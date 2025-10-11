/**
 * Hybrid Search Types
 *
 * Phase 3 Week 3-4: Hybrid Search (Elasticsearch + FAISS + RRF)
 *
 * Architecture:
 * - Tier 1: Elasticsearch (BM25F + Field Boosting) - Lexical precision
 * - Tier 2: FAISS (HNSW Index) - Semantic speed
 * - Tier 3: BGE Reranker (Cross-Encoder) - Final accuracy
 * - Merger: Reciprocal Rank Fusion (RRF)
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md
 */

/**
 * Search Result from any retrieval engine
 */
export interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata: {
    page?: number;
    section?: string;
    type?: 'paragraph' | 'table' | 'list' | 'figure';
    [key: string]: unknown;
  };
}

/**
 * Search Query
 */
export interface SearchQuery {
  query: string;
  k?: number; // Top-K results
  filters?: Record<string, unknown>; // Metadata filters
  minScore?: number; // Score threshold
}

/**
 * Elasticsearch Configuration
 */
export interface ElasticsearchConfig {
  url: string;
  apiKey?: string;
  indexName: string;
  fieldBoosts?: {
    title?: number;
    heading?: number;
    body?: number;
    table?: number;
  };
}

/**
 * FAISS Configuration
 */
export interface FAISSConfig {
  indexPath: string; // Path to FAISS index file
  embeddingModel: string; // e.g., 'multilingual-e5-large'
  dimension: number; // Vector dimension
  metric?: 'cosine' | 'l2' | 'ip'; // Distance metric
}

/**
 * Reranker Configuration
 */
export interface RerankerConfig {
  model: string; // e.g., 'BAAI/bge-reranker-v2-m3'
  apiKey?: string; // If using API
  maxInputLength?: number;
}

/**
 * Subtree Retrieval Configuration (Phase 6)
 */
export interface SubtreeRetrievalConfig {
  enrichSections?: boolean; // Section 청크에 상위 제목 첨부 (default: true)
  enrichTables?: boolean; // Table 청크에 헤더/캡션 첨부 (default: true)
  enrichParagraphs?: boolean; // Paragraph 청크에 주변 문단 첨부 (default: true)
  paragraphRadius?: number; // 주변 문단 범위 (±N, default: 1)
  maxTokenIncrease?: number; // 최대 Token 증가율 (default: 0.3 = 30%)
}

/**
 * Hybrid Search Configuration
 */
export interface HybridSearchConfig {
  elasticsearch: ElasticsearchConfig;
  faiss: FAISSConfig;
  reranker?: RerankerConfig;
  rrf: {
    k?: number; // RRF parameter (default: 60)
    weights?: {
      elastic?: number;
      faiss?: number;
    };
  };
  subtree?: SubtreeRetrievalConfig; // Phase 6: Subtree Retrieval
}

/**
 * Ranked Search Result (after RRF)
 */
export interface RankedResult extends SearchResult {
  originalRank: {
    elastic?: number;
    faiss?: number;
  };
  rrfScore: number; // Final RRF score
}

/**
 * Search Engine Interface
 */
export interface SearchEngine {
  search(query: SearchQuery): Promise<SearchResult[]>;
  index(documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>): Promise<void>;
  close(): Promise<void>;
}

/**
 * Reranker Interface
 */
export interface Reranker {
  rerank(query: string, results: SearchResult[], topK: number): Promise<SearchResult[]>;
}
