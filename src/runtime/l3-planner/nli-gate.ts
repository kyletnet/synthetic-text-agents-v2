/**
 * NLI Entailment Gate (Quick Win #4)
 *
 * Uses NLI (Natural Language Inference) to verify that generated text
 * is entailed by the provided evidence. Prevents hallucinations and
 * ensures groundedness.
 *
 * Expected gain: 근거 불일치 자동 차단, Groundedness ↑
 *
 * Model: microsoft/deberta-v3-large-mnli (1.4GB)
 * Strategy: Check each sentence against evidence, reject if not entailed
 *
 * @see RFC 2025-17, Section 1.4
 */

// @ts-expect-error - @xenova/transformers not installed yet
import { pipeline } from '@xenova/transformers';
import type { Evidence } from '../types';

/**
 * NLI Gate configuration
 */
export interface NLIGateConfig {
  modelName: string;
  threshold: number; // Entailment confidence threshold (0-1)
  strictMode: boolean; // If true, all sentences must be entailed
  enableCaching: boolean;
}

const DEFAULT_CONFIG: NLIGateConfig = {
  modelName: 'microsoft/deberta-v3-large-mnli',
  threshold: 0.8,
  strictMode: true,
  enableCaching: true,
};

/**
 * NLI result for a single sentence
 */
export interface NLIResult {
  sentence: string;
  entailed: boolean;
  label: 'entailment' | 'contradiction' | 'neutral';
  score: number;
  evidenceId?: string;
}

/**
 * NLI Gate
 *
 * Verifies that generated text is entailed by evidence.
 */
export class NLIGate {
  private model: any = null;
  private config: NLIGateConfig;
  private isInitialized = false;
  private cache = new Map<string, NLIResult>();

  constructor(config: Partial<NLIGateConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the model (lazy load)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load NLI model (text-classification task)
      this.model = await pipeline('text-classification', this.config.modelName, {
        quantized: true,
      });
      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize NLIGate: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Check if generated text is entailed by evidence
   *
   * Returns true if all sentences are entailed (strict mode) or
   * if majority are entailed (non-strict mode).
   *
   * @param generated Generated text to verify
   * @param evidence Evidence chunks
   * @returns true if entailed, false otherwise
   */
  async check(generated: string, evidence: Evidence[]): Promise<boolean> {
    // Ensure model is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (evidence.length === 0) {
      // No evidence to check against
      return false;
    }

    // Split generated text into sentences
    const sentences = this.splitSentences(generated);

    if (sentences.length === 0) {
      return true;
    }

    // Check each sentence
    const results = await this.checkSentences(sentences, evidence);

    // Determine overall entailment
    if (this.config.strictMode) {
      // All sentences must be entailed
      return results.every((r) => r.entailed);
    } else {
      // Majority must be entailed
      const entailedCount = results.filter((r) => r.entailed).length;
      return entailedCount / results.length >= 0.5;
    }
  }

  /**
   * Check sentences against evidence (detailed results)
   *
   * @param generated Generated text
   * @param evidence Evidence chunks
   * @returns Detailed NLI results for each sentence
   */
  async checkDetailed(generated: string, evidence: Evidence[]): Promise<NLIResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const sentences = this.splitSentences(generated);
    return this.checkSentences(sentences, evidence);
  }

  /**
   * Check each sentence against all evidence
   */
  private async checkSentences(
    sentences: string[],
    evidence: Evidence[]
  ): Promise<NLIResult[]> {
    const results: NLIResult[] = [];

    for (const sentence of sentences) {
      let entailed = false;
      let bestResult: NLIResult | null = null;

      // Check against all evidence chunks
      for (const ev of evidence) {
        const result = await this.checkPair(ev.text, sentence);

        if (result.label === 'entailment' && result.score >= this.config.threshold) {
          entailed = true;
          bestResult = {
            ...result,
            evidenceId: ev.id,
          };
          break; // Found entailment, no need to check further
        }

        // Track best result even if not entailed
        if (!bestResult || result.score > bestResult.score) {
          bestResult = {
            ...result,
            evidenceId: ev.id,
          };
        }
      }

      results.push({
        ...bestResult!,
        sentence,   // Override with correct sentence
        entailed,   // Override with aggregated entailment
      });
    }

    return results;
  }

  /**
   * Check a single premise-hypothesis pair
   */
  private async checkPair(premise: string, hypothesis: string): Promise<NLIResult> {
    // Check cache
    const cacheKey = this.getCacheKey(premise, hypothesis);
    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Run NLI model
    const result = await this.model([premise, hypothesis]);

    // Parse result (format depends on model output)
    const label = (result.label || result[0]?.label || 'neutral') as
      | 'entailment'
      | 'contradiction'
      | 'neutral';
    const score = result.score || result[0]?.score || 0;

    const nliResult: NLIResult = {
      sentence: hypothesis,
      entailed: label === 'entailment' && score >= this.config.threshold,
      label,
      score,
    };

    // Cache result
    if (this.config.enableCaching) {
      this.cache.set(cacheKey, nliResult);
    }

    return nliResult;
  }

  /**
   * Split text into sentences
   */
  private splitSentences(text: string): string[] {
    // Simple sentence splitting (can be improved with NLP library)
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Get cache key
   */
  private getCacheKey(premise: string, hypothesis: string): string {
    // Simple hash (use crypto.createHash in production)
    return `${premise.substring(0, 50)}_${hypothesis.substring(0, 50)}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get status
   */
  getStatus(): {
    initialized: boolean;
    cacheSize: number;
    modelName: string;
    config: NLIGateConfig;
  } {
    return {
      initialized: this.isInitialized,
      cacheSize: this.cache.size,
      modelName: this.config.modelName,
      config: this.config,
    };
  }

  /**
   * Filter generated text to remove non-entailed sentences
   *
   * @param generated Generated text
   * @param evidence Evidence chunks
   * @returns Filtered text with only entailed sentences
   */
  async filterNonEntailed(generated: string, evidence: Evidence[]): Promise<string> {
    const results = await this.checkDetailed(generated, evidence);

    // Keep only entailed sentences
    const entailedSentences = results.filter((r) => r.entailed).map((r) => r.sentence);

    return entailedSentences.join('. ') + (entailedSentences.length > 0 ? '.' : '');
  }
}

/**
 * Default singleton instance
 */
export const nliGate = new NLIGate();
