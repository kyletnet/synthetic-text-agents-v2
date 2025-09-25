#!/usr/bin/env node

/**
 * DLQ Reprocessing CLI
 * Reprocesses failed items from Dead Letter Queue
 *
 * Usage:
 *   npx tsx scripts/dlq_reprocess.ts --run-id <id>        # Reprocess specific run
 *   npx tsx scripts/dlq_reprocess.ts --all               # Reprocess all pending
 *   npx tsx scripts/dlq_reprocess.ts --stats             # Show DLQ stats
 *   npx tsx scripts/dlq_reprocess.ts --cleanup           # Cleanup old entries
 */

import { createDLQManager, DLQItem } from "./lib/dlq_manager.js";
import { createThresholdManager } from "./metrics/threshold_manager.js";

interface ReprocessOptions {
  runId?: string;
  all?: boolean;
  stats?: boolean;
  cleanup?: boolean;
  maxItems?: number;
  dryRun?: boolean;
}

class DLQReprocessor {
  private dlqManager = createDLQManager();
  private thresholdManager = createThresholdManager();

  async reprocessPendingItems(options: ReprocessOptions): Promise<void> {
    console.log("🔄 DLQ Reprocessing Started");
    console.log(`Options:`, JSON.stringify(options, null, 2));

    if (options.stats) {
      await this.showStats(options.runId);
      return;
    }

    if (options.cleanup) {
      await this.cleanupOldEntries();
      return;
    }

    const pendingItems = this.dlqManager.getPendingRetries(options.runId);
    console.log(`Found ${pendingItems.length} pending retry items`);

    if (pendingItems.length === 0) {
      console.log("✅ No items to reprocess");
      return;
    }

    // Limit items if specified
    const itemsToProcess = options.maxItems
      ? pendingItems.slice(0, options.maxItems)
      : pendingItems;

    console.log(
      `Processing ${itemsToProcess.length} items (dry-run: ${options.dryRun || false})`,
    );

    let successCount = 0;
    let failureCount = 0;
    let exhaustedCount = 0;

    for (const item of itemsToProcess) {
      try {
        console.log(
          `\n📋 Processing item ${item.item_id} (retry ${item.retry_count + 1}/${item.max_retries})`,
        );

        if (options.dryRun) {
          console.log(
            `  [DRY-RUN] Would retry item with context:`,
            item.context,
          );
          continue;
        }

        const result = await this.retryItem(item);

        if (result === "success") {
          successCount++;
          console.log(`  ✅ Success`);
        } else if (result === "exhausted") {
          exhaustedCount++;
          console.log(`  ❌ Exhausted retries`);
        } else {
          failureCount++;
          console.log(`  ⚠️  Failed, will retry later`);
        }

        // Small delay between retries to avoid overwhelming services
        await this.sleep(500);
      } catch (error) {
        console.error(`  ❌ Error processing item ${item.item_id}:`, error);
        failureCount++;
      }
    }

    console.log(`\n📊 Reprocessing Summary:`);
    console.log(`  ✅ Successes: ${successCount}`);
    console.log(`  ⚠️  Still failing: ${failureCount}`);
    console.log(`  ❌ Exhausted: ${exhaustedCount}`);
    console.log(`  📋 Total processed: ${itemsToProcess.length}`);
  }

  /**
   * Retry a specific DLQ item
   */
  private async retryItem(
    item: DLQItem,
  ): Promise<"success" | "failure" | "exhausted"> {
    try {
      // Simulate the original operation that failed
      // In practice, this would call the actual agent/operation that failed
      const success = await this.simulateOperation(item);

      if (success) {
        this.dlqManager.markRetryAttempt(item, true);
        return "success";
      } else {
        const updatedItem = this.dlqManager.markRetryAttempt(
          item,
          false,
          new Error("Retry failed"),
        );
        return updatedItem?.next_retry_timestamp === "exhausted"
          ? "exhausted"
          : "failure";
      }
    } catch (error) {
      const updatedItem = this.dlqManager.markRetryAttempt(
        item,
        false,
        error as Error,
      );
      return updatedItem?.next_retry_timestamp === "exhausted"
        ? "exhausted"
        : "failure";
    }
  }

  /**
   * Simulate the operation that originally failed
   * In practice, this would be replaced with actual operation logic
   */
  private async simulateOperation(item: DLQItem): Promise<boolean> {
    // For POLICY errors, never retry (they are permanent failures)
    if (item.error_type === "POLICY") {
      throw new Error("Policy violation - permanent failure");
    }

    // For PERMANENT errors, don't retry
    if (item.error_type === "PERMANENT") {
      throw new Error("Permanent error - will not recover");
    }

    // For TRANSIENT errors, simulate recovery based on error message
    if (item.error_type === "TRANSIENT") {
      const message = item.error_message.toLowerCase();

      // Simulate rate limit recovery
      if (message.includes("429") || message.includes("rate limit")) {
        console.log(`    ⏳ Simulating rate limit recovery...`);
        await this.sleep(1000);
        return Math.random() > 0.3; // 70% success rate after backoff
      }

      // Simulate timeout recovery
      if (message.includes("timeout")) {
        console.log(`    ⏳ Simulating timeout recovery...`);
        return Math.random() > 0.2; // 80% success rate
      }

      // Simulate network recovery
      if (message.includes("network") || message.includes("connection")) {
        console.log(`    ⏳ Simulating network recovery...`);
        return Math.random() > 0.4; // 60% success rate
      }

      // Default transient recovery
      return Math.random() > 0.5; // 50% success rate
    }

    return false;
  }

  /**
   * Show DLQ statistics
   */
  private async showStats(runId?: string): Promise<void> {
    console.log("📊 DLQ Statistics");

    if (runId) {
      console.log(`Run ID: ${runId}`);
    } else {
      console.log("All runs");
    }

    const stats = this.dlqManager.getDLQStats(runId);

    console.log(`\n📋 Total Items: ${stats.total_items}`);

    if (stats.total_items === 0) {
      console.log("🎉 No items in DLQ");
      return;
    }

    console.log(`\n🔍 Error Types:`);
    console.log(`  🔄 Transient: ${stats.transient_errors}`);
    console.log(`  ❌ Permanent: ${stats.permanent_errors}`);
    console.log(`  🚫 Policy: ${stats.policy_errors}`);

    console.log(`\n⏱️  Retry Status:`);
    console.log(`  ⏳ Pending retries: ${stats.pending_retries}`);
    console.log(`  ⛔ Exhausted retries: ${stats.exhausted_retries}`);
    console.log(`  ✅ Success after retry: ${stats.success_after_retry}`);

    // Calculate success rate
    const totalRetryable = stats.transient_errors;
    const successRate =
      totalRetryable > 0
        ? ((stats.success_after_retry / totalRetryable) * 100).toFixed(1)
        : "0";
    console.log(`\n📈 Recovery Success Rate: ${successRate}%`);

    // Show recommendations
    if (stats.pending_retries > 0) {
      console.log(
        `\n💡 Recommendation: Run 'npx tsx scripts/dlq_reprocess.ts --all' to process ${stats.pending_retries} pending items`,
      );
    }

    if (stats.policy_errors > 0) {
      console.log(
        `\n⚠️  Warning: ${stats.policy_errors} policy violations detected (require manual review)`,
      );
    }
  }

  /**
   * Cleanup old DLQ entries
   */
  private async cleanupOldEntries(): Promise<void> {
    console.log("🧹 Cleaning up old DLQ entries...");

    const removed = this.dlqManager.cleanupOldEntries(7); // 7 days

    console.log(`✅ Removed ${removed} old entries (older than 7 days)`);

    const remainingStats = this.dlqManager.getDLQStats();
    console.log(`📋 Remaining DLQ items: ${remainingStats.total_items}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// CLI Entry Point
async function main() {
  const args = process.argv.slice(2);
  const options: ReprocessOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--run-id":
        options.runId = args[++i];
        break;
      case "--all":
        options.all = true;
        break;
      case "--stats":
        options.stats = true;
        break;
      case "--cleanup":
        options.cleanup = true;
        break;
      case "--max-items":
        options.maxItems = parseInt(args[++i]);
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
        showHelp();
        return;
      default:
        console.error(`Unknown option: ${args[i]}`);
        showHelp();
        process.exit(1);
    }
  }

  // Validate options
  if (!options.stats && !options.cleanup && !options.all && !options.runId) {
    console.error("Must specify --all, --run-id, --stats, or --cleanup");
    showHelp();
    process.exit(1);
  }

  try {
    const reprocessor = new DLQReprocessor();
    await reprocessor.reprocessPendingItems(options);
  } catch (error) {
    console.error("❌ DLQ reprocessing failed:", error);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
DLQ Reprocessing CLI

Usage:
  npx tsx scripts/dlq_reprocess.ts [options]

Options:
  --run-id <id>     Reprocess specific run
  --all             Reprocess all pending items
  --stats           Show DLQ statistics
  --cleanup         Cleanup old entries (>7 days)
  --max-items <n>   Limit number of items to process
  --dry-run         Show what would be done without executing
  --help            Show this help

Examples:
  npx tsx scripts/dlq_reprocess.ts --stats
  npx tsx scripts/dlq_reprocess.ts --run-id baseline_2025-09-17_1234
  npx tsx scripts/dlq_reprocess.ts --all --max-items 10
  npx tsx scripts/dlq_reprocess.ts --all --dry-run
  npx tsx scripts/dlq_reprocess.ts --cleanup
`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
