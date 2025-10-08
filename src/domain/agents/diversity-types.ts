/**
 * Diversity Planning Types
 *
 * Value Objects and types for diversity planning domain logic.
 * Part of Phase 2B: Ensure 90% entity coverage and ±10% type balance.
 */

/**
 * Diversity Target Configuration
 *
 * Defines quality targets for dataset diversity.
 */
export interface DiversityTarget {
  readonly entityCoverageMin: number; // Minimum entity coverage (0-1), e.g., 0.9
  readonly questionTypeBalanceTolerance: number; // Max deviation from ideal distribution, e.g., 0.1
  readonly evidenceSourceMinCount: number; // Minimum distinct evidence sources
  readonly convergenceThreshold: number; // Convergence detection threshold (0-1), e.g., 0.02
}

/**
 * Default diversity targets (Phase 2B goals)
 */
export const DEFAULT_DIVERSITY_TARGET: DiversityTarget = Object.freeze({
  entityCoverageMin: 0.9,
  questionTypeBalanceTolerance: 0.1,
  evidenceSourceMinCount: 3,
  convergenceThreshold: 0.02, // 2% convergence threshold to prevent oscillation
});

/**
 * Current Dataset Coverage Metrics
 */
export interface CoverageMetrics {
  readonly entityCoverage: number; // 0-1, current coverage ratio
  readonly questionTypeDistribution: Map<string, number>; // Type -> count
  readonly evidenceSourceCounts: Map<string, number>; // Source -> count
  readonly totalSamples: number;
}

/**
 * Diversity Gap Analysis
 *
 * Identifies what's missing from current dataset to meet targets.
 */
export interface DiversityGap {
  readonly entityGap: {
    readonly missing: string[]; // Entity types not covered
    readonly underrepresented: string[]; // Entities below threshold
    readonly coverageRatio: number; // Current / Target
  };
  readonly questionTypeGap: {
    readonly overrepresented: string[]; // Types above ideal + tolerance
    readonly underrepresented: string[]; // Types below ideal - tolerance
    readonly deviationFromIdeal: Map<string, number>; // Type -> deviation
  };
  readonly evidenceSourceGap: {
    readonly missingSourceCount: number; // How many more sources needed
    readonly currentSources: string[];
  };
}

/**
 * Sampling Strategy
 *
 * Recommendations for generating additional samples to fill gaps.
 */
export interface SamplingStrategy {
  readonly priorityEntities: string[]; // Entities to focus on
  readonly targetQuestionTypes: Map<string, number>; // Type -> additional samples needed
  readonly evidenceSourcePreference: string[]; // Preferred sources in order
  readonly estimatedSamplesNeeded: number;
}

/**
 * Diversity Plan
 *
 * Complete plan to achieve diversity targets.
 */
export interface DiversityPlan {
  readonly gap: DiversityGap;
  readonly strategy: SamplingStrategy;
  readonly currentMetrics: CoverageMetrics;
  readonly target: DiversityTarget;
  readonly meetsTarget: boolean;
}

/**
 * Question Type Distribution
 *
 * Ideal distribution of question types (can be overridden).
 */
export const IDEAL_QUESTION_TYPE_DISTRIBUTION: Record<string, number> =
  Object.freeze({
    factual: 0.3, // 30% factual questions
    conceptual: 0.25, // 25% conceptual
    procedural: 0.2, // 20% procedural
    analytical: 0.15, // 15% analytical
    comparative: 0.1, // 10% comparative
  });
