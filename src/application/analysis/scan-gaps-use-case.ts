/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Application: Scan Gaps Use Case
 *
 * Orchestrates the complete gap scanning workflow.
 * This is the main entry point for gap scanning functionality.
 */

import type {
  GapCheckConfig,
  GapConfiguration,
  GapScanReport,
  GapScanSettings,
  GapSeverity,
} from "../../domain/analysis/gap-types.js";
import {
  GapAnalyzer,
  GapAutoFixer,
} from "../../domain/analysis/gap-analyzer.js";
import { ConfigurationResolver } from "../../domain/analysis/gap-detector.js";

// ============================================================================
// Configuration Provider Interface
// ============================================================================

export interface GapConfigurationProvider {
  load(): Promise<GapConfiguration>;
  getResolvedSettings(): Promise<GapScanSettings>;
  getEnabledChecks(): Promise<readonly GapCheckConfig[]>;
  logOverride(override: {
    user: string;
    originalMode: string;
    overrideMode: string;
    timestamp: Date;
    ci: boolean;
  }): Promise<void>;
}

// ============================================================================
// Report Writer Interface
// ============================================================================

export interface GapReportWriter {
  saveReport(report: GapScanReport, path: string): Promise<void>;
}

// ============================================================================
// Scan Options
// ============================================================================

export interface ScanGapsOptions {
  readonly quick?: boolean;
  readonly dryRun?: boolean;
  readonly autoFix?: boolean;
}

// ============================================================================
// Scan Gaps Use Case
// ============================================================================

export class ScanGapsUseCase {
  constructor(
    private readonly configProvider: GapConfigurationProvider,
    private readonly analyzer: GapAnalyzer,
    private readonly autoFixer: GapAutoFixer,
    private readonly reportWriter: GapReportWriter,
  ) {}

  /**
   * Execute gap scan
   */
  async execute(options: ScanGapsOptions = {}): Promise<GapScanReport> {
    const startTime = Date.now();

    // Load configuration
    const settings = await this.configProvider.getResolvedSettings();

    // Early exit if disabled
    if (settings.mode === "disabled") {
      return this.createEmptyReport(startTime, "disabled");
    }

    // Get enabled checks
    const checks = await this.configProvider.getEnabledChecks();

    // Run checks
    const gaps = await this.analyzer.runChecks(checks);

    // Auto-fix if enabled
    if (options.autoFix && settings.autoFix.enabled && !options.dryRun) {
      await this.autoFixer.autoFix(gaps, settings.autoFix.maxSeverity);
    }

    // Calculate summary
    const summary = this.analyzer.calculateSummary(gaps);

    // Create report
    const report: GapScanReport = {
      timestamp: new Date(),
      mode: settings.mode,
      totalChecks: checks.length,
      enabledChecks: checks.length,
      gaps,
      summary,
      executionTime: Date.now() - startTime,
    };

    // Save report (unless dry run)
    if (!options.dryRun) {
      await this.reportWriter.saveReport(report, settings.reportPath);
    }

    return report;
  }

  /**
   * Determine if scan should fail
   */
  shouldFail(report: GapScanReport, settings: GapScanSettings): boolean {
    if (settings.failOn.length === 0) return false;
    const failingGaps = this.analyzer.getFailingGaps(
      report.gaps,
      settings.failOn,
    );
    return failingGaps.length > 0;
  }

  /**
   * Get auto-fix summary
   */
  getAutoFixSummary(gaps: GapScanReport["gaps"], maxSeverity: GapSeverity) {
    return this.autoFixer.getAutoFixSummary(gaps, maxSeverity);
  }

  /**
   * Create empty report for disabled mode
   */
  private createEmptyReport(startTime: number, mode: string): GapScanReport {
    return {
      timestamp: new Date(),
      mode: mode as GapScanReport["mode"],
      totalChecks: 0,
      enabledChecks: 0,
      gaps: [],
      summary: { P0: 0, P1: 0, P2: 0, total: 0 },
      executionTime: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Configuration Resolution Use Case
// ============================================================================

export class ResolveConfigurationUseCase {
  constructor(private readonly configProvider: GapConfigurationProvider) {}

  /**
   * Resolve effective configuration
   */
  async execute(): Promise<GapScanSettings> {
    const config = await this.configProvider.load();
    const currentUser = process.env.USER || "unknown";

    // Start with global settings
    let settings = { ...config.globalSettings };

    // Find user's team
    const teamName = ConfigurationResolver.findUserTeam(
      config.teams,
      currentUser,
    );
    const teamConfig = teamName ? config.teams[teamName] : undefined;

    // Apply team override if exists
    if (teamConfig) {
      settings = {
        ...settings,
        mode: teamConfig.mode,
        failOn: [...teamConfig.failOn],
      };
    }

    // ENV override (highest priority)
    const envMode = process.env.GAP_SCAN_MODE;
    if (envMode) {
      const originalMode = settings.mode;
      settings.mode = envMode as typeof settings.mode;

      // Log override if changed
      if (settings.mode !== originalMode) {
        await this.configProvider.logOverride({
          user: currentUser,
          originalMode,
          overrideMode: settings.mode,
          timestamp: new Date(),
          ci: process.env.CI === "true",
        });
      }
    }

    // CI always uses shadow (unless explicitly enforce)
    if (process.env.CI === "true" && settings.mode !== "enforce") {
      settings.mode = "shadow";
    }

    return settings;
  }
}
