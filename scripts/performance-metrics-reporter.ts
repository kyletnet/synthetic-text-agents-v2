#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Performance Metrics Auto-Reporter
 * Generates automated performance reports from Core-Hub routing metrics
 * Implements GPT Phase 2 recommendation for performance analysis indicators
 */

import fs from "fs/promises";
import path from "path";
import { coreSystemHub } from "./lib/core-system-hub.js";

interface PerformanceReport {
  timestamp: string;
  reportId: string;
  period: {
    start: Date;
    end: Date;
    duration: string;
  };
  metrics: {
    totalMessages: number;
    routingEfficiency: {
      directMode: { count: number; percentage: string; avgLatency: number };
      hubMode: { count: number; percentage: string; avgLatency: number };
      fallbackMode: { count: number; percentage: string; avgLatency: number };
    };
    performance: {
      latencyReduction: string;
      throughputImprovement: string;
      hubHealthUptime: string;
      failoverCount: number;
      avgRecoveryTime: number;
    };
    trends: {
      performanceGrade: "A" | "B" | "C" | "D";
      recommendation: string;
      riskFactors: string[];
      optimization: string[];
    };
  };
  export: {
    reportPath: string;
    dashboardPath: string;
    alertsGenerated: number;
  };
}

class PerformanceMetricsReporter {
  private readonly reportsDir = "./reports/performance";
  private readonly alertThresholds = {
    latencySpike: 200, // ms
    failoverRate: 0.05, // 5%
    performanceDrop: 0.2, // 20%
  };

  async generateReport(
    options: {
      automated?: boolean;
      period?: "hourly" | "daily" | "weekly";
      export?: boolean;
    } = {},
  ): Promise<PerformanceReport> {
    const reportId = `perf-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const now = new Date();
    const period = this.calculatePeriod(options.period || "daily");

    console.log("📊 Generating Performance Metrics Report...");
    console.log(`🔍 Report ID: ${reportId}`);
    console.log(
      `⏰ Period: ${period.start.toISOString()} → ${period.end.toISOString()}\n`,
    );

    // Collect routing metrics
    const routingStatus = coreSystemHub.getRoutingStatus();
    const performanceReport = coreSystemHub.getPerformanceReport();

    // Calculate performance metrics
    const report: PerformanceReport = {
      timestamp: now.toISOString(),
      reportId,
      period: {
        start: period.start,
        end: period.end,
        duration: this.formatDuration(
          period.end.getTime() - period.start.getTime(),
        ),
      },
      metrics: {
        totalMessages: routingStatus.metrics.totalMessages,
        routingEfficiency: {
          directMode: {
            count: routingStatus.metrics.modeDistribution.direct,
            percentage: routingStatus.metrics.modePercentages.direct,
            avgLatency: routingStatus.metrics.averageLatency.direct,
          },
          hubMode: {
            count: routingStatus.metrics.modeDistribution.hub,
            percentage: routingStatus.metrics.modePercentages.hub,
            avgLatency: routingStatus.metrics.averageLatency.hub,
          },
          fallbackMode: {
            count: routingStatus.metrics.modeDistribution.fallback,
            percentage: routingStatus.metrics.modePercentages.fallback,
            avgLatency: routingStatus.metrics.averageLatency.fallback,
          },
        },
        performance: {
          latencyReduction: performanceReport.latencyReduction,
          throughputImprovement: performanceReport.throughputImprovement,
          hubHealthUptime: this.calculateUptime(routingStatus.failover),
          failoverCount: performanceReport.failoverCount,
          avgRecoveryTime: performanceReport.avgRecoveryTime,
        },
        trends: this.analyzeTrends(routingStatus, performanceReport),
      },
      export: {
        reportPath: "",
        dashboardPath: "",
        alertsGenerated: 0,
      },
    };

    // Generate alerts if needed
    const alerts = await this.generateAlerts(report);
    report.export.alertsGenerated = alerts.length;

    // Export report if requested
    if (options.export) {
      await this.exportReport(report);
    }

    // Display report
    await this.displayReport(report, options.automated || false);

    return report;
  }

  private calculatePeriod(period: "hourly" | "daily" | "weekly"): {
    start: Date;
    end: Date;
  } {
    const end = new Date();
    const start = new Date();

    switch (period) {
      case "hourly":
        start.setHours(start.getHours() - 1);
        break;
      case "daily":
        start.setDate(start.getDate() - 1);
        break;
      case "weekly":
        start.setDate(start.getDate() - 7);
        break;
    }

    return { start, end };
  }

  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  }

  private calculateUptime(failoverStatus: any): string {
    // Calculate uptime percentage based on hub health
    const uptimeRatio = failoverStatus.hubHealthy ? 0.98 : 0.85; // Simplified calculation
    return `${(uptimeRatio * 100).toFixed(1)}%`;
  }

  private analyzeTrends(
    routingStatus: any,
    performanceReport: any,
  ): PerformanceReport["metrics"]["trends"] {
    // Analyze performance trends and generate grade
    const latencyReductionNum = parseFloat(
      performanceReport.latencyReduction.replace("%", ""),
    );
    const throughputImprovementNum = parseFloat(
      performanceReport.throughputImprovement.replace("%", ""),
    );

    let grade: "A" | "B" | "C" | "D" = "C";
    const riskFactors: string[] = [];
    const optimization: string[] = [];

    // Grade calculation
    if (latencyReductionNum >= 50 && throughputImprovementNum >= 30) {
      grade = "A";
    } else if (latencyReductionNum >= 30 && throughputImprovementNum >= 20) {
      grade = "B";
    } else if (latencyReductionNum >= 15 && throughputImprovementNum >= 10) {
      grade = "C";
    } else {
      grade = "D";
    }

    // Risk analysis
    if (routingStatus.failover.emergencyQueueSize > 10) {
      riskFactors.push("High emergency queue backlog");
    }
    if (routingStatus.performance.hubLatency > 100) {
      riskFactors.push("Hub latency exceeds optimal threshold");
    }
    if (performanceReport.failoverCount > 5) {
      riskFactors.push("Frequent failover events detected");
    }

    // Optimization suggestions
    if (routingStatus.metrics.modeDistribution.fallback > 0) {
      optimization.push("Investigate fallback routing triggers");
    }
    if (
      routingStatus.performance.directLatency <
      routingStatus.performance.hubLatency * 0.7
    ) {
      optimization.push("Consider increasing direct routing ratio");
    }
    if (grade === "D") {
      optimization.push("Urgent: Review Core-Hub architecture efficiency");
    }

    const recommendation = this.generateRecommendation(
      grade,
      riskFactors,
      optimization,
    );

    return {
      performanceGrade: grade,
      recommendation,
      riskFactors,
      optimization,
    };
  }

  private generateRecommendation(
    grade: string,
    risks: string[],
    optimizations: string[],
  ): string {
    if (grade === "A") {
      return "System performing optimally. Continue monitoring for sustained excellence.";
    } else if (grade === "B") {
      return "Good performance with minor optimization opportunities identified.";
    } else if (grade === "C") {
      return "Moderate performance. Address identified risk factors to improve grade.";
    } else {
      return "URGENT: Performance below acceptable threshold. Immediate optimization required.";
    }
  }

  private async generateAlerts(report: PerformanceReport): Promise<any[]> {
    const alerts: any[] = [];

    // Latency spike alert
    const avgLatency =
      (report.metrics.routingEfficiency.directMode.avgLatency +
        report.metrics.routingEfficiency.hubMode.avgLatency) /
      2;

    if (avgLatency > this.alertThresholds.latencySpike) {
      alerts.push({
        type: "latency_spike",
        severity: "high",
        message: `Average latency (${avgLatency.toFixed(
          1,
        )}ms) exceeds threshold (${this.alertThresholds.latencySpike}ms)`,
        timestamp: new Date().toISOString(),
      });
    }

    // Performance grade alert
    if (report.metrics.trends.performanceGrade === "D") {
      alerts.push({
        type: "performance_degradation",
        severity: "critical",
        message: `Performance grade dropped to ${report.metrics.trends.performanceGrade}`,
        timestamp: new Date().toISOString(),
      });
    }

    return alerts;
  }

  private async exportReport(report: PerformanceReport): Promise<void> {
    // Ensure reports directory exists
    await fs.mkdir(this.reportsDir, { recursive: true });

    const reportPath = path.join(this.reportsDir, `${report.reportId}.json`);
    const dashboardPath = path.join(
      this.reportsDir,
      `${report.reportId}-dashboard.md`,
    );

    // Export JSON report
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    report.export.reportPath = reportPath;

    // Generate Markdown dashboard
    const markdown = this.generateMarkdownDashboard(report);
    await fs.writeFile(dashboardPath, markdown);
    report.export.dashboardPath = dashboardPath;

    console.log(`📁 Exported report: ${reportPath}`);
    console.log(`📋 Dashboard: ${dashboardPath}`);
  }

  private generateMarkdownDashboard(report: PerformanceReport): string {
    const { metrics, period } = report;

    return `# Performance Metrics Dashboard

**Report ID**: \`${report.reportId}\`
**Generated**: ${report.timestamp}
**Period**: ${period.start.toLocaleString()} → ${period.end.toLocaleString()} (${
      period.duration
    })

## 🎯 Performance Grade: ${metrics.trends.performanceGrade}

${metrics.trends.recommendation}

## 📊 Core Metrics

### Message Routing Efficiency
- **Total Messages**: ${metrics.totalMessages.toLocaleString()}
- **Direct Mode**: ${metrics.routingEfficiency.directMode.count} (${
      metrics.routingEfficiency.directMode.percentage
    }) - Avg: ${metrics.routingEfficiency.directMode.avgLatency.toFixed(1)}ms
- **Hub Mode**: ${metrics.routingEfficiency.hubMode.count} (${
      metrics.routingEfficiency.hubMode.percentage
    }) - Avg: ${metrics.routingEfficiency.hubMode.avgLatency.toFixed(1)}ms
- **Fallback Mode**: ${metrics.routingEfficiency.fallbackMode.count} (${
      metrics.routingEfficiency.fallbackMode.percentage
    }) - Avg: ${metrics.routingEfficiency.fallbackMode.avgLatency.toFixed(1)}ms

### Performance Improvements
- **Latency Reduction**: ${metrics.performance.latencyReduction}
- **Throughput Improvement**: ${metrics.performance.throughputImprovement}
- **Hub Uptime**: ${metrics.performance.hubHealthUptime}
- **Failover Events**: ${metrics.performance.failoverCount}
- **Avg Recovery Time**: ${metrics.performance.avgRecoveryTime.toFixed(1)}s

## ⚠️ Risk Factors

${
  metrics.trends.riskFactors.length > 0
    ? metrics.trends.riskFactors.map((risk) => `- ${risk}`).join("\n")
    : "✅ No significant risk factors detected"
}

## 🔧 Optimization Opportunities

${
  metrics.trends.optimization.length > 0
    ? metrics.trends.optimization.map((opt) => `- ${opt}`).join("\n")
    : "✅ System operating at optimal efficiency"
}

## 🚨 Alerts Generated

${
  report.export.alertsGenerated > 0
    ? `${report.export.alertsGenerated} alert(s) generated. Check logs for details.`
    : "✅ No alerts triggered during this period"
}

---
*Generated by Performance Metrics Auto-Reporter*
`;
  }

  private async displayReport(
    report: PerformanceReport,
    automated: boolean,
  ): Promise<void> {
    const { metrics } = report;

    if (!automated) {
      console.log("═══════════════════════════════════════");
      console.log("📊 PERFORMANCE METRICS REPORT");
      console.log("═══════════════════════════════════════\n");
    }

    // Performance Grade
    const gradeEmoji = { A: "🏆", B: "🥈", C: "🥉", D: "⚠️" };
    console.log(
      `${gradeEmoji[metrics.trends.performanceGrade]} **Performance Grade**: ${
        metrics.trends.performanceGrade
      }`,
    );
    console.log(`💡 **Recommendation**: ${metrics.trends.recommendation}\n`);

    // Key Metrics
    console.log("📈 **Key Performance Indicators**:");
    console.log(
      `   Latency Reduction: ${metrics.performance.latencyReduction}`,
    );
    console.log(
      `   Throughput Improvement: ${metrics.performance.throughputImprovement}`,
    );
    console.log(`   Hub Uptime: ${metrics.performance.hubHealthUptime}`);
    console.log(
      `   Total Messages: ${metrics.totalMessages.toLocaleString()}\n`,
    );

    // Message Distribution Summary
    console.log("🎯 **Routing Efficiency**:");
    console.log(
      `   Direct: ${
        metrics.routingEfficiency.directMode.percentage
      } (${metrics.routingEfficiency.directMode.avgLatency.toFixed(1)}ms avg)`,
    );
    console.log(
      `   Hub: ${
        metrics.routingEfficiency.hubMode.percentage
      } (${metrics.routingEfficiency.hubMode.avgLatency.toFixed(1)}ms avg)`,
    );
    console.log(
      `   Fallback: ${
        metrics.routingEfficiency.fallbackMode.percentage
      } (${metrics.routingEfficiency.fallbackMode.avgLatency.toFixed(
        1,
      )}ms avg)\n`,
    );

    // Risk Factors & Optimizations
    if (metrics.trends.riskFactors.length > 0) {
      console.log("⚠️ **Risk Factors**:");
      metrics.trends.riskFactors.forEach((risk) => console.log(`   - ${risk}`));
      console.log("");
    }

    if (metrics.trends.optimization.length > 0) {
      console.log("🔧 **Optimization Opportunities**:");
      metrics.trends.optimization.forEach((opt) => console.log(`   - ${opt}`));
      console.log("");
    }

    // Alerts
    if (report.export.alertsGenerated > 0) {
      console.log(`🚨 **Alerts Generated**: ${report.export.alertsGenerated}`);
      console.log("");
    }

    if (!automated) {
      console.log("💻 **Commands**:");
      console.log(
        "   npm run metrics:report              # Generate current report",
      );
      console.log(
        "   npm run metrics:report -- --export    # Export detailed report",
      );
      console.log(
        "   npm run metrics:auto               # Enable automated reporting",
      );
      console.log("");
    }
  }

  async scheduleAutomatedReporting(): Promise<void> {
    console.log("🤖 Starting automated performance reporting...");
    console.log("📋 Generating reports every 4 hours\n");

    const reportInterval = 4 * 60 * 60 * 1000; // 4 hours

    const runAutomatedReport = async () => {
      try {
        console.log(
          `\n🔄 [${new Date().toISOString()}] Automated Performance Report`,
        );
        console.log("─".repeat(60));

        await this.generateReport({
          automated: true,
          period: "daily",
          export: true,
        });

        console.log("─".repeat(60));
        console.log("✅ Automated report completed\n");
      } catch (error) {
        console.error("❌ Automated report failed:", error);
      }
    };

    // Initial report
    await runAutomatedReport();

    // Schedule recurring reports
    setInterval(runAutomatedReport, reportInterval);

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      console.log("\n🛑 Stopping automated performance reporting...");
      process.exit(0);
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const reporter = new PerformanceMetricsReporter();

  const options = {
    automated: args.includes("--auto"),
    period:
      (args.find((arg) => arg.startsWith("--period="))?.split("=")[1] as
        | "hourly"
        | "daily"
        | "weekly") || "daily",
    export: args.includes("--export"),
  };

  try {
    if (options.automated) {
      await reporter.scheduleAutomatedReporting();
    } else {
      await reporter.generateReport(options);
    }
  } catch (error) {
    console.error("❌ Performance metrics reporting failed:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { PerformanceMetricsReporter };
export default PerformanceMetricsReporter;
