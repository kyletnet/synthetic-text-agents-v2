/**
 * Threshold Manager v1.0
 * Manages P0/P1/P2 thresholds with auto-calibration for baseline metrics
 *
 * P0 (Critical): Fixed thresholds, non-negotiable
 * P1 (Performance): Auto-calibrated from historical data
 * P2 (Quality): Auto-calibrated from historical data
 */
export interface P0Thresholds {
    pii_hits_max: number;
    license_violations_max: number;
    evidence_missing_rate_max: number;
    hallucination_rate_max: number;
}
export interface P1Thresholds {
    cost_per_item_warn: number;
    cost_per_item_fail: number;
    latency_p95_warn_ms: number;
    latency_p95_fail_ms: number;
    failure_rate_warn: number;
    failure_rate_fail: number;
}
export interface P2Thresholds {
    duplication_rate_warn: number;
    duplication_rate_fail: number;
    coverage_rate_warn: number;
    coverage_rate_fail: number;
    quality_score_warn: number;
    quality_score_fail: number;
}
export interface ProfileConfig {
    name: string;
    budget_max_usd: number;
    timeout_max_ms: number;
    per_agent_limits: {
        answer_max_usd: number;
        audit_max_ms: number;
    };
}
export interface ThresholdConfig {
    p0: P0Thresholds;
    p1: P1Thresholds;
    p2: P2Thresholds;
}
export interface AutoCalibrationConfig {
    enabled: boolean;
    lookback_runs: number;
    percentile_warn: number;
    percentile_fail: number;
    drift_guard_max_delta: number;
}
export interface HistoricalMetrics {
    timestamp: string;
    session_id: string;
    cost_per_item: number;
    latency_p95_ms: number;
    failure_rate: number;
    duplication_rate: number;
    coverage_rate: number;
    quality_score: number;
    evidence_missing_rate: number;
    hallucination_rate: number;
    pii_hits: number;
    license_violations: number;
}
export interface CalibrationResult {
    metric_name: string;
    threshold_type: "warn" | "fail";
    old_value: number;
    new_value: number;
    change_pct: number;
    applied: boolean;
    drift_guard_triggered: boolean;
    percentile_source: number;
}
export interface ThresholdViolation {
    level: "P0" | "P1" | "P2";
    metric: string;
    threshold_type: "warn" | "fail";
    actual_value: number;
    threshold_value: number;
    severity: "critical" | "high" | "medium" | "low";
    message: string;
}
export interface GatingResult {
    gate_status: "PASS" | "WARN" | "PARTIAL" | "FAIL";
    can_proceed: boolean;
    p0_violations: string[];
    p1_warnings: string[];
    p2_issues: string[];
    violations: ThresholdViolation[];
    recommendation: string;
}
export declare class ThresholdManager {
    private configPath;
    private baselineConfig;
    constructor(configPath?: string);
    /**
     * Load configuration from baseline_config.json
     */
    private loadConfig;
    /**
     * Get P0 thresholds (always fixed, never auto-calibrated)
     */
    getP0Thresholds(): P0Thresholds;
    /**
     * Get P1 thresholds for a specific profile
     */
    getP1Thresholds(profile?: string): P1Thresholds;
    /**
     * Get P2 thresholds for a specific profile
     */
    getP2Thresholds(profile?: string): P2Thresholds;
    /**
     * Get profile configuration
     */
    getProfileConfig(profile: string): ProfileConfig;
    /**
     * Get auto-calibration configuration
     */
    getAutoCalibrationConfig(): AutoCalibrationConfig;
    /**
     * Load historical metrics from recent baseline reports
     */
    loadHistoricalMetrics(): Promise<HistoricalMetrics[]>;
    /**
     * Calculate percentile value from array of numbers
     */
    private calculatePercentile;
    /**
     * Auto-calibrate P1 and P2 thresholds based on historical data
     */
    autoCalibrateThresholds(profile?: string): Promise<CalibrationResult[]>;
    /**
     * Calibrate P1 thresholds
     */
    private calibrateP1Metrics;
    /**
     * Calibrate P2 thresholds
     */
    private calibrateP2Metrics;
    /**
     * Create calibration result with drift guard protection
     */
    private createCalibrationResult;
    /**
     * Apply calibration results to configuration
     */
    applyCalibrationResults(results: CalibrationResult[], profile?: string): void;
    /**
     * Parse metric name to extract group (p1/p2) and metric name
     */
    private parseMetricName;
    /**
     * Evaluate current metrics against thresholds and return gating result
     */
    evaluateGating(currentMetrics: any, profile?: string): GatingResult;
    /**
     * Evaluate P1 thresholds
     */
    private evaluateP1Thresholds;
    /**
     * Evaluate P2 thresholds
     */
    private evaluateP2Thresholds;
    private calculateFailureRate;
    private calculateCoverageRate;
    private calculateEvidenceMissingRate;
    private calculateHallucinationRate;
    private calculatePIIHits;
    private calculateLicenseViolations;
    /**
     * Get calibration status for a profile
     */
    getCalibrationStatus(profile: string): Promise<{
        status: string;
        lastCalibration?: string;
        nextDue?: string;
    }>;
}
/**
 * Factory function to create threshold manager instance
 */
export declare function createThresholdManager(configPath?: string): ThresholdManager;
/**
 * Convenience function to get all thresholds for a profile
 */
export declare function getAllThresholds(profile?: string, configPath?: string): ThresholdConfig;
//# sourceMappingURL=thresholdManager.d.ts.map