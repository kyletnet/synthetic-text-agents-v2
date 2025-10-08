/**
 * Hybrid Retrieval Orchestrator (L1 Integration)
 *
 * Orchestrates BM25 + Vector + Re-ranking + Fusion for optimal retrieval.
 *
 * Pipeline:
 * 1. BM25 + Vector hybrid search (α=0.6, β=0.4)
 * 2. Cross-Encoder re-ranking (top-50 → top-10)
 * 3. MMR/RRF fusion (diversity optimization)
 *
 * @see RFC 2025-17, Section 1.1
 */

import { CrossEncoderReranker } from './cross-encoder-reranker';
import { RetrievalFusion } from './fusion';
import type { Chunk, RetrievalConfig } from '../types';

/**
 * Hybrid orchestrator configuration
 */
export interface HybridOrchestratorConfig {
  retrieval: RetrievalConfig;
  reranker: {
    enabled: boolean;
    topK: number;
  };
  fusion: {
    strategy: 'rrf' | 'mmr' | 'hybrid' | 'weighted' | 'none';
    topK: number;
  };
}

const DEFAULT_CONFIG: HybridOrchestratorConfig = {
  retrieval: {
    alpha: 0.6, // BM25 weight
    beta: 0.4, // Vector weight
    topK: 50,
    minTrustScore: 0.4,
  },
  reranker: {
    enabled: true,
    topK: 10,
  },
  fusion: {
    strategy: 'hybrid', // RRF + MMR
    topK: 10,
  },
};

/**
 * Hybrid Retrieval Orchestrator
 *
 * Main entry point for L1 retrieval layer.
 */
export class HybridOrchestrator {
  private config: HybridOrchestratorConfig;
  private reranker: CrossEncoderReranker;
  private fusion: RetrievalFusion;

  // Retrieval backends (to be injected)
  private bm25Retriever?: (query: string, topK: number) => Promise<Chunk[]>;
  private vectorRetriever?: (query: string, topK: number) => Promise<Chunk[]>;

  constructor(config: Partial<HybridOrchestratorConfig> = {}) {
    this.config = {
      retrieval: { ...DEFAULT_CONFIG.retrieval, ...config.retrieval },
      reranker: { ...DEFAULT_CONFIG.reranker, ...config.reranker },
      fusion: { ...DEFAULT_CONFIG.fusion, ...config.fusion },
    };

    this.reranker = new CrossEncoderReranker({
      topK: this.config.reranker.topK,
    });

    this.fusion = new RetrievalFusion();
  }

  /**
   * Register BM25 retriever
   */
  registerBM25Retriever(retriever: (query: string, topK: number) => Promise<Chunk[]>): void {
    this.bm25Retriever = retriever;
  }

  /**
   * Register vector retriever
   */
  registerVectorRetriever(retriever: (query: string, topK: number) => Promise<Chunk[]>): void {
    this.vectorRetriever = retriever;
  }

  /**
   * Main retrieval method
   *
   * @param query User query
   * @returns Retrieved and re-ranked chunks
   */
  async retrieve(query: string): Promise<Chunk[]> {
    // Step 1: Hybrid search (BM25 + Vector)
    const candidates = await this.hybridSearch(query, this.config.retrieval.topK);

    // Step 2: Cross-Encoder re-ranking (if enabled)
    let reranked = candidates;
    if (this.config.reranker.enabled && candidates.length > 0) {
      reranked = await this.reranker.rerankChunks(query, candidates, this.config.reranker.topK);
    }

    // Step 3: Fusion (if enabled)
    let fused = reranked;
    if (this.config.fusion.strategy !== 'none') {
      fused = await this.fusionStep(query, [reranked]);
    }

    // Step 4: Filter by trust score
    const filtered = this.filterByTrust(fused, this.config.retrieval.minTrustScore);

    return filtered;
  }

  /**
   * Hybrid search: BM25 + Vector
   *
   * @param query User query
   * @param topK Number of candidates
   * @returns Combined results
   */
  private async hybridSearch(query: string, topK: number): Promise<Chunk[]> {
    const results: Chunk[][] = [];

    // BM25 search
    if (this.bm25Retriever) {
      const bm25Results = await this.bm25Retriever(query, topK);
      results.push(bm25Results);
    }

    // Vector search
    if (this.vectorRetriever) {
      const vectorResults = await this.vectorRetriever(query, topK);
      results.push(vectorResults);
    }

    // Combine with RRF if both retrievers present
    if (results.length === 0) {
      return [];
    } else if (results.length === 1) {
      return results[0];
    } else {
      // Use weighted fusion (α for BM25, β for Vector)
      const weights = [this.config.retrieval.alpha, this.config.retrieval.beta];
      return this.fusion.weighted(results, weights, topK);
    }
  }

  /**
   * Fusion step
   */
  private async fusionStep(query: string, resultSets: Chunk[][]): Promise<Chunk[]> {
    const strategy = this.config.fusion.strategy;
    const topK = this.config.fusion.topK;

    switch (strategy) {
      case 'rrf':
        return this.fusion.rrf(resultSets);
      case 'mmr': {
        // Flatten result sets for MMR
        const candidates = resultSets.flat();
        return this.fusion.mmr(query, candidates, topK);
      }
      case 'hybrid':
        return this.fusion.hybrid(resultSets, query, topK);
      case 'weighted': {
        // Equal weights for simplicity
        const weights = Array(resultSets.length).fill(1 / resultSets.length);
        return this.fusion.weighted(resultSets, weights, topK);
      }
      case 'none':
      default:
        return resultSets.flat().slice(0, topK);
    }
  }

  /**
   * Filter chunks by trust score
   */
  private filterByTrust(chunks: Chunk[], minTrustScore?: number): Chunk[] {
    if (!minTrustScore) {
      return chunks;
    }

    return chunks.filter((c) => (c.trustScore ?? 1.0) >= minTrustScore);
  }

  /**
   * Get configuration
   */
  getConfig(): HybridOrchestratorConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HybridOrchestratorConfig>): void {
    this.config = {
      retrieval: { ...this.config.retrieval, ...config.retrieval },
      reranker: { ...this.config.reranker, ...config.reranker },
      fusion: { ...this.config.fusion, ...config.fusion },
    };
  }

  /**
   * Get status
   */
  getStatus(): {
    rerankerInitialized: boolean;
    bm25Registered: boolean;
    vectorRegistered: boolean;
    config: HybridOrchestratorConfig;
  } {
    return {
      rerankerInitialized: this.reranker.getStatus().initialized,
      bm25Registered: !!this.bm25Retriever,
      vectorRegistered: !!this.vectorRetriever,
      config: this.config,
    };
  }
}

/**
 * Default singleton instance
 */
export const hybridOrchestrator = new HybridOrchestrator();
