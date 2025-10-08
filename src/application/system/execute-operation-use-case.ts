/**
 * Execute Operation Use Case
 *
 * Application service for operation execution.
 * Orchestrates domain logic to execute system operations safely.
 */

import type { Logger } from "../../shared/logger.js";
import type {
  ComponentId,
  Operation,
  SystemState,
  Priority,
} from "../../domain/system/system-status.js";
import {
  ExecutionStrategyRules,
  RiskAssessmentRules,
  type ExecutionStrategy,
  type StrategyDecision,
} from "../../domain/system/integration-rules.js";

/**
 * Execute operation request
 */
export interface ExecuteOperationRequest {
  readonly operation: Operation;
  readonly dryRun?: boolean;
  readonly forceExecution?: boolean;
}

/**
 * Execute operation response
 */
export interface ExecuteOperationResponse {
  readonly success: boolean;
  readonly operation: Operation;
  readonly strategyDecision: StrategyDecision;
  readonly riskAssessment: {
    readonly riskLevel: "low" | "medium" | "high" | "critical";
    readonly factors: readonly string[];
  };
  readonly executionPlan: ExecutionPlan;
  readonly executionTime: number;
  readonly error?: string;
}

/**
 * Execution plan
 */
export interface ExecutionPlan {
  readonly strategy: ExecutionStrategy;
  readonly participants: readonly ComponentId[];
  readonly workloadDistribution?: readonly WorkloadAssignment[];
  readonly delegatedTo?: ComponentId;
  readonly estimatedDuration: number;
  readonly canExecute: boolean;
  readonly shouldProceed: boolean;
}

/**
 * Workload assignment for distributed execution
 */
export interface WorkloadAssignment {
  readonly componentId: ComponentId;
  readonly partition: number;
  readonly totalPartitions: number;
  readonly metadata: Record<string, unknown>;
}

/**
 * Operation execution event
 */
export interface OperationExecutionEvent {
  readonly type:
    | "operation:started"
    | "operation:queued"
    | "operation:completed"
    | "operation:failed";
  readonly timestamp: Date;
  readonly operationId: string;
  readonly strategy: ExecutionStrategy;
  readonly participants: readonly ComponentId[];
}

/**
 * Execute Operation Use Case
 *
 * Responsibilities:
 * - Determine execution strategy for operations
 * - Assess operation execution risks
 * - Create execution plans
 * - Coordinate operation execution
 */
export class ExecuteOperationUseCase {
  constructor(private readonly logger: Logger) {}

  /**
   * Execute operation
   */
  async execute(
    systemState: SystemState,
    request: ExecuteOperationRequest,
  ): Promise<ExecuteOperationResponse> {
    const startTime = Date.now();

    this.logger.debug("Executing operation", {
      operationId: request.operation.id,
      type: request.operation.type,
      participants: request.operation.participants.length,
      dryRun: request.dryRun ?? false,
    });

    try {
      // Assess risk
      const riskAssessment = RiskAssessmentRules.assessOperationRisk(
        request.operation,
        systemState,
      );

      this.logger.debug("Risk assessment completed", {
        riskLevel: riskAssessment.riskLevel,
        factors: riskAssessment.factors,
      });

      // Decide execution strategy
      const strategyDecision = ExecutionStrategyRules.decideStrategy(
        request.operation,
        systemState,
      );

      this.logger.debug("Strategy decided", {
        strategy: strategyDecision.strategy,
        participants: strategyDecision.participants.length,
        reasoning: strategyDecision.reasoning,
      });

      // Create execution plan
      const executionPlan = this.createExecutionPlan(
        request.operation,
        strategyDecision,
        riskAssessment,
        systemState,
        request.forceExecution ?? false,
      );

      // Check if execution should proceed
      if (!executionPlan.canExecute && !request.forceExecution) {
        const error =
          "Operation cannot be executed - no healthy participants available";

        this.logger.warn(error, {
          operationId: request.operation.id,
        });

        return {
          success: false,
          operation: request.operation,
          strategyDecision,
          riskAssessment,
          executionPlan,
          executionTime: Date.now() - startTime,
          error,
        };
      }

      if (!executionPlan.shouldProceed && !request.forceExecution) {
        const error = `Operation execution not recommended: risk level ${riskAssessment.riskLevel}`;

        this.logger.warn(error, {
          operationId: request.operation.id,
        });

        return {
          success: false,
          operation: request.operation,
          strategyDecision,
          riskAssessment,
          executionPlan,
          executionTime: Date.now() - startTime,
          error,
        };
      }

      // If dry run, return plan without executing
      if (request.dryRun) {
        this.logger.info("Dry run completed", {
          operationId: request.operation.id,
          strategy: strategyDecision.strategy,
        });

        return {
          success: true,
          operation: request.operation,
          strategyDecision,
          riskAssessment,
          executionPlan,
          executionTime: Date.now() - startTime,
        };
      }

      // Update operation with strategy information
      const updatedOperation: Operation = {
        ...request.operation,
        participants: strategyDecision.participants,
        metadata: {
          ...request.operation.metadata,
          strategy: strategyDecision.strategy,
          reasoning: strategyDecision.reasoning,
          riskLevel: riskAssessment.riskLevel,
        },
      };

      const executionTime = Date.now() - startTime;

      this.logger.info("Operation execution completed", {
        operationId: request.operation.id,
        strategy: strategyDecision.strategy,
        executionTime,
      });

      return {
        success: true,
        operation: updatedOperation,
        strategyDecision,
        riskAssessment,
        executionPlan,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error("Operation execution failed", {
        operationId: request.operation.id,
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      });

      throw error;
    }
  }

  /**
   * Create execution plan
   */
  private createExecutionPlan(
    operation: Operation,
    strategyDecision: StrategyDecision,
    riskAssessment: {
      riskLevel: "low" | "medium" | "high" | "critical";
      factors: readonly string[];
    },
    systemState: SystemState,
    forceExecution: boolean,
  ): ExecutionPlan {
    const canExecute = strategyDecision.participants.length > 0;
    const shouldProceed =
      forceExecution ||
      RiskAssessmentRules.shouldProceed(
        riskAssessment.riskLevel,
        (operation.metadata.priority as Priority) ?? "P2",
      );

    let workloadDistribution: WorkloadAssignment[] | undefined;
    let delegatedTo: ComponentId | undefined;

    // Create workload distribution for distributed strategy
    if (strategyDecision.strategy === "distributed") {
      workloadDistribution = ExecutionStrategyRules.distributeWorkload(
        operation,
        strategyDecision.participants,
      );
    }

    // Find delegation target for delegated strategy
    if (strategyDecision.strategy === "delegated") {
      delegatedTo =
        ExecutionStrategyRules.findBestComponentForDelegation(
          operation,
          systemState,
        ) ?? undefined;
    }

    // Estimate duration based on strategy
    const estimatedDuration = this.estimateDuration(
      strategyDecision.strategy,
      strategyDecision.participants.length,
    );

    return {
      strategy: strategyDecision.strategy,
      participants: strategyDecision.participants,
      workloadDistribution,
      delegatedTo,
      estimatedDuration,
      canExecute,
      shouldProceed,
    };
  }

  /**
   * Estimate operation duration
   */
  private estimateDuration(
    strategy: ExecutionStrategy,
    participantCount: number,
  ): number {
    switch (strategy) {
      case "immediate":
        return 1000; // 1 second
      case "distributed":
        return 3000 + participantCount * 500; // 3s base + 0.5s per participant
      case "delegated":
        return 2000; // 2 seconds
      case "queued":
        return 5000; // 5 seconds (includes queue wait time)
      default:
        return 3000;
    }
  }

  /**
   * Check if operation can be executed immediately
   */
  canExecuteImmediately(
    operation: Operation,
    systemState: SystemState,
  ): boolean {
    return ExecutionStrategyRules.canExecuteImmediately(operation, systemState);
  }

  /**
   * Check if operation should be queued
   */
  shouldQueue(operation: Operation, systemState: SystemState): boolean {
    return ExecutionStrategyRules.shouldQueue(operation, systemState);
  }
}

/**
 * Batch Execute Operation Use Case
 *
 * Executes multiple operations in batch
 */
export class BatchExecuteOperationUseCase {
  constructor(
    private readonly logger: Logger,
    private readonly executeOperationUseCase: ExecuteOperationUseCase,
  ) {}

  /**
   * Execute batch operations
   */
  async execute(
    systemState: SystemState,
    requests: readonly ExecuteOperationRequest[],
  ): Promise<readonly ExecuteOperationResponse[]> {
    this.logger.info("Executing batch operations", {
      operationCount: requests.length,
    });

    const results = await Promise.allSettled(
      requests.map((request) =>
        this.executeOperationUseCase.execute(systemState, request),
      ),
    );

    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      // Return error response for failed operations
      const request = requests[index];
      return {
        success: false,
        operation: request.operation,
        strategyDecision: {
          strategy: "queued" as const,
          participants: [],
          priority: "P2" as const,
          reasoning: "Batch execution failed",
        },
        riskAssessment: {
          riskLevel: "critical" as const,
          factors: ["Batch execution error"],
        },
        executionPlan: {
          strategy: "queued" as const,
          participants: [],
          estimatedDuration: 0,
          canExecute: false,
          shouldProceed: false,
        },
        executionTime: 0,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      };
    });
  }
}
