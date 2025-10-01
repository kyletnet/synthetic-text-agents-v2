/**
 * Post-Execution Verifier - Verify system integrity after operations
 *
 * Purpose:
 * - Verify no unexpected changes occurred
 * - Validate TypeScript compilation
 * - Check ESLint compliance
 * - Ensure system health
 *
 * Design:
 * - Snapshot-based verification
 * - Multiple validation layers
 * - Clear error reporting
 */

import { execSync } from "child_process";
import type { SystemSnapshot, SnapshotDiff } from "./snapshot.schema.js";
import { SnapshotManager } from "./snapshot-manager.js";
import { NotificationSystem } from "./notification-system.js";
import { VerificationError } from "./governance-types.js";

export interface VerificationContext {
  name: string;
  skipTypeScript?: boolean;
  skipESLint?: boolean;
  allowUnexpectedChanges?: boolean;
}

export class PostExecutionVerifier {
  private projectRoot: string;
  private snapshotManager: SnapshotManager;
  private notificationSystem: NotificationSystem;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.snapshotManager = new SnapshotManager(projectRoot);
    this.notificationSystem = new NotificationSystem(projectRoot);
  }

  /**
   * Verify system integrity after operation
   */
  async verify(
    beforeSnapshot: SystemSnapshot,
    afterSnapshot: SystemSnapshot,
    context: VerificationContext,
  ): Promise<void> {
    console.log(`\n🔍 Post-Execution Verification: ${context.name}`);
    console.log("═".repeat(60));

    // 1. Compare snapshots
    await this.verifySnapshots(beforeSnapshot, afterSnapshot, context);

    // 2. TypeScript compilation
    if (!context.skipTypeScript) {
      await this.verifyTypeScript();
    }

    // 3. ESLint
    if (!context.skipESLint) {
      await this.verifyESLint();
    }

    console.log("✅ Post-execution verification passed\n");
  }

  /**
   * Verify snapshots
   */
  private async verifySnapshots(
    before: SystemSnapshot,
    after: SystemSnapshot,
    context: VerificationContext,
  ): Promise<void> {
    console.log("   📸 Snapshot comparison...");

    const diff = await this.snapshotManager.compare(before, after);

    // Display changes
    this.displayDiff(diff);

    // Check unexpected changes
    if (!context.allowUnexpectedChanges && diff.unexpectedChanges.length > 0) {
      console.error("\n❌ Unexpected file changes detected:");

      diff.unexpectedChanges.forEach((change) => {
        console.error(`   ${this.getSeverityIcon(change.severity)} ${change.path}`);
        console.error(`      ${change.reason}`);

        // Notify
        this.notificationSystem.notifyUnexpectedChange(change);
      });

      throw new VerificationError(
        "Unexpected changes detected during operation",
        diff,
      );
    }

    console.log("      ✓ Snapshot verification passed");
  }

  /**
   * Display diff summary
   */
  private displayDiff(diff: SnapshotDiff): void {
    if (diff.summary.totalFilesChanged === 0 && diff.dependenciesChanged.length === 0) {
      console.log("      ℹ️  No changes detected");
      return;
    }

    console.log(`      ℹ️  Changes detected:`);

    if (diff.filesAdded.length > 0) {
      console.log(`         + ${diff.filesAdded.length} file(s) added`);
    }

    if (diff.filesModified.length > 0) {
      console.log(`         ~ ${diff.filesModified.length} file(s) modified`);
    }

    if (diff.filesDeleted.length > 0) {
      console.log(`         - ${diff.filesDeleted.length} file(s) deleted`);
    }

    if (diff.dependenciesChanged.length > 0) {
      console.log(`         📦 ${diff.dependenciesChanged.length} dependency(ies) changed`);
    }

    console.log(`      Risk level: ${diff.summary.riskLevel.toUpperCase()}`);
  }

  /**
   * Verify TypeScript compilation
   */
  private async verifyTypeScript(): Promise<void> {
    console.log("   📘 TypeScript compilation...");

    try {
      execSync("npm run typecheck", {
        stdio: "pipe",
        cwd: this.projectRoot,
        timeout: 120000, // 2 minutes
      });

      console.log("      ✓ TypeScript passed");
    } catch (error) {
      const output = (error as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() || "";
      const errorCount = (output.match(/error TS/g) || []).length;

      console.error(`      ❌ TypeScript failed: ${errorCount} error(s)`);

      throw new VerificationError(
        `TypeScript compilation failed after operation (${errorCount} errors)`,
      );
    }
  }

  /**
   * Verify ESLint
   */
  private async verifyESLint(): Promise<void> {
    console.log("   🔍 ESLint...");

    try {
      execSync("npm run lint", {
        stdio: "pipe",
        cwd: this.projectRoot,
        timeout: 60000, // 1 minute
      });

      console.log("      ✓ ESLint passed");
    } catch (error) {
      const output = (error as { stdout?: Buffer; stderr?: Buffer }).stdout?.toString() || "";
      const warningCount = (output.match(/warning/g) || []).length;
      const errorCount = (output.match(/error/g) || []).length;

      if (errorCount > 0) {
        console.error(`      ❌ ESLint failed: ${errorCount} error(s)`);
        throw new VerificationError(
          `ESLint validation failed after operation (${errorCount} errors)`,
        );
      }

      if (warningCount > 0) {
        console.warn(`      ⚠️  ESLint warnings: ${warningCount}`);
      } else {
        console.log("      ✓ ESLint passed");
      }
    }
  }

  /**
   * Quick validation (non-throwing)
   */
  async validate(
    before: SystemSnapshot,
    after: SystemSnapshot,
    context: VerificationContext,
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      await this.verify(before, after, context);
      return { valid: true, errors, warnings };
    } catch (error) {
      errors.push((error as Error).message);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: string): string {
    const icons = {
      critical: "🔴",
      high: "🟡",
      medium: "🟠",
      low: "🔵",
    };
    return icons[severity as keyof typeof icons] || "⚪";
  }
}

/**
 * Global singleton instance
 */
let globalPostExecutionVerifier: PostExecutionVerifier | null = null;

export function getPostExecutionVerifier(
  projectRoot?: string,
): PostExecutionVerifier {
  if (!globalPostExecutionVerifier) {
    globalPostExecutionVerifier = new PostExecutionVerifier(projectRoot);
  }
  return globalPostExecutionVerifier;
}
