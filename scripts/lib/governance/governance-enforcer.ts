/**
 * Governance Enforcer - Type-based governance enforcement
 *
 * Design Philosophy:
 * - 'analyze' mode tools are exempt by design (read-only operations)
 * - 'transform' mode tools require governance (write operations)
 * - No hardcoded exemption lists - mode drives behavior
 *
 * Purpose:
 * - Scan all *-engine.ts files
 * - Extract @tool-mode declarations
 * - Enforce governance on 'transform' tools only
 *
 * Usage:
 * - Pre-commit hook
 * - CI validation
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import {
  extractToolMetadata,
  validateToolMode,
  type ToolMetadata,
} from "./tool-mode.js";
import { getGovernanceLogger } from "./governance-logger.js";

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
  private logger = getGovernanceLogger();

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
   * Check if file is governance-compliant (type-based)
   */
  private checkFile(filePath: string): {
    compliant: boolean;
    violations: GovernanceEnforcementResult["violations"];
  } {
    const content = readFileSync(filePath, "utf8");
    const relativePath = filePath.replace(this.projectRoot + "/", "");
    const filename = filePath.split("/").pop() || "";
    const violations: GovernanceEnforcementResult["violations"] = [];

    // Extract tool metadata from @tool-mode declaration
    const metadata = extractToolMetadata(filename, content);

    // Check 1: Tool mode must be declared
    const modeValidation = validateToolMode(metadata);
    if (!modeValidation.valid) {
      const violation = {
        file: relativePath,
        reason: modeValidation.reason || "Missing @tool-mode declaration",
        severity: "critical" as const,
      };
      violations.push(violation);

      // Log blocked
      this.logger.logBlocked(filename, "unknown", [
        {
          type: "mode-declaration",
          severity: "critical",
          message: violation.reason,
        },
      ]);

      return { compliant: false, violations };
    }

    // Check 2: If mode is 'analyze', no governance required
    if (metadata!.mode === "analyze") {
      // Log allowed (analyze mode auto-exempt)
      this.logger.logAllowed(
        filename,
        "analyze",
        "Analysis tool - read-only operations, no governance required",
      );

      return { compliant: true, violations: [] };
    }

    // Check 3: Transform tools MUST have governance
    if (metadata!.mode === "transform") {
      // Check 3a: Imports GovernanceRunner OR wrapWithGovernance
      const hasGovernanceImport =
        content.includes("GovernanceRunner") ||
        content.includes("wrapWithGovernance");
      if (!hasGovernanceImport) {
        violations.push({
          file: relativePath,
          reason: "Transform tool missing import: GovernanceRunner or wrapWithGovernance",
          severity: "critical",
        });
      }

      // Check 3b: Uses executeWithGovernance OR wrapWithGovernance
      const hasGovernanceUsage =
        content.includes("executeWithGovernance") ||
        content.includes("wrapWithGovernance(");
      if (!hasGovernanceUsage) {
        violations.push({
          file: relativePath,
          reason: "Transform tool missing call: executeWithGovernance() or wrapWithGovernance()",
          severity: "critical",
        });
      }

      // Check 3c: Has governance property (skip for wrapper pattern)
      const usesWrapperPattern = content.includes("wrapWithGovernance(");
      if (
        !usesWrapperPattern &&
        !content.includes("private governance:") &&
        !content.includes("private governance =")
      ) {
        violations.push({
          file: relativePath,
          reason: "Transform tool missing property: private governance",
          severity: "high",
        });
      }
    }

    // Log result for transform tools
    if (violations.length === 0) {
      // Transform tool is compliant
      this.logger.logAllowed(
        filename,
        "transform",
        "Transform tool with proper governance integration",
      );
    } else {
      // Transform tool has violations
      this.logger.logBlocked(
        filename,
        "transform",
        violations.map((v) => ({
          type: "governance-violation",
          severity: v.severity,
          message: v.reason,
        })),
      );
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
      console.log(`   1. Add @tool-mode declaration (analyze or transform)`);
      console.log(`   2. For transform tools: Import GovernanceRunner`);
      console.log(`   3. For transform tools: Add private governance property`);
      console.log(`   4. For transform tools: Wrap with executeWithGovernance()`);
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
