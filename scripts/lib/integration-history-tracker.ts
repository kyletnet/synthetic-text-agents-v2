#!/usr/bin/env tsx

/**
 * Integration History Tracker and Visualizer
 * Comprehensive tracking and visualization of system integration timeline
 * Implements GPT recommendation for integration history tracking and operational visibility
 */

import { EventEmitter } from "events";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

export interface IntegrationEvent {
  id: string;
  timestamp: Date;
  type:
    | "integration_started"
    | "integration_completed"
    | "integration_failed"
    | "rollback"
    | "approval_granted"
    | "approval_rejected";
  component: {
    name: string;
    version: string;
    type: string;
  };
  strategy: "full_integration" | "partial_integration" | "reject_integration";
  phase: string;
  actor: string; // who initiated the action
  context: {
    reason: string;
    prerequisites: string[];
    risks: string[];
    impact: "low" | "medium" | "high" | "critical";
  };
  metrics: {
    duration?: number; // in milliseconds
    success_rate?: number;
    resource_usage?: {
      cpu: number;
      memory: number;
      storage: number;
    };
  };
  relationships: {
    dependencies: string[];
    conflicts: string[];
    enabledBy: string[];
    enables: string[];
  };
}

export interface IntegrationTimeline {
  totalIntegrations: number;
  successfulIntegrations: number;
  failedIntegrations: number;
  averageDuration: number;
  events: IntegrationEvent[];
  componentEvolution: Map<string, IntegrationEvent[]>;
  monthlyStats: Array<{
    month: string;
    integrations: number;
    successes: number;
    failures: number;
    avgDuration: number;
  }>;
}

export interface VisualizationData {
  timeline: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor: string;
      borderColor: string;
    }>;
  };
  componentMap: {
    nodes: Array<{
      id: string;
      label: string;
      type: string;
      status: string;
      integrationDate: string;
      dependencies: number;
    }>;
    edges: Array<{
      from: string;
      to: string;
      type: "dependency" | "conflict" | "enables";
      weight: number;
    }>;
  };
  heatmap: {
    dates: string[];
    values: number[];
    max: number;
  };
}

/**
 * Integration History Tracker - Comprehensive integration monitoring and visualization
 */
export class IntegrationHistoryTracker extends EventEmitter {
  private projectRoot = process.cwd();
  private reportsDir = join(this.projectRoot, "reports");
  private events: IntegrationEvent[] = [];
  private eventsPath = join(this.reportsDir, "integration-history.json");
  private timelinePath = join(this.reportsDir, "integration-timeline.md");
  private visualDataPath = join(
    this.reportsDir,
    "integration-visualization.json",
  );

  constructor() {
    super();
    this.setMaxListeners(50);
    this.ensureReportsDirectory();
    this.loadHistoricalEvents();
    this.startAutoReporting();
  }

  /**
   * Record integration event
   */
  recordEvent(event: Omit<IntegrationEvent, "id" | "timestamp">): void {
    const fullEvent: IntegrationEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event,
    };

    this.events.push(fullEvent);

    console.log(
      `📝 Recorded integration event: ${event.type} for ${event.component.name}`,
    );

    // Auto-persist after each event
    this.persistEvents();

    // Emit for real-time listeners
    this.emit("event:recorded", fullEvent);

    // Check if timeline needs updating
    if (this.shouldUpdateTimeline(event.type)) {
      this.generateTimelineReport();
    }
  }

  /**
   * Generate comprehensive timeline report
   */
  async generateTimelineReport(): Promise<IntegrationTimeline> {
    console.log("📊 Generating integration timeline report...");

    const timeline = this.analyzeTimeline();
    await this.generateMarkdownReport(timeline);
    await this.generateVisualizationData();

    console.log(`   Total integrations: ${timeline.totalIntegrations}`);
    console.log(
      `   Success rate: ${((timeline.successfulIntegrations / timeline.totalIntegrations) * 100).toFixed(1)}%`,
    );
    console.log(
      `   Average duration: ${(timeline.averageDuration / 1000 / 60).toFixed(1)} minutes`,
    );

    this.emit("timeline:generated", timeline);
    return timeline;
  }

  /**
   * Get component evolution history
   */
  getComponentEvolution(componentName: string): IntegrationEvent[] {
    return this.events
      .filter((e) => e.component.name === componentName)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get integration statistics for a time period
   */
  getIntegrationStats(days = 30): {
    totalEvents: number;
    integrations: number;
    successes: number;
    failures: number;
    topComponents: Array<{ name: string; events: number }>;
    timeline: Array<{ date: string; events: number }>;
  } {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentEvents = this.events.filter((e) => e.timestamp >= cutoff);

    const integrations = recentEvents.filter(
      (e) => e.type === "integration_started",
    ).length;
    const successes = recentEvents.filter(
      (e) => e.type === "integration_completed",
    ).length;
    const failures = recentEvents.filter(
      (e) => e.type === "integration_failed",
    ).length;

    // Component frequency
    const componentCounts = new Map<string, number>();
    recentEvents.forEach((e) => {
      const count = componentCounts.get(e.component.name) || 0;
      componentCounts.set(e.component.name, count + 1);
    });

    const topComponents = Array.from(componentCounts.entries())
      .map(([name, events]) => ({ name, events }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 10);

    // Daily timeline
    const dailyCounts = new Map<string, number>();
    recentEvents.forEach((e) => {
      const date = e.timestamp.toISOString().split("T")[0];
      dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
    });

    const timeline = Array.from(dailyCounts.entries())
      .map(([date, events]) => ({ date, events }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalEvents: recentEvents.length,
      integrations,
      successes,
      failures,
      topComponents,
      timeline,
    };
  }

  /**
   * Generate component dependency map
   */
  generateDependencyMap(): {
    components: string[];
    dependencies: Array<{ source: string; target: string; type: string }>;
  } {
    const components = new Set<string>();
    const dependencies: Array<{
      source: string;
      target: string;
      type: string;
    }> = [];

    this.events.forEach((event) => {
      components.add(event.component.name);

      // Add dependency relationships
      event.relationships.dependencies.forEach((dep) => {
        components.add(dep);
        dependencies.push({
          source: event.component.name,
          target: dep,
          type: "dependency",
        });
      });

      // Add conflict relationships
      event.relationships.conflicts.forEach((conflict) => {
        components.add(conflict);
        dependencies.push({
          source: event.component.name,
          target: conflict,
          type: "conflict",
        });
      });

      // Add enablement relationships
      event.relationships.enables.forEach((enabled) => {
        components.add(enabled);
        dependencies.push({
          source: event.component.name,
          target: enabled,
          type: "enables",
        });
      });
    });

    return {
      components: Array.from(components).sort(),
      dependencies,
    };
  }

  /**
   * Search integration events
   */
  searchEvents(criteria: {
    component?: string;
    type?: string;
    strategy?: string;
    actor?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): IntegrationEvent[] {
    return this.events.filter((event) => {
      if (
        criteria.component &&
        !event.component.name.includes(criteria.component)
      )
        return false;
      if (criteria.type && event.type !== criteria.type) return false;
      if (criteria.strategy && event.strategy !== criteria.strategy)
        return false;
      if (criteria.actor && event.actor !== criteria.actor) return false;
      if (criteria.dateFrom && event.timestamp < criteria.dateFrom)
        return false;
      if (criteria.dateTo && event.timestamp > criteria.dateTo) return false;
      return true;
    });
  }

  /**
   * Export timeline data for external tools
   */
  exportTimelineData(format: "json" | "csv" = "json"): string {
    if (format === "csv") {
      const headers =
        "timestamp,type,component,strategy,phase,actor,duration,impact";
      const rows = this.events.map((e) =>
        [
          e.timestamp.toISOString(),
          e.type,
          e.component.name,
          e.strategy,
          e.phase,
          e.actor,
          e.metrics.duration || 0,
          e.context.impact,
        ].join(","),
      );

      return [headers, ...rows].join("\n");
    }

    return JSON.stringify(this.events, null, 2);
  }

  private analyzeTimeline(): IntegrationTimeline {
    const completedEvents = this.events.filter(
      (e) => e.type === "integration_completed",
    );
    const failedEvents = this.events.filter(
      (e) => e.type === "integration_failed",
    );
    const totalIntegrations = completedEvents.length + failedEvents.length;

    const durations = completedEvents
      .filter((e) => e.metrics.duration)
      .map((e) => e.metrics.duration!);

    const averageDuration =
      durations.length > 0
        ? durations.reduce((sum, d) => sum + d, 0) / durations.length
        : 0;

    // Group events by component
    const componentEvolution = new Map<string, IntegrationEvent[]>();
    this.events.forEach((event) => {
      const componentName = event.component.name;
      if (!componentEvolution.has(componentName)) {
        componentEvolution.set(componentName, []);
      }
      componentEvolution.get(componentName)!.push(event);
    });

    // Monthly statistics
    const monthlyStats = this.calculateMonthlyStats();

    return {
      totalIntegrations,
      successfulIntegrations: completedEvents.length,
      failedIntegrations: failedEvents.length,
      averageDuration,
      events: this.events
        .slice()
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
      componentEvolution,
      monthlyStats,
    };
  }

  private async generateMarkdownReport(
    timeline: IntegrationTimeline,
  ): Promise<void> {
    let report = `# 🚀 Integration Timeline Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Total Events: ${this.events.length}\n\n`;

    // Summary statistics
    report += `## 📊 Summary Statistics\n\n`;
    report += `- **Total Integrations**: ${timeline.totalIntegrations}\n`;
    report += `- **Successful**: ${timeline.successfulIntegrations} (${((timeline.successfulIntegrations / timeline.totalIntegrations) * 100).toFixed(1)}%)\n`;
    report += `- **Failed**: ${timeline.failedIntegrations} (${((timeline.failedIntegrations / timeline.totalIntegrations) * 100).toFixed(1)}%)\n`;
    report += `- **Average Duration**: ${(timeline.averageDuration / 1000 / 60).toFixed(1)} minutes\n\n`;

    // Recent activity
    report += `## 🕒 Recent Activity (Last 10 Events)\n\n`;
    timeline.events.slice(0, 10).forEach((event) => {
      const date = event.timestamp.toISOString().split("T")[0];
      const time = event.timestamp.toISOString().split("T")[1].split(".")[0];
      report += `- **${date} ${time}** - ${event.type.replace("_", " ")} for \`${event.component.name}\` by ${event.actor}\n`;
    });
    report += "\n";

    // Component evolution
    report += `## 🧩 Component Evolution\n\n`;
    for (const [componentName, events] of timeline.componentEvolution) {
      if (events.length > 1) {
        report += `### ${componentName}\n`;
        events.slice(0, 5).forEach((event) => {
          const date = event.timestamp.toISOString().split("T")[0];
          report += `- **${date}**: ${event.type.replace("_", " ")} (${event.strategy})\n`;
        });
        report += "\n";
      }
    }

    // Monthly trends
    report += `## 📈 Monthly Trends\n\n`;
    report += `| Month | Integrations | Successes | Failures | Avg Duration |\n`;
    report += `|-------|--------------|-----------|----------|--------------|\n`;
    timeline.monthlyStats.forEach((month) => {
      report += `| ${month.month} | ${month.integrations} | ${month.successes} | ${month.failures} | ${month.avgDuration.toFixed(1)}min |\n`;
    });
    report += "\n";

    // Risk analysis
    const criticalEvents = this.events.filter(
      (e) => e.context.impact === "critical",
    );
    if (criticalEvents.length > 0) {
      report += `## ⚠️ Critical Impact Events\n\n`;
      criticalEvents.forEach((event) => {
        const date = event.timestamp.toISOString().split("T")[0];
        report += `- **${date}**: ${event.component.name} - ${event.context.reason}\n`;
      });
      report += "\n";
    }

    // Commands
    report += `## 💻 Timeline Commands\n\n`;
    report += `\`\`\`bash\n`;
    report += `# View integration timeline\n`;
    report += `npm run integration:timeline\n\n`;
    report += `# Search integration events\n`;
    report += `npm run integration:search --component=<name>\n\n`;
    report += `# Export timeline data\n`;
    report += `npm run integration:export --format=csv\n`;
    report += `\`\`\`\n\n`;

    report += `---\n\n`;
    report += `*This report is automatically generated and updated after each integration event.*\n`;

    writeFileSync(this.timelinePath, report);
    console.log(`📄 Timeline report saved: ${this.timelinePath}`);
  }

  private async generateVisualizationData(): Promise<void> {
    const monthlyData = this.calculateMonthlyStats();

    const visualData: VisualizationData = {
      timeline: {
        labels: monthlyData.map((m) => m.month),
        datasets: [
          {
            label: "Successful Integrations",
            data: monthlyData.map((m) => m.successes),
            backgroundColor: "#4CAF50",
            borderColor: "#388E3C",
          },
          {
            label: "Failed Integrations",
            data: monthlyData.map((m) => m.failures),
            backgroundColor: "#F44336",
            borderColor: "#D32F2F",
          },
        ],
      },
      componentMap: this.generateComponentMapData(),
      heatmap: this.generateHeatmapData(),
    };

    writeFileSync(this.visualDataPath, JSON.stringify(visualData, null, 2));
    console.log(`📊 Visualization data saved: ${this.visualDataPath}`);
  }

  private calculateMonthlyStats(): Array<{
    month: string;
    integrations: number;
    successes: number;
    failures: number;
    avgDuration: number;
  }> {
    const monthlyMap = new Map<
      string,
      {
        integrations: number;
        successes: number;
        failures: number;
        durations: number[];
      }
    >();

    this.events.forEach((event) => {
      const month = event.timestamp.toISOString().substring(0, 7); // YYYY-MM

      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, {
          integrations: 0,
          successes: 0,
          failures: 0,
          durations: [],
        });
      }

      const stats = monthlyMap.get(month)!;

      if (event.type === "integration_started") {
        stats.integrations++;
      } else if (event.type === "integration_completed") {
        stats.successes++;
        if (event.metrics.duration) {
          stats.durations.push(event.metrics.duration);
        }
      } else if (event.type === "integration_failed") {
        stats.failures++;
      }
    });

    return Array.from(monthlyMap.entries())
      .map(([month, stats]) => ({
        month,
        integrations: stats.integrations,
        successes: stats.successes,
        failures: stats.failures,
        avgDuration:
          stats.durations.length > 0
            ? stats.durations.reduce((sum, d) => sum + d, 0) /
              stats.durations.length /
              1000 /
              60
            : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  private generateComponentMapData(): VisualizationData["componentMap"] {
    const components = new Map<
      string,
      {
        type: string;
        status: string;
        integrationDate: string;
        dependencies: Set<string>;
      }
    >();

    const edges: Array<{
      from: string;
      to: string;
      type: "dependency" | "conflict" | "enables";
      weight: number;
    }> = [];

    this.events.forEach((event) => {
      const name = event.component.name;

      if (!components.has(name)) {
        components.set(name, {
          type: event.component.type,
          status: "unknown",
          integrationDate: event.timestamp.toISOString().split("T")[0],
          dependencies: new Set(),
        });
      }

      const component = components.get(name)!;

      // Update status based on latest event
      if (event.type === "integration_completed") {
        component.status = "integrated";
      } else if (event.type === "integration_failed") {
        component.status = "failed";
      }

      // Add relationships
      event.relationships.dependencies.forEach((dep) => {
        component.dependencies.add(dep);
        edges.push({ from: name, to: dep, type: "dependency", weight: 1 });
      });

      event.relationships.conflicts.forEach((conflict) => {
        edges.push({ from: name, to: conflict, type: "conflict", weight: 1 });
      });

      event.relationships.enables.forEach((enabled) => {
        edges.push({ from: name, to: enabled, type: "enables", weight: 1 });
      });
    });

    return {
      nodes: Array.from(components.entries()).map(([name, data]) => ({
        id: name,
        label: name,
        type: data.type,
        status: data.status,
        integrationDate: data.integrationDate,
        dependencies: data.dependencies.size,
      })),
      edges,
    };
  }

  private generateHeatmapData(): VisualizationData["heatmap"] {
    const dailyCounts = new Map<string, number>();
    let maxCount = 0;

    this.events.forEach((event) => {
      const date = event.timestamp.toISOString().split("T")[0];
      const count = (dailyCounts.get(date) || 0) + 1;
      dailyCounts.set(date, count);
      maxCount = Math.max(maxCount, count);
    });

    return {
      dates: Array.from(dailyCounts.keys()).sort(),
      values: Array.from(dailyCounts.values()),
      max: maxCount,
    };
  }

  private generateEventId(): string {
    return `integration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldUpdateTimeline(eventType: string): boolean {
    return ["integration_completed", "integration_failed", "rollback"].includes(
      eventType,
    );
  }

  private ensureReportsDirectory(): void {
    if (!existsSync(this.reportsDir)) {
      mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  private loadHistoricalEvents(): void {
    try {
      if (existsSync(this.eventsPath)) {
        const data = readFileSync(this.eventsPath, "utf8");
        this.events = JSON.parse(data).map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        }));

        console.log(
          `📊 Loaded ${this.events.length} integration events from history`,
        );
      }
    } catch (error) {
      console.warn("⚠️ Could not load integration history:", error);
    }
  }

  private persistEvents(): void {
    try {
      writeFileSync(this.eventsPath, JSON.stringify(this.events, null, 2));
    } catch (error) {
      console.error("❌ Failed to persist integration events:", error);
    }
  }

  private startAutoReporting(): void {
    // Generate daily reports
    setInterval(
      () => {
        if (this.events.length > 0) {
          console.log("📊 Daily integration report generation...");
          this.generateTimelineReport().catch(console.error);
        }
      },
      24 * 60 * 60 * 1000,
    ); // Daily
  }
}

// Global instance
export const integrationHistoryTracker = new IntegrationHistoryTracker();
export default IntegrationHistoryTracker;
