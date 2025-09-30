#!/usr/bin/env node

/**
 * 🔍 System Health Check CLI Tool
 *
 * Auto-Detection Engine을 사용한 수동 시스템 건강 체크
 *
 * Usage:
 *   npm run health:check                    # 전체 시스템 건강 체크
 *   npm run health:check -- --category mock # 특정 카테고리만 체크
 *   npm run health:check -- --history       # 탐지 기록 조회
 *   npm run health:check -- --watch         # 지속 모니터링
 */

import {
  autoDetectionEngine,
  SystemHealth,
  DetectionResult,
} from "../lib/auto-detection-engine";

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

class HealthCheckCLI {
  private watchMode = false;
  private watchInterval: NodeJS.Timeout | null = null;

  async run(): Promise<void> {
    const args = process.argv.slice(2);

    try {
      if (args.includes("--help") || args.includes("-h")) {
        this.showHelp();
        return;
      }

      if (args.includes("--history")) {
        await this.showHistory();
        return;
      }

      if (args.includes("--watch")) {
        this.watchMode = true;
        await this.startWatchMode();
        return;
      }

      const categoryIndex = args.indexOf("--category");
      if (categoryIndex !== -1 && args[categoryIndex + 1]) {
        await this.checkCategory(args[categoryIndex + 1]);
        return;
      }

      // 전체 시스템 건강 체크
      await this.performFullHealthCheck();
    } catch (error) {
      console.error(
        `${colors.red}❌ Health check failed:${colors.reset}`,
        error,
      );
      process.exit(1);
    }
  }

  private showHelp(): void {
    console.log(`
${colors.cyan}🔍 System Health Check CLI Tool${colors.reset}

${colors.bright}Usage:${colors.reset}
  npm run health:check                     # 전체 시스템 건강 체크
  npm run health:check -- --category <cat> # 특정 카테고리 체크
  npm run health:check -- --history        # 탐지 기록 조회
  npm run health:check -- --watch          # 지속 모니터링 모드
  npm run health:check -- --help           # 도움말 표시

${colors.bright}Available Categories:${colors.reset}
  - "Mock Contamination"     # Silent Mock 감지
  - "API Key Health"         # API Key 상태 체크
  - "Execution Authority"    # LLM 실행 권한 체크
  - "Port & Process Health"  # 포트/프로세스 상태
  - "Security"               # 보안 이슈 감지
  - "System Integrity"       # 시스템 무결성 체크

${colors.bright}Examples:${colors.reset}
  npm run health:check -- --category "API Key Health"
  npm run health:check -- --watch
    `);
  }

  private async performFullHealthCheck(): Promise<void> {
    console.log(
      `${colors.cyan}🔍 Starting full system health check...${colors.reset}\n`,
    );

    const health = await autoDetectionEngine.performFullHealthCheck();

    this.displayHealthSummary(health);
    this.displayDetections(health.detections);
    this.displayRecommendations(health.recommendations);
  }

  private async checkCategory(category: string): Promise<void> {
    console.log(
      `${colors.cyan}🔍 Checking category: ${category}${colors.reset}\n`,
    );

    const results = await autoDetectionEngine.checkCategory(category);

    if (results.length === 0) {
      console.log(
        `${colors.yellow}⚠️ Unknown category: ${category}${colors.reset}`,
      );
      return;
    }

    this.displayDetections(results);
  }

  private async showHistory(): Promise<void> {
    console.log(
      `${colors.cyan}📋 Detection History (last 20 entries)${colors.reset}\n`,
    );

    const history = autoDetectionEngine.getDetectionHistory().slice(-20);

    if (history.length === 0) {
      console.log(`${colors.yellow}No detection history found${colors.reset}`);
      return;
    }

    history.forEach((result, index) => {
      const timeStr = result.timestamp.toLocaleString();
      const statusIcon = result.passed ? "✅" : "❌";
      const severityColor = this.getSeverityColor(result.severity);

      console.log(
        `${index + 1}. ${statusIcon} [${severityColor}${result.severity.toUpperCase()}${colors.reset}] ${result.category}`,
      );
      console.log(`   ${result.message}`);
      console.log(`   ${colors.white}${timeStr}${colors.reset}\n`);
    });
  }

  private async startWatchMode(): Promise<void> {
    console.log(
      `${colors.cyan}👁️ Starting watch mode (checks every 30 seconds)...${colors.reset}`,
    );
    console.log(`${colors.yellow}Press Ctrl+C to stop${colors.reset}\n`);

    // 초기 체크
    await this.performFullHealthCheck();

    this.watchInterval = setInterval(async () => {
      console.log(
        `\n${colors.cyan}🔄 Refreshing health check...${colors.reset}`,
      );
      await this.performFullHealthCheck();
    }, 30000);

    // Graceful shutdown
    process.on("SIGINT", () => {
      if (this.watchInterval) {
        clearInterval(this.watchInterval);
      }
      console.log(
        `\n${colors.yellow}👋 Health check monitoring stopped${colors.reset}`,
      );
      process.exit(0);
    });
  }

  private displayHealthSummary(health: SystemHealth): void {
    const overallColor = this.getOverallHealthColor(health.overall);
    const statusIcon = this.getHealthIcon(health.overall);

    console.log(`${colors.bright}=== SYSTEM HEALTH SUMMARY ===${colors.reset}`);
    console.log(
      `${statusIcon} Overall Status: ${overallColor}${health.overall.toUpperCase()}${colors.reset}`,
    );
    console.log(`🚨 Critical Issues: ${health.summary.criticalIssues}`);
    console.log(`⚠️  Warnings: ${health.summary.warnings}`);
    console.log(`⏱️  Check Duration: ${health.summary.uptime}ms`);
    console.log(`🕒 Last Check: ${health.summary.lastCheck.toLocaleString()}`);
    console.log("");
  }

  private displayDetections(detections: DetectionResult[]): void {
    console.log(`${colors.bright}=== DETECTION RESULTS ===${colors.reset}`);

    if (detections.length === 0) {
      console.log(`${colors.yellow}No detections to display${colors.reset}`);
      return;
    }

    // 심각도별로 그룹화
    const grouped = {
      emergency: detections.filter((d) => d.severity === "emergency"),
      critical: detections.filter((d) => d.severity === "critical"),
      warning: detections.filter((d) => d.severity === "warning"),
      info: detections.filter((d) => d.severity === "info"),
    };

    Object.entries(grouped).forEach(([severity, results]) => {
      if (results.length === 0) return;

      const severityColor = this.getSeverityColor(severity as any);
      console.log(
        `\n${severityColor}${severity.toUpperCase()} (${results.length})${colors.reset}`,
      );
      console.log(
        `${severityColor}${"=".repeat(severity.length + 5)}${colors.reset}`,
      );

      results.forEach((result, index) => {
        const icon = result.passed ? "✅" : "❌";
        console.log(
          `\n${index + 1}. ${icon} [${result.category}] ${result.message}`,
        );

        if (result.actionRequired) {
          console.log(
            `   ${colors.yellow}Action: ${result.actionRequired}${colors.reset}`,
          );
        }

        if (result.details && typeof result.details === "object") {
          console.log(
            `   ${colors.white}Details:${colors.reset}`,
            JSON.stringify(result.details, null, 2)
              .split("\n")
              .map((line) => `   ${line}`)
              .join("\n"),
          );
        }
      });
    });

    console.log("");
  }

  private displayRecommendations(recommendations: string[]): void {
    if (recommendations.length === 0) return;

    console.log(`${colors.bright}=== RECOMMENDATIONS ===${colors.reset}`);
    recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${colors.cyan}${rec}${colors.reset}`);
    });
    console.log("");
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case "emergency":
        return colors.magenta;
      case "critical":
        return colors.red;
      case "warning":
        return colors.yellow;
      case "info":
        return colors.green;
      default:
        return colors.white;
    }
  }

  private getOverallHealthColor(health: string): string {
    switch (health) {
      case "healthy":
        return colors.green;
      case "degraded":
        return colors.yellow;
      case "critical":
        return colors.red;
      case "emergency":
        return colors.magenta;
      default:
        return colors.white;
    }
  }

  private getHealthIcon(health: string): string {
    switch (health) {
      case "healthy":
        return "✅";
      case "degraded":
        return "⚠️";
      case "critical":
        return "🚨";
      case "emergency":
        return "🆘";
      default:
        return "❓";
    }
  }
}

// CLI 실행
if (require.main === module) {
  const cli = new HealthCheckCLI();
  cli.run().catch((error) => {
    console.error(`${colors.red}Fatal error:${colors.reset}`, error);
    process.exit(1);
  });
}

export { HealthCheckCLI };
