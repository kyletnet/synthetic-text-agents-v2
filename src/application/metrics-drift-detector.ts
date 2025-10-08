/**
 * Metrics Drift Detector
 *
 * Detects and records drift in quality metrics compared to baseline.
 * Works with QA Feedback Manager to trigger corrective actions.
 *
 * Phase 2B Step 3: Metrics Drift Detection
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import type { Logger } from "../shared/logger.js";
import type { MetricsReport } from "../domain/ports/metrics-port.js";

/**
 * Drift Detection Configuration
 */
export interface DriftDetectorConfig {
  driftThreshold?: number; // Default: 0.15 (15%)
  baselineTag?: string; // Default: "integration-base"
  driftReportPath?: string; // Default: reports/metrics-drift.json
  rollingWindowSize?: number; // Default: 3 (rolling average window)
  stableThreshold?: number; // Default: 0.05 (5% stable threshold)
}

/**
 * Drift Metric Entry
 */
export interface DriftMetricEntry {
  metric: string;
  current: number;
  baseline: number;
  drift: number;
  threshold: number;
  exceeded: boolean;
  direction: "improvement" | "degradation" | "stable";
  action: string;
}

/**
 * Drift Report
 */
export interface DriftReport {
  schemaVersion: string;
  timestamp: string;
  baseline_tag: string;
  drift_threshold: number;
  current_metrics: Record<string, number>;
  baseline_metrics: Record<string, number>;
  drift_detected: DriftMetricEntry[];
  auto_actions: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Metrics Drift Detector
 *
 * Monitors metrics drift and generates reports.
 */
export class MetricsDriftDetector {
  private readonly logger: Logger;
  private readonly config: Required<DriftDetectorConfig>;
  private readonly projectRoot: string;
  private driftHistory: Map<string, number[]> = new Map(); // Rolling window history

  constructor(
    logger: Logger,
    projectRoot?: string,
    config: DriftDetectorConfig = {},
  ) {
    this.logger = logger;
    this.projectRoot = projectRoot || process.cwd();

    this.config = {
      driftThreshold: config.driftThreshold ?? 0.15,
      baselineTag: config.baselineTag ?? "integration-base",
      driftReportPath:
        config.driftReportPath ?? join(this.projectRoot, "reports", "metrics-drift.json"),
      rollingWindowSize: config.rollingWindowSize ?? 3,
      stableThreshold: config.stableThreshold ?? 0.05,
    };
  }

  /**
   * Detect drift between current and baseline metrics
   */
  async detectDrift(
    current: MetricsReport,
    baseline: MetricsReport,
  ): Promise<DriftReport> {
    this.logger.info("🔍 Detecting metrics drift...");

    const driftDetected: DriftMetricEntry[] = [];
    const autoActions: string[] = [];

    // Prepare metric comparisons
    const currentMetrics = {
      entity_coverage: current.quality.entityCoverage,
      evidence_alignment: current.quality.evidenceAlignment,
      entity_coverage_ratio: current.diversity.entityCoverageRatio,
      question_type_balance: current.diversity.questionTypeBalance,
    };

    const baselineMetrics = {
      entity_coverage: baseline.quality.entityCoverage,
      evidence_alignment: baseline.quality.evidenceAlignment,
      entity_coverage_ratio: baseline.diversity.entityCoverageRatio,
      question_type_balance: baseline.diversity.questionTypeBalance,
    };

    // Detect drift for each metric (with rolling average noise filtering)
    for (const [metricName, currentValue] of Object.entries(currentMetrics)) {
      const baselineValue = baselineMetrics[metricName as keyof typeof baselineMetrics];
      const drift = currentValue - baselineValue;

      // Update drift history for rolling average
      this.updateDriftHistory(metricName, drift);

      // Calculate rolling average drift (noise filtering)
      const rollingAvgDrift = this.calculateRollingAverage(metricName);
      const driftAbs = Math.abs(rollingAvgDrift);

      // Determine if drift exceeds threshold
      const exceeded = driftAbs > this.config.driftThreshold;

      // Determine direction with stable threshold (5%)
      let direction: "improvement" | "degradation" | "stable" = "stable";
      if (driftAbs > this.config.stableThreshold) {
        direction = rollingAvgDrift > 0 ? "improvement" : "degradation";
      }

      let action = "none";
      if (exceeded && direction === "degradation") {
        action = "alert";
        autoActions.push(`Alert: ${metricName} degraded by ${(driftAbs * 100).toFixed(1)}%`);
      } else if (exceeded && direction === "improvement") {
        action = "log";
        this.logger.info(`Metric improved: ${metricName} +${(drift * 100).toFixed(1)}%`);
      }

      driftDetected.push({
        metric: metricName,
        current: currentValue,
        baseline: baselineValue,
        drift: rollingAvgDrift, // Use rolling average drift (noise filtered)
        threshold: this.config.driftThreshold,
        exceeded,
        direction,
        action,
      });
    }

    // Generate drift report
    const report: DriftReport = {
      schemaVersion: "1.0.0",
      timestamp: new Date().toISOString(),
      baseline_tag: this.config.baselineTag,
      drift_threshold: this.config.driftThreshold,
      current_metrics: currentMetrics,
      baseline_metrics: baselineMetrics,
      drift_detected: driftDetected,
      auto_actions: autoActions,
      metadata: {
        total_drifts: driftDetected.filter((d) => d.exceeded).length,
        max_drift: Math.max(...driftDetected.map((d) => Math.abs(d.drift)), 0),
      },
    };

    // Save report
    await this.saveDriftReport(report);

    this.logger.info("Drift detection complete", {
      total_drifts: report.metadata?.total_drifts,
      max_drift: report.metadata?.max_drift,
    });

    return report;
  }

  /**
   * Save drift report to file
   */
  private async saveDriftReport(report: DriftReport): Promise<void> {
    try {
      writeFileSync(
        this.config.driftReportPath,
        JSON.stringify(report, null, 2),
        "utf8",
      );

      this.logger.info(`Drift report saved: ${this.config.driftReportPath}`);
    } catch (error) {
      this.logger.error("Failed to save drift report", { error });
      throw error;
    }
  }

  /**
   * Load existing drift report
   */
  async loadDriftReport(): Promise<DriftReport | null> {
    if (!existsSync(this.config.driftReportPath)) {
      return null;
    }

    try {
      const content = readFileSync(this.config.driftReportPath, "utf8");
      return JSON.parse(content) as DriftReport;
    } catch (error) {
      this.logger.error("Failed to load drift report", { error });
      return null;
    }
  }

  /**
   * Update drift history for rolling average calculation
   */
  private updateDriftHistory(metricName: string, drift: number): void {
    const history = this.driftHistory.get(metricName) || [];

    // Add new drift value
    history.push(drift);

    // Keep only last N values (rolling window)
    if (history.length > this.config.rollingWindowSize) {
      history.shift(); // Remove oldest value
    }

    this.driftHistory.set(metricName, history);
  }

  /**
   * Calculate rolling average drift (noise filtering)
   */
  private calculateRollingAverage(metricName: string): number {
    const history = this.driftHistory.get(metricName) || [];

    if (history.length === 0) {
      return 0;
    }

    // Calculate average of last N drift values
    const sum = history.reduce((acc, val) => acc + val, 0);
    return sum / history.length;
  }

  /**
   * Clear drift history (for testing or reset)
   */
  clearDriftHistory(): void {
    this.driftHistory.clear();
    this.logger.info("Drift history cleared");
  }

  /**
   * Get drift summary
   */
  async getDriftSummary(report: DriftReport): Promise<{
    hasDrift: boolean;
    degradationCount: number;
    improvementCount: number;
    maxDrift: number;
  }> {
    const degradationCount = report.drift_detected.filter(
      (d) => d.exceeded && d.direction === "degradation",
    ).length;

    const improvementCount = report.drift_detected.filter(
      (d) => d.exceeded && d.direction === "improvement",
    ).length;

    const maxDrift = Math.max(
      ...report.drift_detected.map((d) => Math.abs(d.drift)),
      0,
    );

    return {
      hasDrift: degradationCount > 0 || improvementCount > 0,
      degradationCount,
      improvementCount,
      maxDrift,
    };
  }
}
