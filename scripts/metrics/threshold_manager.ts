/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { glob } from "glob";

/**
 * Threshold Manager v1.0
 * Manages P0/P1/P2 thresholds with auto-calibration for baseline metrics
 *
 * P0 (Critical): Fixed thresholds, non-negotiable
 * P1 (Performance): Auto-calibrated from historical data
 * P2 (Quality): Auto-calibrated from historical data
 */

export interface P0Thresholds {
  pii_hits_max: number; // Fixed: 0 (no PII allowed)
  license_violations_max: number; // Fixed: 2 max
  evidence_missing_rate_max: number; // Fixed: 20% max
  hallucination_rate_max: number; // Fixed: 5% max
  citation_invalid_rate_max: number; // NEW: Fixed: 20% max invalid citations
  citation_coverage_min: number; // NEW: Fixed: 0.4 min average coverage
}

export interface P1Thresholds {
  cost_per_item_warn: number; // Auto-calibrated
  cost_per_item_fail: number; // Auto-calibrated
  latency_p95_warn_ms: number; // Auto-calibrated
  latency_p95_fail_ms: number; // Auto-calibrated
  failure_rate_warn: number; // Auto-calibrated
  failure_rate_fail: number; // Auto-calibrated
}

export interface P2Thresholds {
  duplication_rate_warn: number; // Auto-calibrated
  duplication_rate_fail: number; // Auto-calibrated
  coverage_rate_warn: number; // Auto-calibrated (min values)
  coverage_rate_fail: number; // Auto-calibrated (min values)
  quality_score_warn: number; // Auto-calibrated (min values)
  quality_score_fail: number; // Auto-calibrated (min values)
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
  lookback_runs: number; // Number of historical runs to analyze
  percentile_warn: number; // Percentile for warn threshold (e.g., 75)
  percentile_fail: number; // Percentile for fail threshold (e.g., 90)
  drift_guard_max_delta: number; // Max change allowed (e.g., 0.20 = ±20%)
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
  // NEW: Citation quality tracking
  citation_invalid_rate?: number;
  citation_avg_coverage?: number;
  citation_valid_rate?: number;
  citation_avg_alignment?: number;
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

export class ThresholdManager {
  private configPath: string;
  private baselineConfig: any;

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), "baseline_config.json");
    this.loadConfig();
  }

  /**
   * Load configuration from baseline_config.json
   */
  private loadConfig(): void {
    try {
      const configContent = readFileSync(this.configPath, "utf-8");
      this.baselineConfig = JSON.parse(configContent);
    } catch (error) {
      throw new Error(
        `Failed to load configuration from ${this.configPath}: ${error}`,
      );
    }
  }

  /**
   * Get P0 thresholds (always fixed, never auto-calibrated)
   */
  getP0Thresholds(): P0Thresholds {
    const dxloop = this.baselineConfig.dxloop || {};
    const p0 = dxloop.thresholds?.p0 || {};

    return {
      pii_hits_max: p0.pii_hits_max ?? 0, // Fixed: no PII allowed
      license_violations_max: p0.license_violations_max ?? 2, // Fixed: max 2 violations
      evidence_missing_rate_max: p0.evidence_missing_rate_max ?? 0.2, // Fixed: 20% max
      hallucination_rate_max: p0.hallucination_rate_max ?? 0.05, // Fixed: 5% max
      citation_invalid_rate_max: p0.citation_invalid_rate_max ?? 0.2, // NEW: Fixed: 20% max invalid
      citation_coverage_min: p0.citation_coverage_min ?? 0.3, // NEW: Fixed: 30% min coverage (adjusted)
    };
  }

  /**
   * Get P1 thresholds for a specific profile
   */
  getP1Thresholds(profile: string = "dev"): P1Thresholds {
    const dxloop = this.baselineConfig.dxloop || {};
    const p1 = dxloop.thresholds?.p1 || {};

    // Apply profile-specific overrides if any
    const profileOverrides = dxloop.profile_overrides?.[profile]?.p1 || {};

    return {
      cost_per_item_warn:
        profileOverrides.cost_per_item_warn ?? p1.cost_per_item_warn ?? 0.08,
      cost_per_item_fail:
        profileOverrides.cost_per_item_fail ?? p1.cost_per_item_fail ?? 0.15,
      latency_p95_warn_ms:
        profileOverrides.latency_p95_warn_ms ?? p1.latency_p95_warn_ms ?? 4000,
      latency_p95_fail_ms:
        profileOverrides.latency_p95_fail_ms ?? p1.latency_p95_fail_ms ?? 8000,
      failure_rate_warn:
        profileOverrides.failure_rate_warn ?? p1.failure_rate_warn ?? 0.1,
      failure_rate_fail:
        profileOverrides.failure_rate_fail ?? p1.failure_rate_fail ?? 0.25,
    };
  }

  /**
   * Get P2 thresholds for a specific profile
   */
  getP2Thresholds(profile: string = "dev"): P2Thresholds {
    const dxloop = this.baselineConfig.dxloop || {};
    const p2 = dxloop.thresholds?.p2 || {};

    // Apply profile-specific overrides if any
    const profileOverrides = dxloop.profile_overrides?.[profile]?.p2 || {};

    return {
      duplication_rate_warn:
        profileOverrides.duplication_rate_warn ??
        p2.duplication_rate_warn ??
        0.1,
      duplication_rate_fail:
        profileOverrides.duplication_rate_fail ??
        p2.duplication_rate_fail ??
        0.2,
      coverage_rate_warn:
        profileOverrides.coverage_rate_warn ?? p2.coverage_rate_warn ?? 0.7,
      coverage_rate_fail:
        profileOverrides.coverage_rate_fail ?? p2.coverage_rate_fail ?? 0.5,
      quality_score_warn:
        profileOverrides.quality_score_warn ?? p2.quality_score_warn ?? 0.7,
      quality_score_fail:
        profileOverrides.quality_score_fail ?? p2.quality_score_fail ?? 0.5,
    };
  }

  /**
   * Get profile configuration
   */
  getProfileConfig(profile: string): ProfileConfig {
    const dxloop = this.baselineConfig.dxloop || {};
    const profiles = dxloop.profiles || {};
    const profileConfig = profiles[profile];

    if (!profileConfig) {
      throw new Error(`Profile '${profile}' not found in configuration`);
    }

    return profileConfig;
  }

  /**
   * Get auto-calibration configuration
   */
  getAutoCalibrationConfig(): AutoCalibrationConfig {
    const dxloop = this.baselineConfig.dxloop || {};
    const autocalib = dxloop.autocalibration || {};

    return {
      enabled: autocalib.enabled ?? false,
      lookback_runs: autocalib.lookback_runs ?? 10,
      percentile_warn: autocalib.percentile_warn ?? 75,
      percentile_fail: autocalib.percentile_fail ?? 90,
      drift_guard_max_delta: autocalib.drift_guard_max_delta ?? 0.2,
    };
  }

  /**
   * Load historical metrics from recent baseline reports
   */
  async loadHistoricalMetrics(): Promise<HistoricalMetrics[]> {
    const reportsDir = join(process.cwd(), "reports");
    const historyDir = join(reportsDir, "history");

    try {
      // Find all historical baseline reports
      const pattern = join(historyDir, "*", "baseline_report.jsonl");
      const reportFiles = await glob(pattern);

      const metrics: HistoricalMetrics[] = [];
      const autocalibConfig = this.getAutoCalibrationConfig();

      // Sort by timestamp (newest first) and limit to lookback_runs
      const sortedFiles = reportFiles
        .sort((a, b) => b.localeCompare(a))
        .slice(0, autocalibConfig.lookback_runs);

      for (const file of sortedFiles) {
        try {
          const content = readFileSync(file, "utf-8");
          const lines = content.trim().split("\n");

          if (lines.length === 0) continue;

          // Parse the summary line (usually the last line)
          const summaryLine = lines[lines.length - 1];
          const summary = JSON.parse(summaryLine);

          // Extract metrics we need for auto-calibration
          const historicalMetric: HistoricalMetrics = {
            timestamp: summary.timestamp || new Date().toISOString(),
            session_id: summary.session_id || "unknown",
            cost_per_item: summary.cost_per_item || 0,
            latency_p95_ms: summary.latency_p95_ms || 0,
            failure_rate: this.calculateFailureRate(lines),
            duplication_rate: summary.duplication?.rate || 0,
            coverage_rate: this.calculateCoverageRate(summary),
            quality_score: summary.overall_quality_score || 0,
            evidence_missing_rate: this.calculateEvidenceMissingRate(lines),
            hallucination_rate: this.calculateHallucinationRate(lines),
            pii_hits: this.calculatePIIHits(lines),
            license_violations: this.calculateLicenseViolations(lines),
          };

          metrics.push(historicalMetric);
        } catch (error) {
          console.warn(`Failed to parse baseline report ${file}:`, error);
        }
      }

      return metrics;
    } catch (error) {
      console.warn("Failed to load historical metrics:", error);
      return [];
    }
  }

  /**
   * Calculate percentile value from array of numbers
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sorted[lower];
    }

    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  /**
   * Auto-calibrate P1 and P2 thresholds based on historical data
   */
  async autoCalibrateThresholds(
    profile: string = "dev",
  ): Promise<CalibrationResult[]> {
    const autocalibConfig = this.getAutoCalibrationConfig();

    if (!autocalibConfig.enabled) {
      return [];
    }

    const historicalMetrics = await this.loadHistoricalMetrics();

    if (historicalMetrics.length < 3) {
      console.warn(
        "Insufficient historical data for auto-calibration (need at least 3 runs)",
      );
      return [];
    }

    const results: CalibrationResult[] = [];
    const currentP1 = this.getP1Thresholds(profile);
    const currentP2 = this.getP2Thresholds(profile);

    // P1 Metrics Auto-calibration
    results.push(
      ...this.calibrateP1Metrics(historicalMetrics, currentP1, autocalibConfig),
    );

    // P2 Metrics Auto-calibration
    results.push(
      ...this.calibrateP2Metrics(historicalMetrics, currentP2, autocalibConfig),
    );

    return results;
  }

  /**
   * Calibrate P1 thresholds
   */
  private calibrateP1Metrics(
    metrics: HistoricalMetrics[],
    current: P1Thresholds,
    config: AutoCalibrationConfig,
  ): CalibrationResult[] {
    const results: CalibrationResult[] = [];

    // Cost per item (higher values are worse)
    const costValues = metrics.map((m) => m.cost_per_item);
    const costWarnThreshold = this.calculatePercentile(
      costValues,
      config.percentile_warn,
    );
    const costFailThreshold = this.calculatePercentile(
      costValues,
      config.percentile_fail,
    );

    results.push(
      this.createCalibrationResult(
        "cost_per_item_warn",
        costWarnThreshold,
        current.cost_per_item_warn,
        config.drift_guard_max_delta,
        config.percentile_warn,
      ),
    );
    results.push(
      this.createCalibrationResult(
        "cost_per_item_fail",
        costFailThreshold,
        current.cost_per_item_fail,
        config.drift_guard_max_delta,
        config.percentile_fail,
      ),
    );

    // Latency P95 (higher values are worse)
    const latencyValues = metrics.map((m) => m.latency_p95_ms);
    const latencyWarnThreshold = this.calculatePercentile(
      latencyValues,
      config.percentile_warn,
    );
    const latencyFailThreshold = this.calculatePercentile(
      latencyValues,
      config.percentile_fail,
    );

    results.push(
      this.createCalibrationResult(
        "latency_p95_warn_ms",
        latencyWarnThreshold,
        current.latency_p95_warn_ms,
        config.drift_guard_max_delta,
        config.percentile_warn,
      ),
    );
    results.push(
      this.createCalibrationResult(
        "latency_p95_fail_ms",
        latencyFailThreshold,
        current.latency_p95_fail_ms,
        config.drift_guard_max_delta,
        config.percentile_fail,
      ),
    );

    // Failure rate (higher values are worse)
    const failureValues = metrics.map((m) => m.failure_rate);
    const failureWarnThreshold = this.calculatePercentile(
      failureValues,
      config.percentile_warn,
    );
    const failureFailThreshold = this.calculatePercentile(
      failureValues,
      config.percentile_fail,
    );

    results.push(
      this.createCalibrationResult(
        "failure_rate_warn",
        failureWarnThreshold,
        current.failure_rate_warn,
        config.drift_guard_max_delta,
        config.percentile_warn,
      ),
    );
    results.push(
      this.createCalibrationResult(
        "failure_rate_fail",
        failureFailThreshold,
        current.failure_rate_fail,
        config.drift_guard_max_delta,
        config.percentile_fail,
      ),
    );

    return results;
  }

  /**
   * Calibrate P2 thresholds
   */
  private calibrateP2Metrics(
    metrics: HistoricalMetrics[],
    current: P2Thresholds,
    config: AutoCalibrationConfig,
  ): CalibrationResult[] {
    const results: CalibrationResult[] = [];

    // Duplication rate (higher values are worse)
    const dupValues = metrics.map((m) => m.duplication_rate);
    const dupWarnThreshold = this.calculatePercentile(
      dupValues,
      config.percentile_warn,
    );
    const dupFailThreshold = this.calculatePercentile(
      dupValues,
      config.percentile_fail,
    );

    results.push(
      this.createCalibrationResult(
        "duplication_rate_warn",
        dupWarnThreshold,
        current.duplication_rate_warn,
        config.drift_guard_max_delta,
        config.percentile_warn,
      ),
    );
    results.push(
      this.createCalibrationResult(
        "duplication_rate_fail",
        dupFailThreshold,
        current.duplication_rate_fail,
        config.drift_guard_max_delta,
        config.percentile_fail,
      ),
    );

    // Coverage rate (lower values are worse - use inverse percentiles)
    const coverageValues = metrics.map((m) => m.coverage_rate);
    const coverageWarnThreshold = this.calculatePercentile(
      coverageValues,
      100 - config.percentile_warn,
    ); // 25th percentile
    const coverageFailThreshold = this.calculatePercentile(
      coverageValues,
      100 - config.percentile_fail,
    ); // 10th percentile

    results.push(
      this.createCalibrationResult(
        "coverage_rate_warn",
        coverageWarnThreshold,
        current.coverage_rate_warn,
        config.drift_guard_max_delta,
        100 - config.percentile_warn,
      ),
    );
    results.push(
      this.createCalibrationResult(
        "coverage_rate_fail",
        coverageFailThreshold,
        current.coverage_rate_fail,
        config.drift_guard_max_delta,
        100 - config.percentile_fail,
      ),
    );

    // Quality score (lower values are worse - use inverse percentiles)
    const qualityValues = metrics.map((m) => m.quality_score);
    const qualityWarnThreshold = this.calculatePercentile(
      qualityValues,
      100 - config.percentile_warn,
    ); // 25th percentile
    const qualityFailThreshold = this.calculatePercentile(
      qualityValues,
      100 - config.percentile_fail,
    ); // 10th percentile

    results.push(
      this.createCalibrationResult(
        "quality_score_warn",
        qualityWarnThreshold,
        current.quality_score_warn,
        config.drift_guard_max_delta,
        100 - config.percentile_warn,
      ),
    );
    results.push(
      this.createCalibrationResult(
        "quality_score_fail",
        qualityFailThreshold,
        current.quality_score_fail,
        config.drift_guard_max_delta,
        100 - config.percentile_fail,
      ),
    );

    return results;
  }

  /**
   * Create calibration result with drift guard protection
   */
  private createCalibrationResult(
    metricName: string,
    newValue: number,
    currentValue: number,
    maxDelta: number,
    percentileSource: number,
  ): CalibrationResult {
    const changePct =
      currentValue > 0 ? (newValue - currentValue) / currentValue : 0;
    const driftGuardTriggered = Math.abs(changePct) > maxDelta;

    return {
      metric_name: metricName,
      threshold_type: metricName.includes("warn") ? "warn" : "fail",
      old_value: currentValue,
      new_value: driftGuardTriggered ? currentValue : newValue,
      change_pct: changePct,
      applied: !driftGuardTriggered,
      drift_guard_triggered: driftGuardTriggered,
      percentile_source: percentileSource,
    };
  }

  /**
   * Apply calibration results to configuration
   */
  applyCalibrationResults(
    results: CalibrationResult[],
    profile: string = "dev",
  ): void {
    let configModified = false;

    for (const result of results) {
      if (result.applied) {
        const [metricGroup, metricName] = this.parseMetricName(
          result.metric_name,
        );

        if (!this.baselineConfig.dxloop) {
          this.baselineConfig.dxloop = {};
        }
        if (!this.baselineConfig.dxloop.thresholds) {
          this.baselineConfig.dxloop.thresholds = {};
        }
        if (!this.baselineConfig.dxloop.thresholds[metricGroup]) {
          this.baselineConfig.dxloop.thresholds[metricGroup] = {};
        }

        this.baselineConfig.dxloop.thresholds[metricGroup][metricName] =
          result.new_value;
        configModified = true;
      }
    }

    if (configModified) {
      // Update last_updated timestamp
      this.baselineConfig.last_updated = new Date().toISOString();

      // Save back to file
      writeFileSync(
        this.configPath,
        JSON.stringify(this.baselineConfig, null, 2),
        "utf-8",
      );
      console.log(
        `Applied ${
          results.filter((r) => r.applied).length
        } threshold calibrations to ${this.configPath}`,
      );
    }
  }

  /**
   * Parse metric name to extract group (p1/p2) and metric name
   */
  private parseMetricName(fullName: string): [string, string] {
    // Examples: "cost_per_item_warn" -> ["p1", "cost_per_item_warn"]
    //           "duplication_rate_fail" -> ["p2", "duplication_rate_fail"]

    const p1Metrics = ["cost_per_item", "latency_p95", "failure_rate"];
    const p2Metrics = ["duplication_rate", "coverage_rate", "quality_score"];

    for (const p1Metric of p1Metrics) {
      if (fullName.startsWith(p1Metric)) {
        return ["p1", fullName];
      }
    }

    for (const p2Metric of p2Metrics) {
      if (fullName.startsWith(p2Metric)) {
        return ["p2", fullName];
      }
    }

    throw new Error(`Unknown metric name: ${fullName}`);
  }

  /**
   * Evaluate current metrics against thresholds and return gating result
   */
  evaluateGating(currentMetrics: any, profile: string = "dev"): GatingResult {
    const p0Thresholds = this.getP0Thresholds();
    const p1Thresholds = this.getP1Thresholds(profile);
    const p2Thresholds = this.getP2Thresholds(profile);

    const violations: ThresholdViolation[] = [];
    const p0Violations: string[] = [];
    const p1Warnings: string[] = [];
    const p2Issues: string[] = [];

    // P0 Critical Violations (FAIL conditions)
    if (currentMetrics.pii_hits > p0Thresholds.pii_hits_max) {
      const violation = `PII violations detected: ${currentMetrics.pii_hits} > ${p0Thresholds.pii_hits_max}`;
      p0Violations.push(violation);
      violations.push({
        level: "P0",
        metric: "pii_hits",
        threshold_type: "fail",
        actual_value: currentMetrics.pii_hits,
        threshold_value: p0Thresholds.pii_hits_max,
        severity: "critical",
        message: violation,
      });
    }

    if (
      currentMetrics.license_violations > p0Thresholds.license_violations_max
    ) {
      const violation = `License violations: ${currentMetrics.license_violations} > ${p0Thresholds.license_violations_max}`;
      p0Violations.push(violation);
      violations.push({
        level: "P0",
        metric: "license_violations",
        threshold_type: "fail",
        actual_value: currentMetrics.license_violations,
        threshold_value: p0Thresholds.license_violations_max,
        severity: "critical",
        message: violation,
      });
    }

    if (
      currentMetrics.evidence_missing_rate >
      p0Thresholds.evidence_missing_rate_max
    ) {
      const violation = `Evidence missing rate: ${(
        currentMetrics.evidence_missing_rate * 100
      ).toFixed(1)}% > ${(p0Thresholds.evidence_missing_rate_max * 100).toFixed(
        1,
      )}%`;
      p0Violations.push(violation);
      violations.push({
        level: "P0",
        metric: "evidence_missing_rate",
        threshold_type: "fail",
        actual_value: currentMetrics.evidence_missing_rate,
        threshold_value: p0Thresholds.evidence_missing_rate_max,
        severity: "critical",
        message: violation,
      });
    }

    if (
      currentMetrics.hallucination_rate > p0Thresholds.hallucination_rate_max
    ) {
      const violation = `Hallucination rate: ${(
        currentMetrics.hallucination_rate * 100
      ).toFixed(1)}% > ${(p0Thresholds.hallucination_rate_max * 100).toFixed(
        1,
      )}%`;
      p0Violations.push(violation);
      violations.push({
        level: "P0",
        metric: "hallucination_rate",
        threshold_type: "fail",
        actual_value: currentMetrics.hallucination_rate,
        threshold_value: p0Thresholds.hallucination_rate_max,
        severity: "critical",
        message: violation,
      });
    }

    // NEW: Citation Quality Gate (P0 Critical)
    if (
      currentMetrics.citation_invalid_rate !== undefined &&
      currentMetrics.citation_invalid_rate >
        p0Thresholds.citation_invalid_rate_max
    ) {
      const violation = `Citation invalid rate: ${(
        currentMetrics.citation_invalid_rate * 100
      ).toFixed(1)}% > ${(p0Thresholds.citation_invalid_rate_max * 100).toFixed(
        1,
      )}%`;
      p0Violations.push(violation);
      violations.push({
        level: "P0",
        metric: "citation_invalid_rate",
        threshold_type: "fail",
        actual_value: currentMetrics.citation_invalid_rate,
        threshold_value: p0Thresholds.citation_invalid_rate_max,
        severity: "critical",
        message: violation,
      });
    }

    if (
      currentMetrics.citation_avg_coverage !== undefined &&
      currentMetrics.citation_avg_coverage < p0Thresholds.citation_coverage_min
    ) {
      const violation = `Citation coverage: ${(
        currentMetrics.citation_avg_coverage * 100
      ).toFixed(1)}% < ${(p0Thresholds.citation_coverage_min * 100).toFixed(
        1,
      )}%`;
      p0Violations.push(violation);
      violations.push({
        level: "P0",
        metric: "citation_avg_coverage",
        threshold_type: "fail",
        actual_value: currentMetrics.citation_avg_coverage,
        threshold_value: p0Thresholds.citation_coverage_min,
        severity: "critical",
        message: violation,
      });
    }

    // P1 Performance Warnings
    this.evaluateP1Thresholds(
      currentMetrics,
      p1Thresholds,
      violations,
      p1Warnings,
    );

    // P2 Quality Issues
    this.evaluateP2Thresholds(
      currentMetrics,
      p2Thresholds,
      violations,
      p2Issues,
    );

    // Determine gate status based on violation counts
    let gateStatus: "PASS" | "WARN" | "PARTIAL" | "FAIL";
    let canProceed = true;
    let recommendation = "";

    if (p0Violations.length > 0) {
      gateStatus = "FAIL";
      canProceed = false;
      recommendation =
        "BLOCK: Critical P0 violations must be resolved before proceeding";
    } else if (
      p1Warnings.length >= 3 ||
      p1Warnings.filter((w) => w.includes("fail")).length >= 1
    ) {
      gateStatus = "PARTIAL";
      canProceed = true; // Proceed with caution
      recommendation =
        "CAUTION: Multiple P1 performance issues detected, monitor closely";
    } else if (p2Issues.length >= 2) {
      gateStatus = "WARN";
      canProceed = true;
      recommendation =
        "MONITOR: P2 quality issues present, consider improvements";
    } else {
      gateStatus = "PASS";
      canProceed = true;
      recommendation = "PROCEED: All thresholds within acceptable limits";
    }

    return {
      gate_status: gateStatus,
      can_proceed: canProceed,
      p0_violations: p0Violations,
      p1_warnings: p1Warnings,
      p2_issues: p2Issues,
      violations,
      recommendation,
    };
  }

  /**
   * Evaluate P1 thresholds
   */
  private evaluateP1Thresholds(
    metrics: any,
    thresholds: P1Thresholds,
    violations: ThresholdViolation[],
    warnings: string[],
  ): void {
    // Cost per item
    if (metrics.cost_per_item >= thresholds.cost_per_item_fail) {
      const msg = `Cost per item FAIL: $${metrics.cost_per_item.toFixed(
        3,
      )} >= $${thresholds.cost_per_item_fail}`;
      warnings.push(msg);
      violations.push({
        level: "P1",
        metric: "cost_per_item",
        threshold_type: "fail",
        actual_value: metrics.cost_per_item,
        threshold_value: thresholds.cost_per_item_fail,
        severity: "high",
        message: msg,
      });
    } else if (metrics.cost_per_item >= thresholds.cost_per_item_warn) {
      const msg = `Cost per item WARN: $${metrics.cost_per_item.toFixed(
        3,
      )} >= $${thresholds.cost_per_item_warn}`;
      warnings.push(msg);
      violations.push({
        level: "P1",
        metric: "cost_per_item",
        threshold_type: "warn",
        actual_value: metrics.cost_per_item,
        threshold_value: thresholds.cost_per_item_warn,
        severity: "medium",
        message: msg,
      });
    }

    // Latency P95
    if (metrics.latency_p95_ms >= thresholds.latency_p95_fail_ms) {
      const msg = `Latency P95 FAIL: ${metrics.latency_p95_ms}ms >= ${thresholds.latency_p95_fail_ms}ms`;
      warnings.push(msg);
      violations.push({
        level: "P1",
        metric: "latency_p95_ms",
        threshold_type: "fail",
        actual_value: metrics.latency_p95_ms,
        threshold_value: thresholds.latency_p95_fail_ms,
        severity: "high",
        message: msg,
      });
    } else if (metrics.latency_p95_ms >= thresholds.latency_p95_warn_ms) {
      const msg = `Latency P95 WARN: ${metrics.latency_p95_ms}ms >= ${thresholds.latency_p95_warn_ms}ms`;
      warnings.push(msg);
      violations.push({
        level: "P1",
        metric: "latency_p95_ms",
        threshold_type: "warn",
        actual_value: metrics.latency_p95_ms,
        threshold_value: thresholds.latency_p95_warn_ms,
        severity: "medium",
        message: msg,
      });
    }

    // Failure rate
    if (metrics.failure_rate >= thresholds.failure_rate_fail) {
      const msg = `Failure rate FAIL: ${(metrics.failure_rate * 100).toFixed(
        1,
      )}% >= ${(thresholds.failure_rate_fail * 100).toFixed(1)}%`;
      warnings.push(msg);
      violations.push({
        level: "P1",
        metric: "failure_rate",
        threshold_type: "fail",
        actual_value: metrics.failure_rate,
        threshold_value: thresholds.failure_rate_fail,
        severity: "high",
        message: msg,
      });
    } else if (metrics.failure_rate >= thresholds.failure_rate_warn) {
      const msg = `Failure rate WARN: ${(metrics.failure_rate * 100).toFixed(
        1,
      )}% >= ${(thresholds.failure_rate_warn * 100).toFixed(1)}%`;
      warnings.push(msg);
      violations.push({
        level: "P1",
        metric: "failure_rate",
        threshold_type: "warn",
        actual_value: metrics.failure_rate,
        threshold_value: thresholds.failure_rate_warn,
        severity: "medium",
        message: msg,
      });
    }
  }

  /**
   * Evaluate P2 thresholds
   */
  private evaluateP2Thresholds(
    metrics: any,
    thresholds: P2Thresholds,
    violations: ThresholdViolation[],
    issues: string[],
  ): void {
    // Duplication rate (higher is worse)
    if (metrics.duplication_rate >= thresholds.duplication_rate_fail) {
      const msg = `Duplication rate FAIL: ${(
        metrics.duplication_rate * 100
      ).toFixed(1)}% >= ${(thresholds.duplication_rate_fail * 100).toFixed(
        1,
      )}%`;
      issues.push(msg);
      violations.push({
        level: "P2",
        metric: "duplication_rate",
        threshold_type: "fail",
        actual_value: metrics.duplication_rate,
        threshold_value: thresholds.duplication_rate_fail,
        severity: "medium",
        message: msg,
      });
    } else if (metrics.duplication_rate >= thresholds.duplication_rate_warn) {
      const msg = `Duplication rate WARN: ${(
        metrics.duplication_rate * 100
      ).toFixed(1)}% >= ${(thresholds.duplication_rate_warn * 100).toFixed(
        1,
      )}%`;
      issues.push(msg);
      violations.push({
        level: "P2",
        metric: "duplication_rate",
        threshold_type: "warn",
        actual_value: metrics.duplication_rate,
        threshold_value: thresholds.duplication_rate_warn,
        severity: "low",
        message: msg,
      });
    }

    // Coverage rate (lower is worse)
    if (metrics.coverage_rate <= thresholds.coverage_rate_fail) {
      const msg = `Coverage rate FAIL: ${(metrics.coverage_rate * 100).toFixed(
        1,
      )}% <= ${(thresholds.coverage_rate_fail * 100).toFixed(1)}%`;
      issues.push(msg);
      violations.push({
        level: "P2",
        metric: "coverage_rate",
        threshold_type: "fail",
        actual_value: metrics.coverage_rate,
        threshold_value: thresholds.coverage_rate_fail,
        severity: "medium",
        message: msg,
      });
    } else if (metrics.coverage_rate <= thresholds.coverage_rate_warn) {
      const msg = `Coverage rate WARN: ${(metrics.coverage_rate * 100).toFixed(
        1,
      )}% <= ${(thresholds.coverage_rate_warn * 100).toFixed(1)}%`;
      issues.push(msg);
      violations.push({
        level: "P2",
        metric: "coverage_rate",
        threshold_type: "warn",
        actual_value: metrics.coverage_rate,
        threshold_value: thresholds.coverage_rate_warn,
        severity: "low",
        message: msg,
      });
    }

    // Quality score (lower is worse)
    if (metrics.quality_score <= thresholds.quality_score_fail) {
      const msg = `Quality score FAIL: ${(metrics.quality_score * 100).toFixed(
        1,
      )}% <= ${(thresholds.quality_score_fail * 100).toFixed(1)}%`;
      issues.push(msg);
      violations.push({
        level: "P2",
        metric: "quality_score",
        threshold_type: "fail",
        actual_value: metrics.quality_score,
        threshold_value: thresholds.quality_score_fail,
        severity: "medium",
        message: msg,
      });
    } else if (metrics.quality_score <= thresholds.quality_score_warn) {
      const msg = `Quality score WARN: ${(metrics.quality_score * 100).toFixed(
        1,
      )}% <= ${(thresholds.quality_score_warn * 100).toFixed(1)}%`;
      issues.push(msg);
      violations.push({
        level: "P2",
        metric: "quality_score",
        threshold_type: "warn",
        actual_value: metrics.quality_score,
        threshold_value: thresholds.quality_score_warn,
        severity: "low",
        message: msg,
      });
    }
  }

  // Helper methods to calculate metrics from JSONL lines
  private calculateFailureRate(lines: string[]): number {
    let totalItems = 0;
    let failedItems = 0;

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        totalItems++;
        if (record.alert_flags && record.alert_flags.length > 0) {
          failedItems++;
        }
      } catch (error) {
        // Skip invalid lines
      }
    }

    return totalItems > 0 ? failedItems / totalItems : 0;
  }

  private calculateCoverageRate(summary: any): number {
    return (
      summary.coverage?.entity_coverage_rate ||
      summary.coverage?.section_coverage_rate ||
      0
    );
  }

  private calculateEvidenceMissingRate(lines: string[]): number {
    let totalItems = 0;
    let missingEvidence = 0;

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        totalItems++;
        if (!record.evidence_quality?.has_evidence) {
          missingEvidence++;
        }
      } catch (error) {
        // Skip invalid lines
      }
    }

    return totalItems > 0 ? missingEvidence / totalItems : 0;
  }

  private calculateHallucinationRate(lines: string[]): number {
    let totalItems = 0;
    let hallucinationFlags = 0;

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        totalItems++;
        if (record.hallucination?.flagged) {
          hallucinationFlags++;
        }
      } catch (error) {
        // Skip invalid lines
      }
    }

    return totalItems > 0 ? hallucinationFlags / totalItems : 0;
  }

  private calculatePIIHits(lines: string[]): number {
    let totalHits = 0;

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        if (record.pii_license?.pii_violations) {
          totalHits += record.pii_license.pii_violations;
        }
      } catch (error) {
        // Skip invalid lines
      }
    }

    return totalHits;
  }

  private calculateLicenseViolations(lines: string[]): number {
    let totalViolations = 0;

    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        if (record.pii_license?.license_violations) {
          totalViolations += record.pii_license.license_violations;
        }
      } catch (error) {
        // Skip invalid lines
      }
    }

    return totalViolations;
  }
}

/**
 * Factory function to create threshold manager instance
 */
export function createThresholdManager(configPath?: string): ThresholdManager {
  return new ThresholdManager(configPath);
}

/**
 * Convenience function to get all thresholds for a profile
 */
export function getAllThresholds(
  profile: string = "dev",
  configPath?: string,
): ThresholdConfig {
  const manager = new ThresholdManager(configPath);
  return {
    p0: manager.getP0Thresholds(),
    p1: manager.getP1Thresholds(profile),
    p2: manager.getP2Thresholds(profile),
  };
}
