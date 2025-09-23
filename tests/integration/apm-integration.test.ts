/**
 * Integration tests for APM providers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PerformanceMonitor,
  initializePerformanceMonitoring,
} from "../../src/shared/performanceMonitoring";
import {
  APMIntegration,
  DatadogProvider,
  NewRelicProvider,
  PrometheusProvider,
  initializeAPM,
} from "../../src/shared/apmIntegration";
import { TestUtils } from "../setup";

describe("APM Integration", () => {
  let performanceMonitor: PerformanceMonitor;
  let apmIntegration: APMIntegration;

  beforeEach(() => {
    performanceMonitor = initializePerformanceMonitoring({
      provider: "custom",
      enabled: true,
      samplingRate: 1.0,
      flushInterval: 10000,
      batchSize: 100,
      serviceName: "test-service",
      environment: "test",
      version: "1.0.0",
    });
  });

  afterEach(async () => {
    if (apmIntegration) {
      await apmIntegration.shutdown();
    }
    if (performanceMonitor) {
      performanceMonitor.shutdown();
    }
  });

  describe("APM Integration Manager", () => {
    it("should initialize with custom provider", async () => {
      apmIntegration = initializeAPM(
        {
          provider: "custom",
          enabled: true,
          samplingRate: 1.0,
          flushInterval: 5000,
          batchSize: 100,
          serviceName: "test-service",
          environment: "test",
          version: "1.0.0",
        },
        performanceMonitor,
      );

      await apmIntegration.initialize();

      // Should complete without error
    });

    it("should handle disabled APM", async () => {
      apmIntegration = new APMIntegration(
        {
          provider: "custom",
          enabled: false,
          samplingRate: 1.0,
          flushInterval: 5000,
          batchSize: 100,
          serviceName: "test-service",
          environment: "test",
          version: "1.0.0",
        },
        performanceMonitor,
      );

      await apmIntegration.initialize();

      // Should complete without error when disabled
    });

    it("should forward metrics from performance monitor", async () => {
      apmIntegration = new APMIntegration(
        {
          provider: "custom",
          enabled: true,
          samplingRate: 1.0,
          flushInterval: 5000,
          batchSize: 100,
          serviceName: "test-service",
          environment: "test",
          version: "1.0.0",
        },
        performanceMonitor,
      );

      await apmIntegration.initialize();

      const metricForwardSpy = vi.fn();
      apmIntegration.on("metric:send", metricForwardSpy);

      // Record a metric that should be forwarded
      performanceMonitor.recordMetric({
        name: "test.forwarded.metric",
        value: 100,
        unit: "count",
        timestamp: new Date(),
        tags: { test: "value" },
      });

      // Give it a moment to process
      await TestUtils.waitFor(
        () => metricForwardSpy.mock.calls.length > 0,
        1000,
      );

      expect(metricForwardSpy).toHaveBeenCalled();
    });

    it("should record errors across providers", async () => {
      apmIntegration = new APMIntegration(
        {
          provider: "custom",
          enabled: true,
          samplingRate: 1.0,
          flushInterval: 5000,
          batchSize: 100,
          serviceName: "test-service",
          environment: "test",
          version: "1.0.0",
        },
        performanceMonitor,
      );

      await apmIntegration.initialize();

      const testError = new Error("Test error for APM");
      const context = { userId: "123", operation: "test" };

      // Should not throw
      await apmIntegration.recordError(testError, context);
    });

    it("should add custom attributes", () => {
      apmIntegration = new APMIntegration(
        {
          provider: "custom",
          enabled: true,
          samplingRate: 1.0,
          flushInterval: 5000,
          batchSize: 100,
          serviceName: "test-service",
          environment: "test",
          version: "1.0.0",
        },
        performanceMonitor,
      );

      // Should not throw
      apmIntegration.addCustomAttribute("test.attribute", "test.value");
      apmIntegration.addCustomAttribute("numeric.attribute", 42);
    });
  });

  describe("Datadog Provider", () => {
    it("should initialize with mocked dd-trace", async () => {
      // Mock dd-trace module
      const mockDD = {
        init: vi.fn(),
        dogstatsd: {
          gauge: vi.fn(),
        },
        scope: vi.fn(() => ({
          active: vi.fn(() => ({
            setTag: vi.fn(),
            finish: vi.fn(),
            context: vi.fn(() => ({
              toSpanId: vi.fn(() => "mock-span-id"),
            })),
          })),
        })),
        trace: vi.fn(() => ({
          context: vi.fn(() => ({
            toSpanId: vi.fn(() => "mock-span-id"),
          })),
        })),
        shutdown: vi.fn(),
      };

      vi.doMock("dd-trace", () => mockDD);

      const provider = new DatadogProvider();

      await provider.initialize({
        apiKey: "test-key",
        serviceName: "test-service",
        environment: "test",
        version: "1.0.0",
      });

      expect(mockDD.init).toHaveBeenCalledWith(
        expect.objectContaining({
          service: "test-service",
          env: "test",
          version: "1.0.0",
        }),
      );

      await provider.shutdown();
    });

    it("should handle initialization failure gracefully", async () => {
      vi.doMock("dd-trace", () => {
        throw new Error("dd-trace not available");
      });

      const provider = new DatadogProvider();

      await expect(
        provider.initialize({
          serviceName: "test-service",
          environment: "test",
          version: "1.0.0",
        }),
      ).rejects.toThrow("dd-trace not available");
    });
  });

  describe("New Relic Provider", () => {
    it("should set environment variables during initialization", async () => {
      // Mock newrelic module
      const mockNewRelic = {
        recordMetric: vi.fn(),
        noticeError: vi.fn(),
        setTransactionName: vi.fn(),
        addCustomAttribute: vi.fn(),
        endTransaction: vi.fn(),
      };

      vi.doMock("newrelic", () => mockNewRelic);

      const provider = new NewRelicProvider();

      await provider.initialize({
        apiKey: "test-license-key",
        serviceName: "test-service",
        environment: "test",
        version: "1.0.0",
      });

      expect(process.env.NEW_RELIC_LICENSE_KEY).toBe("test-license-key");
      expect(process.env.NEW_RELIC_APP_NAME).toBe("test-service");
      expect(process.env.NEW_RELIC_ENVIRONMENT).toBe("test");
    });

    it("should handle module not available", async () => {
      vi.doMock("newrelic", () => {
        throw new Error("newrelic module not found");
      });

      const provider = new NewRelicProvider();

      await expect(
        provider.initialize({
          serviceName: "test-service",
          environment: "test",
          version: "1.0.0",
        }),
      ).rejects.toThrow("newrelic module not found");
    });
  });

  describe("Prometheus Provider", () => {
    it("should initialize with prom-client", async () => {
      // Mock prom-client
      const mockRegister = {
        setDefaultLabels: vi.fn(),
        clear: vi.fn(),
        metrics: vi.fn(() => "mock metrics output"),
      };

      const mockGauge = vi.fn(() => ({
        set: vi.fn(),
      }));

      const mockCounter = vi.fn(() => ({
        inc: vi.fn(),
      }));

      const mockPromClient = {
        register: mockRegister,
        collectDefaultMetrics: vi.fn(),
        Gauge: mockGauge,
        Counter: mockCounter,
      };

      vi.doMock("prom-client", () => mockPromClient);

      const provider = new PrometheusProvider();

      await provider.initialize({
        serviceName: "test-service",
        environment: "test",
        version: "1.0.0",
      });

      expect(mockRegister.setDefaultLabels).toHaveBeenCalledWith({
        service: "test-service",
        environment: "test",
        version: "1.0.0",
      });

      expect(mockPromClient.collectDefaultMetrics).toHaveBeenCalledWith({
        prefix: "synthetic_agents_",
        timeout: 5000,
      });
    });

    it("should create and manage Prometheus metrics", async () => {
      const mockGauge = vi.fn();
      const mockGaugeInstance = {
        set: vi.fn(),
      };
      mockGauge.mockImplementation(() => mockGaugeInstance);

      const mockPromClient = {
        register: {
          setDefaultLabels: vi.fn(),
          clear: vi.fn(),
          metrics: vi.fn(() => "mock metrics"),
        },
        collectDefaultMetrics: vi.fn(),
        Gauge: mockGauge,
        Counter: vi.fn(),
      };

      vi.doMock("prom-client", () => mockPromClient);

      const provider = new PrometheusProvider();
      await provider.initialize({
        serviceName: "test-service",
        environment: "test",
        version: "1.0.0",
      });

      // Record a metric
      await provider.recordMetric({
        name: "test.metric",
        value: 42,
        unit: "count",
        timestamp: new Date(),
        tags: { environment: "test" },
      });

      expect(mockGauge).toHaveBeenCalledWith({
        name: "synthetic_agents_test_metric",
        help: "Performance metric for test.metric",
        labelNames: ["environment"],
      });

      expect(mockGaugeInstance.set).toHaveBeenCalledWith(
        { environment: "test" },
        42,
      );
    });

    it("should export metrics for scraping", async () => {
      const mockPromClient = {
        register: {
          setDefaultLabels: vi.fn(),
          clear: vi.fn(),
          metrics: vi.fn(() => 'prometheus_metric{label="value"} 42\n'),
        },
        collectDefaultMetrics: vi.fn(),
        Gauge: vi.fn(),
        Counter: vi.fn(),
      };

      vi.doMock("prom-client", () => mockPromClient);

      const provider = new PrometheusProvider();
      await provider.initialize({
        serviceName: "test-service",
        environment: "test",
        version: "1.0.0",
      });

      const metrics = provider.getMetricsForScraping();
      expect(metrics).toBe('prometheus_metric{label="value"} 42\n');
    });
  });

  describe("End-to-End APM Flow", () => {
    it("should track complete agent execution through APM", async () => {
      apmIntegration = initializeAPM(
        {
          provider: "prometheus",
          enabled: true,
          samplingRate: 1.0,
          flushInterval: 10000,
          batchSize: 100,
          serviceName: "test-service",
          environment: "test",
          version: "1.0.0",
        },
        performanceMonitor,
      );

      // Mock prometheus to avoid actual dependency
      vi.doMock("prom-client", () => ({
        register: {
          setDefaultLabels: vi.fn(),
          clear: vi.fn(),
          metrics: vi.fn(() => ""),
        },
        collectDefaultMetrics: vi.fn(),
        Gauge: vi.fn(() => ({ set: vi.fn() })),
        Counter: vi.fn(() => ({ inc: vi.fn() })),
      }));

      await apmIntegration.initialize();

      // Simulate agent execution
      const transactionId = performanceMonitor.startTransaction(
        "agent.qa_generator",
        "agent_execution",
      );

      performanceMonitor.recordAgentMetrics("qa_generator", {
        executionTime: 1500,
        tokensUsed: 200,
        memoryUsage: 1024000,
        qualityScore: 8.5,
      });

      performanceMonitor.endTransaction(transactionId, "success");

      // Should complete without error
    });

    it("should handle errors in APM providers gracefully", async () => {
      apmIntegration = new APMIntegration(
        {
          provider: "datadog",
          enabled: true,
          samplingRate: 1.0,
          flushInterval: 5000,
          batchSize: 100,
          serviceName: "test-service",
          environment: "test",
          version: "1.0.0",
        },
        performanceMonitor,
      );

      // Mock failing dd-trace
      vi.doMock("dd-trace", () => {
        throw new Error("Datadog initialization failed");
      });

      // Should handle initialization failure
      await expect(apmIntegration.initialize()).rejects.toThrow();
    });
  });
});
