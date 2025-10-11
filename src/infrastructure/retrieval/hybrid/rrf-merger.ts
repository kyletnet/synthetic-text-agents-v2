/**
 * RRF (Reciprocal Rank Fusion) Merger
 *
 * Phase 3 Week 3: Hybrid Search Result Merging
 *
 * Algorithm:
 *   RRF(d) = Σ_i ( w_i / (k + rank_i(d)) )
 *
 * where:
 *   - d = document
 *   - w_i = weight for ranker i
 *   - k = smoothing constant (typically 60)
 *   - rank_i(d) = rank of document d in ranker i's results
 *
 * Reference:
 * - Cormack et al. (2009): "Reciprocal Rank Fusion outperforms the best of
 *   its individual input rankings in the presence of  relevance data"
 * - https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 4)
 */

import type { SearchResult, RankedResult } from './types';

/**
 * RRF Configuration
 */
export interface RRFConfig {
  k?: number; // Smoothing constant (default: 60)
  weights?: {
    elastic?: number; // Weight for Elasticsearch results (default: 0.6)
    faiss?: number; // Weight for FAISS results (default: 0.4)
  };
}

/**
 * Resolved RRF Configuration (all properties required)
 */
interface ResolvedRRFConfig {
  k: number;
  weights: {
    elastic: number;
    faiss: number;
  };
}

const DEFAULT_RRF_CONFIG: ResolvedRRFConfig = {
  k: 60,
  weights: {
    elastic: 0.6,
    faiss: 0.4,
  },
};

/**
 * RRF Merger Class
 */
export class RRFMerger {
  private config: ResolvedRRFConfig;

  constructor(config?: RRFConfig) {
    // Explicitly construct config with null coalescing for type safety
    this.config = {
      k: config?.k ?? DEFAULT_RRF_CONFIG.k,
      weights: {
        elastic: config?.weights?.elastic ?? DEFAULT_RRF_CONFIG.weights.elastic,
        faiss: config?.weights?.faiss ?? DEFAULT_RRF_CONFIG.weights.faiss,
      },
    };

    // Validate weights sum to 1.0
    const totalWeight = this.config.weights.elastic + this.config.weights.faiss;
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(
        `RRF weights must sum to 1.0 (current: ${totalWeight}). ` +
        `Got elastic=${this.config.weights.elastic}, faiss=${this.config.weights.faiss}`
      );
    }
  }

  /**
   * Merge results from Elasticsearch and FAISS using RRF
   */
  merge(
    elasticResults: SearchResult[],
    faissResults: SearchResult[],
    topK: number = 10
  ): RankedResult[] {
    // Build document map with RRF scores
    const docScores = new Map<string, {
      doc: SearchResult;
      rrfScore: number;
      elasticRank?: number;
      faissRank?: number;
    }>();

    // Process Elasticsearch results
    elasticResults.forEach((doc, index) => {
      const rank = index + 1; // 1-indexed
      const rrfContribution = this.config.weights.elastic / (this.config.k + rank);

      const existing = docScores.get(doc.id);
      if (existing) {
        existing.rrfScore += rrfContribution;
        existing.elasticRank = rank;
      } else {
        docScores.set(doc.id, {
          doc,
          rrfScore: rrfContribution,
          elasticRank: rank,
        });
      }
    });

    // Process FAISS results
    faissResults.forEach((doc, index) => {
      const rank = index + 1; // 1-indexed
      const rrfContribution = this.config.weights.faiss / (this.config.k + rank);

      const existing = docScores.get(doc.id);
      if (existing) {
        existing.rrfScore += rrfContribution;
        existing.faissRank = rank;
      } else {
        docScores.set(doc.id, {
          doc,
          rrfScore: rrfContribution,
          faissRank: rank,
        });
      }
    });

    // Sort by RRF score (descending)
    const merged = Array.from(docScores.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, topK);

    // Convert to RankedResult format
    return merged.map(item => ({
      ...item.doc,
      originalRank: {
        elastic: item.elasticRank,
        faiss: item.faissRank,
      },
      rrfScore: item.rrfScore,
    }));
  }

  /**
   * Merge multiple result lists (generalized RRF)
   *
   * @param resultLists - Array of [results, weight] tuples
   * @param topK - Number of top results to return
   */
  mergeMultiple(
    resultLists: Array<{ results: SearchResult[]; weight: number }>,
    topK: number = 10
  ): RankedResult[] {
    // Validate weights sum to 1.0
    const totalWeight = resultLists.reduce((sum, { weight }) => sum + weight, 0);
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(
        `RRF weights must sum to 1.0 (current: ${totalWeight}). ` +
        `Got weights: ${resultLists.map(r => r.weight).join(', ')}`
      );
    }

    // Build document map with RRF scores
    const docScores = new Map<string, {
      doc: SearchResult;
      rrfScore: number;
      ranks: number[];
    }>();

    // Process each result list
    resultLists.forEach(({ results, weight }, listIndex) => {
      results.forEach((doc, index) => {
        const rank = index + 1; // 1-indexed
        const rrfContribution = weight / (this.config.k + rank);

        if (!docScores.has(doc.id)) {
          const ranks = new Array(resultLists.length).fill(undefined);
          ranks[listIndex] = rank;
          docScores.set(doc.id, {
            doc,
            rrfScore: rrfContribution,
            ranks,
          });
        } else {
          const existing = docScores.get(doc.id)!;
          existing.rrfScore += rrfContribution;
          existing.ranks[listIndex] = rank;
        }
      });
    });

    // Sort by RRF score (descending)
    const merged = Array.from(docScores.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, topK);

    // Convert to RankedResult format
    return merged.map(item => ({
      ...item.doc,
      originalRank: {
        elastic: item.ranks[0],
        faiss: item.ranks[1],
      },
      rrfScore: item.rrfScore,
    }));
  }

  /**
   * Get current RRF configuration
   */
  getConfig(): ResolvedRRFConfig {
    return { ...this.config };
  }

  /**
   * Update weights dynamically
   */
  updateWeights(weights: { elastic?: number; faiss?: number }): void {
    // Construct new weights with explicit values from config (guaranteed non-null)
    const newWeights = {
      elastic: weights.elastic ?? this.config.weights.elastic,
      faiss: weights.faiss ?? this.config.weights.faiss,
    };

    const totalWeight = newWeights.elastic + newWeights.faiss;
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      throw new Error(
        `RRF weights must sum to 1.0 (current: ${totalWeight}). ` +
        `Got elastic=${newWeights.elastic}, faiss=${newWeights.faiss}`
      );
    }

    this.config.weights = newWeights;
  }

  /**
   * Calculate RRF score for a single document at a given rank
   */
  calculateScore(rank: number, weight: number = 1.0): number {
    return weight / (this.config.k + rank);
  }
}

/**
 * Utility: Create default RRF merger
 */
export function createRRFMerger(config?: RRFConfig): RRFMerger {
  return new RRFMerger(config);
}

/**
 * Utility: Normalize scores to 0-1 range
 */
export function normalizeScores(results: RankedResult[]): RankedResult[] {
  if (results.length === 0) return [];

  const maxScore = Math.max(...results.map(r => r.rrfScore));
  const minScore = Math.min(...results.map(r => r.rrfScore));
  const range = maxScore - minScore;

  if (range === 0) {
    // All scores are the same
    return results.map(r => ({
      ...r,
      rrfScore: 1.0,
    }));
  }

  return results.map(r => ({
    ...r,
    rrfScore: (r.rrfScore - minScore) / range,
  }));
}
