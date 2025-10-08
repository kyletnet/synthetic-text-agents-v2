#!/usr/bin/env node
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * GAP Scanner - Refactored with DDD Architecture
 *
 * This is the CLI entry point that wires together domain, application,
 * and infrastructure layers following Clean Architecture principles.
 */

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { runGovernedScript } from "./lib/governance/governed-script.js";

// Domain imports
import type {
  GapConfiguration,
  GapCheckConfig,
  GapScanSettings,
  GapScanReport,
} from "../src/domain/analysis/gap-types.js";
import {
  GapAnalyzer,
  GapAutoFixer,
} from "../src/domain/analysis/gap-analyzer.js";

// Application imports
import type {
  GapConfigurationProvider,
  GapReportWriter,
  ScanGapsOptions,
} from "../src/application/analysis/scan-gaps-use-case.js";
import {
  ScanGapsUseCase,
  ResolveConfigurationUseCase,
} from "../src/application/analysis/scan-gaps-use-case.js";
import { GapConsoleReporter } from "../src/application/analysis/gap-report-service.js";

// Infrastructure imports
import {
  CLIDocumentationDetector,
  GovernanceSyncDetector,
  PIIMaskingDetector,
  TestCoverageDetector,
  DocCrossRefsDetector,
  AgentE2EDetector,
  ArchivedDocsReactivationDetector,
  DocLifecycleDetector,
  DeprecatedReferenceEnforcementDetector,
  ConfigurationOverrideLogger,
} from "../src/infrastructure/scanning/file-gap-scanner.js";

// ============================================================================
// Configuration Provider Implementation
// ============================================================================

class FileBasedGapConfigurationProvider implements GapConfigurationProvider {
  private configPath = ".gaprc.json";
  private config: GapConfiguration | null = null;
  private overrideLogger = new ConfigurationOverrideLogger();

  async load(): Promise<GapConfiguration> {
    if (this.config) return this.config;

    if (!existsSync(this.configPath)) {
      throw new Error(`.gaprc.json not found. Run: npm run init:gap-system`);
    }

    const content = await readFile(this.configPath, "utf-8");
    this.config = JSON.parse(content) as GapConfiguration;
    return this.config;
  }

  async getResolvedSettings(): Promise<GapScanSettings> {
    const resolver = new ResolveConfigurationUseCase(this);
    return resolver.execute();
  }

  async getEnabledChecks(): Promise<readonly GapCheckConfig[]> {
    const config = await this.load();
    return config.checks.filter((check) => check.enabled);
  }

  async logOverride(override: {
    user: string;
    originalMode: string;
    overrideMode: string;
    timestamp: Date;
    ci: boolean;
  }): Promise<void> {
    // Log to console
    console.log(`⚠️  GAP_SCAN_MODE override detected:`);
    console.log(
      `   Original: ${override.originalMode} → Override: ${override.overrideMode}`,
    );
    console.log(`   User: ${override.user}`);
    console.log(`   Timestamp: ${override.timestamp.toISOString()}`);

    // Log to file
    await this.overrideLogger.logOverride(override);
  }
}

// ============================================================================
// Report Writer Implementation
// ============================================================================

class FileBasedGapReportWriter implements GapReportWriter {
  async saveReport(report: GapScanReport, path: string): Promise<void> {
    // Serialize report, excluding fix functions
    const serializable = {
      ...report,
      gaps: report.gaps.map((gap) => ({
        ...gap,
        fix: gap.fix
          ? {
              strategy: gap.fix.strategy,
              requiresApproval: gap.fix.requiresApproval,
            }
          : undefined,
      })),
    };

    await writeFile(path, JSON.stringify(serializable, null, 2));
  }
}

// ============================================================================
// Scanner Factory
// ============================================================================

class GapScannerFactory {
  static createScanner(): {
    useCase: ScanGapsUseCase;
    analyzer: GapAnalyzer;
    reporter: GapConsoleReporter;
  } {
    // Create infrastructure
    const configProvider = new FileBasedGapConfigurationProvider();
    const reportWriter = new FileBasedGapReportWriter();
    const reporter = new GapConsoleReporter();

    // Create domain services
    const analyzer = new GapAnalyzer();
    const autoFixer = new GapAutoFixer();

    // Register all detectors
    analyzer.registerDetector(
      "cli-documentation",
      new CLIDocumentationDetector(),
    );
    analyzer.registerDetector("governance-sync", new GovernanceSyncDetector());
    analyzer.registerDetector("pii-masking", new PIIMaskingDetector());
    analyzer.registerDetector("test-coverage", new TestCoverageDetector());
    analyzer.registerDetector("doc-cross-refs", new DocCrossRefsDetector());
    analyzer.registerDetector("agent-e2e", new AgentE2EDetector());
    analyzer.registerDetector(
      "archived-docs-reactivation",
      new ArchivedDocsReactivationDetector(),
    );
    analyzer.registerDetector("doc-lifecycle", new DocLifecycleDetector());
    analyzer.registerDetector(
      "deprecated-reference-enforcement",
      new DeprecatedReferenceEnforcementDetector(),
    );

    // Create use case
    const useCase = new ScanGapsUseCase(
      configProvider,
      analyzer,
      autoFixer,
      reportWriter,
    );

    return { useCase, analyzer, reporter };
  }
}

// ============================================================================
// CLI Orchestrator
// ============================================================================

class GapScannerCLI {
  constructor(
    private readonly useCase: ScanGapsUseCase,
    private readonly analyzer: GapAnalyzer,
    private readonly reporter: GapConsoleReporter,
    private readonly configProvider: GapConfigurationProvider,
  ) {}

  async run(options: ScanGapsOptions): Promise<void> {
    // Get settings
    const settings = await this.configProvider.getResolvedSettings();

    // Early exit if disabled
    if (settings.mode === "disabled") {
      this.reporter.printDisabledMessage();
      return;
    }

    // Print header
    this.reporter.printHeader(settings.mode, settings.failOn as string[]);

    // Execute scan
    const report = await this.useCase.execute(options);

    // Print summary
    this.reporter.printSummary(report.summary);

    // Determine if should fail
    const shouldFail = this.useCase.shouldFail(report, settings);

    // Print final status
    this.reporter.printFinalStatus(
      shouldFail,
      settings.mode,
      settings.reportPath,
    );

    // Throw error if should fail in enforce mode
    if (shouldFail && settings.mode === "enforce") {
      throw new Error("GAP scan failed: blocking gaps detected");
    }
  }

  printHelp(): void {
    console.log(`
GAP Scanner - Proactive System Consistency Checker

Usage:
  npm run gap:scan                    # Full scan
  npm run gap:scan -- --quick         # Quick scan
  npm run gap:scan -- --dry-run       # Preview only
  npm run gap:scan -- --auto-fix      # Auto-fix P2 gaps

Environment:
  GAP_SCAN_MODE=shadow|enforce        # Override mode
  CI=true                             # Force shadow mode

Configuration:
  .gaprc.json                         # Main config file
  .gapignore                          # Ignore patterns

Examples:
  # Shadow mode (observe only)
  GAP_SCAN_MODE=shadow npm run gap:scan

  # Enforce mode (fail on P0/P1)
  GAP_SCAN_MODE=enforce npm run gap:scan

  # Auto-fix safe gaps
  npm run gap:scan -- --auto-fix

More info: docs/GAP_SCANNER_GUIDE.md
    `);
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  const options: ScanGapsOptions = {
    quick: args.includes("--quick"),
    dryRun: args.includes("--dry-run"),
    autoFix: args.includes("--auto-fix"),
  };

  const showHelp = args.includes("--help") || args.includes("-h");

  // Create scanner
  const { useCase, analyzer, reporter } = GapScannerFactory.createScanner();
  const configProvider = new FileBasedGapConfigurationProvider();
  const cli = new GapScannerCLI(useCase, analyzer, reporter, configProvider);

  if (showHelp) {
    cli.printHelp();
    return;
  }

  // Run GAP scan with governance enforcement
  await runGovernedScript(
    {
      name: "gap-scan",
      type: "system-command",
      description: "GAP Scanner - System consistency validation",
      skipSnapshot: false,
      skipVerification: true,
    },
    async () => {
      await cli.run(options);
    },
  );
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ GAP Scanner failed:");
    console.error(error);
    process.exit(1);
  });
}

// Export for testing
export { GapScannerFactory, GapScannerCLI };
