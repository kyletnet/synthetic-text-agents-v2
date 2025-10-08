#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import * as readline from "readline";
import { detectEnvironment } from "./lib/env-detection.js";

interface ApprovalItem {
  id: string;
  type: "evolution" | "refactor" | "security";
  title: string;
  description: string;
  command: string;
  impact: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  autoApprovalEligible: boolean;
}

interface ApprovalResult {
  approved: ApprovalItem[];
  rejected: ApprovalItem[];
  deferred: ApprovalItem[];
  autoExecuted: ApprovalItem[];
}

class InteractiveApprovalHandler {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async handleApprovals(): Promise<ApprovalResult> {
    console.log("\n🔔 Interactive Approval System");
    console.log("════════════════════════════════════════════════════════════");

    // Use centralized environment detection
    const env = detectEnvironment();
    if (!env.isInteractive) {
      console.log(
        "⚠️ 비대화형 실행 환경 감지 - 승인이 필요한 작업을 큐에 저장합니다",
      );
      this.rl.close();
      return { approved: [], rejected: [], deferred: [], autoExecuted: [] };
    }

    const approvalItems = await this.collectApprovalItems();

    if (approvalItems.length === 0) {
      console.log("✅ No approvals needed!");
      this.rl.close();
      return { approved: [], rejected: [], deferred: [], autoExecuted: [] };
    }

    const result: ApprovalResult = {
      approved: [],
      rejected: [],
      deferred: [],
      autoExecuted: [],
    };

    // 1. 자동 승인 가능한 항목들 먼저 처리
    const autoApprovalItems = approvalItems.filter(
      (item) => item.autoApprovalEligible,
    );
    if (autoApprovalItems.length > 0) {
      console.log(
        `\n🤖 Auto-approving ${autoApprovalItems.length} safe items...`,
      );
      for (const item of autoApprovalItems) {
        try {
          console.log(`   ⚡ Executing: ${item.title}`);
          execSync(item.command, { stdio: "inherit" });
          result.autoExecuted.push(item);
        } catch (error) {
          console.log(`   ❌ Failed: ${item.title}`);
          result.rejected.push(item);
        }
      }
    }

    // 2. 수동 승인 필요한 항목들
    const manualItems = approvalItems.filter(
      (item) => !item.autoApprovalEligible,
    );

    if (manualItems.length > 0) {
      console.log(`\n👤 ${manualItems.length} items need your approval:`);

      for (let i = 0; i < manualItems.length; i++) {
        const item = manualItems[i];
        const choice = await this.promptForApproval(
          item,
          i + 1,
          manualItems.length,
        );

        switch (choice) {
          case "approve":
            try {
              console.log(`   ⚡ Executing: ${item.title}`);
              execSync(item.command, { stdio: "inherit" });
              result.approved.push(item);
            } catch (error) {
              console.log(`   ❌ Execution failed: ${item.title}`);
              result.rejected.push(item);
            }
            break;
          case "reject":
            result.rejected.push(item);
            break;
          case "defer":
            result.deferred.push(item);
            break;
          case "approveAll":
            result.approved.push(item);
            // Execute current and all remaining items
            for (const remainingItem of manualItems.slice(i)) {
              try {
                console.log(`   ⚡ Executing: ${remainingItem.title}`);
                execSync(remainingItem.command, { stdio: "inherit" });
                if (remainingItem !== item) result.approved.push(remainingItem);
              } catch (error) {
                console.log(`   ❌ Failed: ${remainingItem.title}`);
                result.rejected.push(remainingItem);
              }
            }
            break;
          case "rejectAll":
            result.rejected.push(...manualItems.slice(i));
            break;
        }

        if (choice === "approveAll" || choice === "rejectAll") break;
      }
    }

    this.rl.close();
    this.printSummary(result);
    return result;
  }

  private async collectApprovalItems(): Promise<ApprovalItem[]> {
    const items: ApprovalItem[] = [];

    // 1. Evolution approvals
    try {
      const evolutionReportPath = join(
        process.cwd(),
        "reports",
        "evolution-report.json",
      );
      if (existsSync(evolutionReportPath)) {
        const report = JSON.parse(readFileSync(evolutionReportPath, "utf8"));
        if (report.autoEvolutionCapabilities?.needsApproval?.length > 0) {
          report.autoEvolutionCapabilities.needsApproval.forEach(
            (item: any, index: number) => {
              items.push({
                id: `evolution-${index}`,
                type: "evolution",
                title: `Architecture Evolution: ${item.description}`,
                description: item.description,
                command: "npm run evolution:approve",
                impact: "System structure improvement, duplicate removal",
                riskLevel: item.priority === "critical" ? "critical" : "medium",
                autoApprovalEligible: item.priority === "low",
              });
            },
          );
        }
      }
    } catch (error) {
      console.log("⚠️ Could not load evolution approvals");
    }

    // 2. Refactor approvals
    try {
      const refactorStatePath = join(process.cwd(), ".refactor", "state.json");
      if (existsSync(refactorStatePath)) {
        const state = JSON.parse(readFileSync(refactorStatePath, "utf8"));
        const pendingFindings =
          state.findings?.filter((f: any) => f.status === "pending") || [];

        if (pendingFindings.length > 0) {
          items.push({
            id: "refactor-batch",
            type: "refactor",
            title: `Refactoring Improvements (${pendingFindings.length} items)`,
            description: `Code quality improvements including schema fixes, consistency improvements`,
            command: 'echo "Refactor approval - manual command needed"',
            impact: "Code quality improvement, technical debt reduction",
            riskLevel: "medium",
            autoApprovalEligible: false, // Refactoring needs careful review
          });
        }
      }
    } catch (error) {
      console.log("⚠️ Could not load refactor approvals");
    }

    // 3. ESLint fixes
    try {
      const lintResult = execSync("npm run dev:lint", {
        encoding: "utf8",
        stdio: "pipe",
      });
      const warningCount = (lintResult.match(/warning/g) || []).length;
      if (warningCount > 0) {
        items.push({
          id: "eslint-fix",
          type: "refactor",
          title: `ESLint Auto-fixes (${warningCount} warnings)`,
          description:
            "Automatic code style fixes for unused variables and formatting",
          command: "npm run lint:fix",
          impact: "Code style consistency, unused variable cleanup",
          riskLevel: "low",
          autoApprovalEligible: true, // ESLint fixes are generally safe
        });
      }
    } catch (error) {
      // ESLint failures are not critical for approval flow
    }

    return items;
  }

  private async promptForApproval(
    item: ApprovalItem,
    current: number,
    total: number,
  ): Promise<string> {
    const riskIcon = {
      low: "💡",
      medium: "⚠️",
      high: "🔶",
      critical: "🚨",
    }[item.riskLevel];

    console.log(
      `\n─────────────────────────────────────────────────────────────`,
    );
    console.log(`📋 Approval ${current}/${total}: ${riskIcon} ${item.title}`);
    console.log(`📝 Description: ${item.description}`);
    console.log(`🎯 Impact: ${item.impact}`);
    console.log(`⚡ Command: ${item.command}`);
    console.log(`🔍 Risk Level: ${item.riskLevel.toUpperCase()}`);

    return new Promise((resolve) => {
      console.log(`\n👤 Your choice:`);
      console.log(`   [y] Approve & Execute`);
      console.log(`   [n] Reject`);
      console.log(`   [d] Defer (skip for now)`);
      console.log(`   [A] Approve ALL remaining`);
      console.log(`   [R] Reject ALL remaining`);

      this.rl.question("\nChoice (y/n/d/A/R): ", (answer) => {
        switch (answer.toLowerCase()) {
          case "y":
          case "yes":
            resolve("approve");
            break;
          case "n":
          case "no":
            resolve("reject");
            break;
          case "d":
          case "defer":
            resolve("defer");
            break;
          case "a":
          case "all":
            resolve("approveAll");
            break;
          case "r":
          case "rejectall":
            resolve("rejectAll");
            break;
          default:
            console.log("Please enter y, n, d, A, or R");
            resolve(this.promptForApproval(item, current, total));
        }
      });
    });
  }

  private printSummary(result: ApprovalResult): void {
    console.log("\n🎯 Approval Session Summary");
    console.log("════════════════════════════════════════════════════════════");
    console.log(`🤖 Auto-executed: ${result.autoExecuted.length}`);
    console.log(`✅ Approved: ${result.approved.length}`);
    console.log(`❌ Rejected: ${result.rejected.length}`);
    console.log(`⏸️  Deferred: ${result.deferred.length}`);

    const total =
      result.autoExecuted.length +
      result.approved.length +
      result.rejected.length +
      result.deferred.length;
    const success = result.autoExecuted.length + result.approved.length;
    const successRate = total > 0 ? Math.round((success / total) * 100) : 100;

    console.log(`\n📈 Success Rate: ${successRate}%`);

    if (result.deferred.length > 0) {
      console.log(
        `\n⏸️  Deferred items will be available in next maintenance cycle`,
      );
    }

    console.log("\n🚀 Approval session complete!");
  }
}

// CLI execution
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const handler = new InteractiveApprovalHandler();
  handler.handleApprovals().catch(console.error);
}

export { InteractiveApprovalHandler };
