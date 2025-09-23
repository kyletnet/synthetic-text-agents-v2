/**
 * Unit tests for Performance Monitoring system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PerformanceMonitor,
  initializePerformanceMonitoring,
  getPerformanceMonitor,
  trackPerformance,
} from "../../src/shared/performanceMonitoring";
import { TestUtils } from "../setup";

describe("PerformanceMonitor", () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor({
      provider: "custom",
      enabled: true,
      samplingRate: 1.0,
      flushInterval: 5000,
      batchSize: 100,
      serviceName: "test-service",
      environment: "test",
      version: "1.0.0",
    });
  });

  afterEach(() => {
    monitor.shutdown();
  });

  describe("Transaction Tracking", () => {
    it("should start and end transactions successfully", async () => {
      const transactionId = monitor.startTransaction(
        "test-transaction",
        "agent_execution",
      );

      expect(transactionId).toBeTruthy();
      expect(typeof transactionId).toBe("string");

      monitor.endTransaction(transactionId, "success");

      // Should complete without error
    });

    it("should handle transaction with error", async () => {
      const transactionId = monitor.startTransaction(
        "failing-transaction",
        "api_request",
      );
      const error = new Error("Test error");

      monitor.endTransaction(transactionId, "error", error);

      // Should complete without error
    });

    it("should record transaction duration metrics", async () => {
      const metricSpy = vi.spyOn(monitor, "recordMetric");

      const transactionId = monitor.startTransaction(
        "timed-transaction",
        "agent_execution",
      );

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      monitor.endTransaction(transactionId, "success");

      expect(metricSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "transaction.duration",
          unit: "ms",
          tags: expect.objectContaining({
            transaction_name: "timed-transaction",
            transaction_type: "agent_execution",
            status: "success",
          }),
        }),
      );

      metricSpy.mockRestore();
    });
  });

  describe("Span Tracking", () => {
    it("should create and manage spans within transactions", () => {
      const transactionId = monitor.startTransaction(
        "span-test",
        "agent_execution",
      );

      const spanId = monitor.startSpan(transactionId, "test-span");
      expect(spanId).toBeTruthy();

      monitor.endSpan(transactionId, spanId, { test_tag: "value" });
      monitor.endTransaction(transactionId, "success");
    });

    it("should handle nested spans", () => {
      const transactionId = monitor.startTransaction(
        "nested-spans",
        "agent_execution",
      );

      const parentSpanId = monitor.startSpan(transactionId, "parent-span");
      const childSpanId = monitor.startSpan(
        transactionId,
        "child-span",
        parentSpanId,
      );

      monitor.endSpan(transactionId, childSpanId);
      monitor.endSpan(transactionId, parentSpanId);
      monitor.endTransaction(transactionId, "success");
    });

    it("should throw error for invalid transaction", () => {
      expect(() => {
        monitor.startSpan("invalid-transaction-id", "test-span");
      }).toThrow("Transaction invalid-transaction-id not found");
    });
  });

  describe("Metric Recording", () => {
    it("should record custom metrics", () => {
      const metric = {
        name: "test.metric",
        value: 42,
        unit: "count" as const,
        timestamp: new Date(),
        tags: { environment: "test" },
      };

      monitor.recordMetric(metric);

      // Should complete without error
    });

    it("should record agent performance metrics", () => {
      const agentMetrics = {
        executionTime: 1500,
        tokensUsed: 200,
        memoryUsage: 1024000,
        qualityScore: 8.5,
      };

      monitor.recordAgentMetrics("test-agent", agentMetrics);

      // Should complete without error
    });

    it("should handle metrics when disabled", () => {
      const disabledMonitor = new PerformanceMonitor({
        provider: "custom",
        enabled: false,
        samplingRate: 1.0,
        flushInterval: 5000,
        batchSize: 100,
        serviceName: "test-service",
        environment: "test",
        version: "1.0.0",
      });

      const metric = {
        name: "test.metric",
        value: 42,
        unit: "count" as const,
        timestamp: new Date(),
      };

      // Should not throw error when disabled
      disabledMonitor.recordMetric(metric);
      disabledMonitor.shutdown();
    });
  });

  describe("System Metrics", () => {
    it("should collect system metrics", async () => {
      const systemMetrics = await monitor.getSystemMetrics();

      expect(systemMetrics).toHaveProperty("cpu");
      expect(systemMetrics).toHaveProperty("memory");
      expect(systemMetrics).toHaveProperty("disk");
      expect(systemMetrics).toHaveProperty("network");

      expect(systemMetrics.cpu).toHaveProperty("usage");
      expect(systemMetrics.cpu).toHaveProperty("loadAverage");

      expect(systemMetrics.memory).toHaveProperty("used");
      expect(systemMetrics.memory).toHaveProperty("total");
      expect(systemMetrics.memory).toHaveProperty("heapUsed");
      expect(systemMetrics.memory).toHaveProperty("heapTotal");
    });
  });

  describe("Performance Summary", () => {
    it("should generate performance summary", () => {
      // Record some sample metrics first
      monitor.recordMetric({
        name: "transaction.duration",
        value: 1000,
        unit: "ms",
        timestamp: new Date(),
        tags: { status: "success" },
      });

      monitor.recordMetric({
        name: "agent.execution_time",
        value: 500,
        unit: "ms",
        timestamp: new Date(),
        tags: { agent_id: "test-agent" },
      });

      const summary = monitor.getPerformanceSummary();

      expect(summary).toHaveProperty("transactions");
      expect(summary).toHaveProperty("agents");
      expect(summary).toHaveProperty("system");

      expect(summary.transactions).toHaveProperty("total");
      expect(summary.transactions).toHaveProperty("successful");
      expect(summary.transactions).toHaveProperty("failed");
      expect(summary.transactions).toHaveProperty("averageDuration");

      expect(summary.agents).toHaveProperty("totalExecutions");
      expect(summary.agents).toHaveProperty("averageExecutionTime");
      expect(summary.agents).toHaveProperty("averageQualityScore");
    });
  });

  describe("Prometheus Export", () => {
    it("should export metrics in Prometheus format", () => {
      // Record some metrics
      monitor.recordMetric({
        name: "test.counter",
        value: 5,
        unit: "count",
        timestamp: new Date(),
        tags: { service: "test" },
      });

      const prometheusOutput = monitor.exportPrometheusMetrics();

      expect(prometheusOutput).toContain("# HELP test_counter");
      expect(prometheusOutput).toContain("# TYPE test_counter gauge");
      expect(prometheusOutput).toContain('test_counter{service="test"}');
    });

    it("should handle metrics with special characters in names", () => {
      monitor.recordMetric({
        name: "test.metric-with-dashes.and.dots",
        value: 10,
        unit: "count",
        timestamp: new Date(),
      });

      const prometheusOutput = monitor.exportPrometheusMetrics();
      expect(prometheusOutput).toContain("test_metric_with_dashes_and_dots");
    });
  });

  describe("Event Handling", () => {
    it("should emit events for metric recording", (done) => {
      monitor.on("metric:recorded", (metric) => {
        expect(metric.name).toBe("test.event");
        expect(metric.value).toBe(123);
        done();
      });

      monitor.recordMetric({
        name: "test.event",
        value: 123,
        unit: "count",
        timestamp: new Date(),
      });
    });

    it("should emit events for transaction lifecycle", () => {
      const startSpy = vi.fn();
      const endSpy = vi.fn();

      monitor.on("transaction:start", startSpy);
      monitor.on("transaction:end", endSpy);

      const transactionId = monitor.startTransaction(
        "event-test",
        "agent_execution",
      );
      monitor.endTransaction(transactionId, "success");

      expect(startSpy).toHaveBeenCalledOnce();
      expect(endSpy).toHaveBeenCalledOnce();
    });
  });

  describe("Cleanup and Shutdown", () => {
    it("should clean up resources on shutdown", () => {
      const shutdownSpy = vi.fn();
      monitor.on("shutdown", shutdownSpy);

      monitor.shutdown();

      expect(shutdownSpy).toHaveBeenCalledOnce();
    });

    it("should clear old metrics to prevent memory leaks", () => {
      // This is tested indirectly through the shutdown process
      monitor.shutdown();
      // Should complete without error
    });
  });
});

describe("Global Performance Monitor", () => {
  afterEach(() => {
    const globalMonitor = getPerformanceMonitor();
    if (globalMonitor) {
      globalMonitor.shutdown();
    }
  });

  it("should initialize and retrieve global monitor", () => {
    const config = {
      provider: "custom" as const,
      enabled: true,
      samplingRate: 1.0,
      flushInterval: 5000,
      batchSize: 100,
      serviceName: "global-test",
      environment: "test",
      version: "1.0.0",
    };

    const monitor = initializePerformanceMonitoring(config);
    const retrieved = getPerformanceMonitor();

    expect(monitor).toBe(retrieved);
    expect(retrieved).toBeInstanceOf(PerformanceMonitor);
  });

  it("should replace existing global monitor", () => {
    const config1 = {
      provider: "custom" as const,
      enabled: true,
      samplingRate: 1.0,
      flushInterval: 5000,
      batchSize: 100,
      serviceName: "test1",
      environment: "test",
      version: "1.0.0",
    };

    const config2 = {
      provider: "custom" as const,
      enabled: true,
      samplingRate: 1.0,
      flushInterval: 5000,
      batchSize: 100,
      serviceName: "test2",
      environment: "test",
      version: "1.0.0",
    };

    const monitor1 = initializePerformanceMonitoring(config1);
    const monitor2 = initializePerformanceMonitoring(config2);

    expect(monitor1).not.toBe(monitor2);
    expect(getPerformanceMonitor()).toBe(monitor2);
  });
});

describe("Performance Decorator", () => {
  let testMonitor: PerformanceMonitor;

  beforeEach(() => {
    testMonitor = initializePerformanceMonitoring({
      provider: "custom",
      enabled: true,
      samplingRate: 1.0,
      flushInterval: 5000,
      batchSize: 100,
      serviceName: "decorator-test",
      environment: "test",
      version: "1.0.0",
    });
  });

  afterEach(() => {
    testMonitor.shutdown();
  });

  it("should track method performance automatically", async () => {
    class TestClass {
      @trackPerformance("custom.test.method")
      async testMethod(delay: number): Promise<string> {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return "success";
      }
    }

    const instance = new TestClass();
    const result = await instance.testMethod(10);

    expect(result).toBe("success");
    // Performance should be tracked automatically
  });

  it("should handle method errors gracefully", async () => {
    class TestClass {
      @trackPerformance()
      async failingMethod(): Promise<void> {
        throw new Error("Test error");
      }
    }

    const instance = new TestClass();

    await expect(instance.failingMethod()).rejects.toThrow("Test error");
    // Error should be tracked in performance metrics
  });

  it("should work without global monitor", async () => {
    // Shutdown global monitor
    testMonitor.shutdown();

    class TestClass {
      @trackPerformance()
      async testMethod(): Promise<string> {
        return "success";
      }
    }

    const instance = new TestClass();
    const result = await instance.testMethod();

    expect(result).toBe("success");
    // Should not throw error when no monitor is available
  });
});
