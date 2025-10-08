/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Self-Tuning Agent - Adaptive System Optimization
 *
 * Purpose:
 * - Learn optimal loop intervals from historical data
 * - Suggest (NOT auto-apply) scheduler adjustments
 * - Detect performance patterns and anomalies
 * - Provide recommendations for human approval
 *
 * Phase 2C: Advisor Mode (NO auto-execution)
 *
 * Safety Model:
 * - Advisor mode ONLY: Suggests, never applies
 * - All changes require manual approval
 * - Read-only access to metrics
 * - Cannot modify system state
 */

import type { Logger } from "../../shared/logger.js";

/**
 * Tuning recommendation
 */
export interface TuningRecommendation {
  type: "interval" | "threshold" | "queue" | "other";
  current: number;
  suggested: number;
  reason: string;
  confidence: number; // 0-1
  impact: "low" | "medium" | "high";
  requiresApproval: boolean; // Always true in advisor mode
}

/**
 * Performance pattern
 */
export interface PerformancePattern {
  name: string;
  detected: boolean;
  frequency: number; // Times detected
  lastDetected?: Date;
  recommendation?: TuningRecommendation;
}

/**
 * Tuning history entry
 */
export interface TuningHistoryEntry {
  timestamp: Date;
  intervalMs: number;
  cpuUsage: number;
  memoryUsage: number;
  queueLength: number;
  driftEvents: number;
}

/**
 * Self-Tuning Agent Configuration
 */
export interface SelfTuningConfig {
  mode?: "advisor" | "auto"; // Default: advisor (safe)
  historyWindowSize?: number; // Number of samples to analyze, default: 100
  confidenceThreshold?: number; // Min confidence for recommendations, default: 0.7
  autoApplyEnabled?: boolean; // Enable auto-apply, default: false (DANGEROUS)
}

/**
 * Self-Tuning Agent
 *
 * Learns from system behavior and suggests optimizations.
 *
 * CRITICAL: Advisor mode ONLY - Never auto-applies changes.
 */
export class SelfTuningAgent {
  private readonly logger: Logger;
  private readonly config: Required<SelfTuningConfig>;
  private readonly history: TuningHistoryEntry[] = [];
  private readonly patterns: Map<string, PerformancePattern> = new Map();

  constructor(logger: Logger, config: SelfTuningConfig = {}) {
    this.logger = logger;

    this.config = {
      mode: config.mode ?? "advisor", // Default: advisor (safe)
      historyWindowSize: config.historyWindowSize ?? 100,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
      autoApplyEnabled: config.autoApplyEnabled ?? false,
    };

    // Safety: NEVER allow auto-apply in advisor mode
    if (this.config.mode === "advisor" && this.config.autoApplyEnabled) {
      throw new Error(
        "Auto-apply not allowed in advisor mode (Safety violation)",
      );
    }

    this.logger.info("Self-Tuning Agent initialized", {
      mode: this.config.mode,
      autoApplyEnabled: this.config.autoApplyEnabled,
    });
  }

  /**
   * Record performance sample
   */
  recordSample(sample: Omit<TuningHistoryEntry, "timestamp">): void {
    const entry: TuningHistoryEntry = {
      ...sample,
      timestamp: new Date(),
    };

    this.history.push(entry);

    // Keep only last N samples (rolling window)
    if (this.history.length > this.config.historyWindowSize) {
      this.history.shift();
    }

    this.logger.debug("Performance sample recorded", {
      interval: sample.intervalMs,
      queueLength: sample.queueLength,
      historySize: this.history.length,
    });
  }

  /**
   * Analyze performance and generate recommendations
   *
   * ADVISOR MODE: Returns recommendations for human approval.
   */
  async analyze(): Promise<TuningRecommendation[]> {
    this.logger.info("Analyzing performance patterns...");

    if (this.history.length < 10) {
      this.logger.warn("Insufficient data for analysis", {
        samples: this.history.length,
        required: 10,
      });
      return [];
    }

    const recommendations: TuningRecommendation[] = [];

    // Analysis 1: Optimal interval detection
    const intervalRec = this.analyzeIntervalOptimization();
    if (intervalRec) {
      recommendations.push(intervalRec);
    }

    // Analysis 2: Queue utilization
    const queueRec = this.analyzeQueueUtilization();
    if (queueRec) {
      recommendations.push(queueRec);
    }

    // Analysis 3: Performance patterns
    this.detectPerformancePatterns();

    this.logger.info("Analysis complete", {
      recommendations: recommendations.length,
      patterns: this.patterns.size,
    });

    return recommendations;
  }

  /**
   * Analyze interval optimization
   *
   * Finds optimal interval based on queue length and drift events.
   */
  private analyzeIntervalOptimization(): TuningRecommendation | null {
    // Calculate average queue length and drift events
    const avgQueue =
      this.history.reduce((sum, e) => sum + e.queueLength, 0) /
      this.history.length;
    const avgDrift =
      this.history.reduce((sum, e) => sum + e.driftEvents, 0) /
      this.history.length;

    const currentInterval =
      this.history[this.history.length - 1]?.intervalMs || 5000;

    let suggestedInterval = currentInterval;
    let reason = "";
    let confidence = 0.5;

    // High queue → decrease interval (faster processing)
    if (avgQueue > 15) {
      suggestedInterval = Math.max(2000, currentInterval * 0.8);
      reason = `High queue utilization (avg: ${avgQueue.toFixed(1)}) - decrease interval for faster processing`;
      confidence = 0.8;
    }
    // Low queue + low drift → increase interval (save resources)
    else if (avgQueue < 5 && avgDrift < 1) {
      suggestedInterval = Math.min(10000, currentInterval * 1.3);
      reason = `Low queue + low drift - increase interval to save resources`;
      confidence = 0.7;
    }
    // No change needed
    else {
      return null;
    }

    return {
      type: "interval",
      current: currentInterval,
      suggested: Math.round(suggestedInterval),
      reason,
      confidence,
      impact: "medium",
      requiresApproval: true, // Always require approval
    };
  }

  /**
   * Analyze queue utilization
   */
  private analyzeQueueUtilization(): TuningRecommendation | null {
    const recentSamples = this.history.slice(-20); // Last 20 samples
    const maxQueue = Math.max(...recentSamples.map((s) => s.queueLength));
    const avgQueue =
      recentSamples.reduce((sum, e) => sum + e.queueLength, 0) /
      recentSamples.length;

    const currentMaxQueue = 20; // From loop-scheduler config

    // Queue frequently near max → increase limit
    if (maxQueue >= currentMaxQueue * 0.9) {
      return {
        type: "queue",
        current: currentMaxQueue,
        suggested: Math.min(50, currentMaxQueue * 1.5), // Cap at 50
        reason: `Queue frequently near max (peak: ${maxQueue}) - increase limit to prevent drops`,
        confidence: 0.85,
        impact: "high",
        requiresApproval: true,
      };
    }

    // Queue always low → decrease limit (save memory)
    if (maxQueue < currentMaxQueue * 0.3 && avgQueue < currentMaxQueue * 0.2) {
      return {
        type: "queue",
        current: currentMaxQueue,
        suggested: Math.max(10, Math.ceil(maxQueue * 1.5)), // Keep some headroom
        reason: `Queue underutilized (peak: ${maxQueue}, avg: ${avgQueue.toFixed(1)}) - decrease limit to save memory`,
        confidence: 0.75,
        impact: "low",
        requiresApproval: true,
      };
    }

    return null;
  }

  /**
   * Detect performance patterns
   */
  private detectPerformancePatterns(): void {
    // Pattern 1: Oscillation (interval fluctuating)
    const intervals = this.history.slice(-10).map((h) => h.intervalMs);
    const intervalVariance = this.calculateVariance(intervals);

    if (intervalVariance > 1000000) {
      // High variance
      this.recordPattern("interval_oscillation", {
        detected: true,
        frequency: 1,
        recommendation: {
          type: "other",
          current: 0,
          suggested: 0,
          reason: "Interval oscillation detected - consider fixed interval or wider adaptive range",
          confidence: 0.7,
          impact: "medium",
          requiresApproval: true,
        },
      });
    }

    // Pattern 2: Drift spikes (sudden increases)
    const recentDrifts = this.history.slice(-10).map((h) => h.driftEvents);
    const avgDrift = recentDrifts.reduce((a, b) => a + b, 0) / recentDrifts.length;

    if (avgDrift > 3) {
      this.recordPattern("drift_spike", {
        detected: true,
        frequency: 1,
        recommendation: {
          type: "threshold",
          current: 0.15, // Assuming drift threshold
          suggested: 0.2,
          reason: "Frequent drift events - consider relaxing threshold or improving baseline",
          confidence: 0.6,
          impact: "medium",
          requiresApproval: true,
        },
      });
    }
  }

  /**
   * Record performance pattern
   */
  private recordPattern(
    name: string,
    pattern: Omit<PerformancePattern, "name">,
  ): void {
    const existing = this.patterns.get(name);

    this.patterns.set(name, {
      name,
      detected: pattern.detected,
      frequency: existing ? existing.frequency + 1 : 1,
      lastDetected: new Date(),
      recommendation: pattern.recommendation,
    });

    this.logger.info("Performance pattern detected", {
      pattern: name,
      frequency: this.patterns.get(name)!.frequency,
    });
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map((v) => Math.pow(v - avg, 2));
    return squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Get recommendations summary
   */
  async getRecommendations(): Promise<TuningRecommendation[]> {
    return await this.analyze();
  }

  /**
   * Get detected patterns
   */
  getPatterns(): PerformancePattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get mode
   */
  getMode(): "advisor" | "auto" {
    return this.config.mode;
  }

  /**
   * Check if auto-apply is enabled
   */
  isAutoApplyEnabled(): boolean {
    return this.config.autoApplyEnabled;
  }
}

/**
 * Create safe self-tuning agent (advisor mode)
 */
export function createSafeSelfTuningAgent(logger: Logger): SelfTuningAgent {
  return new SelfTuningAgent(logger, {
    mode: "advisor",
    autoApplyEnabled: false, // NEVER auto-apply
  });
}
