/**
 * System Coordinator Integration Tests
 *
 * Tests the full integration of all use cases
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  SystemCoordinator,
  createSystemCoordinator,
} from "../../../src/application/system/system-coordinator.js";
import { createLogger } from "../../../src/shared/logger.js";
import type {
  ComponentStatus,
  UnifiedMessage,
  Operation,
} from "../../../src/domain/system/system-status.js";

describe("SystemCoordinator", () => {
  let coordinator: SystemCoordinator;
  let logger: ReturnType<typeof createLogger>;

  beforeEach(() => {
    logger = createLogger({ level: "silent" });
    coordinator = createSystemCoordinator(logger, {
      healthCheckIntervalMs: 60000, // Disable auto health checks for tests
      metricsExportIntervalMs: 300000,
    });
  });

  afterEach(async () => {
    await coordinator.shutdown();
  });

  describe("Component Registration", () => {
    it("should register a component", () => {
      const component: ComponentStatus = {
        id: "maintenance-orchestrator",
        status: "healthy",
        lastHeartbeat: new Date(),
        version: "1.0.0",
        capabilities: ["maintenance"],
        dependencies: [],
      };

      coordinator.registerComponent(component);

      const status = coordinator.getSystemStatus();
      expect(status.componentsTotal).toBe(1);
      expect(status.componentsHealthy).toBe(1);
    });

    it("should emit component:registered event", () => {
      return new Promise<void>((resolve) => {
        const component: ComponentStatus = {
          id: "maintenance-orchestrator",
          status: "healthy",
          lastHeartbeat: new Date(),
          version: "1.0.0",
          capabilities: ["maintenance"],
          dependencies: [],
        };

        coordinator.on("component:registered", (registeredComponent) => {
          expect(registeredComponent.id).toBe(component.id);
          resolve();
        });

        coordinator.registerComponent(component);
      });
    });

    it("should unregister a component", () => {
      const component: ComponentStatus = {
        id: "maintenance-orchestrator",
        status: "healthy",
        lastHeartbeat: new Date(),
        version: "1.0.0",
        capabilities: ["maintenance"],
        dependencies: [],
      };

      coordinator.registerComponent(component);
      coordinator.unregisterComponent("maintenance-orchestrator");

      const status = coordinator.getSystemStatus();
      expect(status.componentsTotal).toBe(0);
    });
  });

  describe("Message Routing", () => {
    it("should route a message", async () => {
      const component: ComponentStatus = {
        id: "maintenance-orchestrator",
        status: "healthy",
        lastHeartbeat: new Date(),
        version: "1.0.0",
        capabilities: [],
        dependencies: [],
      };

      coordinator.registerComponent(component);

      const message: UnifiedMessage = {
        source: "maintenance-orchestrator",
        target: "unified-dashboard",
        type: "request",
        priority: "P1",
        payload: { test: "data" },
        correlation: "test-123",
        timestamp: new Date(),
      };

      await coordinator.sendMessage(message);

      const status = coordinator.getSystemStatus();
      expect(status.queuedMessages).toBeGreaterThan(0);
    });

    it("should emit message:routed event", () => {
      return new Promise<void>((resolve) => {
        const message: UnifiedMessage = {
          source: "maintenance-orchestrator",
          target: "unified-dashboard",
          type: "request",
          priority: "P1",
          payload: { test: "data" },
          correlation: "test-123",
          timestamp: new Date(),
        };

        coordinator.on("message:routed", (event) => {
          expect(event.message.correlation).toBe(message.correlation);
          expect(event.routingMode).toBeDefined();
          resolve();
        });

        coordinator.sendMessage(message);
      });
    });

    it("should broadcast messages", () => {
      return new Promise<void>((resolve) => {
        const message: UnifiedMessage = {
          source: "maintenance-orchestrator",
          target: "broadcast",
          type: "event",
          priority: "P2",
          payload: { test: "broadcast" },
          correlation: "broadcast-123",
          timestamp: new Date(),
        };

        coordinator.on("message:broadcast", (broadcastMessage) => {
          expect(broadcastMessage.correlation).toBe(message.correlation);
          resolve();
        });

        coordinator.sendMessage(message);
      });
    });
  });

  describe("Operation Execution", () => {
    it("should start an operation", async () => {
      const component: ComponentStatus = {
        id: "maintenance-orchestrator",
        status: "healthy",
        lastHeartbeat: new Date(),
        version: "1.0.0",
        capabilities: ["maintenance"],
        dependencies: [],
      };

      coordinator.registerComponent(component);

      const operation: Operation = {
        id: "op-123",
        type: "maintenance",
        initiator: "maintenance-orchestrator",
        participants: ["maintenance-orchestrator"],
        status: "pending",
        startTime: new Date(),
        metadata: { priority: "P1" },
      };

      const operationId = await coordinator.startOperation(operation);

      expect(operationId).toBe("op-123");

      const status = coordinator.getSystemStatus();
      expect(status.activeOperations).toBe(1);
    });

    it("should emit operation:started event", () => {
      return new Promise<void>((resolve) => {
        const component: ComponentStatus = {
          id: "maintenance-orchestrator",
          status: "healthy",
          lastHeartbeat: new Date(),
          version: "1.0.0",
          capabilities: ["maintenance"],
          dependencies: [],
        };

        coordinator.registerComponent(component);

        const operation: Operation = {
          id: "op-123",
          type: "maintenance",
          initiator: "maintenance-orchestrator",
          participants: ["maintenance-orchestrator"],
          status: "pending",
          startTime: new Date(),
          metadata: { priority: "P1" },
        };

        coordinator.on("operation:started", (startedOperation) => {
          expect(startedOperation.id).toBe(operation.id);
          resolve();
        });

        coordinator.startOperation(operation);
      });
    });
  });

  describe("Health Monitoring", () => {
    it("should check health manually", async () => {
      const component: ComponentStatus = {
        id: "maintenance-orchestrator",
        status: "healthy",
        lastHeartbeat: new Date(),
        version: "1.0.0",
        capabilities: [],
        dependencies: [],
      };

      coordinator.registerComponent(component);

      const healthResponse = await coordinator.checkHealth();

      expect(healthResponse.success).toBe(true);
      expect(healthResponse.systemHealth.health).toBeGreaterThan(0);
    });

    it("should emit health:updated event", () => {
      return new Promise<void>((resolve) => {
        const component: ComponentStatus = {
          id: "maintenance-orchestrator",
          status: "healthy",
          lastHeartbeat: new Date(),
          version: "1.0.0",
          capabilities: [],
          dependencies: [],
        };

        coordinator.registerComponent(component);

        coordinator.on("health:updated", (health) => {
          expect(health).toBeGreaterThan(0);
          resolve();
        });

        coordinator.checkHealth();
      });
    });
  });

  describe("System Validation", () => {
    it("should validate system", async () => {
      const component: ComponentStatus = {
        id: "maintenance-orchestrator",
        status: "healthy",
        lastHeartbeat: new Date(),
        version: "1.0.0",
        capabilities: [],
        dependencies: [],
      };

      coordinator.registerComponent(component);

      const validation = await coordinator.validateSystem();

      expect(validation.valid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it("should detect validation errors with unhealthy components", async () => {
      const component: ComponentStatus = {
        id: "maintenance-orchestrator",
        status: "failed",
        lastHeartbeat: new Date(Date.now() - 300000), // 5 minutes ago
        version: "1.0.0",
        capabilities: [],
        dependencies: [],
      };

      coordinator.registerComponent(component);

      const validation = await coordinator.validateSystem();

      expect(validation.componentValidations.size).toBe(1);
      const componentValidation = validation.componentValidations.get(
        "maintenance-orchestrator",
      );
      expect(componentValidation?.isHealthy).toBe(false);
    });
  });

  describe("System Status", () => {
    it("should return system status", () => {
      const status = coordinator.getSystemStatus();

      expect(status).toHaveProperty("health");
      expect(status).toHaveProperty("componentsHealthy");
      expect(status).toHaveProperty("componentsTotal");
      expect(status).toHaveProperty("activeOperations");
      expect(status).toHaveProperty("messageQueues");
    });

    it("should track multiple components", () => {
      const components: ComponentStatus[] = [
        {
          id: "maintenance-orchestrator",
          status: "healthy",
          lastHeartbeat: new Date(),
          version: "1.0.0",
          capabilities: [],
          dependencies: [],
        },
        {
          id: "unified-dashboard",
          status: "healthy",
          lastHeartbeat: new Date(),
          version: "1.0.0",
          capabilities: [],
          dependencies: [],
        },
        {
          id: "unified-reporter",
          status: "degraded",
          lastHeartbeat: new Date(),
          version: "1.0.0",
          capabilities: [],
          dependencies: [],
        },
      ];

      components.forEach((c) => coordinator.registerComponent(c));

      const status = coordinator.getSystemStatus();
      expect(status.componentsTotal).toBe(3);
      expect(status.componentsHealthy).toBe(2);
    });
  });

  describe("Routing Metrics", () => {
    it("should provide routing metrics", () => {
      const metrics = coordinator.getRoutingMetrics();

      expect(metrics).toHaveProperty("totalMessages");
      expect(metrics).toHaveProperty("modeDistribution");
      expect(metrics).toHaveProperty("averageLatency");
    });

    it("should provide routing status", () => {
      const status = coordinator.getRoutingStatus();

      expect(status).toHaveProperty("currentMode");
      expect(status).toHaveProperty("metrics");
      expect(status).toHaveProperty("performance");
      expect(status).toHaveProperty("recentHistory");
    });
  });

  describe("Shutdown", () => {
    it("should shutdown cleanly", async () => {
      await expect(coordinator.shutdown()).resolves.not.toThrow();
    });

    it("should remove all listeners on shutdown", async () => {
      coordinator.on("test", () => {});
      expect(coordinator.listenerCount("test")).toBe(1);

      await coordinator.shutdown();

      expect(coordinator.listenerCount("test")).toBe(0);
    });
  });
});
