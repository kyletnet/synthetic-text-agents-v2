/**
 * Feedback Interpreter (L4 Optimizer)
 *
 * Interprets user feedback and maps it to system parameters using
 * feedback-mapping.json configuration.
 *
 * Expected gain: Feedback Utilization ≥70%
 *
 * @see RFC 2025-17, Section 1.6
 */

import * as fs from 'fs';
import * as path from 'path';
import type { UserFeedback, SystemParameters, FeedbackMapping, UserIntent } from '../types';
import { FeedbackNoiseFilter, type FilteredFeedback } from './feedback-noise-filter';

/**
 * Feedback Interpreter configuration
 */
export interface FeedbackInterpreterConfig {
  mappingPath: string;
  enableCaching: boolean;
  defaultConfidenceThreshold: number;
}

const DEFAULT_CONFIG: FeedbackInterpreterConfig = {
  mappingPath: path.join(process.cwd(), 'configs/feedback/feedback-mapping.json'),
  enableCaching: true,
  defaultConfidenceThreshold: 0.6,
};

/**
 * Feedback Interpreter
 *
 * Maps user feedback (intent + modifiers) to system parameters.
 */
export class FeedbackInterpreter {
  private config: FeedbackInterpreterConfig;
  private mapping: FeedbackMapping | null = null;
  private cache = new Map<string, SystemParameters>();
  private noiseFilter: FeedbackNoiseFilter;

  constructor(config: Partial<FeedbackInterpreterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.noiseFilter = new FeedbackNoiseFilter();
  }

  /**
   * Load feedback mapping from JSON
   */
  private loadMapping(): FeedbackMapping {
    if (this.mapping) {
      return this.mapping;
    }

    try {
      const content = fs.readFileSync(this.config.mappingPath, 'utf-8');
      const mapping = JSON.parse(content) as FeedbackMapping;
      this.mapping = mapping;
      return mapping;
    } catch (error) {
      throw new Error(
        `Failed to load feedback mapping from ${this.config.mappingPath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Interpret feedback and return system parameters
   *
   * @param feedback User feedback
   * @returns System parameters to apply
   */
  interpret(feedback: UserFeedback): SystemParameters {
    // Check cache
    const cacheKey = this.getCacheKey(feedback);
    if (this.config.enableCaching && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Load mapping
    const mapping = this.loadMapping();

    // Get intent parameters
    const intentParams = mapping.intent_to_params[feedback.intent] || {};

    // Get modifier parameters
    const modifierParams = feedback.modifiers.map(
      (m) => mapping.modifiers[m] || {}
    );

    // Merge parameters (modifiers override intent)
    const merged = this.mergeParameters([intentParams, ...modifierParams]);

    // Cache result
    if (this.config.enableCaching) {
      this.cache.set(cacheKey, merged);
    }

    return merged;
  }

  /**
   * Merge multiple parameter sets
   *
   * Later parameters override earlier ones.
   */
  private mergeParameters(paramSets: SystemParameters[]): SystemParameters {
    const merged: SystemParameters = {};

    for (const params of paramSets) {
      // Merge retrieval
      if (params.retrieval) {
        merged.retrieval = { ...merged.retrieval, ...params.retrieval };
      }

      // Merge operators (append, no duplicates)
      if (params.operators) {
        merged.operators = [
          ...(merged.operators || []),
          ...params.operators.filter((op) => !merged.operators?.includes(op)),
        ];
      }

      // Merge GCG
      if (params.gcg) {
        merged.gcg = { ...merged.gcg, ...params.gcg };
      }

      // Merge reward weights
      if (params.reward) {
        merged.reward = { ...merged.reward, ...params.reward };
      }
    }

    return merged;
  }

  /**
   * Get cache key for feedback
   */
  private getCacheKey(feedback: UserFeedback): string {
    return `${feedback.intent}_${feedback.modifiers.sort().join('_')}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Batch interpret multiple feedbacks
   *
   * GENIUS INSIGHT: Apply noise filter BEFORE interpretation
   * - Filters low-confidence, expired, and adversarial feedback
   * - Applies temporal decay (14-day half-life)
   * - Detects statistical outliers
   *
   * Expected gain: Intent Accuracy +7%p (85% → 92%)
   *
   * @param feedbacks Array of user feedbacks
   * @returns Aggregated system parameters
   */
  batchInterpret(feedbacks: UserFeedback[]): SystemParameters {
    if (feedbacks.length === 0) {
      return {};
    }

    // GENIUS INSIGHT #1: Apply noise filter (3-layer defense)
    const filteredFeedbacks = this.noiseFilter.filter(feedbacks);

    // Remove filtered feedback
    const accepted = filteredFeedbacks
      .filter((f) => !f.filtered)
      .map((f) => this.convertToUserFeedback(f));

    if (accepted.length === 0) {
      return {};
    }

    // Update user reputations
    filteredFeedbacks.forEach((f) => {
      if (f.userId) {
        this.noiseFilter.updateReputation(f.userId, !f.filtered);
      }
    });

    // Interpret each feedback
    const paramSets = accepted.map((f) => this.interpret(f));

    // Aggregate parameters (weighted by adjusted confidence)
    return this.aggregateParameters(paramSets, accepted);
  }

  /**
   * Convert filtered feedback back to user feedback
   */
  private convertToUserFeedback(filtered: FilteredFeedback): UserFeedback {
    return {
      id: filtered.id,
      intent: filtered.intent,
      modifiers: filtered.modifiers,
      confidence: filtered.adjustedConfidence, // Use adjusted confidence
      text: filtered.text,
      timestamp: filtered.timestamp,
      userId: filtered.userId,
      tenantId: filtered.tenantId,
    };
  }

  /**
   * Aggregate parameters from multiple feedbacks (weighted)
   */
  private aggregateParameters(
    paramSets: SystemParameters[],
    feedbacks: UserFeedback[]
  ): SystemParameters {
    const aggregated: SystemParameters = {};

    // Aggregate retrieval parameters (weighted average)
    const retrievalParams = paramSets
      .map((p, i) => ({ params: p.retrieval, confidence: feedbacks[i].confidence }))
      .filter((x) => x.params);

    if (retrievalParams.length > 0) {
      const totalConfidence = retrievalParams.reduce((sum, x) => sum + x.confidence, 0);

      aggregated.retrieval = {
        alpha: this.weightedAverage(
          retrievalParams.map((x) => x.params?.alpha ?? 0.5),
          retrievalParams.map((x) => x.confidence),
          totalConfidence
        ),
        beta: this.weightedAverage(
          retrievalParams.map((x) => x.params?.beta ?? 0.5),
          retrievalParams.map((x) => x.confidence),
          totalConfidence
        ),
        topK: Math.round(
          this.weightedAverage(
            retrievalParams.map((x) => x.params?.topK ?? 10),
            retrievalParams.map((x) => x.confidence),
            totalConfidence
          ) ?? 10
        ),
      };
    }

    // Aggregate operators (union, weighted by confidence)
    const operatorCounts = new Map<string, number>();
    paramSets.forEach((p, i) => {
      p.operators?.forEach((op) => {
        const current = operatorCounts.get(op) || 0;
        operatorCounts.set(op, current + feedbacks[i].confidence);
      });
    });

    if (operatorCounts.size > 0) {
      // Sort by confidence and take top operators
      aggregated.operators = Array.from(operatorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([op]) => op);
    }

    // Aggregate reward weights (weighted average)
    const rewardParams = paramSets
      .map((p, i) => ({ params: p.reward, confidence: feedbacks[i].confidence }))
      .filter((x) => x.params);

    if (rewardParams.length > 0) {
      const totalConfidence = rewardParams.reduce((sum, x) => sum + x.confidence, 0);

      aggregated.reward = {
        groundednessWeight: this.weightedAverage(
          rewardParams.map((x) => x.params!.groundednessWeight),
          rewardParams.map((x) => x.confidence),
          totalConfidence
        ),
        coverageWeight: this.weightedAverage(
          rewardParams.map((x) => x.params!.coverageWeight),
          rewardParams.map((x) => x.confidence),
          totalConfidence
        ),
        readabilityWeight: this.weightedAverage(
          rewardParams.map((x) => x.params!.readabilityWeight),
          rewardParams.map((x) => x.confidence),
          totalConfidence
        ),
      };
    }

    return aggregated;
  }

  /**
   * Weighted average helper
   */
  private weightedAverage(
    values: (number | undefined)[],
    weights: number[],
    totalWeight: number
  ): number | undefined {
    const filtered = values.filter((v): v is number => v !== undefined);
    if (filtered.length === 0) {
      return undefined;
    }

    const weightedSum = filtered.reduce(
      (sum, v, i) => sum + v * weights[i],
      0
    );

    return weightedSum / totalWeight;
  }

  /**
   * Get mapping metadata
   */
  getMetadata(): {
    totalIntents: number;
    totalModifiers: number;
    version: string;
  } {
    const mapping = this.loadMapping();
    return {
      totalIntents: Object.keys(mapping.intent_to_params).length,
      totalModifiers: Object.keys(mapping.modifiers).length,
      version: '1.0.0',
    };
  }

  /**
   * Validate feedback mapping
   *
   * Checks that all intents and modifiers are properly configured.
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const mapping = this.loadMapping();

      // Check all intents have parameters
      for (const intent of Object.keys(mapping.intent_to_params)) {
        const params = mapping.intent_to_params[intent as UserIntent];
        if (!params) {
          errors.push(`Intent '${intent}' has no parameters`);
        }
      }

      // Check all modifiers have parameters
      for (const modifier of Object.keys(mapping.modifiers)) {
        const params = mapping.modifiers[modifier];
        if (!params) {
          errors.push(`Modifier '${modifier}' has no parameters`);
        }
      }
    } catch (error) {
      errors.push(`Failed to load mapping: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): FeedbackInterpreterConfig {
    return this.config;
  }
}

/**
 * Default singleton instance
 */
export const feedbackInterpreter = new FeedbackInterpreter();
