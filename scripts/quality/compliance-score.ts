/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Compliance Score Calculator (Phase 1)
 *
 * Purpose:
 * - Calculate weighted compliance score from quality metrics
 * - Apply configurable weights to different dimensions
 * - Determine gate pass/fail based on thresholds
 *
 * Architecture:
 * - Load weights from governance-rules.json
 * - Apply weights to metric scores
 * - Generate gate decision
 *
 * Phase: Phase 1
 * Version: 1.0.0
 */

import type {
  QualityMetric,
  ComplianceCheckResult,
  ComplianceDimension,
  GateDecision,
  GateResult,
  Violation,
} from "./models/quality-domain.js";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// ============================================================================
// Types
// ============================================================================

export interface ComplianceWeights {
  questionType: number;
  answerStructure: number;
  numberFormat: number;
  prohibition: number;
}

export interface ComplianceThresholds {
  guideline_compliance: number;
  retrieval_quality_score?: number;
  semantic_quality?: number;
}

export interface ComplianceConfig {
  weights: ComplianceWeights;
  thresholds: ComplianceThresholds;
}

// ============================================================================
// Compliance Score Calculator
// ============================================================================

export class ComplianceScoreCalculator {
  private projectRoot: string;
  private config: ComplianceConfig;

  // Default weights (Architecture document: Phase 1)
  private static DEFAULT_WEIGHTS: ComplianceWeights = {
    questionType: 0.4, // 40%
    answerStructure: 0.3, // 30%
    numberFormat: 0.2, // 20%
    prohibition: 0.1, // 10%
  };

  // Default thresholds
  private static DEFAULT_THRESHOLDS: ComplianceThresholds = {
    guideline_compliance: 0.85, // Phase 1: 85% minimum
    retrieval_quality_score: 0.7, // Phase 2: 70%
    semantic_quality: 0.75, // Phase 3-4: 75%
  };

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from governance-rules.json
   */
  private loadConfig(): ComplianceConfig {
    const rulesPath = join(this.projectRoot, "governance-rules.json");

    if (!existsSync(rulesPath)) {
      console.warn("⚠️  governance-rules.json not found, using default config");
      return {
        weights: ComplianceScoreCalculator.DEFAULT_WEIGHTS,
        thresholds: ComplianceScoreCalculator.DEFAULT_THRESHOLDS,
      };
    }

    try {
      const rules = JSON.parse(readFileSync(rulesPath, "utf8"));

      const weights: ComplianceWeights = {
        questionType:
          rules.quality?.weights?.questionType ??
          ComplianceScoreCalculator.DEFAULT_WEIGHTS.questionType,
        answerStructure:
          rules.quality?.weights?.answerStructure ??
          ComplianceScoreCalculator.DEFAULT_WEIGHTS.answerStructure,
        numberFormat:
          rules.quality?.weights?.numberFormat ??
          ComplianceScoreCalculator.DEFAULT_WEIGHTS.numberFormat,
        prohibition:
          rules.quality?.weights?.prohibition ??
          ComplianceScoreCalculator.DEFAULT_WEIGHTS.prohibition,
      };

      const thresholds: ComplianceThresholds = {
        guideline_compliance:
          rules.quality?.thresholds?.guideline_compliance ??
          ComplianceScoreCalculator.DEFAULT_THRESHOLDS.guideline_compliance,
        retrieval_quality_score:
          rules.quality?.thresholds?.retrieval_quality_score ??
          ComplianceScoreCalculator.DEFAULT_THRESHOLDS.retrieval_quality_score,
        semantic_quality:
          rules.quality?.thresholds?.semantic_quality ??
          ComplianceScoreCalculator.DEFAULT_THRESHOLDS.semantic_quality,
      };

      return { weights, thresholds };
    } catch (error) {
      console.warn(
        `⚠️  Failed to parse governance-rules.json: ${error}, using defaults`,
      );
      return {
        weights: ComplianceScoreCalculator.DEFAULT_WEIGHTS,
        thresholds: ComplianceScoreCalculator.DEFAULT_THRESHOLDS,
      };
    }
  }

  /**
   * Calculate compliance score from metrics
   */
  calculateScore(metrics: QualityMetric[]): ComplianceCheckResult {
    // Extract metrics by dimension
    const questionTypeMetric = metrics.find((m) =>
      m.dimension.includes("question_type"),
    );
    const answerStructureMetric = metrics.find((m) =>
      m.dimension.includes("answer_structure"),
    );
    const numberFormatMetric = metrics.find((m) =>
      m.dimension.includes("number_format"),
    );
    const prohibitionMetric = metrics.find((m) =>
      m.dimension.includes("prohibition"),
    );

    // Build compliance dimensions
    const questionTypeCompliance = this.buildDimension(
      questionTypeMetric,
      this.config.weights.questionType,
    );
    const answerStructureCompliance = this.buildDimension(
      answerStructureMetric,
      this.config.weights.answerStructure,
    );
    const numberFormatCompliance = this.buildDimension(
      numberFormatMetric,
      this.config.weights.numberFormat,
    );
    const prohibitionCompliance = this.buildDimension(
      prohibitionMetric,
      this.config.weights.prohibition,
    );

    // Calculate weighted overall score
    const overallScore =
      questionTypeCompliance.score * questionTypeCompliance.weight +
      answerStructureCompliance.score * answerStructureCompliance.weight +
      numberFormatCompliance.score * numberFormatCompliance.weight +
      prohibitionCompliance.score * prohibitionCompliance.weight;

    return {
      questionTypeCompliance,
      answerStructureCompliance,
      numberFormatCompliance,
      prohibitionCompliance,
      overallScore,
    };
  }

  /**
   * Build compliance dimension from metric
   */
  private buildDimension(
    metric: QualityMetric | undefined,
    weight: number,
  ): ComplianceDimension {
    if (!metric) {
      return {
        score: 0,
        weight,
        violations: [],
        passedCount: 0,
        failedCount: 0,
      };
    }

    const violations = (metric.details?.violations ?? []) as Violation[];
    const breakdown = (metric.details?.breakdown ?? {}) as Record<
      string,
      number
    >;

    const passedCount = breakdown.passed ?? breakdown.matched ?? 0;
    const totalCount = breakdown.total ?? 0;
    const failedCount = totalCount - passedCount;

    return {
      score: metric.score,
      weight,
      violations,
      passedCount,
      failedCount,
    };
  }

  /**
   * Make gate decision based on score
   */
  makeGateDecision(
    score: number,
    phase: "Phase 1" | "Phase 2" | "Phase 3" | "Phase 4",
  ): GateDecision {
    const threshold = this.getThresholdForPhase(phase);

    let result: GateResult;
    let reason: string;
    let canProceed: boolean;

    if (score >= threshold) {
      result = "PASS";
      reason = `Score ${(score * 100).toFixed(1)}% >= threshold ${(
        threshold * 100
      ).toFixed(1)}%`;
      canProceed = true;
    } else if (score >= threshold * 0.9) {
      result = "WARN";
      reason = `Score ${(score * 100).toFixed(1)}% is close to threshold ${(
        threshold * 100
      ).toFixed(1)}%`;
      canProceed = true;
    } else if (score >= threshold * 0.7) {
      result = "PARTIAL";
      reason = `Score ${(score * 100).toFixed(1)}% is below threshold ${(
        threshold * 100
      ).toFixed(1)}%`;
      canProceed = false;
    } else {
      result = "FAIL";
      reason = `Score ${(score * 100).toFixed(
        1,
      )}% is significantly below threshold ${(threshold * 100).toFixed(1)}%`;
      canProceed = false;
    }

    return {
      result,
      phase,
      score,
      threshold,
      reason,
      canProceed,
    };
  }

  /**
   * Get threshold for phase
   */
  private getThresholdForPhase(
    phase: "Phase 1" | "Phase 2" | "Phase 3" | "Phase 4",
  ): number {
    switch (phase) {
      case "Phase 1":
        return this.config.thresholds.guideline_compliance;
      case "Phase 2":
        return this.config.thresholds.retrieval_quality_score ?? 0.7;
      case "Phase 3":
      case "Phase 4":
        return this.config.thresholds.semantic_quality ?? 0.75;
      default:
        return 0.85;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ComplianceConfig {
    return this.config;
  }

  /**
   * Export breakdown for reporting
   */
  exportBreakdown(result: ComplianceCheckResult): {
    question_types: number;
    answer_structure: number;
    number_formats: number;
    prohibitions: number;
  } {
    return {
      question_types: result.questionTypeCompliance.score,
      answer_structure: result.answerStructureCompliance.score,
      number_formats: result.numberFormatCompliance.score,
      prohibitions: result.prohibitionCompliance.score,
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export function createComplianceCalculator(
  projectRoot?: string,
): ComplianceScoreCalculator {
  return new ComplianceScoreCalculator(projectRoot);
}
