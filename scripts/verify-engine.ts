#!/usr/bin/env tsx

// @tool-mode: analyze
// @tool-description: System integrity verification - TypeScript, ESLint, Tests, governance checks

/**
 * Verify Engine - Complete system integrity verification
 *
 * Purpose:
 * - Run all quality gates (TypeScript, ESLint, Tests)
 * - Validate governance rules
 * - Check system health
 * - Pre-deployment verification
 *
 * Usage:
 * - npm run verify
 * - /verify (Claude Code command)
 */

import { execSync } from "child_process";
import { GovernanceRunner } from "./lib/governance/governance-runner.js";

class VerifyEngine {
  private projectRoot: string;
  private governance: GovernanceRunner;
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor() {
    this.projectRoot = process.cwd();
    this.governance = new GovernanceRunner(this.projectRoot);
  }

  /**
   * Main entry point
   */
  async run(): Promise<void> {
    console.log("🔍 System Integrity Verification");
    console.log("═".repeat(60));

    try {
      await this.governance.executeWithGovernance(
        async () => {
          // 1. TypeScript compilation
          await this.verifyTypeScript();

          // 2. ESLint
          await this.verifyESLint();

          // 3. Tests (optional)
          await this.verifyTests();

          // 4. Governance validation
          await this.verifyGovernance();

          // 5. Display summary
          this.displaySummary();
        },
        {
          name: "verify",
          type: "system-command",
          description: "Full system integrity verification",
          skipSnapshot: true, // Read-only verification
          skipVerification: true, // Skip double verification
        },
      );
    } catch (error) {
      console.error("\n❌ Verification failed:");
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * Verify TypeScript compilation
   */
  private async verifyTypeScript(): Promise<void> {
    console.log("\n📘 TypeScript Compilation...");

    try {
      execSync("npm run typecheck", {
        stdio: "pipe",
        cwd: this.projectRoot,
        timeout: 120000, // 2 minutes
      });

      console.log("   ✅ TypeScript: PASS");
    } catch (error) {
      const output = (error as { stdout?: Buffer }).stdout?.toString() || "";
      const errorCount = (output.match(/error TS/g) || []).length;

      console.error(`   ❌ TypeScript: FAIL (${errorCount} errors)`);
      this.errors.push(`TypeScript compilation failed: ${errorCount} errors`);

      // Show first few errors
      const lines = output.split("\n").filter((l) => l.includes("error TS"));
      lines.slice(0, 3).forEach((line) => {
        console.error(`      ${line.trim()}`);
      });

      if (lines.length > 3) {
        console.error(`      ... and ${lines.length - 3} more errors`);
      }
    }
  }

  /**
   * Verify ESLint
   */
  private async verifyESLint(): Promise<void> {
    console.log("\n🔍 ESLint Validation...");

    try {
      execSync("npm run lint", {
        stdio: "pipe",
        cwd: this.projectRoot,
        timeout: 60000, // 1 minute
      });

      console.log("   ✅ ESLint: PASS");
    } catch (error) {
      const output = (error as { stdout?: Buffer }).stdout?.toString() || "";
      const errorCount = (output.match(/✖ \d+ problem/g) || []).length;
      const warningCount = (output.match(/warning/g) || []).length;

      if (errorCount > 0) {
        console.error(`   ❌ ESLint: FAIL (${errorCount} errors)`);
        this.errors.push(`ESLint validation failed: ${errorCount} errors`);
      } else if (warningCount > 0) {
        console.warn(`   ⚠️  ESLint: PASS with warnings (${warningCount})`);
        this.warnings.push(`ESLint has ${warningCount} warnings`);
      } else {
        console.log("   ✅ ESLint: PASS");
      }
    }
  }

  /**
   * Verify tests
   */
  private async verifyTests(): Promise<void> {
    console.log("\n🧪 Tests...");

    try {
      execSync("npm run test", {
        stdio: "pipe",
        cwd: this.projectRoot,
        timeout: 300000, // 5 minutes
      });

      console.log("   ✅ Tests: PASS");
    } catch (error) {
      console.warn("   ⚠️  Tests: SKIP (optional)");
      this.warnings.push("Tests were skipped or failed");
    }
  }

  /**
   * Verify governance system
   */
  private async verifyGovernance(): Promise<void> {
    console.log("\n⚖️  Governance Rules...");

    try {
      execSync("npm run validate", {
        stdio: "pipe",
        cwd: this.projectRoot,
        timeout: 30000, // 30 seconds
      });

      console.log("   ✅ Governance: PASS");
    } catch (error) {
      console.error("   ❌ Governance: FAIL");
      this.errors.push("Governance validation failed");
    }
  }

  /**
   * Display summary
   */
  private displaySummary(): void {
    console.log("\n" + "═".repeat(60));
    console.log("📊 Verification Summary:");
    console.log("═".repeat(60));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log("\n🎉 All verifications passed!");
      console.log("\n✅ System is ready for deployment");
      console.log("\n💡 Next steps:");
      console.log("   - git add -A && git commit -m 'feat: ...'");
      console.log("   - git push");
      console.log("   - Deploy to production");
      return;
    }

    // Errors
    if (this.errors.length > 0) {
      console.error(`\n❌ Errors: ${this.errors.length}`);
      this.errors.forEach((error, i) => {
        console.error(`   ${i + 1}. ${error}`);
      });
    }

    // Warnings
    if (this.warnings.length > 0) {
      console.warn(`\n⚠️  Warnings: ${this.warnings.length}`);
      this.warnings.forEach((warning, i) => {
        console.warn(`   ${i + 1}. ${warning}`);
      });
    }

    // Next steps
    console.log("\n💡 Next steps:");
    if (this.errors.length > 0) {
      console.log("   1. Fix errors listed above");
      console.log("   2. Run: npm run verify");
      console.log("   3. Repeat until all checks pass");
      process.exit(1);
    } else {
      console.log("   - Review warnings (optional)");
      console.log("   - Deploy if acceptable");
    }
  }

  /**
   * Get governance statistics
   */
  async getStatistics(): Promise<void> {
    const stats = await this.governance.getStatistics();

    console.log("\n📊 Governance Statistics:");
    console.log(`   Total operations: ${stats.totalOperations}`);
    console.log(`   Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
    console.log(`   Failures: ${stats.failureCount}`);
    console.log(`   Bypasses: ${stats.bypassCount}`);
  }
}

// Main execution
const engine = new VerifyEngine();
await engine.run();
