/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Governance Logger - Enforcement Trace & Audit Trail
 *
 * Purpose:
 * - Record all governance enforcement decisions
 * - Track why tools were allowed/blocked
 * - Provide audit trail for compliance
 * - Enable governance analytics
 *
 * Design Philosophy:
 * - Every enforcement decision must be traceable
 * - Logs are append-only (JSONL)
 * - Searchable by tool, mode, result, timestamp
 */

import { appendFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

export interface GovernanceLogEntry {
  /** Timestamp of enforcement check */
  timestamp: string;

  /** Tool that was checked */
  tool: string;

  /** Tool mode (analyze or transform) */
  mode: "analyze" | "transform" | "unknown";

  /** Enforcement result */
  result: "allowed" | "blocked" | "error";

  /** Reason for decision */
  reason: string;

  /** Violations found (if blocked) */
  violations?: Array<{
    type: string;
    severity: "critical" | "high" | "medium";
    message: string;
  }>;

  /** Policy that applied */
  policy?: string;

  /** Execution context */
  context?: {
    command?: string;
    user?: string;
    cwd?: string;
  };
}

export class GovernanceLogger {
  private logPath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.logPath = join(
      projectRoot,
      "reports",
      "governance",
      "enforcement-log.jsonl",
    );
    this.ensureLogDirectory();
  }

  /**
   * Log an enforcement decision
   */
  log(entry: Omit<GovernanceLogEntry, "timestamp">): void {
    const fullEntry: GovernanceLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    try {
      const line = JSON.stringify(fullEntry) + "\n";
      appendFileSync(this.logPath, line, "utf8");
    } catch (error) {
      // Don't crash on logging failure, but warn
      console.warn(
        `⚠️  Failed to write governance log: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Log an allowed tool
   */
  logAllowed(
    tool: string,
    mode: "analyze" | "transform",
    reason: string,
  ): void {
    this.log({
      tool,
      mode,
      result: "allowed",
      reason,
      policy: mode === "analyze" ? "auto-exempt" : "governance-compliant",
    });
  }

  /**
   * Log a blocked tool
   */
  logBlocked(
    tool: string,
    mode: "analyze" | "transform" | "unknown",
    violations: Array<{
      type: string;
      severity: "critical" | "high" | "medium";
      message: string;
    }>,
  ): void {
    this.log({
      tool,
      mode,
      result: "blocked",
      reason: `Governance violations: ${violations.length} issue(s)`,
      violations,
      policy: "governance-enforcement",
    });
  }

  /**
   * Log an error during enforcement
   */
  logError(tool: string, error: string): void {
    this.log({
      tool,
      mode: "unknown",
      result: "error",
      reason: `Enforcement error: ${error}`,
      policy: "governance-enforcement",
    });
  }

  /**
   * Get log file path
   */
  getLogPath(): string {
    return this.logPath;
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    const dir = dirname(this.logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Global singleton
 */
let globalLogger: GovernanceLogger | null = null;

export function getGovernanceLogger(projectRoot?: string): GovernanceLogger {
  if (!globalLogger) {
    globalLogger = new GovernanceLogger(projectRoot);
  }
  return globalLogger;
}
