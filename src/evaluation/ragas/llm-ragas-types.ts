/**
 * LLM-based RAGAS Types
 *
 * Phase 6: Detective Mode Hardening
 *
 * Purpose:
 * - LLM-Judge를 사용한 고품질 RAGAS 평가
 * - 휴리스틱 RAGAS 한계 극복
 * - Gate B/D/E 40% → 70-90% 개선
 *
 * @see PHASE_6_START.md (Section A.1)
 */

/**
 * LLM Provider
 */
export type LLMProvider = 'openai' | 'anthropic';

/**
 * LLM RAGAS Configuration
 */
export interface LLMRAGASConfig {
  /**
   * LLM Provider (OpenAI or Anthropic)
   */
  provider: LLMProvider;

  /**
   * Model name
   * - OpenAI: 'gpt-4', 'gpt-4-turbo'
   * - Anthropic: 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'
   */
  model: string;

  /**
   * API Key (from environment variable)
   */
  apiKey: string;

  /**
   * Sampling rate (0.0-1.0)
   * - 0.2 = 20% sampling (default)
   * - 1.0 = 100% (all queries)
   */
  samplingRate: number;

  /**
   * Batch size for parallel evaluation
   * - Default: 5
   * - Max: 10 (avoid rate limits)
   */
  batchSize: number;

  /**
   * Timeout per evaluation (ms)
   * - Default: 30000 (30s)
   */
  timeout: number;

  /**
   * Temperature (0.0-1.0)
   * - Default: 0.0 (deterministic)
   */
  temperature: number;

  /**
   * Max tokens
   * - Default: 500
   */
  maxTokens: number;

  /**
   * Enable caching (for cost saving)
   * - Default: true
   */
  enableCache: boolean;

  /**
   * Cache TTL (ms)
   * - Default: 3600000 (1 hour)
   */
  cacheTTL: number;
}

/**
 * LLM RAGAS Input (same as RAGAS Input)
 */
export interface LLMRAGASInput {
  question: string;
  answer: string;
  contexts: string[];
  groundTruth: string;
}

/**
 * LLM RAGAS Output
 */
export interface LLMRAGASOutput {
  /**
   * Context Recall (Gate B)
   * - "Does the context cover all key information in groundTruth?"
   * - Range: 0.0-1.0
   */
  contextRecall: number;

  /**
   * Context Precision (Gate D)
   * - "Are all contexts relevant to the question?"
   * - Range: 0.0-1.0
   */
  contextPrecision: number;

  /**
   * Answer Relevance (Gate E)
   * - "Does the answer directly address the question?"
   * - Range: 0.0-1.0
   */
  answerRelevance: number;

  /**
   * Answer Faithfulness (Gate G)
   * - "Is the answer grounded in the contexts?"
   * - Range: 0.0-1.0
   */
  answerFaithfulness: number;

  /**
   * Overall score (geometric mean)
   */
  overall: number;

  /**
   * LLM reasoning (for debugging)
   */
  reasoning: {
    contextRecall: string;
    contextPrecision: string;
    answerRelevance: string;
    answerFaithfulness: string;
  };

  /**
   * Cost tracking
   */
  cost: {
    tokens: number;
    costUSD: number;
  };

  /**
   * Latency (ms)
   */
  latencyMs: number;
}

/**
 * LLM RAGAS Result (compatible with existing RAGAS)
 */
export interface LLMRAGASResult {
  input: LLMRAGASInput;
  metrics: {
    contextRecall: number;
    contextPrecision: number;
    answerRelevance: number;
    answerFaithfulness: number;
    overall: number;
  };
  details: {
    contextRecall: {
      score: number;
      reasoning: string;
    };
    contextPrecision: {
      score: number;
      reasoning: string;
    };
    answerRelevance: {
      score: number;
      reasoning: string;
    };
    answerFaithfulness: {
      score: number;
      reasoning: string;
    };
  };
  cost: {
    tokens: number;
    costUSD: number;
  };
  latencyMs: number;
  gateMapping: {
    contextRecall: string;
    contextPrecision: string;
    answerFaithfulness: string;
    answerRelevance: string;
  };
}

/**
 * LLM RAGAS Summary
 */
export interface LLMRAGASSummary {
  totalQueries: number;
  sampledQueries: number;
  samplingRate: number;
  averageMetrics: {
    contextRecall: number;
    contextPrecision: number;
    answerRelevance: number;
    answerFaithfulness: number;
    overall: number;
  };
  gatePassRates: {
    B: number; // Context Recall ≥ 0.7
    D: number; // Context Precision ≥ 0.75
    E: number; // Answer Relevance ≥ 0.85
    G: number; // Answer Faithfulness ≥ 0.9
  };
  cost: {
    totalTokens: number;
    totalCostUSD: number;
    averageTokensPerQuery: number;
    averageCostPerQuery: number;
  };
  performance: {
    averageLatencyMs: number;
    totalTimeMs: number;
  };
}

/**
 * Default LLM RAGAS Config
 */
export const DEFAULT_LLM_RAGAS_CONFIG: Partial<LLMRAGASConfig> = {
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  samplingRate: 0.2, // 20%
  batchSize: 5,
  timeout: 30000, // 30s
  temperature: 0.0,
  maxTokens: 500,
  enableCache: true,
  cacheTTL: 3600000, // 1 hour
};

/**
 * Gate Thresholds (same as existing RAGAS)
 */
export const LLM_RAGAS_GATE_THRESHOLDS = {
  contextRecall: 0.7, // Gate B
  contextPrecision: 0.75, // Gate D
  answerRelevance: 0.85, // Gate E
  answerFaithfulness: 0.9, // Gate G
};

/**
 * LLM Prompt Templates
 */
export const LLM_RAGAS_PROMPTS = {
  contextRecall: `You are an expert evaluator for RAG (Retrieval-Augmented Generation) systems.

**Task:** Evaluate whether the retrieved contexts cover all key information from the ground truth.

⚠️ **ANTI-BIAS RULE:** Compare ONLY groundTruth vs contexts. DO NOT use the final answer.

**Question:** {{question}}

**Retrieved Contexts:**
{{contexts}}

**Ground Truth:**
{{groundTruth}}

**Instructions:**
1. Identify all key facts/entities in the ground truth
2. Check if each key fact is present in at least one context (exact or paraphrase)
3. Calculate coverage score: (covered facts) / (total facts)
4. Return a score between 0.0 and 1.0 (enforced)

**Output Format (STRICT JSON ONLY):**
{
  "score": 0.85,
  "reasoning": "Brief explanation (1-2 sentences)"
}`,

  contextPrecision: `You are an expert evaluator for RAG systems.

**Task:** Evaluate whether all retrieved contexts are relevant to the question.

⚠️ **ANTI-BIAS RULE:** Compare ONLY question vs each context. DO NOT use groundTruth or answer.

**Question:** {{question}}

**Retrieved Contexts:**
{{contexts}}

**Instructions:**
1. For each context, determine if it helps answer the question (relevant = useful information)
2. Penalize irrelevant/off-topic contexts
3. Calculate precision: (relevant contexts) / (total contexts)
4. Return a score between 0.0 and 1.0 (enforced)

**Output Format (STRICT JSON ONLY):**
{
  "score": 0.75,
  "reasoning": "Brief explanation (1-2 sentences)"
}`,

  answerRelevance: `You are an expert evaluator for RAG systems.

**Task:** Evaluate whether the answer directly addresses the question.

⚠️ **ANTI-BIAS RULE:** Compare ONLY question vs answer. DO NOT use contexts or groundTruth.

**Question:** {{question}}

**Answer:** {{answer}}

**Instructions:**
1. Check if the answer addresses the question's intent directly
2. Penalize for irrelevant/off-topic content, verbosity, or style issues
3. Focus on semantic relevance, NOT writing style or length
4. Return a score between 0.0 and 1.0 (enforced)

**Output Format (STRICT JSON ONLY):**
{
  "score": 0.90,
  "reasoning": "Brief explanation (1-2 sentences)"
}`,

  answerFaithfulness: `You are an expert evaluator for RAG systems.

**Task:** Evaluate whether the answer is grounded in the contexts (no hallucination).

⚠️ **ANTI-BIAS RULE:** Compare ONLY contexts vs answer. DO NOT use groundTruth or question.

**Contexts:**
{{contexts}}

**Answer:** {{answer}}

**Instructions:**
1. Check if EVERY statement in the answer is directly supported by contexts
2. Penalize for hallucinated, guessed, or unsupported statements
3. Even one hallucination should lower the score significantly
4. Return a score between 0.0 and 1.0 (enforced)

**Output Format (STRICT JSON ONLY):**
{
  "score": 0.95,
  "reasoning": "Brief explanation (1-2 sentences)"
}`,
};
