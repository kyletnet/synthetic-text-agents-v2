/**
 * Import Fix Command
 *
 * Fixes import-related issues:
 * - Missing imports
 * - Incorrect import paths
 * - Unused imports removal
 * - Import sorting and organization
 * - .js extension enforcement (for ESM)
 */

import { promises as fs } from "fs";
import { dirname, relative, resolve, join } from "path";
import {
  BaseFixCommand,
  type Issue,
  type FixResult,
  type FixCommandOptions,
  type FileChange,
} from "./fix-command.js";
import type { Logger } from "../../shared/logger.js";

export class ImportFixCommand extends BaseFixCommand {
  readonly id = "import-fix";
  readonly name = "Import Path Fixer";
  readonly description = "Automatically fixes import paths and missing imports";

  constructor(logger: Logger) {
    super(logger);
  }

  canFix(issue: Issue): boolean {
    return issue.category === "import" && issue.autoFixable;
  }

  async execute(
    issues: Issue[],
    options?: FixCommandOptions,
  ): Promise<FixResult> {
    const startTime = Date.now();
    const fixedIssues: Issue[] = [];
    const failedIssues: Issue[] = [];
    const changes: FileChange[] = [];

    this.logger.info("Starting import fixes", {
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

      this.logger.info("Import fixes completed", {
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

      this.logger.error("Import fix execution failed", {
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
   * Fix all import issues in a single file
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

    // Apply fixes based on issue types
    for (const issue of issues) {
      modifiedContent = await this.applyFix(modifiedContent, filePath, issue);
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
   * Apply a specific import fix
   */
  private async applyFix(
    content: string,
    filePath: string,
    issue: Issue,
  ): Promise<string> {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const fixType = metadata?.fixType as string | undefined;

    switch (fixType) {
      case "missing-js-extension":
        return this.fixMissingJsExtension(content, issue);

      case "incorrect-import-path":
        return await this.fixIncorrectImportPath(content, filePath, issue);

      case "unused-import":
        return this.fixUnusedImport(content, issue);

      case "missing-import":
        return this.fixMissingImport(content, issue);

      case "organize-imports":
        return this.organizeImports(content);

      default:
        this.logger.warn(`Unknown import fix type: ${fixType}`, { issue });
        return content;
    }
  }

  /**
   * Fix missing .js extension in imports (ESM requirement)
   */
  private fixMissingJsExtension(content: string, issue: Issue): string {
    if (issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Add .js extension to relative imports
    // import { foo } from "./bar" => import { foo } from "./bar.js"
    const modifiedLine = line.replace(
      /from\s+["'](\.[^"']+)["']/g,
      (match, importPath) => {
        if (importPath.endsWith(".js") || importPath.endsWith(".ts")) {
          return match;
        }
        return match.replace(importPath, `${importPath}.js`);
      },
    );

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix incorrect import path
   */
  private async fixIncorrectImportPath(
    content: string,
    filePath: string,
    issue: Issue,
  ): Promise<string> {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const correctPath = metadata?.correctPath as string | undefined;

    if (!correctPath || issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Calculate relative path
    const fromDir = dirname(filePath);
    const toPath = resolve(process.cwd(), correctPath);
    let relativePath = relative(fromDir, toPath);

    // Ensure ./ prefix for relative paths
    if (!relativePath.startsWith(".")) {
      relativePath = "./" + relativePath;
    }

    // Replace .ts with .js for ESM
    relativePath = relativePath.replace(/\.ts$/, ".js");

    // Replace the import path
    const modifiedLine = line.replace(
      /from\s+["']([^"']+)["']/,
      `from "${relativePath}"`,
    );

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix unused import by removing it
   */
  private fixUnusedImport(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const importName = metadata?.importName as string | undefined;

    if (!importName || issue.line === undefined) {
      return content;
    }

    const lines = content.split("\n");
    const line = lines[issue.line - 1];

    // Remove entire import line if it only contains the unused import
    if (
      line.includes(`import { ${importName} }`) ||
      line.includes(`import ${importName}`)
    ) {
      lines.splice(issue.line - 1, 1);
      return lines.join("\n");
    }

    // Remove specific import from multi-import line
    // import { foo, bar, baz } => import { foo, baz }
    const modifiedLine = line
      .replace(new RegExp(`,?\\s*${importName}\\s*,?`), "")
      .replace(/\{\s*,\s*/, "{ ")
      .replace(/,\s*\}/, " }");

    if (modifiedLine !== line) {
      lines[issue.line - 1] = modifiedLine;
      return lines.join("\n");
    }

    return content;
  }

  /**
   * Fix missing import by adding it
   */
  private fixMissingImport(content: string, issue: Issue): string {
    const metadata = issue.metadata as Record<string, unknown> | undefined;
    const importName = metadata?.importName as string | undefined;
    const importPath = metadata?.importPath as string | undefined;

    if (!importName || !importPath) {
      return content;
    }

    const lines = content.split("\n");

    // Find where to insert the import (after other imports)
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith("import ")) {
        insertIndex = i + 1;
      }
      // Stop at first non-import line
      if (
        lines[i].trim() &&
        !lines[i].trim().startsWith("import ") &&
        !lines[i].trim().startsWith("//") &&
        !lines[i].trim().startsWith("/*")
      ) {
        break;
      }
    }

    // Check if import already exists
    const importExists = lines.some(
      (line) => line.includes(importName) && line.includes(importPath),
    );

    if (!importExists) {
      const importStatement = `import { ${importName} } from "${importPath}";`;
      lines.splice(insertIndex, 0, importStatement);
    }

    return lines.join("\n");
  }

  /**
   * Organize imports alphabetically and by type
   */
  private organizeImports(content: string): string {
    const lines = content.split("\n");
    const imports: string[] = [];
    const otherLines: string[] = [];
    let inImportSection = false;

    for (const line of lines) {
      if (line.trim().startsWith("import ")) {
        imports.push(line);
        inImportSection = true;
      } else if (inImportSection && line.trim() === "") {
        // Keep blank line after imports
        otherLines.push(line);
        inImportSection = false;
      } else {
        otherLines.push(line);
      }
    }

    // Sort imports
    // 1. Node.js built-in modules
    // 2. External packages
    // 3. Internal absolute imports
    // 4. Internal relative imports
    const sortedImports = imports.sort((a, b) => {
      const aIsBuiltin = this.isBuiltinModule(a);
      const bIsBuiltin = this.isBuiltinModule(b);
      const aIsExternal = this.isExternalModule(a);
      const bIsExternal = this.isExternalModule(b);
      const aIsRelative = a.includes('from ".');
      const bIsRelative = b.includes('from ".');

      if (aIsBuiltin && !bIsBuiltin) return -1;
      if (!aIsBuiltin && bIsBuiltin) return 1;

      if (aIsExternal && !bIsExternal && !bIsBuiltin) return -1;
      if (!aIsExternal && bIsExternal && !aIsBuiltin) return 1;

      if (!aIsRelative && bIsRelative) return -1;
      if (aIsRelative && !bIsRelative) return 1;

      return a.localeCompare(b);
    });

    return [...sortedImports, "", ...otherLines].join("\n");
  }

  /**
   * Check if import is a Node.js built-in module
   */
  private isBuiltinModule(importLine: string): boolean {
    const builtins = [
      "fs",
      "path",
      "child_process",
      "crypto",
      "util",
      "stream",
      "events",
      "http",
      "https",
      "url",
    ];
    return builtins.some((builtin) => importLine.includes(`from "${builtin}"`));
  }

  /**
   * Check if import is an external package
   */
  private isExternalModule(importLine: string): boolean {
    return !importLine.includes('from ".') && !this.isBuiltinModule(importLine);
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
