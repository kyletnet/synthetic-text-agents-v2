/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Predictive Feedback Recorder
 *
 * Records governance decisions and outcomes for future ML-based prediction.
 * This is the foundation for Stage 4: Self-Evolving Architecture.
 *
 * Design Philosophy (from GPT insight):
 * "Don't build ML first. Build the feedback loop that collects training data."
 *
 * Data Flow:
 * 1. Domain event occurs (threshold change, quality shift, etc.)
 * 2. Governance policy evaluated
 * 3. Outcome recorded (gate passed/failed, drift detected, etc.)
 * 4. After 2-3 weeks, sufficient data for ML training
 *
 * Output Format: prediction-train.jsonl
 * Each line contains:
 * - event: Domain event that triggered policy
 * - delta: Measured change (cost, quality, threshold, etc.)
 * - outcome: Gate result or policy decision
 * - features: Contextual data for ML (time, profile, history, etc.)
 */

import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";

export interface PredictionExample {
  timestamp: string;
  eventType: string;
  eventActor: string;
  delta: {
    metric: string;
    oldValue: number | null;
    newValue: number;
    percentChange: number;
  };
  outcome: {
    gatePassed: boolean;
    severity: "P0" | "P1" | "P2" | "info";
    action: string[];
  };
  features: {
    timeOfDay: string;
    dayOfWeek: string;
    profile: string;
    recentHistory: Array<{
      metric: string;
      value: number;
      timestamp: string;
    }>;
    contextMetrics: Record<string, number>;
  };
  labels: {
    isDrift: boolean;
    isAnomaly: boolean;
    requiresIntervention: boolean;
  };
}

/**
 * Predictive Feedback Recorder
 */
export class PredictiveFeedbackRecorder {
  private outputPath: string;
  private historyWindow: number = 10; // Keep last N events for context
  private recentEvents: PredictionExample[] = [];

  constructor(projectRoot: string = process.cwd()) {
    this.outputPath = join(
      projectRoot,
      "reports/governance/prediction-train.jsonl",
    );

    // Ensure directory exists
    const dir = join(projectRoot, "reports/governance");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Initialize recorder
   */
  async initialize(): Promise<void> {
    console.log("[Predictive Feedback] Initialized training data collection");
    console.log(`[Predictive Feedback] Output: ${this.outputPath}`);
  }

  /**
   * Record prediction example from domain event
   */
  recordFromDomainEvent(
    event: {
      type: string;
      actor: string;
      data: Record<string, unknown>;
      timestamp: string;
    },
    outcome: {
      gatePassed: boolean;
      severity: "P0" | "P1" | "P2" | "info";
      action: string[];
    },
  ): void {
    // Extract delta if available
    const delta = this.extractDelta(event);
    if (!delta) {
      // Skip events without measurable delta
      return;
    }

    // Build features
    const features = this.buildFeatures(event);

    // Determine labels
    const labels = this.determineLabels(delta, outcome);

    const example: PredictionExample = {
      timestamp: event.timestamp,
      eventType: event.type,
      eventActor: event.actor,
      delta,
      outcome,
      features,
      labels,
    };

    // Add to history
    this.recentEvents.push(example);
    if (this.recentEvents.length > this.historyWindow) {
      this.recentEvents.shift();
    }

    // Write to JSONL
    this.writeToFile(example);
  }

  /**
   * Extract measurable delta from event
   */
  private extractDelta(event: {
    type: string;
    data: Record<string, unknown>;
  }): PredictionExample["delta"] | null {
    const { data } = event;

    // Threshold changes
    if (event.type.includes("threshold")) {
      const oldValue = (data.oldValue as number) || null;
      const newValue = data.newValue as number;
      const percentChange = oldValue
        ? ((newValue - oldValue) / oldValue) * 100
        : 0;

      return {
        metric: (data.metric as string) || "threshold",
        oldValue,
        newValue,
        percentChange,
      };
    }

    // Quality score changes
    if (event.type.includes("quality")) {
      const oldValue = (data.oldScore as number) || null;
      const newValue = data.newScore as number;
      const percentChange = oldValue
        ? ((newValue - oldValue) / oldValue) * 100
        : 0;

      return {
        metric: "quality_score",
        oldValue,
        newValue,
        percentChange,
      };
    }

    // Cost/performance changes
    if (event.type.includes("metric")) {
      const metric = (data.metricName as string) || "unknown";
      const oldValue = (data.previousValue as number) || null;
      const newValue = data.currentValue as number;
      const percentChange = oldValue
        ? ((newValue - oldValue) / oldValue) * 100
        : 0;

      return {
        metric,
        oldValue,
        newValue,
        percentChange,
      };
    }

    return null;
  }

  /**
   * Build feature vector for ML
   */
  private buildFeatures(event: {
    timestamp: string;
    data: Record<string, unknown>;
  }): PredictionExample["features"] {
    const date = new Date(event.timestamp);

    // Time-based features
    const timeOfDay = date.getHours().toString().padStart(2, "0") + ":00";
    const dayOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ][date.getDay()];

    // Profile context
    const profile = (event.data.profile as string) || "dev";

    // Recent history (last N events)
    const recentHistory = this.recentEvents.slice(-5).map((e) => ({
      metric: e.delta.metric,
      value: e.delta.newValue,
      timestamp: e.timestamp,
    }));

    // Context metrics
    const contextMetrics: Record<string, number> = {
      recentEventsCount: this.recentEvents.length,
      recentDriftRate: this.calculateRecentDriftRate(),
      avgDeltaMagnitude: this.calculateAvgDeltaMagnitude(),
    };

    return {
      timeOfDay,
      dayOfWeek,
      profile,
      recentHistory,
      contextMetrics,
    };
  }

  /**
   * Determine labels for supervised learning
   */
  private determineLabels(
    delta: PredictionExample["delta"],
    outcome: PredictionExample["outcome"],
  ): PredictionExample["labels"] {
    // Drift detection: >20% change
    const isDrift = Math.abs(delta.percentChange) > 20;

    // Anomaly detection: Gate failed
    const isAnomaly = !outcome.gatePassed;

    // Intervention required: P0 or P1 severity
    const requiresIntervention = ["P0", "P1"].includes(outcome.severity);

    return {
      isDrift,
      isAnomaly,
      requiresIntervention,
    };
  }

  /**
   * Calculate recent drift rate
   */
  private calculateRecentDriftRate(): number {
    if (this.recentEvents.length === 0) return 0;

    const driftCount = this.recentEvents.filter(
      (e) => Math.abs(e.delta.percentChange) > 20,
    ).length;

    return driftCount / this.recentEvents.length;
  }

  /**
   * Calculate average delta magnitude
   */
  private calculateAvgDeltaMagnitude(): number {
    if (this.recentEvents.length === 0) return 0;

    const total = this.recentEvents.reduce(
      (sum, e) => sum + Math.abs(e.delta.percentChange),
      0,
    );

    return total / this.recentEvents.length;
  }

  /**
   * Write example to JSONL file
   */
  private writeToFile(example: PredictionExample): void {
    try {
      appendFileSync(this.outputPath, JSON.stringify(example) + "\n");
    } catch (error) {
      console.error(
        "[Predictive Feedback] Failed to write training data:",
        error,
      );
    }
  }

  /**
   * Get training data path
   */
  getOutputPath(): string {
    return this.outputPath;
  }

  /**
   * Get recent event history
   */
  getRecentEvents(): PredictionExample[] {
    return [...this.recentEvents];
  }
}
