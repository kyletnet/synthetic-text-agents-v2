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
  error_type: "TRANSIENT" | "PERMANENT" | "POLICY";
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
export declare class DLQManager {
  private dlqDir;
  private retryConfig;
  constructor(baseDir?: string);
  private ensureDirectoryExists;
  /**
   * Add failed item to DLQ with appropriate error classification
   */
  addFailedItem(
    runId: string,
    itemId: string,
    originalData: any,
    error: Error,
    context?: any,
  ): DLQItem;
  /**
   * Classify error type for retry strategy
   */
  private classifyError;
  /**
   * Get max retries based on error type
   */
  private getMaxRetriesForErrorType;
  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff;
  /**
   * Write DLQ item to file
   */
  private writeDLQItem;
  /**
   * Get all pending retries that are ready to be processed
   */
  getPendingRetries(runId?: string): DLQItem[];
  /**
   * Mark retry attempt for item
   */
  markRetryAttempt(
    dlqItem: DLQItem,
    success: boolean,
    error?: Error,
  ): DLQItem | null;
  /**
   * Update existing DLQ item in file
   */
  private updateDLQItem;
  /**
   * Remove DLQ item from file
   */
  private removeDLQItem;
  /**
   * Get all DLQ files
   */
  private getAllDLQFiles;
  /**
   * Get DLQ statistics
   */
  getDLQStats(runId?: string): DLQStats;
  /**
   * Clean up old DLQ entries (older than specified days)
   */
  cleanupOldEntries(maxAgeInDays?: number): number;
}
/**
 * Factory function to create DLQ manager
 */
export declare function createDLQManager(baseDir?: string): DLQManager;
/**
 * Wrapper function for retry logic with DLQ
 */
export declare function withRetryAndDLQ<T>(
  operation: () => Promise<T>,
  runId: string,
  itemId: string,
  originalData: any,
  context?: any,
  dlqManager?: DLQManager,
): Promise<T | null>;
//# sourceMappingURL=dlq_manager.d.ts.map
