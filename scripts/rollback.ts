#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


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
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "fs";
import { join, dirname } from "path";
import type { SystemSnapshot } from "./lib/governance/snapshot.schema.js";

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

    // Load snapshot data
    const snapshotPath = join(this.snapshotDir, `${latest.id}.json`);
    const snapshot: SystemSnapshot = JSON.parse(
      readFileSync(snapshotPath, "utf-8"),
    );

    console.log("🔄 Restoring files from snapshot...\n");

    let restored = 0;
    let skipped = 0;
    let failed = 0;

    // Restore each file from snapshot
    for (const [relativePath, fileSnapshot] of Object.entries(snapshot.files)) {
      try {
        // Check if content is available
        if (!fileSnapshot.content) {
          console.log(`⚠️  Skipping ${relativePath} (no content in snapshot)`);
          skipped++;
          continue;
        }

        const fullPath = join(this.projectRoot, relativePath);

        // Ensure directory exists
        const dir = dirname(fullPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        // Restore file content
        writeFileSync(fullPath, fileSnapshot.content, "utf-8");

        console.log(`✅ Restored: ${relativePath}`);
        restored++;
      } catch (error) {
        console.error(
          `❌ Failed to restore ${relativePath}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        failed++;
      }
    }

    console.log("\n═".repeat(60));
    console.log("📊 Rollback Summary:");
    console.log(`   ✅ Restored: ${restored} files`);
    console.log(`   ⚠️  Skipped: ${skipped} files`);
    console.log(`   ❌ Failed: ${failed} files`);

    if (failed > 0) {
      console.log(
        "\n⚠️  Some files failed to restore. Manual intervention may be required.",
      );
      process.exit(1);
    } else if (skipped > 0) {
      console.log("\n⚠️  Some files were skipped (no content in snapshot).");
      console.log(
        "💡 Consider creating a new snapshot to capture current state.",
      );
    } else {
      console.log("\n✅ Rollback completed successfully!");
    }
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
