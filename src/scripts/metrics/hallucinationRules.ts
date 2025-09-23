import { readFileSync } from 'fs';

interface HallucinationConfig {
  similarity_threshold: number;
  min_matching_ngrams: number;
  context_window: number;
  alert_thresholds: {
    hallucination_rate_max: number;
    high_risk_cases_max: number;
  };
}

interface HallucinationFlag {
  index: number;
  question: string;
  answer: string;
  evidence: string;
  reason: string;
  risk_level: 'low' | 'medium' | 'high';
  similarity_score: number;
  missing_support: string[];
}

interface HallucinationMetrics {
  total_items: number;
  flagged_items: number;
  hallucination_rate: number;
  high_risk_count: number;
  flags: HallucinationFlag[];
  risk_distribution: Record<string, number>;
  alert_triggered: boolean;
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
}

/**
 * Extract n-grams from text
 */
function extractNgrams(text: string, n: number): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 1);

  const ngrams = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.add(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

/**
 * Calculate text similarity using n-gram overlap
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1)
  );

  const words2 = new Set(
    text2
      .toLowerCase()
      .replace(/[^\w\s가-힣]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1)
  );

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Find content in answer that lacks support in evidence
 */
function findUnsupportedContent(
  answer: string,
  evidence: string,
  config: HallucinationConfig
): string[] {
  const answerNgrams = extractNgrams(answer, config.min_matching_ngrams);
  const evidenceNgrams = extractNgrams(evidence, config.min_matching_ngrams);

  const unsupported: string[] = [];

  for (const ngram of answerNgrams) {
    let hasSupport = false;

    // Check direct match
    if (evidenceNgrams.has(ngram)) {
      hasSupport = true;
    } else {
      // Check if similar content exists (fuzzy matching)
      for (const evidenceNgram of evidenceNgrams) {
        const similarity = calculateSimilarity(ngram, evidenceNgram);
        if (similarity >= config.similarity_threshold) {
          hasSupport = true;
          break;
        }
      }
    }

    if (!hasSupport && ngram.length > 5) { // Only flag substantial content
      unsupported.push(ngram);
    }
  }

  return unsupported.slice(0, 5); // Limit for readability
}

/**
 * Assess risk level based on unsupported content
 */
function assessRiskLevel(
  unsupportedContent: string[],
  similarityScore: number,
  config: HallucinationConfig
): 'low' | 'medium' | 'high' {
  if (unsupportedContent.length === 0) {
    return 'low';
  }

  if (similarityScore < config.similarity_threshold * 0.5) {
    return 'high';
  } else if (unsupportedContent.length >= config.min_matching_ngrams) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Generate reason for hallucination flag
 */
function generateReason(
  unsupportedContent: string[],
  similarityScore: number,
  config: HallucinationConfig
): string {
  const reasons: string[] = [];

  if (similarityScore < config.similarity_threshold) {
    reasons.push(`Low similarity to evidence (${(similarityScore * 100).toFixed(1)}%)`);
  }

  if (unsupportedContent.length > 0) {
    reasons.push(`${unsupportedContent.length} unsupported content segments`);
  }

  if (unsupportedContent.length >= config.min_matching_ngrams) {
    reasons.push('Multiple factual claims lack evidence support');
  }

  return reasons.join('; ') || 'Potential hallucination detected';
}

/**
 * Detect potential hallucinations using rule-based approach
 */
export function detectHallucinations(
  qaItems: QAItem[],
  configPath: string = 'baseline_config.json'
): HallucinationMetrics {

  // Load configuration
  const configText = readFileSync(configPath, 'utf-8');
  const fullConfig = JSON.parse(configText);
  const config: HallucinationConfig = fullConfig.hallucination_detection;

  const flags: HallucinationFlag[] = [];
  const riskDistribution: Record<string, number> = { low: 0, medium: 0, high: 0 };

  for (let i = 0; i < qaItems.length; i++) {
    const item = qaItems[i];
    const evidence = item.evidence || item.evidence_text || item.source_text || '';

    // Skip items without evidence (different quality issue)
    if (!evidence || evidence.trim().length === 0) {
      continue;
    }

    // Calculate similarity between answer and evidence
    const similarityScore = calculateSimilarity(item.qa.a, evidence);

    // Find unsupported content
    const unsupportedContent = findUnsupportedContent(item.qa.a, evidence, config);

    // Check if this should be flagged
    const shouldFlag =
      similarityScore < config.similarity_threshold ||
      unsupportedContent.length >= config.min_matching_ngrams;

    if (shouldFlag) {
      const riskLevel = assessRiskLevel(unsupportedContent, similarityScore, config);
      const reason = generateReason(unsupportedContent, similarityScore, config);

      flags.push({
        index: item.index || i,
        question: item.qa.q.substring(0, 100) + (item.qa.q.length > 100 ? '...' : ''),
        answer: item.qa.a.substring(0, 150) + (item.qa.a.length > 150 ? '...' : ''),
        evidence: evidence.substring(0, 150) + (evidence.length > 150 ? '...' : ''),
        reason,
        risk_level: riskLevel,
        similarity_score: similarityScore,
        missing_support: unsupportedContent
      });

      riskDistribution[riskLevel]++;
    }
  }

  const hallucinationRate = qaItems.length > 0 ? flags.length / qaItems.length : 0;
  const highRiskCount = riskDistribution.high;

  // Check alert conditions
  const alertTriggered =
    hallucinationRate > config.alert_thresholds.hallucination_rate_max ||
    highRiskCount > config.alert_thresholds.high_risk_cases_max;

  return {
    total_items: qaItems.length,
    flagged_items: flags.length,
    hallucination_rate: hallucinationRate,
    high_risk_count: highRiskCount,
    flags: flags.slice(0, 5), // Limit for reporting
    risk_distribution: riskDistribution,
    alert_triggered: alertTriggered
  };
}

/**
 * Generate hallucination detection report
 */
export function generateHallucinationReport(metrics: HallucinationMetrics): string {
  const lines: string[] = [];

  lines.push('## Hallucination Detection Analysis');
  lines.push('');

  // Summary metrics
  lines.push('### Detection Summary');
  lines.push(`- **Total Items Analyzed**: ${metrics.total_items}`);
  lines.push(`- **Flagged Items**: ${metrics.flagged_items}`);
  lines.push(`- **Hallucination Rate**: ${(metrics.hallucination_rate * 100).toFixed(2)}%`);
  lines.push(`- **High Risk Cases**: ${metrics.high_risk_count}`);
  lines.push(`- **Alert Status**: ${metrics.alert_triggered ? '⚠️ HALLUCINATION RISK' : '✅ NORMAL'}`);
  lines.push('');

  // Risk distribution
  lines.push('### Risk Distribution');
  lines.push('| Risk Level | Count | Percentage |');
  lines.push('|------------|-------|------------|');
  const total = Object.values(metrics.risk_distribution).reduce((sum, count) => sum + count, 0);
  for (const [level, count] of Object.entries(metrics.risk_distribution)) {
    const percentage = total > 0 ? (count / total * 100).toFixed(1) : '0.0';
    lines.push(`| ${level} | ${count} | ${percentage}% |`);
  }
  lines.push('');

  // Flagged cases
  if (metrics.flags.length > 0) {
    lines.push('### Top Flagged Cases');
    lines.push('| Index | Risk | Similarity | Reason | Answer Preview |');
    lines.push('|-------|------|------------|--------|----------------|');

    for (const flag of metrics.flags) {
      const riskIcon = flag.risk_level === 'high' ? '🔴' : flag.risk_level === 'medium' ? '🟡' : '🟢';
      lines.push(`| ${flag.index} | ${riskIcon} ${flag.risk_level} | ${(flag.similarity_score * 100).toFixed(1)}% | ${flag.reason} | ${flag.answer} |`);
    }
    lines.push('');
  }

  // Recommendations
  if (metrics.alert_triggered) {
    lines.push('### Recommendations');
    if (metrics.high_risk_count > 0) {
      lines.push('- ⚠️ Review high-risk cases for factual accuracy');
    }
    if (metrics.hallucination_rate > 0.05) {
      lines.push('- ⚠️ Consider improving evidence matching in QA generation');
    }
    lines.push('- ⚠️ Validate answers against source material before final approval');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * CLI entry point for testing
 */
if (import.meta.url === new URL(process.argv[1], "file://").href) {
  // Test with sample data including potential hallucinations
  const sampleQA: QAItem[] = [
    {
      qa: {
        q: "물이 어떤 상태로 존재하나요?",
        a: "물은 고체, 액체, 기체 상태로 존재합니다."
      },
      evidence: "물은 세 가지 상태로 존재할 수 있습니다. 고체 상태인 얼음, 액체 상태인 물, 그리고 기체 상태인 수증기입니다.",
      index: 0
    },
    {
      qa: {
        q: "식물은 어떻게 자라나요?",
        a: "식물은 햇빛을 받아 플라즈마 상태로 변환하며 자랍니다."
      },
      evidence: "식물은 뿌리로 물을 흡수하고 잎으로 광합성을 합니다.",
      index: 1
    },
    {
      qa: {
        q: "동물은 무엇을 먹나요?",
        a: "동물은 미네랄과 우주 에너지를 흡수하여 생존합니다."
      },
      evidence: "동물은 먹이를 먹고 소화시켜 에너지를 얻습니다.",
      index: 2
    }
  ];

  try {
    const metrics = detectHallucinations(sampleQA);
    console.log('Hallucination Detection Metrics:');
    console.log(JSON.stringify(metrics, null, 2));
    console.log('\nReport:');
    console.log(generateHallucinationReport(metrics));
  } catch (error) {
    console.error('Error detecting hallucinations:', error);
  }
}