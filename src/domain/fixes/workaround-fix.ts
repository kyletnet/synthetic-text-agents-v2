/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Workaround Fix Command
 *
 * Fixes workaround markers:
 * - TODO comments → Convert to proper issues or remove
 * - FIXME comments → Convert to proper issues or remove
 * - HACK comments → Refactor or document properly
 * - XXX comments → Convert to proper issues or remove
 * - Temporary code markers
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

export class WorkaroundFixCommand extends BaseFixCommand {
  readonly id = "workaround-fix";
  readonly name = "Workaround Marker Fixer";
  readonly description = "Removes or properly documents workaround markers";

  constructor(logger: Logger) {
    super(logger);
  }

  canFix(issue: Issue): boolean {
    return issue.category === "workaround" && issue.autoFixable;
  }

  async execute(
    issues: Issue[],
    options?: FixCommandOptions,
  ): Promise<FixResult> {
    const startTime = Date.now();
    const fixedIssues: Issue[] = [];
    const failedIssues: Issue[] = [];
    const changes: FileChange[] = [];

    this.logger.info("Starting workaround fixes", {
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

      this.logger.info("Workaround fixes completed", {
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

      this.logger.error("Workaround fix execution failed", {
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
   * Fix all workaround issues in a single file
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

    // Apply fixes based on marker type
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
   * Apply a specific workaround fix
   */
  private applyFix(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const markerType = (metadata?.markerType as string | undefined) ?? "TODO";

    if (issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Determine fix action based on marker type and content
    const action = this.determineAction(line, markerType);

    switch (action) {
      case "remove":
        return this.removeMarkerLine(lines, issue.line - 1);

      case "convert-to-doc":
        return this.convertToDocumentation(lines, issue.line - 1, markerType);

      case "keep":
        // Keep the marker but improve formatting
        return this.improveMarkerFormat(lines, issue.line - 1, markerType);

      default:
        return content;
    }
  }

  /**
   * Determine what action to take for a marker
   */
  private determineAction(
    line: string,
    markerType: string,
  ): "remove" | "convert-to-doc" | "keep" {
    const lowerLine = line.toLowerCase();

    // Remove if it's a vague or completed TODO
    if (
      lowerLine.includes("fixme: none") ||
      lowerLine.includes("todo: none") ||
      lowerLine.includes("completed") ||
      lowerLine.includes("done") ||
      lowerLine.includes("fixed")
    ) {
      return "remove";
    }

    // Convert to documentation if it's a significant design decision
    if (
      lowerLine.includes("important") ||
      lowerLine.includes("critical") ||
      lowerLine.includes("design decision") ||
      markerType === "HACK"
    ) {
      return "convert-to-doc";
    }

    // Keep if it's a legitimate future work item
    if (
      lowerLine.includes("implement") ||
      lowerLine.includes("refactor") ||
      lowerLine.includes("optimize")
    ) {
      return "keep";
    }

    // Default: remove vague markers
    return "remove";
  }

  /**
   * Remove a marker line
   */
  private removeMarkerLine(lines: string[], lineIndex: number): string {
    // Remove the line
    lines.splice(lineIndex, 1);

    // Remove empty comment lines before/after if they exist
    if (lineIndex > 0 && lines[lineIndex - 1].trim() === "//") {
      lines.splice(lineIndex - 1, 1);
    }

    if (lineIndex < lines.length && lines[lineIndex].trim() === "//") {
      lines.splice(lineIndex, 1);
    }

    return lines.join("\n");
  }

  /**
   * Convert marker to proper documentation comment
   */
  private convertToDocumentation(
    lines: string[],
    lineIndex: number,
    markerType: string,
  ): string {
    const line = lines[lineIndex];
    const indentation = line.match(/^\s*/)?.[0] ?? "";

    // Extract the marker content
    const markerContent = line
      .replace(/\/\/\s*/, "")
      .replace(/\/\*\s*/, "")
      .replace(/\*\/\s*/, "")
      .replace(new RegExp(`${markerType}:?\\s*`, "i"), "")
      .trim();

    // Create a proper JSDoc comment
    const docComment = [
      `${indentation}/**`,
      `${indentation} * ${markerContent}`,
      `${indentation} *`,
      `${indentation} * @remarks This is a known limitation that should be addressed in future iterations.`,
      `${indentation} */`,
    ];

    // Replace the line with the documentation
    lines.splice(lineIndex, 1, ...docComment);

    return lines.join("\n");
  }

  /**
   * Improve marker formatting
   */
  private improveMarkerFormat(
    lines: string[],
    lineIndex: number,
    markerType: string,
  ): string {
    const line = lines[lineIndex];
    const indentation = line.match(/^\s*/)?.[0] ?? "";

    // Extract the marker content
    const markerContent = line
      .replace(/\/\/\s*/, "")
      .replace(/\/\*\s*/, "")
      .replace(/\*\/\s*/, "")
      .replace(new RegExp(`${markerType}:?\\s*`, "i"), "")
      .trim();

    // Create a well-formatted marker
    const formattedMarker = `${indentation}// ${markerType.toUpperCase()}: ${markerContent}`;

    lines[lineIndex] = formattedMarker;

    return lines.join("\n");
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
