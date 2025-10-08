/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Retrieval Port - V1 (FROZEN)
 *
 * Purpose:
 * - Domain abstraction for retrieval operations
 * - Frozen interface for upper layer stability
 * - Adapter implementations can vary (BM25, Vector, Hybrid)
 *
 * Phase 1.5: Retrieval Integration
 *
 * IMPORTANT: This is V1 and FROZEN. Do not modify without version bump.
 */

import type { Chunk } from "../../rag/chunk.js";

/**
 * Retrieval Strategy
 */
export type RetrievalStrategy = "bm25" | "vector" | "hybrid";

/**
 * Retrieval Filters
 */
export interface RetrievalFilters {
  domains?: string[]; // Filter by domain (e.g., ["docs.company.com"])
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  authors?: string[]; // Filter by author
  tags?: string[]; // Filter by metadata tags
  trustThreshold?: number; // Minimum trust score (0-1)
}

/**
 * Retrieval Options
 */
export interface RetrievalOptions {
  topK?: number; // Number of results (default: 5)
  strategy?: RetrievalStrategy; // Retrieval strategy (default: "hybrid")
  filters?: RetrievalFilters; // Optional filters
  includeMetadata?: boolean; // Include chunk metadata (default: true)
  minScore?: number; // Minimum relevance score (default: 0.01)
}

/**
 * Trust Score
 */
export interface TrustScore {
  chunkId: string;
  score: number; // 0-1 (composite trust score)
  factors: {
    domainTrust: number; // 0-1 (whitelisted domain bonus)
    signatureValid: boolean; // Cryptographic signature validation
    timeFreshness: number; // 0-1 (age penalty, 1=fresh, 0.7=1yr old)
    authorReputation: number; // 0-1 (known author bonus)
  };
  metadata?: {
    domain?: string;
    signature?: string;
    timestamp?: Date;
    author?: string;
  };
}

/**
 * Poison Check Result
 */
export interface PoisonCheck {
  passed: boolean;
  blocked: string[]; // Reasons for blocking
  warnings: string[]; // Non-blocking warnings
  metadata?: {
    forbiddenMatches?: string[];
    anomalyScore?: number;
  };
}

/**
 * Scored Chunk (with trust & poison check)
 */
export interface ScoredChunk {
  chunk: Chunk;
  relevanceScore: number; // 0-1 (relevance to query)
  trustScore: TrustScore;
  poisonCheck: PoisonCheck;
  strategy: string; // "bm25", "vector", or "hybrid"
}

/**
 * Retrieval Result
 */
export interface RetrievalResult {
  query: string;
  chunks: ScoredChunk[];
  metadata: {
    strategy: RetrievalStrategy;
    duration: number; // ms
    totalCandidates: number; // Candidates before filtering
    filteredCount: number; // Candidates after filtering
    avgTrustScore: number; // Average trust score
    poisonedBlocked: number; // Number of poisoned chunks blocked
    timestamp: Date;
  };
}

/**
 * Retrieval Statistics
 */
export interface RetrievalStats {
  totalQueries: number;
  totalChunks: number;
  avgDuration: number; // ms
  cacheHitRate: number; // 0-1
  strategyBreakdown: Record<RetrievalStrategy, number>; // Query count per strategy
  trustScoreDistribution: {
    high: number; // ≥ 0.7
    medium: number; // 0.4-0.7
    low: number; // < 0.4
  };
  poisonedBlocked: number;
}

/**
 * Retrieval Port (V1 - FROZEN)
 *
 * All retrieval implementations MUST implement this interface.
 */
export interface RetrievalPort {
  /**
   * Version (frozen at V1)
   */
  readonly version: 1;

  /**
   * Retrieve chunks for a single query
   *
   * @param query - Search query
   * @param options - Retrieval options
   * @returns Retrieval result with scored chunks
   */
  retrieve(query: string, options?: RetrievalOptions): Promise<RetrievalResult>;

  /**
   * Retrieve chunks for multiple queries (batch)
   *
   * @param queries - Array of search queries
   * @param options - Retrieval options
   * @returns Array of retrieval results
   */
  batchRetrieve(
    queries: string[],
    options?: RetrievalOptions,
  ): Promise<RetrievalResult[]>;

  /**
   * Get retrieval statistics
   *
   * @returns Current retrieval statistics
   */
  stats(): RetrievalStats;

  /**
   * Clear cache (if applicable)
   */
  clearCache?(): void;

  /**
   * Health check
   *
   * @returns Health status
   */
  health?(): Promise<{ healthy: boolean; message?: string }>;
}

/**
 * Default retrieval options
 */
export const DEFAULT_RETRIEVAL_OPTIONS: Required<
  Omit<RetrievalOptions, "filters">
> = {
  topK: 5,
  strategy: "hybrid",
  includeMetadata: true,
  minScore: 0.01,
};

/**
 * Default trust threshold for filtering
 */
export const DEFAULT_TRUST_THRESHOLD = 0.6;

/**
 * Validate retrieval options
 *
 * @param options - Options to validate
 * @returns Validated options with defaults
 */
export function validateRetrievalOptions(
  options?: RetrievalOptions,
): Required<Omit<RetrievalOptions, "filters">> & Pick<RetrievalOptions, "filters"> {
  return {
    ...DEFAULT_RETRIEVAL_OPTIONS,
    ...options,
    filters: options?.filters,
  };
}

/**
 * Calculate composite trust score
 *
 * @param factors - Trust factors
 * @returns Composite score (0-1)
 */
export function calculateCompositeTrustScore(factors: TrustScore["factors"]): number {
  // Weighted average:
  // - Domain: 40%
  // - Signature: 30%
  // - Freshness: 20%
  // - Author: 10%

  const weights = {
    domain: 0.4,
    signature: 0.3,
    time: 0.2,
    author: 0.1,
  };

  const signatureScore = factors.signatureValid ? 1.0 : 0.0;

  return (
    factors.domainTrust * weights.domain +
    signatureScore * weights.signature +
    factors.timeFreshness * weights.time +
    factors.authorReputation * weights.author
  );
}

/**
 * Filter chunks by trust threshold
 *
 * @param chunks - Scored chunks
 * @param threshold - Minimum trust score (default: 0.6)
 * @returns Filtered chunks
 */
export function filterByTrust(
  chunks: ScoredChunk[],
  threshold: number = DEFAULT_TRUST_THRESHOLD,
): ScoredChunk[] {
  return chunks.filter((chunk) => chunk.trustScore.score >= threshold);
}

/**
 * Filter chunks by poison check
 *
 * @param chunks - Scored chunks
 * @returns Non-poisoned chunks
 */
export function filterByPoisonCheck(chunks: ScoredChunk[]): ScoredChunk[] {
  return chunks.filter((chunk) => chunk.poisonCheck.passed);
}

/**
 * Sort chunks by relevance score
 *
 * @param chunks - Scored chunks
 * @returns Sorted chunks (highest first)
 */
export function sortByRelevance(chunks: ScoredChunk[]): ScoredChunk[] {
  return [...chunks].sort((a, b) => b.relevanceScore - a.relevanceScore);
}

/**
 * Sort chunks by trust score
 *
 * @param chunks - Scored chunks
 * @returns Sorted chunks (highest first)
 */
export function sortByTrust(chunks: ScoredChunk[]): ScoredChunk[] {
  return [...chunks].sort((a, b) => b.trustScore.score - a.trustScore.score);
}
