#!/usr/bin/env tsx

/**
 * Documentation Linter
 *
 * Lints markdown files for quality issues (empty files, broken structure, etc.)
 */

import { existsSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import * as glob from "glob";

interface LintIssue {
  file: string;
  line?: number;
  severity: "error" | "warning" | "info";
  message: string;
}

interface LintReport {
  overall: "PASS" | "FAIL";
  timestamp: string;
  summary: {
    errors: number;
    warnings: number;
    info: number;
    totalFiles: number;
    totalIssues: number;
  };
  issues: LintIssue[];
}

class DocumentationLinter {
  private rootDir: string;
  private maxFileSize = 1024 * 1024; // 1MB

  constructor() {
    this.rootDir = process.cwd();
  }

  private findMarkdownFiles(): string[] {
    const patterns = [
      "docs/**/*.md",
      "*.md",
      "!node_modules/**",
      "!.archive/**",
      "!.system-backups/**",
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = glob.sync(pattern, { cwd: this.rootDir });
      files.push(...matches);
    }

    return [...new Set(files)]; // Deduplicate
  }

  private checkEmptyFiles(file: string): LintIssue[] {
    const issues: LintIssue[] = [];
    const fullPath = join(this.rootDir, file);

    if (!existsSync(fullPath)) {
      return [];
    }

    const content = readFileSync(fullPath, "utf-8").trim();

    if (content.length === 0) {
      issues.push({
        file,
        severity: "error",
        message: "File is completely empty",
      });
    } else if (content.length < 10) {
      issues.push({
        file,
        severity: "warning",
        message: `File is too short (${content.length} characters)`,
      });
    }

    return issues;
  }

  private checkFileSize(file: string): LintIssue[] {
    const issues: LintIssue[] = [];
    const fullPath = join(this.rootDir, file);

    if (!existsSync(fullPath)) {
      return [];
    }

    const stats = statSync(fullPath);
    if (stats.size > this.maxFileSize) {
      issues.push({
        file,
        severity: "warning",
        message: `File is very large (${(stats.size / 1024).toFixed(0)}KB) - consider splitting`,
      });
    }

    return issues;
  }

  private checkMarkdownStructure(file: string): LintIssue[] {
    const issues: LintIssue[] = [];
    const fullPath = join(this.rootDir, file);

    if (!existsSync(fullPath)) {
      return [];
    }

    const content = readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    // Check for title (# heading)
    const hasTitle = lines.some((line) => line.trim().startsWith("# "));
    if (!hasTitle && content.length > 100) {
      issues.push({
        file,
        severity: "info",
        message: "No top-level heading found",
      });
    }

    // Check for broken links (very basic check)
    const brokenLinkPattern = /\[([^\]]+)\]\(\s*\)/g;
    let match;
    let lineNum = 0;
    for (const line of lines) {
      lineNum++;
      match = brokenLinkPattern.exec(line);
      if (match) {
        issues.push({
          file,
          line: lineNum,
          severity: "warning",
          message: `Broken link: [${match[1]}]()`,
        });
      }
    }

    // Check for TODO/FIXME comments
    lineNum = 0;
    for (const line of lines) {
      lineNum++;
      if (line.includes("TODO") || line.includes("FIXME")) {
        issues.push({
          file,
          line: lineNum,
          severity: "info",
          message: "Contains TODO/FIXME comment",
        });
      }
    }

    return issues;
  }

  private checkConsistency(files: string[]): LintIssue[] {
    const issues: LintIssue[] = [];

    // Check for duplicate filenames in different directories
    const fileNames = new Map<string, string[]>();
    for (const file of files) {
      const baseName = file.split("/").pop() || file;
      if (!fileNames.has(baseName)) {
        fileNames.set(baseName, []);
      }
      fileNames.get(baseName)!.push(file);
    }

    for (const [name, paths] of fileNames.entries()) {
      if (paths.length > 1 && name !== "README.md") {
        issues.push({
          file: name,
          severity: "info",
          message: `Duplicate filename in ${paths.length} locations: ${paths.join(", ")}`,
        });
      }
    }

    return issues;
  }

  async execute(): Promise<LintReport> {
    console.log("🔎 Linting Documentation Files...\n");

    const files = this.findMarkdownFiles();
    console.log(`📝 Found ${files.length} markdown files\n`);

    const allIssues: LintIssue[] = [];

    // Lint each file
    for (const file of files) {
      const issues: LintIssue[] = [];

      issues.push(...this.checkEmptyFiles(file));
      issues.push(...this.checkFileSize(file));
      issues.push(...this.checkMarkdownStructure(file));

      allIssues.push(...issues);

      if (issues.length > 0) {
        console.log(`📄 ${file}:`);
        for (const issue of issues) {
          const icon =
            issue.severity === "error"
              ? "❌"
              : issue.severity === "warning"
                ? "⚠️"
                : "ℹ️";
          const location = issue.line ? `:${issue.line}` : "";
          console.log(`   ${icon} ${issue.message}${location}`);
        }
      }
    }

    // Check consistency across files
    const consistencyIssues = this.checkConsistency(files);
    allIssues.push(...consistencyIssues);

    if (consistencyIssues.length > 0) {
      console.log(`\n📊 Consistency checks:`);
      for (const issue of consistencyIssues) {
        console.log(`   ℹ️  ${issue.message}`);
      }
    }

    // Generate report
    const report: LintReport = {
      overall: "PASS",
      timestamp: new Date().toISOString(),
      summary: {
        errors: 0,
        warnings: 0,
        info: 0,
        totalFiles: files.length,
        totalIssues: allIssues.length,
      },
      issues: allIssues,
    };

    // Count by severity
    for (const issue of allIssues) {
      if (issue.severity === "error") {
        report.summary.errors++;
        report.overall = "FAIL";
      } else if (issue.severity === "warning") {
        report.summary.warnings++;
      } else {
        report.summary.info++;
      }
    }

    // Write report
    const reportsDir = join(this.rootDir, "reports");
    if (!existsSync(reportsDir)) {
      require("fs").mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = join(reportsDir, "doc-lint-report.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Linting Summary:`);
    console.log(
      `   Overall: ${report.overall === "PASS" ? "✅" : "❌"} ${report.overall}`,
    );
    console.log(`   Errors: ${report.summary.errors}`);
    console.log(`   Warnings: ${report.summary.warnings}`);
    console.log(`   Info: ${report.summary.info}`);
    console.log(`   Files checked: ${report.summary.totalFiles}`);
    console.log(`\n📄 Report saved to: ${reportPath}`);

    return report;
  }
}

// CLI execution
async function main() {
  const linter = new DocumentationLinter();
  const report = await linter.execute();

  if (report.overall === "FAIL") {
    console.log("\n❌ Documentation Linting FAILED");
    console.log("💡 Fix errors before proceeding");
    process.exit(1);
  }

  console.log("\n✅ Documentation Linting PASSED");
  if (report.summary.warnings > 0 || report.summary.info > 0) {
    console.log(
      "⚠️  Some non-critical issues found - consider addressing them",
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

export { DocumentationLinter };
export type { LintReport };
