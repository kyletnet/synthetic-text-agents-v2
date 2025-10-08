/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Safe Imports - Security Boundary for External Agents
 *
 * Purpose:
 * - Whitelist safe imports for external agent code
 * - Block dangerous Node.js modules
 * - Validate imports before sandbox execution
 *
 * Phase 0: Multi-Agent Security Boundary
 */

/**
 * Whitelist of safe npm packages for external agents
 */
export const SAFE_IMPORTS = [
  // Utility libraries (pure functions, no side effects)
  "lodash",
  "lodash-es",
  "ramda",
  "date-fns",

  // Data manipulation
  "dayjs",
  "moment",

  // Validation
  "zod",
  "joi",
  "yup",

  // Math and statistics
  "mathjs",

  // String manipulation
  "string-similarity",
  "fuzzysort",

  // NO DANGEROUS MODULES:
  // - fs, fs-extra (file system)
  // - child_process, child-process-promise (process execution)
  // - net, http, https (network)
  // - os (system info)
  // - path (can reveal system paths)
  // - crypto (potential abuse)
  // - eval, Function (code execution)
];

/**
 * Blocked imports (explicit deny list)
 *
 * Includes both npm packages and Node.js built-in modules
 */
export const BLOCKED_IMPORTS = [
  // File system access
  "fs",
  "fs-extra",
  "fs/promises",
  "node:fs",
  "node:fs/promises",

  // Process execution
  "child_process",
  "child-process-promise",
  "node:child_process",

  // Network access
  "net",
  "http",
  "https",
  "http2",
  "node:net",
  "node:http",
  "node:https",
  "node:http2",

  // System information
  "os",
  "node:os",

  // Cryptography (can be abused)
  "crypto",
  "node:crypto",

  // Path manipulation (can reveal system structure)
  "path",
  "node:path",

  // Process control
  "process",
  "node:process",
  "cluster",
  "node:cluster",
  "worker_threads",
  "node:worker_threads",

  // Low-level networking
  "dgram",
  "dns",
  "tls",
  "node:dgram",
  "node:dns",
  "node:tls",

  // Code execution
  "vm",
  "node:vm",
  "repl",
  "node:repl",

  // Module loading
  "module",
  "node:module",
  "require",

  // Other dangerous modules
  "inspector",
  "node:inspector",
  "async_hooks",
  "node:async_hooks",
  "perf_hooks",
  "node:perf_hooks",
];

/**
 * Extract import statements from code
 */
export function extractImports(code: string): string[] {
  const imports: string[] = [];

  // Match: import ... from "package"
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }

  // Match: require("package")
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  while ((match = requireRegex.exec(code)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Validation result
 */
export interface ImportValidationResult {
  valid: boolean;
  violations: string[];
  warnings?: string[];
}

/**
 * Validate imports in agent code
 */
export function validateImports(code: string): ImportValidationResult {
  const imports = extractImports(code);
  const violations: string[] = [];
  const warnings: string[] = [];

  for (const importPath of imports) {
    // Extract package name (before first /)
    const packageName = importPath.split("/")[0];

    // Check if blocked
    if (BLOCKED_IMPORTS.includes(packageName)) {
      violations.push(
        `Blocked import: "${packageName}" (security risk)`
      );
      continue;
    }

    // Check if whitelisted
    if (!SAFE_IMPORTS.includes(packageName)) {
      // Not whitelisted, but not explicitly blocked
      warnings.push(
        `Unknown import: "${packageName}" (not in whitelist, review required)`
      );
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Check if code uses eval or Function constructor
 */
export function detectDangerousFunctions(code: string): string[] {
  const dangerous: string[] = [];

  if (/\beval\s*\(/.test(code)) {
    dangerous.push("eval() detected");
  }

  if (/\bFunction\s*\(/.test(code)) {
    dangerous.push("Function() constructor detected");
  }

  if (/\bnew\s+Function\s*\(/.test(code)) {
    dangerous.push("new Function() detected");
  }

  return dangerous;
}

/**
 * Full security validation
 */
export function validateAgentCodeSecurity(code: string): {
  safe: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check imports
  const importResult = validateImports(code);
  if (!importResult.valid) {
    issues.push(...importResult.violations);
  }

  // Check dangerous functions
  const dangerousFuncs = detectDangerousFunctions(code);
  if (dangerousFuncs.length > 0) {
    issues.push(...dangerousFuncs);
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}
