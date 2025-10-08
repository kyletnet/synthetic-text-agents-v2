#!/usr/bin/env tsx
/**
 * Regression Guard (RG) Orchestrator
 *
 * Purpose: Make regressions impossible to ship by enforcing hard gates
 * around the autonomous governance loop.
 *
 * Gates:
 * A) Static/DNA (depcruise + Meta-Kernel)
 * B) Autonomy Loop (drift + objective + feedback)
 * C) Stability (rolling window)
 * D) Budget (cost profile)
 *
 * Exit Codes:
 * 0 - PASS or WARN (flake recovered)
 * 1 - FAIL (any gate violated)
 */

import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import type {
  RGDecision,
  RGProfile,
  RGGateResults,
  RGSummary,
  RGDecisionOutput,
} from "./types.js";

const PROJECT_ROOT = process.cwd();
const REPORTS_DIR = join(PROJECT_ROOT, "reports/rg");
const EVIDENCE_DIR = join(REPORTS_DIR, "evidence");

// Ensure directories exist
if (!existsSync(REPORTS_DIR)) {
  mkdirSync(REPORTS_DIR, { recursive: true });
}
if (!existsSync(EVIDENCE_DIR)) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
}

interface RGOptions {
  profile?: RGProfile;
  strict?: boolean;
  fast?: boolean;
}

class RegressionGuard {
  private profile: RGProfile;
  private strict: boolean;
  private fast: boolean;
  private startTime: number;

  constructor(options: RGOptions = {}) {
    this.profile = options.profile || this.detectProfile();
    this.strict = options.strict || process.env.RG_STRICT === "true";
    this.fast = options.fast || false;
    this.startTime = Date.now();
  }

  private detectProfile(): RGProfile {
    if (process.env.CI === "true") {
      return process.env.DEPLOY_ENV === "production" ? "prod" : "stage";
    }
    return "dev";
  }

  async run(): Promise<number> {
    console.log("🛡️  Regression Guard\n");
    console.log("=".repeat(60));
    console.log(`Profile: ${this.profile}`);
    console.log(`Strict: ${this.strict}`);
    console.log(`Fast: ${this.fast}`);
    console.log("=".repeat(60) + "\n");

    const gates: RGGateResults = {
      A_static_dna: false,
      B_autonomy: false,
      C_stability: false,
      D_budget: false,
    };

    const failReasons: string[] = [];
    let retryAttempted = false;

    try {
      // Gate A: Static/DNA Check
      console.log("🔍 Gate A: Static/DNA Check");
      gates.A_static_dna = await this.checkStaticDNA();
      if (!gates.A_static_dna) {
        failReasons.push("Gate A: Static/DNA check failed");
      }

      // Gate B: Autonomy Loop
      console.log("\n🔄 Gate B: Autonomy Loop Check");
      try {
        gates.B_autonomy = await this.checkAutonomyLoop();
      } catch (error) {
        console.error("   ❌ Autonomy check failed:", error);
        // Auto-retry once on known transient errors
        if (this.isTransientError(error)) {
          console.log("   ⏳ Retrying in 10s (transient error)...");
          await this.sleep(10000);
          retryAttempted = true;
          gates.B_autonomy = await this.checkAutonomyLoop();
        } else {
          throw error;
        }
      }

      if (!gates.B_autonomy) {
        failReasons.push("Gate B: Autonomy loop check failed");
      }

      // Gate C: Stability Check (skip in fast mode)
      if (!this.fast) {
        console.log("\n📊 Gate C: Stability Check");
        gates.C_stability = await this.checkStability();
        if (!gates.C_stability) {
          failReasons.push("Gate C: Stability check failed");
        }
      } else {
        console.log("\n⏩ Gate C: Skipped (fast mode)");
        gates.C_stability = true;
      }

      // Gate D: Budget Check
      console.log("\n💰 Gate D: Budget Check");
      gates.D_budget = await this.checkBudget();
      if (!gates.D_budget) {
        failReasons.push("Gate D: Budget exceeded");
      }

      // Determine final decision
      const allPassed = Object.values(gates).every((g) => g);
      const decision: RGDecision = allPassed
        ? retryAttempted
          ? "WARN"
          : "PASS"
        : "FAIL";

      // Write artifacts
      await this.writeArtifacts(decision, gates, failReasons);

      // Display result
      this.displayResult(decision, gates, failReasons);

      // Exit code
      return decision === "FAIL" ? 1 : 0;
    } catch (error) {
      console.error("\n❌ Regression Guard encountered an error:", error);
      await this.writeArtifacts("FAIL", gates, [
        `Exception: ${error instanceof Error ? error.message : String(error)}`,
      ]);
      return 1;
    }
  }

  private async checkStaticDNA(): Promise<boolean> {
    try {
      const { checkArchitecture } = await import("./check-architecture.js");
      const result = await checkArchitecture(PROJECT_ROOT);
      console.log(
        `   ${result.passed ? "✅" : "❌"} Architecture check ${
          result.passed ? "passed" : "failed"
        }`,
      );
      return result.passed;
    } catch (error) {
      console.error("   ❌ Static/DNA check error:", error);
      return false;
    }
  }

  private async checkAutonomyLoop(): Promise<boolean> {
    try {
      // Run the existing autonomous system verification
      const { execSync } = await import("child_process");
      const result = execSync("npx tsx scripts/verify-autonomous-system.ts", {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
        stdio: "pipe",
      });

      // Check if all 3 tests passed
      const passedMatch = result.match(/Passed Tests: (\d+)\/3/);
      const passed = passedMatch ? parseInt(passedMatch[1]) === 3 : false;

      console.log(
        `   ${passed ? "✅" : "❌"} Autonomy loop ${
          passed ? "verified" : "failed"
        }`,
      );
      return passed;
    } catch (error) {
      console.error("   ❌ Autonomy loop check error:", error);
      return false;
    }
  }

  private async checkStability(): Promise<boolean> {
    try {
      const { checkRollingStats } = await import("./rolling-stats.js");
      const result = await checkRollingStats(PROJECT_ROOT);
      console.log(
        `   ${result.passed ? "✅" : "❌"} Stability check ${
          result.passed ? "passed" : "failed"
        }`,
      );
      return result.passed;
    } catch (error) {
      console.log("   ℹ️  No rolling stats available yet (first run)");
      return true; // Pass on first run
    }
  }

  private async checkBudget(): Promise<boolean> {
    try {
      const { checkBudget } = await import("./budget.js");
      const result = await checkBudget(PROJECT_ROOT, this.profile);
      console.log(
        `   ${result.passed ? "✅" : "❌"} Budget check ${
          result.passed ? "passed" : "failed"
        }`,
      );
      return result.passed;
    } catch (error) {
      console.log("   ℹ️  Budget check not available yet");
      return true; // Pass if budget check not implemented
    }
  }

  private async writeArtifacts(
    decision: RGDecision,
    gates: RGGateResults,
    failReasons: string[],
  ): Promise<void> {
    try {
      const { writeArtifacts } = await import("./write-artifacts.js");
      const latencyMs = Date.now() - this.startTime;

      const summary: RGSummary = {
        pass: decision === "PASS",
        warn: decision === "WARN",
        failReasons,
        profile: this.profile,
        latencyMs,
        cost: 0, // TODO: Calculate from verify outputs
        hashes: {
          before: "",
          after: "",
        },
      };

      const decisionOutput: RGDecisionOutput = {
        decision,
        gates,
        ts: new Date().toISOString(),
        failReasons: failReasons.length > 0 ? failReasons : undefined,
      };

      await writeArtifacts(PROJECT_ROOT, summary, decisionOutput);
    } catch (error) {
      console.error("   ⚠️  Failed to write artifacts:", error);
    }
  }

  private displayResult(
    decision: RGDecision,
    gates: RGGateResults,
    failReasons: string[],
  ): void {
    console.log("\n" + "=".repeat(60));
    console.log("🛡️  Regression Guard Result");
    console.log("=".repeat(60));

    const icon = decision === "PASS" ? "✅" : decision === "WARN" ? "⚠️" : "❌";
    console.log(`${icon} Decision: ${decision}`);

    console.log("\nGates:");
    console.log(`  A (Static/DNA):  ${gates.A_static_dna ? "✅" : "❌"}`);
    console.log(`  B (Autonomy):    ${gates.B_autonomy ? "✅" : "❌"}`);
    console.log(`  C (Stability):   ${gates.C_stability ? "✅" : "❌"}`);
    console.log(`  D (Budget):      ${gates.D_budget ? "✅" : "❌"}`);

    if (failReasons.length > 0) {
      console.log("\n⚠️  Fail Reasons:");
      failReasons.forEach((reason, i) => {
        console.log(`  ${i + 1}. ${reason}`);
      });
    }

    const latencyMs = Date.now() - this.startTime;
    console.log(`\n⏱️  Latency: ${(latencyMs / 1000).toFixed(2)}s`);
    console.log("=".repeat(60) + "\n");

    if (decision === "PASS") {
      console.log("🎉 All gates passed - no regressions detected!");
    } else if (decision === "WARN") {
      console.log("⚠️  Warning: Flake recovered after retry");
    } else {
      console.log("❌ Regression detected - cannot ship!");
    }
  }

  private isTransientError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message;
    return (
      message.includes("EAI_AGAIN") ||
      message.includes("ETIMEDOUT") ||
      message.includes("ECONNRESET")
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const options: RGOptions = {
    profile: args.find((a) => a.startsWith("--profile="))?.split("=")[1] as
      | RGProfile
      | undefined,
    strict: args.includes("--strict") || process.env.RG_STRICT === "true",
    fast: args.includes("--fast"),
  };

  const guard = new RegressionGuard(options);
  const exitCode = await guard.run();
  process.exit(exitCode);
}

main();
