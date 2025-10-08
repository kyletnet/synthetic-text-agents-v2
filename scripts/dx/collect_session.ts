/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * DxLoop v1 - Session Data Collection
 * Scans and collects core fields from session reports, baseline reports, and LLM analysis
 */

import { promises as fs } from "fs";
import { glob } from "glob";
import { SessionData } from "./types.js";

export interface SessionCollection {
  session_report?: SessionData;
  baseline_report?: any;
  llm_analysis?: any;
  files_found: {
    session_report: string | null;
    baseline_report: string | null;
    llm_analysis: string | null;
  };
  collection_timestamp: string;
}

/**
 * Parse session report markdown to extract summary block
 */
async function parseSessionReport(
  filePath: string,
): Promise<SessionData | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");

    // Find the summary block
    const summaryMatch = content.match(/```\n(SESSION_ID:.*?)\n```/s);
    if (!summaryMatch) {
      console.warn(`No summary block found in ${filePath}`);
      return null;
    }

    const summaryLines = summaryMatch[1].split("\n");
    const data: any = {};

    for (const line of summaryLines) {
      const [key, ...valueParts] = line.split(": ");
      if (key && valueParts.length > 0) {
        const value = valueParts.join(": ").trim();

        // Convert to appropriate types
        switch (key) {
          case "DRY_RUN":
            data[key.toLowerCase()] = value === "true";
            break;
          case "OFFLINE_MODE":
            data[key.toLowerCase().replace("_", "_")] = value === "true";
            break;
          case "BUDGET_USD":
          case "COST_USD":
          case "PASS_RATE":
          case "MEAN_SCORE":
            data[key.toLowerCase()] = parseFloat(value) || 0;
            break;
          case "DURATION_MS":
          case "PANEL_SIZE":
          case "TOKENS_EST":
          case "CASES_TOTAL":
          case "CASES_PASSED":
          case "P50_MS":
          case "P95_MS":
            data[key.toLowerCase()] = parseInt(value) || 0;
            break;
          default:
            data[key.toLowerCase()] = value;
        }
      }
    }

    return {
      session_id: data.session_id || "",
      run_id: data.run_id || "",
      target: data.target || "",
      profile: data.profile || "dev",
      mode: data.mode || "",
      dry_run: data.dry_run || false,
      offline_mode: data.offline_mode || false,
      budget_usd: data.budget_usd || 0,
      cost_usd: data.cost_usd || 0,
      duration_ms: data.duration_ms || 0,
      model_id: data.model_id || "",
      cases_total: data.cases_total || 0,
      cases_passed: data.cases_passed || 0,
      pass_rate: data.pass_rate || 0,
      mean_score: data.mean_score || 0,
      p50_ms: data.p50_ms || 0,
      p95_ms: data.p95_ms || 0,
      result: data.result || "",
      run_state: data.run_state || "",
      timestamp: data.timestamp || new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error parsing session report ${filePath}:`, error);
    return null;
  }
}

/**
 * Parse baseline report JSONL to extract summary metrics
 */
async function parseBaselineReport(filePath: string): Promise<any | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.trim().split("\n");

    if (lines.length === 0) {
      return null;
    }

    // Parse first line as summary
    const summary = JSON.parse(lines[0]);

    return {
      quality_score: summary.quality_score || 0,
      alert_flags: summary.alert_flags || [],
      duplication_rate: summary.duplication_metrics?.rate || 0,
      evidence_presence_rate: summary.evidence_metrics?.presence_rate || 0,
      hallucination_rate: summary.hallucination_metrics?.rate || 0,
      pii_hits: summary.pii_license_metrics?.pii_hits || 0,
      license_violations: summary.pii_license_metrics?.license_violations || 0,
      total_items: lines.length,
      timestamp: summary.timestamp || new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error parsing baseline report ${filePath}:`, error);
    return null;
  }
}

/**
 * Parse LLM analysis JSON to extract panel scores and metrics
 */
async function parseLLMAnalysis(filePath: string): Promise<any | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const analysis = JSON.parse(content);

    return {
      summary: analysis.summary || {},
      panel_scores: analysis.panel_scores || [],
      mean_score: analysis.summary?.mean_score || 0,
      total_cases: analysis.summary?.total_cases || 0,
      passed_cases: analysis.summary?.passed_cases || 0,
      p50_latency_ms: analysis.summary?.p50_latency_ms || 0,
      p95_latency_ms: analysis.summary?.p95_latency_ms || 0,
      cost_metrics: analysis.cost_metrics || {},
      timestamp: analysis.timestamp || new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error parsing LLM analysis ${filePath}:`, error);
    return null;
  }
}

/**
 * Find the most recent file matching pattern
 */
async function findMostRecentFile(pattern: string): Promise<string | null> {
  try {
    const files = await glob(pattern);
    if (files.length === 0) {
      return null;
    }

    // Get file stats and sort by modification time
    const fileStats = await Promise.all(
      files.map(async (file) => {
        const stats = await fs.stat(file);
        return { file, mtime: stats.mtime };
      }),
    );

    fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return fileStats[0].file;
  } catch (error) {
    console.error(`Error finding files for pattern ${pattern}:`, error);
    return null;
  }
}

/**
 * Collect session data from all available sources
 */
export async function collectSessionData(): Promise<SessionCollection> {
  const collection: SessionCollection = {
    files_found: {
      session_report: null,
      baseline_report: null,
      llm_analysis: null,
    },
    collection_timestamp: new Date().toISOString(),
  };

  try {
    // Find most recent session report
    const sessionReportFile = await findMostRecentFile(
      "reports/session_report.md",
    );
    if (sessionReportFile) {
      collection.files_found.session_report = sessionReportFile;
      collection.session_report =
        (await parseSessionReport(sessionReportFile)) || undefined;
    }

    // Find most recent baseline report
    const baselineReportFile = await findMostRecentFile(
      "reports/baseline_report.jsonl",
    );
    if (baselineReportFile) {
      collection.files_found.baseline_report = baselineReportFile;
      collection.baseline_report = await parseBaselineReport(
        baselineReportFile,
      );
    }

    // Find most recent LLM analysis
    const llmAnalysisFile = await findMostRecentFile(
      "reports/LLM_ANALYSIS_*.json",
    );
    if (llmAnalysisFile) {
      collection.files_found.llm_analysis = llmAnalysisFile;
      collection.llm_analysis = await parseLLMAnalysis(llmAnalysisFile);
    }

    console.log("Session data collection completed:", {
      session_report: !!collection.session_report,
      baseline_report: !!collection.baseline_report,
      llm_analysis: !!collection.llm_analysis,
      files_found: collection.files_found,
    });

    return collection;
  } catch (error) {
    console.error("Error during session data collection:", error);
    throw error;
  }
}

/**
 * CLI interface for session data collection
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === "collect") {
    collectSessionData()
      .then((collection) => {
        console.log("Collection Result:");
        console.log(JSON.stringify(collection, null, 2));
      })
      .catch((error) => {
        console.error("Collection failed:", error);
        process.exit(1);
      });
  } else {
    console.log("Usage: node collect_session.js collect");
    process.exit(1);
  }
}
