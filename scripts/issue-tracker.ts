#!/usr/bin/env node
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Issue Tracker System
 * 임시 처리된 문제들을 추적하고 보고
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface TrackedIssue {
  id: string;
  timestamp: string;
  category:
    | "PERFORMANCE"
    | "ERROR"
    | "WARNING"
    | "WORKAROUND"
    | "DEPENDENCY"
    | "CONFIG";
  severity: "P0" | "P1" | "P2" | "P3";
  title: string;
  description: string;
  temporarySolution: string;
  properSolution: string;
  impact: string;
  occurrence: number;
  firstSeen: string;
  lastSeen: string;
  context: {
    command?: string;
    file?: string;
    stackTrace?: string;
    environment?: string;
  };
  status: "ACTIVE" | "RESOLVED" | "IGNORED" | "MONITORING";
}

interface IssueReport {
  timestamp: string;
  totalIssues: number;
  newIssues: number;
  activeIssues: number;
  highPriorityIssues: number;
  issues: TrackedIssue[];
  summary: {
    categories: Record<string, number>;
    severities: Record<string, number>;
    trends: string[];
  };
}

class IssueTracker {
  private projectRoot: string;
  private issuesFile: string;
  private issues: TrackedIssue[] = [];

  constructor() {
    this.projectRoot = process.cwd();
    this.issuesFile = join(this.projectRoot, "reports/tracked-issues.json");
    this.loadIssues();
  }

  private loadIssues(): void {
    if (existsSync(this.issuesFile)) {
      try {
        const content = readFileSync(this.issuesFile, "utf8");
        this.issues = JSON.parse(content);
      } catch (error) {
        console.warn("⚠️ Could not load existing issues:", error);
        this.issues = [];
      }
    }
  }

  private saveIssues(): void {
    const reportsDir = join(this.projectRoot, "reports");
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }
    writeFileSync(this.issuesFile, JSON.stringify(this.issues, null, 2));
  }

  trackIssue(
    issue: Omit<
      TrackedIssue,
      "id" | "timestamp" | "occurrence" | "firstSeen" | "lastSeen"
    >,
  ): void {
    const issueId = this.generateIssueId(issue.title);
    const now = new Date().toISOString();

    const existingIssue = this.issues.find((i) => i.id === issueId);

    if (existingIssue) {
      // Update existing issue
      existingIssue.occurrence += 1;
      existingIssue.lastSeen = now;
      existingIssue.description = issue.description; // Update with latest info
      existingIssue.temporarySolution = issue.temporarySolution;
    } else {
      // Create new issue
      const newIssue: TrackedIssue = {
        ...issue,
        id: issueId,
        timestamp: now,
        occurrence: 1,
        firstSeen: now,
        lastSeen: now,
      };
      this.issues.push(newIssue);
    }

    this.saveIssues();
  }

  private generateIssueId(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .substring(0, 30);
  }

  generateReport(): IssueReport {
    const now = new Date().toISOString();
    const oneWeekAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const activeIssues = this.issues.filter((i) => i.status === "ACTIVE");
    const newIssues = this.issues.filter((i) => i.firstSeen > oneWeekAgo);
    const highPriorityIssues = this.issues.filter(
      (i) => ["P0", "P1"].includes(i.severity) && i.status === "ACTIVE",
    );

    // Category and severity counts
    const categories: Record<string, number> = {};
    const severities: Record<string, number> = {};

    activeIssues.forEach((issue) => {
      categories[issue.category] = (categories[issue.category] || 0) + 1;
      severities[issue.severity] = (severities[issue.severity] || 0) + 1;
    });

    // Generate trends
    const trends = this.generateTrends(activeIssues);

    const report: IssueReport = {
      timestamp: now,
      totalIssues: this.issues.length,
      newIssues: newIssues.length,
      activeIssues: activeIssues.length,
      highPriorityIssues: highPriorityIssues.length,
      issues: activeIssues.sort((a, b) => {
        // Sort by severity then occurrence
        const severityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
        const severityDiff =
          severityOrder[a.severity] - severityOrder[b.severity];
        return severityDiff !== 0 ? severityDiff : b.occurrence - a.occurrence;
      }),
      summary: {
        categories,
        severities,
        trends,
      },
    };

    return report;
  }

  private generateTrends(activeIssues: TrackedIssue[]): string[] {
    const trends: string[] = [];

    // Frequent issues
    const frequentIssues = activeIssues.filter((i) => i.occurrence >= 3);
    if (frequentIssues.length > 0) {
      trends.push(`${frequentIssues.length}개 이슈가 반복 발생 중 (3회+)`);
    }

    // Performance issues
    const perfIssues = activeIssues.filter((i) => i.category === "PERFORMANCE");
    if (perfIssues.length > 0) {
      trends.push(`성능 관련 이슈 ${perfIssues.length}개 추적 중`);
    }

    // High priority accumulation
    const p1Issues = activeIssues.filter((i) => i.severity === "P1");
    if (p1Issues.length >= 3) {
      trends.push(`P1 이슈가 ${p1Issues.length}개로 누적됨 - 검토 필요`);
    }

    return trends;
  }

  printReport(): void {
    const report = this.generateReport();

    console.log("\n🔍 임시 처리 이슈 추적 보고서");
    console.log("==============================");
    console.log(
      `📊 총 이슈: ${report.totalIssues} | 활성: ${report.activeIssues} | 신규: ${report.newIssues} | 우선순위 높음: ${report.highPriorityIssues}`,
    );

    if (report.summary.trends.length > 0) {
      console.log("\n📈 트렌드:");
      report.summary.trends.forEach((trend) => {
        console.log(`   • ${trend}`);
      });
    }

    if (report.issues.length > 0) {
      console.log("\n⚠️ 활성 이슈들:");
      report.issues.forEach((issue, i) => {
        const icon = this.getSeverityIcon(issue.severity);
        const freq = issue.occurrence > 1 ? ` (${issue.occurrence}회)` : "";
        console.log(
          `   ${i + 1}. ${icon} [${issue.category}] ${issue.title}${freq}`,
        );
        console.log(`      📝 ${issue.description}`);
        console.log(`      🩹 임시해결: ${issue.temporarySolution}`);
        console.log(`      💡 근본해결: ${issue.properSolution}`);
        console.log(`      📉 영향: ${issue.impact}`);

        if (issue.context.command) {
          console.log(`      🔧 명령어: ${issue.context.command}`);
        }
      });

      console.log("\n💡 권장 조치:");
      const p1Count = report.issues.filter((i) => i.severity === "P1").length;
      const p2Count = report.issues.filter((i) => i.severity === "P2").length;

      if (p1Count > 0) {
        console.log(`   1. 🔴 P1 이슈 ${p1Count}개 우선 해결`);
      }
      if (p2Count > 2) {
        console.log(
          `   2. 🟡 P2 이슈 ${p2Count}개 중 자주 발생하는 것부터 해결`,
        );
      }
      console.log(`   3. 📋 주간 이슈 리뷰 스케줄 설정`);
    } else {
      console.log("\n✅ 현재 추적 중인 활성 이슈 없음");
    }

    console.log(`\n📁 상세 보고서: ${this.issuesFile}`);
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case "P0":
        return "🚨";
      case "P1":
        return "🔴";
      case "P2":
        return "🟡";
      case "P3":
        return "🟢";
      default:
        return "❓";
    }
  }

  // 미리 정의된 공통 이슈들을 자동으로 감지
  autoDetectIssues(commandOutput: string, command: string): void {
    // SIGPIPE 오류 감지
    if (
      commandOutput.includes("SIGPIPE") ||
      commandOutput.includes("Broken pipe")
    ) {
      this.trackIssue({
        category: "ERROR",
        severity: "P2",
        title: "SIGPIPE 오류 발생",
        description: `${command} 실행 중 SIGPIPE 오류 발생하지만 작업은 부분적으로 완료됨`,
        temporarySolution: "오류를 무시하고 수동으로 재실행",
        properSolution: "pipe 처리 로직 개선 및 오류 핸들링 강화",
        impact: "사용자 혼란, 스크립트 안정성 저하",
        context: { command, environment: process.platform },
        status: "ACTIVE",
      });
    }

    // node_modules 처리 감지
    if (
      commandOutput.includes("node_modules") &&
      (command.includes("find") || command.includes("grep"))
    ) {
      this.trackIssue({
        category: "PERFORMANCE",
        severity: "P1",
        title: "node_modules 불필요 처리",
        description:
          "스크립트가 node_modules 내부 파일들까지 처리하여 속도 저하",
        temporarySolution: "node_modules 제외 옵션 수동 추가",
        properSolution:
          "모든 검색/처리 스크립트에 --exclude node_modules 자동 적용",
        impact: "실행 시간 5-10배 증가, 리소스 낭비",
        context: { command },
        status: "ACTIVE",
      });
    }

    // TypeScript 컴파일 오류 감지
    if (
      commandOutput.includes("error TS") ||
      commandOutput.includes("Found 0 errors")
    ) {
      const errorCount = (commandOutput.match(/error TS\d+/g) || []).length;
      if (errorCount > 0) {
        this.trackIssue({
          category: "ERROR",
          severity: errorCount > 5 ? "P1" : "P2",
          title: `TypeScript 컴파일 오류 ${errorCount}개`,
          description: `TypeScript 컴파일 과정에서 ${errorCount}개 오류 발생`,
          temporarySolution: "오류를 무시하고 진행, 또는 수동으로 타입 수정",
          properSolution: "AI 자동 수정 시스템 사용 또는 타입 정의 개선",
          impact: "타입 안전성 저하, 런타임 오류 위험",
          context: { command },
          status: "ACTIVE",
        });
      }
    }

    // 권한 오류 감지
    if (
      commandOutput.includes("Permission denied") ||
      commandOutput.includes("EACCES")
    ) {
      this.trackIssue({
        category: "CONFIG",
        severity: "P1",
        title: "권한 오류",
        description: "파일/디렉토리 접근 권한 부족",
        temporarySolution: "sudo 사용 또는 권한 수동 변경",
        properSolution: "적절한 권한 설정 및 사용자 그룹 관리",
        impact: "자동화 실패, 수동 개입 필요",
        context: { command },
        status: "ACTIVE",
      });
    }
  }

  resolveIssue(issueId: string): void {
    const issue = this.issues.find((i) => i.id === issueId);
    if (issue) {
      issue.status = "RESOLVED";
      this.saveIssues();
      console.log(`✅ 이슈 해결됨: ${issue.title}`);
    }
  }

  listActiveIssues(): void {
    const activeIssues = this.issues.filter((i) => i.status === "ACTIVE");
    console.log("\n📋 활성 이슈 목록:");
    activeIssues.forEach((issue, i) => {
      console.log(
        `   ${i + 1}. [${issue.id}] ${issue.title} (${issue.severity})`,
      );
    });
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const tracker = new IssueTracker();
  const command = process.argv[2];

  switch (command) {
    case "report":
      tracker.printReport();
      break;

    case "list":
      tracker.listActiveIssues();
      break;

    case "resolve":
      const issueId = process.argv[3];
      if (!issueId) {
        console.error("❌ Issue ID required");
        process.exit(1);
      }
      tracker.resolveIssue(issueId);
      break;

    case "track":
      // Example: npm run issue:track "SIGPIPE error" "Error occurred but work continued"
      const title = process.argv[3];
      const description = process.argv[4];
      if (!title || !description) {
        console.error("❌ Title and description required");
        process.exit(1);
      }

      tracker.trackIssue({
        category: "ERROR",
        severity: "P2",
        title,
        description,
        temporarySolution: "수동으로 처리됨",
        properSolution: "근본 원인 조사 및 수정 필요",
        impact: "사용자 경험 저하",
        context: {},
        status: "ACTIVE",
      });
      console.log("✅ 이슈가 추적 목록에 추가됨");
      break;

    default:
      console.log(
        "Usage: tsx issue-tracker.ts <report|list|resolve <id>|track <title> <description>>",
      );
      process.exit(1);
  }
}

export default IssueTracker;
