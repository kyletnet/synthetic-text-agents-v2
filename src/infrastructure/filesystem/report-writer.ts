/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Infrastructure: Report Writer
 * Handles all file I/O operations for baseline reports
 */

import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
} from "fs";
import { promises as fs } from "node:fs";
import { join } from "path";
import { createHash } from "crypto";

// ============================================================================
// File Hash Calculation
// ============================================================================

export function calculateFileHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

// ============================================================================
// Session Report Management
// ============================================================================

export interface SessionMeta {
  profile: string;
  mode: string;
  dryRun: string;
  casesTotal: number;
}

export async function prewriteSessionMeta(
  meta: SessionMeta,
  reportPath: string,
): Promise<void> {
  try {
    await fs.mkdir(join(reportPath, ".."), { recursive: true });
    const now = new Date().toISOString();
    const block = [
      `PROFILE: ${meta.profile}`,
      `MODE: ${meta.mode}`,
      `DRY_RUN: ${meta.dryRun} (source: CLI)`,
      `CASES_TOTAL: ${meta.casesTotal}`,
      `TIMESTAMP: ${now}`,
    ].join("\n");

    let prev = "";
    try {
      prev = await fs.readFile(reportPath, "utf8");
    } catch {
      // File doesn't exist - use empty string
    }

    const merged = prev.includes("PROFILE:")
      ? prev
      : prev
      ? prev + "\n" + block + "\n"
      : block + "\n";

    await fs.writeFile(reportPath + ".tmp", merged, "utf8");
    await fs.rename(reportPath + ".tmp", reportPath);
  } catch {
    // best-effort; don't block pipeline
  }
}

export async function updateSessionCasesTotal(
  reportPath: string,
  casesTotal: number,
): Promise<void> {
  try {
    let prev = await fs.readFile(reportPath, "utf8");
    prev = prev.replace(/CASES_TOTAL:\s*\d+/g, `CASES_TOTAL: ${casesTotal}`);
    await fs.writeFile(reportPath + ".tmp", prev, "utf8");
    await fs.rename(reportPath + ".tmp", reportPath);
  } catch {
    // Best effort update
  }
}

// ============================================================================
// Report File Writing
// ============================================================================

export function writeJsonlReport(content: string, outputPath: string): void {
  mkdirSync(join(outputPath, ".."), { recursive: true });
  writeFileSync(outputPath, content, "utf-8");
}

export function writeMarkdownReport(content: string, outputPath: string): void {
  mkdirSync(join(outputPath, ".."), { recursive: true });
  writeFileSync(outputPath, content, "utf-8");
}

export function writeCsvReport(content: string, outputPath: string): void {
  mkdirSync(join(outputPath, ".."), { recursive: true });
  writeFileSync(outputPath, content, "utf-8");
}

export function writeJsonReport(content: string, outputPath: string): void {
  mkdirSync(join(outputPath, ".."), { recursive: true });
  writeFileSync(outputPath, content, "utf-8");
}

// ============================================================================
// Historical Data Loading
// ============================================================================

export interface HistoricalReport {
  timestamp: string;
  session_id: string;
  content: string;
  metrics: {
    meanScore?: number;
    costUsd?: number;
    p95Ms?: number;
  };
}

export function loadHistoricalReports(
  outputDir: string,
  limit: number = 10,
): HistoricalReport[] {
  const historyDir = join(outputDir, "history");

  if (!existsSync(historyDir)) {
    return [];
  }

  try {
    const dirs = readdirSync(historyDir)
      .filter((d) => d.match(/^\d{8}_\d{6}$/))
      .sort()
      .slice(-limit);

    const reports: HistoricalReport[] = [];

    for (const dir of dirs) {
      const sessionReportPath = join(historyDir, dir, "session_report.md");
      if (existsSync(sessionReportPath)) {
        const content = readFileSync(sessionReportPath, "utf-8");

        // Extract metrics from session report
        const meanScoreMatch = content.match(/MEAN_SCORE: ([\d.]+)/);
        const costMatch = content.match(/COST_USD: ([\d.]+)/);
        const p95Match = content.match(/P95_MS: ([\d.]+)/);
        const timestampMatch = content.match(/TIMESTAMP: ([^\n]+)/);

        if (timestampMatch) {
          reports.push({
            timestamp: timestampMatch[1],
            session_id: dir,
            content,
            metrics: {
              meanScore: meanScoreMatch
                ? parseFloat(meanScoreMatch[1])
                : undefined,
              costUsd: costMatch ? parseFloat(costMatch[1]) : undefined,
              p95Ms: p95Match ? parseFloat(p95Match[1]) : undefined,
            },
          });
        }
      }
    }

    return reports;
  } catch (error) {
    console.warn(`Warning: Failed to load historical reports: ${error}`);
    return [];
  }
}

// ============================================================================
// DLQ (Dead Letter Queue) Management
// ============================================================================

export interface DLQSummary {
  count: number;
  recentItems: string[];
  reprocessCommand: string;
}

export function loadDLQSummary(outputDir: string): DLQSummary {
  const dlqDir = join(outputDir, "dlq");
  const dlqIndexPath = join(dlqDir, "index.jsonl");

  const summary: DLQSummary = {
    count: 0,
    recentItems: [],
    reprocessCommand: "npm run dev -- --reprocess-dlq",
  };

  if (!existsSync(dlqIndexPath)) {
    return summary;
  }

  try {
    const content = readFileSync(dlqIndexPath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    summary.count = lines.length;
    summary.recentItems = lines.slice(-5).map((line) => {
      try {
        const entry = JSON.parse(line);
        return entry.run_id || "unknown";
      } catch {
        return "unknown";
      }
    });
  } catch (error) {
    console.warn(`Warning: Failed to load DLQ summary: ${error}`);
  }

  return summary;
}

// ============================================================================
// Configuration Management
// ============================================================================

export function loadConfigFile(configPath: string): any {
  try {
    const content = readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error}`);
  }
}

export function saveConfigFile(configPath: string, config: any): void {
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  } catch (error) {
    throw new Error(`Failed to save config to ${configPath}: ${error}`);
  }
}

// ============================================================================
// Schema Validation File Loading
// ============================================================================

export function loadSchemaFile(schemaPath: string): any {
  try {
    const content = readFileSync(schemaPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load schema from ${schemaPath}: ${error}`);
  }
}

// ============================================================================
// Historical Metrics Loading (JSONL)
// ============================================================================

export interface HistoricalMetricsFile {
  filePath: string;
  lines: string[];
  summary: any;
}

export function loadHistoricalMetricsFiles(
  historyDir: string,
  limit: number = 10,
): HistoricalMetricsFile[] {
  if (!existsSync(historyDir)) {
    return [];
  }

  try {
    const dirs = readdirSync(historyDir)
      .filter((d) => d.match(/^\d{8}_\d{6}$/))
      .sort()
      .slice(-limit);

    const files: HistoricalMetricsFile[] = [];

    for (const dir of dirs) {
      const reportPath = join(historyDir, dir, "baseline_report.jsonl");
      if (existsSync(reportPath)) {
        const content = readFileSync(reportPath, "utf-8");
        const lines = content.trim().split("\n").filter(Boolean);

        if (lines.length > 0) {
          try {
            const summaryLine = lines[lines.length - 1];
            const summary = JSON.parse(summaryLine);

            files.push({
              filePath: reportPath,
              lines,
              summary,
            });
          } catch (error) {
            console.warn(`Failed to parse ${reportPath}: ${error}`);
          }
        }
      }
    }

    return files;
  } catch (error) {
    console.warn(`Failed to load historical metrics: ${error}`);
    return [];
  }
}
