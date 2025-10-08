/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * ESLint Fix Command
 *
 * Fixes ESLint errors and warnings:
 * - Auto-fixable rules via eslint --fix
 * - Unused imports removal
 * - Code style violations
 * - Formatting issues
 */

import { promises as fs } from "fs";
import { execSync } from "child_process";
import {
  BaseFixCommand,
  type Issue,
  type FixResult,
  type FixCommandOptions,
  type FileChange,
} from "./fix-command.js";
import type { Logger } from "../../shared/logger.js";

export class ESLintFixCommand extends BaseFixCommand {
  readonly id = "eslint-fix";
  readonly name = "ESLint Auto-Fixer";
  readonly description = "Automatically fixes ESLint errors and warnings";

  constructor(logger: Logger) {
    super(logger);
  }

  canFix(issue: Issue): boolean {
    return issue.category === "eslint" && issue.autoFixable;
  }

  async execute(
    issues: Issue[],
    options?: FixCommandOptions,
  ): Promise<FixResult> {
    const startTime = Date.now();
    const fixedIssues: Issue[] = [];
    const failedIssues: Issue[] = [];
    const changes: FileChange[] = [];

    this.logger.info("Starting ESLint fixes", {
      issueCount: issues.length,
      dryRun: options?.dryRun ?? false,
    });

    try {
      // Group issues by file
      const issuesByFile = this.groupByFile(issues);

      let step = 0;
      const totalSteps = issuesByFile.size;

      for (const [filePath, fileIssues] of issuesByFile.entries()) {
        step++;
        this.reportProgress(
          options,
          step,
          totalSteps,
          `Fixing ${filePath} (${fileIssues.length} issues)`,
        );

        try {
          const change = await this.fixFile(filePath, fileIssues, options);

          if (change) {
            changes.push(change);
            fixedIssues.push(...fileIssues);

            // Add to undo stack
            if (!options?.dryRun) {
              this.undoStack.push(change);
            }
          }
        } catch (error) {
          this.logger.error(`Failed to fix ${filePath}`, {
            error: error instanceof Error ? error.message : String(error),
          });
          failedIssues.push(...fileIssues);
        }
      }

      const duration = Date.now() - startTime;

      this.logger.info("ESLint fixes completed", {
        fixed: fixedIssues.length,
        failed: failedIssues.length,
        changes: changes.length,
        duration,
      });

      return {
        success: failedIssues.length === 0,
        fixedIssues,
        failedIssues,
        changes,
        duration,
        metadata: {
          filesModified: issuesByFile.size,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error("ESLint fix execution failed", {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        fixedIssues: [],
        failedIssues: issues,
        changes: [],
        error: error instanceof Error ? error.message : String(error),
        duration,
      };
    }
  }

  /**
   * Fix all ESLint issues in a single file
   */
  private async fixFile(
    filePath: string,
    issues: Issue[],
    options?: FixCommandOptions,
  ): Promise<FileChange | null> {
    // Read original content
    const originalContent = await fs.readFile(filePath, "utf8");

    // Create backup if requested
    if (options?.createBackup) {
      await this.createBackup(filePath, originalContent);
    }

    // Try ESLint auto-fix first
    let modifiedContent = originalContent;

    if (!options?.dryRun) {
      try {
        // Run ESLint with --fix flag
        execSync(`npx eslint --fix ${filePath}`, {
          stdio: "pipe",
          encoding: "utf8",
        });

        // Read the fixed content
        modifiedContent = await fs.readFile(filePath, "utf8");
      } catch (error) {
        this.logger.warn(`ESLint auto-fix failed for ${filePath}`, {
          error: error instanceof Error ? error.message : String(error),
        });

        // Try manual fixes as fallback
        modifiedContent = await this.applyManualFixes(originalContent, issues);

        if (modifiedContent !== originalContent) {
          await fs.writeFile(filePath, modifiedContent, "utf8");
        }
      }
    } else {
      // Dry run - simulate fixes
      modifiedContent = await this.applyManualFixes(originalContent, issues);
    }

    // If no changes, return null
    if (modifiedContent === originalContent) {
      return null;
    }

    const checksum = await this.calculateChecksum(originalContent);

    return {
      filePath,
      originalContent,
      newContent: modifiedContent,
      changeType: "modify",
      timestamp: new Date(),
      checksum,
    };
  }

  /**
   * Apply manual fixes for specific ESLint rules
   */
  private async applyManualFixes(
    content: string,
    issues: Issue[],
  ): Promise<string> {
    let modifiedContent = content;

    for (const issue of issues) {
      const metadata = issue.metadata as Record<string, unknown> | undefined;
      const ruleId = metadata?.ruleId as string | undefined;

      switch (ruleId) {
        case "no-unused-vars":
          modifiedContent = this.fixUnusedVars(modifiedContent, issue);
          break;

        case "no-console":
          modifiedContent = this.fixNoConsole(modifiedContent, issue);
          break;

        case "prefer-const":
          modifiedContent = this.fixPreferConst(modifiedContent, issue);
          break;

        case "no-var":
          modifiedContent = this.fixNoVar(modifiedContent, issue);
          break;

        case "quotes":
          modifiedContent = this.fixQuotes(modifiedContent, issue);
          break;

        case "semi":
          modifiedContent = this.fixSemicolons(modifiedContent, issue);
          break;

        default:
          this.logger.debug(`No manual fix available for rule: ${ruleId}`);
      }
    }

    return modifiedContent;
  }

  /**
   * Fix unused variables by adding _ prefix
   */
  private fixUnusedVars(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const variableName = metadata?.variableName as string | undefined;

    if (!variableName || issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Add _ prefix
    const modifiedLine = line.replace(
      new RegExp(`\\b${variableName}\\b`, "g"),
      `_${variableName}`,
    );

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix console.log by replacing with logger
   */
  private fixNoConsole(content: string, issue: Issue): string {
    if (issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Skip if it's a CLI file (allowed exception)
    if (content.includes("cli/") || content.includes("scripts/")) {
      return content;
    }

    // Replace console.log with logger.info
    const modifiedLine = line
      .replace(/console\.log\(/g, "this.logger.info(")
      .replace(/console\.error\(/g, "this.logger.error(")
      .replace(/console\.warn\(/g, "this.logger.warn(")
      .replace(/console\.debug\(/g, "this.logger.debug(");

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;

      // Ensure logger import exists
      const hasLoggerImport =
        content.includes("import") && content.includes("Logger");
      if (!hasLoggerImport) {
        // Add logger import at the top
        const firstImportIndex = lines.findIndex((l) =>
          l.trim().startsWith("import"),
        );
        if (firstImportIndex >= 0) {
          lines.splice(
            firstImportIndex,
            0,
            'import { Logger } from "../shared/logger.js";',
          );
        }
      }

      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix prefer-const by replacing let with const
   */
  private fixPreferConst(content: string, issue: Issue): string {
    if (issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Replace let with const if variable is never reassigned
    const modifiedLine = line.replace(/\blet\b/, "const");

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix no-var by replacing var with let/const
   */
  private fixNoVar(content: string, issue: Issue): string {
    if (issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Replace var with const (ESLint will suggest let if needed)
    const modifiedLine = line.replace(/\bvar\b/, "const");

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix quote style
   */
  private fixQuotes(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const preferredQuote = (metadata?.preferredQuote as string) ?? "double";

    if (issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    let modifiedLine = line;

    if (preferredQuote === "double") {
      // Replace single quotes with double quotes
      modifiedLine = line.replace(/'([^']*)'/g, '"$1"');
    } else {
      // Replace double quotes with single quotes
      modifiedLine = line.replace(/"([^"]*)"/g, "'$1'");
    }

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix semicolon usage
   */
  private fixSemicolons(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const requireSemi = (metadata?.requireSemi as boolean) ?? true;

    if (issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    let modifiedLine = line;

    if (requireSemi && !line.trim().endsWith(";")) {
      // Add semicolon at the end
      modifiedLine = line.trimEnd() + ";";
    } else if (!requireSemi && line.trim().endsWith(";")) {
      // Remove semicolon
      modifiedLine = line.replace(/;$/, "");
    }

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Group issues by file path
   */
  private groupByFile(issues: Issue[]): Map<string, Issue[]> {
    const grouped = new Map<string, Issue[]>();

    for (const issue of issues) {
      const existing = grouped.get(issue.filePath) ?? [];
      existing.push(issue);
      grouped.set(issue.filePath, existing);
    }

    return grouped;
  }

  /**
   * Create backup of file
   */
  private async createBackup(filePath: string, content: string): Promise<void> {
    const backupPath = `${filePath}.backup-${Date.now()}`;
    await fs.writeFile(backupPath, content, "utf8");
    this.logger.debug(`Created backup: ${backupPath}`);
  }
}
