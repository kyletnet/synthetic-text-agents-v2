/**
 * Diversity Planner Tests
 *
 * Tests for diversity planning domain logic.
 */

import { describe, it, expect } from "vitest";
import { DiversityPlanner } from "../../../src/domain/agents/diversity-planner.js";
import type {
  CoverageMetrics,
  DiversityTarget,
} from "../../../src/domain/agents/diversity-types.js";

describe("DiversityPlanner", () => {
  describe("Plan Creation", () => {
    it("should create plan with perfect coverage", () => {
      const planner = new DiversityPlanner();

      const perfectMetrics: CoverageMetrics = {
        entityCoverage: 1.0,
        questionTypeDistribution: new Map([
          ["factual", 30],
          ["conceptual", 25],
          ["procedural", 20],
          ["analytical", 15],
          ["comparative", 10],
        ]),
        evidenceSourceCounts: new Map([
          ["web_search", 50],
          ["knowledge_base", 30],
          ["expert_input", 20],
        ]),
        totalSamples: 100,
      };

      const plan = planner.createPlan(perfectMetrics);

      expect(plan.meetsTarget).toBe(true);
      expect(plan.gap.entityGap.coverageRatio).toBe(1.0);
      expect(plan.gap.questionTypeGap.underrepresented).toHaveLength(0);
      expect(plan.gap.evidenceSourceGap.missingSourceCount).toBe(0);
    });

    it("should identify entity coverage gap", () => {
      const planner = new DiversityPlanner();

      const lowCoverageMetrics: CoverageMetrics = {
        entityCoverage: 0.7, // Below 0.9 target
        questionTypeDistribution: new Map([["factual", 100]]),
        evidenceSourceCounts: new Map([
          ["web_search", 50],
          ["knowledge_base", 30],
          ["expert_input", 20],
        ]),
        totalSamples: 100,
      };

      const plan = planner.createPlan(lowCoverageMetrics);

      expect(plan.meetsTarget).toBe(false);
      expect(plan.gap.entityGap.coverageRatio).toBeCloseTo(0.778, 2); // 0.7 / 0.9
    });

    it("should identify question type imbalance", () => {
      const planner = new DiversityPlanner();

      const imbalancedMetrics: CoverageMetrics = {
        entityCoverage: 1.0,
        questionTypeDistribution: new Map([
          ["factual", 80], // Overrepresented (should be ~30)
          ["conceptual", 20], // Underrepresented (should be ~25)
        ]),
        evidenceSourceCounts: new Map([
          ["web_search", 50],
          ["knowledge_base", 30],
          ["expert_input", 20],
        ]),
        totalSamples: 100,
      };

      const plan = planner.createPlan(imbalancedMetrics);

      expect(plan.meetsTarget).toBe(false);
      expect(plan.gap.questionTypeGap.overrepresented).toContain("factual");
      expect(plan.gap.questionTypeGap.underrepresented.length).toBeGreaterThan(0);
    });

    it("should identify evidence source gap", () => {
      const planner = new DiversityPlanner();

      const fewSourcesMetrics: CoverageMetrics = {
        entityCoverage: 1.0,
        questionTypeDistribution: new Map([
          ["factual", 30],
          ["conceptual", 25],
          ["procedural", 20],
          ["analytical", 15],
          ["comparative", 10],
        ]),
        evidenceSourceCounts: new Map([
          ["web_search", 100], // Only 1 source (need 3)
        ]),
        totalSamples: 100,
      };

      const plan = planner.createPlan(fewSourcesMetrics);

      expect(plan.meetsTarget).toBe(false);
      expect(plan.gap.evidenceSourceGap.missingSourceCount).toBe(2);
      expect(plan.gap.evidenceSourceGap.currentSources).toEqual(["web_search"]);
    });
  });

  describe("Sampling Strategy", () => {
    it("should recommend additional samples for underrepresented types", () => {
      const planner = new DiversityPlanner();

      const metrics: CoverageMetrics = {
        entityCoverage: 1.0,
        questionTypeDistribution: new Map([
          ["factual", 30],
          ["conceptual", 5], // Underrepresented (should be ~10, which is 25% of 40)
        ]),
        evidenceSourceCounts: new Map([
          ["web_search", 20],
          ["knowledge_base", 10],
          ["expert_input", 5],
        ]),
        totalSamples: 35,
      };

      const plan = planner.createPlan(metrics);

      expect(plan.strategy.estimatedSamplesNeeded).toBeGreaterThan(0);
      expect(plan.strategy.targetQuestionTypes.has("conceptual")).toBe(true);
    });

    it("should include evidence source preferences", () => {
      const planner = new DiversityPlanner();

      const metrics: CoverageMetrics = {
        entityCoverage: 1.0,
        questionTypeDistribution: new Map([["factual", 100]]),
        evidenceSourceCounts: new Map([["web_search", 100]]),
        totalSamples: 100,
      };

      const plan = planner.createPlan(metrics);

      expect(plan.strategy.evidenceSourcePreference).toContain("web_search");
      expect(plan.strategy.evidenceSourcePreference.length).toBeGreaterThan(1);
    });
  });

  describe("Suggestions Generation", () => {
    it("should generate suggestions for gaps", () => {
      const planner = new DiversityPlanner();

      const gappyMetrics: CoverageMetrics = {
        entityCoverage: 0.7,
        questionTypeDistribution: new Map([
          ["factual", 80],
          ["conceptual", 20],
        ]),
        evidenceSourceCounts: new Map([["web_search", 100]]),
        totalSamples: 100,
      };

      const plan = planner.createPlan(gappyMetrics);
      const suggestions = planner.generateSuggestions(plan);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some((s) => s.includes("Entity Coverage"))).toBe(true);
      expect(suggestions.some((s) => s.includes("Evidence Sources"))).toBe(true);
    });

    it("should congratulate when targets are met", () => {
      const planner = new DiversityPlanner();

      const perfectMetrics: CoverageMetrics = {
        entityCoverage: 1.0,
        questionTypeDistribution: new Map([
          ["factual", 30],
          ["conceptual", 25],
          ["procedural", 20],
          ["analytical", 15],
          ["comparative", 10],
        ]),
        evidenceSourceCounts: new Map([
          ["web_search", 50],
          ["knowledge_base", 30],
          ["expert_input", 20],
        ]),
        totalSamples: 100,
      };

      const plan = planner.createPlan(perfectMetrics);
      const suggestions = planner.generateSuggestions(plan);

      expect(suggestions).toContain("✅ Dataset meets all diversity targets!");
    });
  });

  describe("Custom Targets", () => {
    it("should use custom diversity targets", () => {
      const customTarget: DiversityTarget = {
        entityCoverageMin: 0.95, // Higher than default 0.9
        questionTypeBalanceTolerance: 0.05, // Stricter than default 0.1
        evidenceSourceMinCount: 5, // More than default 3
      };

      const planner = new DiversityPlanner(customTarget);

      const metrics: CoverageMetrics = {
        entityCoverage: 0.92, // Would pass default, but not custom
        questionTypeDistribution: new Map([
          ["factual", 30],
          ["conceptual", 25],
          ["procedural", 20],
          ["analytical", 15],
          ["comparative", 10],
        ]),
        evidenceSourceCounts: new Map([
          ["web_search", 50],
          ["knowledge_base", 30],
          ["expert_input", 20],
        ]),
        totalSamples: 100,
      };

      const plan = planner.createPlan(metrics);

      expect(plan.meetsTarget).toBe(false); // Fails due to stricter targets
      expect(plan.gap.entityGap.coverageRatio).toBeCloseTo(0.968, 2); // 0.92 / 0.95
      expect(plan.gap.evidenceSourceGap.missingSourceCount).toBe(2); // Need 5, have 3
    });
  });
});
