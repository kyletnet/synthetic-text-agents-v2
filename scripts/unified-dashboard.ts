#!/usr/bin/env node

/**
 * Unified System Dashboard
 * 모든 시스템 상태를 한 곳에서 제공 (보고서 시스템 통합)
 */

import IssueTracker from './issue-tracker.js';
import SecurityAuditChecker from './security-audit-checker.js';
import SystemIntegrationAnalyzer from './system-integration-analyzer.js';
import { execSync } from 'child_process';

class UnifiedSystemDashboard {
  async showCompleteDashboard(): Promise<void> {
    console.log('🎛️ 통합 시스템 대시보드');
    console.log('=======================');

    // 1. 시스템 건강 상태 (한눈에)
    console.log('\n🏥 시스템 건강도:');
    const health = await this.getSystemHealth();
    console.log(`   전체: ${health.overall}/10`);
    console.log(`   타입스크립트: ${health.typescript ? '✅' : '❌'}`);
    console.log(`   보안: ${health.security}`);
    console.log(`   통합성: ${health.integration}/100`);

    // 2. 활성 이슈 요약
    console.log('\n🔍 활성 이슈:');
    const issueTracker = new IssueTracker();
    const issueReport = issueTracker.generateReport();
    console.log(`   임시 처리 이슈: ${issueReport.activeIssues}개`);

    if (issueReport.activeIssues > 0) {
      const p1Issues = issueReport.issues.filter(i => i.severity === 'P1').length;
      console.log(`   우선순위 높음: ${p1Issues}개`);
    }

    // 3. 최근 변경사항 영향도
    console.log('\n🔄 최근 변경 영향도:');
    try {
      const changes = execSync('git status --porcelain', { encoding: 'utf8' });
      const fileCount = changes.trim() ? changes.trim().split('\n').length : 0;
      console.log(`   수정된 파일: ${fileCount}개`);

      if (fileCount > 5) {
        console.log('   ⚠️ 대규모 변경 - 통합 검사 권장');
      }
    } catch (error) {
      console.log('   ℹ️ Git 상태 확인 불가');
    }

    // 4. 시스템 모드 및 트랜잭션 상태
    console.log('\n🏗️ 시스템 모드:');
    const systemMode = await this.getSystemMode();
    console.log(`   모드: ${systemMode.mode} (v${systemMode.version})`);
    console.log(`   승인 워크플로우: ${systemMode.approvalRequired ? '✅ 활성' : '❌ 비활성'}`);

    if (systemMode.hasIncompleteTransaction) {
      console.log(`   ⚠️ 미완료 트랜잭션 감지: ${systemMode.incompleteTransaction}`);
    }

    // 5. 자동화 갭 모니터링
    console.log('\n🔧 자동화 갭 모니터링:');
    const gaps = await this.detectAutomationGaps();
    if (gaps.length > 0) {
      gaps.forEach((gap, i) => console.log(`   ${i+1}. ⚠️ ${gap}`));
    } else {
      console.log('   ✅ 주요 자동화 갭 없음');
    }

    // 5. 권장 액션
    console.log('\n💡 권장 액션:');
    if (!health.typescript) {
      console.log('   1. 🔴 TypeScript 오류 수정 필요');
    }
    if (issueReport.activeIssues > 0) {
      console.log('   2. 🟡 활성 이슈 검토 권장');
    }
    if (health.integration < 80) {
      console.log('   3. 🔵 시스템 통합 개선 권장');
    }
    if (gaps.length > 0) {
      console.log('   4. 🔧 자동화 갭 해결 권장');
    }
    if (health.overall >= 8 && health.typescript && issueReport.activeIssues === 0) {
      console.log('   ✅ 시스템 상태 양호 - 정기 점검만 필요');
    }
  }

  private async getSystemHealth(): Promise<{
    overall: number;
    typescript: boolean;
    security: string;
    integration: number;
  }> {
    let overall = 10;
    let typescript = true;
    let security = 'PASS';
    let integration = 85;

    // TypeScript 검사
    try {
      execSync('npm run typecheck', { stdio: 'ignore' });
    } catch (error) {
      typescript = false;
      overall -= 2;
    }

    // 보안 검사
    try {
      const secChecker = new SecurityAuditChecker();
      const secReport = await secChecker.runSecurityAudit();
      security = secReport.overallStatus;
      if (security !== 'PASS') overall -= 1;
    } catch (error) {
      security = 'ERROR';
      overall -= 2;
    }

    // 통합 점수 (이전 분석 결과 사용)
    try {
      const integrationAnalyzer = new SystemIntegrationAnalyzer();
      const intReport = await integrationAnalyzer.analyzeFullSystem();
      integration = intReport.integration_score;
      if (integration < 70) overall -= 1;
    } catch (error) {
      integration = 50;
      overall -= 1;
    }

    return { overall: Math.max(0, overall), typescript, security, integration };
  }

  private async detectAutomationGaps(): Promise<string[]> {
    const gaps: string[] = [];

    try {
      // 1. package.json에서 미사용 스크립트 검사 (ignore 리스트 반영)
      const fs = await import('fs');
      const packageJson = JSON.parse(fs.readFileSync('/Users/kyle/synthetic-text-agents-v2/package.json', 'utf8'));
      const scriptsDir = fs.readdirSync('/Users/kyle/synthetic-text-agents-v2/scripts/');

      // ignore-scripts.json 로드
      let ignoreList: string[] = [];
      try {
        const ignoreConfig = JSON.parse(fs.readFileSync('/Users/kyle/synthetic-text-agents-v2/.claude/ignore-scripts.json', 'utf8'));
        ignoreList = ignoreConfig.ignore || [];
      } catch (error) {
        // ignore-scripts.json이 없으면 빈 배열로 처리
      }

      const usedScripts = Object.values(packageJson.scripts)
        .join(' ')
        .match(/scripts\/[\w-]+\.(ts|js|sh|cjs)/g) || [];

      const allScripts = scriptsDir.filter(file => file.match(/\.(ts|js|sh|cjs)$/));
      const unusedScripts = allScripts
        .filter(file => !usedScripts.some(used => used.includes(file)))
        .filter(file => !ignoreList.includes(file));

      // 자동화 커버리지 스코어 계산
      const totalScripts = allScripts.length;
      const managedScripts = totalScripts - unusedScripts.length;
      const coverageScore = ((managedScripts / totalScripts) * 100).toFixed(1);

      console.log(`\n🧠 자동화 커버리지: ${coverageScore}% (${managedScripts}/${totalScripts} scripts managed)`);

      if (unusedScripts.length > 0) {
        console.log(`⚠️ 미관리 스크립트: ${unusedScripts.slice(0, 5).join(', ')}${unusedScripts.length > 5 ? '...' : ''}`);
      }

      if (unusedScripts.length > 10) {
        gaps.push(`${unusedScripts.length}개 스크립트가 자동화에서 제외됨`);
      }

      // 2. 핵심 워크플로우 검사
      const coreCommands = ['sync', 'status', 'fix', 'ship'];
      const missingCore = coreCommands.filter(cmd => !packageJson.scripts[cmd]);
      if (missingCore.length > 0) {
        gaps.push(`핵심 명령어 누락: ${missingCore.join(', ')}`);
      }

      // 3. 승인 워크플로우 완성도 검사
      const approvalCommands = ['confirm-sync', 'deny-sync', 'prepare-release', 'confirm-release'];
      const missingApproval = approvalCommands.filter(cmd => !packageJson.scripts[cmd]);
      if (missingApproval.length > 0) {
        gaps.push(`승인 워크플로우 불완전: ${missingApproval.join(', ')}`);
      }

      // 4. 자동 실행되지 않는 중요 검사들
      const reviewSync = packageJson.scripts['review-sync'] || '';
      if (!reviewSync.includes('advanced:audit')) {
        gaps.push('리팩토링 audit이 sync에 미포함');
      }

      // 5. 문서 자동화 검사
      if (!fs.existsSync('/Users/kyle/synthetic-text-agents-v2/docs/USER_GUIDE.md')) {
        gaps.push('사용자 가이드 문서 누락');
      }

    } catch (error) {
      gaps.push('자동화 갭 검사 중 오류 발생');
    }

    return gaps;
  }

  private async getSystemMode(): Promise<{
    mode: string;
    version: string;
    approvalRequired: boolean;
    hasIncompleteTransaction: boolean;
    incompleteTransaction?: string;
  }> {
    try {
      const fs = await import('fs');
      const yaml = await import('yaml');

      // system-mode.yaml 읽기
      const modeConfig = yaml.parse(
        fs.readFileSync('/Users/kyle/synthetic-text-agents-v2/.claude/system-mode.yaml', 'utf8')
      );

      // 미완료 트랜잭션 검사
      let hasIncompleteTransaction = false;
      let incompleteTransaction = '';

      // approval-workflow 상태 파일 확인
      try {
        if (fs.existsSync('/Users/kyle/synthetic-text-agents-v2/.claude/pending-approval.json')) {
          const pendingApproval = JSON.parse(
            fs.readFileSync('/Users/kyle/synthetic-text-agents-v2/.claude/pending-approval.json', 'utf8')
          );
          hasIncompleteTransaction = true;
          incompleteTransaction = `${pendingApproval.action} 승인 대기 중`;
        }
      } catch (error) {
        // 파일이 없으면 정상 상태
      }

      return {
        mode: modeConfig.system_mode || 'unknown',
        version: modeConfig.version || '0.0.0',
        approvalRequired: modeConfig.operational_flags?.require_approval_for_changes ?? true,
        hasIncompleteTransaction,
        incompleteTransaction
      };
    } catch (error) {
      return {
        mode: 'fallback',
        version: '0.0.0',
        approvalRequired: true,
        hasIncompleteTransaction: false
      };
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const dashboard = new UnifiedSystemDashboard();
  dashboard.showCompleteDashboard().catch(console.error);
}

export default UnifiedSystemDashboard;