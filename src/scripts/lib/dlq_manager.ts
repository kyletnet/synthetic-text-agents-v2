import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Dead Letter Queue Manager
 * Handles failed items with exponential backoff and retry logic
 * Implements P0/P1/P2-aware retry policies
 */

export interface DLQItem {
  id: string;
  run_id: string;
  item_id: string;
  original_data: any;
  error_type: 'TRANSIENT' | 'PERMANENT' | 'POLICY';
  error_message: string;
  first_failure_timestamp: string;
  last_retry_timestamp: string;
  retry_count: number;
  max_retries: number;
  backoff_ms: number;
  next_retry_timestamp: string;
  context: {
    agent_role?: string;
    profile: string;
    cost_budget_remaining?: number;
    timeout_ms?: number;
  };
}

export interface RetryConfig {
  max_retries: number;
  initial_backoff_ms: number;
  max_backoff_ms: number;
  backoff_multiplier: number;
  retry_jitter_pct: number;
}

export interface DLQStats {
  total_items: number;
  transient_errors: number;
  permanent_errors: number;
  policy_errors: number;
  pending_retries: number;
  exhausted_retries: number;
  success_after_retry: number;
}

export class DLQManager {
  private dlqDir: string;
  private retryConfig: RetryConfig;

  constructor(baseDir?: string) {
    this.dlqDir = join(baseDir || process.cwd(), 'reports', 'dlq');
    this.ensureDirectoryExists();

    this.retryConfig = {
      max_retries: 3,
      initial_backoff_ms: 1000,
      max_backoff_ms: 30000,
      backoff_multiplier: 2.0,
      retry_jitter_pct: 10
    };
  }

  private ensureDirectoryExists(): void {
    if (!existsSync(this.dlqDir)) {
      mkdirSync(this.dlqDir, { recursive: true });
    }
  }

  /**
   * Add failed item to DLQ with appropriate error classification
   */
  addFailedItem(
    runId: string,
    itemId: string,
    originalData: any,
    error: Error,
    context: any = {}
  ): DLQItem {
    const errorType = this.classifyError(error);
    const maxRetries = this.getMaxRetriesForErrorType(errorType);
    const backoffMs = this.calculateBackoff(0);

    const dlqItem: DLQItem = {
      id: `${runId}_${itemId}_${Date.now()}`,
      run_id: runId,
      item_id: itemId,
      original_data: originalData,
      error_type: errorType,
      error_message: error.message,
      first_failure_timestamp: new Date().toISOString(),
      last_retry_timestamp: new Date().toISOString(),
      retry_count: 0,
      max_retries: maxRetries,
      backoff_ms: backoffMs,
      next_retry_timestamp: new Date(Date.now() + backoffMs).toISOString(),
      context: {
        profile: context.profile || 'dev',
        agent_role: context.agent_role,
        cost_budget_remaining: context.cost_budget_remaining,
        timeout_ms: context.timeout_ms
      }
    };

    this.writeDLQItem(runId, dlqItem);
    return dlqItem;
  }

  /**
   * Classify error type for retry strategy
   */
  private classifyError(error: Error): 'TRANSIENT' | 'PERMANENT' | 'POLICY' {
    const message = error.message.toLowerCase();

    // P0 Policy violations - never retry
    if (message.includes('pii') ||
        message.includes('license') ||
        message.includes('copyright') ||
        message.includes('policy violation')) {
      return 'POLICY';
    }

    // Permanent errors - don't retry
    if (message.includes('invalid input') ||
        message.includes('malformed') ||
        message.includes('authentication failed') ||
        message.includes('permission denied') ||
        error.name === 'ValidationError') {
      return 'PERMANENT';
    }

    // Transient errors - retry with backoff
    if (message.includes('429') ||           // Rate limit
        message.includes('rate limit') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('503') ||           // Service unavailable
        message.includes('502') ||           // Bad gateway
        message.includes('500') ||           // Internal server error
        error.name === 'TimeoutError' ||
        error.name === 'NetworkError') {
      return 'TRANSIENT';
    }

    // Default to permanent for unknown errors
    return 'PERMANENT';
  }

  /**
   * Get max retries based on error type
   */
  private getMaxRetriesForErrorType(errorType: 'TRANSIENT' | 'PERMANENT' | 'POLICY'): number {
    switch (errorType) {
      case 'TRANSIENT': return this.retryConfig.max_retries;
      case 'PERMANENT': return 0;
      case 'POLICY': return 0;
      default: return 0;
    }
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff(retryCount: number): number {
    const baseBackoff = Math.min(
      this.retryConfig.initial_backoff_ms * Math.pow(this.retryConfig.backoff_multiplier, retryCount),
      this.retryConfig.max_backoff_ms
    );

    // Add jitter to prevent thundering herd
    const jitter = baseBackoff * (this.retryConfig.retry_jitter_pct / 100);
    const jitterAmount = (Math.random() - 0.5) * 2 * jitter;

    return Math.max(100, Math.floor(baseBackoff + jitterAmount));
  }

  /**
   * Write DLQ item to file
   */
  private writeDLQItem(runId: string, dlqItem: DLQItem): void {
    const filePath = join(this.dlqDir, `${runId}.jsonl`);
    const line = JSON.stringify(dlqItem) + '\n';

    try {
      writeFileSync(filePath, line, { flag: 'a' });
    } catch (error) {
      console.error(`Failed to write DLQ item to ${filePath}:`, error);
    }
  }

  /**
   * Get all pending retries that are ready to be processed
   */
  getPendingRetries(runId?: string): DLQItem[] {
    const now = new Date();
    const pendingItems: DLQItem[] = [];

    try {
      const files = runId ? [`${runId}.jsonl`] : this.getAllDLQFiles();

      for (const file of files) {
        const filePath = join(this.dlqDir, file);
        if (!existsSync(filePath)) continue;

        const content = readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const item: DLQItem = JSON.parse(line);

            // Check if item is ready for retry
            if (item.retry_count < item.max_retries &&
                new Date(item.next_retry_timestamp) <= now) {
              pendingItems.push(item);
            }
          } catch (error) {
            console.warn(`Failed to parse DLQ line: ${line}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to get pending retries:', error);
    }

    return pendingItems;
  }

  /**
   * Mark retry attempt for item
   */
  markRetryAttempt(dlqItem: DLQItem, success: boolean, error?: Error): DLQItem | null {
    const updatedItem = { ...dlqItem };
    updatedItem.retry_count++;
    updatedItem.last_retry_timestamp = new Date().toISOString();

    if (success) {
      // Remove from DLQ on success
      this.removeDLQItem(dlqItem.run_id, dlqItem.id);
      return null;
    }

    // Update for next retry if retries remaining
    if (updatedItem.retry_count < updatedItem.max_retries) {
      updatedItem.backoff_ms = this.calculateBackoff(updatedItem.retry_count);
      updatedItem.next_retry_timestamp = new Date(Date.now() + updatedItem.backoff_ms).toISOString();

      if (error) {
        updatedItem.error_message = error.message;
        updatedItem.error_type = this.classifyError(error);
      }

      // Update the DLQ file
      this.updateDLQItem(updatedItem);
      return updatedItem;
    }

    // Mark as exhausted (no more retries)
    updatedItem.next_retry_timestamp = 'exhausted';
    this.updateDLQItem(updatedItem);
    return updatedItem;
  }

  /**
   * Update existing DLQ item in file
   */
  private updateDLQItem(updatedItem: DLQItem): void {
    const filePath = join(this.dlqDir, `${updatedItem.run_id}.jsonl`);

    try {
      if (!existsSync(filePath)) return;

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      const updatedLines: string[] = [];
      let found = false;

      for (const line of lines) {
        try {
          const item: DLQItem = JSON.parse(line);
          if (item.id === updatedItem.id) {
            updatedLines.push(JSON.stringify(updatedItem));
            found = true;
          } else {
            updatedLines.push(line);
          }
        } catch (error) {
          updatedLines.push(line); // Keep malformed lines as-is
        }
      }

      if (!found) {
        updatedLines.push(JSON.stringify(updatedItem));
      }

      writeFileSync(filePath, updatedLines.join('\n') + '\n');
    } catch (error) {
      console.error(`Failed to update DLQ item ${updatedItem.id}:`, error);
    }
  }

  /**
   * Remove DLQ item from file
   */
  private removeDLQItem(runId: string, itemId: string): void {
    const filePath = join(this.dlqDir, `${runId}.jsonl`);

    try {
      if (!existsSync(filePath)) return;

      const content = readFileSync(filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      const filteredLines: string[] = [];

      for (const line of lines) {
        try {
          const item: DLQItem = JSON.parse(line);
          if (item.id !== itemId) {
            filteredLines.push(line);
          }
        } catch (error) {
          filteredLines.push(line); // Keep malformed lines as-is
        }
      }

      if (filteredLines.length === 0) {
        // Remove empty file
        require('fs').unlinkSync(filePath);
      } else {
        writeFileSync(filePath, filteredLines.join('\n') + '\n');
      }
    } catch (error) {
      console.error(`Failed to remove DLQ item ${itemId}:`, error);
    }
  }

  /**
   * Get all DLQ files
   */
  private getAllDLQFiles(): string[] {
    try {
      return require('fs').readdirSync(this.dlqDir)
        .filter((file: string) => file.endsWith('.jsonl'));
    } catch (error) {
      console.error('Failed to list DLQ files:', error);
      return [];
    }
  }

  /**
   * Get DLQ statistics
   */
  getDLQStats(runId?: string): DLQStats {
    const stats: DLQStats = {
      total_items: 0,
      transient_errors: 0,
      permanent_errors: 0,
      policy_errors: 0,
      pending_retries: 0,
      exhausted_retries: 0,
      success_after_retry: 0
    };

    try {
      const files = runId ? [`${runId}.jsonl`] : this.getAllDLQFiles();
      const now = new Date();

      for (const file of files) {
        const filePath = join(this.dlqDir, file);
        if (!existsSync(filePath)) continue;

        const content = readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const item: DLQItem = JSON.parse(line);
            stats.total_items++;

            switch (item.error_type) {
              case 'TRANSIENT': stats.transient_errors++; break;
              case 'PERMANENT': stats.permanent_errors++; break;
              case 'POLICY': stats.policy_errors++; break;
            }

            if (item.next_retry_timestamp === 'exhausted') {
              stats.exhausted_retries++;
            } else if (item.retry_count < item.max_retries &&
                       new Date(item.next_retry_timestamp) <= now) {
              stats.pending_retries++;
            }

            if (item.retry_count > 0) {
              stats.success_after_retry++;
            }
          } catch (error) {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      console.error('Failed to calculate DLQ stats:', error);
    }

    return stats;
  }

  /**
   * Clean up old DLQ entries (older than specified days)
   */
  cleanupOldEntries(maxAgeInDays: number = 7): number {
    const cutoffDate = new Date(Date.now() - maxAgeInDays * 24 * 60 * 60 * 1000);
    let removedCount = 0;

    try {
      const files = this.getAllDLQFiles();

      for (const file of files) {
        const filePath = join(this.dlqDir, file);
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(line => line.trim());
        const remainingLines: string[] = [];

        for (const line of lines) {
          try {
            const item: DLQItem = JSON.parse(line);
            const itemDate = new Date(item.first_failure_timestamp);

            if (itemDate >= cutoffDate) {
              remainingLines.push(line);
            } else {
              removedCount++;
            }
          } catch (error) {
            remainingLines.push(line); // Keep malformed lines
          }
        }

        if (remainingLines.length === 0) {
          require('fs').unlinkSync(filePath);
        } else {
          writeFileSync(filePath, remainingLines.join('\n') + '\n');
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old DLQ entries:', error);
    }

    return removedCount;
  }
}

/**
 * Factory function to create DLQ manager
 */
export function createDLQManager(baseDir?: string): DLQManager {
  return new DLQManager(baseDir);
}

/**
 * Wrapper function for retry logic with DLQ
 */
export async function withRetryAndDLQ<T>(
  operation: () => Promise<T>,
  runId: string,
  itemId: string,
  originalData: any,
  context: any = {},
  dlqManager?: DLQManager
): Promise<T | null> {
  const manager = dlqManager || new DLQManager();

  try {
    return await operation();
  } catch (error) {
    console.warn(`Operation failed for item ${itemId}:`, (error as any)?.message ?? error);

    // Add to DLQ for potential retry
    const dlqItem = manager.addFailedItem(runId, itemId, originalData, error as Error, context);

    console.log(`Added item ${itemId} to DLQ with ${dlqItem.max_retries} max retries`);
    return null;
  }
}