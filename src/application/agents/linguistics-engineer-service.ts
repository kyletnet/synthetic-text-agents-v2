/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Linguistics Engineer Service
 *
 * Application service layer that orchestrates linguistics strategies.
 * Follows Clean Architecture principles by coordinating domain strategies.
 */

import type {
  LinguisticsAnalysisRequest,
  LinguisticsEngineerOutput,
} from "../../domain/agents/linguistics-types.js";
import { PromptOptimizationStrategy } from "../../domain/agents/linguistics-strategies/prompt-optimization.js";
import { TerminologyValidationStrategy } from "../../domain/agents/linguistics-strategies/terminology-validation.js";
import { StructureAnalysisStrategy } from "../../domain/agents/linguistics-strategies/structure-analysis.js";
import { Logger } from "../../shared/logger.js";

/**
 * Service for coordinating linguistics engineering operations
 */
export class LinguisticsEngineerService {
  private promptOptimization: PromptOptimizationStrategy;
  private terminologyValidation: TerminologyValidationStrategy;
  private structureAnalysis: StructureAnalysisStrategy;

  constructor(private logger?: Logger) {
    this.promptOptimization = new PromptOptimizationStrategy();
    this.terminologyValidation = new TerminologyValidationStrategy();
    this.structureAnalysis = new StructureAnalysisStrategy();
  }

  /**
   * Execute complete linguistics analysis using all strategies
   */
  async analyze(
    request: LinguisticsAnalysisRequest,
  ): Promise<LinguisticsEngineerOutput> {
    this.logger?.info("Starting linguistics analysis", {
      targetLLM: request.targetLLM,
      domain: request.domain,
      complexityLevel: request.complexityLevel,
    });

    // Execute strategies in parallel where possible
    const [llmOptimization, terminologyFramework] = await Promise.all([
      this.promptOptimization.execute(request),
      this.terminologyValidation.execute(request),
    ]);

    // Structure analysis depends on LLM optimization, so execute it after
    const structureResult =
      await this.structureAnalysis.executeWithOptimization(
        request,
        llmOptimization,
      );

    const output: LinguisticsEngineerOutput = {
      llmOptimization,
      languageQuality: structureResult.languageQuality,
      terminologyFramework,
      structuralRecommendations: structureResult.structuralRecommendations,
      performancePredictions: structureResult.performancePredictions,
    };

    this.logger?.info("Linguistics analysis completed", {
      generationQuality:
        structureResult.performancePredictions.generationQuality,
      tokenEfficiency: structureResult.performancePredictions.tokenEfficiency,
    });

    return output;
  }

  /**
   * Execute only prompt optimization strategy
   */
  async optimizePrompt(request: LinguisticsAnalysisRequest) {
    return this.promptOptimization.execute(request);
  }

  /**
   * Execute only terminology validation strategy
   */
  async validateTerminology(request: LinguisticsAnalysisRequest) {
    return this.terminologyValidation.execute(request);
  }

  /**
   * Execute only structure analysis strategy
   */
  async analyzeStructure(request: LinguisticsAnalysisRequest) {
    return this.structureAnalysis.execute(request);
  }

  /**
   * Execute structure analysis with pre-computed optimization
   */
  async analyzeStructureWithOptimization(
    request: LinguisticsAnalysisRequest,
    llmOptimization: Awaited<
      ReturnType<typeof this.promptOptimization.execute>
    >,
  ) {
    return this.structureAnalysis.executeWithOptimization(
      request,
      llmOptimization,
    );
  }

  /**
   * Assess confidence in the analysis results
   */
  assessConfidence(result: LinguisticsEngineerOutput): number {
    const tokenEfficiency =
      result.llmOptimization.tokenOptimization.efficiencyScore;
    const avgLanguageQuality =
      (result.languageQuality.clarity.score +
        result.languageQuality.consistency.score +
        result.languageQuality.precision.score +
        result.languageQuality.naturalness.score) /
      40; // Convert to 0-1 scale

    const performanceConfidence =
      result.performancePredictions.generationQuality / 10;

    return (
      tokenEfficiency * 0.3 +
      avgLanguageQuality * 0.4 +
      performanceConfidence * 0.3
    );
  }

  /**
   * Generate reasoning explanation for results
   */
  explainReasoning(result: LinguisticsEngineerOutput): string {
    const tokenEst = result.llmOptimization.tokenOptimization.estimatedTokens;
    const efficiency = result.llmOptimization.tokenOptimization.efficiencyScore;
    const avgLangScore =
      (result.languageQuality.clarity.score +
        result.languageQuality.consistency.score +
        result.languageQuality.precision.score +
        result.languageQuality.naturalness.score) /
      4;

    return `Linguistics Engineer optimized prompt structure for target LLM with ${tokenEst} estimated tokens (${(
      efficiency * 100
    ).toFixed(
      0,
    )}% efficiency). Average language quality: ${avgLangScore.toFixed(
      1,
    )}/10 (Clarity ${result.languageQuality.clarity.score}/10, Consistency ${
      result.languageQuality.consistency.score
    }/10, Precision ${result.languageQuality.precision.score}/10, Naturalness ${
      result.languageQuality.naturalness.score
    }/10). Performance prediction: ${
      result.performancePredictions.generationQuality
    }/10 quality, ${
      result.performancePredictions.processingSpeed
    } processing speed.`;
  }
}
