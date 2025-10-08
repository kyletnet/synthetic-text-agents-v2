/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Explanation Validator
 *
 * Purpose:
 * - Calculate semantic similarity between explanations
 * - Detect explanation drift
 * - Validate consistency threshold (>95%)
 *
 * Phase: v3.2.1 - Trust Infrastructure (P2-2: Gate E)
 */

/**
 * Explanation Similarity Result
 */
export interface SimilarityResult {
  similarity: number; // 0-1 scale
  method: "token-overlap" | "cosine" | "levenshtein";
  details: {
    commonTokens?: number;
    totalTokens?: number;
    editDistance?: number;
  };
}

/**
 * Explanation Validator
 *
 * Validates explanation consistency
 */
export class ExplanationValidator {
  private readonly threshold: number;

  constructor(options: { threshold?: number } = {}) {
    this.threshold = options.threshold ?? 0.95; // 95% default
  }

  /**
   * Calculate Similarity
   *
   * Computes semantic similarity between two explanations
   */
  calculateSimilarity(
    baseline: string,
    candidate: string,
  ): SimilarityResult {
    // Use token overlap method (simple and effective)
    return this.tokenOverlapSimilarity(baseline, candidate);
  }

  /**
   * Validate Consistency
   *
   * Check if candidate explanation meets consistency threshold
   */
  validate(baseline: string, candidate: string): boolean {
    const result = this.calculateSimilarity(baseline, candidate);
    return result.similarity >= this.threshold;
  }

  /**
   * Token Overlap Similarity
   *
   * Calculates similarity based on shared tokens (Jaccard similarity)
   */
  private tokenOverlapSimilarity(
    text1: string,
    text2: string,
  ): SimilarityResult {
    const tokens1 = this.tokenize(text1);
    const tokens2 = this.tokenize(text2);

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    // Calculate Jaccard similarity: |A ∩ B| / |A ∪ B|
    const intersection = new Set([...set1].filter((t) => set2.has(t)));
    const union = new Set([...set1, ...set2]);

    const similarity = union.size > 0 ? intersection.size / union.size : 1.0;

    return {
      similarity,
      method: "token-overlap",
      details: {
        commonTokens: intersection.size,
        totalTokens: union.size,
      },
    };
  }

  /**
   * Tokenize text
   *
   * Split text into normalized tokens
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ") // Remove punctuation
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  /**
   * Cosine Similarity (TF-IDF based)
   *
   * Note: Simplified version without actual TF-IDF weighting
   */
  private cosineSimilarity(text1: string, text2: string): SimilarityResult {
    const tokens1 = this.tokenize(text1);
    const tokens2 = this.tokenize(text2);

    // Build vocabulary
    const vocab = new Set([...tokens1, ...tokens2]);

    // Create frequency vectors
    const vector1 = Array.from(vocab).map(
      (token) => tokens1.filter((t) => t === token).length,
    );
    const vector2 = Array.from(vocab).map(
      (token) => tokens2.filter((t) => t === token).length,
    );

    // Calculate cosine similarity
    const dotProduct = vector1.reduce((sum, v, i) => sum + v * vector2[i], 0);
    const magnitude1 = Math.sqrt(
      vector1.reduce((sum, v) => sum + v * v, 0),
    );
    const magnitude2 = Math.sqrt(
      vector2.reduce((sum, v) => sum + v * v, 0),
    );

    const similarity =
      magnitude1 > 0 && magnitude2 > 0
        ? dotProduct / (magnitude1 * magnitude2)
        : 1.0;

    return {
      similarity,
      method: "cosine",
      details: {
        totalTokens: vocab.size,
      },
    };
  }

  /**
   * Levenshtein Distance (edit distance)
   *
   * Calculates character-level edit distance
   */
  private levenshteinSimilarity(
    text1: string,
    text2: string,
  ): SimilarityResult {
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);

    const similarity = maxLength > 0 ? 1 - distance / maxLength : 1.0;

    return {
      similarity,
      method: "levenshtein",
      details: {
        editDistance: distance,
      },
    };
  }

  /**
   * Levenshtein Distance Algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1, // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }
}

/**
 * Create default Explanation Validator
 */
export function createExplanationValidator(options?: { threshold?: number }): ExplanationValidator {
  return new ExplanationValidator(options);
}
