import { readFileSync } from "fs";
import { calculateAlignment } from "../lib/contrastive-alignment.js";

interface EvidenceConfig {
  hit_rate: {
    required_fields: string[];
  };
  snippet_alignment: {
    similarity_method: string;
    min_similarity: number;
    ngram_overlap_weight: number;
    embedding_weight: number;
  };
  alert_thresholds: {
    evidence_presence_rate_min: number;
    snippet_alignment_mean_min: number;
    snippet_alignment_p95_min: number;
  };
}

interface EvidenceQualityMetrics {
  evidence_presence_rate: number;
  total_items: number;
  items_with_evidence: number;
  items_missing_evidence: number;
  snippet_alignment: {
    mean: number;
    median: number;
    p95: number;
    scores: number[];
  };
  failed_alignments: Array<{
    index: number;
    question: string;
    answer: string;
    evidence: string;
    alignment_score: number;
  }>;
  alert_triggered: boolean;
}

interface QAItem {
  qa: {
    q: string;
    a: string;
  };
  evidence?: string;
  evidence_idx?: number;
  evidence_text?: string;
  index?: number;
}

/**
 * Check if evidence fields are present
 */
function hasEvidence(item: QAItem, requiredFields: string[]): boolean {
  for (const field of requiredFields) {
    const value = (item as any)[field];
    if (!value || (typeof value === "string" && value.trim().length === 0)) {
      return false;
    }
  }
  return true;
}

/**
 * Extract the best evidence text from available fields
 */
function extractEvidenceText(item: QAItem): string {
  return item.evidence_text || item.evidence || "";
}

/**
 * Calculate n-gram overlap between two texts
 */
function calculateNgramOverlap(
  text1: string,
  text2: string,
  n: number = 3,
): number {
  const tokens1 = text1
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const tokens2 = text2
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);

  if (tokens1.length < n || tokens2.length < n) {
    return 0;
  }

  const ngrams1 = new Set<string>();
  const ngrams2 = new Set<string>();

  for (let i = 0; i <= tokens1.length - n; i++) {
    ngrams1.add(tokens1.slice(i, i + n).join(" "));
  }

  for (let i = 0; i <= tokens2.length - n; i++) {
    ngrams2.add(tokens2.slice(i, i + n).join(" "));
  }

  const intersection = new Set(
    [...ngrams1].filter((ngram) => ngrams2.has(ngram)),
  );
  const union = new Set([...ngrams1, ...ngrams2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Simple character-level cosine similarity
 */
function calculateCosineSimilarity(text1: string, text2: string): number {
  const chars1 = new Map<string, number>();
  const chars2 = new Map<string, number>();

  // Count character frequencies
  for (const char of text1.toLowerCase()) {
    if (/[\w가-힣]/.test(char)) {
      chars1.set(char, (chars1.get(char) || 0) + 1);
    }
  }

  for (const char of text2.toLowerCase()) {
    if (/[\w가-힣]/.test(char)) {
      chars2.set(char, (chars2.get(char) || 0) + 1);
    }
  }

  // Calculate cosine similarity
  const allChars = new Set([...chars1.keys(), ...chars2.keys()]);
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const char of allChars) {
    const freq1 = chars1.get(char) || 0;
    const freq2 = chars2.get(char) || 0;

    dotProduct += freq1 * freq2;
    norm1 += freq1 * freq1;
    norm2 += freq2 * freq2;
  }

  if (norm1 === 0 || norm2 === 0) return 0;
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Calculate snippet alignment score between answer and evidence
 *
 * IMPROVEMENT: Now uses contrastive embeddings for semantic similarity
 * Falls back to n-gram overlap if FEATURE_CONTRASTIVE_ALIGNMENT=false
 */
async function calculateSnippetAlignment(
  answer: string,
  evidence: string,
  config: EvidenceConfig,
): Promise<number> {
  if (!evidence || evidence.trim().length === 0) {
    return 0;
  }

  // Use contrastive alignment (with automatic fallback)
  const alignmentResult = await calculateAlignment(answer, evidence);

  // Log method used for observability
  if (alignmentResult.method === "contrastive") {
    // Contrastive method already provides optimal score
    return Math.min(alignmentResult.score, 1.0);
  } else {
    // Fallback: use weighted combination as before
    const ngramOverlap = calculateNgramOverlap(answer, evidence, 3);
    const cosineSim = calculateCosineSimilarity(answer, evidence);

    const alignmentScore =
      ngramOverlap * config.snippet_alignment.ngram_overlap_weight +
      cosineSim * config.snippet_alignment.embedding_weight;

    return Math.min(alignmentScore, 1.0);
  }
}

/**
 * Calculate percentile value from array
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Calculate mean value from array
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate evidence quality metrics
 *
 * IMPROVEMENT: Now async to support contrastive embedding alignment
 */
export async function calculateEvidenceQuality(
  qaItems: QAItem[],
  configPath: string = "baseline_config.json",
): Promise<EvidenceQualityMetrics> {
  // Load configuration
  const configText = readFileSync(configPath, "utf-8");
  const fullConfig = JSON.parse(configText);
  const config: EvidenceConfig = fullConfig.evidence_quality;

  // Calculate evidence presence rate
  let itemsWithEvidence = 0;
  const alignmentScores: number[] = [];
  const failedAlignments: Array<{
    index: number;
    question: string;
    answer: string;
    evidence: string;
    alignment_score: number;
  }> = [];

  for (let i = 0; i < qaItems.length; i++) {
    const item = qaItems[i];
    const hasEvidenceFields = hasEvidence(
      item,
      config.hit_rate.required_fields,
    );

    if (hasEvidenceFields) {
      itemsWithEvidence++;

      // Calculate snippet alignment (now async)
      const evidenceText = extractEvidenceText(item);
      const alignmentScore = await calculateSnippetAlignment(
        item.qa.a,
        evidenceText,
        config,
      );
      alignmentScores.push(alignmentScore);

      // Track failed alignments
      if (alignmentScore < config.snippet_alignment.min_similarity) {
        failedAlignments.push({
          index: item.index || i,
          question:
            item.qa.q.substring(0, 100) + (item.qa.q.length > 100 ? "..." : ""),
          answer:
            item.qa.a.substring(0, 100) + (item.qa.a.length > 100 ? "..." : ""),
          evidence:
            evidenceText.substring(0, 100) +
            (evidenceText.length > 100 ? "..." : ""),
          alignment_score: alignmentScore,
        });
      }
    }
  }

  const evidencePresenceRate =
    qaItems.length > 0 ? itemsWithEvidence / qaItems.length : 0;
  const itemsMissingEvidence = qaItems.length - itemsWithEvidence;

  // Calculate alignment statistics
  const meanAlignment = calculateMean(alignmentScores);
  const medianAlignment = calculatePercentile(alignmentScores, 50);
  const p95Alignment = calculatePercentile(alignmentScores, 95);

  // Check alert conditions
  const alertTriggered =
    evidencePresenceRate < config.alert_thresholds.evidence_presence_rate_min ||
    meanAlignment < config.alert_thresholds.snippet_alignment_mean_min ||
    p95Alignment < config.alert_thresholds.snippet_alignment_p95_min;

  return {
    evidence_presence_rate: evidencePresenceRate,
    total_items: qaItems.length,
    items_with_evidence: itemsWithEvidence,
    items_missing_evidence: itemsMissingEvidence,
    snippet_alignment: {
      mean: meanAlignment,
      median: medianAlignment,
      p95: p95Alignment,
      scores: alignmentScores,
    },
    failed_alignments: failedAlignments.slice(0, 5), // Limit for reporting
    alert_triggered: alertTriggered,
  };
}

/**
 * Generate evidence quality report
 */
export function generateEvidenceReport(
  metrics: EvidenceQualityMetrics,
): string {
  const lines: string[] = [];

  lines.push("## Evidence Quality Analysis");
  lines.push("");

  // Summary metrics
  lines.push("### Evidence Presence");
  lines.push(`- **Total Items**: ${metrics.total_items}`);
  lines.push(`- **Items with Evidence**: ${metrics.items_with_evidence}`);
  lines.push(`- **Items Missing Evidence**: ${metrics.items_missing_evidence}`);
  lines.push(
    `- **Evidence Presence Rate**: ${(
      metrics.evidence_presence_rate * 100
    ).toFixed(1)}%`,
  );
  lines.push("");

  // Alignment metrics
  lines.push("### Snippet Alignment Quality");
  lines.push(
    `- **Mean Alignment Score**: ${metrics.snippet_alignment.mean.toFixed(3)}`,
  );
  lines.push(
    `- **Median Alignment Score**: ${metrics.snippet_alignment.median.toFixed(
      3,
    )}`,
  );
  lines.push(
    `- **95th Percentile**: ${metrics.snippet_alignment.p95.toFixed(3)}`,
  );
  lines.push(
    `- **Alert Status**: ${
      metrics.alert_triggered ? "⚠️ QUALITY ISSUES" : "✅ NORMAL"
    }`,
  );
  lines.push("");

  // Failed alignments
  if (metrics.failed_alignments.length > 0) {
    lines.push("### Failed Alignments (Low Quality Evidence)");
    lines.push("| Index | Question | Answer | Evidence | Score |");
    lines.push("|-------|----------|--------|----------|-------|");

    for (const failure of metrics.failed_alignments) {
      lines.push(
        `| ${failure.index} | ${failure.question} | ${failure.answer} | ${
          failure.evidence
        } | ${failure.alignment_score.toFixed(3)} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * CLI entry point for testing
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // Test with sample data
  const sampleQA: QAItem[] = [
    {
      qa: {
        q: "물이 어떤 상태로 존재하나요?",
        a: "물은 고체, 액체, 기체 상태로 존재합니다.",
      },
      evidence:
        "물은 세 가지 상태로 존재할 수 있습니다. 고체 상태인 얼음, 액체 상태인 물, 그리고 기체 상태인 수증기입니다.",
      evidence_idx: 0,
      index: 0,
    },
    {
      qa: {
        q: "식물은 어떻게 자라나요?",
        a: "식물은 뿌리로 물을 흡수하고 잎으로 광합성을 합니다.",
      },
      evidence: "식물은 뿌리로 물을 흡수하고 잎으로 광합성을 합니다.",
      evidence_idx: 1,
      index: 1,
    },
    {
      qa: { q: "동물은 무엇을 먹나요?", a: "동물은 다양한 먹이를 먹습니다." },
      // Missing evidence
      index: 2,
    },
  ];

  try {
    const metrics = await calculateEvidenceQuality(sampleQA);
    console.log("Evidence Quality Metrics:");
    console.log(JSON.stringify(metrics, null, 2));
    console.log("\nReport:");
    console.log(generateEvidenceReport(metrics));
  } catch (error) {
    console.error("Error calculating evidence quality:", error);
  }
}
