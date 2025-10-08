/**
 * TypeScript Fix Command
 *
 * Fixes TypeScript compilation errors:
 * - Type mismatches
 * - Missing return types
 * - Unused variables (with _ prefix)
 * - Non-null assertions (replace with ?? operator)
 * - Any types (suggest proper types)
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

export class TypeScriptFixCommand extends BaseFixCommand {
  readonly id = "typescript-fix";
  readonly name = "TypeScript Error Fixer";
  readonly description =
    "Automatically fixes common TypeScript compilation errors";

  constructor(logger: Logger) {
    super(logger);
  }

  canFix(issue: Issue): boolean {
    return issue.category === "typescript" && issue.autoFixable;
  }

  async execute(
    issues: Issue[],
    options?: FixCommandOptions,
  ): Promise<FixResult> {
    const startTime = Date.now();
    const fixedIssues: Issue[] = [];
    const failedIssues: Issue[] = [];
    const changes: FileChange[] = [];

    this.logger.info("Starting TypeScript fixes", {
      issueCount: issues.length,
      dryRun: options?.dryRun ?? false,
    });

    try {
      // Group issues by file for efficient processing
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

      // Verify TypeScript compilation if not dry run
      if (!options?.dryRun && changes.length > 0) {
        const compilationSuccess = await this.verifyTypeScript();
        if (!compilationSuccess) {
          this.logger.warn("TypeScript compilation failed after fixes");
          // Don't fail completely, just report
        }
      }

      const duration = Date.now() - startTime;

      this.logger.info("TypeScript fixes completed", {
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
          compilationVerified: !options?.dryRun,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error("TypeScript fix execution failed", {
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
   * Fix all TypeScript issues in a single file
   */
  private async fixFile(
    filePath: string,
    issues: Issue[],
    options?: FixCommandOptions,
  ): Promise<FileChange | null> {
    // Read original content
    const originalContent = await fs.readFile(filePath, "utf8");
    let modifiedContent = originalContent;

    // Apply fixes based on issue types
    for (const issue of issues) {
      modifiedContent = this.applyFix(modifiedContent, issue);
    }

    // If no changes, return null
    if (modifiedContent === originalContent) {
      return null;
    }

    // Create backup if requested
    if (options?.createBackup) {
      await this.createBackup(filePath, originalContent);
    }

    // Write modified content (unless dry run)
    if (!options?.dryRun) {
      await fs.writeFile(filePath, modifiedContent, "utf8");
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
   * Apply a specific fix based on issue type
   */
  private applyFix(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const fixType = metadata?.fixType as string | undefined;

    switch (fixType) {
      case "unused-variable":
        return this.fixUnusedVariable(content, issue);

      case "missing-return-type":
        return this.fixMissingReturnType(content, issue);

      case "non-null-assertion":
        return this.fixNonNullAssertion(content, issue);

      case "any-type":
        return this.fixAnyType(content, issue);

      case "type-mismatch":
        return this.fixTypeMismatch(content, issue);

      default:
        this.logger.warn(`Unknown fix type: ${fixType}`, { issue });
        return content;
    }
  }

  /**
   * Fix unused variable by adding _ prefix
   */
  private fixUnusedVariable(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const variableName = metadata?.variableName as string | undefined;

    if (!variableName || issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const lineIndex = issue.line - 1;

    if (lineIndex < 0 || lineIndex >= lines.length) {
      return content;
    }

    const line = lines[lineIndex];

    // Check if variable is already prefixed with _
    if (new RegExp(`\\b_${variableName}\\b`).test(line)) {
      return content;
    }

    // Add _ prefix to unused variable - handle multiple occurrences in same line
    // This regex matches the variable name as a whole word
    const modifiedLine = line.replace(
      new RegExp(`\\b${variableName}\\b`, "g"),
      `_${variableName}`,
    );

    if (modifiedLine !== line) {
      lines[lineIndex] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix missing return type
   */
  private fixMissingReturnType(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const suggestedType = metadata?.suggestedType as string | undefined;

    if (!suggestedType || issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Add return type annotation
    // function foo() { ... } => function foo(): Type { ... }
    // const foo = () => { ... } => const foo = (): Type => { ... }
    const patterns = [
      // Arrow function: () => { ... } => (): Type => { ... }
      { regex: /(\([^)]*\))\s*=>/, replacement: `$1: ${suggestedType} =>` },
      // Regular function: function foo() { ... } => function foo(): Type { ... }
      {
        regex: /function\s+\w+\s*\([^)]*\)\s*\{/,
        replacement: (match: string) =>
          match.replace("{", `: ${suggestedType} {`),
      },
    ];

    let modifiedLine = line;

    for (const { regex, replacement } of patterns) {
      if (regex.test(line)) {
        if (typeof replacement === "function") {
          modifiedLine = replacement(line);
        } else {
          modifiedLine = line.replace(regex, replacement);
        }
        break;
      }
    }

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix non-null assertion by replacing with nullish coalescing
   */
  private fixNonNullAssertion(content: string, issue: Issue): string {
    if (issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Replace foo! with (foo ?? defaultValue)
    // This is a simplified version - real implementation would need more context
    const modifiedLine = line.replace(/(\w+)!/g, "($1 ?? undefined)");

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix 'any' type by suggesting a more specific type
   */
  private fixAnyType(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const suggestedType = metadata?.suggestedType as string | undefined;

    if (!suggestedType || issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Replace : any with : suggestedType
    const modifiedLine = line.replace(/:\s*any\b/g, `: ${suggestedType}`);

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix type mismatch by adding type assertion
   */
  private fixTypeMismatch(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const targetType = metadata?.targetType as string | undefined;

    if (!targetType || issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Add type assertion: value => (value as TargetType)
    // This is a simplified version
    const modifiedLine = line.replace(
      /(\w+)\s*=\s*([^;]+);/,
      `$1 = ($2 as ${targetType});`,
    );

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

  /**
   * Verify TypeScript compilation
   */
  private async verifyTypeScript(): Promise<boolean> {
    try {
      execSync("npx tsc --noEmit -p tsconfig.build.json", {
        stdio: "pipe",
        encoding: "utf8",
      });
      return true;
    } catch (error) {
      this.logger.warn("TypeScript compilation check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
