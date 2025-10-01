/**
 * Governance Runner - Central orchestrator for all governance operations
 *
 * Purpose:
 * - Execute operations with full governance enforcement
 * - Coordinate preflight checks, snapshots, verification
 * - Handle errors and logging
 *
 * Design:
 * - Wraps any async operation with governance layer
 * - Ensures no operation bypasses rules
 * - Provides consistent error handling
 */

import { PreflightChecker } from "./preflight-checker.js";
import { SnapshotManager } from "./snapshot-manager.js";
import { PostExecutionVerifier } from "./post-execution-verifier.js";
import { OperationLogger } from "./operation-logger.js";
import { SafeExecutor } from "./safe-executor.js";
import type { OperationType } from "./governance-types.js";

export interface GovernanceContext {
  /** Operation name (e.g., "inspect", "maintain", "fix") */
  name: string;

  /** Operation type for timeout policy */
  type: OperationType;

  /** Optional description */
  description?: string;

  /** Skip snapshot (for read-only operations) */
  skipSnapshot?: boolean;

  /** Skip verification (for non-critical operations) */
  skipVerification?: boolean;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export class GovernanceRunner {
  private preflightChecker: PreflightChecker;
  private snapshotManager: SnapshotManager;
  private verifier: PostExecutionVerifier;
  private logger: OperationLogger;
  private safeExecutor: SafeExecutor;

  constructor(projectRoot: string = process.cwd()) {
    this.preflightChecker = new PreflightChecker(projectRoot);
    this.snapshotManager = new SnapshotManager(projectRoot);
    this.verifier = new PostExecutionVerifier(projectRoot);
    this.logger = new OperationLogger(projectRoot);
    this.safeExecutor = new SafeExecutor(projectRoot);
  }

  /**
   * Execute an operation with full governance enforcement
   */
  async executeWithGovernance<T>(
    operation: () => Promise<T>,
    context: GovernanceContext,
  ): Promise<T> {
    const operationId = this.logger.startOperation({
      name: context.name,
      type: context.type,
      description: context.description,
      metadata: context.metadata,
    });

    let beforeSnapshotId: string | undefined;
    let afterSnapshotId: string | undefined;

    try {
      // Phase 1: Preflight checks
      console.log(`\n🔍 Governance: Preflight checks for "${context.name}"`);
      await this.preflightChecker.check({
        name: context.name,
        type: context.type,
      });

      // Phase 2: Snapshot before (if enabled)
      if (!context.skipSnapshot) {
        console.log(`📸 Governance: Capturing before snapshot`);
        const beforeSnapshot = await this.snapshotManager.capture();
        beforeSnapshotId = beforeSnapshot.id;
      }

      // Phase 3: Execute operation with SafeExecutor
      console.log(`⚡ Governance: Executing "${context.name}"`);
      const result = await this.safeExecutor.execute(operation, {
        type: context.type,
      });

      // Phase 4: Snapshot after (if enabled)
      if (!context.skipSnapshot) {
        console.log(`📸 Governance: Capturing after snapshot`);
        const afterSnapshot = await this.snapshotManager.capture();
        afterSnapshotId = afterSnapshot.id;
      }

      // Phase 5: Verification (if enabled)
      if (!context.skipVerification && beforeSnapshotId && afterSnapshotId) {
        console.log(`🔍 Governance: Verifying changes`);
        await this.verifier.verify(
          await this.snapshotManager.load(beforeSnapshotId),
          await this.snapshotManager.load(afterSnapshotId),
          { name: context.name },
        );
      }

      // Phase 6: Log success
      this.logger.endOperation(operationId, "success", {
        snapshots: {
          before: beforeSnapshotId,
          after: afterSnapshotId,
        },
        metadata: context.metadata,
      });

      console.log(`✅ Governance: "${context.name}" completed successfully\n`);
      return result;
    } catch (error) {
      // Log failure
      this.logger.endOperation(operationId, "failure", {
        error: {
          message: (error as Error).message,
          stack: (error as Error).stack,
          type: (error as Error).constructor.name,
        },
        snapshots: {
          before: beforeSnapshotId,
          after: afterSnapshotId,
        },
        metadata: context.metadata,
      });

      console.error(`❌ Governance: "${context.name}" failed\n`);
      throw error;
    }
  }

  /**
   * Execute operation without governance (only for trusted internal operations)
   * WARNING: Use sparingly - this bypasses all safety checks
   */
  async executeWithoutGovernance<T>(
    operation: () => Promise<T>,
    reason: string,
  ): Promise<T> {
    console.warn(
      `⚠️  Governance bypass: Executing without governance (Reason: ${reason})`,
    );

    const operationId = this.logger.startOperation({
      name: "bypass",
      type: "system-command",
      description: `Governance bypass: ${reason}`,
      metadata: { bypassReason: reason },
    });

    try {
      const result = await operation();

      this.logger.endOperation(operationId, "success", {
        bypassReason: reason,
      });

      return result;
    } catch (error) {
      this.logger.endOperation(operationId, "failure", {
        error: {
          message: (error as Error).message,
          stack: (error as Error).stack,
        },
        bypassReason: reason,
      });

      throw error;
    }
  }

  /**
   * Get governance statistics
   */
  async getStatistics(): Promise<{
    totalOperations: number;
    successRate: number;
    failureCount: number;
    bypassCount: number;
  }> {
    const logs = await this.logger.query({
      page: 1,
      pageSize: 1000,
    });

    const successCount = logs.logs.filter((l) => l.status === "success").length;
    const failureCount = logs.logs.filter((l) => l.status === "failure").length;
    const bypassCount = logs.logs.filter(
      (l) => l.operation === "bypass",
    ).length;

    return {
      totalOperations: logs.total,
      successRate: logs.total > 0 ? successCount / logs.total : 0,
      failureCount,
      bypassCount,
    };
  }
}

/**
 * Global singleton instance
 */
let globalGovernanceRunner: GovernanceRunner | null = null;

export function getGovernanceRunner(projectRoot?: string): GovernanceRunner {
  if (!globalGovernanceRunner) {
    globalGovernanceRunner = new GovernanceRunner(projectRoot);
  }
  return globalGovernanceRunner;
}
