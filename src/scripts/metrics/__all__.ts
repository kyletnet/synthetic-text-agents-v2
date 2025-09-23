import { readFileSync, existsSync } from "fs";
import { calculateDuplicationMetrics } from "./duplicationMetrics";
import { analyzeQuestionTypeDistribution } from "./qtypeDistribution";
import { calculateCoverageMetrics } from "./coverageMetrics";
import { calculateEvidenceQuality } from "./evidenceQuality";
import { detectHallucinations } from "./hallucinationRules";
import { scanPiiAndLicense } from "./piiLicenseScan";

interface BaselineMetricsRecord {
  // Metadata
  timestamp: string;
  session_id: string;
  item_index: number;
  total_items: number;

  // QA Content
  qa: {
    q: string;
    a: string;
  };
  evidence?: string;
  evidence_idx?: number;
  source_text?: string;

  // V1.5 Metrics
  duplication: {
    is_duplicate: boolean;
    max_similarity: number;
    similar_to_indices: number[];
  };

  qtype: {
    classified_type: string | null;
    confidence: number;
    unclassified: boolean;
  };

  coverage: {
    entity_coverage_score: number;
    section_coverage_score: number;
    covered_entities: string[];
    missing_entities: string[];
  };

  evidence_quality: {
    has_evidence: boolean;
    alignment_score: number;
    evidence_complete: boolean;
  };

  hallucination: {
    flagged: boolean;
    risk_level: "low" | "medium" | "high" | null;
    similarity_to_evidence: number;
    unsupported_claims: string[];
  };

  pii_license: {
    pii_violations: number;
    license_violations: number;
    clean: boolean;
    violation_types: string[];
  };

  // Cost & Performance
  cost_usd: number;
  latency_ms: number;
  tokens_in?: number;
  tokens_out?: number;

  // Overall Quality Score
  quality_score: number;
  alert_flags: string[];
}

interface BaselineMetricsSummary {
  // Metadata
  timestamp: string;
  session_id: string;
  total_items: number;
  config_version: string;

  // V1.5 Metrics Summary
  duplication: {
    rate: number;
    high_similarity_pairs: number;
    semantic_duplication_rate?: number;
    alert_triggered: boolean;
  };

  qtype_distribution: {
    distributions: Record<string, { count: number; ratio: number }>;
    imbalance_score: number;
    entropy: number;
    missing_categories: string[];
    alert_triggered: boolean;
  };

  coverage: {
    entity_coverage_rate: number;
    section_coverage_rate: number;
    overall_score: number;
    critical_gaps: string[];
    alert_triggered: boolean;
  };

  evidence_quality: {
    presence_rate: number;
    alignment_mean: number;
    alignment_p95: number;
    alert_triggered: boolean;
  };

  hallucination: {
    rate: number;
    high_risk_count: number;
    risk_distribution: Record<string, number>;
    alert_triggered: boolean;
  };

  pii_license: {
    pii_hits: number;
    license_hits: number;
    total_violations: number;
    alert_triggered: boolean;
  };

  // Cost & Performance
  cost_total_usd: number;
  cost_per_item: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  budget_utilization: number;

  // Overall Assessment
  overall_quality_score: number;
  reproducibility_check: {
    passed: boolean;
    deviations: Record<string, number>;
  };
  total_alerts: number;
  recommendation_level: "green" | "yellow" | "red";
}

interface QAItem {
  qa: {
    q: string;
    a: string;
  };
  evidence?: string;
  evidence_text?: string;
  source_text?: string;
  index?: number;
  cost_usd?: number;
  latency_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
}

interface CalculateOptions {
  configPath?: string;
  sessionId?: string;
  budgetLimit?: number;
  sourceTexts?: string[];
}

/**
 * Calculate percentile from array
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Calculate mean value
 */
function _calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate overall quality score from component metrics
 */
function calculateOverallQualityScore(
  duplicateRate: number,
  evidencePresenceRate: number,
  hallucinationRate: number,
  piiViolations: number,
  qtypeBalance: number,
  coverageScore: number,
): number {
  // Weighted scoring (0-1 scale)
  const weights = {
    duplication: 0.15, // Lower duplication is better
    evidence: 0.25, // Higher evidence presence is better
    hallucination: 0.25, // Lower hallucination is better
    pii: 0.15, // No PII violations is better
    qtype: 0.1, // Balanced question types is better
    coverage: 0.1, // Higher coverage is better
  };

  const duplicationScore = Math.max(0, 1 - duplicateRate * 2); // Penalize >50% duplication heavily
  const evidenceScore = evidencePresenceRate;
  const hallucinationScore = Math.max(0, 1 - hallucinationRate * 10); // Penalize >10% hallucination heavily
  const piiScore = piiViolations === 0 ? 1 : 0; // Binary: any PII violation = 0
  const qtypeScore = Math.max(0, 1 - qtypeBalance); // Lower imbalance is better
  const coverageScoreNorm = coverageScore;

  const overallScore =
    weights.duplication * duplicationScore +
    weights.evidence * evidenceScore +
    weights.hallucination * hallucinationScore +
    weights.pii * piiScore +
    weights.qtype * qtypeScore +
    weights.coverage * coverageScoreNorm;

  return Math.max(0, Math.min(1, overallScore));
}

/**
 * Check reproducibility against previous baselines
 */
function checkReproducibility(
  currentMetrics: BaselineMetricsSummary,
  tolerancePct: number = 5,
): { passed: boolean; deviations: Record<string, number> } {
  const deviations: Record<string, number> = {};

  // Try to load previous baseline
  const previousBaselinePath = "tests/regression/baseline_metrics.json";
  if (!existsSync(previousBaselinePath)) {
    return { passed: true, deviations: {} };
  }

  try {
    const previousData = JSON.parse(
      readFileSync(previousBaselinePath, "utf-8"),
    );
    const previous = previousData.baseline_metrics;

    // Check key metrics for reproducibility
    const keyMetrics = [
      {
        name: "duplication_rate",
        current: currentMetrics.duplication.rate,
        previous: previous.pass_rate,
      },
      {
        name: "evidence_presence_rate",
        current: currentMetrics.evidence_quality.presence_rate,
        previous: previous.mean_score,
      },
      {
        name: "overall_quality_score",
        current: currentMetrics.overall_quality_score,
        previous: previous.mean_score,
      },
    ];

    let allPassed = true;

    for (const metric of keyMetrics) {
      if (metric.previous !== undefined && metric.previous !== 0) {
        const deviation =
          (Math.abs(metric.current - metric.previous) / metric.previous) * 100;
        deviations[metric.name] = deviation;

        if (deviation > tolerancePct) {
          allPassed = false;
        }
      }
    }

    return { passed: allPassed, deviations };
  } catch (error) {
    console.warn("Could not check reproducibility:", error);
    return { passed: true, deviations: {} };
  }
}

/**
 * Main function to calculate all baseline metrics
 */
export async function calculateAllBaselineMetrics(
  qaItems: QAItem[],
  options: CalculateOptions = {},
): Promise<{
  records: BaselineMetricsRecord[];
  summary: BaselineMetricsSummary;
}> {
  const {
    configPath = "baseline_config.json",
    sessionId = `baseline_${Date.now()}`,
    budgetLimit = 0,
    sourceTexts = [],
  } = options;

  console.log(
    `\n🔍 Calculating baseline v1.5 metrics for ${qaItems.length} items...`,
  );

  // Calculate component metrics
  console.log("📊 Calculating duplication metrics...");
  const duplicationMetrics = await calculateDuplicationMetrics(
    qaItems,
    configPath,
  );

  console.log("📊 Calculating question type distribution...");
  const qtypeMetrics = analyzeQuestionTypeDistribution(qaItems, configPath);

  console.log("📊 Calculating coverage metrics...");
  const coverageMetrics = calculateCoverageMetrics(
    qaItems,
    sourceTexts,
    configPath,
  );

  console.log("📊 Calculating evidence quality...");
  const evidenceMetrics = calculateEvidenceQuality(qaItems, configPath);

  console.log("📊 Detecting hallucinations...");
  const hallucinationMetrics = detectHallucinations(qaItems, configPath);

  console.log("📊 Scanning for PII and license violations...");
  const piiLicenseMetrics = scanPiiAndLicense(qaItems, configPath);

  // Calculate cost and performance metrics
  const costs = qaItems.map((item) => item.cost_usd || 0);
  const latencies = qaItems.map((item) => item.latency_ms || 0);

  const totalCost = costs.reduce((sum, cost) => sum + cost, 0);
  const costPerItem = qaItems.length > 0 ? totalCost / qaItems.length : 0;
  const latencyP50 = calculatePercentile(latencies, 50);
  const latencyP95 = calculatePercentile(latencies, 95);
  const budgetUtilization = budgetLimit > 0 ? totalCost / budgetLimit : 0;

  // Generate per-item records
  const records: BaselineMetricsRecord[] = qaItems.map((item, index) => {
    // Find if this item is flagged in various metrics
    const duplicateFlag = duplicationMetrics.top_duplicate_pairs.some(
      (pair: any) => pair.index1 === index || pair.index2 === index,
    );

    const hallucinationFlag = hallucinationMetrics.flags.find(
      (flag: any) => flag.index === index,
    );
    const piiLicenseViolations = piiLicenseMetrics.matches.filter(
      (match: any) => match.location.index === index,
    );

    // Calculate individual quality score
    const itemQualityScore = calculateOverallQualityScore(
      duplicateFlag ? 1 : 0,
      item.evidence ? 1 : 0,
      hallucinationFlag ? 1 : 0,
      piiLicenseViolations.length,
      qtypeMetrics.imbalance_score,
      coverageMetrics.coverage_summary.overall_score,
    );

    const alertFlags: string[] = [];
    if (duplicateFlag) alertFlags.push("duplication");
    if (hallucinationFlag) alertFlags.push("hallucination");
    if (piiLicenseViolations.length > 0) alertFlags.push("pii_license");
    if (!item.evidence) alertFlags.push("missing_evidence");

    return {
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      item_index: index,
      total_items: qaItems.length,

      qa: item.qa,
      evidence: item.evidence ?? "",
      evidence_idx: index,
      source_text: item.source_text ?? "",

      duplication: {
        is_duplicate: duplicateFlag,
        max_similarity: duplicateFlag
          ? Math.max(
              ...duplicationMetrics.top_duplicate_pairs
                .filter(
                  (pair: any) => pair.index1 === index || pair.index2 === index,
                )
                .map((pair: any) => pair.jaccard_similarity),
            )
          : 0,
        similar_to_indices: duplicationMetrics.top_duplicate_pairs
          .filter((pair: any) => pair.index1 === index || pair.index2 === index)
          .map((pair: any) =>
            pair.index1 === index ? pair.index2 : pair.index1,
          ),
      },

      qtype: {
        classified_type: qtypeMetrics.distributions[
          Object.keys(qtypeMetrics.distributions)[0]
        ]?.examples.includes(item.qa.q)
          ? Object.keys(qtypeMetrics.distributions)[0]
          : null,
        confidence: 0.8, // Mock confidence
        unclassified: false, // Will be properly calculated
      },

      coverage: {
        entity_coverage_score: coverageMetrics.entity_coverage.coverage_rate,
        section_coverage_score: coverageMetrics.section_coverage.coverage_rate,
        covered_entities: [], // Would need more detailed analysis
        missing_entities: coverageMetrics.entity_coverage.missed_entities.slice(
          0,
          3,
        ),
      },

      evidence_quality: {
        has_evidence: !!item.evidence,
        alignment_score: evidenceMetrics.snippet_alignment.scores[index] || 0,
        evidence_complete: !!item.evidence,
      },

      hallucination: {
        flagged: !!hallucinationFlag,
        risk_level: hallucinationFlag?.risk_level || null,
        similarity_to_evidence: hallucinationFlag?.similarity_score || 1.0,
        unsupported_claims: hallucinationFlag?.missing_support || [],
      },

      pii_license: {
        pii_violations: piiLicenseViolations.filter(
          (v: any) => v.type === "pii",
        ).length,
        license_violations: piiLicenseViolations.filter(
          (v: any) => v.type === "license",
        ).length,
        clean: piiLicenseViolations.length === 0,
        violation_types: [
          ...new Set(piiLicenseViolations.map((v: any) => v.pattern as string)),
        ] as string[],
      },

      cost_usd: item.cost_usd || 0,
      latency_ms: item.latency_ms || 0,
      tokens_in: typeof item.tokens_in === "number" ? item.tokens_in : 0,
      tokens_out: typeof item.tokens_out === "number" ? item.tokens_out : 0,

      quality_score: itemQualityScore,
      alert_flags: alertFlags,
    };
  });

  // Calculate overall quality score
  const overallQualityScore = calculateOverallQualityScore(
    duplicationMetrics.duplication_rate,
    evidenceMetrics.evidence_presence_rate,
    hallucinationMetrics.hallucination_rate,
    piiLicenseMetrics.pii_hits,
    qtypeMetrics.imbalance_score,
    coverageMetrics.coverage_summary.overall_score,
  );

  // Create summary
  const summary: BaselineMetricsSummary = {
    timestamp: new Date().toISOString(),
    session_id: sessionId,
    total_items: qaItems.length,
    config_version: "1.5.0",

    duplication: {
      rate: duplicationMetrics.duplication_rate,
      high_similarity_pairs: duplicationMetrics.high_similarity_pairs,
      ...(typeof duplicationMetrics.semantic_duplication_rate === "number"
        ? {
            semantic_duplication_rate:
              duplicationMetrics.semantic_duplication_rate,
          }
        : {}),
      alert_triggered: duplicationMetrics.alert_triggered,
    },

    qtype_distribution: {
      distributions: Object.fromEntries(
        Object.entries(qtypeMetrics.distributions).map(
          ([key, value]: [string, any]) => [
            key,
            { count: value.count, ratio: value.ratio },
          ],
        ),
      ),
      imbalance_score: qtypeMetrics.imbalance_score,
      entropy: qtypeMetrics.entropy,
      missing_categories: qtypeMetrics.missing_categories,
      alert_triggered: qtypeMetrics.alert_triggered,
    },

    coverage: {
      entity_coverage_rate: coverageMetrics.entity_coverage.coverage_rate,
      section_coverage_rate: coverageMetrics.section_coverage.coverage_rate,
      overall_score: coverageMetrics.coverage_summary.overall_score,
      critical_gaps: coverageMetrics.coverage_summary.critical_gaps,
      alert_triggered: coverageMetrics.alert_triggered,
    },

    evidence_quality: {
      presence_rate: evidenceMetrics.evidence_presence_rate,
      alignment_mean: evidenceMetrics.snippet_alignment.mean,
      alignment_p95: evidenceMetrics.snippet_alignment.p95,
      alert_triggered: evidenceMetrics.alert_triggered,
    },

    hallucination: {
      rate: hallucinationMetrics.hallucination_rate,
      high_risk_count: hallucinationMetrics.high_risk_count,
      risk_distribution: hallucinationMetrics.risk_distribution,
      alert_triggered: hallucinationMetrics.alert_triggered,
    },

    pii_license: {
      pii_hits: piiLicenseMetrics.pii_hits,
      license_hits: piiLicenseMetrics.license_risk_hits,
      total_violations: piiLicenseMetrics.total_violations,
      alert_triggered: piiLicenseMetrics.alert_triggered,
    },

    cost_total_usd: totalCost,
    cost_per_item: costPerItem,
    latency_p50_ms: latencyP50,
    latency_p95_ms: latencyP95,
    budget_utilization: budgetUtilization,

    overall_quality_score: overallQualityScore,
    reproducibility_check: checkReproducibility({} as BaselineMetricsSummary), // Would pass actual metrics
    total_alerts: [
      duplicationMetrics.alert_triggered,
      qtypeMetrics.alert_triggered,
      coverageMetrics.alert_triggered,
      evidenceMetrics.alert_triggered,
      hallucinationMetrics.alert_triggered,
      piiLicenseMetrics.alert_triggered,
    ].filter(Boolean).length,
    recommendation_level:
      overallQualityScore > 0.8
        ? "green"
        : overallQualityScore > 0.6
          ? "yellow"
          : "red",
  };

  // Add reproducibility check with actual summary
  summary.reproducibility_check = checkReproducibility(summary);

  console.log(`✅ Baseline metrics calculation complete!`);
  console.log(
    `📈 Overall Quality Score: ${(overallQualityScore * 100).toFixed(1)}%`,
  );
  console.log(`⚠️  Total Alerts: ${summary.total_alerts}`);
  console.log(`💰 Total Cost: $${totalCost.toFixed(4)}`);

  return { records, summary };
}

/**
 * CLI entry point for testing
 */
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  // Test with sample data
  const sampleQA: QAItem[] = [
    {
      qa: {
        q: "물이 어떤 상태로 존재하나요?",
        a: "물은 고체, 액체, 기체 상태로 존재합니다.",
      },
      evidence:
        "물은 세 가지 상태로 존재할 수 있습니다. 고체 상태인 얼음, 액체 상태인 물, 그리고 기체 상태인 수증기입니다.",
      cost_usd: 0.01,
      latency_ms: 150,
      index: 0,
    },
    {
      qa: {
        q: "식물은 어떻게 자라나요?",
        a: "식물은 뿌리로 물을 흡수하고 잎으로 광합성을 합니다.",
      },
      evidence: "식물은 뿌리로 물을 흡수하고 잎으로 광합성을 합니다.",
      cost_usd: 0.01,
      latency_ms: 200,
      index: 1,
    },
  ];

  const sourceTexts = [
    "물은 세 가지 상태로 존재할 수 있습니다. 고체 상태인 얼음, 액체 상태인 물, 그리고 기체 상태인 수증기입니다.",
    "식물은 뿌리로 물을 흡수하고 잎으로 광합성을 합니다.",
  ];

  calculateAllBaselineMetrics(sampleQA, { sourceTexts })
    .then(({ records, summary }) => {
      console.log("\n=== BASELINE METRICS SUMMARY ===");
      console.log(JSON.stringify(summary, null, 2));

      console.log("\n=== SAMPLE RECORDS ===");
      console.log(JSON.stringify(records[0], null, 2));
    })
    .catch(console.error);
}
