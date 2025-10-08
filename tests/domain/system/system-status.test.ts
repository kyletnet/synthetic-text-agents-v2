/**
 * System Status Domain Tests
 *
 * Unit tests for system status domain logic
 */

import { describe, it, expect } from "vitest";
import {
  SystemHealthCalculator,
  OperationPriorityCalculator,
  type ComponentStatus,
  type Operation,
} from "../../../src/domain/system/system-status.js";

describe("SystemHealthCalculator", () => {
  describe("calculateHealth", () => {
    it("should return 100 for empty component map", () => {
      const components = new Map();
      const health = SystemHealthCalculator.calculateHealth(components);
      expect(health).toBe(100);
    });

    it("should return 100 for all healthy components", () => {
      const components = new Map<string, ComponentStatus>([
        [
          "comp1",
          {
            id: "maintenance-orchestrator",
            status: "healthy",
            lastHeartbeat: new Date(),
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
            lastHeartbeat: new Date(),
            version: "1.0.0",
            capabilities: [],
            dependencies: [],
          },
        ],
      ]);

      const health = SystemHealthCalculator.calculateHealth(components);
      expect(health).toBe(100);
    });

    it("should return 50 for mix of healthy and degraded components", () => {
      const components = new Map<string, ComponentStatus>([
        [
          "comp1",
          {
            id: "maintenance-orchestrator",
            status: "healthy",
            lastHeartbeat: new Date(),
            version: "1.0.0",
            capabilities: [],
            dependencies: [],
          },
        ],
        [
          "comp2",
          {
            id: "unified-dashboard",
            status: "degraded",
            lastHeartbeat: new Date(),
            version: "1.0.0",
            capabilities: [],
            dependencies: [],
          },
        ],
      ]);

      const health = SystemHealthCalculator.calculateHealth(components);
      expect(health).toBe(75); // (100 + 50) / 2
    });

    it("should return 0 for all failed components", () => {
      const components = new Map<string, ComponentStatus>([
        [
          "comp1",
          {
            id: "maintenance-orchestrator",
            status: "failed",
            lastHeartbeat: new Date(),
            version: "1.0.0",
            capabilities: [],
            dependencies: [],
          },
        ],
      ]);

      const health = SystemHealthCalculator.calculateHealth(components);
      expect(health).toBe(0);
    });
  });

  describe("assessComponentHealth", () => {
    it("should mark component as healthy with recent heartbeat", () => {
      const now = new Date();
      const lastHeartbeat = new Date(now.getTime() - 30000); // 30 seconds ago

      const result = SystemHealthCalculator.assessComponentHealth(
        lastHeartbeat,
        now,
      );

      expect(result.isHealthy).toBe(true);
      expect(result.status).toBe("healthy");
    });

    it("should mark component as degraded with old heartbeat", () => {
      const now = new Date();
      const lastHeartbeat = new Date(now.getTime() - 90000); // 90 seconds ago

      const result = SystemHealthCalculator.assessComponentHealth(
        lastHeartbeat,
        now,
      );

      expect(result.isHealthy).toBe(false);
      expect(result.status).toBe("degraded");
      expect(result.reason).toContain("1 minute");
    });

    it("should mark component as failed with very old heartbeat", () => {
      const now = new Date();
      const lastHeartbeat = new Date(now.getTime() - 180000); // 3 minutes ago

      const result = SystemHealthCalculator.assessComponentHealth(
        lastHeartbeat,
        now,
      );

      expect(result.isHealthy).toBe(false);
      expect(result.status).toBe("failed");
      expect(result.reason).toContain("2 minutes");
    });
  });

  describe("createHealthAssessment", () => {
    it("should create correct health assessment", () => {
      const components = new Map([
        [
          "maintenance-orchestrator",
          {
            id: "maintenance-orchestrator" as const,
            status: "healthy" as const,
            lastHeartbeat: new Date(),
            version: "1.0.0",
            capabilities: [],
            dependencies: [],
          },
        ],
        [
          "unified-dashboard",
          {
            id: "unified-dashboard" as const,
            status: "degraded" as const,
            lastHeartbeat: new Date(),
            version: "1.0.0",
            capabilities: [],
            dependencies: [],
          },
        ],
        [
          "unified-reporter",
          {
            id: "unified-reporter" as const,
            status: "failed" as const,
            lastHeartbeat: new Date(),
            version: "1.0.0",
            capabilities: [],
            dependencies: [],
          },
        ],
      ]);

      const assessment =
        SystemHealthCalculator.createHealthAssessment(components);

      expect(assessment.healthyCount).toBe(1);
      expect(assessment.totalCount).toBe(3);
      expect(assessment.degradedComponents).toContain("unified-dashboard");
      expect(assessment.failedComponents).toContain("unified-reporter");
      expect(assessment.recommendations.length).toBeGreaterThan(0);
    });
  });
});

describe("OperationPriorityCalculator", () => {
  describe("getPriorityWeight", () => {
    it("should return correct weights", () => {
      expect(OperationPriorityCalculator.getPriorityWeight("P0")).toBe(3);
      expect(OperationPriorityCalculator.getPriorityWeight("P1")).toBe(2);
      expect(OperationPriorityCalculator.getPriorityWeight("P2")).toBe(1);
    });
  });

  describe("compare", () => {
    it("should sort by priority first", () => {
      const op1: Operation = {
        id: "op1",
        type: "maintenance",
        initiator: "maintenance-orchestrator",
        participants: [],
        status: "pending",
        startTime: new Date(),
        metadata: { priority: "P2" },
      };

      const op2: Operation = {
        id: "op2",
        type: "maintenance",
        initiator: "maintenance-orchestrator",
        participants: [],
        status: "pending",
        startTime: new Date(),
        metadata: { priority: "P0" },
      };

      const result = OperationPriorityCalculator.compare(op1, op2);
      expect(result).toBeGreaterThan(0); // P0 should come before P2
    });

    it("should sort by start time when priority is equal", () => {
      const earlier = new Date("2024-01-01");
      const later = new Date("2024-01-02");

      const op1: Operation = {
        id: "op1",
        type: "maintenance",
        initiator: "maintenance-orchestrator",
        participants: [],
        status: "pending",
        startTime: later,
        metadata: { priority: "P1" },
      };

      const op2: Operation = {
        id: "op2",
        type: "maintenance",
        initiator: "maintenance-orchestrator",
        participants: [],
        status: "pending",
        startTime: earlier,
        metadata: { priority: "P1" },
      };

      const result = OperationPriorityCalculator.compare(op1, op2);
      expect(result).toBeGreaterThan(0); // Earlier should come first
    });
  });

  describe("sortByPriority", () => {
    it("should sort operations correctly", () => {
      const ops: Operation[] = [
        {
          id: "op1",
          type: "maintenance",
          initiator: "maintenance-orchestrator",
          participants: [],
          status: "pending",
          startTime: new Date("2024-01-03"),
          metadata: { priority: "P2" },
        },
        {
          id: "op2",
          type: "maintenance",
          initiator: "maintenance-orchestrator",
          participants: [],
          status: "pending",
          startTime: new Date("2024-01-01"),
          metadata: { priority: "P0" },
        },
        {
          id: "op3",
          type: "maintenance",
          initiator: "maintenance-orchestrator",
          participants: [],
          status: "pending",
          startTime: new Date("2024-01-02"),
          metadata: { priority: "P1" },
        },
      ];

      const sorted = OperationPriorityCalculator.sortByPriority(ops);

      expect(sorted[0].metadata.priority).toBe("P0");
      expect(sorted[1].metadata.priority).toBe("P1");
      expect(sorted[2].metadata.priority).toBe("P2");
    });
  });
});
