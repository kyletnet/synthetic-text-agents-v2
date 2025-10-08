#!/usr/bin/env node
/**
 * preflight_pack.ts — Production preflight pack with handoff bundle generation (REFACTORED)
 *
 * Usage: node dist/scripts/preflight_pack.js --profile stage --budget-smoke 2.00 --budget-full 50.00 --run-tags preflight
 *
 * 7-Stage Pipeline Process:
 * [1] TypeScript validate → GREEN 필요
 * [2] Lint → GREEN
 * [3] Manifest/Seed/Threshold sanity
 * [4] Paid smoke (DRY_RUN=false)
 * [5] Gating (P0/P1/P2 정책 일치)
 * [6] Observability export (HTML)
 * [7] Full run (Gate 통과 시)
 *
 * Architecture: Domain-Driven Design + Pipeline Pattern
 * - Domain: Stage definitions, validation rules, gating rules
 * - Application: Pipeline executor, stage executor, bundle generator
 * - Infrastructure: Stage runners (7 concrete implementations)
 *
 * Outputs handoff bundle with all required artifacts
 */

import { promises as fs } from "fs";
import { parseArgs } from "util";
import { Logger } from "../shared/logger.js";
import { StageContext } from "../domain/preflight/stage-definitions.js";
import {
  createPipelineBuilder,
  PipelineResult,
} from "../application/preflight/preflight-pipeline.js";
import { createAllStages } from "../infrastructure/preflight/stage-runners.js";
import {
  BundleGenerator,
  HandoffBundle,
} from "../application/preflight/bundle-generator.js";

interface PreflightConfig {
  profile: "dev" | "stage" | "prod";
  budgetSmoke: number;
  budgetFull: number;
  runTags: string;
  timestamp: string;
  reportDir: string;
  runLogsDir: string;
  obsDir: string;
  dlqDir: string;
}

/**
 * PreflightPack - Refactored with Pipeline Pattern
 *
 * This class now uses the Domain-Driven Design architecture:
 * - Domain layer: Stage definitions, validation rules, gating rules
 * - Application layer: Pipeline executor, stage executor, bundle generator
 * - Infrastructure layer: Stage runners (7 concrete implementations)
 */
export class PreflightPack {
  private config: PreflightConfig;
  private logger: Logger;
  private bundleGenerator: BundleGenerator;

  constructor(config: Partial<PreflightConfig> = {}) {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);

    this.config = {
      profile: "stage" as const,
      budgetSmoke: 2.0,
      budgetFull: 50.0,
      runTags: "preflight",
      timestamp,
      reportDir: "reports",
      runLogsDir: "RUN_LOGS",
      obsDir: `reports/observability/${timestamp}`,
      dlqDir: "reports/dlq",
      ...config,
    };

    this.logger = new Logger({ level: "info" });
    this.bundleGenerator = new BundleGenerator();
  }

  async run(): Promise<{ success: boolean; handoffBundle: HandoffBundle }> {
    this.logger.info("Starting preflight pack", {
      profile: this.config.profile,
      budgetSmoke: this.config.budgetSmoke,
      budgetFull: this.config.budgetFull,
      timestamp: this.config.timestamp,
    });

    console.log(`[PREFLIGHT] Starting with profile: ${this.config.profile}`);
    console.log(
      `[PREFLIGHT] Budgets - Smoke: $${this.config.budgetSmoke}, Full: $${this.config.budgetFull}`,
    );
    console.log(`[PREFLIGHT] Timestamp: ${this.config.timestamp}`);

    try {
      // Ensure directories exist
      await this.ensureDirectories();

      // Create stage context
      const context: StageContext = {
        profile: this.config.profile,
        budgetSmoke: this.config.budgetSmoke,
        budgetFull: this.config.budgetFull,
        runTags: this.config.runTags,
        timestamp: this.config.timestamp,
        reportDir: this.config.reportDir,
        runLogsDir: this.config.runLogsDir,
        obsDir: this.config.obsDir,
        dlqDir: this.config.dlqDir,
      };

      // Create all stages
      const stages = createAllStages();

      // Build and execute pipeline
      const pipeline = createPipelineBuilder()
        .withStages(stages)
        .withContext(context)
        .withConfig({
          stopOnBlockingFailure: true,
          enableGating: true,
        })
        .build();

      const pipelineResult = await pipeline.execute();

      // Generate handoff bundle
      const handoffBundle = await this.bundleGenerator.generateHandoffBundle(
        pipelineResult.stagesCompleted,
        context,
        pipelineResult.success,
      );

      // Display results
      this.displayResults(pipelineResult, handoffBundle);

      return {
        success: pipelineResult.success,
        handoffBundle,
      };
    } catch (error) {
      this.logger.error("Preflight pack failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      console.error(`[PREFLIGHT] Fatal error: ${error}`);

      // Generate partial bundle with empty stages
      const context: StageContext = {
        profile: this.config.profile,
        budgetSmoke: this.config.budgetSmoke,
        budgetFull: this.config.budgetFull,
        runTags: this.config.runTags,
        timestamp: this.config.timestamp,
        reportDir: this.config.reportDir,
        runLogsDir: this.config.runLogsDir,
        obsDir: this.config.obsDir,
        dlqDir: this.config.dlqDir,
      };

      const handoffBundle = await this.bundleGenerator.generateHandoffBundle(
        [],
        context,
        false,
      );

      return { success: false, handoffBundle };
    }
  }

  private displayResults(
    pipelineResult: PipelineResult,
    handoffBundle: HandoffBundle,
  ): void {
    console.log("\n" + "=".repeat(80));
    console.log(
      `🎯 PREFLIGHT ${pipelineResult.success ? "SUCCESS" : "FAILED"}`,
    );
    console.log("=".repeat(80));

    // Display stage results
    console.log("\nStage Results:");
    for (const stage of pipelineResult.stagesCompleted) {
      const icon = stage.success ? "✅" : "❌";
      console.log(`  ${icon} ${stage.stage} (${stage.duration_ms}ms)`);
      if (!stage.success && stage.error) {
        console.log(`     Error: ${stage.error}`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📦 HANDOFF BUNDLE");
    console.log("=".repeat(80));
    console.log(`Bundle Hash: ${handoffBundle.bundle_hash}`);
    console.log(`Profile: ${handoffBundle.profile}`);
    console.log(`Git Hash: ${handoffBundle.git_commit_hash.slice(0, 8)}`);
    console.log(`Product Plan: ${handoffBundle.product_plan_version}`);
    console.log(
      `Stages: ${handoffBundle.stages_summary.successful}/${handoffBundle.stages_summary.total} succeeded`,
    );
    console.log("=".repeat(80));

    if (!pipelineResult.canProceedToFullRun) {
      console.log(
        `\n[GATE] ❌ ${pipelineResult.gatingReason || "Gate check failed"}`,
      );
    }
  }

  /**
   * Ensure all required directories exist
   */

  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.config.reportDir,
      this.config.runLogsDir,
      this.config.obsDir,
      this.config.dlqDir,
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}

// CLI interface
async function main() {
  const { values: args } = parseArgs({
    options: {
      profile: { type: "string", default: "stage" },
      "budget-smoke": { type: "string", default: "2.00" },
      "budget-full": { type: "string", default: "50.00" },
      "run-tags": { type: "string", default: "preflight" },
    },
  });

  const config = {
    profile: args.profile as "dev" | "stage" | "prod",
    budgetSmoke: parseFloat(args["budget-smoke"] || "2.00"),
    budgetFull: parseFloat(args["budget-full"] || "50.00"),
    runTags: args["run-tags"] || "preflight",
  };

  console.log("🚀 Preflight Pack v1.5+");
  console.log(`📋 Config: ${JSON.stringify(config, null, 2)}`);

  const preflight = new PreflightPack(config);
  const result = await preflight.run();

  console.log("\n" + "=".repeat(80));
  console.log(`🎯 PREFLIGHT ${result.success ? "SUCCESS" : "FAILED"}`);
  console.log("=".repeat(80));
  console.log(`📦 Handoff Bundle: ${result.handoffBundle.bundle_hash}`);
  console.log(`📊 Profile: ${result.handoffBundle.profile}`);
  console.log(
    `🔗 Git Hash: ${result.handoffBundle.git_commit_hash.slice(0, 8)}`,
  );
  console.log(`📝 Product Plan: ${result.handoffBundle.product_plan_version}`);
  console.log("=".repeat(80));

  process.exit(result.success ? 0 : 1);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { main };
