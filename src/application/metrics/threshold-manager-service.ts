/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Application: Threshold Manager Service
 * Orchestrates threshold management, configuration, and calibration
 */

import { join } from "path";
import {
  loadConfigFile,
  saveConfigFile,
  loadHistoricalMetricsFiles,
} from "../../infrastructure/filesystem/report-writer.js";
import {
  P0Thresholds,
  P1Thresholds,
  P2Thresholds,
  GatingResult,
  CalibrationResult,
  BaselineMetrics,
  evaluateP0Thresholds,
  evaluateP1Thresholds,
  evaluateP2Thresholds,
  determineGatingStatus,
  createCalibrationResult,
} from "../../domain/metrics/threshold-rules.js";
import { calculatePercentile } from "../../domain/metrics/baseline-calculator.js";
import { domainEventBus } from "../../domain/events/domain-event-bus.js";

// ============================================================================
// Configuration Interfaces
// ============================================================================

export interface ProfileConfig {
  name: string;
  budget_max_usd: number;
  timeout_max_ms: number;
  per_agent_limits: {
    answer_max_usd: number;
    audit_max_ms: number;
  };
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

// ============================================================================
// Threshold Manager Service
// ============================================================================

export class ThresholdManagerService {
  private configPath: string;
  private baselineConfig: any;

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), "baseline_config.json");
    this.loadConfig();
  }

  private loadConfig(): void {
    this.baselineConfig = loadConfigFile(this.configPath);
  }

  // ==========================================================================
  // Threshold Getters
  // ==========================================================================

  getP0Thresholds(): P0Thresholds {
    const dxloop = this.baselineConfig.dxloop || {};
    const p0 = dxloop.thresholds?.p0 || {};

    return {
      pii_hits_max: p0.pii_hits_max ?? 0,
      license_violations_max: p0.license_violations_max ?? 2,
      evidence_missing_rate_max: p0.evidence_missing_rate_max ?? 0.2,
      hallucination_rate_max: p0.hallucination_rate_max ?? 0.05,
    };
  }

  getP1Thresholds(profile: string = "dev"): P1Thresholds {
    const dxloop = this.baselineConfig.dxloop || {};
    const p1 = dxloop.thresholds?.p1 || {};
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

  getP2Thresholds(profile: string = "dev"): P2Thresholds {
    const dxloop = this.baselineConfig.dxloop || {};
    const p2 = dxloop.thresholds?.p2 || {};
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

  getProfileConfig(profile: string): ProfileConfig {
    const dxloop = this.baselineConfig.dxloop || {};
    const profiles = dxloop.profiles || {};
    const profileConfig = profiles[profile];

    if (!profileConfig) {
      throw new Error(`Profile '${profile}' not found in configuration`);
    }

    return profileConfig;
  }

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

  // ==========================================================================
  // Gating Evaluation
  // ==========================================================================

  evaluateGating(
    metrics: BaselineMetrics,
    profile: string = "dev",
  ): GatingResult {
    const p0Thresholds = this.getP0Thresholds();
    const p1Thresholds = this.getP1Thresholds(profile);
    const p2Thresholds = this.getP2Thresholds(profile);

    // Evaluate each priority level
    const p0Result = evaluateP0Thresholds(metrics, p0Thresholds);
    const p1Result = evaluateP1Thresholds(metrics, p1Thresholds);
    const p2Result = evaluateP2Thresholds(metrics, p2Thresholds);

    // Combine all violations
    const allViolations = [
      ...p0Result.violations,
      ...p1Result.violations,
      ...p2Result.violations,
    ];

    // Determine gating status
    return determineGatingStatus(
      p0Result.messages,
      p1Result.warnings,
      p2Result.issues,
      allViolations,
    );
  }

  // ==========================================================================
  // Historical Metrics Loading
  // ==========================================================================

  async loadHistoricalMetrics(): Promise<HistoricalMetrics[]> {
    const reportsDir = join(process.cwd(), "reports");
    const historyDir = join(reportsDir, "history");
    const autocalibConfig = this.getAutoCalibrationConfig();

    const files = loadHistoricalMetricsFiles(
      historyDir,
      autocalibConfig.lookback_runs,
    );

    const metrics: HistoricalMetrics[] = [];

    for (const file of files) {
      try {
        const summary = file.summary;

        const historicalMetric: HistoricalMetrics = {
          timestamp: summary.timestamp || new Date().toISOString(),
          session_id: summary.session_id || "unknown",
          cost_per_item: summary.cost_per_item || 0,
          latency_p95_ms: summary.latency_p95_ms || 0,
          failure_rate: this.calculateFailureRate(file.lines),
          duplication_rate: summary.duplication?.rate || 0,
          coverage_rate: this.calculateCoverageRate(summary),
          quality_score: summary.overall_quality_score || 0,
          evidence_missing_rate: this.calculateEvidenceMissingRate(file.lines),
          hallucination_rate: this.calculateHallucinationRate(file.lines),
          pii_hits: this.calculatePIIHits(file.lines),
          license_violations: this.calculateLicenseViolations(file.lines),
        };

        metrics.push(historicalMetric);
      } catch (error) {
        console.warn(`Failed to parse historical metrics: ${error}`);
      }
    }

    return metrics;
  }

  // ==========================================================================
  // Auto-Calibration
  // ==========================================================================

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

    // Emit domain event for governance tracking
    await domainEventBus.publish({
      type: "metric.threshold.calibration.started",
      actor: "ThresholdManagerService",
      data: {
        profile,
        historicalRunsCount: historicalMetrics.length,
        autocalibConfig,
      },
    });

    const results: CalibrationResult[] = [];
    const currentP1 = this.getP1Thresholds(profile);
    const currentP2 = this.getP2Thresholds(profile);

    // P1 Metrics
    results.push(
      ...this.calibrateP1Metrics(historicalMetrics, currentP1, autocalibConfig),
    );

    // P2 Metrics
    results.push(
      ...this.calibrateP2Metrics(historicalMetrics, currentP2, autocalibConfig),
    );

    return results;
  }

  private calibrateP1Metrics(
    metrics: HistoricalMetrics[],
    current: P1Thresholds,
    config: AutoCalibrationConfig,
  ): CalibrationResult[] {
    const results: CalibrationResult[] = [];

    // Cost per item
    const costValues = metrics.map((m) => m.cost_per_item);
    results.push(
      createCalibrationResult(
        "cost_per_item_warn",
        calculatePercentile(costValues, config.percentile_warn),
        current.cost_per_item_warn,
        config.drift_guard_max_delta,
        config.percentile_warn,
      ),
    );
    results.push(
      createCalibrationResult(
        "cost_per_item_fail",
        calculatePercentile(costValues, config.percentile_fail),
        current.cost_per_item_fail,
        config.drift_guard_max_delta,
        config.percentile_fail,
      ),
    );

    // Latency P95
    const latencyValues = metrics.map((m) => m.latency_p95_ms);
    results.push(
      createCalibrationResult(
        "latency_p95_warn_ms",
        calculatePercentile(latencyValues, config.percentile_warn),
        current.latency_p95_warn_ms,
        config.drift_guard_max_delta,
        config.percentile_warn,
      ),
    );
    results.push(
      createCalibrationResult(
        "latency_p95_fail_ms",
        calculatePercentile(latencyValues, config.percentile_fail),
        current.latency_p95_fail_ms,
        config.drift_guard_max_delta,
        config.percentile_fail,
      ),
    );

    // Failure rate
    const failureValues = metrics.map((m) => m.failure_rate);
    results.push(
      createCalibrationResult(
        "failure_rate_warn",
        calculatePercentile(failureValues, config.percentile_warn),
        current.failure_rate_warn,
        config.drift_guard_max_delta,
        config.percentile_warn,
      ),
    );
    results.push(
      createCalibrationResult(
        "failure_rate_fail",
        calculatePercentile(failureValues, config.percentile_fail),
        current.failure_rate_fail,
        config.drift_guard_max_delta,
        config.percentile_fail,
      ),
    );

    return results;
  }

  private calibrateP2Metrics(
    metrics: HistoricalMetrics[],
    current: P2Thresholds,
    config: AutoCalibrationConfig,
  ): CalibrationResult[] {
    const results: CalibrationResult[] = [];

    // Duplication rate
    const dupValues = metrics.map((m) => m.duplication_rate);
    results.push(
      createCalibrationResult(
        "duplication_rate_warn",
        calculatePercentile(dupValues, config.percentile_warn),
        current.duplication_rate_warn,
        config.drift_guard_max_delta,
        config.percentile_warn,
      ),
    );
    results.push(
      createCalibrationResult(
        "duplication_rate_fail",
        calculatePercentile(dupValues, config.percentile_fail),
        current.duplication_rate_fail,
        config.drift_guard_max_delta,
        config.percentile_fail,
      ),
    );

    // Coverage rate (inverse percentiles for "lower is worse")
    const coverageValues = metrics.map((m) => m.coverage_rate);
    results.push(
      createCalibrationResult(
        "coverage_rate_warn",
        calculatePercentile(coverageValues, 100 - config.percentile_warn),
        current.coverage_rate_warn,
        config.drift_guard_max_delta,
        100 - config.percentile_warn,
      ),
    );
    results.push(
      createCalibrationResult(
        "coverage_rate_fail",
        calculatePercentile(coverageValues, 100 - config.percentile_fail),
        current.coverage_rate_fail,
        config.drift_guard_max_delta,
        100 - config.percentile_fail,
      ),
    );

    // Quality score (inverse percentiles for "lower is worse")
    const qualityValues = metrics.map((m) => m.quality_score);
    results.push(
      createCalibrationResult(
        "quality_score_warn",
        calculatePercentile(qualityValues, 100 - config.percentile_warn),
        current.quality_score_warn,
        config.drift_guard_max_delta,
        100 - config.percentile_warn,
      ),
    );
    results.push(
      createCalibrationResult(
        "quality_score_fail",
        calculatePercentile(qualityValues, 100 - config.percentile_fail),
        current.quality_score_fail,
        config.drift_guard_max_delta,
        100 - config.percentile_fail,
      ),
    );

    return results;
  }

  applyCalibrationResults(
    results: CalibrationResult[],
    _profile: string = "dev",
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
      this.baselineConfig.last_updated = new Date().toISOString();
      saveConfigFile(this.configPath, this.baselineConfig);
      console.log(
        `Applied ${
          results.filter((r) => r.applied).length
        } threshold calibrations to ${this.configPath}`,
      );
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private parseMetricName(fullName: string): [string, string] {
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
      } catch {
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
      } catch {
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
      } catch {
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
      } catch {
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
      } catch {
        // Skip invalid lines
      }
    }

    return totalViolations;
  }

  /**
   * Get calibration status for a profile
   */
  async getCalibrationStatus(
    _profile: string,
  ): Promise<{ status: string; lastCalibration?: string; nextDue?: string }> {
    // Return basic calibration status
    return {
      status: "ready",
      lastCalibration: new Date().toISOString(),
      nextDue: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createThresholdManagerService(
  configPath?: string,
): ThresholdManagerService {
  return new ThresholdManagerService(configPath);
}
