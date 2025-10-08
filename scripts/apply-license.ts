#!/usr/bin/env tsx
/**
 * Apply License Headers - Auto-insert SPDX headers
 *
 * Purpose:
 * - Automatically add SPDX license headers to all source files
 * - Ensure proper copyright notices
 * - Support dual-license (Apache-2.0 vs BSL-1.1)
 *
 * Usage:
 *   npm run license:apply
 *   npm run license:check  # Verify headers
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join } from "path";

const APACHE_HEADER = `/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 [Your Company]
 */
`;

const BSL_HEADER = `/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */
`;

// Open-Core components (Apache-2.0)
const APACHE_PATHS = [
  "open-template",
  "demo-ui",
  "docs",
  "src/domain/interfaces/agent-contracts.ts",
];

// Proprietary components (BSL-1.1)
const BSL_PATHS = [
  "src/core",
  "src/feedback",
  "src/infrastructure/governance",
  "src/multi-agent-bus/internal",
];

interface FileStats {
  total: number;
  withHeader: number;
  withoutHeader: number;
  added: number;
  errors: number;
}

const stats: FileStats = {
  total: 0,
  withHeader: 0,
  withoutHeader: 0,
  added: 0,
  errors: 0,
};

/**
 * Check if path matches any pattern
 */
function matchesPath(filePath: string, patterns: string[]): boolean {
  return patterns.some((pattern) => filePath.includes(pattern));
}

/**
 * Determine license for file
 */
function getLicenseForFile(filePath: string): "apache" | "bsl" {
  if (matchesPath(filePath, APACHE_PATHS)) {
    return "apache";
  }

  if (matchesPath(filePath, BSL_PATHS)) {
    return "bsl";
  }

  // Default: BSL for core code
  return "bsl";
}

/**
 * Check if file has SPDX header
 */
function hasSPDXHeader(content: string): boolean {
  return content.includes("SPDX-License-Identifier");
}

/**
 * Add license header to file
 */
function addLicenseHeader(filePath: string, dryRun: boolean = false): boolean {
  try {
    const content = readFileSync(filePath, "utf8");

    // Skip if already has header
    if (hasSPDXHeader(content)) {
      stats.withHeader++;
      return false;
    }

    const license = getLicenseForFile(filePath);
    const header = license === "apache" ? APACHE_HEADER : BSL_HEADER;

    const newContent = header + "\n" + content;

    if (!dryRun) {
      writeFileSync(filePath, newContent, "utf8");
    }

    stats.withoutHeader++;
    stats.added++;

    return true;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    stats.errors++;
    return false;
  }
}

/**
 * Scan directory recursively
 */
function scanDirectory(dir: string, dryRun: boolean = false) {
  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);

      // Skip node_modules, .git, dist, etc
      if (
        entry === "node_modules" ||
        entry === ".git" ||
        entry === "dist" ||
        entry === "build" ||
        entry === ".next" ||
        entry === "coverage"
      ) {
        continue;
      }

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          scanDirectory(fullPath, dryRun);
        } else if (stat.isFile()) {
          // Only process TypeScript files
          if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
            stats.total++;

            const added = addLicenseHeader(fullPath, dryRun);

            if (added) {
              console.log(`  ${dryRun ? "[DRY-RUN] " : ""}✅ Added header: ${fullPath}`);
            }
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
}

/**
 * Main execution
 */
function main() {
  const dryRun = process.argv.includes("--dry-run");
  const check = process.argv.includes("--check");

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         License Header Application                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  if (dryRun) {
    console.log("\n🔍 DRY RUN MODE - No files will be modified\n");
  }

  if (check) {
    console.log("\n🔍 CHECK MODE - Verifying existing headers\n");
  }

  const projectRoot = process.cwd();
  const srcDir = join(projectRoot, "src");
  const scriptsDir = join(projectRoot, "scripts");

  console.log(`📁 Scanning: ${srcDir}\n`);
  scanDirectory(srcDir, dryRun || check);

  console.log(`\n📁 Scanning: ${scriptsDir}\n`);
  scanDirectory(scriptsDir, dryRun || check);

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary");
  console.log("=".repeat(60));
  console.log(`Total files scanned: ${stats.total}`);
  console.log(`With SPDX header:    ${stats.withHeader} ✅`);
  console.log(`Without header:      ${stats.withoutHeader} ⚠️`);
  console.log(`Headers added:       ${stats.added} ${dryRun ? "(dry-run)" : "✅"}`);
  console.log(`Errors:              ${stats.errors} ${stats.errors > 0 ? "❌" : ""}`);

  if (check) {
    if (stats.withoutHeader > 0) {
      console.log(`\n❌ ${stats.withoutHeader} files missing SPDX headers`);
      console.log("Run: npm run license:apply\n");
      process.exit(1);
    } else {
      console.log("\n✅ All files have SPDX headers\n");
      process.exit(0);
    }
  } else if (dryRun) {
    console.log(`\n💡 Run without --dry-run to apply headers\n`);
  } else {
    console.log("\n✅ License headers applied successfully\n");
  }
}

main();
