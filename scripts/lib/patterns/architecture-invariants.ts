/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Architecture Invariants Validator
 *
 * Purpose:
 * - Define and enforce architectural rules that must ALWAYS hold true
 * - Detect violations automatically across entire codebase
 * - Prevent architectural erosion over time
 *
 * Design Philosophy:
 * - Invariants are NOT guidelines - they are hard constraints
 * - Violations should block builds/commits
 * - Rules should be enforceable via static analysis
 */

import { readFileSync, existsSync } from "fs";
import { glob } from "glob";
import { join } from "path";

export interface ArchitectureInvariant {
  id: string;
  name: string;
  description: string;
  severity: "P0" | "P1" | "P2";
  category: "structure" | "pattern" | "dependency" | "lifecycle";
  check: (codebase: CodebaseSnapshot) => InvariantViolation[];
}

export interface CodebaseSnapshot {
  rootDir: string;
  files: FileInfo[];
  patterns: Map<string, FileInfo[]>;
}

export interface FileInfo {
  path: string;
  content: string;
  imports: string[];
  exports: string[];
  usesReadline: boolean;
  usesGovernance: boolean;
}

export interface InvariantViolation {
  invariantId: string;
  file: string;
  line?: number;
  severity: "P0" | "P1" | "P2";
  message: string;
  suggestion: string;
  autoFixable: boolean;
}

/**
 * Invariant 1: Single Environment Detection
 *
 * All environment detection MUST use env-detection.ts
 * No direct process.stdin.isTTY or CLAUDECODE checks allowed
 */
export const SINGLE_ENV_DETECTION: ArchitectureInvariant = {
  id: "SINGLE_ENV_DETECTION",
  name: "Centralized Environment Detection",
  description:
    "All environment detection must use scripts/lib/env-detection.ts",
  severity: "P0",
  category: "pattern",

  check: (codebase: CodebaseSnapshot): InvariantViolation[] => {
    const violations: InvariantViolation[] = [];

    for (const file of codebase.files) {
      // Skip exempted files (source of truth + this file itself)
      if (file.path.includes("env-detection.ts")) continue;
      if (file.path.includes("architecture-invariants.ts")) continue;
      if (file.path.includes("test-")) continue;
      // Skip deprecated files (marked with autoBlockIfDeprecated)
      if (file.content.includes("autoBlockIfDeprecated")) continue;

      // Check for direct isTTY usage
      const isTTYMatches = file.content.matchAll(/process\.stdin\.isTTY/g);
      for (const match of isTTYMatches) {
        // Allow if detectEnvironment is also imported
        if (!file.imports.some((imp) => imp.includes("env-detection"))) {
          violations.push({
            invariantId: "SINGLE_ENV_DETECTION",
            file: file.path,
            severity: "P0",
            message:
              "Direct process.stdin.isTTY usage without env-detection import",
            suggestion:
              "Import and use detectEnvironment() from ./lib/env-detection.js",
            autoFixable: true,
          });
        }
      }

      // Check for direct CLAUDECODE checks
      const claudeCodeMatches = file.content.matchAll(
        /process\.env\.CLAUDECODE/g,
      );
      for (const match of claudeCodeMatches) {
        if (
          !file.path.includes("env-detection.ts") &&
          !file.imports.some((imp) => imp.includes("env-detection"))
        ) {
          violations.push({
            invariantId: "SINGLE_ENV_DETECTION",
            file: file.path,
            severity: "P0",
            message:
              "Direct CLAUDECODE environment variable check without env-detection",
            suggestion:
              "Use detectEnvironment().isClaudeCode instead of direct env check",
            autoFixable: true,
          });
        }
      }
    }

    return violations;
  },
};

/**
 * Invariant 2: No Duplicate Logic
 *
 * Same logic should not be duplicated across files
 * Detects copy-paste of environment detection logic
 */
export const NO_DUPLICATE_ENV_LOGIC: ArchitectureInvariant = {
  id: "NO_DUPLICATE_ENV_LOGIC",
  name: "No Duplicate Environment Detection Logic",
  description:
    "Environment detection logic should only exist in env-detection.ts",
  severity: "P1",
  category: "pattern",

  check: (codebase: CodebaseSnapshot): InvariantViolation[] => {
    const violations: InvariantViolation[] = [];

    // Pattern: const isClaudeCode = process.env.CLAUDECODE === "1"
    const duplicatePatterns = [
      /const\s+isClaudeCode\s*=\s*process\.env\.CLAUDECODE/,
      /const\s+isTTY\s*=\s*.*process\.stdin\.isTTY/,
      /const\s+isInteractive\s*=\s*.*isTTY.*isClaudeCode/,
    ];

    for (const file of codebase.files) {
      // Skip exempted files
      if (file.path.includes("env-detection.ts")) continue;
      if (file.path.includes("architecture-invariants.ts")) continue;
      // Skip deprecated files
      if (file.content.includes("autoBlockIfDeprecated")) continue;

      for (const pattern of duplicatePatterns) {
        if (pattern.test(file.content)) {
          violations.push({
            invariantId: "NO_DUPLICATE_ENV_LOGIC",
            file: file.path,
            severity: "P1",
            message:
              "Duplicate environment detection logic found - should use env-detection.ts",
            suggestion:
              "Remove local environment detection and import detectEnvironment()",
            autoFixable: true,
          });
        }
      }
    }

    return violations;
  },
};

/**
 * Invariant 3: Consistent Migration
 *
 * If migration is in progress, all target files must be migrated together
 * No partial migrations allowed
 */
export const CONSISTENT_MIGRATION: ArchitectureInvariant = {
  id: "CONSISTENT_MIGRATION",
  name: "Complete Migration Required",
  description:
    "Migrations must be completed across all target files - no partial migrations",
  severity: "P0",
  category: "lifecycle",

  check: (codebase: CodebaseSnapshot): InvariantViolation[] => {
    const violations: InvariantViolation[] = [];

    // Load migration registry
    const migrationPath = join(codebase.rootDir, ".migration", "progress.json");
    if (!existsSync(migrationPath)) return violations;

    const migration = JSON.parse(readFileSync(migrationPath, "utf8"));

    for (const mig of migration.migrations) {
      if (mig.status !== "in_progress") continue;

      const notCompleted = mig.targetFiles.filter(
        (f: any) => f.status !== "completed",
      );

      if (notCompleted.length > 0 && mig.progress.completed > 0) {
        // Partial migration detected
        for (const file of notCompleted) {
          violations.push({
            invariantId: "CONSISTENT_MIGRATION",
            file: file.path,
            severity: "P0",
            message: `Migration ${mig.id} is incomplete - ${notCompleted.length} files remaining`,
            suggestion: `Complete migration in ${file.path} or revert completed files`,
            autoFixable: false,
          });
        }
      }
    }

    return violations;
  },
};

/**
 * Invariant 4: Readline Requires Environment Detection
 *
 * Any file using readline MUST also import detectEnvironment
 */
export const READLINE_REQUIRES_ENV_DETECTION: ArchitectureInvariant = {
  id: "READLINE_REQUIRES_ENV_DETECTION",
  name: "Readline Must Use Environment Detection",
  description:
    "Files using readline.createInterface must import detectEnvironment",
  severity: "P0",
  category: "dependency",

  check: (codebase: CodebaseSnapshot): InvariantViolation[] => {
    const violations: InvariantViolation[] = [];

    for (const file of codebase.files) {
      // Skip deprecated files
      if (file.content.includes("autoBlockIfDeprecated")) continue;

      if (file.usesReadline) {
        const hasEnvDetection = file.imports.some((imp) =>
          imp.includes("env-detection"),
        );

        if (!hasEnvDetection) {
          violations.push({
            invariantId: "READLINE_REQUIRES_ENV_DETECTION",
            file: file.path,
            severity: "P0",
            message:
              "File uses readline but does not import detectEnvironment()",
            suggestion:
              "Add: import { detectEnvironment } from './lib/env-detection.js'",
            autoFixable: true,
          });
        }
      }
    }

    return violations;
  },
};

/**
 * All Invariants Registry
 */
export const ALL_INVARIANTS: ArchitectureInvariant[] = [
  SINGLE_ENV_DETECTION,
  NO_DUPLICATE_ENV_LOGIC,
  CONSISTENT_MIGRATION,
  READLINE_REQUIRES_ENV_DETECTION,
];

/**
 * Create codebase snapshot
 */
export function createCodebaseSnapshot(rootDir: string): CodebaseSnapshot {
  const files: FileInfo[] = [];

  const filePaths = glob.sync("scripts/**/*.ts", {
    cwd: rootDir,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });

  for (const filePath of filePaths) {
    const fullPath = join(rootDir, filePath);
    const content = readFileSync(fullPath, "utf8");

    // Extract imports
    const importMatches = content.matchAll(
      /import\s+.*?\s+from\s+['"](.+?)['"]/g,
    );
    const imports = Array.from(importMatches, (m) => m[1]);

    // Extract exports
    const exportMatches = content.matchAll(
      /export\s+(class|function|const|interface|type)\s+(\w+)/g,
    );
    const exports = Array.from(exportMatches, (m) => m[2]);

    // Detect patterns
    const usesReadline = /readline\.createInterface/.test(content);
    const usesGovernance = /GovernanceRunner/.test(content);

    files.push({
      path: filePath,
      content,
      imports,
      exports,
      usesReadline,
      usesGovernance,
    });
  }

  return {
    rootDir,
    files,
    patterns: new Map(),
  };
}

/**
 * Validate all invariants
 */
export function validateInvariants(
  snapshot: CodebaseSnapshot,
  invariants: ArchitectureInvariant[] = ALL_INVARIANTS,
): InvariantViolation[] {
  const allViolations: InvariantViolation[] = [];

  for (const invariant of invariants) {
    const violations = invariant.check(snapshot);
    allViolations.push(...violations);
  }

  return allViolations;
}
