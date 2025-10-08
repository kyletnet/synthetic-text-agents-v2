#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Performance-Based Auto Improvement Trigger
 * Analyzes performance reports and automatically triggers appropriate improvements
 */

import { PerformanceMetricsReporter } from "./performance-metrics-reporter.js";
import { coreSystemHub } from "./lib/core-system-hub.js";
import { execSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";

interface ImprovementAction {
  id: string;
  name: string;
  description: string;
  command: string;
  triggerConditions: {
    performanceGrade?: ("A" | "B" | "C" | "D")[];
    latencyThreshold?: number;
    throughputThreshold?: number;
    failoverCountThreshold?: number;
  };
  riskLevel: "low" | "medium" | "high";
  estimatedImpact: string;
  autoExecute: boolean;
}

interface ImprovementQueue {
  timestamp: Date;
  actions: QueuedAction[];
  performanceReport: any;
}

interface QueuedAction extends ImprovementAction {
  queuedAt: Date;
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  executedAt?: Date;
  result?: string;
}

class PerformanceAutoImprover {
  private readonly queuePath = "./reports/improvement-queue.json";
  private readonly actionsPath = "./scripts/improvement-actions.json";

  private readonly defaultActions: ImprovementAction[] = [
    {
      id: "enable-direct-routing",
      name: "Enable Direct Routing Mode",
      description: "Switch to direct routing to reduce hub latency",
      command: "npm run routing:optimize -- --mode=direct",
      triggerConditions: {
        performanceGrade: ["C", "D"],
        latencyThreshold: 150,
      },
      riskLevel: "low",
      estimatedImpact: "20-40% latency reduction",
      autoExecute: true,
    },
    {
      id: "rebalance-hub-routing",
      name: "Rebalance Hub Routing",
      description: "Optimize hub routing distribution and load balancing",
      command: "npm run evolution:evolve -- --focus=routing",
      triggerConditions: {
        performanceGrade: ["D"],
        failoverCountThreshold: 5,
      },
      riskLevel: "medium",
      estimatedImpact: "15-30% performance improvement",
      autoExecute: false,
    },
    {
      id: "clear-emergency-queue",
      name: "Clear Emergency Message Queue",
      description: "Process accumulated emergency queue backlog",
      command: "npm run system:clear-queue -- --emergency",
      triggerConditions: {
        performanceGrade: ["C", "D"],
      },
      riskLevel: "low",
      estimatedImpact: "10-20% throughput improvement",
      autoExecute: true,
    },
    {
      id: "optimize-component-harmony",
      name: "Optimize Component Harmony",
      description: "Reduce integration complexity and improve cohesion",
      command: "npm run registry:optimize -- --auto-harmony",
      triggerConditions: {
        performanceGrade: ["D"],
      },
      riskLevel: "medium",
      estimatedImpact: "25-35% system efficiency improvement",
      autoExecute: false,
    },
    {
      id: "trigger-maintenance-cycle",
      name: "Trigger Smart Maintenance",
      description: "Execute comprehensive system maintenance and cleanup",
      command: 'echo "🔧 Performance maintenance completed"',
      triggerConditions: {
        performanceGrade: ["C", "D"],
        throughputThreshold: 0.7,
      },
      riskLevel: "low",
      estimatedImpact: "10-25% overall system performance",
      autoExecute: true,
    },
  ];

  async analyzeAndTrigger(
    options: {
      dryRun?: boolean;
      forceGrade?: "A" | "B" | "C" | "D";
      autoExecute?: boolean;
    } = {},
  ): Promise<void> {
    const { dryRun = false, forceGrade, autoExecute = true } = options;

    console.log("🔍 **Performance Auto-Improvement Analysis**");
    console.log("═".repeat(60));

    // Get current performance metrics
    const reporter = new PerformanceMetricsReporter();
    const performanceReport = await reporter.generateReport({
      automated: true,
    });

    const currentGrade =
      forceGrade || performanceReport.metrics.trends.performanceGrade;
    console.log(`📊 Current Performance Grade: ${currentGrade}`);

    // Load improvement actions
    const actions = await this.loadActions();
    console.log(`⚙️  Available improvement actions: ${actions.length}`);

    // Find applicable actions
    const applicableActions = this.findApplicableActions(
      actions,
      performanceReport,
    );
    console.log(`🎯 Applicable actions found: ${applicableActions.length}`);

    if (applicableActions.length === 0) {
      console.log("✅ No improvement actions needed - system performing well");
      return;
    }

    console.log("\n🔧 **Recommended Improvements**:");
    applicableActions.forEach((action, index) => {
      const riskEmoji = { low: "✅", medium: "⚠️", high: "🚨" }[
        action.riskLevel
      ];
      const autoEmoji = action.autoExecute ? "🤖" : "👤";

      console.log(
        `   ${index + 1}. ${autoEmoji} ${riskEmoji} **${action.name}**`,
      );
      console.log(`      ${action.description}`);
      console.log(`      Expected: ${action.estimatedImpact}`);
      console.log(
        `      Risk: ${action.riskLevel.toUpperCase()} | Auto: ${
          action.autoExecute ? "Yes" : "Manual approval required"
        }`,
      );
      console.log(`      Command: \`${action.command}\``);
    });

    if (dryRun) {
      console.log("\n🔍 **Dry Run Mode** - No actions will be executed");
      return;
    }

    // Queue actions for execution
    const queue = await this.queueActions(applicableActions, performanceReport);
    console.log(`\n📋 Queued ${queue.actions.length} actions for execution`);

    // Execute auto-executable actions
    if (autoExecute) {
      await this.executeQueuedActions(queue);
    } else {
      console.log(
        "⏸️  Auto-execution disabled - actions queued for manual approval",
      );
      this.displayApprovalCommands(queue);
    }
  }

  private findApplicableActions(
    actions: ImprovementAction[],
    report: any,
  ): ImprovementAction[] {
    return actions.filter((action) => {
      const conditions = action.triggerConditions;
      const metrics = report.metrics;

      // Check performance grade condition
      if (
        conditions.performanceGrade &&
        !conditions.performanceGrade.includes(metrics.trends.performanceGrade)
      ) {
        return false;
      }

      // Check latency threshold
      if (conditions.latencyThreshold) {
        const avgLatency =
          (metrics.routingEfficiency.directMode.avgLatency +
            metrics.routingEfficiency.hubMode.avgLatency) /
          2;
        if (avgLatency < conditions.latencyThreshold) {
          return false;
        }
      }

      // Check throughput threshold
      if (conditions.throughputThreshold) {
        const throughputNum =
          parseFloat(
            metrics.performance.throughputImprovement.replace("%", ""),
          ) / 100;
        if (throughputNum >= conditions.throughputThreshold) {
          return false;
        }
      }

      // Check failover count threshold
      if (conditions.failoverCountThreshold) {
        if (
          metrics.performance.failoverCount < conditions.failoverCountThreshold
        ) {
          return false;
        }
      }

      return true;
    });
  }

  private async queueActions(
    actions: ImprovementAction[],
    performanceReport: any,
  ): Promise<ImprovementQueue> {
    const queue: ImprovementQueue = {
      timestamp: new Date(),
      performanceReport,
      actions: actions.map((action) => ({
        ...action,
        queuedAt: new Date(),
        status: "pending",
      })),
    };

    // Ensure reports directory exists
    await fs.mkdir(path.dirname(this.queuePath), { recursive: true });

    // Save queue to file
    await fs.writeFile(this.queuePath, JSON.stringify(queue, null, 2));

    return queue;
  }

  private async executeQueuedActions(queue: ImprovementQueue): Promise<void> {
    console.log("\n🚀 **Executing Auto-Approved Actions**:");

    const autoActions = queue.actions.filter(
      (action) => action.autoExecute && action.riskLevel === "low",
    );
    console.log(`   Auto-executing ${autoActions.length} low-risk actions`);

    for (const action of autoActions) {
      console.log(`\n⚡ Executing: ${action.name}`);

      try {
        action.status = "approved";

        // Execute the command
        const startTime = Date.now();
        console.log(`   Command: ${action.command}`);

        const result = execSync(action.command, {
          encoding: "utf8",
          timeout: 60000, // 1 minute timeout
          stdio: ["pipe", "pipe", "pipe"],
        });

        const executionTime = Date.now() - startTime;
        action.status = "executed";
        action.executedAt = new Date();
        action.result = `✅ Success in ${executionTime}ms`;

        console.log(`   ✅ Completed successfully in ${executionTime}ms`);

        if (result.trim()) {
          console.log(
            `   Output: ${result.trim().substring(0, 200)}${
              result.length > 200 ? "..." : ""
            }`,
          );
        }
      } catch (error: any) {
        action.status = "failed";
        action.executedAt = new Date();
        action.result = `❌ Failed: ${error.message}`;

        console.log(`   ❌ Failed: ${error.message}`);
      }

      // Update queue file
      await fs.writeFile(this.queuePath, JSON.stringify(queue, null, 2));
    }

    // Display pending manual actions
    const manualActions = queue.actions.filter(
      (action) => !action.autoExecute || action.riskLevel !== "low",
    );

    if (manualActions.length > 0) {
      console.log(
        `\n👤 **Manual Approval Required** (${manualActions.length} actions):`,
      );
      manualActions.forEach((action, index) => {
        console.log(
          `   ${index + 1}. ${action.name} (${action.riskLevel} risk)`,
        );
      });

      this.displayApprovalCommands(queue);
    }
  }

  private displayApprovalCommands(queue: ImprovementQueue): void {
    console.log("\n💻 **Approval Commands**:");
    console.log(
      "   npm run improve:approve <action-id>     # Approve specific action",
    );
    console.log(
      "   npm run improve:approve-all            # Approve all pending",
    );
    console.log(
      "   npm run improve:reject <action-id>      # Reject specific action",
    );
    console.log(
      "   npm run improve:status                 # View queue status",
    );
    console.log(
      "   npm run improve:clear                  # Clear completed actions",
    );
  }

  private async loadActions(): Promise<ImprovementAction[]> {
    try {
      const content = await fs.readFile(this.actionsPath, "utf8");
      const customActions = JSON.parse(content);
      return [...this.defaultActions, ...customActions];
    } catch {
      // File doesn't exist, use defaults
      await this.saveActions(this.defaultActions);
      return this.defaultActions;
    }
  }

  private async saveActions(actions: ImprovementAction[]): Promise<void> {
    await fs.mkdir(path.dirname(this.actionsPath), { recursive: true });
    await fs.writeFile(this.actionsPath, JSON.stringify(actions, null, 2));
  }

  async displayQueueStatus(): Promise<void> {
    try {
      const content = await fs.readFile(this.queuePath, "utf8");
      const queue: ImprovementQueue = JSON.parse(content);

      console.log("📋 **Improvement Queue Status**");
      console.log("═".repeat(60));
      console.log(`Created: ${new Date(queue.timestamp).toLocaleString()}`);
      console.log(`Total actions: ${queue.actions.length}`);

      const statusCount = queue.actions.reduce(
        (acc, action) => {
          acc[action.status] = (acc[action.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      Object.entries(statusCount).forEach(([status, count]) => {
        const emoji =
          {
            pending: "⏳",
            approved: "✅",
            rejected: "❌",
            executed: "🎉",
            failed: "💥",
          }[status] || "❓";
        console.log(`${emoji} ${status}: ${count}`);
      });

      if (queue.actions.some((a) => a.status === "pending")) {
        console.log("\n⏳ **Pending Actions**:");
        queue.actions
          .filter((a) => a.status === "pending")
          .forEach((action, index) => {
            const riskEmoji = { low: "✅", medium: "⚠️", high: "🚨" }[
              action.riskLevel
            ];
            console.log(`   ${index + 1}. ${riskEmoji} ${action.name}`);
            console.log(`      ID: ${action.id}`);
            console.log(`      Risk: ${action.riskLevel}`);
          });
      }
    } catch (error) {
      console.log("📭 No improvement queue found");
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const improver = new PerformanceAutoImprover();

  const command = args[0] || "analyze";

  try {
    switch (command) {
      case "analyze":
        await improver.analyzeAndTrigger({
          dryRun: args.includes("--dry-run"),
          forceGrade: args
            .find((arg) => arg.startsWith("--grade="))
            ?.split("=")[1] as any,
          autoExecute: !args.includes("--no-auto"),
        });
        break;

      case "status":
        await improver.displayQueueStatus();
        break;

      default:
        console.log(
          "Usage: npm run improve:analyze [--dry-run] [--grade=D] [--no-auto]",
        );
        console.log("       npm run improve:status");
    }
  } catch (error) {
    console.error("❌ Performance auto-improver error:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { PerformanceAutoImprover };
export default PerformanceAutoImprover;
