#!/usr/bin/env tsx

/**
 * 승인 대기 큐 처리 스크립트
 * /approve 명령어 구현
 */

import { approvalQueue } from "./lib/approval-queue.js";
import { simplifiedApproval } from "./lib/simplified-approval-system.js";
import { detectEnvironment } from "./lib/env-detection.js";

class ApprovalQueueHandler {
  /**
   * 대기 중인 승인 요청들을 보여주고 처리
   */
  async processQueue(): Promise<void> {
    const pendingItems = approvalQueue.getPendingItemsSorted();

    if (pendingItems.length === 0) {
      console.log("📭 승인 대기 큐가 비어있습니다.");
      console.log("💡 메인테넌스를 실행하면 승인 요청이 생성됩니다.");
      return;
    }

    const stats = approvalQueue.getQueueStats();

    console.log("📋 승인 대기 큐 현황");
    console.log("=".repeat(60));
    console.log(`📊 총 ${stats.total}개 항목 대기 중`);
    console.log(`🔴 Critical: ${stats.byPriority.critical}개`);
    console.log(`🟠 High: ${stats.byPriority.high}개`);
    console.log(`🟡 Medium: ${stats.byPriority.medium}개`);
    console.log(`🟢 Low: ${stats.byPriority.low}개`);

    if (stats.oldestItem) {
      const daysSince = Math.floor(
        (Date.now() - stats.oldestItem.getTime()) / (1000 * 60 * 60 * 24),
      );
      console.log(`⏰ 가장 오래된 항목: ${daysSince}일 전`);
    }

    console.log("\n🔄 대기 항목들을 순서대로 처리합니다...\n");

    for (let i = 0; i < pendingItems.length; i++) {
      const item = pendingItems[i];
      console.log(`\n📋 ${i + 1}/${pendingItems.length}: ${item.title}`);
      console.log(`🕐 생성: ${new Date(item.createdAt).toLocaleString()}`);
      console.log(`🔄 시도: ${item.attempts}회`);

      const result = await simplifiedApproval.requestApproval(
        {
          title: item.title,
          description: item.description,
          command: item.command,
          impact: item.impact,
        },
        false,
      ); // safe 모드는 아님

      // 결과 처리
      if (result.approved) {
        console.log(`✅ 승인됨: ${item.title}`);
        approvalQueue.removeItem(item.id);

        // 실제 명령어 실행 (필요시)
        if (item.command && item.command.trim()) {
          console.log(`⚡ 명령어 실행: ${item.command}`);
          try {
            const { execSync } = await import("child_process");
            execSync(item.command, { stdio: "inherit" });
            console.log(`✅ 명령어 실행 완료`);
          } catch (error) {
            console.log(`❌ 명령어 실행 실패: ${error}`);
          }
        }
      } else if (result.action === "abort") {
        console.log(`🛑 사용자가 승인 처리를 중단했습니다.`);
        break;
      } else if (result.action === "manual") {
        console.log(`🔧 수동 처리로 표시됨: ${item.title}`);
        console.log(`💻 실행할 명령어: ${item.command}`);
        approvalQueue.removeItem(item.id);
      } else {
        // skip - 큐에서 제거하지 않고 다음에 다시 처리
        console.log(`⏭️ 건너뛰기: ${item.title} (큐에 남김)`);
      }
    }

    // 최종 상태
    const remainingItems = approvalQueue.getPendingItems();
    if (remainingItems.length > 0) {
      console.log(
        `\n📊 처리 완료: ${remainingItems.length}개 항목이 큐에 남아있습니다.`,
      );
      console.log(`💡 다시 처리하려면: npm run approve`);
    } else {
      console.log(`\n🎉 모든 승인 요청이 처리되었습니다!`);
    }
  }

  /**
   * 큐 상태만 보기
   */
  async showQueueStatus(): Promise<void> {
    const pendingItems = approvalQueue.getPendingItemsSorted();
    const stats = approvalQueue.getQueueStats();

    if (pendingItems.length === 0) {
      console.log("📭 승인 대기 큐가 비어있습니다.");
      return;
    }

    console.log("📋 승인 대기 큐 상태");
    console.log("=".repeat(60));
    console.log(`📊 총 ${stats.total}개 항목`);
    console.log(`🔴 Critical: ${stats.byPriority.critical}개`);
    console.log(`🟠 High: ${stats.byPriority.high}개`);
    console.log(`🟡 Medium: ${stats.byPriority.medium}개`);
    console.log(`🟢 Low: ${stats.byPriority.low}개`);

    console.log("\n📋 대기 항목 목록:");
    pendingItems.slice(0, 10).forEach((item, idx) => {
      const priority =
        item.priority === "critical"
          ? "🔴"
          : item.priority === "high"
            ? "🟠"
            : item.priority === "medium"
              ? "🟡"
              : "🟢";
      console.log(
        `   ${idx + 1}. ${priority} ${item.title} (${item.attempts}회 시도)`,
      );
    });

    if (pendingItems.length > 10) {
      console.log(`   ... 및 ${pendingItems.length - 10}개 추가 항목`);
    }

    console.log("\n💡 처리 명령어:");
    console.log("   npm run approve           # 대화형 승인 처리");
    console.log("   npm run approve:clear     # 큐 초기화");
  }

  /**
   * 큐 초기화
   */
  async clearQueue(): Promise<void> {
    const stats = approvalQueue.getQueueStats();

    if (stats.total === 0) {
      console.log("📭 승인 대기 큐가 이미 비어있습니다.");
      return;
    }

    console.log(
      `⚠️ ${stats.total}개의 승인 대기 항목을 모두 삭제하시겠습니까?`,
    );
    console.log("   (y/N): ");

    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question("", (answer) => {
        rl.close();

        if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
          approvalQueue.clearQueue();
          console.log("✅ 승인 대기 큐를 초기화했습니다.");
        } else {
          console.log("❌ 취소되었습니다.");
        }

        resolve();
      });
    });
  }
}

// CLI 실행
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const handler = new ApprovalQueueHandler();
  const args = process.argv.slice(2);

  if (args.includes("--status") || args.includes("-s")) {
    handler.showQueueStatus();
  } else if (args.includes("--clear") || args.includes("-c")) {
    handler.clearQueue();
  } else {
    handler.processQueue();
  }
}

export { ApprovalQueueHandler };
