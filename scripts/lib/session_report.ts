/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

import * as fs from "fs";
import * as path from "path";

interface SessionReportFields {
  SESSION_ID: string;
  RUN_ID: string;
  TARGET: string;
  PROFILE: string;
  MODE: string;
  DRY_RUN: boolean;
  OFFLINE_MODE: boolean;
  BUDGET_USD: string;
  COST_USD: string;
  DURATION_MS: number;
  MODEL_ID: string;
  PANEL_SIZE: number;
  TOKENS_EST: number;
  COST_EST_USD: string;
  CASES_TOTAL: number;
  CASES_PASSED: number;
  PASS_RATE: string;
  MEAN_SCORE: string;
  P50_MS: string;
  P95_MS: string;
  TOP_FAIL_REASONS: string;
  ERROR_CLASS: string;
  TRACE_ID: string;
  CI_BUILD_ID: string;
  GIT_COMMIT: string;
  GIT_COMMIT_FULL: string;
  RUN_STATE: string;
  RETRY_COUNT: number;
  RETRY_FROM_DLQ: boolean;
  RESULT: string;
  WARNINGS: number;
  CHANGED_FILES: string;
  NOTES: string;
  TIMESTAMP: string;
  DLQ_COUNT?: number;
  LAST_DLQ_RUN_ID?: string;
}

interface DLQInfo {
  count: number;
  lastRunId?: string;
}

export class SessionReportManager {
  private finalWriteCompleted = false;

  /**
   * Enforce cases total consistency - if CASES_TOTAL is 0, RESULT cannot be PASS
   */
  static enforceCasesTotal(
    fields: Partial<SessionReportFields>,
  ): Partial<SessionReportFields> {
    if (
      fields.CASES_TOTAL === 0 &&
      fields.MODE === "smoke" &&
      fields.RESULT === "PASS"
    ) {
      // Even smoke mode should have some cases if it actually ran
      fields.RESULT = "FAIL";
      fields.NOTES = `${fields.NOTES || ""} | zero_cases_detected`.trim();
    }
    return fields;
  }

  /**
   * Map RUN_STATE to RESULT for consistency
   */
  static mapRunStateToResult(runState: string): string {
    switch (runState) {
      case "SUCCESS":
        return "PASS";
      case "FAIL":
        return "FAIL";
      case "SKIPPED":
        return "SKIPPED";
      case "QUEUED":
      case "RUNNING":
        return "FAIL"; // Unexpected termination
      default:
        return "SKIPPED";
    }
  }

  /**
   * Validate and sanitize field values
   */
  static validateFields(
    fields: Partial<SessionReportFields>,
  ): Partial<SessionReportFields> {
    const validated = { ...fields };

    // Ensure numeric fields are valid
    validated.CASES_TOTAL = Math.max(0, Number(validated.CASES_TOTAL) || 0);
    validated.CASES_PASSED = Math.max(0, Number(validated.CASES_PASSED) || 0);
    validated.WARNINGS = Math.max(0, Number(validated.WARNINGS) || 0);
    validated.DURATION_MS = Math.max(0, Number(validated.DURATION_MS) || 0);
    validated.PANEL_SIZE = Math.max(1, Number(validated.PANEL_SIZE) || 1);
    validated.TOKENS_EST = Math.max(0, Number(validated.TOKENS_EST) || 0);

    // Ensure string fields are not undefined
    validated.BUDGET_USD = validated.BUDGET_USD || "0.00";
    validated.COST_USD = validated.COST_USD || "0.00";
    validated.PASS_RATE = validated.PASS_RATE || "0.00";
    validated.MEAN_SCORE = validated.MEAN_SCORE || "0.00";
    validated.P50_MS = validated.P50_MS || "0";
    validated.P95_MS = validated.P95_MS || "0";
    validated.TOP_FAIL_REASONS = validated.TOP_FAIL_REASONS || "[]";
    validated.ERROR_CLASS = validated.ERROR_CLASS || "";
    validated.CHANGED_FILES = validated.CHANGED_FILES || "[]";
    validated.NOTES = validated.NOTES || "";

    // Enforce consistency rules
    return this.enforceCasesTotal(validated);
  }

  /**
   * Get DLQ information
   */
  static getDLQInfo(): DLQInfo {
    const dlqDir = "reports/dlq";
    const indexPath = path.join(dlqDir, "index.jsonl");

    let count = 0;
    let lastRunId: string | undefined;

    try {
      if (fs.existsSync(indexPath)) {
        const lines = fs
          .readFileSync(indexPath, "utf-8")
          .trim()
          .split("\n")
          .filter((line) => line.trim());
        count = lines.length;

        if (lines.length > 0) {
          try {
            const lastEntry = JSON.parse(lines[lines.length - 1]);
            lastRunId = lastEntry.run_id;
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (e) {
      // Ignore file system errors
    }

    return { count, lastRunId };
  }

  /**
   * Atomic write with tmp/rename pattern
   */
  writeSessionReportFinal(fields: Partial<SessionReportFields>): void {
    if (this.finalWriteCompleted) {
      console.warn(
        "[SESSION_REPORT] Final write already completed, skipping duplicate write",
      );
      return;
    }

    // Validate and sanitize fields
    const validatedFields = SessionReportManager.validateFields(fields);

    // Ensure RUN_STATE/RESULT consistency
    if (validatedFields.RUN_STATE && !validatedFields.RESULT) {
      validatedFields.RESULT = SessionReportManager.mapRunStateToResult(
        validatedFields.RUN_STATE,
      );
    }

    // Get DLQ information
    const dlqInfo = SessionReportManager.getDLQInfo();
    validatedFields.DLQ_COUNT = dlqInfo.count;
    validatedFields.LAST_DLQ_RUN_ID = dlqInfo.lastRunId;

    // Ensure reports directory exists
    const reportsDir = "reports";
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate report content
    const reportContent = this.generateReportContent(validatedFields);

    // Atomic write: tmp -> rename
    const finalPath = path.join(reportsDir, "session_report.md");
    const tmpPath = `${finalPath}.tmp.${process.pid}`;

    try {
      fs.writeFileSync(tmpPath, reportContent, "utf-8");
      fs.renameSync(tmpPath, finalPath);

      this.finalWriteCompleted = true;
      console.log(
        `[SESSION_REPORT] Final report written atomically: ${finalPath}`,
      );
    } catch (error) {
      // Clean up tmp file on error
      try {
        fs.unlinkSync(tmpPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Generate the complete session report content
   */
  private generateReportContent(fields: Partial<SessionReportFields>): string {
    const timestamp = new Date().toISOString();

    return `# Session Report

## Summary Block (Copy for Operational Reviews)

\`\`\`
SESSION_ID: ${fields.SESSION_ID || "unknown"}
RUN_ID: ${fields.RUN_ID || "unknown"}
TARGET: ${fields.TARGET || "unknown"}
PROFILE: ${fields.PROFILE || "dev"}
MODE: ${fields.MODE || "unknown"}
DRY_RUN: ${fields.DRY_RUN || "unknown"} (source: CLI)
OFFLINE_MODE: ${fields.OFFLINE_MODE || "false"}
BUDGET_USD: ${fields.BUDGET_USD || "0.00"}
COST_USD: ${fields.COST_USD || "0.00"}
DURATION_MS: ${fields.DURATION_MS || 0}
MODEL_ID: ${fields.MODEL_ID || "default"}
PANEL_SIZE: ${fields.PANEL_SIZE || 1}
TOKENS_EST: ${fields.TOKENS_EST || 0}
COST_EST_USD: ${fields.COST_EST_USD || "0.00"}
CASES_TOTAL: ${fields.CASES_TOTAL || 0}
CASES_PASSED: ${fields.CASES_PASSED || 0}
PASS_RATE: ${fields.PASS_RATE || "0.00"}
MEAN_SCORE: ${fields.MEAN_SCORE || "0.00"}
P50_MS: ${fields.P50_MS || "0"}
P95_MS: ${fields.P95_MS || "0"}
TOP_FAIL_REASONS: ${fields.TOP_FAIL_REASONS || "[]"}
ERROR_CLASS: ${fields.ERROR_CLASS || ""}
TRACE_ID: ${fields.TRACE_ID || "unknown"}
CI_BUILD_ID: ${fields.CI_BUILD_ID || "unknown"}
GIT_COMMIT: ${fields.GIT_COMMIT || "unknown"}
GIT_COMMIT_FULL: ${fields.GIT_COMMIT_FULL || "unknown"}
RUN_STATE: ${fields.RUN_STATE || "UNKNOWN"}
RETRY_COUNT: ${fields.RETRY_COUNT || 0}
RETRY_FROM_DLQ: ${fields.RETRY_FROM_DLQ || false}
RESULT: ${fields.RESULT || "FAIL"}
WARNINGS: ${fields.WARNINGS || 0}
CHANGED_FILES: [${fields.CHANGED_FILES || ""}]
NOTES: ${fields.NOTES || ""}
TIMESTAMP: ${timestamp}
DLQ_COUNT: ${fields.DLQ_COUNT || 0}
LAST_DLQ_RUN_ID: ${fields.LAST_DLQ_RUN_ID || ""}
\`\`\`

## Operational Guidelines

- Copy the Summary Block above for reviews and incident reports
- No screenshots required - this block contains all necessary context
- For detailed logs, see: RUN_LOGS/session_${fields.SESSION_ID || "unknown"}.log
- For changed files, see git commit: ${fields.GIT_COMMIT_FULL || "uncommitted"}

## System Health

- Environment loading: ${fs.existsSync("tools/load_env.sh") ? "OK" : "MISSING"}
- API client enforcement: ${
      fs.existsSync("tools/anthropic_client.sh") ? "OK" : "MISSING"
    }
- Registry coverage: ${
      fs.existsSync("scripts/entrypoints.jsonl")
        ? this.getEntrypointCount() + " entries"
        : "MISSING"
    }
- Git status: ${this.getGitStatus()} uncommitted changes

## DLQ Status

${this.getDLQStatus(fields.DLQ_COUNT || 0)}
`;
  }

  /**
   * Get number of entrypoints
   */
  private getEntrypointCount(): string {
    try {
      const content = fs.readFileSync("scripts/entrypoints.jsonl", "utf-8");
      return content
        .trim()
        .split("\n")
        .filter((line) => line.trim())
        .length.toString();
    } catch (e) {
      return "unknown";
    }
  }

  /**
   * Get git status
   */
  private getGitStatus(): string {
    try {
      if (typeof require !== "undefined") {
        const { execSync } = require("child_process");
        const output = execSync(
          'git status --porcelain 2>/dev/null || echo ""',
          { encoding: "utf-8" },
        );
        return output
          .trim()
          .split("\n")
          .filter((line: string) => line.trim())
          .length.toString();
      }
      return "unknown";
    } catch (e) {
      return "unknown";
    }
  }

  /**
   * Get DLQ status description
   */
  private getDLQStatus(dlqCount: number): string {
    if (dlqCount === 0) {
      return "No failed runs in DLQ";
    }

    const dlqDir = "reports/dlq";
    try {
      if (fs.existsSync(dlqDir)) {
        const entries = fs
          .readdirSync(dlqDir)
          .filter(
            (name) =>
              name !== "index.jsonl" &&
              fs.statSync(path.join(dlqDir, name)).isDirectory(),
          )
          .sort((a, b) => {
            try {
              const statA = fs.statSync(path.join(dlqDir, a));
              const statB = fs.statSync(path.join(dlqDir, b));
              return statB.mtime.getTime() - statA.mtime.getTime();
            } catch (e) {
              return 0;
            }
          })
          .slice(0, 3);

        return `Failed runs in DLQ: ${dlqCount}
Latest DLQ entries:
${entries.map((entry) => `- ${entry}`).join("\n")}`;
      }
    } catch (e) {
      // Ignore errors
    }

    return `Failed runs in DLQ: ${dlqCount}`;
  }
}

// CLI interface for Node.js execution
if (typeof require !== "undefined" && require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage: node session_report.js --write-final --session-id <id> --result <result> ...",
    );
    process.exit(1);
  }

  const fields: Partial<SessionReportFields> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace("--", "").replace(/-/g, "_").toUpperCase();
    const value = args[i + 1];

    if (key && value !== undefined) {
      // Handle special field types
      if (["DRY_RUN", "OFFLINE_MODE", "RETRY_FROM_DLQ"].includes(key)) {
        (fields as any)[key] = value.toLowerCase() === "true";
      } else if (
        [
          "DURATION_MS",
          "PANEL_SIZE",
          "TOKENS_EST",
          "CASES_TOTAL",
          "CASES_PASSED",
          "WARNINGS",
          "RETRY_COUNT",
        ].includes(key)
      ) {
        (fields as any)[key] = parseInt(value, 10) || 0;
      } else {
        (fields as any)[key] = value;
      }
    }
  }

  if (args.includes("--write-final")) {
    const manager = new SessionReportManager();
    try {
      manager.writeSessionReportFinal(fields);
      console.log("Session report written successfully");
    } catch (error) {
      console.error("Failed to write session report:", error);
      process.exit(1);
    }
  } else {
    console.error("No action specified. Use --write-final");
    process.exit(1);
  }
}
