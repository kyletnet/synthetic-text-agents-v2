/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * DxLoop v1 - Action Recommendations
 * Maps issues to actionable recommendations with cause hypotheses and impact estimates
 */

import {
  MetricsAnalysis,
  AnomalyDetection,
  ActionRecommendation,
} from "./types.js";

/**
 * Recommendation rules database
 */
const RECOMMENDATION_RULES = {
  // Data Quality Issues
  high_duplication: {
    category: "data" as const,
    severity: "medium" as const,
    hypothesis:
      "Input data contains repetitive patterns or insufficient diversity",
    action:
      "Review data source for duplicates, increase sampling diversity, or implement deduplication preprocessing",
    expected_impact: "Reduce redundant processing and improve output variety",
    effort_estimate: "medium" as const,
  },

  low_entity_coverage: {
    category: "data" as const,
    severity: "medium" as const,
    hypothesis:
      "Dataset lacks comprehensive coverage of domain entities or key concepts",
    action:
      "Expand training data to include missing entities, review domain coverage requirements",
    expected_impact: "Improve comprehensiveness and reduce knowledge gaps",
    effort_estimate: "high" as const,
  },

  low_section_coverage: {
    category: "retriever" as const,
    severity: "medium" as const,
    hypothesis:
      "Retrieval system not accessing all relevant document sections or contexts",
    action:
      "Tune retrieval parameters, expand chunk overlap, or improve indexing strategy",
    expected_impact: "Better context utilization and more complete answers",
    effort_estimate: "medium" as const,
  },

  // Evidence and Hallucination Issues
  missing_evidence: {
    category: "retriever" as const,
    severity: "high" as const,
    hypothesis:
      "Retrieval system failing to find relevant supporting evidence for responses",
    action:
      "Improve retrieval recall, expand knowledge base, or tune similarity thresholds",
    expected_impact: "Reduce hallucinations and improve factual accuracy",
    effort_estimate: "high" as const,
  },

  poor_evidence_alignment: {
    category: "agent" as const,
    severity: "medium" as const,
    hypothesis:
      "Agent not effectively utilizing retrieved evidence in response generation",
    action:
      "Improve evidence integration prompts, add citation requirements, or enhance context utilization",
    expected_impact: "Better evidence utilization and more grounded responses",
    effort_estimate: "medium" as const,
  },

  high_hallucination: {
    category: "prompt" as const,
    severity: "critical" as const,
    hypothesis:
      "Model generating information not supported by provided context or knowledge",
    action:
      "Strengthen grounding instructions, add factual verification steps, or implement confidence thresholds",
    expected_impact: "Significantly reduce false information generation",
    effort_estimate: "high" as const,
  },

  // Cost and Performance Issues
  high_cost_per_item: {
    category: "agent" as const,
    severity: "medium" as const,
    hypothesis:
      "Inefficient token usage, oversized context windows, or unnecessary API calls",
    action:
      "Optimize prompt length, implement response caching, or use smaller models for simple tasks",
    expected_impact: "Reduce operational costs while maintaining quality",
    effort_estimate: "medium" as const,
  },

  high_latency: {
    category: "system" as const,
    severity: "medium" as const,
    hypothesis:
      "Network bottlenecks, sequential processing, or resource constraints",
    action:
      "Implement parallel processing, optimize API calls, or upgrade infrastructure",
    expected_impact: "Faster response times and better user experience",
    effort_estimate: "high" as const,
  },

  budget_overrun: {
    category: "system" as const,
    severity: "high" as const,
    hypothesis:
      "Cost controls insufficient or usage patterns exceeding estimates",
    action:
      "Implement stricter budget controls, add early warning systems, or optimize expensive operations",
    expected_impact: "Prevent cost overruns and improve budget predictability",
    effort_estimate: "medium" as const,
  },

  // Failure and Reliability Issues
  high_failure_rate: {
    category: "system" as const,
    severity: "high" as const,
    hypothesis: "System instability, API rate limits, or configuration issues",
    action:
      "Implement robust retry logic, add circuit breakers, or review system dependencies",
    expected_impact: "Improve system reliability and reduce failure cascades",
    effort_estimate: "high" as const,
  },

  dlq_accumulation: {
    category: "system" as const,
    severity: "medium" as const,
    hypothesis:
      "Persistent failures not being resolved or inadequate error handling",
    action:
      "Review DLQ processing logic, improve error classification, or add automated recovery",
    expected_impact: "Reduce manual intervention and improve fault tolerance",
    effort_estimate: "medium" as const,
  },

  // Security and Compliance Issues
  pii_detected: {
    category: "data" as const,
    severity: "critical" as const,
    hypothesis:
      "Input data contains personal identifiable information not properly sanitized",
    action:
      "Implement PII detection and redaction pipeline, review data sources for sensitive content",
    expected_impact: "Ensure compliance and protect user privacy",
    effort_estimate: "high" as const,
  },

  license_violations: {
    category: "data" as const,
    severity: "critical" as const,
    hypothesis:
      "Training or reference data may contain copyrighted or restricted content",
    action:
      "Audit data sources for licensing compliance, implement content filtering, or seek proper permissions",
    expected_impact: "Avoid legal risks and ensure compliant operations",
    effort_estimate: "high" as const,
  },

  // Cache and Optimization Issues
  cache_miss_pattern: {
    category: "cache" as const,
    severity: "low" as const,
    hypothesis:
      "Caching strategy not aligned with usage patterns or cache size insufficient",
    action:
      "Analyze cache hit patterns, optimize cache keys, or increase cache capacity",
    expected_impact: "Reduce redundant processing and improve response times",
    effort_estimate: "low" as const,
  },
};

/**
 * Generate issue-specific recommendations
 */
function generateIssueRecommendations(
  metrics: MetricsAnalysis,
  anomalies: AnomalyDetection,
): ActionRecommendation[] {
  const recommendations: ActionRecommendation[] = [];

  // Check duplication issues
  if (metrics.duplication.rate > 0.15) {
    recommendations.push({
      issue: `High duplication rate: ${(metrics.duplication.rate * 100).toFixed(
        1,
      )}%`,
      ...RECOMMENDATION_RULES.high_duplication,
    });
  }

  // Check coverage issues
  if (metrics.coverage.entity_coverage_rate < 0.6) {
    recommendations.push({
      issue: `Low entity coverage: ${(
        metrics.coverage.entity_coverage_rate * 100
      ).toFixed(1)}%`,
      ...RECOMMENDATION_RULES.low_entity_coverage,
    });
  }

  if (metrics.coverage.section_coverage_rate < 0.7) {
    recommendations.push({
      issue: `Low section coverage: ${(
        metrics.coverage.section_coverage_rate * 100
      ).toFixed(1)}%`,
      ...RECOMMENDATION_RULES.low_section_coverage,
    });
  }

  // Check evidence issues
  if (metrics.evidence.presence_rate < 0.8) {
    recommendations.push({
      issue: `Missing evidence: ${(
        metrics.evidence.presence_rate * 100
      ).toFixed(1)}% presence rate`,
      ...RECOMMENDATION_RULES.missing_evidence,
    });
  }

  if (metrics.evidence.alignment_mean < 0.5) {
    recommendations.push({
      issue: `Poor evidence alignment: ${(
        metrics.evidence.alignment_mean * 100
      ).toFixed(1)}% mean alignment`,
      ...RECOMMENDATION_RULES.poor_evidence_alignment,
    });
  }

  // Check hallucination issues
  if (metrics.hallucination.rate > 0.05) {
    recommendations.push({
      issue: `High hallucination rate: ${(
        metrics.hallucination.rate * 100
      ).toFixed(1)}%`,
      ...RECOMMENDATION_RULES.high_hallucination,
    });
  }

  // Check PII/license issues
  if (metrics.pii_license.pii_hits > 0) {
    recommendations.push({
      issue: `PII detected: ${metrics.pii_license.pii_hits} instances`,
      ...RECOMMENDATION_RULES.pii_detected,
    });
  }

  if (metrics.pii_license.license_violations > 2) {
    recommendations.push({
      issue: `License violations: ${metrics.pii_license.license_violations} instances`,
      ...RECOMMENDATION_RULES.license_violations,
    });
  }

  // Check cost/latency issues
  if (metrics.cost_latency.cost_per_item > 0.1) {
    recommendations.push({
      issue: `High cost per item: $${metrics.cost_latency.cost_per_item.toFixed(
        3,
      )}`,
      ...RECOMMENDATION_RULES.high_cost_per_item,
    });
  }

  if (metrics.cost_latency.latency_p95_ms > 5000) {
    recommendations.push({
      issue: `High P95 latency: ${metrics.cost_latency.latency_p95_ms}ms`,
      ...RECOMMENDATION_RULES.high_latency,
    });
  }

  if (metrics.cost_latency.budget_utilization > 0.95) {
    recommendations.push({
      issue: `Budget near limit: ${(
        metrics.cost_latency.budget_utilization * 100
      ).toFixed(1)}% utilized`,
      ...RECOMMENDATION_RULES.budget_overrun,
    });
  }

  // Check failure/retry issues
  if (metrics.failure_retry.failure_rate > 0.25) {
    recommendations.push({
      issue: `High failure rate: ${(
        metrics.failure_retry.failure_rate * 100
      ).toFixed(1)}%`,
      ...RECOMMENDATION_RULES.high_failure_rate,
    });
  }

  if (metrics.failure_retry.dlq_count > 5) {
    recommendations.push({
      issue: `DLQ accumulation: ${metrics.failure_retry.dlq_count} failed runs`,
      ...RECOMMENDATION_RULES.dlq_accumulation,
    });
  }

  // Add anomaly-based recommendations
  for (const anomaly of anomalies.anomalies) {
    if (anomaly.severity === "high") {
      let rule: (typeof RECOMMENDATION_RULES)[keyof typeof RECOMMENDATION_RULES] =
        RECOMMENDATION_RULES.cache_miss_pattern; // Default

      if (anomaly.metric.includes("cost")) {
        rule = RECOMMENDATION_RULES.high_cost_per_item;
      } else if (anomaly.metric.includes("latency")) {
        rule = RECOMMENDATION_RULES.high_latency;
      } else if (anomaly.metric.includes("failure")) {
        rule = RECOMMENDATION_RULES.high_failure_rate;
      }

      recommendations.push({
        issue: `Anomaly detected: ${anomaly.description}`,
        ...rule,
        severity: "high" as const,
      });
    }
  }

  // Add spike-based recommendations
  for (const spike of anomalies.spikes) {
    let rule: (typeof RECOMMENDATION_RULES)[keyof typeof RECOMMENDATION_RULES] =
      RECOMMENDATION_RULES.cache_miss_pattern; // Default

    switch (spike.type) {
      case "cost":
        rule = RECOMMENDATION_RULES.high_cost_per_item;
        break;
      case "latency":
        rule = RECOMMENDATION_RULES.high_latency;
        break;
      case "failure_rate":
        rule = RECOMMENDATION_RULES.high_failure_rate;
        break;
    }

    recommendations.push({
      issue: `${spike.type} spike: ${spike.value.toFixed(
        3,
      )} (threshold: ${spike.threshold.toFixed(3)})`,
      ...rule,
      severity: "high" as const,
    });
  }

  return recommendations;
}

/**
 * Prioritize recommendations by severity and impact
 */
function prioritizeRecommendations(
  recommendations: ActionRecommendation[],
): ActionRecommendation[] {
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const effortOrder = { low: 0, medium: 1, high: 2 };

  return recommendations.sort((a, b) => {
    // First by severity
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;

    // Then by effort (prefer lower effort for same severity)
    return effortOrder[a.effort_estimate] - effortOrder[b.effort_estimate];
  });
}

/**
 * Generate comprehensive action recommendations
 */
export function recommendActions(
  metrics: MetricsAnalysis,
  anomalies: AnomalyDetection,
): ActionRecommendation[] {
  try {
    console.log("Generating action recommendations...");

    // Generate issue-specific recommendations
    const recommendations = generateIssueRecommendations(metrics, anomalies);

    // Remove duplicates (same issue text)
    const uniqueRecommendations = recommendations.filter(
      (rec, index, arr) =>
        arr.findIndex((r) => r.issue === rec.issue) === index,
    );

    // Prioritize by severity and effort
    const prioritizedRecommendations = prioritizeRecommendations(
      uniqueRecommendations,
    );

    console.log("Action recommendations generated:", {
      total_recommendations: prioritizedRecommendations.length,
      critical: prioritizedRecommendations.filter(
        (r) => r.severity === "critical",
      ).length,
      high: prioritizedRecommendations.filter((r) => r.severity === "high")
        .length,
      medium: prioritizedRecommendations.filter((r) => r.severity === "medium")
        .length,
      low: prioritizedRecommendations.filter((r) => r.severity === "low")
        .length,
    });

    return prioritizedRecommendations;
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return [];
  }
}

/**
 * Generate executive summary of recommendations
 */
export function summarizeRecommendations(
  recommendations: ActionRecommendation[],
): {
  priority_actions: string[];
  effort_breakdown: { [key: string]: number };
  category_breakdown: { [key: string]: number };
  quick_wins: ActionRecommendation[];
  major_initiatives: ActionRecommendation[];
} {
  const priority_actions = recommendations
    .filter((r) => r.severity === "critical" || r.severity === "high")
    .slice(0, 5)
    .map((r) => `${r.category.toUpperCase()}: ${r.action}`);

  const effort_breakdown = recommendations.reduce(
    (acc, rec) => {
      acc[rec.effort_estimate] = (acc[rec.effort_estimate] || 0) + 1;
      return acc;
    },
    {} as { [key: string]: number },
  );

  const category_breakdown = recommendations.reduce(
    (acc, rec) => {
      acc[rec.category] = (acc[rec.category] || 0) + 1;
      return acc;
    },
    {} as { [key: string]: number },
  );

  const quick_wins = recommendations.filter(
    (r) =>
      r.effort_estimate === "low" &&
      (r.severity === "medium" || r.severity === "high"),
  );

  const major_initiatives = recommendations.filter(
    (r) =>
      r.effort_estimate === "high" &&
      (r.severity === "critical" || r.severity === "high"),
  );

  return {
    priority_actions,
    effort_breakdown,
    category_breakdown,
    quick_wins,
    major_initiatives,
  };
}

/**
 * CLI interface for action recommendations
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === "recommend") {
    // Mock data for testing
    const mockMetrics: MetricsAnalysis = {
      duplication: { rate: 0.18, pairs_detected: 5, semantic_duplicates: 3 },
      coverage: {
        entity_coverage_rate: 0.55,
        section_coverage_rate: 0.68,
        uncovered_entities: ["concept_a", "concept_b"],
      },
      evidence: {
        presence_rate: 0.75,
        alignment_mean: 0.45,
        alignment_p95: 0.3,
        missing_evidence_count: 8,
      },
      hallucination: {
        rate: 0.08,
        high_risk_cases: 2,
        confidence_scores: [0.6, 0.7, 0.5],
      },
      pii_license: {
        pii_hits: 1,
        license_violations: 3,
        risk_samples: ["email@example.com"],
      },
      cost_latency: {
        cost_per_item: 0.12,
        latency_p50_ms: 2000,
        latency_p95_ms: 6000,
        budget_utilization: 0.98,
      },
      failure_retry: {
        failure_rate: 0.3,
        retry_count: 5,
        dlq_count: 8,
        top_error_classes: ["timeout", "rate_limit"],
      },
    };

    const mockAnomalies: AnomalyDetection = {
      anomalies: [
        {
          metric: "cost_per_item",
          value: 0.12,
          baseline: 0.06,
          deviation: 2.5,
          severity: "high" as const,
          description: "Cost spike detected: 100% above baseline",
        },
      ],
      spikes: [
        {
          type: "latency" as const,
          value: 6000,
          threshold: 4000,
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const recommendations = recommendActions(mockMetrics, mockAnomalies);
    const summary = summarizeRecommendations(recommendations);

    console.log("Action Recommendations Result:");
    console.log(
      JSON.stringify(
        {
          recommendations,
          summary,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("Usage: node recommend_actions.js recommend");
    process.exit(1);
  }
}
