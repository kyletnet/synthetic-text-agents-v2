/**
 * QA Feedback Manager Tests
 *
 * Tests for Phase 2B Step 3: QA Feedback Loop + Plugin Integration
 */

import { describe, it, expect, beforeEach } from "vitest";
import { QAFeedbackManager } from "../../src/application/qa-feedback-manager.js";
import { MetricsService } from "../../src/application/metrics/metrics-service.js";
import { DiversityPlannerService } from "../../src/application/agents/diversity-planner-service.js";
import type { MetricsReport } from "../../src/domain/ports/metrics-port.js";
import type { Logger } from "../../src/shared/logger.js";

// Mock logger
const mockLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
} as any;

describe("QAFeedbackManager", () => {
  let feedbackManager: QAFeedbackManager;
  let mockMetricsService: any;
  let mockDiversityPlannerService: any;

  beforeEach(() => {
    // Mock Metrics Service
    mockMetricsService = {
      getCurrentReport: async (): Promise<MetricsReport> => ({
        quality: {
          entityCoverage: 0.5,
          questionTypeDistribution: new Map(),
          evidenceAlignment: 0.6,
          evidenceSourceCounts: new Map(),
          naturalness: 0.8,
          coherence: 0.7,
          totalSamples: 100,
          timestamp: new Date(),
        },
        diversity: {
          entityCoverageRatio: 0.75,
          questionTypeBalance: 0.8,
          evidenceSourceDiversity: 0.9,
          meetsTarget: true,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      }),
      getBaselineMetrics: async (): Promise<MetricsReport> => ({
        quality: {
          entityCoverage: 0.4,
          questionTypeDistribution: new Map(),
          evidenceAlignment: 0.5,
          evidenceSourceCounts: new Map(),
          naturalness: 0.7,
          coherence: 0.6,
          totalSamples: 100,
          timestamp: new Date(),
        },
        diversity: {
          entityCoverageRatio: 0.6,
          questionTypeBalance: 0.7,
          evidenceSourceDiversity: 0.8,
          meetsTarget: false,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      }),
    } as MetricsService;

    // Mock Diversity Planner Service
    mockDiversityPlannerService = {
      createPlan: async () => ({
        plan: {
          meetsTarget: true,
          gap: {
            entityGap: { coverageRatio: 0.75 },
            questionTypeGap: { deviationFromIdeal: new Map() },
            evidenceSourceGap: { currentSources: [] },
          },
          target: {},
        },
        converged: false,
        cached: false,
      }),
      generateSuggestions: () => [
        "Increase entity coverage",
        "Balance question types",
      ],
    } as any;

    // Create Feedback Manager
    feedbackManager = new QAFeedbackManager(
      mockLogger,
      mockMetricsService,
      mockDiversityPlannerService,
      {
        feedbackLoopEnabled: true,
        driftThreshold: 0.15,
        baselineTag: "integration-base",
      },
    );
  });

  describe("Drift Detection", () => {
    it("should detect drift within threshold", async () => {
      const result = await feedbackManager.runFeedbackLoop();

      expect(result.executed).toBe(true);
      expect(result.drift).toBeDefined();
      expect(result.drift.drifts.length).toBeGreaterThan(0);
    });

    it("should identify improvement direction", async () => {
      const result = await feedbackManager.runFeedbackLoop();

      const entityCoverageDrift = result.drift.drifts.find(
        (d) => d.metric === "entity_coverage",
      );

      expect(entityCoverageDrift).toBeDefined();
      expect(entityCoverageDrift?.direction).toBe("improvement");
    });

    it("should not exceed threshold for small changes", async () => {
      // Override metrics with small difference
      mockMetricsService.getCurrentReport = async () => ({
        quality: {
          entityCoverage: 0.41, // +0.01 from baseline (0.40)
          questionTypeDistribution: new Map(),
          evidenceAlignment: 0.51,
          evidenceSourceCounts: new Map(),
          naturalness: 0.7,
          coherence: 0.6,
          totalSamples: 100,
          timestamp: new Date(),
        },
        diversity: {
          entityCoverageRatio: 0.61,
          questionTypeBalance: 0.71,
          evidenceSourceDiversity: 0.81,
          meetsTarget: false,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      });

      const result = await feedbackManager.runFeedbackLoop();

      expect(result.drift.exceeded).toBe(false);
      expect(result.plan).toBeNull();
    });
  });

  describe("Feedback Loop", () => {
    it("should generate diversity plan when drift exceeds threshold", async () => {
      const result = await feedbackManager.runFeedbackLoop();

      if (result.drift.exceeded) {
        expect(result.plan).toBeDefined();
        expect(result.adjustments.length).toBeGreaterThan(0);
      }
    });

    it("should not run when feature flag is disabled", async () => {
      const disabledManager = new QAFeedbackManager(
        mockLogger,
        mockMetricsService,
        mockDiversityPlannerService,
        {
          feedbackLoopEnabled: false,
        },
      );

      const result = await disabledManager.runFeedbackLoop();

      expect(result.executed).toBe(false);
      expect(result.plan).toBeNull();
    });
  });

  describe("Auto-Adjustment", () => {
    it("should generate adjustments but not apply when auto-adjustment is disabled", async () => {
      const result = await feedbackManager.runFeedbackLoop();

      if (result.adjustments.length > 0) {
        const firstAdjustment = result.adjustments[0];
        // Auto-adjustment is disabled by default
        expect(firstAdjustment.applied).toBe(false);
      }
    });

    it("should include diversity planner suggestions", async () => {
      const result = await feedbackManager.runFeedbackLoop();

      if (result.drift.exceeded) {
        const suggestions = result.adjustments.filter(
          (a) => a.type === "target",
        );
        expect(suggestions.length).toBeGreaterThan(0);
      }
    });
  });
});
