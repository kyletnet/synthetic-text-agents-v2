#!/usr/bin/env tsx

// @tool-mode: transform
// @tool-description: Structural refactoring - architecture-level cross-module improvements

/**
 * Refactor Engine - Structural Improvement Handler
 *
 * Purpose:
 * - Execute architecture-level refactoring (cross-module issues)
 * - Integrates with SmartRefactorAuditor for safe automated improvements
 * - Uses GovernanceRunner for full observability
 *
 * Design (MECE):
 * - /maintain: Code style (Prettier, ESLint)
 * - /fix: Compilation errors (TypeScript, TODO markers)
 * - /refactor: Structural improvements (duplicate exports, config drift)
 *
 * Workflow:
 * 1. Read inspection cache (inspection-results.json)
 * 2. Check refactoringQueue from cache
 * 3. Execute SmartRefactorAuditor with governance
 * 4. Apply safe fixes, prompt for manual approval
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { InspectionCache } from "./lib/inspection-cache.js";
import { GovernanceRunner } from "./lib/governance/governance-runner.js";
import {
  createCodebaseSnapshot,
  validateInvariants,
  ALL_INVARIANTS,
} from "./lib/patterns/architecture-invariants.js";
import type { InspectionResults } from "./lib/inspection-schema.js";

class RefactorEngine {
  private cache: InspectionCache;
  private projectRoot: string;
  private governance: GovernanceRunner;

  constructor() {
    this.projectRoot = process.cwd();
    this.cache = new InspectionCache(this.projectRoot);
    this.governance = new GovernanceRunner(this.projectRoot);
  }

  /**
   * Main entry point: Run structural refactoring
   */
  async runRefactoring(): Promise<void> {
    console.log("🔧 Refactor Engine v1.0");
    console.log("═".repeat(60));
    console.log("📐 Structural Improvement - Architecture-level fixes");
    console.log("⏳ Starting refactoring workflow...\n");

    try {
      // Execute with governance enforcement
      await this.governance.executeWithGovernance(
        async () => {
          // 1. Verify prerequisites
          this.verifyPrerequisites();

          // 2. Load inspection cache
          const cachedResults = this.loadInspectionCache();

          // 3. Check refactoring queue
          const refactorItems = this.extractRefactorItems(cachedResults);

          if (refactorItems.length === 0) {
            console.log("✅ No refactoring items found. System is clean!");
            return;
          }

          // 4. Display refactoring plan
          this.displayRefactorPlan(refactorItems);

          // 5. Execute SmartRefactorAuditor
          await this.executeSmartRefactor();

          // 6. Re-validate architecture after refactoring (CRITICAL)
          console.log("\n🏛️  Re-validating architecture...");
          const architectureValid = await this.revalidateArchitecture();

          if (!architectureValid) {
            console.error(
              "\n❌ Architecture violations detected after refactoring!",
            );
            console.error(
              "⚠️  Refactoring may have introduced architectural issues",
            );
            console.error(
              "💡 Run: npm run _arch:validate for detailed analysis",
            );
            throw new Error(
              "Architecture validation failed after refactoring - P0 violations detected",
            );
          }

          // 7. Show results
          console.log("\n✅ Refactoring complete!");
          console.log("✅ Architecture validation passed");
          console.log(
            "💡 Next: Run /inspect to verify changes, then /ship to deploy",
          );
        },
        {
          name: "refactor",
          type: "system-command",
          description: "Structural refactoring (cross-module improvements)",
          skipSnapshot: false, // Capture snapshots for rollback
          skipVerification: false, // Verify changes
        },
      );
    } catch (error) {
      console.error("\n❌ Refactoring failed:");
      console.error(error);
      console.error("\n💡 Please review errors and try again");
      process.exit(1);
    }
  }

  /**
   * Verify prerequisites (must run /inspect first)
   */
  private verifyPrerequisites(): void {
    console.log("🔍 Checking prerequisites...\n");

    // Check if inspection cache exists
    if (!this.cache.exists()) {
      console.error("❌ Error: No inspection cache found!");
      console.error(
        "\n⚠️  /refactor를 실행하기 전에 /inspect를 먼저 실행하세요",
      );
      console.error("✅ 올바른 순서: /inspect → /maintain → /fix → /refactor");
      throw new Error(
        "Prerequisites not met: Inspection cache not found. Run /inspect first.",
      );
    }

    // Check cache freshness (30 min TTL)
    if (this.cache.isExpired()) {
      const age = this.cache.getAge();
      console.error(`⚠️  진단 결과가 오래되었습니다 (${age}분 전)`);
      console.error(
        "\n💡 /inspect를 다시 실행하여 최신 진단 결과를 생성하세요",
      );
      throw new Error(
        `Prerequisites not met: Inspection cache expired (${age} minutes old). Run /inspect again.`,
      );
    }

    console.log("✅ Prerequisites satisfied");
  }

  /**
   * Load inspection cache
   */
  private loadInspectionCache(): InspectionResults {
    console.log("📂 Loading inspection results...\n");

    const results = this.cache.load();
    if (!results) {
      console.error("❌ Failed to load inspection cache");
      throw new Error(
        "Failed to load inspection cache - file may be corrupted",
      );
    }

    return results;
  }

  /**
   * Extract refactoring items from inspection results
   */
  private extractRefactorItems(results: InspectionResults): any[] {
    const refactorItem = results.manualApprovalNeeded.find(
      (item) => item.id === "refactor-pending",
    );

    if (!refactorItem) {
      return [];
    }

    // Load .refactor/state.json for detailed items
    const refactorStatePath = join(this.projectRoot, ".refactor/state.json");
    if (!existsSync(refactorStatePath)) {
      return [];
    }

    try {
      const state = JSON.parse(readFileSync(refactorStatePath, "utf8"));
      return state.pending || [];
    } catch {
      return [];
    }
  }

  /**
   * Display refactoring plan
   */
  private displayRefactorPlan(items: any[]): void {
    console.log("📋 Refactoring Plan:");
    console.log(`   Total items: ${items.length}\n`);

    items.slice(0, 5).forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.description || item.id}`);
    });

    if (items.length > 5) {
      console.log(`   ... and ${items.length - 5} more items\n`);
    }
  }

  /**
   * Re-validate architecture after refactoring
   * CRITICAL: Ensures refactoring didn't introduce violations
   */
  private async revalidateArchitecture(): Promise<boolean> {
    try {
      const snapshot = createCodebaseSnapshot(this.projectRoot);
      const violations = validateInvariants(snapshot, ALL_INVARIANTS);

      if (violations.length === 0) {
        console.log("   ✅ No architecture violations");
        return true;
      }

      // Group by severity
      const p0 = violations.filter((v) => v.severity === "P0");
      const p1 = violations.filter((v) => v.severity === "P1");
      const p2 = violations.filter((v) => v.severity === "P2");

      console.log(
        `   ⚠️  Found violations: ${p0.length} P0, ${p1.length} P1, ${p2.length} P2`,
      );

      // P0 violations are blocking
      if (p0.length > 0) {
        console.error("   🔴 P0 (Critical) violations detected - BLOCKING");
        return false;
      }

      // P1 violations are warnings (non-blocking for refactor)
      if (p1.length > 0) {
        console.warn(
          "   🟡 P1 (High) violations detected - Review recommended",
        );
      }

      return true; // Allow P1/P2 violations for refactor
    } catch (error) {
      console.error(
        `   ❌ Architecture validation failed: ${(error as Error).message}`,
      );
      return false;
    }
  }

  /**
   * Execute SmartRefactorAuditor
   *
   * SAFETY: By default, only shows preview and prompts for confirmation.
   * Auto-fix is disabled to prevent unintended structural changes.
   */
  private async executeSmartRefactor(): Promise<void> {
    console.log("\n🚀 Executing smart refactoring...\n");

    // Dynamic import to avoid circular dependencies
    const { SmartRefactorAuditor } = await import(
      "./smart-refactor-auditor.js"
    );
    const auditor = new SmartRefactorAuditor(this.projectRoot);

    // CRITICAL: autoFix is FALSE by default for safety
    // This shows preview + prompts for confirmation instead of auto-applying
    await auditor.runSmartAudit({
      priority: "ALL",
      verbose: true,
      autoFix: false, // ✅ SAFETY: Require manual approval
      simulate: false, // Show actual items, not simulation
    });

    console.log(
      "\n💡 Next steps: Review proposed changes, then run tests to verify",
    );
  }
}

// Main execution
async function main() {
  const engine = new RefactorEngine();
  await engine.runRefactoring();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
