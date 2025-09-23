#!/usr/bin/env node

/**
 * JSON-only CLI adapter for fe-web app
 * Reads JSON from STDIN, processes request, outputs single JSON line to STDOUT
 */

const fs = require("fs");
const process = require("process");

function generateDeterministicSampleData(input) {
  // Use input hash for deterministic but varied results
  const inputStr = JSON.stringify(input);
  const hash = inputStr.split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  const seed = Math.abs(hash);

  // Deterministic random using seed
  const random = (min = 0, max = 1) => {
    const x = Math.sin(seed * 9999) * 10000;
    const normalized = x - Math.floor(x);
    return min + normalized * (max - min);
  };

  const passRate = Math.round(random(0.6, 0.9) * 100) / 100;
  const avgScore = Math.round(random(6.0, 8.5) * 10) / 10;
  const avgLatency = Math.round(random(1500, 2500));
  const vetoedPct = Math.round(random(0.1, 0.4) * 100) / 100;

  const allIssues = [
    "hallucination",
    "too_easy",
    "format_issue",
    "unclear",
    "too_long",
    "factual_error",
    "bias",
  ];
  const issuesTop3 = allIssues.slice(0, 3);

  const samples = [];
  for (let i = 1; i <= 3; i++) {
    const sampleSeed = seed + i * 1000;
    const sampleRandom = (min = 0, max = 1) => {
      const x = Math.sin(sampleSeed * 9999) * 10000;
      const normalized = x - Math.floor(x);
      return min + normalized * (max - min);
    };

    const statuses = ["passed", "failed", "vetoed"];
    const status = statuses[Math.floor(sampleRandom() * statuses.length)];
    const score = Math.round(sampleRandom(4.5, 9.0) * 10) / 10;
    const latencyMs = Math.round(sampleRandom(1200, 2800));

    let issues = [];
    if (status === "failed" || status === "vetoed") {
      const numIssues = Math.floor(sampleRandom(1, 4));
      issues = allIssues.slice(0, numIssues);
    }

    samples.push({
      id: `sample-${String(i).padStart(3, "0")}`,
      status,
      score,
      latencyMs,
      issues,
    });
  }

  const currentDate = new Date().toISOString().split("T")[0];
  const runId = String(Math.floor(random(1, 999))).padStart(3, "0");

  return {
    metrics: {
      passRate,
      avgScore,
      avgLatency,
      vetoedPct,
    },
    issuesTop3,
    samples,
    links: {
      runLogPath: `docs/RUN_LOGS/${currentDate}_run-${runId}.md`,
      decisionPath: `docs/LEDGER/dec-${currentDate.replace(/-/g, "")}-${runId}.md`,
    },
    suggestedTags: issuesTop3.slice(0, 2),
  };
}

async function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";

    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (chunk) => {
      data += chunk;
    });

    process.stdin.on("end", () => {
      resolve(data);
    });

    process.stdin.on("error", (err) => {
      reject(err);
    });

    // Handle case where stdin is empty or not piped
    setTimeout(() => {
      if (data === "") {
        reject(new Error("No input received from STDIN"));
      }
    }, 1000);
  });
}

async function main() {
  try {
    // Read entire STDIN as UTF-8 string
    const stdinData = await readStdin();

    if (!stdinData.trim()) {
      throw new Error("Empty input received from STDIN");
    }

    // Parse JSON request
    let request;
    try {
      request = JSON.parse(stdinData.trim());
    } catch (parseError) {
      throw new Error(`Invalid JSON input: ${parseError.message}`);
    }

    // Validate basic structure
    if (typeof request !== "object" || request === null) {
      throw new Error("Input must be a JSON object");
    }

    // Generate deterministic result based on input
    const result = generateDeterministicSampleData(request);

    // Output only the JSON result to STDOUT
    console.log(JSON.stringify(result));

    // Exit successfully
    process.exit(0);
  } catch (error) {
    // Log error to STDERR (not STDOUT to keep STDOUT clean for JSON)
    console.error(`Error: ${error.message}`);

    // Exit with error code
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error.message);
  process.exit(1);
});

// Start the CLI
main();
