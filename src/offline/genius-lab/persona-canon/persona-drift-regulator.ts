/**
 * Persona Drift Regulator (Phase 3.3 - Evolution Stabilization)
 *
 * "진화는 필요하지만, 표류는 막아야 한다"
 * - ChatGPT Genius Insight
 *
 * Purpose:
 * - Prevent persona drift and overfitting
 * - Stabilize evolution process
 * - Maintain long-term quality
 *
 * Architecture:
 * Persona Evolution → **Drift Regulator** → Stabilized Persona
 *
 * Regulation Strategy:
 * 1. Drift Detection (품질 저하 감지)
 * 2. Regularization (과적합 방지)
 * 3. Constraint Enforcement (한계 설정)
 * 4. Auto-correction (자동 보정)
 *
 * Expected Gain: Persona drift <1%, Long-term stability ≥98%
 *
 * @see ChatGPT Master Directive: "Evolve with Control"
 */

import type { ExpertPersona } from './persona-factory';
import type { EvolutionResult } from './persona-evolver';

/**
 * Drift Detection Result
 */
export interface DriftDetectionResult {
  // Detection
  driftDetected: boolean;
  driftScore: number; // 0-1 (0 = no drift, 1 = severe drift)
  driftType: DriftType[];

  // Analysis
  qualityTrend: 'improving' | 'declining' | 'stable';
  overfittingRisk: number; // 0-1

  // Diagnostics
  issues: DriftIssue[];
  recommendations: string[];
}

/**
 * Drift Types
 */
export type DriftType =
  | 'quality-decline' // Overall quality declining
  | 'reward-imbalance' // Reward weights too skewed
  | 'operator-bloat' // Too many operators
  | 'overfitting' // Overfitted to recent feedback
  | 'concept-drift' // Domain understanding changed
  | 'performance-degradation'; // Performance decline

/**
 * Drift Issue
 */
export interface DriftIssue {
  type: DriftType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  metric?: string;
  value?: number;
  threshold?: number;
}

/**
 * Regulation Action
 */
export interface RegulationAction {
  type: ActionType;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Action Types
 */
export type ActionType =
  | 'reset-weights' // Reset reward weights to baseline
  | 'prune-operators' // Remove low-value operators
  | 'rollback' // Rollback to previous version
  | 're-validate' // Force re-validation
  | 'freeze' // Freeze evolution temporarily
  | 'rebalance'; // Rebalance weights

/**
 * Drift Regulator Config
 */
export interface DriftRegulatorConfig {
  // Detection thresholds
  maxDriftScore: number; // Default: 0.15 (15% drift)
  maxQualityDecline: number; // Default: 0.1 (10% decline)
  maxRewardImbalance: number; // Default: 0.3 (30% imbalance)

  // Constraints
  maxOperators: number; // Default: 20
  minOperators: number; // Default: 3
  maxRewardWeight: number; // Default: 0.7 (70%)
  minRewardWeight: number; // Default: 0.1 (10%)

  // Actions
  enableAutoCorrection: boolean; // Default: true
  autoRollbackOnCritical: boolean; // Default: true
}

/**
 * Persona Drift Regulator
 *
 * Regulates persona evolution to prevent drift
 */
export class PersonaDriftRegulator {
  private config: DriftRegulatorConfig;
  private personaHistory: Map<string, ExpertPersona[]> = new Map();

  constructor(config?: Partial<DriftRegulatorConfig>) {
    this.config = {
      maxDriftScore: config?.maxDriftScore ?? 0.15,
      maxQualityDecline: config?.maxQualityDecline ?? 0.1,
      maxRewardImbalance: config?.maxRewardImbalance ?? 0.3,
      maxOperators: config?.maxOperators ?? 20,
      minOperators: config?.minOperators ?? 3,
      maxRewardWeight: config?.maxRewardWeight ?? 0.7,
      minRewardWeight: config?.minRewardWeight ?? 0.1,
      enableAutoCorrection: config?.enableAutoCorrection ?? true,
      autoRollbackOnCritical: config?.autoRollbackOnCritical ?? true,
    };
  }

  /**
   * Detect drift
   */
  detectDrift(
    persona: ExpertPersona,
    evolution: EvolutionResult
  ): DriftDetectionResult {
    const issues: DriftIssue[] = [];
    const driftTypes: DriftType[] = [];

    // 1. Check quality trend
    if (evolution.improvement < -this.config.maxQualityDecline) {
      issues.push({
        type: 'quality-decline',
        severity: 'high',
        description: `Quality declined by ${Math.abs(evolution.improvement * 100).toFixed(1)}%`,
        metric: 'improvement',
        value: evolution.improvement,
        threshold: -this.config.maxQualityDecline,
      });
      driftTypes.push('quality-decline');
    }

    // 2. Check reward weight imbalance
    const rewardImbalance = this.checkRewardImbalance(
      persona.configuration.rewardWeights
    );

    if (rewardImbalance > this.config.maxRewardImbalance) {
      issues.push({
        type: 'reward-imbalance',
        severity: 'medium',
        description: `Reward weights imbalanced (${(rewardImbalance * 100).toFixed(1)}%)`,
        metric: 'rewardImbalance',
        value: rewardImbalance,
        threshold: this.config.maxRewardImbalance,
      });
      driftTypes.push('reward-imbalance');
    }

    // 3. Check operator bloat
    const operatorCount = persona.configuration.aolOperators.length;

    if (operatorCount > this.config.maxOperators) {
      issues.push({
        type: 'operator-bloat',
        severity: 'medium',
        description: `Too many operators (${operatorCount})`,
        metric: 'operatorCount',
        value: operatorCount,
        threshold: this.config.maxOperators,
      });
      driftTypes.push('operator-bloat');
    }

    // 4. Check overfitting risk
    const overfittingRisk = this.assessOverfittingRisk(persona, evolution);

    if (overfittingRisk > 0.7) {
      issues.push({
        type: 'overfitting',
        severity: overfittingRisk > 0.9 ? 'critical' : 'high',
        description: `High overfitting risk (${(overfittingRisk * 100).toFixed(1)}%)`,
        metric: 'overfittingRisk',
        value: overfittingRisk,
        threshold: 0.7,
      });
      driftTypes.push('overfitting');
    }

    // Calculate drift score
    const driftScore = this.calculateDriftScore(issues);

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues);

    return {
      driftDetected: driftScore > this.config.maxDriftScore,
      driftScore,
      driftType: driftTypes,
      qualityTrend: this.inferQualityTrend(evolution.improvement),
      overfittingRisk,
      issues,
      recommendations,
    };
  }

  /**
   * Regulate evolution
   */
  async regulate(
    persona: ExpertPersona,
    evolution: EvolutionResult,
    driftResult: DriftDetectionResult
  ): Promise<{
    regulated: ExpertPersona;
    actions: RegulationAction[];
  }> {
    const actions: RegulationAction[] = [];
    let regulated = evolution.evolved;

    if (!this.config.enableAutoCorrection) {
      return { regulated, actions };
    }

    // Check if critical drift
    const hasCriticalIssues = driftResult.issues.some(
      (issue) => issue.severity === 'critical'
    );

    if (hasCriticalIssues && this.config.autoRollbackOnCritical) {
      // Rollback to previous version
      const previous = this.getPreviousVersion(persona.id);
      if (previous) {
        regulated = previous;
        actions.push({
          type: 'rollback',
          description: 'Critical drift detected - rolled back to previous version',
          parameters: {},
        });
        return { regulated, actions };
      }
    }

    // Apply corrections based on issues
    driftResult.issues.forEach((issue) => {
      switch (issue.type) {
        case 'reward-imbalance':
          regulated = this.rebalanceRewardWeights(regulated);
          actions.push({
            type: 'rebalance',
            description: 'Rebalanced reward weights',
            parameters: { weights: regulated.configuration.rewardWeights },
          });
          break;

        case 'operator-bloat':
          regulated = this.pruneOperators(regulated);
          actions.push({
            type: 'prune-operators',
            description: 'Pruned excess operators',
            parameters: { count: regulated.configuration.aolOperators.length },
          });
          break;

        case 'overfitting':
          regulated = this.applyRegularization(regulated);
          actions.push({
            type: 'rebalance',
            description: 'Applied regularization to prevent overfitting',
            parameters: {},
          });
          break;
      }
    });

    return { regulated, actions };
  }

  /**
   * Save persona version
   */
  saveVersion(persona: ExpertPersona): void {
    if (!this.personaHistory.has(persona.id)) {
      this.personaHistory.set(persona.id, []);
    }

    this.personaHistory.get(persona.id)!.push(persona);

    // Keep only last 10 versions
    const history = this.personaHistory.get(persona.id)!;
    if (history.length > 10) {
      this.personaHistory.set(persona.id, history.slice(-10));
    }
  }

  /**
   * Get previous version
   */
  private getPreviousVersion(personaId: string): ExpertPersona | null {
    const history = this.personaHistory.get(personaId);
    if (!history || history.length < 2) return null;

    return history[history.length - 2];
  }

  // ========== Helper Methods ==========

  /**
   * Check reward weight imbalance
   */
  private checkRewardImbalance(weights: Record<string, number>): number {
    const values = Object.values(weights);
    const max = Math.max(...values);
    const min = Math.min(...values);

    // Imbalance = (max - min) / max
    return max > 0 ? (max - min) / max : 0;
  }

  /**
   * Assess overfitting risk
   */
  private assessOverfittingRisk(
    _persona: ExpertPersona,
    evolution: EvolutionResult
  ): number {
    // High confidence with low improvement → overfitting
    if (evolution.confidence > 0.8 && evolution.improvement < 0.1) {
      return 0.8;
    }

    // Extreme reward weight changes → overfitting
    if (evolution.changes.rewardWeights) {
      const weightChanges = Object.entries(
        evolution.changes.rewardWeights.after
      ).map(([key, after]) => {
        const before = evolution.changes.rewardWeights!.before[key] || 0;
        return Math.abs(after - before);
      });

      const maxChange = Math.max(...weightChanges);
      if (maxChange > 0.3) {
        return 0.7;
      }
    }

    return 0.3; // Low risk by default
  }

  /**
   * Calculate drift score
   */
  private calculateDriftScore(issues: DriftIssue[]): number {
    if (issues.length === 0) return 0;

    const severityWeights = {
      critical: 1.0,
      high: 0.7,
      medium: 0.4,
      low: 0.2,
    };

    const totalScore = issues.reduce(
      (sum, issue) => sum + severityWeights[issue.severity],
      0
    );

    return Math.min(totalScore / issues.length, 1.0);
  }

  /**
   * Infer quality trend
   */
  private inferQualityTrend(
    improvement: number
  ): 'improving' | 'declining' | 'stable' {
    if (improvement > 0.05) return 'improving';
    if (improvement < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(issues: DriftIssue[]): string[] {
    const recommendations: string[] = [];

    issues.forEach((issue) => {
      switch (issue.type) {
        case 'quality-decline':
          recommendations.push(
            'Consider rolling back to previous version or collecting more diverse feedback'
          );
          break;
        case 'reward-imbalance':
          recommendations.push(
            'Rebalance reward weights to ensure all quality dimensions are valued'
          );
          break;
        case 'operator-bloat':
          recommendations.push('Remove low-impact operators to reduce complexity');
          break;
        case 'overfitting':
          recommendations.push(
            'Apply regularization or increase diversity in training data'
          );
          break;
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Rebalance reward weights
   */
  private rebalanceRewardWeights(persona: ExpertPersona): ExpertPersona {
    // Reset to balanced weights
    const balanced = {
      groundednessWeight: 0.4,
      coverageWeight: 0.35,
      readabilityWeight: 0.25,
    };

    return {
      ...persona,
      configuration: {
        ...persona.configuration,
        rewardWeights: balanced,
      },
    };
  }

  /**
   * Prune operators
   */
  private pruneOperators(persona: ExpertPersona): ExpertPersona {
    // Keep only first maxOperators
    const pruned = persona.configuration.aolOperators.slice(
      0,
      this.config.maxOperators
    );

    return {
      ...persona,
      configuration: {
        ...persona.configuration,
        aolOperators: pruned,
      },
    };
  }

  /**
   * Apply regularization
   */
  private applyRegularization(persona: ExpertPersona): ExpertPersona {
    // Smooth reward weights toward baseline
    const current = persona.configuration.rewardWeights;
    const baseline = {
      groundednessWeight: 0.4,
      coverageWeight: 0.35,
      readabilityWeight: 0.25,
    };

    const alpha = 0.3; // Regularization strength

    const regularized = {
      groundednessWeight:
        (1 - alpha) * current.groundednessWeight + alpha * baseline.groundednessWeight,
      coverageWeight:
        (1 - alpha) * current.coverageWeight + alpha * baseline.coverageWeight,
      readabilityWeight:
        (1 - alpha) * current.readabilityWeight + alpha * baseline.readabilityWeight,
    };

    return {
      ...persona,
      configuration: {
        ...persona.configuration,
        rewardWeights: regularized,
      },
    };
  }

  /**
   * Get configuration
   */
  getConfig(): DriftRegulatorConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  getStats(): {
    trackedPersonas: number;
    totalVersions: number;
    avgVersionsPerPersona: number;
  } {
    const trackedPersonas = this.personaHistory.size;
    const totalVersions = Array.from(this.personaHistory.values()).reduce(
      (sum, history) => sum + history.length,
      0
    );

    return {
      trackedPersonas,
      totalVersions,
      avgVersionsPerPersona:
        trackedPersonas > 0 ? totalVersions / trackedPersonas : 0,
    };
  }
}

/**
 * Default singleton instance
 */
export const personaDriftRegulator = new PersonaDriftRegulator();
