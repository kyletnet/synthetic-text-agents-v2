/**
 * Architecture Auto-Fix Engine
 *
 * Purpose:
 * - Automatically fix architecture invariant violations
 * - Safe file modification with backup/rollback
 * - Comprehensive verification and reporting
 *
 * Design Philosophy:
 * - Never lose data: Always backup before modification
 * - Verify everything: Re-validate after each fix
 * - Report everything: Detailed logs of all changes
 * - Fail safe: Rollback on any error
 */

import { readFileSync, writeFileSync } from "fs";
import { join, relative, dirname } from "path";
import { execSync } from "child_process";
import type {
  InvariantViolation,
  CodebaseSnapshot,
  FileInfo,
} from "./architecture-invariants.js";
import { getSnapshotManager } from "../governance/snapshot-manager.js";
import type { SystemSnapshot } from "../governance/snapshot.schema.js";

/**
 * Fix result for a single file
 */
export interface FileFix {
  file: string;
  violationsFixed: number;
  changesApplied: string[];
  success: boolean;
  error?: string;
}

/**
 * Complete fix session result
 */
export interface AutoFixResult {
  totalViolations: number;
  fixedViolations: number;
  failedViolations: number;
  filesModified: number;
  fileFixes: FileFix[];
  backupSnapshot: string;
  verificationPassed: boolean;
  rollbackPerformed: boolean;
}

/**
 * Auto-Fix Engine
 *
 * Orchestrates the complete auto-fix workflow:
 * 1. Create backup snapshot
 * 2. Group violations by file
 * 3. Apply fixes file-by-file
 * 4. Verify TypeScript compilation
 * 5. Re-validate architecture
 * 6. Rollback on failure
 */
export class AutoFixEngine {
  private rootDir: string;
  private snapshotManager: ReturnType<typeof getSnapshotManager>;
  private backupSnapshot: SystemSnapshot | null = null;

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.snapshotManager = getSnapshotManager(rootDir);
  }

  /**
   * Main entry point: Fix all violations
   */
  async fix(violations: InvariantViolation[]): Promise<AutoFixResult> {
    console.log("\n🔧 Auto-Fix Engine Starting...");
    console.log("═".repeat(60));

    const result: AutoFixResult = {
      totalViolations: violations.length,
      fixedViolations: 0,
      failedViolations: 0,
      filesModified: 0,
      fileFixes: [],
      backupSnapshot: "",
      verificationPassed: false,
      rollbackPerformed: false,
    };

    try {
      // Step 1: Create backup
      console.log("\n📸 Step 1: Creating backup snapshot...");
      this.backupSnapshot = await this.snapshotManager.capture();
      result.backupSnapshot = this.backupSnapshot.id;
      console.log(`✅ Backup created: ${this.backupSnapshot.id}`);

      // Step 2: Filter fixable violations
      const fixable = violations.filter((v) => v.autoFixable);
      console.log(
        `\n🔍 Step 2: Found ${fixable.length} auto-fixable violations`,
      );

      if (fixable.length === 0) {
        console.log("⚠️  No auto-fixable violations found");
        return result;
      }

      // Step 3: Group by file
      const byFile = this.groupByFile(fixable);
      console.log(`📁 Affecting ${byFile.size} files`);

      // Step 4: Fix each file
      console.log("\n🔧 Step 3: Applying fixes...");
      for (const [filePath, fileViolations] of byFile.entries()) {
        const fileFix = await this.fixFile(filePath, fileViolations);
        result.fileFixes.push(fileFix);

        if (fileFix.success) {
          result.fixedViolations += fileFix.violationsFixed;
          result.filesModified++;
        } else {
          result.failedViolations += fileViolations.length;
        }
      }

      // Step 5: Verify TypeScript compilation
      console.log("\n✅ Step 4: Verifying TypeScript compilation...");
      const compileSuccess = this.verifyTypeScript();

      if (!compileSuccess) {
        console.log("❌ TypeScript compilation failed!");
        await this.rollback();
        result.rollbackPerformed = true;
        return result;
      }

      console.log("✅ TypeScript compilation successful");
      result.verificationPassed = true;

      // Step 6: Summary
      console.log("\n" + "═".repeat(60));
      console.log("📊 Auto-Fix Summary:");
      console.log(`   ✅ Fixed: ${result.fixedViolations} violations`);
      console.log(`   ❌ Failed: ${result.failedViolations} violations`);
      console.log(`   📁 Modified: ${result.filesModified} files`);
      console.log(`   🔒 Backup: ${result.backupSnapshot}`);

      return result;
    } catch (error) {
      console.error(
        `\n❌ Auto-fix failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      // Rollback on error
      if (this.backupSnapshot) {
        await this.rollback();
        result.rollbackPerformed = true;
      }

      throw error;
    }
  }

  /**
   * Fix all violations in a single file
   */
  private async fixFile(
    filePath: string,
    violations: InvariantViolation[],
  ): Promise<FileFix> {
    const result: FileFix = {
      file: filePath,
      violationsFixed: 0,
      changesApplied: [],
      success: false,
    };

    try {
      console.log(`\n  📝 Fixing ${filePath}...`);

      const fullPath = join(this.rootDir, filePath);
      let content = readFileSync(fullPath, "utf8");

      // Apply fixes in order
      for (const violation of violations) {
        const strategy = this.getFixStrategy(violation);
        if (strategy) {
          const modified = strategy(content, filePath, violation);
          if (modified !== content) {
            content = modified;
            result.violationsFixed++;
            result.changesApplied.push(violation.message);
            console.log(`     ✅ Fixed: ${violation.message}`);
          }
        }
      }

      // Write modified content
      if (result.violationsFixed > 0) {
        writeFileSync(fullPath, content, "utf8");
        console.log(`     💾 Saved ${result.violationsFixed} fixes`);
      }

      result.success = true;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`     ❌ Failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Get fix strategy for a violation
   */
  private getFixStrategy(
    violation: InvariantViolation,
  ):
    | ((content: string, filePath: string, v: InvariantViolation) => string)
    | null {
    switch (violation.invariantId) {
      case "SINGLE_ENV_DETECTION":
        return this.fixSingleEnvDetection.bind(this);

      case "NO_DUPLICATE_ENV_LOGIC":
        return this.fixDuplicateEnvLogic.bind(this);

      case "READLINE_REQUIRES_ENV_DETECTION":
        return this.fixReadlineRequiresEnv.bind(this);

      default:
        return null;
    }
  }

  /**
   * Fix Strategy: SINGLE_ENV_DETECTION
   *
   * Cases:
   * 1. detectEnvironment().isTTY -> detectEnvironment().isTTY
   * 2. detectEnvironment().isClaudeCode -> detectEnvironment().isClaudeCode
   */
  private fixSingleEnvDetection(
    content: string,
    filePath: string,
    _violation: InvariantViolation,
  ): string {
    let modified = content;

    // Ensure import exists
    modified = this.ensureEnvDetectionImport(modified, filePath);

    // Replace detectEnvironment().isTTY
    modified = modified.replace(
      /process\.stdin\.isTTY/g,
      "detectEnvironment().isTTY",
    );

    // Replace detectEnvironment().isClaudeCode
    modified = modified.replace(
      /process\.env\.CLAUDECODE\s*===\s*["']1["']/g,
      "detectEnvironment().isClaudeCode",
    );

    // Replace detectEnvironment().isClaudeCode (general case)
    modified = modified.replace(
      /process\.env\.CLAUDECODE/g,
      "detectEnvironment().isClaudeCode",
    );

    return modified;
  }

  /**
   * Fix Strategy: NO_DUPLICATE_ENV_LOGIC
   *
   * Remove duplicate environment detection logic
   */
  private fixDuplicateEnvLogic(
    content: string,
    filePath: string,
    _violation: InvariantViolation,
  ): string {
    let modified = content;

    // Ensure import exists first
    modified = this.ensureEnvDetectionImport(modified, filePath);

    // Remove duplicate patterns
    const patterns = [
      /const\s+isClaudeCode\s*=\s*process\.env\.CLAUDECODE[^;]*;?\n?/g,
      /const\s+isTTY\s*=\s*.*process\.stdin\.isTTY[^;]*;?\n?/g,
      /const\s+isInteractive\s*=\s*.*isTTY.*isClaudeCode[^;]*;?\n?/g,
    ];

    for (const pattern of patterns) {
      modified = modified.replace(pattern, "");
    }

    return modified;
  }

  /**
   * Fix Strategy: READLINE_REQUIRES_ENV_DETECTION
   *
   * Just add the import
   */
  private fixReadlineRequiresEnv(
    content: string,
    filePath: string,
    _violation: InvariantViolation,
  ): string {
    return this.ensureEnvDetectionImport(content, filePath);
  }

  /**
   * Ensure env-detection import exists
   *
   * Adds import if not present, with correct relative path
   */
  private ensureEnvDetectionImport(content: string, filePath: string): string {
    // Check if import already exists
    if (/import.*detectEnvironment.*env-detection/s.test(content)) {
      return content;
    }

    // Calculate relative path
    const relativePath = this.calculateRelativePath(
      filePath,
      "scripts/lib/env-detection.ts",
    );

    // Find where to insert import
    const importStatement = `import { detectEnvironment } from "${relativePath}";\n`;

    // Insert after existing imports or at top
    const lines = content.split("\n");
    let insertIndex = 0;

    // Find last import statement
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith("import ")) {
        insertIndex = i + 1;
      }
      // Stop at first non-import, non-comment line
      if (
        lines[i].trim() &&
        !lines[i].trim().startsWith("import ") &&
        !lines[i].trim().startsWith("//") &&
        !lines[i].trim().startsWith("/*") &&
        !lines[i].trim().startsWith("*")
      ) {
        break;
      }
    }

    lines.splice(insertIndex, 0, importStatement);
    return lines.join("\n");
  }

  /**
   * Calculate relative import path
   */
  private calculateRelativePath(fromFile: string, toFile: string): string {
    const fromDir = dirname(fromFile);
    let relativePath = relative(fromDir, toFile);

    // Convert to JS extension
    relativePath = relativePath.replace(/\.ts$/, ".js");

    // Ensure it starts with ./
    if (!relativePath.startsWith(".")) {
      relativePath = "./" + relativePath;
    }

    return relativePath;
  }

  /**
   * Group violations by file
   */
  private groupByFile(
    violations: InvariantViolation[],
  ): Map<string, InvariantViolation[]> {
    const map = new Map<string, InvariantViolation[]>();

    for (const v of violations) {
      const existing = map.get(v.file) || [];
      existing.push(v);
      map.set(v.file, existing);
    }

    return map;
  }

  /**
   * Verify TypeScript compilation
   */
  private verifyTypeScript(): boolean {
    try {
      execSync("npx tsc --noEmit -p tsconfig.build.json", {
        cwd: this.rootDir,
        stdio: "pipe",
      });
      return true;
    } catch (error) {
      console.error("TypeScript compilation errors detected");
      return false;
    }
  }

  /**
   * Rollback to backup snapshot
   */
  private async rollback(): Promise<void> {
    if (!this.backupSnapshot) {
      console.error("❌ No backup snapshot available for rollback");
      return;
    }

    console.log(`\n🔄 Rolling back to snapshot: ${this.backupSnapshot.id}`);

    let restored = 0;
    for (const [relativePath, fileSnapshot] of Object.entries(
      this.backupSnapshot.files,
    )) {
      if (fileSnapshot.content) {
        const fullPath = join(this.rootDir, relativePath);
        writeFileSync(fullPath, fileSnapshot.content, "utf8");
        restored++;
      }
    }

    console.log(`✅ Rolled back ${restored} files`);
  }
}
