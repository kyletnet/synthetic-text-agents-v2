#!/usr/bin/env tsx

/**
 * Interactive Approval System
 * 실제 사용자 입력을 받는 승인 시스템
 */

import { createInterface } from "readline";
import { safeGuard } from "./safe-automation-guard.js";

interface ApprovalRequest {
  title: string;
  description: string;
  command: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  impact: string;
  autoFix?: boolean;
  alternatives?: string[];
}

class InteractiveApprovalSystem {
  private readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  /**
   * 실제 사용자 승인 요청
   */
  async requestApproval(request: ApprovalRequest): Promise<{
    approved: boolean;
    action?: 'fix' | 'skip' | 'manual' | 'abort';
    reason?: string;
  }> {
    // Check if running in non-interactive mode (CI/CD, background process)
    if (!process.stdin.isTTY) {
      console.log('⚠️ 비대화형 실행 환경 감지 - 승인 요청을 큐에 저장합니다');
      return {
        approved: false,
        action: 'skip',
        reason: 'Non-interactive environment - queued for manual approval'
      };
    }

    console.log('\n' + '='.repeat(80));
    console.log(`🤔 승인 요청: ${request.title}`);
    console.log('='.repeat(80));

    console.log(`📝 설명: ${request.description}`);
    console.log(`⚡ 실행 명령어: ${request.command}`);
    console.log(`🎯 위험도: ${this.getRiskEmoji(request.riskLevel)} ${request.riskLevel.toUpperCase()}`);
    console.log(`💥 영향: ${request.impact}`);

    // 자동화 가드 체크
    const safetyCheck = await safeGuard.canExecuteAutomation(request.command);
    if (!safetyCheck.allowed) {
      console.log(`🛡️ 자동화 가드: ${safetyCheck.reason}`);
      if (safetyCheck.nextAllowedTime) {
        console.log(`   ⏰ 다음 가능 시간: ${safetyCheck.nextAllowedTime}`);
      }
    }

    if (request.alternatives && request.alternatives.length > 0) {
      console.log(`🔄 대안 명령어:`);
      request.alternatives.forEach((alt, idx) => {
        console.log(`   ${idx + 1}. ${alt}`);
      });
    }

    console.log('\n' + '-'.repeat(80));
    console.log('선택하세요:');
    console.log('  y/Y: 승인하고 실행');
    console.log('  n/N: 거부');
    console.log('  s/S: 지금은 건너뛰기 (나중에 처리)');
    console.log('  m/M: 수동으로 처리 (직접 명령어 실행)');
    console.log('  a/A: 전체 세션 중단');
    console.log('  ?/h: 도움말 보기');

    if (request.autoFix) {
      console.log('  f/F: 자동 수정 시도 (위험할 수 있음)');
    }

    // 우선순위에 따른 타임아웃 설정 (무한 루프 방지)
    const timeoutMs = this.getTimeoutForRisk(request.riskLevel);
    console.log(`⏱️ 시간 제한: ${timeoutMs / 1000}초 (시간 초과 시 안전한 기본값 적용)`);

    return new Promise((resolve) => {
      let timeoutHandle: NodeJS.Timeout | null = null;

      // 타임아웃 설정
      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          console.log(`\n⏰ 시간 초과 (${timeoutMs / 1000}초)`);
          const defaultAction = this.getDefaultActionForRisk(request.riskLevel);
          console.log(`🛡️ 안전한 기본 동작 적용: ${defaultAction}`);
          this.readline.close();

          if (defaultAction === 'skip') {
            resolve({ approved: false, action: 'skip', reason: '시간 초과로 안전한 건너뛰기' });
          } else {
            resolve({ approved: false, action: 'manual', reason: '시간 초과로 수동 처리 필요' });
          }
        }, timeoutMs);
      }

      const handleInput = (input: string) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        const choice = input.trim().toLowerCase();

        switch (choice) {
          case 'y':
          case 'yes':
            console.log('✅ 승인됨 - 실행합니다...');
            this.readline.close();
            resolve({ approved: true, action: 'fix' });
            break;

          case 'n':
          case 'no':
            console.log('❌ 거부됨 - 건너뜁니다.');
            this.readline.close();
            resolve({ approved: false, action: 'skip', reason: '사용자 거부' });
            break;

          case 's':
          case 'skip':
            console.log('⏭️ 건너뛰기 - 나중에 처리하세요.');
            this.readline.close();
            resolve({ approved: false, action: 'skip', reason: '나중에 처리' });
            break;

          case 'm':
          case 'manual':
            console.log('🔧 수동 처리 - 직접 명령어를 실행하세요:');
            console.log(`   💻 ${request.command}`);
            this.readline.close();
            resolve({ approved: false, action: 'manual', reason: '수동 처리 선택' });
            break;

          case 'a':
          case 'abort':
            console.log('🛑 전체 세션 중단됨.');
            this.readline.close();
            resolve({ approved: false, action: 'abort', reason: '사용자가 세션 중단' });
            break;

          case 'f':
          case 'fix':
            if (request.autoFix) {
              console.log('⚡ 자동 수정 시도...');
              this.readline.close();
              resolve({ approved: true, action: 'fix' });
            } else {
              console.log('❌ 자동 수정이 지원되지 않는 작업입니다.');
              this.readline.question('다시 선택하세요 [y/n/s/m/a/?]: ', handleInput);
            }
            break;

          case '?':
          case 'h':
          case 'help':
            this.showDetailedHelp(request);
            this.readline.question('선택하세요 [y/n/s/m/a/?]: ', handleInput);
            break;

          default:
            console.log('❓ 올바른 선택지를 입력하세요.');
            this.readline.question('다시 선택하세요 [y/n/s/m/a/?]: ', handleInput);
            break;
        }
      };

      this.readline.question('선택하세요 [y/n/s/m/a/?]: ', handleInput);
    });
  }

  /**
   * 배치 승인 처리 (여러 항목)
   */
  async requestBatchApproval(requests: ApprovalRequest[]): Promise<{
    approved: ApprovalRequest[];
    rejected: ApprovalRequest[];
    manual: ApprovalRequest[];
    aborted: boolean;
  }> {
    const approved: ApprovalRequest[] = [];
    const rejected: ApprovalRequest[] = [];
    const manual: ApprovalRequest[] = [];

    console.log(`\n🔄 일괄 승인 프로세스 시작 (${requests.length}개 항목)`);

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      console.log(`\n📋 진행 상황: ${i + 1}/${requests.length}`);

      const result = await this.requestApproval(request);

      if (result.action === 'abort') {
        console.log('🛑 사용자가 일괄 승인 프로세스를 중단했습니다.');
        return { approved, rejected, manual, aborted: true };
      }

      if (result.approved) {
        approved.push(request);
      } else if (result.action === 'manual') {
        manual.push(request);
      } else {
        rejected.push(request);
      }
    }

    return { approved, rejected, manual, aborted: false };
  }

  private showDetailedHelp(request: ApprovalRequest): void {
    console.log('\n📋 상세 정보:');
    console.log('-'.repeat(80));

    // 위험도별 설명
    const riskExplanations = {
      low: '낮음 - 시스템에 미미한 영향, 되돌리기 쉬움',
      medium: '보통 - 일부 기능에 영향, 주의 필요',
      high: '높음 - 중요 기능에 영향, 신중한 검토 필요',
      critical: '치명적 - 전체 시스템에 영향, 매우 위험'
    };

    console.log(`🎯 위험도: ${riskExplanations[request.riskLevel]}`);

    // 명령어별 안전성 정보
    if (request.command.includes('typecheck')) {
      console.log('📋 TypeScript 체크는 코드 분석만 하므로 비교적 안전합니다.');
    } else if (request.command.includes('lint:fix')) {
      console.log('⚠️  lint:fix는 코드를 자동으로 수정하므로 주의가 필요합니다.');
    } else if (request.command.includes('system:evolve')) {
      console.log('🚨 system:evolve는 아키텍처를 변경하므로 매우 위험합니다.');
    }

    console.log('\n💡 권장사항:');
    if (request.riskLevel === 'critical') {
      console.log('   - 수동 처리 (m) 또는 건너뛰기 (s) 권장');
      console.log('   - 백업 후 별도 환경에서 테스트');
    } else if (request.riskLevel === 'high') {
      console.log('   - 신중한 검토 후 승인 또는 수동 처리 권장');
    } else {
      console.log('   - 승인 후 실행하거나 수동 처리 가능');
    }

    console.log('-'.repeat(80));
  }

  private getRiskEmoji(riskLevel: string): string {
    const emojis = {
      low: '🟢',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };
    return emojis[riskLevel as keyof typeof emojis] || '❓';
  }

  /**
   * 위험도에 따른 타임아웃 시간 반환 (무한 루프 방지)
   */
  private getTimeoutForRisk(riskLevel: string): number {
    const timeouts = {
      low: 30000,      // 30초 - 빠른 결정
      medium: 60000,   // 1분 - 일반적인 검토
      high: 120000,    // 2분 - 신중한 검토
      critical: 180000 // 3분 - 매우 중요한 결정
    };
    return timeouts[riskLevel as keyof typeof timeouts] || 60000;
  }

  /**
   * 위험도에 따른 기본 동작 반환 (타임아웃 발생 시)
   */
  private getDefaultActionForRisk(riskLevel: string): 'skip' | 'manual' {
    // 위험도가 높을수록 수동 처리 권장
    if (riskLevel === 'critical' || riskLevel === 'high') {
      return 'manual'; // 수동 처리로 안전하게
    }
    return 'skip'; // 낮은 위험도는 건너뛰기
  }

  /**
   * 빠른 yes/no 승인 (간단한 경우용)
   */
  async quickApproval(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.readline.question(`❓ ${question} [y/N]: `, (answer) => {
        const approved = ['y', 'yes', 'Y', 'YES'].includes(answer.trim());
        console.log(approved ? '✅ 승인됨' : '❌ 거부됨');
        this.readline.close();
        resolve(approved);
      });
    });
  }

  close(): void {
    this.readline.close();
  }
}

export const approvalSystem = new InteractiveApprovalSystem();
export default InteractiveApprovalSystem;