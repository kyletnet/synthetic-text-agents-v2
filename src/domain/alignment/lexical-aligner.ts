/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Lexical Aligner
 *
 * Character-level alignment using n-gram overlap and cosine similarity.
 * This is the baseline implementation migrated from scripts/metrics/evidenceQuality.ts.
 *
 * Features:
 * - Direct quote detection (via CitationDetector)
 * - N-gram overlap (token-level)
 * - Cosine similarity (character-level)
 * - Weighted combination
 */

import {
  DEFAULT_ALIGNMENT_CONFIG,
  type SemanticAligner,
  type AlignmentResult,
  type AlignmentConfig,
} from "./semantic-aligner.js";
import { CitationDetector } from "./citation-detector.js";

export class LexicalAligner implements SemanticAligner {
  private citationDetector: CitationDetector;
  private config: AlignmentConfig;

  constructor(config?: Partial<AlignmentConfig>) {
    this.citationDetector = new CitationDetector();
    this.config = {
      ...DEFAULT_ALIGNMENT_CONFIG,
      ...config,
    };
  }

  async calculateAlignment(
    answer: string,
    evidence: string,
  ): Promise<AlignmentResult> {
    if (!evidence || evidence.trim().length === 0) {
      return {
        score: 0,
        method: "unrelated",
        confidence: 1.0,
        matchedSpans: [],
        metadata: {
          directQuoteRatio: 0,
          ngramOverlap: 0,
          cosineSimilarity: 0,
        },
      };
    }

    // 1. Direct quote detection (highest priority)
    const directQuoteRatio = this.citationDetector.calculateDirectQuoteRatio(
      answer,
      evidence,
    );

    if (directQuoteRatio >= this.config.directQuoteThreshold) {
      // 30% 이상 직접 인용 → 매우 높은 점수
      const score = 0.8 + directQuoteRatio * 0.2; // 0.8 ~ 1.0

      return {
        score: Math.min(score, 1.0),
        method: "direct_quote",
        confidence: 0.95,
        matchedSpans: this.citationDetector.detectDirectQuotes(
          answer,
          evidence,
        ),
        metadata: {
          directQuoteRatio,
          ngramOverlap: 0,
          cosineSimilarity: 0,
        },
      };
    }

    // 2. N-gram overlap + cosine similarity (fallback)
    const ngramOverlap = this.calculateNgramOverlap(
      answer,
      evidence,
      this.config.minNgramSize,
    );
    const cosineSim = this.calculateCosineSimilarity(answer, evidence);

    // 3. Weighted combination
    const combinedScore =
      ngramOverlap * this.config.ngramWeight +
      cosineSim * this.config.cosineWeight;

    // 4. Determine method based on score
    let method: AlignmentResult["method"];
    if (combinedScore >= this.config.paraphraseThreshold) {
      method = "paraphrase";
    } else if (combinedScore >= this.config.inferenceThreshold) {
      method = "inference";
    } else {
      method = "unrelated";
    }

    return {
      score: Math.min(combinedScore, 1.0),
      method,
      confidence: 0.7, // Medium confidence for lexical methods
      matchedSpans: [],
      metadata: {
        directQuoteRatio,
        ngramOverlap,
        cosineSimilarity: cosineSim,
      },
    };
  }

  async calculateBatchAlignment(
    items: Array<{ answer: string; evidence: string }>,
  ): Promise<AlignmentResult[]> {
    const results: AlignmentResult[] = [];

    for (const item of items) {
      const result = await this.calculateAlignment(item.answer, item.evidence);
      results.push(result);
    }

    return results;
  }

  /**
   * Calculate n-gram overlap (token-level)
   *
   * Migrated from evidenceQuality.ts:73-112
   */
  private calculateNgramOverlap(
    text1: string,
    text2: string,
    n: number,
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

    // Extract n-grams
    for (let i = 0; i <= tokens1.length - n; i++) {
      ngrams1.add(tokens1.slice(i, i + n).join(" "));
    }

    for (let i = 0; i <= tokens2.length - n; i++) {
      ngrams2.add(tokens2.slice(i, i + n).join(" "));
    }

    // Calculate Jaccard similarity (intersection / union)
    const intersection = new Set(
      [...ngrams1].filter((ngram) => ngrams2.has(ngram)),
    );
    const union = new Set([...ngrams1, ...ngrams2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate cosine similarity (character-level)
   *
   * Migrated from evidenceQuality.ts:115-152
   */
  private calculateCosineSimilarity(text1: string, text2: string): number {
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
   * Get detailed alignment statistics
   */
  async getAlignmentStatistics(
    answer: string,
    evidence: string,
  ): Promise<{
    alignment: AlignmentResult;
    citation: {
      directQuoteRatio: number;
      matchCount: number;
      longestMatch: number;
      hasCitationPattern: boolean;
    };
  }> {
    const alignment = await this.calculateAlignment(answer, evidence);
    const citationStats = this.citationDetector.getCitationStatistics(
      answer,
      evidence,
    );

    return {
      alignment,
      citation: {
        directQuoteRatio: citationStats.directQuoteRatio,
        matchCount: citationStats.matchCount,
        longestMatch: citationStats.longestMatch,
        hasCitationPattern: citationStats.hasCitationPattern,
      },
    };
  }
}
