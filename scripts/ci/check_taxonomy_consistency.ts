#!/usr/bin/env node
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

import { readFileSync, statSync } from "fs";
import { globSync } from "glob";
import { parseArgs } from "util";

interface TaxonomyMismatch {
  file: string;
  line: number;
  content: string;
  category: "severity" | "stage";
  found_value: string;
  context: string;
}

interface TaxonomyReport {
  unknown_severities: TaxonomyMismatch[];
  unknown_stages: TaxonomyMismatch[];
  total_files_scanned: number;
  scan_roots: string[];
}

// Canonical values only
const CANONICAL_SEVERITIES = new Set(["P0", "P1", "P2"]);
const CANONICAL_STAGES = new Set([
  "STEP_1_TYPESCRIPT",
  "STEP_2_LINT",
  "STEP_3_SANITY",
  "STEP_4_SMOKE_PAID",
  "STEP_5_GATING",
  "STEP_6_OBSERVABILITY",
  "STEP_7_FULL_RUN",
]);

// Stage alias mappings (case-insensitive)
const STAGE_ALIASES = new Map([
  ["typescript-validation", "STEP_1_TYPESCRIPT"],
  ["typescript validate", "STEP_1_TYPESCRIPT"],
  ["lint", "STEP_2_LINT"],
  ["sanity", "STEP_3_SANITY"],
  ["manifest/seed/threshold", "STEP_3_SANITY"],
  ["smoke-run", "STEP_4_SMOKE_PAID"],
  ["paid smoke", "STEP_4_SMOKE_PAID"],
  ["gating-validation", "STEP_5_GATING"],
  ["gating", "STEP_5_GATING"],
  ["observability export", "STEP_6_OBSERVABILITY"],
  ["observability", "STEP_6_OBSERVABILITY"],
  ["full run", "STEP_7_FULL_RUN"],
  ["full", "STEP_7_FULL_RUN"],
]);

class TaxonomyChecker {
  private report: TaxonomyReport = {
    unknown_severities: [],
    unknown_stages: [],
    total_files_scanned: 0,
    scan_roots: [],
  };

  private maxSamplesPerFile = 5;

  async scanProject(
    roots: string[],
    sessionPath?: string,
    schemaPath?: string,
    obsGlob?: string,
  ): Promise<TaxonomyReport> {
    this.report.scan_roots = roots;

    // Build file patterns with exclusions
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
          await this.scanFile(file);
        }
      }
    }

    // Scan specific files if provided
    if (sessionPath) await this.scanFile(sessionPath);
    if (schemaPath) await this.scanFile(schemaPath);
    if (obsGlob) {
      const obsFiles = globSync(obsGlob);
      for (const file of obsFiles) {
        await this.scanObservabilityHTML(file);
      }
    }

    return this.report;
  }

  private async scanFile(filePath: string): Promise<void> {
    try {
      const stats = statSync(filePath);
      if (!stats.isFile()) return;

      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");
      this.report.total_files_scanned++;

      let samplesInFile = 0;

      lines.forEach((line, index) => {
        if (samplesInFile >= this.maxSamplesPerFile) return;

        const severityMatches = this.checkSeverities(
          filePath,
          index + 1,
          line,
          lines,
        );
        const stageMatches = this.checkStages(filePath, index + 1, line);

        samplesInFile += severityMatches + stageMatches;
      });
    } catch (error) {
      // Skip files that can't be read
    }
  }

  private async scanObservabilityHTML(filePath: string): Promise<void> {
    try {
      const content = readFileSync(filePath, "utf-8");

      // Parse <pre> JSON for components
      const preMatch = content.match(/<pre>([\s\S]*?)<\/pre>/);
      if (preMatch) {
        try {
          const obsData = JSON.parse(preMatch[1]);
          const runs = obsData.runs || {};

          for (const run of Object.values(runs) as any[]) {
            if (run.components) {
              for (const component of run.components) {
                const canonical = this.mapStageAlias(component);
                if (!canonical) {
                  this.report.unknown_stages.push({
                    file: filePath,
                    line: 1, // HTML doesn't have meaningful line numbers
                    content: `"components": [${run.components
                      .map((c: string) => `"${c}"`)
                      .join(", ")}]`,
                    category: "stage",
                    found_value: component,
                    context: `observability component: ${component}`,
                  });
                }
              }
            }
          }
        } catch (e) {
          // Skip malformed JSON
        }
      }

      this.report.total_files_scanned++;
    } catch (error) {
      // Skip files that can't be read
    }
  }

  private checkSeverities(
    file: string,
    lineNum: number,
    line: string,
    allLines: string[],
  ): number {
    // Skip lines in Zod enum context
    if (this.isInZodEnumContext(lineNum - 1, allLines)) {
      return 0;
    }

    // Skip config/log lines
    if (/\b(level|severity|options)\b/i.test(line)) {
      return 0;
    }

    // Only look for exact P0, P1, P2 tokens with word boundaries
    const severityRegex = /\bP[0-2]\b/g;
    let match;
    let count = 0;

    while ((match = severityRegex.exec(line)) !== null) {
      const severity = match[0];
      if (!CANONICAL_SEVERITIES.has(severity)) {
        this.report.unknown_severities.push({
          file,
          line: lineNum,
          content: line.trim(),
          category: "severity",
          found_value: severity,
          context: this.getContext(line, severity),
        });
        count++;
      }
    }

    return count;
  }

  private checkStages(file: string, lineNum: number, line: string): number {
    // Skip technical stage-related identifiers
    if (/\b(stage(Name|Id|Count|able)|await|stages)\b/i.test(line)) {
      return 0;
    }

    // Skip CSS/style contexts
    if (/stage-|\.stage|#stage/i.test(line)) {
      return 0;
    }

    const stagePatterns = [
      // Quoted stage names
      /"(typescript-validation|smoke-run|gating-validation|observability export|full run|sanity|lint|gating|observability|full)"/gi,
      // Canonical stage constants
      /"(STEP_[1-7]_[A-Z_]+)"/gi,
      // Component names in arrays/objects
      /\b(typescript-validation|smoke-run|gating-validation)\b/gi,
    ];

    let count = 0;
    for (const pattern of stagePatterns) {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const stage = match[1];
        const canonical = this.mapStageAlias(stage);

        if (!canonical) {
          this.report.unknown_stages.push({
            file,
            line: lineNum,
            content: line.trim(),
            category: "stage",
            found_value: stage,
            context: this.getContext(line, stage),
          });
          count++;
        }
      }
    }

    return count;
  }

  private isInZodEnumContext(lineIndex: number, lines: string[]): boolean {
    // Check current line and ±1 lines for z.enum(
    for (
      let i = Math.max(0, lineIndex - 1);
      i <= Math.min(lines.length - 1, lineIndex + 1);
      i++
    ) {
      if (lines[i].includes("z.enum(")) {
        return true;
      }
    }
    return false;
  }

  private mapStageAlias(stage: string): string | null {
    const canonical = STAGE_ALIASES.get(stage.toLowerCase());
    if (canonical) return canonical;

    if (CANONICAL_STAGES.has(stage)) return stage;

    return null;
  }

  private getContext(line: string, value: string): string {
    const index = line.indexOf(value);
    const start = Math.max(0, index - 15);
    const end = Math.min(line.length, index + value.length + 15);
    return line.substring(start, end);
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      roots: {
        type: "string",
        default: "src,scripts,validators,reports,.claude/commands,docs",
      },
      session: { type: "string" },
      schema: { type: "string" },
      obs_glob: { type: "string" },
    },
  });

  const roots = values.roots?.split(",") || [];
  const checker = new TaxonomyChecker();
  const report = await checker.scanProject(
    roots,
    values.session,
    values.schema,
    values.obs_glob,
  );

  // Output compact JSON
  const summary = {
    unknown_severities: report.unknown_severities.slice(0, 5),
    unknown_stages: report.unknown_stages.slice(0, 5),
    total_unknown_severities: report.unknown_severities.length,
    total_unknown_stages: report.unknown_stages.length,
    files_scanned: report.total_files_scanned,
    scan_roots: report.scan_roots,
    scan_complete: true,
  };

  console.log(JSON.stringify(summary, null, 2));

  // Exit with error code if significant mismatches found
  const hasIssues =
    report.unknown_severities.length > 0 || report.unknown_stages.length > 0;
  process.exit(hasIssues ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
