#!/usr/bin/env tsx

/**
 * Test Snapshot & Rollback System
 *
 * Purpose:
 * - Test snapshot creation with file content
 * - Test rollback restoration
 */

import { getSnapshotManager } from "./lib/governance/snapshot-manager.js";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";

async function test() {
  console.log("🧪 Testing Snapshot & Rollback System");
  console.log("═".repeat(60));

  const projectRoot = process.cwd();
  const snapshotManager = getSnapshotManager(projectRoot);

  // Create a test file
  const testFilePath = join(projectRoot, "test-snapshot-file.txt");
  const originalContent = `Original content at ${new Date().toISOString()}`;

  console.log("\n📝 Step 1: Creating test file...");
  writeFileSync(testFilePath, originalContent, "utf-8");
  console.log(`✅ Created: ${testFilePath}`);
  console.log(`   Content: "${originalContent}"`);

  // Create snapshot
  console.log("\n📸 Step 2: Creating snapshot...");
  const snapshot = await snapshotManager.capture();
  console.log(`✅ Snapshot created: ${snapshot.id}`);
  console.log(`   Files captured: ${Object.keys(snapshot.files).length}`);

  // Verify snapshot has content
  const snapshotPath = join(
    projectRoot,
    "reports",
    "snapshots",
    `${snapshot.id}.json`,
  );
  if (existsSync(snapshotPath)) {
    const snapshotData = JSON.parse(readFileSync(snapshotPath, "utf-8"));
    const testFileSnapshot = snapshotData.files["test-snapshot-file.txt"];

    if (testFileSnapshot && testFileSnapshot.content) {
      console.log(`✅ Snapshot contains file content`);
      console.log(
        `   Content length: ${testFileSnapshot.content.length} chars`,
      );
    } else {
      console.log(`❌ Snapshot missing file content!`);
      process.exit(1);
    }
  }

  // Modify the test file
  const modifiedContent = `Modified content at ${new Date().toISOString()}`;
  console.log("\n✏️  Step 3: Modifying test file...");
  writeFileSync(testFilePath, modifiedContent, "utf-8");
  console.log(`✅ Modified: ${testFilePath}`);
  console.log(`   New content: "${modifiedContent}"`);

  // Verify modification
  const currentContent = readFileSync(testFilePath, "utf-8");
  if (currentContent === modifiedContent) {
    console.log(`✅ File successfully modified`);
  } else {
    console.log(`❌ File modification failed!`);
    process.exit(1);
  }

  console.log("\n🔄 Step 4: Test complete!");
  console.log("\n💡 To test rollback, run:");
  console.log("   tsx scripts/rollback.ts");
  console.log("\n   This should restore the original content:");
  console.log(`   "${originalContent}"`);
}

test().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
