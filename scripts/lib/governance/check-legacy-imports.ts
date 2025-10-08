/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Legacy Import Checker
 *
 * Purpose:
 * - Detect imports of deprecated files
 * - Warn developers about legacy usage
 * - Suggest correct alternatives
 *
 * Design:
 * - Uses governance-rules.json deprecatedFiles list
 * - Scans file content for import statements
 * - Provides actionable migration guidance
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type {
  GovernanceRulesConfig,
  DeprecatedFile,
} from "./governance-types.js";

export interface LegacyImportWarning {
  file: string;
  line: number;
  deprecated: string;
  replacement: string;
  reason: string;
}

export class LegacyImportChecker {
  private projectRoot: string;
  private rules: GovernanceRulesConfig | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Load governance rules
   */
  private loadRules(): GovernanceRulesConfig {
    if (this.rules) return this.rules;

    const rulesPath = join(this.projectRoot, "governance-rules.json");
    if (!existsSync(rulesPath)) {
      throw new Error(`governance-rules.json not found at ${rulesPath}`);
    }

    const content = readFileSync(rulesPath, "utf8");
    this.rules = JSON.parse(content) as GovernanceRulesConfig;
    return this.rules;
  }

  /**
   * Check a single file for legacy imports
   */
  check(filePath: string): LegacyImportWarning[] {
    const rules = this.loadRules();
    const warnings: LegacyImportWarning[] = [];

    if (!existsSync(filePath)) {
      return warnings;
    }

    const content = readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    // Check each deprecated file
    for (const deprecated of rules.deprecatedFiles) {
      const pattern = this.createImportPattern(deprecated.path);

      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          warnings.push({
            file: filePath,
            line: index + 1,
            deprecated: deprecated.path,
            replacement: deprecated.replacement,
            reason: deprecated.reason,
          });
        }
      });
    }

    return warnings;
  }

  /**
   * Check multiple files for legacy imports
   */
  checkMultiple(filePaths: string[]): LegacyImportWarning[] {
    const allWarnings: LegacyImportWarning[] = [];

    for (const filePath of filePaths) {
      const warnings = this.check(filePath);
      allWarnings.push(...warnings);
    }

    return allWarnings;
  }

  /**
   * Display warnings to console
   */
  displayWarnings(warnings: LegacyImportWarning[]): void {
    if (warnings.length === 0) {
      console.log("✅ No legacy imports detected");
      return;
    }

    console.log(`\n⚠️  Legacy Imports Detected: ${warnings.length}\n`);
    console.log("=".repeat(70));

    // Group by deprecated file
    const grouped = this.groupByDeprecated(warnings);

    for (const [deprecated, fileWarnings] of Object.entries(grouped)) {
      const first = fileWarnings[0];
      console.log(`\n📦 ${deprecated}`);
      console.log(`   Reason: ${first.reason}`);
      console.log(`   ✅ Use instead: ${first.replacement}`);
      console.log(`\n   Found in ${fileWarnings.length} location(s):`);

      fileWarnings.slice(0, 5).forEach((w) => {
        console.log(`   - ${w.file}:${w.line}`);
      });

      if (fileWarnings.length > 5) {
        console.log(`   ... and ${fileWarnings.length - 5} more`);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log("\n📚 Migration Guide: docs/MIGRATION_V2.md");
    console.log("🔧 Auto-fix: npm run migrate:imports (coming soon)\n");
  }

  /**
   * Check if a file is deprecated
   */
  isDeprecated(filePath: string): boolean {
    const rules = this.loadRules();
    const relativePath = filePath.replace(this.projectRoot + "/", "");

    return rules.deprecatedFiles.some((d) => d.path === relativePath);
  }

  /**
   * Get deprecation info for a file
   */
  getDeprecationInfo(filePath: string): DeprecatedFile | null {
    const rules = this.loadRules();
    const relativePath = filePath.replace(this.projectRoot + "/", "");

    return rules.deprecatedFiles.find((d) => d.path === relativePath) || null;
  }

  /**
   * Create regex pattern to match imports
   */
  private createImportPattern(deprecatedPath: string): RegExp {
    // Remove .ts extension and escape special characters
    const basePath = deprecatedPath.replace(/\.ts$/, "");
    const escaped = basePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Match various import styles:
    // - import ... from "path"
    // - import ... from 'path'
    // - require("path")
    // - require('path')
    return new RegExp(
      `(?:import|require)\\s*.*?["'].*?${escaped}(?:\\.js)?["']`,
    );
  }

  /**
   * Group warnings by deprecated file
   */
  private groupByDeprecated(
    warnings: LegacyImportWarning[],
  ): Record<string, LegacyImportWarning[]> {
    const grouped: Record<string, LegacyImportWarning[]> = {};

    for (const warning of warnings) {
      if (!grouped[warning.deprecated]) {
        grouped[warning.deprecated] = [];
      }
      grouped[warning.deprecated].push(warning);
    }

    return grouped;
  }

  /**
   * Check if file should block execution (critical deprecation)
   */
  shouldBlock(filePath: string): boolean {
    const rules = this.loadRules();
    const relativePath = filePath.replace(this.projectRoot + "/", "");

    const deprecated = rules.deprecatedFiles.find(
      (d) => d.path === relativePath,
    );
    if (!deprecated) return false;

    // Check if there's a corresponding rule with action: "throw"
    const blockingRule = rules.rules.find(
      (r) => r.id === "NO_LEGACY_IMPORTS" && r.action === "throw",
    );

    return !!blockingRule && blockingRule.enabled;
  }
}

/**
 * Global singleton instance
 */
let globalLegacyImportChecker: LegacyImportChecker | null = null;

export function getLegacyImportChecker(
  projectRoot?: string,
): LegacyImportChecker {
  if (!globalLegacyImportChecker) {
    globalLegacyImportChecker = new LegacyImportChecker(projectRoot);
  }
  return globalLegacyImportChecker;
}
