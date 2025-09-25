#!/usr/bin/env tsx
/**
 * Workflow Completeness Auditor - 워크플로우 누락사항 분석 및 보강
 */

import { promises as fs } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface WorkflowGap {
  category:
    | "MISSING_STEP"
    | "INCOMPLETE_INTEGRATION"
    | "DESIGN_OVERSIGHT"
    | "EDGE_CASE";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  component: string;
  description: string;
  rootCause: string;
  currentState: string;
  expectedBehavior: string;
  solution: string;
  preventionStrategy: string;
}

interface WorkflowAuditReport {
  timestamp: string;
  overallCompleteness: number;
  gaps: WorkflowGap[];
  recommendations: string[];
  preventionMechanisms: string[];
}

class WorkflowCompletenessAuditor {
  private projectRoot: string;
  private gaps: WorkflowGap[] = [];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  async auditWorkflowCompleteness(): Promise<WorkflowAuditReport> {
    console.log("🔍 Auditing workflow completeness and identifying gaps...\n");

    await this.auditSyncWorkflow();
    await this.auditDocumentationWorkflow();
    await this.auditQualityGateWorkflow();
    await this.auditDeveloperHandoffWorkflow();
    await this.auditEdgeCases();

    const report = this.generateReport();
    await this.saveReport(report);

    return report;
  }

  private async auditSyncWorkflow(): Promise<void> {
    console.log("📋 Auditing /sync workflow...");

    // 1. /sync 명령어 단계별 분석
    const syncScript = await this.readFile("scripts/slash-commands.sh");

    // 문서 업데이트가 빠져있었던 이유 분석
    this.addGap({
      category: "DESIGN_OVERSIGHT",
      priority: "HIGH",
      component: "/sync workflow",
      description: "핵심 프로젝트 문서 업데이트가 초기 설계에서 누락됨",
      rootCause:
        "초기 /sync 설계 시 docs:sync만 고려하고 핵심 README, CHANGELOG 등은 고려하지 않음",
      currentState:
        "docs:sync는 시스템 문서만 업데이트, README/CHANGELOG는 수동 관리",
      expectedBehavior: "모든 프로젝트 핵심 문서가 /sync로 자동 업데이트",
      solution: "docs:update-core 단계 추가 (이미 해결됨)",
      preventionStrategy:
        '워크플로우 설계 시 "문서 완전성 체크리스트" 필수 검토',
    });

    // 2. 다른 누락 가능성 체크
    if (!syncScript.includes("pre-commit")) {
      this.addGap({
        category: "MISSING_STEP",
        priority: "MEDIUM",
        component: "/sync workflow",
        description: "Pre-commit hooks 설치 확인이 /sync에 포함되지 않음",
        rootCause: "개발 환경 설정과 동기화 워크플로우 분리",
        currentState: "Pre-commit hooks는 별도 설치 필요",
        expectedBehavior: "/sync 시 hooks 상태 확인 및 필요시 자동 설치",
        solution: "hooks:install 상태 체크 추가",
        preventionStrategy: "환경 설정 의존성을 워크플로우에 통합",
      });
    }

    if (!syncScript.includes("security")) {
      this.addGap({
        category: "MISSING_STEP",
        priority: "HIGH",
        component: "/sync workflow",
        description: "보안 검사가 /sync에 포함되지 않음",
        rootCause: "보안 검사를 별도 워크플로우로 분리하여 간과",
        currentState: "guard:git은 실행되지만 포괄적 보안 검사 부족",
        expectedBehavior: "/sync 시 보안 취약점 자동 검사",
        solution: "security:audit 단계 추가",
        preventionStrategy: "보안을 모든 워크플로우의 필수 단계로 포함",
      });
    }
  }

  private async auditDocumentationWorkflow(): Promise<void> {
    console.log("📚 Auditing documentation workflow...");

    // 문서 간 일관성 체크
    const coreDocuments = [
      "README.md",
      "CLAUDE.md",
      "LLM_DEVELOPMENT_CONTRACT.md",
      "CHANGELOG.md",
      "HANDOFF_NAVIGATION.md",
    ];

    for (const doc of coreDocuments) {
      try {
        const content = await this.readFile(doc);

        // 버전 정보 불일치 체크
        if (
          !content.includes("2025-09-25") &&
          !content.includes("2025. 9. 25.")
        ) {
          this.addGap({
            category: "INCOMPLETE_INTEGRATION",
            priority: "MEDIUM",
            component: `Documentation: ${doc}`,
            description: "최신 업데이트 날짜 불일치",
            rootCause: "문서별로 다른 업데이트 시점과 형식",
            currentState: "일부 문서가 구 버전 정보 보유",
            expectedBehavior: "모든 문서의 메타데이터 동기화",
            solution: "통일된 문서 메타데이터 관리 시스템",
            preventionStrategy: "문서 업데이트 시 메타데이터 자동 검증",
          });
        }

        // CLAUDE.md 특별 체크 (시스템의 핵심이므로)
        if (
          doc === "CLAUDE.md" &&
          !content.includes("fix") &&
          !content.includes("AI-powered")
        ) {
          this.addGap({
            category: "DESIGN_OVERSIGHT",
            priority: "CRITICAL",
            component: "CLAUDE.md",
            description: "CLAUDE.md에 최신 AI 기능들 반영되지 않음",
            rootCause:
              "CLAUDE.md는 프로젝트 헌법이지만 기능 추가시 업데이트 누락",
            currentState: "구 버전의 기능 설명만 포함",
            expectedBehavior:
              "새로운 AI 기능들(fix, health reporting)이 문서화됨",
            solution: "CLAUDE.md 자동 섹션 업데이트 시스템",
            preventionStrategy:
              "기능 추가시 CLAUDE.md 업데이트 필수 체크리스트",
          });
        }
      } catch (error) {
        this.addGap({
          category: "MISSING_STEP",
          priority: "HIGH",
          component: `Documentation: ${doc}`,
          description: "핵심 문서 누락 또는 접근 불가",
          rootCause: "문서 경로 변경 또는 삭제",
          currentState: "파일 접근 실패",
          expectedBehavior: "모든 핵심 문서 접근 가능",
          solution: "문서 존재성 검증 추가",
          preventionStrategy: "핵심 문서 목록 관리 및 정기 검증",
        });
      }
    }
  }

  private async auditQualityGateWorkflow(): Promise<void> {
    console.log("🛡️ Auditing quality gate workflow...");

    // Pre-commit hooks 상태 체크
    try {
      const hookExists = await this.fileExists(".git/hooks/pre-commit");
      if (!hookExists) {
        this.addGap({
          category: "MISSING_STEP",
          priority: "HIGH",
          component: "Quality Gates",
          description: "Pre-commit hook이 설치되지 않음",
          rootCause: "개발자별 환경 설정 차이",
          currentState: "품질 게이트 비활성",
          expectedBehavior: "모든 커밋에서 품질 검증 강제",
          solution: "/sync에 hooks 상태 확인 및 설치 추가",
          preventionStrategy: "환경 설정 자동화 및 검증",
        });
      }
    } catch (error) {
      // Hook 상태 체크 실패
    }

    // ESLint 설정 포괄성 체크
    try {
      const eslintConfig = await this.readFile(".eslintrc.typescript.js");
      if (!eslintConfig.includes("unused-vars")) {
        this.addGap({
          category: "INCOMPLETE_INTEGRATION",
          priority: "MEDIUM",
          component: "ESLint Configuration",
          description: "ESLint 규칙이 충분하지 않음",
          rootCause: "점진적 ESLint 규칙 추가로 인한 불완전성",
          currentState: "일부 코드 품질 이슈 미감지",
          expectedBehavior: "모든 코드 품질 이슈 자동 감지",
          solution: "ESLint 규칙 강화",
          preventionStrategy: "코드 품질 기준 정기 검토",
        });
      }
    } catch (error) {
      // ESLint 설정 체크 실패
    }
  }

  private async auditDeveloperHandoffWorkflow(): Promise<void> {
    console.log("🤝 Auditing developer handoff workflow...");

    // 환경 변수 템플릿 체크
    const envExample = await this.fileExists(".env.example");
    if (!envExample) {
      this.addGap({
        category: "DESIGN_OVERSIGHT",
        priority: "HIGH",
        component: "Developer Onboarding",
        description: "환경 변수 예시 파일 누락",
        rootCause: "개발 환경 설정 문서화 부족",
        currentState: "새 개발자가 환경 설정에 어려움",
        expectedBehavior: ".env.example로 쉬운 환경 설정",
        solution: ".env.example 파일 생성",
        preventionStrategy: "온보딩 체크리스트에 환경 설정 포함",
      });
    }

    // Docker 설정 체크 (선택사항이지만 있으면 좋음)
    const dockerfile = await this.fileExists("Dockerfile");
    const dockerCompose = await this.fileExists("docker-compose.yml");

    if (!dockerfile && !dockerCompose) {
      this.addGap({
        category: "MISSING_STEP",
        priority: "LOW",
        component: "Developer Environment",
        description: "Docker 컨테이너화 지원 없음",
        rootCause: "Node.js 프로젝트라 Docker 필요성 낮게 평가",
        currentState: "로컬 개발 환경에만 의존",
        expectedBehavior: "Docker로 일관된 개발 환경 제공",
        solution: "Dockerfile과 docker-compose.yml 추가",
        preventionStrategy: "프로젝트 시작시 컨테이너화 고려",
      });
    }
  }

  private async auditEdgeCases(): Promise<void> {
    console.log("🔍 Auditing edge cases and failure scenarios...");

    // /sync 실패 시 복구 메커니즘
    this.addGap({
      category: "EDGE_CASE",
      priority: "HIGH",
      component: "/sync failure recovery",
      description: "/sync 실패 시 부분 완료된 작업의 복구 메커니즘 부족",
      rootCause: "성공 시나리오만 고려하고 실패 시나리오 간과",
      currentState: "/sync 실패 시 수동 복구 필요",
      expectedBehavior: "부분 실패 시 자동 롤백 또는 재시도",
      solution: "/sync 트랜잭션 시스템 구현",
      preventionStrategy: "모든 자동화에 실패 시나리오 포함",
    });

    // 대용량 프로젝트에서의 성능
    this.addGap({
      category: "EDGE_CASE",
      priority: "MEDIUM",
      component: "Performance at scale",
      description: "프로젝트 규모 증가 시 /sync 성능 저하 가능성",
      rootCause: "현재 프로젝트 규모에만 최적화",
      currentState: "소규모 프로젝트에서는 빠르지만 확장성 미검증",
      expectedBehavior: "프로젝트 규모와 무관하게 일관된 성능",
      solution: "단계별 성능 모니터링 및 최적화",
      preventionStrategy: "확장성을 고려한 워크플로우 설계",
    });

    // 네트워크 연결 실패 시
    this.addGap({
      category: "EDGE_CASE",
      priority: "MEDIUM",
      component: "Network failure handling",
      description: "git push 실패 등 네트워크 문제 시 처리 부족",
      rootCause: "로컬 작업에만 집중, 외부 의존성 간과",
      currentState: "네트워크 실패 시 오류만 표시",
      expectedBehavior: "오프라인 모드 지원 또는 재시도 메커니즘",
      solution: "네트워크 실패 감지 및 적절한 대응",
      preventionStrategy: "외부 의존성 실패 시나리오 포함",
    });
  }

  private addGap(gap: WorkflowGap): void {
    this.gaps.push(gap);
  }

  private async readFile(filePath: string): Promise<string> {
    return fs.readFile(join(this.projectRoot, filePath), "utf-8");
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(join(this.projectRoot, filePath));
      return true;
    } catch {
      return false;
    }
  }

  private generateReport(): WorkflowAuditReport {
    const totalPossibleScore = 100;
    const criticalGaps = this.gaps.filter(
      (g) => g.priority === "CRITICAL",
    ).length;
    const highGaps = this.gaps.filter((g) => g.priority === "HIGH").length;
    const mediumGaps = this.gaps.filter((g) => g.priority === "MEDIUM").length;
    const lowGaps = this.gaps.filter((g) => g.priority === "LOW").length;

    // 점수 계산 (중요도에 따라 가중치 적용)
    const penaltyScore =
      criticalGaps * 20 + highGaps * 10 + mediumGaps * 5 + lowGaps * 2;
    const completeness = Math.max(totalPossibleScore - penaltyScore, 0);

    const recommendations = this.generateRecommendations();
    const preventionMechanisms = this.generatePreventionMechanisms();

    return {
      timestamp: new Date().toISOString(),
      overallCompleteness: completeness,
      gaps: this.gaps,
      recommendations,
      preventionMechanisms,
    };
  }

  private generateRecommendations(): string[] {
    const recs: string[] = [];

    const criticalGaps = this.gaps.filter((g) => g.priority === "CRITICAL");
    if (criticalGaps.length > 0) {
      recs.push(`🚨 ${criticalGaps.length}개 치명적 누락사항 즉시 해결 필요`);
    }

    const missingSteps = this.gaps.filter((g) => g.category === "MISSING_STEP");
    if (missingSteps.length > 0) {
      recs.push(`📋 ${missingSteps.length}개 누락된 단계를 워크플로우에 추가`);
    }

    const designOversights = this.gaps.filter(
      (g) => g.category === "DESIGN_OVERSIGHT",
    );
    if (designOversights.length > 0) {
      recs.push(`🔍 ${designOversights.length}개 설계 간과사항 재검토 필요`);
    }

    if (recs.length === 0) {
      recs.push("✅ 주요 워크플로우 누락사항이 발견되지 않았습니다");
    }

    return recs;
  }

  private generatePreventionMechanisms(): string[] {
    return [
      '📋 워크플로우 변경시 "완전성 체크리스트" 필수 검토',
      "🔄 정기적 워크플로우 감사 (월 1회)",
      "🧪 엣지 케이스 시나리오 테스트 포함",
      "📚 워크플로우 문서화 의무화",
      "🤝 새 기능 추가시 기존 워크플로우 영향도 분석",
      "🔍 자동화된 워크플로우 완전성 검증 시스템",
    ];
  }

  private async saveReport(report: WorkflowAuditReport): Promise<void> {
    const reportPath = join(
      this.projectRoot,
      "reports/workflow-completeness-audit.json",
    );
    await fs.mkdir(join(this.projectRoot, "reports"), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  }

  displayReport(report: WorkflowAuditReport): void {
    console.log("\n🔍 Workflow Completeness Audit Report");
    console.log("=====================================");
    console.log(`📊 Overall Completeness: ${report.overallCompleteness}%`);
    console.log(`🔍 Total gaps identified: ${report.gaps.length}`);

    // 우선순위별 요약
    const gapsByPriority = {
      CRITICAL: report.gaps.filter((g) => g.priority === "CRITICAL"),
      HIGH: report.gaps.filter((g) => g.priority === "HIGH"),
      MEDIUM: report.gaps.filter((g) => g.priority === "MEDIUM"),
      LOW: report.gaps.filter((g) => g.priority === "LOW"),
    };

    console.log(`\n📈 Gap Breakdown:`);
    console.log(`   🚨 Critical: ${gapsByPriority.CRITICAL.length}`);
    console.log(`   🔴 High: ${gapsByPriority.HIGH.length}`);
    console.log(`   🟡 Medium: ${gapsByPriority.MEDIUM.length}`);
    console.log(`   🟢 Low: ${gapsByPriority.LOW.length}`);

    // 중요한 갭들 표시
    if (gapsByPriority.CRITICAL.length > 0 || gapsByPriority.HIGH.length > 0) {
      console.log("\n🔥 Priority Actions Required:");
      [...gapsByPriority.CRITICAL, ...gapsByPriority.HIGH].forEach((gap, i) => {
        console.log(`   ${i + 1}. ${gap.component}: ${gap.description}`);
        console.log(`      💡 Solution: ${gap.solution}`);
      });
    }

    console.log("\n🎯 Recommendations:");
    report.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });

    console.log("\n🛡️ Prevention Mechanisms:");
    report.preventionMechanisms.forEach((prev, i) => {
      console.log(`   ${i + 1}. ${prev}`);
    });

    console.log(
      `\n📊 Detailed report: reports/workflow-completeness-audit.json`,
    );
  }
}

async function main(): Promise<void> {
  const auditor = new WorkflowCompletenessAuditor();
  const report = await auditor.auditWorkflowCompleteness();
  auditor.displayReport(report);
}

// ES module main check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
