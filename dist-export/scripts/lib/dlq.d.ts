interface DLQEntry {
  run_id: string;
  timestamp: string;
  target: string;
  mode: string;
  reason: string;
  exit_code: number;
  top_fail_reasons: string[];
  budget_usd?: string;
  cost_usd?: string;
  session_id?: string;
  notes?: string;
}
export declare class DLQManager {
  private readonly dlqDir;
  private readonly indexPath;
  constructor();
  /**
   * Ensure DLQ directory structure exists
   */
  private ensureDLQDirectory;
  /**
   * Add a failed run to DLQ
   */
  toDLQ(
    runId: string,
    reason: string,
    exitCode: number,
    artifacts?: string[],
    options?: {
      target?: string;
      mode?: string;
      sessionId?: string;
      budgetUsd?: string;
      costUsd?: string;
      notes?: string;
    },
  ): void;
  /**
   * Copy directory recursively
   */
  private copyDirectory;
  /**
   * Extract failure reasons from context
   */
  private extractFailReasons;
  /**
   * Append entry to DLQ index
   */
  private appendToIndex;
  /**
   * Get DLQ statistics
   */
  getDLQStats(): {
    totalEntries: number;
    recentEntries: DLQEntry[];
    topFailReasons: {
      reason: string;
      count: number;
    }[];
  };
  /**
   * Clean up old DLQ entries (keep last N days)
   */
  cleanupOldEntries(keepDays?: number): void;
  /**
   * Rebuild DLQ index based on existing directories
   */
  private rebuildIndex;
}
export {};
//# sourceMappingURL=dlq.d.ts.map
