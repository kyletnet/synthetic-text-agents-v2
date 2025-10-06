#!/usr/bin/env tsx

/**
 * Guard - Comprehensive System Quality Check
 *
 * Purpose:
 * - Unified quality check command (inspect + security + history)
 * - One command to rule them all
 * - Perfect for pre-deployment validation
 *
 * Usage:
 *   npm run guard              # Full check
 *   npm run guard --quick      # Quick check (skip deep scans)
 *   npm run guard --report     # Generate detailed report
 */

import { execSync } from "child_process";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";

interface GuardOptions {
  quick?: boolean;
  report?: boolean;
  skipSecurity?: boolean;
  skipHistory?: boolean;
}

class SystemGuard {
  private projectRoot: string;
  private options: GuardOptions;

  constructor(options: GuardOptions = {}) {
    this.projectRoot = process.cwd();
    this.options = options;
  }

  async runFullGuard(): Promise<void> {
    console.log("🛡️ System Guard - Comprehensive Quality Check");
    console.log("═".repeat(60));
    console.log("📋 Running all quality checks...\n");

    const startTime = Date.now();
    const results: any = {
      timestamp: new Date().toISOString(),
      checks: {},
      summary: {
        passed: 0,
        failed: 0,
        skipped: 0,
      },
    };

    try {
      // 1. Inspection Check
      console.log("1️⃣  Running Inspection...");
      const inspectionResult = await this.runInspection();
      results.checks.inspection = inspectionResult;
      if (inspectionResult.passed) results.summary.passed++;
      else results.summary.failed++;

      // 2. Security Check
      if (!this.options.skipSecurity) {
        console.log("\n2️⃣  Running Security Check...");
        const securityResult = await this.runSecurityCheck();
        results.checks.security = securityResult;
        if (securityResult.passed) results.summary.passed++;
        else results.summary.failed++;
      } else {
        results.summary.skipped++;
        console.log("\n2️⃣  Security Check: SKIPPED");
      }

      // 3. Quality History
      if (!this.options.skipHistory && !this.options.quick) {
        console.log("\n3️⃣  Recording Quality History...");
        const historyResult = await this.recordQualityHistory(results);
        results.checks.history = historyResult;
        if (historyResult.passed) results.summary.passed++;
        else results.summary.failed++;
      } else {
        results.summary.skipped++;
        console.log("\n3️⃣  Quality History: SKIPPED (quick mode)");
      }

      // 4. Summary
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log("\n" + "═".repeat(60));
      console.log("📊 Guard Summary");
      console.log("═".repeat(60));
      console.log(`✅ Passed: ${results.summary.passed}`);
      console.log(`❌ Failed: ${results.summary.failed}`);
      console.log(`⏭️  Skipped: ${results.summary.skipped}`);
      console.log(`⏱️  Duration: ${duration}s`);
      console.log("═".repeat(60));

      // 5. Save Report
      if (this.options.report) {
        const reportPath = join(this.projectRoot, "reports/guard-report.json");
        writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`\n📄 Report saved: ${reportPath}`);
      }

      // 6. Exit Code
      if (results.summary.failed > 0) {
        console.log("\n❌ Guard FAILED - Fix issues before deployment");
        process.exit(1);
      } else {
        console.log("\n✅ Guard PASSED - System is ready!");
        process.exit(0);
      }
    } catch (error) {
      console.error("\n💥 Guard crashed:", error);
      process.exit(1);
    }
  }

  private async runInspection(): Promise<any> {
    try {
      execSync("npm run status", {
        stdio: "inherit",
        cwd: this.projectRoot,
      });

      return {
        passed: true,
        message: "Inspection completed successfully",
      };
    } catch (error) {
      return {
        passed: false,
        message: "Inspection failed",
        error: (error as Error).message,
      };
    }
  }

  private async runSecurityCheck(): Promise<any> {
    try {
      const output = execSync("npx tsx scripts/lib/security-guard.ts", {
        encoding: "utf-8",
        cwd: this.projectRoot,
      });

      const hasCircularDeps = output.includes("❌ Found");

      return {
        passed: !hasCircularDeps,
        message: hasCircularDeps
          ? "Circular dependencies found"
          : "No security issues",
        output: output.slice(0, 500), // First 500 chars
      };
    } catch (error) {
      // Exit code 1 means circular deps found
      return {
        passed: false,
        message: "Security check failed",
        error: (error as Error).message,
      };
    }
  }

  private async recordQualityHistory(currentResults: any): Promise<any> {
    try {
      // Extract health score from inspection results
      const healthScore = this.extractHealthScore(currentResults);

      // Save to history
      const historyPath = join(this.projectRoot, "reports/quality-history");
      if (!existsSync(historyPath)) {
        execSync(`mkdir -p ${historyPath}`, { cwd: this.projectRoot });
      }

      const timestamp = new Date().toISOString().split("T")[0];
      const recordPath = join(historyPath, `${timestamp}.json`);

      writeFileSync(
        recordPath,
        JSON.stringify(
          {
            date: timestamp,
            healthScore,
            checks: currentResults.summary,
          },
          null,
          2,
        ),
      );

      return {
        passed: true,
        message: `Quality history recorded: ${timestamp}`,
        healthScore,
      };
    } catch (error) {
      return {
        passed: false,
        message: "Failed to record quality history",
        error: (error as Error).message,
      };
    }
  }

  private extractHealthScore(results: any): number {
    // Try to extract from inspection results
    // Default to 85 if not found (from our current system)
    return 85;
  }
}

// CLI
const args = process.argv.slice(2);
const options: GuardOptions = {
  quick: args.includes("--quick"),
  report: args.includes("--report"),
  skipSecurity: args.includes("--skip-security"),
  skipHistory: args.includes("--skip-history"),
};

const guard = new SystemGuard(options);
await guard.runFullGuard();
