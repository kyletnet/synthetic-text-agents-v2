#!/usr/bin/env node
/**
 * Quality Assessment Orchestrator
 *
 * @tool-mode: analyze
 *
 * Purpose:
 * - Orchestrate quality assessment across all phases
 * - Coordinate checkers, scorers, and state machine
 * - Generate quality reports
 * - Integrate with governance system
 *
 * Flow:
 * 1. Load QA pairs
 * 2. Run appropriate checker for current phase
 * 3. Calculate compliance score
 * 4. Make gate decision
 * 5. Update phase state
 * 6. Append to quality ledger
 * 7. Generate report
 *
 * Phase: All phases (0-4)
 * Version: 1.0.0
 */

import type { QAPair, QualityReport, QualityChecker } from "./models/quality-domain.js";
import { RuleBasedChecker } from "./checkers/rule-based-checker.js";
import { EvidenceAligner } from "./checkers/evidence-aligner.js";
import { HybridSearchChecker } from "./checkers/hybrid-search-checker.js";
import { ComplianceScoreCalculator } from "./compliance-score.js";
import { getPhaseStateMachine } from "./phase-state-machine.js";
import { getQualityLedger } from "./quality-ledger.js";
import { FeatureMatrixManager } from "./feature-matrix-manager.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

// ============================================================================
// Types
// ============================================================================

export interface OrchestratorOptions {
  projectRoot?: string;
  phase?: "Phase 1" | "Phase 2" | "Phase 3" | "Phase 4";
  sessionId?: string;
  outputPath?: string;
}

export interface OrchestratorResult {
  success: boolean;
  report: QualityReport;
  gateDecision: {
    result: "PASS" | "WARN" | "PARTIAL" | "FAIL";
    score: number;
    canProceed: boolean;
  };
  ledgerHash?: string;
  error?: string;
}

// ============================================================================
// Quality Orchestrator
// ============================================================================

export class QualityOrchestrator {
  private projectRoot: string;
  private phase: "Phase 1" | "Phase 2" | "Phase 3" | "Phase 4";
  private sessionId: string;
  private checkers: Map<string, QualityChecker> = new Map();
  private featureMatrix: FeatureMatrixManager;
  private pluginRegistryEnabled: boolean;

  constructor(options: OrchestratorOptions = {}) {
    this.projectRoot = options.projectRoot ?? process.cwd();
    this.phase = options.phase ?? "Phase 1";
    this.sessionId = options.sessionId ?? `session-${Date.now()}`;
    this.featureMatrix = new FeatureMatrixManager(this.projectRoot);
    this.pluginRegistryEnabled =
      process.env.FEATURE_PLUGIN_REGISTRY_ENABLED === "true";

    // Auto-register default checkers
    this.registerDefaultCheckers();
  }

  /**
   * Register default checkers based on phase
   */
  private registerDefaultCheckers(): void {
    // Phase 1: Rule-based checker (always)
    const ruleChecker = new RuleBasedChecker(this.projectRoot);
    this.registerChecker(ruleChecker);

    // Phase 2+: Evidence aligner
    if (this.phase !== "Phase 1") {
      const evidenceAligner = new EvidenceAligner();
      this.registerChecker(evidenceAligner);
    }

    // Phase 3+: Hybrid search (if enabled)
    if (this.phase === "Phase 3" || this.phase === "Phase 4") {
      const hybridSearchChecker = new HybridSearchChecker();
      this.registerChecker(hybridSearchChecker);
    }
  }

  /**
   * Register a quality checker
   *
   * Checks Feature Matrix for conflicts before registration.
   */
  registerChecker(checker: QualityChecker): void {
    // Skip if plugin registry is disabled and checker is not a default
    if (!this.pluginRegistryEnabled) {
      // Only register if it's a core checker (rule-based, evidence-aligner)
      if (
        checker.name !== "rule-based-checker" &&
        checker.name !== "evidence-aligner"
      ) {
        console.log(
          `Plugin registry disabled, skipping: ${checker.name}`,
        );
        return;
      }
    }

    // Check Feature Matrix for conflicts
    const activeCheckers = Array.from(this.checkers.keys());
    const canActivateResult = this.featureMatrix.canActivate(
      checker.name,
      activeCheckers,
    );

    if (!canActivateResult.canActivate) {
      console.warn(
        `Cannot register checker ${checker.name}: ${canActivateResult.reason}`,
      );
      return;
    }

    // Check if enabled in Feature Matrix
    const pluginConfig = this.featureMatrix.getPluginConfig(checker.name);
    if (pluginConfig && !pluginConfig.enabled) {
      console.log(
        `Checker ${checker.name} not enabled in Feature Matrix`,
      );
      return;
    }

    // Register
    this.checkers.set(checker.name, checker);
    console.log(`✅ Registered checker: ${checker.name} (${checker.version})`);
  }

  /**
   * Get checkers in priority order
   */
  private getCheckersInPriorityOrder(): QualityChecker[] {
    const pluginConfigs = this.featureMatrix.getPluginsInPriorityOrder();
    const orderedCheckers: QualityChecker[] = [];

    for (const pluginConfig of pluginConfigs) {
      const checker = this.checkers.get(pluginConfig.name);
      if (checker) {
        orderedCheckers.push(checker);
      }
    }

    return orderedCheckers;
  }

  /**
   * Run quality assessment
   */
  async assess(qaPairs: QAPair[]): Promise<OrchestratorResult> {
    console.log("🔍 Quality Assessment Orchestrator v1.0.0");
    console.log(
      "════════════════════════════════════════════════════════════\n",
    );
    console.log(`📋 Phase: ${this.phase}`);
    console.log(`🆔 Session ID: ${this.sessionId}`);
    console.log(`📊 QA Pairs: ${qaPairs.length}\n`);

    try {
      // 1. Run checker for current phase
      console.log("⏳ Running quality checks...");
      const checkResult = await this.runChecker(qaPairs);

      // 2. Calculate compliance score
      console.log("📐 Calculating compliance score...");
      const calculator = new ComplianceScoreCalculator(this.projectRoot);
      const complianceResult = calculator.calculateScore(checkResult.metrics);

      // 3. Make gate decision
      console.log("🚦 Making gate decision...");
      const gateDecision = calculator.makeGateDecision(
        complianceResult.overallScore,
        this.phase,
      );

      console.log(
        `   Result: ${gateDecision.result} (${(
          gateDecision.score * 100
        ).toFixed(1)}%)`,
      );
      console.log(`   ${gateDecision.reason}\n`);

      // 4. Extract phase-specific metrics
      const retrievalQualityScore =
        checkResult.metrics.find(
          (m) => m.dimension === "retrieval_quality_score",
        )?.score ?? null;

      // 4. Update phase state
      console.log("💾 Updating phase state...");
      const stateMachine = getPhaseStateMachine(this.projectRoot);
      const transitionResult = await stateMachine.transition(
        gateDecision.result,
        {
          guideline_compliance: complianceResult.overallScore,
          retrieval_quality_score: retrievalQualityScore,
          semantic_quality: null,
        },
        "v1.0",
      );

      if (!transitionResult.success) {
        throw new Error(`Phase transition failed: ${transitionResult.reason}`);
      }

      console.log(`   ${transitionResult.reason}`);
      console.log(`   Ledger Hash: ${transitionResult.ledgerHash}\n`);

      // 5. Generate report
      console.log("📄 Generating quality report...");
      const report = this.generateReport(
        complianceResult,
        checkResult,
        calculator,
      );

      // 6. Save report
      const reportPath = join(
        this.projectRoot,
        "reports",
        "quality",
        `compliance-summary-${this.sessionId}.json`,
      );
      this.ensureDir(reportPath);
      writeFileSync(reportPath, JSON.stringify(report, null, 2));

      console.log(`   Saved: ${reportPath}\n`);

      console.log(
        "════════════════════════════════════════════════════════════",
      );
      console.log("✅ ASSESSMENT COMPLETE");
      console.log(
        "════════════════════════════════════════════════════════════\n",
      );

      return {
        success: true,
        report,
        gateDecision: {
          result: gateDecision.result,
          score: gateDecision.score,
          canProceed: gateDecision.canProceed,
        },
        ledgerHash: transitionResult.ledgerHash,
      };
    } catch (error) {
      console.error("❌ Assessment failed:", error);
      return {
        success: false,
        report: this.createEmptyReport(),
        gateDecision: {
          result: "FAIL",
          score: 0,
          canProceed: false,
        },
        error: String(error),
      };
    }
  }

  /**
   * Run checker based on current phase
   */
  private async runChecker(qaPairs: QAPair[]) {
    switch (this.phase) {
      case "Phase 1": {
        const checker = new RuleBasedChecker(this.projectRoot);
        return await checker.check(qaPairs);
      }
      case "Phase 2": {
        // Phase 2: Run both Phase 1 + Evidence checkers
        const ruleChecker = new RuleBasedChecker(this.projectRoot);
        const evidenceAligner = new EvidenceAligner();
        const hybridSearchChecker = new HybridSearchChecker();

        // Run all checkers
        const ruleResult = await ruleChecker.check(qaPairs);
        const evidenceResult = await evidenceAligner.check(qaPairs);
        const hybridResult = await hybridSearchChecker.check(qaPairs);

        // Combine results
        return {
          metrics: [
            ...ruleResult.metrics,
            ...evidenceResult.metrics,
            ...hybridResult.metrics,
          ],
          summary: {
            totalChecked: qaPairs.length,
            overallScore:
              (ruleResult.summary.overallScore +
                evidenceResult.summary.overallScore) /
              2,
            passRate:
              (ruleResult.summary.passRate + evidenceResult.summary.passRate) /
              2,
            violationCount:
              ruleResult.summary.violationCount +
              evidenceResult.summary.violationCount,
            recommendationCount:
              ruleResult.summary.recommendationCount +
              evidenceResult.summary.recommendationCount,
          },
          timestamp: new Date().toISOString(),
          checkerVersion: "phase-2-combined",
        };
      }
      case "Phase 3": {
        // Phase 3: Canary deployment of Hybrid Search
        const ruleChecker = new RuleBasedChecker(this.projectRoot);
        const evidenceAligner = new EvidenceAligner();
        const hybridSearchChecker = new HybridSearchChecker();

        // Check feature flags
        const hybridSearchEnabled =
          process.env.FEATURE_QUALITY_HYBRID_SEARCH === "true";
        const canaryRate = parseFloat(process.env.HYBRID_CANARY_RATE ?? "0.0");

        console.log(
          `   Hybrid Search: ${hybridSearchEnabled ? "ENABLED" : "DISABLED"}`,
        );
        console.log(`   Canary Rate: ${(canaryRate * 100).toFixed(0)}%`);

        // Canary decision (deterministic for testing, use random for production)
        const inCanary = Math.random() < canaryRate;
        console.log(`   In Canary: ${inCanary ? "YES" : "NO"}\n`);

        // Run all checkers
        const ruleResult = await ruleChecker.check(qaPairs);
        const evidenceResult = await evidenceAligner.check(qaPairs);
        const hybridResult = await hybridSearchChecker.check(qaPairs);

        // Determine if hybrid search affects gating
        const hybridAffectsGating = hybridSearchEnabled && inCanary;

        // Combine results
        const baseScore =
          (ruleResult.summary.overallScore +
            evidenceResult.summary.overallScore) /
          2;

        // If hybrid affects gating, include it in score
        const overallScore = hybridAffectsGating
          ? (baseScore + hybridResult.summary.overallScore) / 2
          : baseScore;

        return {
          metrics: [
            ...ruleResult.metrics,
            ...evidenceResult.metrics,
            ...hybridResult.metrics,
          ],
          summary: {
            totalChecked: qaPairs.length,
            overallScore,
            passRate:
              (ruleResult.summary.passRate + evidenceResult.summary.passRate) /
              2,
            violationCount:
              ruleResult.summary.violationCount +
              evidenceResult.summary.violationCount,
            recommendationCount:
              ruleResult.summary.recommendationCount +
              evidenceResult.summary.recommendationCount,
          },
          timestamp: new Date().toISOString(),
          checkerVersion: hybridAffectsGating
            ? "phase-3-hybrid-active"
            : "phase-3-shadow",
        };
      }
      case "Phase 4":
        throw new Error(`Phase ${this.phase} checkers not yet implemented`);
      default:
        throw new Error(`Unknown phase: ${this.phase}`);
    }
  }

  /**
   * Generate quality report
   */
  private generateReport(
    complianceResult: any,
    checkResult: any,
    calculator: ComplianceScoreCalculator,
  ): QualityReport {
    const breakdown = calculator.exportBreakdown(complianceResult);

    const allViolations = checkResult.metrics.flatMap(
      (m: any) => m.details?.violations ?? [],
    );
    const allRecommendations = checkResult.metrics.flatMap(
      (m: any) => m.details?.recommendations ?? [],
    );

    // Extract evidence metrics (Phase 2+)
    const evidenceMetrics = this.extractEvidenceMetrics(checkResult.metrics);

    // Extract shadow metrics (Phase 2+)
    const shadowMetrics = this.extractShadowMetrics(checkResult.metrics);

    const report: QualityReport = {
      schemaVersion: "2025-10-quality-v1",
      timestamp: new Date().toISOString(),
      phase: this.phase,
      guideline_compliance: {
        score: complianceResult.overallScore,
        version: "1.0",
        breakdown,
      },
      violations: allViolations,
      recommendations: allRecommendations,
    };

    // Add phase-specific metrics
    if (evidenceMetrics) {
      report.evidence_metrics = evidenceMetrics;
    }

    if (shadowMetrics) {
      report.shadow_metrics = shadowMetrics;
    }

    return report;
  }

  /**
   * Extract evidence metrics from Phase 2 checkers
   */
  private extractEvidenceMetrics(metrics: any[]): any | undefined {
    const snippetAlignment = metrics.find((m) =>
      m.dimension.includes("snippet_alignment"),
    );
    const citationPresence = metrics.find((m) =>
      m.dimension.includes("citation_presence"),
    );
    const contextPrecision = metrics.find((m) =>
      m.dimension.includes("context_precision"),
    );
    const contextRecall = metrics.find((m) =>
      m.dimension.includes("context_recall"),
    );
    const retrievalQuality = metrics.find((m) =>
      m.dimension.includes("retrieval_quality_score"),
    );

    if (!retrievalQuality) return undefined;

    return {
      snippet_alignment: snippetAlignment?.score ?? 0,
      citation_presence: citationPresence?.score ?? 0,
      context_precision: contextPrecision?.score ?? 0,
      context_recall: contextRecall?.score ?? 0,
      retrieval_quality_score: retrievalQuality.score,
    };
  }

  /**
   * Extract shadow metrics (hybrid search)
   */
  private extractShadowMetrics(metrics: any[]): any | undefined {
    const hybridMetric = metrics.find((m) =>
      m.dimension.includes("hybrid_search_combined"),
    );

    if (!hybridMetric) return undefined;

    const breakdown = hybridMetric.details?.breakdown ?? {};

    // Extract BM25 and Vector scores from their own metrics
    const bm25Metric = metrics.find((m) =>
      m.dimension.includes("hybrid_search_bm25"),
    );
    const vectorMetric = metrics.find((m) =>
      m.dimension.includes("hybrid_search_vector"),
    );

    return {
      hybrid_search: {
        improvement_delta: breakdown.improvement_delta ?? 0,
        bm25_avg: bm25Metric?.score ?? 0,
        vector_avg: vectorMetric?.score ?? 0,
        hybrid_avg: breakdown.avg ?? 0,
      },
    };
  }

  /**
   * Create empty report (fallback)
   */
  private createEmptyReport(): QualityReport {
    return {
      schemaVersion: "2025-10-quality-v1",
      timestamp: new Date().toISOString(),
      phase: this.phase,
      violations: [],
      recommendations: [],
    };
  }

  /**
   * Ensure directory exists
   */
  private ensureDir(filePath: string): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  const inputPath = args[0] || "data/qa-pairs.json";
  // Join "Phase 1" back together if split
  const phaseArg =
    args.length > 2 ? `${args[1]} ${args[2]}` : args[1] || "Phase 1";
  const phase = phaseArg as "Phase 1" | "Phase 2" | "Phase 3" | "Phase 4";

  console.log(`📂 Input: ${inputPath}`);
  console.log(`📋 Phase: ${phase}\n`);

  // Load QA pairs
  if (!existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const qaPairs: QAPair[] = JSON.parse(readFileSync(inputPath, "utf8"));

  // Run orchestrator
  const orchestrator = new QualityOrchestrator({ phase });
  const result = await orchestrator.assess(qaPairs);

  // Exit with appropriate code
  if (result.success && result.gateDecision.canProceed) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Run if called directly (ES module)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Orchestrator error:", error);
    process.exit(1);
  });
}

// ============================================================================
// Exports
// ============================================================================

export async function assessQuality(
  qaPairs: QAPair[],
  options?: OrchestratorOptions,
): Promise<OrchestratorResult> {
  const orchestrator = new QualityOrchestrator(options);
  return await orchestrator.assess(qaPairs);
}
