/**
 * Bandit Policy Scaffold (Performance Tuning)
 *
 * Multi-Armed Bandit for dynamic model/prompt/operator selection.
 * This is a SCAFFOLD for Phase 2.6 - full implementation in Phase 2.8.
 *
 * Current purpose:
 * - Define reward function skeleton
 * - Start collecting observation logs
 * - Prepare for offline learning
 *
 * Architecture Insight:
 * Bandit scaffold is NOT a stub - it's an OBSERVATION
 * INFRASTRUCTURE for data collection and future learning.
 *
 * @see RFC 2025-17, Section 3.1 (Bandit Orchestration)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Action, Context, Reward } from '../types';

/**
 * Bandit policy configuration
 */
export interface BanditPolicyConfig {
  strategy: 'random' | 'epsilon-greedy' | 'ucb' | 'thompson' | 'slate';
  epsilon: number; // For epsilon-greedy (default: 0.1)
  explorationRate: number; // Exploration vs exploitation (default: 0.2)
  logPath: string; // Path to observation logs
  enableLogging: boolean; // Enable observation logging (default: true)
}

const DEFAULT_CONFIG: BanditPolicyConfig = {
  strategy: 'random', // Start with random for data collection
  epsilon: 0.1,
  explorationRate: 0.2,
  logPath: path.join(process.cwd(), 'reports/bandit-observations.jsonl'),
  enableLogging: true,
};

/**
 * Observation record
 */
export interface Observation {
  timestamp: Date;
  context: Context;
  action: Action;
  reward: Reward;
  metadata: {
    latency: number;
    cost: number;
    quality: number;
  };
}

/**
 * Action registry
 */
const ACTION_REGISTRY: Action[] = [
  // Model variations
  { model: 'claude-3-5-sonnet', prompt: 'standard', operators: [] },
  { model: 'claude-3-5-sonnet', prompt: 'concise', operators: ['summarize'] },
  { model: 'claude-3-5-sonnet', prompt: 'detailed', operators: ['expand-context'] },

  // Operator variations
  { model: 'claude-3-5-sonnet', prompt: 'standard', operators: ['paraphrase-with-citation'] },
  { model: 'claude-3-5-sonnet', prompt: 'standard', operators: ['multi-source-citation', 'evidence-lock'] },

  // Temperature variations
  { model: 'claude-3-5-sonnet', prompt: 'standard', operators: [], temperature: 0.3 },
  { model: 'claude-3-5-sonnet', prompt: 'standard', operators: [], temperature: 0.7 },
  { model: 'claude-3-5-sonnet', prompt: 'standard', operators: [], temperature: 1.0 },
];

/**
 * Bandit Policy (Scaffold)
 *
 * Selects actions and logs observations for future learning.
 */
export class BanditPolicy {
  private config: BanditPolicyConfig;
  private observations: Observation[] = [];
  private actionCounts = new Map<string, number>();
  private actionRewards = new Map<string, number[]>();

  constructor(config: Partial<BanditPolicyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize action counts
    for (const action of ACTION_REGISTRY) {
      const key = this.actionToKey(action);
      this.actionCounts.set(key, 0);
      this.actionRewards.set(key, []);
    }
  }

  /**
   * Select action based on context
   *
   * SCAFFOLD: Currently uses random selection for exploration.
   * Phase 2.8 will implement UCB/Thompson Sampling.
   *
   * @param context Decision context
   * @returns Selected action
   */
  selectAction(context: Context): Action {
    switch (this.config.strategy) {
      case 'random':
        return this.selectRandom();

      case 'epsilon-greedy':
        return this.selectEpsilonGreedy();

      case 'ucb':
        // TODO: Implement UCB in Phase 2.8
        return this.selectRandom();

      case 'thompson':
        // TODO: Implement Thompson Sampling in Phase 2.8
        return this.selectRandom();

      case 'slate':
        // TODO: Implement Slate Bandit in Phase 2.8
        return this.selectRandom();

      default:
        return this.selectRandom();
    }
  }

  /**
   * Random action selection (for exploration)
   */
  private selectRandom(): Action {
    const index = Math.floor(Math.random() * ACTION_REGISTRY.length);
    return ACTION_REGISTRY[index];
  }

  /**
   * Epsilon-greedy action selection
   */
  private selectEpsilonGreedy(): Action {
    // Exploration: random action
    if (Math.random() < this.config.epsilon) {
      return this.selectRandom();
    }

    // Exploitation: best action
    return this.selectBest();
  }

  /**
   * Select best action (highest average reward)
   */
  private selectBest(): Action {
    let bestAction: Action = ACTION_REGISTRY[0];
    let bestReward = -Infinity;

    for (const action of ACTION_REGISTRY) {
      const key = this.actionToKey(action);
      const rewards = this.actionRewards.get(key) || [];

      if (rewards.length === 0) {
        // No observations yet - encourage exploration
        continue;
      }

      const avgReward = rewards.reduce((sum, r) => sum + r, 0) / rewards.length;

      if (avgReward > bestReward) {
        bestReward = avgReward;
        bestAction = action;
      }
    }

    return bestAction;
  }

  /**
   * Update reward for action
   *
   * Logs observation and updates internal statistics.
   *
   * @param action Selected action
   * @param reward Observed reward
   * @param context Decision context
   */
  async updateReward(action: Action, reward: Reward, context: Context): Promise<void> {
    const key = this.actionToKey(action);

    // Update counts
    const count = this.actionCounts.get(key) || 0;
    this.actionCounts.set(key, count + 1);

    // Compute composite reward
    const compositeReward = this.computeCompositeReward(reward);

    // Update rewards
    const rewards = this.actionRewards.get(key) || [];
    rewards.push(compositeReward);
    this.actionRewards.set(key, rewards);

    // Log observation
    if (this.config.enableLogging) {
      const observation: Observation = {
        timestamp: new Date(),
        context,
        action,
        reward,
        metadata: {
          latency: 0, // TODO: Add actual latency tracking
          cost: this.estimateCost(action),
          quality: compositeReward,
        },
      };

      this.observations.push(observation);
      await this.logObservation(observation);
    }
  }

  /**
   * Compute composite reward
   *
   * Formula: weighted sum of quality dimensions
   */
  private computeCompositeReward(reward: Reward): number {
    const weights = {
      naturalness: 0.25,
      groundedness: 0.30,
      originality: 0.15,
      compliance: 0.20,
      toneConsistency: 0.10,
    };

    return (
      reward.naturalness * weights.naturalness +
      reward.groundedness * weights.groundedness +
      reward.originality * weights.originality +
      reward.compliance * weights.compliance +
      reward.toneConsistency * weights.toneConsistency
    );
  }

  /**
   * Estimate cost for action
   */
  private estimateCost(action: Action): number {
    // Simple cost estimation (tokens × price)
    // TODO: Add actual cost tracking
    return 0.01; // Placeholder
  }

  /**
   * Log observation to file
   */
  private async logObservation(observation: Observation): Promise<void> {
    try {
      const logDir = path.dirname(this.config.logPath);

      // Create directory if not exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append observation as JSONL
      const line = JSON.stringify(observation) + '\n';
      fs.appendFileSync(this.config.logPath, line);
    } catch (error) {
      console.error('Failed to log observation:', error);
    }
  }

  /**
   * Convert action to unique key
   */
  private actionToKey(action: Action): string {
    const ops = action.operators?.join(',') || '';
    const temp = action.temperature ?? 0.5;
    return `${action.model}|${action.prompt}|${ops}|${temp}`;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalObservations: number;
    actionCounts: Map<string, number>;
    actionRewards: Map<string, number[]>;
    bestAction: Action | null;
    bestReward: number;
  } {
    const best = this.selectBest();
    const bestKey = this.actionToKey(best);
    const bestRewards = this.actionRewards.get(bestKey) || [];
    const bestReward = bestRewards.length > 0
      ? bestRewards.reduce((sum, r) => sum + r, 0) / bestRewards.length
      : 0;

    return {
      totalObservations: this.observations.length,
      actionCounts: this.actionCounts,
      actionRewards: this.actionRewards,
      bestAction: bestRewards.length > 0 ? best : null,
      bestReward,
    };
  }

  /**
   * Export observations for offline learning
   */
  exportObservations(): Observation[] {
    return this.observations;
  }

  /**
   * Clear observations (for testing)
   */
  clearObservations(): void {
    this.observations = [];
    this.actionCounts.clear();
    this.actionRewards.clear();

    // Re-initialize
    for (const action of ACTION_REGISTRY) {
      const key = this.actionToKey(action);
      this.actionCounts.set(key, 0);
      this.actionRewards.set(key, []);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): BanditPolicyConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BanditPolicyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get action registry
   */
  getActionRegistry(): Action[] {
    return ACTION_REGISTRY;
  }
}

/**
 * Default singleton instance
 */
export const banditPolicy = new BanditPolicy();
