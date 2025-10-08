/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Domain: Threshold Rules and Evaluation
 * Pure business logic for threshold evaluation without I/O
 */

// ============================================================================
// Value Objects
// ============================================================================

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

export interface BaselineMetrics {
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
// P0 Evaluation (Critical - Fixed Thresholds)
// ============================================================================

export function evaluateP0Thresholds(
  metrics: BaselineMetrics,
  thresholds: P0Thresholds,
): {
  violations: ThresholdViolation[];
  messages: string[];
} {
  const violations: ThresholdViolation[] = [];
  const messages: string[] = [];

  // PII Hits
  if (metrics.pii_hits > thresholds.pii_hits_max) {
    const message = `PII violations detected: ${metrics.pii_hits} > ${thresholds.pii_hits_max}`;
    messages.push(message);
    violations.push({
      level: "P0",
      metric: "pii_hits",
      threshold_type: "fail",
      actual_value: metrics.pii_hits,
      threshold_value: thresholds.pii_hits_max,
      severity: "critical",
      message,
    });
  }

  // License Violations
  if (metrics.license_violations > thresholds.license_violations_max) {
    const message = `License violations: ${metrics.license_violations} > ${thresholds.license_violations_max}`;
    messages.push(message);
    violations.push({
      level: "P0",
      metric: "license_violations",
      threshold_type: "fail",
      actual_value: metrics.license_violations,
      threshold_value: thresholds.license_violations_max,
      severity: "critical",
      message,
    });
  }

  // Evidence Missing Rate
  if (metrics.evidence_missing_rate > thresholds.evidence_missing_rate_max) {
    const message = `Evidence missing rate: ${(
      metrics.evidence_missing_rate * 100
    ).toFixed(1)}% > ${(thresholds.evidence_missing_rate_max * 100).toFixed(
      1,
    )}%`;
    messages.push(message);
    violations.push({
      level: "P0",
      metric: "evidence_missing_rate",
      threshold_type: "fail",
      actual_value: metrics.evidence_missing_rate,
      threshold_value: thresholds.evidence_missing_rate_max,
      severity: "critical",
      message,
    });
  }

  // Hallucination Rate
  if (metrics.hallucination_rate > thresholds.hallucination_rate_max) {
    const message = `Hallucination rate: ${(
      metrics.hallucination_rate * 100
    ).toFixed(1)}% > ${(thresholds.hallucination_rate_max * 100).toFixed(1)}%`;
    messages.push(message);
    violations.push({
      level: "P0",
      metric: "hallucination_rate",
      threshold_type: "fail",
      actual_value: metrics.hallucination_rate,
      threshold_value: thresholds.hallucination_rate_max,
      severity: "critical",
      message,
    });
  }

  return { violations, messages };
}

// ============================================================================
// P1 Evaluation (Performance - Auto-Calibrated)
// ============================================================================

export function evaluateP1Thresholds(
  metrics: BaselineMetrics,
  thresholds: P1Thresholds,
): {
  violations: ThresholdViolation[];
  warnings: string[];
} {
  const violations: ThresholdViolation[] = [];
  const warnings: string[] = [];

  // Cost per item
  if (metrics.cost_per_item >= thresholds.cost_per_item_fail) {
    const msg = `Cost per item FAIL: $${metrics.cost_per_item.toFixed(3)} >= $${
      thresholds.cost_per_item_fail
    }`;
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
    const msg = `Cost per item WARN: $${metrics.cost_per_item.toFixed(3)} >= $${
      thresholds.cost_per_item_warn
    }`;
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

  return { violations, warnings };
}

// ============================================================================
// P2 Evaluation (Quality - Auto-Calibrated)
// ============================================================================

export function evaluateP2Thresholds(
  metrics: BaselineMetrics,
  thresholds: P2Thresholds,
): {
  violations: ThresholdViolation[];
  issues: string[];
} {
  const violations: ThresholdViolation[] = [];
  const issues: string[] = [];

  // Duplication rate (higher is worse)
  if (metrics.duplication_rate >= thresholds.duplication_rate_fail) {
    const msg = `Duplication rate FAIL: ${(
      metrics.duplication_rate * 100
    ).toFixed(1)}% >= ${(thresholds.duplication_rate_fail * 100).toFixed(1)}%`;
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
    ).toFixed(1)}% >= ${(thresholds.duplication_rate_warn * 100).toFixed(1)}%`;
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

  return { violations, issues };
}

// ============================================================================
// Gating Decision Logic
// ============================================================================

export function determineGatingStatus(
  p0Violations: string[],
  p1Warnings: string[],
  p2Issues: string[],
  allViolations: ThresholdViolation[],
): GatingResult {
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
    p1Warnings.filter((w) => w.includes("FAIL")).length >= 1
  ) {
    gateStatus = "PARTIAL";
    canProceed = true;
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
    violations: allViolations,
    recommendation,
  };
}

// ============================================================================
// Calibration Logic
// ============================================================================

export function createCalibrationResult(
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
