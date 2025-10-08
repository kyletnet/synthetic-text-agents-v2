/**
 * Quality Assessment Service (Domain Service)
 *
 * Pure coordination service for quality assessment.
 * Prevents circular dependencies between domain modules.
 * Following DDD Domain Service pattern.
 */

import type { Entity } from "../extraction/entity-recognizer.js";
import type { AlignmentResult } from "../alignment/semantic-aligner.js";
import type { QuestionClassificationResult } from "../classification/question-classifier.js";

export interface QAItem {
  question: string;
  answer: string;
  evidence?: string;
}

export interface QualityMetrics {
  /** Entity coverage (0.0 - 1.0) */
  entityCoverage: number;

  /** Evidence alignment score (0.0 - 1.0) */
  evidenceAlignment: number;

  /** Question type */
  questionType: string;

  /** Overall quality score (0.0 - 1.0) */
  overallQuality: number;

  /** Quality level */
  qualityLevel: "excellent" | "good" | "acceptable" | "poor" | "failing";
}

export interface QualityTarget {
  /** Target entity coverage (default: 0.85) */
  entityCoverageTarget: number;

  /** Target evidence alignment (default: 0.85) */
  evidenceAlignmentTarget: number;

  /** Target question type distribution */
  questionTypeDistribution: {
    analytical: number;
    procedural: number;
    comparative: number;
    factual: number;
  };
}

/**
 * Quality Assessment Service
 *
 * Coordinates quality assessment across domain modules without creating dependencies.
 */
export class QualityAssessmentService {
  /**
   * Assess quality of a QA item
   *
   * @param item - QA item to assess
   * @param entities - Extracted entities from source text
   * @param alignment - Alignment result
   * @param classification - Question classification result
   * @returns Quality metrics
   */
  assessQuality(
    item: QAItem,
    entities: Entity[],
    alignment: AlignmentResult,
    classification: QuestionClassificationResult,
  ): QualityMetrics {
    // 1. Calculate entity coverage
    const entityCoverage = this.calculateEntityCoverage(item, entities);

    // 2. Evidence alignment score
    const evidenceAlignment = alignment.score;

    // 3. Overall quality score (weighted average)
    const overallQuality =
      entityCoverage * 0.4 + // 40%: Entity coverage
      evidenceAlignment * 0.5 + // 50%: Evidence alignment
      classification.confidence * 0.1; // 10%: Classification confidence

    // 4. Quality level
    const qualityLevel = this.getQualityLevel(overallQuality);

    return {
      entityCoverage,
      evidenceAlignment,
      questionType: classification.type,
      overallQuality,
      qualityLevel,
    };
  }

  /**
   * Check if QA item meets quality targets
   *
   * @param metrics - Quality metrics
   * @param target - Quality target
   * @returns True if all targets are met
   */
  meetsQualityTarget(metrics: QualityMetrics, target: QualityTarget): boolean {
    return (
      metrics.entityCoverage >= target.entityCoverageTarget &&
      metrics.evidenceAlignment >= target.evidenceAlignmentTarget
    );
  }

  /**
   * Calculate gap between current quality and target
   *
   * @param metrics - Current quality metrics
   * @param target - Quality target
   * @returns Quality gap (0.0 = perfect, 1.0 = maximum gap)
   */
  calculateQualityGap(
    metrics: QualityMetrics,
    target: QualityTarget,
  ): {
    entityCoverageGap: number;
    evidenceAlignmentGap: number;
    overallGap: number;
  } {
    const entityCoverageGap = Math.max(
      0,
      target.entityCoverageTarget - metrics.entityCoverage,
    );
    const evidenceAlignmentGap = Math.max(
      0,
      target.evidenceAlignmentTarget - metrics.evidenceAlignment,
    );

    const overallGap = (entityCoverageGap + evidenceAlignmentGap) / 2;

    return {
      entityCoverageGap,
      evidenceAlignmentGap,
      overallGap,
    };
  }

  /**
   * Generate improvement suggestions
   *
   * @param metrics - Current quality metrics
   * @param target - Quality target
   * @returns Array of improvement suggestions
   */
  generateImprovementSuggestions(
    metrics: QualityMetrics,
    target: QualityTarget,
  ): string[] {
    const suggestions: string[] = [];

    // Entity coverage suggestions
    if (metrics.entityCoverage < target.entityCoverageTarget) {
      const gap = target.entityCoverageTarget - metrics.entityCoverage;
      suggestions.push(
        `Improve entity coverage by ${(gap * 100).toFixed(
          1,
        )}%: Include more key entities in questions/answers`,
      );
    }

    // Evidence alignment suggestions
    if (metrics.evidenceAlignment < target.evidenceAlignmentTarget) {
      const gap = target.evidenceAlignmentTarget - metrics.evidenceAlignment;

      if (metrics.evidenceAlignment < 0.3) {
        suggestions.push(
          `Critical alignment issue (${(gap * 100).toFixed(
            1,
          )}% below target): Use direct quotes from evidence`,
        );
      } else if (metrics.evidenceAlignment < 0.5) {
        suggestions.push(
          `Low alignment (${(gap * 100).toFixed(
            1,
          )}% below target): Paraphrase evidence more closely`,
        );
      } else {
        suggestions.push(
          `Moderate alignment (${(gap * 100).toFixed(
            1,
          )}% below target): Strengthen connection to evidence`,
        );
      }
    }

    // Overall quality suggestions
    if (metrics.overallQuality < 0.5) {
      suggestions.push(
        "Overall quality is below acceptable threshold: Consider regenerating QA pair",
      );
    }

    return suggestions;
  }

  /**
   * Calculate entity coverage for a QA item
   */
  private calculateEntityCoverage(item: QAItem, entities: Entity[]): number {
    if (entities.length === 0) return 0;

    const qaText = `${item.question} ${item.answer}`.toLowerCase();

    const coveredEntities = entities.filter((entity) =>
      qaText.includes(entity.text.toLowerCase()),
    );

    return coveredEntities.length / entities.length;
  }

  /**
   * Get quality level from score
   */
  private getQualityLevel(
    score: number,
  ): "excellent" | "good" | "acceptable" | "poor" | "failing" {
    if (score >= 0.85) return "excellent";
    if (score >= 0.7) return "good";
    if (score >= 0.5) return "acceptable";
    if (score >= 0.3) return "poor";
    return "failing";
  }
}

/**
 * Default quality target (85% for entity coverage and evidence alignment)
 */
export const DEFAULT_QUALITY_TARGET: QualityTarget = {
  entityCoverageTarget: 0.85,
  evidenceAlignmentTarget: 0.85,
  questionTypeDistribution: {
    analytical: 0.3,
    procedural: 0.3,
    comparative: 0.2,
    factual: 0.2,
  },
};
