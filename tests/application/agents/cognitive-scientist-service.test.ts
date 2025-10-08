/**
 * Cognitive Scientist Service Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CognitiveScientistService } from "../../../src/application/agents/cognitive-scientist-service.js";
import type { CognitiveAnalysisRequest } from "../../../src/domain/agents/cognitive-strategy.js";
import { Logger } from "../../../src/shared/logger.js";

describe("CognitiveScientistService", () => {
  let service: CognitiveScientistService;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({ level: "silent" });
    service = new CognitiveScientistService(logger);
  });

  describe("Service initialization", () => {
    it("should create service instance", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(CognitiveScientistService);
    });
  });

  describe("Complete analysis workflow", () => {
    it("should perform complete analysis for customer service domain", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "professional",
        taskType: "customer_support",
        cognitiveComplexity: 5,
      };

      const result = await service.analyze(request);

      // Verify all components are present
      expect(result.expertThinkingModel).toBeDefined();
      expect(result.expertiseTransferFramework).toBeDefined();
      expect(result.qaDesignPsychology).toBeDefined();
      expect(result.implementationGuidance).toBeDefined();
      expect(result.validationMethods).toBeDefined();
    });

    it("should perform complete analysis for sales domain", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "sales",
        expertiseLevel: "expert",
        taskType: "complex_sale",
        cognitiveComplexity: 7,
      };

      const result = await service.analyze(request);

      // Verify expert thinking model structure
      expect(result.expertThinkingModel.cognitiveArchitecture).toBeDefined();
      expect(result.expertThinkingModel.knowledgeStructure).toBeDefined();
      expect(result.expertThinkingModel.cognitiveProcesses).toBeDefined();

      // Verify expertise transfer framework
      expect(
        result.expertiseTransferFramework.knowledgeExternalization,
      ).toBeDefined();
      expect(result.expertiseTransferFramework.learningDesign).toBeDefined();
      expect(
        result.expertiseTransferFramework.adaptiveInstruction,
      ).toBeDefined();
    });

    it("should perform complete analysis for marketing domain", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "marketing",
        expertiseLevel: "specialist",
        taskType: "campaign_design",
        cognitiveComplexity: 8,
      };

      const result = await service.analyze(request);

      // Verify QA design psychology
      expect(result.qaDesignPsychology.questionFormulation).toBeDefined();
      expect(result.qaDesignPsychology.answerStructuring).toBeDefined();

      // Verify implementation guidance
      expect(
        result.implementationGuidance.thinkingProcessIntegration,
      ).toBeDefined();
      expect(result.implementationGuidance.expertiseReplication).toBeDefined();
      expect(result.implementationGuidance.cognitiveAuthenticity).toBeDefined();
      expect(result.implementationGuidance.learningEffectiveness).toBeDefined();

      // Verify validation methods
      expect(result.validationMethods.expertiseAccuracy).toBeDefined();
      expect(result.validationMethods.cognitiveValidity).toBeDefined();
      expect(result.validationMethods.learningOutcomes).toBeDefined();
      expect(result.validationMethods.transferEffectiveness).toBeDefined();
    });
  });

  describe("Expert thinking model output", () => {
    it("should produce mental models", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "professional",
        taskType: "support",
        cognitiveComplexity: 5,
      };

      const result = await service.analyze(request);

      const mentalModels =
        result.expertThinkingModel.cognitiveArchitecture.mentalModels;
      expect(mentalModels.length).toBeGreaterThan(0);
      expect(mentalModels[0].name).toBeDefined();
      expect(mentalModels[0].description).toBeDefined();
      expect(mentalModels[0].components.length).toBeGreaterThan(0);
      expect(mentalModels[0].relationships.length).toBeGreaterThan(0);
    });

    it("should produce reasoning patterns", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "sales",
        expertiseLevel: "expert",
        taskType: "sales",
        cognitiveComplexity: 7,
      };

      const result = await service.analyze(request);

      const reasoningPatterns =
        result.expertThinkingModel.cognitiveArchitecture.reasoningPatterns;
      expect(reasoningPatterns.length).toBeGreaterThan(0);
      expect(reasoningPatterns[0].pattern).toBeDefined();
      expect(reasoningPatterns[0].triggerConditions.length).toBeGreaterThan(0);
      expect(reasoningPatterns[0].steps.length).toBeGreaterThan(0);
      expect(reasoningPatterns[0].outputCharacteristics.length).toBeGreaterThan(
        0,
      );
    });

    it("should produce decision heuristics", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "marketing",
        expertiseLevel: "professional",
        taskType: "marketing",
        cognitiveComplexity: 6,
      };

      const result = await service.analyze(request);

      const heuristics =
        result.expertThinkingModel.cognitiveArchitecture.decisionHeuristics;
      expect(heuristics.length).toBeGreaterThan(0);
      expect(heuristics[0].heuristic).toBeDefined();
      expect(heuristics[0].applicableContexts.length).toBeGreaterThan(0);
      expect(heuristics[0].reliability).toMatch(/high|medium|low/);
      expect(heuristics[0].biasRisks.length).toBeGreaterThan(0);
    });
  });

  describe("Knowledge structure output", () => {
    it("should categorize knowledge types", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "professional",
        taskType: "support",
        cognitiveComplexity: 5,
      };

      const result = await service.analyze(request);

      const coreKnowledge =
        result.expertThinkingModel.knowledgeStructure.coreKnowledge;
      expect(coreKnowledge.factual.length).toBeGreaterThan(0);
      expect(coreKnowledge.procedural.length).toBeGreaterThan(0);
      expect(coreKnowledge.conditional.length).toBeGreaterThan(0);
      expect(coreKnowledge.metacognitive.length).toBeGreaterThan(0);
    });

    it("should identify tacit knowledge", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "sales",
        expertiseLevel: "expert",
        taskType: "sales",
        cognitiveComplexity: 7,
      };

      const result = await service.analyze(request);

      const tacitKnowledge =
        result.expertThinkingModel.knowledgeStructure.tacitKnowledge;
      expect(tacitKnowledge.intuitions.length).toBeGreaterThan(0);
      expect(tacitKnowledge.experienceBasedInsights.length).toBeGreaterThan(0);
      expect(tacitKnowledge.situationalAwareness.length).toBeGreaterThan(0);
      expect(tacitKnowledge.implicitRules.length).toBeGreaterThan(0);
    });
  });

  describe("QA design psychology output", () => {
    it("should provide question formulation guidance", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "marketing",
        expertiseLevel: "professional",
        taskType: "marketing",
        cognitiveComplexity: 6,
      };

      const result = await service.analyze(request);

      const questionFormulation = result.qaDesignPsychology.questionFormulation;
      expect(questionFormulation.cognitiveLoad).toBeDefined();
      expect(questionFormulation.expertiseElicitation).toBeDefined();
      expect(questionFormulation.thinkingStimulation).toBeDefined();

      expect(
        questionFormulation.cognitiveLoad.intrinsicLoad.length,
      ).toBeGreaterThan(0);
      expect(
        questionFormulation.cognitiveLoad.extraneousLoad.length,
      ).toBeGreaterThan(0);
      expect(
        questionFormulation.cognitiveLoad.germaneLoad.length,
      ).toBeGreaterThan(0);
    });

    it("should provide answer structuring guidance", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "expert",
        taskType: "support",
        cognitiveComplexity: 7,
      };

      const result = await service.analyze(request);

      const answerStructuring = result.qaDesignPsychology.answerStructuring;
      expect(answerStructuring.cognitiveFlow).toBeDefined();
      expect(answerStructuring.expertiseMarkers).toBeDefined();
      expect(answerStructuring.learningOptimization).toBeDefined();

      expect(
        answerStructuring.cognitiveFlow.informationSequencing.length,
      ).toBeGreaterThan(0);
      expect(
        answerStructuring.expertiseMarkers.knowledgeDepth.length,
      ).toBeGreaterThan(0);
      expect(
        answerStructuring.learningOptimization.memorability.length,
      ).toBeGreaterThan(0);
    });
  });

  describe("Implementation guidance output", () => {
    it("should provide comprehensive implementation guidance", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "sales",
        expertiseLevel: "professional",
        taskType: "sales",
        cognitiveComplexity: 6,
      };

      const result = await service.analyze(request);

      const guidance = result.implementationGuidance;
      expect(guidance.thinkingProcessIntegration.length).toBeGreaterThan(0);
      expect(guidance.expertiseReplication.length).toBeGreaterThan(0);
      expect(guidance.cognitiveAuthenticity.length).toBeGreaterThan(0);
      expect(guidance.learningEffectiveness.length).toBeGreaterThan(0);
    });
  });

  describe("Validation methods output", () => {
    it("should provide comprehensive validation methods", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "marketing",
        expertiseLevel: "specialist",
        taskType: "marketing",
        cognitiveComplexity: 8,
      };

      const result = await service.analyze(request);

      const validation = result.validationMethods;
      expect(validation.expertiseAccuracy.length).toBeGreaterThan(0);
      expect(validation.cognitiveValidity.length).toBeGreaterThan(0);
      expect(validation.learningOutcomes.length).toBeGreaterThan(0);
      expect(validation.transferEffectiveness.length).toBeGreaterThan(0);
    });
  });

  describe("Error handling", () => {
    it("should handle invalid request gracefully", async () => {
      const invalidRequest = null as any;

      await expect(service.analyze(invalidRequest)).rejects.toThrow();
    });

    it("should handle malformed request", async () => {
      const malformedRequest = {} as CognitiveAnalysisRequest;

      // Should not throw - should use defaults
      const result = await service.analyze(malformedRequest);
      expect(result).toBeDefined();
    });
  });

  describe("Performance characteristics", () => {
    it("should complete analysis in reasonable time", async () => {
      const request: CognitiveAnalysisRequest = {
        expertDomain: "customer_service",
        expertiseLevel: "professional",
        taskType: "support",
        cognitiveComplexity: 5,
      };

      const startTime = Date.now();
      await service.analyze(request);
      const duration = Date.now() - startTime;

      // Should complete in less than 1 second (synchronous processing)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("Integration with multiple domains", () => {
    it("should handle multiple sequential analyses", async () => {
      const requests: CognitiveAnalysisRequest[] = [
        {
          expertDomain: "customer_service",
          expertiseLevel: "professional",
          taskType: "support",
          cognitiveComplexity: 5,
        },
        {
          expertDomain: "sales",
          expertiseLevel: "expert",
          taskType: "sales",
          cognitiveComplexity: 7,
        },
        {
          expertDomain: "marketing",
          expertiseLevel: "specialist",
          taskType: "marketing",
          cognitiveComplexity: 8,
        },
      ];

      const results = [];
      for (const request of requests) {
        const result = await service.analyze(request);
        results.push(result);
      }

      expect(results.length).toBe(3);
      results.forEach((result) => {
        expect(result.expertThinkingModel).toBeDefined();
        expect(result.expertiseTransferFramework).toBeDefined();
        expect(result.qaDesignPsychology).toBeDefined();
      });
    });
  });
});
