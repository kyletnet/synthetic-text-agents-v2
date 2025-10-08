/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Telemetry Interpreter
 *
 * Purpose:
 * - Convert user behavior events into UX improvement signals
 * - Calculate confidence scores and intent
 * - Weight events by importance
 *
 * Phase: v3.2.1 - Trust Infrastructure (P2)
 */

import type {
  TelemetryEvent,
  TelemetryInsight,
  TelemetryEventType,
  UserIntent,
  TelemetryInterpretationOptions,
} from "./telemetry-types.js";

/**
 * Event Weights (importance scoring)
 *
 * Higher weight = more important signal
 */
const EVENT_WEIGHTS: Record<TelemetryEventType, number> = {
  approve: 1.0, // Strongest trust signal
  rollback: 1.0, // Strongest distrust signal
  explain: 0.8, // High importance (seeking understanding)
  click: 0.5, // Medium importance
  duration: 0.6, // Medium-high (engagement indicator)
  hover: 0.3, // Low importance
  scroll: 0.2, // Lowest importance
};

/**
 * Telemetry Interpreter
 *
 * Converts raw telemetry events into actionable insights
 */
export class TelemetryInterpreter {
  private readonly options: Required<TelemetryInterpretationOptions>;

  constructor(options: TelemetryInterpretationOptions = {}) {
    this.options = {
      minWeight: options.minWeight ?? 0.3,
      sessionDuration: options.sessionDuration ?? 30 * 60 * 1000, // 30 minutes
    };
  }

  /**
   * Interpret Session Events
   *
   * Analyzes all events in a session and generates insights
   */
  interpret(events: TelemetryEvent[]): TelemetryInsight {
    if (events.length === 0) {
      return this.createEmptyInsight("unknown-session");
    }

    const sessionId = events[0].sessionId;
    const filteredEvents = this.filterByWeight(events);

    // Calculate engagement metrics
    const engagement = this.calculateEngagement(filteredEvents);

    // Calculate trust signals
    const trustSignals = this.calculateTrustSignals(filteredEvents);

    // Infer user intent
    const { intent, intentConfidence } = this.inferIntent(filteredEvents);

    // Weight events by type
    const weightedEvents = this.aggregateWeightedEvents(filteredEvents);

    return {
      sessionId,
      timestamp: new Date(),
      intent,
      intentConfidence,
      engagement,
      trustSignals,
      weightedEvents,
    };
  }

  /**
   * Filter Events by Weight
   *
   * Remove low-importance events (weight < minWeight)
   */
  private filterByWeight(events: TelemetryEvent[]): TelemetryEvent[] {
    return events.filter((event) => {
      const weight = EVENT_WEIGHTS[event.type] ?? 0;
      return weight >= this.options.minWeight;
    });
  }

  /**
   * Calculate Engagement Metrics
   */
  private calculateEngagement(events: TelemetryEvent[]) {
    const totalEvents = events.length;

    // Calculate active duration
    const activeDuration = events.reduce((sum, event) => {
      return sum + (event.metadata.duration ?? 0);
    }, 0);

    // Calculate interaction rate (events per minute)
    const sessionDuration = activeDuration > 0 ? activeDuration : 60000; // Min 1 minute
    const interactionRate = (totalEvents / sessionDuration) * 60000; // Events per minute

    return {
      totalEvents,
      activeDuration,
      interactionRate,
    };
  }

  /**
   * Calculate Trust Signals
   *
   * Confidence score interpretation:
   * - Repeated "explain" clicks → low confidence (uncertainty)
   * - Quick "approve" → high confidence (trust)
   * - "rollback" → distrust
   */
  private calculateTrustSignals(events: TelemetryEvent[]) {
    const eventCounts = this.countEventTypes(events);

    // Calculate confidence score (0-1 scale)
    const approveCount = eventCounts.approve ?? 0;
    const rollbackCount = eventCounts.rollback ?? 0;
    const explainCount = eventCounts.explain ?? 0;

    // Confidence formula:
    // - Approve boosts confidence (+0.5 per approve)
    // - Rollback reduces confidence (-0.5 per rollback)
    // - Repeated explains reduce confidence (-0.1 per explain after 2nd)
    const baseConfidence = 0.5;
    const approveBoost = approveCount * 0.5;
    const rollbackPenalty = rollbackCount * 0.5;
    const explainPenalty = Math.max(0, explainCount - 2) * 0.1;

    const confidenceScore = Math.max(
      0,
      Math.min(1, baseConfidence + approveBoost - rollbackPenalty - explainPenalty),
    );

    // Verification depth (how thoroughly user examines evidence)
    const evidenceEvents = events.filter((e) =>
      e.target.includes("evidence"),
    ).length;
    const verificationDepth = Math.min(1, evidenceEvents / 5); // 5+ evidence interactions = full depth

    // Hesitation count (uncertain actions)
    const hesitationCount = explainCount + rollbackCount;

    return {
      confidenceScore,
      verificationDepth,
      hesitationCount,
    };
  }

  /**
   * Infer User Intent
   */
  private inferIntent(
    events: TelemetryEvent[],
  ): { intent: UserIntent; intentConfidence: number } {
    const eventCounts = this.countEventTypes(events);

    const approveCount = eventCounts.approve ?? 0;
    const rollbackCount = eventCounts.rollback ?? 0;
    const explainCount = eventCounts.explain ?? 0;
    const evidenceViews = events.filter((e) =>
      e.target.includes("evidence"),
    ).length;

    // Intent inference logic (order matters!)
    if (rollbackCount > 0) {
      return { intent: "distrusting", intentConfidence: 0.95 };
    }

    if (approveCount > 0 && explainCount <= 1) {
      return { intent: "trusting", intentConfidence: 0.9 };
    }

    // Check uncertain BEFORE verifying (explain without approval = uncertainty)
    if (explainCount >= 2 && approveCount === 0 && evidenceViews < 5) {
      return { intent: "uncertain", intentConfidence: 0.8 };
    }

    if (explainCount >= 3 || evidenceViews >= 5) {
      return { intent: "verifying", intentConfidence: 0.85 };
    }

    return { intent: "exploring", intentConfidence: 0.6 };
  }

  /**
   * Aggregate Weighted Events
   */
  private aggregateWeightedEvents(events: TelemetryEvent[]) {
    const aggregated = new Map<
      TelemetryEventType,
      { count: number; weight: number }
    >();

    for (const event of events) {
      const existing = aggregated.get(event.type);
      const weight = EVENT_WEIGHTS[event.type] ?? 0;

      if (existing) {
        aggregated.set(event.type, {
          count: existing.count + 1,
          weight,
        });
      } else {
        aggregated.set(event.type, { count: 1, weight });
      }
    }

    return Array.from(aggregated.entries()).map(([type, data]) => ({
      type,
      count: data.count,
      weight: data.weight,
    }));
  }

  /**
   * Count Event Types
   */
  private countEventTypes(
    events: TelemetryEvent[],
  ): Partial<Record<TelemetryEventType, number>> {
    const counts: Partial<Record<TelemetryEventType, number>> = {};

    for (const event of events) {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
    }

    return counts;
  }

  /**
   * Create Empty Insight (for empty sessions)
   */
  private createEmptyInsight(sessionId: string): TelemetryInsight {
    return {
      sessionId,
      timestamp: new Date(),
      intent: "exploring",
      intentConfidence: 0,
      engagement: {
        totalEvents: 0,
        activeDuration: 0,
        interactionRate: 0,
      },
      trustSignals: {
        confidenceScore: 0.5,
        verificationDepth: 0,
        hesitationCount: 0,
      },
      weightedEvents: [],
    };
  }
}

/**
 * Create default Telemetry Interpreter
 */
export function createTelemetryInterpreter(): TelemetryInterpreter {
  return new TelemetryInterpreter();
}
