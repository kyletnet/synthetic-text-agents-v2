import {
  createThresholdManager,
  GatingResult,
} from "../metrics/threshold_manager.js";
import { createBudgetGuardian } from "./budget_guardian.js";
import { getAgentLogger } from "./agent_logger.js";

/**
 * Gating Integrator
 * Connects threshold gates to session result determination
 * Ensures P0/P1/P2 violations map correctly to RESULT status
 */

export interface GatingContext {
  run_id: string;
  session_id: string;
  profile: string;
  dry_run: boolean;
  mode: "smoke" | "full";
  cases_total: number;
}

export interface GatedMetrics {
  // Raw metrics from baseline report
  duplication_rate: number;
  evidence_presence_rate: number;
  evidence_missing_rate: number;
  hallucination_rate: number;
  pii_hits: number;
  license_violations: number;
  cost_per_item: number;
  latency_p95_ms: number;
  failure_rate: number;
  coverage_rate: number;
  quality_score: number;

  // Aggregated totals
  total_cost_usd: number;
  total_items: number;
  total_time_ms: number;
}

export interface SessionResult {
  result: "PASS" | "WARN" | "PARTIAL" | "FAIL";
  run_state: "completed" | "failed" | "killed" | "budget_exceeded";
  can_proceed: boolean;

  // Gating summary
  gating_summary: {
    gate_status: string;
    p0_violations: string[];
    p1_warnings: string[];
    p2_issues: string[];
    threshold_source: string;
    profile_used: string;
    autocalibration_enabled: boolean;
  };

  // Decision rationale
  decision_rationale: string;
  blocking_issues: string[];
  recommendations: string[];

  // Compliance
  cases_total_valid: boolean;
  threshold_compliance: boolean;
  manifest_integrity: boolean;
  budget_compliance: boolean;
}

export class GatingIntegrator {
  private thresholdManager = createThresholdManager();
  private budgetGuardian = createBudgetGuardian();
  private logger = getAgentLogger();

  /**
   * Evaluate session result based on metrics and context
   */
  evaluateSessionResult(
    context: GatingContext,
    metrics: GatedMetrics,
    manifestHash?: string,
    budgetState?: any,
  ): SessionResult {
    console.log(`🚪 Evaluating session result for ${context.run_id}...`);

    // Validate required conditions
    const validations = this.validateRequiredConditions(
      context,
      metrics,
      manifestHash,
      budgetState,
    );

    // If critical validations fail, return immediate FAIL
    if (!validations.cases_total_valid || !validations.budget_compliance) {
      return this.createFailResult(
        context,
        validations,
        "Critical validation failure",
      );
    }

    // Run threshold gating
    const gatingResult = this.thresholdManager.evaluateGating(
      metrics,
      context.profile,
    );

    // Apply gating logic
    const sessionResult = this.mapGatingToSessionResult(
      context,
      gatingResult,
      validations,
    );

    // Log gating decision
    this.logGatingDecision(context, sessionResult, gatingResult);

    return sessionResult;
  }

  /**
   * Validate required conditions before gating
   */
  private validateRequiredConditions(
    context: GatingContext,
    metrics: GatedMetrics,
    manifestHash?: string,
    budgetState?: any,
  ): {
    cases_total_valid: boolean;
    threshold_compliance: boolean;
    manifest_integrity: boolean;
    budget_compliance: boolean;
    validation_errors: string[];
  } {
    const errors: string[] = [];

    // 1. Cases total validation
    const casesTotalValid = context.cases_total > 0;
    if (!casesTotalValid) {
      errors.push(`CASES_TOTAL must be > 0, got ${context.cases_total}`);
    }

    // 2. Budget compliance
    let budgetCompliant = true;
    if (budgetState) {
      budgetCompliant =
        budgetState.status !== "budget_exceeded" &&
        budgetState.status !== "killed";
      if (!budgetCompliant) {
        errors.push(`Budget status: ${budgetState.status}`);
      }
    }

    // 3. Manifest integrity (if provided)
    const manifestIntegrityOk = manifestHash ? true : true; // TODO: implement actual validation

    // 4. Threshold compliance (basic sanity checks)
    const thresholdCompliance = this.validateThresholdSanity(metrics);
    if (!thresholdCompliance.valid) {
      errors.push(...thresholdCompliance.errors);
    }

    return {
      cases_total_valid: casesTotalValid,
      threshold_compliance: thresholdCompliance.valid,
      manifest_integrity: manifestIntegrityOk,
      budget_compliance: budgetCompliant,
      validation_errors: errors,
    };
  }

  /**
   * Validate threshold sanity (detect obviously invalid metrics)
   */
  private validateThresholdSanity(metrics: GatedMetrics): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for impossible values
    if (metrics.duplication_rate < 0 || metrics.duplication_rate > 1) {
      errors.push(`Invalid duplication_rate: ${metrics.duplication_rate}`);
    }

    if (
      metrics.evidence_presence_rate < 0 ||
      metrics.evidence_presence_rate > 1
    ) {
      errors.push(
        `Invalid evidence_presence_rate: ${metrics.evidence_presence_rate}`,
      );
    }

    if (metrics.hallucination_rate < 0 || metrics.hallucination_rate > 1) {
      errors.push(`Invalid hallucination_rate: ${metrics.hallucination_rate}`);
    }

    if (metrics.cost_per_item < 0) {
      errors.push(`Invalid cost_per_item: ${metrics.cost_per_item}`);
    }

    if (metrics.latency_p95_ms < 0) {
      errors.push(`Invalid latency_p95_ms: ${metrics.latency_p95_ms}`);
    }

    if (metrics.pii_hits < 0) {
      errors.push(`Invalid pii_hits: ${metrics.pii_hits}`);
    }

    if (metrics.license_violations < 0) {
      errors.push(`Invalid license_violations: ${metrics.license_violations}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Map gating result to session result
   */
  private mapGatingToSessionResult(
    context: GatingContext,
    gatingResult: GatingResult,
    validations: any,
  ): SessionResult {
    // Determine run state
    let runState: "completed" | "failed" | "killed" | "budget_exceeded" =
      "completed";

    if (!validations.budget_compliance) {
      runState = "budget_exceeded";
    } else if (gatingResult.p0_violations.length > 0) {
      runState = "failed";
    }

    // Map gate status to result
    let result: "PASS" | "WARN" | "PARTIAL" | "FAIL";
    let decisionRationale: string;
    const blockingIssues: string[] = [];

    switch (gatingResult.gate_status) {
      case "PASS":
        result = "PASS";
        decisionRationale = "All metrics within acceptable thresholds";
        break;

      case "WARN":
        result = "WARN";
        decisionRationale =
          "Quality issues detected but within operational limits";
        break;

      case "PARTIAL":
        result = "PARTIAL";
        decisionRationale =
          "Performance issues require monitoring but can proceed";
        break;

      case "FAIL":
        result = "FAIL";
        decisionRationale = "Critical violations detected - cannot proceed";
        blockingIssues.push(...gatingResult.p0_violations);
        break;

      default:
        result = "FAIL";
        decisionRationale =
          "Unknown gate status - defaulting to FAIL for safety";
        blockingIssues.push(`Unknown gate status: ${gatingResult.gate_status}`);
    }

    // Override result based on validations
    if (!validations.cases_total_valid) {
      result = "FAIL";
      decisionRationale = "CASES_TOTAL validation failed";
      blockingIssues.push(...validations.validation_errors);
    }

    // For smoke runs, be more lenient with P2 issues
    if (context.mode === "smoke" && result === "WARN") {
      result = "PASS";
      decisionRationale += " (smoke mode - P2 issues acceptable)";
    }

    // Get threshold configuration info
    const thresholdSource = this.getThresholdSource();
    const autocalibConfig = this.thresholdManager.getAutoCalibrationConfig();

    return {
      result,
      run_state: runState,
      can_proceed: gatingResult.can_proceed && validations.cases_total_valid,

      gating_summary: {
        gate_status: gatingResult.gate_status,
        p0_violations: gatingResult.p0_violations,
        p1_warnings: gatingResult.p1_warnings,
        p2_issues: gatingResult.p2_issues,
        threshold_source: thresholdSource,
        profile_used: context.profile,
        autocalibration_enabled: autocalibConfig.enabled,
      },

      decision_rationale: decisionRationale,
      blocking_issues: blockingIssues,
      recommendations: gatingResult.recommendation
        ? [gatingResult.recommendation]
        : [],

      cases_total_valid: validations.cases_total_valid,
      threshold_compliance: validations.threshold_compliance,
      manifest_integrity: validations.manifest_integrity,
      budget_compliance: validations.budget_compliance,
    };
  }

  /**
   * Create immediate FAIL result for critical violations
   */
  private createFailResult(
    context: GatingContext,
    validations: any,
    reason: string,
  ): SessionResult {
    return {
      result: "FAIL",
      run_state: "failed",
      can_proceed: false,

      gating_summary: {
        gate_status: "FAIL",
        p0_violations: validations.validation_errors,
        p1_warnings: [],
        p2_issues: [],
        threshold_source: "validation_failure",
        profile_used: context.profile,
        autocalibration_enabled: false,
      },

      decision_rationale: reason,
      blocking_issues: validations.validation_errors,
      recommendations: ["Fix critical validation errors before retrying"],

      cases_total_valid: validations.cases_total_valid,
      threshold_compliance: validations.threshold_compliance,
      manifest_integrity: validations.manifest_integrity,
      budget_compliance: validations.budget_compliance,
    };
  }

  /**
   * Get threshold source description
   */
  private getThresholdSource(): string {
    const autocalibConfig = this.thresholdManager.getAutoCalibrationConfig();

    if (autocalibConfig.enabled) {
      return `autocalibrated (lookback: ${autocalibConfig.lookback_runs} runs)`;
    } else {
      return "defaults from baseline_config.json";
    }
  }

  /**
   * Log gating decision for audit trail
   */
  private logGatingDecision(
    context: GatingContext,
    sessionResult: SessionResult,
    gatingResult: GatingResult,
  ): void {
    const traceContext = this.logger.createTraceContext(
      context.run_id,
      "session",
      context.session_id,
    );

    this.logger.logOperationComplete(
      traceContext,
      "gating_integrator",
      "gating",
      "session_evaluation",
      Date.now() - 1000, // Approximate start time
      {
        cost_usd: 0,
        output_data: {
          session_result: sessionResult.result,
          run_state: sessionResult.run_state,
          gate_status: gatingResult.gate_status,
          p0_violations_count: gatingResult.p0_violations.length,
          p1_warnings_count: gatingResult.p1_warnings.length,
          p2_issues_count: gatingResult.p2_issues.length,
          can_proceed: sessionResult.can_proceed,
          decision_rationale: sessionResult.decision_rationale,
        },
        quality_score: this.calculateGatingQualityScore(sessionResult),
        confidence_score: this.calculateGatingConfidence(sessionResult),
      },
    );

    console.log(
      `🚪 Gating result: ${sessionResult.result} (${sessionResult.run_state})`,
    );
    console.log(`   P0 violations: ${gatingResult.p0_violations.length}`);
    console.log(`   P1 warnings: ${gatingResult.p1_warnings.length}`);
    console.log(`   P2 issues: ${gatingResult.p2_issues.length}`);
    console.log(`   Can proceed: ${sessionResult.can_proceed}`);
  }

  /**
   * Calculate quality score for gating decision
   */
  private calculateGatingQualityScore(sessionResult: SessionResult): number {
    const weights = {
      PASS: 1.0,
      WARN: 0.8,
      PARTIAL: 0.6,
      FAIL: 0.0,
    };

    return weights[sessionResult.result] || 0.0;
  }

  /**
   * Calculate confidence score for gating decision
   */
  private calculateGatingConfidence(sessionResult: SessionResult): number {
    let confidence = 1.0;

    // Reduce confidence if validations failed
    if (!sessionResult.threshold_compliance) confidence -= 0.3;
    if (!sessionResult.manifest_integrity) confidence -= 0.2;
    if (!sessionResult.budget_compliance) confidence -= 0.2;

    // Reduce confidence for edge cases
    if (sessionResult.result === "PARTIAL") confidence -= 0.1;

    return Math.max(0, confidence);
  }

  /**
   * Generate session report integration data
   */
  generateSessionReportData(
    context: GatingContext,
    sessionResult: SessionResult,
    metrics: GatedMetrics,
    manifestHash?: string,
  ): any {
    return {
      // Summary block fields
      RESULT: sessionResult.result,
      RUN_STATE: sessionResult.run_state,
      CASES_TOTAL: context.cases_total,
      CAN_PROCEED: sessionResult.can_proceed,

      // Gating details
      GATE_STATUS: sessionResult.gating_summary.gate_status,
      P0_VIOLATIONS: sessionResult.gating_summary.p0_violations.length,
      P1_WARNINGS: sessionResult.gating_summary.p1_warnings.length,
      P2_ISSUES: sessionResult.gating_summary.p2_issues.length,

      // Threshold information
      THRESHOLD_SOURCE: sessionResult.gating_summary.threshold_source,
      PROFILE_USED: sessionResult.gating_summary.profile_used,
      AUTOCALIBRATION_ENABLED:
        sessionResult.gating_summary.autocalibration_enabled,

      // Manifest information
      MANIFEST_HASH: manifestHash || "not_provided",
      MANIFEST_INTEGRITY: sessionResult.manifest_integrity,

      // Budget information
      BUDGET_COMPLIANCE: sessionResult.budget_compliance,
      TOTAL_COST_USD: metrics.total_cost_usd,

      // Decision metadata
      DECISION_RATIONALE: sessionResult.decision_rationale,
      BLOCKING_ISSUES: sessionResult.blocking_issues.join("; "),
      RECOMMENDATIONS: sessionResult.recommendations.join("; "),

      // Compliance flags
      VALIDATIONS: {
        cases_total_valid: sessionResult.cases_total_valid,
        threshold_compliance: sessionResult.threshold_compliance,
        manifest_integrity: sessionResult.manifest_integrity,
        budget_compliance: sessionResult.budget_compliance,
      },
    };
  }

  /**
   * Auto-calibrate thresholds if enabled
   */
  async autoCalibrateIfEnabled(profile: string): Promise<void> {
    const autocalibConfig = this.thresholdManager.getAutoCalibrationConfig();

    if (autocalibConfig.enabled) {
      console.log(`🔧 Auto-calibrating thresholds for profile: ${profile}...`);

      try {
        const calibrationResults =
          await this.thresholdManager.autoCalibrateThresholds(profile);

        if (calibrationResults.length > 0) {
          console.log(
            `📊 Applied ${calibrationResults.filter((r) => r.applied).length} threshold calibrations`,
          );

          // Log calibration for audit
          const appliedResults = calibrationResults.filter((r) => r.applied);
          for (const result of appliedResults) {
            console.log(
              `   ${result.metric_name}: ${result.old_value} → ${result.new_value} (${result.change_pct > 0 ? "+" : ""}${(result.change_pct * 100).toFixed(1)}%)`,
            );
          }

          // Apply calibration to configuration
          this.thresholdManager.applyCalibrationResults(
            calibrationResults,
            profile,
          );
        } else {
          console.log(
            `ℹ️  No threshold calibrations needed for profile: ${profile}`,
          );
        }
      } catch (error) {
        console.error(
          `❌ Auto-calibration failed for profile ${profile}:`,
          error,
        );
      }
    }
  }
}

/**
 * Factory function to create gating integrator
 */
export function createGatingIntegrator(): GatingIntegrator {
  return new GatingIntegrator();
}

/**
 * Convenience function for complete session evaluation
 */
export async function evaluateSession(
  context: GatingContext,
  metrics: GatedMetrics,
  manifestHash?: string,
): Promise<SessionResult> {
  const integrator = createGatingIntegrator();

  // Auto-calibrate thresholds if enabled
  await integrator.autoCalibrateIfEnabled(context.profile);

  // Load budget state
  const budgetGuardian = createBudgetGuardian();
  const budgetState = budgetGuardian.loadBudgetState(context.run_id);

  // Evaluate session
  const sessionResult = integrator.evaluateSessionResult(
    context,
    metrics,
    manifestHash,
    budgetState ? budgetGuardian.getBudgetSummary() : null,
  );

  return sessionResult;
}
