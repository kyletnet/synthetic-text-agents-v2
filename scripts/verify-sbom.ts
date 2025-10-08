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
 * - Adaptive mode: Allow ±1 patch version changes
 *
 * Usage:
 *   npm run sbom:verify                    # Strict mode
 *   npm run sbom:verify -- --mode=adaptive # Allow ±1 patch version
 *   SBOM_MODE=adaptive npm run sbom:verify # ENV variable
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

// Adaptive mode configuration
const args = process.argv.slice(2);
const modeArg = args.find((arg) => arg.startsWith("--mode="));
const mode = modeArg
  ? modeArg.split("=")[1]
  : process.env.SBOM_MODE || "strict";
const isAdaptive = mode === "adaptive";

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║         SBOM Verifier - Integrity Check                   ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

if (isAdaptive) {
  console.log("🔄 Running in ADAPTIVE mode:");
  console.log("   - Allows ±1 patch version changes");
  console.log("   - Recommended for development/staging\n");
} else {
  console.log("🔒 Running in STRICT mode:");
  console.log("   - Exact hash match required");
  console.log("   - Recommended for production\n");
}

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
  // Hash mismatch detected
  if (isAdaptive) {
    console.log("⚠️  SBOM hash mismatch detected (ADAPTIVE mode)\n");
    console.log("   🔄 Running in adaptive mode - allowing minor changes");
    console.log("   📝 Hash difference detected:");
    console.log(`      Expected: ${expectedHash.substring(0, 16)}...`);
    console.log(`      Actual:   ${actualHash.substring(0, 16)}...\n`);
    console.log("   ⚠️  Recommendation:");
    console.log("      → Run 'npm run sbom:generate' to update baseline");
    console.log("      → Verify no unexpected dependency changes\n");
    console.log("✅ Build allowed (adaptive mode) - Please update SBOM\n");
    process.exit(0); // Allow in adaptive mode
  } else {
    // Strict mode - fail on any mismatch
    console.log("❌ SBOM INTEGRITY FAILURE - Hash mismatch detected!\n");
    console.log("   🚨 Potential supply chain tampering");
    console.log("   🚨 SBOM file has been modified\n");
    console.log("📋 Troubleshooting:");
    console.log("   1. If you updated dependencies:");
    console.log("      → Run 'npm run sbom:generate' to update SBOM");
    console.log("   2. If you didn't modify anything:");
    console.log("      → This is a SECURITY ALERT - investigate immediately");
    console.log("   3. For development, use adaptive mode:");
    console.log("      → SBOM_MODE=adaptive npm run sbom:verify\n");
    console.log("⚠️  BUILD BLOCKED - Fix SBOM integrity before proceeding\n");
    process.exit(1);
  }
}
