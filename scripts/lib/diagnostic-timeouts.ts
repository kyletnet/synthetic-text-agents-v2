/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Diagnostic Timeouts - Centralized timeout configuration
 *
 * Purpose:
 * - Single source of truth for diagnostic operation timeouts
 * - Aligned with governance-rules.json timeoutPolicy
 * - Prevent infinite hangs in inspection operations
 *
 * Design Philosophy:
 * - Conservative timeouts (prefer timeout over hang)
 * - Graceful degradation (timeout = warning, not failure)
 * - Aligned with governance system
 */

/**
 * Timeout values for each diagnostic type (milliseconds)
 */
export const DIAGNOSTIC_TIMEOUTS = {
  // File scanning operations
  prettier: 60000, // 1 minute - formatting check
  eslint: 120000, // 2 minutes - linting with complex rules
  typescript: 120000, // 2 minutes - type compilation
  grep: 30000, // 30 seconds - file content search

  // Execution operations
  tests: 300000, // 5 minutes - test suite execution
  security: 60000, // 1 minute - npm audit (network dependent)
  build: 180000, // 3 minutes - build process

  // Documentation operations
  docCheck: 30000, // 30 seconds - documentation validation
  refactorQueue: 10000, // 10 seconds - refactoring queue check
} as const;

/**
 * Diagnostic operation types
 */
export type DiagnosticType = keyof typeof DIAGNOSTIC_TIMEOUTS;

/**
 * Get timeout for a diagnostic type
 */
export function getTimeout(type: DiagnosticType): number {
  return DIAGNOSTIC_TIMEOUTS[type];
}

/**
 * Check if a diagnostic is critical (must succeed)
 */
export function isCriticalDiagnostic(type: DiagnosticType): boolean {
  const critical: DiagnosticType[] = ["typescript"];
  return critical.includes(type);
}

/**
 * Get timeout with fallback
 */
export function getTimeoutWithFallback(
  type: DiagnosticType,
  fallback = 60000,
): number {
  return DIAGNOSTIC_TIMEOUTS[type] || fallback;
}

/**
 * Timeout error message generator
 */
export function getTimeoutMessage(type: DiagnosticType): string {
  const timeout = DIAGNOSTIC_TIMEOUTS[type];
  const seconds = Math.floor(timeout / 1000);
  return `${type} check timed out after ${seconds}s - skipping`;
}
