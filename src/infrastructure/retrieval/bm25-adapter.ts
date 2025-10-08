/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * BM25 Retrieval Adapter
 *
 * Purpose:
 * - Wraps existing BM25 retrieval logic
 * - Implements RetrievalPort interface
 * - Provides keyword-based search
 *
 * Phase 1.5: Retrieval Integration
 */

import {
  type RetrievalPort,
  type RetrievalOptions,
  type RetrievalResult,
  type RetrievalStats,
  type ScoredChunk,
  validateRetrievalOptions,
} from "../../domain/ports/retrieval-port.js";
import { retrieve, type RetrieveOptions } from "../../rag/retrieve.js";
import type { Chunk } from "../../rag/chunk.js";
import { SourceTrust } from "./source-trust.js";
import { PoisoningGuard } from "./poisoning-guard.js";

/**
 * BM25 Adapter Statistics
 */
interface BM25Stats {
  totalQueries: number;
  totalDuration: number;
  strategyCount: { bm25: number };
}

/**
 * BM25 Adapter
 *
 * Implements RetrievalPort using BM25 algorithm
 */
export class BM25Adapter implements RetrievalPort {
  readonly version = 1 as const;

  private corpus: Chunk[] = [];
  private sourceTrust: SourceTrust;
  private poisoningGuard: PoisoningGuard;
  private adapterStats: BM25Stats = {
    totalQueries: 0,
    totalDuration: 0,
    strategyCount: { bm25: 0 },
  };

  constructor(
    corpus: Chunk[],
    sourceTrust?: SourceTrust,
    poisoningGuard?: PoisoningGuard,
  ) {
    this.corpus = corpus;
    this.sourceTrust = sourceTrust || new SourceTrust();
    this.poisoningGuard = poisoningGuard || new PoisoningGuard();
  }

  /**
   * Retrieve chunks using BM25
   */
  async retrieve(
    query: string,
    options?: RetrievalOptions,
  ): Promise<RetrievalResult> {
    const start = Date.now();
    const opts = validateRetrievalOptions(options);

    // Convert to BM25 options
    const bm25Options: RetrieveOptions = {
      topK: opts.topK * 2, // Get more candidates for filtering
      minScore: opts.minScore,
      algorithm: "bm25",
    };

    // Retrieve using BM25
    const bm25Results = retrieve(query, this.corpus, bm25Options);

    // Apply trust & poison filtering
    const scoredChunks: ScoredChunk[] = [];

    for (const result of bm25Results) {
      // Trust scoring
      const trustScore = this.sourceTrust.scoreChunk(result.chunk);

      // Poison check
      const poisonCheck = this.poisoningGuard.check(result.chunk);

      // Skip if poisoned
      if (!poisonCheck.passed) {
        continue;
      }

      // Apply trust threshold
      if (opts.filters?.trustThreshold !== undefined) {
        if (trustScore.score < opts.filters.trustThreshold) {
          continue;
        }
      }

      scoredChunks.push({
        chunk: result.chunk,
        relevanceScore: result.score,
        trustScore,
        poisonCheck,
        strategy: "bm25",
      });
    }

    // Limit to topK
    const finalChunks = scoredChunks.slice(0, opts.topK);

    // Calculate metadata
    const avgTrustScore =
      finalChunks.length > 0
        ? finalChunks.reduce((sum, c) => sum + c.trustScore.score, 0) /
          finalChunks.length
        : 0;

    const poisonedBlocked = bm25Results.length - scoredChunks.length;

    const duration = Date.now() - start;

    // Update stats
    this.adapterStats.totalQueries++;
    this.adapterStats.totalDuration += duration;
    this.adapterStats.strategyCount.bm25++;

    return {
      query,
      chunks: finalChunks,
      metadata: {
        strategy: "bm25",
        duration,
        totalCandidates: bm25Results.length,
        filteredCount: scoredChunks.length,
        avgTrustScore,
        poisonedBlocked,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Batch retrieve (parallel execution)
   */
  async batchRetrieve(
    queries: string[],
    options?: RetrievalOptions,
  ): Promise<RetrievalResult[]> {
    const results = await Promise.all(
      queries.map((query) => this.retrieve(query, options)),
    );

    return results;
  }

  /**
   * Get statistics
   */
  stats(): RetrievalStats {
    const avgDuration =
      this.adapterStats.totalQueries > 0
        ? this.adapterStats.totalDuration / this.adapterStats.totalQueries
        : 0;

    return {
      totalQueries: this.adapterStats.totalQueries,
      totalChunks: this.corpus.length,
      avgDuration,
      cacheHitRate: 0, // BM25 has no cache
      strategyBreakdown: {
        bm25: this.adapterStats.strategyCount.bm25,
        vector: 0,
        hybrid: 0,
      },
      trustScoreDistribution: {
        high: 0, // TODO: track in real-time
        medium: 0,
        low: 0,
      },
      poisonedBlocked: 0, // TODO: track
    };
  }

  /**
   * Update corpus
   */
  updateCorpus(corpus: Chunk[]): void {
    this.corpus = corpus;
  }

  /**
   * Health check
   */
  async health(): Promise<{ healthy: boolean; message?: string }> {
    if (this.corpus.length === 0) {
      return {
        healthy: false,
        message: "Corpus is empty",
      };
    }

    return {
      healthy: true,
      message: `BM25 adapter ready with ${this.corpus.length} chunks`,
    };
  }
}
