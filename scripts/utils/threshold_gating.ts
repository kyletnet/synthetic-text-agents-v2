/**
 * Threshold Gating System
 * Maps P0/P1/P2 metrics to PASS/WARN/FAIL results according to AC-1
 *
 * Logic:
 * - P0 violations → FAIL (critical safety gates)
 * - P1 multiple violations → WARN (performance concerns)
 * - P2 minor violations → PASS (quality notices)
 */

import * as fs from "fs";
import * as path from "path";

export interface ThresholdConfig {
  p0: Record<string, number>;
  p1: Record<string, number>;
  p2: Record<string, number>;
}

export interface MetricResult {
  metric_name: string;
  value: number;
  priority: "P0" | "P1" | "P2";
  threshold_value: number;
  status: "PASS" | "WARN" | "FAIL";
  violation_type?: "max_exceeded" | "min_not_met";
}

export interface GatingResult {
  overall_result: "PASS" | "WARN" | "FAIL";
  total_violations: number;
  p0_violations: number;
  p1_violations: number;
  p2_violations: number;
  metric_results: MetricResult[];
  summary: string;
  recommendation: string;
}

export class ThresholdGating {
  private thresholds!: ThresholdConfig;
  private profile: string;

  constructor(
    configPath: string = "baseline_config.json",
    profile: string = "dev",
  ) {
    this.profile = profile;
    this.loadConfiguration(configPath);
  }

  private loadConfiguration(configPath: string): void {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

      // Load base thresholds
      const baseThresholds = config.dxloop?.thresholds || {};

      // Apply profile-specific overrides
      const overrides = config.dxloop?.profile_overrides?.[this.profile] || {};

      this.thresholds = {
        p0: { ...baseThresholds.p0 },
        p1: { ...baseThresholds.p1, ...overrides.p1 },
        p2: { ...baseThresholds.p2, ...overrides.p2 },
      };

      console.log(`[GATING] Loaded thresholds for profile: ${this.profile}`);
    } catch (error) {
      throw new Error(`Failed to load threshold configuration: ${error}`);
    }
  }

  /**
   * Evaluate metrics against thresholds and determine gating result
   */
  public evaluateMetrics(metrics: Record<string, number>): GatingResult {
    const results: MetricResult[] = [];

    // Evaluate P0 metrics (critical safety gates)
    for (const [metricName, threshold] of Object.entries(this.thresholds.p0)) {
      const value = metrics[metricName];
      if (value !== undefined) {
        const result = this.evaluateMetric(metricName, value, threshold, "P0");
        results.push(result);
      }
    }

    // Evaluate P1 metrics (performance)
    for (const [metricName, threshold] of Object.entries(this.thresholds.p1)) {
      const value = metrics[metricName];
      if (value !== undefined) {
        const priority = metricName.includes("_warn") ? "P1" : "P1";
        const result = this.evaluateMetric(
          metricName,
          value,
          threshold,
          priority,
        );
        results.push(result);
      }
    }

    // Evaluate P2 metrics (quality)
    for (const [metricName, threshold] of Object.entries(this.thresholds.p2)) {
      const value = metrics[metricName];
      if (value !== undefined) {
        const priority = metricName.includes("_warn") ? "P2" : "P2";
        const result = this.evaluateMetric(
          metricName,
          value,
          threshold,
          priority,
        );
        results.push(result);
      }
    }

    return this.determineOverallResult(results);
  }

  private evaluateMetric(
    metricName: string,
    value: number,
    threshold: number,
    priority: "P0" | "P1" | "P2",
  ): MetricResult {
    let status: "PASS" | "WARN" | "FAIL" = "PASS";
    let violationType: "max_exceeded" | "min_not_met" | undefined;

    // Determine if this is a max or min threshold
    const isMaxThreshold =
      metricName.includes("_max") ||
      metricName.includes("_fail") ||
      metricName.includes("_warn");
    const isMinThreshold = metricName.includes("_min");

    if (isMaxThreshold) {
      if (value > threshold) {
        status =
          priority === "P0"
            ? "FAIL"
            : metricName.includes("_warn")
              ? "WARN"
              : "FAIL";
        violationType = "max_exceeded";
      }
    } else if (isMinThreshold) {
      if (value < threshold) {
        status =
          priority === "P0"
            ? "FAIL"
            : metricName.includes("_warn")
              ? "WARN"
              : "FAIL";
        violationType = "min_not_met";
      }
    } else {
      // Default to max threshold behavior
      if (value > threshold) {
        status = priority === "P0" ? "FAIL" : "WARN";
        violationType = "max_exceeded";
      }
    }

    return {
      metric_name: metricName,
      value,
      priority,
      threshold_value: threshold,
      status,
      violation_type: violationType,
    };
  }

  private determineOverallResult(results: MetricResult[]): GatingResult {
    const p0Violations = results.filter(
      (r) => r.priority === "P0" && r.status === "FAIL",
    );
    const p1Violations = results.filter(
      (r) =>
        r.priority === "P1" && (r.status === "FAIL" || r.status === "WARN"),
    );
    const p2Violations = results.filter(
      (r) =>
        r.priority === "P2" && (r.status === "FAIL" || r.status === "WARN"),
    );

    let overallResult: "PASS" | "WARN" | "FAIL";
    let summary: string;
    let recommendation: string;

    // AC-1 Logic: P0 violations → FAIL, P1 multiple → WARN, P2 minor → PASS
    if (p0Violations.length > 0) {
      overallResult = "FAIL";
      summary = `Critical P0 violation detected: ${p0Violations.map((v) => v.metric_name).join(", ")}`;
      recommendation =
        "IMMEDIATE ACTION REQUIRED: Fix P0 violations before production deployment";
    } else if (p1Violations.length >= 2) {
      overallResult = "WARN";
      summary = `Multiple P1 performance issues: ${p1Violations.length} violations`;
      recommendation =
        "Performance optimization recommended before full production load";
    } else if (p1Violations.length === 1 && p1Violations[0].status === "FAIL") {
      overallResult = "WARN";
      summary = `Single critical P1 violation: ${p1Violations[0].metric_name}`;
      recommendation = "Monitor performance closely, consider optimization";
    } else if (p2Violations.length > 0) {
      overallResult = "PASS";
      summary = `Minor P2 quality issues: ${p2Violations.length} violations`;
      recommendation = "Quality improvements suggested for optimal performance";
    } else {
      overallResult = "PASS";
      summary = "All metrics within acceptable thresholds";
      recommendation = "System performing within expected parameters";
    }

    return {
      overall_result: overallResult,
      total_violations:
        p0Violations.length + p1Violations.length + p2Violations.length,
      p0_violations: p0Violations.length,
      p1_violations: p1Violations.length,
      p2_violations: p2Violations.length,
      metric_results: results,
      summary,
      recommendation,
    };
  }

  /**
   * Update session report with gating result
   */
  public updateSessionReport(
    sessionReportPath: string,
    gatingResult: GatingResult,
    runId: string = "unknown",
  ): void {
    try {
      let reportContent = "";

      if (fs.existsSync(sessionReportPath)) {
        reportContent = fs.readFileSync(sessionReportPath, "utf8");

        // Update RESULT field in summary block
        reportContent = reportContent.replace(
          /RESULT: [A-Z]+/g,
          `RESULT: ${gatingResult.overall_result}`,
        );

        // Add P0_VIOLATIONS, P1_VIOLATIONS, P2_VIOLATIONS fields
        const summaryEndPattern = /```(\r?\n)/;
        const summaryMatch = reportContent.match(summaryEndPattern);

        if (summaryMatch) {
          const insertPoint = reportContent.indexOf(summaryMatch[0]);
          const beforeSummaryEnd = reportContent.substring(0, insertPoint);
          const afterSummaryEnd = reportContent.substring(insertPoint);

          const gatingFields = `P0_VIOLATIONS: ${gatingResult.p0_violations}
P1_VIOLATIONS: ${gatingResult.p1_violations}
P2_VIOLATIONS: ${gatingResult.p2_violations}
TOTAL_VIOLATIONS: ${gatingResult.total_violations}
GATING_SUMMARY: ${gatingResult.summary}
`;

          reportContent = beforeSummaryEnd + gatingFields + afterSummaryEnd;
        }
      }

      // Add detailed gating section
      const gatingSection = `
## Threshold Gating Results

**Overall Result**: ${this.getStatusBadge(gatingResult.overall_result)} ${gatingResult.overall_result}

**Summary**: ${gatingResult.summary}

**Recommendation**: ${gatingResult.recommendation}

### Metric Violations by Priority

${
  gatingResult.p0_violations > 0
    ? `
**P0 Violations (Critical)**: ${gatingResult.p0_violations}
${gatingResult.metric_results
  .filter((r) => r.priority === "P0" && r.status === "FAIL")
  .map((r) => `- ❌ ${r.metric_name}: ${r.value} > ${r.threshold_value}`)
  .join("\n")}
`
    : ""
}

${
  gatingResult.p1_violations > 0
    ? `
**P1 Violations (Performance)**: ${gatingResult.p1_violations}
${gatingResult.metric_results
  .filter(
    (r) => r.priority === "P1" && (r.status === "FAIL" || r.status === "WARN"),
  )
  .map(
    (r) =>
      `- ${r.status === "FAIL" ? "❌" : "⚠️"} ${r.metric_name}: ${r.value} vs ${r.threshold_value}`,
  )
  .join("\n")}
`
    : ""
}

${
  gatingResult.p2_violations > 0
    ? `
**P2 Violations (Quality)**: ${gatingResult.p2_violations}
${gatingResult.metric_results
  .filter(
    (r) => r.priority === "P2" && (r.status === "FAIL" || r.status === "WARN"),
  )
  .map(
    (r) =>
      `- ${r.status === "FAIL" ? "❌" : "⚠️"} ${r.metric_name}: ${r.value} vs ${r.threshold_value}`,
  )
  .join("\n")}
`
    : ""
}

### All Metric Results
${gatingResult.metric_results
  .map(
    (r) =>
      `- ${this.getStatusBadge(r.status)} **${r.metric_name}** (${r.priority}): ${r.value} vs ${r.threshold_value}`,
  )
  .join("\n")}

**Gating Profile**: ${this.profile}
**Evaluation Timestamp**: ${new Date().toISOString()}
`;

      reportContent += gatingSection;

      fs.writeFileSync(sessionReportPath, reportContent);

      console.log(`[GATING] Updated session report: ${sessionReportPath}`);
      console.log(
        `[GATING] Overall result: ${gatingResult.overall_result} (${gatingResult.total_violations} violations)`,
      );
    } catch (error) {
      console.error(`[GATING] Failed to update session report: ${error}`);
    }
  }

  private getStatusBadge(status: string): string {
    const badges = {
      PASS: "✅",
      WARN: "⚠️",
      FAIL: "❌",
    };
    return badges[status as keyof typeof badges] || "ℹ️";
  }

  /**
   * Export gating result to JSONL for machine processing
   */
  public exportGatingResult(
    gatingResult: GatingResult,
    outputPath: string,
    runId: string,
    metadata: Record<string, any> = {},
  ): void {
    const exportData = {
      timestamp: new Date().toISOString(),
      run_id: runId,
      profile: this.profile,
      gating_result: gatingResult.overall_result,
      total_violations: gatingResult.total_violations,
      p0_violations: gatingResult.p0_violations,
      p1_violations: gatingResult.p1_violations,
      p2_violations: gatingResult.p2_violations,
      summary: gatingResult.summary,
      recommendation: gatingResult.recommendation,
      metric_details: gatingResult.metric_results,
      ...metadata,
    };

    try {
      // Ensure directory exists
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      // Append to JSONL file
      fs.appendFileSync(outputPath, JSON.stringify(exportData) + "\n");

      console.log(`[GATING] Exported result to: ${outputPath}`);
    } catch (error) {
      console.error(`[GATING] Failed to export gating result: ${error}`);
    }
  }
}

// CLI interface for standalone usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "evaluate") {
    const configPath = args[1] || "baseline_config.json";
    const metricsPath = args[2];
    const profile = args[3] || process.env.PROFILE || "dev";

    if (!metricsPath) {
      console.error(
        "Usage: ts-node threshold_gating.ts evaluate <config_path> <metrics_jsonl> [profile]",
      );
      process.exit(1);
    }

    try {
      const gating = new ThresholdGating(configPath, profile);

      // Read metrics from JSONL file
      const metricsContent = fs.readFileSync(metricsPath, "utf8");
      const metricsLines = metricsContent
        .trim()
        .split("\n")
        .filter((line) => line);

      for (const line of metricsLines) {
        const metricsData = JSON.parse(line);
        const result = gating.evaluateMetrics(metricsData);

        console.log(
          JSON.stringify({
            run_id: metricsData.run_id || "unknown",
            gating_result: result.overall_result,
            violations: result.total_violations,
            summary: result.summary,
          }),
        );
      }
    } catch (error) {
      console.error(`Evaluation failed: ${error}`);
      process.exit(1);
    }
  } else {
    console.log("Available commands:");
    console.log(
      "  evaluate <config_path> <metrics_jsonl> [profile] - Evaluate metrics against thresholds",
    );
  }
}
