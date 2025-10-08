import { describe, it, expect } from "vitest";
import { StructureAnalysisStrategy } from "../../../../src/domain/agents/linguistics-strategies/structure-analysis.js";
import { LinguisticsAnalysisRequest } from "../../../../src/agents/linguisticsEngineer.js";

describe("StructureAnalysisStrategy", () => {
  const strategy = new StructureAnalysisStrategy();

  describe("Strategy Interface", () => {
    it("should have correct strategy name", () => {
      expect(strategy.getName()).toBe("structure-analysis");
    });

    it("should handle all requests", () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 5,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };
      expect(strategy.canHandle(request)).toBe(true);
    });
  });

  describe("Clarity Assessment", () => {
    it("should assess clarity for healthcare domain", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "healthcare",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.languageQuality.clarity.score).toBeGreaterThanOrEqual(7);
      expect(result.languageQuality.clarity.improvements).toContain(
        "Use precise technical terminology with clear definitions",
      );
    });

    it("should adjust clarity for high complexity", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "technical",
        complexityLevel: 9,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.languageQuality.clarity.readabilityLevel).toBe(
        "advanced-professional",
      );
      expect(result.languageQuality.clarity.improvements).toContain(
        "Break down complex concepts into digestible components",
      );
    });

    it("should adjust clarity for low complexity", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "general",
        complexityLevel: 2,
        qualityTarget: 7,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.languageQuality.clarity.readabilityLevel).toBe(
        "accessible-professional",
      );
      expect(result.languageQuality.clarity.improvements).toContain(
        "Use simple, direct language without jargon",
      );
    });

    it("should include quality improvements for high quality target", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "sales",
        complexityLevel: 6,
        qualityTarget: 10,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.languageQuality.clarity.improvements).toContain(
        "Ensure every sentence adds clear value",
      );
    });
  });

  describe("Consistency Assessment", () => {
    it("should assess consistency with terminology requirements", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
        terminologyRequirements: ["CRM", "SLA", "NPS"],
      };

      const result = await strategy.execute(request);

      expect(result.languageQuality.consistency.score).toBeGreaterThanOrEqual(
        8,
      );
      expect(result.languageQuality.consistency.terminologyAlignment).toContain(
        "Maintain consistent usage of specified domain terms",
      );
    });

    it("should include style coherence requirements", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "marketing",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.languageQuality.consistency.styleCoherence).toContain(
        "Maintain consistent tone and formality level",
      );
      expect(result.languageQuality.consistency.styleCoherence).toContain(
        "Apply consistent formatting and punctuation patterns",
      );
    });

    it("should adjust for high complexity", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "technical",
        complexityLevel: 8,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.languageQuality.consistency.styleCoherence).toContain(
        "Maintain sophisticated language register consistently",
      );
    });
  });

  describe("Precision Assessment", () => {
    it("should assess precision for legal domain", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "legal",
        complexityLevel: 7,
        qualityTarget: 9,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.languageQuality.precision.score).toBeGreaterThanOrEqual(8);
      expect(
        result.languageQuality.precision.specificityEnhancements,
      ).toContain("Use exact, unambiguous terminology");
      expect(result.languageQuality.precision.ambiguityReduction).toContain(
        'Avoid vague qualifiers like "often" or "sometimes"',
      );
    });

    it("should include general precision improvements", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "general",
        complexityLevel: 5,
        qualityTarget: 7,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(
        result.languageQuality.precision.specificityEnhancements,
      ).toContain("Replace general terms with specific, measurable concepts");
      expect(result.languageQuality.precision.ambiguityReduction).toContain(
        "Eliminate pronouns with unclear antecedents",
      );
    });

    it("should include advanced precision for high quality target", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "finance",
        complexityLevel: 7,
        qualityTarget: 10,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(
        result.languageQuality.precision.specificityEnhancements,
      ).toContain("Provide exact methodologies and step-by-step procedures");
    });
  });

  describe("Naturalness Assessment", () => {
    it("should assess naturalness for conversational format", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 5,
        qualityTarget: 8,
        outputFormat: "conversational",
      };

      const result = await strategy.execute(request);

      expect(result.languageQuality.naturalness.score).toBeGreaterThanOrEqual(
        7,
      );
      expect(
        result.languageQuality.naturalness.conversationalElements,
      ).toContain("Use natural dialogue patterns and transitions");
    });

    it("should assess naturalness for QA pairs format", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "sales",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(
        result.languageQuality.naturalness.conversationalElements,
      ).toContain("Frame questions as natural inquiries");
    });

    it("should adjust for customer-facing domains", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "marketing",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(
        result.languageQuality.naturalness.conversationalElements,
      ).toContain("Use empathetic and engaging language");
    });
  });

  describe("Structural Recommendations", () => {
    it("should generate recommendations for excellent instruction following", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "technical",
        complexityLevel: 7,
        qualityTarget: 9,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.structuralRecommendations.promptArchitecture).toContain(
        "Use multi-level instruction hierarchy",
      );
    });

    it("should adjust information hierarchy for high quality target", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "sales",
        complexityLevel: 6,
        qualityTarget: 10,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.structuralRecommendations.informationHierarchy).toContain(
        "Include advanced concepts and edge cases",
      );
    });

    it("should include coherence strategies", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "marketing",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.structuralRecommendations.coherenceStrategies).toContain(
        "Use consistent logical flow patterns",
      );
    });

    it("should include diversity mechanisms", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.structuralRecommendations.diversityMechanisms).toContain(
        "Vary sentence structures and lengths",
      );
    });
  });

  describe("Performance Predictions", () => {
    it("should predict performance based on factors", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(
        result.performancePredictions.generationQuality,
      ).toBeGreaterThanOrEqual(7);
      expect(
        result.performancePredictions.generationQuality,
      ).toBeLessThanOrEqual(10);
      expect(
        result.performancePredictions.consistencyExpectation,
      ).toBeGreaterThanOrEqual(0);
      expect(
        result.performancePredictions.tokenEfficiency,
      ).toBeGreaterThanOrEqual(0);
      expect(result.performancePredictions.tokenEfficiency).toBeLessThanOrEqual(
        1,
      );
    });

    it("should predict processing speed based on token count", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "technical",
        complexityLevel: 3,
        qualityTarget: 7,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(["fast", "medium", "slow"]).toContain(
        result.performancePredictions.processingSpeed,
      );
    });
  });

  describe("Integration", () => {
    it("should return complete structure analysis result", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 7,
        qualityTarget: 9,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result).toHaveProperty("languageQuality");
      expect(result).toHaveProperty("structuralRecommendations");
      expect(result).toHaveProperty("performancePredictions");

      expect(result.languageQuality).toHaveProperty("clarity");
      expect(result.languageQuality).toHaveProperty("consistency");
      expect(result.languageQuality).toHaveProperty("precision");
      expect(result.languageQuality).toHaveProperty("naturalness");
    });
  });
});
