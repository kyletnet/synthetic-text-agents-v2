/**
 * RAGAS Evaluation Module
 *
 * Phase 3 Week 4 - Phase 4: RAG quality assessment
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 6)
 */

// Export types except RAGASEvaluator (to avoid conflict with class)
export type {
  RAGASInput,
  RAGASMetrics,
  RAGASResult,
  RAGASConfig,
} from './types';

export { DEFAULT_RAGAS_CONFIG, RAGAS_GATE_MAPPING } from './types';

// Export evaluator class and factory
export { RAGASEvaluator, createRAGASEvaluator } from './ragas-evaluator';
