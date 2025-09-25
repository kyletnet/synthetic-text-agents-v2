#!/usr/bin/env tsx
/**
 * Sync Health Reporter - 임시 해결책과 근본적 문제를 추적하고 보고
 */

import { promises as fs } from "fs";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface HealthIssue {
  type: "TEMPORARY_FIX" | "ROOT_CAUSE" | "TECHNICAL_DEBT" | "WARNING";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  component: string;
  description: string;
  temporaryFix?: string;
  rootCauseFix?: string;
  impact: string;
  handoffRequired: boolean;
}

interface SyncHealthReport {
  timestamp: string;
  overallHealth: "EXCELLENT" | "GOOD" | "NEEDS_ATTENTION" | "CRITICAL";
  issues: HealthIssue[];
  temporaryFixes: number;
  rootCauseIssues: number;
  handoffItems: number;
  recommendations: string[];
}

class SyncHealthReporter {
  private projectRoot: string;
  private issues: HealthIssue[] = [];

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  async generateHealthReport(): Promise<SyncHealthReport> {
    console.log("🔍 Analyzing system health and temporary fixes...\n");

    await this.scanForTemporaryFixes();
    await this.scanForWarnings();

    const report = this.compileReport();
    await this.updateHandoffDocuments(report);

    return report;
  }

  private async scanForTemporaryFixes(): Promise<void> {
    // 1. Plugin Loader 임시 수정 확인
    const pluginLoaderPath = join(
      this.projectRoot,
      "src/shared/pluginLoader.ts",
    );
    try {
      const content = await fs.readFile(pluginLoaderPath, "utf-8");

      // 완전 재구현된 경우 체크
      if (content.includes("완전한 재구현")) {
        this.addIssue({
          type: "ROOT_CAUSE",
          severity: "LOW",
          component: "src/shared/pluginLoader.ts",
          description: "Plugin system 완전 재구현됨",
          impact: "기능적 완전성 확보, 하지만 실제 플러그인 파일 부재",
          handoffRequired: false,
        });
      }
    } catch (error) {
      // 파일 없음
    }

    // 2. 주석 처리된 코드 스캔
    await this.scanForCommentedCode();

    // 3. TODO/FIXME/HACK 주석 스캔
    await this.scanForTodoComments();
  }

  private async scanForCommentedCode(): Promise<void> {
    try {
      const { stdout } = await execAsync(
        'find src scripts -name "*.ts" -exec grep -l "TEMPORARILY DISABLED\\|TODO.*FIX\\|HACK" {} \\;',
      );
      const files = stdout
        .trim()
        .split("\n")
        .filter((f) => f);

      for (const file of files) {
        try {
          const content = await fs.readFile(file, "utf-8");
          const lines = content.split("\n");

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            if (
              line.includes("temporarily disabled") ||
              line.includes("temporary stub") ||
              line.includes("TODO.*FIX".toLowerCase())
            ) {
              this.addIssue({
                type: "TEMPORARY_FIX",
                severity: "MEDIUM",
                component: file,
                description: `Line ${i + 1}: ${lines[i].trim()}`,
                temporaryFix: "주석 처리 또는 임시 구현",
                rootCauseFix: "완전한 기능 구현 필요",
                impact: "기능 제한적, 향후 개발 필요",
                handoffRequired: true,
              });
            }
          }
        } catch (error) {
          // 파일 읽기 실패
        }
      }
    } catch (error) {
      // grep 실패는 무시
    }
  }

  private async scanForTodoComments(): Promise<void> {
    try {
      const { stdout } = await execAsync(
        'find src scripts -name "*.ts" -exec grep -n "TODO\\|FIXME\\|HACK\\|XXX" {} + | head -20',
      );
      const matches = stdout
        .trim()
        .split("\n")
        .filter((m) => m);

      for (const match of matches) {
        const [file, lineNum, ...rest] = match.split(":");
        const comment = rest.join(":").trim();

        if (comment.includes("TODO") || comment.includes("FIXME")) {
          this.addIssue({
            type: "TECHNICAL_DEBT",
            severity: comment.includes("CRITICAL") ? "HIGH" : "LOW",
            component: file,
            description: `Line ${lineNum}: ${comment}`,
            impact: "Code quality and maintainability",
            handoffRequired: comment.includes("FIXME"),
          });
        }
      }
    } catch (error) {
      // grep 실패는 무시
    }
  }

  private async scanForWarnings(): Promise<void> {
    // TypeScript warnings
    try {
      const { stderr } = await execAsync("npm run typecheck 2>&1 || true");
      if (stderr && stderr.includes("warning")) {
        this.addIssue({
          type: "WARNING",
          severity: "LOW",
          component: "TypeScript",
          description: "TypeScript warnings present",
          impact: "Code quality warnings exist",
          handoffRequired: false,
        });
      }
    } catch (error) {
      // TypeScript check 실패
    }

    // ESLint warnings
    try {
      const { stdout } = await execAsync("npm run lint 2>&1 || true");
      if (stdout && stdout.includes("warning")) {
        const warningCount = (stdout.match(/warning/g) || []).length;
        this.addIssue({
          type: "WARNING",
          severity: warningCount > 10 ? "MEDIUM" : "LOW",
          component: "ESLint",
          description: `${warningCount} ESLint warnings`,
          impact: "Code style and potential issues",
          handoffRequired: warningCount > 20,
        });
      }
    } catch (error) {
      // ESLint 실패
    }
  }

  private addIssue(issue: HealthIssue): void {
    this.issues.push(issue);
  }

  private compileReport(): SyncHealthReport {
    const temporaryFixes = this.issues.filter(
      (i) => i.type === "TEMPORARY_FIX",
    ).length;
    const rootCauseIssues = this.issues.filter(
      (i) => i.type === "ROOT_CAUSE",
    ).length;
    const handoffItems = this.issues.filter((i) => i.handoffRequired).length;

    const criticalIssues = this.issues.filter(
      (i) => i.severity === "CRITICAL",
    ).length;
    const highIssues = this.issues.filter((i) => i.severity === "HIGH").length;

    let overallHealth: SyncHealthReport["overallHealth"] = "EXCELLENT";
    if (criticalIssues > 0) overallHealth = "CRITICAL";
    else if (highIssues > 2) overallHealth = "NEEDS_ATTENTION";
    else if (temporaryFixes > 5 || handoffItems > 3) overallHealth = "GOOD";

    const recommendations = this.generateRecommendations();

    return {
      timestamp: new Date().toISOString(),
      overallHealth,
      issues: this.issues,
      temporaryFixes,
      rootCauseIssues,
      handoffItems,
      recommendations,
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    const temporaryFixes = this.issues.filter(
      (i) => i.type === "TEMPORARY_FIX",
    );
    if (temporaryFixes.length > 0) {
      recommendations.push(
        `🔧 ${temporaryFixes.length}개 임시 수정사항 검토 필요`,
      );
    }

    const handoffItems = this.issues.filter((i) => i.handoffRequired);
    if (handoffItems.length > 0) {
      recommendations.push(
        `📋 ${handoffItems.length}개 항목 개발자 인수인계 필요`,
      );
    }

    const criticalIssues = this.issues.filter((i) => i.severity === "CRITICAL");
    if (criticalIssues.length > 0) {
      recommendations.push(
        `🚨 ${criticalIssues.length}개 치명적 문제 즉시 해결 필요`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ 모든 시스템이 안정적으로 작동 중입니다");
    }

    return recommendations;
  }

  private async updateHandoffDocuments(
    report: SyncHealthReport,
  ): Promise<void> {
    // 1. 기존 HANDOFF_TECH_FIXES.md 업데이트
    const handoffPath = join(this.projectRoot, "HANDOFF_TECH_FIXES.md");

    let handoffContent = "";
    try {
      handoffContent = await fs.readFile(handoffPath, "utf-8");
    } catch (error) {
      // 파일 없으면 새로 생성
    }

    // 건강 상태 섹션 추가
    const healthSection = this.generateHealthSection(report);

    if (handoffContent.includes("## 🏥 **시스템 건강 상태**")) {
      // 기존 섹션 교체
      handoffContent = handoffContent.replace(
        /## 🏥 \*\*시스템 건강 상태\*\*[\s\S]*?(?=##|$)/,
        healthSection,
      );
    } else {
      // 새 섹션 추가
      handoffContent += "\n\n" + healthSection;
    }

    await fs.writeFile(handoffPath, handoffContent);

    // 2. 실시간 건강 상태 리포트 생성
    const reportPath = join(
      this.projectRoot,
      "reports/sync-health-report.json",
    );
    await fs.mkdir(join(this.projectRoot, "reports"), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  }

  private generateHealthSection(report: SyncHealthReport): string {
    let section = `## 🏥 **시스템 건강 상태**

_마지막 업데이트: ${new Date().toLocaleString("ko-KR")}_

### 📊 **전체 상태: ${report.overallHealth}**

- 📋 전체 이슈: ${report.issues.length}개
- ⚠️ 임시 수정사항: ${report.temporaryFixes}개
- 🔍 근본 원인 분석 필요: ${report.rootCauseIssues}개
- 📤 개발자 인수인계 필요: ${report.handoffItems}개

### 🎯 **추천 액션**

`;

    report.recommendations.forEach((rec) => {
      section += `- ${rec}\n`;
    });

    if (report.issues.length > 0) {
      section += `\n### 📝 **상세 이슈 목록**\n\n`;

      const groupedIssues = {
        TEMPORARY_FIX: report.issues.filter((i) => i.type === "TEMPORARY_FIX"),
        ROOT_CAUSE: report.issues.filter((i) => i.type === "ROOT_CAUSE"),
        TECHNICAL_DEBT: report.issues.filter(
          (i) => i.type === "TECHNICAL_DEBT",
        ),
        WARNING: report.issues.filter((i) => i.type === "WARNING"),
      };

      Object.entries(groupedIssues).forEach(([type, issues]) => {
        if (issues.length > 0) {
          const emoji = {
            TEMPORARY_FIX: "⚠️",
            ROOT_CAUSE: "🔍",
            TECHNICAL_DEBT: "💳",
            WARNING: "⚡",
          };

          section += `#### ${emoji[type as keyof typeof emoji]} **${type.replace("_", " ")} (${issues.length}개)**\n\n`;

          issues.forEach((issue, index) => {
            section += `${index + 1}. **${issue.component}** (${issue.severity})\n`;
            section += `   - 문제: ${issue.description}\n`;
            if (issue.temporaryFix) {
              section += `   - 임시 해결: ${issue.temporaryFix}\n`;
            }
            if (issue.rootCauseFix) {
              section += `   - 근본 해결: ${issue.rootCauseFix}\n`;
            }
            section += `   - 영향: ${issue.impact}\n`;
            section += `   - 인수인계: ${issue.handoffRequired ? "✅ 필요" : "❌ 불필요"}\n\n`;
          });
        }
      });
    }

    return section;
  }

  displayReport(report: SyncHealthReport): void {
    const healthEmoji = {
      EXCELLENT: "🟢",
      GOOD: "🟡",
      NEEDS_ATTENTION: "🟠",
      CRITICAL: "🔴",
    };

    console.log(
      `\n${healthEmoji[report.overallHealth]} 시스템 건강 상태: ${report.overallHealth}`,
    );
    console.log("========================================");

    if (report.temporaryFixes > 0) {
      console.log(`⚠️  임시 수정사항: ${report.temporaryFixes}개`);
    }

    if (report.handoffItems > 0) {
      console.log(`📤 개발자 인수인계 필요: ${report.handoffItems}개`);
    }

    if (report.issues.length === 0) {
      console.log("✅ 임시 해결책이나 심각한 문제가 발견되지 않았습니다.");
    }

    console.log("\n🎯 추천 액션:");
    report.recommendations.forEach((rec) => {
      console.log(`   ${rec}`);
    });

    console.log(`\n📊 상세 리포트: reports/sync-health-report.json`);
    console.log(`📋 인수인계 문서: HANDOFF_TECH_FIXES.md`);
  }
}

async function main(): Promise<void> {
  const reporter = new SyncHealthReporter();
  const report = await reporter.generateHealthReport();
  reporter.displayReport(report);
}

// ES module main check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
