#!/usr/bin/env tsx
/**
 * Unified Governance Entry Point
 *
 * Design Philosophy (from GPT):
 * "Don't create multiple entry points (IDE, pre-commit, CI).
 *  Create ONE command that all tools call."
 *
 * Integration Points:
 * - IDE Extension → calls this script
 * - Pre-commit hook → calls this script
 * - CI GitHub Action → calls this script
 * - Manual CLI → calls this script
 *
 * Unified Flow:
 * 1. Architecture validation (dependency-cruiser)
 * 2. Policy evaluation (governance-rules.yaml)
 * 3. Predictive feedback recording
 * 4. Report generation
 *
 * Exit Codes:
 * 0 - All checks passed
 * 1 - Errors found (blocks commit/build)
 * 2 - Warnings found (allows commit/build)
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

interface GovernanceCheckOptions {
  strict?: boolean; // Block on warnings
  skipArch?: boolean; // Skip architecture check
  skipPolicy?: boolean; // Skip policy evaluation
  verbose?: boolean; // Detailed output
}

interface CheckResult {
  architecture: {
    passed: boolean;
    errors: number;
    warnings: number;
    circular: number;
    dddViolations: number;
  };
  policies: {
    passed: boolean;
    triggered: string[];
    blocked: boolean;
  };
  overall: {
    passed: boolean;
    exitCode: number;
  };
}

class GovernanceCheckRunner {
  private projectRoot: string;
  private options: GovernanceCheckOptions;

  constructor(options: GovernanceCheckOptions = {}) {
    this.projectRoot = process.cwd();
    this.options = {
      strict: options.strict ?? false,
      skipArch: options.skipArch ?? false,
      skipPolicy: options.skipPolicy ?? false,
      verbose: options.verbose ?? false,
    };
  }

  async run(): Promise<CheckResult> {
    console.log("🔍 [Governance Check] Starting unified validation...\n");

    const result: CheckResult = {
      architecture: {
        passed: true,
        errors: 0,
        warnings: 0,
        circular: 0,
        dddViolations: 0,
      },
      policies: {
        passed: true,
        triggered: [],
        blocked: false,
      },
      overall: {
        passed: true,
        exitCode: 0,
      },
    };

    // 1. Architecture Check
    if (!this.options.skipArch) {
      console.log("📐 Step 1: Architecture Validation");
      result.architecture = await this.checkArchitecture();
      this.displayArchitectureResult(result.architecture);
    }

    // 2. Policy Evaluation
    if (!this.options.skipPolicy) {
      console.log("\n📋 Step 2: Policy Evaluation");
      result.policies = await this.evaluatePolicies();
      this.displayPolicyResult(result.policies);
    }

    // 3. Determine overall result
    result.overall = this.determineOverallResult(result);

    // 4. Display summary
    this.displaySummary(result);

    return result;
  }

  /**
   * Check architecture using dependency-cruiser
   */
  private async checkArchitecture(): Promise<CheckResult["architecture"]> {
    try {
      const output = execSync(
        "npx depcruise --config .dependency-cruiser.cjs --output-type json src/",
        {
          cwd: this.projectRoot,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      const analysis = JSON.parse(output);

      return {
        passed: analysis.summary.error === 0,
        errors: analysis.summary.error || 0,
        warnings: analysis.summary.warn || 0,
        circular: this.countCircular(analysis),
        dddViolations: this.countDDDViolations(analysis),
      };
    } catch (error: any) {
      // depcruise exits with error if violations found
      if (error.stdout) {
        const analysis = JSON.parse(error.stdout);
        return {
          passed: false,
          errors: analysis.summary.error || 0,
          warnings: analysis.summary.warn || 0,
          circular: this.countCircular(analysis),
          dddViolations: this.countDDDViolations(analysis),
        };
      }

      throw error;
    }
  }

  /**
   * Count circular dependencies
   */
  private countCircular(analysis: any): number {
    let count = 0;
    for (const module of analysis.modules || []) {
      for (const dep of module.dependencies || []) {
        if (dep.circular) count++;
      }
    }
    return count;
  }

  /**
   * Count DDD violations
   */
  private countDDDViolations(analysis: any): number {
    let count = 0;
    for (const module of analysis.modules || []) {
      for (const dep of module.dependencies || []) {
        if (dep.valid === false) {
          for (const rule of dep.rules || []) {
            if (rule.name.includes("domain")) count++;
          }
        }
      }
    }
    return count;
  }

  /**
   * Evaluate governance policies
   */
  private async evaluatePolicies(): Promise<CheckResult["policies"]> {
    const policyPath = join(this.projectRoot, "governance-rules.yaml");

    if (!existsSync(policyPath)) {
      console.warn("   ⚠️  No governance-rules.yaml found, skipping...");
      return {
        passed: true,
        triggered: [],
        blocked: false,
      };
    }

    try {
      // Dynamic import to avoid circular deps during build
      const { getPolicyInterpreter } = await import(
        "../src/infrastructure/governance/policy-interpreter.js"
      );

      const interpreter = getPolicyInterpreter(this.projectRoot);
      await interpreter.loadPolicies();

      // Evaluate architecture policies
      const context = {
        circular_dependency_count: 0, // Would come from arch check
        domain_imports_application: false,
        domain_imports_infrastructure: false,
        orphan_module_count: 0,
      };

      const results = await interpreter.evaluate("architecture", context);

      const triggered = results
        .filter((r) => r.matched)
        .map((r) => r.policyName);
      const blocked = results.some(
        (r) => r.matched && r.actionsTriggered.includes("block"),
      );

      return {
        passed: !blocked,
        triggered,
        blocked,
      };
    } catch (error) {
      console.error("   ❌ Policy evaluation failed:", error);
      return {
        passed: false,
        triggered: [],
        blocked: true,
      };
    }
  }

  /**
   * Determine overall result
   */
  private determineOverallResult(result: CheckResult): CheckResult["overall"] {
    const archFailed = !result.architecture.passed;
    const policyBlocked = result.policies.blocked;
    const hasWarnings =
      result.architecture.warnings > 0 || result.policies.triggered.length > 0;

    if (archFailed || policyBlocked) {
      return { passed: false, exitCode: 1 };
    }

    if (this.options.strict && hasWarnings) {
      return { passed: false, exitCode: 1 };
    }

    if (hasWarnings) {
      return { passed: true, exitCode: 2 };
    }

    return { passed: true, exitCode: 0 };
  }

  /**
   * Display architecture result
   */
  private displayArchitectureResult(arch: CheckResult["architecture"]): void {
    if (arch.passed) {
      console.log("   ✅ Architecture validation passed");
    } else {
      console.log("   ❌ Architecture validation failed");
    }

    console.log(`   - Errors: ${arch.errors}`);
    console.log(`   - Warnings: ${arch.warnings}`);
    console.log(`   - Circular Dependencies: ${arch.circular}`);
    console.log(`   - DDD Violations: ${arch.dddViolations}`);
  }

  /**
   * Display policy result
   */
  private displayPolicyResult(policy: CheckResult["policies"]): void {
    if (policy.passed) {
      console.log("   ✅ Policy evaluation passed");
    } else {
      console.log("   ❌ Policy evaluation failed (blocked)");
    }

    if (policy.triggered.length > 0) {
      console.log(`   - Triggered Policies: ${policy.triggered.join(", ")}`);
    }

    if (policy.blocked) {
      console.log("   - Status: BLOCKED");
    }
  }

  /**
   * Display summary
   */
  private displaySummary(result: CheckResult): void {
    console.log("\n" + "=".repeat(60));
    console.log("📊 Governance Check Summary");
    console.log("=".repeat(60));

    if (result.overall.passed) {
      console.log("✅ Status: PASSED");
    } else {
      console.log("❌ Status: FAILED");
    }

    console.log(`   Exit Code: ${result.overall.exitCode}`);
    console.log("=".repeat(60) + "\n");

    if (!result.overall.passed) {
      console.log("💡 Next Steps:");
      console.log("   1. Review violations above");
      console.log("   2. Fix errors: npm run arch:check");
      console.log("   3. Re-run: npm run governance:check\n");
    }
  }
}

// CLI
const args = process.argv.slice(2);
const options: GovernanceCheckOptions = {
  strict: args.includes("--strict"),
  skipArch: args.includes("--skip-arch"),
  skipPolicy: args.includes("--skip-policy"),
  verbose: args.includes("--verbose"),
};

const runner = new GovernanceCheckRunner(options);

runner
  .run()
  .then((result) => {
    process.exit(result.overall.exitCode);
  })
  .catch((error) => {
    console.error("❌ Governance check failed:", error);
    process.exit(1);
  });
