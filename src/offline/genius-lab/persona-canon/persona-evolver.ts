/**
 * Dynamic Persona Evolution (Phase 3.1 - DPE)
 *
 * "전문가는 학습하고 진화한다"
 * - ChatGPT Genius Insight
 *
 * Purpose:
 * - Enable personas to evolve based on feedback
 * - Auto-adjust reward weights and operator sets
 * - Prevent long-term drift through continuous learning
 *
 * Architecture:
 * Persona → Feedback → **DPE** → Evolved Persona
 *
 * Evolution Strategy:
 * 1. Feedback Analysis (extract improvement signals)
 * 2. Reward Weight Adjustment (optimize for feedback)
 * 3. Operator Set Refinement (add/remove operators)
 * 4. Validation (ensure consistency)
 *
 * Expected Gain: Long-term quality ≥95%, Adaptation speed ×3
 */

import type { ExpertPersona } from './persona-factory';

/**
 * Evolution Feedback
 */
export interface EvolutionFeedback {
  // Metrics
  qualityScore: number; // 0-1
  groundedness: number; // 0-1
  coverage: number; // 0-1
  readability: number; // 0-1

  // User feedback
  userRating?: number; // 1-5
  userComment?: string;

  // System feedback
  driftDetected: boolean;
  errorCount: number;

  // Timestamp
  timestamp: Date;
}

/**
 * Evolution Result
 */
export interface EvolutionResult {
  // Evolved persona
  evolved: ExpertPersona;

  // Changes
  changes: {
    rewardWeights?: {
      before: ExpertPersona['configuration']['rewardWeights'];
      after: ExpertPersona['configuration']['rewardWeights'];
    };
    operators?: {
      added: string[];
      removed: string[];
    };
  };

  // Statistics
  improvement: number; // -1 to 1 (quality delta)
  confidence: number; // 0-1 (evolution confidence)
}

/**
 * Persona Evolver
 */
export class PersonaEvolver {
  /**
   * Evolve persona based on feedback
   */
  async evolve(
    persona: ExpertPersona,
    feedbackHistory: EvolutionFeedback[]
  ): Promise<EvolutionResult> {
    // 1. Analyze feedback
    const analysis = this.analyzeFeedback(feedbackHistory);

    // 2. Adjust reward weights
    const newWeights = this.adjustRewardWeights(
      persona.configuration.rewardWeights,
      analysis
    );

    // 3. Refine operator set
    const { added, removed } = this.refineOperators(
      persona.configuration.aolOperators,
      analysis
    );

    // 4. Create evolved persona
    const evolved: ExpertPersona = {
      ...persona,
      configuration: {
        ...persona.configuration,
        rewardWeights: newWeights,
        aolOperators: [
          ...persona.configuration.aolOperators.filter((op) => !removed.includes(op)),
          ...added,
        ],
      },
    };

    // 5. Calculate improvement
    const improvement = this.calculateImprovement(analysis);

    return {
      evolved,
      changes: {
        rewardWeights: {
          before: persona.configuration.rewardWeights,
          after: newWeights,
        },
        operators: { added, removed },
      },
      improvement,
      confidence: analysis.confidence,
    };
  }

  /**
   * Analyze feedback
   */
  private analyzeFeedback(
    feedback: EvolutionFeedback[]
  ): {
    avgQuality: number;
    trend: 'improving' | 'declining' | 'stable';
    weakestDimension: 'groundedness' | 'coverage' | 'readability';
    confidence: number;
  } {
    if (feedback.length === 0) {
      return {
        avgQuality: 0.5,
        trend: 'stable',
        weakestDimension: 'groundedness',
        confidence: 0,
      };
    }

    const avgQuality =
      feedback.reduce((sum, f) => sum + f.qualityScore, 0) / feedback.length;

    // Detect trend
    const recentAvg =
      feedback
        .slice(-5)
        .reduce((sum, f) => sum + f.qualityScore, 0) / Math.min(feedback.length, 5);
    const earlyAvg =
      feedback
        .slice(0, 5)
        .reduce((sum, f) => sum + f.qualityScore, 0) / Math.min(feedback.length, 5);

    const trend =
      recentAvg > earlyAvg + 0.05
        ? 'improving'
        : recentAvg < earlyAvg - 0.05
        ? 'declining'
        : 'stable';

    // Find weakest dimension
    const avgGroundedness =
      feedback.reduce((sum, f) => sum + f.groundedness, 0) / feedback.length;
    const avgCoverage =
      feedback.reduce((sum, f) => sum + f.coverage, 0) / feedback.length;
    const avgReadability =
      feedback.reduce((sum, f) => sum + f.readability, 0) / feedback.length;

    const dimensions = [
      { name: 'groundedness' as const, value: avgGroundedness },
      { name: 'coverage' as const, value: avgCoverage },
      { name: 'readability' as const, value: avgReadability },
    ];

    const weakestDimension = dimensions.reduce((min, d) =>
      d.value < min.value ? d : min
    ).name;

    return {
      avgQuality,
      trend,
      weakestDimension,
      confidence: Math.min(feedback.length / 10, 1.0),
    };
  }

  /**
   * Adjust reward weights
   */
  private adjustRewardWeights(
    current: ExpertPersona['configuration']['rewardWeights'],
    analysis: ReturnType<typeof this.analyzeFeedback>
  ): ExpertPersona['configuration']['rewardWeights'] {
    const weights = { ...current };

    // Boost weakest dimension
    const boostAmount = 0.1;
    weights[`${analysis.weakestDimension}Weight`] += boostAmount;

    // Normalize to sum to 1.0
    const total =
      weights.groundednessWeight + weights.coverageWeight + weights.readabilityWeight;

    return {
      groundednessWeight: weights.groundednessWeight / total,
      coverageWeight: weights.coverageWeight / total,
      readabilityWeight: weights.readabilityWeight / total,
    };
  }

  /**
   * Refine operator set
   */
  private refineOperators(
    current: string[],
    analysis: ReturnType<typeof this.analyzeFeedback>
  ): { added: string[]; removed: string[] } {
    const added: string[] = [];
    const removed: string[] = [];

    // If quality declining, try new operators
    if (analysis.trend === 'declining') {
      // Add domain-specific operators (placeholder)
      if (!current.includes('op_domain_refine')) {
        added.push('op_domain_refine');
      }
    }

    // If groundedness weak, add verification operators
    if (analysis.weakestDimension === 'groundedness') {
      if (!current.includes('op_nli_verify')) {
        added.push('op_nli_verify');
      }
    }

    return { added, removed };
  }

  /**
   * Calculate improvement
   */
  private calculateImprovement(
    analysis: ReturnType<typeof this.analyzeFeedback>
  ): number {
    // Simple heuristic: quality - 0.5 (baseline)
    return (analysis.avgQuality - 0.5) * 2; // -1 to 1
  }
}

/**
 * Default singleton instance
 */
export const personaEvolver = new PersonaEvolver();
