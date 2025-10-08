/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * DxLoop v1 - Gating Logic
 * Determines PASS/WARN/PARTIAL/FAIL based on P0/P1/P2 threshold violations
 */

import {
  DxThresholds,
  MetricsAnalysis,
  AnomalyDetection,
  ActionRecommendation,
  GatingResult,
  ConsistencyCheck,
} from "./types.js";

/**
 * Check P0 violations (critical, always block)
 */
function checkP0Violations(
  metrics: MetricsAnalysis,
  thresholds: DxThresholds["p0"],
): string[] {
  const violations: string[] = [];

  // PII hits (must be zero)
  if (metrics.pii_license.pii_hits > thresholds.pii_hits_max) {
    violations.push(
      `PII detected: ${metrics.pii_license.pii_hits} hits (max: ${thresholds.pii_hits_max})`,
    );
  }

  // License violations
  if (
    metrics.pii_license.license_violations > thresholds.license_violations_max
  ) {
    violations.push(
      `License violations: ${metrics.pii_license.license_violations} (max: ${thresholds.license_violations_max})`,
    );
  }

  // Evidence missing rate
  const evidenceMissingRate = 1.0 - metrics.evidence.presence_rate;
  if (evidenceMissingRate > thresholds.evidence_missing_rate_max) {
    violations.push(
      `Evidence missing rate: ${(evidenceMissingRate * 100).toFixed(
        1,
      )}% (max: ${(thresholds.evidence_missing_rate_max * 100).toFixed(1)}%)`,
    );
  }

  // Hallucination rate
  if (metrics.hallucination.rate > thresholds.hallucination_rate_max) {
    violations.push(
      `Hallucination rate: ${(metrics.hallucination.rate * 100).toFixed(
        1,
      )}% (max: ${(thresholds.hallucination_rate_max * 100).toFixed(1)}%)`,
    );
  }

  return violations;
}

/**
 * Check P1 warnings (important, warn but may allow)
 */
function checkP1Warnings(
  metrics: MetricsAnalysis,
  thresholds: DxThresholds["p1"],
): string[] {
  const warnings: string[] = [];

  // Cost per item
  if (metrics.cost_latency.cost_per_item > thresholds.cost_per_item_fail) {
    warnings.push(
      `Cost per item FAIL: $${metrics.cost_latency.cost_per_item.toFixed(
        3,
      )} (threshold: $${thresholds.cost_per_item_fail})`,
    );
  } else if (
    metrics.cost_latency.cost_per_item > thresholds.cost_per_item_warn
  ) {
    warnings.push(
      `Cost per item WARN: $${metrics.cost_latency.cost_per_item.toFixed(
        3,
      )} (threshold: $${thresholds.cost_per_item_warn})`,
    );
  }

  // Latency P95
  if (metrics.cost_latency.latency_p95_ms > thresholds.latency_p95_fail_ms) {
    warnings.push(
      `P95 latency FAIL: ${metrics.cost_latency.latency_p95_ms}ms (threshold: ${thresholds.latency_p95_fail_ms}ms)`,
    );
  } else if (
    metrics.cost_latency.latency_p95_ms > thresholds.latency_p95_warn_ms
  ) {
    warnings.push(
      `P95 latency WARN: ${metrics.cost_latency.latency_p95_ms}ms (threshold: ${thresholds.latency_p95_warn_ms}ms)`,
    );
  }

  // Failure rate
  if (metrics.failure_retry.failure_rate > thresholds.failure_rate_fail) {
    warnings.push(
      `Failure rate FAIL: ${(metrics.failure_retry.failure_rate * 100).toFixed(
        1,
      )}% (threshold: ${(thresholds.failure_rate_fail * 100).toFixed(1)}%)`,
    );
  } else if (
    metrics.failure_retry.failure_rate > thresholds.failure_rate_warn
  ) {
    warnings.push(
      `Failure rate WARN: ${(metrics.failure_retry.failure_rate * 100).toFixed(
        1,
      )}% (threshold: ${(thresholds.failure_rate_warn * 100).toFixed(1)}%)`,
    );
  }

  return warnings;
}

/**
 * Check P2 issues (quality concerns, informational)
 */
function checkP2Issues(
  metrics: MetricsAnalysis,
  thresholds: DxThresholds["p2"],
): string[] {
  const issues: string[] = [];

  // Duplication rate
  if (metrics.duplication.rate > thresholds.duplication_rate_fail) {
    issues.push(
      `Duplication rate FAIL: ${(metrics.duplication.rate * 100).toFixed(
        1,
      )}% (threshold: ${(thresholds.duplication_rate_fail * 100).toFixed(1)}%)`,
    );
  } else if (metrics.duplication.rate > thresholds.duplication_rate_warn) {
    issues.push(
      `Duplication rate WARN: ${(metrics.duplication.rate * 100).toFixed(
        1,
      )}% (threshold: ${(thresholds.duplication_rate_warn * 100).toFixed(1)}%)`,
    );
  }

  // Coverage rate (lower is worse)
  if (metrics.coverage.entity_coverage_rate < thresholds.coverage_rate_fail) {
    issues.push(
      `Coverage rate FAIL: ${(
        metrics.coverage.entity_coverage_rate * 100
      ).toFixed(1)}% (threshold: ${(
        thresholds.coverage_rate_fail * 100
      ).toFixed(1)}%)`,
    );
  } else if (
    metrics.coverage.entity_coverage_rate < thresholds.coverage_rate_warn
  ) {
    issues.push(
      `Coverage rate WARN: ${(
        metrics.coverage.entity_coverage_rate * 100
      ).toFixed(1)}% (threshold: ${(
        thresholds.coverage_rate_warn * 100
      ).toFixed(1)}%)`,
    );
  }

  // Quality score (estimate from evidence alignment)
  const qualityScore = metrics.evidence.alignment_mean;
  if (qualityScore < thresholds.quality_score_fail) {
    issues.push(
      `Quality score FAIL: ${(qualityScore * 100).toFixed(1)}% (threshold: ${(
        thresholds.quality_score_fail * 100
      ).toFixed(1)}%)`,
    );
  } else if (qualityScore < thresholds.quality_score_warn) {
    issues.push(
      `Quality score WARN: ${(qualityScore * 100).toFixed(1)}% (threshold: ${(
        thresholds.quality_score_warn * 100
      ).toFixed(1)}%)`,
    );
  }

  return issues;
}

/**
 * Apply additional checks from anomalies and consistency
 */
function applyAdditionalChecks(
  anomalies: AnomalyDetection,
  consistency: ConsistencyCheck,
  p0Violations: string[],
  p1Warnings: string[],
): void {
  // Add critical anomalies as P0 violations
  for (const anomaly of anomalies.anomalies) {
    if (anomaly.severity === "high") {
      p0Violations.push(`Critical anomaly: ${anomaly.description}`);
    }
  }

  // Add spikes as P1 warnings
  for (const spike of anomalies.spikes) {
    p1Warnings.push(
      `${spike.type} spike: ${spike.value.toFixed(
        3,
      )} (threshold: ${spike.threshold.toFixed(3)})`,
    );
  }

  // Add consistency issues as P0 violations
  if (!consistency.passed) {
    p0Violations.push("CASES_TOTAL is zero - invalid run state");
  }

  if (!consistency.session_report_exists) {
    p0Violations.push("Session report not found or invalid");
  }

  for (const issue of consistency.issues) {
    if (
      issue.includes("CASES_TOTAL is 0") ||
      issue.includes("Session report not found")
    ) {
      if (!p0Violations.some((v) => v.includes(issue))) {
        p0Violations.push(`Consistency error: ${issue}`);
      }
    } else {
      if (!p1Warnings.some((w) => w.includes(issue))) {
        p1Warnings.push(`Consistency warning: ${issue}`);
      }
    }
  }
}

/**
 * Determine final gate status based on violations and warnings
 */
function determineGateStatus(
  p0Violations: string[],
  p1Warnings: string[],
  p2Issues: string[],
  recommendations: ActionRecommendation[],
): {
  gate_status: "PASS" | "WARN" | "PARTIAL" | "FAIL";
  reason: string;
  can_proceed: boolean;
} {
  // P0 violations always result in FAIL
  if (p0Violations.length > 0) {
    return {
      gate_status: "FAIL",
      reason: `${p0Violations.length} critical P0 violation(s) detected`,
      can_proceed: false,
    };
  }

  // Count critical recommendations
  const criticalRecommendations = recommendations.filter(
    (r) => r.severity === "critical",
  ).length;
  if (criticalRecommendations > 0) {
    return {
      gate_status: "FAIL",
      reason: `${criticalRecommendations} critical recommendation(s) require immediate attention`,
      can_proceed: false,
    };
  }

  // Multiple P1 warnings result in PARTIAL (proceed with caution)
  const p1FailCount = p1Warnings.filter((w) => w.includes("FAIL")).length;
  const p1WarnCount = p1Warnings.filter((w) => w.includes("WARN")).length;

  if (p1FailCount > 2) {
    return {
      gate_status: "FAIL",
      reason: `${p1FailCount} P1 FAIL conditions exceed tolerance`,
      can_proceed: false,
    };
  }

  if (p1FailCount > 0 || p1WarnCount > 3) {
    return {
      gate_status: "PARTIAL",
      reason: `${p1FailCount} P1 failures and ${p1WarnCount} P1 warnings detected`,
      can_proceed: true,
    };
  }

  // P2 issues result in WARN but can proceed
  const p2FailCount = p2Issues.filter((i) => i.includes("FAIL")).length;
  const p2WarnCount = p2Issues.filter((i) => i.includes("WARN")).length;

  if (p2FailCount > 1 || p2WarnCount > 2) {
    return {
      gate_status: "WARN",
      reason: `${p2FailCount} P2 failures and ${p2WarnCount} P2 warnings noted`,
      can_proceed: true,
    };
  }

  // Few or no issues - can proceed
  if (p1WarnCount > 0 || p2WarnCount > 0) {
    return {
      gate_status: "WARN",
      reason: `Minor issues detected but within acceptable limits`,
      can_proceed: true,
    };
  }

  return {
    gate_status: "PASS",
    reason: "All checks passed within acceptable thresholds",
    can_proceed: true,
  };
}

/**
 * Perform comprehensive gating decision
 */
export function performGating(
  metrics: MetricsAnalysis,
  thresholds: DxThresholds,
  anomalies: AnomalyDetection,
  recommendations: ActionRecommendation[],
  consistency: ConsistencyCheck,
): GatingResult {
  try {
    console.log("Performing gating analysis...");

    // Check violations at each priority level
    const p0Violations = checkP0Violations(metrics, thresholds.p0);
    const p1Warnings = checkP1Warnings(metrics, thresholds.p1);
    const p2Issues = checkP2Issues(metrics, thresholds.p2);

    // Apply additional checks from anomalies and consistency
    applyAdditionalChecks(anomalies, consistency, p0Violations, p1Warnings);

    // Determine final gate status
    const gateDecision = determineGateStatus(
      p0Violations,
      p1Warnings,
      p2Issues,
      recommendations,
    );

    const result: GatingResult = {
      gate_status: gateDecision.gate_status,
      p0_violations: p0Violations,
      p1_warnings: p1Warnings,
      p2_issues: p2Issues,
      reason: gateDecision.reason,
      can_proceed: gateDecision.can_proceed,
    };

    console.log("Gating analysis completed:", {
      gate_status: result.gate_status,
      can_proceed: result.can_proceed,
      p0_violations: p0Violations.length,
      p1_warnings: p1Warnings.length,
      p2_issues: p2Issues.length,
    });

    return result;
  } catch (error) {
    console.error("Error during gating analysis:", error);

    // Error state - fail safe
    return {
      gate_status: "FAIL",
      p0_violations: [`Gating analysis error: ${error}`],
      p1_warnings: [],
      p2_issues: [],
      reason: "Gating analysis failed - failing safe",
      can_proceed: false,
    };
  }
}

/**
 * Generate gating summary for reporting
 */
export function summarizeGating(result: GatingResult): {
  status_emoji: string;
  summary_text: string;
  action_required: boolean;
  next_steps: string[];
} {
  let status_emoji = "";
  let summary_text = "";
  let action_required = false;
  const next_steps: string[] = [];

  switch (result.gate_status) {
    case "PASS":
      status_emoji = "✅";
      summary_text = "All quality gates passed - system ready for full run";
      action_required = false;
      next_steps.push("Proceed with full run execution");
      next_steps.push("Monitor metrics during execution");
      break;

    case "WARN":
      status_emoji = "⚠️";
      summary_text =
        "Minor issues detected but within acceptable limits - proceed with monitoring";
      action_required = false;
      next_steps.push("Proceed with full run but increase monitoring");
      next_steps.push("Review P2 quality issues when time permits");
      next_steps.push("Consider threshold adjustments if patterns persist");
      break;

    case "PARTIAL":
      status_emoji = "🟡";
      summary_text =
        "Significant warnings detected - proceed with caution and enhanced monitoring";
      action_required = true;
      next_steps.push("Review P1 warnings and assess risk tolerance");
      next_steps.push("Consider implementing recommended mitigations");
      next_steps.push("Proceed with reduced batch size or enhanced monitoring");
      next_steps.push("Plan corrective actions for next run");
      break;

    case "FAIL":
      status_emoji = "❌";
      summary_text =
        "Critical issues detected - full run blocked until resolved";
      action_required = true;
      next_steps.push("Address all P0 violations before proceeding");
      next_steps.push("Implement critical recommendations");
      next_steps.push("Re-run diagnostic loop after fixes");
      next_steps.push("Consider rollback to last known good configuration");
      break;

    default:
      status_emoji = "❓";
      summary_text = "Unknown gating status";
      action_required = true;
      next_steps.push("Review gating logic and thresholds");
  }

  // Add specific next steps based on violation types
  if (result.p0_violations.length > 0) {
    next_steps.push(
      `Resolve ${result.p0_violations.length} critical P0 violations`,
    );
  }

  if (result.p1_warnings.length > 3) {
    next_steps.push(
      `Review ${result.p1_warnings.length} P1 performance warnings`,
    );
  }

  if (result.p2_issues.length > 2) {
    next_steps.push(
      `Consider addressing ${result.p2_issues.length} P2 quality issues`,
    );
  }

  return {
    status_emoji,
    summary_text,
    action_required,
    next_steps: next_steps.slice(0, 6), // Limit to top 6 steps
  };
}

/**
 * CLI interface for gating logic
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === "gate") {
    // Mock data for testing
    const mockMetrics: MetricsAnalysis = {
      duplication: { rate: 0.05, pairs_detected: 2, semantic_duplicates: 1 },
      coverage: {
        entity_coverage_rate: 0.8,
        section_coverage_rate: 0.85,
        uncovered_entities: [],
      },
      evidence: {
        presence_rate: 0.9,
        alignment_mean: 0.75,
        alignment_p95: 0.6,
        missing_evidence_count: 1,
      },
      hallucination: {
        rate: 0.02,
        high_risk_cases: 0,
        confidence_scores: [0.8, 0.9, 0.85],
      },
      pii_license: { pii_hits: 0, license_violations: 0, risk_samples: [] },
      cost_latency: {
        cost_per_item: 0.12,
        latency_p50_ms: 1200,
        latency_p95_ms: 3500,
        budget_utilization: 0.6,
      },
      failure_retry: {
        failure_rate: 0.05,
        retry_count: 1,
        dlq_count: 1,
        top_error_classes: ["timeout"],
      },
    };

    const mockThresholds: DxThresholds = {
      p0: {
        pii_hits_max: 0,
        license_violations_max: 2,
        evidence_missing_rate_max: 0.3,
        hallucination_rate_max: 0.05,
      },
      p1: {
        cost_per_item_warn: 0.08,
        cost_per_item_fail: 0.15,
        latency_p95_warn_ms: 4000,
        latency_p95_fail_ms: 8000,
        failure_rate_warn: 0.1,
        failure_rate_fail: 0.25,
      },
      p2: {
        duplication_rate_warn: 0.1,
        duplication_rate_fail: 0.2,
        coverage_rate_warn: 0.7,
        coverage_rate_fail: 0.5,
        quality_score_warn: 0.7,
        quality_score_fail: 0.5,
      },
    };

    const mockAnomalies: AnomalyDetection = { anomalies: [], spikes: [] };
    const mockRecommendations: ActionRecommendation[] = [];
    const mockConsistency: ConsistencyCheck = {
      session_report_exists: true,
      baseline_report_exists: true,
      llm_analysis_exists: true,
      dry_run_match: true,
      mode_match: true,
      result_match: true,
      passed: true,
      cases_total: 1,
      issues: [],
    };

    const result = performGating(
      mockMetrics,
      mockThresholds,
      mockAnomalies,
      mockRecommendations,
      mockConsistency,
    );
    const summary = summarizeGating(result);

    console.log("Gating Result:");
    console.log(
      JSON.stringify(
        {
          result,
          summary,
        },
        null,
        2,
      ),
    );

    // Exit with appropriate code
    process.exit(result.can_proceed ? 0 : 1);
  } else {
    console.log("Usage: node gating.js gate");
    process.exit(1);
  }
}
