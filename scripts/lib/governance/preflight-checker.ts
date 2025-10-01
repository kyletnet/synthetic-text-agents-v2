/**
 * Preflight Checker - Pre-execution validation
 *
 * Purpose:
 * - Validate environment before operations
 * - Check cache validity (for maintain/fix)
 * - Verify Git status
 * - Check risk domains
 *
 * Design:
 * - User-friendly output
 * - Clear error messages
 * - Actionable guidance
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { InspectionCache } from "../inspection-cache.js";
import type { OperationType } from "./governance-types.js";

export interface PreflightContext {
  name: string;
  type: OperationType;
  skipCacheCheck?: boolean;
}

export class PreflightChecker {
  private projectRoot: string;
  private inspectionCache: InspectionCache;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.inspectionCache = new InspectionCache(projectRoot);
  }

  /**
   * Run all preflight checks
   */
  async check(context: PreflightContext): Promise<void> {
    console.log(`\n🔍 Preflight Check: ${context.name}`);
    console.log("═".repeat(60));

    // 1. Environment check
    await this.checkEnvironment();

    // 2. Cache check (for maintain/fix only)
    if (!context.skipCacheCheck && ["maintain", "fix"].includes(context.name)) {
      this.checkCache(context.name);
    }

    // 3. Git status check
    await this.checkGitStatus();

    // 4. Node modules check
    await this.checkNodeModules();

    // 5. Governance rules check
    this.checkGovernanceRules();

    console.log("✅ All preflight checks passed\n");
  }

  /**
   * Check environment variables and Node version
   */
  private async checkEnvironment(): Promise<void> {
    console.log("   📦 Environment...");

    // Node version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

    if (majorVersion < 18) {
      throw new Error(
        `Node.js version ${nodeVersion} is not supported. Please use Node.js 18 or higher.`,
      );
    }

    // Package.json exists
    const packageJsonPath = join(this.projectRoot, "package.json");
    if (!existsSync(packageJsonPath)) {
      throw new Error("package.json not found");
    }

    console.log(`      ✓ Node.js ${nodeVersion}`);
  }

  /**
   * Check inspection cache validity
   */
  private checkCache(commandName: string): void {
    console.log("   📋 Inspection cache...");

    try {
      this.inspectionCache.enforceInspectFirst(commandName);
      const age = this.inspectionCache.getCacheAge();
      console.log(`      ✓ Cache valid (${age})`);
    } catch (error) {
      // enforceInspectFirst already handles error display and exit
      throw error;
    }
  }

  /**
   * Check Git status
   */
  private async checkGitStatus(): Promise<void> {
    console.log("   🔀 Git status...");

    try {
      // Check if git repo
      execSync("git rev-parse --git-dir", {
        stdio: "pipe",
        cwd: this.projectRoot,
      });

      // Get current branch
      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
        cwd: this.projectRoot,
      }).trim();

      // Get uncommitted changes
      const status = execSync("git status --porcelain", {
        encoding: "utf8",
        cwd: this.projectRoot,
      });

      if (status.trim()) {
        const lines = status.trim().split("\n");
        console.log(
          `      ⚠️  ${lines.length} uncommitted change(s) on ${branch}`,
        );
        console.log(
          "      💡 Consider committing before governance operations",
        );
      } else {
        console.log(`      ✓ Clean working tree on ${branch}`);
      }
    } catch {
      console.log("      ⚠️  Not a git repository");
    }
  }

  /**
   * Check node_modules exists
   */
  private async checkNodeModules(): Promise<void> {
    console.log("   📚 Dependencies...");

    const nodeModulesPath = join(this.projectRoot, "node_modules");
    if (!existsSync(nodeModulesPath)) {
      throw new Error(
        "node_modules not found. Please run 'npm install' first.",
      );
    }

    console.log("      ✓ node_modules exists");
  }

  /**
   * Check governance-rules.json exists and is valid
   */
  private checkGovernanceRules(): void {
    console.log("   ⚖️  Governance rules...");

    const rulesPath = join(this.projectRoot, "governance-rules.json");
    if (!existsSync(rulesPath)) {
      throw new Error(
        "governance-rules.json not found. Governance system not initialized.",
      );
    }

    try {
      const content = readFileSync(rulesPath, "utf8");
      const rules = JSON.parse(content);

      // Validate schema version
      if (!rules.schemaVersion) {
        throw new Error("governance-rules.json missing schemaVersion");
      }

      if (rules.schemaVersion !== "2025-10-governance-v1") {
        console.log(
          `      ⚠️  Schema version ${rules.schemaVersion} (expected 2025-10-governance-v1)`,
        );
      } else {
        console.log("      ✓ Governance rules valid");
      }

      // Count enabled rules
      const enabledRules =
        rules.rules?.filter((r: { enabled: boolean }) => r.enabled) || [];
      console.log(`      ✓ ${enabledRules.length} rule(s) enabled`);
    } catch (error) {
      throw new Error(
        `governance-rules.json is invalid: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Quick validation without throwing errors
   */
  async validate(context: PreflightContext): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      await this.check(context);
      return { valid: true, errors, warnings };
    } catch (error) {
      errors.push((error as Error).message);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Display preflight summary
   */
  displaySummary(): void {
    console.log("\n📊 Preflight Summary:");
    console.log("   Environment: ✓");
    console.log("   Git: ✓");
    console.log("   Dependencies: ✓");
    console.log("   Governance: ✓");
  }
}

/**
 * Global singleton instance
 */
let globalPreflightChecker: PreflightChecker | null = null;

export function getPreflightChecker(projectRoot?: string): PreflightChecker {
  if (!globalPreflightChecker) {
    globalPreflightChecker = new PreflightChecker(projectRoot);
  }
  return globalPreflightChecker;
}
