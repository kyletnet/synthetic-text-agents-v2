/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Application: Stage Executor
 * Provides common execution logic for preflight stages
 */

import { Logger } from "../../shared/logger.js";
import {
  StageResult,
  StageContext,
  StageName,
} from "../../domain/preflight/stage-definitions.js";

const logger = new Logger({ level: "info" });

// ============================================================================
// Execution Options
// ============================================================================

export interface ExecutionOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  failFast?: boolean;
}

// ============================================================================
// Stage Executor
// ============================================================================

export class StageExecutor {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ level: "info" });
  }

  /**
   * Execute a stage with timing and error handling
   */
  async executeWithTiming<T>(
    stageName: string,
    operation: () => Promise<T>,
    options: ExecutionOptions = {},
  ): Promise<{ result: T; duration_ms: number }> {
    const startTime = Date.now();

    try {
      let lastError: Error | undefined;
      const maxAttempts = (options.retries || 0) + 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (attempt > 1) {
            this.logger.info(`Retrying stage ${stageName}`, {
              attempt,
              maxAttempts,
            });

            // Wait before retry
            if (options.retryDelay) {
              await this.delay(options.retryDelay);
            }
          }

          // Execute with timeout if specified
          const result = options.timeout
            ? await this.executeWithTimeout(operation, options.timeout)
            : await operation();

          const duration_ms = Date.now() - startTime;

          this.logger.info(`Stage ${stageName} completed`, {
            attempt,
            duration_ms,
          });

          return { result, duration_ms };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          if (options.failFast || attempt === maxAttempts) {
            throw lastError;
          }

          this.logger.warn(`Stage ${stageName} failed, will retry`, {
            attempt,
            error: lastError.message,
          });
        }
      }

      // This should never be reached, but TypeScript needs it
      throw lastError || new Error("Stage execution failed");
    } catch (error) {
      const duration_ms = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Stage execution failed after ${duration_ms}ms: ${errorMessage}`,
      );
    }
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  /**
   * Delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a success result
   */
  createSuccessResult(
    stage: string,
    stageName: StageName,
    duration_ms: number,
    details?: Record<string, unknown>,
    outputs?: string[],
  ): StageResult {
    return {
      stage,
      stageName,
      success: true,
      duration_ms,
      details: details || {},
      outputs: outputs || [],
    };
  }

  /**
   * Create a failure result
   */
  createFailureResult(
    stage: string,
    stageName: StageName,
    duration_ms: number,
    error: string,
    details?: Record<string, unknown>,
  ): StageResult {
    return {
      stage,
      stageName,
      success: false,
      duration_ms,
      error,
      details: details || {},
      outputs: [],
    };
  }

  /**
   * Log stage start
   */
  logStageStart(stageName: string, context: StageContext): void {
    this.logger.info(`[STAGE START] ${stageName}`, {
      profile: context.profile,
      timestamp: context.timestamp,
    });
  }

  /**
   * Log stage completion
   */
  logStageComplete(result: StageResult): void {
    if (result.success) {
      this.logger.info(`[STAGE COMPLETE] ${result.stage}`, {
        duration_ms: result.duration_ms,
        outputs: result.outputs?.length || 0,
      });
    } else {
      this.logger.error(`[STAGE FAILED] ${result.stage}`, {
        duration_ms: result.duration_ms,
        error: result.error,
      });
    }
  }

  /**
   * Execute multiple operations in parallel
   */
  async executeParallel<T>(operations: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(operations.map((op) => op()));
  }

  /**
   * Execute multiple operations in sequence
   */
  async executeSequential<T>(
    operations: Array<() => Promise<T>>,
  ): Promise<T[]> {
    const results: T[] = [];
    for (const operation of operations) {
      results.push(await operation());
    }
    return results;
  }

  /**
   * Execute with progress tracking
   */
  async executeWithProgress<T>(
    items: T[],
    processor: (item: T, index: number, total: number) => Promise<void>,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<void> {
    const total = items.length;

    for (let i = 0; i < items.length; i++) {
      await processor(items[i], i, total);

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createStageExecutor(): StageExecutor {
  return new StageExecutor();
}

// ============================================================================
// Exports
// ============================================================================

logger.info("Stage executor module loaded");
