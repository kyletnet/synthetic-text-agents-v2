/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Semantic Alignment Interface
 *
 * Domain layer interface for evidence-answer alignment.
 * Supports multiple alignment methods:
 * - Direct quote (exact match)
 * - Paraphrase (semantic similarity)
 * - Inference (logical derivation)
 * - Unrelated (no connection)
 */

export type AlignmentMethod =
  | "direct_quote"
  | "paraphrase"
  | "inference"
  | "unrelated";

export interface AlignmentResult {
  /** Alignment score (0.0 - 1.0) */
  score: number;

  /** Alignment method detected */
  method: AlignmentMethod;

  /** Confidence in the alignment score (0.0 - 1.0) */
  confidence: number;

  /** Matched text spans (if any) */
  matchedSpans: Array<{
    answerSpan: string;
    evidenceSpan: string;
    similarity: number;
  }>;

  /** Metadata for debugging/analysis */
  metadata?: {
    directQuoteRatio?: number;
    ngramOverlap?: number;
    cosineSimilarity?: number;
    reasoning?: string;
  };
}

export interface SemanticAligner {
  /**
   * Calculate alignment between answer and evidence
   *
   * @param answer - The answer text to evaluate
   * @param evidence - The evidence text to compare against
   * @returns Promise resolving to alignment result
   */
  calculateAlignment(
    answer: string,
    evidence: string,
  ): Promise<AlignmentResult>;

  /**
   * Batch calculate alignments for multiple QA items
   *
   * @param items - Array of {answer, evidence} pairs
   * @returns Promise resolving to array of alignment results
   */
  calculateBatchAlignment(
    items: Array<{ answer: string; evidence: string }>,
  ): Promise<AlignmentResult[]>;
}

/**
 * Configuration for alignment calculation
 */
export interface AlignmentConfig {
  /** Minimum n-gram size for overlap detection (default: 3) */
  minNgramSize: number;

  /** Weight for n-gram overlap (0.0 - 1.0, default: 0.4) */
  ngramWeight: number;

  /** Weight for cosine similarity (0.0 - 1.0, default: 0.6) */
  cosineWeight: number;

  /** Threshold for direct quote detection (default: 0.3) */
  directQuoteThreshold: number;

  /** Threshold for paraphrase detection (default: 0.5) */
  paraphraseThreshold: number;

  /** Threshold for inference detection (default: 0.3) */
  inferenceThreshold: number;
}

/**
 * Default configuration
 */
export const DEFAULT_ALIGNMENT_CONFIG: AlignmentConfig = {
  minNgramSize: 3,
  ngramWeight: 0.4,
  cosineWeight: 0.6,
  directQuoteThreshold: 0.3,
  paraphraseThreshold: 0.5,
  inferenceThreshold: 0.3,
};

/**
 * Alignment quality thresholds
 */
export const ALIGNMENT_QUALITY_THRESHOLDS = {
  excellent: 0.85, // Direct quote or very close paraphrase
  good: 0.7, // Clear paraphrase
  acceptable: 0.5, // Some inference required
  poor: 0.3, // Weak connection
  failing: 0.0, // Unrelated
} as const;

/**
 * Get quality label for alignment score
 */
export function getAlignmentQuality(
  score: number,
): "excellent" | "good" | "acceptable" | "poor" | "failing" {
  if (score >= ALIGNMENT_QUALITY_THRESHOLDS.excellent) return "excellent";
  if (score >= ALIGNMENT_QUALITY_THRESHOLDS.good) return "good";
  if (score >= ALIGNMENT_QUALITY_THRESHOLDS.acceptable) return "acceptable";
  if (score >= ALIGNMENT_QUALITY_THRESHOLDS.poor) return "poor";
  return "failing";
}
