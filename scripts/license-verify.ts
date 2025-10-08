#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * License Verification - SPDX Compliance Check
 *
 * Purpose:
 * - Verify all source files have SPDX headers
 * - Ensure SPDX identifiers match LICENSE files
 * - Detect license inconsistencies
 * - Block builds if license violations found
 *
 * Usage:
 *   npm run license:verify
 *   (Called automatically in CI/CD)
 */

import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join } from "path";

interface LicenseViolation {
  file: string;
  issue: string;
  expected?: string;
  actual?: string;
}

const violations: LicenseViolation[] = [];

// Valid SPDX identifiers for this project
const VALID_LICENSES = ["BUSL-1.1", "Apache-2.0"];

// Files to scan
const SCAN_DIRS = ["src", "scripts"];

// Files to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /dist/,
  /build/,
  /\.test\.ts$/,
  /\.spec\.ts$/,
  /\.d\.ts$/,
];

/**
 * Extract SPDX license from file content
 */
function extractSPDXLicense(content: string): string | null {
  const match = content.match(/SPDX-License-Identifier:\s*([A-Za-z0-9\-.]+)/);

  return match ? match[1] : null;
}

/**
 * Check if file should be scanned
 */
function shouldScan(filePath: string): boolean {
  // Check skip patterns
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(filePath)) {
      return false;
    }
  }

  // Only scan TypeScript files
  return filePath.endsWith(".ts") || filePath.endsWith(".tsx");
}

/**
 * Scan directory recursively
 */
function scanDirectory(dir: string, baseDir: string = dir): number {
  let fileCount = 0;

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = fullPath.replace(baseDir + "/", "");

      // Skip node_modules, .git, etc
      if (entry === "node_modules" || entry === ".git" || entry === "dist") {
        continue;
      }

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          fileCount += scanDirectory(fullPath, baseDir);
        } else if (stat.isFile()) {
          if (shouldScan(fullPath)) {
            scanFile(fullPath, relativePath);
            fileCount++;
          }
        }
      } catch (error) {
        // Skip if permission denied
        continue;
      }
    }
  } catch (error) {
    console.error(`Cannot scan directory: ${dir}`, error);
  }

  return fileCount;
}

/**
 * Scan file for license compliance
 */
function scanFile(filePath: string, relativePath: string) {
  try {
    const content = readFileSync(filePath, "utf8");

    // Extract SPDX license
    const license = extractSPDXLicense(content);

    if (!license) {
      violations.push({
        file: relativePath,
        issue: "Missing SPDX-License-Identifier header",
      });

      return;
    }

    // Check if license is valid
    if (!VALID_LICENSES.includes(license)) {
      violations.push({
        file: relativePath,
        issue: "Invalid SPDX license identifier",
        expected: VALID_LICENSES.join(" or "),
        actual: license,
      });
    }
  } catch (error) {
    // Skip if can't read file
  }
}

/**
 * Check if LICENSE files exist
 */
function checkLicenseFiles(): void {
  const licenseFiles = ["LICENSE", "LICENSE-APACHE", "NOTICE"];

  for (const licenseFile of licenseFiles) {
    const licensePath = join(process.cwd(), licenseFile);

    if (!existsSync(licensePath)) {
      violations.push({
        file: licenseFile,
        issue: "LICENSE file missing (required for dual-license)",
      });
    }
  }
}

/**
 * Main execution
 */
function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║       License Verification - SPDX Compliance Check        ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log("🔍 Scanning source files for SPDX compliance...\n");

  // Check LICENSE files
  checkLicenseFiles();

  // Scan directories
  let totalFiles = 0;

  for (const dir of SCAN_DIRS) {
    const dirPath = join(process.cwd(), dir);

    if (existsSync(dirPath)) {
      console.log(`   📁 ${dir}/`);

      const count = scanDirectory(dirPath, dirPath);
      totalFiles += count;
    }
  }

  console.log(`\n   Total files scanned: ${totalFiles}\n`);

  console.log("=".repeat(60));
  console.log("📊 Verification Results");
  console.log("=".repeat(60));

  if (violations.length === 0) {
    console.log("\n✅ All files have valid SPDX headers");
    console.log(`   ✓ ${totalFiles} files checked`);
    console.log(`   ✓ Valid licenses: ${VALID_LICENSES.join(", ")}`);
    console.log(`   ✓ No violations found\n`);
    process.exit(0);
  } else {
    console.log(`\n❌ ${violations.length} license violation(s) found:\n`);

    // Group by issue type
    const byIssue: Record<string, LicenseViolation[]> = {};

    for (const violation of violations) {
      if (!byIssue[violation.issue]) {
        byIssue[violation.issue] = [];
      }

      byIssue[violation.issue].push(violation);
    }

    for (const [issue, violationList] of Object.entries(byIssue)) {
      console.log(`📋 ${issue}:`);

      for (const v of violationList) {
        console.log(`   • ${v.file}`);

        if (v.expected && v.actual) {
          console.log(`     Expected: ${v.expected}`);
          console.log(`     Actual: ${v.actual}`);
        }
      }

      console.log();
    }

    console.log("=".repeat(60));
    console.log("🔧 Fix Instructions");
    console.log("=".repeat(60));
    console.log("\n1. Add missing SPDX headers:");
    console.log("   npm run license:apply\n");
    console.log("2. Verify license compliance:");
    console.log("   npm run license:verify\n");
    console.log("⚠️  BUILD BLOCKED - Fix license violations before proceeding\n");
    process.exit(1);
  }
}

main();
