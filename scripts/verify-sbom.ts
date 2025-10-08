#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * SBOM Verifier - Integrity Check
 *
 * Purpose:
 * - Verify SBOM integrity using SHA-256 hash
 * - Detect supply chain tampering
 * - Block builds if SBOM is modified
 *
 * Usage:
 *   npm run sbom:verify
 *   (Called automatically in prebuild hook)
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║         SBOM Verifier - Integrity Check                   ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

const reportsDir = join(process.cwd(), "reports");
const sbomPath = join(reportsDir, "sbom-phase0.json");
const hashPath = join(reportsDir, "sbom-phase0.hash");

// Check if SBOM exists
if (!existsSync(sbomPath)) {
  console.log("⚠️  SBOM not found - run 'npm run sbom:generate' first\n");
  process.exit(0); // Don't fail if SBOM doesn't exist (for initial setup)
}

// Check if hash file exists
if (!existsSync(hashPath)) {
  console.log("⚠️  SBOM hash file not found - run 'npm run sbom:generate' first\n");
  process.exit(0);
}

console.log("🔍 Verifying SBOM integrity...\n");

// Read SBOM
const sbomContent = readFileSync(sbomPath, "utf8");

// Parse SBOM
let sbom;

try {
  sbom = JSON.parse(sbomContent);
} catch (error) {
  console.log("❌ SBOM file is corrupted (invalid JSON)\n");
  console.log("   File: " + sbomPath);
  console.log("   Action: Run 'npm run sbom:generate' to regenerate\n");
  process.exit(1);
}

// Read expected hash from hash file
const hashFileContent = readFileSync(hashPath, "utf8");
const expectedHash = hashFileContent.split(/\s+/)[0];

// Calculate actual hash (excluding hash field)
const sbomForHash = {
  metadata: sbom.metadata,
  dependencies: sbom.dependencies,
  devDependencies: sbom.devDependencies,
  totalCount: sbom.totalCount,
};

const sbomJsonForHash = JSON.stringify(sbomForHash, null, 2);
const actualHash = createHash("sha256").update(sbomJsonForHash).digest("hex");

// Compare hashes
console.log(`📊 SBOM Details:`);
console.log(`   Project: ${sbom.metadata?.project || "unknown"}`);
console.log(`   Version: ${sbom.metadata?.projectVersion || "unknown"}`);
console.log(`   Dependencies: ${sbom.totalCount || 0}`);
console.log(`   Timestamp: ${sbom.metadata?.timestamp || "unknown"}\n`);

console.log(`🔐 Hash Verification:`);
console.log(`   Expected: ${expectedHash}`);
console.log(`   Actual:   ${actualHash}\n`);

if (actualHash === expectedHash) {
  console.log("✅ SBOM integrity verified - Hash matches\n");
  console.log("   ✓ Supply chain security check passed");
  console.log("   ✓ No tampering detected\n");
  process.exit(0);
} else {
  console.log("❌ SBOM INTEGRITY FAILURE - Hash mismatch detected!\n");
  console.log("   🚨 Potential supply chain tampering");
  console.log("   🚨 SBOM file has been modified\n");
  console.log("📋 Troubleshooting:");
  console.log("   1. If you updated dependencies:");
  console.log("      → Run 'npm run sbom:generate' to update SBOM");
  console.log("   2. If you didn't modify anything:");
  console.log("      → This is a SECURITY ALERT - investigate immediately\n");
  console.log("⚠️  BUILD BLOCKED - Fix SBOM integrity before proceeding\n");
  process.exit(1);
}
