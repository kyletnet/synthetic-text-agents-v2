/**
 * Application: Bundle Generator
 * Generates handoff bundles from preflight pipeline results
 */

import { promises as fs } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { createHash } from "crypto";
import { Logger } from "../../shared/logger.js";
import {
  StageResult,
  StageContext,
} from "../../domain/preflight/stage-definitions.js";
import { appendJSONL } from "../../shared/jsonl.js";

const logger = new Logger({ level: "info" });

// ============================================================================
// Bundle Types
// ============================================================================

export interface HandoffBundle {
  timestamp: string;
  git_commit_hash: string;
  profile: string;
  session_report_path: string;
  baseline_report_path: string;
  observability_path: string;
  data_manifest_path: string;
  config_snapshot: ConfigSnapshot;
  run_logs_dir: string;
  dlq_reports: string[];
  product_plan_version: string;
  bundle_hash: string;
  stages_summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface ConfigSnapshot {
  env_files: string[];
  baseline_config: string;
  tsconfig_files: string[];
}

// ============================================================================
// Bundle Generator
// ============================================================================

export class BundleGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ level: "info" });
  }

  /**
   * Generate handoff bundle from pipeline results
   */
  async generateHandoffBundle(
    stages: StageResult[],
    context: StageContext,
    success: boolean,
  ): Promise<HandoffBundle> {
    this.logger.info("Generating handoff bundle", {
      stagesCompleted: stages.length,
      success,
    });

    const gitCommitHash = await this.getGitCommitHash();
    const productPlanVersion = await this.getProductPlanVersion();
    const configSnapshot = await this.collectConfigSnapshot();
    const dlqReports = await this.collectDLQReports(context.dlqDir);

    const bundle: HandoffBundle = {
      timestamp: context.timestamp,
      git_commit_hash: gitCommitHash,
      profile: context.profile,
      session_report_path: join(context.reportDir, "session_report.md"),
      baseline_report_path: join(context.reportDir, "baseline_report.jsonl"),
      observability_path: join(context.obsDir, "index.html"),
      data_manifest_path: join(context.reportDir, "manifest_current.json"),
      config_snapshot: configSnapshot,
      run_logs_dir: context.runLogsDir,
      dlq_reports: dlqReports,
      product_plan_version: productPlanVersion,
      bundle_hash: "",
      stages_summary: {
        total: stages.length,
        successful: stages.filter((s) => s.success).length,
        failed: stages.filter((s) => !s.success).length,
      },
    };

    // Generate bundle hash
    bundle.bundle_hash = this.generateBundleHash(bundle, stages);

    // Save bundle metadata
    await this.saveBundleMetadata(bundle, context.reportDir);

    // Log bundle for observability
    await this.logBundleGeneration(bundle, context.runLogsDir, success);

    // Create PRODUCT_PLAN.md symlink if needed
    await this.ensureProductPlanSymlink();

    this.logger.info("Handoff bundle generated", {
      bundle_hash: bundle.bundle_hash,
      stages: bundle.stages_summary,
    });

    return bundle;
  }

  /**
   * Get git commit hash
   */
  private async getGitCommitHash(): Promise<string> {
    try {
      return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    } catch (error) {
      this.logger.warn("Could not get git commit hash", {
        error: error instanceof Error ? error.message : String(error),
      });
      return "unknown";
    }
  }

  /**
   * Get PRODUCT_PLAN.md version
   */
  private async getProductPlanVersion(): Promise<string> {
    const productPlanPaths = ["PRODUCT_PLAN.md", "docs/PRODUCT_PLAN.md"];

    for (const path of productPlanPaths) {
      try {
        const content = await fs.readFile(path, "utf8");
        const versionMatch = content.match(/version[:\s]*([^\n\r]+)/i);
        if (versionMatch) {
          return versionMatch[1].trim();
        }
      } catch {
        // Try next path
      }
    }

    this.logger.warn("Could not read PRODUCT_PLAN.md", {
      searchedPaths: productPlanPaths,
    });

    return "v1.0";
  }

  /**
   * Collect configuration snapshot
   */
  private async collectConfigSnapshot(): Promise<ConfigSnapshot> {
    const snapshot: ConfigSnapshot = {
      env_files: [],
      baseline_config: "",
      tsconfig_files: [],
    };

    // Collect .env files
    const envFiles = [".env", ".env.local", ".env.production", ".env.staging"];
    for (const envFile of envFiles) {
      try {
        await fs.access(envFile);
        snapshot.env_files.push(envFile);
      } catch {
        // File doesn't exist, skip
      }
    }

    // Collect baseline config
    try {
      await fs.access("baseline_config.json");
      snapshot.baseline_config = "baseline_config.json";
    } catch {
      this.logger.warn("No baseline_config.json found");
    }

    // Collect tsconfig files
    const tsconfigFiles = ["tsconfig.json", "tsconfig.export.json"];
    for (const tsconfigFile of tsconfigFiles) {
      try {
        await fs.access(tsconfigFile);
        snapshot.tsconfig_files.push(tsconfigFile);
      } catch {
        // File doesn't exist, skip
      }
    }

    return snapshot;
  }

  /**
   * Collect DLQ reports
   */
  private async collectDLQReports(dlqDir: string): Promise<string[]> {
    const dlqReports: string[] = [];

    try {
      const dlqFiles = await fs.readdir(dlqDir);
      for (const file of dlqFiles) {
        if (file.endsWith(".jsonl") || file.endsWith(".json")) {
          dlqReports.push(join(dlqDir, file));
        }
      }
    } catch {
      // DLQ directory doesn't exist or is empty
    }

    return dlqReports;
  }

  /**
   * Generate bundle hash
   */
  private generateBundleHash(
    bundle: HandoffBundle,
    stages: StageResult[],
  ): string {
    const hashInput = JSON.stringify({
      timestamp: bundle.timestamp,
      git_commit_hash: bundle.git_commit_hash,
      profile: bundle.profile,
      stages: stages.map((s) => ({
        stage: s.stage,
        success: s.success,
        duration_ms: s.duration_ms,
      })),
    });

    return createHash("sha256").update(hashInput).digest("hex").slice(0, 16);
  }

  /**
   * Save bundle metadata
   */
  private async saveBundleMetadata(
    bundle: HandoffBundle,
    reportDir: string,
  ): Promise<void> {
    const bundlePath = join(reportDir, "handoff_bundle.json");

    try {
      await fs.writeFile(bundlePath, JSON.stringify(bundle, null, 2));
      this.logger.info("Bundle metadata saved", { path: bundlePath });
    } catch (error) {
      this.logger.error("Failed to save bundle metadata", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Log bundle generation for observability
   */
  private async logBundleGeneration(
    bundle: HandoffBundle,
    runLogsDir: string,
    success: boolean,
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      component: "bundle_generator",
      operation: "generate_handoff_bundle",
      bundle_hash: bundle.bundle_hash,
      success,
      profile: bundle.profile,
      stages_completed: bundle.stages_summary.total,
      stages_successful: bundle.stages_summary.successful,
      bundle_metadata: bundle,
    };

    const logPath = join(
      runLogsDir,
      `handoff_bundle_${bundle.timestamp}.jsonl`,
    );

    try {
      await appendJSONL(logPath, logEntry);
    } catch (error) {
      this.logger.warn("Failed to log bundle generation", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Ensure PRODUCT_PLAN.md symlink exists
   */
  private async ensureProductPlanSymlink(): Promise<void> {
    try {
      await fs.access("./PRODUCT_PLAN.md");
      // File exists, no action needed
    } catch {
      // PRODUCT_PLAN.md doesn't exist at repo root
      try {
        await fs.access("./docs/PRODUCT_PLAN.md");
        // docs/PRODUCT_PLAN.md exists, create symlink
        execSync("ln -sf docs/PRODUCT_PLAN.md PRODUCT_PLAN.md");
        this.logger.info(
          "Created symlink: PRODUCT_PLAN.md -> docs/PRODUCT_PLAN.md",
        );
      } catch {
        // Neither file exists, skip symlink creation
      }
    }
  }

  /**
   * Create bundle summary for display
   */
  createBundleSummary(bundle: HandoffBundle): string {
    const lines = [
      "=".repeat(80),
      "HANDOFF BUNDLE SUMMARY",
      "=".repeat(80),
      `Bundle Hash: ${bundle.bundle_hash}`,
      `Profile: ${bundle.profile}`,
      `Git Hash: ${bundle.git_commit_hash.slice(0, 8)}`,
      `Product Plan: ${bundle.product_plan_version}`,
      `Timestamp: ${bundle.timestamp}`,
      "",
      "Stages Summary:",
      `  Total: ${bundle.stages_summary.total}`,
      `  Successful: ${bundle.stages_summary.successful}`,
      `  Failed: ${bundle.stages_summary.failed}`,
      "",
      "Artifacts:",
      `  Session Report: ${bundle.session_report_path}`,
      `  Baseline Report: ${bundle.baseline_report_path}`,
      `  Observability: ${bundle.observability_path}`,
      `  Data Manifest: ${bundle.data_manifest_path}`,
      `  Run Logs: ${bundle.run_logs_dir}`,
      "",
      "Config Snapshot:",
      `  Env Files: ${bundle.config_snapshot.env_files.length}`,
      `  Baseline Config: ${bundle.config_snapshot.baseline_config || "N/A"}`,
      `  TSConfig Files: ${bundle.config_snapshot.tsconfig_files.length}`,
      "=".repeat(80),
    ];

    return lines.join("\n");
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createBundleGenerator(): BundleGenerator {
  return new BundleGenerator();
}

// ============================================================================
// Exports
// ============================================================================

logger.info("Bundle generator module loaded");
