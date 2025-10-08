/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Explanation Cache
 *
 * Purpose:
 * - Cache first explanation for each decision context
 * - Ensure deterministic explanations for audit reproducibility
 * - Enable explanation drift detection
 *
 * Phase: v3.2.1 - Trust Infrastructure (P2-2: Gate E)
 */

import { createHash } from "node:crypto";

/**
 * Cached Explanation Entry
 */
export interface CachedExplanation {
  contextHash: string; // Hash of decision context
  explanation: string; // Cached explanation text
  timestamp: Date; // When first generated
  usageCount: number; // How many times retrieved
}

/**
 * Explanation Cache
 *
 * Stores first explanation for each unique decision context
 */
export class ExplanationCache {
  private cache: Map<string, CachedExplanation> = new Map();

  /**
   * Generate Context Hash
   *
   * Creates a deterministic hash from decision context
   */
  private generateContextHash(context: Record<string, unknown>): string {
    // Sort keys for deterministic hashing
    const sortedKeys = Object.keys(context).sort();
    const normalized = sortedKeys.map((key) => `${key}:${JSON.stringify(context[key])}`).join("|");

    return createHash("sha256").update(normalized).digest("hex");
  }

  /**
   * Get Cached Explanation
   *
   * Returns cached explanation if exists, otherwise null
   */
  get(context: Record<string, unknown>): CachedExplanation | null {
    const hash = this.generateContextHash(context);
    const cached = this.cache.get(hash);

    if (cached) {
      // Increment usage count
      const currentCount = cached.usageCount;
      cached.usageCount++;

      // Return snapshot with current count (before increment)
      return {
        ...cached,
        usageCount: currentCount,
      };
    }

    return null;
  }

  /**
   * Set Cached Explanation
   *
   * Stores explanation for future lookups
   */
  set(context: Record<string, unknown>, explanation: string): void {
    const hash = this.generateContextHash(context);

    // Only cache if not already present (first-write-wins)
    if (!this.cache.has(hash)) {
      this.cache.set(hash, {
        contextHash: hash,
        explanation,
        timestamp: new Date(),
        usageCount: 0,
      });
    }
  }

  /**
   * Check if explanation exists for context
   */
  has(context: Record<string, unknown>): boolean {
    const hash = this.generateContextHash(context);
    return this.cache.has(hash);
  }

  /**
   * Clear cache (for testing)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values());

    return {
      totalEntries: this.cache.size,
      totalUsage: entries.reduce((sum, e) => sum + e.usageCount, 0),
      avgUsagePerEntry: this.cache.size > 0
        ? entries.reduce((sum, e) => sum + e.usageCount, 0) / this.cache.size
        : 0,
      oldestEntry: entries.length > 0
        ? new Date(Math.min(...entries.map((e) => e.timestamp.getTime())))
        : null,
      newestEntry: entries.length > 0
        ? new Date(Math.max(...entries.map((e) => e.timestamp.getTime())))
        : null,
    };
  }
}

/**
 * Global Explanation Cache
 */
let globalCache: ExplanationCache | null = null;

/**
 * Get Global Explanation Cache
 */
export function getExplanationCache(): ExplanationCache {
  if (!globalCache) {
    globalCache = new ExplanationCache();
  }
  return globalCache;
}

/**
 * Reset Global Explanation Cache (for testing)
 */
export function resetExplanationCache(): void {
  globalCache = null;
}
