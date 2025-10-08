#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Protected Files Pre-commit Hook
 *
 * Purpose:
 * - Prevent modification of quality-essential files
 * - Enforce quality policy during git commits
 * - Allow modifications only with explicit override
 *
 * Usage:
 *   .git/hooks/pre-commit (auto-run)
 *   npx tsx scripts/check-protected-files.ts (manual)
 *   ALLOW_PROTECTED_EDIT=1 git commit (override)
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface QualityPolicy {
  agentProtection: {
    static: Array<{
      file: string;
      reason: string;
      allowedOperations?: string[];
    }>;
  };
}

class ProtectedFilesChecker {
  private projectRoot: string;
  private policy: QualityPolicy | null = null;

  constructor() {
    this.projectRoot = process.cwd();
    this.loadPolicy();
  }

  private loadPolicy(): void {
    const policyPath = join(this.projectRoot, "quality-policy.json");

    if (!existsSync(policyPath)) {
      console.warn("⚠️  quality-policy.json not found - skipping protection");
      return;
    }

    try {
      this.policy = JSON.parse(readFileSync(policyPath, "utf-8"));
    } catch (error) {
      console.error("❌ Failed to load quality-policy.json:", error);
      process.exit(1);
    }
  }

  async check(): Promise<void> {
    // Allow override with environment variable
    if (process.env.ALLOW_PROTECTED_EDIT === "1") {
      console.log("✅ Protected file check bypassed (ALLOW_PROTECTED_EDIT=1)");
      return;
    }

    if (!this.policy) {
      // No policy = no protection
      return;
    }

    // Get staged files
    const stagedFiles = this.getStagedFiles();

    if (stagedFiles.length === 0) {
      // No files staged = nothing to check
      return;
    }

    // Check for protected files
    const violations: Array<{ file: string; reason: string }> = [];

    for (const file of stagedFiles) {
      const protection = this.isProtected(file);
      if (protection) {
        violations.push({ file, reason: protection.reason });
      }
    }

    if (violations.length > 0) {
      this.reportViolations(violations);
      process.exit(1);
    }

    console.log("✅ No protected files modified");
  }

  private getStagedFiles(): string[] {
    try {
      const output = execSync("git diff --cached --name-only", {
        encoding: "utf-8",
        cwd: this.projectRoot,
      });

      return output
        .split("\n")
        .filter(Boolean)
        .map((f) => f.trim());
    } catch (error) {
      console.error("❌ Failed to get staged files:", error);
      return [];
    }
  }

  private isProtected(
    file: string,
  ): { file: string; reason: string } | undefined {
    if (!this.policy) return undefined;

    for (const protection of this.policy.agentProtection.static) {
      // Exact match or starts with (for directories)
      if (file === protection.file || file.startsWith(protection.file + "/")) {
        return protection;
      }
    }

    return undefined;
  }

  private reportViolations(
    violations: Array<{ file: string; reason: string }>,
  ): void {
    console.error("\n" + "═".repeat(70));
    console.error("🚨 PROTECTED FILES MODIFICATION BLOCKED");
    console.error("═".repeat(70));
    console.error(
      `\n❌ You are attempting to modify ${violations.length} quality-essential file(s):\n`,
    );

    violations.forEach((v, idx) => {
      console.error(`${idx + 1}. ${v.file}`);
      console.error(`   Reason: ${v.reason}\n`);
    });

    console.error("🛡️  These files are protected by quality policy.");
    console.error(
      "   Modifications may break core functionality or QA quality.\n",
    );

    console.error("💡 Options:");
    console.error("   1. Revert changes:    git restore --staged <file>");
    console.error(
      "   2. Override (risky):  ALLOW_PROTECTED_EDIT=1 git commit -m '...'",
    );
    console.error("   3. Request review:    Create PR with justification\n");

    console.error("📋 Protected by: quality-policy.json");
    console.error("═".repeat(70) + "\n");
  }
}

// Main execution
const checker = new ProtectedFilesChecker();
await checker.check();
