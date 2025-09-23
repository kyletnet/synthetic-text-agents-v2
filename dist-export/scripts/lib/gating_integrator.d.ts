/**
 * gating_integrator.ts — Evaluate session reports against success criteria for gating decisions
 */
interface GatingCriteria {
    minCases: number;
    requireCostGt: number;
    maxWarn: number;
    enforceResult: string[];
    customThresholds?: {
        p0?: any;
        p1?: any;
        p2?: any;
    };
}
interface GatingResult {
    canProceed: boolean;
    reason: string;
    violations: string[];
    criteria: GatingCriteria;
    sessionMetrics: {
        totalCases: number;
        successfulCases: number;
        totalCost: number;
        result: string;
        warningCount: number;
        errorCount: number;
        p0Violations: string[];
        p1Warnings: string[];
        p2Issues: string[];
    };
    decision: {
        timestamp: string;
        profile: string;
        gateStatus: "PASS" | "WARN" | "PARTIAL" | "FAIL";
        overallScore: number;
    };
}
export declare class GatingIntegrator {
    private thresholdManager;
    constructor();
    evaluateSession(sessionReportPath: string, criteria: GatingCriteria): Promise<GatingResult>;
    private loadSessionReport;
    private extractJSONFromMarkdown;
    private extractNumericValue;
    private extractStringValue;
    private extractSessionMetrics;
    private evaluateMinCases;
    private evaluateCostRequirement;
    private evaluateWarningLimit;
    private evaluateResultRequirement;
    private evaluateThresholdViolations;
    private determineGateStatus;
    private calculateOverallScore;
    private logGatingDecision;
    evaluateAndExit(sessionReportPath: string, criteria: GatingCriteria): Promise<never>;
}
export {};
//# sourceMappingURL=gating_integrator.d.ts.map