/**
 * Documentation Fix Command
 *
 * Fixes documentation issues:
 * - Missing JSDoc comments
 * - Incomplete JSDoc tags
 * - Outdated documentation
 * - Missing parameter descriptions
 * - Missing return type documentation
 */

import { promises as fs } from "fs";
import {
  BaseFixCommand,
  type Issue,
  type FixResult,
  type FixCommandOptions,
  type FileChange,
} from "./fix-command.js";
import type { Logger } from "../../shared/logger.js";

export class DocumentationFixCommand extends BaseFixCommand {
  readonly id = "documentation-fix";
  readonly name = "Documentation Fixer";
  readonly description = "Automatically adds or fixes documentation comments";

  constructor(logger: Logger) {
    super(logger);
  }

  canFix(issue: Issue): boolean {
    return issue.category === "documentation" && issue.autoFixable;
  }

  async execute(
    issues: Issue[],
    options?: FixCommandOptions,
  ): Promise<FixResult> {
    const startTime = Date.now();
    const fixedIssues: Issue[] = [];
    const failedIssues: Issue[] = [];
    const changes: FileChange[] = [];

    this.logger.info("Starting documentation fixes", {
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

      this.logger.info("Documentation fixes completed", {
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

      this.logger.error("Documentation fix execution failed", {
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
   * Fix all documentation issues in a single file
   */
  private async fixFile(
    filePath: string,
    issues: Issue[],
    options?: FixCommandOptions,
  ): Promise<FileChange | null> {
    const originalContent = await fs.readFile(filePath, "utf8");
    let modifiedContent = originalContent;

    // Create backup if requested
    if (options?.createBackup) {
      await this.createBackup(filePath, originalContent);
    }

    // Apply fixes
    for (const issue of issues) {
      modifiedContent = this.applyFix(modifiedContent, issue);
    }

    // If no changes, return null
    if (modifiedContent === originalContent) {
      return null;
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
   * Apply a specific documentation fix
   */
  private applyFix(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const fixType = metadata?.fixType as string | undefined;

    switch (fixType) {
      case "missing-jsdoc":
        return this.addJSDoc(content, issue);

      case "incomplete-param":
        return this.addParameterDoc(content, issue);

      case "missing-return":
        return this.addReturnDoc(content, issue);

      case "missing-description":
        return this.addDescription(content, issue);

      default:
        this.logger.warn(`Unknown documentation fix type: ${fixType}`, {
          issue,
        });
        return content;
    }
  }

  /**
   * Add JSDoc comment to a function/class
   */
  private addJSDoc(content: string, issue: Issue): string {
    if (issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const targetLine = issue.line - 1;
    const line = lines[targetLine];
    const indentation = line.match(/^\s*/)?.[0] ?? "";

    // Extract function/class signature
    const signature = this.extractSignature(lines, targetLine);
    if (!signature) {
      return content;
    }

    // Generate JSDoc comment
    const jsdoc = this.generateJSDoc(signature, indentation);

    // Insert JSDoc above the function/class
    lines.splice(targetLine, 0, ...jsdoc);

    return lines.join("\n");
  }

  /**
   * Add parameter documentation
   */
  private addParameterDoc(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const paramName = metadata?.paramName as string | undefined;
    const paramType = metadata?.paramType as string | undefined;

    if (!paramName || issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const targetLine = issue.line - 1;

    // Find the JSDoc comment block
    let jsdocStart = -1;
    for (let i = targetLine - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith("/**")) {
        jsdocStart = i;
        break;
      }
      if (!lines[i].trim().startsWith("*") && lines[i].trim() !== "") {
        break;
      }
    }

    if (jsdocStart === -1) {
      return content;
    }

    // Find where to insert the @param tag
    let insertIndex = jsdocStart + 1;
    for (let i = jsdocStart + 1; i < targetLine; i++) {
      if (lines[i].includes("@param")) {
        insertIndex = i + 1;
      }
      if (lines[i].includes("@returns") || lines[i].includes("@return")) {
        break;
      }
    }

    const indentation = lines[jsdocStart].match(/^\s*/)?.[0] ?? "";
    const paramDoc = paramType
      ? `${indentation} * @param {${paramType}} ${paramName} - Description needed`
      : `${indentation} * @param ${paramName} - Description needed`;

    lines.splice(insertIndex, 0, paramDoc);

    return lines.join("\n");
  }

  /**
   * Add return documentation
   */
  private addReturnDoc(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const returnType = metadata?.returnType as string | undefined;

    if (issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const targetLine = issue.line - 1;

    // Find the JSDoc comment block
    let jsdocStart = -1;
    let jsdocEnd = -1;
    for (let i = targetLine - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith("/**")) {
        jsdocStart = i;
        break;
      }
      if (lines[i].trim() === "*/") {
        jsdocEnd = i;
      }
      if (!lines[i].trim().startsWith("*") && lines[i].trim() !== "") {
        break;
      }
    }

    if (jsdocStart === -1 || jsdocEnd === -1) {
      return content;
    }

    const indentation = lines[jsdocStart].match(/^\s*/)?.[0] ?? "";
    const returnDoc = returnType
      ? `${indentation} * @returns {${returnType}} Description needed`
      : `${indentation} * @returns Description needed`;

    // Insert before the closing */
    lines.splice(jsdocEnd, 0, `${indentation} *`, returnDoc);

    return lines.join("\n");
  }

  /**
   * Add description to existing JSDoc
   */
  private addDescription(content: string, issue: Issue): string {
    if (issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const targetLine = issue.line - 1;

    // Find the JSDoc comment block
    let jsdocStart = -1;
    for (let i = targetLine - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith("/**")) {
        jsdocStart = i;
        break;
      }
    }

    if (jsdocStart === -1) {
      return content;
    }

    const indentation = lines[jsdocStart].match(/^\s*/)?.[0] ?? "";

    // Add a description placeholder
    const description = `${indentation} * Description needed for this function/class`;
    lines.splice(jsdocStart + 1, 0, description, `${indentation} *`);

    return lines.join("\n");
  }

  /**
   * Extract function/class signature
   */
  private extractSignature(lines: string[], startLine: number): string | null {
    const line = lines[startLine];

    // Check if it's a function/class/method
    if (
      line.includes("function") ||
      line.includes("class") ||
      line.includes("=>") ||
      line.includes("async")
    ) {
      return line.trim();
    }

    return null;
  }

  /**
   * Generate JSDoc comment based on signature
   */
  private generateJSDoc(signature: string, indentation: string): string[] {
    const jsdoc: string[] = [`${indentation}/**`];

    // Add description placeholder
    jsdoc.push(`${indentation} * Description needed`);
    jsdoc.push(`${indentation} *`);

    // Extract parameters
    const params = this.extractParameters(signature);
    if (params.length > 0) {
      for (const param of params) {
        jsdoc.push(`${indentation} * @param ${param} - Description needed`);
      }
      jsdoc.push(`${indentation} *`);
    }

    // Add return tag if not a constructor or void
    if (!signature.includes("constructor") && !signature.includes(": void")) {
      jsdoc.push(`${indentation} * @returns Description needed`);
    }

    jsdoc.push(`${indentation} */`);

    return jsdoc;
  }

  /**
   * Extract parameter names from signature
   */
  private extractParameters(signature: string): string[] {
    const match = signature.match(/\(([^)]*)\)/);
    if (!match) {
      return [];
    }

    const paramsString = match[1];
    if (!paramsString.trim()) {
      return [];
    }

    return paramsString
      .split(",")
      .map((param) => {
        // Extract parameter name (before : or =)
        const name = param.trim().split(/[:\s=]/)[0];
        return name;
      })
      .filter((name) => name && name !== "");
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
