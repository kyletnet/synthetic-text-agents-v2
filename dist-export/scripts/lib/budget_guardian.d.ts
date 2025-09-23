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
export declare class BudgetGuardian {
    private budgetFile;
    private killSwitchFile;
    private currentState;
    constructor(baseDir?: string);
    /**
     * Initialize budget tracking for a new run
     */
    initializeRun(runId: string, sessionId: string, profile: string, budgetLimits: BudgetLimits, estimatedItems: number): RunBudgetState;
    /**
     * Load existing budget state
     */
    loadBudgetState(runId?: string): RunBudgetState | null;
    /**
     * Check if operation can proceed within budget
     */
    checkBudget(estimatedCost?: number, estimatedTimeMs?: number, agentRole?: string): BudgetCheckResult;
    /**
     * Record actual usage after operation completion
     */
    recordUsage(actualCost: number, actualTimeMs: number, agentRole?: string, itemsProcessed?: number): void;
    /**
     * Check kill switch status
     */
    checkKillSwitch(): KillSwitchStatus;
    /**
     * Activate kill switch
     */
    activateKillSwitch(reason: string, manualOverride?: boolean): void;
    /**
     * Deactivate kill switch
     */
    deactivateKillSwitch(): void;
    /**
     * Complete run and finalize budget state
     */
    completeRun(finalStatus?: "completed" | "killed" | "budget_exceeded" | "paused" | "running"): RunBudgetState | null;
    /**
     * Get current budget state
     */
    getCurrentState(): RunBudgetState | null;
    /**
     * Save budget state to file
     */
    private saveBudgetState;
    /**
     * Generate budget recommendations
     */
    private generateRecommendations;
    /**
     * Get budget utilization summary
     */
    getBudgetSummary(): any;
}
/**
 * Factory function to create budget guardian
 */
export declare function createBudgetGuardian(baseDir?: string): BudgetGuardian;
/**
 * Default budget limits based on profile
 */
export declare function getDefaultBudgetLimits(profile: string): BudgetLimits;
//# sourceMappingURL=budget_guardian.d.ts.map