/**
 * LLM-based RAGAS Evaluator
 *
 * Phase 6: Detective Mode Hardening
 *
 * Purpose:
 * - LLM-Judge를 사용한 고품질 RAGAS 평가
 * - Gate B/D/E 40% → 70-90% 개선
 *
 * Architecture:
 * - Anthropic Claude 3.5 Sonnet (primary)
 * - OpenAI GPT-4 (fallback)
 * - 20% sampling for cost efficiency
 * - Batch processing with rate limiting
 *
 * @see PHASE_6_START.md (Section A.1)
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import {
  type LLMRAGASConfig,
  type LLMRAGASInput,
  type LLMRAGASOutput,
  type LLMRAGASResult,
  type LLMRAGASSummary,
  DEFAULT_LLM_RAGAS_CONFIG,
  LLM_RAGAS_GATE_THRESHOLDS,
  LLM_RAGAS_PROMPTS,
} from './llm-ragas-types';

/**
 * LLM RAGAS Evaluator
 */
export class LLMRAGASEvaluator {
  private config: LLMRAGASConfig;
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private cache: Map<string, LLMRAGASOutput> = new Map();

  constructor(config?: Partial<LLMRAGASConfig>) {
    this.config = {
      ...DEFAULT_LLM_RAGAS_CONFIG,
      ...config,
      apiKey: config?.apiKey || this.getAPIKey(config?.provider || 'anthropic'),
    } as LLMRAGASConfig;

    // Initialize LLM client
    if (this.config.provider === 'anthropic') {
      this.anthropic = new Anthropic({
        apiKey: this.config.apiKey,
      });
    } else {
      this.openai = new OpenAI({
        apiKey: this.config.apiKey,
      });
    }
  }

  /**
   * Get API key from environment
   */
  private getAPIKey(provider: 'openai' | 'anthropic'): string {
    const key =
      provider === 'openai'
        ? process.env.OPENAI_API_KEY
        : process.env.ANTHROPIC_API_KEY;

    if (!key) {
      throw new Error(
        `${provider.toUpperCase()}_API_KEY not found in environment`
      );
    }

    return key;
  }

  /**
   * Evaluate single input
   */
  async evaluate(input: LLMRAGASInput): Promise<LLMRAGASResult> {
    const startTime = performance.now();

    // Check cache
    const cacheKey = this.getCacheKey(input);
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      return this.formatResult(input, cached);
    }

    // Evaluate each metric
    const [contextRecall, contextPrecision, answerRelevance, answerFaithfulness] =
      await Promise.all([
        this.evaluateContextRecall(input),
        this.evaluateContextPrecision(input),
        this.evaluateAnswerRelevance(input),
        this.evaluateAnswerFaithfulness(input),
      ]);

    const endTime = performance.now();

    // Calculate overall score (geometric mean)
    const overall = Math.pow(
      contextRecall.score *
        contextPrecision.score *
        answerRelevance.score *
        answerFaithfulness.score,
      1 / 4
    );

    const output: LLMRAGASOutput = {
      contextRecall: contextRecall.score,
      contextPrecision: contextPrecision.score,
      answerRelevance: answerRelevance.score,
      answerFaithfulness: answerFaithfulness.score,
      overall,
      reasoning: {
        contextRecall: contextRecall.reasoning,
        contextPrecision: contextPrecision.reasoning,
        answerRelevance: answerRelevance.reasoning,
        answerFaithfulness: answerFaithfulness.reasoning,
      },
      cost: {
        tokens:
          contextRecall.tokens +
          contextPrecision.tokens +
          answerRelevance.tokens +
          answerFaithfulness.tokens,
        costUSD:
          contextRecall.cost +
          contextPrecision.cost +
          answerRelevance.cost +
          answerFaithfulness.cost,
      },
      latencyMs: endTime - startTime,
    };

    // Cache result
    if (this.config.enableCache) {
      this.cache.set(cacheKey, output);
    }

    return this.formatResult(input, output);
  }

  /**
   * Evaluate Context Recall (Gate B)
   */
  private async evaluateContextRecall(
    input: LLMRAGASInput
  ): Promise<{ score: number; reasoning: string; tokens: number; cost: number }> {
    const prompt = this.fillPrompt(LLM_RAGAS_PROMPTS.contextRecall, input);

    const result = await this.callLLM(prompt);

    return result;
  }

  /**
   * Evaluate Context Precision (Gate D)
   */
  private async evaluateContextPrecision(
    input: LLMRAGASInput
  ): Promise<{ score: number; reasoning: string; tokens: number; cost: number }> {
    const prompt = this.fillPrompt(LLM_RAGAS_PROMPTS.contextPrecision, input);

    const result = await this.callLLM(prompt);

    return result;
  }

  /**
   * Evaluate Answer Relevance (Gate E)
   */
  private async evaluateAnswerRelevance(
    input: LLMRAGASInput
  ): Promise<{ score: number; reasoning: string; tokens: number; cost: number }> {
    const prompt = this.fillPrompt(LLM_RAGAS_PROMPTS.answerRelevance, input);

    const result = await this.callLLM(prompt);

    return result;
  }

  /**
   * Evaluate Answer Faithfulness (Gate G)
   */
  private async evaluateAnswerFaithfulness(
    input: LLMRAGASInput
  ): Promise<{ score: number; reasoning: string; tokens: number; cost: number }> {
    const prompt = this.fillPrompt(LLM_RAGAS_PROMPTS.answerFaithfulness, input);

    const result = await this.callLLM(prompt);

    return result;
  }

  /**
   * Call LLM with retry and backoff (anti-bias safeguard)
   */
  private async callLLM(
    prompt: string,
    retries = 2
  ): Promise<{ score: number; reasoning: string; tokens: number; cost: number }> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (this.config.provider === 'anthropic') {
          return await this.callAnthropic(prompt, attempt);
        } else {
          return await this.callOpenAI(prompt, attempt);
        }
      } catch (error) {
        if (attempt === retries) {
          // Final attempt failed
          console.error(`[LLM RAGAS] All ${retries + 1} attempts failed:`, error);
          // Return fallback score
          return {
            score: 0.5,
            reasoning: `Evaluation failed after ${retries + 1} attempts: ${error}`,
            tokens: 0,
            cost: 0,
          };
        }

        // Exponential backoff
        const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.warn(`[LLM RAGAS] Attempt ${attempt + 1} failed, retrying in ${backoffMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // Should never reach here
    throw new Error('Unexpected: callLLM exhausted all retries');
  }

  /**
   * Call Anthropic Claude with JSON parsing retry (anti-bias: JSON enforcement)
   */
  private async callAnthropic(
    prompt: string,
    attempt: number
  ): Promise<{ score: number; reasoning: string; tokens: number; cost: number }> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    // Add strict JSON instruction on retry
    const finalPrompt = attempt > 0
      ? prompt + '\n\n**CRITICAL: Return ONLY valid JSON. No preamble, no explanation.**'
      : prompt;

    const message = await this.anthropic.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: [
        {
          role: 'user',
          content: finalPrompt,
        },
      ],
    });

    // Parse JSON response (strict)
    const content = message.content[0];
    const text = content.type === 'text' ? content.text : '';

    let parsed: { score: number; reasoning: string };
    try {
      // Try to extract JSON from text (handle cases like "```json\n{...}\n```")
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }

      // Validate score range (anti-bias: enforce 0-1)
      if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 1) {
        throw new Error(`Invalid score: ${parsed.score} (must be 0.0-1.0)`);
      }
    } catch (error) {
      console.error(`[LLM RAGAS] JSON parse failed (attempt ${attempt + 1}):`, text);
      throw error; // Will trigger retry
    }

    // Calculate cost (Claude Sonnet 3.5)
    // Input: $3/M tokens, Output: $15/M tokens
    const inputTokens = message.usage.input_tokens;
    const outputTokens = message.usage.output_tokens;
    const costUSD =
      (inputTokens / 1_000_000) * 3 + (outputTokens / 1_000_000) * 15;

    return {
      score: parsed.score,
      reasoning: parsed.reasoning,
      tokens: inputTokens + outputTokens,
      cost: costUSD,
    };
  }

  /**
   * Call OpenAI GPT with strict JSON mode (anti-bias: JSON enforcement)
   */
  private async callOpenAI(
    prompt: string,
    attempt: number
  ): Promise<{ score: number; reasoning: string; tokens: number; cost: number }> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    // Add strict JSON instruction on retry
    const finalPrompt = attempt > 0
      ? prompt + '\n\n**CRITICAL: Return ONLY valid JSON. No preamble, no explanation.**'
      : prompt;

    const completion = await this.openai.chat.completions.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      messages: [
        {
          role: 'user',
          content: finalPrompt,
        },
      ],
      response_format: { type: 'json_object' }, // Strict JSON mode
    });

    const text = completion.choices[0].message.content || '';

    let parsed: { score: number; reasoning: string };
    try {
      parsed = JSON.parse(text);

      // Validate score range (anti-bias: enforce 0-1)
      if (typeof parsed.score !== 'number' || parsed.score < 0 || parsed.score > 1) {
        throw new Error(`Invalid score: ${parsed.score} (must be 0.0-1.0)`);
      }
    } catch (error) {
      console.error(`[LLM RAGAS] JSON parse failed (attempt ${attempt + 1}):`, text);
      throw error; // Will trigger retry
    }

    // Calculate cost (GPT-4 Turbo)
    // Input: $10/M tokens, Output: $30/M tokens
    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;
    const costUSD =
      (inputTokens / 1_000_000) * 10 + (outputTokens / 1_000_000) * 30;

    return {
      score: parsed.score,
      reasoning: parsed.reasoning,
      tokens: inputTokens + outputTokens,
      cost: costUSD,
    };
  }

  /**
   * Fill prompt template
   */
  private fillPrompt(template: string, input: LLMRAGASInput): string {
    return template
      .replace('{{question}}', input.question)
      .replace('{{answer}}', input.answer)
      .replace('{{contexts}}', input.contexts.map((c, i) => `${i + 1}. ${c}`).join('\n'))
      .replace('{{groundTruth}}', input.groundTruth);
  }

  /**
   * Format result (compatible with existing RAGAS)
   */
  private formatResult(
    input: LLMRAGASInput,
    output: LLMRAGASOutput
  ): LLMRAGASResult {
    return {
      input,
      metrics: {
        contextRecall: output.contextRecall,
        contextPrecision: output.contextPrecision,
        answerRelevance: output.answerRelevance,
        answerFaithfulness: output.answerFaithfulness,
        overall: output.overall,
      },
      details: {
        contextRecall: {
          score: output.contextRecall,
          reasoning: output.reasoning.contextRecall,
        },
        contextPrecision: {
          score: output.contextPrecision,
          reasoning: output.reasoning.contextPrecision,
        },
        answerRelevance: {
          score: output.answerRelevance,
          reasoning: output.reasoning.answerRelevance,
        },
        answerFaithfulness: {
          score: output.answerFaithfulness,
          reasoning: output.reasoning.answerFaithfulness,
        },
      },
      cost: output.cost,
      latencyMs: output.latencyMs,
      gateMapping: {
        contextRecall: 'Gate B (Evidence Hit)',
        contextPrecision: 'Gate D (Diversity)',
        answerFaithfulness: 'Gate G (Compliance)',
        answerRelevance: 'Gate E (Explanation)',
      },
    };
  }

  /**
   * Get cache key
   */
  private getCacheKey(input: LLMRAGASInput): string {
    return JSON.stringify(input);
  }

  /**
   * Evaluate batch with sampling
   */
  async evaluateBatch(
    inputs: LLMRAGASInput[],
    samplingRate?: number
  ): Promise<{
    results: LLMRAGASResult[];
    summary: LLMRAGASSummary;
  }> {
    const rate = samplingRate || this.config.samplingRate;

    // Sample inputs
    const sampledInputs = this.sampleInputs(inputs, rate);

    console.log(
      `[LLM RAGAS] Evaluating ${sampledInputs.length}/${inputs.length} queries (${(rate * 100).toFixed(0)}% sampling)`
    );

    // Evaluate in batches
    const results: LLMRAGASResult[] = [];
    for (let i = 0; i < sampledInputs.length; i += this.config.batchSize) {
      const batch = sampledInputs.slice(i, i + this.config.batchSize);
      const batchResults = await Promise.all(
        batch.map(input => this.evaluate(input))
      );
      results.push(...batchResults);

      console.log(
        `   [${i + batchResults.length}/${sampledInputs.length}] Batch complete`
      );
    }

    // Calculate summary
    const summary = this.calculateSummary(results, inputs.length, rate);

    return { results, summary };
  }

  /**
   * Sample inputs (random)
   */
  private sampleInputs(
    inputs: LLMRAGASInput[],
    rate: number
  ): LLMRAGASInput[] {
    const sampleSize = Math.ceil(inputs.length * rate);
    const shuffled = [...inputs].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, sampleSize);
  }

  /**
   * Calculate summary
   */
  private calculateSummary(
    results: LLMRAGASResult[],
    totalQueries: number,
    samplingRate: number
  ): LLMRAGASSummary {
    const totalTokens = results.reduce((sum, r) => sum + r.cost.tokens, 0);
    const totalCostUSD = results.reduce((sum, r) => sum + r.cost.costUSD, 0);
    const totalLatencyMs = results.reduce((sum, r) => sum + r.latencyMs, 0);

    return {
      totalQueries,
      sampledQueries: results.length,
      samplingRate,
      averageMetrics: {
        contextRecall:
          results.reduce((sum, r) => sum + r.metrics.contextRecall, 0) /
          results.length,
        contextPrecision:
          results.reduce((sum, r) => sum + r.metrics.contextPrecision, 0) /
          results.length,
        answerRelevance:
          results.reduce((sum, r) => sum + r.metrics.answerRelevance, 0) /
          results.length,
        answerFaithfulness:
          results.reduce((sum, r) => sum + r.metrics.answerFaithfulness, 0) /
          results.length,
        overall:
          results.reduce((sum, r) => sum + r.metrics.overall, 0) / results.length,
      },
      gatePassRates: {
        B:
          results.filter(
            r => r.metrics.contextRecall >= LLM_RAGAS_GATE_THRESHOLDS.contextRecall
          ).length / results.length,
        D:
          results.filter(
            r =>
              r.metrics.contextPrecision >=
              LLM_RAGAS_GATE_THRESHOLDS.contextPrecision
          ).length / results.length,
        E:
          results.filter(
            r =>
              r.metrics.answerRelevance >= LLM_RAGAS_GATE_THRESHOLDS.answerRelevance
          ).length / results.length,
        G:
          results.filter(
            r =>
              r.metrics.answerFaithfulness >=
              LLM_RAGAS_GATE_THRESHOLDS.answerFaithfulness
          ).length / results.length,
      },
      cost: {
        totalTokens,
        totalCostUSD,
        averageTokensPerQuery: totalTokens / results.length,
        averageCostPerQuery: totalCostUSD / results.length,
      },
      performance: {
        averageLatencyMs: totalLatencyMs / results.length,
        totalTimeMs: totalLatencyMs,
      },
    };
  }
}

/**
 * Create LLM RAGAS Evaluator
 */
export function createLLMRAGASEvaluator(
  config?: Partial<LLMRAGASConfig>
): LLMRAGASEvaluator {
  return new LLMRAGASEvaluator(config);
}
