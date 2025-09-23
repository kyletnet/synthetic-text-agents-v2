import { readFileSync } from 'fs';
import { join } from 'path';

interface DuplicationConfig {
  ngram_range: number[];
  similarity_thresholds: {
    jaccard: number;
    cosine: number;
  };
  max_pairs_for_llm_judge: number;
  budget_caps: {
    llm_judge_max_usd: number;
  };
  alert_thresholds: {
    duplication_rate_max: number;
    semantic_duplication_rate_max: number;
  };
}

interface DuplicationPair {
  index1: number;
  index2: number;
  text1: string;
  text2: string;
  jaccard_similarity: number;
  cosine_similarity?: number;
  ngram_overlap: number;
  semantic_duplicate?: boolean;
}

interface DuplicationMetrics {
  duplication_rate: number;
  total_pairs_checked: number;
  high_similarity_pairs: number;
  top_duplicate_pairs: DuplicationPair[];
  semantic_duplication_rate?: number;
  ngram_distributions: Record<number, number>;
  alert_triggered: boolean;
}

interface QAItem {
  qa: {
    q: string;
    a: string;
  };
  index?: number;
}

/**
 * Extract n-grams from text
 */
function extractNgrams(text: string, n: number): Set<string> {
  const tokens = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 0);

  const ngrams = new Set<string>();
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.add(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
  const union = new Set([...Array.from(set1), ...Array.from(set2)]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Simple cosine similarity using character-level vectors
 */
function cosineSimilarity(text1: string, text2: string): number {
  const chars1 = new Map<string, number>();
  const chars2 = new Map<string, number>();

  // Count character frequencies
  for (const char of text1.toLowerCase()) {
    chars1.set(char, (chars1.get(char) || 0) + 1);
  }
  for (const char of text2.toLowerCase()) {
    chars2.set(char, (chars2.get(char) || 0) + 1);
  }

  // Get all unique characters
  const allChars = new Set([...Array.from(chars1.keys()), ...Array.from(chars2.keys())]);

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (const char of Array.from(allChars)) {
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
 * Calculate maximum n-gram overlap for a pair of texts
 */
function calculateMaxNgramOverlap(text1: string, text2: string, ngramRange: number[]): number {
  let maxOverlap = 0;

  for (const n of ngramRange) {
    const ngrams1 = extractNgrams(text1, n);
    const ngrams2 = extractNgrams(text2, n);
    const overlap = jaccardSimilarity(ngrams1, ngrams2);
    maxOverlap = Math.max(maxOverlap, overlap);
  }

  return maxOverlap;
}

/**
 * Find duplicate pairs in a batch of QA items
 */
function findDuplicatePairs(
  qaItems: QAItem[],
  config: DuplicationConfig
): DuplicationPair[] {
  const pairs: DuplicationPair[] = [];

  for (let i = 0; i < qaItems.length; i++) {
    for (let j = i + 1; j < qaItems.length; j++) {
      const qa1 = qaItems[i];
      const qa2 = qaItems[j];

      // Combine question and answer for full text comparison
      const text1 = `${qa1.qa.q} ${qa1.qa.a}`;
      const text2 = `${qa2.qa.q} ${qa2.qa.a}`;

      const ngramOverlap = calculateMaxNgramOverlap(text1, text2, config.ngram_range);
      const jaccardSim = jaccardSimilarity(
        new Set(text1.toLowerCase().split(/\s+/)),
        new Set(text2.toLowerCase().split(/\s+/))
      );

      // Check if pair meets similarity threshold
      if (jaccardSim >= config.similarity_thresholds.jaccard ||
          ngramOverlap >= config.similarity_thresholds.jaccard) {

        const cosineSim = cosineSimilarity(text1, text2);

        pairs.push({
          index1: qa1.index || i,
          index2: qa2.index || j,
          text1: text1.substring(0, 200) + (text1.length > 200 ? '...' : ''),
          text2: text2.substring(0, 200) + (text2.length > 200 ? '...' : ''),
          jaccard_similarity: jaccardSim,
          cosine_similarity: cosineSim,
          ngram_overlap: ngramOverlap
        });
      }
    }
  }

  // Sort by highest similarity first
  pairs.sort((a, b) => b.jaccard_similarity - a.jaccard_similarity);

  return pairs;
}

/**
 * Calculate n-gram distribution statistics
 */
function calculateNgramDistributions(qaItems: QAItem[], ngramRange: number[]): Record<number, number> {
  const distributions: Record<number, number> = {};

  for (const n of ngramRange) {
    const allNgrams = new Set<string>();

    for (const item of qaItems) {
      const text = `${item.qa.q} ${item.qa.a}`;
      const ngrams = extractNgrams(text, n);
      ngrams.forEach(ngram => allNgrams.add(ngram));
    }

    distributions[n] = allNgrams.size;
  }

  return distributions;
}

/**
 * Mock LLM judge for semantic similarity (placeholder for future implementation)
 */
async function mockLlmJudgeSemanticSimilarity(pairs: DuplicationPair[]): Promise<DuplicationPair[]> {
  // In a real implementation, this would call an LLM to judge semantic similarity
  // For now, use cosine similarity as a proxy
  return pairs.map(pair => ({
    ...pair,
    semantic_duplicate: (pair.cosine_similarity || 0) > 0.8
  }));
}

/**
 * Calculate duplication metrics for a batch of QA items
 */
export async function calculateDuplicationMetrics(
  qaItems: QAItem[],
  configPath: string = 'baseline_config.json'
): Promise<DuplicationMetrics> {

  // Load configuration
  const configText = readFileSync(configPath, 'utf-8');
  const fullConfig = JSON.parse(configText);
  const config: DuplicationConfig = fullConfig.duplication_metrics;

  // Find duplicate pairs
  const duplicatePairs = findDuplicatePairs(qaItems, config);

  // Calculate basic metrics
  const totalPossiblePairs = (qaItems.length * (qaItems.length - 1)) / 2;
  const duplicationRate = totalPossiblePairs > 0 ? duplicatePairs.length / totalPossiblePairs : 0;

  // Get top pairs for detailed analysis
  const topPairs = duplicatePairs.slice(0, config.max_pairs_for_llm_judge);

  // Apply LLM judge to top pairs (if budget allows)
  let semanticAnalyzedPairs = topPairs;
  let semanticDuplicationRate: number | undefined;

  try {
    semanticAnalyzedPairs = await mockLlmJudgeSemanticSimilarity(topPairs);
    const semanticDuplicates = semanticAnalyzedPairs.filter(p => p.semantic_duplicate).length;
    semanticDuplicationRate = topPairs.length > 0 ? semanticDuplicates / topPairs.length : 0;
  } catch (error) {
    console.warn('LLM judge failed, using rule-based similarity only:', error);
  }

  // Calculate n-gram distributions
  const ngramDistributions = calculateNgramDistributions(qaItems, config.ngram_range);

  // Check alert conditions
  const alertTriggered = duplicationRate > config.alert_thresholds.duplication_rate_max ||
    (semanticDuplicationRate !== undefined &&
     semanticDuplicationRate > config.alert_thresholds.semantic_duplication_rate_max);

  const result: any = {
    duplication_rate: duplicationRate,
    total_pairs_checked: totalPossiblePairs,
    high_similarity_pairs: duplicatePairs.length,
    top_duplicate_pairs: semanticAnalyzedPairs.slice(0, 10), // Limit for reporting
    ngram_distributions: ngramDistributions,
    alert_triggered: alertTriggered
  };
  if (typeof semanticDuplicationRate === "number") {
    result.semantic_duplication_rate = semanticDuplicationRate;
  }
  return result;
}

/**
 * CLI entry point for testing
 */
if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  // Test with sample data
  const sampleQA: QAItem[] = [
    { qa: { q: "물이 어떤 상태로 존재하나요?", a: "물은 고체, 액체, 기체 상태로 존재합니다." }, index: 0 },
    { qa: { q: "물의 상태는 무엇인가요?", a: "물은 얼음, 물, 수증기로 존재할 수 있습니다." }, index: 1 },
    { qa: { q: "식물은 어떻게 자라나요?", a: "식물은 뿌리로 물을 흡수하고 잎으로 광합성을 합니다." }, index: 2 }
  ];

  calculateDuplicationMetrics(sampleQA)
    .then(metrics => {
      console.log('Duplication Metrics:');
      console.log(JSON.stringify(metrics, null, 2));
    })
    .catch(console.error);
}