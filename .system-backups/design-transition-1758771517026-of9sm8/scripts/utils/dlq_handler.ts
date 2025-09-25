/**
 * Dead Letter Queue (DLQ) Handler
 * Implements AC-2: DLQ & retry policy system
 *
 * - Handles 429/5xx/timeout errors with exponential backoff
 * - Records failures after 3+ attempts to reports/dlq/*.jsonl
 * - Provides retry-dlq command for reprocessing failed items
 */

import * as fs from "fs";
import * as path from "path";

export interface RetryableError {
  type: "rate_limit" | "server_error" | "timeout" | "network_error" | "unknown";
  status_code?: number;
  message: string;
  retryable: boolean;
}

export interface DLQEntry {
  id: string;
  run_id: string;
  item_id: string;
  agent_role: string;
  timestamp: string;
  attempt_count: number;
  max_attempts: number;
  original_request: any;
  last_error: RetryableError;
  failure_history: Array<{
    attempt: number;
    timestamp: string;
    error: RetryableError;
    backoff_ms: number;
  }>;
  cost_usd: number;
  latency_ms: number;
  metadata: Record<string, any>;
}

export interface RetryPolicy {
  max_attempts: number;
  initial_backoff_ms: number;
  max_backoff_ms: number;
  backoff_multiplier: number;
  jitter_factor: number;
  retryable_status_codes: number[];
  retryable_error_patterns: string[];
}

export class DLQHandler {
  private retryPolicy: RetryPolicy;
  private dlqDirectory: string;

  constructor(dlqDirectory: string = "reports/dlq") {
    this.dlqDirectory = dlqDirectory;
    this.retryPolicy = this.getDefaultRetryPolicy();
    this.ensureDLQDirectory();
  }

  private getDefaultRetryPolicy(): RetryPolicy {
    return {
      max_attempts: 3,
      initial_backoff_ms: 1000, // Start with 1 second
      max_backoff_ms: 30000, // Cap at 30 seconds
      backoff_multiplier: 2.0, // Exponential backoff
      jitter_factor: 0.1, // 10% jitter to prevent thundering herd
      retryable_status_codes: [429, 500, 502, 503, 504], // Rate limits and server errors
      retryable_error_patterns: [
        "timeout",
        "ECONNRESET",
        "ECONNREFUSED",
        "ETIMEDOUT",
        "socket hang up",
        "network timeout",
      ],
    };
  }

  private ensureDLQDirectory(): void {
    if (!fs.existsSync(this.dlqDirectory)) {
      fs.mkdirSync(this.dlqDirectory, { recursive: true });
    }
  }

  /**
   * Classify an error to determine if it's retryable
   */
  public classifyError(error: any): RetryableError {
    let errorType: RetryableError["type"] = "unknown";
    let retryable = false;
    const message = String(error?.message || error || "Unknown error");
    const statusCode =
      error?.response?.status || error?.status || error?.statusCode;

    // Check status codes
    if (statusCode) {
      if (statusCode === 429) {
        errorType = "rate_limit";
        retryable = true;
      } else if (statusCode >= 500 && statusCode < 600) {
        errorType = "server_error";
        retryable =
          this.retryPolicy.retryable_status_codes.includes(statusCode);
      }
    }

    // Check error message patterns
    for (const pattern of this.retryPolicy.retryable_error_patterns) {
      if (message.toLowerCase().includes(pattern.toLowerCase())) {
        if (pattern.includes("timeout")) {
          errorType = "timeout";
        } else {
          errorType = "network_error";
        }
        retryable = true;
        break;
      }
    }

    return {
      type: errorType,
      status_code: statusCode,
      message: message.slice(0, 500), // Truncate long messages
      retryable,
    };
  }

  /**
   * Calculate backoff delay with jitter
   */
  private calculateBackoff(attempt: number): number {
    const exponentialBackoff = Math.min(
      this.retryPolicy.initial_backoff_ms *
        Math.pow(this.retryPolicy.backoff_multiplier, attempt - 1),
      this.retryPolicy.max_backoff_ms,
    );

    // Add jitter to prevent thundering herd
    const jitter =
      exponentialBackoff * this.retryPolicy.jitter_factor * Math.random();

    return Math.round(exponentialBackoff + jitter);
  }

  /**
   * Execute a function with retry logic
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      run_id: string;
      item_id: string;
      agent_role: string;
      operation_name: string;
      request_data?: any;
      metadata?: Record<string, any>;
    },
  ): Promise<T> {
    let lastError: any;
    const failureHistory: DLQEntry["failure_history"] = [];

    for (let attempt = 1; attempt <= this.retryPolicy.max_attempts; attempt++) {
      const attemptStart = Date.now();

      try {
        const result = await operation();

        // Log successful retry if this wasn't the first attempt
        if (attempt > 1) {
          console.log(
            `[DLQ] Retry successful on attempt ${attempt} for ${context.operation_name} (${context.item_id})`,
          );
        }

        return result;
      } catch (error) {
        lastError = error;
        const classifiedError = this.classifyError(error);
        const latencyMs = Date.now() - attemptStart;

        console.log(
          `[DLQ] Attempt ${attempt}/${this.retryPolicy.max_attempts} failed for ${context.operation_name}: ${classifiedError.message}`,
        );

        // Record failure
        const backoffMs = this.calculateBackoff(attempt);
        failureHistory.push({
          attempt,
          timestamp: new Date().toISOString(),
          error: classifiedError,
          backoff_ms: backoffMs,
        });

        // If this isn't retryable, fail immediately
        if (!classifiedError.retryable) {
          console.log(
            `[DLQ] Non-retryable error, failing immediately: ${classifiedError.type}`,
          );
          break;
        }

        // If this is the last attempt, break without waiting
        if (attempt === this.retryPolicy.max_attempts) {
          break;
        }

        // Wait for backoff period
        console.log(
          `[DLQ] Backing off for ${backoffMs}ms before retry ${attempt + 1}`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    // All retries failed, add to DLQ
    await this.addToDLQ({
      run_id: context.run_id,
      item_id: context.item_id,
      agent_role: context.agent_role,
      original_request: context.request_data,
      last_error: this.classifyError(lastError),
      failure_history: failureHistory,
      metadata: context.metadata || {},
    });

    throw lastError;
  }

  /**
   * Add a failed item to the DLQ
   */
  private async addToDLQ(params: {
    run_id: string;
    item_id: string;
    agent_role: string;
    original_request: any;
    last_error: RetryableError;
    failure_history: DLQEntry["failure_history"];
    metadata: Record<string, any>;
  }): Promise<void> {
    const dlqEntry: DLQEntry = {
      id: `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      run_id: params.run_id,
      item_id: params.item_id,
      agent_role: params.agent_role,
      timestamp: new Date().toISOString(),
      attempt_count: this.retryPolicy.max_attempts,
      max_attempts: this.retryPolicy.max_attempts,
      original_request: params.original_request,
      last_error: params.last_error,
      failure_history: params.failure_history,
      cost_usd: 0, // Will be updated by cost tracking
      latency_ms: params.failure_history.reduce(
        (sum, f) => sum + (f.backoff_ms || 0),
        0,
      ),
      metadata: {
        ...params.metadata,
        dlq_timestamp: new Date().toISOString(),
        retry_policy: this.retryPolicy,
      },
    };

    // Write to date-specific DLQ file
    const today = new Date().toISOString().split("T")[0];
    const dlqFile = path.join(this.dlqDirectory, `dlq_${today}.jsonl`);

    try {
      fs.appendFileSync(dlqFile, JSON.stringify(dlqEntry) + "\n");
      console.log(`[DLQ] Added entry to DLQ: ${dlqFile} (ID: ${dlqEntry.id})`);
    } catch (error) {
      console.error(`[DLQ] Failed to write DLQ entry: ${error}`);
    }
  }

  /**
   * List all DLQ entries for a specific date range
   */
  public listDLQEntries(startDate?: string, endDate?: string): DLQEntry[] {
    const entries: DLQEntry[] = [];

    if (!fs.existsSync(this.dlqDirectory)) {
      return entries;
    }

    const dlqFiles = fs
      .readdirSync(this.dlqDirectory)
      .filter((file) => file.startsWith("dlq_") && file.endsWith(".jsonl"))
      .sort();

    for (const file of dlqFiles) {
      const filePath = path.join(this.dlqDirectory, file);

      try {
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content
          .trim()
          .split("\n")
          .filter((line) => line);

        for (const line of lines) {
          const entry: DLQEntry = JSON.parse(line);

          // Apply date filtering if provided
          if (startDate && entry.timestamp < startDate) continue;
          if (endDate && entry.timestamp > endDate) continue;

          entries.push(entry);
        }
      } catch (error) {
        console.error(`[DLQ] Failed to read DLQ file ${file}: ${error}`);
      }
    }

    return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Retry failed DLQ entries
   */
  public async retryDLQEntries(
    filter: {
      run_id?: string;
      agent_role?: string;
      error_type?: string;
      max_age_hours?: number;
    } = {},
    retryHandler: (entry: DLQEntry) => Promise<boolean>,
  ): Promise<{ attempted: number; succeeded: number; failed: number }> {
    const entries = this.listDLQEntries();

    // Apply filters
    const filteredEntries = entries.filter((entry) => {
      if (filter.run_id && entry.run_id !== filter.run_id) return false;
      if (filter.agent_role && entry.agent_role !== filter.agent_role)
        return false;
      if (filter.error_type && entry.last_error.type !== filter.error_type)
        return false;

      if (filter.max_age_hours) {
        const entryAge = Date.now() - new Date(entry.timestamp).getTime();
        const maxAge = filter.max_age_hours * 60 * 60 * 1000;
        if (entryAge > maxAge) return false;
      }

      return true;
    });

    console.log(`[DLQ] Retrying ${filteredEntries.length} DLQ entries`);

    let succeeded = 0;
    let failed = 0;

    for (const entry of filteredEntries) {
      try {
        console.log(
          `[DLQ] Retrying entry ${entry.id} (${entry.agent_role}:${entry.item_id})`,
        );
        const success = await retryHandler(entry);

        if (success) {
          succeeded++;
          // Move entry to processed directory
          await this.archiveDLQEntry(entry);
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`[DLQ] Retry failed for entry ${entry.id}: ${error}`);
        failed++;
      }
    }

    console.log(
      `[DLQ] Retry complete: ${succeeded} succeeded, ${failed} failed out of ${filteredEntries.length} attempted`,
    );

    return {
      attempted: filteredEntries.length,
      succeeded,
      failed,
    };
  }

  /**
   * Archive a successfully processed DLQ entry
   */
  private async archiveDLQEntry(entry: DLQEntry): Promise<void> {
    const archiveDir = path.join(this.dlqDirectory, "processed");
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const today = new Date().toISOString().split("T")[0];
    const archiveFile = path.join(archiveDir, `processed_${today}.jsonl`);

    try {
      const archivedEntry = {
        ...entry,
        processed_timestamp: new Date().toISOString(),
        status: "retry_succeeded",
      };

      fs.appendFileSync(archiveFile, JSON.stringify(archivedEntry) + "\n");

      // TODO: Remove from original DLQ file (requires more complex file manipulation)
      console.log(`[DLQ] Archived processed entry: ${entry.id}`);
    } catch (error) {
      console.error(`[DLQ] Failed to archive entry ${entry.id}: ${error}`);
    }
  }

  /**
   * Get DLQ statistics
   */
  public getDLQStatistics(): {
    total_entries: number;
    by_error_type: Record<string, number>;
    by_agent_role: Record<string, number>;
    by_run_id: Record<string, number>;
    oldest_entry: string;
    newest_entry: string;
  } {
    const entries = this.listDLQEntries();

    const stats = {
      total_entries: entries.length,
      by_error_type: {} as Record<string, number>,
      by_agent_role: {} as Record<string, number>,
      by_run_id: {} as Record<string, number>,
      oldest_entry: entries.length > 0 ? entries[0].timestamp : "",
      newest_entry:
        entries.length > 0 ? entries[entries.length - 1].timestamp : "",
    };

    for (const entry of entries) {
      // Count by error type
      const errorType = entry.last_error.type;
      stats.by_error_type[errorType] =
        (stats.by_error_type[errorType] || 0) + 1;

      // Count by agent role
      stats.by_agent_role[entry.agent_role] =
        (stats.by_agent_role[entry.agent_role] || 0) + 1;

      // Count by run ID
      stats.by_run_id[entry.run_id] = (stats.by_run_id[entry.run_id] || 0) + 1;
    }

    return stats;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const dlq = new DLQHandler();

  if (command === "list") {
    const entries = dlq.listDLQEntries();
    console.log(JSON.stringify(entries, null, 2));
  } else if (command === "stats") {
    const stats = dlq.getDLQStatistics();
    console.log(JSON.stringify(stats, null, 2));
  } else if (command === "retry") {
    const runId = args[1];
    const agentRole = args[2];

    dlq
      .retryDLQEntries(
        { run_id: runId, agent_role: agentRole },
        async (entry) => {
          console.log(
            `Would retry: ${entry.id} - ${entry.agent_role}:${entry.item_id}`,
          );
          // Mock retry success for CLI demo
          return true;
        },
      )
      .then((result) => {
        console.log("Retry complete:", result);
      })
      .catch((error) => {
        console.error("Retry failed:", error);
        process.exit(1);
      });
  } else {
    console.log("DLQ Handler CLI");
    console.log("Commands:");
    console.log("  list                 - List all DLQ entries");
    console.log("  stats                - Show DLQ statistics");
    console.log("  retry [run_id] [role] - Retry failed entries");
  }
}
