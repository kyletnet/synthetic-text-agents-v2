/**
 * Diversity Planner (Domain Service)
 *
 * Ensures QA dataset diversity by analyzing coverage gaps and
 * generating sampling strategies.
 *
 * Phase 2B Goals:
 * - Entity Coverage: ≥90%
 * - Question Type Balance: ±10% from ideal distribution
 * - Evidence Source Diversity: ≥3 distinct sources
 *
 * This is a Domain Service (pure coordination logic, no infrastructure dependencies).
 */

import {
  DEFAULT_DIVERSITY_TARGET,
  IDEAL_QUESTION_TYPE_DISTRIBUTION,
  type DiversityTarget,
  type CoverageMetrics,
  type DiversityGap,
  type SamplingStrategy,
  type DiversityPlan,
} from "./diversity-types.js";

/**
 * Diversity Planner Service
 *
 * Analyzes current dataset and generates diversity improvement plans.
 */
export class DiversityPlanner {
  private readonly target: DiversityTarget;

  constructor(target: DiversityTarget = DEFAULT_DIVERSITY_TARGET) {
    this.target = target;
  }

  /**
   * Create a diversity plan based on current dataset metrics
   */
  createPlan(currentMetrics: CoverageMetrics): DiversityPlan {
    const gap = this.analyzeGaps(currentMetrics);
    const strategy = this.generateStrategy(gap, currentMetrics);
    const meetsTarget = this.checkIfMeetsTarget(gap);

    return Object.freeze({
      gap,
      strategy,
      currentMetrics,
      target: this.target,
      meetsTarget,
    });
  }

  /**
   * Analyze diversity gaps
   */
  private analyzeGaps(metrics: CoverageMetrics): DiversityGap {
    return Object.freeze({
      entityGap: this.analyzeEntityGap(metrics),
      questionTypeGap: this.analyzeQuestionTypeGap(metrics),
      evidenceSourceGap: this.analyzeEvidenceSourceGap(metrics),
    });
  }

  /**
   * Analyze entity coverage gap
   */
  private analyzeEntityGap(
    metrics: CoverageMetrics,
  ): DiversityGap["entityGap"] {
    // Coverage ratio capped at 1.0 (100% achievement)
    const coverageRatio = Math.min(
      1.0,
      metrics.entityCoverage / this.target.entityCoverageMin,
    );

    // For now, we'll use placeholder logic
    // In real implementation, this would analyze entity distribution
    const missing: string[] = [];
    const underrepresented: string[] = [];

    return Object.freeze({
      missing,
      underrepresented,
      coverageRatio,
    });
  }

  /**
   * Analyze question type distribution gap
   */
  private analyzeQuestionTypeGap(
    metrics: CoverageMetrics,
  ): DiversityGap["questionTypeGap"] {
    const overrepresented: string[] = [];
    const underrepresented: string[] = [];
    const deviationFromIdeal = new Map<string, number>();

    const total = metrics.totalSamples;
    if (total === 0) {
      return Object.freeze({
        overrepresented,
        underrepresented,
        deviationFromIdeal,
      });
    }

    // Calculate deviation for each question type
    for (const [qtype, idealRatio] of Object.entries(
      IDEAL_QUESTION_TYPE_DISTRIBUTION,
    )) {
      const currentCount = metrics.questionTypeDistribution.get(qtype) || 0;
      const currentRatio = currentCount / total;
      const deviation = currentRatio - idealRatio;

      deviationFromIdeal.set(qtype, deviation);

      if (deviation > this.target.questionTypeBalanceTolerance) {
        overrepresented.push(qtype);
      } else if (deviation < -this.target.questionTypeBalanceTolerance) {
        underrepresented.push(qtype);
      }
    }

    return Object.freeze({
      overrepresented,
      underrepresented,
      deviationFromIdeal,
    });
  }

  /**
   * Analyze evidence source diversity gap
   */
  private analyzeEvidenceSourceGap(
    metrics: CoverageMetrics,
  ): DiversityGap["evidenceSourceGap"] {
    const currentSources = Array.from(metrics.evidenceSourceCounts.keys());
    const missingSourceCount = Math.max(
      0,
      this.target.evidenceSourceMinCount - currentSources.length,
    );

    return Object.freeze({
      missingSourceCount,
      currentSources,
    });
  }

  /**
   * Generate sampling strategy to fill gaps
   */
  private generateStrategy(
    gap: DiversityGap,
    metrics: CoverageMetrics,
  ): SamplingStrategy {
    // Priority entities: missing > underrepresented
    const priorityEntities = [
      ...gap.entityGap.missing,
      ...gap.entityGap.underrepresented,
    ];

    // Calculate additional samples needed per question type
    const targetQuestionTypes = new Map<string, number>();
    const total = metrics.totalSamples;

    for (const qtype of gap.questionTypeGap.underrepresented) {
      const idealRatio = IDEAL_QUESTION_TYPE_DISTRIBUTION[qtype] || 0;
      const currentCount = metrics.questionTypeDistribution.get(qtype) || 0;
      const targetCount = Math.ceil(total * idealRatio);
      const additionalNeeded = Math.max(0, targetCount - currentCount);
      targetQuestionTypes.set(qtype, additionalNeeded);
    }

    // Estimate total samples needed
    const estimatedSamplesNeeded = Array.from(
      targetQuestionTypes.values(),
    ).reduce((sum, count) => sum + count, 0);

    // Evidence source preference (use existing sources, then expand)
    const evidenceSourcePreference = [
      ...gap.evidenceSourceGap.currentSources,
      "web_search", // Fallback sources
      "knowledge_base",
    ];

    return Object.freeze({
      priorityEntities,
      targetQuestionTypes,
      evidenceSourcePreference,
      estimatedSamplesNeeded,
    });
  }

  /**
   * Check if current metrics meet all targets
   */
  private checkIfMeetsTarget(gap: DiversityGap): boolean {
    const entityOk = gap.entityGap.coverageRatio >= 1.0;
    const questionTypeOk =
      gap.questionTypeGap.overrepresented.length === 0 &&
      gap.questionTypeGap.underrepresented.length === 0;
    const evidenceSourceOk = gap.evidenceSourceGap.missingSourceCount === 0;

    return entityOk && questionTypeOk && evidenceSourceOk;
  }

  /**
   * Check if plan is converged (no significant changes from previous iteration)
   *
   * Prevents oscillation by detecting when metrics are "close enough" to targets.
   */
  isPlanConverged(
    currentPlan: DiversityPlan,
    previousPlan: DiversityPlan | null,
  ): boolean {
    if (!previousPlan) {
      return false; // First iteration, not converged
    }

    // Check if coverage ratio changed significantly
    const coverageChange = Math.abs(
      currentPlan.gap.entityGap.coverageRatio -
        previousPlan.gap.entityGap.coverageRatio,
    );
    if (coverageChange > this.target.convergenceThreshold) {
      return false;
    }

    // Check if question type deviations changed significantly
    const currentDeviations = Array.from(
      currentPlan.gap.questionTypeGap.deviationFromIdeal.values(),
    );
    const previousDeviations = Array.from(
      previousPlan.gap.questionTypeGap.deviationFromIdeal.values(),
    );

    if (currentDeviations.length !== previousDeviations.length) {
      return false;
    }

    for (let i = 0; i < currentDeviations.length; i++) {
      const change = Math.abs(currentDeviations[i] - previousDeviations[i]);
      if (change > this.target.convergenceThreshold) {
        return false;
      }
    }

    // Converged if all changes are within threshold
    return true;
  }

  /**
   * Generate improvement suggestions in human-readable format
   */
  generateSuggestions(plan: DiversityPlan): string[] {
    const suggestions: string[] = [];

    if (plan.meetsTarget) {
      suggestions.push("✅ Dataset meets all diversity targets!");
      return suggestions;
    }

    // Entity coverage suggestions
    if (plan.gap.entityGap.coverageRatio < 1.0) {
      suggestions.push(
        `📊 Entity Coverage: ${(plan.gap.entityGap.coverageRatio * 100).toFixed(
          1,
        )}% of target`,
      );
      if (plan.gap.entityGap.missing.length > 0) {
        suggestions.push(
          `   → Add samples covering: ${plan.gap.entityGap.missing.join(", ")}`,
        );
      }
    }

    // Question type balance suggestions
    if (plan.gap.questionTypeGap.underrepresented.length > 0) {
      suggestions.push(
        `📝 Question Type Balance: ${plan.gap.questionTypeGap.underrepresented.length} types underrepresented`,
      );
      for (const [qtype, count] of plan.strategy.targetQuestionTypes) {
        suggestions.push(`   → Add ${count} more "${qtype}" questions`);
      }
    }

    // Evidence source diversity suggestions
    if (plan.gap.evidenceSourceGap.missingSourceCount > 0) {
      suggestions.push(
        `🔍 Evidence Sources: Need ${plan.gap.evidenceSourceGap.missingSourceCount} more source(s)`,
      );
      suggestions.push(
        `   → Current: ${plan.gap.evidenceSourceGap.currentSources.join(", ")}`,
      );
    }

    // Overall estimate
    if (plan.strategy.estimatedSamplesNeeded > 0) {
      suggestions.push("");
      suggestions.push(
        `📈 Estimated additional samples needed: ${plan.strategy.estimatedSamplesNeeded}`,
      );
    }

    return suggestions;
  }
}
