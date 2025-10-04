#!/usr/bin/env tsx

/**
 * /fix 명령어 - 대화형 품질 수정 시스템
 *
 * ⚠️  DEPRECATED: This file is no longer directly executable.
 * Use scripts/fix-engine.ts instead.
 *
 * 철학: 사용자가 하나씩 승인하며 수정
 *
 * 역할:
 * - 수정 항목 수집 (code-quality, documentation, workaround, refactor)
 * - 심각도별 우선순위 정렬
 * - 대화형 승인 (y/n/m/a/i)
 * - 수정 실행 및 결과 보고
 *
 * 워크플로우 위치:
 * 1. npm run status    (진단)
 * 2. npm run maintain  (자동 수정)
 * 3. npm run fix       (대화형 수정) ← 여기
 * 4. npm run ship      (배포 준비)
 */

// Governance: Block direct execution
if (require.main === module) {
  throw new Error(`
❌ DEPRECATED: fix-orchestrator.ts는 더 이상 직접 실행할 수 없습니다.

✅ 올바른 사용법:
   npm run fix       # 대화형 수정 (캐시 기반)
   npm run status    # 진단 재실행

📚 자세한 내용: docs/MIGRATION_V2.md
📋 새로운 구현: scripts/fix-engine.ts

이 파일은 테스트 호환성을 위해 import는 계속 허용됩니다.
  `);
}

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { simplifiedApproval } from "./lib/simplified-approval-system.js";

interface FixItem {
  id: string;
  category: "code-quality" | "documentation" | "workaround" | "refactor";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  command?: string;
  autoFixable: boolean;
  impact: string;
  files?: string[];
}

interface FixSession {
  timestamp: Date;
  totalItems: number;
  fixed: number;
  skipped: number;
  failed: number;
  items: FixItem[];
  results: Array<{
    item: FixItem;
    status: "fixed" | "skipped" | "failed";
    message: string;
  }>;
}

class FixOrchestrator {
  private session: FixSession;
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.session = {
      timestamp: new Date(),
      totalItems: 0,
      fixed: 0,
      skipped: 0,
      failed: 0,
      items: [],
      results: [],
    };
  }

  /**
   * 메인 실행 (대화형 수정)
   */
  async run(): Promise<void> {
    console.log("🔧 Fix Orchestrator - 대화형 품질 수정");
    console.log("═".repeat(60));
    console.log("💡 이 명령어 실행 전: npm run status, npm run maintain\n");

    // 1. 수정 항목 수집
    console.log("📊 1단계: 수정 항목 수집 중...\n");
    await this.collectFixItems();

    if (this.session.items.length === 0) {
      console.log("✨ 수정할 항목이 없습니다!");
      console.log("\n💡 다음 단계: npm run ship (배포 준비)");
      return;
    }

    console.log(`\n📋 총 ${this.session.items.length}개 수정 항목 발견\n`);
    this.showFixSummary();

    // 2. 대화형 수정
    console.log("\n🔧 2단계: 대화형 수정 시작\n");
    await this.interactiveFix();

    // 3. 결과 보고
    this.showResults();

    // 4. 세션 저장
    this.saveSession();

    // 5. 다음 단계 안내
    this.showNextSteps();
  }

  /**
   * 수정 항목 수집
   */
  private async collectFixItems(): Promise<void> {
    // 1. Code Quality 이슈
    await this.collectCodeQualityIssues();

    // 2. 문서화 이슈
    await this.collectDocumentationIssues();

    // 3. 워크어라운드
    await this.collectWorkarounds();

    // 4. 리팩토링 이슈
    await this.collectRefactorIssues();

    this.session.totalItems = this.session.items.length;
  }

  /**
   * Code Quality 이슈 수집
   */
  private async collectCodeQualityIssues(): Promise<void> {
    // Prettier
    try {
      execSync("npx prettier --check .", { stdio: "ignore" });
    } catch {
      this.session.items.push({
        id: "prettier-format",
        category: "code-quality",
        severity: "low",
        description: "코드 포매팅 불일치",
        command: "npx prettier --write .",
        autoFixable: true,
        impact: "코드 스타일 일관성 개선",
      });
    }

    // ESLint
    try {
      const lintOutput = execSync("npm run dev:lint", {
        encoding: "utf8",
        stdio: "pipe",
      });
      const warningCount = (lintOutput.match(/warning/g) || []).length;
      if (warningCount > 0) {
        this.session.items.push({
          id: "eslint-warnings",
          category: "code-quality",
          severity: "low",
          description: `ESLint 경고 ${warningCount}개`,
          command: "npm run lint:fix",
          autoFixable: true,
          impact: "코드 품질 개선, 미사용 변수 정리",
        });
      }
    } catch (error: any) {
      const errorCount = (error.stdout?.match(/error/g) || []).length;
      if (errorCount > 0) {
        this.session.items.push({
          id: "eslint-errors",
          category: "code-quality",
          severity: "high",
          description: `ESLint 오류 ${errorCount}개`,
          command: "npm run lint:fix",
          autoFixable: false,
          impact: "코드 오류 수정 필요",
        });
      }
    }

    // TypeScript
    try {
      execSync("npm run dev:typecheck", { stdio: "ignore" });
    } catch {
      this.session.items.push({
        id: "typescript-errors",
        category: "code-quality",
        severity: "critical",
        description: "TypeScript 컴파일 오류",
        command: "npm run dev:typecheck",
        autoFixable: false,
        impact: "타입 안정성 복구 필요",
      });
    }
  }

  /**
   * 문서화 이슈 수집
   */
  private async collectDocumentationIssues(): Promise<void> {
    try {
      const registryPath = join(
        this.projectRoot,
        "reports/component-registry.json",
      );
      if (!existsSync(registryPath)) {
        return;
      }

      const registry = JSON.parse(readFileSync(registryPath, "utf8"));
      const total = registry.summary?.totalComponents || 0;
      const compliant = registry.summary?.compliantComponents || 0;
      const nonCompliant = total - compliant;

      if (nonCompliant > 0) {
        this.session.items.push({
          id: "component-documentation",
          category: "documentation",
          severity: "medium",
          description: `컴포넌트 문서화 누락 ${nonCompliant}개 (${total}개 중 ${compliant}개만 완료)`,
          autoFixable: true,
          impact: "컴포넌트 문서화 준수율 개선",
        });
      }
    } catch {
      // 레지스트리 파일 없음 - 무시
    }
  }

  /**
   * 워크어라운드 수집
   */
  private async collectWorkarounds(): Promise<void> {
    try {
      // TODO, FIXME, HACK, WORKAROUND 패턴 검색
      const patterns = ["TODO", "FIXME", "HACK", "WORKAROUND"];
      let totalCount = 0;

      for (const pattern of patterns) {
        try {
          const output = execSync(
            `grep -r "${pattern}" src/ scripts/ --exclude-dir=node_modules --exclude-dir=dist 2>/dev/null | wc -l`,
            { encoding: "utf8" },
          );
          totalCount += parseInt(output.trim()) || 0;
        } catch {
          // grep 실패 - 무시
        }
      }

      if (totalCount > 0) {
        this.session.items.push({
          id: "workarounds",
          category: "workaround",
          severity: "medium",
          description: `워크어라운드/TODO 마커 ${totalCount}개`,
          autoFixable: false,
          impact: "기술 부채 감소, 코드 품질 개선",
        });
      }
    } catch {
      // 무시
    }
  }

  /**
   * 리팩토링 이슈 수집
   */
  private async collectRefactorIssues(): Promise<void> {
    try {
      const refactorStatePath = join(this.projectRoot, ".refactor/state.json");
      if (!existsSync(refactorStatePath)) {
        return;
      }

      const state = JSON.parse(readFileSync(refactorStatePath, "utf8"));
      const pendingCount = state.pending?.length || 0;

      if (pendingCount > 0) {
        this.session.items.push({
          id: "refactor-pending",
          category: "refactor",
          severity: "medium",
          description: `리팩토링 대기 항목 ${pendingCount}개`,
          autoFixable: false,
          impact: "코드 구조 개선, 유지보수성 향상",
        });
      }
    } catch {
      // 무시
    }
  }

  /**
   * 수정 항목 요약 표시
   */
  private showFixSummary(): void {
    const byCategory = this.session.items.reduce(
      (acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const bySeverity = this.session.items.reduce(
      (acc, item) => {
        acc[item.severity] = (acc[item.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log("📊 카테고리별:");
    Object.entries(byCategory).forEach(([cat, count]) => {
      const icon = {
        "code-quality": "🔍",
        documentation: "📚",
        workaround: "🔧",
        refactor: "♻️",
      }[cat];
      console.log(`   ${icon} ${cat}: ${count}개`);
    });

    console.log("\n⚡ 심각도별:");
    Object.entries(bySeverity).forEach(([sev, count]) => {
      const icon = {
        low: "🟢",
        medium: "🟡",
        high: "🟠",
        critical: "🔴",
      }[sev];
      console.log(`   ${icon} ${sev}: ${count}개`);
    });

    const autoFixable = this.session.items.filter((i) => i.autoFixable).length;
    console.log(`\n✨ 자동 수정 가능: ${autoFixable}개`);
  }

  /**
   * 대화형 수정
   */
  private async interactiveFix(): Promise<void> {
    // 심각도 순으로 정렬
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const sortedItems = [...this.session.items].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
    );

    for (let i = 0; i < sortedItems.length; i++) {
      const item = sortedItems[i];
      const icon = {
        low: "🟢",
        medium: "🟡",
        high: "🟠",
        critical: "🔴",
      }[item.severity];

      console.log(
        `\n${icon} [${i + 1}/${sortedItems.length}] ${item.description}`,
      );
      console.log(`   카테고리: ${item.category}`);
      console.log(`   영향: ${item.impact}`);
      if (item.command) {
        console.log(`   명령어: ${item.command}`);
      }
      console.log(`   자동 수정: ${item.autoFixable ? "가능" : "불가능"}`);

      // 승인 요청
      const result = await simplifiedApproval.requestApproval(
        {
          title: item.description,
          description: `${item.category} 수정`,
          command: item.command,
          impact: item.impact,
        },
        false,
      );

      if (result.approved) {
        // 수정 실행
        await this.executeFixItem(item);
      } else if (result.action === "skip") {
        this.session.skipped++;
        this.session.results.push({
          item,
          status: "skipped",
          message: "사용자가 건너뜀",
        });
        console.log("   ⏭️  건너뜀");
      } else if (result.action === "abort") {
        console.log("\n🛑 사용자가 수정 세션을 중단했습니다.");
        break;
      }
    }
  }

  /**
   * 수정 항목 실행
   */
  private async executeFixItem(item: FixItem): Promise<void> {
    console.log(`\n🔧 실행 중: ${item.description}`);

    try {
      if (item.id === "prettier-format") {
        execSync("npx prettier --write .", { stdio: "inherit" });
      } else if (item.id === "eslint-warnings" || item.id === "eslint-errors") {
        execSync("npm run lint:fix", { stdio: "inherit" });
      } else if (item.id === "component-documentation") {
        await this.fixComponentDocumentation();
      } else if (item.id === "workarounds") {
        console.log("   💡 워크어라운드는 수동으로 검토가 필요합니다.");
        console.log("   📝 다음 명령으로 목록 확인:");
        console.log(
          '      grep -rn "TODO\\|FIXME\\|HACK\\|WORKAROUND" src/ scripts/',
        );
        this.session.skipped++;
        this.session.results.push({
          item,
          status: "skipped",
          message: "수동 검토 필요",
        });
        return;
      } else if (item.command) {
        execSync(item.command, { stdio: "inherit" });
      }

      this.session.fixed++;
      this.session.results.push({
        item,
        status: "fixed",
        message: "수정 완료",
      });
      console.log("   ✅ 수정 완료");
    } catch (error: any) {
      this.session.failed++;
      this.session.results.push({
        item,
        status: "failed",
        message: error.message || "수정 실패",
      });
      console.log(`   ❌ 수정 실패: ${error.message}`);
    }
  }

  /**
   * 컴포넌트 문서화 자동 수정
   */
  private async fixComponentDocumentation(): Promise<void> {
    console.log("   📚 컴포넌트 문서 템플릿 생성 중...");

    try {
      const registryPath = join(
        this.projectRoot,
        "reports/component-registry.json",
      );
      const registry = JSON.parse(readFileSync(registryPath, "utf8"));

      let fixedCount = 0;
      const components = registry.components || [];

      for (const component of components) {
        if (component.compliance?.issues?.includes("Missing documentation")) {
          // 문서 템플릿 생성
          const docPath = component.path.replace(/\.ts$/, ".md");
          if (!existsSync(docPath)) {
            const template = this.generateDocTemplate(component);
            writeFileSync(docPath, template);
            fixedCount++;
            console.log(`      ✅ ${docPath} 생성`);
          }
        }
      }

      console.log(`   📝 ${fixedCount}개 문서 템플릿 생성 완료`);

      // 레지스트리 재생성
      console.log("   🔄 컴포넌트 레지스트리 갱신 중...");
      execSync("npm run registry:generate", { stdio: "inherit" });
    } catch (error: any) {
      console.log(`   ⚠️  일부 문서 생성 실패: ${error.message}`);
    }
  }

  /**
   * 문서 템플릿 생성
   */
  private generateDocTemplate(component: any): string {
    return `# ${component.name}

## 개요

${component.description || "컴포넌트 설명을 작성하세요."}

## 사용법

\`\`\`bash
npm run ${component.name}
\`\`\`

## 설정

(필요한 환경 변수 또는 설정 파일)

## 예제

\`\`\`typescript
// 사용 예제
\`\`\`

## 관련 문서

- [시스템 아키텍처](../../docs/ARCHITECTURE.md)
- [개발 가이드](../../docs/DEVELOPMENT_STANDARDS.md)

---

*자동 생성된 문서 템플릿입니다. 내용을 채워주세요.*
`;
  }

  /**
   * 결과 보고
   */
  private showResults(): void {
    console.log("\n" + "═".repeat(60));
    console.log("📊 수정 결과");
    console.log("═".repeat(60));

    console.log(`\n⏱️  소요 시간: ${this.getElapsedTime()}`);
    console.log(`📋 총 항목: ${this.session.totalItems}개`);
    console.log(`✅ 수정 완료: ${this.session.fixed}개`);
    console.log(`⏭️  건너뜀: ${this.session.skipped}개`);
    console.log(`❌ 실패: ${this.session.failed}개`);

    const successRate = Math.round(
      (this.session.fixed / this.session.totalItems) * 100,
    );
    console.log(`\n📈 성공률: ${successRate}%`);

    if (this.session.fixed > 0) {
      console.log("\n✅ 수정된 항목:");
      this.session.results
        .filter((r) => r.status === "fixed")
        .forEach((r) => {
          console.log(`   ✅ ${r.item.description}`);
        });
    }

    if (this.session.skipped > 0) {
      console.log("\n⏭️  건너뛴 항목:");
      this.session.results
        .filter((r) => r.status === "skipped")
        .forEach((r) => {
          console.log(`   ⏭️  ${r.item.description}: ${r.message}`);
        });
    }

    if (this.session.failed > 0) {
      console.log("\n❌ 실패한 항목:");
      this.session.results
        .filter((r) => r.status === "failed")
        .forEach((r) => {
          console.log(`   ❌ ${r.item.description}: ${r.message}`);
        });
    }

    console.log("\n💡 다음 단계:");
    if (this.session.fixed > 0) {
      console.log("   1. npm run status      # 건강도 재측정");
      console.log("   2. npm run test        # 테스트 실행");
      console.log("   3. git add -A && git commit -m 'fix: 품질 개선'");
    }
    if (this.session.skipped > 0 || this.session.failed > 0) {
      console.log("   4. /fix                # 나머지 항목 다시 수정");
    }
  }

  /**
   * 다음 단계 안내
   */
  private showNextSteps(): void {
    console.log("\n" + "═".repeat(60));
    console.log("🎯 다음 단계");
    console.log("═".repeat(60));

    if (this.session.fixed > 0) {
      console.log("\n✅ 수정 사항이 있습니다:");
      console.log("   1. git add -A                    # 변경사항 스테이징");
      console.log('   2. git commit -m "fix: 품질 개선" # 커밋');
      console.log("   3. npm run ship                  # 배포 준비");
    } else if (this.session.skipped > 0) {
      console.log("\n💡 건너뛴 항목이 있습니다:");
      console.log("   - npm run fix                    # 다시 실행");
    } else {
      console.log("\n✨ 모든 항목이 완료되었습니다!");
      console.log("   - npm run ship                   # 배포 준비");
    }

    console.log("\n📚 전체 워크플로우:");
    console.log("   1. npm run status    # 진단");
    console.log("   2. npm run maintain  # 자동 수정");
    console.log("   3. npm run fix       # 대화형 수정");
    console.log("   4. npm run ship      # 배포 준비");
    console.log("");
  }

  /**
   * 경과 시간 계산
   */
  private getElapsedTime(): string {
    const elapsed = Date.now() - this.session.timestamp.getTime();
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}분 ${seconds % 60}초`;
    }
    return `${seconds}초`;
  }

  /**
   * 세션 저장
   */
  private saveSession(): void {
    const sessionPath = join(
      this.projectRoot,
      "reports/.fix-sessions/latest.json",
    );
    writeFileSync(sessionPath, JSON.stringify(this.session, null, 2));
    console.log(`\n💾 세션 저장: ${sessionPath}`);
  }
}

// CLI 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  const orchestrator = new FixOrchestrator();
  orchestrator.run().catch((error) => {
    console.error("\n❌ Fix Orchestrator 실패:", error);
    process.exit(1);
  });
}

export default FixOrchestrator;
