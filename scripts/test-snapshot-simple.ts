#!/usr/bin/env tsx

/**
 * Simple Snapshot Test
 *
 * Test that snapshots capture file content correctly
 */

import { getSnapshotManager } from "./lib/governance/snapshot-manager.js";
import { readFileSync } from "fs";
import { join } from "path";

async function test() {
  console.log("🧪 Testing Snapshot Content Capture");
  console.log("═".repeat(60));

  const projectRoot = process.cwd();
  const snapshotManager = getSnapshotManager(projectRoot);

  console.log("\n📸 Creating snapshot...");
  const snapshot = await snapshotManager.capture();
  console.log(`✅ Snapshot created: ${snapshot.id}`);
  console.log(`   Files captured: ${Object.keys(snapshot.files).length}`);

  // Verify snapshot file on disk has content
  const snapshotPath = join(
    projectRoot,
    "reports",
    "snapshots",
    `${snapshot.id}.json`,
  );

  const snapshotData = JSON.parse(readFileSync(snapshotPath, "utf-8"));

  // Check random files
  let filesWithContent = 0;
  let filesWithoutContent = 0;

  for (const [path, file] of Object.entries(snapshotData.files)) {
    if ((file as any).content) {
      filesWithContent++;
    } else {
      filesWithoutContent++;
    }
  }

  console.log(`\n📊 Content Analysis:`);
  console.log(`   ✅ Files with content: ${filesWithContent}`);
  console.log(`   ❌ Files without content: ${filesWithoutContent}`);

  if (filesWithContent > 0) {
    console.log(`\n✅ SUCCESS: Snapshots are capturing file content!`);
    console.log(`\n💡 Next step: Test rollback with:`);
    console.log(`   npx tsx scripts/rollback.ts`);
  } else {
    console.log(`\n❌ FAIL: No files have content in snapshot!`);
    process.exit(1);
  }
}

test().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
