/**
 * Diversity Planner Application Service
 *
 * Orchestrates diversity planning with:
 * - Performance optimization (p-limit, caching)
 * - Governance integration (event notifications)
 * - Convergence detection (oscillation prevention)
 *
 * This is an Application Service (orchestration + infrastructure integration).
 */

import pLimit from "p-limit";
import type { Logger } from "../../shared/logger.js";
import {
  DiversityPlanner,
  type CoverageMetrics,
  type DiversityPlan,
  type DiversityTarget,
  DEFAULT_DIVERSITY_TARGET,
} from "../../domain/agents/index.js";

/**
 * Cache entry for diversity plans
 */
interface PlanCacheEntry {
  plan: DiversityPlan;
  timestamp: number;
}

/**
 * Governance event for diversity plan updates
 */
interface DiversityPlanEvent {
  type: "diversity_plan_updated";
  timestamp: Date;
  meetsTarget: boolean;
  entityCoverage: number;
  questionTypeBalance: number;
  evidenceSourceCount: number;
  converged: boolean;
}

/**
 * Diversity Planner Service Configuration
 */
export interface DiversityPlannerServiceConfig {
  readonly target?: DiversityTarget;
  readonly cacheTTL?: number; // Cache time-to-live in milliseconds (default: 3 minutes)
  readonly maxConcurrent?: number; // Max concurrent operations (default: 8)
}

/**
 * Diversity Planner Application Service
 *
 * Provides performance-optimized, governance-integrated diversity planning.
 */
export class DiversityPlannerService {
  private readonly planner: DiversityPlanner;
  private readonly logger: Logger;
  private readonly cacheTTL: number;
  private readonly limit: ReturnType<typeof pLimit>;
  private planCache: Map<string, PlanCacheEntry> = new Map();
  private previousPlan: DiversityPlan | null = null;

  constructor(
    logger: Logger,
    config: DiversityPlannerServiceConfig = {},
  ) {
    this.logger = logger;
    this.planner = new DiversityPlanner(
      config.target || DEFAULT_DIVERSITY_TARGET,
    );
    this.cacheTTL = config.cacheTTL || 3 * 60 * 1000; // Default: 3 minutes
    this.limit = pLimit(config.maxConcurrent || 8); // Default: p-limit(8)
  }

  /**
   * Create a diversity plan with performance optimization and governance integration
   */
  async createPlan(
    currentMetrics: CoverageMetrics,
    options: { skipCache?: boolean } = {},
  ): Promise<{
    plan: DiversityPlan;
    converged: boolean;
    cached: boolean;
  }> {
    const cacheKey = this.getCacheKey(currentMetrics);

    // Check cache (unless skipCache is true)
    if (!options.skipCache) {
      const cached = this.getCachedPlan(cacheKey);
      if (cached) {
        this.logger.info("Using cached diversity plan", { cacheKey });
        return {
          plan: cached,
          converged: this.planner.isPlanConverged(cached, this.previousPlan),
          cached: true,
        };
      }
    }

    // Create plan with concurrency limit
    const plan = await this.limit(async () => {
      this.logger.info("Creating diversity plan", {
        entityCoverage: currentMetrics.entityCoverage,
        totalSamples: currentMetrics.totalSamples,
      });

      const result = this.planner.createPlan(currentMetrics);

      // Cache the result
      this.setCachedPlan(cacheKey, result);

      return result;
    });

    // Check convergence
    const converged = this.planner.isPlanConverged(plan, this.previousPlan);

    // Notify governance
    this.notifyGovernance(plan, converged);

    // Update previous plan for next iteration
    this.previousPlan = plan;

    return {
      plan,
      converged,
      cached: false,
    };
  }

  /**
   * Generate suggestions for improving diversity
   */
  generateSuggestions(plan: DiversityPlan): string[] {
    return this.planner.generateSuggestions(plan);
  }

  /**
   * Clear cache (useful for testing or forcing re-calculation)
   */
  clearCache(): void {
    this.planCache.clear();
    this.logger.info("Diversity plan cache cleared");
  }

  /**
   * Notify governance system about diversity plan updates
   *
   * This integrates with the governance ledger (Gate B: Autonomy Loop)
   */
  private notifyGovernance(plan: DiversityPlan, converged: boolean): void {
    const event: DiversityPlanEvent = {
      type: "diversity_plan_updated",
      timestamp: new Date(),
      meetsTarget: plan.meetsTarget,
      entityCoverage: plan.gap.entityGap.coverageRatio,
      questionTypeBalance:
        1.0 -
        Math.max(
          ...Array.from(plan.gap.questionTypeGap.deviationFromIdeal.values()).map(
            Math.abs,
          ),
          0,
        ),
      evidenceSourceCount: plan.gap.evidenceSourceGap.currentSources.length,
      converged,
    };

    this.logger.info("Diversity plan updated", event);

    // TODO: Integrate with governance event bus when available
    // For now, just log the event
    // this.governanceEventBus?.emit('diversity_plan_updated', event);
  }

  /**
   * Get cached plan if available and not expired
   */
  private getCachedPlan(cacheKey: string): DiversityPlan | null {
    const entry = this.planCache.get(cacheKey);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTTL) {
      // Cache expired
      this.planCache.delete(cacheKey);
      return null;
    }

    return entry.plan;
  }

  /**
   * Cache a diversity plan
   */
  private setCachedPlan(cacheKey: string, plan: DiversityPlan): void {
    this.planCache.set(cacheKey, {
      plan,
      timestamp: Date.now(),
    });
  }

  /**
   * Generate cache key from metrics
   */
  private getCacheKey(metrics: CoverageMetrics): string {
    return `${metrics.entityCoverage.toFixed(2)}-${metrics.totalSamples}-${metrics.questionTypeDistribution.size}-${metrics.evidenceSourceCounts.size}`;
  }
}
