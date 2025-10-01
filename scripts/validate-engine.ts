#!/usr/bin/env tsx

/**
 * Validate Engine - Governance rules validation
 *
 * Purpose:
 * - Validate governance-rules.json schema
 * - Check for legacy imports
 * - Verify cache consistency
 * - Display governance status
 *
 * Usage:
 * - npm run validate
 * - /validate (Claude Code command)
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import { LegacyImportChecker } from "./lib/governance/check-legacy-imports.js";
import { InspectionCache } from "./lib/inspection-cache.js";
import { RiskDomainRegistry } from "./lib/governance/risk-domain-registry.js";
import { LoopDetector } from "./lib/governance/loop-detector.js";
import { GovernanceEnforcer } from "./lib/governance/governance-enforcer.js";
import { runGovernedScript } from "./lib/governance/governed-script.js";
import type { GovernanceRulesConfig } from "./lib/governance/governance-types.js";

class ValidateEngine {
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * Main entry point
   */
  async run(): Promise<void> {
    console.log("🔍 Governance Validation Engine");
    console.log("═".repeat(60));

    let hasErrors = false;

    try {
      // 1. Validate governance-rules.json
      console.log("\n📋 Validating governance-rules.json...");
      const rulesValid = await this.validateGovernanceRules();
      if (!rulesValid) hasErrors = true;

      // 2. Check legacy imports
      console.log("\n🔍 Checking legacy imports...");
      const importsValid = await this.checkLegacyImports();
      if (!importsValid) hasErrors = true;

      // 3. Validate inspection cache
      console.log("\n📦 Validating inspection cache...");
      const cacheValid = await this.validateInspectionCache();
      if (!cacheValid) hasErrors = true;

      // 4. Enforce governance on all engines 🆕
      console.log("\n⚖️  Governance enforcement...");
      const enforcementValid = await this.enforceGovernance();
      if (!enforcementValid) hasErrors = true;

      // 5. Display governance status
      console.log("\n📊 Governance Status...");
      await this.displayGovernanceStatus();

      // Summary
      console.log("\n" + "═".repeat(60));
      if (hasErrors) {
        console.error("❌ Validation failed with errors");
        throw new Error("Validation failed with errors");
      } else {
        console.log("✅ All validations passed");
        console.log("\n💡 Governance system is healthy");
      }
    } catch (error) {
      console.error("\n❌ Validation failed with critical error:");
      console.error(error);
      throw error;
    }
  }

  /**
   * Validate governance-rules.json
   */
  private async validateGovernanceRules(): Promise<boolean> {
    const rulesPath = join(this.projectRoot, "governance-rules.json");

    if (!existsSync(rulesPath)) {
      console.error("   ❌ governance-rules.json not found");
      return false;
    }

    try {
      const content = readFileSync(rulesPath, "utf8");
      const rules = JSON.parse(content) as GovernanceRulesConfig;

      // Check schema version
      if (!rules.schemaVersion) {
        console.error("   ❌ Missing schemaVersion");
        return false;
      }

      if (rules.schemaVersion !== "2025-10-governance-v1") {
        console.warn(
          `   ⚠️  Schema version ${rules.schemaVersion} (expected 2025-10-governance-v1)`,
        );
      }

      // Check required sections
      const requiredSections = [
        "rules",
        "timeoutPolicy",
        "loopDetection",
        "notifications",
        "riskDomains",
        "deprecatedFiles",
      ];

      for (const section of requiredSections) {
        if (!(section in rules)) {
          console.error(`   ❌ Missing required section: ${section}`);
          return false;
        }
      }

      // Count enabled rules
      const enabledRules = rules.rules.filter((r) => r.enabled);
      console.log(`   ✓ Schema version: ${rules.schemaVersion}`);
      console.log(
        `   ✓ Enabled rules: ${enabledRules.length}/${rules.rules.length}`,
      );
      console.log(`   ✓ Risk domains: ${rules.riskDomains.length}`);
      console.log(`   ✓ Deprecated files: ${rules.deprecatedFiles.length}`);

      return true;
    } catch (error) {
      console.error(`   ❌ Invalid JSON: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Check for legacy imports
   */
  private async checkLegacyImports(): Promise<boolean> {
    const checker = new LegacyImportChecker(this.projectRoot);

    // Scan src/ and scripts/
    const patterns = ["src/**/*.ts", "scripts/**/*.ts"];
    const excludePatterns = [
      "node_modules/**",
      "dist/**",
      "**/*.test.ts",
      "scripts/lib/governance/**", // Exclude governance system itself
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = glob.sync(pattern, {
        cwd: this.projectRoot,
        ignore: excludePatterns,
        nodir: true,
      });
      files.push(...matches.map((f) => join(this.projectRoot, f)));
    }

    const warnings = checker.checkMultiple(files);

    if (warnings.length === 0) {
      console.log("   ✓ No legacy imports detected");
      return true;
    }

    console.warn(`   ⚠️  Found ${warnings.length} legacy import(s):`);
    checker.displayWarnings(warnings);

    // Legacy imports are warnings, not errors
    return true;
  }

  /**
   * Validate inspection cache
   */
  private async validateInspectionCache(): Promise<boolean> {
    const cache = new InspectionCache(this.projectRoot);
    const validation = cache.validateCache();

    if (!validation.valid) {
      if (validation.reason === "missing") {
        console.log("   ℹ️  No inspection cache (run: npm run status)");
      } else if (validation.reason === "expired") {
        const age = validation.ageSeconds || 0;
        console.warn(`   ⚠️  Cache expired (${Math.floor(age / 60)}min ago)`);
        console.log("   💡 Run: npm run status");
      } else {
        console.error("   ❌ Cache corrupted");
        return false;
      }
      return true; // Not an error, just informational
    }

    const age = cache.getCacheAge();
    console.log(`   ✓ Cache valid (${age})`);

    if (validation.results) {
      console.log(
        `   ✓ Health score: ${validation.results.summary.healthScore}/100`,
      );
      console.log(
        `   ✓ Auto-fixable: ${validation.results.summary.autoFixableCount}`,
      );
      console.log(
        `   ✓ Needs approval: ${validation.results.summary.manualApprovalCount}`,
      );
    }

    return true;
  }

  /**
   * Enforce governance on all engines 🆕
   */
  private async enforceGovernance(): Promise<boolean> {
    const enforcer = new GovernanceEnforcer(this.projectRoot);
    const result = await enforcer.enforce();

    if (result.violations.length === 0) {
      console.log(
        `   ✓ All ${result.summary.total} engines are governance-compliant`,
      );
      return true;
    }

    console.error(
      `   ❌ ${result.violations.length} governance violation(s) found`,
    );
    result.violations.forEach((v) => {
      console.error(`      - ${v.file}: ${v.reason}`);
    });

    return false;
  }

  /**
   * Display governance status
   */
  private async displayGovernanceStatus(): Promise<void> {
    // Risk domains
    const riskRegistry = new RiskDomainRegistry(this.projectRoot);
    const risks = riskRegistry.getAllRiskDomains();

    const criticalRisks = risks.filter((r) => r.severity === "critical").length;
    const highRisks = risks.filter((r) => r.severity === "high").length;

    console.log(`   📊 Risk domains: ${risks.length} total`);
    console.log(`      🔴 Critical: ${criticalRisks}`);
    console.log(`      🟡 High: ${highRisks}`);

    // Loop detection status
    const loopDetector = new LoopDetector(this.projectRoot);
    const loopStats = loopDetector.getStatistics();

    console.log(`   📊 Loop detection:`);
    console.log(`      Active loops: ${loopStats.activeLoops}`);
    console.log(`      Total iterations: ${loopStats.totalIterations}`);
  }

  /**
   * Display help
   */
  displayHelp(): void {
    console.log("\n📚 Validation Commands:");
    console.log("   npm run validate   - Validate governance system");
    console.log("   npm run verify     - Full system integrity check");
    console.log("   npm run status     - Run inspection (creates cache)");
    console.log("\n📖 Documentation:");
    console.log("   docs/GOVERNANCE_PHILOSOPHY.md");
    console.log("   docs/MIGRATION_V2.md");
  }
}

// Main execution with governance
await runGovernedScript(
  {
    name: "validate",
    type: "system-command",
    description: "Governance system validation",
    skipSnapshot: false, // Capture snapshots for validation tracking
    skipVerification: true, // Skip verification (read-only validation)
  },
  async () => {
    const engine = new ValidateEngine();
    await engine.run();
  },
);
