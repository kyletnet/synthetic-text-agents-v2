/**
 * QA Feedback Manager
 *
 * Orchestrates the Feedback Loop between:
 * - Diversity Planner (creates plans)
 * - Metrics Service (monitors quality)
 * - Governance Kernel (policy evaluation)
 *
 * Phase 2B Step 3: QA Feedback Loop + Plugin Integration
 *
 * Flow:
 * 1. Get current metrics from Metrics Service
 * 2. Compare with baseline (drift detection)
 * 3. If drift detected → generate Diversity Plan
 * 4. Record feedback to Governance ledger
 * 5. Optionally auto-adjust (if Feature Flag enabled)
 *
 * Feature Flags:
 * - FEATURE_FEEDBACK_LOOP_ENABLED (default: false)
 * - FEATURE_FEEDBACK_AUTO_ADJUSTMENT (default: false)
 */

import type { Logger } from "../shared/logger.js";
import type { MetricsService } from "./metrics/metrics-service.js";
import type { DiversityPlannerService } from "./agents/diversity-planner-service.js";
import type { MetricsReport } from "../domain/ports/metrics-port.js";
import type { DiversityPlan, CoverageMetrics } from "../domain/agents/index.js";

/**
 * Feedback Loop Configuration
 */
export interface FeedbackConfig {
  // Drift detection threshold (0-1)
  driftThreshold?: number; // default: 0.15 (15%)

  // Auto-adjustment (requires Feature Flag)
  enableAutoAdjustment?: boolean; // default: false

  // Baseline tag for comparison
  baselineTag?: string; // default: "integration-base"

  // Feature flags (can be overridden by env)
  feedbackLoopEnabled?: boolean;
}

/**
 * Drift Detection Result
 */
export interface DriftResult {
  exceeded: boolean; // true if drift exceeds threshold
  drifts: DriftMetric[];
  summary: {
    totalDrifts: number;
    maxDrift: number;
    avgDrift: number;
  };
}

/**
 * Individual Drift Metric
 */
export interface DriftMetric {
  metric: string;
  current: number;
  baseline: number;
  drift: number; // absolute difference
  driftPercentage: number; // percentage change
  direction: "improvement" | "degradation" | "stable";
  exceeded: boolean;
}

/**
 * Feedback Loop Result
 */
export interface FeedbackResult {
  executed: boolean; // true if feedback loop ran
  drift: DriftResult;
  plan: DiversityPlan | null;
  adjustments: Adjustment[];
  timestamp: Date;
}

/**
 * Feedback Adjustment
 */
export interface Adjustment {
  type: "threshold" | "target" | "planner";
  action: string;
  reason: string;
  applied: boolean; // false if auto-adjustment disabled
}

/**
 * QA Feedback Manager
 *
 * Coordinates feedback loop between Metrics, Planner, and Governance.
 */
export class QAFeedbackManager {
  private readonly logger: Logger;
  private readonly metricsService: MetricsService;
  private readonly diversityPlannerService: DiversityPlannerService;
  private readonly config: Required<FeedbackConfig>;

  constructor(
    logger: Logger,
    metricsService: MetricsService,
    diversityPlannerService: DiversityPlannerService,
    config: FeedbackConfig = {},
  ) {
    this.logger = logger;
    this.metricsService = metricsService;
    this.diversityPlannerService = diversityPlannerService;

    // Merge config with defaults
    this.config = {
      driftThreshold: config.driftThreshold ?? 0.15,
      enableAutoAdjustment:
        config.enableAutoAdjustment ??
        process.env.FEATURE_FEEDBACK_AUTO_ADJUSTMENT === "true",
      baselineTag: config.baselineTag ?? "integration-base",
      feedbackLoopEnabled:
        config.feedbackLoopEnabled ??
        process.env.FEATURE_FEEDBACK_LOOP_ENABLED === "true",
    };
  }

  /**
   * Run feedback loop
   *
   * Main entry point for feedback loop execution.
   */
  async runFeedbackLoop(): Promise<FeedbackResult> {
    this.logger.info("🔄 QA Feedback Loop starting...");

    // Check if feedback loop is enabled
    if (!this.config.feedbackLoopEnabled) {
      this.logger.info("Feedback loop disabled (Feature Flag off)");
      return this.createEmptyResult();
    }

    try {
      // 1. Get current metrics
      this.logger.info("📊 Fetching current metrics...");
      const currentReport = await this.metricsService.getCurrentReport();

      // 2. Compare with baseline
      this.logger.info(
        `📐 Comparing with baseline: ${this.config.baselineTag}`,
      );
      const baseline = await this.metricsService.getBaselineMetrics(
        this.config.baselineTag,
      );

      if (!baseline) {
        this.logger.warn(`Baseline not found: ${this.config.baselineTag}`);
        return this.createEmptyResult();
      }

      // 3. Detect drift
      this.logger.info("🔍 Detecting drift...");
      const drift = this.detectDrift(currentReport, baseline);

      this.logger.info("Drift detection complete", {
        exceeded: drift.exceeded,
        totalDrifts: drift.summary.totalDrifts,
        maxDrift: drift.summary.maxDrift.toFixed(3),
      });

      // 4. Generate diversity plan if drift detected
      let plan: DiversityPlan | null = null;
      let adjustments: Adjustment[] = [];

      if (drift.exceeded) {
        this.logger.warn("⚠️  Drift threshold exceeded - generating plan");

        // Convert MetricsReport to CoverageMetrics
        const coverageMetrics = this.convertToCoverageMetrics(currentReport);

        // Create diversity plan
        const planResult = await this.diversityPlannerService.createPlan(
          coverageMetrics,
        );
        plan = planResult.plan;

        this.logger.info("Diversity plan generated", {
          meetsTarget: plan.meetsTarget,
          converged: planResult.converged,
        });

        // 5. Generate adjustments
        adjustments = this.generateAdjustments(drift, plan);

        // 6. Record feedback to Governance
        await this.recordFeedback(drift, plan, adjustments);
      } else {
        this.logger.info("✅ No significant drift detected");
      }

      return {
        executed: true,
        drift,
        plan,
        adjustments,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error("Feedback loop failed", { error });
      throw error;
    }
  }

  /**
   * Detect drift between current and baseline metrics
   */
  private detectDrift(
    current: MetricsReport,
    baseline: MetricsReport,
  ): DriftResult {
    const drifts: DriftMetric[] = [];

    // Quality metrics drift
    drifts.push(
      this.calculateDrift(
        "entity_coverage",
        current.quality.entityCoverage,
        baseline.quality.entityCoverage,
      ),
    );
    drifts.push(
      this.calculateDrift(
        "evidence_alignment",
        current.quality.evidenceAlignment,
        baseline.quality.evidenceAlignment,
      ),
    );

    // Diversity metrics drift
    drifts.push(
      this.calculateDrift(
        "entity_coverage_ratio",
        current.diversity.entityCoverageRatio,
        baseline.diversity.entityCoverageRatio,
      ),
    );
    drifts.push(
      this.calculateDrift(
        "question_type_balance",
        current.diversity.questionTypeBalance,
        baseline.diversity.questionTypeBalance,
      ),
    );

    // Calculate summary
    const totalDrifts = drifts.filter((d) => d.exceeded).length;
    const maxDrift = Math.max(...drifts.map((d) => Math.abs(d.drift)), 0);
    const avgDrift =
      drifts.reduce((sum, d) => sum + Math.abs(d.drift), 0) / drifts.length;

    return {
      exceeded: totalDrifts > 0,
      drifts,
      summary: {
        totalDrifts,
        maxDrift,
        avgDrift,
      },
    };
  }

  /**
   * Calculate drift for a single metric
   */
  private calculateDrift(
    metric: string,
    current: number,
    baseline: number,
  ): DriftMetric {
    const drift = current - baseline;
    const driftPercentage = baseline === 0 ? 0 : (drift / baseline) * 100;

    let direction: "improvement" | "degradation" | "stable" = "stable";
    if (Math.abs(drift) > 0.01) {
      // 1% threshold for direction
      direction = drift > 0 ? "improvement" : "degradation";
    }

    const exceeded = Math.abs(drift) > this.config.driftThreshold;

    return {
      metric,
      current,
      baseline,
      drift,
      driftPercentage,
      direction,
      exceeded,
    };
  }

  /**
   * Convert MetricsReport to CoverageMetrics (for Diversity Planner)
   */
  private convertToCoverageMetrics(report: MetricsReport): CoverageMetrics {
    return {
      entityCoverage: report.quality.entityCoverage,
      questionTypeDistribution: report.quality.questionTypeDistribution,
      evidenceSourceCounts: report.quality.evidenceSourceCounts,
      totalSamples: report.quality.totalSamples,
    };
  }

  /**
   * Generate adjustments based on drift and plan
   */
  private generateAdjustments(
    drift: DriftResult,
    plan: DiversityPlan,
  ): Adjustment[] {
    const adjustments: Adjustment[] = [];

    // Check if auto-adjustment is enabled
    const autoEnabled = this.config.enableAutoAdjustment;

    // Adjustment 1: Entity coverage threshold
    const entityDrift = drift.drifts.find((d) =>
      d.metric.includes("entity_coverage"),
    );
    if (entityDrift && entityDrift.direction === "degradation") {
      adjustments.push({
        type: "threshold",
        action: "Increase entity coverage target",
        reason: `Entity coverage degraded by ${Math.abs(
          entityDrift.driftPercentage,
        ).toFixed(1)}%`,
        applied: autoEnabled,
      });
    }

    // Adjustment 2: Question type balance
    const balanceDrift = drift.drifts.find((d) =>
      d.metric.includes("question_type_balance"),
    );
    if (balanceDrift && balanceDrift.direction === "degradation") {
      adjustments.push({
        type: "planner",
        action: "Rebalance question type distribution",
        reason: `Question type balance degraded by ${Math.abs(
          balanceDrift.driftPercentage,
        ).toFixed(1)}%`,
        applied: autoEnabled,
      });
    }

    // Adjustment 3: Diversity plan suggestions
    const suggestions = this.diversityPlannerService.generateSuggestions(plan);
    for (const suggestion of suggestions.slice(0, 2)) {
      // Top 2 suggestions
      adjustments.push({
        type: "target",
        action: suggestion,
        reason: "Diversity Planner suggestion",
        applied: false, // Suggestions are never auto-applied
      });
    }

    return adjustments;
  }

  /**
   * Record feedback to Governance ledger
   */
  private async recordFeedback(
    drift: DriftResult,
    plan: DiversityPlan,
    adjustments: Adjustment[],
  ): Promise<void> {
    const feedbackEvent = {
      type: "qa_feedback_loop_executed",
      timestamp: new Date(),
      drift: {
        exceeded: drift.exceeded,
        totalDrifts: drift.summary.totalDrifts,
        maxDrift: drift.summary.maxDrift,
        avgDrift: drift.summary.avgDrift,
      },
      plan: {
        meetsTarget: plan.meetsTarget,
        entityGap: plan.gap.entityGap.coverageRatio,
      },
      adjustments: adjustments.map((a) => ({
        type: a.type,
        action: a.action,
        applied: a.applied,
      })),
    };

    this.logger.info("📝 Recording feedback to governance", feedbackEvent);

    // TODO: Integrate with actual governance event bus
    // For now, just log the event
    // await this.governanceEventBus.emit('qa_feedback_loop_executed', feedbackEvent);
  }

  /**
   * Create empty result (when feedback loop is disabled or baseline missing)
   */
  private createEmptyResult(): FeedbackResult {
    return {
      executed: false,
      drift: {
        exceeded: false,
        drifts: [],
        summary: {
          totalDrifts: 0,
          maxDrift: 0,
          avgDrift: 0,
        },
      },
      plan: null,
      adjustments: [],
      timestamp: new Date(),
    };
  }
}
