/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Telemetry Types
 *
 * Purpose:
 * - User behavior event types
 * - Telemetry interpretation and scoring
 *
 * Phase: v3.2.1 - Trust Infrastructure (P2)
 */

/**
 * Telemetry Event Type
 */
export type TelemetryEventType =
  | "click"
  | "hover"
  | "scroll"
  | "duration"
  | "approve"
  | "rollback"
  | "explain";

/**
 * User Intent (inferred from behavior)
 */
export type UserIntent =
  | "trusting" // Quick approval, minimal checks
  | "verifying" // Evidence viewing, careful examination
  | "uncertain" // Repeated explains, hesitation
  | "distrusting" // Rollback, rejection
  | "exploring"; // Browsing, learning

/**
 * Telemetry Event
 */
export interface TelemetryEvent {
  id: string; // Event ID
  timestamp: Date;
  sessionId: string; // User session ID
  type: TelemetryEventType;
  target: string; // Element ID (e.g., "trust-badge", "evidence-viewer")
  metadata: {
    x?: number; // Mouse X position
    y?: number; // Mouse Y position
    duration?: number; // Time spent (ms)
    value?: string; // Additional context
  };
}

/**
 * Telemetry Insight (interpreted behavior)
 */
export interface TelemetryInsight {
  sessionId: string;
  timestamp: Date;

  // User Intent
  intent: UserIntent;
  intentConfidence: number; // 0-1 scale

  // Engagement Metrics
  engagement: {
    totalEvents: number;
    activeDuration: number; // Active time (ms)
    interactionRate: number; // Events per minute
  };

  // Trust Signals
  trustSignals: {
    confidenceScore: number; // 0-1 (1 = high confidence)
    verificationDepth: number; // 0-1 (1 = thorough examination)
    hesitationCount: number; // Number of uncertain actions
  };

  // Weighted Events (by importance)
  weightedEvents: Array<{
    type: TelemetryEventType;
    count: number;
    weight: number; // 0-1 scale
  }>;
}

/**
 * Telemetry Interpretation Options
 */
export interface TelemetryInterpretationOptions {
  minWeight?: number; // Filter events below this weight (default: 0.3)
  sessionDuration?: number; // Session window (ms, default: 30 minutes)
}

/**
 * Telemetry Statistics
 */
export interface TelemetryStats {
  totalSessions: number;
  totalEvents: number;
  avgConfidenceScore: number;
  avgVerificationDepth: number;
  intentDistribution: Record<UserIntent, number>;
}
