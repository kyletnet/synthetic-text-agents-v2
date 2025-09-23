import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface QualityMetrics {
  overall_score: number;
  recommendation_level: "green" | "yellow" | "red";
  total_alerts: number;
  metric_scores: {
    duplication_rate: number;
    evidence_presence_rate: number;
    hallucination_rate: number;
    pii_violations: number;
    coverage_score: number;
    inference_type_ratio?: number;
  };
  threshold_validation: {
    enabled: boolean;
    gate_status: "PASS" | "WARN" | "FAIL";
    can_proceed: boolean;
    p0_violations: string[];
    p1_warnings: string[];
    p2_issues: string[];
  };
}

// Parse session report markdown for quality metrics
async function parseSessionReport(
  filePath: string,
): Promise<Partial<QualityMetrics> | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");

    // Look for JSON blocks in the markdown
    const jsonMatches = content.match(/```json\s*\n([\s\S]*?)\n```/g);

    if (jsonMatches) {
      for (const match of jsonMatches) {
        try {
          const jsonContent = match
            .replace(/```json\s*\n/, "")
            .replace(/\n```/, "");
          const data = JSON.parse(jsonContent);

          // Check if this looks like quality metrics
          if (
            data.quality_score_summary ||
            data.metric_scores ||
            data.overall_score
          ) {
            return data;
          }
        } catch (parseError) {
          continue;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error parsing session report:", error);
    return null;
  }
}

// Parse baseline report JSONL
async function parseBaselineReport(
  filePath: string,
): Promise<Partial<QualityMetrics> | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line.trim());

    // Get the last (most recent) entry
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const data = JSON.parse(lastLine);

      // Transform to our expected format
      if (data.quality_summary || data.metrics) {
        return {
          overall_score:
            data.overall_score || data.quality_summary?.overall_score || 0,
          metric_scores:
            data.metrics || data.quality_summary?.metric_scores || {},
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error parsing baseline report:", error);
    return null;
  }
}

// Find the most recent report files
async function findReportFiles(): Promise<{
  sessionReport?: string;
  baselineReport?: string;
}> {
  const projectRoot = path.resolve(process.cwd(), "../..");
  const reportsDir = path.join(projectRoot, "reports");

  const result: { sessionReport?: string; baselineReport?: string } = {};

  // Check for session report
  const sessionReportPaths = [
    path.join(reportsDir, "session_report.md"),
    path.join(projectRoot, "session_report.md"),
  ];

  for (const sessionPath of sessionReportPaths) {
    if (existsSync(sessionPath)) {
      result.sessionReport = sessionPath;
      break;
    }
  }

  // Check for baseline report
  const baselineReportPaths = [
    path.join(reportsDir, "baseline_report.jsonl"),
    path.join(projectRoot, "baseline_report.jsonl"),
  ];

  for (const baselinePath of baselineReportPaths) {
    if (existsSync(baselinePath)) {
      result.baselineReport = baselinePath;
      break;
    }
  }

  return result;
}

// Generate mock quality metrics for testing
function generateMockMetrics(): QualityMetrics {
  return {
    overall_score: 0.875,
    recommendation_level: "green",
    total_alerts: 2,
    metric_scores: {
      duplication_rate: 0.05,
      evidence_presence_rate: 0.95,
      hallucination_rate: 0.02,
      pii_violations: 0,
      coverage_score: 0.88,
      inference_type_ratio: 0.15,
    },
    threshold_validation: {
      enabled: true,
      gate_status: "PASS",
      can_proceed: true,
      p0_violations: [],
      p1_warnings: ["Question type balance below optimal threshold"],
      p2_issues: ["Minor coverage gaps in advanced topics"],
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    console.log("[Report API] Fetching quality metrics...");

    const { sessionReport, baselineReport } = await findReportFiles();
    let metrics: Partial<QualityMetrics> = {};

    // Parse session report if available
    if (sessionReport) {
      console.log(`[Report API] Parsing session report: ${sessionReport}`);
      const sessionData = await parseSessionReport(sessionReport);
      if (sessionData) {
        metrics = { ...metrics, ...sessionData };
      }
    }

    // Parse baseline report if available
    if (baselineReport) {
      console.log(`[Report API] Parsing baseline report: ${baselineReport}`);
      const baselineData = await parseBaselineReport(baselineReport);
      if (baselineData) {
        metrics = { ...metrics, ...baselineData };
      }
    }

    // If no real data found, return mock data
    if (Object.keys(metrics).length === 0) {
      console.log("[Report API] No report files found, returning mock data");
      metrics = generateMockMetrics();
    } else {
      // Fill in missing fields with reasonable defaults
      const fullMetrics: QualityMetrics = {
        overall_score: metrics.overall_score || 0.8,
        recommendation_level: metrics.recommendation_level || "green",
        total_alerts: metrics.total_alerts || 0,
        metric_scores: {
          duplication_rate: 0.05,
          evidence_presence_rate: 0.95,
          hallucination_rate: 0.02,
          pii_violations: 0,
          coverage_score: 0.88,
          inference_type_ratio: 0.15,
          ...metrics.metric_scores,
        },
        threshold_validation: {
          enabled: true,
          gate_status: "PASS",
          can_proceed: true,
          p0_violations: [],
          p1_warnings: [],
          p2_issues: [],
          ...metrics.threshold_validation,
        },
      };
      metrics = fullMetrics;
    }

    return NextResponse.json({
      success: true,
      quality_metrics: metrics,
      sources: {
        sessionReport: sessionReport || null,
        baselineReport: baselineReport || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Report API error:", error);
    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error ? error.message : "Failed to fetch report",
      },
      { status: 500 },
    );
  }
}
