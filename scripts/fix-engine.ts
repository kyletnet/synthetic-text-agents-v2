#!/usr/bin/env tsx

/**
 * Fix Engine - Interactive or non-interactive manual approval
 *
 * GPT Advice:
 * "fix must reuse the cached inspection results for consistency"
 * "Never auto-trigger fallback inspection inside /fix"
 *
 * Design:
 * 1. Enforce /inspect must run first
 * 2. Read manualApprovalNeeded items from cache
 * 3. Interactive approval (y/n/m/a/i) OR non-interactive list mode
 * 4. Display results
 *
 * Usage:
 *   npm run fix                     # Interactive mode (for humans)
 *   npm run fix -- --non-interactive # List-only mode (for AI assistants)
 *
 * This file NEVER diagnoses. It only reads from inspection-results.json.
 */

import { createInterface } from "readline";
import { InspectionCache } from "./lib/inspection-cache.js";
import { GovernanceRunner } from "./lib/governance/governance-runner.js";
import { SafeExecutor } from "./lib/governance/safe-executor.js";
import type { ManualApprovalItem } from "./lib/inspection-schema.js";

class FixEngine {
  private cache: InspectionCache;
  private governance: GovernanceRunner;
  private safeExecutor: SafeExecutor;
  private projectRoot: string;
  private fixed = 0;
  private skipped = 0;
  private manual = 0;
  private nonInteractive: boolean;

  constructor() {
    this.projectRoot = process.cwd();
    this.cache = new InspectionCache(this.projectRoot);
    this.governance = new GovernanceRunner(this.projectRoot);
    this.safeExecutor = new SafeExecutor(this.projectRoot);
    this.nonInteractive = process.argv.includes("--non-interactive");
  }

  /**
   * Main entry point
   */
  async run(): Promise<void> {
    const mode = this.nonInteractive
      ? "Non-Interactive List"
      : "Interactive Manual Approval";
    console.log(`⚠️  Fix Engine - ${mode}`);
    console.log("═".repeat(60));

    try {
      // Run with governance enforcement
      await this.governance.executeWithGovernance(
        async () => {
          // 1. Enforce /inspect first (GPT Advice)
          console.log("\n📋 Checking inspection results...");
          this.cache.enforceInspectFirst("fix");

          // 2. Load cached results
          const validation = this.cache.validateCache();
          if (!validation.valid || !validation.results) {
            console.error(
              "\n❌ Internal error: cache validation passed but no results",
            );
            process.exit(1);
          }

          const { results } = validation;
          const age = this.cache.getCacheAge();
          console.log(`✅ Using inspection results from ${age}`);

          // 3. Check if there are manual approval items
          if (results.manualApprovalNeeded.length === 0) {
            console.log("\n✨ No manual approval items found!");
            console.log("\n💡 All issues resolved! Run: npm run ship");
            return;
          }

          console.log(
            `\n⚠️  Found ${results.manualApprovalNeeded.length} items needing approval\n`,
          );

          // 4. Interactive or non-interactive mode
          if (this.nonInteractive) {
            this.listApprovalItems(results.manualApprovalNeeded);
          } else {
            await this.interactiveApproval(results.manualApprovalNeeded);
          }

          // 5. Show summary
          this.showSummary();
        },
        {
          name: "fix",
          type: "user-input" as const, // Allow infinite wait for both modes
          description: this.nonInteractive
            ? "List manual approval items"
            : "Interactive manual approval",
          skipSnapshot: false,
          skipVerification: false,
        },
      );
    } catch (error) {
      console.error("\n❌ Fix engine failed with critical error:");
      console.error(error);
      console.error("\n💡 Please report this error to the development team");
      process.exit(1);
    }
  }

  /**
   * Non-interactive list mode (for AI assistants)
   */
  private listApprovalItems(items: ManualApprovalItem[]): void {
    console.log("\n📋 Manual Approval Items (Non-Interactive Mode)");
    console.log("═".repeat(60));

    items.forEach((item, idx) => {
      const icon = item.severity === "critical" ? "🔴" : "🟡";
      console.log(`\n${idx + 1}. ${icon} ${item.description}`);
      console.log(`   • Severity: ${item.severity.toUpperCase()}`);
      console.log(`   • Count: ${item.count || 1}`);
      console.log(`   • Impact: ${item.impact}`);
      console.log(`   • Action: ${item.suggestedAction}`);

      if (item.files && item.files.length > 0) {
        console.log(`   • Files (top 3):`);
        item.files.slice(0, 3).forEach((file) => {
          console.log(`     - ${file}`);
        });
        if (item.files.length > 3) {
          console.log(`     ... and ${item.files.length - 3} more`);
        }
      }
    });

    console.log("\n" + "═".repeat(60));
    console.log("💡 These items require human decision or implementation");
    console.log("   Run without --non-interactive for interactive mode");
    console.log("\n✅ /fix analysis complete - no changes made");
  }

  /**
   * Interactive approval for each item
   */
  private async interactiveApproval(
    items: ManualApprovalItem[],
  ): Promise<void> {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const icon = item.severity === "critical" ? "🔴" : "🟡";

      // 눈에 띄는 구분선
      console.log("\n" + "═".repeat(70));
      console.log(`📋 항목 ${i + 1}/${items.length} - 승인이 필요합니다`);
      console.log("═".repeat(70));

      // 심각도 색상 강조
      const severityIcon =
        item.severity === "critical" ? "🚨 긴급" : "⚠️  주의";
      console.log(`\n${icon} ${severityIcon}: ${item.description}`);

      console.log(`\n📊 상세 정보:`);
      console.log(`   • 심각도: ${item.severity.toUpperCase()}`);
      console.log(`   • 발견 개수: ${item.count}개`);
      console.log(`   • 영향: ${item.impact}`);

      console.log(`\n💡 권장 조치:`);
      console.log(`   ${item.suggestedAction}`);

      if (item.files && item.files.length > 0) {
        console.log(
          `\n📁 영향 받는 파일 (상위 ${Math.min(5, item.files.length)}개):`,
        );
        item.files.slice(0, 5).forEach((file, idx) => {
          console.log(`   ${idx + 1}. ${file}`);
        });
        if (item.files.length > 5) {
          console.log(`   ... 외 ${item.files.length - 5}개 파일`);
        }
      }

      // 비개발자를 위한 설명
      console.log(`\n🤔 이것은 무엇인가요?`);
      const explanation = this.getExplanation(item.id);
      console.log(`   ${explanation}`);

      console.log(`\n💬 개발자에게 물어볼 질문:`);
      const questions = this.getSuggestedQuestions(item.id);
      questions.forEach((q, idx) => {
        console.log(`   ${idx + 1}. ${q}`);
      });

      // 눈에 띄는 승인 요청
      console.log("\n" + "─".repeat(70));
      console.log("🔵 결정을 내려주세요:");
      console.log("   y = 승인 (이 문제를 해결하겠습니다)");
      console.log("   n = 건너뛰기 (나중에 처리)");
      console.log("   m = 수동 처리 (직접 확인 필요)");
      console.log("   a = 전체 중단");
      console.log("   i = 더 자세한 정보 보기");
      console.log("─".repeat(70));

      const answer = await this.prompt(rl, "\n👉 선택 [y/n/m/a/i]: ");

      console.log(""); // 빈 줄

      switch (answer.toLowerCase()) {
        case "y":
          console.log("   ✅ 승인됨 - 개발자가 수동으로 검토합니다");
          this.fixed++;
          break;

        case "n":
          console.log("   ⏭️  건너뜀 - 나중에 다시 검토합니다");
          this.skipped++;
          break;

        case "m":
          console.log("   📝 수동 처리로 표시됨 - 직접 확인이 필요합니다");
          this.manual++;
          break;

        case "a":
          console.log("\n🛑 전체 중단 - 현재까지 처리 내용이 저장되었습니다");
          rl.close();
          process.exit(0);

        case "i":
          console.log("\n📖 추가 정보:");
          console.log(`   ID: ${item.id}`);
          console.log(`   전체 영향: ${item.impact}`);
          if (item.files) {
            console.log(`   전체 파일 목록: ${item.files.join(", ")}`);
          }
          i--; // 이 항목 다시 묻기
          break;

        default:
          console.log("   ⚠️  잘못된 입력입니다. 건너뜁니다.");
          this.skipped++;
      }
    }

    rl.close();
  }

  /**
   * Get user-friendly explanation for non-developers
   */
  private getExplanation(itemId: string): string {
    const explanations: Record<string, string> = {
      "typescript-errors":
        "TypeScript 컴파일 오류는 코드의 타입이 맞지 않아 발생합니다. 빌드가 실패할 수 있습니다.",
      "eslint-errors":
        "ESLint 오류는 코드 품질 규칙을 위반한 것입니다. 잠재적 버그나 보안 문제일 수 있습니다.",
      workarounds:
        "TODO/FIXME 마커는 임시 해결책이나 나중에 수정해야 할 부분을 표시한 것입니다.",
      "component-documentation":
        "컴포넌트 문서가 누락되면 다른 개발자가 코드를 이해하기 어렵습니다.",
      "refactor-pending":
        "리팩토링 대기 항목은 코드 구조를 개선해야 하는 부분입니다. 유지보수성을 높입니다.",
    };
    return (
      explanations[itemId] ||
      "시스템 품질을 개선하기 위해 검토가 필요한 항목입니다."
    );
  }

  /**
   * Get suggested questions for developers
   */
  private getSuggestedQuestions(itemId: string): string[] {
    const questions: Record<string, string[]> = {
      "typescript-errors": [
        "이 TypeScript 오류가 빌드에 영향을 미치나요?",
        "얼마나 긴급하게 수정해야 하나요?",
        "수정하는데 얼마나 걸릴까요?",
      ],
      "eslint-errors": [
        "이 ESLint 오류가 보안 문제인가요?",
        "프로덕션에 영향을 미칠 수 있나요?",
        "지금 당장 수정해야 하나요?",
      ],
      workarounds: [
        "이 TODO 마커들 중 긴급한 것이 있나요?",
        "언제까지 해결해야 하나요?",
        "어떤 것부터 우선 처리해야 하나요?",
      ],
      "component-documentation": [
        "문서가 없으면 어떤 문제가 생기나요?",
        "언제까지 문서를 작성해야 하나요?",
        "누가 문서를 작성해야 하나요?",
      ],
      "refactor-pending": [
        "리팩토링을 안 하면 어떤 문제가 생기나요?",
        "언제 리팩토링을 진행할 계획인가요?",
        "리팩토링에 얼마나 시간이 걸릴까요?",
      ],
    };
    return (
      questions[itemId] || [
        "이것은 얼마나 중요한가요?",
        "언제까지 처리해야 하나요?",
        "누가 담당해야 하나요?",
      ]
    );
  }

  /**
   * Prompt helper
   */
  private prompt(rl: any, question: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(question, (answer: string) => {
        resolve(answer);
      });
    });
  }

  /**
   * Show summary
   */
  private showSummary(): void {
    console.log("\n" + "═".repeat(60));
    console.log("📊 Fix Session Summary:");
    console.log(`   ✅ Approved: ${this.fixed}`);
    console.log(`   ⏭️  Skipped: ${this.skipped}`);
    console.log(`   📝 Manual: ${this.manual}`);

    console.log("\n🚀 Next Steps:");
    if (this.fixed > 0 || this.manual > 0) {
      console.log(
        `   1. Address ${this.fixed + this.manual} approved/manual items`,
      );
      console.log("   2. Re-run: npm run status");
      console.log("   3. Verify: npm run ship");
    } else {
      console.log("   → npm run ship (final verification)");
    }
  }
}

// Main execution
const engine = new FixEngine();
await engine.run();
