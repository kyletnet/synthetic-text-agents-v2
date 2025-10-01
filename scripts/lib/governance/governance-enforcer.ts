/**
 * Governance Enforcer - Ensure all engines use governance
 *
 * Purpose:
 * - Scan all *-engine.ts files
 * - Verify they import GovernanceRunner
 * - Ensure executeWithGovernance is called
 *
 * Usage:
 * - Pre-commit hook
 * - CI validation
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { glob } from "glob";

export interface GovernanceEnforcementResult {
  compliant: string[];
  violations: Array<{
    file: string;
    reason: string;
    severity: "critical" | "high" | "medium";
  }>;
  summary: {
    total: number;
    compliant: number;
    violations: number;
  };
}

export class GovernanceEnforcer {
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Enforce governance on all engine files
   */
  async enforce(): Promise<GovernanceEnforcementResult> {
    const engineFiles = this.findEngineFiles();
    const compliant: string[] = [];
    const violations: GovernanceEnforcementResult["violations"] = [];

    for (const file of engineFiles) {
      const result = this.checkFile(file);

      if (result.compliant) {
        compliant.push(file);
      } else {
        violations.push(...result.violations);
      }
    }

    return {
      compliant,
      violations,
      summary: {
        total: engineFiles.length,
        compliant: compliant.length,
        violations: violations.length,
      },
    };
  }

  /**
   * Find all *-engine.ts files
   */
  private findEngineFiles(): string[] {
    const patterns = ["scripts/*-engine.ts", "scripts/**/*-engine.ts"];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = glob.sync(pattern, {
        cwd: this.projectRoot,
        ignore: ["**/node_modules/**", "**/dist/**"],
        absolute: true,
      });
      files.push(...matches);
    }

    return files;
  }

  /**
   * Check if file is governance-compliant
   */
  private checkFile(filePath: string): {
    compliant: boolean;
    violations: GovernanceEnforcementResult["violations"];
  } {
    const content = readFileSync(filePath, "utf8");
    const relativePath = filePath.replace(this.projectRoot + "/", "");
    const violations: GovernanceEnforcementResult["violations"] = [];

    // Exemptions (files that don't need governance)
    const exemptions = [
      "validate-engine.ts", // Validation only
      "verify-engine.ts", // Uses governance internally
    ];

    if (exemptions.some((exempt) => filePath.includes(exempt))) {
      return { compliant: true, violations: [] };
    }

    // Check 1: Imports GovernanceRunner OR wrapWithGovernance (new pattern)
    const hasGovernanceImport =
      content.includes("GovernanceRunner") ||
      content.includes("wrapWithGovernance");
    if (!hasGovernanceImport) {
      violations.push({
        file: relativePath,
        reason: "Missing import: GovernanceRunner or wrapWithGovernance",
        severity: "critical",
      });
    }

    // Check 2: Uses executeWithGovernance OR wrapWithGovernance
    const hasGovernanceUsage =
      content.includes("executeWithGovernance") ||
      content.includes("wrapWithGovernance(");
    if (!hasGovernanceUsage) {
      violations.push({
        file: relativePath,
        reason: "Missing call: executeWithGovernance() or wrapWithGovernance()",
        severity: "critical",
      });
    }

    // Check 3: Has governance property (skip for wrapper pattern)
    const usesWrapperPattern = content.includes("wrapWithGovernance(");
    if (
      !usesWrapperPattern &&
      !content.includes("private governance:") &&
      !content.includes("private governance =")
    ) {
      violations.push({
        file: relativePath,
        reason: "Missing property: private governance",
        severity: "high",
      });
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  /**
   * Display enforcement report
   */
  displayReport(result: GovernanceEnforcementResult): void {
    console.log("\n🔍 Governance Enforcement Report");
    console.log("═".repeat(60));

    console.log(`\n📊 Summary:`);
    console.log(`   Total engines: ${result.summary.total}`);
    console.log(`   ✅ Compliant: ${result.summary.compliant}`);
    console.log(`   ❌ Violations: ${result.summary.violations}`);

    if (result.compliant.length > 0) {
      console.log(`\n✅ Compliant Engines (${result.compliant.length}):`);
      result.compliant.forEach((file) => {
        const name = file.split("/").pop();
        console.log(`   ✓ ${name}`);
      });
    }

    if (result.violations.length > 0) {
      console.log(`\n❌ Violations Found (${result.violations.length}):`);
      result.violations.forEach((v, i) => {
        const icon = v.severity === "critical" ? "🔴" : "🟡";
        console.log(`\n   ${i + 1}. ${icon} ${v.file}`);
        console.log(`      ${v.reason}`);
        console.log(`      Severity: ${v.severity.toUpperCase()}`);
      });

      console.log(`\n💡 Fix violations by:`);
      console.log(`   1. Import GovernanceRunner`);
      console.log(`   2. Add private governance: GovernanceRunner`);
      console.log(`   3. Wrap operations with executeWithGovernance()`);
    }

    console.log("\n" + "═".repeat(60));
  }

  /**
   * Throw error if violations found (for CI)
   */
  assertCompliant(result: GovernanceEnforcementResult): void {
    if (result.violations.length > 0) {
      throw new Error(
        `Governance violations found: ${result.violations.length} issue(s)`,
      );
    }
  }
}

/**
 * Global singleton
 */
let globalGovernanceEnforcer: GovernanceEnforcer | null = null;

export function getGovernanceEnforcer(
  projectRoot?: string,
): GovernanceEnforcer {
  if (!globalGovernanceEnforcer) {
    globalGovernanceEnforcer = new GovernanceEnforcer(projectRoot);
  }
  return globalGovernanceEnforcer;
}
