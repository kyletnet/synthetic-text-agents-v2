import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Budget Guardian
 * Enforces cost and time limits with kill switch functionality
 * Implements P1-aware budget policies with graceful degradation
 */

export interface BudgetLimits {
  max_cost_per_run: number;
  max_cost_per_item: number;
  max_time_per_run_ms: number;
  max_time_per_item_ms: number;
  per_agent_limits: {
    [agentRole: string]: {
      max_cost_usd: number;
      max_time_ms: number;
    };
  };
}

export interface RunBudgetState {
  run_id: string;
  session_id: string;
  profile: string;
  start_timestamp: string;
  total_cost_usd: number;
  total_time_ms: number;
  items_processed: number;
  items_remaining: number;
  budget_limits: BudgetLimits;
  agent_usage: {
    [agentRole: string]: {
      cost_usd: number;
      time_ms: number;
      call_count: number;
    };
  };
  status: "running" | "paused" | "completed" | "killed" | "budget_exceeded";
  warnings: string[];
  last_updated: string;
}

export interface BudgetCheckResult {
  can_proceed: boolean;
  reason: string;
  warning_level: "none" | "low" | "medium" | "high" | "critical";
  remaining_budget: {
    cost_usd: number;
    time_ms: number;
    items: number;
  };
  recommendations: string[];
}

export interface KillSwitchStatus {
  enabled: boolean;
  triggered: boolean;
  trigger_reason: string;
  trigger_timestamp?: string;
  manual_override: boolean;
}

const LEVEL = { none: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;
type LevelKey = keyof typeof LEVEL;

function maxLevel(a: LevelKey, b: LevelKey): LevelKey {
  return LEVEL[a] >= LEVEL[b] ? a : b;
}

export class BudgetGuardian {
  private budgetFile: string;
  private killSwitchFile: string;
  private currentState: RunBudgetState | null = null;

  constructor(baseDir?: string) {
    const reportsDir = join(baseDir || process.cwd(), "reports");
    this.budgetFile = join(reportsDir, "budget_state.json");
    this.killSwitchFile = join(reportsDir, "kill_switch.json");
  }

  /**
   * Initialize budget tracking for a new run
   */
  initializeRun(
    runId: string,
    sessionId: string,
    profile: string,
    budgetLimits: BudgetLimits,
    estimatedItems: number,
  ): RunBudgetState {
    this.currentState = {
      run_id: runId,
      session_id: sessionId,
      profile,
      start_timestamp: new Date().toISOString(),
      total_cost_usd: 0,
      total_time_ms: 0,
      items_processed: 0,
      items_remaining: estimatedItems,
      budget_limits: budgetLimits,
      agent_usage: {},
      status: "running",
      warnings: [],
      last_updated: new Date().toISOString(),
    };

    this.saveBudgetState();
    return this.currentState;
  }

  /**
   * Load existing budget state
   */
  loadBudgetState(runId?: string): RunBudgetState | null {
    try {
      if (existsSync(this.budgetFile)) {
        const content = readFileSync(this.budgetFile, "utf-8");
        const state = JSON.parse(content) as RunBudgetState;

        if (!runId || state.run_id === runId) {
          this.currentState = state;
          return state;
        }
      }
    } catch (error) {
      console.warn("Failed to load budget state:", error);
    }

    return null;
  }

  /**
   * Check if operation can proceed within budget
   */
  checkBudget(
    estimatedCost: number = 0,
    estimatedTimeMs: number = 0,
    agentRole?: string,
  ): BudgetCheckResult {
    if (!this.currentState) {
      return {
        can_proceed: false,
        reason: "Budget tracking not initialized",
        warning_level: "critical",
        remaining_budget: { cost_usd: 0, time_ms: 0, items: 0 },
        recommendations: ["Initialize budget tracking before proceeding"],
      };
    }

    // Check kill switch first
    const killSwitch = this.checkKillSwitch();
    if (killSwitch.triggered) {
      this.currentState.status = "killed";
      this.saveBudgetState();

      return {
        can_proceed: false,
        reason: `Kill switch triggered: ${killSwitch.trigger_reason}`,
        warning_level: "critical",
        remaining_budget: { cost_usd: 0, time_ms: 0, items: 0 },
        recommendations: ["Clear kill switch before proceeding"],
      };
    }

    const limits = this.currentState.budget_limits;
    const warnings: string[] = [];
    let warningLevel: "none" | "low" | "medium" | "high" | "critical" = "none";

    // Check run-level budget limits
    const projectedCost = this.currentState.total_cost_usd + estimatedCost;
    const projectedTime = this.currentState.total_time_ms + estimatedTimeMs;

    if (projectedCost > limits.max_cost_per_run) {
      this.currentState.status = "budget_exceeded";
      this.saveBudgetState();

      return {
        can_proceed: false,
        reason: `Run cost limit exceeded: $${projectedCost.toFixed(3)} > $${
          limits.max_cost_per_run
        }`,
        warning_level: "critical",
        remaining_budget: {
          cost_usd: Math.max(
            0,
            limits.max_cost_per_run - this.currentState.total_cost_usd,
          ),
          time_ms: Math.max(
            0,
            limits.max_time_per_run_ms - this.currentState.total_time_ms,
          ),
          items: this.currentState.items_remaining,
        },
        recommendations: ["Increase run budget limit or optimize operations"],
      };
    }

    if (projectedTime > limits.max_time_per_run_ms) {
      this.currentState.status = "budget_exceeded";
      this.saveBudgetState();

      return {
        can_proceed: false,
        reason: `Run time limit exceeded: ${projectedTime}ms > ${limits.max_time_per_run_ms}ms`,
        warning_level: "critical",
        remaining_budget: {
          cost_usd: Math.max(
            0,
            limits.max_cost_per_run - this.currentState.total_cost_usd,
          ),
          time_ms: Math.max(
            0,
            limits.max_time_per_run_ms - this.currentState.total_time_ms,
          ),
          items: this.currentState.items_remaining,
        },
        recommendations: ["Increase run time limit or optimize operations"],
      };
    }

    // Check item-level limits
    if (estimatedCost > limits.max_cost_per_item) {
      warnings.push(
        `Item cost ($${estimatedCost.toFixed(3)}) exceeds limit ($${
          limits.max_cost_per_item
        })`,
      );
      warningLevel = "high";
    }

    if (estimatedTimeMs > limits.max_time_per_item_ms) {
      warnings.push(
        `Item time (${estimatedTimeMs}ms) exceeds limit (${limits.max_time_per_item_ms}ms)`,
      );
      warningLevel = "high";
    }

    // Check agent-specific limits
    if (agentRole && limits.per_agent_limits[agentRole]) {
      const agentLimits = limits.per_agent_limits[agentRole];
      const agentUsage = this.currentState.agent_usage[agentRole] || {
        cost_usd: 0,
        time_ms: 0,
        call_count: 0,
      };

      const projectedAgentCost = agentUsage.cost_usd + estimatedCost;
      const projectedAgentTime = agentUsage.time_ms + estimatedTimeMs;

      if (projectedAgentCost > agentLimits.max_cost_usd) {
        return {
          can_proceed: false,
          reason: `Agent ${agentRole} cost limit exceeded: $${projectedAgentCost.toFixed(
            3,
          )} > $${agentLimits.max_cost_usd}`,
          warning_level: "critical",
          remaining_budget: {
            cost_usd: Math.max(
              0,
              agentLimits.max_cost_usd - agentUsage.cost_usd,
            ),
            time_ms: Math.max(0, agentLimits.max_time_ms - agentUsage.time_ms),
            items: this.currentState.items_remaining,
          },
          recommendations: [
            `Increase ${agentRole} budget limit or use alternative agent`,
          ],
        };
      }

      if (projectedAgentTime > agentLimits.max_time_ms) {
        return {
          can_proceed: false,
          reason: `Agent ${agentRole} time limit exceeded: ${projectedAgentTime}ms > ${agentLimits.max_time_ms}ms`,
          warning_level: "critical",
          remaining_budget: {
            cost_usd: Math.max(
              0,
              agentLimits.max_cost_usd - agentUsage.cost_usd,
            ),
            time_ms: Math.max(0, agentLimits.max_time_ms - agentUsage.time_ms),
            items: this.currentState.items_remaining,
          },
          recommendations: [
            `Increase ${agentRole} time limit or optimize agent performance`,
          ],
        };
      }
    }

    // Calculate warning levels based on budget utilization
    const costUtilization = projectedCost / limits.max_cost_per_run;
    const timeUtilization = projectedTime / limits.max_time_per_run_ms;

    if (costUtilization > 0.9 || timeUtilization > 0.9) {
      warningLevel = "high";
      warnings.push(
        `Budget utilization high: cost ${(costUtilization * 100).toFixed(
          1,
        )}%, time ${(timeUtilization * 100).toFixed(1)}%`,
      );
    } else if (costUtilization > 0.75 || timeUtilization > 0.75) {
      warningLevel = maxLevel(warningLevel as LevelKey, "medium");
      warnings.push(
        `Budget utilization moderate: cost ${(costUtilization * 100).toFixed(
          1,
        )}%, time ${(timeUtilization * 100).toFixed(1)}%`,
      );
    } else if (costUtilization > 0.5 || timeUtilization > 0.5) {
      warningLevel = maxLevel(warningLevel as LevelKey, "low");
    }

    const recommendations = this.generateRecommendations(
      costUtilization,
      timeUtilization,
      warnings,
    );

    return {
      can_proceed: true,
      reason: "Within budget limits",
      warning_level: warningLevel,
      remaining_budget: {
        cost_usd: limits.max_cost_per_run - this.currentState.total_cost_usd,
        time_ms: limits.max_time_per_run_ms - this.currentState.total_time_ms,
        items: this.currentState.items_remaining,
      },
      recommendations,
    };
  }

  /**
   * Record actual usage after operation completion
   */
  recordUsage(
    actualCost: number,
    actualTimeMs: number,
    agentRole?: string,
    itemsProcessed: number = 1,
  ): void {
    if (!this.currentState) {
      console.warn("Cannot record usage: budget tracking not initialized");
      return;
    }

    this.currentState.total_cost_usd += actualCost;
    this.currentState.total_time_ms += actualTimeMs;
    this.currentState.items_processed += itemsProcessed;
    this.currentState.items_remaining = Math.max(
      0,
      this.currentState.items_remaining - itemsProcessed,
    );
    this.currentState.last_updated = new Date().toISOString();

    // Record agent-specific usage
    if (agentRole) {
      if (!this.currentState.agent_usage[agentRole]) {
        this.currentState.agent_usage[agentRole] = {
          cost_usd: 0,
          time_ms: 0,
          call_count: 0,
        };
      }

      this.currentState.agent_usage[agentRole].cost_usd += actualCost;
      this.currentState.agent_usage[agentRole].time_ms += actualTimeMs;
      this.currentState.agent_usage[agentRole].call_count += 1;
    }

    this.saveBudgetState();
  }

  /**
   * Check kill switch status
   */
  checkKillSwitch(): KillSwitchStatus {
    try {
      // Check environment variable first
      if (process.env.HARD_STOP === "1" || process.env.HARD_STOP === "true") {
        return {
          enabled: true,
          triggered: true,
          trigger_reason: "Environment variable HARD_STOP=1",
          trigger_timestamp: new Date().toISOString(),
          manual_override: false,
        };
      }

      // Check kill switch file
      if (existsSync(this.killSwitchFile)) {
        const content = readFileSync(this.killSwitchFile, "utf-8");
        const killSwitch = JSON.parse(content) as KillSwitchStatus;

        const st: any = {
          enabled: killSwitch.enabled ?? false,
          triggered: killSwitch.triggered ?? false,
          manual_override: killSwitch.manual_override ?? false,
        };
        if (killSwitch.trigger_reason)
          st.trigger_reason = killSwitch.trigger_reason;
        if (killSwitch.trigger_timestamp)
          st.trigger_timestamp = killSwitch.trigger_timestamp;
        return st;
      }

      return {
        enabled: false,
        triggered: false,
        trigger_reason: "",
        manual_override: false,
      };
    } catch (error) {
      console.warn("Failed to check kill switch:", error);
      return {
        enabled: false,
        triggered: false,
        trigger_reason: "Error checking kill switch",
        manual_override: false,
      };
    }
  }

  /**
   * Activate kill switch
   */
  activateKillSwitch(reason: string, manualOverride: boolean = true): void {
    const killSwitch: KillSwitchStatus = {
      enabled: true,
      triggered: true,
      trigger_reason: reason,
      trigger_timestamp: new Date().toISOString(),
      manual_override: manualOverride,
    };

    try {
      writeFileSync(this.killSwitchFile, JSON.stringify(killSwitch, null, 2));
      console.log(`🚨 Kill switch activated: ${reason}`);

      // Update current run status if available
      if (this.currentState) {
        this.currentState.status = "killed";
        this.currentState.warnings.push(`Kill switch: ${reason}`);
        this.saveBudgetState();
      }
    } catch (error) {
      console.error("Failed to activate kill switch:", error);
    }
  }

  /**
   * Deactivate kill switch
   */
  deactivateKillSwitch(): void {
    try {
      if (existsSync(this.killSwitchFile)) {
        require("fs").unlinkSync(this.killSwitchFile);
        console.log("✅ Kill switch deactivated");
      }
    } catch (error) {
      console.error("Failed to deactivate kill switch:", error);
    }
  }

  /**
   * Complete run and finalize budget state
   */
  completeRun(
    finalStatus:
      | "completed"
      | "killed"
      | "budget_exceeded"
      | "paused"
      | "running" = "completed",
  ): RunBudgetState | null {
    if (!this.currentState) {
      return null;
    }

    this.currentState.status = finalStatus;
    this.currentState.last_updated = new Date().toISOString();

    // Calculate final statistics
    const runDurationMs =
      Date.now() - new Date(this.currentState.start_timestamp).getTime();
    const avgCostPerItem =
      this.currentState.items_processed > 0
        ? this.currentState.total_cost_usd / this.currentState.items_processed
        : 0;

    this.currentState.warnings.push(
      `Run completed: ${this.currentState.items_processed} items processed`,
    );
    this.currentState.warnings.push(
      `Total cost: $${this.currentState.total_cost_usd.toFixed(3)}`,
    );
    this.currentState.warnings.push(
      `Average cost per item: $${avgCostPerItem.toFixed(3)}`,
    );
    this.currentState.warnings.push(`Total duration: ${runDurationMs}ms`);

    this.saveBudgetState();
    return this.currentState;
  }

  /**
   * Get current budget state
   */
  getCurrentState(): RunBudgetState | null {
    return this.currentState;
  }

  /**
   * Save budget state to file
   */
  private saveBudgetState(): void {
    if (!this.currentState) return;

    try {
      // Save as temp file first, then atomic rename
      const tempFile = this.budgetFile + ".tmp";
      writeFileSync(tempFile, JSON.stringify(this.currentState, null, 2));
      require("fs").renameSync(tempFile, this.budgetFile);
    } catch (error) {
      console.error("Failed to save budget state:", error);
    }
  }

  /**
   * Generate budget recommendations
   */
  private generateRecommendations(
    costUtilization: number,
    timeUtilization: number,
    warnings: string[],
  ): string[] {
    const recommendations: string[] = [];

    if (costUtilization > 0.8) {
      recommendations.push("Consider optimizing operations to reduce cost");
      recommendations.push("Monitor per-agent cost distribution");
    }

    if (timeUtilization > 0.8) {
      recommendations.push(
        "Consider parallelization to reduce processing time",
      );
      recommendations.push("Review timeout settings for agents");
    }

    if (warnings.length > 0) {
      recommendations.push("Review budget limits for this profile");
    }

    if (costUtilization > 0.9 || timeUtilization > 0.9) {
      recommendations.push(
        "Consider early termination if quality targets are met",
      );
    }

    return recommendations;
  }

  /**
   * Get budget utilization summary
   */
  getBudgetSummary(): any {
    if (!this.currentState) return null;

    const limits = this.currentState.budget_limits;
    const costUtilization =
      this.currentState.total_cost_usd / limits.max_cost_per_run;
    const timeUtilization =
      this.currentState.total_time_ms / limits.max_time_per_run_ms;

    return {
      run_id: this.currentState.run_id,
      status: this.currentState.status,
      cost_utilization_pct: (costUtilization * 100).toFixed(1),
      time_utilization_pct: (timeUtilization * 100).toFixed(1),
      items_processed: this.currentState.items_processed,
      items_remaining: this.currentState.items_remaining,
      total_cost_usd: this.currentState.total_cost_usd,
      budget_remaining_usd:
        limits.max_cost_per_run - this.currentState.total_cost_usd,
      agent_usage: this.currentState.agent_usage,
      warnings_count: this.currentState.warnings.length,
      kill_switch: this.checkKillSwitch(),
    };
  }
}

/**
 * Factory function to create budget guardian
 */
export function createBudgetGuardian(baseDir?: string): BudgetGuardian {
  return new BudgetGuardian(baseDir);
}

/**
 * Default budget limits based on profile
 */
export function getDefaultBudgetLimits(profile: string): BudgetLimits {
  const profiles = {
    dev: {
      max_cost_per_run: 1.0,
      max_cost_per_item: 0.05,
      max_time_per_run_ms: 300000, // 5 minutes
      max_time_per_item_ms: 30000, // 30 seconds
      per_agent_limits: {
        answer: { max_cost_usd: 0.05, max_time_ms: 6000 },
        audit: { max_cost_usd: 0.03, max_time_ms: 4000 },
        evidence: { max_cost_usd: 0.02, max_time_ms: 3000 },
      },
    },
    stage: {
      max_cost_per_run: 2.0,
      max_cost_per_item: 0.1,
      max_time_per_run_ms: 450000, // 7.5 minutes
      max_time_per_item_ms: 45000, // 45 seconds
      per_agent_limits: {
        answer: { max_cost_usd: 0.1, max_time_ms: 10000 },
        audit: { max_cost_usd: 0.06, max_time_ms: 8000 },
        evidence: { max_cost_usd: 0.04, max_time_ms: 6000 },
      },
    },
    prod: {
      max_cost_per_run: 5.0,
      max_cost_per_item: 0.2,
      max_time_per_run_ms: 600000, // 10 minutes
      max_time_per_item_ms: 60000, // 1 minute
      per_agent_limits: {
        answer: { max_cost_usd: 0.2, max_time_ms: 15000 },
        audit: { max_cost_usd: 0.12, max_time_ms: 12000 },
        evidence: { max_cost_usd: 0.08, max_time_ms: 10000 },
      },
    },
  };

  return profiles[profile as keyof typeof profiles] || profiles.dev;
}
