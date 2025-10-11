/**
 * Confidence Detector
 *
 * Phase 3 Week 4: Detect if retrieved context is sufficient for answer generation
 *
 * Methods:
 * - Heuristic-based (fast, no API calls)
 * - LLM-based (accurate, uses API)
 *
 * Heuristics:
 * 1. Score distribution (are top results well-separated?)
 * 2. Content overlap (how much redundancy?)
 * 3. Query-context similarity (basic keyword matching)
 * 4. Minimum score threshold
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 5)
 */

import type { SearchResult } from '../../infrastructure/retrieval/hybrid/types';
import type { ConfidenceResult } from './types';

/**
 * Confidence Detector Configuration
 */
export interface ConfidenceDetectorConfig {
  /** Method: 'heuristic' (fast) or 'llm' (accurate) */
  method: 'heuristic' | 'llm';

  /** Minimum score for top result */
  minTopScore: number;

  /** Minimum average score for all results */
  minAverageScore: number;

  /** Maximum score variance (too high = uncertain) */
  maxScoreVariance: number;

  /** Minimum content coverage (keyword overlap) */
  minContentCoverage: number;

  /** LLM API configuration (if method === 'llm') */
  llmConfig?: {
    apiKey: string;
    model: string;
    endpoint?: string;
  };
}

/**
 * Default Configuration
 */
const DEFAULT_CONFIG: ConfidenceDetectorConfig = {
  method: 'heuristic',
  minTopScore: 0.5,
  minAverageScore: 0.3,
  maxScoreVariance: 0.3,
  minContentCoverage: 0.4,
};

/**
 * Confidence Detector
 */
export class ConfidenceDetector {
  private config: ConfidenceDetectorConfig;

  constructor(config?: Partial<ConfidenceDetectorConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Detect confidence level for given query and results
   */
  async detect(query: string, results: SearchResult[]): Promise<ConfidenceResult> {
    if (this.config.method === 'heuristic') {
      return this.detectHeuristic(query, results);
    } else {
      return this.detectLLM(query, results);
    }
  }

  /**
   * Heuristic-based confidence detection (fast, no API)
   */
  private detectHeuristic(query: string, results: SearchResult[]): ConfidenceResult {
    const issues: ConfidenceResult['issues'] = [];
    let confidence = 1.0;

    // Check 1: Empty results
    if (results.length === 0) {
      issues.push({
        type: 'no_answer_possible',
        severity: 'high',
        message: 'No results found for query',
      });
      return {
        confidence: 0,
        isSufficient: false,
        issues,
        recommendation: 'expand_k',
      };
    }

    // Check 2: Top score threshold
    const topScore = results[0].score;
    if (topScore < this.config.minTopScore) {
      confidence *= 0.7;
      issues.push({
        type: 'low_relevance',
        severity: 'high',
        message: `Top score ${topScore.toFixed(3)} below threshold ${this.config.minTopScore}`,
      });
    }

    // Check 3: Average score
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    if (avgScore < this.config.minAverageScore) {
      confidence *= 0.8;
      issues.push({
        type: 'low_relevance',
        severity: 'medium',
        message: `Average score ${avgScore.toFixed(3)} below threshold ${this.config.minAverageScore}`,
      });
    }

    // Check 4: Score variance (too high = uncertain ranking)
    const scoreVariance = this.calculateVariance(results.map(r => r.score));
    if (scoreVariance > this.config.maxScoreVariance) {
      confidence *= 0.9;
      issues.push({
        type: 'insufficient_context',
        severity: 'low',
        message: `High score variance ${scoreVariance.toFixed(3)} indicates uncertain ranking`,
      });
    }

    // Check 5: Content coverage (keyword matching)
    const coverage = this.calculateContentCoverage(query, results);
    if (coverage < this.config.minContentCoverage) {
      confidence *= 0.7;
      issues.push({
        type: 'insufficient_context',
        severity: 'high',
        message: `Low content coverage ${coverage.toFixed(3)} - retrieved context may not address query`,
      });
    }

    // Check 6: Result diversity (avoid redundancy)
    const diversity = this.calculateDiversity(results);
    if (diversity < 0.3) {
      confidence *= 0.85;
      issues.push({
        type: 'insufficient_context',
        severity: 'medium',
        message: `Low diversity ${diversity.toFixed(3)} - results are too similar`,
      });
    }

    // Determine recommendation
    let recommendation: ConfidenceResult['recommendation'];

    if (confidence >= 0.8) {
      recommendation = 'proceed';
    } else if (confidence >= 0.5 && results.length < 6) {
      recommendation = 'expand_k';
    } else if (coverage < 0.2) {
      recommendation = 'rephrase_query';
    } else {
      recommendation = 'fallback';
    }

    return {
      confidence,
      isSufficient: confidence >= 0.7,
      issues,
      recommendation,
    };
  }

  /**
   * LLM-based confidence detection (accurate, uses API)
   *
   * TODO: Implement when LLM evaluation is needed
   */
  private async detectLLM(query: string, results: SearchResult[]): Promise<ConfidenceResult> {
    // For now, fallback to heuristic
    // In the future, call LLM to evaluate:
    // - Query clarity
    // - Context relevance
    // - Answer possibility
    console.warn('LLM-based confidence detection not yet implemented, using heuristic fallback');
    return this.detectHeuristic(query, results);
  }

  /**
   * Calculate variance of scores
   */
  private calculateVariance(scores: number[]): number {
    if (scores.length === 0) return 0;

    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const squaredDiffs = scores.map(s => Math.pow(s - mean, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / scores.length;

    return variance;
  }

  /**
   * Calculate content coverage (keyword matching)
   */
  private calculateContentCoverage(query: string, results: SearchResult[]): number {
    // Extract keywords from query
    const queryKeywords = this.extractKeywords(query);

    if (queryKeywords.length === 0) return 1.0;

    // Check how many keywords appear in results
    const allContent = results.map(r => r.content.toLowerCase()).join(' ');
    const matchedKeywords = queryKeywords.filter(kw =>
      allContent.includes(kw.toLowerCase())
    );

    return matchedKeywords.length / queryKeywords.length;
  }

  /**
   * Extract keywords from text (basic)
   */
  private extractKeywords(text: string): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      '은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '으로', '와', '과',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    ]);

    const words = text
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^\w가-힣]/g, ''))
      .filter(w => w.length > 1 && !stopWords.has(w));

    return [...new Set(words)]; // Unique keywords
  }

  /**
   * Calculate diversity of results (avoid redundancy)
   */
  private calculateDiversity(results: SearchResult[]): number {
    if (results.length <= 1) return 1.0;

    // Calculate pairwise similarity and return average dissimilarity
    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        const similarity = this.calculateSimilarity(
          results[i].content,
          results[j].content
        );
        totalSimilarity += similarity;
        pairCount++;
      }
    }

    const avgSimilarity = pairCount > 0 ? totalSimilarity / pairCount : 0;
    return 1 - avgSimilarity; // Diversity = 1 - Similarity
  }

  /**
   * Calculate Jaccard similarity between two texts
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(this.extractKeywords(text1));
    const words2 = new Set(this.extractKeywords(text2));

    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConfidenceDetectorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

/**
 * Create confidence detector with default configuration
 */
export function createConfidenceDetector(
  config?: Partial<ConfidenceDetectorConfig>
): ConfidenceDetector {
  return new ConfidenceDetector(config);
}
