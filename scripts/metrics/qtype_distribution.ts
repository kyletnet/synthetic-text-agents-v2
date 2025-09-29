import { readFileSync } from "fs";

interface QtypeConfig {
  patterns: Record<string, string[]>;
  target_distribution: Record<string, number>;
  alert_thresholds: {
    imbalance_score_max: number;
    missing_categories_max: number;
  };
}

interface QtypeDistribution {
  distributions: Record<
    string,
    {
      count: number;
      ratio: number;
      examples: string[];
    }
  >;
  imbalance_score: number;
  entropy: number;
  missing_categories: string[];
  alert_triggered: boolean;
  unclassified_count: number;
  unclassified_ratio: number;
}

interface QAItem {
  qa: {
    q: string;
    a: string;
  };
  index?: number;
}

/**
 * Classify a question based on configured patterns
 */
function classifyQuestion(
  question: string,
  patterns: Record<string, string[]>,
): string | null {
  const normalizedQuestion = question.toLowerCase().trim();

  // Check each question type
  for (const [qtype, keywords] of Object.entries(patterns)) {
    for (const keyword of keywords) {
      if (normalizedQuestion.includes(keyword.toLowerCase())) {
        return qtype;
      }
    }
  }

  // Additional pattern-based classification
  if (normalizedQuestion.match(/^(어떤|무엇|뭐).*(인가|일까|인지)/)) {
    return "what";
  }
  if (normalizedQuestion.match(/^(왜|어째서).*(인가|일까|인지)/)) {
    return "why";
  }
  if (normalizedQuestion.match(/^(어떻게|방법).*(인가|일까|인지)/)) {
    return "how";
  }
  if (normalizedQuestion.match(/^(언제|시간).*(인가|일까|인지)/)) {
    return "when";
  }
  if (normalizedQuestion.match(/^(어디|장소).*(인가|일까|인지)/)) {
    return "where";
  }
  if (normalizedQuestion.match(/^(누구|사람).*(인가|일까|인지)/)) {
    return "who";
  }
  if (
    normalizedQuestion.includes("비교") ||
    normalizedQuestion.includes("차이") ||
    normalizedQuestion.includes("다른") ||
    normalizedQuestion.includes("같은")
  ) {
    return "comparison";
  }
  if (
    normalizedQuestion.includes("생각") ||
    normalizedQuestion.includes("판단") ||
    normalizedQuestion.includes("결론") ||
    normalizedQuestion.includes("추론")
  ) {
    return "inference";
  }

  return null; // Unclassified
}

/**
 * Calculate Shannon entropy for distribution
 */
function calculateEntropy(distribution: Record<string, number>): number {
  const total = Object.values(distribution).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (total === 0) return 0;

  let entropy = 0;
  for (const count of Object.values(distribution)) {
    if (count > 0) {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }
  }

  return entropy;
}

/**
 * Calculate imbalance score compared to target distribution
 */
function calculateImbalanceScore(
  actualDistribution: Record<string, number>,
  targetDistribution: Record<string, number>,
  totalItems: number,
): number {
  let totalDeviation = 0;

  for (const [qtype, targetRatio] of Object.entries(targetDistribution)) {
    const actualCount = actualDistribution[qtype] || 0;
    const actualRatio = totalItems > 0 ? actualCount / totalItems : 0;
    const deviation = Math.abs(actualRatio - targetRatio);
    totalDeviation += deviation;
  }

  return totalDeviation;
}

/**
 * Find missing categories from target distribution
 */
function findMissingCategories(
  actualDistribution: Record<string, number>,
  targetDistribution: Record<string, number>,
): string[] {
  const missing: string[] = [];

  for (const qtype of Object.keys(targetDistribution)) {
    if (!actualDistribution[qtype] || actualDistribution[qtype] === 0) {
      missing.push(qtype);
    }
  }

  return missing;
}

/**
 * Analyze question type distribution in QA dataset
 */
export function analyzeQuestionTypeDistribution(
  qaItems: QAItem[],
  configPath: string = "baseline_config.json",
): QtypeDistribution {
  // Load configuration
  const configText = readFileSync(configPath, "utf-8");
  const fullConfig = JSON.parse(configText);
  const config: QtypeConfig = fullConfig.qtype_distribution;

  // Classify all questions
  const classifications: Record<string, { count: number; examples: string[] }> =
    {};
  let unclassifiedCount = 0;
  const unclassifiedExamples: string[] = [];

  for (const item of qaItems) {
    const qtype = classifyQuestion(item.qa.q, config.patterns);

    if (qtype) {
      if (!classifications[qtype]) {
        classifications[qtype] = { count: 0, examples: [] };
      }
      classifications[qtype].count++;

      // Keep first 3 examples
      if (classifications[qtype].examples.length < 3) {
        classifications[qtype].examples.push(item.qa.q);
      }
    } else {
      unclassifiedCount++;
      if (unclassifiedExamples.length < 3) {
        unclassifiedExamples.push(item.qa.q);
      }
    }
  }

  // Convert to distribution format
  const distributions: Record<
    string,
    { count: number; ratio: number; examples: string[] }
  > = {};
  const rawCounts: Record<string, number> = {};

  for (const [qtype, data] of Object.entries(classifications)) {
    const ratio = qaItems.length > 0 ? data.count / qaItems.length : 0;
    distributions[qtype] = {
      count: data.count,
      ratio: ratio,
      examples: data.examples,
    };
    rawCounts[qtype] = data.count;
  }

  // Calculate metrics
  const entropy = calculateEntropy(rawCounts);
  const imbalanceScore = calculateImbalanceScore(
    rawCounts,
    config.target_distribution,
    qaItems.length,
  );
  const missingCategories = findMissingCategories(
    rawCounts,
    config.target_distribution,
  );

  // Check alert conditions
  const alertTriggered =
    imbalanceScore > config.alert_thresholds.imbalance_score_max ||
    missingCategories.length > config.alert_thresholds.missing_categories_max;

  const unclassifiedRatio =
    qaItems.length > 0 ? unclassifiedCount / qaItems.length : 0;

  return {
    distributions,
    imbalance_score: imbalanceScore,
    entropy,
    missing_categories: missingCategories,
    alert_triggered: alertTriggered,
    unclassified_count: unclassifiedCount,
    unclassified_ratio: unclassifiedRatio,
  };
}

/**
 * Generate a summary report for question type distribution
 */
export function generateQtypeReport(distribution: QtypeDistribution): string {
  const lines: string[] = [];

  lines.push("## Question Type Distribution Analysis");
  lines.push("");

  // Summary table
  lines.push("| Question Type | Count | Ratio | Examples |");
  lines.push("|---------------|-------|-------|----------|");

  for (const [qtype, data] of Object.entries(distribution.distributions)) {
    const examples = data.examples.slice(0, 2).join("; ");
    lines.push(
      `| ${qtype} | ${data.count} | ${(data.ratio * 100).toFixed(1)}% | ${examples} |`,
    );
  }

  if (distribution.unclassified_count > 0) {
    lines.push(
      `| unclassified | ${distribution.unclassified_count} | ${(distribution.unclassified_ratio * 100).toFixed(1)}% | - |`,
    );
  }

  lines.push("");

  // Metrics summary
  lines.push("### Distribution Metrics");
  lines.push(
    `- **Imbalance Score**: ${distribution.imbalance_score.toFixed(3)}`,
  );
  lines.push(`- **Entropy**: ${distribution.entropy.toFixed(3)}`);
  lines.push(
    `- **Missing Categories**: ${distribution.missing_categories.length > 0 ? distribution.missing_categories.join(", ") : "None"}`,
  );
  lines.push(
    `- **Alert Status**: ${distribution.alert_triggered ? "⚠️ TRIGGERED" : "✅ NORMAL"}`,
  );

  lines.push("");

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
        a: "고체, 액체, 기체 상태로 존재합니다.",
      },
      index: 0,
    },
    {
      qa: { q: "왜 물이 얼까요?", a: "온도가 0도 이하로 내려가기 때문입니다." },
      index: 1,
    },
    {
      qa: { q: "어떻게 물이 수증기가 되나요?", a: "가열하면 증발합니다." },
      index: 2,
    },
    {
      qa: { q: "언제 얼음이 녹나요?", a: "온도가 0도 이상일 때 녹습니다." },
      index: 3,
    },
    {
      qa: {
        q: "식물과 동물의 차이는 무엇인가요?",
        a: "식물은 광합성을 하고 동물은 호흡을 합니다.",
      },
      index: 4,
    },
  ];

  try {
    const distribution = analyzeQuestionTypeDistribution(sampleQA);
    console.log("Question Type Distribution:");
    console.log(JSON.stringify(distribution, null, 2));
    console.log("\nReport:");
    console.log(generateQtypeReport(distribution));
  } catch (error) {
    console.error("Error analyzing question types:", error);
  }
}
