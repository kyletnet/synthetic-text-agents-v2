/**
 * Intent-Driven Adaptive RAG
 *
 * Phase 7: Self-Evolving RAG Network
 *
 * Extends AdaptiveRAG with:
 * 1. Intent Classification (0.01-0.66ms, $0 cost)
 * 2. Evidence-Locked Prompt Generation
 * 3. Context Strategy based on Intent
 *
 * Expected Impact:
 * - Relevance: +60pp (4% → 64%)
 * - Precision: +30pp (9.7% → 39.7%)
 * - Faithfulness: 100% maintained
 */

import { AdaptiveRAG } from './adaptive-rag';
import {
  IntentClassifier,
  EvidenceLockedPromptBuilder,
  type QueryIntent,
  type EvidenceContext,
} from '../intent';
import type {
  HybridSearchEngine,
} from '../../infrastructure/retrieval/hybrid/hybrid-search-engine';
import type {
  AdaptiveRAGQuery,
  AdaptiveRAGResult,
} from './types';

/**
 * LLM Generator with Prompt Support
 */
interface IntentAwareLLMGenerator {
  generate(
    prompt: string,
    context: string[]
  ): Promise<{ answer: string; tokens: number }>;
}

/**
 * Intent-Driven Adaptive RAG Configuration
 */
export interface IntentDrivenAdaptiveRAGConfig {
  // Base AdaptiveRAG config
  initialK?: number;
  maxK?: number;
  confidenceThreshold?: number;
  costLimit?: number;
  expansionStep?: number;
  enableGateF?: boolean;

  // Intent-Driven extensions
  enableIntentClassification?: boolean;
  enableEvidenceLockedPrompt?: boolean;
  requireCitation?: boolean;
  allowSynthesis?: boolean;
}

/**
 * Intent-Driven Adaptive RAG Result
 */
export interface IntentDrivenAdaptiveRAGResult extends AdaptiveRAGResult {
  intent?: QueryIntent;
  intentClassificationTime?: number;
  promptTemplate?: string; // For debugging
}

/**
 * Intent-Driven Adaptive RAG
 */
export class IntentDrivenAdaptiveRAG extends AdaptiveRAG {
  private intentClassifier: IntentClassifier;
  private promptBuilder: EvidenceLockedPromptBuilder;
  private intentDrivenConfig: IntentDrivenAdaptiveRAGConfig;
  private intentAwareLLMGenerator?: IntentAwareLLMGenerator;

  constructor(
    searchEngine: HybridSearchEngine,
    llmGenerator?: IntentAwareLLMGenerator,
    config?: Partial<IntentDrivenAdaptiveRAGConfig>
  ) {
    super(searchEngine, llmGenerator, config);

    this.intentAwareLLMGenerator = llmGenerator;

    this.intentDrivenConfig = {
      ...config,
      enableIntentClassification: config?.enableIntentClassification ?? true,
      enableEvidenceLockedPrompt: config?.enableEvidenceLockedPrompt ?? true,
      requireCitation: config?.requireCitation ?? true,
      allowSynthesis: config?.allowSynthesis ?? true,
    };

    // Initialize Intent components
    this.intentClassifier = new IntentClassifier();

    this.promptBuilder = new EvidenceLockedPromptBuilder({
      requireCitation: this.intentDrivenConfig.requireCitation,
      allowSynthesis: this.intentDrivenConfig.allowSynthesis,
      penalizeHallucination: true,
      maxContexts: 10,
      contextSummaryMode: 'full',
    });
  }

  /**
   * Override query method to add Intent-Driven capabilities
   */
  async query(
    query: AdaptiveRAGQuery
  ): Promise<IntentDrivenAdaptiveRAGResult> {
    // Phase 1: Classify Intent (if enabled)
    let intent: QueryIntent | undefined;
    let intentClassificationTime = 0;

    if (this.intentDrivenConfig.enableIntentClassification) {
      const result = await this.intentClassifier.classify(query.query);
      intentClassificationTime = result.processingTime;
      intent = result.intent;

      console.log(
        `[Intent] ${intent.type} (${intent.expectedAnswerType}) - ${intentClassificationTime.toFixed(2)}ms`
      );
    }

    // Phase 2: Execute base Adaptive RAG query
    const baseResult = await super.query(query);

    // Phase 3: If Evidence-Locked Prompt enabled, regenerate answer
    let finalAnswer = baseResult.answer;
    let promptTemplate: string | undefined;

    if (
      this.intentDrivenConfig.enableEvidenceLockedPrompt &&
      intent &&
      this.intentAwareLLMGenerator
    ) {
      // Convert context to Evidence format
      const evidenceContexts: EvidenceContext[] = baseResult.context.map(ctx => ({
        id: ctx.id,
        content: ctx.content,
        metadata: ctx.metadata,
        score: ctx.score,
      }));

      // Build Evidence-Locked Prompt
      promptTemplate = this.promptBuilder.build(
        query.query,
        evidenceContexts,
        intent
      );

      // Regenerate answer with Evidence-Locked Prompt
      const generationStart = performance.now();
      const result = await this.intentAwareLLMGenerator.generate(
        promptTemplate,
        evidenceContexts.map(c => c.content)
      );
      const generationEnd = performance.now();

      finalAnswer = result.answer;

      // Update performance stats
      baseResult.performance.generationTimeMs = generationEnd - generationStart;
    }

    // Return enhanced result
    return {
      ...baseResult,
      answer: finalAnswer,
      intent,
      intentClassificationTime,
      promptTemplate,
    };
  }

  /**
   * Get Intent Classifier for external use
   */
  getIntentClassifier(): IntentClassifier {
    return this.intentClassifier;
  }

  /**
   * Get Prompt Builder for external use
   */
  getPromptBuilder(): EvidenceLockedPromptBuilder {
    return this.promptBuilder;
  }
}

/**
 * Factory function: Create Intent-Driven Adaptive RAG
 */
export function createIntentDrivenAdaptiveRAG(
  searchEngine: HybridSearchEngine,
  llmGenerator?: IntentAwareLLMGenerator,
  config?: Partial<IntentDrivenAdaptiveRAGConfig>
): IntentDrivenAdaptiveRAG {
  return new IntentDrivenAdaptiveRAG(searchEngine, llmGenerator, config);
}
