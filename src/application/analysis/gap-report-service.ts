/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Application: Gap Report Service
 *
 * Handles gap report generation, formatting, and output.
 */

import type {
  GapScanReport,
  Gap,
  GapSummary,
} from "../../domain/analysis/gap-types.js";

// ============================================================================
// Console Reporter
// ============================================================================

export class GapConsoleReporter {
  /**
   * Print scan header
   */
  printHeader(mode: string, failOn: readonly string[]): void {
    console.log("\n🔍 GAP Scanner v1.0");
    console.log("═".repeat(60));
    console.log(`Mode: ${mode}`);
    console.log(`Fail on: ${failOn.join(", ") || "none"}`);
    console.log("═".repeat(60));
    console.log("");
  }

  /**
   * Print check progress
   */
  printCheckProgress(checkName: string, gapCount: number): void {
    if (gapCount > 0) {
      console.log(`⏳ Checking: ${checkName}...`);
      console.log(`   ❌ ${gapCount} gap(s) found`);
    } else {
      console.log(`⏳ Checking: ${checkName}...`);
      console.log(`   ✅ PASS`);
    }
  }

  /**
   * Print summary
   */
  printSummary(summary: GapSummary): void {
    console.log("");
    console.log("═".repeat(60));
    console.log("📊 Results:");
    console.log(`   🔴 P0 Critical: ${summary.P0}`);
    console.log(`   🟡 P1 High: ${summary.P1}`);
    console.log(`   🟢 P2 Medium: ${summary.P2}`);
    console.log(`   Total: ${summary.total}`);
  }

  /**
   * Print auto-fix results
   */
  printAutoFixResults(fixed: readonly Gap[], failed: readonly Gap[]): void {
    if (fixed.length === 0 && failed.length === 0) return;

    console.log("");
    console.log(`🔧 Auto-fixing ${fixed.length + failed.length} gap(s)...`);

    for (const gap of fixed) {
      console.log(`   ✅ Fixed: ${gap.title}`);
    }

    for (const gap of failed) {
      console.log(`   ❌ Failed: ${gap.title}`);
    }
  }

  /**
   * Print final status
   */
  printFinalStatus(
    shouldFail: boolean,
    mode: string,
    reportPath: string,
  ): void {
    if (shouldFail && mode === "enforce") {
      console.log("");
      console.log("❌ GAP scan failed: blocking gaps detected");
      console.log(`   Run: npm run gap:scan -- --help for more info`);
    } else if (shouldFail && mode === "shadow") {
      console.log("");
      console.log("⚠️  GAP scan found issues (shadow mode, not blocking)");
    } else {
      console.log("");
      console.log("✅ GAP scan passed");
    }

    console.log(`\n💾 Report saved: ${reportPath}`);
    console.log("═".repeat(60));
    console.log("");
  }

  /**
   * Print disabled message
   */
  printDisabledMessage(): void {
    console.log("ℹ️  GAP Scanner disabled (mode: disabled)");
  }

  /**
   * Print mode override warning
   */
  printModeOverride(original: string, override: string, user: string): void {
    console.log(`⚠️  GAP_SCAN_MODE override detected:`);
    console.log(`   Original: ${original} → Override: ${override}`);
    console.log(`   User: ${user}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);
  }
}

// ============================================================================
// Gap Detail Formatter
// ============================================================================

export class GapDetailFormatter {
  /**
   * Format gap for display
   */
  formatGap(gap: Gap): string {
    const lines: string[] = [];

    lines.push(`ID: ${gap.id}`);
    lines.push(`Check: ${gap.checkId}`);
    lines.push(`Severity: ${gap.severity}`);
    lines.push(`Category: ${gap.category}`);
    lines.push(`Title: ${gap.title}`);
    lines.push(`Description: ${gap.description}`);
    lines.push(`Auto-fixable: ${gap.autoFixable}`);

    if (gap.details) {
      lines.push(`Details:`);
      for (const [key, value] of Object.entries(gap.details)) {
        lines.push(`  ${key}: ${JSON.stringify(value)}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Format gap list
   */
  formatGapList(gaps: readonly Gap[]): string {
    if (gaps.length === 0) return "No gaps found";

    return gaps
      .map((gap, index) => {
        return `\n${index + 1}. ${this.formatGap(gap)}`;
      })
      .join("\n");
  }

  /**
   * Format summary
   */
  formatSummary(summary: GapSummary): string {
    return [
      `P0 Critical: ${summary.P0}`,
      `P1 High: ${summary.P1}`,
      `P2 Medium: ${summary.P2}`,
      `Total: ${summary.total}`,
    ].join("\n");
  }
}

// ============================================================================
// Report Export Service
// ============================================================================

export class GapReportExportService {
  /**
   * Export report to JSON
   */
  toJSON(report: GapScanReport): string {
    return JSON.stringify(
      report,
      (key, value) => {
        // Exclude fix functions from JSON
        if (key === "fix") return undefined;
        return value;
      },
      2,
    );
  }

  /**
   * Export report to markdown
   */
  toMarkdown(report: GapScanReport): string {
    const lines: string[] = [];

    lines.push(`# Gap Scan Report`);
    lines.push("");
    lines.push(`**Timestamp:** ${report.timestamp.toISOString()}`);
    lines.push(`**Mode:** ${report.mode}`);
    lines.push(`**Execution Time:** ${report.executionTime}ms`);
    lines.push("");

    lines.push(`## Summary`);
    lines.push("");
    lines.push(`- 🔴 P0 Critical: ${report.summary.P0}`);
    lines.push(`- 🟡 P1 High: ${report.summary.P1}`);
    lines.push(`- 🟢 P2 Medium: ${report.summary.P2}`);
    lines.push(`- Total: ${report.summary.total}`);
    lines.push("");

    if (report.gaps.length > 0) {
      lines.push(`## Gaps`);
      lines.push("");

      for (let i = 0; i < report.gaps.length; i++) {
        const gap = report.gaps[i];
        lines.push(`### ${i + 1}. ${gap.title}`);
        lines.push("");
        lines.push(`- **ID:** ${gap.id}`);
        lines.push(`- **Check:** ${gap.checkId}`);
        lines.push(`- **Severity:** ${gap.severity}`);
        lines.push(`- **Category:** ${gap.category}`);
        lines.push(`- **Description:** ${gap.description}`);
        lines.push(`- **Auto-fixable:** ${gap.autoFixable}`);

        if (gap.details) {
          lines.push(`- **Details:**`);
          for (const [key, value] of Object.entries(gap.details)) {
            lines.push(`  - ${key}: ${JSON.stringify(value)}`);
          }
        }

        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Export summary to CSV
   */
  toCSV(report: GapScanReport): string {
    const lines: string[] = [];

    // Header
    lines.push("ID,Check,Severity,Category,Title,Description,Auto-fixable");

    // Data rows
    for (const gap of report.gaps) {
      const row = [
        gap.id,
        gap.checkId,
        gap.severity,
        gap.category,
        this.escapeCSV(gap.title),
        this.escapeCSV(gap.description),
        gap.autoFixable.toString(),
      ];
      lines.push(row.join(","));
    }

    return lines.join("\n");
  }

  private escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
