#!/usr/bin/env node

/**
 * System Integration Analyzer
 * 새로운 기능 추가 시 전체 시스템에 미칠 영향을 종합 분석
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
} from "fs";
import { join, extname } from "path";

interface SystemComponent {
  name: string;
  type: "SCRIPT" | "CONFIG" | "WORKFLOW" | "COMMAND" | "DOCUMENTATION";
  path: string;
  dependencies: string[];
  impacts: string[];
  purpose: string;
}

interface IntegrationAnalysis {
  component: string;
  analysis: {
    duplications: Array<{
      with: string;
      overlap: string;
      recommendation: string;
    }>;
    synergies: Array<{ with: string; opportunity: string; action: string }>;
    conflicts: Array<{ with: string; issue: string; resolution: string }>;
    missing_integrations: Array<{
      component: string;
      integration: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
    }>;
    user_experience_impact: {
      complexity_increase: number; // 1-10
      learning_curve: number; // 1-10
      efficiency_gain: number; // 1-10
      overall_score: number; // 1-10
    };
  };
}

interface SystemIntegrationReport {
  timestamp: string;
  components_analyzed: number;
  integration_score: number; // 0-100
  recommendations: {
    immediate: string[];
    planned: string[];
    architectural: string[];
  };
  analysis: IntegrationAnalysis[];
  system_health: {
    coherence: number; // 0-100
    redundancy: number; // 0-100 (lower is better)
    completeness: number; // 0-100
    maintainability: number; // 0-100
  };
}

class SystemIntegrationAnalyzer {
  private projectRoot: string;
  private components: SystemComponent[] = [];

  constructor() {
    this.projectRoot = process.cwd();
  }

  async analyzeFullSystem(): Promise<SystemIntegrationReport> {
    console.log("🔍 전체 시스템 통합 분석 시작...");

    // 1. 시스템 컴포넌트 발견 및 분류
    await this.discoverComponents();

    // 2. 각 컴포넌트별 통합 분석
    const analyses = await this.analyzeIntegrations();

    // 3. 전체 시스템 건강도 평가
    const systemHealth = this.evaluateSystemHealth();

    // 4. 통합 권장사항 생성
    const recommendations = this.generateRecommendations(analyses);

    const report: SystemIntegrationReport = {
      timestamp: new Date().toISOString(),
      components_analyzed: this.components.length,
      integration_score: this.calculateIntegrationScore(analyses),
      recommendations,
      analysis: analyses,
      system_health: systemHealth,
    };

    this.saveReport(report);
    this.printReport(report);

    return report;
  }

  private async discoverComponents(): Promise<void> {
    console.log("📋 시스템 컴포넌트 발견 중...");

    // Scripts 분석
    const scriptsDir = join(this.projectRoot, "scripts");
    if (existsSync(scriptsDir)) {
      const scriptFiles = readdirSync(scriptsDir)
        .filter((f) => [".ts", ".js", ".sh"].includes(extname(f)))
        .slice(0, 20); // 성능을 위해 20개로 제한

      for (const file of scriptFiles) {
        const filePath = join(scriptsDir, file);
        try {
          const content = readFileSync(filePath, "utf8");
          this.components.push({
            name: file,
            type: "SCRIPT",
            path: filePath,
            dependencies: this.extractDependencies(content),
            impacts: this.extractImpacts(content),
            purpose: this.extractPurpose(content),
          });
        } catch (error) {
          console.warn(`⚠️ Could not analyze ${file}:`, error);
        }
      }
    }

    // Package.json 스크립트 분석
    try {
      const packageJson = JSON.parse(
        readFileSync(join(this.projectRoot, "package.json"), "utf8"),
      );
      const scripts = packageJson.scripts || {};

      // 주요 워크플로우 명령어들만 분석
      const workflowCommands = Object.keys(scripts).filter(
        (key) =>
          key.includes("sync") ||
          key.includes("fix") ||
          key.includes("status") ||
          key.includes("issues") ||
          key.includes("workflow") ||
          key.includes("security"),
      );

      for (const cmd of workflowCommands) {
        this.components.push({
          name: cmd,
          type: "COMMAND",
          path: "package.json",
          dependencies: this.extractCommandDependencies(scripts[cmd]),
          impacts: [],
          purpose: this.inferCommandPurpose(cmd, scripts[cmd]),
        });
      }
    } catch (error) {
      console.warn("⚠️ Could not analyze package.json:", error);
    }

    console.log(`✅ ${this.components.length}개 컴포넌트 발견`);
  }

  private extractDependencies(content: string): string[] {
    const deps: string[] = [];

    // Import/require 분석
    const importMatches =
      content.match(
        /(?:import.*from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g,
      ) || [];
    importMatches.forEach((match) => {
      const dep = match.match(/['"]([^'"]+)['"]/)?.[1];
      if (dep && dep.startsWith("./")) {
        deps.push(dep);
      }
    });

    // npm run 호출 분석
    const npmRunMatches = content.match(/npm\s+run\s+([a-zA-Z0-9:_-]+)/g) || [];
    npmRunMatches.forEach((match) => {
      const cmd = match.replace("npm run ", "");
      deps.push(`npm:${cmd}`);
    });

    // 파일 경로 참조 분석
    const fileRefs =
      content.match(/['"`]([^'"`]*\.(json|md|ts|js|sh))['"`]/g) || [];
    fileRefs.forEach((ref) => {
      const file = ref.replace(/['"`]/g, "");
      if (file.includes("reports/") || file.includes("docs/")) {
        deps.push(file);
      }
    });

    return [...new Set(deps)];
  }

  private extractImpacts(content: string): string[] {
    const impacts: string[] = [];

    // 파일 쓰기 감지
    if (content.includes("writeFileSync") || content.includes("writeFile")) {
      impacts.push("FILE_MODIFICATION");
    }

    // 보고서 생성 감지
    if (content.includes("report") || content.includes("Report")) {
      impacts.push("REPORT_GENERATION");
    }

    // 시스템 상태 변경 감지
    if (content.includes("git") || content.includes("commit")) {
      impacts.push("VERSION_CONTROL");
    }

    // 설정 변경 감지
    if (content.includes("config") || content.includes("Config")) {
      impacts.push("CONFIGURATION");
    }

    return impacts;
  }

  private extractPurpose(content: string): string {
    // 파일 상단의 주석에서 목적 추출
    const comment = content.match(/\/\*\*([\s\S]*?)\*\//)?.[1];
    if (comment) {
      const lines = comment
        .split("\n")
        .map((l) => l.replace(/^\s*\*\s?/, "").trim())
        .filter((l) => l);
      if (lines.length > 0) {
        return lines[0];
      }
    }

    // 클래스명이나 함수명에서 유추
    const classMatch = content.match(/class\s+(\w+)/);
    if (classMatch) {
      return `${classMatch[1]} 클래스 기반 기능`;
    }

    return "목적 미확인";
  }

  private extractCommandDependencies(command: string): string[] {
    const deps: string[] = [];

    // tsx/node 실행 파일 추출
    const scriptMatch = command.match(/tsx\s+([^\s]+)/);
    if (scriptMatch) {
      deps.push(scriptMatch[1]);
    }

    return deps;
  }

  private inferCommandPurpose(name: string, command: string): string {
    if (name.includes("sync")) return "시스템 동기화";
    if (name.includes("fix")) return "자동 수정";
    if (name.includes("status")) return "상태 확인";
    if (name.includes("issues")) return "이슈 추적";
    if (name.includes("workflow")) return "워크플로우 관리";
    if (name.includes("security")) return "보안 검사";
    return `${name} 기능`;
  }

  private async analyzeIntegrations(): Promise<IntegrationAnalysis[]> {
    console.log("🔗 통합 분석 수행 중...");

    const analyses: IntegrationAnalysis[] = [];

    for (const component of this.components.slice(0, 10)) {
      // 성능을 위해 10개로 제한
      const analysis = await this.analyzeComponentIntegration(component);
      analyses.push({
        component: component.name,
        analysis,
      });
    }

    return analyses;
  }

  private async analyzeComponentIntegration(
    component: SystemComponent,
  ): Promise<IntegrationAnalysis["analysis"]> {
    const duplications = this.findDuplications(component);
    const synergies = this.findSynergies(component);
    const conflicts = this.findConflicts(component);
    const missing_integrations = this.findMissingIntegrations(component);
    const user_experience_impact = this.assessUXImpact(component);

    return {
      duplications,
      synergies,
      conflicts,
      missing_integrations,
      user_experience_impact,
    };
  }

  private findDuplications(
    component: SystemComponent,
  ): Array<{ with: string; overlap: string; recommendation: string }> {
    const duplications = [];

    // 보고서 생성 중복 검사
    if (
      component.purpose.includes("보고") ||
      component.name.includes("report")
    ) {
      const otherReporters = this.components.filter(
        (c) =>
          c.name !== component.name &&
          (c.purpose.includes("보고") || c.name.includes("report")),
      );

      for (const other of otherReporters) {
        duplications.push({
          with: other.name,
          overlap: "보고서 생성 기능",
          recommendation: "통합된 보고 시스템으로 통합 검토",
        });
      }
    }

    // 이슈 추적 중복 검사
    if (component.name.includes("issue") || component.name.includes("health")) {
      const otherTrackers = this.components.filter(
        (c) =>
          c.name !== component.name &&
          (c.name.includes("issue") ||
            c.name.includes("health") ||
            c.name.includes("audit")),
      );

      for (const other of otherTrackers.slice(0, 2)) {
        duplications.push({
          with: other.name,
          overlap: "문제 추적 및 분석 기능",
          recommendation: "단일 통합 분석 시스템 구축 검토",
        });
      }
    }

    return duplications;
  }

  private findSynergies(
    component: SystemComponent,
  ): Array<{ with: string; opportunity: string; action: string }> {
    const synergies = [];

    // 이슈 추적과 워크플로우 방지 시너지
    if (component.name.includes("issue")) {
      const workflowComponents = this.components.filter(
        (c) => c.name.includes("workflow") || c.name.includes("prevention"),
      );
      for (const wf of workflowComponents) {
        synergies.push({
          with: wf.name,
          opportunity: "이슈 패턴을 워크플로우 방지 규칙으로 자동 전환",
          action: "이슈 추적 데이터를 워크플로우 방지 시스템에 피드백",
        });
      }
    }

    // 보안 검사와 전체 시스템 통합
    if (component.name.includes("security")) {
      const syncComponents = this.components.filter(
        (c) => c.name.includes("sync") || c.name === "slash-commands.sh",
      );
      for (const sync of syncComponents) {
        synergies.push({
          with: sync.name,
          opportunity: "보안 이슈를 실시간으로 sync 워크플로우에 반영",
          action: "보안 검사 결과를 sync 결정에 활용",
        });
      }
    }

    return synergies;
  }

  private findConflicts(
    component: SystemComponent,
  ): Array<{ with: string; issue: string; resolution: string }> {
    const conflicts = [];

    // 트랜잭션 시스템과 git 워크플로우 충돌 가능성
    if (component.name.includes("transaction")) {
      const gitComponents = this.components.filter((c) =>
        c.impacts.includes("VERSION_CONTROL"),
      );
      for (const git of gitComponents) {
        conflicts.push({
          with: git.name,
          issue: "Git 상태와 트랜잭션 백업 간 불일치 가능성",
          resolution: "트랜잭션 시작 전 git 상태 검증 추가",
        });
      }
    }

    // 다중 보고서 시스템 간 리소스 충돌
    if (component.impacts.includes("REPORT_GENERATION")) {
      const otherReporters = this.components.filter(
        (c) =>
          c.name !== component.name && c.impacts.includes("REPORT_GENERATION"),
      );

      if (otherReporters.length > 2) {
        conflicts.push({
          with: otherReporters.map((c) => c.name).join(", "),
          issue: "다중 보고서 생성으로 인한 성능 저하",
          resolution: "보고서 생성 스케줄링 또는 통합",
        });
      }
    }

    return conflicts;
  }

  private findMissingIntegrations(component: SystemComponent): Array<{
    component: string;
    integration: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  }> {
    const missing = [];

    // 이슈 추적 시스템이 AI 수정과 통합되지 않음
    if (component.name.includes("issue")) {
      const hasAIFix = this.components.some(
        (c) => c.name.includes("fix") || c.name.includes("ai"),
      );
      if (hasAIFix) {
        missing.push({
          component: "AI 자동 수정 시스템",
          integration: "AI 수정 결과를 이슈 해결 상태에 자동 반영",
          priority: "HIGH" as const,
        });
      }
    }

    // 보안 검사가 이슈 추적에 통합되지 않음
    if (component.name.includes("security")) {
      const hasIssueTracker = this.components.some((c) =>
        c.name.includes("issue"),
      );
      if (hasIssueTracker) {
        missing.push({
          component: "이슈 추적 시스템",
          integration: "보안 이슈를 자동으로 이슈 추적에 등록",
          priority: "MEDIUM" as const,
        });
      }
    }

    return missing;
  }

  private assessUXImpact(
    component: SystemComponent,
  ): IntegrationAnalysis["analysis"]["user_experience_impact"] {
    // 명령어 복잡도 평가
    const isCommand = component.type === "COMMAND";
    const hasColons = component.name.includes(":");
    const complexity_increase = isCommand ? (hasColons ? 3 : 2) : 1;

    // 학습 곡선 평가
    const isNewConcept =
      component.name.includes("transaction") ||
      component.name.includes("prevention");
    const learning_curve = isNewConcept ? 6 : 3;

    // 효율성 향상 평가
    const isAutomated =
      component.purpose.includes("자동") || component.name.includes("auto");
    const efficiency_gain = isAutomated ? 8 : 5;

    const overall_score = Math.round(
      (10 - complexity_increase + 10 - learning_curve + efficiency_gain) / 3,
    );

    return {
      complexity_increase,
      learning_curve,
      efficiency_gain,
      overall_score,
    };
  }

  private evaluateSystemHealth(): SystemIntegrationReport["system_health"] {
    // 시스템 일관성 평가
    const reporterCount = this.components.filter((c) =>
      c.impacts.includes("REPORT_GENERATION"),
    ).length;
    const coherence = Math.max(0, 100 - reporterCount * 10); // 보고서 생성기가 많을수록 일관성 저하

    // 중복도 평가
    const duplicateCommands = this.components.filter(
      (c) => c.type === "COMMAND" && c.name.includes(":"),
    ).length;
    const redundancy = Math.min(100, duplicateCommands * 5);

    // 완전성 평가
    const hasCore = ["sync", "status", "fix", "security"].every((core) =>
      this.components.some((c) => c.name.includes(core)),
    );
    const completeness = hasCore ? 85 : 60;

    // 유지보수성 평가
    const avgDependencies =
      this.components.reduce((sum, c) => sum + c.dependencies.length, 0) /
      this.components.length;
    const maintainability = Math.max(0, 100 - avgDependencies * 10);

    return {
      coherence,
      redundancy,
      completeness,
      maintainability,
    };
  }

  private generateRecommendations(
    analyses: IntegrationAnalysis[],
  ): SystemIntegrationReport["recommendations"] {
    const immediate: string[] = [];
    const planned: string[] = [];
    const architectural: string[] = [];

    // 즉시 조치 사항
    const criticalConflicts = analyses
      .flatMap((a) => a.analysis.conflicts)
      .filter((c) => c.issue.includes("충돌"));
    if (criticalConflicts.length > 0) {
      immediate.push("트랜잭션 시스템과 Git 워크플로우 충돌 해결");
    }

    const highPriorityMissing = analyses
      .flatMap((a) => a.analysis.missing_integrations)
      .filter((m) => m.priority === "HIGH");
    if (highPriorityMissing.length > 0) {
      immediate.push("AI 수정과 이슈 추적 간 자동 연동 구현");
    }

    // 계획된 개선사항
    const duplications = analyses.flatMap((a) => a.analysis.duplications);
    if (duplications.length > 2) {
      planned.push("중복 보고서 시스템 통합 계획 수립");
    }

    const synergies = analyses.flatMap((a) => a.analysis.synergies);
    if (synergies.length > 0) {
      planned.push("시스템 간 시너지 효과 활용 방안 구현");
    }

    // 아키텍처 개선사항
    if (this.components.filter((c) => c.type === "COMMAND").length > 20) {
      architectural.push("명령어 계층화 및 그룹핑 체계 재설계");
    }

    architectural.push("통합 설정 관리 시스템 도입 검토");
    architectural.push("플러그인 아키텍처로 확장성 개선");

    return {
      immediate,
      planned,
      architectural,
    };
  }

  private calculateIntegrationScore(analyses: IntegrationAnalysis[]): number {
    const totalComponents = analyses.length;
    if (totalComponents === 0) return 0;

    const avgUXScore =
      analyses.reduce(
        (sum, a) => sum + a.analysis.user_experience_impact.overall_score,
        0,
      ) / totalComponents;
    const conflictPenalty = analyses.reduce(
      (sum, a) => sum + a.analysis.conflicts.length * 10,
      0,
    );
    const synergyBonus = analyses.reduce(
      (sum, a) => sum + a.analysis.synergies.length * 5,
      0,
    );

    return Math.max(
      0,
      Math.min(100, avgUXScore * 10 - conflictPenalty + synergyBonus),
    );
  }

  private saveReport(report: SystemIntegrationReport): void {
    const reportPath = join(
      this.projectRoot,
      "reports/system-integration-analysis.json",
    );
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }

  private printReport(report: SystemIntegrationReport): void {
    console.log("\n🔗 시스템 통합 분석 보고서");
    console.log("===========================");
    console.log(`📊 통합 점수: ${report.integration_score}/100`);
    console.log(`🧩 분석 컴포넌트: ${report.components_analyzed}개`);

    console.log("\n🏥 시스템 건강도:");
    console.log(`   일관성: ${report.system_health.coherence}/100`);
    console.log(
      `   중복도: ${report.system_health.redundancy}/100 (낮을수록 좋음)`,
    );
    console.log(`   완전성: ${report.system_health.completeness}/100`);
    console.log(`   유지보수성: ${report.system_health.maintainability}/100`);

    if (report.recommendations.immediate.length > 0) {
      console.log("\n🚨 즉시 조치 사항:");
      report.recommendations.immediate.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    if (report.recommendations.planned.length > 0) {
      console.log("\n📋 계획된 개선사항:");
      report.recommendations.planned.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    if (report.recommendations.architectural.length > 0) {
      console.log("\n🏗️ 아키텍처 개선사항:");
      report.recommendations.architectural.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    // 주요 발견사항
    console.log("\n🔍 주요 발견사항:");
    const totalDuplications = report.analysis.reduce(
      (sum, a) => sum + a.analysis.duplications.length,
      0,
    );
    const totalSynergies = report.analysis.reduce(
      (sum, a) => sum + a.analysis.synergies.length,
      0,
    );
    const totalConflicts = report.analysis.reduce(
      (sum, a) => sum + a.analysis.conflicts.length,
      0,
    );

    console.log(`   중복 기능: ${totalDuplications}개`);
    console.log(`   시너지 기회: ${totalSynergies}개`);
    console.log(`   잠재적 충돌: ${totalConflicts}개`);

    console.log(`\n📁 상세 보고서: reports/system-integration-analysis.json`);
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new SystemIntegrationAnalyzer();

  analyzer.analyzeFullSystem().catch((error) => {
    console.error("❌ 시스템 통합 분석 실패:", error);
    process.exit(1);
  });
}

export default SystemIntegrationAnalyzer;
