#!/usr/bin/env node

/**
 * 🔄 System Self-Healing CLI Tool
 *
 * Self-Healing Engine을 사용한 수동 시스템 복구
 *
 * Usage:
 *   npm run heal:system                        # 전체 자동 치유 실행
 *   npm run heal:system -- --type api_key     # 특정 유형만 치유
 *   npm run heal:system -- --stats            # 치유 통계 조회
 *   npm run heal:system -- --history          # 치유 기록 조회
 *   npm run heal:system -- --monitor          # 실시간 모니터링
 */

import {
  selfHealingEngine,
  HealingResult,
  SelfHealingStats,
  HealingAction,
} from "../lib/self-healing-engine";

// 🎨 Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

class HealingCLI {
  private monitorMode = false;
  private monitorInterval: NodeJS.Timeout | null = null;

  async run(): Promise<void> {
    const args = process.argv.slice(2);

    try {
      if (args.includes("--help") || args.includes("-h")) {
        this.showHelp();
        return;
      }

      if (args.includes("--stats")) {
        await this.showStats();
        return;
      }

      if (args.includes("--history")) {
        await this.showHistory();
        return;
      }

      if (args.includes("--monitor")) {
        this.monitorMode = true;
        await this.startMonitorMode();
        return;
      }

      const typeIndex = args.indexOf("--type");
      if (typeIndex !== -1 && args[typeIndex + 1]) {
        await this.healSpecificType(
          args[typeIndex + 1] as HealingAction["type"],
        );
        return;
      }

      // 전체 자동 치유 실행
      await this.performFullHealing();
    } catch (error) {
      console.error(`${colors.red}❌ Healing failed:${colors.reset}`, error);
      process.exit(1);
    }
  }

  private showHelp(): void {
    console.log(`
${colors.cyan}🔄 System Self-Healing CLI Tool${colors.reset}

${colors.bright}Usage:${colors.reset}
  npm run heal:system                     # 전체 자동 치유 실행
  npm run heal:system -- --type <type>    # 특정 유형만 치유
  npm run heal:system -- --stats          # 치유 통계 조회
  npm run heal:system -- --history        # 치유 기록 조회
  npm run heal:system -- --monitor        # 실시간 모니터링 모드
  npm run heal:system -- --help           # 도움말 표시

${colors.bright}Available Healing Types:${colors.reset}
  - api_key_rotation      # API Key 로테이션 및 복구
  - process_cleanup       # 프로세스 정리 및 재시작
  - mock_recovery         # Mock Contamination 복구
  - preventive_maintenance # 예방적 유지보수
  - system_restart        # 시스템 재시작

${colors.bright}Examples:${colors.reset}
  npm run heal:system -- --type api_key_rotation
  npm run heal:system -- --monitor
  npm run heal:system -- --stats
    `);
  }

  private async performFullHealing(): Promise<void> {
    console.log(
      `${colors.cyan}🔄 Starting full system healing...${colors.reset}\n`,
    );

    const results = await selfHealingEngine.manualHeal();

    if (results.length === 0) {
      console.log(
        `${colors.green}✅ No healing actions required - system is healthy!${colors.reset}`,
      );
      return;
    }

    this.displayHealingResults(results);
    this.displayHealingSummary(results);
  }

  private async healSpecificType(type: HealingAction["type"]): Promise<void> {
    console.log(
      `${colors.cyan}🔄 Healing specific type: ${type}${colors.reset}\n`,
    );

    const results = await selfHealingEngine.manualHeal(type);

    if (results.length === 0) {
      console.log(
        `${colors.yellow}⚠️ No healing actions found for type: ${type}${colors.reset}`,
      );
      return;
    }

    this.displayHealingResults(results);
    this.displayHealingSummary(results);
  }

  private async showStats(): Promise<void> {
    console.log(`${colors.cyan}📊 Self-Healing Statistics${colors.reset}\n`);

    const stats = selfHealingEngine.getHealingStats();

    console.log(`${colors.bright}=== OVERALL STATISTICS ===${colors.reset}`);
    console.log(`🔄 Total Healing Attempts: ${stats.totalHealingAttempts}`);
    console.log(
      `✅ Successful Healings: ${colors.green}${stats.successfulHealings}${colors.reset}`,
    );
    console.log(
      `❌ Failed Healings: ${colors.red}${stats.failedHealings}${colors.reset}`,
    );
    console.log(
      `⏱️  Average Healing Time: ${Math.round(stats.averageHealingTime)}ms`,
    );
    console.log(
      `🛡️ Issues Prevented: ${colors.blue}${stats.preventedIssues}${colors.reset}`,
    );
    console.log(
      `🕒 Last Healing: ${
        stats.lastHealingTime ? stats.lastHealingTime.toLocaleString() : "Never"
      }`,
    );

    const successRate =
      stats.totalHealingAttempts > 0
        ? (
            (stats.successfulHealings / stats.totalHealingAttempts) *
            100
          ).toFixed(1)
        : "0";

    const successColor =
      parseFloat(successRate) >= 90
        ? colors.green
        : parseFloat(successRate) >= 70
        ? colors.yellow
        : colors.red;

    console.log(
      `📈 Success Rate: ${successColor}${successRate}%${colors.reset}\n`,
    );

    if (Object.keys(stats.healingsByType).length > 0) {
      console.log(`${colors.bright}=== HEALING BY TYPE ===${colors.reset}`);
      Object.entries(stats.healingsByType).forEach(([type, count]) => {
        console.log(`${this.getTypeIcon(type)} ${type}: ${count} times`);
      });
      console.log("");
    }
  }

  private async showHistory(): Promise<void> {
    console.log(
      `${colors.cyan}📋 Self-Healing History (last 20 entries)${colors.reset}\n`,
    );

    const history = selfHealingEngine.getHealingHistory().slice(-20);

    if (history.length === 0) {
      console.log(`${colors.yellow}No healing history found${colors.reset}`);
      return;
    }

    history.forEach((result, index) => {
      const timeStr = result.timestamp.toLocaleString();
      const statusIcon = result.success ? "✅" : "❌";
      const durationStr = `${result.duration}ms`;
      const actionColor = this.getActionColor(result.action.severity);

      console.log(
        `${
          index + 1
        }. ${statusIcon} [${actionColor}${result.action.type.toUpperCase()}${
          colors.reset
        }] ${result.action.description}`,
      );
      console.log(
        `   Duration: ${durationStr} | Severity: ${result.action.severity}`,
      );

      if (result.followUpRequired) {
        console.log(`   ${colors.yellow}⚠️ Follow-up required${colors.reset}`);
      }

      if (result.errorMessage) {
        console.log(
          `   ${colors.red}Error: ${result.errorMessage}${colors.reset}`,
        );
      }

      console.log(`   ${colors.white}${timeStr}${colors.reset}\n`);
    });
  }

  private async startMonitorMode(): Promise<void> {
    console.log(
      `${colors.cyan}👁️ Starting healing monitor mode (checks every 60 seconds)...${colors.reset}`,
    );
    console.log(`${colors.yellow}Press Ctrl+C to stop${colors.reset}\n`);

    // 초기 상태 표시
    await this.showCurrentStatus();

    this.monitorInterval = setInterval(async () => {
      console.log(
        `\n${colors.cyan}🔄 Refreshing healing status...${colors.reset}`,
      );
      await this.showCurrentStatus();
    }, 60000);

    // Graceful shutdown
    process.on("SIGINT", () => {
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
      }
      console.log(
        `\n${colors.yellow}👋 Healing monitor stopped${colors.reset}`,
      );
      process.exit(0);
    });
  }

  private async showCurrentStatus(): Promise<void> {
    const stats = selfHealingEngine.getHealingStats();
    const recentHistory = selfHealingEngine.getHealingHistory().slice(-5);

    console.log(
      `${colors.bright}=== CURRENT HEALING STATUS ===${colors.reset}`,
    );
    console.log(`🔄 Total Attempts: ${stats.totalHealingAttempts}`);
    console.log(
      `✅ Success Rate: ${
        stats.totalHealingAttempts > 0
          ? (
              (stats.successfulHealings / stats.totalHealingAttempts) *
              100
            ).toFixed(1)
          : "0"
      }%`,
    );
    console.log(
      `🕒 Last Healing: ${
        stats.lastHealingTime ? stats.lastHealingTime.toLocaleString() : "Never"
      }`,
    );

    if (recentHistory.length > 0) {
      console.log(`\n${colors.bright}Recent Healing Actions:${colors.reset}`);
      recentHistory.forEach((result, index) => {
        const icon = result.success ? "✅" : "❌";
        const timeStr = new Date(result.timestamp).toLocaleTimeString();
        console.log(`  ${icon} ${result.action.type} (${timeStr})`);
      });
    }

    console.log("");
  }

  private displayHealingResults(results: HealingResult[]): void {
    console.log(`${colors.bright}=== HEALING RESULTS ===${colors.reset}\n`);

    results.forEach((result, index) => {
      const statusIcon = result.success ? "✅" : "❌";
      const actionColor = this.getActionColor(result.action.severity);
      const durationStr = `${result.duration}ms`;

      console.log(
        `${
          index + 1
        }. ${statusIcon} [${actionColor}${result.action.type.toUpperCase()}${
          colors.reset
        }] ${result.action.description}`,
      );
      console.log(
        `   Duration: ${durationStr} | Severity: ${
          result.action.severity
        } | Automated: ${result.action.automated ? "Yes" : "No"}`,
      );

      if (result.action.requirements) {
        console.log(
          `   Requirements: ${result.action.requirements.join(", ")}`,
        );
      }

      if (result.success) {
        console.log(
          `   ${colors.green}✓ Healing completed successfully${colors.reset}`,
        );

        if (result.followUpRequired) {
          console.log(
            `   ${colors.yellow}⚠️ Follow-up actions may be required${colors.reset}`,
          );
        }

        if (result.details) {
          this.displayHealingDetails(result.details);
        }
      } else {
        console.log(`   ${colors.red}✗ Healing failed${colors.reset}`);

        if (result.errorMessage) {
          console.log(
            `   ${colors.red}Error: ${result.errorMessage}${colors.reset}`,
          );
        }
      }

      console.log("");
    });
  }

  private displayHealingDetails(details: any): void {
    if (typeof details === "object" && details !== null) {
      const relevantKeys = Object.keys(details).filter(
        (key) =>
          !key.startsWith("_") &&
          details[key] !== null &&
          details[key] !== undefined,
      );

      if (relevantKeys.length > 0) {
        console.log(`   ${colors.white}Details:${colors.reset}`);
        relevantKeys.slice(0, 3).forEach((key) => {
          // 최대 3개만 표시
          const value =
            typeof details[key] === "object"
              ? JSON.stringify(details[key]).slice(0, 50) + "..."
              : details[key];
          console.log(`     ${key}: ${value}`);
        });
      }
    }
  }

  private displayHealingSummary(results: HealingResult[]): void {
    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`${colors.bright}=== HEALING SUMMARY ===${colors.reset}`);
    console.log(`🎯 Actions Completed: ${successCount}/${totalCount}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);

    const successRate =
      totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : "0";
    const successColor =
      parseFloat(successRate) === 100
        ? colors.green
        : parseFloat(successRate) >= 50
        ? colors.yellow
        : colors.red;

    console.log(
      `📈 Success Rate: ${successColor}${successRate}%${colors.reset}`,
    );

    if (successCount === totalCount && totalCount > 0) {
      console.log(
        `\n${colors.green}🎉 All healing actions completed successfully!${colors.reset}`,
      );
    } else if (successCount > 0) {
      console.log(
        `\n${colors.yellow}⚠️ Some healing actions failed - manual intervention may be required${colors.reset}`,
      );
    } else {
      console.log(
        `\n${colors.red}🚨 All healing actions failed - system requires manual attention${colors.reset}`,
      );
    }
  }

  private getActionColor(severity: string): string {
    switch (severity) {
      case "critical":
        return colors.red;
      case "high":
        return colors.magenta;
      case "medium":
        return colors.yellow;
      case "low":
        return colors.blue;
      default:
        return colors.white;
    }
  }

  private getTypeIcon(type: string): string {
    switch (type) {
      case "api_key_rotation":
        return "🔑";
      case "process_cleanup":
        return "🧹";
      case "mock_recovery":
        return "🎭";
      case "preventive_maintenance":
        return "🔧";
      case "system_restart":
        return "🔄";
      default:
        return "⚙️";
    }
  }
}

// CLI 실행
if (require.main === module) {
  const cli = new HealingCLI();
  cli.run().catch((error) => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  });
}

export { HealingCLI };
