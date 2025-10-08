#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface ApprovalAlert {
  id: string;
  timestamp: Date;
  type: "architecture" | "security" | "breaking-change";
  severity: "critical" | "high" | "medium";
  title: string;
  description: string;
  action: string;
  autoExecuteCommand?: string;
  requiresManualApproval: boolean;
}

interface AlertState {
  activeAlerts: ApprovalAlert[];
  lastCheck: Date;
}

class ApprovalAlertSystem {
  private stateFile = join(process.cwd(), "reports", "approval-alerts.json");

  constructor() {
    this.ensureReportsDir();
  }

  private ensureReportsDir(): void {
    const reportsDir = join(process.cwd(), "reports");
    if (!existsSync(reportsDir)) {
      require("fs").mkdirSync(reportsDir, { recursive: true });
    }
  }

  /**
   * 새로운 승인 알람 생성
   */
  createAlert(alert: Omit<ApprovalAlert, "id" | "timestamp">): void {
    const newAlert: ApprovalAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    const state = this.loadState();
    state.activeAlerts.push(newAlert);
    this.saveState(state);

    // 콘솔에 즉시 알람 표시
    this.displayAlert(newAlert);
  }

  /**
   * 알람 즉시 표시
   */
  private displayAlert(alert: ApprovalAlert): void {
    const severityIcon = {
      critical: "🚨",
      high: "⚠️",
      medium: "💡",
    }[alert.severity];

    console.log(`\n${severityIcon} 승인 필요 알람 ${severityIcon}`);
    console.log("═".repeat(50));
    console.log(`📋 제목: ${alert.title}`);
    console.log(`📝 설명: ${alert.description}`);
    console.log(`🎯 액션: ${alert.action}`);

    if (alert.autoExecuteCommand) {
      console.log(`⚡ 자동실행: ${alert.autoExecuteCommand}`);
    }

    console.log(`⏰ 시간: ${alert.timestamp.toLocaleString()}`);
    console.log("═".repeat(50));

    if (alert.requiresManualApproval) {
      console.log("🔒 수동 승인이 필요합니다. /approve 명령어로 승인하세요.");
    }
    console.log();
  }

  /**
   * 활성 알람 목록 조회
   */
  getActiveAlerts(): ApprovalAlert[] {
    return this.loadState().activeAlerts;
  }

  /**
   * 알람 승인 처리
   */
  approveAlert(alertId: string): boolean {
    const state = this.loadState();
    const alertIndex = state.activeAlerts.findIndex((a) => a.id === alertId);

    if (alertIndex === -1) {
      console.log(`❌ 알람을 찾을 수 없습니다: ${alertId}`);
      return false;
    }

    const alert = state.activeAlerts[alertIndex];

    // 자동 실행 명령이 있으면 실행
    if (alert.autoExecuteCommand) {
      console.log(`⚡ 자동 실행 중: ${alert.autoExecuteCommand}`);
      try {
        require("child_process").execSync(alert.autoExecuteCommand, {
          stdio: "inherit",
        });
        console.log("✅ 자동 실행 완료");
      } catch (error) {
        console.error("❌ 자동 실행 실패:", error);
        return false;
      }
    }

    // 알람 제거
    state.activeAlerts.splice(alertIndex, 1);
    this.saveState(state);

    console.log(`✅ 알람 승인 완료: ${alert.title}`);
    return true;
  }

  /**
   * 모든 알람 목록 표시
   */
  showActiveAlerts(): void {
    const alerts = this.getActiveAlerts();

    if (alerts.length === 0) {
      console.log("✅ 승인 대기 중인 알람이 없습니다.");
      return;
    }

    console.log("\n🔔 활성 승인 알람 목록");
    console.log("═".repeat(50));

    alerts.forEach((alert, index) => {
      const severityIcon = {
        critical: "🚨",
        high: "⚠️",
        medium: "💡",
      }[alert.severity];

      console.log(`${index + 1}. ${severityIcon} ${alert.title}`);
      console.log(`   📝 ${alert.description}`);
      console.log(`   🆔 ID: ${alert.id.substr(-8)}`);
      console.log(`   ⏰ ${alert.timestamp.toLocaleString()}`);
      console.log();
    });

    console.log(
      "승인하려면: /approve <alert-id> 또는 npm run approve:<alert-id>",
    );
  }

  private loadState(): AlertState {
    if (!existsSync(this.stateFile)) {
      return {
        activeAlerts: [],
        lastCheck: new Date(),
      };
    }

    try {
      const content = readFileSync(this.stateFile, "utf8");
      const parsed = JSON.parse(content);

      // Date 객체 복원
      parsed.activeAlerts = parsed.activeAlerts.map((alert: any) => ({
        ...alert,
        timestamp: new Date(alert.timestamp),
      }));
      parsed.lastCheck = new Date(parsed.lastCheck);

      return parsed;
    } catch {
      return {
        activeAlerts: [],
        lastCheck: new Date(),
      };
    }
  }

  private saveState(state: AlertState): void {
    state.lastCheck = new Date();
    writeFileSync(this.stateFile, JSON.stringify(state, null, 2));
  }
}

// CLI 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  const alertSystem = new ApprovalAlertSystem();

  if (args.includes("show")) {
    alertSystem.showActiveAlerts();
  } else if (args.includes("approve") && args[1]) {
    const alertId = args[1];
    alertSystem.approveAlert(alertId);
  } else if (args.includes("test")) {
    // 테스트 알람 생성
    alertSystem.createAlert({
      type: "architecture",
      severity: "high",
      title: "아키텍처 변경 감지",
      description:
        "ARCHITECTURE.md 파일이 변경되었습니다. 시스템 재구성이 필요할 수 있습니다.",
      action: "설계 원칙을 재적용하고 컴포넌트를 재분석합니다.",
      autoExecuteCommand: "npm run policy:reflect",
      requiresManualApproval: true,
    });
  } else {
    console.log("Usage:");
    console.log(
      "  tsx scripts/approval-alert-system.ts show     # 활성 알람 표시",
    );
    console.log(
      "  tsx scripts/approval-alert-system.ts approve <id>  # 알람 승인",
    );
    console.log(
      "  tsx scripts/approval-alert-system.ts test    # 테스트 알람 생성",
    );
  }
}

export { ApprovalAlertSystem };
export type { ApprovalAlert };
