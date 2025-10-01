/**
 * Safe Executor - Operation-type-based timeout management
 *
 * Purpose:
 * - Execute operations with appropriate timeouts
 * - Distinguish user-input (infinite wait) from system commands
 * - Prevent infinite loops while allowing user approval waits
 *
 * Design Philosophy:
 * - 무한 대기 ≠ 무한 루프
 * - 사용자 입력 = timeout null (무한 대기 OK)
 * - 시스템 작업 = timeout 적용 (무한루프 방지)
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  OperationType,
  TimeoutError,
  type ExecutionOptions,
  type GovernanceRulesConfig,
} from "./governance-types.js";
import { LoopDetector } from "./loop-detector.js";
import { NotificationSystem } from "./notification-system.js";

export class SafeExecutor {
  private projectRoot: string;
  private loopDetector: LoopDetector;
  private notificationSystem: NotificationSystem;
  private rules: GovernanceRulesConfig | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.loopDetector = new LoopDetector(projectRoot);
    this.notificationSystem = new NotificationSystem(projectRoot);
  }

  /**
   * Execute operation with type-based timeout
   */
  async execute<T>(
    operation: () => Promise<T>,
    options: ExecutionOptions,
  ): Promise<T> {
    const rules = this.loadRules();
    const timeoutConfig = rules.timeoutPolicy[options.type];

    // USER INPUT: 무한 대기 허용
    if (options.type === "user-input") {
      console.log("⏳ Waiting for user input (no timeout)...");
      return await operation();
    }

    // SYSTEM OPERATIONS: 타임아웃 적용
    const timeout = timeoutConfig.timeout;
    if (timeout === null) {
      // Fallback (should not happen)
      return await operation();
    }

    return await this.executeWithTimeout(operation, timeout, options);
  }

  /**
   * Execute with timeout and retry logic
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number,
    options: ExecutionOptions,
  ): Promise<T> {
    const maxRetries = options.maxRetries || 1;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new TimeoutError(
                `Operation timed out after ${timeout}ms`,
                options.type,
                timeout,
              ),
            );
          }, timeout);
        });

        // Race between operation and timeout
        const result = await Promise.race([operation(), timeoutPromise]);

        // Success
        return result;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof TimeoutError) {
          // Notify timeout
          await this.notificationSystem.notifyTimeout(error);

          // Execute onTimeout callback
          if (options.onTimeout) {
            options.onTimeout();
          }

          // Retry logic
          if (attempt < maxRetries) {
            console.warn(
              `⚠️  Timeout on attempt ${attempt}/${maxRetries}. Retrying...`,
            );

            // Execute onRetry callback
            if (options.onRetry) {
              options.onRetry(attempt);
            }

            // Wait before retry (with backoff)
            const retryDelay = options.retryDelay || 1000;
            await new Promise((resolve) =>
              setTimeout(resolve, retryDelay * attempt),
            );

            continue;
          }

          // Max retries reached
          throw error;
        }

        // Non-timeout error
        throw error;
      }
    }

    // Should not reach here, but for type safety
    throw lastError || new Error("Unknown error");
  }

  /**
   * Execute with loop detection
   */
  async executeWithLoopDetection<T>(
    operation: (checkpoint: () => void) => Promise<T>,
    operationId: string,
    options: ExecutionOptions,
  ): Promise<T> {
    // Create checkpoint function
    const checkpoint = () => {
      this.loopDetector.checkpoint(operationId);
    };

    try {
      const result = await this.execute(() => operation(checkpoint), options);

      // Reset loop detector on success
      this.loopDetector.reset(operationId);

      return result;
    } catch (error) {
      // Don't reset on error - keep loop data for analysis
      throw error;
    }
  }

  /**
   * Get timeout for operation type
   */
  getTimeout(type: OperationType): number | null {
    const rules = this.loadRules();
    return rules.timeoutPolicy[type].timeout;
  }

  /**
   * Load governance rules
   */
  private loadRules(): GovernanceRulesConfig {
    if (this.rules) return this.rules;

    const rulesPath = join(this.projectRoot, "governance-rules.json");
    if (!existsSync(rulesPath)) {
      throw new Error(`governance-rules.json not found at ${rulesPath}`);
    }

    const content = readFileSync(rulesPath, "utf8");
    this.rules = JSON.parse(content) as GovernanceRulesConfig;
    return this.rules;
  }

  /**
   * Create periodic reminder for long-running user waits
   */
  createUserWaitReminder(
    message: string,
    intervalMs: number = 300000, // 5 minutes
  ): NodeJS.Timeout {
    return setInterval(() => {
      console.log(`\n⏳ ${message}`);
      console.log(`   (Waiting for user input...)\n`);
    }, intervalMs);
  }

  /**
   * Clear reminder
   */
  clearReminder(timerId: NodeJS.Timeout): void {
    clearInterval(timerId);
  }
}

/**
 * Global singleton instance
 */
let globalSafeExecutor: SafeExecutor | null = null;

export function getSafeExecutor(projectRoot?: string): SafeExecutor {
  if (!globalSafeExecutor) {
    globalSafeExecutor = new SafeExecutor(projectRoot);
  }
  return globalSafeExecutor;
}
