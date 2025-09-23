/**
 * Checkpoint Manager
 * Handles checkpoint creation and recovery for baseline runs
 * Ensures idempotent operations and resumable execution
 */
export interface CheckpointData {
  checkpoint_id: string;
  run_id: string;
  session_id: string;
  created_timestamp: string;
  checkpoint_type: "full" | "incremental" | "emergency";
  progress: {
    total_items: number;
    completed_items: number;
    failed_items: number;
    last_processed_index: number;
    completion_percentage: number;
  };
  state: {
    manifest_hash?: string;
    seed_value?: number;
    budget_state?: any;
    threshold_config?: any;
    agent_states?: {
      [agentId: string]: any;
    };
  };
  results: {
    processed_items: ProcessedItem[];
    metrics_summary?: any;
    error_summary?: any;
  };
  recovery_info: {
    recovery_strategy: "resume" | "restart" | "skip_failed";
    recovery_point: string;
    data_integrity_hash: string;
    dependencies: string[];
  };
}
export interface ProcessedItem {
  item_id: string;
  item_index: number;
  status: "completed" | "failed" | "skipped";
  timestamp: string;
  result_hash?: string;
  error_message?: string;
  processing_time_ms?: number;
  cost_usd?: number;
}
export interface RecoveryPlan {
  can_recover: boolean;
  recovery_strategy: "resume" | "restart" | "partial_restart";
  recovery_point: number;
  items_to_reprocess: number[];
  integrity_check_passed: boolean;
  estimated_time_saved_ms: number;
  recommendations: string[];
}
export interface CheckpointConfig {
  checkpoint_interval: number;
  auto_checkpoint_enabled: boolean;
  max_checkpoints_to_keep: number;
  compression_enabled: boolean;
  integrity_checks_enabled: boolean;
}
export declare class CheckpointManager {
  private checkpointDir;
  private config;
  constructor(baseDir?: string, config?: Partial<CheckpointConfig>);
  private ensureDirectoryExists;
  /**
   * Create a new checkpoint
   */
  createCheckpoint(
    runId: string,
    sessionId: string,
    progress: {
      total_items: number;
      completed_items: number;
      failed_items: number;
      last_processed_index: number;
    },
    state: any,
    processedItems: ProcessedItem[],
    checkpointType?: "full" | "incremental" | "emergency",
  ): CheckpointData;
  /**
   * Create emergency checkpoint (for unexpected termination)
   */
  createEmergencyCheckpoint(
    runId: string,
    sessionId: string,
    currentState: any,
    errorDetails: {
      error: Error;
      context: any;
    },
  ): CheckpointData;
  /**
   * Load the latest checkpoint for a run
   */
  loadLatestCheckpoint(runId: string): CheckpointData | null;
  /**
   * Load specific checkpoint
   */
  loadCheckpoint(checkpointId: string): CheckpointData | null;
  /**
   * Analyze recovery options for a run
   */
  analyzeRecoveryOptions(runId: string): RecoveryPlan;
  /**
   * Execute recovery based on recovery plan
   */
  executeRecovery(
    runId: string,
    recoveryPlan: RecoveryPlan,
  ): {
    recovered_state: any;
    items_to_process: number[];
    recovery_metadata: any;
  };
  /**
   * Check if auto-checkpoint should be created
   */
  shouldCreateCheckpoint(itemsProcessed: number): boolean;
  /**
   * Generate checkpoint ID
   */
  private generateCheckpointId;
  /**
   * Save checkpoint to file
   */
  private saveCheckpoint;
  /**
   * List all checkpoints for a run
   */
  listCheckpoints(runId: string): CheckpointData[];
  /**
   * Clean up old checkpoints
   */
  private cleanupOldCheckpoints;
  /**
   * Calculate data integrity hash
   */
  private calculateDataIntegrityHash;
  /**
   * Verify checkpoint integrity
   */
  private verifyCheckpointIntegrity;
  /**
   * Helper methods
   */
  private generateMetricsSummary;
  private generateErrorSummary;
  private extractDependencies;
  private extractProcessedItemsFromState;
  private calculateProgressFromItems;
  private determineItemsToReprocess;
  private getItemsAfterIndex;
  private findLastStablePoint;
  private cleanStateForPartialRestart;
  private resetStateForRestart;
}
/**
 * Factory function to create checkpoint manager
 */
export declare function createCheckpointManager(
  baseDir?: string,
  config?: Partial<CheckpointConfig>,
): CheckpointManager;
/**
 * Convenience functions for checkpoint integration
 */
export declare const CheckpointUtils: {
  /**
   * Wrap operation with automatic checkpointing
   */
  withCheckpointing: <T>(
    operation: () => Promise<T>,
    checkpointManager: CheckpointManager,
    context: {
      runId: string;
      sessionId: string;
      itemIndex: number;
      totalItems: number;
    },
  ) => Promise<T>;
};
//# sourceMappingURL=checkpoint_manager.d.ts.map
