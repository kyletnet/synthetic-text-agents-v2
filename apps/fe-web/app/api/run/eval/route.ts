import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { processLifecycleManager } from "@/lib/process-lifecycle-manager";

// Generate a unique evaluation ID
function generateEvalId(): string {
  return `eval-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// Execute evaluation script
function executeEvaluation(
  fileId?: string,
  runId?: string,
  evalId?: string,
): Promise<{ success: boolean; result?: any; error?: string }> {
  return new Promise((resolve) => {
    const projectRoot = path.resolve(process.cwd(), "../..");
    const scriptPath = path.join(projectRoot, "run_v3.sh");

    // For evaluation, we typically run baseline metrics on existing output
    const args = [
      "baseline",
      "--eval-only",
      "--profile",
      "stage",
      "--budget",
      "0.50",
    ];

    if (evalId) {
      args.push("--run-id", evalId);
    }

    console.log(`[Eval API] Executing: bash ${scriptPath} ${args.join(" ")}`);

    const child = processLifecycleManager.spawnManaged("bash", [scriptPath, ...args], {
      cwd: projectRoot,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, EVAL_ID: evalId },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        // Parse output for quality metrics
        const lines = stdout.split("\n");
        let overallScore = 0;
        let qualityLevel = "Unknown";
        let issuesCount = 0;

        // Look for quality indicators
        for (const line of lines) {
          if (
            line.includes("Overall score") ||
            line.includes("Quality score")
          ) {
            const match = line.match(/(\d+(?:\.\d+)?)\%?/);
            if (match) overallScore = parseFloat(match[1]);
          }
          if (
            line.includes("Quality level") ||
            line.includes("Recommendation")
          ) {
            const match = line.match(/(GREEN|YELLOW|RED|PASS|WARN|FAIL)/i);
            if (match) qualityLevel = match[1].toUpperCase();
          }
          if (line.includes("issues") || line.includes("violations")) {
            const match = line.match(/(\d+)/);
            if (match) issuesCount += parseInt(match[1]);
          }
        }

        // Map quality level to user-friendly terms
        const qualityMapping = {
          GREEN: "Excellent",
          PASS: "Good",
          YELLOW: "Fair",
          WARN: "Needs Review",
          RED: "Poor",
          FAIL: "Poor",
        };

        resolve({
          success: true,
          result: {
            evalId,
            overallScore: overallScore > 1 ? overallScore / 100 : overallScore, // Normalize to 0-1
            qualityLevel:
              qualityMapping[qualityLevel as keyof typeof qualityMapping] ||
              qualityLevel,
            issuesCount,
            exitCode: code,
            timestamp: new Date().toISOString(),
            sourceRunId: runId,
          },
        });
      } else {
        resolve({
          success: false,
          error: `Evaluation failed with exit code ${code}. Stderr: ${stderr || "No error details"}`,
        });
      }
    });

    child.on("error", (error) => {
      resolve({
        success: false,
        error: `Failed to start evaluation: ${error.message}`,
      });
    });

    // Set timeout
    setTimeout(
      () => {
        child.kill("SIGTERM");
        resolve({
          success: false,
          error: "Evaluation timed out after 3 minutes",
        });
      },
      3 * 60 * 1000,
    ); // 3 minutes
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileId, runId } = body;

    const evalId = generateEvalId();
    console.log(
      `[Eval API] Starting quality evaluation with eval ID ${evalId}`,
    );

    // Execute the evaluation script
    const result = await executeEvaluation(fileId, runId, evalId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        ...result.result,
      });
    } else {
      return NextResponse.json(
        {
          error: true,
          message: result.error || "Quality evaluation failed",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json(
      {
        error: true,
        message:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
