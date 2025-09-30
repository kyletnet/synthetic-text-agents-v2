#!/usr/bin/env tsx

/**
 * Core-Hub Routing Status Monitor
 * Displays current routing mode, performance metrics, and failover status
 * Implements GPT recommendation for routing observability
 */

import { coreSystemHub } from "./lib/core-system-hub.js";

interface RoutingStatusOptions {
  export?: boolean;
  detailed?: boolean;
  watch?: boolean;
}

class RoutingStatusMonitor {
  async displayStatus(options: RoutingStatusOptions = {}): Promise<void> {
    console.log("🚦 Core-Hub Routing Status Monitor");
    console.log("═══════════════════════════════════════\n");

    const status = coreSystemHub.getRoutingStatus();
    const performanceReport = coreSystemHub.getPerformanceReport();

    // Current Mode
    const modeEmoji = {
      direct: "⚡",
      hub: "🔄",
      fallback: "🚨",
    };

    console.log(
      `${modeEmoji[status.currentMode]} **Current Mode**: ${status.currentMode.toUpperCase()}`,
    );

    // Hub Health
    const healthEmoji = status.failover.hubHealthy ? "✅" : "❌";
    console.log(
      `${healthEmoji} **Hub Health**: ${status.failover.hubHealthy ? "Healthy" : "Unhealthy"}`,
    );

    if (status.failover.directModeActive) {
      console.log(
        `🔀 **Direct Mode**: Active (${status.failover.directConnections} connections)`,
      );
    }

    if (status.failover.emergencyQueueSize > 0) {
      console.log(
        `🚨 **Emergency Queue**: ${status.failover.emergencyQueueSize} messages`,
      );
    }

    console.log("");

    // Performance Metrics
    console.log("📈 **Performance Impact**:");
    console.log(
      `   Avg latency reduction: ${performanceReport.latencyReduction}`,
    );
    console.log(
      `   Hub latency: ${status.performance.hubLatency.toFixed(1)}ms`,
    );
    console.log(
      `   Direct latency: ${status.performance.directLatency.toFixed(1)}ms`,
    );
    console.log(
      `   Performance improvement: ${status.performance.performanceImprovement}`,
    );
    console.log(`   Recommended mode: ${status.performance.recommendedMode}`);
    console.log("");

    // Message Distribution
    console.log("📊 **Message Distribution**:");
    console.log(`   Total messages: ${status.metrics.totalMessages}`);
    console.log(
      `   Direct routing: ${status.metrics.modePercentages.direct} (${status.metrics.modeDistribution.direct} msgs)`,
    );
    console.log(
      `   Hub routing: ${status.metrics.modePercentages.hub} (${status.metrics.modeDistribution.hub} msgs)`,
    );
    console.log(
      `   Fallback routing: ${status.metrics.modePercentages.fallback} (${status.metrics.modeDistribution.fallback} msgs)`,
    );
    console.log("");

    // Failover Statistics
    console.log("🔄 **Failover Statistics**:");
    console.log(`   Failover events: ${performanceReport.failoverCount}`);
    console.log(
      `   Avg recovery time: ${performanceReport.avgRecoveryTime.toFixed(1)}s`,
    );
    console.log(
      `   Throughput improvement: ${performanceReport.throughputImprovement}`,
    );
    console.log("");

    // Recommendation
    console.log("💡 **Recommendation**:");
    console.log(`   ${performanceReport.recommendation}`);
    console.log("");

    if (options.detailed) {
      // Recent Activity
      console.log("🕒 **Recent Activity**:");
      if (status.recentActivity.length > 0) {
        status.recentActivity.forEach((activity) => {
          const time = new Date(activity.timestamp).toLocaleTimeString();
          console.log(
            `   ${time} - ${activity.mode} (${activity.latency}ms) - ${activity.reason}`,
          );
        });
      } else {
        console.log("   No recent activity recorded");
      }
      console.log("");

      // System Load
      console.log("🖥️ **System Metrics**:");
      console.log(
        `   Recent latency: ${status.metrics.recentLatency.toFixed(2)}ms`,
      );
      console.log(`   Average latencies:`);
      console.log(
        `     - Direct: ${status.metrics.averageLatency.direct.toFixed(1)}ms`,
      );
      console.log(
        `     - Hub: ${status.metrics.averageLatency.hub.toFixed(1)}ms`,
      );
      console.log(
        `     - Fallback: ${status.metrics.averageLatency.fallback.toFixed(1)}ms`,
      );
      console.log("");
    }

    // Export option
    if (options.export) {
      await coreSystemHub.exportRoutingMetrics();
      console.log("📄 Metrics exported to reports/hub-routing-metrics.json");
      console.log("");
    }

    // Commands
    console.log("💻 **Available Commands**:");
    console.log("   npm run routing:status              # Basic status");
    console.log("   npm run routing:status -- --detailed   # Detailed status");
    console.log("   npm run routing:status -- --export     # Export metrics");
    console.log("   npm run routing:status -- --watch      # Watch mode");
    console.log("");
  }

  async watchMode(): Promise<void> {
    console.log("👀 Entering watch mode (Ctrl+C to exit)...\n");

    const displayInterval = setInterval(async () => {
      // Clear screen
      console.clear();

      await this.displayStatus({ detailed: false });

      const now = new Date().toLocaleTimeString();
      console.log(`🔄 Auto-refreshing every 30 seconds... (${now})`);
    }, 30000);

    // Initial display
    await this.displayStatus({ detailed: false });
    console.log(
      `🔄 Auto-refreshing every 30 seconds... (${new Date().toLocaleTimeString()})`,
    );

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      clearInterval(displayInterval);
      console.log("\n👋 Exiting watch mode...");
      process.exit(0);
    });
  }

  async generateStatusReport(): Promise<string> {
    const status = coreSystemHub.getRoutingStatus();
    const performance = coreSystemHub.getPerformanceReport();

    let report = `# Core-Hub Routing Status Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    report += `## Current Status\n\n`;
    report += `- **Mode**: ${status.currentMode}\n`;
    report += `- **Hub Health**: ${status.failover.hubHealthy ? "✅ Healthy" : "❌ Unhealthy"}\n`;
    report += `- **Direct Connections**: ${status.failover.directConnections}\n`;
    report += `- **Emergency Queue**: ${status.failover.emergencyQueueSize}\n\n`;

    report += `## Performance Metrics\n\n`;
    report += `- **Latency Reduction**: ${performance.latencyReduction}\n`;
    report += `- **Hub Latency**: ${status.performance.hubLatency.toFixed(1)}ms\n`;
    report += `- **Direct Latency**: ${status.performance.directLatency.toFixed(1)}ms\n`;
    report += `- **Throughput**: ${performance.throughputImprovement}\n`;
    report += `- **Failover Count**: ${performance.failoverCount}\n\n`;

    report += `## Recommendations\n\n`;
    report += `${performance.recommendation}\n\n`;

    return report;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const monitor = new RoutingStatusMonitor();

  const options: RoutingStatusOptions = {
    export: args.includes("--export"),
    detailed: args.includes("--detailed"),
    watch: args.includes("--watch"),
  };

  try {
    if (options.watch) {
      await monitor.watchMode();
    } else {
      await monitor.displayStatus(options);
    }
  } catch (error) {
    console.error("❌ Error displaying routing status:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default RoutingStatusMonitor;
