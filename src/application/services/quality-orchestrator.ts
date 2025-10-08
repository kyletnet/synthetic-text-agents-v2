/**
 * Quality Orchestrator (Application Service)
 *
 * Orchestrates domain services in a standard workflow.
 * Prevents arbitrary calling order and ensures consistent quality assessment.
 *
 * This is an Application Service, NOT a Domain Service:
 * - Domain Services: Pure coordination within domain (no infrastructure dependencies)
 * - Application Services: Workflow orchestration across domain modules (may have infrastructure dependencies)
 */

import type {
  Entity,
  EntityRecognizer,
} from "../../domain/extraction/entity-recognizer.js";
import type {
  AlignmentResult,
  SemanticAligner,
} from "../../domain/alignment/semantic-aligner.js";
import type {
  QuestionClassificationResult,
  QuestionClassifier,
} from "../../domain/classification/question-classifier.js";
import {
  QualityAssessmentService,
  type QAItem,
  type QualityMetrics,
  type QualityTarget,
  DEFAULT_QUALITY_TARGET,
} from "../../domain/services/quality-assessment-service.js";

/**
 * Quality Assessment Result
 */
export interface QualityAssessmentResult {
  /** Quality metrics */
  metrics: QualityMetrics;

  /** Whether quality targets are met */
  meetsTarget: boolean;

  /** Quality gap analysis */
  gap: {
    entityCoverageGap: number;
    evidenceAlignmentGap: number;
    overallGap: number;
  };

  /** Improvement suggestions */
  suggestions: string[];

  /** Detailed breakdown */
  breakdown: {
    entityCount: number;
    coveredEntityCount: number;
    alignmentMethod: string;
    alignmentConfidence: number;
    questionType: string;
    questionConfidence: number;
  };
}

/**
 * Quality Orchestrator
 *
 * Standard workflow for quality assessment:
 * 1. Extract entities from source text
 * 2. Calculate evidence alignment
 * 3. Classify question type
 * 4. Assess overall quality
 * 5. Generate improvement suggestions
 */
export class QualityOrchestrator {
  private qualityService: QualityAssessmentService;

  constructor(
    private entityRecognizer: EntityRecognizer,
    private semanticAligner: SemanticAligner,
    private questionClassifier: QuestionClassifier,
  ) {
    this.qualityService = new QualityAssessmentService();
  }

  /**
   * Standard quality assessment workflow
   *
   * @param qaItem - QA item to assess
   * @param sourceText - Source text for entity extraction
   * @param domain - Domain context (e.g., "art_renaissance")
   * @param target - Quality target (defaults to 85% for entity coverage and evidence alignment)
   * @returns Complete quality assessment result
   */
  async assessQuality(
    qaItem: QAItem,
    sourceText: string,
    domain: string = "art_renaissance",
    target: QualityTarget = DEFAULT_QUALITY_TARGET,
  ): Promise<QualityAssessmentResult> {
    // Step 1: Extract entities from source text
    const entities = await this.entityRecognizer.extractEntities(
      sourceText,
      domain,
    );

    // Step 2: Calculate evidence alignment
    const alignment = await this.semanticAligner.calculateAlignment(
      qaItem.answer,
      qaItem.evidence || "",
    );

    // Step 3: Classify question type
    const classification = this.questionClassifier.classify(qaItem.question);

    // Step 4: Assess overall quality
    const metrics = this.qualityService.assessQuality(
      qaItem,
      entities,
      alignment,
      classification,
    );

    // Step 5: Check if targets are met
    const meetsTarget = this.qualityService.meetsQualityTarget(metrics, target);

    // Step 6: Calculate quality gap
    const gap = this.qualityService.calculateQualityGap(metrics, target);

    // Step 7: Generate improvement suggestions
    const suggestions = this.qualityService.generateImprovementSuggestions(
      metrics,
      target,
    );

    // Step 8: Build detailed breakdown
    const coveredEntityCount = entities.filter((entity) => {
      const qaText = `${qaItem.question} ${qaItem.answer}`.toLowerCase();
      return qaText.includes(entity.text.toLowerCase());
    }).length;

    const breakdown = {
      entityCount: entities.length,
      coveredEntityCount,
      alignmentMethod: alignment.method,
      alignmentConfidence: alignment.confidence,
      questionType: classification.type,
      questionConfidence: classification.confidence,
    };

    return {
      metrics,
      meetsTarget,
      gap,
      suggestions,
      breakdown,
    };
  }

  /**
   * Batch quality assessment for multiple QA items
   *
   * @param qaItems - Array of QA items
   * @param sourceTexts - Array of source texts
   * @param domain - Domain context
   * @param target - Quality target
   * @returns Array of quality assessment results
   */
  async assessBatchQuality(
    qaItems: QAItem[],
    sourceTexts: string[],
    domain: string = "art_renaissance",
    target: QualityTarget = DEFAULT_QUALITY_TARGET,
  ): Promise<QualityAssessmentResult[]> {
    const results: QualityAssessmentResult[] = [];

    for (let i = 0; i < qaItems.length; i++) {
      const qaItem = qaItems[i];
      const sourceText = sourceTexts[i % sourceTexts.length]; // Wrap around if needed

      const result = await this.assessQuality(
        qaItem,
        sourceText,
        domain,
        target,
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Get aggregated statistics for batch assessment
   *
   * @param results - Array of quality assessment results
   * @returns Aggregated statistics
   */
  getAggregatedStatistics(results: QualityAssessmentResult[]): {
    totalItems: number;
    itemsMeetingTarget: number;
    averageEntityCoverage: number;
    averageEvidenceAlignment: number;
    averageOverallQuality: number;
    qualityLevelDistribution: Record<string, number>;
    questionTypeDistribution: Record<string, number>;
  } {
    const totalItems = results.length;
    const itemsMeetingTarget = results.filter((r) => r.meetsTarget).length;

    const totalEntityCoverage = results.reduce(
      (sum, r) => sum + r.metrics.entityCoverage,
      0,
    );
    const totalEvidenceAlignment = results.reduce(
      (sum, r) => sum + r.metrics.evidenceAlignment,
      0,
    );
    const totalOverallQuality = results.reduce(
      (sum, r) => sum + r.metrics.overallQuality,
      0,
    );

    const qualityLevelDistribution: Record<string, number> = {};
    const questionTypeDistribution: Record<string, number> = {};

    for (const result of results) {
      const level = result.metrics.qualityLevel;
      qualityLevelDistribution[level] =
        (qualityLevelDistribution[level] || 0) + 1;

      const type = result.metrics.questionType;
      questionTypeDistribution[type] =
        (questionTypeDistribution[type] || 0) + 1;
    }

    return {
      totalItems,
      itemsMeetingTarget,
      averageEntityCoverage: totalEntityCoverage / totalItems,
      averageEvidenceAlignment: totalEvidenceAlignment / totalItems,
      averageOverallQuality: totalOverallQuality / totalItems,
      qualityLevelDistribution,
      questionTypeDistribution,
    };
  }

  /**
   * Find items that need improvement
   *
   * @param results - Array of quality assessment results
   * @param threshold - Minimum quality score (default: 0.5)
   * @returns Array of indices of items that need improvement
   */
  findItemsNeedingImprovement(
    results: QualityAssessmentResult[],
    threshold: number = 0.5,
  ): number[] {
    return results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.metrics.overallQuality < threshold)
      .map(({ index }) => index);
  }

  /**
   * Generate improvement plan for failing items
   *
   * @param qaItems - Array of QA items
   * @param results - Array of quality assessment results
   * @returns Improvement plan
   */
  generateImprovementPlan(
    qaItems: QAItem[],
    results: QualityAssessmentResult[],
  ): {
    itemsToRegenerate: number[];
    regenerationStrategy: Record<number, string[]>;
  } {
    const itemsToRegenerate = this.findItemsNeedingImprovement(results, 0.5);

    const regenerationStrategy: Record<number, string[]> = {};

    for (const index of itemsToRegenerate) {
      regenerationStrategy[index] = results[index].suggestions;
    }

    return {
      itemsToRegenerate,
      regenerationStrategy,
    };
  }
}
