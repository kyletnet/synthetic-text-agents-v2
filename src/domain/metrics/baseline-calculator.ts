/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Domain: Baseline Metrics Calculator
 * Pure calculation logic without external dependencies
 */

// ============================================================================
// Value Objects
// ============================================================================

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

export interface HistoricalTrend {
  values: number[];
  timestamps: string[];
  min: number;
  max: number;
  median: number;
  sparkline: string;
}

export interface PercentileResult {
  p50: number;
  p95: number;
}

// ============================================================================
// Pure Calculation Functions
// ============================================================================

/**
 * Calculate percentile value from array of numbers
 */
export function calculatePercentile(
  values: number[],
  percentile: number,
): number {
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
 * Calculate percentiles for an array (p50 and p95)
 */
export function calculatePercentiles(values: number[]): PercentileResult {
  return {
    p50: calculatePercentile(values, 50),
    p95: calculatePercentile(values, 95),
  };
}

/**
 * Calculate median from values
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Generate ASCII sparkline from values
 */
export function generateSparkline(values: number[]): string {
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
 * Create historical trend from values
 */
export function createHistoricalTrend(
  values: number[],
  timestamps: string[],
): HistoricalTrend {
  if (values.length === 0) {
    return {
      values: [],
      timestamps: [],
      min: 0,
      max: 0,
      median: 0,
      sparkline: "",
    };
  }

  return {
    values,
    timestamps,
    min: Math.min(...values),
    max: Math.max(...values),
    median: calculateMedian(values),
    sparkline: generateSparkline(values),
  };
}

/**
 * Calculate cost per item
 */
export function calculateCostPerItem(
  totalCost: number,
  itemCount: number,
): number {
  return itemCount > 0 ? totalCost / itemCount : 0;
}

/**
 * Calculate failure rate from record counts
 */
export function calculateFailureRate(
  failedCount: number,
  totalCount: number,
): number {
  return totalCount > 0 ? failedCount / totalCount : 0;
}

/**
 * Calculate budget utilization
 */
export function calculateBudgetUtilization(
  actualCost: number,
  budgetLimit: number,
): number {
  return budgetLimit > 0 ? actualCost / budgetLimit : 0;
}

/**
 * Calculate overall quality score
 * Weighted average of multiple quality dimensions
 */
export function calculateOverallQualityScore(params: {
  evidencePresenceRate: number;
  coverageScore: number;
  duplicationRate: number;
  hallucinationRate: number;
}): number {
  const {
    evidencePresenceRate,
    coverageScore,
    duplicationRate,
    hallucinationRate,
  } = params;

  // Weights for each dimension
  const weights = {
    evidence: 0.3,
    coverage: 0.3,
    duplication: 0.2,
    hallucination: 0.2,
  };

  // Calculate weighted score (normalize deductions)
  const evidenceScore = evidencePresenceRate;
  const coverageScoreNormalized = coverageScore;
  const duplicationDeduction = 1 - duplicationRate;
  const hallucinationDeduction = 1 - hallucinationRate;

  return (
    weights.evidence * evidenceScore +
    weights.coverage * coverageScoreNormalized +
    weights.duplication * duplicationDeduction +
    weights.hallucination * hallucinationDeduction
  );
}

/**
 * Determine recommendation level based on quality score and alerts
 */
export function determineRecommendationLevel(
  qualityScore: number,
  totalAlerts: number,
  hasP0Violations: boolean,
): "green" | "yellow" | "red" {
  if (hasP0Violations || qualityScore < 0.5) {
    return "red";
  }
  if (totalAlerts > 2 || qualityScore < 0.7) {
    return "yellow";
  }
  return "green";
}

/**
 * Calculate hash for integrity checking
 */
export function calculateContentHash(content: string): string {
  // Simple hash function (in real implementation, use crypto)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
