#!/usr/bin/env tsx

// @tool-mode: analyze
// @tool-description: Refactor preview - shows changes without applying them

/**
 * Refactor Preview Engine - Safe preview before applying changes
 *
 * Purpose:
 * - Show what /refactor will do WITHOUT making changes
 * - Display diff preview for each refactoring item
 * - Calculate impact score and risk assessment
 *
 * CRITICAL SAFETY:
 * - This is a READ-ONLY operation
 * - No files are modified
 * - User can review before running /refactor
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { InspectionCache } from "./lib/inspection-cache.js";
import { GovernanceRunner } from "./lib/governance/governance-runner.js";
import type { InspectionResults } from "./lib/inspection-schema.js";

class RefactorPreviewEngine {
  private cache: InspectionCache;
  private projectRoot: string;
  private governance: GovernanceRunner;

  constructor() {
    this.projectRoot = process.cwd();
    this.cache = new InspectionCache(this.projectRoot);
    this.governance = new GovernanceRunner(this.projectRoot);
  }

  /**
   * Main entry point: Preview refactoring changes
   */
  async runPreview(): Promise<void> {
    console.log("🔍 Refactor Preview Engine v1.0");
    console.log("═".repeat(60));
    console.log("📋 Dry-run mode - No changes will be applied\n");

    try {
      // Execute with governance (read-only)
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

          // 4. Analyze each item
          await this.analyzeItems(refactorItems);

          // 5. Show summary
          this.showSummary(refactorItems);
        },
        {
          name: "refactor-preview",
          type: "system-command",
          description: "Refactor preview (read-only dry-run)",
          skipSnapshot: true, // Read-only, no snapshot needed
          skipVerification: true, // No changes made
        },
      );
    } catch (error) {
      console.error("\n❌ Preview failed:");
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * Verify prerequisites
   */
  private verifyPrerequisites(): void {
    console.log("🔍 Checking prerequisites...\n");

    if (!this.cache.exists()) {
      console.error("❌ Error: No inspection cache found!");
      console.error(
        "\n⚠️  /refactor-preview를 실행하기 전에 /inspect를 먼저 실행하세요",
      );
      process.exit(1);
    }

    if (this.cache.isExpired()) {
      const age = this.cache.getAge();
      console.error(`⚠️  진단 결과가 오래되었습니다 (${age}분 전)`);
      console.error(
        "\n💡 /inspect를 다시 실행하여 최신 진단 결과를 생성하세요",
      );
      process.exit(1);
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
      process.exit(1);
    }

    return results;
  }

  /**
   * Extract refactoring items
   */
  private extractRefactorItems(results: InspectionResults): any[] {
    const refactorItem = results.manualApprovalNeeded.find(
      (item) => item.id === "refactor-pending",
    );

    if (!refactorItem) {
      return [];
    }

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
   * Analyze each refactoring item
   */
  private async analyzeItems(items: any[]): Promise<void> {
    console.log("📊 Refactoring Impact Analysis:\n");

    for (let i = 0; i < Math.min(items.length, 10); i++) {
      const item = items[i];
      console.log(`${i + 1}. ${item.description || item.id}`);
      console.log(`   Type: ${item.type || "unknown"}`);
      console.log(`   Files: ${item.files?.length || 0} affected`);

      // Calculate risk
      const risk = this.calculateRisk(item);
      const riskIcon = risk === "low" ? "🟢" : risk === "medium" ? "🟡" : "🔴";
      console.log(`   Risk: ${riskIcon} ${risk.toUpperCase()}`);

      // Show first few affected files
      if (item.files && item.files.length > 0) {
        console.log(`   Affected files:`);
        item.files.slice(0, 3).forEach((file: string) => {
          console.log(`     - ${file}`);
        });
        if (item.files.length > 3) {
          console.log(`     ... and ${item.files.length - 3} more`);
        }
      }

      console.log();
    }

    if (items.length > 10) {
      console.log(`... and ${items.length - 10} more items\n`);
    }
  }

  /**
   * Calculate risk level
   */
  private calculateRisk(item: any): "low" | "medium" | "high" {
    const fileCount = item.files?.length || 0;
    const affectsCore = item.files?.some((f: string) =>
      f.includes("src/core/"),
    );
    const affectsShared = item.files?.some((f: string) =>
      f.includes("src/shared/"),
    );

    if (fileCount > 10 || affectsCore) return "high";
    if (fileCount > 3 || affectsShared) return "medium";
    return "low";
  }

  /**
   * Show summary
   */
  private showSummary(items: any[]): void {
    const lowRisk = items.filter((i) => this.calculateRisk(i) === "low").length;
    const mediumRisk = items.filter(
      (i) => this.calculateRisk(i) === "medium",
    ).length;
    const highRisk = items.filter(
      (i) => this.calculateRisk(i) === "high",
    ).length;

    console.log("═".repeat(60));
    console.log("📊 Summary:\n");
    console.log(`   Total items: ${items.length}`);
    console.log(`   🟢 Low risk: ${lowRisk}`);
    console.log(`   🟡 Medium risk: ${mediumRisk}`);
    console.log(`   🔴 High risk: ${highRisk}`);

    console.log("\n💡 Next steps:");
    console.log("   1. Review the changes above");
    console.log("   2. Run /refactor to apply changes (with manual approval)");
    console.log("   3. After refactoring, run /inspect to verify");
    console.log("   4. Run tests: npm run test");
  }
}

// Main execution
async function main() {
  const engine = new RefactorPreviewEngine();
  await engine.runPreview();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
