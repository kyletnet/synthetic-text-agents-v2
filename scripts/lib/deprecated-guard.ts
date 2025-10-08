/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Deprecated File Execution Guard
 *
 * Purpose:
 * - Block direct execution of deprecated files
 * - Work in both CommonJS and ESM environments
 * - Provide clear migration guidance
 *
 * Usage:
 * ```typescript
 * import { blockIfDeprecated } from './lib/deprecated-guard.js';
 *
 * blockIfDeprecated({
 *   file: import.meta.url,
 *   replacement: 'npm run maintain',
 *   reason: 'Migrated to cache-based architecture'
 * });
 * ```
 */

import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface DeprecationInfo {
  file: string;
  replacement: string;
  reason: string;
  allowImport?: boolean;
}

/**
 * Check if file is being directly executed (not imported)
 */
function isDirectExecution(fileUrl: string): boolean {
  try {
    // ESM: import.meta.url
    const filePath = fileURLToPath(fileUrl);

    // Check if this file is the main module
    // In ESM, process.argv[1] contains the executed file path
    const executedFile = process.argv[1];

    if (!executedFile) return false;

    // Normalize paths for comparison
    const normalizedFile = filePath.replace(/\\/g, "/");
    const normalizedExecuted = executedFile.replace(/\\/g, "/");

    return normalizedFile === normalizedExecuted;
  } catch (error) {
    // Fallback: if we can't determine, assume it's not direct execution
    return false;
  }
}

/**
 * Load deprecated files list from governance-rules.json
 */
function loadDeprecatedFiles(): Map<string, any> {
  const rulesPath = join(process.cwd(), "governance-rules.json");

  if (!existsSync(rulesPath)) {
    return new Map();
  }

  try {
    const rules = JSON.parse(readFileSync(rulesPath, "utf8"));
    const map = new Map();

    for (const deprecated of rules.deprecatedFiles || []) {
      map.set(deprecated.path, deprecated);
    }

    return map;
  } catch (error) {
    console.warn("Failed to load deprecated files:", error);
    return new Map();
  }
}

/**
 * Block execution if file is deprecated and being run directly
 */
export function blockIfDeprecated(info: DeprecationInfo): void {
  if (!isDirectExecution(info.file)) {
    // Being imported, not executed - allow if allowImport is true
    if (info.allowImport === false) {
      throw new Error(
        `❌ DEPRECATED: This file cannot be imported. ${info.replacement}`,
      );
    }
    return;
  }

  // Direct execution detected - block
  console.error("\n" + "=".repeat(70));
  console.error("❌ DEPRECATED FILE EXECUTION BLOCKED");
  console.error("=".repeat(70));
  console.error();
  console.error(`📁 File: ${fileURLToPath(info.file)}`);
  console.error(`🚫 Reason: ${info.reason}`);
  console.error();
  console.error("✅ Use instead:");
  console.error(`   ${info.replacement}`);
  console.error();
  console.error(
    "💡 This file is marked as deprecated in governance-rules.json",
  );
  console.error("💡 Direct execution is blocked to prevent confusion");
  console.error();
  console.error("=".repeat(70));
  console.error();

  process.exit(1);
}

/**
 * Auto-detect deprecation from governance-rules.json
 */
export function autoBlockIfDeprecated(fileUrl: string): void {
  const filePath = fileURLToPath(fileUrl);
  const deprecatedFiles = loadDeprecatedFiles();

  // Check if this file is in deprecated list
  for (const [path, info] of deprecatedFiles.entries()) {
    if (filePath.includes(path.replace(/^scripts\//, ""))) {
      blockIfDeprecated({
        file: fileUrl,
        replacement: info.replacement,
        reason: info.reason,
      });
      return;
    }
  }
}

/**
 * Check if a file path is deprecated (without blocking)
 */
export function isDeprecated(filePath: string): boolean {
  const deprecatedFiles = loadDeprecatedFiles();

  for (const path of deprecatedFiles.keys()) {
    if (filePath.includes(path.replace(/^scripts\//, ""))) {
      return true;
    }
  }

  return false;
}
