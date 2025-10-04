#!/usr/bin/env tsx

/**
 * Auto-Rollback System
 *
 * Purpose:
 * - Restore from latest snapshot on failure
 * - Automatic recovery mechanism
 *
 * Usage:
 *   npm run rollback        # Rollback to latest snapshot
 *   npm run rollback:list   # List available snapshots
 */

import { execSync } from "child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

class RollbackSystem {
  private projectRoot: string;
  private snapshotDir: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.snapshotDir = join(this.projectRoot, "reports", "snapshots");
  }

  async rollback(): Promise<void> {
    console.log("🔄 Auto-Rollback System");
    console.log("═".repeat(60));

    const snapshots = this.listSnapshots();

    if (snapshots.length === 0) {
      console.error("❌ No snapshots found. Cannot rollback.");
      process.exit(1);
    }

    const latest = snapshots[0];
    console.log(`\n📸 Rolling back to: ${latest.id}`);
    console.log(`   Created: ${latest.timestamp}`);
    console.log(`   Files: ${latest.fileCount}\n`);

    // TODO: Implement actual file restoration from snapshot
    console.log("⚠️  Rollback mechanism not yet fully implemented");
    console.log("💡 Manual rollback: git stash && git reset --hard HEAD~1");
  }

  listSnapshots(): Array<{ id: string; timestamp: Date; fileCount: number }> {
    if (!existsSync(this.snapshotDir)) {
      return [];
    }

    return readdirSync(this.snapshotDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        const path = join(this.snapshotDir, f);
        const content = JSON.parse(readFileSync(path, "utf-8"));
        const stats = statSync(path);

        return {
          id: f.replace(".json", ""),
          timestamp: stats.mtime,
          fileCount: Object.keys(content.files || {}).length,
        };
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

const system = new RollbackSystem();

if (command === "list") {
  const snapshots = system.listSnapshots();
  console.log(`Found ${snapshots.length} snapshots:`);
  snapshots.forEach((s, i) => {
    console.log(`${i + 1}. ${s.id} (${s.timestamp.toLocaleString()})`);
  });
} else {
  await system.rollback();
}
