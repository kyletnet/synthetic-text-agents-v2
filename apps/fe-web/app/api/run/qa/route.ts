import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { processLifecycleManager } from "@/lib/process-lifecycle-manager";

// Generate a unique run ID
function generateRunId(): string {
  return `qa-run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// Execute run_v3.sh script
function executeScript(
  fileId: string,
  inputType: string,
  runId: string,
): Promise<{ success: boolean; result?: any; error?: string }> {
  return new Promise((resolve) => {
    const projectRoot = path.resolve(process.cwd(), "../..");
    const scriptPath = path.join(projectRoot, "run_v3.sh");

    // Prepare the command based on input type
    const args = [
      "baseline",
      "--smoke",
      "--profile",
      "stage",
      "--budget",
      "1.00",
      "--run-id",
      runId,
    ];

    // Add data path if we have file
    if (fileId) {
      const dataPath = path.join(process.cwd(), "data", "uploads", fileId);
      args.push("--data", dataPath);
    }

    console.log(`[QA API] Executing: bash ${scriptPath} ${args.join(" ")}`);

    const child = processLifecycleManager.spawnManaged(
      "bash",
      [scriptPath, ...args],
      {
        cwd: projectRoot,
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, RUN_ID: runId },
      },
    );

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
        // Parse output for useful information
        const lines = stdout.split("\n");
        let pairsGenerated = 0;
        let processingTime = "Unknown";

        // Look for indicators of successful generation
        for (const line of lines) {
          if (line.includes("Generated") && line.includes("pairs")) {
            const match = line.match(/(\d+)/);
            if (match) pairsGenerated = parseInt(match[1]);
          }
          if (line.includes("Processing time") || line.includes("duration")) {
            const match = line.match(/(\d+(?:\.\d+)?)\s*(ms|seconds?|s)/);
            if (match) processingTime = `${match[1]}${match[2]}`;
          }
        }

        resolve({
          success: true,
          result: {
            runId,
            pairsGenerated,
            processingTime,
            exitCode: code,
            timestamp: new Date().toISOString(),
          },
        });
      } else {
        resolve({
          success: false,
          error: `Script failed with exit code ${code}. Stderr: ${stderr || "No error details"}`,
        });
      }
    });

    child.on("error", (error) => {
      resolve({
        success: false,
        error: `Failed to start script: ${error.message}`,
      });
    });

    // Set timeout to prevent hanging
    setTimeout(
      () => {
        child.kill("SIGTERM");
        resolve({
          success: false,
          error: "Script execution timed out after 5 minutes",
        });
      },
      5 * 60 * 1000,
    ); // 5 minutes
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileId, inputType } = body;

    if (!fileId || !inputType) {
      return NextResponse.json(
        { error: true, message: "fileId and inputType are required" },
        { status: 400 },
      );
    }

    // Verify file exists
    const filePath = path.join(process.cwd(), "data", "uploads", fileId);
    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        { error: true, message: "Uploaded file not found" },
        { status: 404 },
      );
    }

    const runId = generateRunId();
    console.log(
      `[QA API] Starting QA generation for file ${fileId} with run ID ${runId}`,
    );

    // Execute the generation script
    const result = await executeScript(fileId, inputType, runId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        ...result.result,
      });
    } else {
      return NextResponse.json(
        {
          error: true,
          message: result.error || "QA generation failed",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("QA generation error:", error);
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
