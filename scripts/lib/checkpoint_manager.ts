import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

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
  checkpoint_type: 'full' | 'incremental' | 'emergency';

  // Progress tracking
  progress: {
    total_items: number;
    completed_items: number;
    failed_items: number;
    last_processed_index: number;
    completion_percentage: number;
  };

  // State preservation
  state: {
    manifest_hash?: string;
    seed_value?: number;
    budget_state?: any;
    threshold_config?: any;
    agent_states?: { [agentId: string]: any };
  };

  // Processing results
  results: {
    processed_items: ProcessedItem[];
    metrics_summary?: any;
    error_summary?: any;
  };

  // Recovery metadata
  recovery_info: {
    recovery_strategy: 'resume' | 'restart' | 'skip_failed';
    recovery_point: string;
    data_integrity_hash: string;
    dependencies: string[];
  };
}

export interface ProcessedItem {
  item_id: string;
  item_index: number;
  status: 'completed' | 'failed' | 'skipped';
  timestamp: string;
  result_hash?: string;
  error_message?: string;
  processing_time_ms?: number;
  cost_usd?: number;
}

export interface RecoveryPlan {
  can_recover: boolean;
  recovery_strategy: 'resume' | 'restart' | 'partial_restart';
  recovery_point: number;
  items_to_reprocess: number[];
  integrity_check_passed: boolean;
  estimated_time_saved_ms: number;
  recommendations: string[];
}

export interface CheckpointConfig {
  checkpoint_interval: number;  // Items between checkpoints
  auto_checkpoint_enabled: boolean;
  max_checkpoints_to_keep: number;
  compression_enabled: boolean;
  integrity_checks_enabled: boolean;
}

export class CheckpointManager {
  private checkpointDir: string;
  private config: CheckpointConfig;

  constructor(baseDir?: string, config?: Partial<CheckpointConfig>) {
    this.checkpointDir = join(baseDir || process.cwd(), 'reports', 'checkpoints');
    this.ensureDirectoryExists();

    this.config = {
      checkpoint_interval: 10,
      auto_checkpoint_enabled: true,
      max_checkpoints_to_keep: 5,
      compression_enabled: false,
      integrity_checks_enabled: true,
      ...config
    };
  }

  private ensureDirectoryExists(): void {
    if (!existsSync(this.checkpointDir)) {
      mkdirSync(this.checkpointDir, { recursive: true });
    }
  }

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
    checkpointType: 'full' | 'incremental' | 'emergency' = 'incremental'
  ): CheckpointData {
    const checkpointId = this.generateCheckpointId(runId, checkpointType);
    const timestamp = new Date().toISOString();

    const checkpoint: CheckpointData = {
      checkpoint_id: checkpointId,
      run_id: runId,
      session_id: sessionId,
      created_timestamp: timestamp,
      checkpoint_type: checkpointType,

      progress: {
        ...progress,
        completion_percentage: progress.total_items > 0
          ? (progress.completed_items / progress.total_items) * 100
          : 0
      },

      state: {
        ...state,
        checkpoint_timestamp: timestamp
      },

      results: {
        processed_items: processedItems,
        metrics_summary: this.generateMetricsSummary(processedItems),
        error_summary: this.generateErrorSummary(processedItems)
      },

      recovery_info: {
        recovery_strategy: 'resume',
        recovery_point: `item_${progress.last_processed_index}`,
        data_integrity_hash: this.calculateDataIntegrityHash(processedItems, state),
        dependencies: this.extractDependencies(state)
      }
    };

    this.saveCheckpoint(checkpoint);
    this.cleanupOldCheckpoints(runId);

    console.log(`💾 Checkpoint created: ${checkpointId} (${progress.completed_items}/${progress.total_items} items)`);

    return checkpoint;
  }

  /**
   * Create emergency checkpoint (for unexpected termination)
   */
  createEmergencyCheckpoint(
    runId: string,
    sessionId: string,
    currentState: any,
    errorDetails: { error: Error; context: any }
  ): CheckpointData {
    console.log(`🚨 Creating emergency checkpoint for run ${runId}...`);

    const processedItems = this.extractProcessedItemsFromState(currentState);
    const progress = this.calculateProgressFromItems(processedItems, currentState.total_items || 0);

    const emergencyState = {
      ...currentState,
      emergency_info: {
        error_message: errorDetails.error.message,
        error_stack: errorDetails.error.stack,
        error_context: errorDetails.context,
        termination_timestamp: new Date().toISOString(),
        termination_reason: 'unexpected_error'
      }
    };

    return this.createCheckpoint(
      runId,
      sessionId,
      progress,
      emergencyState,
      processedItems,
      'emergency'
    );
  }

  /**
   * Load the latest checkpoint for a run
   */
  loadLatestCheckpoint(runId: string): CheckpointData | null {
    try {
      const checkpoints = this.listCheckpoints(runId);
      if (checkpoints.length === 0) {
        return null;
      }

      // Sort by creation time and get the latest
      const latestCheckpoint = checkpoints.sort((a, b) =>
        new Date(b.created_timestamp).getTime() - new Date(a.created_timestamp).getTime()
      )[0];

      return this.loadCheckpoint(latestCheckpoint.checkpoint_id);
    } catch (error) {
      console.error(`Failed to load latest checkpoint for run ${runId}:`, error);
      return null;
    }
  }

  /**
   * Load specific checkpoint
   */
  loadCheckpoint(checkpointId: string): CheckpointData | null {
    const checkpointPath = join(this.checkpointDir, `${checkpointId}.json`);

    try {
      if (existsSync(checkpointPath)) {
        const content = readFileSync(checkpointPath, 'utf-8');
        const checkpoint = JSON.parse(content) as CheckpointData;

        // Verify integrity if enabled
        if (this.config.integrity_checks_enabled) {
          const isValid = this.verifyCheckpointIntegrity(checkpoint);
          if (!isValid) {
            console.warn(`Checkpoint ${checkpointId} failed integrity check`);
            return null;
          }
        }

        return checkpoint;
      }
    } catch (error) {
      console.error(`Failed to load checkpoint ${checkpointId}:`, error);
    }

    return null;
  }

  /**
   * Analyze recovery options for a run
   */
  analyzeRecoveryOptions(runId: string): RecoveryPlan {
    const checkpoint = this.loadLatestCheckpoint(runId);

    if (!checkpoint) {
      return {
        can_recover: false,
        recovery_strategy: 'restart',
        recovery_point: 0,
        items_to_reprocess: [],
        integrity_check_passed: false,
        estimated_time_saved_ms: 0,
        recommendations: ['No checkpoint found - must restart from beginning']
      };
    }

    const integrityPassed = this.verifyCheckpointIntegrity(checkpoint);
    const completedItems = checkpoint.results.processed_items.filter(item => item.status === 'completed');
    const failedItems = checkpoint.results.processed_items.filter(item => item.status === 'failed');

    const recoveryPoint = checkpoint.progress.last_processed_index;
    const itemsToReprocess = this.determineItemsToReprocess(checkpoint);

    // Estimate time savings
    const avgProcessingTime = completedItems.length > 0
      ? completedItems.reduce((sum, item) => sum + (item.processing_time_ms || 0), 0) / completedItems.length
      : 1000;

    const estimatedTimeSaved = completedItems.length * avgProcessingTime;

    // Determine recovery strategy
    let recoveryStrategy: 'resume' | 'restart' | 'partial_restart';
    let recommendations: string[] = [];

    if (!integrityPassed) {
      recoveryStrategy = 'restart';
      recommendations.push('Checkpoint integrity check failed - recommend full restart');
    } else if (failedItems.length > completedItems.length * 0.3) {
      recoveryStrategy = 'partial_restart';
      recommendations.push('High failure rate detected - recommend partial restart from last stable point');
    } else {
      recoveryStrategy = 'resume';
      recommendations.push('Checkpoint looks good - can resume from last processed item');
    }

    if (checkpoint.checkpoint_type === 'emergency') {
      recommendations.push('Emergency checkpoint detected - review error details before recovery');
    }

    return {
      can_recover: integrityPassed,
      recovery_strategy: recoveryStrategy,
      recovery_point: recoveryPoint,
      items_to_reprocess: itemsToReprocess,
      integrity_check_passed: integrityPassed,
      estimated_time_saved_ms: estimatedTimeSaved,
      recommendations
    };
  }

  /**
   * Execute recovery based on recovery plan
   */
  executeRecovery(runId: string, recoveryPlan: RecoveryPlan): {
    recovered_state: any;
    items_to_process: number[];
    recovery_metadata: any;
  } {
    const checkpoint = this.loadLatestCheckpoint(runId);
    if (!checkpoint) {
      throw new Error(`No checkpoint found for run ${runId}`);
    }

    console.log(`🔄 Executing recovery for run ${runId} using strategy: ${recoveryPlan.recovery_strategy}`);

    let itemsToProcess: number[] = [];
    let recoveredState = checkpoint.state;

    switch (recoveryPlan.recovery_strategy) {
      case 'resume':
        // Resume from last processed item
        itemsToProcess = this.getItemsAfterIndex(checkpoint.progress.last_processed_index, checkpoint.progress.total_items);
        break;

      case 'partial_restart':
        // Restart from last stable checkpoint
        const stablePoint = this.findLastStablePoint(checkpoint);
        itemsToProcess = this.getItemsAfterIndex(stablePoint, checkpoint.progress.total_items);
        recoveredState = this.cleanStateForPartialRestart(recoveredState, stablePoint);
        break;

      case 'restart':
        // Full restart
        itemsToProcess = Array.from({ length: checkpoint.progress.total_items }, (_, i) => i);
        recoveredState = this.resetStateForRestart(recoveredState);
        break;
    }

    const recoveryMetadata = {
      checkpoint_id: checkpoint.checkpoint_id,
      recovery_timestamp: new Date().toISOString(),
      recovery_strategy: recoveryPlan.recovery_strategy,
      items_recovered: checkpoint.progress.completed_items,
      items_to_reprocess: itemsToProcess.length,
      estimated_time_saved_ms: recoveryPlan.estimated_time_saved_ms
    };

    console.log(`✅ Recovery executed: ${checkpoint.progress.completed_items} items recovered, ${itemsToProcess.length} items to process`);

    return {
      recovered_state: recoveredState,
      items_to_process: itemsToProcess,
      recovery_metadata: recoveryMetadata
    };
  }

  /**
   * Check if auto-checkpoint should be created
   */
  shouldCreateCheckpoint(itemsProcessed: number): boolean {
    if (!this.config.auto_checkpoint_enabled) {
      return false;
    }

    return itemsProcessed > 0 && itemsProcessed % this.config.checkpoint_interval === 0;
  }

  /**
   * Generate checkpoint ID
   */
  private generateCheckpointId(runId: string, type: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substring(2, 6);
    return `${runId}_${type}_${timestamp}_${random}`;
  }

  /**
   * Save checkpoint to file
   */
  private saveCheckpoint(checkpoint: CheckpointData): void {
    const checkpointPath = join(this.checkpointDir, `${checkpoint.checkpoint_id}.json`);

    try {
      const content = JSON.stringify(checkpoint, null, 2);

      // Atomic write using temp file
      const tempPath = checkpointPath + '.tmp';
      writeFileSync(tempPath, content);
      require('fs').renameSync(tempPath, checkpointPath);

      console.log(`💾 Checkpoint saved: ${checkpointPath}`);
    } catch (error) {
      console.error(`Failed to save checkpoint ${checkpoint.checkpoint_id}:`, error);
      throw error;
    }
  }

  /**
   * List all checkpoints for a run
   */
  listCheckpoints(runId: string): CheckpointData[] {
    try {
      const files = require('fs').readdirSync(this.checkpointDir)
        .filter((file: string) => file.startsWith(runId) && file.endsWith('.json'));

      const checkpoints: CheckpointData[] = [];

      for (const file of files) {
        try {
          const content = readFileSync(join(this.checkpointDir, file), 'utf-8');
          const checkpoint = JSON.parse(content) as CheckpointData;
          checkpoints.push(checkpoint);
        } catch (error) {
          console.warn(`Failed to parse checkpoint file ${file}:`, error);
        }
      }

      return checkpoints;
    } catch (error) {
      console.error(`Failed to list checkpoints for run ${runId}:`, error);
      return [];
    }
  }

  /**
   * Clean up old checkpoints
   */
  private cleanupOldCheckpoints(runId: string): void {
    try {
      const checkpoints = this.listCheckpoints(runId);

      if (checkpoints.length <= this.config.max_checkpoints_to_keep) {
        return;
      }

      // Sort by creation time (newest first)
      const sortedCheckpoints = checkpoints.sort((a, b) =>
        new Date(b.created_timestamp).getTime() - new Date(a.created_timestamp).getTime()
      );

      // Keep the newest ones, delete the rest
      const checkpointsToDelete = sortedCheckpoints.slice(this.config.max_checkpoints_to_keep);

      for (const checkpoint of checkpointsToDelete) {
        const checkpointPath = join(this.checkpointDir, `${checkpoint.checkpoint_id}.json`);
        try {
          require('fs').unlinkSync(checkpointPath);
          console.log(`🗑️ Deleted old checkpoint: ${checkpoint.checkpoint_id}`);
        } catch (error) {
          console.warn(`Failed to delete checkpoint ${checkpoint.checkpoint_id}:`, error);
        }
      }
    } catch (error) {
      console.error(`Failed to cleanup old checkpoints for run ${runId}:`, error);
    }
  }

  /**
   * Calculate data integrity hash
   */
  private calculateDataIntegrityHash(processedItems: ProcessedItem[], state: any): string {
    const crypto = require('crypto');

    const dataToHash = {
      processed_items_count: processedItems.length,
      completed_items: processedItems.filter(item => item.status === 'completed').length,
      failed_items: processedItems.filter(item => item.status === 'failed').length,
      state_keys: Object.keys(state).sort(),
      last_item_hash: processedItems.length > 0 ? processedItems[processedItems.length - 1].result_hash : null
    };

    return crypto.createHash('sha256').update(JSON.stringify(dataToHash)).digest('hex').substring(0, 16);
  }

  /**
   * Verify checkpoint integrity
   */
  private verifyCheckpointIntegrity(checkpoint: CheckpointData): boolean {
    try {
      const expectedHash = this.calculateDataIntegrityHash(
        checkpoint.results.processed_items,
        checkpoint.state
      );

      const integrityMatch = expectedHash === checkpoint.recovery_info.data_integrity_hash;

      // Additional consistency checks
      const itemsCountMatch = checkpoint.results.processed_items.length === checkpoint.progress.completed_items + checkpoint.progress.failed_items;

      const progressConsistency = checkpoint.progress.completion_percentage <=
        (checkpoint.progress.completed_items / checkpoint.progress.total_items) * 100 + 1; // Allow 1% tolerance

      return integrityMatch && itemsCountMatch && progressConsistency;
    } catch (error) {
      console.error('Error verifying checkpoint integrity:', error);
      return false;
    }
  }

  /**
   * Helper methods
   */
  private generateMetricsSummary(processedItems: ProcessedItem[]): any {
    const completedItems = processedItems.filter(item => item.status === 'completed');
    const failedItems = processedItems.filter(item => item.status === 'failed');

    const totalCost = completedItems.reduce((sum, item) => sum + (item.cost_usd || 0), 0);
    const totalTime = completedItems.reduce((sum, item) => sum + (item.processing_time_ms || 0), 0);

    return {
      total_items: processedItems.length,
      completed_items: completedItems.length,
      failed_items: failedItems.length,
      success_rate: processedItems.length > 0 ? completedItems.length / processedItems.length : 0,
      total_cost_usd: totalCost,
      total_time_ms: totalTime,
      avg_cost_per_item: completedItems.length > 0 ? totalCost / completedItems.length : 0,
      avg_time_per_item: completedItems.length > 0 ? totalTime / completedItems.length : 0
    };
  }

  private generateErrorSummary(processedItems: ProcessedItem[]): any {
    const failedItems = processedItems.filter(item => item.status === 'failed');

    const errorCounts = new Map<string, number>();
    failedItems.forEach(item => {
      const errorType = item.error_message?.split(':')[0] || 'unknown';
      errorCounts.set(errorType, (errorCounts.get(errorType) || 0) + 1);
    });

    return {
      total_failures: failedItems.length,
      error_types: Array.from(errorCounts.entries()).map(([type, count]) => ({ type, count })),
      failure_rate: processedItems.length > 0 ? failedItems.length / processedItems.length : 0
    };
  }

  private extractDependencies(state: any): string[] {
    const dependencies: string[] = [];

    if (state.manifest_hash) dependencies.push(`manifest:${state.manifest_hash}`);
    if (state.seed_value) dependencies.push(`seed:${state.seed_value}`);
    if (state.threshold_config) dependencies.push('threshold_config');
    if (state.budget_state) dependencies.push('budget_state');

    return dependencies;
  }

  private extractProcessedItemsFromState(state: any): ProcessedItem[] {
    return state.processed_items || [];
  }

  private calculateProgressFromItems(processedItems: ProcessedItem[], totalItems: number): any {
    const completedItems = processedItems.filter(item => item.status === 'completed').length;
    const failedItems = processedItems.filter(item => item.status === 'failed').length;
    const lastIndex = processedItems.length > 0 ? Math.max(...processedItems.map(item => item.item_index)) : -1;

    return {
      total_items: totalItems,
      completed_items: completedItems,
      failed_items: failedItems,
      last_processed_index: lastIndex
    };
  }

  private determineItemsToReprocess(checkpoint: CheckpointData): number[] {
    const failedItems = checkpoint.results.processed_items
      .filter(item => item.status === 'failed')
      .map(item => item.item_index);

    return failedItems;
  }

  private getItemsAfterIndex(lastIndex: number, totalItems: number): number[] {
    const items: number[] = [];
    for (let i = lastIndex + 1; i < totalItems; i++) {
      items.push(i);
    }
    return items;
  }

  private findLastStablePoint(checkpoint: CheckpointData): number {
    const processedItems = checkpoint.results.processed_items;

    // Find the last sequence of successful items
    for (let i = processedItems.length - 1; i >= 0; i--) {
      if (processedItems[i].status === 'completed') {
        return processedItems[i].item_index;
      }
    }

    return -1; // No stable point found
  }

  private cleanStateForPartialRestart(state: any, stablePoint: number): any {
    // Remove state related to items after the stable point
    const cleanedState = { ...state };

    if (cleanedState.processed_items) {
      cleanedState.processed_items = cleanedState.processed_items.filter(
        (item: ProcessedItem) => item.item_index <= stablePoint
      );
    }

    return cleanedState;
  }

  private resetStateForRestart(state: any): any {
    // Reset state for full restart while preserving configuration
    const resetState = {
      manifest_hash: state.manifest_hash,
      seed_value: state.seed_value,
      threshold_config: state.threshold_config,
      // Remove all processing-related state
      processed_items: [],
      budget_state: null,
      agent_states: {}
    };

    return resetState;
  }
}

/**
 * Factory function to create checkpoint manager
 */
export function createCheckpointManager(baseDir?: string, config?: Partial<CheckpointConfig>): CheckpointManager {
  return new CheckpointManager(baseDir, config);
}

/**
 * Convenience functions for checkpoint integration
 */
export const CheckpointUtils = {
  /**
   * Wrap operation with automatic checkpointing
   */
  withCheckpointing: async <T>(
    operation: () => Promise<T>,
    checkpointManager: CheckpointManager,
    context: {
      runId: string;
      sessionId: string;
      itemIndex: number;
      totalItems: number;
    }
  ): Promise<T> => {
    try {
      const result = await operation();

      // Check if checkpoint should be created
      if (checkpointManager.shouldCreateCheckpoint(context.itemIndex + 1)) {
        // This would need more context about current state and processed items
        console.log(`📍 Auto-checkpoint trigger at item ${context.itemIndex + 1}`);
      }

      return result;
    } catch (error) {
      // Create emergency checkpoint on error
      try {
        checkpointManager.createEmergencyCheckpoint(
          context.runId,
          context.sessionId,
          { current_item_index: context.itemIndex, total_items: context.totalItems },
          { error: error as Error, context }
        );
      } catch (checkpointError) {
        console.error('Failed to create emergency checkpoint:', checkpointError);
      }

      throw error;
    }
  }
};