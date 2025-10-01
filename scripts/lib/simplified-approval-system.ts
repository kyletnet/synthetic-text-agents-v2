#!/usr/bin/env tsx

/**
 * Simplified Approval System
 * 복잡한 dual-mode 시스템을 제거하고 명확한 기준 기반의 단일 모드로 단순화
 * 사용자 요청에 따라 구현됨
 */

import { createInterface } from "readline";
import { approvalAnalyzer, ApprovalCriteria } from "./approval-criteria.js";
import { approvalQueue, PendingApprovalItem } from "./approval-queue.js";
import { detectEnvironment } from "./env-detection.js";

interface SimplifiedApprovalRequest {
  title: string;
  description: string;
  command?: string;
  filePaths?: string[];
  changeType?: string;
  impact: string;
  autoAnalyzed?: boolean;
}

interface ApprovalResult {
  approved: boolean;
  action: "proceed" | "skip" | "manual" | "abort";
  reason: string;
  matchedCriteria?: ApprovalCriteria | null;
  rollbackStrategy?:
    | "ignore"
    | "revert"
    | "snapshot_rollback"
    | "graceful_abort";
}

class SimplifiedApprovalSystem {
  private readline: any = null;

  /**
   * 메인 승인 처리 메서드
   * 자동 분석 후 필요시에만 사용자에게 물어봄
   */
  async requestApproval(
    request: SimplifiedApprovalRequest,
    safeMode: boolean = false,
  ): Promise<ApprovalResult> {
    // 1. 자동 분석으로 승인 필요 여부 판단
    const analysis = approvalAnalyzer.analyzeChange(
      request.description,
      request.filePaths || [],
    );

    console.log(`\n🔍 변경사항 분석: ${request.title}`);
    console.log(`📝 설명: ${request.description}`);
    console.log(`📊 분석 결과: ${analysis.reason}`);
    console.log(
      `🎯 위험도: ${this.getRiskEmoji(analysis.riskLevel)} ${analysis.riskLevel.toUpperCase()}`,
    );

    // 2. safe 모드에서는 모든 것을 사용자에게 물어봄
    if (safeMode) {
      console.log(`\n🛡️ Safe 모드: 모든 변경사항을 수동 승인합니다`);
    } else if (!analysis.requiresApproval) {
      // 3. 자동 승인 가능한 경우 바로 처리
      console.log(
        `✅ 자동 승인: ${analysis.matchedCriteria?.description || "안전한 변경사항"}`,
      );
      console.log(`⚡ 자동 실행됩니다...`);

      return {
        approved: true,
        action: "proceed",
        reason: `자동 승인: ${analysis.reason}`,
        matchedCriteria: analysis.matchedCriteria,
      };
    }

    // 4. 사용자 승인이 필요한 경우만 인터랙티브 처리
    console.log(
      `\n⚠️  사용자 승인 필요: ${analysis.matchedCriteria?.description || "중요한 변경사항"}`,
    );

    if (analysis.matchedCriteria) {
      console.log(`📋 변경 유형: ${analysis.matchedCriteria.changeType}`);
      console.log(`💡 예시:`);
      analysis.matchedCriteria.examples.forEach((example, idx) => {
        console.log(`   ${idx + 1}. ${example}`);
      });
    }

    if (request.command) {
      console.log(`⚡ 실행 명령어: ${request.command}`);
    }

    console.log(`💥 예상 영향: ${request.impact}`);

    // 5. 사용자 입력 받기
    return await this.getUserDecision(request, analysis, safeMode);
  }

  /**
   * 사용자 결정 요청 (비대화형 모드 지원)
   */
  private async getUserDecision(
    request: SimplifiedApprovalRequest,
    analysis: any,
    safeMode: boolean = false,
  ): Promise<ApprovalResult> {
    // Use centralized environment detection
    const { isInteractive } = detectEnvironment();

    if (!isInteractive) {
      // 비대화형 환경: 즉시 큐에 저장
      console.log("\n⚠️  비대화형 실행 환경 감지");
      console.log(
        "📋 승인 대기 큐에 저장합니다 - 나중에 npm run approve 명령어로 처리하세요.",
      );

      const priority = this.riskToPriority(analysis.riskLevel);
      approvalQueue.addToQueue({
        title: request.title,
        description: request.description,
        command: request.command || "",
        impact: request.impact,
        riskLevel: analysis.riskLevel,
        priority: priority,
        timeoutAt: new Date(),
        source: "maintenance",
      });

      return {
        approved: false,
        action: "skip",
        reason: "비대화형 환경 - 승인 큐에 저장됨 (npm run approve로 처리)",
        matchedCriteria: analysis.matchedCriteria,
        rollbackStrategy: analysis.matchedCriteria?.rollbackStrategy,
      };
    }

    // 대화형 환경: 기존 로직
    console.log("\n" + "-".repeat(80));
    console.log("🤔 어떻게 처리하시겠습니까?");
    console.log("  y/Y: 승인하고 실행");
    console.log("  n/N: 건너뛰기 (나중에 처리)");
    console.log("  m/M: 수동으로 처리 (직접 실행)");
    console.log("  a/A: 전체 세션 중단");
    console.log("  i/I: 자세한 정보 보기");

    // readline 인스턴스를 필요할 때만 생성
    if (!this.readline) {
      this.readline = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }

    return new Promise((resolve) => {
      // 중요도별 타임아웃 설정
      const timeoutMs = this.getTimeoutForRisk(analysis.riskLevel, safeMode);

      let timeoutHandle: NodeJS.Timeout | null = null;

      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          console.log(`\n⏰ 시간 초과 (${timeoutMs / 1000}초)`);
          console.log(
            `📋 승인 대기 큐에 저장합니다 - 나중에 npm run approve 명령어로 처리하세요.`,
          );

          // 큐에 저장
          const priority = this.riskToPriority(analysis.riskLevel);
          approvalQueue.addToQueue({
            title: request.title,
            description: request.description,
            command: request.command || "",
            impact: request.impact,
            riskLevel: analysis.riskLevel,
            priority: priority,
            timeoutAt: new Date(),
            source: "maintenance",
          });

          if (this.readline) {
            this.readline.close();
            this.readline = null;
          }

          resolve({
            approved: false,
            action: "skip",
            reason: "시간 초과 - 승인 큐에 저장됨",
            matchedCriteria: analysis.matchedCriteria,
            rollbackStrategy: analysis.matchedCriteria?.rollbackStrategy,
          });
        }, timeoutMs);
      }

      const handleInput = (input: string) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        const choice = input.trim().toLowerCase();

        switch (choice) {
          case "y":
          case "yes":
            console.log("✅ 승인됨 - 실행합니다...");
            if (this.readline) {
              this.readline.close();
              this.readline = null;
            }
            resolve({
              approved: true,
              action: "proceed",
              reason: "사용자 승인",
              matchedCriteria: analysis.matchedCriteria,
              rollbackStrategy: analysis.matchedCriteria?.rollbackStrategy,
            });
            break;

          case "n":
          case "no":
            console.log("⏭️ 건너뛰기 - 나중에 처리하세요.");
            if (this.readline) {
              this.readline.close();
              this.readline = null;
            }
            resolve({
              approved: false,
              action: "skip",
              reason: "사용자가 나중으로 미룸",
              matchedCriteria: analysis.matchedCriteria,
              rollbackStrategy: analysis.matchedCriteria?.rollbackStrategy,
            });
            break;

          case "m":
          case "manual":
            console.log("🔧 수동 처리 선택됨.");
            if (request.command) {
              console.log(`💻 실행할 명령어: ${request.command}`);
            }
            if (this.readline) {
              this.readline.close();
              this.readline = null;
            }
            resolve({
              approved: false,
              action: "manual",
              reason: "사용자가 수동 처리 선택",
              matchedCriteria: analysis.matchedCriteria,
              rollbackStrategy: analysis.matchedCriteria?.rollbackStrategy,
            });
            break;

          case "a":
          case "abort":
            console.log("🛑 전체 세션 중단됨.");
            if (this.readline) {
              this.readline.close();
              this.readline = null;
            }
            resolve({
              approved: false,
              action: "abort",
              reason: "사용자가 세션 중단",
              matchedCriteria: analysis.matchedCriteria,
              rollbackStrategy: analysis.matchedCriteria?.rollbackStrategy,
            });
            break;

          case "i":
          case "info":
            this.showDetailedInfo(request, analysis);
            this.readline.question("\n선택하세요 [y/n/m/a/i]: ", handleInput);
            break;

          default:
            console.log("❓ 올바른 선택지를 입력하세요 (y/n/m/a/i)");
            this.readline.question("다시 선택하세요: ", handleInput);
            break;
        }
      };

      if (timeoutMs > 0) {
        console.log(
          `⏱️ ${timeoutMs / 1000}초 후 자동으로 건너뛰기 처리됩니다.`,
        );
      } else {
        console.log(`⏱️ 타임아웃 없음 - 사용자 결정을 기다립니다.`);
      }
      this.readline.question("\n선택하세요 [y/n/m/a/i]: ", handleInput);
    });
  }

  /**
   * 상세 정보 표시
   */
  private showDetailedInfo(
    request: SimplifiedApprovalRequest,
    analysis: any,
  ): void {
    console.log("\n📋 상세 분석 정보:");
    console.log("-".repeat(80));

    if (analysis.matchedCriteria) {
      const criteria = analysis.matchedCriteria;
      console.log(`🏷️  변경 유형: ${criteria.changeType}`);
      console.log(`📝 설명: ${criteria.description}`);
      console.log(
        `🎯 위험도: ${this.getRiskEmoji(criteria.riskLevel)} ${criteria.riskLevel}`,
      );

      console.log(`\n📚 유사한 변경사항 예시:`);
      criteria.examples.forEach((example: string, idx: number) => {
        console.log(`   ${idx + 1}. ${example}`);
      });
    }

    // 위험도별 권장사항
    console.log(`\n💡 권장사항:`);
    switch (analysis.riskLevel) {
      case "critical":
        console.log("   🚨 매우 위험: 수동 처리 (m) 권장");
        console.log("   📝 백업 후 별도 환경에서 테스트 필요");
        break;
      case "high":
        console.log("   ⚠️  위험: 신중한 검토 후 승인 또는 수동 처리");
        console.log("   🔍 코드 리뷰 및 테스트 권장");
        break;
      case "medium":
        console.log("   📋 보통: 승인 후 실행 가능, 주의 필요");
        break;
      case "low":
        console.log("   ✅ 안전: 승인 후 실행 권장");
        break;
    }

    if (request.filePaths && request.filePaths.length > 0) {
      console.log(`\n📁 영향받는 파일:`);
      request.filePaths.slice(0, 5).forEach((path) => {
        console.log(`   📄 ${path}`);
      });
      if (request.filePaths.length > 5) {
        console.log(`   ... 및 ${request.filePaths.length - 5}개 추가 파일`);
      }
    }

    // 롤백 전략 정보 추가
    if (analysis.matchedCriteria?.rollbackStrategy) {
      this.showRollbackOptions(analysis.matchedCriteria);
    }

    console.log("-".repeat(80));
  }

  /**
   * 배치 처리 (여러 항목을 한번에)
   */
  async processBatch(
    requests: SimplifiedApprovalRequest[],
    safeMode: boolean = false,
  ): Promise<{
    approved: SimplifiedApprovalRequest[];
    skipped: SimplifiedApprovalRequest[];
    manual: SimplifiedApprovalRequest[];
    autoApproved: SimplifiedApprovalRequest[];
    aborted: boolean;
  }> {
    const approved: SimplifiedApprovalRequest[] = [];
    const skipped: SimplifiedApprovalRequest[] = [];
    const manual: SimplifiedApprovalRequest[] = [];
    const autoApproved: SimplifiedApprovalRequest[] = [];

    console.log(`\n🔄 일괄 승인 처리 시작 (${requests.length}개 항목)`);
    console.log(`📊 자동 분석으로 필요한 항목만 사용자 승인 요청`);

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      console.log(`\n📋 진행: ${i + 1}/${requests.length} - ${request.title}`);

      const result = await this.requestApproval(request, safeMode);

      // 중단 요청 처리
      if (result.action === "abort") {
        console.log("🛑 사용자가 일괄 처리를 중단했습니다.");
        return { approved, skipped, manual, autoApproved, aborted: true };
      }

      // 결과별 분류
      if (result.approved) {
        if (result.reason.includes("자동 승인")) {
          autoApproved.push(request);
        } else {
          approved.push(request);
        }
      } else if (result.action === "manual") {
        manual.push(request);
      } else {
        skipped.push(request);
      }
    }

    // 결과 요약
    console.log(`\n📊 일괄 처리 완료:`);
    console.log(`   ✅ 자동 승인: ${autoApproved.length}개`);
    console.log(`   🤝 사용자 승인: ${approved.length}개`);
    console.log(`   ⏭️  건너뛰기: ${skipped.length}개`);
    console.log(`   🔧 수동 처리: ${manual.length}개`);

    return { approved, skipped, manual, autoApproved, aborted: false };
  }

  /**
   * 위험도별 이모지
   */
  private getRiskEmoji(riskLevel: string): string {
    const emojis = {
      low: "🟢",
      medium: "🟡",
      high: "🟠",
      critical: "🔴",
    };
    return emojis[riskLevel as keyof typeof emojis] || "❓";
  }

  /**
   * 중요도별 타임아웃 (GPT 조언 반영)
   */
  private getTimeoutForRisk(
    riskLevel: string,
    safeMode: boolean = false,
  ): number {
    // safe 모드에서는 모든 것을 무한 대기
    if (safeMode) {
      return 0;
    }

    const timeouts = {
      low: 30000, // 30초 (안전한 변경, 빠른 결정)
      medium: 90000, // 90초 (일반적인 검토)
      high: 180000, // 3분 (중요한 결정)
      critical: 0, // 무한 대기 (매우 중요한 결정, P0)
    };
    return timeouts[riskLevel as keyof typeof timeouts] || 90000;
  }

  /**
   * 위험도를 우선순위로 변환
   */
  private riskToPriority(
    riskLevel: string,
  ): "low" | "medium" | "high" | "critical" {
    const mapping: Record<string, "low" | "medium" | "high" | "critical"> = {
      low: "low",
      medium: "medium",
      high: "high",
      critical: "critical",
    };
    return mapping[riskLevel] || "medium";
  }

  /**
   * 거부된 변경사항에 대한 롤백 처리
   */
  async handleRejectionRollback(
    result: ApprovalResult,
    request: SimplifiedApprovalRequest,
    snapshotId?: string,
  ): Promise<void> {
    if (result.approved || !result.rollbackStrategy) {
      return; // 승인되었거나 롤백 전략이 없으면 아무것도 하지 않음
    }

    console.log(`\n🔄 거부된 변경사항 롤백 처리: ${result.rollbackStrategy}`);
    console.log(`📝 변경사항: ${request.title}`);

    if (result.matchedCriteria?.rollbackDescription) {
      console.log(
        `💡 롤백 이유: ${result.matchedCriteria.rollbackDescription}`,
      );
    }

    try {
      switch (result.rollbackStrategy) {
        case "ignore":
          console.log("✅ 무시: 시스템에 영향이 없으므로 롤백하지 않습니다.");
          break;

        case "revert":
          console.log("🔄 Git revert 실행 중...");
          // 실제 git revert 로직은 호출하는 쪽에서 구현
          console.log("💡 수동 실행 필요: git revert <commit-hash>");
          break;

        case "snapshot_rollback":
          if (snapshotId) {
            console.log(`📸 스냅샷 롤백 실행 중... (${snapshotId})`);
            // 실제 스냅샷 롤백은 호출하는 쪽에서 구현
            console.log("💡 스냅샷 롤백이 필요합니다.");
          } else {
            console.log("⚠️ 스냅샷 ID가 없어 롤백할 수 없습니다.");
          }
          break;

        case "graceful_abort":
          console.log("🛑 안전한 세션 중단: 추가 변경사항 실행을 중단합니다.");
          console.log(
            "🔒 데이터 무결성 보호를 위해 전체 메인테넌스를 중단합니다.",
          );
          // 세션 중단 플래그 설정은 호출하는 쪽에서 처리
          break;

        default:
          console.log(`❓ 알 수 없는 롤백 전략: ${result.rollbackStrategy}`);
          console.log("💡 수동으로 상황을 검토해주세요.");
      }
    } catch (error) {
      console.log(`❌ 롤백 처리 중 오류: ${error}`);
      console.log("💡 수동으로 시스템 상태를 확인해주세요.");
    }
  }

  /**
   * 롤백 전략 설명 표시
   */
  showRollbackOptions(criteria: ApprovalCriteria): void {
    console.log(`\n🔄 거부 시 롤백 전략:`);
    console.log(`   전략: ${criteria.rollbackStrategy || "none"}`);

    if (criteria.rollbackDescription) {
      console.log(`   설명: ${criteria.rollbackDescription}`);
    }

    switch (criteria.rollbackStrategy) {
      case "ignore":
        console.log("   ✅ 영향 없음: 거부해도 시스템에 문제 없습니다");
        break;
      case "revert":
        console.log("   🔄 Git revert: 변경사항을 되돌릴 수 있습니다");
        break;
      case "snapshot_rollback":
        console.log("   📸 스냅샷 복원: 완전한 시스템 상태 복원");
        break;
      case "graceful_abort":
        console.log("   🛑 안전 중단: 전체 세션을 안전하게 중단");
        break;
    }
  }

  /**
   * 시스템 종료
   */
  close(): void {
    if (this.readline) {
      this.readline.close();
      this.readline = null;
    }
  }
}

export const simplifiedApproval = new SimplifiedApprovalSystem();
export default SimplifiedApprovalSystem;
