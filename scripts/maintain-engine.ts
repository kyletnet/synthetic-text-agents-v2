#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


// @tool-mode: transform
// @tool-description: Automated maintenance - Prettier, ESLint auto-fix, self-validation

/**
 * Maintain Engine - Auto-fix only (no user approval)
 *
 * GPT Advice:
 * "maintain and fix must reuse the cached inspection results for consistency"
 * "Respect TTL (5 min) for inspection cache"
 *
 * Design:
 * 1. Enforce /inspect must run first (via cache validation)
 * 2. Read autoFixable items from cache
 * 3. Execute auto-fixes without user approval
 * 4. Display results
 *
 * This file NEVER diagnoses. It only reads from inspection-results.json.
 */

import { execSync } from "child_process";
import { InspectionCache } from "./lib/inspection-cache.js";
import { GovernanceRunner } from "./lib/governance/governance-runner.js";
import { SafeExecutor } from "./lib/governance/safe-executor.js";
import { LoopDetector } from "./lib/governance/loop-detector.js";
import type { AutoFixableItem } from "./lib/inspection-schema.js";

class MaintainEngine {
  private cache: InspectionCache;
  private governance: GovernanceRunner;
  private safeExecutor: SafeExecutor;
  private loopDetector: LoopDetector;
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.cache = new InspectionCache(this.projectRoot);
    this.governance = new GovernanceRunner(this.projectRoot);
    this.safeExecutor = new SafeExecutor(this.projectRoot);
    this.loopDetector = new LoopDetector(this.projectRoot);
  }

  /**
   * Main entry point
   */
  async run(): Promise<void> {
    console.log("🔧 Maintain Engine - Auto-fix + Self-Validation");
    console.log("═".repeat(60));
    console.log("⏳ Starting maintenance workflow...\n");

    try {
      // Run with governance enforcement
      await this.governance.executeWithGovernance(
        async () => {
          // 1. Enforce /inspect first (GPT Advice)
          console.log("📋 Step 1/4: Checking inspection results...");
          this.cache.enforceInspectFirst("maintain");

          // 2. Load cached results
          const validation = this.cache.validateCache();
          if (!validation.valid || !validation.results) {
            console.error(
              "\n❌ Internal error: cache validation passed but no results",
            );
            process.exit(1);
          }

          const { results } = validation;
          const age = this.cache.getCacheAge();
          console.log(`✅ Using inspection results from ${age}`);

          // 3. Check if there are auto-fixable items
          if (results.autoFixable.length === 0) {
            console.log("\n✨ No auto-fixable items found!");
            console.log("\n💡 Next: npm run fix (manual approval items)");
            return;
          }

          console.log(
            `\n🔧 Found ${results.autoFixable.length} auto-fixable items`,
          );

          // 4. Execute auto-fixes
          console.log("\n⚙️  Step 2/4: Executing auto-fixes...");
          await this.executeAutoFixes(results.autoFixable);

          // 5. Self-Validation 🆕
          console.log("\n🔍 Step 3/4: Self-validation...");
          await this.selfValidateWithRetry();

          // 6. Display summary
          console.log("\n📊 Step 4/4: Summary");
          this.showSummary(results.autoFixable);

          // 7. Show next steps
          this.showNextSteps(results.manualApprovalNeeded.length);
        },
        {
          name: "maintain",
          type: "system-command",
          description: "Auto-fix with self-validation",
          skipSnapshot: false, // Capture before/after
          skipVerification: false, // Verify changes
        },
      );
    } catch (error) {
      console.error("\n❌ Maintain engine failed with critical error:");
      console.error(error);
      console.error("\n💡 Please report this error to the development team");
      process.exit(1);
    }
  }

  /**
   * Execute all auto-fixes
   */
  private async executeAutoFixes(items: AutoFixableItem[]): Promise<void> {
    let successCount = 0;
    const failedItems: Array<{ item: AutoFixableItem; error: string }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      console.log(`[${i + 1}/${items.length}] ${item.description}`);
      console.log(`   → ${item.command}`);

      try {
        const startTime = Date.now();
        execSync(item.command, {
          stdio: "inherit",
          cwd: process.cwd(),
          timeout: 120000, // 2분 타임아웃
        });
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   ✅ Completed (${duration}s)\n`);
        successCount++;
      } catch (error: any) {
        const errorMsg = error.message || "Unknown error";
        console.log(`   ❌ Failed: ${errorMsg}\n`);
        failedItems.push({ item, error: errorMsg });
      }
    }

    console.log("\n" + "═".repeat(60));
    console.log(`✅ Success: ${successCount}`);

    if (failedItems.length > 0) {
      console.log(`\n🔴 Failed: ${failedItems.length}`);
      console.log("\n❌ Failed Items (need manual attention):");
      console.log("═".repeat(60));
      failedItems.forEach(({ item, error }, i) => {
        console.log(`\n${i + 1}. ${item.description}`);
        console.log(`   Command: ${item.command}`);
        console.log(`   Error: ${error.substring(0, 200)}`);
        console.log(`   💡 Suggested: Run command manually to see full error`);
      });
    }
  }

  /**
   * Self-Validation with retry logic 🆕
   */
  private async selfValidateWithRetry(maxRetries = 3): Promise<void> {
    console.log("\n🔄 Self-Validation...");
    console.log("═".repeat(60));

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Checkpoint for loop detection
      this.loopDetector.checkpoint("self-validation", maxRetries);

      const validation = await this.safeExecutor.execute(
        async () => {
          // TypeScript check
          const tsResult = this.checkTypeScript();

          // ESLint check
          const lintResult = this.checkESLint();

          return { ts: tsResult, lint: lintResult };
        },
        { type: "validation" },
      );

      // Check if passed
      if (!validation.ts.hasErrors && !validation.lint.hasErrors) {
        console.log(
          `✅ Self-validation passed (attempt ${attempt}/${maxRetries})\n`,
        );
        this.loopDetector.reset("self-validation");
        return;
      }

      // Auto-fix if possible
      if (validation.lint.autoFixable && attempt < maxRetries) {
        console.log(
          `🔧 Retry ${attempt}/${maxRetries}: Auto-fixing validation issues...`,
        );

        try {
          execSync("npm run lint:fix", {
            stdio: "inherit",
            cwd: this.projectRoot,
          });
        } catch (error) {
          console.error(`   ❌ Auto-fix failed: ${(error as Error).message}`);
        }
      } else {
        console.error(`❌ Self-validation failed after ${attempt} attempt(s)`);
        console.error("   TypeScript errors:", validation.ts.errorCount || 0);
        console.error("   ESLint errors:", validation.lint.errorCount || 0);

        if (attempt === maxRetries) {
          throw new Error(
            "Self-validation failed: Manual intervention required",
          );
        }
      }
    }
  }

  /**
   * Check TypeScript compilation
   */
  private checkTypeScript(): { hasErrors: boolean; errorCount: number } {
    try {
      execSync("npm run typecheck", { stdio: "pipe", cwd: this.projectRoot });
      return { hasErrors: false, errorCount: 0 };
    } catch (error) {
      const output = (error as { stdout?: Buffer }).stdout?.toString() || "";
      const errorCount = (output.match(/error TS/g) || []).length;
      return { hasErrors: true, errorCount };
    }
  }

  /**
   * Check ESLint
   */
  private checkESLint(): {
    hasErrors: boolean;
    errorCount: number;
    autoFixable: boolean;
  } {
    try {
      execSync("npm run lint", { stdio: "pipe", cwd: this.projectRoot });
      return { hasErrors: false, errorCount: 0, autoFixable: false };
    } catch (error) {
      const output = (error as { stdout?: Buffer }).stdout?.toString() || "";
      const errorCount = (output.match(/error/g) || []).length;
      const warningCount = (output.match(/warning/g) || []).length;

      return {
        hasErrors: errorCount > 0,
        errorCount,
        autoFixable: warningCount > 0 && errorCount === 0,
      };
    }
  }

  /**
   * Show summary
   */
  private showSummary(items: AutoFixableItem[]): void {
    console.log("\n📊 Auto-fix Summary:");
    console.log(`   Total items: ${items.length}`);
    console.log(
      `   Estimated time saved: ${items.reduce(
        (sum, item) => sum + (item.estimatedDuration || 0),
        0,
      )}s`,
    );
  }

  /**
   * Show next steps
   */
  private showNextSteps(manualCount: number): void {
    console.log("\n🚀 Recommended Next Steps:");
    console.log("═".repeat(60));

    if (manualCount > 0) {
      console.log(
        `\n1️⃣  Fix ${manualCount} critical issues (manual approval):`,
      );
      console.log(`   npm run fix`);
      console.log("\n2️⃣  Optional: Check for refactoring needs:");
      console.log("   /inspect (re-run to detect refactoring)");
      console.log("\n3️⃣  Deploy:");
      console.log("   npm run ship");
    } else {
      console.log("\n✅ All auto-fixable issues resolved!");
      console.log("\n1️⃣  Optional: Check for refactoring needs:");
      console.log("   /inspect (re-run to detect refactoring)");
      console.log("\n2️⃣  Deploy:");
      console.log("   npm run ship");
    }

    console.log(
      "\n📋 Workflow: /inspect → /maintain → /fix → [/refactor] → /ship",
    );
  }
}

// Main execution
const engine = new MaintainEngine();
await engine.run();
