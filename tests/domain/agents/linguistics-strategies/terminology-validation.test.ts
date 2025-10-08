import { describe, it, expect } from "vitest";
import { TerminologyValidationStrategy } from "../../../../src/domain/agents/linguistics-strategies/terminology-validation.js";
import { LinguisticsAnalysisRequest } from "../../../../src/agents/linguisticsEngineer.js";

describe("TerminologyValidationStrategy", () => {
  const strategy = new TerminologyValidationStrategy();

  describe("Strategy Interface", () => {
    it("should have correct strategy name", () => {
      expect(strategy.getName()).toBe("terminology-validation");
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

  describe("Domain Vocabulary Building", () => {
    it("should build customer service vocabulary", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.domainVocabulary.coreTerms).toContain(
        "customer satisfaction",
      );
      expect(result.domainVocabulary.coreTerms).toContain(
        "service level agreement",
      );
      expect(result.domainVocabulary.industryJargon).toContain("NPS");
      expect(result.domainVocabulary.industryJargon).toContain("CSAT");
      expect(result.domainVocabulary.alternativeExpressions.customer).toContain(
        "client",
      );
    });

    it("should build sales vocabulary", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "sales",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.domainVocabulary.coreTerms).toContain("pipeline");
      expect(result.domainVocabulary.coreTerms).toContain("lead qualification");
      expect(result.domainVocabulary.industryJargon).toContain("MQL");
      expect(result.domainVocabulary.industryJargon).toContain("SQL");
      expect(result.domainVocabulary.alternativeExpressions.prospect).toContain(
        "lead",
      );
    });

    it("should build marketing vocabulary", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "marketing",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.domainVocabulary.coreTerms).toContain("brand awareness");
      expect(result.domainVocabulary.coreTerms).toContain("target audience");
      expect(result.domainVocabulary.industryJargon).toContain("CTR");
      expect(result.domainVocabulary.industryJargon).toContain("ROAS");
      expect(result.domainVocabulary.alternativeExpressions.audience).toContain(
        "target market",
      );
    });

    it("should use generic vocabulary for unknown domains", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "unknown_domain",
        complexityLevel: 5,
        qualityTarget: 7,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.domainVocabulary.coreTerms).toContain("strategy");
      expect(result.domainVocabulary.coreTerms).toContain("implementation");
      expect(result.domainVocabulary.industryJargon).toContain("KPI");
      expect(result.domainVocabulary.industryJargon).toContain("ROI");
    });

    it("should integrate user-specified terminology requirements", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
        terminologyRequirements: ["custom_term_1", "custom_term_2"],
      };

      const result = await strategy.execute(request);

      expect(result.domainVocabulary.coreTerms).toContain("custom_term_1");
      expect(result.domainVocabulary.coreTerms).toContain("custom_term_2");
    });
  });

  describe("Usage Guidelines Creation", () => {
    it("should create appropriate context guidelines", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(
        Object.keys(result.usageGuidelines.appropriateContexts).length,
      ).toBeGreaterThan(0);
    });

    it("should include avoidance patterns for high quality targets", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 6,
        qualityTarget: 9,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.usageGuidelines.avoidancePatterns).toContain(
        'Avoid vague qualifiers like "might", "could", "possibly"',
      );
      expect(result.usageGuidelines.avoidancePatterns).toContain(
        'Minimize use of generic terms like "things", "stuff", "issues"',
      );
    });

    it("should include clarification needs for high complexity", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "technical",
        complexityLevel: 8,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.usageGuidelines.clarificationNeeds).toContain(
        "Define technical acronyms on first use",
      );
      expect(result.usageGuidelines.clarificationNeeds).toContain(
        "Provide context for industry-specific terminology",
      );
    });

    it("should include plain language guidance for low complexity", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 3,
        qualityTarget: 7,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.usageGuidelines.clarificationNeeds).toContain(
        "Use plain language alternatives for technical terms",
      );
    });
  });

  describe("Consistency Rules Establishment", () => {
    it("should establish preferred terms from alternatives", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(
        Object.keys(result.consistencyRules.preferredTerms).length,
      ).toBeGreaterThan(0);
      // Check that alternatives map to primary terms
      expect(result.consistencyRules.preferredTerms["client"]).toBe("customer");
    });

    it("should include synonym handling strategies", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "sales",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.consistencyRules.synonymHandling).toContain(
        "Use primary terminology consistently within each response",
      );
      expect(result.consistencyRules.synonymHandling).toContain(
        "Maintain term consistency across related Q&A pairs",
      );
    });

    it("should include definition requirements", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "marketing",
        complexityLevel: 7,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.consistencyRules.definitionRequirements).toContain(
        "Define technical terms on first use in each response",
      );
      expect(result.consistencyRules.definitionRequirements).toContain(
        "Maintain consistent definitions across all responses",
      );
    });
  });

  describe("Integration", () => {
    it("should return complete terminology framework", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 7,
        qualityTarget: 9,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result).toHaveProperty("domainVocabulary");
      expect(result).toHaveProperty("usageGuidelines");
      expect(result).toHaveProperty("consistencyRules");

      expect(result.domainVocabulary).toHaveProperty("coreTerms");
      expect(result.domainVocabulary).toHaveProperty("technicalConcepts");
      expect(result.domainVocabulary).toHaveProperty("industryJargon");
      expect(result.domainVocabulary).toHaveProperty("alternativeExpressions");

      expect(result.usageGuidelines).toHaveProperty("appropriateContexts");
      expect(result.usageGuidelines).toHaveProperty("avoidancePatterns");
      expect(result.usageGuidelines).toHaveProperty("clarificationNeeds");

      expect(result.consistencyRules).toHaveProperty("preferredTerms");
      expect(result.consistencyRules).toHaveProperty("synonymHandling");
      expect(result.consistencyRules).toHaveProperty("definitionRequirements");
    });
  });
});
