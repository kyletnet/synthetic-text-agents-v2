#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Safe Automation Guard
 * 무한루프 및 위험한 자동화 방지 시스템
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface AutomationAttempt {
  command: string;
  timestamp: string;
  success: boolean;
  error?: string;
  duration: number;
}

interface SafetyLimits {
  maxAttemptsPerHour: number;
  maxConsecutiveFailures: number;
  cooldownMinutes: number;
  dangerousCommands: string[];
}

class SafeAutomationGuard {
  private projectRoot = process.cwd();
  private attemptsFile = join(
    this.projectRoot,
    "reports",
    ".automation-attempts.json",
  );
  private limits: SafetyLimits = {
    maxAttemptsPerHour: 5, // TypeScript 체크는 시간당 최대 5회만
    maxConsecutiveFailures: 3, // 연속 실패 3회면 중단
    cooldownMinutes: 15, // 실패 후 15분 쿨다운
    dangerousCommands: [
      "npm run dev:typecheck",
      "npm run advanced:audit",
      "npm run lint:fix",
      "npm run system:evolve",
    ],
  };

  /**
   * 자동화 실행 전 안전성 검사
   */
  async canExecuteAutomation(command: string): Promise<{
    allowed: boolean;
    reason?: string;
    nextAllowedTime?: string;
  }> {
    const attempts = this.loadAttempts();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const cooldownEndTime = new Date(
      now.getTime() - this.limits.cooldownMinutes * 60 * 1000,
    );

    // 1. 시간당 시도 제한 확인
    const recentAttempts = attempts.filter(
      (a) => a.command === command && new Date(a.timestamp) > oneHourAgo,
    );

    if (recentAttempts.length >= this.limits.maxAttemptsPerHour) {
      const oldestAttempt = recentAttempts[0];
      const nextAllowed = new Date(
        new Date(oldestAttempt.timestamp).getTime() + 60 * 60 * 1000,
      );

      return {
        allowed: false,
        reason: `시간당 시도 제한 초과 (${this.limits.maxAttemptsPerHour}회)`,
        nextAllowedTime: nextAllowed.toLocaleString("ko-KR"),
      };
    }

    // 2. 연속 실패 확인
    const lastAttempts = attempts
      .filter((a) => a.command === command)
      .slice(-this.limits.maxConsecutiveFailures);

    const allRecentFailed =
      lastAttempts.length >= this.limits.maxConsecutiveFailures &&
      lastAttempts.every((a) => !a.success);

    if (allRecentFailed) {
      const lastFailTime = new Date(
        lastAttempts[lastAttempts.length - 1].timestamp,
      );
      const cooldownEnd = new Date(
        lastFailTime.getTime() + this.limits.cooldownMinutes * 60 * 1000,
      );

      if (now < cooldownEnd) {
        return {
          allowed: false,
          reason: `연속 실패 후 쿨다운 중 (${this.limits.maxConsecutiveFailures}회 실패)`,
          nextAllowedTime: cooldownEnd.toLocaleString("ko-KR"),
        };
      }
    }

    // 3. 위험한 명령어 특별 처리
    if (this.limits.dangerousCommands.includes(command)) {
      console.log(`⚠️  위험한 자동화 명령: ${command}`);
      console.log(
        `   📊 최근 1시간 시도: ${recentAttempts.length}/${this.limits.maxAttemptsPerHour}`,
      );

      // 사용자 확인 필요
      return {
        allowed: false,
        reason: "위험한 명령어 - 사용자 수동 승인 필요",
      };
    }

    return { allowed: true };
  }

  /**
   * 자동화 시도 기록
   */
  async recordAttempt(
    command: string,
    success: boolean,
    duration: number,
    error?: string,
  ): Promise<void> {
    const attempts = this.loadAttempts();

    attempts.push({
      command,
      timestamp: new Date().toISOString(),
      success,
      duration,
      error,
    });

    // 오래된 기록 정리 (7일 이상)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const filteredAttempts = attempts.filter(
      (a) => new Date(a.timestamp) > sevenDaysAgo,
    );

    this.saveAttempts(filteredAttempts);
  }

  /**
   * 자동화 통계 보고서
   */
  generateSafetyReport(): string {
    const attempts = this.loadAttempts();
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentAttempts = attempts.filter(
      (a) => new Date(a.timestamp) > oneHourAgo,
    );
    const dailyAttempts = attempts.filter(
      (a) => new Date(a.timestamp) > oneDayAgo,
    );

    const commandStats = new Map<
      string,
      { success: number; failed: number; lastTry: string }
    >();

    for (const attempt of dailyAttempts) {
      const stats = commandStats.get(attempt.command) || {
        success: 0,
        failed: 0,
        lastTry: "",
      };
      if (attempt.success) stats.success++;
      else stats.failed++;
      stats.lastTry = attempt.timestamp;
      commandStats.set(attempt.command, stats);
    }

    let report = `
## 🛡️ 자동화 안전 보고서

### 📊 최근 활동 (24시간)
- **총 시도**: ${dailyAttempts.length}회
- **성공**: ${dailyAttempts.filter((a) => a.success).length}회
- **실패**: ${dailyAttempts.filter((a) => !a.success).length}회
- **최근 1시간**: ${recentAttempts.length}회

### 📋 명령어별 통계
`;

    for (const [command, stats] of commandStats) {
      const isDangerous = this.limits.dangerousCommands.includes(command);
      const successRate = Math.round(
        (stats.success / (stats.success + stats.failed)) * 100,
      );

      report += `
- **${command}** ${isDangerous ? "⚠️ " : ""}
  - 성공률: ${successRate}% (${stats.success}/${stats.success + stats.failed})
  - 최종 시도: ${new Date(stats.lastTry).toLocaleString("ko-KR")}`;
    }

    report += `

### 🚨 위험 지표
`;

    // 연속 실패 명령어 찾기
    for (const dangerousCmd of this.limits.dangerousCommands) {
      const cmdAttempts = attempts
        .filter((a) => a.command === dangerousCmd)
        .slice(-3);
      if (cmdAttempts.length >= 3 && cmdAttempts.every((a) => !a.success)) {
        report += `- ❌ **${dangerousCmd}**: 연속 ${cmdAttempts.length}회 실패\n`;
      }
    }

    return report;
  }

  private loadAttempts(): AutomationAttempt[] {
    if (!existsSync(this.attemptsFile)) {
      return [];
    }

    try {
      return JSON.parse(readFileSync(this.attemptsFile, "utf8"));
    } catch {
      return [];
    }
  }

  private saveAttempts(attempts: AutomationAttempt[]): void {
    writeFileSync(this.attemptsFile, JSON.stringify(attempts, null, 2));
  }
}

export const safeGuard = new SafeAutomationGuard();
export default SafeAutomationGuard;
