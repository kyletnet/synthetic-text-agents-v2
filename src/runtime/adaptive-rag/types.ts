/**
 * Adaptive RAG Types
 *
 * Phase 3 Week 4: Dynamic k-value adjustment for cost optimization
 *
 * Purpose:
 * - Minimize token costs while maintaining accuracy
 * - Start with k=2, expand to k=6 only when needed
 * - Track confidence and cost in real-time
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 5)
 */

/**
 * Adaptive RAG Configuration
 */
export interface AdaptiveRAGConfig {
  /** Initial k-value (default: 2) */
  initialK: number;

  /** Maximum k-value (default: 6) */
  maxK: number;

  /** Confidence threshold for expansion (default: 0.7) */
  confidenceThreshold: number;

  /** Cost limit per query (tokens, default: 8000) */
  costLimit: number;

  /** Step size for k expansion (default: 2) */
  expansionStep: number;

  /** Enable Gate F integration for cost tracking */
  enableGateF: boolean;
}

/**
 * Adaptive RAG Query
 */
export interface AdaptiveRAGQuery {
  /** User query text */
  query: string;

  /** Context from previous attempts (for iterative expansion) */
  previousContext?: string[];

  /** Metadata filters */
  filters?: Record<string, unknown>;

  /** Override configuration */
  config?: Partial<AdaptiveRAGConfig>;
}

/**
 * Confidence Detection Result
 */
export interface ConfidenceResult {
  /** Overall confidence score (0-1) */
  confidence: number;

  /** Is answer sufficient? */
  isSufficient: boolean;

  /** Detected issues */
  issues: Array<{
    type: 'insufficient_context' | 'ambiguous_query' | 'low_relevance' | 'no_answer_possible';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }>;

  /** Recommendation */
  recommendation: 'proceed' | 'expand_k' | 'rephrase_query' | 'fallback';
}

/**
 * Adaptive RAG Result
 */
export interface AdaptiveRAGResult {
  /** Final answer */
  answer: string;

  /** Retrieved context chunks */
  context: Array<{
    id: string;
    content: string;
    score: number;
    metadata: Record<string, unknown>;
  }>;

  /** Final k-value used */
  finalK: number;

  /** Number of iterations */
  iterations: number;

  /** Confidence score */
  confidence: number;

  /** Cost tracking */
  cost: {
    totalTokens: number;
    retrievalTokens: number;
    generationTokens: number;
    costUSD: number;
  };

  /** Performance metrics */
  performance: {
    totalTimeMs: number;
    retrievalTimeMs: number;
    generationTimeMs: number;
    confidenceCheckTimeMs: number;
  };

  /** Execution trace */
  trace: Array<{
    iteration: number;
    k: number;
    contextsRetrieved: number;
    confidence: number;
    action: 'expand_k' | 'generate_answer' | 'fallback';
    timestamp: number;
  }>;
}

/**
 * Cost Tracking Entry
 */
export interface CostEntry {
  timestamp: number;
  queryId: string;
  operation: 'retrieval' | 'generation' | 'confidence_check' | 'reranking';
  tokens: number;
  costUSD: number;
  metadata?: Record<string, unknown>;
}

/**
 * Adaptive RAG Statistics
 */
export interface AdaptiveRAGStats {
  totalQueries: number;
  totalTokens: number;
  totalCostUSD: number;
  averageK: number;
  averageIterations: number;
  averageConfidence: number;

  /** Savings compared to fixed k=6 */
  savings: {
    tokensSaved: number;
    percentageSaved: number;
    costSavedUSD: number;
  };

  /** Distribution of final k-values */
  kDistribution: Record<number, number>;

  /** Success rates */
  successRates: {
    highConfidence: number; // confidence >= 0.8
    mediumConfidence: number; // 0.6 <= confidence < 0.8
    lowConfidence: number; // confidence < 0.6
  };
}

/**
 * Adaptive RAG Engine Interface
 */
export interface AdaptiveRAGEngine {
  /** Execute adaptive RAG query */
  query(query: AdaptiveRAGQuery): Promise<AdaptiveRAGResult>;

  /** Get current statistics */
  getStats(): AdaptiveRAGStats;

  /** Reset statistics */
  resetStats(): void;

  /** Update configuration */
  updateConfig(config: Partial<AdaptiveRAGConfig>): void;
}

/**
 * Default Adaptive RAG Configuration
 */
export const DEFAULT_ADAPTIVE_RAG_CONFIG: AdaptiveRAGConfig = {
  initialK: 2,
  maxK: 6,
  confidenceThreshold: 0.7,
  costLimit: 8000,
  expansionStep: 2,
  enableGateF: true,
};
