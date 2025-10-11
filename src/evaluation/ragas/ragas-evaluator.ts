/**
 * RAGAS Evaluator
 *
 * Phase 3 Week 4 to Phase 4: RAG quality assessment
 *
 * Implements RAGAS metrics using heuristic and LLM-based methods:
 * - Context Recall (Gate B)
 * - Context Precision (Gate D)
 * - Answer Faithfulness (Gate G)
 * - Answer Relevance (Gate E)
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 6)
 */

import {
  type RAGASEvaluator as IRAGASEvaluator,
  type RAGASInput,
  type RAGASResult,
  type RAGASMetrics,
  type RAGASConfig,
  DEFAULT_RAGAS_CONFIG,
} from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * RAGAS Evaluator Implementation
 */
export class RAGASEvaluator implements IRAGASEvaluator {
  private config: {
    method: 'heuristic' | 'llm' | 'hybrid';
    llmProvider?: 'anthropic' | 'openai';
    model?: string;
    apiKey?: string;
    thresholds: {
      contextRecall: number;
      contextPrecision: number;
      answerFaithfulness: number;
      answerRelevance: number;
    };
    batchSize: number;
    saveResults: boolean;
    enableGates: boolean;
  };

  constructor(config?: Partial<RAGASConfig>) {
    this.config = {
      method: config?.method ?? DEFAULT_RAGAS_CONFIG.method!,
      llmProvider: config?.llmProvider,
      model: config?.model,
      apiKey: config?.apiKey,
      thresholds: {
        ...DEFAULT_RAGAS_CONFIG.thresholds!,
        ...config?.thresholds,
      },
      batchSize: config?.batchSize ?? DEFAULT_RAGAS_CONFIG.batchSize!,
      saveResults: config?.saveResults ?? DEFAULT_RAGAS_CONFIG.saveResults!,
      enableGates: config?.enableGates ?? DEFAULT_RAGAS_CONFIG.enableGates!,
    };
  }

  /**
   * Evaluate a single RAG result
   */
  async evaluate(input: RAGASInput): Promise<RAGASResult> {
    const startTime = performance.now();

    // Calculate individual metrics
    const contextRecall = await this.calculateContextRecall(input);
    const contextPrecision = await this.calculateContextPrecision(input);
    const answerFaithfulness = await this.calculateAnswerFaithfulness(input);
    const answerRelevance = await this.calculateAnswerRelevance(input);

    // Calculate overall score (harmonic mean)
    const metrics: RAGASMetrics = {
      contextRecall,
      contextPrecision,
      answerFaithfulness,
      answerRelevance,
      overall: this.harmonicMean([
        contextRecall,
        contextPrecision,
        answerFaithfulness,
        answerRelevance,
      ]),
    };

    // Detailed analysis
    const details = {
      contextRecall: {
        score: contextRecall,
        coverage: contextRecall,
        missingConcepts: [],
      },
      contextPrecision: {
        score: contextPrecision,
        relevantContexts: Math.round(contextPrecision * input.contexts.length),
        irrelevantContexts: input.contexts.length - Math.round(contextPrecision * input.contexts.length),
      },
      answerFaithfulness: {
        score: answerFaithfulness,
        groundedStatements: Math.round(answerFaithfulness * this.splitSentences(input.answer).length),
        ungroundedStatements: this.splitSentences(input.answer).length -
          Math.round(answerFaithfulness * this.splitSentences(input.answer).length),
        hallucinationRisk: answerFaithfulness >= 0.9
          ? ('low' as const)
          : answerFaithfulness >= 0.7
          ? ('medium' as const)
          : ('high' as const),
      },
      answerRelevance: {
        score: answerRelevance,
        questionIntent: 'auto-detected',
        answerIntent: 'auto-detected',
        alignment: answerRelevance,
      },
    };

    const endTime = performance.now();

    return {
      input,
      metrics,
      details,
      gateMapping: {
        contextRecall: 'Gate B (Evidence Hit)',
        contextPrecision: 'Gate D (Diversity)',
        answerFaithfulness: 'Gate G (Compliance)',
        answerRelevance: 'Gate E (Explanation)',
      },
    };
  }

  /**
   * Batch evaluation
   */
  async evaluateBatch(inputs: RAGASInput[]): Promise<RAGASResult[]> {
    const results: RAGASResult[] = [];
    const batchSize = this.config.batchSize;

    // Process in batches
    for (let i = 0; i < inputs.length; i += batchSize) {
      const batch = inputs.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(input => this.evaluate(input)));
      results.push(...batchResults);
    }

    // Save results if enabled
    if (this.config.saveResults) {
      await this.saveReport(results, 'reports/ragas/batch-evaluation.json');
    }

    return results;
  }

  /**
   * Save evaluation report
   */
  async saveReport(results: RAGASResult[], outputPath: string): Promise<void> {
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    const report = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalEvaluations: results.length,
        config: this.config,
      },
      summary: {
        averageMetrics: this.calculateAverageMetrics(results),
        gatePassRates: this.calculateGatePassRates(results),
      },
      results,
    };

    await fs.writeFile(outputPath, JSON.stringify(report, null, 2));
    console.log(`[OK] RAGAS report saved to ${outputPath}`);
  }

  // Private metric calculation methods

  /**
   * Calculate Context Recall (heuristic: keyword coverage)
   */
  private async calculateContextRecall(input: RAGASInput): Promise<number> {
    if (this.config.method === 'llm') {
      return this.calculateContextRecallLLM(input);
    }

    if (!input.groundTruth && !input.groundTruthContexts) {
      return 1.0;
    }

    const groundTruthText = input.groundTruth || input.groundTruthContexts?.join(' ') || '';
    const groundTruthKeywords = this.extractKeywords(groundTruthText);
    const retrievedText = input.contexts.join(' ');

    if (groundTruthKeywords.length === 0) return 1.0;

    const matchedKeywords = groundTruthKeywords.filter(kw =>
      retrievedText.toLowerCase().includes(kw.toLowerCase())
    );

    return matchedKeywords.length / groundTruthKeywords.length;
  }

  /**
   * Calculate Context Precision (heuristic: relevance to query)
   */
  private async calculateContextPrecision(input: RAGASInput): Promise<number> {
    if (this.config.method === 'llm') {
      return this.calculateContextPrecisionLLM(input);
    }

    const queryKeywords = this.extractKeywords(input.question);
    if (queryKeywords.length === 0) return 1.0;

    const relevanceScores = input.contexts.map(context => {
      const contextKeywords = this.extractKeywords(context);
      const overlap = queryKeywords.filter(qk =>
        contextKeywords.some(ck => ck.toLowerCase() === qk.toLowerCase())
      );
      return overlap.length / queryKeywords.length;
    });

    return relevanceScores.reduce((sum, score) => sum + score, 0) / relevanceScores.length;
  }

  /**
   * Calculate Answer Faithfulness (heuristic: sentence grounding)
   */
  private async calculateAnswerFaithfulness(input: RAGASInput): Promise<number> {
    if (this.config.method === 'llm') {
      return this.calculateAnswerFaithfulnessLLM(input);
    }

    const sentences = this.splitSentences(input.answer);
    if (sentences.length === 0) return 1.0;

    const contextsText = input.contexts.join(' ').toLowerCase();

    const groundedSentences = sentences.filter(sentence => {
      const keywords = this.extractKeywords(sentence);
      if (keywords.length === 0) return true;

      const matchedKeywords = keywords.filter(kw =>
        contextsText.includes(kw.toLowerCase())
      );

      return matchedKeywords.length / keywords.length >= 0.5;
    });

    return groundedSentences.length / sentences.length;
  }

  /**
   * Calculate Answer Relevance (heuristic: keyword overlap)
   */
  private async calculateAnswerRelevance(input: RAGASInput): Promise<number> {
    if (this.config.method === 'llm') {
      return this.calculateAnswerRelevanceLLM(input);
    }

    const queryKeywords = this.extractKeywords(input.question);
    const answerKeywords = this.extractKeywords(input.answer);

    if (queryKeywords.length === 0) return 1.0;

    const matchedKeywords = queryKeywords.filter(qk =>
      answerKeywords.some(ak => ak.toLowerCase() === qk.toLowerCase())
    );

    return matchedKeywords.length / queryKeywords.length;
  }

  // LLM-based methods (placeholders)

  private async calculateContextRecallLLM(_input: RAGASInput): Promise<number> {
    console.warn('LLM-based Context Recall not yet implemented');
    return this.calculateContextRecall({ ..._input });
  }

  private async calculateContextPrecisionLLM(_input: RAGASInput): Promise<number> {
    console.warn('LLM-based Context Precision not yet implemented');
    return this.calculateContextPrecision({ ..._input });
  }

  private async calculateAnswerFaithfulnessLLM(_input: RAGASInput): Promise<number> {
    console.warn('LLM-based Answer Faithfulness not yet implemented');
    return this.calculateAnswerFaithfulness({ ..._input });
  }

  private async calculateAnswerRelevanceLLM(_input: RAGASInput): Promise<number> {
    console.warn('LLM-based Answer Relevance not yet implemented');
    return this.calculateAnswerRelevance({ ..._input });
  }

  // Helper methods

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      '은', '는', '이', '가', '을', '를', '의', '에', '에서', '로', '으로', '와', '과',
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'what', 'when', 'where', 'who', 'why', 'how',
    ]);

    const words = text
      .toLowerCase()
      .split(/\s+/)
      .map(w => w.replace(/[^\w가-힣]/g, ''))
      .filter(w => w.length > 1 && !stopWords.has(w));

    return [...new Set(words)];
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/[.!?。！？]\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  private harmonicMean(values: number[]): number {
    if (values.length === 0) return 0;
    const reciprocalSum = values.reduce((sum, v) => sum + 1 / (v || 0.0001), 0);
    return values.length / reciprocalSum;
  }

  private calculateAverageMetrics(results: RAGASResult[]): RAGASMetrics {
    if (results.length === 0) {
      return {
        contextRecall: 0,
        contextPrecision: 0,
        answerFaithfulness: 0,
        answerRelevance: 0,
        overall: 0,
      };
    }

    const sum = results.reduce(
      (acc, r) => ({
        contextRecall: acc.contextRecall + r.metrics.contextRecall,
        contextPrecision: acc.contextPrecision + r.metrics.contextPrecision,
        answerFaithfulness: acc.answerFaithfulness + r.metrics.answerFaithfulness,
        answerRelevance: acc.answerRelevance + r.metrics.answerRelevance,
        overall: acc.overall + r.metrics.overall,
      }),
      {
        contextRecall: 0,
        contextPrecision: 0,
        answerFaithfulness: 0,
        answerRelevance: 0,
        overall: 0,
      }
    );

    return {
      contextRecall: sum.contextRecall / results.length,
      contextPrecision: sum.contextPrecision / results.length,
      answerFaithfulness: sum.answerFaithfulness / results.length,
      answerRelevance: sum.answerRelevance / results.length,
      overall: sum.overall / results.length,
    };
  }

  private calculateGatePassRates(results: RAGASResult[]): Record<string, number> {
    if (results.length === 0) {
      return { B: 0, D: 0, E: 0, G: 0 };
    }

    const passCount = results.reduce(
      (acc, r) => ({
        B: acc.B + (r.details.contextRecall.score >= this.config.thresholds.contextRecall ? 1 : 0),
        D: acc.D + (r.details.contextPrecision.score >= this.config.thresholds.contextPrecision ? 1 : 0),
        E: acc.E + (r.details.answerRelevance.score >= this.config.thresholds.answerRelevance ? 1 : 0),
        G: acc.G + (r.details.answerFaithfulness.score >= this.config.thresholds.answerFaithfulness ? 1 : 0),
      }),
      { B: 0, D: 0, E: 0, G: 0 }
    );

    return {
      B: passCount.B / results.length,
      D: passCount.D / results.length,
      E: passCount.E / results.length,
      G: passCount.G / results.length,
    };
  }
}

/**
 * Create RAGAS evaluator
 */
export function createRAGASEvaluator(config?: Partial<RAGASConfig>): RAGASEvaluator {
  return new RAGASEvaluator(config);
}
