/**
 * Question Classification Interface
 *
 * Classifies questions into 4 types:
 * - Analytical: Why/Reason questions (왜, 이유, 원인)
 * - Procedural: How/Method questions (어떻게, 방법, 과정)
 * - Comparative: Comparison questions (차이, 비교)
 * - Factual: Fact/What/Who/When/Where questions (무엇, 누가, 언제, 어디)
 */

export type QuestionType =
  | "analytical"
  | "procedural"
  | "comparative"
  | "factual";

export interface QuestionClassificationResult {
  /** Question type */
  type: QuestionType;

  /** Confidence score (0.0 - 1.0) */
  confidence: number;

  /** Whether the question was successfully classified */
  classified: boolean;

  /** Metadata for debugging */
  metadata?: {
    matchedPattern?: string;
    reasoning?: string;
  };
}

export interface QuestionClassifier {
  /**
   * Classify a single question
   *
   * @param question - Question text to classify
   * @returns Classification result
   */
  classify(question: string): QuestionClassificationResult;

  /**
   * Classify multiple questions (batch)
   *
   * @param questions - Array of question texts
   * @returns Array of classification results
   */
  classifyBatch(questions: string[]): QuestionClassificationResult[];

  /**
   * Get type distribution from a set of questions
   *
   * @param questions - Array of question texts
   * @returns Distribution of question types
   */
  getTypeDistribution(questions: string[]): {
    analytical: number;
    procedural: number;
    comparative: number;
    factual: number;
    total: number;
  };
}

/**
 * Target distribution for balanced QA generation
 */
export const TARGET_QUESTION_DISTRIBUTION = {
  analytical: 0.3, // 30%
  procedural: 0.3, // 30%
  comparative: 0.2, // 20%
  factual: 0.2, // 20%
} as const;

/**
 * Calculate distribution balance score
 *
 * Measures how balanced the distribution is (0.0 - 1.0).
 * 1.0 = perfect balance, 0.0 = completely imbalanced
 *
 * @param distribution - Question type distribution
 * @returns Balance score
 */
export function calculateDistributionBalance(distribution: {
  analytical: number;
  procedural: number;
  comparative: number;
  factual: number;
  total: number;
}): number {
  if (distribution.total === 0) return 0;

  // Calculate entropy
  const probabilities = [
    distribution.analytical / distribution.total,
    distribution.procedural / distribution.total,
    distribution.comparative / distribution.total,
    distribution.factual / distribution.total,
  ].filter((p) => p > 0);

  const entropy = -probabilities.reduce((sum, p) => sum + p * Math.log2(p), 0);

  // Max entropy for 4 types is log2(4) = 2
  const maxEntropy = Math.log2(4);

  return entropy / maxEntropy;
}

/**
 * Calculate deviation from target distribution
 *
 * @param distribution - Actual distribution
 * @returns Average absolute deviation
 */
export function calculateDistributionDeviation(distribution: {
  analytical: number;
  procedural: number;
  comparative: number;
  factual: number;
  total: number;
}): number {
  if (distribution.total === 0) return 1.0; // Maximum deviation

  const actualRatios = {
    analytical: distribution.analytical / distribution.total,
    procedural: distribution.procedural / distribution.total,
    comparative: distribution.comparative / distribution.total,
    factual: distribution.factual / distribution.total,
  };

  const deviations = [
    Math.abs(actualRatios.analytical - TARGET_QUESTION_DISTRIBUTION.analytical),
    Math.abs(actualRatios.procedural - TARGET_QUESTION_DISTRIBUTION.procedural),
    Math.abs(
      actualRatios.comparative - TARGET_QUESTION_DISTRIBUTION.comparative,
    ),
    Math.abs(actualRatios.factual - TARGET_QUESTION_DISTRIBUTION.factual),
  ];

  return deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
}
