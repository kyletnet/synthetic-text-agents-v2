/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Sandbox Runner - Isolated Policy Execution
 *
 * Purpose:
 * - Execute policies in isolated environment (prevent code injection)
 * - Read/Write separation (policies cannot modify system state)
 * - Resource limits (CPU, memory, time)
 * - Rollback on any error
 *
 * Phase 2C: Controlled Integration Layer
 *
 * Security Model:
 * - No access to file system
 * - No access to network
 * - No access to process/child_process
 * - Read-only access to context
 * - Time limit: 5s per policy execution
 */

import { createContext, runInContext, Script } from "vm";
import type { Logger } from "../../shared/logger.js";
import type { ParsedPolicy } from "../../core/governance/kernel.js";

/**
 * Sandbox configuration
 */
export interface SandboxConfig {
  timeoutMs?: number; // Execution timeout (ms), default: 5000 (5s)
  memoryLimitMB?: number; // Memory limit (MB), default: 50
  allowFileSystem?: boolean; // Allow file system access, default: false
  allowNetwork?: boolean; // Allow network access, default: false
}

/**
 * Sandbox execution context
 */
export interface SandboxContext {
  policy: ParsedPolicy;
  metrics?: Record<string, number>; // Current metrics
  baseline?: Record<string, number>; // Baseline metrics
  [key: string]: unknown;
}

/**
 * Sandbox execution result
 */
export interface SandboxResult {
  success: boolean;
  policyName: string;
  conditionsMet: boolean;
  actionsTriggered: string[];
  errors?: string[];
  warnings?: string[];
  executionTime: number; // ms
  memoryUsed: number; // bytes
}

/**
 * Sandbox Runner
 *
 * Executes policies in isolated VM context with strict security boundaries.
 */
export class SandboxRunner {
  private readonly logger: Logger;
  private readonly config: Required<SandboxConfig>;

  constructor(logger: Logger, config: SandboxConfig = {}) {
    this.logger = logger;

    this.config = {
      timeoutMs: config.timeoutMs ?? 5000, // 5s
      memoryLimitMB: config.memoryLimitMB ?? 50, // 50MB
      allowFileSystem: config.allowFileSystem ?? false,
      allowNetwork: config.allowNetwork ?? false,
    };
  }

  /**
   * Execute policy in sandbox
   *
   * Algorithm:
   * 1. Create isolated VM context
   * 2. Inject read-only context
   * 3. Evaluate policy conditions
   * 4. Collect actions (but do NOT execute them)
   * 5. Return result for manual approval
   */
  async execute(
    policy: ParsedPolicy,
    context: SandboxContext,
  ): Promise<SandboxResult> {
    this.logger.info("Executing policy in sandbox", {
      policy: policy.name,
      type: policy.type,
    });

    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      // Step 1: Create isolated context (read-only)
      const sandboxContext = this.createIsolatedContext(context);

      // Step 2: Evaluate conditions in sandbox
      const conditionsMet = await this.evaluateConditions(
        policy,
        sandboxContext,
      );

      // Step 3: Collect actions (do NOT execute)
      const actionsTriggered: string[] = [];

      if (conditionsMet) {
        // Collect action names (execution requires manual approval)
        for (const constraint of policy.constraints) {
          if (constraint.startsWith("action:")) {
            actionsTriggered.push(constraint.replace("action:", "").trim());
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;

      // Check resource limits
      if (executionTime > this.config.timeoutMs) {
        throw new Error(
          `Policy execution timeout (${executionTime}ms > ${this.config.timeoutMs}ms)`,
        );
      }

      if (memoryUsed > this.config.memoryLimitMB * 1024 * 1024) {
        throw new Error(
          `Policy execution memory limit exceeded (${(memoryUsed / 1024 / 1024).toFixed(2)}MB > ${this.config.memoryLimitMB}MB)`,
        );
      }

      this.logger.info("Sandbox execution complete", {
        policy: policy.name,
        conditionsMet,
        actionsTriggered,
        executionTime,
        memoryUsed,
      });

      return {
        success: true,
        policyName: policy.name,
        conditionsMet,
        actionsTriggered,
        executionTime,
        memoryUsed,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;

      this.logger.error("Sandbox execution failed", {
        policy: policy.name,
        error,
      });

      return {
        success: false,
        policyName: policy.name,
        conditionsMet: false,
        actionsTriggered: [],
        errors: [String(error)],
        executionTime,
        memoryUsed,
      };
    }
  }

  /**
   * Create isolated VM context
   *
   * Security: No access to:
   * - File system (fs, path)
   * - Network (http, https, net)
   * - Process (process, child_process)
   * - Dangerous globals (eval, Function, require)
   */
  private createIsolatedContext(context: SandboxContext): any {
    // Create safe sandbox with limited globals
    const sandbox = {
      // Math functions (safe)
      Math,

      // Console (limited, no side effects)
      console: {
        log: (...args: any[]) =>
          this.logger.debug("Sandbox log", { args }),
      },

      // Context (read-only)
      metrics: Object.freeze({ ...context.metrics }),
      baseline: Object.freeze({ ...context.baseline }),
      policy: Object.freeze({ ...context.policy }),

      // Helper functions (safe)
      abs: Math.abs,
      max: Math.max,
      min: Math.min,

      // No access to dangerous globals
      eval: undefined,
      Function: undefined,
      require: undefined,
      import: undefined,
      process: undefined,
      global: undefined,
      globalThis: undefined,
    };

    return createContext(sandbox);
  }

  /**
   * Evaluate policy conditions in sandbox
   */
  private async evaluateConditions(
    policy: ParsedPolicy,
    sandboxContext: any,
  ): Promise<boolean> {
    // Simple condition evaluation
    // Phase 2C: Can be enhanced with full DSL interpreter

    try {
      // Build condition expression from policy constraints
      const conditionExpr = this.buildConditionExpression(policy);

      if (!conditionExpr) {
        return false; // No conditions = no match
      }

      // Execute in sandbox with timeout
      const script = new Script(conditionExpr);
      const result = script.runInContext(sandboxContext, {
        timeout: this.config.timeoutMs,
        displayErrors: false,
      });

      return Boolean(result);
    } catch (error) {
      this.logger.error("Condition evaluation failed", {
        policy: policy.name,
        error,
      });
      return false;
    }
  }

  /**
   * Build condition expression from policy
   */
  private buildConditionExpression(policy: ParsedPolicy): string | null {
    // Extract conditions from constraints
    const conditions = policy.constraints.filter(
      (c) => !c.startsWith("action:"),
    );

    if (conditions.length === 0) {
      return null;
    }

    // Simple AND logic (can be enhanced)
    return conditions.join(" && ");
  }

  /**
   * Evaluate simple expression in sandbox
   *
   * For Policy Interpreter: evaluates condition expressions safely
   * without needing full ParsedPolicy structure
   */
  async evaluateExpression(
    expression: string,
    context: Record<string, unknown>,
  ): Promise<boolean> {
    this.logger.debug("Evaluating expression in sandbox", { expression });

    try {
      // Create safe sandbox with context
      const sandbox = {
        Math,
        abs: Math.abs,
        max: Math.max,
        min: Math.min,
        ...context, // Inject context variables
        // No dangerous globals
        eval: undefined,
        Function: undefined,
        require: undefined,
        import: undefined,
        process: undefined,
        global: undefined,
        globalThis: undefined,
      };

      const sandboxContext = createContext(sandbox);

      // Execute expression with timeout
      const script = new Script(expression);
      const result = script.runInContext(sandboxContext, {
        timeout: this.config.timeoutMs,
        displayErrors: false,
      });

      return Boolean(result);
    } catch (error) {
      this.logger.error("Expression evaluation failed", {
        expression,
        error,
      });
      return false;
    }
  }

  /**
   * Get sandbox configuration
   */
  getConfig(): Required<SandboxConfig> {
    return { ...this.config };
  }
}

/**
 * Create default sandbox runner
 */
export function createSandboxRunner(logger: Logger): SandboxRunner {
  return new SandboxRunner(logger, {
    timeoutMs: 5000, // 5s
    memoryLimitMB: 50, // 50MB
    allowFileSystem: false,
    allowNetwork: false,
  });
}
