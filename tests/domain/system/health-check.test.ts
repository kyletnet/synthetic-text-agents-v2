/**
 * Health Check Rules Tests
 *
 * Unit tests for health check domain rules
 */

import { describe, it, expect } from "vitest";
import {
  HealthCheckRules,
  HeartbeatValidator,
  DEFAULT_HEALTH_THRESHOLDS,
  type ComponentStatus,
} from "../../../src/domain/system/health-check.js";

describe("HealthCheckRules", () => {
  const rules = new HealthCheckRules(DEFAULT_HEALTH_THRESHOLDS);

  describe("checkComponentHealth", () => {
    it("should mark component as healthy with fresh heartbeat", () => {
      const now = new Date();
      const component: ComponentStatus = {
        id: "maintenance-orchestrator",
        status: "healthy",
        lastHeartbeat: new Date(now.getTime() - 30000), // 30s ago
        version: "1.0.0",
        capabilities: [],
        dependencies: [],
      };

      const result = rules.checkComponentHealth(component, now);

      expect(result.newStatus).toBe("healthy");
      expect(result.changed).toBe(false);
      expect(result.reason).toContain("normally");
    });

    it("should mark component as degraded with stale heartbeat", () => {
      const now = new Date();
      const component: ComponentStatus = {
        id: "maintenance-orchestrator",
        status: "healthy",
        lastHeartbeat: new Date(now.getTime() - 90000), // 90s ago
        version: "1.0.0",
        capabilities: [],
        dependencies: [],
      };

      const result = rules.checkComponentHealth(component, now);

      expect(result.newStatus).toBe("degraded");
      expect(result.changed).toBe(true);
      expect(result.reason).toContain("Slow heartbeat");
    });

    it("should mark component as failed with very old heartbeat", () => {
      const now = new Date();
      const component: ComponentStatus = {
        id: "maintenance-orchestrator",
        status: "healthy",
        lastHeartbeat: new Date(now.getTime() - 180000), // 3min ago
        version: "1.0.0",
        capabilities: [],
        dependencies: [],
      };

      const result = rules.checkComponentHealth(component, now);

      expect(result.newStatus).toBe("failed");
      expect(result.changed).toBe(true);
      expect(result.reason).toContain("No heartbeat");
    });
  });

  describe("checkAllComponents", () => {
    it("should check all components", () => {
      const now = new Date();
      const components = new Map<string, ComponentStatus>([
        [
          "comp1",
          {
            id: "maintenance-orchestrator",
            status: "healthy",
            lastHeartbeat: new Date(now.getTime() - 30000),
            version: "1.0.0",
            capabilities: [],
            dependencies: [],
          },
        ],
        [
          "comp2",
          {
            id: "unified-dashboard",
            status: "healthy",
            lastHeartbeat: new Date(now.getTime() - 90000),
            version: "1.0.0",
            capabilities: [],
            dependencies: [],
          },
        ],
      ]);

      const results = rules.checkAllComponents(components, now);

      expect(results.length).toBe(2);
      expect(results[0].newStatus).toBe("healthy");
      expect(results[1].newStatus).toBe("degraded");
    });
  });

  describe("determineSystemHealthStatus", () => {
    it("should return critical for very low health", () => {
      const status = rules.determineSystemHealthStatus(30);
      expect(status).toBe("critical");
    });

    it("should return warning for moderate health", () => {
      const status = rules.determineSystemHealthStatus(60);
      expect(status).toBe("warning");
    });

    it("should return healthy for good health", () => {
      const status = rules.determineSystemHealthStatus(80);
      expect(status).toBe("healthy");
    });
  });

  describe("shouldAlert", () => {
    it("should alert on status degradation from healthy to degraded", () => {
      const result = {
        componentId: "maintenance-orchestrator" as const,
        previousStatus: "healthy" as const,
        newStatus: "degraded" as const,
        changed: true,
        timeSinceHeartbeat: 90000,
        reason: "Degraded",
      };

      expect(rules.shouldAlert(result)).toBe(true);
    });

    it("should alert on status degradation from degraded to failed", () => {
      const result = {
        componentId: "maintenance-orchestrator" as const,
        previousStatus: "degraded" as const,
        newStatus: "failed" as const,
        changed: true,
        timeSinceHeartbeat: 180000,
        reason: "Failed",
      };

      expect(rules.shouldAlert(result)).toBe(true);
    });

    it("should not alert if status unchanged", () => {
      const result = {
        componentId: "maintenance-orchestrator" as const,
        previousStatus: "healthy" as const,
        newStatus: "healthy" as const,
        changed: false,
        timeSinceHeartbeat: 30000,
        reason: "Normal",
      };

      expect(rules.shouldAlert(result)).toBe(false);
    });

    it("should not alert on status improvement", () => {
      const result = {
        componentId: "maintenance-orchestrator" as const,
        previousStatus: "degraded" as const,
        newStatus: "healthy" as const,
        changed: true,
        timeSinceHeartbeat: 30000,
        reason: "Recovered",
      };

      expect(rules.shouldAlert(result)).toBe(false);
    });
  });

  describe("getRecommendedCheckInterval", () => {
    it("should recommend 5s for critical health", () => {
      const interval = rules.getRecommendedCheckInterval(30);
      expect(interval).toBe(5000);
    });

    it("should recommend 15s for warning health", () => {
      const interval = rules.getRecommendedCheckInterval(60);
      expect(interval).toBe(15000);
    });

    it("should recommend 30s for healthy systems", () => {
      const interval = rules.getRecommendedCheckInterval(80);
      expect(interval).toBe(30000);
    });
  });
});

describe("HeartbeatValidator", () => {
  describe("isHeartbeatFresh", () => {
    it("should return true for fresh heartbeat", () => {
      const now = new Date();
      const heartbeat = new Date(now.getTime() - 30000); // 30s ago

      const result = HeartbeatValidator.isHeartbeatFresh(heartbeat, 60000, now);

      expect(result).toBe(true);
    });

    it("should return false for stale heartbeat", () => {
      const now = new Date();
      const heartbeat = new Date(now.getTime() - 90000); // 90s ago

      const result = HeartbeatValidator.isHeartbeatFresh(heartbeat, 60000, now);

      expect(result).toBe(false);
    });
  });

  describe("validateHeartbeatConsistency", () => {
    it("should detect consistent heartbeats", () => {
      const heartbeats = [
        new Date("2024-01-01T00:00:00"),
        new Date("2024-01-01T00:00:30"),
        new Date("2024-01-01T00:01:00"),
        new Date("2024-01-01T00:01:30"),
      ];

      const result = HeartbeatValidator.validateHeartbeatConsistency(
        heartbeats,
        30000, // 30s expected interval
        5000, // 5s tolerance
      );

      expect(result.consistent).toBe(true);
      expect(result.averageInterval).toBe(30000);
    });

    it("should detect inconsistent heartbeats", () => {
      const heartbeats = [
        new Date("2024-01-01T00:00:00"),
        new Date("2024-01-01T00:00:30"),
        new Date("2024-01-01T00:02:00"), // Large gap
        new Date("2024-01-01T00:02:30"),
      ];

      const result = HeartbeatValidator.validateHeartbeatConsistency(
        heartbeats,
        30000,
        5000,
      );

      expect(result.consistent).toBe(false);
      expect(result.gaps.length).toBe(3);
    });

    it("should handle single heartbeat", () => {
      const heartbeats = [new Date("2024-01-01T00:00:00")];

      const result = HeartbeatValidator.validateHeartbeatConsistency(
        heartbeats,
        30000,
        5000,
      );

      expect(result.consistent).toBe(true);
      expect(result.averageInterval).toBe(0);
    });
  });
});
