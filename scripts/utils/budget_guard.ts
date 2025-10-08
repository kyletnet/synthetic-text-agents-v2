/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Budget Guard & Kill Switch System
 * Implements AC-3: Budget guards and kill switch functionality
 *
 * - Run/item level budget caps declared in baseline_config.json
 * - Runtime environment variable HARD_STOP=1 for immediate termination
 * - Granular budget tracking with predictive enforcement
 */

import * as fs from "fs";
import * as path from "path";

export interface BudgetLimits {
  run_max_usd: number;
  item_max_usd: number;
  agent_limits: {
    answer_max_usd: number;
    audit_max_ms: number;
    evidence_max_usd: number;
    [key: string]: number;
  };
  buffer_percentage: number; // Safety buffer (e.g., 10% = 0.10)
}

export interface BudgetUsage {
  run_id: string;
  total_spent_usd: number;
  remaining_budget_usd: number;
  items_processed: number;
  average_cost_per_item: number;
  projected_final_cost: number;
  agent_spending: Record<string, number>;
  timestamp: string;
}

export interface BudgetViolation {
  type: "run_limit" | "item_limit" | "agent_limit" | "projection_exceeded";
  current_value: number;
  limit_value: number;
  agent_role?: string;
  severity: "warning" | "critical";
  action: "continue" | "abort" | "fallback";
  message: string;
}

export interface KillSwitchStatus {
  hard_stop_enabled: boolean;
  budget_enforcement_enabled: boolean;
  emergency_stop_triggered: boolean;
  stop_reason?: string;
  timestamp?: string;
}

export class BudgetGuard {
  private budgetLimits!: BudgetLimits;
  private currentUsage!: BudgetUsage;
  private configPath: string;
  private usageLogPath: string;
  private killSwitchStatus!: KillSwitchStatus;

  constructor(
    configPath: string = "baseline_config.json",
    profile: string = "dev",
    runId: string = "unknown",
  ) {
    this.configPath = configPath;
    this.usageLogPath = `reports/budget_usage_${runId}.jsonl`;

    this.loadBudgetConfiguration(profile);
    this.initializeUsageTracking(runId);
    this.checkKillSwitch();

    // Set up periodic kill switch checks
    this.startKillSwitchMonitoring();
  }

  private loadBudgetConfiguration(profile: string): void {
    try {
      const config = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
      const profileConfig = config.dxloop?.profiles?.[profile];

      if (!profileConfig) {
        throw new Error(`Profile '${profile}' not found in configuration`);
      }

      this.budgetLimits = {
        run_max_usd: profileConfig.budget_max_usd || 1.0,
        item_max_usd:
          config.cost_latency?.alert_thresholds?.cost_per_item_max || 0.1,
        agent_limits: {
          answer_max_usd:
            profileConfig.per_agent_limits?.answer_max_usd || 0.05,
          audit_max_ms: profileConfig.per_agent_limits?.audit_max_ms || 6000,
          evidence_max_usd: 0.03, // Default limit for evidence agent
          ...profileConfig.per_agent_limits,
        },
        buffer_percentage: 0.1, // 10% safety buffer
      };

      console.log(`[BUDGET] Loaded limits for profile ${profile}:`, {
        run_max: this.budgetLimits.run_max_usd,
        item_max: this.budgetLimits.item_max_usd,
        agent_limits: this.budgetLimits.agent_limits,
      });
    } catch (error) {
      throw new Error(`Failed to load budget configuration: ${error}`);
    }
  }

  private initializeUsageTracking(runId: string): void {
    this.currentUsage = {
      run_id: runId,
      total_spent_usd: 0,
      remaining_budget_usd: this.budgetLimits.run_max_usd,
      items_processed: 0,
      average_cost_per_item: 0,
      projected_final_cost: 0,
      agent_spending: {},
      timestamp: new Date().toISOString(),
    };

    // Try to load existing usage from log file
    this.loadExistingUsage();
  }

  private loadExistingUsage(): void {
    if (fs.existsSync(this.usageLogPath)) {
      try {
        const content = fs.readFileSync(this.usageLogPath, "utf8");
        const lines = content
          .trim()
          .split("\n")
          .filter((line) => line);

        if (lines.length > 0) {
          // Get the latest usage entry
          const latestUsage = JSON.parse(lines[lines.length - 1]);
          this.currentUsage = { ...this.currentUsage, ...latestUsage };
          console.log(
            `[BUDGET] Loaded existing usage: $${this.currentUsage.total_spent_usd.toFixed(
              4,
            )}`,
          );
        }
      } catch (error) {
        console.warn(`[BUDGET] Could not load existing usage log: ${error}`);
      }
    }
  }

  private checkKillSwitch(): void {
    this.killSwitchStatus = {
      hard_stop_enabled: process.env.HARD_STOP === "1",
      budget_enforcement_enabled: process.env.BUDGET_ENFORCEMENT !== "0",
      emergency_stop_triggered: false,
    };

    if (this.killSwitchStatus.hard_stop_enabled) {
      console.log("🚨 [BUDGET] HARD_STOP kill switch is ENABLED");
    }
  }

  private startKillSwitchMonitoring(): void {
    // Check kill switch every 5 seconds
    setInterval(() => {
      const previousState = this.killSwitchStatus.hard_stop_enabled;
      this.checkKillSwitch();

      // If kill switch was just enabled, trigger emergency stop
      if (!previousState && this.killSwitchStatus.hard_stop_enabled) {
        this.triggerEmergencyStop("HARD_STOP environment variable set to 1");
      }
    }, 5000);
  }

  /**
   * Record a cost and check budget limits
   */
  public recordCost(params: {
    agent_role: string;
    item_id: string;
    cost_usd: number;
    latency_ms?: number;
    metadata?: Record<string, any>;
  }): BudgetViolation[] {
    const violations: BudgetViolation[] = [];

    // Update usage tracking
    this.currentUsage.total_spent_usd += params.cost_usd;
    this.currentUsage.remaining_budget_usd = Math.max(
      0,
      this.budgetLimits.run_max_usd - this.currentUsage.total_spent_usd,
    );

    // Track agent-specific spending
    if (!this.currentUsage.agent_spending[params.agent_role]) {
      this.currentUsage.agent_spending[params.agent_role] = 0;
    }
    this.currentUsage.agent_spending[params.agent_role] += params.cost_usd;

    // Update item statistics
    this.currentUsage.items_processed += 1;
    this.currentUsage.average_cost_per_item =
      this.currentUsage.total_spent_usd / this.currentUsage.items_processed;

    // Project final cost based on current trend
    if (this.currentUsage.items_processed > 0) {
      const estimatedTotalItems = this.estimateTotalItems();
      this.currentUsage.projected_final_cost =
        this.currentUsage.average_cost_per_item * estimatedTotalItems;
    }

    this.currentUsage.timestamp = new Date().toISOString();

    // Check for violations
    violations.push(...this.checkBudgetLimits(params));

    // Log usage update
    this.logUsageUpdate(params);

    // Handle critical violations
    const criticalViolations = violations.filter(
      (v) => v.severity === "critical",
    );
    if (criticalViolations.length > 0) {
      for (const violation of criticalViolations) {
        if (violation.action === "abort") {
          this.triggerEmergencyStop(`Budget violation: ${violation.message}`);
        }
      }
    }

    return violations;
  }

  private checkBudgetLimits(params: {
    agent_role: string;
    item_id: string;
    cost_usd: number;
  }): BudgetViolation[] {
    const violations: BudgetViolation[] = [];

    // Check run-level budget
    if (this.currentUsage.total_spent_usd >= this.budgetLimits.run_max_usd) {
      violations.push({
        type: "run_limit",
        current_value: this.currentUsage.total_spent_usd,
        limit_value: this.budgetLimits.run_max_usd,
        severity: "critical",
        action: "abort",
        message: `Run budget exceeded: $${this.currentUsage.total_spent_usd.toFixed(
          4,
        )} >= $${this.budgetLimits.run_max_usd.toFixed(2)}`,
      });
    } else if (
      this.currentUsage.total_spent_usd >=
      this.budgetLimits.run_max_usd * (1 - this.budgetLimits.buffer_percentage)
    ) {
      violations.push({
        type: "run_limit",
        current_value: this.currentUsage.total_spent_usd,
        limit_value: this.budgetLimits.run_max_usd,
        severity: "warning",
        action: "continue",
        message: `Run budget warning: $${this.currentUsage.total_spent_usd.toFixed(
          4,
        )} approaching limit $${this.budgetLimits.run_max_usd.toFixed(2)}`,
      });
    }

    // Check item-level budget
    if (params.cost_usd > this.budgetLimits.item_max_usd) {
      violations.push({
        type: "item_limit",
        current_value: params.cost_usd,
        limit_value: this.budgetLimits.item_max_usd,
        severity: "warning",
        action: "fallback",
        message: `Item cost exceeded: $${params.cost_usd.toFixed(
          4,
        )} > $${this.budgetLimits.item_max_usd.toFixed(4)} for ${
          params.item_id
        }`,
      });
    }

    // Check agent-specific limits
    const agentSpending =
      this.currentUsage.agent_spending[params.agent_role] || 0;
    const agentLimit = this.budgetLimits.agent_limits[params.agent_role];

    if (agentLimit && agentSpending > agentLimit) {
      violations.push({
        type: "agent_limit",
        current_value: agentSpending,
        limit_value: agentLimit,
        agent_role: params.agent_role,
        severity: "warning",
        action: "fallback",
        message: `Agent budget exceeded: ${
          params.agent_role
        } spent $${agentSpending.toFixed(4)} > $${agentLimit.toFixed(4)}`,
      });
    }

    // Check projected budget overrun
    if (
      this.currentUsage.projected_final_cost >
      this.budgetLimits.run_max_usd * 1.2
    ) {
      violations.push({
        type: "projection_exceeded",
        current_value: this.currentUsage.projected_final_cost,
        limit_value: this.budgetLimits.run_max_usd,
        severity: "warning",
        action: "continue",
        message: `Projected final cost $${this.currentUsage.projected_final_cost.toFixed(
          4,
        )} may exceed budget $${this.budgetLimits.run_max_usd.toFixed(2)}`,
      });
    }

    return violations;
  }

  private estimateTotalItems(): number {
    // Simple estimation based on current progress
    // In a real implementation, this would use more sophisticated methods
    const baseEstimate = Math.max(10, this.currentUsage.items_processed * 2);

    // Factor in any available metadata about expected item counts
    const envItemCount = parseInt(process.env.EXPECTED_ITEMS || "0");
    if (envItemCount > 0) {
      return envItemCount;
    }

    return baseEstimate;
  }

  private logUsageUpdate(params: {
    agent_role: string;
    item_id: string;
    cost_usd: number;
    metadata?: Record<string, any>;
  }): void {
    const logEntry = {
      ...this.currentUsage,
      last_operation: {
        agent_role: params.agent_role,
        item_id: params.item_id,
        cost_usd: params.cost_usd,
        metadata: params.metadata || {},
      },
    };

    try {
      // Ensure directory exists
      fs.mkdirSync(path.dirname(this.usageLogPath), { recursive: true });

      // Append to usage log
      fs.appendFileSync(this.usageLogPath, JSON.stringify(logEntry) + "\n");
    } catch (error) {
      console.error(`[BUDGET] Failed to log usage update: ${error}`);
    }
  }

  /**
   * Trigger emergency stop
   */
  public triggerEmergencyStop(reason: string): void {
    this.killSwitchStatus.emergency_stop_triggered = true;
    this.killSwitchStatus.stop_reason = reason;
    this.killSwitchStatus.timestamp = new Date().toISOString();

    console.error(`🚨 [BUDGET] EMERGENCY STOP TRIGGERED: ${reason}`);
    console.error(
      `🚨 [BUDGET] Current usage: $${this.currentUsage.total_spent_usd.toFixed(
        4,
      )}`,
    );
    console.error(
      `🚨 [BUDGET] Budget limit: $${this.budgetLimits.run_max_usd.toFixed(2)}`,
    );

    // Log emergency stop
    const emergencyLog = {
      event: "emergency_stop",
      reason,
      timestamp: this.killSwitchStatus.timestamp,
      usage_at_stop: this.currentUsage,
      budget_limits: this.budgetLimits,
    };

    try {
      const emergencyLogPath = `reports/emergency_stop_${this.currentUsage.run_id}.json`;
      fs.writeFileSync(emergencyLogPath, JSON.stringify(emergencyLog, null, 2));
      console.error(
        `🚨 [BUDGET] Emergency stop logged to: ${emergencyLogPath}`,
      );
    } catch (error) {
      console.error(`[BUDGET] Failed to log emergency stop: ${error}`);
    }

    // Forcefully exit process
    process.exit(2);
  }

  /**
   * Check if operation should proceed based on kill switch status
   */
  public shouldProceed(): boolean {
    if (
      this.killSwitchStatus.hard_stop_enabled ||
      this.killSwitchStatus.emergency_stop_triggered
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get current budget status
   */
  public getBudgetStatus(): {
    usage: BudgetUsage;
    limits: BudgetLimits;
    kill_switch: KillSwitchStatus;
    utilization_percentage: number;
    estimated_remaining_items: number;
  } {
    const utilizationPercentage =
      (this.currentUsage.total_spent_usd / this.budgetLimits.run_max_usd) * 100;

    let estimatedRemainingItems = 0;
    if (this.currentUsage.average_cost_per_item > 0) {
      estimatedRemainingItems = Math.floor(
        this.currentUsage.remaining_budget_usd /
          this.currentUsage.average_cost_per_item,
      );
    }

    return {
      usage: this.currentUsage,
      limits: this.budgetLimits,
      kill_switch: this.killSwitchStatus,
      utilization_percentage: utilizationPercentage,
      estimated_remaining_items: estimatedRemainingItems,
    };
  }

  /**
   * Check if agent should use fallback mode due to budget constraints
   */
  public shouldUseFallback(agentRole: string): boolean {
    const agentSpending = this.currentUsage.agent_spending[agentRole] || 0;
    const agentLimit = this.budgetLimits.agent_limits[agentRole];

    if (!agentLimit) return false;

    // Use fallback if spending is 80% of limit
    return agentSpending >= agentLimit * 0.8;
  }

  /**
   * Validate operation before execution
   */
  public validateOperation(params: {
    agent_role: string;
    estimated_cost_usd: number;
    estimated_latency_ms?: number;
  }): { allowed: boolean; reason?: string; use_fallback?: boolean } {
    // Check kill switch first
    if (!this.shouldProceed()) {
      return {
        allowed: false,
        reason: this.killSwitchStatus.stop_reason || "Kill switch activated",
      };
    }

    // Check if estimated cost would exceed run budget
    const projectedTotal =
      this.currentUsage.total_spent_usd + params.estimated_cost_usd;
    if (projectedTotal > this.budgetLimits.run_max_usd) {
      return {
        allowed: false,
        reason: `Operation would exceed run budget: $${projectedTotal.toFixed(
          4,
        )} > $${this.budgetLimits.run_max_usd.toFixed(2)}`,
      };
    }

    // Check if should use fallback
    if (this.shouldUseFallback(params.agent_role)) {
      return {
        allowed: true,
        use_fallback: true,
        reason: `Agent ${params.agent_role} approaching budget limit, using fallback mode`,
      };
    }

    return { allowed: true };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "status") {
    const runId = args[1] || "test_run";
    const profile = args[2] || "dev";

    const guard = new BudgetGuard("baseline_config.json", profile, runId);
    const status = guard.getBudgetStatus();

    console.log(JSON.stringify(status, null, 2));
  } else if (command === "test-violation") {
    const runId = args[1] || "test_run";
    const profile = args[2] || "dev";

    const guard = new BudgetGuard("baseline_config.json", profile, runId);

    // Simulate high cost operations
    console.log("Testing budget violations...");

    const violations1 = guard.recordCost({
      agent_role: "answer",
      item_id: "test_item_1",
      cost_usd: 0.08,
    });

    console.log("Violations after item 1:", violations1);

    const violations2 = guard.recordCost({
      agent_role: "answer",
      item_id: "test_item_2",
      cost_usd: 1.0,
    });

    console.log("Violations after item 2 (should trigger stop):", violations2);
  } else {
    console.log("Budget Guard CLI");
    console.log("Commands:");
    console.log("  status [run_id] [profile] - Show budget status");
    console.log(
      "  test-violation [run_id] [profile] - Test budget violation handling",
    );
  }
}
