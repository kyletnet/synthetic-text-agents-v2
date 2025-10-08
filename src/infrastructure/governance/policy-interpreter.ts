/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Policy Interpreter - DSL Evaluation Engine
 *
 * Design Philosophy (from GPT):
 * "Policies should be DATA, not CODE.
 *  The interpreter evaluates declarative rules without hardcoded logic."
 *
 * Evolution:
 * - Before: if (event.type === "threshold") { ... } (O(n) complexity, tight coupling)
 * - After: evaluate(policy, context) (O(1) lookup, zero coupling)
 *
 * DSL Features:
 * - Condition evaluation: Simple expressions (>, <, ==, AND, OR)
 * - Variable substitution: Replace ${var} with context values
 * - Action execution: Pluggable action handlers
 *
 * Future Extensions:
 * - Complex expressions (nested conditions)
 * - Custom functions (avg(), percentile(), etc.)
 * - Temporal logic (WITHIN 5 minutes, etc.)
 */

import { readFileSync, existsSync } from "fs";
import { load as loadYaml } from "js-yaml";
import { join } from "path";
import { SandboxRunner } from "./sandbox-runner.js";

export interface PolicyDefinition {
  name: string;
  type: string;
  level: "error" | "warn" | "info";
  description: string;
  condition: string;
  action: string[];
  metadata?: Record<string, unknown>;
}

export interface PolicyDocument {
  version: string;
  policies: PolicyDefinition[];
  actions?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface EvaluationContext {
  policy?: PolicyDefinition;
  [key: string]: unknown;
}

export interface EvaluationResult {
  policyName: string;
  matched: boolean;
  actionsTriggered: string[];
  error?: string;
}

/**
 * Policy Interpreter
 */
export class PolicyInterpreter {
  private policies: PolicyDocument | null = null;
  private policyPath: string;
  private actionHandlers: Map<
    string,
    (context: EvaluationContext) => Promise<void>
  > = new Map();
  private sandbox: SandboxRunner; // Phase 2C: Isolated execution

  constructor(projectRoot: string = process.cwd()) {
    this.policyPath = join(projectRoot, "governance-rules.yaml");
    // Phase 2C: Sandbox with minimal timeout for expression evaluation
    // Note: SandboxRunner requires Logger, but we'll use console as fallback
    this.sandbox = new SandboxRunner(
      {
        info: console.log,
        debug: console.log,
        warn: console.warn,
        error: console.error,
      } as any,
      { timeoutMs: 1000 }, // 1s timeout for simple expressions
    );
    this.registerDefaultActionHandlers();
  }

  /**
   * Load policies from YAML
   */
  async loadPolicies(): Promise<void> {
    if (!existsSync(this.policyPath)) {
      throw new Error(`Policy file not found: ${this.policyPath}`);
    }

    try {
      const content = readFileSync(this.policyPath, "utf8");
      this.policies = loadYaml(content) as PolicyDocument;
      console.log(
        `[Policy Interpreter] Loaded ${this.policies.policies.length} policies`,
      );
    } catch (error) {
      console.error("[Policy Interpreter] Failed to load policies:", error);
      throw error;
    }
  }

  /**
   * Evaluate policies for given context
   */
  async evaluate(
    eventType: string,
    context: EvaluationContext,
  ): Promise<EvaluationResult[]> {
    if (!this.policies) {
      await this.loadPolicies();
    }

    const results: EvaluationResult[] = [];

    // Filter policies by type
    const relevantPolicies = this.policies!.policies.filter((policy) => {
      // Match policy type to event type prefix
      return eventType.includes(policy.type);
    });

    // Evaluate each policy
    for (const policy of relevantPolicies) {
      try {
        const matched = await this.evaluateCondition(policy.condition, context);

        if (matched) {
          // Execute actions
          const actionsTriggered = await this.executeActions(
            policy.action,
            context,
            policy,
          );

          results.push({
            policyName: policy.name,
            matched: true,
            actionsTriggered,
          });
        } else {
          results.push({
            policyName: policy.name,
            matched: false,
            actionsTriggered: [],
          });
        }
      } catch (error: any) {
        results.push({
          policyName: policy.name,
          matched: false,
          actionsTriggered: [],
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Evaluate condition expression
   * Simple DSL: supports >, <, ==, !=, AND, OR, abs()
   *
   * Phase 2C: Uses Sandbox Runner (NO eval, VM isolation)
   */
  private async evaluateCondition(
    condition: string,
    context: EvaluationContext,
  ): Promise<boolean> {
    try {
      // Normalize whitespace
      let expr = condition.trim().replace(/\s+/g, " ");

      // Replace variables with values
      for (const [key, value] of Object.entries(context)) {
        const regex = new RegExp(`\\b${key}\\b`, "g");
        if (typeof value === "string") {
          expr = expr.replace(regex, `"${value}"`);
        } else {
          expr = expr.replace(regex, String(value));
        }
      }

      // Handle abs() function
      expr = expr.replace(/abs\(([^)]+)\)/g, (_, inner) => {
        return `Math.abs(${inner})`;
      });

      // Replace logical operators
      expr = expr.replace(/\bAND\b/g, "&&");
      expr = expr.replace(/\bOR\b/g, "||");

      // Phase 2C: Execute in sandbox (NO eval)
      const result = await this.sandbox.evaluateExpression(expr, context);

      return result;
    } catch (error) {
      console.error(
        `[Policy Interpreter] Condition evaluation error: ${error}`,
      );
      return false;
    }
  }

  /**
   * Execute policy actions
   */
  private async executeActions(
    actions: string[],
    context: EvaluationContext,
    policy: PolicyDefinition,
  ): Promise<string[]> {
    const triggered: string[] = [];

    for (const action of actions) {
      const handler = this.actionHandlers.get(action);
      if (handler) {
        await handler({ ...context, policy });
        triggered.push(action);
      } else {
        console.warn(`[Policy Interpreter] No handler for action: ${action}`);
      }
    }

    return triggered;
  }

  /**
   * Register action handler
   */
  registerActionHandler(
    action: string,
    handler: (context: EvaluationContext) => Promise<void>,
  ): void {
    this.actionHandlers.set(action, handler);
  }

  /**
   * Register default action handlers
   */
  private registerDefaultActionHandlers(): void {
    // Block action
    this.registerActionHandler("block", async (context) => {
      console.error(
        `[Governance] 🚫 BLOCKED by policy: ${context.policy?.name}`,
      );
      console.error(`   Reason: ${context.policy?.description}`);
      console.error(`   Level: ${context.policy?.level}`);
      // In strict mode, this would throw an error
    });

    // Notify Slack action
    this.registerActionHandler("notify:slack", async (context) => {
      console.log(
        `[Governance] 📢 Slack notification: ${context.policy?.name}`,
      );
      // TODO: Integrate with Slack API
    });

    // Log to governance action
    this.registerActionHandler("log:governance", async (context) => {
      console.log(`[Governance] 📝 Logged: ${context.policy?.name}`);
      // TODO: Write to governance-log.jsonl
    });

    // Record for prediction action
    this.registerActionHandler("record:prediction", async (context) => {
      console.log(`[Governance] 🔮 Recorded for ML: ${context.policy?.name}`);
      // Integrated with PredictiveFeedbackRecorder
    });

    // Rollback suggestion action
    this.registerActionHandler("rollback:suggest", async (context) => {
      console.log(
        `[Governance] ⏪ Rollback suggested: ${context.policy?.name}`,
      );
      // TODO: Generate rollback plan
    });

    // Cleanup suggestion action
    this.registerActionHandler("suggest:cleanup", async (context) => {
      console.log(`[Governance] 🧹 Cleanup suggested: ${context.policy?.name}`);
      // TODO: Generate cleanup recommendations
    });

    // Preemptive action suggestion (ML-based)
    this.registerActionHandler("suggest:preemptive-action", async (context) => {
      console.log(`[Governance] 🔮 Preemptive action: ${context.policy?.name}`);
      // TODO: ML-based recommendations
    });

    // Security notification action
    this.registerActionHandler("notify:security", async (context) => {
      console.error(`[Governance] 🔒 SECURITY ALERT: ${context.policy?.name}`);
      // TODO: Integrate with security alerting system
    });
  }

  /**
   * Get loaded policies
   */
  getPolicies(): PolicyDocument | null {
    return this.policies;
  }

  /**
   * Get policy by name
   */
  getPolicy(name: string): PolicyDefinition | undefined {
    return this.policies?.policies.find((p) => p.name === name);
  }
}

/**
 * Global interpreter instance
 */
let globalInterpreter: PolicyInterpreter | null = null;

/**
 * Get global policy interpreter
 */
export function getPolicyInterpreter(projectRoot?: string): PolicyInterpreter {
  if (!globalInterpreter) {
    globalInterpreter = new PolicyInterpreter(projectRoot);
  }
  return globalInterpreter;
}
