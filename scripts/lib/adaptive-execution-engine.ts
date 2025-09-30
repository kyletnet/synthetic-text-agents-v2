#!/usr/bin/env tsx

/**
 * Adaptive Execution Engine
 * Executes operations using Smart Decision Matrix for optimal performance-safety-usability balance
 * Implements the adaptive execution strategies from the system philosophy analysis
 */

import {
  smartDecisionMatrix,
  ExecutionContext,
  DecisionResult,
} from "./smart-decision-matrix.js";
import { perfCache } from "./performance-cache.js";
import { safeGuard } from "./safe-automation-guard.js";
import { approvalSystem } from "./interactive-approval-system.js";
import { ComponentAdapter } from "./component-integration-adapter.js";
import { processLifecycleManager } from "./process-lifecycle-manager.js";
import { execSync } from "child_process";
import { performance } from "perf_hooks";
import { EventEmitter } from "events";

export interface AdaptiveOperation {
  id: string;
  name: string;
  command: string;
  type:
    | "typecheck"
    | "lint"
    | "test"
    | "audit"
    | "evolution"
    | "build"
    | "analysis";
  priority: "P0" | "P1" | "P2";
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult {
  operationId: string;
  success: boolean;
  duration: number;
  strategy: string;
  output?: string;
  error?: string;
  performance: {
    cpuUsage: number;
    memoryUsage: number;
    cacheHits: number;
  };
  userInteraction: {
    approvalsRequested: number;
    progressUpdates: number;
    userSatisfaction?: number;
  };
}

export interface ProgressCallback {
  (progress: {
    operationId: string;
    stage: string;
    percentage: number;
    message: string;
  }): void;
}

export class AdaptiveExecutionEngine extends EventEmitter {
  private activeOperations: Map<
    string,
    {
      operation: AdaptiveOperation;
      context: ExecutionContext;
      decision: DecisionResult;
      startTime: number;
      controller?: AbortController;
    }
  > = new Map();

  private executionQueue: Array<{
    operation: AdaptiveOperation;
    context: ExecutionContext;
    resolve: (result: ExecutionResult) => void;
    reject: (error: Error) => void;
  }> = [];

  private systemMetrics = {
    cpuLoad: 0,
    memoryUsage: 0,
    activeUsers: 0,
    queueLength: 0,
  };

  constructor() {
    super();
    this.setMaxListeners(50);
    this.startSystemMonitoring();
    this.startQueueProcessor();
  }

  /**
   * Execute an operation with adaptive strategy selection
   */
  async execute(
    operation: AdaptiveOperation,
    context?: Partial<ExecutionContext>,
    progressCallback?: ProgressCallback,
  ): Promise<ExecutionResult> {
    const fullContext: ExecutionContext = {
      priority: operation.priority,
      userPresent: false,
      systemLoad: this.getCurrentSystemLoad(),
      timeConstraints: "moderate",
      errorTolerance: "low",
      automationLevel: "supervised",
      ...context,
    };

    // Get decision from Smart Decision Matrix
    const decision = await smartDecisionMatrix.makeDecision(
      operation.name,
      fullContext,
    );

    console.log(`🎯 Adaptive execution for ${operation.name}:`);
    console.log(`   Strategy: ${decision.execution}`);
    console.log(`   Reasoning: ${decision.reasoning}`);
    console.log(
      `   Trade-offs: P=${Math.round(decision.tradeoffs.performance * 100)}% S=${Math.round(decision.tradeoffs.safety * 100)}% U=${Math.round(decision.tradeoffs.usability * 100)}%`,
    );

    const startTime = performance.now();

    // Register active operation
    const controller = new AbortController();
    this.activeOperations.set(operation.id, {
      operation,
      context: fullContext,
      decision,
      startTime,
      controller,
    });

    try {
      // Execute based on selected strategy
      const result = await this.executeWithStrategy(
        operation,
        decision,
        fullContext,
        progressCallback,
      );

      // Record outcome for learning
      smartDecisionMatrix.recordOutcome(operation.name, {
        duration: result.duration,
        success: result.success,
        userFeedback: result.userInteraction?.userSatisfaction,
      });

      // Update safety guard
      await safeGuard.recordAttempt(
        operation.command,
        result.success,
        result.duration,
        result.error,
      );

      this.emit("execution:completed", result);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorResult: ExecutionResult = {
        operationId: operation.id,
        success: false,
        duration,
        strategy: decision.execution,
        error: error instanceof Error ? error.message : String(error),
        performance: {
          cpuUsage: 0,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
          cacheHits: 0,
        },
        userInteraction: {
          approvalsRequested: 0,
          progressUpdates: 0,
        },
      };

      // Record failure for learning
      smartDecisionMatrix.recordOutcome(operation.name, {
        duration,
        success: false,
      });

      await safeGuard.recordAttempt(
        operation.command,
        false,
        duration,
        errorResult.error,
      );

      this.emit("execution:failed", errorResult);
      throw error;
    } finally {
      this.activeOperations.delete(operation.id);
    }
  }

  /**
   * Execute multiple operations with intelligent coordination
   */
  async executeBatch(
    operations: AdaptiveOperation[],
    context?: Partial<ExecutionContext>,
    progressCallback?: ProgressCallback,
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];
    const fullContext: ExecutionContext = {
      priority: "P2",
      userPresent: false,
      systemLoad: this.getCurrentSystemLoad(),
      timeConstraints: "moderate",
      errorTolerance: "medium",
      automationLevel: "autonomous",
      ...context,
    };

    // Analyze operations for dependencies and optimal sequencing
    const executionPlan = this.planBatchExecution(operations, fullContext);

    console.log(`📋 Executing batch of ${operations.length} operations`);
    console.log(`   Execution plan: ${executionPlan.strategy}`);
    console.log(
      `   Estimated duration: ${Math.round(executionPlan.estimatedDuration / 1000)}s`,
    );

    let completed = 0;
    const totalOperations = operations.length;

    try {
      switch (executionPlan.strategy) {
        case "sequential":
          for (const operation of executionPlan.sequence) {
            progressCallback?.({
              operationId: "batch",
              stage: operation.name,
              percentage: (completed / totalOperations) * 100,
              message: `Executing ${operation.name} (${completed + 1}/${totalOperations})`,
            });

            const result = await this.execute(
              operation,
              fullContext,
              progressCallback,
            );
            results.push(result);
            completed++;
          }
          break;

        case "parallel":
          const promises = executionPlan.sequence.map(
            async (operation, index) => {
              const result = await this.execute(
                operation,
                fullContext,
                (progress) => {
                  progressCallback?.({
                    ...progress,
                    operationId: "batch",
                    percentage: ((completed + index) / totalOperations) * 100,
                  });
                },
              );
              completed++;
              return result;
            },
          );

          const parallelResults = await Promise.allSettled(promises);
          parallelResults.forEach((result) => {
            if (result.status === "fulfilled") {
              results.push(result.value);
            } else {
              // Create error result for failed operation
              results.push({
                operationId: "unknown",
                success: false,
                duration: 0,
                strategy: "parallel",
                error: result.reason?.message || "Unknown error",
                performance: { cpuUsage: 0, memoryUsage: 0, cacheHits: 0 },
                userInteraction: { approvalsRequested: 0, progressUpdates: 0 },
              });
            }
          });
          break;

        case "hybrid":
          // Execute critical operations sequentially first
          const criticalOps = executionPlan.sequence.filter(
            (op) => op.priority === "P0",
          );
          for (const operation of criticalOps) {
            const result = await this.execute(
              operation,
              fullContext,
              progressCallback,
            );
            results.push(result);
            completed++;
          }

          // Execute remaining operations in parallel
          const remainingOps = executionPlan.sequence.filter(
            (op) => op.priority !== "P0",
          );
          if (remainingOps.length > 0) {
            const promises = remainingOps.map(async (operation) => {
              const result = await this.execute(
                operation,
                fullContext,
                progressCallback,
              );
              completed++;
              return result;
            });

            const remainingResults = await Promise.allSettled(promises);
            remainingResults.forEach((result) => {
              if (result.status === "fulfilled") {
                results.push(result.value);
              }
            });
          }
          break;
      }

      progressCallback?.({
        operationId: "batch",
        stage: "Complete",
        percentage: 100,
        message: `Batch execution complete: ${results.filter((r) => r.success).length}/${totalOperations} successful`,
      });

      return results;
    } catch (error) {
      console.error("Batch execution failed:", error);
      throw error;
    }
  }

  /**
   * Get current system status and active operations
   */
  getStatus(): {
    activeOperations: number;
    queuedOperations: number;
    systemLoad: string;
    recommendations: string[];
  } {
    const recommendations = [];

    if (this.activeOperations.size > 5) {
      recommendations.push(
        "High number of active operations - consider queuing",
      );
    }

    if (this.systemMetrics.queueLength > 10) {
      recommendations.push(
        "Queue backup detected - consider increasing parallelism",
      );
    }

    const recentRecommendations =
      smartDecisionMatrix.getOptimizationRecommendations();
    recommendations.push(...recentRecommendations.map((r) => r.recommendation));

    return {
      activeOperations: this.activeOperations.size,
      queuedOperations: this.executionQueue.length,
      systemLoad: this.getCurrentSystemLoad(),
      recommendations,
    };
  }

  private async executeWithStrategy(
    operation: AdaptiveOperation,
    decision: DecisionResult,
    context: ExecutionContext,
    progressCallback?: ProgressCallback,
  ): Promise<ExecutionResult> {
    const startTime = performance.now();
    let approvalsRequested = 0;
    let progressUpdates = 0;
    let cacheHits = 0;

    // Handle user interaction based on configuration
    if (decision.configuration.userInteraction === "approval") {
      approvalsRequested++;
      const approved = await this.requestUserApproval(operation, decision);
      if (!approved) {
        throw new Error("User approval denied");
      }
    }

    // Check cache if appropriate
    let cachedResult = null;
    if (
      decision.execution !== "user-guided" &&
      operation.type !== "evolution"
    ) {
      const cacheKey = `${operation.name}-${JSON.stringify(operation.metadata)}`;
      cachedResult = await perfCache.get(cacheKey, {
        ttl: this.getCacheTTL(operation.type),
        checkFileChanges: true,
        filePaths: this.getRelevantFiles(operation),
      });

      if (cachedResult) {
        cacheHits = 1;
        console.log(`   💾 Using cached result for ${operation.name}`);

        return {
          operationId: operation.id,
          success: true,
          duration: performance.now() - startTime,
          strategy: decision.execution,
          output: cachedResult as string,
          performance: {
            cpuUsage: 0,
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
            cacheHits,
          },
          userInteraction: {
            approvalsRequested,
            progressUpdates,
          },
        };
      }
    }

    // Execute based on strategy
    let result;
    switch (decision.execution) {
      case "immediate":
        result = await this.executeImmediate(
          operation,
          decision,
          progressCallback,
        );
        break;

      case "optimized":
        result = await this.executeOptimized(
          operation,
          decision,
          progressCallback,
        );
        break;

      case "safe-mode":
        result = await this.executeSafeMode(
          operation,
          decision,
          progressCallback,
        );
        break;

      case "user-guided":
        result = await this.executeUserGuided(
          operation,
          decision,
          progressCallback,
        );
        progressUpdates += 5; // User-guided has more interaction
        break;

      case "deferred":
        result = await this.executeDeferred(operation, decision);
        break;

      default:
        throw new Error(`Unknown execution strategy: ${decision.execution}`);
    }

    // Cache successful results
    if (result.success && !cachedResult && operation.type !== "evolution") {
      const cacheKey = `${operation.name}-${JSON.stringify(operation.metadata)}`;
      await perfCache.set(cacheKey, result.output || "success", {
        ttl: this.getCacheTTL(operation.type),
      });
    }

    return {
      operationId: result.operationId || operation.id,
      success: result.success ?? false,
      duration: result.duration ?? 0,
      strategy: result.strategy ?? "unknown",
      output: result.output,
      error: result.error,
      performance: {
        cpuUsage: this.systemMetrics.cpuLoad,
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        cacheHits,
      },
      userInteraction: {
        approvalsRequested,
        progressUpdates:
          progressUpdates + (result.userInteraction?.progressUpdates || 0),
      },
    };
  }

  private async executeImmediate(
    operation: AdaptiveOperation,
    decision: DecisionResult,
    progressCallback?: ProgressCallback,
  ): Promise<Partial<ExecutionResult>> {
    progressCallback?.({
      operationId: operation.id,
      stage: "Executing",
      percentage: 10,
      message: `Immediate execution: ${operation.name}`,
    });

    const startTime = performance.now();

    try {
      const output = execSync(operation.command, {
        encoding: "utf8",
        timeout: decision.configuration.timeoutMs,
        maxBuffer: 1024 * 1024, // 1MB buffer
        stdio: "pipe",
      });

      progressCallback?.({
        operationId: operation.id,
        stage: "Complete",
        percentage: 100,
        message: "Execution completed successfully",
      });

      return {
        success: true,
        duration: performance.now() - startTime,
        strategy: "immediate",
        output: output.trim(),
        userInteraction: { approvalsRequested: 0, progressUpdates: 2 },
      };
    } catch (error) {
      return {
        success: false,
        duration: performance.now() - startTime,
        strategy: "immediate",
        error: error instanceof Error ? error.message : String(error),
        userInteraction: { approvalsRequested: 0, progressUpdates: 1 },
      };
    }
  }

  private async executeOptimized(
    operation: AdaptiveOperation,
    decision: DecisionResult,
    progressCallback?: ProgressCallback,
  ): Promise<Partial<ExecutionResult>> {
    const startTime = performance.now();
    let attempts = 0;
    let lastError: string | undefined;

    while (attempts < decision.configuration.retries + 1) {
      attempts++;

      progressCallback?.({
        operationId: operation.id,
        stage: `Attempt ${attempts}`,
        percentage: (attempts / (decision.configuration.retries + 1)) * 80,
        message: `Optimized execution attempt ${attempts}`,
      });

      try {
        const child = processLifecycleManager.spawnManaged(
          operation.command.split(" ")[0],
          operation.command.split(" ").slice(1),
          {
            stdio: "pipe",
            timeout: decision.configuration.timeoutMs,
          },
        );

        let output = "";
        let error = "";

        child.stdout?.on("data", (data) => {
          output += data.toString();
        });

        child.stderr?.on("data", (data) => {
          error += data.toString();
        });

        await new Promise<void>((resolve, reject) => {
          child.on("close", (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Command failed with code ${code}: ${error}`));
            }
          });

          child.on("error", reject);
        });

        progressCallback?.({
          operationId: operation.id,
          stage: "Complete",
          percentage: 100,
          message: "Optimized execution completed",
        });

        return {
          success: true,
          duration: performance.now() - startTime,
          strategy: "optimized",
          output: output.trim(),
          userInteraction: {
            approvalsRequested: 0,
            progressUpdates: attempts + 1,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempts < decision.configuration.retries + 1) {
          console.log(`   🔄 Retry ${attempts} failed, retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
        }
      }
    }

    return {
      success: false,
      duration: performance.now() - startTime,
      strategy: "optimized",
      error: lastError,
      userInteraction: { approvalsRequested: 0, progressUpdates: attempts },
    };
  }

  private async executeSafeMode(
    operation: AdaptiveOperation,
    decision: DecisionResult,
    progressCallback?: ProgressCallback,
  ): Promise<Partial<ExecutionResult>> {
    const startTime = performance.now();

    // Extra validation in safe mode
    progressCallback?.({
      operationId: operation.id,
      stage: "Validation",
      percentage: 20,
      message: "Running safety validation checks",
    });

    const safetyCheck = await safeGuard.canExecuteAutomation(operation.command);
    if (!safetyCheck.allowed) {
      return {
        success: false,
        duration: performance.now() - startTime,
        strategy: "safe-mode",
        error: `Safety check failed: ${safetyCheck.reason}`,
        userInteraction: { approvalsRequested: 0, progressUpdates: 1 },
      };
    }

    // Slower, more careful execution
    progressCallback?.({
      operationId: operation.id,
      stage: "Executing",
      percentage: 50,
      message: "Safe mode execution with extra monitoring",
    });

    try {
      const output = execSync(operation.command, {
        encoding: "utf8",
        timeout: decision.configuration.timeoutMs,
        stdio: "pipe",
      });

      progressCallback?.({
        operationId: operation.id,
        stage: "Complete",
        percentage: 100,
        message: "Safe execution completed successfully",
      });

      return {
        success: true,
        duration: performance.now() - startTime,
        strategy: "safe-mode",
        output: output.trim(),
        userInteraction: { approvalsRequested: 0, progressUpdates: 3 },
      };
    } catch (error) {
      return {
        success: false,
        duration: performance.now() - startTime,
        strategy: "safe-mode",
        error: error instanceof Error ? error.message : String(error),
        userInteraction: { approvalsRequested: 0, progressUpdates: 2 },
      };
    }
  }

  private async executeUserGuided(
    operation: AdaptiveOperation,
    decision: DecisionResult,
    progressCallback?: ProgressCallback,
  ): Promise<Partial<ExecutionResult>> {
    const startTime = performance.now();

    // User controls the execution
    console.log(`🤝 User-guided execution for ${operation.name}`);
    console.log(`   Command: ${operation.command}`);

    const proceed = await approvalSystem.quickApproval(
      `Execute ${operation.name}? Command: ${operation.command}`,
    );

    if (!proceed) {
      return {
        success: false,
        duration: performance.now() - startTime,
        strategy: "user-guided",
        error: "User chose not to proceed",
        userInteraction: { approvalsRequested: 1, progressUpdates: 1 },
      };
    }

    // Execute with user in control
    try {
      const output = execSync(operation.command, {
        encoding: "utf8",
        stdio: "inherit", // User sees real-time output
      });

      return {
        success: true,
        duration: performance.now() - startTime,
        strategy: "user-guided",
        output: "User-guided execution completed",
        userInteraction: {
          approvalsRequested: 1,
          progressUpdates: 0,
          userSatisfaction: 0.9,
        },
      };
    } catch (error) {
      return {
        success: false,
        duration: performance.now() - startTime,
        strategy: "user-guided",
        error: error instanceof Error ? error.message : String(error),
        userInteraction: {
          approvalsRequested: 1,
          progressUpdates: 0,
          userSatisfaction: 0.3,
        },
      };
    }
  }

  private async executeDeferred(
    operation: AdaptiveOperation,
    decision: DecisionResult,
  ): Promise<Partial<ExecutionResult>> {
    // Add to queue for later execution
    return new Promise((resolve, reject) => {
      this.executionQueue.push({
        operation,
        context: {
          // Default context for deferred operations
          priority: operation.priority,
          userPresent: false,
          systemLoad: "low",
          timeConstraints: "none",
          errorTolerance: "medium",
          automationLevel: "autonomous",
        },
        resolve: (result) =>
          resolve({
            success: result.success,
            duration: result.duration,
            strategy: "deferred",
            output: result.output,
            error: result.error,
            userInteraction: { approvalsRequested: 0, progressUpdates: 0 },
          }),
        reject,
      });

      this.systemMetrics.queueLength = this.executionQueue.length;
    });
  }

  private async requestUserApproval(
    operation: AdaptiveOperation,
    decision: DecisionResult,
  ): Promise<boolean> {
    const result = await approvalSystem.requestApproval({
      title: operation.name,
      description: `Execute operation with ${decision.execution} strategy`,
      command: operation.command,
      riskLevel: this.getRiskLevel(operation),
      impact: `Strategy: ${decision.execution}, Expected duration: ${Math.round(decision.expectedOutcome.duration / 1000)}s`,
    });

    return result.approved;
  }

  private planBatchExecution(
    operations: AdaptiveOperation[],
    context: ExecutionContext,
  ): {
    strategy: "sequential" | "parallel" | "hybrid";
    sequence: AdaptiveOperation[];
    estimatedDuration: number;
  } {
    // Sort by priority and dependencies
    const sortedOps = [...operations].sort((a, b) => {
      const priorityWeight = { P0: 3, P1: 2, P2: 1 };
      return priorityWeight[b.priority] - priorityWeight[a.priority];
    });

    const hasCritical = operations.some((op) => op.priority === "P0");
    const hasHighResource = operations.some((op) =>
      ["audit", "evolution", "build"].includes(op.type),
    );

    let strategy: "sequential" | "parallel" | "hybrid";
    let estimatedDuration = 0;

    if (hasCritical || context.systemLoad === "high") {
      strategy = "sequential";
      estimatedDuration = operations.length * 30000; // 30s per operation
    } else if (hasHighResource) {
      strategy = "hybrid";
      estimatedDuration = operations.length * 20000; // Some parallelism
    } else {
      strategy = "parallel";
      estimatedDuration = Math.max(...operations.map(() => 30000)); // Parallel execution
    }

    return {
      strategy,
      sequence: sortedOps,
      estimatedDuration,
    };
  }

  private getCurrentSystemLoad(): "low" | "medium" | "high" {
    if (this.activeOperations.size > 5 || this.systemMetrics.cpuLoad > 80) {
      return "high";
    } else if (
      this.activeOperations.size > 2 ||
      this.systemMetrics.cpuLoad > 50
    ) {
      return "medium";
    }
    return "low";
  }

  private getRiskLevel(
    operation: AdaptiveOperation,
  ): "low" | "medium" | "high" | "critical" {
    switch (operation.type) {
      case "evolution":
        return "critical";
      case "audit":
        return "medium";
      case "build":
        return "medium";
      case "typecheck":
        return "low";
      case "lint":
        return "low";
      default:
        return "medium";
    }
  }

  private getCacheTTL(type: string): number {
    switch (type) {
      case "typecheck":
        return 2 * 60 * 1000; // 2 minutes
      case "lint":
        return 5 * 60 * 1000; // 5 minutes
      case "test":
        return 10 * 60 * 1000; // 10 minutes
      case "analysis":
        return 30 * 60 * 1000; // 30 minutes
      default:
        return 5 * 60 * 1000; // 5 minutes
    }
  }

  private getRelevantFiles(operation: AdaptiveOperation): string[] {
    // Simple heuristic - can be enhanced
    switch (operation.type) {
      case "typecheck":
        return ["tsconfig.json", "package.json"];
      case "lint":
        return [".eslintrc.js", "package.json"];
      case "test":
        return ["package.json", "jest.config.js"];
      default:
        return ["package.json"];
    }
  }

  private startSystemMonitoring(): void {
    setInterval(() => {
      // Simple CPU monitoring
      const usage = process.cpuUsage();
      this.systemMetrics.cpuLoad = (usage.user + usage.system) / 10000; // Rough estimate

      this.systemMetrics.memoryUsage =
        process.memoryUsage().heapUsed / 1024 / 1024;
      this.systemMetrics.activeUsers = 1; // Placeholder
    }, 10000);
  }

  private startQueueProcessor(): void {
    setInterval(async () => {
      if (
        this.executionQueue.length === 0 ||
        this.getCurrentSystemLoad() === "high"
      ) {
        return;
      }

      const queuedItem = this.executionQueue.shift();
      if (!queuedItem) return;

      this.systemMetrics.queueLength = this.executionQueue.length;

      try {
        const result = await this.execute(
          queuedItem.operation,
          queuedItem.context,
        );
        queuedItem.resolve(result);
      } catch (error) {
        queuedItem.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }, 5000); // Check queue every 5 seconds
  }
}

// Singleton instance for global coordination
export const adaptiveExecutionEngine = new AdaptiveExecutionEngine();
export default AdaptiveExecutionEngine;
