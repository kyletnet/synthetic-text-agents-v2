/**
 * Cost Tracker
 *
 * Phase 3 Week 4: Track token usage and costs for Adaptive RAG
 *
 * Features:
 * - Real-time token counting
 * - Cost calculation (per operation and total)
 * - Gate F integration
 * - Statistics and reporting
 *
 * Token Pricing (GPT-4 Turbo):
 * - Input: $0.01 / 1K tokens
 * - Output: $0.03 / 1K tokens
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 5)
 */

import type { CostEntry, AdaptiveRAGStats } from './types';

/**
 * Token Pricing Configuration
 */
export interface TokenPricing {
  inputTokensPerUSD: number; // How many input tokens per $1
  outputTokensPerUSD: number; // How many output tokens per $1
}

/**
 * Default Pricing (GPT-4 Turbo)
 */
const DEFAULT_PRICING: TokenPricing = {
  inputTokensPerUSD: 100000, // $0.01 / 1K = 100K tokens per dollar
  outputTokensPerUSD: 33333, // $0.03 / 1K = 33.3K tokens per dollar
};

/**
 * Cost Tracker Configuration
 */
export interface CostTrackerConfig {
  pricing: TokenPricing;
  enableGateF: boolean;
  logFilePath?: string;
}

/**
 * Cost Tracker
 */
export class CostTracker {
  private config: CostTrackerConfig;
  private entries: CostEntry[] = [];
  private stats: {
    totalTokens: number;
    inputTokens: number;
    outputTokens: number;
    totalCostUSD: number;
    operationCounts: Record<string, number>;
  } = {
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalCostUSD: 0,
    operationCounts: {},
  };

  constructor(config?: Partial<CostTrackerConfig>) {
    this.config = {
      pricing: DEFAULT_PRICING,
      enableGateF: true,
      ...config,
    };
  }

  /**
   * Track token usage for an operation
   */
  track(
    queryId: string,
    operation: 'retrieval' | 'generation' | 'confidence_check' | 'reranking',
    tokens: number,
    metadata?: Record<string, unknown>
  ): CostEntry {
    // Determine token type based on operation
    const isOutput = operation === 'generation';
    const tokensPerUSD = isOutput
      ? this.config.pricing.outputTokensPerUSD
      : this.config.pricing.inputTokensPerUSD;

    // Calculate cost
    const costUSD = tokens / tokensPerUSD;

    // Create entry
    const entry: CostEntry = {
      timestamp: Date.now(),
      queryId,
      operation,
      tokens,
      costUSD,
      metadata,
    };

    // Update statistics
    this.entries.push(entry);
    this.stats.totalTokens += tokens;

    if (isOutput) {
      this.stats.outputTokens += tokens;
    } else {
      this.stats.inputTokens += tokens;
    }

    this.stats.totalCostUSD += costUSD;
    this.stats.operationCounts[operation] = (this.stats.operationCounts[operation] || 0) + 1;

    // Integrate with Gate F (if enabled)
    if (this.config.enableGateF) {
      this.reportToGateF(entry);
    }

    return entry;
  }

  /**
   * Estimate tokens for text (simple heuristic)
   */
  estimateTokens(text: string): number {
    // GPT tokenizer approximation:
    // - English: ~1 token per 4 chars
    // - Korean: ~1 token per 2 chars (more bytes per char)

    const koreanChars = (text.match(/[가-힣]/g) || []).length;
    const otherChars = text.length - koreanChars;

    const koreanTokens = Math.ceil(koreanChars / 2);
    const otherTokens = Math.ceil(otherChars / 4);

    return koreanTokens + otherTokens;
  }

  /**
   * Get current statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Get cost entries for a specific query
   */
  getEntriesForQuery(queryId: string): CostEntry[] {
    return this.entries.filter(e => e.queryId === queryId);
  }

  /**
   * Calculate savings compared to baseline
   */
  calculateSavings(baselineTokens: number): {
    tokensSaved: number;
    percentageSaved: number;
    costSavedUSD: number;
  } {
    const tokensSaved = baselineTokens - this.stats.totalTokens;
    const percentageSaved = (tokensSaved / baselineTokens) * 100;

    // Calculate baseline cost (assuming same input/output ratio)
    const baselineInputTokens = Math.ceil(baselineTokens * (this.stats.inputTokens / this.stats.totalTokens));
    const baselineOutputTokens = baselineTokens - baselineInputTokens;

    const baselineCost =
      baselineInputTokens / this.config.pricing.inputTokensPerUSD +
      baselineOutputTokens / this.config.pricing.outputTokensPerUSD;

    const costSavedUSD = baselineCost - this.stats.totalCostUSD;

    return {
      tokensSaved,
      percentageSaved,
      costSavedUSD,
    };
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.entries = [];
    this.stats = {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalCostUSD: 0,
      operationCounts: {},
    };
  }

  /**
   * Export entries to JSON
   */
  exportToJSON(): string {
    return JSON.stringify(
      {
        stats: this.stats,
        entries: this.entries,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  /**
   * Report to Gate F (Throughput Gate)
   */
  private reportToGateF(entry: CostEntry): void {
    // TODO: Integrate with actual Gate F implementation
    // For now, just log to console if verbose
    // console.log(`[Gate F] ${entry.operation}: ${entry.tokens} tokens, $${entry.costUSD.toFixed(4)}`);
  }

  /**
   * Update pricing configuration
   */
  updatePricing(pricing: Partial<TokenPricing>): void {
    this.config.pricing = {
      ...this.config.pricing,
      ...pricing,
    };
  }
}

/**
 * Create cost tracker with default configuration
 */
export function createCostTracker(config?: Partial<CostTrackerConfig>): CostTracker {
  return new CostTracker(config);
}

/**
 * Singleton instance for global cost tracking
 */
let globalCostTracker: CostTracker | null = null;

/**
 * Get or create global cost tracker
 */
export function getGlobalCostTracker(): CostTracker {
  if (!globalCostTracker) {
    globalCostTracker = new CostTracker();
  }
  return globalCostTracker;
}

/**
 * Reset global cost tracker
 */
export function resetGlobalCostTracker(): void {
  if (globalCostTracker) {
    globalCostTracker.reset();
  }
}
