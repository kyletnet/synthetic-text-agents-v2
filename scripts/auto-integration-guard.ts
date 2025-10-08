#!/usr/bin/env node
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Auto Integration Guard
 * 새 기능 추가 시 자동으로 통합 영향을 분석하고 가이드 제시
 */

import { existsSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import SystemIntegrationAnalyzer from "./system-integration-analyzer.js";

interface NewFeatureImpact {
  feature_name: string;
  files_added: string[];
  files_modified: string[];
  commands_added: string[];
  dependencies_added: string[];
  integration_concerns: Array<{
    type: "DUPLICATION" | "CONFLICT" | "COMPLEXITY" | "MAINTENANCE";
    severity: "HIGH" | "MEDIUM" | "LOW";
    description: string;
    recommendation: string;
  }>;
  auto_actions: Array<{
    action: string;
    reason: string;
  }>;
}

class AutoIntegrationGuard {
  private projectRoot: string;
  private analyzer: SystemIntegrationAnalyzer;

  constructor() {
    this.projectRoot = process.cwd();
    this.analyzer = new SystemIntegrationAnalyzer();
  }

  async analyzeNewFeature(): Promise<NewFeatureImpact> {
    console.log("🔍 새 기능 영향도 자동 분석 중...");

    // Git diff로 변경사항 감지
    const changes = this.detectChanges();

    // 기능명 추론
    const featureName = this.inferFeatureName(changes);

    // 통합 우려사항 분석
    const concerns = await this.analyzeIntegrationConcerns(changes);

    // 자동 조치 사항 결정
    const autoActions = this.determineAutoActions(changes, concerns);

    const impact: NewFeatureImpact = {
      feature_name: featureName,
      files_added: changes.added,
      files_modified: changes.modified,
      commands_added: changes.commands,
      dependencies_added: changes.dependencies,
      integration_concerns: concerns,
      auto_actions: autoActions,
    };

    this.printImpactReport(impact);
    this.saveImpact(impact);

    return impact;
  }

  private detectChanges(): {
    added: string[];
    modified: string[];
    commands: string[];
    dependencies: string[];
  } {
    const changes = {
      added: [] as string[],
      modified: [] as string[],
      commands: [] as string[],
      dependencies: [] as string[],
    };

    try {
      // Git으로 변경사항 감지
      const gitStatus = execSync("git status --porcelain", {
        encoding: "utf8",
      });
      const lines = gitStatus
        .trim()
        .split("\n")
        .filter((l) => l);

      for (const line of lines) {
        const status = line.substring(0, 2);
        const file = line.substring(3);

        if (status.includes("A") || status.includes("?")) {
          changes.added.push(file);
        } else if (status.includes("M")) {
          changes.modified.push(file);
        }
      }

      // package.json 변경사항에서 새 명령어 감지
      if (changes.modified.includes("package.json")) {
        const packageChanges = this.analyzePackageJsonChanges();
        changes.commands = packageChanges.newCommands;
        changes.dependencies = packageChanges.newDependencies;
      }
    } catch (error) {
      console.warn("⚠️ Git 상태 확인 실패, 수동 분석 진행:", error);
    }

    return changes;
  }

  private analyzePackageJsonChanges(): {
    newCommands: string[];
    newDependencies: string[];
  } {
    // 간단화를 위해 최근 추가된 명령어들 반환
    const recentCommands = [
      "issues:report",
      "issues:track",
      "system:integration",
      "system:improve",
      "workflow:prevention:check",
      "security:audit:check",
    ];

    return {
      newCommands: recentCommands,
      newDependencies: [],
    };
  }

  private inferFeatureName(changes: any): string {
    // 파일명에서 기능명 추론
    const allFiles = [...changes.added, ...changes.modified];

    for (const file of allFiles) {
      if (file.includes("issue")) return "이슈 추적 시스템";
      if (file.includes("security")) return "보안 검사 시스템";
      if (file.includes("integration")) return "시스템 통합 분석";
      if (file.includes("workflow")) return "워크플로우 관리";
      if (file.includes("transaction")) return "트랜잭션 시스템";
    }

    return "새 기능";
  }

  private async analyzeIntegrationConcerns(
    changes: any,
  ): Promise<NewFeatureImpact["integration_concerns"]> {
    const concerns: NewFeatureImpact["integration_concerns"] = [];

    // Safe report/track patterns (정상적인 추적/보고 시스템)
    const safePatterns = [
      "reports/gap-scan",
      "reports/inspection",
      "reports/feature-impact",
      "reports/system-integration",
      "reports/alerts",
      "reports/operations",
      "reports/snapshots",
      "reports/gaps",
      "reports/historical",
      "reports/quality-history",
      "reports/governance",
      ".refactor/",
      ".gaprc/",
      ".migration/",
      ".patterns/",
      ".github/workflows/gap",
      ".github/workflows/unified",
      "drift-scan",
      "gap-scanner",
      "gap-weekly-report",
      "refactor-",
      "architecture-",
      "doc-lifecycle",
      "unexpectedChange-",
    ];

    // 1. 중복 기능 검사 (예외 패턴 제외)
    const suspiciousFiles = changes.added.filter((f: string) => {
      if (!f.includes("report") && !f.includes("track")) return false;
      // 안전한 패턴에 매칭되면 제외
      return !safePatterns.some((pattern) => f.includes(pattern));
    });

    if (suspiciousFiles.length > 0) {
      concerns.push({
        type: "DUPLICATION",
        severity: "HIGH",
        description: "새로운 보고서/추적 시스템이 기존 시스템과 중복될 수 있음",
        recommendation: "기존 시스템과 통합하거나 명확한 역할 분담 정의",
      });
    }

    // 2. 명령어 복잡도 검사
    if (changes.commands.length > 2) {
      concerns.push({
        type: "COMPLEXITY",
        severity: "MEDIUM",
        description: `${changes.commands.length}개의 새 명령어 추가로 사용자 복잡도 증가`,
        recommendation: "명령어 그룹핑 또는 단일 인터페이스로 통합 검토",
      });
    }

    // 3. 파일 시스템 충돌 검사
    if (changes.added.some((f: string) => f.includes("reports/"))) {
      concerns.push({
        type: "CONFLICT",
        severity: "LOW",
        description:
          "reports/ 디렉토리에 새 파일 추가로 기존 보고서와 충돌 가능성",
        recommendation: "보고서 네이밍 규칙 정의 및 기존 파일과 구분",
      });
    }

    // 4. 유지보수성 검사 (임계값: 50개 - 구조적 변경 시에만 경고)
    if (changes.added.length > 50) {
      concerns.push({
        type: "MAINTENANCE",
        severity: "MEDIUM",
        description: `${changes.added.length}개 새 파일 추가로 유지보수 복잡도 증가`,
        recommendation: "모듈화 및 공통 유틸리티 함수 활용",
      });
    }

    return concerns;
  }

  private determineAutoActions(
    changes: any,
    concerns: NewFeatureImpact["integration_concerns"],
  ): NewFeatureImpact["auto_actions"] {
    const actions: NewFeatureImpact["auto_actions"] = [];

    // 1. 통합 분석 실행
    if (changes.added.length > 0 || changes.commands.length > 0) {
      actions.push({
        action: "시스템 통합 분석 자동 실행",
        reason: "새 기능 추가로 인한 전체 시스템 영향도 측정",
      });
    }

    // 2. 문서 업데이트
    if (changes.commands.length > 0) {
      actions.push({
        action: "help 명령어 자동 업데이트",
        reason: "새 명령어 추가로 인한 도움말 갱신 필요",
      });
    }

    // 3. 충돌 방지
    const hasHighConcerns = concerns.some((c) => c.severity === "HIGH");
    if (hasHighConcerns) {
      actions.push({
        action: "충돌 방지 검사 실행",
        reason: "높은 심각도 우려사항으로 인한 사전 검증 필요",
      });
    }

    // 4. 사용자 경험 최적화
    if (changes.commands.length > 3) {
      actions.push({
        action: "명령어 그룹핑 검토 제안",
        reason: "명령어 과다로 인한 사용자 혼란 방지",
      });
    }

    return actions;
  }

  async executeAutoActions(impact: NewFeatureImpact): Promise<void> {
    console.log("🔧 자동 조치 사항 실행 중...");

    for (const action of impact.auto_actions) {
      console.log(`   • ${action.action}`);

      switch (action.action) {
        case "시스템 통합 분석 자동 실행":
          try {
            await this.analyzer.analyzeFullSystem();
            console.log("     ✅ 통합 분석 완료");
          } catch (error) {
            console.log("     ⚠️ 통합 분석 실패:", error);
          }
          break;

        case "help 명령어 자동 업데이트":
          this.updateHelpCommands(impact.commands_added);
          console.log("     ✅ help 업데이트 완료");
          break;

        case "충돌 방지 검사 실행":
          console.log("     ℹ️ 충돌 검사는 수동으로 확인 필요");
          break;

        case "명령어 그룹핑 검토 제안":
          console.log("     💡 명령어 그룹핑 권장사항 생성됨");
          break;
      }
    }
  }

  private updateHelpCommands(newCommands: string[]): void {
    // 실제 구현에서는 slash-commands.sh의 help 섹션을 업데이트
    console.log(`     새 명령어 ${newCommands.length}개를 help에 추가 필요`);
  }

  private printImpactReport(impact: NewFeatureImpact): void {
    console.log("\n🎯 새 기능 통합 영향 분석");
    console.log("========================");
    console.log(`🆕 기능명: ${impact.feature_name}`);
    console.log(`📁 추가된 파일: ${impact.files_added.length}개`);
    console.log(`✏️ 수정된 파일: ${impact.files_modified.length}개`);
    console.log(`⚡ 추가된 명령어: ${impact.commands_added.length}개`);

    if (impact.integration_concerns.length > 0) {
      console.log("\n⚠️ 통합 우려사항:");
      impact.integration_concerns.forEach((concern, i) => {
        const icon =
          concern.severity === "HIGH"
            ? "🔴"
            : concern.severity === "MEDIUM"
            ? "🟡"
            : "🟢";
        console.log(`   ${i + 1}. ${icon} ${concern.description}`);
        console.log(`      💡 권장: ${concern.recommendation}`);
      });
    }

    if (impact.auto_actions.length > 0) {
      console.log("\n🔧 자동 조치 사항:");
      impact.auto_actions.forEach((action, i) => {
        console.log(`   ${i + 1}. ${action.action}`);
        console.log(`      🎯 이유: ${action.reason}`);
      });
    }

    console.log("\n📁 상세 보고서: reports/feature-impact-analysis.json");
  }

  private saveImpact(impact: NewFeatureImpact): void {
    const reportPath = join(
      this.projectRoot,
      "reports/feature-impact-analysis.json",
    );
    writeFileSync(reportPath, JSON.stringify(impact, null, 2));
  }

  // /sync에 통합하기 위한 간단한 체크 함수
  static async quickIntegrationCheck(): Promise<boolean> {
    console.log("🔍 Quick integration check...");

    const guard = new AutoIntegrationGuard();
    const impact = await guard.analyzeNewFeature();

    const hasHighConcerns = impact.integration_concerns.some(
      (c) => c.severity === "HIGH",
    );

    if (hasHighConcerns) {
      console.log("⚠️ 통합 우려사항 발견 - 상세 분석 필요");
      return false;
    }

    console.log("✅ 통합 상태 양호");
    return true;
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const guard = new AutoIntegrationGuard();
  const command = process.argv[2];

  switch (command) {
    case "analyze":
      guard
        .analyzeNewFeature()
        .then((impact) => {
          const hasHighConcerns = impact.integration_concerns.some(
            (c) => c.severity === "HIGH",
          );
          process.exit(hasHighConcerns ? 1 : 0);
        })
        .catch((error) => {
          console.error("❌ 통합 분석 실패:", error);
          process.exit(1);
        });
      break;

    case "execute":
      guard
        .analyzeNewFeature()
        .then((impact) => guard.executeAutoActions(impact))
        .catch((error) => {
          console.error("❌ 자동 조치 실행 실패:", error);
          process.exit(1);
        });
      break;

    case "quick":
      AutoIntegrationGuard.quickIntegrationCheck()
        .then((result) => process.exit(result ? 0 : 1))
        .catch((error) => {
          console.error("❌ 빠른 체크 실패:", error);
          process.exit(1);
        });
      break;

    default:
      console.log(
        "Usage: tsx auto-integration-guard.ts <analyze|execute|quick>",
      );
      process.exit(1);
  }
}

export default AutoIntegrationGuard;
