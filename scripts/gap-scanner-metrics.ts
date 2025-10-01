#!/usr/bin/env node

/**
 * GAP Scanner Metrics Collector
 *
 * Collects and reports metrics from GAP scan results:
 * - Daily/weekly/monthly reports
 * - Trend analysis
 * - Team performance
 * - Export to CSV/JSON
 */

import { readFile, writeFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

interface GapScanReport {
  timestamp: Date;
  mode: string;
  totalChecks: number;
  enabledChecks: number;
  gaps: Array<{
    id: string;
    checkId: string;
    severity: "P0" | "P1" | "P2";
    category: string;
    title: string;
    autoFixable: boolean;
  }>;
  summary: {
    P0: number;
    P1: number;
    P2: number;
    total: number;
  };
  executionTime: number;
}

interface MetricsReport {
  period: string;
  startDate: Date;
  endDate: Date;
  totalScans: number;
  averageGaps: {
    P0: number;
    P1: number;
    P2: number;
    total: number;
  };
  trend: {
    direction: "improving" | "degrading" | "stable";
    changePercent: number;
  };
  topGaps: Array<{
    checkId: string;
    count: number;
    severity: string;
  }>;
  categories: Record<string, number>;
  autoFixableRate: number;
}

// ============================================================================
// Metrics Collector
// ============================================================================

class GapMetricsCollector {
  private reportsDir = "reports";
  private metricsDir = "reports/metrics";

  async collectMetrics(options: {
    period: "daily" | "weekly" | "monthly";
    compare?: boolean;
    export?: "json" | "csv";
  }): Promise<void> {
    console.log(
      `📊 GAP Scanner Metrics - ${options.period.toUpperCase()} Report\n`,
    );

    // Load historical reports
    const reports = await this.loadHistoricalReports(options.period);

    if (reports.length === 0) {
      console.log("ℹ️  No historical data available");
      return;
    }

    // Calculate metrics
    const metrics = this.calculateMetrics(reports, options.period);

    // Display report
    this.displayReport(metrics);

    // Compare with previous period
    if (options.compare) {
      await this.compareWithPrevious(metrics, options.period);
    }

    // Export
    if (options.export) {
      await this.exportMetrics(metrics, options.export);
    }
  }

  private async loadHistoricalReports(
    period: "daily" | "weekly" | "monthly",
  ): Promise<GapScanReport[]> {
    const reports: GapScanReport[] = [];
    const now = new Date();
    const cutoffDate = this.getCutoffDate(now, period);

    // Load main report
    const mainReportPath = path.join(this.reportsDir, "gap-scan-results.json");
    if (existsSync(mainReportPath)) {
      const content = await readFile(mainReportPath, "utf-8");
      const report = JSON.parse(content) as GapScanReport;
      report.timestamp = new Date(report.timestamp);

      if (report.timestamp >= cutoffDate) {
        reports.push(report);
      }
    }

    // Load archived reports (if they exist)
    const archivePath = path.join(this.reportsDir, "archive");
    if (existsSync(archivePath)) {
      const files = await readdir(archivePath);

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        const filePath = path.join(archivePath, file);
        const content = await readFile(filePath, "utf-8");
        const report = JSON.parse(content) as GapScanReport;
        report.timestamp = new Date(report.timestamp);

        if (report.timestamp >= cutoffDate) {
          reports.push(report);
        }
      }
    }

    return reports.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  private calculateMetrics(
    reports: GapScanReport[],
    period: string,
  ): MetricsReport {
    if (reports.length === 0) {
      throw new Error("No reports available for metrics calculation");
    }

    const startDate = reports[0].timestamp;
    const endDate = reports[reports.length - 1].timestamp;

    // Average gaps
    const totalP0 = reports.reduce((sum, r) => sum + r.summary.P0, 0);
    const totalP1 = reports.reduce((sum, r) => sum + r.summary.P1, 0);
    const totalP2 = reports.reduce((sum, r) => sum + r.summary.P2, 0);
    const totalGaps = reports.reduce((sum, r) => sum + r.summary.total, 0);

    const averageGaps = {
      P0: Math.round((totalP0 / reports.length) * 10) / 10,
      P1: Math.round((totalP1 / reports.length) * 10) / 10,
      P2: Math.round((totalP2 / reports.length) * 10) / 10,
      total: Math.round((totalGaps / reports.length) * 10) / 10,
    };

    // Trend analysis
    const trend = this.calculateTrend(reports);

    // Top gaps
    const topGaps = this.calculateTopGaps(reports);

    // Categories
    const categories = this.calculateCategories(reports);

    // Auto-fixable rate
    const totalAutoFixable = reports.reduce(
      (sum, r) => sum + r.gaps.filter((g) => g.autoFixable).length,
      0,
    );
    const autoFixableRate =
      totalGaps > 0 ? Math.round((totalAutoFixable / totalGaps) * 100) : 0;

    return {
      period,
      startDate,
      endDate,
      totalScans: reports.length,
      averageGaps,
      trend,
      topGaps,
      categories,
      autoFixableRate,
    };
  }

  private calculateTrend(reports: GapScanReport[]): {
    direction: "improving" | "degrading" | "stable";
    changePercent: number;
  } {
    if (reports.length < 2) {
      return { direction: "stable", changePercent: 0 };
    }

    const midpoint = Math.floor(reports.length / 2);
    const firstHalf = reports.slice(0, midpoint);
    const secondHalf = reports.slice(midpoint);

    const avgFirst =
      firstHalf.reduce((sum, r) => sum + r.summary.total, 0) / firstHalf.length;
    const avgSecond =
      secondHalf.reduce((sum, r) => sum + r.summary.total, 0) /
      secondHalf.length;

    const changePercent =
      avgFirst > 0 ? Math.round(((avgSecond - avgFirst) / avgFirst) * 100) : 0;

    let direction: "improving" | "degrading" | "stable";
    if (changePercent < -5) {
      direction = "improving";
    } else if (changePercent > 5) {
      direction = "degrading";
    } else {
      direction = "stable";
    }

    return { direction, changePercent: Math.abs(changePercent) };
  }

  private calculateTopGaps(
    reports: GapScanReport[],
  ): Array<{ checkId: string; count: number; severity: string }> {
    const gapCounts: Record<string, { count: number; severity: string }> = {};

    for (const report of reports) {
      for (const gap of report.gaps) {
        if (!gapCounts[gap.checkId]) {
          gapCounts[gap.checkId] = { count: 0, severity: gap.severity };
        }
        gapCounts[gap.checkId].count++;
      }
    }

    return Object.entries(gapCounts)
      .map(([checkId, data]) => ({
        checkId,
        count: data.count,
        severity: data.severity,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private calculateCategories(
    reports: GapScanReport[],
  ): Record<string, number> {
    const categories: Record<string, number> = {};

    for (const report of reports) {
      for (const gap of report.gaps) {
        categories[gap.category] = (categories[gap.category] || 0) + 1;
      }
    }

    return categories;
  }

  private displayReport(metrics: MetricsReport): void {
    console.log("═".repeat(70));
    console.log(`📅 Period: ${metrics.period.toUpperCase()}`);
    console.log(
      `📆 ${metrics.startDate.toISOString().split("T")[0]} → ${metrics.endDate.toISOString().split("T")[0]}`,
    );
    console.log(`🔍 Total Scans: ${metrics.totalScans}`);
    console.log("═".repeat(70));

    console.log("\n📊 Average Gaps per Scan:");
    console.log(`   🔴 P0 Critical: ${metrics.averageGaps.P0}`);
    console.log(`   🟡 P1 High: ${metrics.averageGaps.P1}`);
    console.log(`   🟢 P2 Medium: ${metrics.averageGaps.P2}`);
    console.log(`   📈 Total: ${metrics.averageGaps.total}`);

    console.log("\n📈 Trend:");
    const trendIcon =
      metrics.trend.direction === "improving"
        ? "📉"
        : metrics.trend.direction === "degrading"
          ? "📈"
          : "➡️";
    const trendText =
      metrics.trend.direction === "improving"
        ? "IMPROVING"
        : metrics.trend.direction === "degrading"
          ? "DEGRADING"
          : "STABLE";
    console.log(
      `   ${trendIcon} ${trendText} (${metrics.trend.changePercent}% change)`,
    );

    console.log("\n🔝 Top Gaps:");
    if (metrics.topGaps.length === 0) {
      console.log("   ✅ No gaps detected!");
    } else {
      for (const gap of metrics.topGaps) {
        console.log(
          `   ${gap.severity} ${gap.checkId}: ${gap.count} occurrence(s)`,
        );
      }
    }

    console.log("\n📂 Categories:");
    for (const [category, count] of Object.entries(metrics.categories)) {
      console.log(`   ${category}: ${count}`);
    }

    console.log(`\n🔧 Auto-fixable Rate: ${metrics.autoFixableRate}%`);

    console.log("\n" + "═".repeat(70));
  }

  private async compareWithPrevious(
    current: MetricsReport,
    period: "daily" | "weekly" | "monthly",
  ): Promise<void> {
    console.log("\n🔄 Comparison with Previous Period\n");

    const previousReports = await this.loadPreviousPeriodReports(
      current.startDate,
      period,
    );

    if (previousReports.length === 0) {
      console.log("ℹ️  No previous period data available for comparison");
      return;
    }

    const previous = this.calculateMetrics(previousReports, period);

    // Compare averages
    const p0Change = current.averageGaps.P0 - previous.averageGaps.P0;
    const p1Change = current.averageGaps.P1 - previous.averageGaps.P1;
    const p2Change = current.averageGaps.P2 - previous.averageGaps.P2;
    const totalChange = current.averageGaps.total - previous.averageGaps.total;

    console.log("Gap Changes:");
    console.log(`   P0: ${this.formatChange(p0Change)}`);
    console.log(`   P1: ${this.formatChange(p1Change)}`);
    console.log(`   P2: ${this.formatChange(p2Change)}`);
    console.log(`   Total: ${this.formatChange(totalChange)}`);

    console.log(
      `\nAuto-fixable Rate: ${previous.autoFixableRate}% → ${current.autoFixableRate}%`,
    );
  }

  private async loadPreviousPeriodReports(
    currentStartDate: Date,
    period: "daily" | "weekly" | "monthly",
  ): Promise<GapScanReport[]> {
    const reports: GapScanReport[] = [];
    const archivePath = path.join(this.reportsDir, "archive");

    if (!existsSync(archivePath)) {
      return [];
    }

    const previousStart = this.getPreviousPeriodStart(currentStartDate, period);
    const previousEnd = new Date(currentStartDate);

    const files = await readdir(archivePath);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(archivePath, file);
      const content = await readFile(filePath, "utf-8");
      const report = JSON.parse(content) as GapScanReport;
      report.timestamp = new Date(report.timestamp);

      if (report.timestamp >= previousStart && report.timestamp < previousEnd) {
        reports.push(report);
      }
    }

    return reports.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
  }

  private async exportMetrics(
    metrics: MetricsReport,
    format: "json" | "csv",
  ): Promise<void> {
    if (!existsSync(this.metricsDir)) {
      await writeFile(this.metricsDir, "", { flag: "wx" }).catch(() => {});
    }

    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `gap-metrics-${metrics.period}-${timestamp}.${format}`;
    const filepath = path.join(this.metricsDir, filename);

    if (format === "json") {
      await writeFile(filepath, JSON.stringify(metrics, null, 2));
    } else if (format === "csv") {
      const csv = this.convertToCSV(metrics);
      await writeFile(filepath, csv);
    }

    console.log(`\n💾 Exported: ${filepath}`);
  }

  private convertToCSV(metrics: MetricsReport): string {
    const rows = [
      ["Metric", "Value"],
      ["Period", metrics.period],
      ["Total Scans", metrics.totalScans.toString()],
      ["Avg P0", metrics.averageGaps.P0.toString()],
      ["Avg P1", metrics.averageGaps.P1.toString()],
      ["Avg P2", metrics.averageGaps.P2.toString()],
      ["Avg Total", metrics.averageGaps.total.toString()],
      ["Trend", metrics.trend.direction],
      ["Trend Change %", metrics.trend.changePercent.toString()],
      ["Auto-fixable Rate %", metrics.autoFixableRate.toString()],
    ];

    return rows.map((row) => row.join(",")).join("\n");
  }

  private formatChange(change: number): string {
    if (change > 0) {
      return `+${change} ❌`;
    } else if (change < 0) {
      return `${change} ✅`;
    } else {
      return `${change} ➡️`;
    }
  }

  private getCutoffDate(
    now: Date,
    period: "daily" | "weekly" | "monthly",
  ): Date {
    const cutoff = new Date(now);

    switch (period) {
      case "daily":
        cutoff.setDate(cutoff.getDate() - 1);
        break;
      case "weekly":
        cutoff.setDate(cutoff.getDate() - 7);
        break;
      case "monthly":
        cutoff.setMonth(cutoff.getMonth() - 1);
        break;
    }

    return cutoff;
  }

  private getPreviousPeriodStart(
    currentStart: Date,
    period: "daily" | "weekly" | "monthly",
  ): Date {
    const start = new Date(currentStart);

    switch (period) {
      case "daily":
        start.setDate(start.getDate() - 1);
        break;
      case "weekly":
        start.setDate(start.getDate() - 7);
        break;
      case "monthly":
        start.setMonth(start.getMonth() - 1);
        break;
    }

    return start;
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  const options = {
    period: (args.find((arg) => arg.startsWith("--report="))?.split("=")[1] ||
      "daily") as "daily" | "weekly" | "monthly",
    compare: args.includes("--compare"),
    export: args.find((arg) => arg.startsWith("--export="))?.split("=")[1] as
      | "json"
      | "csv"
      | undefined,
    help: args.includes("--help") || args.includes("-h"),
  };

  if (options.help) {
    console.log(`
GAP Scanner Metrics Collector

Usage:
  npm run gap:scan:metrics                           # Daily report
  npm run gap:scan:metrics -- --report=weekly        # Weekly report
  npm run gap:scan:metrics -- --report=monthly       # Monthly report
  npm run gap:scan:metrics -- --compare              # Compare with previous
  npm run gap:scan:metrics -- --export=json          # Export to JSON
  npm run gap:scan:metrics -- --export=csv           # Export to CSV

Options:
  --report=<period>     Period: daily, weekly, monthly (default: daily)
  --compare             Compare with previous period
  --export=<format>     Export format: json, csv

Examples:
  # Weekly report with comparison
  npm run gap:scan:metrics -- --report=weekly --compare

  # Monthly report exported to CSV
  npm run gap:scan:metrics -- --report=monthly --export=csv

  # Daily report with all features
  npm run gap:scan:metrics -- --compare --export=json
    `);
    process.exit(0);
  }

  const collector = new GapMetricsCollector();
  await collector.collectMetrics(options);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Metrics collection failed:");
    console.error(error);
    process.exit(1);
  });
}

export { GapMetricsCollector };
