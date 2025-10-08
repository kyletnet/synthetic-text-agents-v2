/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * DEPRECATED: Legacy wrapper for backward compatibility
 * Please use src/infrastructure/filesystem/report-writer.ts instead
 */

import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { promises as fs } from "node:fs";
import path, { join } from "path";
import { createHash } from "crypto";
import {
  prewriteSessionMeta as newPrewriteSessionMeta,
  type SessionMeta,
} from "../../infrastructure/filesystem/report-writer.js";

const SESSION_REPORT = path.join(process.cwd(), "reports", "session_report.md");

export async function prewriteSessionMeta(meta: {
  profile: string;
  mode: string;
  dryRun: string;
  casesTotal: number;
}): Promise<void> {
  const sessionMeta: SessionMeta = {
    profile: meta.profile,
    mode: meta.mode,
    dryRun: meta.dryRun,
    casesTotal: meta.casesTotal,
  };
  return newPrewriteSessionMeta(sessionMeta, SESSION_REPORT);
}
import { calculateAllBaselineMetrics } from "./__all__.js";
import {
  createThresholdManager,
  ThresholdManager,
  GatingResult,
  CalibrationResult,
} from "./thresholdManager.js";
import Ajv from "ajv";
import addFormats from "ajv-formats";

interface BaselineMetricsRecord {
  timestamp: string;
  session_id: string;
  item_index: number;
  total_items: number;
  qa: { q: string; a: string };
  evidence?: string;
  duplication: any;
  qtype: any;
  coverage: any;
  evidence_quality: any;
  hallucination: any;
  pii_license: any;
  cost_usd: number;
  latency_ms: number;
  quality_score: number;
  alert_flags: string[];
}

interface BaselineMetricsSummary {
  timestamp: string;
  session_id: string;
  total_items: number;
  config_version: string;
  duplication: any;
  qtype_distribution: any;
  coverage: any;
  evidence_quality: any;
  hallucination: any;
  pii_license: any;
  cost_total_usd: number;
  cost_per_item: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  budget_utilization: number;
  overall_quality_score: number;
  reproducibility_check: any;
  total_alerts: number;
  recommendation_level: string;
}

interface QAItem {
  qa: { q: string; a: string };
  evidence?: string;
  evidence_text?: string;
  source_text?: string;
  index?: number;
  cost_usd?: number;
  latency_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
}

interface ReportOptions {
  outputDir?: string;
  sessionId?: string;
  budgetLimit?: number;
  sourceTexts?: string[];
  includeFullData?: boolean;
  profile?: string; // Profile for threshold evaluation (dev/stage/prod)
  enableAutocalibration?: boolean; // Enable threshold auto-calibration
  applyCalibration?: boolean; // Apply calibration changes immediately
  enableSchemaValidation?: boolean; // Enable JSON schema validation
  enableExport?: boolean; // Enable CSV/JSON export for BI
  trendHistoryLimit?: number; // Number of historical runs for trends (default: 10)
}

interface BaselineExportRecord {
  RUN_ID: string;
  ITEM_ID: string;
  RESULT: "PASS" | "WARN" | "PARTIAL" | "FAIL";
  COST_USD: number;
  LAT_MS: number;
  WARNINGS: number;
  P0_VIOLATIONS: number;
  P1_VIOLATIONS: number;
  P2_VIOLATIONS: number;
  ACCURACY_SCORE: number;
  EVIDENCE_PRESENCE: number;
  DUPLICATION_RATE: number;
  HALLUCINATION_RISK: "low" | "medium" | "high" | "none";
  PII_HITS: number;
  LICENSE_HITS: number;
  PROFILE: string;
  TIMESTAMP: string;
  Q_TYPE?: string;
  COVERAGE_SCORE?: number;
  TOKENS_IN?: number;
  TOKENS_OUT?: number;
  SESSION_ID?: string;
  BATCH_INDEX?: number;
}

interface HistoricalTrend {
  values: number[];
  timestamps: string[];
  min: number;
  max: number;
  median: number;
  sparkline: string;
}

interface DLQSummary {
  count: number;
  recentItems: string[];
  reprocessCommand: string;
}

/**
 * Calculate file hash for integrity checking
 */
function calculateFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Generate ASCII sparkline from values
 */
function generateSparkline(values: number[]): string {
  if (values.length === 0) return "";

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  if (range === 0) return "▄".repeat(values.length);

  const chars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

  return values
    .map((val) => {
      const normalized = (val - min) / range;
      const index = Math.floor(normalized * (chars.length - 1));
      return chars[Math.max(0, Math.min(index, chars.length - 1))];
    })
    .join("");
}

/**
 * Load historical trend data from reports/history
 */
function loadHistoricalTrends(
  outputDir: string,
  limit: number = 10,
): { [key: string]: HistoricalTrend } {
  const trends: { [key: string]: HistoricalTrend } = {};
  const historyDir = join(outputDir, "history");

  if (!existsSync(historyDir)) {
    return trends;
  }

  try {
    const dirs = readdirSync(historyDir)
      .filter((d) => d.match(/^\d{8}_\d{6}$/))
      .sort()
      .slice(-limit);

    const accuracyValues: number[] = [];
    const costValues: number[] = [];
    const latencyValues: number[] = [];
    const timestamps: string[] = [];

    for (const dir of dirs) {
      const sessionReportPath = join(historyDir, dir, "session_report.md");
      if (existsSync(sessionReportPath)) {
        const content = readFileSync(sessionReportPath, "utf-8");

        // Extract metrics from session report
        const meanScoreMatch = content.match(/MEAN_SCORE: ([\d.]+)/);
        const costMatch = content.match(/COST_USD: ([\d.]+)/);
        const p95Match = content.match(/P95_MS: ([\d.]+)/);
        const timestampMatch = content.match(/TIMESTAMP: ([^\n]+)/);

        if (meanScoreMatch && costMatch && p95Match && timestampMatch) {
          accuracyValues.push(parseFloat(meanScoreMatch[1]));
          costValues.push(parseFloat(costMatch[1]));
          latencyValues.push(parseFloat(p95Match[1]));
          timestamps.push(timestampMatch[1]);
        }
      }
    }

    if (accuracyValues.length > 0) {
      trends.accuracy = {
        values: accuracyValues,
        timestamps,
        min: Math.min(...accuracyValues),
        max: Math.max(...accuracyValues),
        median: accuracyValues.sort()[Math.floor(accuracyValues.length / 2)],
        sparkline: generateSparkline(accuracyValues),
      };
    }

    if (costValues.length > 0) {
      trends.cost_per_item = {
        values: costValues,
        timestamps,
        min: Math.min(...costValues),
        max: Math.max(...costValues),
        median: costValues.sort()[Math.floor(costValues.length / 2)],
        sparkline: generateSparkline(costValues),
      };
    }

    if (latencyValues.length > 0) {
      trends.latency_p95 = {
        values: latencyValues,
        timestamps,
        min: Math.min(...latencyValues),
        max: Math.max(...latencyValues),
        median: latencyValues.sort()[Math.floor(latencyValues.length / 2)],
        sparkline: generateSparkline(latencyValues),
      };
    }
  } catch (error) {
    console.warn(`Warning: Failed to load historical trends: ${error}`);
  }

  return trends;
}

/**
 * Load DLQ summary information
 */
function loadDLQSummary(outputDir: string): DLQSummary {
  const dlqDir = join(outputDir, "dlq");
  const dlqIndexPath = join(dlqDir, "index.jsonl");

  const summary: DLQSummary = {
    count: 0,
    recentItems: [],
    reprocessCommand: "npm run dev -- --reprocess-dlq",
  };

  if (!existsSync(dlqIndexPath)) {
    return summary;
  }

  try {
    const content = readFileSync(dlqIndexPath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    summary.count = lines.length;
    summary.recentItems = lines.slice(-5).map((line) => {
      try {
        const entry = JSON.parse(line);
        return entry.run_id || "unknown";
      } catch {
        return "unknown";
      }
    });
  } catch (error) {
    console.warn(`Warning: Failed to load DLQ summary: ${error}`);
  }

  return summary;
}

/**
 * Convert records to export format
 */
function convertToExportFormat(
  records: BaselineMetricsRecord[],
  summary: BaselineMetricsSummary,
  _gating?: GatingResult,
): BaselineExportRecord[] {
  return records.map((record, _index) => {
    // Determine result status
    let result: "PASS" | "WARN" | "PARTIAL" | "FAIL" = "PASS";
    if (record.alert_flags.length > 0) {
      result = record.alert_flags.includes("pii_license") ? "FAIL" : "WARN";
    }

    // Count violations by priority
    const p0Violations = record.alert_flags.filter(
      (flag) => flag === "pii_license",
    ).length;

    const p1Violations = record.alert_flags.filter((flag) =>
      ["hallucination"].includes(flag),
    ).length;

    const p2Violations = record.alert_flags.filter((flag) =>
      ["duplication", "missing_evidence", "low_quality"].includes(flag),
    ).length;

    return {
      RUN_ID: summary.session_id,
      ITEM_ID: `${summary.session_id}_${record.item_index}`,
      RESULT: result,
      COST_USD: record.cost_usd,
      LAT_MS: record.latency_ms,
      WARNINGS: record.alert_flags.length,
      P0_VIOLATIONS: p0Violations,
      P1_VIOLATIONS: p1Violations,
      P2_VIOLATIONS: p2Violations,
      ACCURACY_SCORE: record.quality_score,
      EVIDENCE_PRESENCE: record.evidence_quality.has_evidence ? 1 : 0,
      DUPLICATION_RATE: record.duplication.max_similarity,
      HALLUCINATION_RISK: record.hallucination.risk_level || "none",
      PII_HITS: record.pii_license.pii_violations,
      LICENSE_HITS: record.pii_license.license_violations,
      PROFILE: "dev", // Will be overridden with actual profile
      TIMESTAMP: record.timestamp,
      Q_TYPE: record.qtype.classified_type,
      COVERAGE_SCORE: record.coverage.entity_coverage_score,
      TOKENS_IN: (record as any).tokens_in,
      TOKENS_OUT: (record as any).tokens_out,
      SESSION_ID: summary.session_id,
      BATCH_INDEX: record.item_index,
    };
  });
}

/**
 * Validate export data against schema
 */
function validateExportData(
  records: BaselineExportRecord[],
  schemaPath: string,
): { valid: boolean; errors?: string[] } {
  try {
    const schemaContent = readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(schemaContent);

    const ajv = new Ajv();
    addFormats(ajv);

    const validate = ajv.compile(schema);

    for (let i = 0; i < Math.min(records.length, 5); i++) {
      const valid = validate(records[i]);
      if (!valid) {
        return {
          valid: false,
          errors: validate.errors?.map(
            (err) => `Record ${i}: ${err.instancePath}: ${err.message}`,
          ) || ["Unknown validation error"],
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [`Export schema validation failed: ${error}`],
    };
  }
}

/**
 * Write export files (CSV and JSON)
 */
function writeExportFiles(
  records: BaselineExportRecord[],
  outputDir: string,
  profile: string,
): { csvPath: string; jsonPath: string } {
  const exportDir = join(outputDir, "export");
  if (!existsSync(exportDir)) {
    mkdirSync(exportDir, { recursive: true });
  }

  // Update profile in records
  records.forEach((record) => {
    record.PROFILE = profile;
  });

  const csvPath = join(exportDir, "baseline_latest.csv");
  const jsonPath = join(exportDir, "baseline_latest.json");

  // Write CSV
  if (records.length > 0) {
    const headers = Object.keys(records[0]).join(",");
    const rows = records.map((record) =>
      Object.values(record)
        .map((val) =>
          typeof val === "string" && val.includes(",") ? `"${val}"` : val,
        )
        .join(","),
    );
    const csvContent = [headers, ...rows].join("\n");
    writeFileSync(csvPath, csvContent, "utf-8");
  }

  // Write JSON
  writeFileSync(jsonPath, JSON.stringify(records, null, 2), "utf-8");

  return { csvPath, jsonPath };
}

/**
 * Validate record against JSON schema
 */
function validateSchema(
  record: BaselineMetricsRecord,
  schemaPath: string,
): { valid: boolean; errors?: string[] } {
  try {
    const schemaContent = readFileSync(schemaPath, "utf-8");
    const schema = JSON.parse(schemaContent);

    const ajv = new Ajv();
    addFormats(ajv);

    const validate = ajv.compile(schema);
    const valid = validate(record);

    if (!valid) {
      return {
        valid: false,
        errors: validate.errors?.map(
          (err) => `${err.instancePath}: ${err.message}`,
        ) || ["Unknown validation error"],
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      errors: [`Schema validation failed: ${error}`],
    };
  }
}

/**
 * Extract metrics for threshold validation from summary
 */
function extractThresholdMetrics(
  summary: BaselineMetricsSummary,
  records: BaselineMetricsRecord[],
): any {
  return {
    cost_per_item: summary.cost_per_item,
    latency_p95_ms: summary.latency_p95_ms,
    failure_rate:
      records.filter((r) => r.alert_flags.length > 0).length / records.length,
    duplication_rate: summary.duplication?.rate || 0,
    coverage_rate:
      summary.coverage?.entity_coverage_rate ||
      summary.coverage?.section_coverage_rate ||
      0,
    quality_score: summary.overall_quality_score,
    evidence_missing_rate: 1 - (summary.evidence_quality?.presence_rate || 0),
    hallucination_rate: summary.hallucination?.rate || 0,
    pii_hits: summary.pii_license?.pii_hits || 0,
    license_violations: summary.pii_license?.license_hits || 0,
  };
}

/**
 * Generate gate mapping banner
 * TODO: Reserved for future enhanced reporting features
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _generateGateMappingBanner(
  profile: string,
  autocalibrationEnabled: boolean,
): string[] {
  const lines: string[] = [];

  lines.push("---");
  lines.push("");
  lines.push("## 🎯 Gate Mapping Policy");
  lines.push("");
  lines.push(`**Current Profile**: ${profile.toUpperCase()}`);
  lines.push(
    `**Auto-calibration**: ${
      autocalibrationEnabled ? "✅ ENABLED" : "❌ DISABLED"
    }`,
  );
  lines.push("");
  lines.push("**Gate Rules**:");
  lines.push("    P0 violations → FAIL (cannot proceed)");
  lines.push("    Many P1 violations → WARN/PARTIAL (review recommended)");
  lines.push("    P2-only small issues → PASS (monitor)");
  lines.push("");

  return lines;
}

/**
 * Generate KPI trends section
 * TODO: Reserved for future trend visualization features
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _generateKPITrends(trends: {
  [key: string]: HistoricalTrend;
}): string[] {
  const lines: string[] = [];

  lines.push("## 📈 KPI Trends (Last 10 Runs)");
  lines.push("");

  if (Object.keys(trends).length === 0) {
    lines.push("*No historical trend data available*");
    lines.push("");
    return lines;
  }

  lines.push("| Metric | Trend | Min | Median | Max |");
  lines.push("|--------|-------|-----|--------|-----|");

  if (trends.accuracy) {
    const t = trends.accuracy;
    lines.push(
      `| Accuracy Score | ${t.sparkline} | ${t.min.toFixed(
        3,
      )} | ${t.median.toFixed(3)} | ${t.max.toFixed(3)} |`,
    );
  }

  if (trends.cost_per_item) {
    const t = trends.cost_per_item;
    lines.push(
      `| Cost per Item | ${t.sparkline} | $${t.min.toFixed(
        4,
      )} | $${t.median.toFixed(4)} | $${t.max.toFixed(4)} |`,
    );
  }

  if (trends.latency_p95) {
    const t = trends.latency_p95;
    lines.push(
      `| P95 Latency | ${t.sparkline} | ${t.min.toFixed(
        0,
      )}ms | ${t.median.toFixed(0)}ms | ${t.max.toFixed(0)}ms |`,
    );
  }

  lines.push("");
  lines.push("*Sparklines show trend direction: ▁▂▃▄▅▆▇ (low to high)*");
  lines.push("");

  return lines;
}

/**
 * Generate DLQ summary section
 * TODO: Reserved for future DLQ reporting features
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _generateDLQSummary(dlqSummary: DLQSummary): string[] {
  const lines: string[] = [];

  lines.push("## 🔄 DLQ (Dead Letter Queue) Status");
  lines.push("");

  if (dlqSummary.count === 0) {
    lines.push("✅ **No DLQ items** - All runs completed successfully");
  } else {
    lines.push(`⚠️ **DLQ Count**: ${dlqSummary.count} failed runs`);
    lines.push("");
    lines.push("**Recent DLQ Items**:");
    for (const item of dlqSummary.recentItems) {
      lines.push(`- ${item}`);
    }
    lines.push("");
    lines.push(`**Reprocess Command**: \`${dlqSummary.reprocessCommand}\``);
  }
  lines.push("");

  return lines;
}

/**
 * Generate threshold summary with previous/current/delta comparison
 */
function generateThresholdSummary(
  gating: GatingResult,
  calibrationResults: CalibrationResult[],
  profile: string,
  manager: ThresholdManager,
  summary: BaselineMetricsSummary,
  previousSummary?: BaselineMetricsSummary,
): string[] {
  const lines: string[] = [];

  lines.push("## 🚪 Threshold Validation & Gating");
  lines.push("");

  // Gating status
  const statusEmoji =
    gating.gate_status === "PASS"
      ? "✅"
      : gating.gate_status === "WARN"
      ? "⚠️"
      : gating.gate_status === "PARTIAL"
      ? "🟡"
      : "❌";

  lines.push(`**Gate Status**: ${statusEmoji} ${gating.gate_status}`);
  lines.push(`**Profile**: ${profile.toUpperCase()}`);
  lines.push(`**Can Proceed**: ${gating.can_proceed ? "✅ YES" : "❌ NO"}`);
  lines.push(`**Recommendation**: ${gating.recommendation}`);
  lines.push("");

  // P0 Violations (Critical)
  if (gating.p0_violations.length > 0) {
    lines.push("### ❌ P0 Critical Violations");
    lines.push("");
    for (const violation of gating.p0_violations) {
      lines.push(`- 🚨 ${violation}`);
    }
    lines.push("");
  }

  // P1 Warnings (Performance)
  if (gating.p1_warnings.length > 0) {
    lines.push("### ⚠️ P1 Performance Warnings");
    lines.push("");
    for (const warning of gating.p1_warnings) {
      lines.push(`- ⚠️ ${warning}`);
    }
    lines.push("");
  }

  // P2 Issues (Quality)
  if (gating.p2_issues.length > 0) {
    lines.push("### 🟡 P2 Quality Issues");
    lines.push("");
    for (const issue of gating.p2_issues) {
      lines.push(`- 🟡 ${issue}`);
    }
    lines.push("");
  }

  // Enhanced Threshold Summary Table with Previous/Current/Delta
  lines.push("### 📊 Threshold Summary with Trend Analysis");
  lines.push("");
  lines.push(
    "| Priority | Metric | Current | Previous | Delta | Threshold | Status |",
  );
  lines.push(
    "|----------|--------|---------|----------|-------|-----------|--------|",
  );

  const thresholds = {
    p0: manager.getP0Thresholds(),
    p1: manager.getP1Thresholds(profile),
    p2: manager.getP2Thresholds(profile),
  };

  // Define metrics to track
  const metricsToTrack = [
    {
      priority: "P0",
      metric: "PII Hits",
      current: summary.pii_license.pii_hits,
      previous: previousSummary?.pii_license.pii_hits,
      threshold: thresholds.p0.pii_hits_max,
      format: "number",
      source: "FIXED",
    },
    {
      priority: "P0",
      metric: "License Violations",
      current: summary.pii_license.license_hits,
      previous: previousSummary?.pii_license.license_hits,
      threshold: thresholds.p0.license_violations_max,
      format: "number",
      source: "FIXED",
    },
    {
      priority: "P1",
      metric: "Cost/Item",
      current: summary.cost_per_item,
      previous: previousSummary?.cost_per_item,
      threshold: thresholds.p1.cost_per_item_warn,
      format: "currency",
    },
    {
      priority: "P1",
      metric: "Latency P95",
      current: summary.latency_p95_ms,
      previous: previousSummary?.latency_p95_ms,
      threshold: thresholds.p1.latency_p95_warn_ms,
      format: "ms",
    },
    {
      priority: "P2",
      metric: "Duplication Rate",
      current: summary.duplication.rate,
      previous: previousSummary?.duplication.rate,
      threshold: thresholds.p2.duplication_rate_warn,
      format: "percentage",
    },
  ];

  for (const metric of metricsToTrack) {
    const isPass = metric.current <= metric.threshold;
    const status = isPass ? "✅ PASS" : "❌ FAIL";
    if (!isPass && metric.priority === "P0") {
      // Add FIXED annotation for P0
      // status += ' (FIXED)';
    }

    // Format values
    const formatValue = (val: number | undefined, format: string) => {
      if (val === undefined) return "N/A";
      switch (format) {
        case "percentage":
          return `${(val * 100).toFixed(1)}%`;
        case "currency":
          return `$${val.toFixed(4)}`;
        case "ms":
          return `${val.toFixed(0)}ms`;
        case "number":
          return val.toString();
        default:
          return val.toString();
      }
    };

    const currentStr = formatValue(metric.current, metric.format);
    const previousStr = formatValue(metric.previous, metric.format);
    const thresholdStr = formatValue(metric.threshold, metric.format);

    // Calculate delta
    let deltaStr = "N/A";
    if (metric.previous !== undefined) {
      const delta = metric.current - metric.previous;
      const deltaIcon = delta > 0 ? "📈" : delta < 0 ? "📉" : "➡️";
      deltaStr = `${deltaIcon} ${formatValue(Math.abs(delta), metric.format)}`;
    }

    const priorityLabel =
      metric.source === "FIXED"
        ? `${metric.priority} (FIXED)`
        : metric.priority;
    lines.push(
      `| ${priorityLabel} | ${metric.metric} | ${currentStr} | ${previousStr} | ${deltaStr} | ${thresholdStr} | ${status} |`,
    );
  }
  lines.push("");

  // Auto-calibration Results
  if (calibrationResults.length > 0) {
    lines.push("### 📈 Auto-Calibration Results");
    lines.push("");

    const appliedChanges = calibrationResults.filter((c) => c.applied);
    const blockedChanges = calibrationResults.filter((c) => !c.applied);

    if (appliedChanges.length > 0) {
      lines.push("**Applied Changes**:");
      for (const change of appliedChanges) {
        const changeStr =
          change.old_value !== change.new_value
            ? `${change.old_value.toFixed(3)} → ${change.new_value.toFixed(
                3,
              )} (${(change.change_pct * 100).toFixed(1)}%)`
            : "No change";
        lines.push(`- ✅ ${change.metric_name}: ${changeStr}`);
      }
      lines.push("");
    }

    if (blockedChanges.length > 0) {
      lines.push("**Blocked by Drift Guard**:");
      for (const change of blockedChanges) {
        lines.push(
          `- 🛡️ ${change.metric_name}: Change of ${(
            change.change_pct * 100
          ).toFixed(1)}% exceeds drift guard limit`,
        );
      }
      lines.push("");
    }
  }

  return lines;
}

/**
 * Generate JSONL report with individual item records
 */
function generateJsonlReport(
  records: BaselineMetricsRecord[],
  outputPath: string,
): void {
  const jsonlContent = records
    .map((record) => JSON.stringify(record))
    .join("\n");

  writeFileSync(outputPath, jsonlContent, "utf-8");
}

/**
 * Generate comprehensive markdown report
 */
function generateMarkdownReport(
  summary: BaselineMetricsSummary,
  records: BaselineMetricsRecord[],
  options: ReportOptions,
  gating?: GatingResult,
  calibrationResults?: CalibrationResult[],
  thresholdManager?: ThresholdManager,
  _trends?: { [key: string]: HistoricalTrend },
  _dlqSummary?: any,
  _previousSummary?: BaselineMetricsSummary,
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Baseline v1.5 Metrics Report`);
  lines.push("");
  lines.push(`**Session**: ${summary.session_id}`);
  lines.push(`**Generated**: ${summary.timestamp}`);
  lines.push(`**Items Analyzed**: ${summary.total_items}`);
  lines.push(`**Config Version**: ${summary.config_version}`);
  lines.push("");

  // Executive Summary
  lines.push("## Executive Summary");
  lines.push("");

  const statusIcon =
    summary.recommendation_level === "green"
      ? "✅"
      : summary.recommendation_level === "yellow"
      ? "⚠️"
      : "❌";

  lines.push(
    `**Overall Quality Score**: ${statusIcon} ${(
      summary.overall_quality_score * 100
    ).toFixed(1)}%`,
  );
  lines.push(
    `**Recommendation Level**: ${summary.recommendation_level.toUpperCase()}`,
  );
  lines.push(`**Total Alerts**: ${summary.total_alerts}`);
  lines.push(
    `**Budget Utilization**: ${(summary.budget_utilization * 100).toFixed(1)}%`,
  );
  lines.push("");

  // Threshold Validation Summary (if enabled)
  if (gating && calibrationResults && thresholdManager && options.profile) {
    const thresholdLines = generateThresholdSummary(
      gating,
      calibrationResults,
      options.profile,
      thresholdManager,
      summary,
    );
    lines.push(...thresholdLines);
  }

  // Quick Metrics Dashboard
  lines.push("## Quick Metrics Dashboard");
  lines.push("");
  lines.push("| Metric | Value | Status | Alert |");
  lines.push("|--------|-------|--------|-------|");

  const metrics = [
    {
      name: "Duplication Rate",
      value: `${(summary.duplication.rate * 100).toFixed(1)}%`,
      status: summary.duplication.rate < 0.15 ? "✅" : "⚠️",
      alert: summary.duplication.alert_triggered ? "🚨" : "✅",
    },
    {
      name: "Evidence Presence",
      value: `${(summary.evidence_quality.presence_rate * 100).toFixed(1)}%`,
      status: summary.evidence_quality.presence_rate > 0.8 ? "✅" : "⚠️",
      alert: summary.evidence_quality.alert_triggered ? "🚨" : "✅",
    },
    {
      name: "Hallucination Rate",
      value: `${(summary.hallucination.rate * 100).toFixed(2)}%`,
      status: summary.hallucination.rate < 0.05 ? "✅" : "⚠️",
      alert: summary.hallucination.alert_triggered ? "🚨" : "✅",
    },
    {
      name: "PII Violations",
      value: `${summary.pii_license.pii_hits}`,
      status: summary.pii_license.pii_hits === 0 ? "✅" : "❌",
      alert: summary.pii_license.alert_triggered ? "🚨" : "✅",
    },
    {
      name: "Coverage Score",
      value: `${(summary.coverage.overall_score * 100).toFixed(1)}%`,
      status: summary.coverage.overall_score > 0.7 ? "✅" : "⚠️",
      alert: summary.coverage.alert_triggered ? "🚨" : "✅",
    },
  ];

  for (const metric of metrics) {
    lines.push(
      `| ${metric.name} | ${metric.value} | ${metric.status} | ${metric.alert} |`,
    );
  }
  lines.push("");

  // Detailed Metrics Sections

  // 1. Duplication Analysis
  lines.push("## 1. Duplication Analysis");
  lines.push("");
  lines.push(
    `- **Duplication Rate**: ${(summary.duplication.rate * 100).toFixed(1)}%`,
  );
  lines.push(
    `- **High Similarity Pairs**: ${summary.duplication.high_similarity_pairs}`,
  );
  if (summary.duplication.semantic_duplication_rate !== undefined) {
    lines.push(
      `- **Semantic Duplication Rate**: ${(
        summary.duplication.semantic_duplication_rate * 100
      ).toFixed(1)}%`,
    );
  }
  lines.push(
    `- **Alert Status**: ${
      summary.duplication.alert_triggered ? "⚠️ TRIGGERED" : "✅ NORMAL"
    }`,
  );
  lines.push("");

  // 2. Question Type Distribution
  lines.push("## 2. Question Type Distribution");
  lines.push("");
  lines.push("| Question Type | Count | Ratio |");
  lines.push("|---------------|-------|-------|");
  for (const [qtype, data] of Object.entries(
    summary.qtype_distribution.distributions,
  )) {
    const typedData = data as { count: number; ratio: number };
    lines.push(
      `| ${qtype} | ${typedData.count} | ${(typedData.ratio * 100).toFixed(
        1,
      )}% |`,
    );
  }
  lines.push("");
  lines.push(
    `- **Imbalance Score**: ${summary.qtype_distribution.imbalance_score.toFixed(
      3,
    )}`,
  );
  lines.push(`- **Entropy**: ${summary.qtype_distribution.entropy.toFixed(3)}`);
  lines.push(
    `- **Missing Categories**: ${
      summary.qtype_distribution.missing_categories.length > 0
        ? summary.qtype_distribution.missing_categories.join(", ")
        : "None"
    }`,
  );
  lines.push("");

  // 3. Coverage Analysis
  lines.push("## 3. Coverage Analysis");
  lines.push("");
  lines.push(
    `- **Entity Coverage**: ${(
      summary.coverage.entity_coverage_rate * 100
    ).toFixed(1)}%`,
  );
  lines.push(
    `- **Section Coverage**: ${(
      summary.coverage.section_coverage_rate * 100
    ).toFixed(1)}%`,
  );
  lines.push(
    `- **Overall Coverage Score**: ${(
      summary.coverage.overall_score * 100
    ).toFixed(1)}%`,
  );
  if (summary.coverage.critical_gaps.length > 0) {
    lines.push(`- **Critical Gaps**:`);
    for (const gap of summary.coverage.critical_gaps) {
      lines.push(`  - ${gap}`);
    }
  }
  lines.push("");

  // 4. Evidence Quality (Enhanced with prominence)
  lines.push("## 4. Evidence Quality Assessment");
  lines.push("");

  // Prominent Evidence Metrics Block
  const evidenceIcon =
    summary.evidence_quality.presence_rate > 0.8 ? "✅" : "⚠️";
  const alignmentIcon =
    summary.evidence_quality.alignment_mean > 0.7 ? "✅" : "⚠️";

  lines.push("### 📋 Evidence Quality KPIs");
  lines.push("");
  lines.push("| Metric | Value | Status |");
  lines.push("|--------|-------|--------|");
  lines.push(
    `| **Citation Presence %** | **${(
      summary.evidence_quality.presence_rate * 100
    ).toFixed(1)}%** | ${evidenceIcon} |`,
  );
  lines.push(
    `| **Snippet Alignment %** | **${(
      summary.evidence_quality.alignment_mean * 100
    ).toFixed(1)}%** | ${alignmentIcon} |`,
  );
  lines.push(
    `| **95th Percentile Alignment** | ${summary.evidence_quality.alignment_p95.toFixed(
      3,
    )} | - |`,
  );
  lines.push("");

  lines.push(
    `- **Alert Status**: ${
      summary.evidence_quality.alert_triggered
        ? "⚠️ QUALITY ISSUES"
        : "✅ NORMAL"
    }`,
  );
  lines.push("");

  // 5. Hallucination Detection
  lines.push("## 5. Hallucination Detection");
  lines.push("");
  lines.push(
    `- **Hallucination Rate**: ${(summary.hallucination.rate * 100).toFixed(
      2,
    )}%`,
  );
  lines.push(`- **High Risk Cases**: ${summary.hallucination.high_risk_count}`);
  lines.push("");
  lines.push("**Risk Distribution**:");
  for (const [level, count] of Object.entries(
    summary.hallucination.risk_distribution,
  )) {
    const c = Number(count ?? 0);
    const percentage =
      summary.total_items > 0
        ? ((c / summary.total_items) * 100).toFixed(1)
        : "0.0";
    lines.push(`- ${level}: ${count} (${percentage}%)`);
  }
  lines.push("");

  // 6. PII and License Scanning
  lines.push("## 6. PII and License Compliance");
  lines.push("");
  lines.push(`- **PII Violations**: ${summary.pii_license.pii_hits}`);
  lines.push(`- **License Violations**: ${summary.pii_license.license_hits}`);
  lines.push(`- **Total Violations**: ${summary.pii_license.total_violations}`);
  lines.push(
    `- **Compliance Status**: ${
      summary.pii_license.alert_triggered
        ? "🚨 VIOLATIONS DETECTED"
        : "✅ COMPLIANT"
    }`,
  );
  lines.push("");

  // Cost and Performance
  lines.push("## 7. Cost and Performance Analysis");
  lines.push("");
  lines.push(`- **Total Cost**: $${summary.cost_total_usd.toFixed(4)}`);
  lines.push(`- **Cost per Item**: $${summary.cost_per_item.toFixed(4)}`);
  lines.push(`- **Latency P50**: ${summary.latency_p50_ms.toFixed(0)}ms`);
  lines.push(`- **Latency P95**: ${summary.latency_p95_ms.toFixed(0)}ms`);
  lines.push(
    `- **Budget Utilization**: ${(summary.budget_utilization * 100).toFixed(
      1,
    )}%`,
  );
  lines.push("");

  // Reproducibility
  lines.push("## 8. Reproducibility Assessment");
  lines.push("");
  lines.push(
    `- **Reproducibility Check**: ${
      summary.reproducibility_check.passed ? "✅ PASSED" : "⚠️ FAILED"
    }`,
  );
  if (Object.keys(summary.reproducibility_check.deviations).length > 0) {
    lines.push(`- **Deviations**:`);
    for (const [metric, deviation] of Object.entries(
      summary.reproducibility_check.deviations,
    )) {
      const d = Number(deviation ?? 0);
      lines.push(`  - ${metric}: ${d.toFixed(1)}%`);
    }
  }
  lines.push("");

  // Alert Summary
  if (summary.total_alerts > 0) {
    lines.push("## 🚨 Alert Summary");
    lines.push("");
    lines.push("The following areas require attention:");
    lines.push("");

    const alertSections = [
      {
        condition: summary.duplication.alert_triggered,
        message:
          "High duplication rate detected - review for content repetition",
      },
      {
        condition: summary.evidence_quality.alert_triggered,
        message: "Evidence quality issues - verify answer-evidence alignment",
      },
      {
        condition: summary.hallucination.alert_triggered,
        message:
          "Potential hallucinations detected - validate against source material",
      },
      {
        condition: summary.pii_license.alert_triggered,
        message: "PII or license violations found - immediate cleanup required",
      },
      {
        condition: summary.coverage.alert_triggered,
        message: "Coverage gaps identified - important content may be missing",
      },
      {
        condition: summary.qtype_distribution.alert_triggered,
        message:
          "Question type imbalance detected - diversify question patterns",
      },
    ];

    for (const alert of alertSections) {
      if (alert.condition) {
        lines.push(`- ⚠️ ${alert.message}`);
      }
    }
    lines.push("");
  }

  // Recommendations
  lines.push("## Recommendations");
  lines.push("");

  if (summary.recommendation_level === "green") {
    lines.push("✅ **Quality is acceptable for production use**");
    lines.push("- Continue monitoring key metrics");
    lines.push("- Maintain current quality standards");
  } else if (summary.recommendation_level === "yellow") {
    lines.push("⚠️ **Quality requires review before production**");
    lines.push("- Address alert conditions above");
    lines.push("- Re-run baseline after improvements");
    lines.push("- Consider additional QA validation");
  } else {
    lines.push("❌ **Quality is not acceptable for production**");
    lines.push("- Immediate action required for all alerts");
    lines.push("- Full quality review and remediation needed");
    lines.push("- Do not deploy until quality improves");
  }
  lines.push("");

  // File References
  lines.push("## File References");
  lines.push("");
  lines.push(`- **Configuration**: baseline_config.json`);
  lines.push(`- **Detailed Data**: reports/baseline_report.jsonl`);
  lines.push(`- **Schema**: schema/baseline_report.schema.json`);
  lines.push(`- **Session Report**: reports/session_report.md`);
  lines.push("");

  // Footer
  lines.push("---");
  lines.push("");
  lines.push(`*Generated by Baseline v1.5 Metrics System*`);
  lines.push(`*Report ID: ${summary.session_id}*`);
  lines.push(`*Total Items: ${summary.total_items}*`);
  lines.push("");

  return lines.join("\n");
}

/**
 * Main function to generate all baseline reports
 */
export async function generateBaselineReports(
  qaItems: QAItem[],
  options: ReportOptions = {},
): Promise<{
  jsonlPath: string;
  markdownPath: string;
  summary: BaselineMetricsSummary;
  hash: string;
  gating?: GatingResult;
  calibrationResults?: CalibrationResult[];
  schemaValidationResults?: { valid: boolean; errors?: string[] }[];
  exportPaths?: { csvPath: string; jsonPath: string };
  exportValidation?: { valid: boolean; errors?: string[] };
}> {
  const {
    outputDir = "reports",
    sessionId = `baseline_${Date.now()}`,
    budgetLimit = 0,
    sourceTexts = [],
    profile = "dev",
    enableAutocalibration = false,
    applyCalibration = false,
    enableSchemaValidation = true,
    enableExport = true,
    trendHistoryLimit = 10,
  } = options;

  console.log(`\n📝 Generating baseline v1.5 reports...`);

  // Calculate all metrics
  const { records, summary } = await calculateAllBaselineMetrics(qaItems, {
    sessionId,
    budgetLimit,
    sourceTexts,
  });
  // After data load:
  const arr = Array.isArray(qaItems)
    ? qaItems
    : Array.isArray((qaItems as any)?.items)
    ? (qaItems as any).items
    : [];
  const casesTotal = arr.length;
  try {
    // Update CASES_TOTAL in session_report to reflect real count
    let prev = await fs.readFile(SESSION_REPORT, "utf8");
    prev = prev.replace(/CASES_TOTAL:\s*\d+/g, `CASES_TOTAL: ${casesTotal}`);
    await fs.writeFile(SESSION_REPORT + ".tmp", prev, "utf8");
    await fs.rename(SESSION_REPORT + ".tmp", SESSION_REPORT);
  } catch {
    // Best effort update - continue if file operations fail
  }

  // Initialize threshold manager and perform gating evaluation
  let thresholdManager: ThresholdManager | undefined;
  let gating: GatingResult | undefined;
  let calibrationResults: CalibrationResult[] = [];

  try {
    console.log(`🔍 Initializing threshold manager (profile: ${profile})...`);
    thresholdManager = createThresholdManager();

    // Perform auto-calibration if enabled
    if (enableAutocalibration) {
      console.log(`📈 Running auto-calibration...`);
      calibrationResults = await thresholdManager.autoCalibrateThresholds(
        profile,
      );

      if (calibrationResults.length > 0) {
        console.log(
          `📊 Found ${calibrationResults.length} calibration opportunities`,
        );

        if (applyCalibration) {
          console.log(`✅ Applying calibration changes...`);
          thresholdManager.applyCalibrationResults(calibrationResults, profile);
        } else {
          console.log(
            `⏳ Calibration changes calculated but not applied (use applyCalibration: true)`,
          );
        }
      } else {
        console.log(`📊 No calibration changes needed`);
      }
    }

    // Extract metrics for threshold evaluation
    const thresholdMetrics = extractThresholdMetrics(summary, records);

    // Perform gating evaluation
    console.log(`🚪 Performing threshold validation and gating...`);
    gating = thresholdManager.evaluateGating(thresholdMetrics, profile);

    console.log(
      `🎯 Gate Status: ${gating.gate_status} (Can Proceed: ${gating.can_proceed})`,
    );
    if (gating.p0_violations.length > 0) {
      console.log(`🚨 P0 Violations: ${gating.p0_violations.length}`);
    }
    if (gating.p1_warnings.length > 0) {
      console.log(`⚠️ P1 Warnings: ${gating.p1_warnings.length}`);
    }
    if (gating.p2_issues.length > 0) {
      console.log(`🟡 P2 Issues: ${gating.p2_issues.length}`);
    }
  } catch (error) {
    console.warn(`⚠️ Threshold validation failed: ${error}`);
    console.warn(
      `📋 Continuing report generation without threshold validation...`,
    );
  }

  // Schema validation
  const schemaValidationResults: { valid: boolean; errors?: string[] }[] = [];
  if (enableSchemaValidation) {
    console.log(`📋 Performing schema validation...`);
    const schemaPath = join(
      process.cwd(),
      "schema",
      "baseline_report.schema.json",
    );

    for (let i = 0; i < Math.min(records.length, 10); i++) {
      // Validate first 10 records for performance
      const result = validateSchema(records[i], schemaPath);
      schemaValidationResults.push(result);

      if (!result.valid) {
        console.warn(
          `❌ Schema validation failed for record ${i}: ${result.errors?.join(
            ", ",
          )}`,
        );
      }
    }

    const validCount = schemaValidationResults.filter((r) => r.valid).length;
    console.log(
      `📊 Schema validation: ${validCount}/${schemaValidationResults.length} records valid`,
    );
  }

  // Generate output file paths
  const jsonlPath = join(outputDir, "baseline_report.jsonl");
  const markdownPath = join(outputDir, "baseline_report.md");

  // Generate JSONL report
  console.log(`📊 Writing JSONL data to: ${jsonlPath}`);
  generateJsonlReport(records, jsonlPath);

  // Load historical trends and DLQ summary
  console.log(
    `📈 Loading historical trends (last ${trendHistoryLimit} runs)...`,
  );
  const trends = loadHistoricalTrends(outputDir, trendHistoryLimit);

  console.log(`🔄 Loading DLQ summary...`);
  const dlqSummary = loadDLQSummary(outputDir);

  // Load previous summary for comparison (if available)
  let previousSummary: BaselineMetricsSummary | undefined;
  try {
    const previousJsonlPath = join(outputDir, "baseline_report.jsonl");
    if (existsSync(previousJsonlPath)) {
      const previousContent = readFileSync(previousJsonlPath, "utf-8");
      const previousLines = previousContent
        .trim()
        .split("\n")
        .filter((line) => line.trim());
      if (previousLines.length > 0) {
        // Extract summary from last line (it should contain summary data)
        // const _____lastRecord = JSON.parse(previousLines[previousLines.length - 1]);
        // Note: This is a simplified approach - in practice, you'd store summary separately
      }
    }
  } catch (error) {
    console.warn(
      `Warning: Could not load previous summary for comparison: ${error}`,
    );
  }

  // Generate Markdown report with enhanced features
  console.log(`📄 Writing enhanced markdown report to: ${markdownPath}`);
  const markdownContent = generateMarkdownReport(
    summary,
    records,
    options,
    gating,
    calibrationResults,
    thresholdManager,
    trends,
    dlqSummary,
    previousSummary,
  );
  writeFileSync(markdownPath, markdownContent, "utf-8");

  // Export for BI if enabled
  let exportPaths: { csvPath: string; jsonPath: string } | undefined;
  let exportValidation: { valid: boolean; errors?: string[] } | undefined;

  if (enableExport) {
    console.log(`📊 Generating BI export files...`);
    const exportRecords = convertToExportFormat(records, summary, gating);

    // Validate export data
    const exportSchemaPath = join(
      process.cwd(),
      "schema",
      "baseline_export.schema.json",
    );
    exportValidation = validateExportData(exportRecords, exportSchemaPath);

    if (exportValidation.valid) {
      exportPaths = writeExportFiles(exportRecords, outputDir, profile);
      console.log(`📈 Export files written:`);
      console.log(`  - CSV: ${exportPaths.csvPath}`);
      console.log(`  - JSON: ${exportPaths.jsonPath}`);
    } else {
      console.warn(
        `⚠️ Export validation failed: ${exportValidation.errors?.join(", ")}`,
      );
      console.warn(`📊 Skipping export file generation`);
    }
  }

  // Calculate integrity hash
  const combinedContent = JSON.stringify(summary) + markdownContent;
  const hash = calculateFileHash(combinedContent);

  console.log(`✅ Enhanced baseline reports generated successfully!`);
  console.log(`🔗 Markdown Report: ${markdownPath}`);
  console.log(`🔗 Data File: ${jsonlPath}`);
  if (exportPaths) {
    console.log(
      `🔗 BI Export: ${exportPaths.csvPath}, ${exportPaths.jsonPath}`,
    );
  }
  console.log(`📈 Trends: ${Object.keys(trends).length} metrics tracked`);
  console.log(`🔄 DLQ Status: ${dlqSummary.count} items`);
  console.log(`🔒 Integrity Hash: ${hash}`);

  const out: any = { jsonlPath, markdownPath, summary, hash };
  if (gating) out.gating = gating;
  if (calibrationResults) out.calibrationResults = calibrationResults;
  if (schemaValidationResults)
    out.schemaValidationResults = schemaValidationResults;
  if (exportPaths) out.exportPaths = exportPaths;
  if (exportValidation) out.exportValidation = exportValidation;
  return out;
}
