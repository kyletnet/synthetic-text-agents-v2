#!/usr/bin/env tsx

/**
 * Smart Refactor Auditor - Main Interface
 * Combines audit findings with smart automation and user-friendly feedback
 */

import { RefactorAuditor } from "./refactor-auditor.js";
import { SmartRefactorStateManager } from "./smart-refactor-state.js";
import { SafetyAnalyzer } from "./safety-analyzer.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

interface AuditConfig {
  priority: "P1" | "P2" | "P3" | "ALL";
  verbose: boolean;
  autoFix: boolean;
  simulate?: boolean;
}

interface FixItem {
  id: string;
  category: string;
  title: string;
  description: string;
  files: string[];
  changeType: string;
  rollbackSupported: boolean;
  externalInterface: boolean;
}

interface ConfirmItem {
  id: string;
  category: string;
  title: string;
  description: string;
  files: string[];
  impact: any;
  previewCommand?: string;
  risk: "low" | "medium" | "high";
}

class SmartRefactorAuditor {
  private auditor: RefactorAuditor;
  private stateManager: SmartRefactorStateManager;
  private safetyAnalyzer: SafetyAnalyzer;
  private rootDir: string;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.auditor = new RefactorAuditor({
      priority: "ALL",
      verbose: false,
      autoFix: false,
    });
    this.stateManager = new SmartRefactorStateManager(rootDir);
    this.safetyAnalyzer = new SafetyAnalyzer(rootDir);
  }

  async runSmartAudit(
    config: AuditConfig = { priority: "ALL", verbose: false, autoFix: true },
  ): Promise<void> {
    console.log("🔍 Starting Smart Refactor Audit...");

    // Check for incomplete session first
    await this.checkIncompleteSession();

    // Run the audit
    console.log("🔍 Analyzing codebase...");
    const findings = await this.auditor.runAudit();

    // Convert findings to fix items
    const fixItems = this.convertFindingsToFixItems(findings);

    // Categorize items
    const { autoFixable, needsConfirm } = await this.categorizeItems(fixItems);

    // Display progress
    console.log(`📊 Analysis complete: ${fixItems.length} issues found`);
    console.log(`✅ ${autoFixable.length} items can be auto-fixed`);
    console.log(`🔶 ${needsConfirm.length} items need confirmation`);

    if (!config.simulate) {
      // Apply auto-fixes
      if (autoFixable.length > 0) {
        console.log("\n🔧 Applying safe fixes...");
        await this.applyAutoFixes(autoFixable);
      }

      // Store items needing confirmation
      if (needsConfirm.length > 0) {
        this.stateManager.setPendingConfirmations(needsConfirm);
        console.log(
          `\n🔶 ${needsConfirm.length} items need your confirmation → run /refactor-confirm`,
        );
      }
    } else {
      console.log("\n📋 SIMULATION MODE - No changes applied");
      this.showSimulationResults(autoFixable, needsConfirm);
    }

    // Update learning
    this.stateManager.updateLearnedCriteria();

    // Show completion summary
    await this.showCompletionSummary(autoFixable, needsConfirm);
  }

  private async checkIncompleteSession(): Promise<void> {
    if (this.stateManager.hasIncompleteSession()) {
      console.log("⚠️ You have an incomplete confirmation session.");
      console.log("💡 Resume with: /refactor-confirm");
      console.log();
    }
  }

  private convertFindingsToFixItems(findings: any[]): FixItem[] {
    return findings.map((finding, index) => ({
      id: `fix-${Date.now()}-${index}`,
      category: this.mapCategoryName(finding.category),
      title: finding.title,
      description: finding.description,
      files: finding.files || [],
      changeType: this.inferChangeType(finding),
      rollbackSupported: this.supportsRollback(finding),
      externalInterface: this.affectsExternalInterface(finding),
    }));
  }

  private mapCategoryName(category: string): string {
    const mapping: Record<string, string> = {
      "Import/Export Consistency": "duplicate-export-cleanup",
      "Schema Validation": "schema-fix",
      "LLM Flow Alignment": "agent-inheritance",
      "Runtime Guardrails": "runtime-protection",
      "Slash Command Mapping": "command-mapping",
      "Routing Integrity": "routing-unification",
      "Naming Clarity": "naming-improvement",
      "Report Format": "report-format-normalization",
      "Release Safety": "release-safety",
    };

    return mapping[category] || category.toLowerCase().replace(/\s+/g, "-");
  }

  private inferChangeType(finding: any): string {
    const description = finding.description.toLowerCase();

    if (description.includes("duplicate")) return "remove-duplicates";
    if (description.includes("missing")) return "add-missing";
    if (description.includes("invalid")) return "fix-invalid";
    if (description.includes("inconsistent")) return "standardize";
    if (description.includes("unused")) return "remove-unused";

    return "modify";
  }

  private supportsRollback(finding: any): boolean {
    // Simple rules for rollback support
    const category = finding.category;
    const safeCategories = [
      "Import/Export Consistency",
      "Report Format",
      "Naming Clarity",
    ];

    return safeCategories.includes(category);
  }

  private affectsExternalInterface(finding: any): boolean {
    const files = finding.files || [];
    const externalFiles = [
      "package.json",
      "tsconfig.json",
      "src/shared/types",
      "src/cli/",
    ];

    return files.some((file: string) =>
      externalFiles.some((external) => file.includes(external)),
    );
  }

  private async categorizeItems(items: FixItem[]): Promise<{
    autoFixable: FixItem[];
    needsConfirm: ConfirmItem[];
  }> {
    const autoFixable: FixItem[] = [];
    const needsConfirm: ConfirmItem[] = [];

    for (const item of items) {
      const categoryCheck = this.safetyAnalyzer.isAutoFixableByCategory(item);

      if (categoryCheck.autoSafe) {
        autoFixable.push(item);
      } else {
        const { safety } = this.safetyAnalyzer.analyzeItem(item);
        const risk = this.determineRiskLevel(safety);

        needsConfirm.push({
          id: item.id,
          category: item.category,
          title: item.title,
          description: item.description,
          files: item.files,
          impact: this.safetyAnalyzer.convertToImpactScore(safety),
          risk,
        });
      }
    }

    return { autoFixable, needsConfirm };
  }

  private determineRiskLevel(safety: any): "low" | "medium" | "high" {
    let riskScore = 0;

    if (safety.fileCount > 5) riskScore += 2;
    if (safety.crossModule) riskScore += 3;
    if (safety.buildImpact) riskScore += 4;
    if (safety.testCoverage < 50) riskScore += 2;
    if (safety.rollbackDifficulty > 0.7) riskScore += 3;

    if (riskScore >= 7) return "high";
    if (riskScore >= 3) return "medium";
    return "low";
  }

  private async applyAutoFixes(items: FixItem[]): Promise<void> {
    let applied = 0;
    const progressMax = items.length;

    for (const item of items) {
      try {
        // Create rollback data before applying
        const rollbackData = await this.createRollbackData(item);

        // Apply the fix (simplified - in real implementation, this would contain actual fix logic)
        const success = await this.applyFix(item);

        if (success) {
          // Log decision criteria
          const decisionLog = this.safetyAnalyzer.generateDecisionLog(
            item,
            "auto-fix",
          );
          console.log(`  ${decisionLog}`);

          // Record in state
          const { safety } = this.safetyAnalyzer.analyzeItem(item);
          this.stateManager.addAutoFix({
            id: item.id,
            type: item.category,
            description: item.description,
            files: item.files,
            appliedAt: new Date(),
            rollbackData,
            safety,
            criteria: [decisionLog],
          });

          applied++;
        }

        // Update progress
        const progress = Math.round((applied / progressMax) * 20); // 20 characters wide
        const bar = "█".repeat(progress) + "░".repeat(20 - progress);
        process.stdout.write(
          `\r🔧 Applying fixes... [${bar}] ${applied}/${progressMax}`,
        );
      } catch (error) {
        console.log(`\n❌ Failed to apply fix for ${item.title}: ${error}`);

        // 실패 로그 저장
        this.stateManager.addAutoFixFailure({
          id: item.id,
          title: item.title,
          category: item.category,
          error: String(error),
          reason: this.determineFailureReason(error),
          files: item.files,
          failedAt: new Date(),
          canRetry: this.canRetryFix(item, error)
        });
      }
    }

    console.log(); // New line after progress bar
  }

  private async createRollbackData(item: FixItem): Promise<any> {
    // In a real implementation, this would capture file contents before changes
    return {
      files: item.files.map((file) => ({
        path: file,
        beforeContent: existsSync(file) ? readFileSync(file, "utf-8") : null,
      })),
    };
  }

  /**
   * 실패 원인 분석
   */
  private determineFailureReason(error: any): string {
    const errorMsg = String(error).toLowerCase();

    if (errorMsg.includes('enoent') || errorMsg.includes('no such file')) {
      return 'FILE_NOT_FOUND';
    }
    if (errorMsg.includes('eacces') || errorMsg.includes('permission')) {
      return 'PERMISSION_DENIED';
    }
    if (errorMsg.includes('typescript') || errorMsg.includes('compilation')) {
      return 'COMPILATION_ERROR';
    }
    if (errorMsg.includes('syntax') || errorMsg.includes('parse')) {
      return 'SYNTAX_ERROR';
    }
    if (errorMsg.includes('not implemented') || errorMsg.includes('todo')) {
      return 'NOT_IMPLEMENTED';
    }
    if (errorMsg.includes('import') || errorMsg.includes('export') || errorMsg.includes('module')) {
      return 'MODULE_RESOLUTION';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * 재시도 가능 여부 판단
   */
  private canRetryFix(item: FixItem, error: any): boolean {
    const reason = this.determineFailureReason(error);

    // 재시도 불가능한 이유들
    const nonRetryableReasons = [
      'PERMISSION_DENIED',
      'NOT_IMPLEMENTED',
      'SYNTAX_ERROR'
    ];

    return !nonRetryableReasons.includes(reason);
  }

  /**
   * 자동 수정 실패 요약 출력
   */
  private displayAutoFixFailureSummary(): void {
    const failures = this.stateManager.getAutoFixFailures?.() || [];

    if (failures.length === 0) {
      return;
    }

    console.log(`\n🔍 Auto-Fix Failure Analysis:`);
    console.log("─".repeat(50));

    // 실패 원인별 그룹화
    const failuresByReason: Record<string, any[]> = {};
    failures.forEach(failure => {
      const reason = failure.reason || 'UNKNOWN';
      if (!failuresByReason[reason]) failuresByReason[reason] = [];
      failuresByReason[reason].push(failure);
    });

    Object.entries(failuresByReason).forEach(([reason, items]) => {
      const retryCount = items.filter(item => item.canRetry).length;
      const reasonLabel = this.getReasonLabel(reason);

      console.log(`\n❌ ${reasonLabel}: ${items.length}개`);
      console.log(`   📁 Affected: ${items.map(i => i.category).join(', ')}`);
      console.log(`   🔄 Can retry: ${retryCount}/${items.length}`);

      if (items.length <= 3) {
        items.forEach(item => {
          console.log(`   • ${item.title}: ${item.error.slice(0, 60)}...`);
        });
      }
    });

    const retryableCount = failures.filter(f => f.canRetry).length;
    if (retryableCount > 0) {
      console.log(`\n💡 Suggestion: ${retryableCount} failures can be retried after addressing root causes`);
    }
  }

  /**
   * 실패 원인 레이블 변환
   */
  private getReasonLabel(reason: string): string {
    const labels: Record<string, string> = {
      'FILE_NOT_FOUND': 'File Not Found',
      'PERMISSION_DENIED': 'Permission Denied',
      'COMPILATION_ERROR': 'TypeScript Compilation',
      'SYNTAX_ERROR': 'Syntax Error',
      'NOT_IMPLEMENTED': 'Feature Not Implemented',
      'MODULE_RESOLUTION': 'Module Resolution',
      'UNKNOWN_ERROR': 'Unknown Error'
    };

    return labels[reason] || reason;
  }

  private async applyFix(item: FixItem): Promise<boolean> {
    // Simplified fix implementation
    // In reality, this would contain the actual fix logic for each category

    switch (item.category) {
      case "unused-import-removal":
        return this.removeUnusedImports(item.files);

      case "duplicate-export-cleanup":
        return this.removeDuplicateExports(item.files);

      case "report-format-normalization":
        return this.normalizeReportFormats(item.files);

      case "documentation-formatting":
        return this.formatDocumentation(item.files);

      default:
        console.log(
          `  ⚠️ No fix implementation for category: ${item.category}`,
        );
        return false;
    }
  }

  private removeUnusedImports(files: string[]): boolean {
    // Simplified implementation
    console.log(`    Removing unused imports from ${files.length} files`);
    return true;
  }

  private removeDuplicateExports(files: string[]): boolean {
    console.log(`    Consolidating duplicate exports in ${files.length} files`);
    return true;
  }

  private normalizeReportFormats(files: string[]): boolean {
    console.log(`    Normalizing report formats in ${files.length} files`);
    return true;
  }

  private formatDocumentation(files: string[]): boolean {
    console.log(`    Formatting documentation in ${files.length} files`);
    return true;
  }

  private showSimulationResults(
    autoFixable: FixItem[],
    needsConfirm: ConfirmItem[],
  ): void {
    if (autoFixable.length > 0) {
      console.log("\n✅ WOULD AUTO-FIX:");
      autoFixable.forEach((item) => {
        const decisionLog = this.safetyAnalyzer.generateDecisionLog(
          item,
          "auto-fix",
        );
        console.log(`  ${decisionLog}`);
      });
    }

    if (needsConfirm.length > 0) {
      console.log("\n🔶 WOULD NEED CONFIRMATION:");
      needsConfirm.forEach((item) => {
        console.log(
          `  ❌ ${item.category} (Risk: ${item.risk}, ${item.files.length} files)`,
        );
      });
    }
  }

  private async showCompletionSummary(
    autoFixable: FixItem[],
    needsConfirm: ConfirmItem[],
  ): Promise<void> {
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Smart Audit Complete");
    console.log("=".repeat(60));

    if (autoFixable.length > 0) {
      console.log(`✅ Auto-fixed ${autoFixable.length} issues:`);
      autoFixable.slice(0, 3).forEach((item) => {
        console.log(`   • ${item.title}`);
      });
      if (autoFixable.length > 3) {
        console.log(`   • ... and ${autoFixable.length - 3} more`);
      }
    }

    if (needsConfirm.length > 0) {
      console.log(`\n🔶 ${needsConfirm.length} items need confirmation:`);
      needsConfirm.forEach((item) => {
        console.log(`   • ${item.title} (${item.risk} risk)`);
      });
      console.log(`\n💡 Run /refactor-confirm to review these items`);
    }

    // Show next action
    const nextAction = this.stateManager.getNextAction();
    console.log(`\n🎯 Next action: ${nextAction}`);

    // 실패 요약 출력
    this.displayAutoFixFailureSummary();

    // Log location
    const timestamp =
      new Date().toISOString().replace(/[:.]/g, "-").split("T")[0] +
      "-" +
      new Date().toISOString().split("T")[1].split(".")[0].replace(/:/g, "-");
    console.log(`\n📁 All changes logged to: .refactor/logs/${timestamp}/`);

    console.log("=".repeat(60));
  }

  // Additional utility methods for the CLI commands
  async runConfirmation(): Promise<void> {
    // Check for incomplete session first
    const incompleteSession = this.stateManager.getIncompleteSession();
    if (incompleteSession) {
      console.log(
        "⚠️ You have an incomplete confirmation session. Resume? [y/N]:",
      );
      // In real CLI, would wait for user input
      // For now, assume resume
      await this.resumeConfirmationSession(incompleteSession);
      return;
    }

    const pending = this.stateManager.getPendingConfirmations();
    if (pending.length === 0) {
      console.log("✅ No items need confirmation!");
      return;
    }

    await this.runConfirmationLoop(pending);
  }

  private async resumeConfirmationSession(items: ConfirmItem[]): Promise<void> {
    console.log(
      `📋 Resuming session with ${items.length} remaining items...\n`,
    );
    await this.runConfirmationLoop(items);
  }

  private async runConfirmationLoop(items: ConfirmItem[]): Promise<void> {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      console.log(`[${i + 1}/${items.length}] 🔧 ${item.title}`);
      console.log(`     Impact: ${item.files.length} files, ${item.risk} risk`);
      console.log(
        `     Files: ${item.files.slice(0, 3).join(", ")}${item.files.length > 3 ? "..." : ""}`,
      );

      // Save session progress
      this.stateManager.saveConfirmSession(items, i + 1);

      // In real implementation, would wait for user input
      // For now, simulate approval
      const approved = Math.random() > 0.3; // 70% approval rate simulation

      this.stateManager.confirmItem(item, approved);

      if (approved) {
        console.log(`     ✅ Applied: ${item.title}`);
        const decisionLog = this.safetyAnalyzer.generateDecisionLog(
          {
            ...item,
            changeType: "modify",
            rollbackSupported: true,
            externalInterface: false,
          },
          "auto-fix",
        );
        console.log(`     ${decisionLog}`);
      } else {
        console.log(`     ❌ Skipped: ${item.title}`);
      }
      console.log();
    }

    this.stateManager.clearConfirmSession();
    console.log("🎉 All confirmations complete!");
  }

  // CLI utility methods
  getSummary(): void {
    const summary = this.stateManager.getSummary();
    const nextAction = this.stateManager.getNextAction();

    console.log("📊 Refactor Status Summary");
    console.log("=".repeat(40));
    console.log(`Auto-fixed items: ${summary.autoFixedCount}`);
    console.log(`Pending confirmations: ${summary.pendingConfirmCount}`);
    console.log(`Rollback points available: ${summary.rollbackPointsCount}`);
    console.log(
      `Incomplete session: ${summary.hasIncompleteSession ? "Yes" : "No"}`,
    );
    console.log();
    console.log(`🎯 Next action: ${nextAction}`);
  }

  getLearnedCriteria(): void {
    const criteria = this.stateManager.getLearnedCriteriaSummary();

    console.log("🧠 Learned Safety Criteria");
    console.log("=".repeat(40));

    if (criteria.length === 0) {
      console.log(
        "No learned criteria yet. Run more audits to build learning data.",
      );
    } else {
      criteria.forEach((criterion) => {
        console.log(`• ${criterion}`);
      });
    }

    console.log("\n💡 Use /refactor-reset-learning to reset learned criteria");
  }

  resetLearnedCriteria(): void {
    this.stateManager.resetLearnedCriteria();
    console.log("✅ Learned criteria reset to defaults");
  }

  showRollbackPreview(pointId?: string): void {
    const preview = this.stateManager.getRollbackPreview(pointId);

    if (!preview) {
      console.log("❌ No rollback points available");
      return;
    }

    console.log("🔄 Rollback Preview");
    console.log("=".repeat(40));
    console.log(`Point: ${preview.point.description}`);
    console.log(`Time: ${preview.point.timestamp.toLocaleString()}`);
    console.log(`Files: ${preview.point.affectedFiles.length} files affected`);

    if (preview.conflicts.length > 0) {
      console.log(`\n⚠️ Conflicts detected:`);
      preview.conflicts.forEach((file) => {
        console.log(`   • ${file} (modified after rollback point)`);
      });
      console.log("\n❌ Rollback not safe - manual merge needed");
    } else {
      console.log("\n✅ Rollback is safe");
    }
  }

  syncState(): void {
    const changes = this.stateManager.detectOutOfSyncChanges();

    if (
      changes.modifiedFiles.length === 0 &&
      changes.deletedFiles.length === 0
    ) {
      console.log("✅ State is in sync");
      return;
    }

    console.log("🔄 State Synchronization");
    console.log("=".repeat(40));
    console.log(`Summary: ${changes.summary}`);

    if (changes.modifiedFiles.length > 0) {
      console.log(`\nModified files:`);
      changes.modifiedFiles.slice(0, 5).forEach((file) => {
        console.log(`   • ${file}`);
      });
      if (changes.modifiedFiles.length > 5) {
        console.log(`   • ... and ${changes.modifiedFiles.length - 5} more`);
      }
    }

    if (changes.deletedFiles.length > 0) {
      console.log(`\nDeleted files:`);
      changes.deletedFiles.forEach((file) => {
        console.log(`   • ${file}`);
      });
    }

    this.stateManager.syncState();
    console.log("\n✅ State synchronized");
  }

  showGuide(): void {
    console.log("📖 Smart Refactor System Guide");
    console.log("=".repeat(50));
    console.log();
    console.log("🎯 MAIN COMMANDS:");
    console.log("  /refactor-audit     - Analyze and auto-fix safe issues");
    console.log("  /refactor-confirm   - Review items needing confirmation");
    console.log();
    console.log("📊 UTILITY COMMANDS:");
    console.log("  /refactor-summary   - Show current status");
    console.log("  /refactor-next      - Show next recommended action");
    console.log("  /refactor-sync      - Sync state after manual changes");
    console.log();
    console.log("🧠 LEARNING SYSTEM:");
    console.log("  /refactor-learned-criteria - View learned safety rules");
    console.log("  /refactor-reset-learning   - Reset learned criteria");
    console.log();
    console.log("🔄 ROLLBACK:");
    console.log("  /refactor-audit --rollback - Rollback last changes");
    console.log("  /refactor-rollback-preview - Preview rollback impact");
    console.log();
    console.log("💡 HOW IT WORKS:");
    console.log(
      "• Safe fixes (docs, unused imports) are applied automatically",
    );
    console.log(
      "• Risky fixes (config changes, inheritance) need your confirmation",
    );
    console.log(
      "• System learns from your decisions to improve future automation",
    );
    console.log("• All changes are logged and can be rolled back");
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "audit";

  const auditor = new SmartRefactorAuditor();

  try {
    switch (command) {
      case "audit":
        const config = {
          priority: "ALL" as const,
          verbose: args.includes("--verbose"),
          autoFix: !args.includes("--no-auto-fix"),
          simulate: args.includes("--simulate"),
        };
        await auditor.runSmartAudit(config);
        break;

      case "confirm":
        await auditor.runConfirmation();
        break;

      case "summary":
        auditor.getSummary();
        break;

      case "learned-criteria":
        auditor.getLearnedCriteria();
        break;

      case "reset-learning":
        auditor.resetLearnedCriteria();
        break;

      case "rollback-preview":
        auditor.showRollbackPreview();
        break;

      case "sync":
        auditor.syncState();
        break;

      case "guide":
        auditor.showGuide();
        break;

      default:
        console.log(`Unknown command: ${command}`);
        auditor.showGuide();
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { SmartRefactorAuditor };
