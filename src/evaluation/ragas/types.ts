/**
 * RAGAS Evaluation Types
 *
 * Phase 3 Week 4 → Phase 4: Quality Evaluation Framework
 *
 * RAGAS Metrics:
 * - Context Recall: Were all necessary contexts retrieved?
 * - Context Precision: What % of retrieved contexts are relevant?
 * - Answer Faithfulness: Is answer grounded in retrieved contexts?
 * - Answer Relevance: Does answer match the question intent?
 *
 * Gate Integration:
 * - Context Recall → Gate B (Evidence Hit)
 * - Context Precision → Gate D (Faithfulness)
 * - Answer Faithfulness → Gate G (Groundedness/Compliance)
 * - Answer Relevance → Gate E (Utility/Explanation)
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 6)
 */

/**
 * RAGAS Evaluation Input
 */
export interface RAGASInput {
  question: string;
  answer: string;
  contexts: string[]; // Retrieved contexts
  groundTruth?: string; // Optional: Human-verified answer
  groundTruthContexts?: string[]; // Optional: Ground truth contexts for recall calculation
}

/**
 * RAGAS Metrics Output
 */
export interface RAGASMetrics {
  contextRecall: number; // 0-1: Coverage of necessary contexts
  contextPrecision: number; // 0-1: Relevance of retrieved contexts
  answerFaithfulness: number; // 0-1: Grounding in contexts
  answerRelevance: number; // 0-1: Alignment with question
  overall: number; // Harmonic mean of all metrics
}

/**
 * RAGAS Evaluation Result
 */
export interface RAGASResult {
  input: RAGASInput;
  metrics: RAGASMetrics;
  details: {
    contextRecall: {
      score: number;
      coverage: number; // % of ground truth covered
      missingConcepts: string[];
    };
    contextPrecision: {
      score: number;
      relevantContexts: number;
      irrelevantContexts: number;
    };
    answerFaithfulness: {
      score: number;
      groundedStatements: number;
      ungroundedStatements: number;
      hallucinationRisk: 'low' | 'medium' | 'high';
    };
    answerRelevance: {
      score: number;
      questionIntent: string;
      answerIntent: string;
      alignment: number;
    };
  };
  gateMapping: {
    contextRecall: 'Gate B (Evidence Hit)';
    contextPrecision: 'Gate D (Diversity)';
    answerFaithfulness: 'Gate G (Compliance)';
    answerRelevance: 'Gate E (Explanation)';
  };
}

/**
 * RAGAS Evaluator Configuration
 */
export interface RAGASConfig {
  /** Evaluation method: heuristic (fast) or llm (accurate) */
  method: 'heuristic' | 'llm' | 'hybrid';

  /** LLM provider for evaluation */
  llmProvider?: 'anthropic' | 'openai';

  /** LLM model (e.g., 'claude-3-5-sonnet-20241022', 'gpt-4-turbo') */
  model?: string;

  /** API key for LLM */
  apiKey?: string;

  /** Thresholds for pass/fail */
  thresholds?: {
    contextRecall: number;
    contextPrecision: number;
    answerFaithfulness: number;
    answerRelevance: number;
  };

  /** Parallel evaluation batch size */
  batchSize?: number;

  /** Save results to reports/ragas/ */
  saveResults?: boolean;

  /** Enable Gate integration */
  enableGates?: boolean;
}

/**
 * Default RAGAS Configuration
 */
export const DEFAULT_RAGAS_CONFIG: RAGASConfig = {
  method: 'heuristic',
  thresholds: {
    contextRecall: 0.7,
    contextPrecision: 0.75,
    answerFaithfulness: 0.8,
    answerRelevance: 0.85,
  },
  batchSize: 10,
  saveResults: true,
  enableGates: true,
};

/**
 * RAGAS Evaluator Interface
 */
export interface RAGASEvaluator {
  evaluate(input: RAGASInput): Promise<RAGASResult>;
  evaluateBatch(inputs: RAGASInput[]): Promise<RAGASResult[]>;
  saveReport(results: RAGASResult[], outputPath: string): Promise<void>;
}

/**
 * Gate Integration Mapping
 */
export const RAGAS_GATE_MAPPING = {
  contextRecall: 'B', // Evidence Hit
  contextPrecision: 'D', // Diversity
  answerFaithfulness: 'G', // Compliance
  answerRelevance: 'E', // Explanation
} as const;
