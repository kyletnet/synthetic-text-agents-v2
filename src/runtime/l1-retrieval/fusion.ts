/**
 * Retrieval Fusion Strategies (Quick Win #5)
 *
 * Implements MMR (Maximal Marginal Relevance) and RRF (Reciprocal Rank Fusion)
 * for combining multiple retrieval result sets.
 *
 * Expected gain: Diversity ↑, Duplication -20%
 *
 * @see RFC 2025-17, Section 1.5
 */

import type { Chunk } from '../types';

/**
 * Fusion configuration
 */
export interface FusionConfig {
  rrf: {
    k: number; // RRF parameter (default: 60)
  };
  mmr: {
    lambda: number; // Relevance vs. diversity trade-off (default: 0.7)
  };
}

const DEFAULT_CONFIG: FusionConfig = {
  rrf: {
    k: 60, // Standard RRF parameter
  },
  mmr: {
    lambda: 0.7, // 70% relevance, 30% diversity
  },
};

/**
 * Retrieval Fusion
 *
 * Combines multiple retrieval result sets using various fusion strategies.
 */
export class RetrievalFusion {
  private config: FusionConfig;

  constructor(config: Partial<FusionConfig> = {}) {
    this.config = {
      rrf: { ...DEFAULT_CONFIG.rrf, ...config.rrf },
      mmr: { ...DEFAULT_CONFIG.mmr, ...config.mmr },
    };
  }

  /**
   * Reciprocal Rank Fusion (RRF)
   *
   * Combines multiple ranked lists by reciprocal rank scoring.
   * Score(d) = Σ 1/(k + rank_i(d)) where k=60 (standard)
   *
   * @param resultSets Array of ranked result sets
   * @param k RRF parameter (default: 60)
   * @returns Fused and re-ranked results
   */
  rrf(resultSets: Chunk[][], k: number = this.config.rrf.k): Chunk[] {
    if (resultSets.length === 0) {
      return [];
    }

    if (resultSets.length === 1) {
      return resultSets[0];
    }

    const scores = new Map<string, number>();
    const chunkMap = new Map<string, Chunk>();

    // Calculate RRF scores
    for (const results of resultSets) {
      results.forEach((chunk, rank) => {
        const currentScore = scores.get(chunk.id) || 0;
        scores.set(chunk.id, currentScore + 1 / (k + rank));

        // Store chunk reference (use first occurrence)
        if (!chunkMap.has(chunk.id)) {
          chunkMap.set(chunk.id, chunk);
        }
      });
    }

    // Sort by RRF score and return chunks
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => {
        const chunk = chunkMap.get(id)!;
        return {
          ...chunk,
          metadata: {
            ...chunk.metadata,
            rrfScore: score,
            fusionStrategy: 'rrf',
          },
        };
      });
  }

  /**
   * Maximal Marginal Relevance (MMR)
   *
   * Iteratively selects chunks that balance relevance and diversity.
   * MMR = argmax [λ*Sim(q,d) - (1-λ)*max Sim(d,d_i)]
   *
   * @param query User query
   * @param candidates Candidate chunks
   * @param topK Number of chunks to select
   * @param lambda Relevance vs. diversity trade-off (default: 0.7)
   * @returns Diversified chunks
   */
  mmr(
    query: string,
    candidates: Chunk[],
    topK: number,
    lambda: number = this.config.mmr.lambda
  ): Chunk[] {
    if (candidates.length === 0) {
      return [];
    }

    const selected: Chunk[] = [];
    const remaining = [...candidates];

    while (selected.length < topK && remaining.length > 0) {
      const nextChunk = this.selectNextMMR(query, remaining, selected, lambda);
      if (!nextChunk) {
        break;
      }

      selected.push(nextChunk);
      const index = remaining.findIndex((c) => c.id === nextChunk.id);
      if (index !== -1) {
        remaining.splice(index, 1);
      }
    }

    return selected.map((chunk, i) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        mmrRank: i,
        fusionStrategy: 'mmr',
      },
    }));
  }

  /**
   * Select next chunk using MMR criterion
   */
  private selectNextMMR(
    query: string,
    candidates: Chunk[],
    selected: Chunk[],
    lambda: number
  ): Chunk | null {
    if (candidates.length === 0) {
      return null;
    }

    let bestChunk: Chunk | null = null;
    let bestScore = -Infinity;

    for (const candidate of candidates) {
      const relevance = this.similarity(query, candidate.text);
      const maxSimilarity =
        selected.length > 0
          ? Math.max(...selected.map((s) => this.similarity(candidate.text, s.text)))
          : 0;

      const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestChunk = candidate;
      }
    }

    return bestChunk;
  }

  /**
   * Calculate text similarity (simplified)
   *
   * TODO: Replace with proper embedding similarity in production
   */
  private similarity(text1: string, text2: string): number {
    // Simple Jaccard similarity as placeholder
    const tokens1 = new Set(text1.toLowerCase().split(/\s+/));
    const tokens2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);

    return intersection.size / union.size;
  }

  /**
   * Hybrid fusion: RRF + MMR
   *
   * 1. Use RRF to combine multiple result sets
   * 2. Use MMR to diversify final selection
   *
   * @param resultSets Array of ranked result sets
   * @param query User query
   * @param topK Number of chunks to return
   * @returns Fused and diversified chunks
   */
  hybrid(resultSets: Chunk[][], query: string, topK: number): Chunk[] {
    // Step 1: RRF fusion
    const rrfResults = this.rrf(resultSets);

    // Step 2: MMR diversification
    const mmrResults = this.mmr(query, rrfResults, topK);

    return mmrResults.map((chunk) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        fusionStrategy: 'hybrid',
      },
    }));
  }

  /**
   * Weighted fusion
   *
   * Combines result sets with explicit weights for each set.
   *
   * @param resultSets Array of ranked result sets
   * @param weights Weight for each result set (must sum to 1.0)
   * @param topK Number of chunks to return
   * @returns Fused chunks
   */
  weighted(resultSets: Chunk[][], weights: number[], topK: number): Chunk[] {
    if (resultSets.length !== weights.length) {
      throw new Error('Number of result sets must match number of weights');
    }

    const sumWeights = weights.reduce((sum, w) => sum + w, 0);
    if (Math.abs(sumWeights - 1.0) > 0.01) {
      throw new Error('Weights must sum to 1.0');
    }

    const scores = new Map<string, number>();
    const chunkMap = new Map<string, Chunk>();

    // Calculate weighted scores
    for (let i = 0; i < resultSets.length; i++) {
      const results = resultSets[i];
      const weight = weights[i];

      results.forEach((chunk, rank) => {
        const currentScore = scores.get(chunk.id) || 0;
        const normalizedRank = (rank + 1) / results.length; // Normalize to [0, 1]
        const rankScore = 1 - normalizedRank; // Higher rank = higher score
        scores.set(chunk.id, currentScore + weight * rankScore);

        if (!chunkMap.has(chunk.id)) {
          chunkMap.set(chunk.id, chunk);
        }
      });
    }

    // Sort and return top-K
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([id, score]) => {
        const chunk = chunkMap.get(id)!;
        return {
          ...chunk,
          metadata: {
            ...chunk.metadata,
            weightedScore: score,
            fusionStrategy: 'weighted',
          },
        };
      });
  }

  /**
   * Get configuration
   */
  getConfig(): FusionConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<FusionConfig>): void {
    this.config = {
      rrf: { ...this.config.rrf, ...config.rrf },
      mmr: { ...this.config.mmr, ...config.mmr },
    };
  }
}

/**
 * Default singleton instance
 */
export const retrievalFusion = new RetrievalFusion();
