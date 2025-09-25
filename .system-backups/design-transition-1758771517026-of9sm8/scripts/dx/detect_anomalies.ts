/**
 * DxLoop v1 - Anomaly Detection
 * Detects metric spikes, drift patterns, and statistical outliers using historical data
 */

import { promises as fs } from "fs";
import { glob } from "glob";
import { MetricsAnalysis, AnomalyDetection } from "./types.js";

interface HistoricalMetric {
  timestamp: string;
  session_id: string;
  value: number;
  context: {
    target: string;
    profile: string;
    mode: string;
  };
}

/**
 * Load historical metric values from session reports
 */
async function loadHistoricalMetrics(
  metricName: string,
  lookbackDays: number = 7,
): Promise<HistoricalMetric[]> {
  const metrics: HistoricalMetric[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  try {
    // Find session report history files
    const historyFiles = await glob("reports/history/*/session_report.md");

    for (const filePath of historyFiles) {
      try {
        // Extract timestamp from path
        const timestampMatch = filePath.match(/history\/(\d{8}_\d{6})/);
        if (!timestampMatch) continue;

        const timestamp = timestampMatch[1];
        const date = new Date(
          parseInt(timestamp.substr(0, 4)), // year
          parseInt(timestamp.substr(4, 2)) - 1, // month (0-indexed)
          parseInt(timestamp.substr(6, 2)), // day
          parseInt(timestamp.substr(9, 2)), // hour
          parseInt(timestamp.substr(11, 2)), // minute
          parseInt(timestamp.substr(13, 2)), // second
        );

        // Skip if too old
        if (date < cutoffDate) continue;

        const content = await fs.readFile(filePath, "utf-8");
        const summaryMatch = content.match(/```\n(SESSION_ID:.*?)\n```/s);
        if (!summaryMatch) continue;

        const summaryLines = summaryMatch[1].split("\n");
        const data: any = {};

        for (const line of summaryLines) {
          const [key, ...valueParts] = line.split(": ");
          if (key && valueParts.length > 0) {
            data[key.toLowerCase()] = valueParts.join(": ").trim();
          }
        }

        // Extract specific metric value
        let value: number | null = null;
        switch (metricName) {
          case "cost_per_item":
            const cost = parseFloat(data.cost_usd || "0");
            const cases = parseInt(data.cases_total || "1");
            value = cost / Math.max(cases, 1);
            break;
          case "latency_p95_ms":
            value = parseInt(data.p95_ms || "0");
            break;
          case "failure_rate":
            const passRate = parseFloat(data.pass_rate || "0");
            value = 1.0 - passRate / 100;
            break;
          case "budget_utilization":
            const actualCost = parseFloat(data.cost_usd || "0");
            const budget = parseFloat(data.budget_usd || "1");
            value = actualCost / Math.max(budget, 1);
            break;
          case "duration_minutes":
            value = parseInt(data.duration_ms || "0") / 60000;
            break;
        }

        if (value !== null && !isNaN(value) && value >= 0) {
          metrics.push({
            timestamp: date.toISOString(),
            session_id: data.session_id || "",
            value,
            context: {
              target: data.target || "",
              profile: data.profile || "",
              mode: data.mode || "",
            },
          });
        }
      } catch (error) {
        console.warn(
          `Could not parse historical metric from ${filePath}:`,
          error,
        );
      }
    }

    // Sort by timestamp (newest first)
    metrics.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    console.log(`Loaded ${metrics.length} historical values for ${metricName}`);
    return metrics;
  } catch (error) {
    console.error(`Error loading historical metrics for ${metricName}:`, error);
    return [];
  }
}

/**
 * Calculate statistical measures for anomaly detection
 */
function calculateStatistics(values: number[]): {
  mean: number;
  median: number;
  stdDev: number;
  q1: number;
  q3: number;
  iqr: number;
  min: number;
  max: number;
} {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      min: 0,
      max: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  // Mean
  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  // Median
  const median =
    n % 2 === 0
      ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
      : sorted[Math.floor(n / 2)];

  // Standard deviation
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // Quartiles
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;

  return {
    mean,
    median,
    stdDev,
    q1,
    q3,
    iqr,
    min: sorted[0],
    max: sorted[n - 1],
  };
}

/**
 * Detect anomalies using Z-score and IQR methods
 */
function detectMetricAnomalies(
  currentValue: number,
  historicalMetrics: HistoricalMetric[],
  metricName: string,
): Array<{
  metric: string;
  value: number;
  baseline: number;
  deviation: number;
  severity: "low" | "medium" | "high";
  description: string;
}> {
  const anomalies: any[] = [];

  if (historicalMetrics.length < 3) {
    return anomalies;
  }

  const values = historicalMetrics.map((m) => m.value);
  const stats = calculateStatistics(values);

  // Z-score anomaly detection (statistical outliers)
  if (stats.stdDev > 0) {
    const zScore = Math.abs(currentValue - stats.mean) / stats.stdDev;

    if (zScore > 3) {
      anomalies.push({
        metric: metricName,
        value: currentValue,
        baseline: stats.mean,
        deviation: zScore,
        severity: "high" as const,
        description: `Extreme statistical outlier (Z-score: ${zScore.toFixed(2)})`,
      });
    } else if (zScore > 2) {
      anomalies.push({
        metric: metricName,
        value: currentValue,
        baseline: stats.mean,
        deviation: zScore,
        severity: "medium" as const,
        description: `Statistical outlier (Z-score: ${zScore.toFixed(2)})`,
      });
    }
  }

  // IQR anomaly detection (robust outliers)
  if (stats.iqr > 0) {
    const lowerBound = stats.q1 - 1.5 * stats.iqr;
    const upperBound = stats.q3 + 1.5 * stats.iqr;

    if (currentValue < lowerBound || currentValue > upperBound) {
      const severity =
        currentValue < stats.q1 - 3 * stats.iqr ||
        currentValue > stats.q3 + 3 * stats.iqr
          ? ("high" as const)
          : ("medium" as const);

      anomalies.push({
        metric: metricName,
        value: currentValue,
        baseline: stats.median,
        deviation: Math.min(
          Math.abs(currentValue - lowerBound),
          Math.abs(currentValue - upperBound),
        ),
        severity,
        description: `IQR outlier (outside ${lowerBound.toFixed(3)}-${upperBound.toFixed(3)} range)`,
      });
    }
  }

  // Trend-based anomaly detection (recent vs historical)
  if (historicalMetrics.length >= 6) {
    const recent = historicalMetrics.slice(0, 3).map((m) => m.value);
    const historical = historicalMetrics.slice(3).map((m) => m.value);

    const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const historicalMean =
      historical.reduce((a, b) => a + b, 0) / historical.length;

    if (historicalMean > 0) {
      const trendChange =
        Math.abs(recentMean - historicalMean) / historicalMean;

      if (trendChange > 0.5) {
        // 50% change
        anomalies.push({
          metric: metricName,
          value: currentValue,
          baseline: historicalMean,
          deviation: trendChange,
          severity: trendChange > 1.0 ? ("high" as const) : ("medium" as const),
          description: `Significant trend change: ${(trendChange * 100).toFixed(1)}% shift from historical baseline`,
        });
      }
    }
  }

  return anomalies;
}

/**
 * Detect specific spike patterns
 */
function detectSpikes(
  metrics: MetricsAnalysis,
  historicalData: { [key: string]: HistoricalMetric[] },
): Array<{
  type: "cost" | "latency" | "failure_rate";
  value: number;
  threshold: number;
  timestamp: string;
}> {
  const spikes: any[] = [];
  const timestamp = new Date().toISOString();

  // Cost spikes
  const costHistory = historicalData["cost_per_item"] || [];
  if (costHistory.length > 0) {
    const recentCostMean =
      costHistory.slice(0, 5).reduce((sum, m) => sum + m.value, 0) /
      Math.min(5, costHistory.length);
    const costThreshold = recentCostMean * 2; // 100% increase threshold

    if (metrics.cost_latency.cost_per_item > costThreshold) {
      spikes.push({
        type: "cost" as const,
        value: metrics.cost_latency.cost_per_item,
        threshold: costThreshold,
        timestamp,
      });
    }
  }

  // Latency spikes
  const latencyHistory = historicalData["latency_p95_ms"] || [];
  if (latencyHistory.length > 0) {
    const recentLatencyMean =
      latencyHistory.slice(0, 5).reduce((sum, m) => sum + m.value, 0) /
      Math.min(5, latencyHistory.length);
    const latencyThreshold = recentLatencyMean * 1.5; // 50% increase threshold

    if (metrics.cost_latency.latency_p95_ms > latencyThreshold) {
      spikes.push({
        type: "latency" as const,
        value: metrics.cost_latency.latency_p95_ms,
        threshold: latencyThreshold,
        timestamp,
      });
    }
  }

  // Failure rate spikes
  const failureHistory = historicalData["failure_rate"] || [];
  if (failureHistory.length > 0) {
    const recentFailureMean =
      failureHistory.slice(0, 5).reduce((sum, m) => sum + m.value, 0) /
      Math.min(5, failureHistory.length);
    const failureThreshold = Math.max(recentFailureMean * 2, 0.05); // Double or 5% minimum

    if (metrics.failure_retry.failure_rate > failureThreshold) {
      spikes.push({
        type: "failure_rate" as const,
        value: metrics.failure_retry.failure_rate,
        threshold: failureThreshold,
        timestamp,
      });
    }
  }

  return spikes;
}

/**
 * Comprehensive anomaly detection
 */
export async function detectAnomalies(
  metrics: MetricsAnalysis,
): Promise<AnomalyDetection> {
  try {
    console.log("Starting anomaly detection...");

    const anomalies: any[] = [];
    const lookbackDays = 7;

    // Load historical data for key metrics
    const metricNames = [
      "cost_per_item",
      "latency_p95_ms",
      "failure_rate",
      "budget_utilization",
    ];
    const historicalData: { [key: string]: HistoricalMetric[] } = {};

    for (const metricName of metricNames) {
      historicalData[metricName] = await loadHistoricalMetrics(
        metricName,
        lookbackDays,
      );
    }

    // Detect anomalies for each metric
    const costAnomalies = detectMetricAnomalies(
      metrics.cost_latency.cost_per_item,
      historicalData["cost_per_item"],
      "cost_per_item",
    );
    anomalies.push(...costAnomalies);

    const latencyAnomalies = detectMetricAnomalies(
      metrics.cost_latency.latency_p95_ms,
      historicalData["latency_p95_ms"],
      "latency_p95_ms",
    );
    anomalies.push(...latencyAnomalies);

    const failureAnomalies = detectMetricAnomalies(
      metrics.failure_retry.failure_rate,
      historicalData["failure_rate"],
      "failure_rate",
    );
    anomalies.push(...failureAnomalies);

    const budgetAnomalies = detectMetricAnomalies(
      metrics.cost_latency.budget_utilization,
      historicalData["budget_utilization"],
      "budget_utilization",
    );
    anomalies.push(...budgetAnomalies);

    // Detect specific spike patterns
    const spikes = detectSpikes(metrics, historicalData);

    const detection: AnomalyDetection = {
      anomalies,
      spikes,
    };

    console.log("Anomaly detection completed:", {
      total_anomalies: anomalies.length,
      high_severity: anomalies.filter((a) => a.severity === "high").length,
      medium_severity: anomalies.filter((a) => a.severity === "medium").length,
      low_severity: anomalies.filter((a) => a.severity === "low").length,
      spikes: spikes.length,
    });

    return detection;
  } catch (error) {
    console.error("Error during anomaly detection:", error);
    return {
      anomalies: [],
      spikes: [],
    };
  }
}

/**
 * Generate anomaly summary for reporting
 */
export function summarizeAnomalies(detection: AnomalyDetection): {
  has_critical_anomalies: boolean;
  top_concerns: string[];
  recommendation: string;
} {
  const { anomalies, spikes } = detection;

  const criticalAnomalies = anomalies.filter((a) => a.severity === "high");
  const mediumAnomalies = anomalies.filter((a) => a.severity === "medium");

  const has_critical_anomalies =
    criticalAnomalies.length > 0 || spikes.length > 0;

  const top_concerns: string[] = [];

  // Add critical anomalies
  for (const anomaly of criticalAnomalies.slice(0, 3)) {
    top_concerns.push(`${anomaly.metric}: ${anomaly.description}`);
  }

  // Add spikes
  for (const spike of spikes.slice(0, 2)) {
    top_concerns.push(
      `${spike.type} spike: ${spike.value.toFixed(3)} (threshold: ${spike.threshold.toFixed(3)})`,
    );
  }

  // Add medium anomalies if room
  for (const anomaly of mediumAnomalies.slice(
    0,
    Math.max(0, 5 - top_concerns.length),
  )) {
    top_concerns.push(`${anomaly.metric}: ${anomaly.description}`);
  }

  let recommendation = "";
  if (has_critical_anomalies) {
    recommendation =
      "Critical anomalies detected - investigate immediately before proceeding with full run";
  } else if (mediumAnomalies.length > 2) {
    recommendation =
      "Multiple anomalies detected - review metrics and consider adjusting thresholds";
  } else if (anomalies.length > 0) {
    recommendation =
      "Minor anomalies detected - monitor closely but safe to proceed";
  } else {
    recommendation =
      "No significant anomalies detected - metrics are within normal ranges";
  }

  return {
    has_critical_anomalies,
    top_concerns,
    recommendation,
  };
}

/**
 * CLI interface for anomaly detection
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === "detect") {
    // Mock metrics for testing
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

    detectAnomalies(mockMetrics)
      .then((detection) => {
        const summary = summarizeAnomalies(detection);

        console.log("Anomaly Detection Result:");
        console.log(
          JSON.stringify(
            {
              detection,
              summary,
            },
            null,
            2,
          ),
        );

        // Exit with appropriate code
        process.exit(summary.has_critical_anomalies ? 1 : 0);
      })
      .catch((error) => {
        console.error("Anomaly detection failed:", error);
        process.exit(1);
      });
  } else {
    console.log("Usage: node detect_anomalies.js detect");
    process.exit(1);
  }
}
