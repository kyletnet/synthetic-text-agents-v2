/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Gate E: Explanation Stability
 *
 * Purpose:
 * - Prevent explanation drift (LLM generating different reasons for same decision)
 * - Ensure audit reproducibility
 * - Maintain customer trust in AI reasoning
 *
 * Phase: v3.2.1 - Trust Infrastructure (P2-2)
 */

import {
  ExplanationCache,
  getExplanationCache,
} from "../../core/transparency/explanation-cache.js";
import {
  ExplanationValidator,
  createExplanationValidator,
  type SimilarityResult,
} from "../../core/transparency/explanation-validator.js";

/**
 * Gate E Check Result
 */
export interface GateEResult {
  passed: boolean; // Gate passed or failed
  similarity: number; // Similarity score (0-1)
  action: "allow" | "warn" | "block"; // Action taken
  message: string; // Human-readable message
  details: {
    cached: boolean; // Was baseline cached?
    similarityDetails?: SimilarityResult;
    fallbackUsed?: boolean; // Did we fall back to cached explanation?
  };
}

/**
 * Gate E: Explanation Stability Validator
 *
 * Ensures explanations remain consistent for identical decision contexts
 */
export class GateE {
  private readonly cache: ExplanationCache;
  private readonly validator: ExplanationValidator;
  private readonly threshold: number;

  constructor(options: { threshold?: number } = {}) {
    this.cache = getExplanationCache();
    this.validator = createExplanationValidator({ threshold: options.threshold });
    this.threshold = options.threshold ?? 0.95; // 95% default
  }

  /**
   * Check Explanation Stability
   *
   * Validates that new explanation is consistent with cached baseline
   */
  check(
    decisionContext: Record<string, unknown>,
    newExplanation: string,
  ): GateEResult {
    const cached = this.cache.get(decisionContext);

    // First explanation: cache and allow
    if (!cached) {
      this.cache.set(decisionContext, newExplanation);

      return {
        passed: true,
        similarity: 1.0,
        action: "allow",
        message: "First explanation cached as baseline",
        details: {
          cached: true,
        },
      };
    }

    // Compare with cached baseline
    const similarityResult = this.validator.calculateSimilarity(
      cached.explanation,
      newExplanation,
    );

    const passed = similarityResult.similarity >= this.threshold;

    // Determine action
    let action: "allow" | "warn" | "block";
    let message: string;

    if (passed) {
      action = "allow";
      message = `Explanation consistent with baseline (${(similarityResult.similarity * 100).toFixed(1)}%)`;
    } else if (similarityResult.similarity >= 0.85) {
      // Warning zone: 85-95%
      action = "warn";
      message = `Explanation drift detected (${(similarityResult.similarity * 100).toFixed(1)}%), below threshold ${(this.threshold * 100).toFixed(0)}%`;
    } else {
      // Critical zone: <85%
      action = "block";
      message = `Critical explanation drift (${(similarityResult.similarity * 100).toFixed(1)}%), falling back to cached explanation`;
    }

    return {
      passed,
      similarity: similarityResult.similarity,
      action,
      message,
      details: {
        cached: false,
        similarityDetails: similarityResult,
        fallbackUsed: action === "block",
      },
    };
  }

  /**
   * Get Explanation (with fallback)
   *
   * Returns new explanation if stable, otherwise returns cached baseline
   */
  getStableExplanation(
    decisionContext: Record<string, unknown>,
    newExplanation: string,
  ): string {
    const result = this.check(decisionContext, newExplanation);

    // If critical drift, use cached explanation
    if (result.action === "block") {
      const cached = this.cache.get(decisionContext);
      return cached?.explanation ?? newExplanation;
    }

    return newExplanation;
  }

  /**
   * Get Cache Statistics
   */
  getStats() {
    return this.cache.getStats();
  }
}

/**
 * Create default Gate E instance
 */
export function createGateE(): GateE {
  return new GateE();
}
