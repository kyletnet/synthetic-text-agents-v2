/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Environment Detection Utility
 *
 * Single source of truth for detecting runtime environment
 * and determining interactive mode capabilities.
 *
 * Design:
 * - Claude Code: Detected via CLAUDECODE=1 or CLAUDE_CODE_ENTRYPOINT=cli
 * - CI: Detected via CI=true
 * - TTY: Detected via process.stdin.isTTY
 * - Interactive: TTY or Claude Code (readline works in both)
 *
 * History:
 * - commit 67cf1ad: Confirmed readline works in Claude Code
 * - This module centralizes all environment detection logic
 */

export interface EnvironmentInfo {
  /** Is running in Claude Code CLI */
  isClaudeCode: boolean;
  /** Is running in CI environment */
  isCI: boolean;
  /** Has TTY (terminal) */
  isTTY: boolean;
  /** Supports interactive input (readline) */
  isInteractive: boolean;
  /** Should run in non-interactive mode (list-only) */
  isNonInteractive: boolean;
}

/**
 * Detect current runtime environment
 *
 * @returns Environment information object
 *
 * @example
 * ```ts
 * const env = detectEnvironment();
 * if (env.isInteractive) {
 *   // Use readline for user input
 * } else {
 *   // Skip interactive prompts
 * }
 * ```
 */
export function detectEnvironment(): EnvironmentInfo {
  const isClaudeCode =
    process.env.CLAUDECODE === "1" ||
    process.env.CLAUDE_CODE_ENTRYPOINT === "cli";

  const isCI = process.env.CI === "true";
  const isTTY = Boolean(process.stdin.isTTY);

  // CRITICAL FIX: Claude Code 환경에서는 readline이 hang됨 (SlashCommand 실행 시)
  // 원래 설계(commit 67cf1ad)는 readline 지원을 가정했지만,
  // 실제로는 SlashCommand로 실행 시 stdin이 연결되지 않음
  // 따라서 Claude Code는 non-interactive로 처리
  const isInteractive = isTTY; // Claude Code 제거

  // Non-interactive = CI or no TTY
  const isNonInteractive = isCI || !isTTY;

  return {
    isClaudeCode,
    isCI,
    isTTY,
    isInteractive,
    isNonInteractive,
  };
}

/**
 * Check if current environment supports interactive input
 *
 * @returns true if readline can be used
 */
export function canUseReadline(): boolean {
  return detectEnvironment().isInteractive;
}

/**
 * Check if running in Claude Code
 *
 * @returns true if CLAUDECODE or CLAUDE_CODE_ENTRYPOINT is set
 */
export function isClaudeCodeEnvironment(): boolean {
  return detectEnvironment().isClaudeCode;
}

/**
 * Print environment detection details (for debugging)
 */
export function printEnvironmentInfo(): void {
  const env = detectEnvironment();

  console.log("\n📊 Environment Detection:");
  console.log(`   CLAUDECODE: ${process.env.CLAUDECODE}`);
  console.log(
    `   CLAUDE_CODE_ENTRYPOINT: ${process.env.CLAUDE_CODE_ENTRYPOINT}`,
  );
  console.log(`   CI: ${process.env.CI}`);
  console.log(`   stdin.isTTY: ${process.stdin.isTTY}`);
  console.log(`   isClaudeCode: ${env.isClaudeCode}`);
  console.log(`   isCI: ${env.isCI}`);
  console.log(`   isTTY: ${env.isTTY}`);
  console.log(`   isInteractive: ${env.isInteractive}`);
  console.log(`   isNonInteractive: ${env.isNonInteractive}`);
}
