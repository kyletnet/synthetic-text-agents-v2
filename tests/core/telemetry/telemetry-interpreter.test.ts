/**
 * Telemetry Interpreter Tests
 */

import { describe, it, expect } from "vitest";
import { TelemetryInterpreter } from "../../../src/core/telemetry/telemetry-interpreter.js";
import type { TelemetryEvent } from "../../../src/core/telemetry/telemetry-types.js";

describe("Telemetry Interpreter", () => {
  const interpreter = new TelemetryInterpreter();

  const createEvent = (
    type: TelemetryEvent["type"],
    target: string = "test-element",
  ): TelemetryEvent => ({
    id: `ev-${Math.random()}`,
    timestamp: new Date(),
    sessionId: "session-123",
    type,
    target,
    metadata: {},
  });

  describe("Intent Inference", () => {
    it("should infer 'trusting' intent for quick approval", () => {
      const events: TelemetryEvent[] = [
        createEvent("click", "trust-badge"),
        createEvent("approve", "approve-button"),
      ];

      const insight = interpreter.interpret(events);

      expect(insight.intent).toBe("trusting");
      expect(insight.intentConfidence).toBeGreaterThan(0.8);
    });

    it("should infer 'distrusting' intent for rollback", () => {
      const events: TelemetryEvent[] = [
        createEvent("click", "trust-badge"),
        createEvent("rollback", "rollback-button"),
      ];

      const insight = interpreter.interpret(events);

      expect(insight.intent).toBe("distrusting");
      expect(insight.intentConfidence).toBeGreaterThan(0.9);
    });

    it("should infer 'verifying' intent for thorough examination", () => {
      const events: TelemetryEvent[] = [
        createEvent("click", "evidence-viewer"),
        createEvent("click", "evidence-item-1"),
        createEvent("click", "evidence-item-2"),
        createEvent("click", "evidence-item-3"),
        createEvent("click", "evidence-item-4"),
        createEvent("explain", "explain-button"),
      ];

      const insight = interpreter.interpret(events);

      expect(insight.intent).toBe("verifying");
      expect(insight.intentConfidence).toBeGreaterThan(0.8);
    });

    it("should infer 'uncertain' intent for repeated explains without approval", () => {
      const events: TelemetryEvent[] = [
        createEvent("explain", "explain-button"),
        createEvent("explain", "explain-button"),
        createEvent("explain", "explain-button"),
      ];

      const insight = interpreter.interpret(events);

      expect(insight.intent).toBe("uncertain");
      expect(insight.intentConfidence).toBeGreaterThan(0.7);
    });

    it("should infer 'exploring' intent for browsing behavior", () => {
      const events: TelemetryEvent[] = [
        createEvent("click", "trust-badge"),
        createEvent("hover", "compliance-badge"),
      ];

      const insight = interpreter.interpret(events);

      expect(insight.intent).toBe("exploring");
    });
  });

  describe("Confidence Score Calculation", () => {
    it("should have high confidence for immediate approval", () => {
      const events: TelemetryEvent[] = [createEvent("approve", "approve-button")];

      const insight = interpreter.interpret(events);

      expect(insight.trustSignals.confidenceScore).toBeGreaterThan(0.8);
    });

    it("should have low confidence for repeated explains", () => {
      const events: TelemetryEvent[] = [
        createEvent("explain", "explain-button"),
        createEvent("explain", "explain-button"),
        createEvent("explain", "explain-button"),
        createEvent("explain", "explain-button"),
      ];

      const insight = interpreter.interpret(events);

      expect(insight.trustSignals.confidenceScore).toBeLessThan(0.5);
    });

    it("should have very low confidence for rollback", () => {
      const events: TelemetryEvent[] = [createEvent("rollback", "rollback-button")];

      const insight = interpreter.interpret(events);

      expect(insight.trustSignals.confidenceScore).toBeLessThan(0.3);
    });
  });

  describe("Verification Depth", () => {
    it("should calculate high verification depth for thorough examination", () => {
      const events: TelemetryEvent[] = [
        createEvent("click", "evidence-item-1"),
        createEvent("click", "evidence-item-2"),
        createEvent("click", "evidence-item-3"),
        createEvent("click", "evidence-item-4"),
        createEvent("click", "evidence-item-5"),
      ];

      const insight = interpreter.interpret(events);

      expect(insight.trustSignals.verificationDepth).toBeGreaterThanOrEqual(0.8);
    });

    it("should calculate low verification depth for minimal examination", () => {
      const events: TelemetryEvent[] = [createEvent("click", "trust-badge")];

      const insight = interpreter.interpret(events);

      expect(insight.trustSignals.verificationDepth).toBeLessThan(0.3);
    });
  });

  describe("Engagement Metrics", () => {
    it("should calculate engagement metrics", () => {
      const events: TelemetryEvent[] = [
        createEvent("click", "trust-badge"),
        createEvent("click", "evidence-viewer"),
        createEvent("approve", "approve-button"),
      ];

      const insight = interpreter.interpret(events);

      expect(insight.engagement.totalEvents).toBe(3);
      expect(insight.engagement.interactionRate).toBeGreaterThan(0);
    });
  });

  describe("Weight Filtering", () => {
    it("should filter low-weight events (default minWeight = 0.3)", () => {
      const events: TelemetryEvent[] = [
        createEvent("approve", "approve-button"), // weight: 1.0
        createEvent("scroll", "page"), // weight: 0.2 (filtered)
        createEvent("hover", "badge"), // weight: 0.3 (kept)
      ];

      const insight = interpreter.interpret(events);

      // Only approve and hover should remain
      expect(insight.engagement.totalEvents).toBe(2);
    });

    it("should apply custom minWeight threshold", () => {
      const customInterpreter = new TelemetryInterpreter({ minWeight: 0.5 });

      const events: TelemetryEvent[] = [
        createEvent("approve", "approve-button"), // weight: 1.0
        createEvent("hover", "badge"), // weight: 0.3 (filtered)
        createEvent("click", "element"), // weight: 0.5 (kept)
      ];

      const insight = customInterpreter.interpret(events);

      // Only approve and click should remain
      expect(insight.engagement.totalEvents).toBe(2);
    });
  });

  describe("Weighted Events Aggregation", () => {
    it("should aggregate events by type with weights", () => {
      const events: TelemetryEvent[] = [
        createEvent("approve", "approve-button"),
        createEvent("approve", "approve-button"),
        createEvent("click", "element"),
      ];

      const insight = interpreter.interpret(events);

      const approveEvent = insight.weightedEvents.find((e) => e.type === "approve");
      const clickEvent = insight.weightedEvents.find((e) => e.type === "click");

      expect(approveEvent?.count).toBe(2);
      expect(approveEvent?.weight).toBe(1.0);
      expect(clickEvent?.count).toBe(1);
      expect(clickEvent?.weight).toBe(0.5);
    });
  });

  describe("Empty Session Handling", () => {
    it("should handle empty event list", () => {
      const insight = interpreter.interpret([]);

      expect(insight.sessionId).toBe("unknown-session");
      expect(insight.intent).toBe("exploring");
      expect(insight.engagement.totalEvents).toBe(0);
      expect(insight.trustSignals.confidenceScore).toBe(0.5);
    });
  });

  describe("Hesitation Detection", () => {
    it("should count hesitation actions", () => {
      const events: TelemetryEvent[] = [
        createEvent("explain", "explain-button"),
        createEvent("explain", "explain-button"),
        createEvent("rollback", "rollback-button"),
      ];

      const insight = interpreter.interpret(events);

      expect(insight.trustSignals.hesitationCount).toBe(3);
    });
  });
});
