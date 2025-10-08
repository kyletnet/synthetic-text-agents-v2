/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Cognitive Scientist Service
 *
 * Orchestrates multiple cognitive strategies to analyze expert thinking
 * and generate comprehensive cognitive models.
 *
 * Uses Strategy Pattern to combine:
 * - Expert Modeling: Analyzes thinking patterns and cognitive processes
 * - Knowledge Extraction: Structures knowledge for transfer
 * - QA Design: Applies cognitive psychology to Q&A design
 * - Implementation Guidance: Provides practical implementation guidance
 * - Validation Methods: Establishes validation approaches
 */

import { Logger } from "../../shared/logger.js";
import type { CognitiveAnalysisRequest } from "../../domain/agents/cognitive-strategy.js";
import {
  ExpertModelingStrategy,
  type ExpertThinkingModel,
} from "../../domain/agents/cognitive-strategies/expert-modeling.js";
import {
  KnowledgeExtractionStrategy,
  type ExpertiseTransferFramework,
} from "../../domain/agents/cognitive-strategies/knowledge-extraction.js";
import {
  QADesignStrategy,
  type QADesignPsychology,
} from "../../domain/agents/cognitive-strategies/qa-design.js";
import {
  ImplementationGuidanceStrategy,
  type ImplementationGuidance,
  ValidationMethodsStrategy,
  type ValidationMethods,
} from "../../domain/agents/cognitive-strategies/implementation-guidance.js";

/**
 * Cognitive scientist output
 */
export interface CognitiveScientistOutput {
  expertThinkingModel: ExpertThinkingModel;
  expertiseTransferFramework: ExpertiseTransferFramework;
  qaDesignPsychology: QADesignPsychology;
  implementationGuidance: ImplementationGuidance;
  validationMethods: ValidationMethods;
}

/**
 * Service performance metrics
 */
export interface ServicePerformanceMetrics {
  totalDuration: number;
  strategyDurations: Record<string, number>;
  confidenceScores: Record<string, number>;
  averageConfidence: number;
}

/**
 * Cognitive Scientist Service
 *
 * Orchestrates cognitive strategies to produce comprehensive expert analysis.
 * This service replaces the monolithic CognitiveScientist agent with a
 * modular, strategy-based approach.
 */
export class CognitiveScientistService {
  private logger: Logger;
  private expertModelingStrategy: ExpertModelingStrategy;
  private knowledgeExtractionStrategy: KnowledgeExtractionStrategy;
  private qaDesignStrategy: QADesignStrategy;
  private implementationGuidanceStrategy: ImplementationGuidanceStrategy;
  private validationMethodsStrategy: ValidationMethodsStrategy;

  constructor(logger: Logger) {
    this.logger = logger;

    // Initialize strategies
    this.expertModelingStrategy = new ExpertModelingStrategy();
    this.knowledgeExtractionStrategy = new KnowledgeExtractionStrategy();
    this.qaDesignStrategy = new QADesignStrategy();
    this.implementationGuidanceStrategy = new ImplementationGuidanceStrategy();
    this.validationMethodsStrategy = new ValidationMethodsStrategy();
  }

  /**
   * Analyze expert thinking and generate comprehensive cognitive model
   *
   * @param request - Cognitive analysis request
   * @returns Complete cognitive scientist output
   */
  async analyze(
    request: CognitiveAnalysisRequest,
  ): Promise<CognitiveScientistOutput> {
    const startTime = Date.now();

    this.logger.info("Starting cognitive analysis", {
      domain: request.expertDomain,
      expertiseLevel: request.expertiseLevel,
      complexity: request.cognitiveComplexity,
    });

    try {
      // Create context
      const context = {
        request,
        logger: this.logger,
      };

      // Execute strategies in sequence
      // 1. Model expert thinking
      const expertModelResult = await this.expertModelingStrategy.analyze(
        request,
        context,
      );

      this.logger.debug("Expert modeling completed", {
        duration: expertModelResult.duration,
        confidence: expertModelResult.confidence,
      });

      // 2. Extract knowledge for transfer
      const knowledgeExtractionResult =
        await this.knowledgeExtractionStrategy.analyze(
          { expertModel: expertModelResult.data },
          context,
        );

      this.logger.debug("Knowledge extraction completed", {
        duration: knowledgeExtractionResult.duration,
        confidence: knowledgeExtractionResult.confidence,
      });

      // 3. Design QA psychology
      const qaDesignResult = await this.qaDesignStrategy.analyze(
        { expertModel: expertModelResult.data },
        context,
      );

      this.logger.debug("QA design completed", {
        duration: qaDesignResult.duration,
        confidence: qaDesignResult.confidence,
      });

      // 4. Generate implementation guidance
      const implementationGuidanceResult =
        await this.implementationGuidanceStrategy.analyze(
          { expertModel: expertModelResult.data },
          context,
        );

      this.logger.debug("Implementation guidance completed", {
        duration: implementationGuidanceResult.duration,
        confidence: implementationGuidanceResult.confidence,
      });

      // 5. Establish validation methods
      const validationMethodsResult =
        await this.validationMethodsStrategy.analyze(
          { expertModel: expertModelResult.data },
          context,
        );

      this.logger.debug("Validation methods completed", {
        duration: validationMethodsResult.duration,
        confidence: validationMethodsResult.confidence,
      });

      const totalDuration = Date.now() - startTime;

      // Log performance metrics
      const metrics: ServicePerformanceMetrics = {
        totalDuration,
        strategyDurations: {
          expertModeling: expertModelResult.duration,
          knowledgeExtraction: knowledgeExtractionResult.duration,
          qaDesign: qaDesignResult.duration,
          implementationGuidance: implementationGuidanceResult.duration,
          validationMethods: validationMethodsResult.duration,
        },
        confidenceScores: {
          expertModeling: expertModelResult.confidence,
          knowledgeExtraction: knowledgeExtractionResult.confidence,
          qaDesign: qaDesignResult.confidence,
          implementationGuidance: implementationGuidanceResult.confidence,
          validationMethods: validationMethodsResult.confidence,
        },
        averageConfidence:
          (expertModelResult.confidence +
            knowledgeExtractionResult.confidence +
            qaDesignResult.confidence +
            implementationGuidanceResult.confidence +
            validationMethodsResult.confidence) /
          5,
      };

      this.logger.info("Cognitive analysis completed", metrics);

      return {
        expertThinkingModel: expertModelResult.data,
        expertiseTransferFramework: knowledgeExtractionResult.data,
        qaDesignPsychology: qaDesignResult.data,
        implementationGuidance: implementationGuidanceResult.data,
        validationMethods: validationMethodsResult.data,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error("Cognitive analysis failed", {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      throw error;
    }
  }

  /**
   * Get performance metrics for the last analysis
   */
  getPerformanceMetrics(): ServicePerformanceMetrics | null {
    // This would be enhanced with actual metrics tracking
    return null;
  }
}
