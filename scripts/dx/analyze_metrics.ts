/**
 * DxLoop v1 - Metrics Analyzer
 * Re-calculates and summarizes v1.5 metrics: duplication, qtype, coverage, evidence, hallucination, PII/license
 */

import { promises as fs } from "fs";
import { SessionCollection, collectSessionData } from "./collect_session.js";
import { MetricsAnalysis } from "./types.js";

/**
 * Analyze duplication metrics from baseline report
 */
function analyzeDuplication(baselineData: any): MetricsAnalysis["duplication"] {
  if (!baselineData) {
    return {
      rate: 0,
      pairs_detected: 0,
      semantic_duplicates: 0,
    };
  }

  return {
    rate: baselineData.duplication_metrics?.rate || 0,
    pairs_detected: baselineData.duplication_metrics?.pairs_detected || 0,
    semantic_duplicates:
      baselineData.duplication_metrics?.semantic_duplicates || 0,
  };
}

/**
 * Analyze coverage metrics
 */
function analyzeCoverage(baselineData: any): MetricsAnalysis["coverage"] {
  if (!baselineData) {
    return {
      entity_coverage_rate: 0,
      section_coverage_rate: 0,
      uncovered_entities: [],
    };
  }

  return {
    entity_coverage_rate:
      baselineData.coverage_metrics?.entity_coverage_rate || 0,
    section_coverage_rate:
      baselineData.coverage_metrics?.section_coverage_rate || 0,
    uncovered_entities: baselineData.coverage_metrics?.uncovered_entities || [],
  };
}

/**
 * Analyze evidence quality metrics
 */
function analyzeEvidence(baselineData: any): MetricsAnalysis["evidence"] {
  if (!baselineData) {
    return {
      presence_rate: 0,
      alignment_mean: 0,
      alignment_p95: 0,
      missing_evidence_count: 0,
    };
  }

  return {
    presence_rate: baselineData.evidence_metrics?.presence_rate || 0,
    alignment_mean: baselineData.evidence_metrics?.alignment_mean || 0,
    alignment_p95: baselineData.evidence_metrics?.alignment_p95 || 0,
    missing_evidence_count:
      baselineData.evidence_metrics?.missing_evidence_count || 0,
  };
}

/**
 * Analyze hallucination detection metrics
 */
function analyzeHallucination(
  baselineData: any,
): MetricsAnalysis["hallucination"] {
  if (!baselineData) {
    return {
      rate: 0,
      high_risk_cases: 0,
      confidence_scores: [],
    };
  }

  return {
    rate: baselineData.hallucination_metrics?.rate || 0,
    high_risk_cases: baselineData.hallucination_metrics?.high_risk_cases || 0,
    confidence_scores:
      baselineData.hallucination_metrics?.confidence_scores || [],
  };
}

/**
 * Analyze PII and license metrics
 */
function analyzePiiLicense(baselineData: any): MetricsAnalysis["pii_license"] {
  if (!baselineData) {
    return {
      pii_hits: 0,
      license_violations: 0,
      risk_samples: [],
    };
  }

  return {
    pii_hits: baselineData.pii_license_metrics?.pii_hits || 0,
    license_violations:
      baselineData.pii_license_metrics?.license_violations || 0,
    risk_samples: baselineData.pii_license_metrics?.risk_samples || [],
  };
}

/**
 * Analyze cost and latency metrics
 */
function analyzeCostLatency(
  sessionData: any,
  llmData: any,
): MetricsAnalysis["cost_latency"] {
  const costPerItem =
    (sessionData?.cost_usd || 0) / Math.max(sessionData?.cases_total || 1, 1);
  const budgetUtilization =
    (sessionData?.cost_usd || 0) / Math.max(sessionData?.budget_usd || 1, 1);

  return {
    cost_per_item: costPerItem,
    latency_p50_ms: sessionData?.p50_ms || llmData?.p50_latency_ms || 0,
    latency_p95_ms: sessionData?.p95_ms || llmData?.p95_latency_ms || 0,
    budget_utilization: Math.min(budgetUtilization, 1.0),
  };
}

/**
 * Analyze failure and retry metrics
 */
async function analyzeFailureRetry(
  sessionData: any,
): Promise<MetricsAnalysis["failure_retry"]> {
  const failureRate = sessionData ? 1.0 - (sessionData.pass_rate || 0) : 0;

  // Check DLQ for retry information
  let dlqCount = 0;
  let retryCount = 0;
  const topErrorClasses: string[] = [];

  try {
    const dlqDir = "DLQ";
    const dlqEntries = await fs.readdir(dlqDir);
    dlqCount = dlqEntries.length;

    // Analyze DLQ entries for error patterns
    for (const entry of dlqEntries.slice(0, 10)) {
      // Limit to first 10 for performance
      try {
        const entryPath = `${dlqDir}/${entry}`;
        const stats = await fs.stat(entryPath);
        if (stats.isDirectory()) {
          const stateHistoryPath = `${entryPath}/state_history`;
          try {
            const stateHistory = await fs.readFile(stateHistoryPath, "utf-8");
            const lines = stateHistory.split("\n");
            for (const line of lines) {
              if (line.includes("retry")) {
                retryCount++;
              }
              // Extract error class from reason
              const reasonMatch = line.match(/\(([^)]+)\)$/);
              if (reasonMatch) {
                const reason = reasonMatch[1];
                if (
                  !topErrorClasses.includes(reason) &&
                  topErrorClasses.length < 5
                ) {
                  topErrorClasses.push(reason);
                }
              }
            }
          } catch {
            // State history not available
          }
        }
      } catch {
        // Entry not accessible
      }
    }
  } catch {
    // DLQ directory not accessible
  }

  return {
    failure_rate: failureRate,
    retry_count: retryCount,
    dlq_count: dlqCount,
    top_error_classes: topErrorClasses,
  };
}

/**
 * Comprehensive metrics analysis
 */
export async function analyzeMetrics(): Promise<MetricsAnalysis> {
  try {
    console.log("Starting comprehensive metrics analysis...");

    // Collect session data
    const collection = await collectSessionData();

    // Analyze each metrics category
    const duplication = analyzeDuplication(collection.baseline_report);
    const coverage = analyzeCoverage(collection.baseline_report);
    const evidence = analyzeEvidence(collection.baseline_report);
    const hallucination = analyzeHallucination(collection.baseline_report);
    const pii_license = analyzePiiLicense(collection.baseline_report);
    const cost_latency = analyzeCostLatency(
      collection.session_report,
      collection.llm_analysis,
    );
    const failure_retry = await analyzeFailureRetry(collection.session_report);

    const analysis: MetricsAnalysis = {
      duplication,
      coverage,
      evidence,
      hallucination,
      pii_license,
      cost_latency,
      failure_retry,
    };

    console.log("Metrics analysis completed:", {
      duplication_rate: duplication.rate,
      coverage_entity: coverage.entity_coverage_rate,
      evidence_presence: evidence.presence_rate,
      hallucination_rate: hallucination.rate,
      pii_hits: pii_license.pii_hits,
      cost_per_item: cost_latency.cost_per_item,
      failure_rate: failure_retry.failure_rate,
    });

    return analysis;
  } catch (error) {
    console.error("Error during metrics analysis:", error);
    throw error;
  }
}

/**
 * Generate summary statistics from metrics
 */
export function summarizeMetrics(metrics: MetricsAnalysis): {
  critical_issues: string[];
  warning_issues: string[];
  info_items: string[];
  overall_health_score: number;
} {
  const critical_issues: string[] = [];
  const warning_issues: string[] = [];
  const info_items: string[] = [];

  // Critical issues (P0 level)
  if (metrics.pii_license.pii_hits > 0) {
    critical_issues.push(`PII detected: ${metrics.pii_license.pii_hits} hits`);
  }
  if (metrics.pii_license.license_violations > 2) {
    critical_issues.push(
      `License violations: ${metrics.pii_license.license_violations} detected`,
    );
  }
  if (metrics.evidence.presence_rate < 0.7) {
    critical_issues.push(
      `Low evidence presence: ${(metrics.evidence.presence_rate * 100).toFixed(
        1,
      )}%`,
    );
  }
  if (metrics.hallucination.rate > 0.05) {
    critical_issues.push(
      `High hallucination rate: ${(metrics.hallucination.rate * 100).toFixed(
        1,
      )}%`,
    );
  }

  // Warning issues (P1 level)
  if (metrics.cost_latency.cost_per_item > 0.08) {
    warning_issues.push(
      `High cost per item: $${metrics.cost_latency.cost_per_item.toFixed(3)}`,
    );
  }
  if (metrics.cost_latency.latency_p95_ms > 4000) {
    warning_issues.push(
      `High P95 latency: ${metrics.cost_latency.latency_p95_ms}ms`,
    );
  }
  if (metrics.failure_retry.failure_rate > 0.1) {
    warning_issues.push(
      `High failure rate: ${(metrics.failure_retry.failure_rate * 100).toFixed(
        1,
      )}%`,
    );
  }

  // Informational items (P2 level)
  if (metrics.duplication.rate > 0.1) {
    info_items.push(
      `Moderate duplication: ${(metrics.duplication.rate * 100).toFixed(1)}%`,
    );
  }
  if (metrics.coverage.entity_coverage_rate < 0.7) {
    info_items.push(
      `Low entity coverage: ${(
        metrics.coverage.entity_coverage_rate * 100
      ).toFixed(1)}%`,
    );
  }
  if (metrics.failure_retry.dlq_count > 0) {
    info_items.push(
      `DLQ entries: ${metrics.failure_retry.dlq_count} failed runs`,
    );
  }

  // Calculate overall health score (0-1)
  let healthScore = 1.0;

  // Deduct for critical issues
  healthScore -= critical_issues.length * 0.25;

  // Deduct for warning issues
  healthScore -= warning_issues.length * 0.15;

  // Deduct for info items
  healthScore -= info_items.length * 0.05;

  // Ensure non-negative
  healthScore = Math.max(healthScore, 0);

  return {
    critical_issues,
    warning_issues,
    info_items,
    overall_health_score: healthScore,
  };
}

/**
 * CLI interface for metrics analysis
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === "analyze") {
    analyzeMetrics()
      .then((metrics) => {
        const summary = summarizeMetrics(metrics);

        console.log("Metrics Analysis Result:");
        console.log(
          JSON.stringify(
            {
              metrics,
              summary,
            },
            null,
            2,
          ),
        );

        // Exit with appropriate code based on health
        if (summary.critical_issues.length > 0) {
          process.exit(1);
        } else if (summary.warning_issues.length > 3) {
          process.exit(2);
        } else {
          process.exit(0);
        }
      })
      .catch((error) => {
        console.error("Metrics analysis failed:", error);
        process.exit(1);
      });
  } else {
    console.log("Usage: node analyze_metrics.js analyze");
    process.exit(1);
  }
}
