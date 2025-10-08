/**
 * Prompt Optimization Strategy
 *
 * Handles LLM-specific prompt optimization including:
 * - Model characteristic analysis
 * - Prompt structure optimization
 * - Token usage optimization
 * - Output parsing design
 */

import { BaseLinguisticsStrategy } from "./base-strategy.js";
import type {
  LinguisticsAnalysisRequest,
  LLMOptimization,
} from "../linguistics-types.js";

export class PromptOptimizationStrategy extends BaseLinguisticsStrategy {
  constructor() {
    super("prompt-optimization");
  }

  async execute(request: LinguisticsAnalysisRequest): Promise<LLMOptimization> {
    const modelCharacteristics = this.analyzeLLMCharacteristics(
      request.targetLLM,
    );
    const promptStructure = await this.optimizePromptStructure(
      request,
      modelCharacteristics,
    );
    const tokenOptimization = await this.optimizeTokenUsage(
      request,
      promptStructure,
    );
    const outputParsing = await this.designOutputParsing(
      request,
      modelCharacteristics,
    );

    return {
      modelCharacteristics,
      promptStructure,
      tokenOptimization,
      outputParsing,
    };
  }

  private analyzeLLMCharacteristics(targetLLM: string) {
    const characteristics = {
      claude: {
        contextWindow: 200000,
        tokenEfficiency: 4.2,
        instructionFollowing: "excellent" as const,
        reasoningCapability: "advanced" as const,
        creativityLevel: "high" as const,
      },
      gpt: {
        contextWindow: 128000,
        tokenEfficiency: 3.8,
        instructionFollowing: "excellent" as const,
        reasoningCapability: "advanced" as const,
        creativityLevel: "high" as const,
      },
      gemini: {
        contextWindow: 1000000,
        tokenEfficiency: 3.5,
        instructionFollowing: "good" as const,
        reasoningCapability: "standard" as const,
        creativityLevel: "medium" as const,
      },
      generic: {
        contextWindow: 8000,
        tokenEfficiency: 3.0,
        instructionFollowing: "moderate" as const,
        reasoningCapability: "standard" as const,
        creativityLevel: "medium" as const,
      },
    };

    return (
      characteristics[targetLLM as keyof typeof characteristics] ||
      characteristics.generic
    );
  }

  private async optimizePromptStructure(
    request: LinguisticsAnalysisRequest,
    modelChar: LLMOptimization["modelCharacteristics"],
  ): Promise<LLMOptimization["promptStructure"]> {
    let optimalFormat = "hierarchical-structured";
    let sectionOrganization: string[] = [];
    let instructionClarity: string[] = [];
    let examplePlacement: "before" | "after" | "inline" | "none" = "before";

    if (modelChar.instructionFollowing === "excellent") {
      optimalFormat = "detailed-hierarchical";
      sectionOrganization = [
        "Role definition and context",
        "Task specification with quality criteria",
        "Domain expertise requirements",
        "Output format and structure",
        "Quality validation guidelines",
        "Example demonstrations (if needed)",
      ];
      instructionClarity = [
        "Use imperative voice for direct commands",
        "Employ numbered lists for sequential instructions",
        "Include explicit quality thresholds and metrics",
        "Specify output formatting with clear delimiters",
      ];
      examplePlacement = "inline";
    } else if (modelChar.instructionFollowing === "good") {
      optimalFormat = "structured-with-examples";
      sectionOrganization = [
        "Clear role and task definition",
        "Specific requirements and constraints",
        "Domain context and expertise level",
        "Output format specification",
        "Quality examples",
      ];
      instructionClarity = [
        "Use clear, direct language with minimal ambiguity",
        "Include examples to clarify expectations",
        "Repeat key requirements in different sections",
        "Use bullet points for clarity",
      ];
      examplePlacement = "after";
    } else {
      optimalFormat = "simple-direct";
      sectionOrganization = [
        "Task definition",
        "Basic requirements",
        "Output format",
        "Simple examples",
      ];
      instructionClarity = [
        "Use simple, direct instructions",
        "Minimize complex terminology",
        "Provide clear examples",
        "Repeat important points",
      ];
      examplePlacement = "before";
    }

    if (request.complexityLevel >= 8) {
      sectionOrganization.push("Advanced reasoning guidelines");
      sectionOrganization.push("Edge case handling instructions");
    }

    if (request.qualityTarget >= 9) {
      instructionClarity.push("Include innovation and uniqueness requirements");
      instructionClarity.push("Specify expert-level depth expectations");
    }

    return {
      optimalFormat,
      sectionOrganization,
      instructionClarity,
      examplePlacement,
    };
  }

  private async optimizeTokenUsage(
    request: LinguisticsAnalysisRequest,
    promptStructure: LLMOptimization["promptStructure"],
  ): Promise<LLMOptimization["tokenOptimization"]> {
    let estimatedTokens = 0;

    estimatedTokens += promptStructure.sectionOrganization.length * 50;
    estimatedTokens += promptStructure.instructionClarity.length * 30;

    estimatedTokens += request.terminologyRequirements?.length
      ? request.terminologyRequirements.length * 10
      : 100;

    estimatedTokens += request.complexityLevel * 50;

    if (request.qualityTarget >= 9) {
      estimatedTokens += 200;
    }

    const reductionStrategies: string[] = [];

    if (estimatedTokens > 1000) {
      reductionStrategies.push(
        "Consolidate similar instructions into single statements",
      );
      reductionStrategies.push(
        "Use abbreviations for frequently repeated terms",
      );
      reductionStrategies.push("Remove redundant examples and explanations");
    }

    if (request.targetLLM === "generic" && estimatedTokens > 500) {
      reductionStrategies.push(
        "Simplify language and reduce technical terminology",
      );
      reductionStrategies.push(
        "Combine related sections to reduce overall length",
      );
    }

    const maxReasonableTokens =
      request.targetLLM === "claude"
        ? 2000
        : request.targetLLM === "gpt"
        ? 1500
        : 800;
    const efficiencyScore = Math.max(
      0,
      Math.min(
        1,
        (maxReasonableTokens - estimatedTokens) / maxReasonableTokens,
      ),
    );

    return {
      estimatedTokens,
      reductionStrategies,
      efficiencyScore: Math.round(efficiencyScore * 100) / 100,
    };
  }

  private async designOutputParsing(
    request: LinguisticsAnalysisRequest,
    modelChar: LLMOptimization["modelCharacteristics"],
  ): Promise<LLMOptimization["outputParsing"]> {
    let formatSpecification = "";
    const validationCriteria: string[] = [];
    const errorHandling: string[] = [];

    if (request.outputFormat === "qa-pairs") {
      formatSpecification = "Q: [Question text] | A: [Answer text]";
      validationCriteria.push(
        "Each line must contain exactly one Q: and one A: section",
      );
      validationCriteria.push(
        "Questions must end with appropriate punctuation",
      );
      validationCriteria.push(
        "Answers must be complete sentences or paragraphs",
      );

      errorHandling.push("Reject malformed Q:/A: patterns");
      errorHandling.push("Flag incomplete questions or answers");
      errorHandling.push("Validate minimum/maximum length requirements");
    } else if (request.outputFormat === "structured") {
      formatSpecification =
        "JSON structure with question, answer, metadata fields";
      validationCriteria.push("Valid JSON syntax required");
      validationCriteria.push("All required fields must be present");
      validationCriteria.push(
        "Metadata should include complexity and domain tags",
      );

      errorHandling.push("Parse JSON and validate schema compliance");
      errorHandling.push("Check for missing or null required fields");
      errorHandling.push("Verify data types match specifications");
    }

    if (modelChar.instructionFollowing === "moderate") {
      errorHandling.push("Implement lenient parsing with automatic correction");
      errorHandling.push("Provide clear error messages for format violations");
    }

    return {
      formatSpecification,
      validationCriteria,
      errorHandling,
    };
  }
}
