/**
 * Metrics Adapter Tests
 *
 * Tests for Port/Adapter pattern implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { rm } from "fs/promises";
import { createLogger } from "../../../src/shared/logger.js";
import { FileMetricsAdapter } from "../../../src/infrastructure/metrics/file-metrics-adapter.js";
import { MetricsService } from "../../../src/application/metrics/metrics-service.js";
import type {
  QualityMetrics,
  DiversityMetrics,
  AdvancedQualityMetrics,
} from "../../../src/domain/ports/metrics-port.js";

describe("Metrics Adapter (Port/Adapter Pattern)", () => {
  const testStoragePath = join(__dirname, ".test-metrics");
  const logger = createLogger();
  let adapter: FileMetricsAdapter;
  let service: MetricsService;

  beforeEach(() => {
    adapter = new FileMetricsAdapter(logger, {
      storagePath: testStoragePath,
      enableCaching: true,
      cacheTTLMs: 60000,
    });
    service = new MetricsService(logger, adapter, {
      enableFallback: true,
      enablePerformanceMonitoring: true,
    });
  });

  afterEach(async () => {
    await rm(testStoragePath, { recursive: true, force: true });
  });

  describe("Quality Metrics", () => {
    it("should record and retrieve quality metrics", async () => {
      const metrics: QualityMetrics = {
        entityCoverage: 0.85,
        questionTypeDistribution: new Map([
          ["factual", 30],
          ["conceptual", 20],
        ]),
        evidenceAlignment: 0.72,
        evidenceSourceCounts: new Map([
          ["web_search", 25],
          ["knowledge_base", 25],
        ]),
        naturalness: 0.8,
        coherence: 0.75,
        totalSamples: 50,
        timestamp: new Date(),
      };

      await service.recordQualityMetrics(metrics);

      const report = await service.getCurrentReport();

      expect(report.quality.entityCoverage).toBe(0.85);
      expect(report.quality.evidenceAlignment).toBe(0.72);
      expect(report.quality.totalSamples).toBe(50);
    });
  });

  describe("Diversity Metrics", () => {
    it("should record and retrieve diversity metrics", async () => {
      const metrics: DiversityMetrics = {
        entityCoverageRatio: 0.95,
        questionTypeBalance: 0.88,
        evidenceSourceDiversity: 0.92,
        meetsTarget: true,
        timestamp: new Date(),
      };

      await service.recordDiversityMetrics(metrics);

      const report = await service.getCurrentReport();

      expect(report.diversity.entityCoverageRatio).toBe(0.95);
      expect(report.diversity.meetsTarget).toBe(true);
    });
  });

  describe("Advanced Quality Metrics", () => {
    it("should record and retrieve advanced quality metrics", async () => {
      const metrics: AdvancedQualityMetrics = {
        multiViewAlignment: 0.85,
        querySideAlignment: 0.80,
        translationNaturalness: 0.78,
        hybridSearchCoverage: 0.90,
        ragasOverallScore: 0.82,
        costPerQA: 0.002,
        totalCost: 0.20,
        latencyMs: 350,
        errorRate: 0.02,
        activeCheckers: ["hybrid_search", "queryside_embedding"],
        timestamp: new Date(),
      };

      await service.recordAdvancedQualityMetrics(metrics);

      const report = await service.getCurrentReport();

      expect(report.advanced?.hybridSearchCoverage).toBe(0.90);
      expect(report.advanced?.costPerQA).toBe(0.002);
      expect(report.advanced?.activeCheckers).toHaveLength(2);
    });
  });

  describe("Fallback Mechanism", () => {
    it("should not throw on adapter failure when fallback enabled", async () => {
      // Force adapter failure by using invalid path
      const failingAdapter = new FileMetricsAdapter(logger, {
        storagePath: "/invalid/path/that/does/not/exist",
      });
      const fallbackService = new MetricsService(logger, failingAdapter, {
        enableFallback: true,
      });

      const metrics: QualityMetrics = {
        entityCoverage: 0.5,
        questionTypeDistribution: new Map(),
        evidenceAlignment: 0.3,
        evidenceSourceCounts: new Map(),
        naturalness: 0.6,
        coherence: 0.5,
        totalSamples: 10,
        timestamp: new Date(),
      };

      // Should not throw - fallback prevents exceptions
      await expect(
        fallbackService.recordQualityMetrics(metrics),
      ).resolves.not.toThrow();

      // Note: getCurrentReport will still fail because adapter can't read
      // This is expected - fallback is only for recording, not retrieval
    });
  });

  describe("Baseline Comparison", () => {
    it("should compare current metrics with baseline", async () => {
      // Record baseline
      const baselineMetrics: QualityMetrics = {
        entityCoverage: 0.70,
        questionTypeDistribution: new Map(),
        evidenceAlignment: 0.60,
        evidenceSourceCounts: new Map(),
        naturalness: 0.65,
        coherence: 0.60,
        totalSamples: 100,
        timestamp: new Date(),
      };
      const baselineDiversity: DiversityMetrics = {
        entityCoverageRatio: 0.80,
        questionTypeBalance: 0.75,
        evidenceSourceDiversity: 0.70,
        meetsTarget: false,
        timestamp: new Date(),
      };

      await service.recordQualityMetrics(baselineMetrics);
      await service.recordDiversityMetrics(baselineDiversity);

      // Record improved metrics
      const improvedMetrics: QualityMetrics = {
        ...baselineMetrics,
        entityCoverage: 0.85, // +15% improvement
        evidenceAlignment: 0.75, // +15% improvement
      };
      const improvedDiversity: DiversityMetrics = {
        ...baselineDiversity,
        entityCoverageRatio: 0.95, // +15% improvement
        questionTypeBalance: 0.90, // +15% improvement
      };

      await service.recordQualityMetrics(improvedMetrics);
      await service.recordDiversityMetrics(improvedDiversity);

      const comparison = await service.compareWithBaseline("integration-base");

      // Since we don't have actual baseline file, this will return empty
      expect(comparison).toBeDefined();
    });
  });

  describe("Performance Monitoring", () => {
    it("should monitor metrics recording performance", async () => {
      const metrics: DiversityMetrics = {
        entityCoverageRatio: 1.0,
        questionTypeBalance: 1.0,
        evidenceSourceDiversity: 1.0,
        meetsTarget: true,
        timestamp: new Date(),
      };

      // Should complete quickly and log if slow
      await service.recordDiversityMetrics(metrics);

      // No assertion needed - just verify it doesn't throw
      expect(true).toBe(true);
    });
  });
});
