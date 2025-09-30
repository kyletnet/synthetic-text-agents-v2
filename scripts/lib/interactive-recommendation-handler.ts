#!/usr/bin/env tsx

import * as readline from "readline";
import { execSync } from "child_process";

interface Recommendation {
  id: string;
  title: string;
  description: string;
  command?: string;
  riskLevel: "low" | "medium" | "high";
  autoExecutable: boolean;
  category: "fix" | "improve" | "optimize" | "security";
}

interface RecommendationSession {
  source: string;
  recommendations: Recommendation[];
  showInstructions?: boolean;
}

/**
 * Unified handler for converting notification-only patterns into interactive workflows
 * Solves the major UX gap of systems that show recommendations but don't allow action
 */
export class InteractiveRecommendationHandler {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Handle a session of recommendations with interactive prompts
   */
  async handleRecommendations(session: RecommendationSession): Promise<{
    executed: Recommendation[];
    skipped: Recommendation[];
    failed: Recommendation[];
  }> {
    console.log(`\\n🎯 ${session.source} - Interactive Recommendations`);
    console.log("════════════════════════════════════════════════════════════");

    if (session.recommendations.length === 0) {
      console.log("✅ No recommendations needed!");
      this.rl.close();
      return { executed: [], skipped: [], failed: [] };
    }

    // Auto-execute low risk recommendations first
    const autoExecutable = session.recommendations.filter(
      (r) => r.autoExecutable && r.riskLevel === "low" && r.command,
    );

    const manualReview = session.recommendations.filter(
      (r) => !r.autoExecutable || r.riskLevel !== "low" || !r.command,
    );

    const result = {
      executed: [] as Recommendation[],
      skipped: [] as Recommendation[],
      failed: [] as Recommendation[],
    };

    // Phase 1: Auto-execute safe recommendations
    if (autoExecutable.length > 0) {
      console.log(
        `\\n🤖 Auto-executing ${autoExecutable.length} safe recommendations...`,
      );

      for (const rec of autoExecutable) {
        try {
          console.log(`   ⚡ ${rec.title}`);
          if (rec.command) {
            execSync(rec.command, { stdio: "pipe" });
            result.executed.push(rec);
          }
        } catch (error) {
          console.log(`   ❌ Failed: ${rec.title}`);
          result.failed.push(rec);
        }
      }
    }

    // Phase 2: Interactive review for everything else
    if (manualReview.length > 0) {
      console.log(
        `\\n👤 ${manualReview.length} recommendations need your review:`,
      );

      if (session.showInstructions !== false) {
        console.log(`\\n💡 Options for each recommendation:`);
        console.log(`   [y] Execute this recommendation`);
        console.log(`   [n] Skip this recommendation`);
        console.log(`   [A] Execute ALL remaining recommendations`);
        console.log(`   [S] Skip ALL remaining recommendations`);
        console.log(`   [?] Show more details`);
      }

      for (let i = 0; i < manualReview.length; i++) {
        const rec = manualReview[i];
        const choice = await this.promptForRecommendation(
          rec,
          i + 1,
          manualReview.length,
        );

        switch (choice) {
          case "execute":
            if (rec.command) {
              try {
                console.log(`   ⚡ Executing: ${rec.title}`);
                execSync(rec.command, { stdio: "inherit" });
                result.executed.push(rec);
              } catch (error) {
                console.log(`   ❌ Execution failed: ${rec.title}`);
                result.failed.push(rec);
              }
            } else {
              console.log(`   ℹ️ Manual action required: ${rec.description}`);
              result.skipped.push(rec);
            }
            break;
          case "skip":
            result.skipped.push(rec);
            break;
          case "executeAll":
            // Execute current and all remaining
            for (const remainingRec of manualReview.slice(i)) {
              if (remainingRec.command) {
                try {
                  console.log(`   ⚡ Executing: ${remainingRec.title}`);
                  execSync(remainingRec.command, { stdio: "inherit" });
                  result.executed.push(remainingRec);
                } catch (error) {
                  console.log(`   ❌ Failed: ${remainingRec.title}`);
                  result.failed.push(remainingRec);
                }
              } else {
                result.skipped.push(remainingRec);
              }
            }
            break;
          case "skipAll":
            result.skipped.push(...manualReview.slice(i));
            break;
        }

        if (choice === "executeAll" || choice === "skipAll") break;
      }
    }

    this.rl.close();
    this.printSummary(result, session.source);
    return result;
  }

  private async promptForRecommendation(
    rec: Recommendation,
    current: number,
    total: number,
  ): Promise<"execute" | "skip" | "executeAll" | "skipAll" | "details"> {
    const riskIcon = { low: "💡", medium: "⚠️", high: "🚨" }[rec.riskLevel];
    const categoryIcon = {
      fix: "🔧",
      improve: "⚡",
      optimize: "🚀",
      security: "🛡️",
    }[rec.category];

    console.log(
      `\\n─────────────────────────────────────────────────────────────`,
    );
    console.log(
      `📋 Recommendation ${current}/${total}: ${categoryIcon} ${riskIcon} ${rec.title}`,
    );
    console.log(`📝 ${rec.description}`);

    if (rec.command) {
      console.log(`⚡ Command: ${rec.command}`);
    } else {
      console.log(`📋 Manual action required (no automated command)`);
    }

    console.log(`🔍 Risk: ${rec.riskLevel.toUpperCase()}`);

    return new Promise((resolve) => {
      this.rl.question("\\nChoice (y/n/A/S/?): ", (answer) => {
        switch (answer.toLowerCase()) {
          case "y":
          case "yes":
            resolve("execute");
            break;
          case "n":
          case "no":
            resolve("skip");
            break;
          case "a":
          case "all":
            resolve("executeAll");
            break;
          case "s":
          case "skipall":
            resolve("skipAll");
            break;
          case "?":
          case "help":
            console.log(`\\n📖 Detailed Information:`);
            console.log(`   ID: ${rec.id}`);
            console.log(`   Category: ${rec.category}`);
            console.log(
              `   Auto-executable: ${rec.autoExecutable ? "Yes" : "No"}`,
            );
            console.log(`   Risk Level: ${rec.riskLevel}`);
            resolve(this.promptForRecommendation(rec, current, total));
            break;
          default:
            console.log("Please enter y, n, A, S, or ?");
            resolve(this.promptForRecommendation(rec, current, total));
        }
      });
    });
  }

  private printSummary(
    result: {
      executed: Recommendation[];
      skipped: Recommendation[];
      failed: Recommendation[];
    },
    source: string,
  ): void {
    console.log(`\\n🎯 ${source} - Session Summary`);
    console.log("════════════════════════════════════════════════════════════");
    console.log(`✅ Executed: ${result.executed.length}`);
    console.log(`⏸️ Skipped: ${result.skipped.length}`);
    console.log(`❌ Failed: ${result.failed.length}`);

    const total =
      result.executed.length + result.skipped.length + result.failed.length;
    const successRate =
      total > 0 ? Math.round((result.executed.length / total) * 100) : 100;
    console.log(`\\n📈 Success Rate: ${successRate}%`);

    if (result.failed.length > 0) {
      console.log(`\\n❌ Failed recommendations:`);
      result.failed.forEach((rec) => console.log(`   - ${rec.title}`));
    }

    console.log("\\n🚀 Interactive recommendation session complete!");
  }

  /**
   * Static method to quickly convert notification-only patterns
   */
  static async handleQuickRecommendations(
    source: string,
    recommendations: Recommendation[],
  ) {
    const handler = new InteractiveRecommendationHandler();
    return await handler.handleRecommendations({
      source,
      recommendations,
    });
  }

  /**
   * Factory method to create recommendations from common patterns
   */
  static createRecommendation(
    id: string,
    title: string,
    description: string,
    options: {
      command?: string;
      riskLevel?: "low" | "medium" | "high";
      category?: "fix" | "improve" | "optimize" | "security";
      autoExecutable?: boolean;
    } = {},
  ): Recommendation {
    return {
      id,
      title,
      description,
      command: options.command,
      riskLevel: options.riskLevel || "medium",
      category: options.category || "improve",
      autoExecutable:
        options.autoExecutable ??
        (options.riskLevel === "low" && !!options.command),
    };
  }
}

// CLI execution for testing
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const handler = new InteractiveRecommendationHandler();

  // Demo recommendations
  const demoRecommendations = [
    InteractiveRecommendationHandler.createRecommendation(
      "demo-1",
      "Fix ESLint Issues",
      "Auto-fix common code style issues",
      {
        command: "npm run lint:fix",
        riskLevel: "low",
        category: "fix",
      },
    ),
    InteractiveRecommendationHandler.createRecommendation(
      "demo-2",
      "Update Documentation",
      "Refresh documentation indexes",
      {
        command: "npm run docs:refresh",
        riskLevel: "low",
        category: "improve",
      },
    ),
    InteractiveRecommendationHandler.createRecommendation(
      "demo-3",
      "Review Security Audit",
      "Check security-audit.json for high-priority findings",
      {
        riskLevel: "medium",
        category: "security",
      },
    ),
  ];

  handler
    .handleRecommendations({
      source: "Interactive Recommendation Handler Demo",
      recommendations: demoRecommendations,
    })
    .catch(console.error);
}
