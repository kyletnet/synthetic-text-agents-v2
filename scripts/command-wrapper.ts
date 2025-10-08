#!/usr/bin/env node
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Command Wrapper with Issue Detection
 * 명령어 실행 후 자동으로 이슈를 감지하고 추적
 */

import { execSync, spawn } from "child_process";
import IssueTracker from "./issue-tracker.js";

class CommandWrapper {
  public issueTracker: IssueTracker;

  constructor() {
    this.issueTracker = new IssueTracker();
  }

  async executeWithTracking(
    command: string,
    description?: string,
  ): Promise<{
    success: boolean;
    output: string;
    issues: number;
  }> {
    console.log(`🔧 실행 중: ${description || command}`);

    let output = "";
    let success = true;
    let issuesBefore = 0;

    try {
      // 실행 전 이슈 수 확인
      const reportBefore = this.issueTracker.generateReport();
      issuesBefore = reportBefore.activeIssues;

      // 명령어 실행
      output = execSync(command, {
        encoding: "utf8",
        timeout: 300000, // 5분 타임아웃
        maxBuffer: 1024 * 1024 * 10, // 10MB 버퍼
      });

      console.log("✅ 명령어 실행 완료");
    } catch (error: any) {
      success = false;
      output = error.stdout || error.message || "Unknown error";
      console.log("⚠️ 명령어 실행 중 오류 발생, 출력 분석 중...");
    }

    // 자동 이슈 감지
    this.issueTracker.autoDetectIssues(output, command);

    // 실행 후 이슈 수 확인
    const reportAfter = this.issueTracker.generateReport();
    const newIssues = reportAfter.activeIssues - issuesBefore;

    if (newIssues > 0) {
      console.log(`📋 새로운 이슈 ${newIssues}개 감지됨`);
    }

    return {
      success,
      output,
      issues: newIssues,
    };
  }

  // 미리 정의된 문제 패턴들을 수동으로 추가
  addKnownIssue(pattern: {
    title: string;
    description: string;
    category:
      | "PERFORMANCE"
      | "ERROR"
      | "WARNING"
      | "WORKAROUND"
      | "DEPENDENCY"
      | "CONFIG";
    severity: "P0" | "P1" | "P2" | "P3";
    temporarySolution: string;
    properSolution: string;
    impact: string;
  }): void {
    this.issueTracker.trackIssue({
      ...pattern,
      context: {},
      status: "ACTIVE",
    });
  }
}

// 자주 발생하는 알려진 이슈들을 미리 등록
function registerKnownIssues(wrapper: CommandWrapper): void {
  // node_modules 성능 이슈
  wrapper.addKnownIssue({
    title: "find/grep 명령어가 node_modules 처리",
    description: "검색 명령어들이 node_modules 디렉토리까지 처리하여 속도 저하",
    category: "PERFORMANCE",
    severity: "P1",
    temporarySolution: "수동으로 --exclude node_modules 옵션 추가",
    properSolution: "모든 검색 스크립트에 자동 제외 옵션 적용",
    impact: "실행 시간 5-10배 증가, 불필요한 리소스 사용",
  });

  // SIGPIPE 일반적 이슈
  wrapper.addKnownIssue({
    title: "SIGPIPE 오류 빈발",
    description: "pipe 처리 과정에서 SIGPIPE 오류 발생하지만 작업은 완료됨",
    category: "ERROR",
    severity: "P2",
    temporarySolution: "오류 무시하고 재실행",
    properSolution: "pipe 오류 핸들링 개선 및 graceful shutdown 구현",
    impact: "사용자 혼란, 자동화 스크립트 불안정",
  });

  // TypeScript 설정 이슈
  wrapper.addKnownIssue({
    title: "TypeScript 설정 충돌",
    description: "tsconfig.json과 실제 코드 간 설정 불일치",
    category: "CONFIG",
    severity: "P2",
    temporarySolution: "any 타입으로 임시 우회",
    properSolution: "tsconfig 통합 및 타입 정의 정리",
    impact: "타입 안전성 저하, 개발 효율성 감소",
  });
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const wrapper = new CommandWrapper();
  const command = process.argv.slice(2).join(" ");

  if (!command) {
    console.log("Usage: tsx command-wrapper.ts <command>");
    console.log('Example: tsx command-wrapper.ts "npm run build"');
    process.exit(1);
  }

  // 알려진 이슈들 등록
  registerKnownIssues(wrapper);

  wrapper
    .executeWithTracking(command)
    .then((result) => {
      if (result.issues > 0) {
        console.log("\n📋 감지된 이슈 요약:");
        wrapper.issueTracker.printReport();
      }

      console.log(
        `\n${result.success ? "✅" : "❌"} 실행 ${
          result.success ? "완료" : "실패"
        }`,
      );

      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("❌ Wrapper 실행 실패:", error);
      process.exit(1);
    });
}

export default CommandWrapper;
