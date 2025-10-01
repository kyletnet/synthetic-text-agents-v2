/**
 * Governed Script - Standardized governance wrapper for all CLI scripts
 *
 * Purpose:
 * - Enforce consistent governance across all scripts
 * - Automatic snapshot + operation logging
 * - Centralized timeout management
 * - Prevent governance bypass
 *
 * Design Philosophy:
 * - Every script should be governed by default
 * - Governance-free scripts are exceptions (whitelist only)
 * - Consistent audit trail for all operations
 *
 * Usage:
 * ```typescript
 * await runGovernedScript("my-script", async () => {
 *   // Your script logic here
 * });
 * ```
 *
 * GPT Advice Integration:
 * "All CLI entry points should use runGovernedScript to ensure
 *  system-wide governance consistency and auditability"
 */

import { GovernanceRunner } from "./governance-runner.js";
import type { OperationType } from "./governance-types.js";

export interface GovernedScriptOptions {
  /** Script name (e.g., "gap-scan", "validate") */
  name: string;

  /** Operation type for timeout policy */
  type?: OperationType;

  /** Human-readable description */
  description?: string;

  /** Skip snapshot capture (for lightweight read-only ops) */
  skipSnapshot?: boolean;

  /** Skip post-execution verification */
  skipVerification?: boolean;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Run a script with full governance enforcement
 *
 * This is the STANDARD way to run any CLI script.
 * All new scripts MUST use this pattern.
 *
 * @param options - Script configuration
 * @param script - Async function containing script logic
 * @returns Promise that resolves when script completes
 *
 * @example
 * ```typescript
 * await runGovernedScript(
 *   { name: "my-tool", description: "My awesome tool" },
 *   async () => {
 *     console.log("Running my tool...");
 *     // ... tool logic
 *   }
 * );
 * ```
 */
export async function runGovernedScript<T>(
  options: GovernedScriptOptions,
  script: () => Promise<T>,
): Promise<T> {
  const governance = new GovernanceRunner(process.cwd());

  return await governance.executeWithGovernance(script, {
    name: options.name,
    type: options.type || "system-command",
    description: options.description,
    skipSnapshot: options.skipSnapshot ?? false,
    skipVerification: options.skipVerification ?? true, // Most scripts are read-only
    metadata: options.metadata,
  });
}

/**
 * Check if a script should be governed
 *
 * Used by linters and pre-commit hooks to enforce governance compliance.
 *
 * @param scriptPath - Path to the script file
 * @returns true if script requires governance
 */
export function requiresGovernance(scriptPath: string): boolean {
  // Whitelist: Scripts that don't need governance
  const whitelist = [
    // Build tools
    "build.ts",
    "dev.ts",

    // Test utilities
    "test-helper.ts",

    // Documentation generators (passive)
    "generate-docs.ts",
  ];

  const scriptName = scriptPath.split("/").pop() || "";
  return !whitelist.includes(scriptName);
}

/**
 * Governance compliance metadata
 *
 * Attach this to scripts to declare governance status
 */
export interface GovernanceCompliance {
  /** Is this script governed? */
  governed: boolean;

  /** Reason if not governed */
  exemptionReason?: string;

  /** Exemption approved by */
  approvedBy?: string;

  /** Exemption date */
  exemptionDate?: string;
}
