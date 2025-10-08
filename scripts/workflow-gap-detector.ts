#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { glob } from "glob";

interface WorkflowGap {
  type:
    | "notification_only"
    | "missing_action"
    | "broken_chain"
    | "manual_dependency";
  severity: "critical" | "high" | "medium" | "low";
  component: string;
  description: string;
  evidence: string[];
  suggestedFix: string;
}

class WorkflowGapDetector {
  private gaps: WorkflowGap[] = [];

  async detectWorkflowGaps(): Promise<WorkflowGap[]> {
    console.log("🔍 Scanning for workflow gaps system-wide...");

    await this.checkNotificationOnlyPatterns();
    await this.checkBrokenActionChains();
    await this.checkManualDependencies();
    await this.checkMissingInteractivity();

    this.printReport();
    return this.gaps;
  }

  private async checkNotificationOnlyPatterns(): Promise<void> {
    console.log("   📢 Checking notification-only patterns...");

    // Find files that show information but don't provide actions
    const scriptFiles = await glob("scripts/**/*.ts");

    for (const file of scriptFiles) {
      try {
        const content = readFileSync(file, "utf8");

        // Pattern: console.log with recommendation but no interactive followup
        if (
          content.includes("console.log") &&
          (content.includes("recommendation") ||
            content.includes("suggested") ||
            content.includes("should"))
        ) {
          // Check if it provides actionable commands
          if (
            !content.includes("readline") &&
            !content.includes("prompt") &&
            !content.includes("question") &&
            !content.includes("confirm")
          ) {
            this.gaps.push({
              type: "notification_only",
              severity: "medium",
              component: file,
              description:
                "Shows recommendations but provides no interactive way to act on them",
              evidence: [
                "Found console.log with recommendations",
                "No interactive prompts found",
              ],
              suggestedFix: "Add interactive prompt or auto-execution option",
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  private async checkBrokenActionChains(): Promise<void> {
    console.log("   🔗 Checking broken action chains...");

    // Check for commands that depend on external state but don't verify it
    const packageJsonPath = join(process.cwd(), "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      const scripts = packageJson.scripts || {};

      for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
        if (typeof scriptCommand === "string") {
          // Check for commands that might fail due to missing dependencies
          if (
            scriptCommand.includes("tsx") &&
            scriptCommand.includes("refactor")
          ) {
            // This is a refactor command, check if it requires prior setup
            if (!scripts["refactor:setup"] && !scripts["refactor:init"]) {
              this.gaps.push({
                type: "broken_chain",
                severity: "high",
                component: `package.json:scripts:${scriptName}`,
                description:
                  "Refactor command may fail if state is not properly initialized",
                evidence: [
                  `Script: ${scriptCommand}`,
                  "No setup/init scripts found",
                ],
                suggestedFix: "Add state verification or auto-initialization",
              });
            }
          }
        }
      }
    }
  }

  private async checkManualDependencies(): Promise<void> {
    console.log("   🤝 Checking manual dependencies...");

    // Check for workflows that require manual steps in sequence
    const cliFiles = await glob("scripts/**/*cli*.ts");
    const orchestratorFiles = await glob("scripts/**/*orchestrator*.ts");

    for (const file of [...cliFiles, ...orchestratorFiles]) {
      try {
        const content = readFileSync(file, "utf8");

        // Look for manual step indicators
        const manualIndicators = [
          "manual",
          "manually",
          "user must",
          "requires approval",
          "needs confirmation",
          "run separately",
        ];

        let foundManualSteps = false;
        const evidence: string[] = [];

        for (const indicator of manualIndicators) {
          if (content.toLowerCase().includes(indicator)) {
            foundManualSteps = true;
            evidence.push(`Found: "${indicator}"`);
          }
        }

        if (foundManualSteps) {
          // Check if there's automation for these manual steps
          if (
            !content.includes("automate") &&
            !content.includes("auto-") &&
            !content.includes("interactive")
          ) {
            this.gaps.push({
              type: "manual_dependency",
              severity: "medium",
              component: file,
              description:
                "Workflow requires manual steps but provides no automation options",
              evidence,
              suggestedFix: "Add automation options or interactive prompts",
            });
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  private async checkMissingInteractivity(): Promise<void> {
    console.log("   🎯 Checking missing interactivity...");

    // Check systems that make decisions but don't ask user preference
    const systemFiles = await glob("scripts/**/*system*.ts");

    for (const file of systemFiles) {
      try {
        const content = readFileSync(file, "utf8");

        // Look for decision-making without user input
        if (content.includes("execSync") || content.includes("exec(")) {
          // This file executes commands
          if (
            content.includes("console.log") &&
            (content.includes("executing") || content.includes("running"))
          ) {
            // It tells user what it's doing
            if (
              !content.includes("readline") &&
              !content.includes("confirm") &&
              !content.includes("prompt") &&
              !content.includes("--force") &&
              !content.includes("--auto")
            ) {
              // But doesn't ask for confirmation or provide override options

              this.gaps.push({
                type: "missing_action",
                severity: "high",
                component: file,
                description:
                  "Executes commands without user confirmation or override options",
                evidence: [
                  "Executes commands automatically",
                  "No confirmation prompts",
                  "No force/auto flags",
                ],
                suggestedFix:
                  "Add confirmation prompts or --auto/--force flags",
              });
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
  }

  private printReport(): void {
    console.log("\n🎯 Workflow Gap Analysis Report");
    console.log("════════════════════════════════════════════════════════════");

    if (this.gaps.length === 0) {
      console.log("✅ No significant workflow gaps detected!");
      return;
    }

    const critical = this.gaps.filter((g) => g.severity === "critical").length;
    const high = this.gaps.filter((g) => g.severity === "high").length;
    const medium = this.gaps.filter((g) => g.severity === "medium").length;
    const low = this.gaps.filter((g) => g.severity === "low").length;

    console.log(`📊 Found ${this.gaps.length} workflow gaps:`);
    if (critical > 0) console.log(`   🚨 Critical: ${critical}`);
    if (high > 0) console.log(`   ⚠️  High: ${high}`);
    if (medium > 0) console.log(`   🔶 Medium: ${medium}`);
    if (low > 0) console.log(`   💡 Low: ${low}`);

    console.log("\n🔍 Detailed Findings:");
    this.gaps.forEach((gap, index) => {
      const severityIcon = {
        critical: "🚨",
        high: "⚠️",
        medium: "🔶",
        low: "💡",
      }[gap.severity];

      console.log(
        `\n${index + 1}. ${severityIcon} ${gap.type.toUpperCase()}: ${
          gap.component
        }`,
      );
      console.log(`   📝 ${gap.description}`);
      console.log(`   🔧 Fix: ${gap.suggestedFix}`);
      if (gap.evidence.length > 0) {
        console.log(`   📋 Evidence: ${gap.evidence.join(", ")}`);
      }
    });

    console.log("\n🎯 Priority Actions:");
    const priorityGaps = this.gaps.filter(
      (g) => g.severity === "critical" || g.severity === "high",
    );
    if (priorityGaps.length > 0) {
      console.log("   1. Fix high/critical gaps first");
      console.log("   2. Add interactive prompts to automation scripts");
      console.log("   3. Provide --auto flags for CI/CD usage");
      console.log("   4. Add confirmation steps for destructive operations");
    }

    console.log("\n💡 This analysis can be automated in maintenance cycles");
  }
}

// CLI execution
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const detector = new WorkflowGapDetector();
  detector.detectWorkflowGaps().catch(console.error);
}

export { WorkflowGapDetector };
