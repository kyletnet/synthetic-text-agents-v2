#!/usr/bin/env node
/**
 * Pre-flight Integration Script
 * TypeScript implementation of the preflight_and_full_run.sh workflow
 * Integrates all the new systems: thresholds, DLQ, budget, manifest, etc.
 */
interface PreflightConfig {
    profile: "dev" | "stage" | "prod";
    budget_smoke_usd: number;
    budget_full_usd: number;
    run_tags: string;
    hard_stop: boolean;
    skip_dry_run: boolean;
    force_full_run: boolean;
}
interface PreflightResult {
    smoke_passed: boolean;
    full_run_executed: boolean;
    final_status: "SUCCESS" | "FAILED" | "BLOCKED";
    artifacts: {
        session_report_path: string;
        observability_path: string;
        dlq_items: number;
        trace_tree_path?: string;
    };
    timing: {
        smoke_duration_ms: number;
        full_duration_ms: number;
        total_duration_ms: number;
    };
    costs: {
        smoke_cost_usd: number;
        full_cost_usd: number;
        total_cost_usd: number;
    };
}
export declare class PreflightRunner {
    private config;
    private timestamp;
    private reportDir;
    private runLogsDir;
    private dlqDir;
    private obsDir;
    private thresholdManager;
    private manifestManager;
    private budgetGuardian;
    private dlqManager;
    private gatingIntegrator;
    private checkpointManager;
    constructor(config?: Partial<PreflightConfig>);
    private setupDirectories;
    /**
     * Execute the complete preflight and full run workflow
     */
    execute(): Promise<PreflightResult>;
    /**
     * Step 1: Initialize and verify all systems
     */
    private initializeAndVerifySystems;
    /**
     * Step 2: Optional dry run smoke (no cost)
     */
    private runDryRunSmoke;
    /**
     * Step 3: Paid smoke run (critical validation)
     */
    private runPaidSmoke;
    /**
     * Step 4: Full run execution
     */
    private runFullExecution;
    /**
     * Step 5: Post-processing (DLQ, observability)
     */
    private postProcessing;
    /**
     * Generate observability artifacts
     */
    private generateObservabilityArtifacts;
    /**
     * Validate final reports
     */
    private validateFinalReports;
    /**
     * Helper methods
     */
    private simulateQuickSmoke;
    private simulateFullRun;
    private generateObservabilityHTML;
    private createFailedResult;
}
export type { PreflightConfig, PreflightResult };
//# sourceMappingURL=preflight_integration.d.ts.map