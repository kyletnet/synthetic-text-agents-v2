/**
 * Cross-Encoder Re-ranker (Quick Win #1)
 *
 * Uses bge-reranker-large to re-rank retrieval candidates.
 * Expected gain: Groundedness +8-12%p
 *
 * Model: BAAI/bge-reranker-large (550MB)
 * Latency: ~50-150ms per batch (depends on batch size)
 *
 * @see RFC 2025-17, Section 1.1
 */

// @ts-expect-error - @xenova/transformers not installed yet
import { pipeline } from '@xenova/transformers';
import type { Chunk, RerankResult } from '../types';

/**
 * Configuration for Cross-Encoder re-ranking
 */
export interface CrossEncoderConfig {
  modelName: string;
  topK: number;
  batchSize: number;
  minScore?: number;
  enableCaching?: boolean;
}

const DEFAULT_CONFIG: CrossEncoderConfig = {
  modelName: 'BAAI/bge-reranker-large',
  topK: 10,
  batchSize: 32,
  minScore: 0.3, // Filter out low-relevance chunks
  enableCaching: true,
};

/**
 * Cross-Encoder Re-ranker
 *
 * Re-ranks retrieval candidates using a cross-encoder model.
 * More accurate than bi-encoder (vector) but slower.
 */
export class CrossEncoderReranker {
  private model: any = null;
  private config: CrossEncoderConfig;
  private isInitialized = false;
  private cache = new Map<string, number>();

  constructor(config: Partial<CrossEncoderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the model (lazy load)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load cross-encoder model (text-classification task)
      this.model = await pipeline(
        'text-classification',
        this.config.modelName,
        {
          quantized: true, // Use quantized model for speed
        }
      );
      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize CrossEncoderReranker: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Re-rank chunks using cross-encoder
   *
   * @param query User query
   * @param chunks Candidate chunks to re-rank
   * @param topK Number of top chunks to return
   * @returns Re-ranked chunks with scores
   */
  async rerank(
    query: string,
    chunks: Chunk[],
    topK: number = this.config.topK
  ): Promise<RerankResult[]> {
    // Ensure model is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (chunks.length === 0) {
      return [];
    }

    // Build query-chunk pairs
    const pairs: [string, string][] = chunks.map((c) => [query, c.text] as [string, string]);

    // Check cache
    const scores = await this.scorePairs(pairs);

    // Build results with original and new ranks
    const results = chunks
      .map((c, i) => ({
        chunkId: c.id,
        score: scores[i],
        originalRank: i,
        newRank: -1,
      }))
      .filter((r) => r.score >= (this.config.minScore ?? 0)) // Filter low scores
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, topK) // Take top-K
      .map((r, i) => ({ ...r, newRank: i })); // Assign new ranks

    return results;
  }

  /**
   * Score query-chunk pairs
   *
   * @param pairs Array of [query, chunk] pairs
   * @returns Array of relevance scores
   */
  private async scorePairs(pairs: [string, string][]): Promise<number[]> {
    const scores: number[] = [];

    // Process in batches for efficiency
    for (let i = 0; i < pairs.length; i += this.config.batchSize) {
      const batch = pairs.slice(i, i + this.config.batchSize);

      // Check cache first
      const batchScores = await Promise.all(
        batch.map(async ([query, chunk]) => {
          const cacheKey = this.getCacheKey(query, chunk);
          if (this.config.enableCaching && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey)!;
          }

          // Score pair
          const result = await this.model([query, chunk]);
          const score = result.score ?? result[0]?.score ?? 0;

          // Cache result
          if (this.config.enableCaching) {
            this.cache.set(cacheKey, score);
          }

          return score;
        })
      );

      scores.push(...batchScores);
    }

    return scores;
  }

  /**
   * Get reranked chunks (convenience method)
   *
   * @param query User query
   * @param chunks Candidate chunks
   * @param topK Number of top chunks to return
   * @returns Reranked chunks
   */
  async rerankChunks(
    query: string,
    chunks: Chunk[],
    topK: number = this.config.topK
  ): Promise<Chunk[]> {
    const results = await this.rerank(query, chunks, topK);

    // Map back to original chunks
    return results.map((r) => {
      const chunk = chunks.find((c) => c.id === r.chunkId)!;
      return {
        ...chunk,
        metadata: {
          ...chunk.metadata,
          rerankScore: r.score,
          originalRank: r.originalRank,
          newRank: r.newRank,
        },
      };
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache key for query-chunk pair
   */
  private getCacheKey(query: string, chunk: string): string {
    // Simple hash (use crypto.createHash in production)
    return `${query.substring(0, 50)}_${chunk.substring(0, 50)}`;
  }

  /**
   * Get model status
   */
  getStatus(): {
    initialized: boolean;
    cacheSize: number;
    modelName: string;
  } {
    return {
      initialized: this.isInitialized,
      cacheSize: this.cache.size,
      modelName: this.config.modelName,
    };
  }
}

/**
 * Default singleton instance
 */
export const crossEncoderReranker = new CrossEncoderReranker();
