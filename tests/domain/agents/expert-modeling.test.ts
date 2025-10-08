/**
 * Expert Modeling Strategy Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ExpertModelingStrategy } from "../../../src/domain/agents/cognitive-strategies/expert-modeling.js";
import type { CognitiveAnalysisRequest } from "../../../src/domain/agents/cognitive-strategy.js";
import { Logger } from "../../../src/shared/logger.js";

describe("ExpertModelingStrategy", () => {
  let strategy: ExpertModelingStrategy;
  let logger: Logger;

  beforeEach(() => {
    strategy = new ExpertModelingStrategy();
    logger = new Logger({ level: "silent" });
  });

  describe("Strategy metadata", () => {
    it("should have correct strategy id", () => {
      expect(strategy.id).toBe("expert-modeling");
    });

    it("should have descriptive name", () => {
      expect(strategy.name).toBe("Expert Modeling Strategy");
    });

    it("should have description", () => {
      expect(strategy.description).toContain("expert thinking patterns");
    });
  });

  describe("Input validation", () => {
    it("should validate valid request", () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "professional",
        taskType: "problem_solving",
        cognitiveComplexity: 5,
      };

      expect(strategy.validateInput(request)).toBe(true);
    });

    it("should reject null input", () => {
      expect(strategy.validateInput(null as any)).toBe(false);
    });

    it("should reject undefined input", () => {
      expect(strategy.validateInput(undefined as any)).toBe(false);
    });
  });

  describe("Expert modeling analysis", () => {
    it("should model expert thinking for customer service", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "professional",
        taskType: "customer_support",
        cognitiveComplexity: 5,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      expect(result.strategyId).toBe("expert-modeling");
      expect(result.data).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("should model expert thinking for sales domain", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "sales",
        expertiseLevel: "expert",
        taskType: "complex_sale",
        cognitiveComplexity: 7,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      expect(result.data.cognitiveArchitecture).toBeDefined();
      expect(result.data.knowledgeStructure).toBeDefined();
      expect(result.data.cognitiveProcesses).toBeDefined();
    });

    it("should model expert thinking for marketing domain", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "marketing",
        expertiseLevel: "specialist",
        taskType: "campaign_design",
        cognitiveComplexity: 8,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      expect(
        result.data.cognitiveArchitecture.mentalModels.length,
      ).toBeGreaterThan(0);
      expect(
        result.data.cognitiveArchitecture.reasoningPatterns.length,
      ).toBeGreaterThan(0);
      expect(
        result.data.cognitiveArchitecture.decisionHeuristics.length,
      ).toBeGreaterThan(0);
    });
  });

  describe("Cognitive architecture", () => {
    it("should include domain-specific mental models", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "professional",
        taskType: "support",
        cognitiveComplexity: 5,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const mentalModels = result.data.cognitiveArchitecture.mentalModels;
      const domainModel = mentalModels.find((m) =>
        m.name.includes("Customer Journey"),
      );

      expect(domainModel).toBeDefined();
      expect(domainModel?.components.length).toBeGreaterThan(0);
      expect(domainModel?.relationships.length).toBeGreaterThan(0);
    });

    it("should include generic professional models", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "general",
        expertiseLevel: "professional",
        taskType: "problem_solving",
        cognitiveComplexity: 5,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const mentalModels = result.data.cognitiveArchitecture.mentalModels;
      const problemSolutionModel = mentalModels.find((m) =>
        m.name.includes("Problem-Solution"),
      );

      expect(problemSolutionModel).toBeDefined();
    });

    it("should include advanced models for high expertise", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "sales",
        expertiseLevel: "specialist",
        taskType: "strategic_sales",
        cognitiveComplexity: 9,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const mentalModels = result.data.cognitiveArchitecture.mentalModels;
      const systemsModel = mentalModels.find((m) =>
        m.name.includes("Strategic Systems"),
      );

      expect(systemsModel).toBeDefined();
    });

    it("should include reasoning patterns", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "professional",
        taskType: "support",
        cognitiveComplexity: 5,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const patterns = result.data.cognitiveArchitecture.reasoningPatterns;
      expect(patterns.length).toBeGreaterThan(0);

      const patternRecognition = patterns.find((p) =>
        p.pattern.includes("Pattern Recognition"),
      );
      expect(patternRecognition).toBeDefined();
      expect(patternRecognition?.steps.length).toBeGreaterThan(0);
      expect(patternRecognition?.triggerConditions.length).toBeGreaterThan(0);
    });

    it("should include domain-specific reasoning for customer service", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "professional",
        taskType: "support",
        cognitiveComplexity: 5,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const patterns = result.data.cognitiveArchitecture.reasoningPatterns;
      const empatheticPattern = patterns.find((p) =>
        p.pattern.includes("Empathetic"),
      );

      expect(empatheticPattern).toBeDefined();
    });

    it("should include decision heuristics", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "sales",
        expertiseLevel: "professional",
        taskType: "sales",
        cognitiveComplexity: 6,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const heuristics = result.data.cognitiveArchitecture.decisionHeuristics;
      expect(heuristics.length).toBeGreaterThan(0);

      const stakeholderHeuristic = heuristics.find((h) =>
        h.heuristic.includes("Stakeholder Impact"),
      );
      expect(stakeholderHeuristic).toBeDefined();
      expect(stakeholderHeuristic?.reliability).toMatch(/high|medium|low/);
    });
  });

  describe("Knowledge structure", () => {
    it("should categorize core knowledge", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "sales",
        expertiseLevel: "professional",
        taskType: "sales",
        cognitiveComplexity: 5,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const coreKnowledge = result.data.knowledgeStructure.coreKnowledge;
      expect(coreKnowledge.factual.length).toBeGreaterThan(0);
      expect(coreKnowledge.procedural.length).toBeGreaterThan(0);
      expect(coreKnowledge.conditional.length).toBeGreaterThan(0);
      expect(coreKnowledge.metacognitive.length).toBeGreaterThan(0);
    });

    it("should include knowledge organization", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "marketing",
        expertiseLevel: "professional",
        taskType: "marketing",
        cognitiveComplexity: 5,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const organization = result.data.knowledgeStructure.knowledgeOrganization;
      expect(organization.hierarchies.length).toBeGreaterThan(0);
      expect(organization.associations.length).toBeGreaterThan(0);
      expect(organization.patterns.length).toBeGreaterThan(0);
      expect(organization.schemas.length).toBeGreaterThan(0);
    });

    it("should identify tacit knowledge", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "expert",
        taskType: "support",
        cognitiveComplexity: 7,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const tacitKnowledge = result.data.knowledgeStructure.tacitKnowledge;
      expect(tacitKnowledge.intuitions.length).toBeGreaterThan(0);
      expect(tacitKnowledge.experienceBasedInsights.length).toBeGreaterThan(0);
      expect(tacitKnowledge.situationalAwareness.length).toBeGreaterThan(0);
      expect(tacitKnowledge.implicitRules.length).toBeGreaterThan(0);
    });
  });

  describe("Cognitive processes", () => {
    it("should model problem identification", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "sales",
        expertiseLevel: "professional",
        taskType: "sales",
        cognitiveComplexity: 5,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const problemId = result.data.cognitiveProcesses.problemIdentification;
      expect(problemId.cueRecognition.length).toBeGreaterThan(0);
      expect(problemId.patternMatching.length).toBeGreaterThan(0);
      expect(problemId.contextualAnalysis.length).toBeGreaterThan(0);
    });

    it("should model solution generation", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "marketing",
        expertiseLevel: "professional",
        taskType: "marketing",
        cognitiveComplexity: 5,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const solutionGen = result.data.cognitiveProcesses.solutionGeneration;
      expect(solutionGen.searchStrategies.length).toBeGreaterThan(0);
      expect(solutionGen.creativityMechanisms.length).toBeGreaterThan(0);
      expect(solutionGen.analogicalReasoning.length).toBeGreaterThan(0);
    });

    it("should model evaluation processes", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "professional",
        taskType: "support",
        cognitiveComplexity: 5,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      const evaluation = result.data.cognitiveProcesses.evaluation;
      expect(evaluation.criteria.length).toBeGreaterThan(0);
      expect(evaluation.weightingFactors.length).toBeGreaterThan(0);
      expect(evaluation.uncertaintyHandling.length).toBeGreaterThan(0);
    });
  });

  describe("Confidence calculation", () => {
    it("should calculate higher confidence for complex models", async () => {
      const simpleRequest: CognitiveAnalysisRequest = {
        expertDomain: "general",
        expertiseLevel: "professional",
        taskType: "simple",
        cognitiveComplexity: 3,
      };

      const complexRequest: CognitiveAnalysisRequest = {
        expertDomain: "sales",
        expertiseLevel: "specialist",
        taskType: "complex",
        cognitiveComplexity: 9,
      };

      const context1 = { request: simpleRequest, logger };
      const context2 = { request: complexRequest, logger };

      const simpleResult = await strategy.analyze(simpleRequest, context1);
      const complexResult = await strategy.analyze(complexRequest, context2);

      // Complex models should have higher confidence due to more patterns
      expect(complexResult.confidence).toBeGreaterThanOrEqual(
        simpleResult.confidence,
      );
    });

    it("should have confidence between 0 and 1", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "professional",
        taskType: "support",
        cognitiveComplexity: 5,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe("Metadata collection", () => {
    it("should collect comprehensive metadata", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "sales",
        expertiseLevel: "expert",
        taskType: "sales",
        cognitiveComplexity: 7,
      };

      const context = { request, logger };
      const result = await strategy.analyze(request, context);

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.mentalModelsCount).toBeGreaterThan(0);
      expect(result.metadata?.reasoningPatternsCount).toBeGreaterThan(0);
      expect(result.metadata?.heuristicsCount).toBeGreaterThan(0);
      expect(result.metadata?.domain).toBe("sales");
      expect(result.metadata?.expertiseLevel).toBe("expert");
    });
  });
});
