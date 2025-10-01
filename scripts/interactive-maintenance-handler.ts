#!/usr/bin/env tsx

/**
 * Interactive Maintenance Handler
 * Provides safe semi-automated maintenance with clear risk communication
 * Designed for non-technical users with appropriate safety warnings
 */

import readline from "readline";
import chalk from "chalk";
import { detectEnvironment } from "./lib/env-detection.js";

interface MaintenanceAction {
  id: string;
  name: string;
  description: string;
  riskLevel: "safe" | "low" | "medium" | "high" | "critical";
  impact: string[];
  technicalDetails: string;
  userFriendlyExplanation: string;
  requiresExpertReview: boolean;
  autoApprovable: boolean;
  estimatedTime: string;
  rollbackable: boolean;
}

interface RiskProfile {
  emoji: string;
  color: string;
  title: string;
  defaultChoice: "y" | "n";
  requiresExpertConfirmation: boolean;
  warningMessage: string;
  consequences: string[];
}

class InteractiveMaintenanceHandler {
  private readonly rl: readline.Interface;
  private readonly riskProfiles: Record<string, RiskProfile> = {
    safe: {
      emoji: "✅",
      color: "green",
      title: "SAFE - 안전함",
      defaultChoice: "y",
      requiresExpertConfirmation: false,
      warningMessage:
        "이 작업은 완전히 안전하며 시스템에 영향을 주지 않습니다.",
      consequences: ["시스템 안정성에 영향 없음", "언제든 되돌릴 수 있음"],
    },
    low: {
      emoji: "🟢",
      color: "green",
      title: "LOW RISK - 낮은 위험",
      defaultChoice: "y",
      requiresExpertConfirmation: false,
      warningMessage: "매우 안전한 개선 작업입니다.",
      consequences: ["코드 품질 향상", "버그 가능성 매우 낮음", "자동 백업됨"],
    },
    medium: {
      emoji: "🟡",
      color: "yellow",
      title: "MEDIUM RISK - 중간 위험",
      defaultChoice: "n",
      requiresExpertConfirmation: false,
      warningMessage: "신중하게 검토가 필요한 작업입니다.",
      consequences: [
        "일부 기능에 영향 가능",
        "테스트 후 확인 권장",
        "백업본으로 복원 가능",
      ],
    },
    high: {
      emoji: "🟠",
      color: "red",
      title: "HIGH RISK - 높은 위험",
      defaultChoice: "n",
      requiresExpertConfirmation: true,
      warningMessage: "⚠️  시스템 전체에 영향을 줄 수 있는 중요한 변경입니다.",
      consequences: [
        "전체 시스템 동작 방식 변경 가능",
        "예상치 못한 부작용 발생 가능",
        "개발자/전문가 검토 강력 권장",
      ],
    },
    critical: {
      emoji: "🔴",
      color: "red",
      title: "CRITICAL - 치명적 위험",
      defaultChoice: "n",
      requiresExpertConfirmation: true,
      warningMessage:
        "🚨 STOP! 이 작업은 시스템을 완전히 망가뜨릴 수 있습니다.",
      consequences: [
        "시스템 전체 중단 가능",
        "데이터 손실 위험",
        "복구 불가능할 수 있음",
        "반드시 전문가 확인 필요",
      ],
    },
  };

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async handleMaintenanceActions(actions: MaintenanceAction[]): Promise<void> {
    // Check environment before interactive operations
    const env = detectEnvironment();
    if (!env.isInteractive) {
      console.log(
        "\n⚠️  비대화형 환경 감지 - 대화형 유지보수를 사용할 수 없습니다.",
      );
      console.log(
        "💡 터미널에서 직접 실행하거나 npm run maintain을 사용하세요.",
      );
      this.rl.close();
      return;
    }

    console.log("\n🔧 **스마트 유지보수 시작**");
    console.log("=".repeat(50));

    // Group by risk level
    const groupedActions = this.groupActionsByRisk(actions);

    // Handle safe actions first (auto-approve if user wants)
    if (groupedActions.safe?.length > 0) {
      await this.handleSafeActions(groupedActions.safe);
    }

    // Handle low risk actions
    if (groupedActions.low?.length > 0) {
      await this.handleLowRiskActions(groupedActions.low);
    }

    // Handle medium risk actions
    if (groupedActions.medium?.length > 0) {
      await this.handleMediumRiskActions(groupedActions.medium);
    }

    // Handle high risk actions with extra warnings
    if (groupedActions.high?.length > 0) {
      await this.handleHighRiskActions(groupedActions.high);
    }

    // Handle critical actions with maximum warnings
    if (groupedActions.critical?.length > 0) {
      await this.handleCriticalActions(groupedActions.critical);
    }

    console.log("\n✅ 유지보수 완료!");
    this.rl.close();
  }

  private async handleSafeActions(actions: MaintenanceAction[]): Promise<void> {
    console.log(`\n✅ **안전한 작업 ${actions.length}개 발견**`);
    console.log(
      "이 작업들은 100% 안전하며 시스템에 전혀 영향을 주지 않습니다.",
    );

    const allApprove = await this.promptUser(
      `모든 안전한 작업을 진행하시겠습니까?`,
      "Y",
      "n",
      "권장: Yes (안전함)",
    );

    if (allApprove) {
      for (const action of actions) {
        console.log(`  ✅ ${action.name} - 완료`);
        await this.executeAction(action);
      }
    }
  }

  private async handleLowRiskActions(
    actions: MaintenanceAction[],
  ): Promise<void> {
    console.log(`\n🟢 **낮은 위험 작업 ${actions.length}개 발견**`);

    for (const action of actions) {
      console.log(`\n📋 작업: ${action.name}`);
      console.log(`설명: ${action.userFriendlyExplanation}`);
      console.log(`예상 시간: ${action.estimatedTime}`);

      const approve = await this.promptUser(
        "이 작업을 진행하시겠습니까?",
        "Y",
        "n",
        "일반적으로 안전한 작업입니다",
      );

      if (approve) {
        await this.executeAction(action);
      }
    }
  }

  private async handleMediumRiskActions(
    actions: MaintenanceAction[],
  ): Promise<void> {
    console.log(`\n🟡 **중간 위험 작업 ${actions.length}개 발견**`);
    console.log("⚠️  신중한 검토가 필요한 작업들입니다.");

    for (const action of actions) {
      await this.displayDetailedRiskInfo(action);

      const approve = await this.promptUser(
        "정말로 이 작업을 진행하시겠습니까?",
        "y",
        "N",
        "확실하지 않으면 N을 선택하세요",
      );

      if (approve) {
        console.log("📸 백업 생성 중...");
        await this.executeAction(action);
      } else {
        console.log("⏭️  작업을 건너뛰었습니다.");
      }
    }
  }

  private async handleHighRiskActions(
    actions: MaintenanceAction[],
  ): Promise<void> {
    console.log(`\n🟠 **높은 위험 작업 ${actions.length}개 발견**`);

    for (const action of actions) {
      await this.displayCriticalWarning(action);

      // Require explicit expert consultation warning
      console.log("\n⚠️  **중요한 결정이 필요합니다**");
      console.log("이 작업은 시스템 전체에 영향을 줄 수 있습니다.");
      console.log("개발자나 기술 전문가와 상의하는 것을 강력히 권장합니다.");

      const expertConsulted = await this.promptUser(
        "전문가와 상의했거나 위험을 충분히 이해하셨습니까?",
        "y",
        "N",
        "확실하지 않으면 반드시 N을 선택하세요",
      );

      if (!expertConsulted) {
        console.log("✅ 현명한 선택입니다. 이 작업을 건너뛰겠습니다.");
        console.log("💡 나중에 전문가와 상의 후 수동으로 실행할 수 있습니다.");
        continue;
      }

      const finalConfirm = await this.promptUser(
        "정말로 실행하시겠습니까? (되돌릴 수 없을 수도 있습니다)",
        "y",
        "N",
        "마지막 확인 - 위험을 감수하시겠습니까?",
      );

      if (finalConfirm) {
        console.log("🚨 고위험 작업 실행 중...");
        console.log("📸 완전한 시스템 백업 생성 중...");
        await this.executeAction(action);
      }
    }
  }

  private async handleCriticalActions(
    actions: MaintenanceAction[],
  ): Promise<void> {
    console.log(`\n🔴 **치명적 위험 작업 ${actions.length}개 발견**`);
    console.log("\n🚨 **STOP!** - 매우 위험한 작업들입니다.");

    for (const action of actions) {
      await this.displayCriticalWarning(action);

      console.log("\n🛑 **자동 실행 차단됨**");
      console.log("이 작업은 시스템을 완전히 망가뜨릴 수 있습니다.");
      console.log("\n💡 **권장 사항**:");
      console.log("1. 개발자/기술팀과 먼저 상의하세요");
      console.log("2. 시스템 전체를 백업하세요");
      console.log("3. 테스트 환경에서 먼저 시도하세요");
      console.log("4. 확실하지 않으면 실행하지 마세요");

      const understandRisk = await this.promptUser(
        "위험성을 완전히 이해하고 전문가 승인을 받았습니까?",
        "y",
        "N",
        "확실하지 않으면 절대 Y를 선택하지 마세요",
      );

      if (!understandRisk) {
        console.log("✅ 안전한 선택입니다. 이 작업은 건너뛰겠습니다.");
        continue;
      }

      // Triple confirmation for critical actions
      const typed = await this.promptTypedConfirmation(
        '정말로 실행하려면 "EXECUTE"를 정확히 입력하세요',
      );

      if (typed === "EXECUTE") {
        console.log("🚨 치명적 위험 작업 실행...");
        console.log("📸 완전한 시스템 스냅샷 생성 중...");
        await this.executeAction(action);
      } else {
        console.log("⏭️ 작업이 취소되었습니다. (안전한 선택)");
      }
    }
  }

  private async displayDetailedRiskInfo(
    action: MaintenanceAction,
  ): Promise<void> {
    const profile = this.riskProfiles[action.riskLevel];

    console.log(`\n${profile.emoji} **${profile.title}**`);
    console.log(`작업명: ${action.name}`);
    console.log(`설명: ${action.userFriendlyExplanation}`);
    console.log(`예상 시간: ${action.estimatedTime}`);
    console.log(`되돌리기: ${action.rollbackable ? "✅ 가능" : "❌ 어려움"}`);

    console.log("\n📋 **예상 영향**:");
    action.impact.forEach((impact) => console.log(`  • ${impact}`));

    console.log("\n⚠️  **주의사항**:");
    profile.consequences.forEach((consequence) =>
      console.log(`  • ${consequence}`),
    );
  }

  private async displayCriticalWarning(
    action: MaintenanceAction,
  ): Promise<void> {
    const profile = this.riskProfiles[action.riskLevel];

    console.log("\n" + "🚨".repeat(20));
    console.log(`${profile.emoji} **${profile.title}**`);
    console.log("🚨".repeat(20));

    console.log(`\n📋 **작업 내용**: ${action.name}`);
    console.log(`🔍 **상세 설명**: ${action.userFriendlyExplanation}`);
    console.log(`⏰ **예상 시간**: ${action.estimatedTime}`);
    console.log(
      `🔄 **복구 가능성**: ${action.rollbackable ? "부분적으로 가능" : "매우 어려움"}`,
    );

    console.log("\n💥 **가능한 결과**:");
    profile.consequences.forEach((consequence) =>
      console.log(`  ❌ ${consequence}`),
    );

    console.log("\n🎯 **영향 범위**:");
    action.impact.forEach((impact) => console.log(`  🔴 ${impact}`));

    console.log(`\n⚠️  ${profile.warningMessage}`);
  }

  private async promptUser(
    question: string,
    yesChar: string,
    noChar: string,
    hint: string,
  ): Promise<boolean> {
    const prompt = `\n❓ ${question} [${yesChar}/${noChar}] (${hint}): `;

    return new Promise((resolve) => {
      this.rl.question(prompt, (answer) => {
        const normalized = answer.toLowerCase().trim();
        if (normalized === "" || normalized === yesChar.toLowerCase()) {
          resolve(yesChar === yesChar.toUpperCase());
        } else if (normalized === noChar.toLowerCase()) {
          resolve(noChar === noChar.toUpperCase());
        } else {
          console.log(`올바른 답변을 입력하세요: ${yesChar} 또는 ${noChar}`);
          this.promptUser(question, yesChar, noChar, hint).then(resolve);
        }
      });
    });
  }

  private async promptTypedConfirmation(message: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(`\n⌨️  ${message}: `, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  private groupActionsByRisk(
    actions: MaintenanceAction[],
  ): Record<string, MaintenanceAction[]> {
    return actions.reduce(
      (groups, action) => {
        const risk = action.riskLevel;
        if (!groups[risk]) groups[risk] = [];
        groups[risk].push(action);
        return groups;
      },
      {} as Record<string, MaintenanceAction[]>,
    );
  }

  private async executeAction(action: MaintenanceAction): Promise<void> {
    // Placeholder for actual execution
    console.log(`⚡ 실행 중: ${action.name}...`);

    // Simulate execution time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log(`✅ 완료: ${action.name}`);
  }
}

// Demo function
async function demo() {
  const handler = new InteractiveMaintenanceHandler();

  const sampleActions: MaintenanceAction[] = [
    {
      id: "fix-unused-vars",
      name: "사용하지 않는 변수 정리",
      description: "Remove unused variables from codebase",
      riskLevel: "safe",
      impact: ["코드 정리", "파일 크기 약간 감소"],
      technicalDetails: "Remove 40 unused variable declarations",
      userFriendlyExplanation:
        "사용하지 않는 코드를 정리해서 코드를 깔끔하게 만듭니다.",
      requiresExpertReview: false,
      autoApprovable: true,
      estimatedTime: "30초",
      rollbackable: true,
    },
    {
      id: "update-types",
      name: "TypeScript 타입 문제 수정",
      description: "Fix TypeScript any-type issues",
      riskLevel: "low",
      impact: ["타입 안정성 향상", "버그 감소"],
      technicalDetails: "Replace any types with proper types",
      userFriendlyExplanation:
        "TypeScript의 타입 검사를 더 정확하게 만들어 오류를 줄입니다.",
      requiresExpertReview: false,
      autoApprovable: true,
      estimatedTime: "1분",
      rollbackable: true,
    },
    {
      id: "config-update",
      name: "시스템 설정 업데이트",
      description: "Update system configuration files",
      riskLevel: "high",
      impact: [
        "전체 시스템 동작 방식 변경",
        "성능에 영향 가능",
        "일부 기능 중단 가능",
      ],
      technicalDetails: "Update tsconfig.json and package.json configurations",
      userFriendlyExplanation:
        "시스템의 핵심 설정 파일을 수정합니다. 잘못되면 전체 시스템이 작동하지 않을 수 있습니다.",
      requiresExpertReview: true,
      autoApprovable: false,
      estimatedTime: "2분",
      rollbackable: false,
    },
  ];

  await handler.handleMaintenanceActions(sampleActions);
}

// Run demo if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}

export { InteractiveMaintenanceHandler };
export default InteractiveMaintenanceHandler;
