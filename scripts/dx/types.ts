/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * DxLoop v1 - Pre-Full-Run Quality & Stability Guard
 * Core type definitions for diagnostic loop system
 */

export interface DxLoopConfig {
  profiles: {
    dev: DxProfile;
    stage: DxProfile;
    prod: DxProfile;
  };
  thresholds: DxThresholds;
  autocalibration: {
    enabled: boolean;
    lookback_runs: number;
    percentile_warn: number;
    percentile_fail: number;
    drift_guard_max_delta: number;
  };
}

export interface DxProfile {
  name: string;
  budget_max_usd: number;
  timeout_max_ms: number;
  per_agent_limits: {
    answer_max_usd: number;
    audit_max_ms: number;
  };
}

export interface DxThresholds {
  // P0 - Fixed thresholds (never auto-calibrated)
  p0: {
    pii_hits_max: number;
    license_violations_max: number;
    evidence_missing_rate_max: number;
    hallucination_rate_max: number;
  };
  // P1 - Auto-calibration candidates
  p1: {
    cost_per_item_warn: number;
    cost_per_item_fail: number;
    latency_p95_warn_ms: number;
    latency_p95_fail_ms: number;
    failure_rate_warn: number;
    failure_rate_fail: number;
  };
  // P2 - Auto-calibration candidates
  p2: {
    duplication_rate_warn: number;
    duplication_rate_fail: number;
    coverage_rate_warn: number;
    coverage_rate_fail: number;
    quality_score_warn: number;
    quality_score_fail: number;
  };
}

export interface SessionData {
  session_id: string;
  run_id: string;
  target: string;
  profile: string;
  mode: string;
  dry_run: boolean;
  offline_mode: boolean;
  budget_usd: number;
  cost_usd: number;
  duration_ms: number;
  model_id: string;
  cases_total: number;
  cases_passed: number;
  pass_rate: number;
  mean_score: number;
  p50_ms: number;
  p95_ms: number;
  result: string;
  run_state: string;
  timestamp: string;
}

export interface MetricsAnalysis {
  duplication: {
    rate: number;
    pairs_detected: number;
    semantic_duplicates: number;
  };
  coverage: {
    entity_coverage_rate: number;
    section_coverage_rate: number;
    uncovered_entities: string[];
  };
  evidence: {
    presence_rate: number;
    alignment_mean: number;
    alignment_p95: number;
    missing_evidence_count: number;
  };
  hallucination: {
    rate: number;
    high_risk_cases: number;
    confidence_scores: number[];
  };
  pii_license: {
    pii_hits: number;
    license_violations: number;
    risk_samples: string[];
  };
  cost_latency: {
    cost_per_item: number;
    latency_p50_ms: number;
    latency_p95_ms: number;
    budget_utilization: number;
  };
  failure_retry: {
    failure_rate: number;
    retry_count: number;
    dlq_count: number;
    top_error_classes: string[];
  };
}

export interface AnomalyDetection {
  anomalies: Array<{
    metric: string;
    value: number;
    baseline: number;
    deviation: number;
    severity: "low" | "medium" | "high";
    description: string;
  }>;
  spikes: Array<{
    type: "cost" | "latency" | "failure_rate";
    value: number;
    threshold: number;
    timestamp: string;
  }>;
}

export interface ActionRecommendation {
  issue: string;
  category: "data" | "prompt" | "cache" | "retriever" | "agent" | "system";
  severity: "low" | "medium" | "high" | "critical";
  hypothesis: string;
  action: string;
  expected_impact: string;
  effort_estimate: "low" | "medium" | "high";
}

export interface GatingResult {
  gate_status: "PASS" | "WARN" | "PARTIAL" | "FAIL";
  p0_violations: string[];
  p1_warnings: string[];
  p2_issues: string[];
  reason: string;
  can_proceed: boolean;
}

export interface ThresholdCalibration {
  metric: string;
  current_warn: number;
  current_fail: number;
  suggested_warn: number;
  suggested_fail: number;
  confidence: number;
  lookback_runs: number;
  drift_detected: boolean;
  change_reason: string;
}

export interface DxLoopReport {
  // Header
  report_version: string;
  session_id: string;
  run_id: string;
  timestamp: string;
  profile: string;
  mode: string;
  budget_usd: number;

  // Consistency check
  consistency: {
    passed: boolean;
    issues: string[];
    cases_total: number;
    dry_run_match: boolean;
    mode_match: boolean;
    result_match: boolean;
  };

  // Metrics analysis
  metrics: MetricsAnalysis;

  // Anomaly detection
  anomalies: AnomalyDetection;

  // Threshold calibration
  calibration: {
    enabled: boolean;
    approved: boolean;
    changes: ThresholdCalibration[];
    diff_summary: string;
  };

  // Gating decision
  gating: GatingResult;

  // Action recommendations
  recommendations: ActionRecommendation[];

  // DLQ status
  dlq_status: {
    total_entries: number;
    recent_failures: string[];
    retry_candidates: string[];
  };

  // Summary
  summary: {
    overall_status: "PASS" | "WARN" | "PARTIAL" | "FAIL";
    top_issues: string[];
    next_actions: string[];
    proceed_recommendation: boolean;
  };
}

export interface ConsistencyCheck {
  passed: boolean;
  issues: string[];
  cases_total: number;
  session_report_exists: boolean;
  baseline_report_exists: boolean;
  llm_analysis_exists: boolean;
  dry_run_match: boolean;
  mode_match: boolean;
  result_match: boolean;
}

export interface DlqStatus {
  total_entries: number;
  recent_failures: string[];
  retry_candidates: string[];
}
