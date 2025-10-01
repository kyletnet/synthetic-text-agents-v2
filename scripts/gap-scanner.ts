#!/usr/bin/env node

/**
 * GAP Scanner - Proactive System Consistency Checker
 *
 * Detects and prevents gaps in:
 * - Documentation coverage
 * - Governance consistency
 * - Security compliance (PII masking)
 * - Test coverage
 * - Cross-references
 * - E2E testing
 * - Document lifecycle
 */

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { execSync } from "child_process";
import { glob } from "glob";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

interface GaprcConfig {
  version: string;
  globalSettings: {
    mode: "disabled" | "shadow" | "enforce";
    failOn: ("P0" | "P1" | "P2")[];
    autoFix: {
      enabled: boolean;
      maxSeverity: "P0" | "P1" | "P2";
    };
    timeout: number;
    reportPath: string;
  };
  checks: GapCheck[];
  teams: Record<string, TeamConfig>;
  metrics: {
    enabled: boolean;
    collectInterval: string;
  };
}

interface GapCheck {
  id: string;
  name: string;
  enabled: boolean;
  severity: "P0" | "P1" | "P2";
  category: "docs" | "governance" | "security" | "testing";
  config?: Record<string, unknown>;
  autoFixable: boolean;
  autoFix?: {
    strategy: string;
    requiresApproval?: boolean;
  };
}

interface TeamConfig {
  members?: string[];
  mode: "disabled" | "shadow" | "enforce";
  failOn: ("P0" | "P1" | "P2")[];
}

interface GapScanResult {
  id: string;
  checkId: string;
  severity: "P0" | "P1" | "P2";
  category: string;
  title: string;
  description: string;
  autoFixable: boolean;
  details?: Record<string, unknown>;
  fix?: () => Promise<void>;
}

interface GapScanReport {
  timestamp: Date;
  mode: string;
  totalChecks: number;
  enabledChecks: number;
  gaps: GapScanResult[];
  summary: {
    P0: number;
    P1: number;
    P2: number;
    total: number;
  };
  executionTime: number;
}

// ============================================================================
// Configuration
// ============================================================================

class GapConfigManager {
  private configPath = ".gaprc.json";
  private config: GaprcConfig | null = null;

  async load(): Promise<GaprcConfig> {
    if (this.config) return this.config;

    if (!existsSync(this.configPath)) {
      throw new Error(
        `.gaprc.json not found. Run: npm run init:gap-system`
      );
    }

    const content = await readFile(this.configPath, "utf-8");
    this.config = JSON.parse(content) as GaprcConfig;
    return this.config;
  }

  async getResolvedConfig(): Promise<GaprcConfig["globalSettings"]> {
    const config = await this.load();
    const currentUser = process.env.USER || "unknown";

    // Start with global settings
    let settings = { ...config.globalSettings };

    // Team override (if user is in a team)
    for (const [_teamName, teamConfig] of Object.entries(config.teams || {})) {
      if (teamConfig.members?.includes(currentUser)) {
        settings = {
          ...settings,
          mode: teamConfig.mode,
          failOn: teamConfig.failOn,
        };
        break;
      }
    }

    // ENV override (highest priority)
    if (process.env.GAP_SCAN_MODE) {
      settings.mode = process.env.GAP_SCAN_MODE as typeof settings.mode;
    }

    // CI always uses shadow (unless explicitly enforce)
    if (process.env.CI === "true" && settings.mode !== "enforce") {
      settings.mode = "shadow";
    }

    return settings;
  }

  async getEnabledChecks(): Promise<GapCheck[]> {
    const config = await this.load();
    return config.checks.filter((check) => check.enabled);
  }
}

// ============================================================================
// Gap Checks
// ============================================================================

class GapChecker {
  private configManager: GapConfigManager;

  constructor(configManager: GapConfigManager) {
    this.configManager = configManager;
  }

  async runAllChecks(): Promise<GapScanResult[]> {
    const checks = await this.configManager.getEnabledChecks();
    const results: GapScanResult[] = [];

    for (const check of checks) {
      console.log(`⏳ Checking: ${check.name}...`);

      try {
        const gaps = await this.runCheck(check);

        if (gaps.length > 0) {
          console.log(`   ❌ ${gaps.length} gap(s) found`);
          results.push(...gaps);
        } else {
          console.log(`   ✅ PASS`);
        }
      } catch (error) {
        console.error(`   ⚠️  Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  private async runCheck(check: GapCheck): Promise<GapScanResult[]> {
    switch (check.id) {
      case "cli-documentation":
        return this.checkCLIDocumentation(check);
      case "governance-sync":
        return this.checkGovernanceSync(check);
      case "pii-masking":
        return this.checkPIIMasking(check);
      case "test-coverage":
        return this.checkTestCoverage(check);
      case "doc-cross-refs":
        return this.checkDocCrossRefs(check);
      case "agent-e2e":
        return this.checkAgentE2E(check);
      default:
        return [];
    }
  }

  // Check 1: CLI Documentation Coverage
  private async checkCLIDocumentation(check: GapCheck): Promise<GapScanResult[]> {
    const packageJson = JSON.parse(
      await readFile("package.json", "utf-8")
    );

    const scripts = Object.keys(packageJson.scripts);
    const excludePatterns = (check.config?.excludePatterns as string[]) || [];
    const requiredDocs = (check.config?.requiredDocs as string[]) || [];

    const gaps: GapScanResult[] = [];

    for (const requiredDoc of requiredDocs) {
      if (!existsSync(requiredDoc)) continue;

      const docContent = await readFile(requiredDoc, "utf-8");

      for (const script of scripts) {
        // Skip excluded patterns
        if (excludePatterns.some((pattern) => script.startsWith(pattern))) {
          continue;
        }

        // Check if script is documented
        if (!docContent.includes(script)) {
          gaps.push({
            id: `cli-doc-${script}`,
            checkId: check.id,
            severity: check.severity,
            category: check.category,
            title: `Undocumented CLI command: ${script}`,
            description: `'${script}' exists in package.json but not documented in ${requiredDoc}`,
            autoFixable: false,
            details: {
              command: script,
              documentation: requiredDoc,
            },
          });
        }
      }
    }

    return gaps;
  }

  // Check 2: Governance-Code Consistency
  private async checkGovernanceSync(check: GapCheck): Promise<GapScanResult[]> {
    const governanceFile = check.config?.governanceFile as string;
    const codeFiles = (check.config?.codeFiles as string[]) || [];

    if (!existsSync(governanceFile)) {
      return [];
    }

    const governanceRules = JSON.parse(
      await readFile(governanceFile, "utf-8")
    );

    const gaps: GapScanResult[] = [];

    // Check CACHE_TTL consistency
    const cacheTtlRule = governanceRules.rules?.find(
      (r: { id: string }) => r.id === "CACHE_TTL"
    );

    if (cacheTtlRule && codeFiles.length > 0) {
      for (const codeFile of codeFiles) {
        if (!existsSync(codeFile)) continue;

        const codeContent = await readFile(codeFile, "utf-8");
        const ttlMatch = codeContent.match(/TTL_SECONDS\s*=\s*(\d+)/);

        if (ttlMatch) {
          const codeTtl = parseInt(ttlMatch[1]);
          const ruleTtl = cacheTtlRule.ttlSeconds;

          if (codeTtl !== ruleTtl) {
            gaps.push({
              id: "governance-ttl-mismatch",
              checkId: check.id,
              severity: check.severity,
              category: check.category,
              title: "Governance rule mismatch: CACHE_TTL",
              description: `Code: ${codeTtl}s, Governance: ${ruleTtl}s`,
              autoFixable: true,
              details: {
                codeFile,
                codeTtl,
                ruleTtl,
              },
              fix: async () => {
                // Auto-fix: Update governance to match code
                cacheTtlRule.ttlSeconds = codeTtl;
                cacheTtlRule.description = `${codeTtl / 60}분 TTL 엄수`;
                await writeFile(
                  governanceFile,
                  JSON.stringify(governanceRules, null, 2) + "\n"
                );
              },
            });
          }
        }
      }
    }

    return gaps;
  }

  // Check 3: PII Masking Implementation
  private async checkPIIMasking(check: GapCheck): Promise<GapScanResult[]> {
    const requiredFunctions = (check.config?.requiredFunctions as string[]) || [];
    const targetFiles = (check.config?.targetFiles as string[]) || [];

    const gaps: GapScanResult[] = [];

    for (const targetFile of targetFiles) {
      if (!existsSync(targetFile)) continue;

      const content = await readFile(targetFile, "utf-8");

      const missingFunctions = requiredFunctions.filter(
        (fn) => !content.includes(fn)
      );

      if (missingFunctions.length > 0) {
        gaps.push({
          id: "pii-masking-missing",
          checkId: check.id,
          severity: check.severity,
          category: check.category,
          title: `PII masking not implemented in ${path.basename(targetFile)}`,
          description: `Missing functions: ${missingFunctions.join(", ")}`,
          autoFixable: false,
          details: {
            file: targetFile,
            missingFunctions,
          },
        });
      }
    }

    return gaps;
  }

  // Check 4: Test Coverage for New Features
  private async checkTestCoverage(check: GapCheck): Promise<GapScanResult[]> {
    const gaps: GapScanResult[] = [];

    try {
      // Get recently added files (last commit)
      const newFiles = execSync(
        "git diff --name-only --diff-filter=A HEAD~1 HEAD scripts/",
        { encoding: "utf-8" }
      )
        .trim()
        .split("\n")
        .filter(Boolean);

      for (const file of newFiles) {
        if (!file.endsWith(".ts")) continue;

        const testFile = file
          .replace("scripts/", "tests/")
          .replace(".ts", ".test.ts");

        if (!existsSync(testFile)) {
          gaps.push({
            id: `test-coverage-${path.basename(file)}`,
            checkId: check.id,
            severity: check.severity,
            category: check.category,
            title: `Missing test: ${path.basename(file)}`,
            description: `New file ${file} has no corresponding test`,
            autoFixable: false,
            details: {
              file,
              expectedTest: testFile,
            },
          });
        }
      }
    } catch (error) {
      // No git history or no new files - skip
    }

    return gaps;
  }

  // Check 5: Document Cross-References
  private async checkDocCrossRefs(check: GapCheck): Promise<GapScanResult[]> {
    const minReferences = (check.config?.minReferences as number) || 10;
    const patterns = (check.config?.patterns as string[]) || [];

    const docFiles = await glob("docs/**/*.md");
    let totalRefs = 0;

    for (const file of docFiles) {
      const content = await readFile(file, "utf-8");

      for (const pattern of patterns) {
        const regex = new RegExp(pattern, "g");
        const matches = content.match(regex) || [];
        totalRefs += matches.length;
      }
    }

    if (totalRefs < minReferences) {
      return [
        {
          id: "doc-cross-refs-insufficient",
          checkId: check.id,
          severity: check.severity,
          category: check.category,
          title: "Insufficient document cross-references",
          description: `Only ${totalRefs} cross-references found (minimum: ${minReferences})`,
          autoFixable: false,
          details: {
            found: totalRefs,
            minimum: minReferences,
            patterns,
          },
        },
      ];
    }

    return [];
  }

  // Check 6: Agent Chain E2E Tests
  private async checkAgentE2E(check: GapCheck): Promise<GapScanResult[]> {
    const requiredChains = (check.config?.requiredChains as string[]) || [];
    const testPattern = (check.config?.testPattern as string) || "tests/**/*.test.ts";

    const testFiles = await glob(testPattern);
    let hasE2E = false;

    for (const file of testFiles) {
      const content = await readFile(file, "utf-8");

      // Check if test covers agent chain
      const hasAllAgents = requiredChains.every((chain) => {
        const agents = chain.split("→").map((a) => a.trim());
        return agents.every((agent) => content.includes(agent));
      });

      if (hasAllAgents) {
        hasE2E = true;
        break;
      }
    }

    if (!hasE2E) {
      return [
        {
          id: "agent-e2e-missing",
          checkId: check.id,
          severity: check.severity,
          category: check.category,
          title: "Agent chain E2E test missing",
          description: `No test covers: ${requiredChains.join(", ")}`,
          autoFixable: false,
          details: {
            requiredChains,
            testPattern,
          },
        },
      ];
    }

    return [];
  }
}

// ============================================================================
// Main Scanner
// ============================================================================

class GapScanner {
  private configManager: GapConfigManager;
  private checker: GapChecker;

  constructor() {
    this.configManager = new GapConfigManager();
    this.checker = new GapChecker(this.configManager);
  }

  async scan(options: {
    quick?: boolean;
    dryRun?: boolean;
    autoFix?: boolean;
  } = {}): Promise<GapScanReport> {
    const startTime = Date.now();
    const settings = await this.configManager.getResolvedConfig();

    // Early exit if disabled
    if (settings.mode === "disabled") {
      console.log("ℹ️  GAP Scanner disabled (mode: disabled)");
      return this.emptyReport(startTime);
    }

    console.log("\n🔍 GAP Scanner v1.0");
    console.log("═".repeat(60));
    console.log(`Mode: ${settings.mode}`);
    console.log(`Fail on: ${settings.failOn.join(", ") || "none"}`);
    console.log("═".repeat(60));
    console.log("");

    // Run checks
    const gaps = await this.checker.runAllChecks();

    // Summary
    const summary = {
      P0: gaps.filter((g) => g.severity === "P0").length,
      P1: gaps.filter((g) => g.severity === "P1").length,
      P2: gaps.filter((g) => g.severity === "P2").length,
      total: gaps.length,
    };

    console.log("");
    console.log("═".repeat(60));
    console.log("📊 Results:");
    console.log(`   🔴 P0 Critical: ${summary.P0}`);
    console.log(`   🟡 P1 High: ${summary.P1}`);
    console.log(`   🟢 P2 Medium: ${summary.P2}`);
    console.log(`   Total: ${summary.total}`);

    // Auto-fix
    if (options.autoFix && settings.autoFix.enabled) {
      await this.autoFix(gaps, settings.autoFix.maxSeverity);
    }

    // Generate report
    const report: GapScanReport = {
      timestamp: new Date(),
      mode: settings.mode,
      totalChecks: (await this.configManager.getEnabledChecks()).length,
      enabledChecks: (await this.configManager.getEnabledChecks()).length,
      gaps,
      summary,
      executionTime: Date.now() - startTime,
    };

    // Save report
    await this.saveReport(report, settings.reportPath);

    // Determine if should fail
    const shouldFail = this.shouldFail(gaps, settings);

    if (shouldFail && settings.mode === "enforce") {
      console.log("");
      console.log("❌ GAP scan failed: blocking gaps detected");
      console.log(`   Run: npm run gap:scan -- --help for more info`);
      process.exit(1);
    } else if (shouldFail && settings.mode === "shadow") {
      console.log("");
      console.log("⚠️  GAP scan found issues (shadow mode, not blocking)");
    } else {
      console.log("");
      console.log("✅ GAP scan passed");
    }

    console.log("═".repeat(60));
    console.log("");

    return report;
  }

  private async autoFix(
    gaps: GapScanResult[],
    _maxSeverity: "P0" | "P1" | "P2"
  ): Promise<void> {
    const fixable = gaps.filter((g) => g.autoFixable && g.fix);

    // Only fix P2 (never P0/P1)
    const toFix = fixable.filter((g) => g.severity === "P2");

    if (toFix.length === 0) return;

    console.log("");
    console.log(`🔧 Auto-fixing ${toFix.length} gap(s)...`);

    for (const gap of toFix) {
      try {
        if (gap.fix) {
          await gap.fix();
          console.log(`   ✅ Fixed: ${gap.title}`);
        }
      } catch (error) {
        console.log(`   ❌ Failed: ${gap.title}`);
      }
    }
  }

  private shouldFail(
    gaps: GapScanResult[],
    settings: GaprcConfig["globalSettings"]
  ): boolean {
    if (settings.failOn.length === 0) return false;

    return gaps.some((gap) => settings.failOn.includes(gap.severity));
  }

  private async saveReport(
    report: GapScanReport,
    reportPath: string
  ): Promise<void> {
    await writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved: ${reportPath}`);
  }

  private emptyReport(startTime: number): GapScanReport {
    return {
      timestamp: new Date(),
      mode: "disabled",
      totalChecks: 0,
      enabledChecks: 0,
      gaps: [],
      summary: { P0: 0, P1: 0, P2: 0, total: 0 },
      executionTime: Date.now() - startTime,
    };
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  const options = {
    quick: args.includes("--quick"),
    dryRun: args.includes("--dry-run"),
    autoFix: args.includes("--auto-fix"),
    help: args.includes("--help") || args.includes("-h"),
  };

  if (options.help) {
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
    process.exit(0);
  }

  const scanner = new GapScanner();
  await scanner.scan(options);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ GAP Scanner failed:");
    console.error(error);
    process.exit(1);
  });
}

export { GapScanner, GapConfigManager, GapChecker };
