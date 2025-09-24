/**
 * Unit tests for Circuit Breaker implementation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CircuitBreaker,
  CircuitState,
  CircuitBreakerError,
  CircuitBreakerRegistry,
  getCircuitBreaker,
  withCircuitBreaker,
} from "../../src/shared/circuitBreaker";
import { TestUtils } from "../setup";

describe("CircuitBreaker", () => {
  let circuitBreaker: CircuitBreaker;
  let mockMonitor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockMonitor = vi.fn();
    circuitBreaker = new CircuitBreaker("test-circuit", {
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 1000,
      monitor: mockMonitor,
    });
  });

  describe("Normal Operation (CLOSED state)", () => {
    it("should start in CLOSED state", () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should execute successful operations normally", async () => {
      const mockOperation = vi.fn().mockResolvedValue("success");

      const result = await circuitBreaker.execute(mockOperation);

      expect(result).toBe("success");
      expect(mockOperation).toHaveBeenCalledOnce();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it("should track successful operations in metrics", async () => {
      const mockOperation = vi.fn().mockResolvedValue("success");

      await circuitBreaker.execute(mockOperation);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successCount).toBe(1);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.consecutiveSuccesses).toBe(1);
      expect(metrics.consecutiveFailures).toBe(0);
    });

    it("should handle individual failures without opening circuit", async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(new Error("operation failed"));

      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
        "operation failed",
      );

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successCount).toBe(0);
      expect(metrics.failureCount).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
    });
  });

  describe("Circuit Opening (CLOSED -> OPEN)", () => {
    it("should open circuit after failure threshold is reached", async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(new Error("operation failed"));

      // Execute failures up to threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
          "operation failed",
        );
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(mockMonitor).toHaveBeenCalledWith(
        expect.objectContaining({
          state: CircuitState.OPEN,
          previousState: CircuitState.CLOSED,
          reason: "Failure threshold reached: 3 consecutive failures",
        }),
      );
    });

    it("should reject requests immediately when circuit is open", async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(new Error("operation failed"));

      // Trigger circuit to open
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
          "operation failed",
        );
      }

      // Now circuit should be open and reject immediately
      const newOperation = vi.fn().mockResolvedValue("success");

      await expect(circuitBreaker.execute(newOperation)).rejects.toThrow(
        CircuitBreakerError,
      );
      expect(newOperation).not.toHaveBeenCalled();
    });

    it("should include retry time in circuit breaker error", async () => {
      const mockOperation = vi
        .fn()
        .mockRejectedValue(new Error("operation failed"));

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(
          "operation failed",
        );
      }

      // Try to execute when circuit is open
      try {
        await circuitBreaker.execute(vi.fn());
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerError);
        expect((error as CircuitBreakerError).circuitName).toBe("test-circuit");
        expect((error as CircuitBreakerError).state).toBe(CircuitState.OPEN);
        expect((error as CircuitBreakerError).message).toContain(
          "Next attempt at",
        );
      }
    });
  });

  describe("Circuit Recovery (OPEN -> HALF_OPEN -> CLOSED)", () => {
    beforeEach(async () => {
      // Open the circuit first
      const failingOperation = vi
        .fn()
        .mockRejectedValue(new Error("operation failed"));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow(
          "operation failed",
        );
      }
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it("should transition to HALF_OPEN after timeout", async () => {
      vi.useFakeTimers();

      // Advance time past the timeout
      vi.advanceTimersByTime(1100);

      const mockOperation = vi.fn().mockResolvedValue("success");
      await circuitBreaker.execute(mockOperation);

      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      vi.useRealTimers();
    });

    it("should close circuit after sufficient successes in HALF_OPEN", async () => {
      vi.useFakeTimers();

      // Move to HALF_OPEN
      vi.advanceTimersByTime(1100);

      const mockOperation = vi.fn().mockResolvedValue("success");

      // Execute successful operations to meet success threshold
      await circuitBreaker.execute(mockOperation);
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      await circuitBreaker.execute(mockOperation);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      expect(mockMonitor).toHaveBeenCalledWith(
        expect.objectContaining({
          state: CircuitState.CLOSED,
          previousState: CircuitState.HALF_OPEN,
          reason: "Sufficient successes in half-open state",
        }),
      );

      vi.useRealTimers();
    });

    it("should reopen circuit if failure occurs in HALF_OPEN", async () => {
      vi.useFakeTimers();

      // Move to HALF_OPEN
      vi.advanceTimersByTime(1100);

      const successOperation = vi.fn().mockResolvedValue("success");
      await circuitBreaker.execute(successOperation);
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);

      // Now fail in HALF_OPEN state
      const failOperation = vi
        .fn()
        .mockRejectedValue(new Error("failed again"));
      await expect(circuitBreaker.execute(failOperation)).rejects.toThrow(
        "failed again",
      );

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);

      vi.useRealTimers();
    });
  });

  describe("Manual Control", () => {
    it("should allow manual circuit opening", () => {
      circuitBreaker.forceOpen("Testing manual open");

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(mockMonitor).toHaveBeenCalledWith(
        expect.objectContaining({
          state: CircuitState.OPEN,
          reason: "Testing manual open",
        }),
      );
    });

    it("should allow manual circuit closing", async () => {
      // Open circuit first
      const failingOperation = vi
        .fn()
        .mockRejectedValue(new Error("operation failed"));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow(
          "operation failed",
        );
      }

      // Manually close
      circuitBreaker.forceClose("Testing manual close");

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.consecutiveSuccesses).toBe(0);
    });

    it("should allow circuit reset", async () => {
      // Execute some operations and open circuit
      const failingOperation = vi
        .fn()
        .mockRejectedValue(new Error("operation failed"));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow(
          "operation failed",
        );
      }

      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(0);
      expect(metrics.consecutiveSuccesses).toBe(0);
    });
  });

  describe("Metrics", () => {
    it("should calculate failure rate correctly", async () => {
      const successOperation = vi.fn().mockResolvedValue("success");
      const failOperation = vi.fn().mockRejectedValue(new Error("failed"));

      // 3 successes, 2 failures = 40% failure rate
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);

      await expect(circuitBreaker.execute(failOperation)).rejects.toThrow();
      await expect(circuitBreaker.execute(failOperation)).rejects.toThrow();

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(5);
      expect(metrics.successCount).toBe(3);
      expect(metrics.failureCount).toBe(2);
      expect(metrics.failureRate).toBeCloseTo(0.4);
    });

    it("should track uptime", async () => {
      vi.useFakeTimers();

      const metrics1 = circuitBreaker.getMetrics();
      const initialUptime = metrics1.uptime;

      vi.advanceTimersByTime(5000);

      const metrics2 = circuitBreaker.getMetrics();
      expect(metrics2.uptime).toBeGreaterThan(initialUptime);

      vi.useRealTimers();
    });
  });
});

describe("CircuitBreakerRegistry", () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    registry = new CircuitBreakerRegistry({
      failureThreshold: 5,
      timeout: 2000,
    });
  });

  it("should create and return circuit breakers", () => {
    const circuit = registry.getCircuitBreaker("test-service");

    expect(circuit).toBeInstanceOf(CircuitBreaker);
    expect(circuit.getState()).toBe(CircuitState.CLOSED);
  });

  it("should reuse existing circuit breakers", () => {
    const circuit1 = registry.getCircuitBreaker("test-service");
    const circuit2 = registry.getCircuitBreaker("test-service");

    expect(circuit1).toBe(circuit2);
  });

  it("should apply global config to new circuits", async () => {
    const circuit = registry.getCircuitBreaker("test-service");

    // Trigger enough failures to test the global config
    const failOperation = vi.fn().mockRejectedValue(new Error("failed"));

    // Should need 5 failures (global config) instead of default 3
    for (let i = 0; i < 5; i++) {
      await expect(circuit.execute(failOperation)).rejects.toThrow();
    }

    expect(circuit.getState()).toBe(CircuitState.OPEN);
  });

  it("should provide registry statistics", async () => {
    const circuit1 = registry.getCircuitBreaker("service-1");
    const circuit2 = registry.getCircuitBreaker("service-2");

    // Open one circuit
    const failOperation = vi.fn().mockRejectedValue(new Error("failed"));
    for (let i = 0; i < 5; i++) {
      await expect(circuit1.execute(failOperation)).rejects.toThrow();
    }

    const stats = registry.getRegistryStats();

    expect(stats.totalCircuits).toBe(2);
    expect(stats.openCircuits).toBe(1);
    expect(stats.closedCircuits).toBe(1);
    expect(stats.halfOpenCircuits).toBe(0);

    expect(stats.circuitDetails).toHaveLength(2);
    expect(stats.circuitDetails.map((c) => c.name)).toContain("service-1");
    expect(stats.circuitDetails.map((c) => c.name)).toContain("service-2");
  });
});

describe("Circuit Breaker Utilities", () => {
  describe("getCircuitBreaker", () => {
    it("should return global circuit breaker", () => {
      const circuit = getCircuitBreaker("global-test");
      expect(circuit).toBeInstanceOf(CircuitBreaker);
    });
  });

  describe("withCircuitBreaker", () => {
    it("should wrap function with circuit breaker", async () => {
      const originalFn = vi.fn().mockResolvedValue("wrapped result");
      const wrappedFn = withCircuitBreaker(originalFn, "wrapped-test");

      const result = await wrappedFn("arg1", "arg2");

      expect(result).toBe("wrapped result");
      expect(originalFn).toHaveBeenCalledWith("arg1", "arg2");
    });

    it("should handle failures in wrapped function", async () => {
      const originalFn = vi.fn().mockRejectedValue(new Error("wrapped error"));
      const wrappedFn = withCircuitBreaker(originalFn, "wrapped-test-fail", {
        failureThreshold: 1,
      });

      // First call should fail and open circuit
      await expect(wrappedFn()).rejects.toThrow("wrapped error");

      // Second call should be blocked by circuit breaker
      await expect(wrappedFn()).rejects.toThrow(CircuitBreakerError);
    });
  });
});
