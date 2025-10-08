/**
 * Domain: Preflight Gating Rules
 * Defines gate decision logic for pipeline continuation
 */

import { Logger } from "../../shared/logger.js";
import { StageResult } from "./stage-definitions.js";

const logger = new Logger({ level: "info" });

// ============================================================================
// Gating Decision Types
// ============================================================================

export interface GatingDecision {
  canProceed: boolean;
  reason: string;
  gateStatus: "PASS" | "WARN" | "PARTIAL" | "FAIL";
  overallScore: number;
  violations: string[];
  timestamp: string;
}

export interface GatingCriteria {
  minCases: number;
  requireCostGt: number;
  maxWarn: number;
  enforceResult: string[];
}

export interface SessionMetrics {
  totalCases: number;
  successfulCases: number;
  totalCost: number;
  result: string;
  warningCount: number;
  errorCount: number;
  p0Violations: string[];
  p1Warnings: string[];
  p2Issues: string[];
}

// ============================================================================
// Gating Rules Engine
// ============================================================================

export class GatingRules {
  private static readonly DEFAULT_CRITERIA: GatingCriteria = {
    minCases: 5,
    requireCostGt: 0.0,
    maxWarn: 1,
    enforceResult: ["PASS", "PARTIAL"],
  };

  /**
   * Evaluate if pipeline can proceed to full run
   */
  static evaluateGate(
    sessionMetrics: SessionMetrics,
    criteria: Partial<GatingCriteria> = {},
  ): GatingDecision {
    const fullCriteria = { ...this.DEFAULT_CRITERIA, ...criteria };
    const violations: string[] = [];
    const evaluations = [
      this.checkMinimumCases(sessionMetrics, fullCriteria),
      this.checkCostRequirement(sessionMetrics, fullCriteria),
      this.checkWarningLimit(sessionMetrics, fullCriteria),
      this.checkResultRequirement(sessionMetrics, fullCriteria),
      this.checkP0Violations(sessionMetrics),
    ];

    for (const evaluation of evaluations) {
      if (!evaluation.passed) {
        violations.push(evaluation.reason);
      }
    }

    const overallScore = this.calculateOverallScore(
      sessionMetrics,
      violations.length,
    );
    const gateStatus = this.determineGateStatus(sessionMetrics, violations);
    const canProceed = gateStatus !== "FAIL" && violations.length === 0;

    const reason = canProceed
      ? "All gating criteria met"
      : `Failed criteria: ${violations.join("; ")}`;

    return {
      canProceed,
      reason,
      gateStatus,
      overallScore,
      violations,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if minimum case count is met
   */
  private static checkMinimumCases(
    metrics: SessionMetrics,
    criteria: GatingCriteria,
  ): { passed: boolean; reason: string } {
    if (metrics.totalCases < criteria.minCases) {
      return {
        passed: false,
        reason: `Insufficient cases: ${metrics.totalCases} < ${criteria.minCases}`,
      };
    }
    return { passed: true, reason: "Minimum cases met" };
  }

  /**
   * Check if cost requirement is met (verifies real execution)
   */
  private static checkCostRequirement(
    metrics: SessionMetrics,
    criteria: GatingCriteria,
  ): { passed: boolean; reason: string } {
    if (metrics.totalCost <= criteria.requireCostGt) {
      return {
        passed: false,
        reason: `Insufficient cost: $${metrics.totalCost} <= $${criteria.requireCostGt}`,
      };
    }
    return { passed: true, reason: "Cost requirement met" };
  }

  /**
   * Check if warning count is within limits
   */
  private static checkWarningLimit(
    metrics: SessionMetrics,
    criteria: GatingCriteria,
  ): { passed: boolean; reason: string } {
    if (metrics.warningCount > criteria.maxWarn) {
      return {
        passed: false,
        reason: `Too many warnings: ${metrics.warningCount} > ${criteria.maxWarn}`,
      };
    }
    return { passed: true, reason: "Warning limit met" };
  }

  /**
   * Check if result is in allowed results
   */
  private static checkResultRequirement(
    metrics: SessionMetrics,
    criteria: GatingCriteria,
  ): { passed: boolean; reason: string } {
    if (!criteria.enforceResult.includes(metrics.result)) {
      return {
        passed: false,
        reason: `Result '${
          metrics.result
        }' not in [${criteria.enforceResult.join(", ")}]`,
      };
    }
    return { passed: true, reason: "Result requirement met" };
  }

  /**
   * Check for P0 violations (always blocking)
   */
  private static checkP0Violations(metrics: SessionMetrics): {
    passed: boolean;
    reason: string;
  } {
    if (metrics.p0Violations.length > 0) {
      return {
        passed: false,
        reason: `P0 violations: ${metrics.p0Violations.join(", ")}`,
      };
    }
    return { passed: true, reason: "No P0 violations" };
  }

  /**
   * Calculate overall quality score
   */
  private static calculateOverallScore(
    metrics: SessionMetrics,
    violationCount: number,
  ): number {
    let score = 1.0;

    // Penalize for violations
    score -= violationCount * 0.1;

    // Penalize for errors and warnings
    score -= metrics.errorCount * 0.2;
    score -= metrics.warningCount * 0.05;

    // Bonus for clean pass
    if (metrics.result === "PASS" && metrics.warningCount === 0) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Determine gate status
   */
  private static determineGateStatus(
    metrics: SessionMetrics,
    violations: string[],
  ): "PASS" | "WARN" | "PARTIAL" | "FAIL" {
    if (violations.length === 0) {
      return metrics.warningCount === 0 ? "PASS" : "WARN";
    }

    // Check for critical violations
    const hasCriticalViolations = violations.some(
      (v) =>
        v.includes("P0") ||
        v.includes("Insufficient cases") ||
        v.includes("not in allowed results"),
    );

    return hasCriticalViolations ? "FAIL" : "PARTIAL";
  }

  /**
   * Determine if full run should proceed based on gating decision
   */
  static shouldProceedToFullRun(decision: GatingDecision): boolean {
    return decision.canProceed && decision.gateStatus !== "FAIL";
  }

  /**
   * Check if pipeline should continue after stage failure
   */
  static shouldContinuePipeline(stageResult: StageResult): boolean {
    // Blocking stages (TypeScript, Lint, Sanity) must succeed
    if (
      stageResult.stage.includes("[1]") ||
      stageResult.stage.includes("[2]") ||
      stageResult.stage.includes("[3]")
    ) {
      return stageResult.success;
    }

    // Non-blocking stages can fail without stopping pipeline
    return true;
  }

  /**
   * Evaluate stage result for continuation
   */
  static evaluateStageForContinuation(stageResult: StageResult): {
    shouldContinue: boolean;
    reason: string;
  } {
    if (stageResult.success) {
      return {
        shouldContinue: true,
        reason: "Stage succeeded",
      };
    }

    const shouldContinue = this.shouldContinuePipeline(stageResult);

    return {
      shouldContinue,
      reason: shouldContinue
        ? "Non-blocking stage failed, continuing pipeline"
        : `Blocking stage ${stageResult.stage} failed`,
    };
  }
}

// ============================================================================
// Stage-Specific Gate Rules
// ============================================================================

export class StageGateRules {
  /**
   * Check if TypeScript stage allows continuation
   */
  static canProceedAfterTypeScript(result: StageResult): boolean {
    return result.success;
  }

  /**
   * Check if Lint stage allows continuation
   */
  static canProceedAfterLint(result: StageResult): boolean {
    return result.success;
  }

  /**
   * Check if Sanity stage allows continuation
   */
  static canProceedAfterSanity(result: StageResult): boolean {
    return result.success;
  }

  /**
   * Check if Smoke stage allows continuation (non-blocking)
   */
  static canProceedAfterSmoke(result: StageResult): boolean {
    // Smoke can fail but pipeline continues
    return true;
  }

  /**
   * Check if Gating stage allows full run
   */
  static canProceedToFullRun(result: StageResult): boolean {
    const details = result.details as any;
    return details?.canProceed === true;
  }

  /**
   * Check if Observability stage allows continuation
   */
  static canProceedAfterObservability(result: StageResult): boolean {
    // Observability failures don't block full run
    return true;
  }
}

// ============================================================================
// Exports
// ============================================================================

logger.info("Gating rules loaded", {
  defaultCriteria: GatingRules["DEFAULT_CRITERIA"],
});
