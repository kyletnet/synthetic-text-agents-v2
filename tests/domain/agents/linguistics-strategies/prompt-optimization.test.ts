import { describe, it, expect } from "vitest";
import { PromptOptimizationStrategy } from "../../../../src/domain/agents/linguistics-strategies/prompt-optimization.js";
import { LinguisticsAnalysisRequest } from "../../../../src/agents/linguisticsEngineer.js";

describe("PromptOptimizationStrategy", () => {
  const strategy = new PromptOptimizationStrategy();

  describe("Strategy Interface", () => {
    it("should have correct strategy name", () => {
      expect(strategy.getName()).toBe("prompt-optimization");
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

  describe("Claude LLM Optimization", () => {
    it("should optimize for Claude with excellent instruction following", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 7,
        qualityTarget: 9,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.modelCharacteristics.contextWindow).toBe(200000);
      expect(result.modelCharacteristics.instructionFollowing).toBe(
        "excellent",
      );
      expect(result.modelCharacteristics.reasoningCapability).toBe("advanced");
      expect(result.promptStructure.optimalFormat).toBe(
        "detailed-hierarchical",
      );
      expect(result.promptStructure.examplePlacement).toBe("inline");
    });

    it("should include advanced guidelines for high complexity", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "technical",
        complexityLevel: 9,
        qualityTarget: 9,
        outputFormat: "structured",
      };

      const result = await strategy.execute(request);

      expect(result.promptStructure.sectionOrganization).toContain(
        "Advanced reasoning guidelines",
      );
      expect(result.promptStructure.sectionOrganization).toContain(
        "Edge case handling instructions",
      );
    });

    it("should include quality requirements for high quality target", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "sales",
        complexityLevel: 5,
        qualityTarget: 10,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.promptStructure.instructionClarity).toContain(
        "Include innovation and uniqueness requirements",
      );
      expect(result.promptStructure.instructionClarity).toContain(
        "Specify expert-level depth expectations",
      );
    });
  });

  describe("GPT LLM Optimization", () => {
    it("should optimize for GPT with correct characteristics", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "gpt",
        domain: "marketing",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.modelCharacteristics.contextWindow).toBe(128000);
      expect(result.modelCharacteristics.instructionFollowing).toBe(
        "excellent",
      );
      expect(result.modelCharacteristics.tokenEfficiency).toBe(3.8);
    });
  });

  describe("Gemini LLM Optimization", () => {
    it("should optimize for Gemini with good instruction following", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "gemini",
        domain: "customer_service",
        complexityLevel: 5,
        qualityTarget: 7,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.modelCharacteristics.contextWindow).toBe(1000000);
      expect(result.modelCharacteristics.instructionFollowing).toBe("good");
      expect(result.promptStructure.optimalFormat).toBe(
        "structured-with-examples",
      );
      expect(result.promptStructure.examplePlacement).toBe("after");
    });
  });

  describe("Generic LLM Optimization", () => {
    it("should optimize for generic LLM with simple structure", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "generic",
        domain: "general",
        complexityLevel: 3,
        qualityTarget: 6,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.modelCharacteristics.instructionFollowing).toBe("moderate");
      expect(result.promptStructure.optimalFormat).toBe("simple-direct");
      expect(result.promptStructure.examplePlacement).toBe("before");
    });
  });

  describe("Token Optimization", () => {
    it("should estimate tokens based on structure and complexity", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 5,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
        terminologyRequirements: ["CRM", "SLA", "NPS"],
      };

      const result = await strategy.execute(request);

      expect(result.tokenOptimization.estimatedTokens).toBeGreaterThan(0);
      expect(result.tokenOptimization.efficiencyScore).toBeGreaterThanOrEqual(
        0,
      );
      expect(result.tokenOptimization.efficiencyScore).toBeLessThanOrEqual(1);
    });

    it("should include reduction strategies for high token count", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "technical",
        complexityLevel: 10,
        qualityTarget: 10,
        outputFormat: "structured",
        terminologyRequirements: Array(20).fill("term"),
      };

      const result = await strategy.execute(request);

      expect(result.tokenOptimization.estimatedTokens).toBeGreaterThan(1000);
      expect(
        result.tokenOptimization.reductionStrategies.length,
      ).toBeGreaterThan(0);
    });

    it("should provide specific reduction strategies for generic LLM", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "generic",
        domain: "technical",
        complexityLevel: 7,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.tokenOptimization.reductionStrategies).toContain(
        "Simplify language and reduce technical terminology",
      );
    });
  });

  describe("Output Parsing Design", () => {
    it("should design QA pairs output format correctly", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "sales",
        complexityLevel: 5,
        qualityTarget: 8,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.outputParsing.formatSpecification).toContain("Q:");
      expect(result.outputParsing.formatSpecification).toContain("A:");
      expect(result.outputParsing.validationCriteria).toContain(
        "Each line must contain exactly one Q: and one A: section",
      );
      expect(result.outputParsing.errorHandling).toContain(
        "Reject malformed Q:/A: patterns",
      );
    });

    it("should design structured JSON output format correctly", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "marketing",
        complexityLevel: 6,
        qualityTarget: 8,
        outputFormat: "structured",
      };

      const result = await strategy.execute(request);

      expect(result.outputParsing.formatSpecification).toContain("JSON");
      expect(result.outputParsing.validationCriteria).toContain(
        "Valid JSON syntax required",
      );
      expect(result.outputParsing.errorHandling).toContain(
        "Parse JSON and validate schema compliance",
      );
    });

    it("should include lenient parsing for moderate instruction following", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "generic",
        domain: "general",
        complexityLevel: 4,
        qualityTarget: 6,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result.outputParsing.errorHandling).toContain(
        "Implement lenient parsing with automatic correction",
      );
    });
  });

  describe("Integration", () => {
    it("should return complete optimization structure", async () => {
      const request: LinguisticsAnalysisRequest = {
        targetLLM: "claude",
        domain: "customer_service",
        complexityLevel: 7,
        qualityTarget: 9,
        outputFormat: "qa-pairs",
      };

      const result = await strategy.execute(request);

      expect(result).toHaveProperty("modelCharacteristics");
      expect(result).toHaveProperty("promptStructure");
      expect(result).toHaveProperty("tokenOptimization");
      expect(result).toHaveProperty("outputParsing");
    });
  });
});
