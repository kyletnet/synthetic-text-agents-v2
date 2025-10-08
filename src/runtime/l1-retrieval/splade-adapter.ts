/**
 * SPLADE Adapter (Quick Win #2)
 *
 * SPLADE (Sparse Lexical and Expansion) model for query/document expansion.
 * Uses learned sparse representations for better lexical matching.
 *
 * Expected gain: Recall@10 +10-15%
 *
 * Model: naver/splade-cocondenser-ensembledistil (440MB)
 * Strategy: Expand query with weighted terms, then use with BM25
 *
 * @see RFC 2025-17, Section 1.2
 */

// @ts-expect-error - @xenova/transformers not installed yet
import { pipeline } from '@xenova/transformers';

/**
 * SPLADE configuration
 */
export interface SPLADEConfig {
  modelName: string;
  topK: number; // Number of expansion terms
  minWeight: number; // Minimum term weight threshold
  enableCaching: boolean;
}

const DEFAULT_CONFIG: SPLADEConfig = {
  modelName: 'naver/splade-cocondenser-ensembledistil',
  topK: 10,
  minWeight: 0.1,
  enableCaching: true,
};

/**
 * SPLADE term weight
 */
export interface TermWeight {
  term: string;
  weight: number;
}

/**
 * SPLADE Adapter
 *
 * Provides query expansion using SPLADE sparse lexical model.
 */
export class SPLADEAdapter {
  private model: any = null;
  private config: SPLADEConfig;
  private isInitialized = false;
  private cache = new Map<string, TermWeight[]>();

  constructor(config: Partial<SPLADEConfig> = {}) {
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
      // Load SPLADE model
      this.model = await pipeline('feature-extraction', this.config.modelName, {
        quantized: true,
      });
      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize SPLADEAdapter: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Expand query with SPLADE
   *
   * Returns top-K weighted expansion terms.
   *
   * @param query User query
   * @returns Expanded terms with weights
   */
  async expand(query: string): Promise<TermWeight[]> {
    // Ensure model is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check cache
    if (this.config.enableCaching && this.cache.has(query)) {
      return this.cache.get(query)!;
    }

    // Get SPLADE features
    const features = await this.model(query);

    // Extract top-K weighted terms
    const termWeights = this.extractTopTerms(features, this.config.topK);

    // Cache result
    if (this.config.enableCaching) {
      this.cache.set(query, termWeights);
    }

    return termWeights;
  }

  /**
   * Get expanded query string
   *
   * Combines original query with expansion terms (weighted).
   *
   * @param query Original query
   * @returns Expanded query string
   */
  async expandQueryString(query: string): Promise<string> {
    const expansionTerms = await this.expand(query);

    // Build expanded query: original + expansion terms
    const expandedParts = [query];

    for (const { term, weight } of expansionTerms) {
      // Repeat term based on weight (simple boosting)
      const boost = Math.ceil(weight * 3); // Scale weight to [1, 3] repetitions
      expandedParts.push(...Array(boost).fill(term));
    }

    return expandedParts.join(' ');
  }

  /**
   * Extract top-K weighted terms from SPLADE features
   */
  private extractTopTerms(features: any, topK: number): TermWeight[] {
    // SPLADE outputs sparse vector of term weights
    // Format depends on transformer.js implementation

    // Placeholder: Extract from features (adjust based on actual output format)
    const termWeights: TermWeight[] = [];

    // TODO: Implement actual feature extraction based on model output
    // For now, return empty array (will be implemented when testing with real model)

    if (Array.isArray(features) && features.length > 0) {
      const featureVector = features[0];

      if (featureVector && typeof featureVector === 'object') {
        // Extract non-zero weights
        for (const [term, weight] of Object.entries(featureVector)) {
          if (typeof weight === 'number' && weight >= this.config.minWeight) {
            termWeights.push({ term, weight });
          }
        }
      }
    }

    // Sort by weight and take top-K
    return termWeights
      .sort((a, b) => b.weight - a.weight)
      .slice(0, topK);
  }

  /**
   * Expand document (for indexing)
   *
   * @param document Document text
   * @returns Expanded document with weighted terms
   */
  async expandDocument(document: string): Promise<string> {
    const expansionTerms = await this.expand(document);

    // Build expanded document
    const expandedParts = [document];

    for (const { term, weight } of expansionTerms) {
      // Add expansion terms (weighted)
      const boost = Math.ceil(weight * 2);
      expandedParts.push(...Array(boost).fill(term));
    }

    return expandedParts.join(' ');
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
  } {
    return {
      initialized: this.isInitialized,
      cacheSize: this.cache.size,
      modelName: this.config.modelName,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): SPLADEConfig {
    return this.config;
  }
}

/**
 * Default singleton instance
 */
export const spladeAdapter = new SPLADEAdapter();
