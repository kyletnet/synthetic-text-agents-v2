/**
 * Hybrid Search Engine
 *
 * Phase 3 Week 3: Orchestrates Elasticsearch + FAISS + RRF
 * Phase 6 Day 4: Context-Aware Subtree Retrieval 통합
 *
 * Architecture:
 *   Query → [Elasticsearch | FAISS] → RRF Merger → Subtree Enrichment → Results
 *                     ↓
 *               (parallel)
 *
 * Features:
 * - Parallel search execution
 * - RRF-based result merging
 * - Context-Aware Subtree Retrieval (Phase 6)
 * - Caching layer
 * - Metrics tracking
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 4)
 */

import type {
  SearchEngine,
  SearchQuery,
  SearchResult,
  RankedResult,
  HybridSearchConfig,
} from './types';
import { RRFMerger } from './rrf-merger';
import { SubtreeRetriever } from './subtree-retriever';

/**
 * Search Metrics
 */
export interface SearchMetrics {
  totalQueries: number;
  elasticTime: number; // ms
  faissTime: number; // ms
  mergeTime: number; // ms
  cacheHits: number;
  cacheMisses: number;
  averageLatency: number; // ms
}

/**
 * Hybrid Search Engine
 */
export class HybridSearchEngine {
  private elasticClient: SearchEngine;
  private faissClient: SearchEngine;
  private rrfMerger: RRFMerger;
  private subtreeRetriever: SubtreeRetriever; // Phase 6: Subtree Retrieval
  private allIndexedDocuments: SearchResult[] = []; // Phase 6: 전체 청크 저장
  private enableSubtreeRetrieval: boolean = true; // Phase 6: 활성화 플래그
  private cache: Map<string, RankedResult[]> = new Map();
  private cacheTTL: number = 60000; // 1 minute
  private cacheTimestamps: Map<string, number> = new Map();

  private metrics: SearchMetrics = {
    totalQueries: 0,
    elasticTime: 0,
    faissTime: 0,
    mergeTime: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageLatency: 0,
  };

  constructor(
    elasticClient: SearchEngine,
    faissClient: SearchEngine,
    config?: Partial<HybridSearchConfig>
  ) {
    this.elasticClient = elasticClient;
    this.faissClient = faissClient;

    // Initialize RRF merger
    this.rrfMerger = new RRFMerger({
      k: config?.rrf?.k,
      weights: config?.rrf?.weights,
    });

    // Phase 6: Initialize Subtree Retriever
    this.subtreeRetriever = new SubtreeRetriever({
      enrichSections: config?.subtree?.enrichSections ?? true,
      enrichTables: config?.subtree?.enrichTables ?? true,
      enrichParagraphs: config?.subtree?.enrichParagraphs ?? true,
      paragraphRadius: config?.subtree?.paragraphRadius ?? 1,
      maxTokenIncrease: config?.subtree?.maxTokenIncrease ?? 0.3,
    });

    // Subtree Retrieval 활성화 여부 (환경 변수로 제어 가능)
    this.enableSubtreeRetrieval = process.env.ENABLE_SUBTREE_RETRIEVAL !== 'false';
  }

  /**
   * Search using hybrid approach (Elasticsearch + FAISS)
   */
  async search(query: SearchQuery): Promise<RankedResult[]> {
    const startTime = performance.now();
    this.metrics.totalQueries++;

    // Check cache
    const cacheKey = this.getCacheKey(query);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }

    this.metrics.cacheMisses++;

    // Run searches in parallel
    const [elasticResults, faissResults] = await Promise.all([
      this.searchElastic(query),
      this.searchFAISS(query),
    ]);

    // Merge results using RRF
    const mergeStart = performance.now();
    let merged = this.rrfMerger.merge(elasticResults, faissResults, query.k || 10);
    const mergeEnd = performance.now();

    this.metrics.mergeTime += mergeEnd - mergeStart;

    // Phase 6: Context-Aware Subtree Retrieval
    if (this.enableSubtreeRetrieval && this.allIndexedDocuments.length > 0) {
      // Convert SearchResult[] to RankedResult[] for SubtreeRetriever
      const allChunksForRetrieval = this.allIndexedDocuments.map(doc => ({
        ...doc,
        score: 0,
        originalRank: {},
        rrfScore: 0,
      } as RankedResult));

      this.subtreeRetriever.setAllChunks(allChunksForRetrieval);
      merged = await this.subtreeRetriever.enrichContext(merged);
    }

    // Cache results
    this.cache.set(cacheKey, merged);
    this.cacheTimestamps.set(cacheKey, Date.now());

    // Update metrics
    const endTime = performance.now();
    const latency = endTime - startTime;
    this.metrics.averageLatency =
      (this.metrics.averageLatency * (this.metrics.totalQueries - 1) + latency) /
      this.metrics.totalQueries;

    return merged;
  }

  /**
   * Search using Elasticsearch only
   */
  private async searchElastic(query: SearchQuery): Promise<SearchResult[]> {
    const start = performance.now();
    const results = await this.elasticClient.search(query);
    const end = performance.now();

    this.metrics.elasticTime += end - start;
    return results;
  }

  /**
   * Search using FAISS only
   */
  private async searchFAISS(query: SearchQuery): Promise<SearchResult[]> {
    const start = performance.now();
    const results = await this.faissClient.search(query);
    const end = performance.now();

    this.metrics.faissTime += end - start;
    return results;
  }

  /**
   * Index documents in both Elasticsearch and FAISS
   */
  async index(
    documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    // Phase 6: 전체 문서 저장 (Subtree Retrieval용)
    this.allIndexedDocuments = documents.map(doc => ({
      id: doc.id,
      content: doc.content,
      score: 0, // Indexed documents have no score yet
      metadata: doc.metadata || {},
    }));

    // Index in parallel
    await Promise.all([
      this.elasticClient.index(documents),
      this.faissClient.index(documents),
    ]);

    // Clear cache after re-indexing
    this.clearCache();
  }

  /**
   * Close both clients
   */
  async close(): Promise<void> {
    await Promise.all([
      this.elasticClient.close(),
      this.faissClient.close(),
    ]);

    this.clearCache();
  }

  /**
   * Get search metrics
   */
  getMetrics(): SearchMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalQueries: 0,
      elasticTime: 0,
      faissTime: 0,
      mergeTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageLatency: 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Set cache TTL (time to live)
   */
  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  /**
   * Update RRF weights dynamically
   */
  updateWeights(weights: { elastic?: number; faiss?: number }): void {
    this.rrfMerger.updateWeights(weights);
    this.clearCache(); // Clear cache as rankings will change
  }

  /**
   * Phase 6: Enable/Disable Subtree Retrieval
   */
  setSubtreeRetrievalEnabled(enabled: boolean): void {
    this.enableSubtreeRetrieval = enabled;
    this.clearCache(); // Clear cache as results will change
  }

  /**
   * Phase 6: Get Subtree Retrieval status
   */
  isSubtreeRetrievalEnabled(): boolean {
    return this.enableSubtreeRetrieval;
  }

  // Private helper methods

  private getCacheKey(query: SearchQuery): string {
    return JSON.stringify({
      query: query.query,
      k: query.k,
      filters: query.filters,
      minScore: query.minScore,
    });
  }

  private getFromCache(key: string): RankedResult[] | null {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return null;

    // Check if cache entry is still valid
    if (Date.now() - timestamp > this.cacheTTL) {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return null;
    }

    return this.cache.get(key) || null;
  }
}

/**
 * Create Hybrid Search Engine with default configuration
 */
export function createHybridSearchEngine(
  elasticClient: SearchEngine,
  faissClient: SearchEngine,
  config?: Partial<HybridSearchConfig>
): HybridSearchEngine {
  return new HybridSearchEngine(elasticClient, faissClient, config);
}
