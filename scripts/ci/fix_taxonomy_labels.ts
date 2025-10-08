#!/usr/bin/env node
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

import { readFileSync, writeFileSync, statSync } from "fs";
import { globSync } from "glob";
import { parseArgs } from "util";

interface FixCandidate {
  file: string;
  line: number;
  original: string;
  fixed: string;
  category: "severity" | "stage";
}

interface FixReport {
  candidates: FixCandidate[];
  total_files_processed: number;
  total_fixes: number;
  dry_run: boolean;
}

// Stage alias mappings for auto-fix
const STAGE_REPLACEMENTS = new Map([
  ["typescript-validation", "STEP_1_TYPESCRIPT"],
  ["typescript validate", "STEP_1_TYPESCRIPT"],
  ["lint", "STEP_2_LINT"],
  ["sanity", "STEP_3_SANITY"],
  ["smoke-run", "STEP_4_SMOKE_PAID"],
  ["paid smoke", "STEP_4_SMOKE_PAID"],
  ["gating-validation", "STEP_5_GATING"],
  ["gating", "STEP_5_GATING"],
  ["observability export", "STEP_6_OBSERVABILITY"],
  ["observability", "STEP_6_OBSERVABILITY"],
  ["full run", "STEP_7_FULL_RUN"],
  ["full", "STEP_7_FULL_RUN"],
]);

class TaxonomyFixer {
  private report: FixReport = {
    candidates: [],
    total_files_processed: 0,
    total_fixes: 0,
    dry_run: true,
  };

  async fixProject(
    roots: string[],
    dryRun: boolean = true,
  ): Promise<FixReport> {
    this.report.dry_run = dryRun;

    const fileGlobs = [
      "**/*.ts",
      "**/*.tsx",
      "**/*.md",
      "**/*.mdx",
      "**/*.json",
      "**/*.yml",
      "**/*.yaml",
    ];

    const excludePatterns = [
      "node_modules/**",
      "dist/**",
      "build/**",
      "experimental/**",
      "legacy/**",
      "tests/**",
      "test/**",
      "**/*.min.*",
      "reports/EXPORT/**",
    ];

    for (const root of roots) {
      for (const glob of fileGlobs) {
        const pattern = `${root}/${glob}`;
        const files = globSync(pattern, { ignore: excludePatterns });

        for (const file of files) {
          await this.processFile(file);
        }
      }
    }

    return this.report;
  }

  private async processFile(filePath: string): Promise<void> {
    try {
      const stats = statSync(filePath);
      if (!stats.isFile()) return;

      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      this.report.total_files_processed++;

      let modified = false;
      let newLines = [...lines];

      lines.forEach((line, index) => {
        const fixes = this.findFixesInLine(filePath, index + 1, line);

        for (const fix of fixes) {
          this.report.candidates.push(fix);
          if (!this.report.dry_run) {
            newLines[index] = newLines[index].replace(fix.original, fix.fixed);
            modified = true;
          }
        }
      });

      // Write back if not dry run and modifications made
      if (!this.report.dry_run && modified) {
        writeFileSync(filePath, newLines.join("\n"));
        this.report.total_fixes += this.report.candidates.filter(
          (c) => c.file === filePath,
        ).length;
      }
    } catch (error) {
      // Skip files that can't be processed
    }
  }

  private findFixesInLine(
    file: string,
    lineNum: number,
    line: string,
  ): FixCandidate[] {
    const fixes: FixCandidate[] = [];

    // Skip certain contexts
    if (this.shouldSkipLine(line)) {
      return fixes;
    }

    // Look for stage replacements
    for (const [alias, canonical] of STAGE_REPLACEMENTS) {
      const quotedPattern = new RegExp(`"${alias}"`, "gi");
      if (quotedPattern.test(line)) {
        fixes.push({
          file,
          line: lineNum,
          original: `"${alias}"`,
          fixed: `"${canonical}"`,
          category: "stage",
        });
      }
    }

    return fixes;
  }

  private shouldSkipLine(line: string): boolean {
    // Skip technical identifiers
    if (/\b(stage(Name|Id|Count|able)|await|stages)\b/i.test(line)) {
      return true;
    }

    // Skip CSS/style contexts
    if (/stage-|\.stage|#stage/i.test(line)) {
      return true;
    }

    // Skip Zod enum contexts
    if (line.includes("z.enum(")) {
      return true;
    }

    // Skip config/log lines
    if (/\b(level|severity|options)\b/i.test(line)) {
      return true;
    }

    return false;
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      roots: {
        type: "string",
        default: "src,scripts,.claude/commands,reports,docs",
      },
      dry: { type: "boolean", default: true },
    },
  });

  const roots = values.roots?.split(",") || [];
  const fixer = new TaxonomyFixer();
  const report = await fixer.fixProject(roots, values.dry);

  // Output fix summary
  const summary = {
    dry_run: report.dry_run,
    total_candidates: report.candidates.length,
    total_files_processed: report.total_files_processed,
    total_fixes_applied: report.total_fixes,
    sample_fixes: report.candidates.slice(0, 10),
    fix_summary: report.candidates.reduce(
      (acc, fix) => {
        const key = `${fix.original} → ${fix.fixed}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (report.dry_run && report.candidates.length > 0) {
    console.log("\n📝 DRY RUN COMPLETE - No changes applied");
    console.log("To apply fixes, run with --dry=false");
  }

  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
