#!/usr/bin/env tsx

/**
 * Safety Analyzer for Smart Refactor System
 * Determines what can be auto-fixed vs needs confirmation
 *
 * CRITICAL: Includes quality-essential file protection
 * - Prevents refactoring of QA generation core logic
 * - Integrated with quality-policy.json and governance-rules.json
 */

import { readFileSync, existsSync } from "fs";
import { glob } from "glob";
import { SmartRefactorStateManager } from "./smart-refactor-state.js";
import { getQualityPolicyManager } from "./lib/quality-policy.js";

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

interface SafetyScore {
  fileCount: number;
  crossModule: boolean;
  buildImpact: boolean;
  testCoverage: number;
  rollbackDifficulty: number;
  isQualityEssential: boolean; // 🆕 Quality protection
  autoSafe: boolean;
}

interface ImpactScore {
  fileCount: number;
  crossModuleImpact: boolean;
  buildImpact: boolean;
  testCoverage: number;
  rollbackDifficulty: number;
}

export class SafetyAnalyzer {
  private stateManager: SmartRefactorStateManager;
  private rootDir: string;
  private policyManager: ReturnType<typeof getQualityPolicyManager>; // 🆕

  constructor(rootDir: string = process.cwd()) {
    this.rootDir = rootDir;
    this.stateManager = new SmartRefactorStateManager(rootDir);
    this.policyManager = getQualityPolicyManager(rootDir); // 🆕
  }

  analyzeItem(item: FixItem): { safety: SafetyScore; criteria: string[] } {
    const criteria: string[] = [];

    // 🆕 CRITICAL: Quality-essential check (최우선!)
    const qualityImpact = this.analyzeQualityImpact(item);
    criteria.push(
      `quality-essential: ${
        qualityImpact.isEssential ? "YES (PROTECTED)" : "no"
      }`,
    );
    if (qualityImpact.isEssential) {
      criteria.push(`  → reason: ${qualityImpact.reason}`);
    }

    // 🆕 Policy-based protection check
    const policyProtected = this.checkPolicyProtection(item);
    criteria.push(
      `policy-protected: ${policyProtected ? "YES (PROTECTED)" : "no"}`,
    );

    // File count analysis
    const fileCount = item.files.length;
    const learnedThreshold = this.getLearnedThreshold(item.category);

    criteria.push(`files: ${fileCount} (threshold: ${learnedThreshold})`);
    const fileCountOk = fileCount <= learnedThreshold;

    // Cross-module analysis
    const crossModule = this.detectCrossModuleImpact(item);
    criteria.push(`cross-module: ${crossModule ? "yes" : "no"}`);

    // Build impact analysis
    const buildImpact = this.detectBuildImpact(item);
    criteria.push(`build-impact: ${buildImpact ? "yes" : "no"}`);

    // Test coverage
    const testCoverage = this.getTestCoverage(item.files);
    criteria.push(`test-coverage: ${testCoverage.toFixed(1)}%`);

    // Rollback difficulty
    const rollbackDifficulty = this.estimateRollbackDifficulty(item);
    criteria.push(`rollback-difficulty: ${rollbackDifficulty.toFixed(2)}`);

    // External interface check
    criteria.push(
      `external-interface: ${item.externalInterface ? "yes" : "no"}`,
    );

    // Critical path check
    const criticalPath = this.touchesCriticalPath(item);
    criteria.push(`critical-path: ${criticalPath ? "yes" : "no"}`);

    const isQualityEssential = qualityImpact.isEssential || policyProtected; // 🆕

    const safety: SafetyScore = {
      fileCount,
      crossModule,
      buildImpact,
      testCoverage,
      rollbackDifficulty,
      isQualityEssential, // 🆕
      autoSafe: this.isAutoSafe({
        fileCountOk,
        crossModule,
        buildImpact,
        testCoverage,
        rollbackDifficulty,
        externalInterface: item.externalInterface,
        rollbackSupported: item.rollbackSupported,
        criticalPath,
        isQualityEssential, // 🆕 Pass to isAutoSafe
      }),
    };

    return { safety, criteria };
  }

  private getLearnedThreshold(category: string): number {
    const state = this.stateManager.exportState();
    return state.learnedCriteria.fileCountThresholds[category] || 3;
  }

  private isAutoSafe(factors: {
    fileCountOk: boolean;
    crossModule: boolean;
    buildImpact: boolean;
    testCoverage: number;
    rollbackDifficulty: number;
    externalInterface: boolean;
    rollbackSupported: boolean;
    criticalPath: boolean;
    isQualityEssential: boolean; // 🆕
  }): boolean {
    // 🚨 CRITICAL: Quality-essential files are NEVER auto-refactored!
    if (factors.isQualityEssential) {
      console.warn(
        "⚠️  Quality-essential file detected - manual review required",
      );
      return false;
    }

    // Hard requirements for auto-fix
    if (!factors.fileCountOk) return false;
    if (factors.crossModule) return false;
    if (factors.buildImpact) return false;
    if (factors.externalInterface) return false;
    if (!factors.rollbackSupported) return false;
    if (factors.criticalPath) return false;

    // Soft requirements
    if (factors.testCoverage < 50) return false;
    if (factors.rollbackDifficulty > 0.5) return false;

    return true;
  }

  /**
   * 🆕 Analyze quality impact using Radar engine logic
   */
  private analyzeQualityImpact(item: FixItem): {
    isEssential: boolean;
    reason: string;
  } {
    for (const file of item.files) {
      try {
        // Check if file exists
        if (!existsSync(file)) {
          continue;
        }

        const content = readFileSync(file, "utf-8");

        // Reuse logic from radar-engine.ts
        const impact = this.analyzeFileQualityImpactLocal(file, content);

        if (impact.isQualityEssential) {
          return {
            isEssential: true,
            reason: impact.reason,
          };
        }
      } catch (error) {
        console.warn(`Failed to analyze ${file}:`, error);
      }
    }

    return { isEssential: false, reason: "No quality impact detected" };
  }

  /**
   * 🆕 Local implementation of quality impact analysis
   * (mirrors scripts/radar-engine.ts::analyzeFileQualityImpact)
   */
  private analyzeFileQualityImpactLocal(
    filePath: string,
    content: string,
  ): {
    isQualityEssential: boolean;
    reason: string;
  } {
    // Quality patterns (domain knowledge, business logic)
    const qualityPatterns = [
      /const\s+\w+:\s*Record<string,\s*string\[\]>\s*=\s*\{/g,
      /knowledgeBase\.set\(/g,
      /marketDynamics:|keyStakeholders:|bestPractices:/g,
      /DOMAIN_\w+:\s*Record/g,
      /private\s+\w+Emotions|Motivations|Stressors/g,
    ];

    let qualitySignals = 0;
    for (const pattern of qualityPatterns) {
      const matches = content.match(pattern);
      if (matches) qualitySignals += matches.length;
    }

    // Agent files with domain knowledge
    if (filePath.includes("/agents/") && qualitySignals > 5) {
      return {
        isQualityEssential: true,
        reason: "도메인 전문 지식 데이터 포함 (QA 품질에 필수)",
      };
    }

    // Shared infrastructure
    if (filePath.includes("/shared/") && qualitySignals > 3) {
      return {
        isQualityEssential: true,
        reason: "핵심 인프라 로직 (시스템 안정성에 필수)",
      };
    }

    // High quality signal concentration
    if (qualitySignals > 10) {
      return {
        isQualityEssential: true,
        reason: "도메인 지식/비즈니스 로직 집약 (품질 유지 필요)",
      };
    }

    return {
      isQualityEssential: false,
      reason: "구조 개선 가능 (모듈 분리 고려)",
    };
  }

  /**
   * 🆕 Check policy-based protection
   */
  private checkPolicyProtection(item: FixItem): boolean {
    for (const file of item.files) {
      if (this.policyManager.isProtectedFile(file)) {
        return true;
      }
    }
    return false;
  }

  private detectCrossModuleImpact(item: FixItem): boolean {
    // Simple heuristic: files in different directories under src/
    const srcFiles = item.files.filter((f) => f.startsWith("src/"));
    if (srcFiles.length < 2) return false;

    const modules = new Set(
      srcFiles.map((f) => {
        const parts = f.split("/");
        return parts.length > 2 ? parts[1] : "root"; // src/agents, src/core, etc.
      }),
    );

    return modules.size > 1;
  }

  private detectBuildImpact(item: FixItem): boolean {
    const buildFiles = [
      "tsconfig.json",
      "tsconfig.build.json",
      "package.json",
      "vite.config.ts",
      "webpack.config.js",
      ".eslintrc.js",
      ".eslintrc.json",
    ];

    return item.files.some((file) =>
      buildFiles.some((buildFile) => file.endsWith(buildFile)),
    );
  }

  private getTestCoverage(files: string[]): number {
    let totalFiles = files.length;
    let testedFiles = 0;

    for (const file of files) {
      if (this.hasCorrespondingTest(file)) {
        testedFiles++;
      }
    }

    return totalFiles === 0 ? 0 : (testedFiles / totalFiles) * 100;
  }

  private hasCorrespondingTest(file: string): boolean {
    // Look for corresponding test files
    const testPatterns = [
      file.replace(/\.ts$/, ".test.ts"),
      file.replace(/\.ts$/, ".spec.ts"),
      file.replace(/src\//, "tests/").replace(/\.ts$/, ".test.ts"),
      file.replace(/src\//, "test/").replace(/\.ts$/, ".test.ts"),
    ];

    return testPatterns.some((pattern) => existsSync(pattern));
  }

  private estimateRollbackDifficulty(item: FixItem): number {
    let difficulty = 0.0;

    // File count contributes to difficulty
    difficulty += Math.min(item.files.length * 0.1, 0.3);

    // Certain change types are harder to rollback
    if (item.changeType.includes("rename")) difficulty += 0.3;
    if (item.changeType.includes("move")) difficulty += 0.3;
    if (item.changeType.includes("delete")) difficulty += 0.5;
    if (item.changeType.includes("structure")) difficulty += 0.4;

    // Cross-module changes harder to rollback
    if (this.detectCrossModuleImpact(item)) difficulty += 0.2;

    return Math.min(difficulty, 1.0);
  }

  private touchesCriticalPath(item: FixItem): boolean {
    const criticalPaths = [
      "src/core/",
      "src/orchestrator",
      "src/shared/types",
      "src/shared/logger",
      "package.json",
      "tsconfig",
    ];

    return item.files.some((file) =>
      criticalPaths.some((critical) => file.includes(critical)),
    );
  }

  // Category-specific safety rules
  getCategorySafetyRules(): Record<string, (item: FixItem) => boolean> {
    return {
      "documentation-formatting": (item) => {
        return (
          item.files.every((f) => f.endsWith(".md") || f.includes("docs/")) &&
          item.files.length <= 10
        );
      },

      "unused-import-removal": (item) => {
        const threshold = this.getLearnedThreshold("import-cleanup");
        return (
          item.files.length <= threshold &&
          item.files.every((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
        );
      },

      "duplicate-export-cleanup": (item) => {
        const threshold = this.getLearnedThreshold("export-duplication");
        return (
          item.files.length <= threshold && !this.detectCrossModuleImpact(item)
        );
      },

      "report-format-normalization": (item) => {
        return (
          item.files.every(
            (f) => f.includes("reports/") || f.endsWith(".jsonl"),
          ) && item.files.length <= 5
        );
      },

      "package-json-script-add": (item) => {
        return (
          item.files.length === 1 &&
          item.files[0] === "package.json" &&
          item.changeType === "add-script"
        );
      },

      "agent-inheritance": (item) => {
        // Never auto-fix - always needs confirmation
        return false;
      },

      "tsconfig-modification": (item) => {
        // Never auto-fix - always needs confirmation
        return false;
      },

      "routing-unification": (item) => {
        // Never auto-fix - always needs confirmation
        return false;
      },
    };
  }

  isAutoFixableByCategory(item: FixItem): {
    autoSafe: boolean;
    reason: string;
  } {
    const rules = this.getCategorySafetyRules();
    const rule = rules[item.category];

    if (!rule) {
      return { autoSafe: false, reason: "unknown-category" };
    }

    const categoryResult = rule(item);
    if (!categoryResult) {
      return { autoSafe: false, reason: "category-rule-failed" };
    }

    // Also check general safety
    const { safety, criteria } = this.analyzeItem(item);

    return {
      autoSafe: safety.autoSafe,
      reason: safety.autoSafe
        ? "passed-all-checks"
        : `failed: ${criteria.join(", ")}`,
    };
  }

  generateDecisionLog(item: FixItem, decision: "auto-fix" | "confirm"): string {
    const { safety, criteria } = this.analyzeItem(item);
    const categoryCheck = this.isAutoFixableByCategory(item);

    if (decision === "auto-fix") {
      return `✅ ${item.category} (Safe: ${criteria.join(", ")})`;
    } else {
      return `❌ ${item.category} (Risk: ${categoryCheck.reason}, ${criteria
        .filter(
          (c) =>
            c.includes("yes") ||
            c.includes("high") ||
            parseFloat(c.split(":")[1]) < 50,
        )
        .join(", ")})`;
    }
  }

  // Convert to impact score for state management
  convertToImpactScore(safety: SafetyScore): ImpactScore {
    return {
      fileCount: safety.fileCount,
      crossModuleImpact: safety.crossModule,
      buildImpact: safety.buildImpact,
      testCoverage: safety.testCoverage,
      rollbackDifficulty: safety.rollbackDifficulty,
    };
  }
}
