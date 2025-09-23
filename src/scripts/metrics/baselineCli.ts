#!/usr/bin/env npx ts-node
/**
 * CLI wrapper for baseline report generator with threshold autocalibration support
 */

// Support both ts-node (direct .ts) and bundled .mjs execution.
// Prefer ESM-friendly import that works in ts-node and esbuild bundle.
import {
  generateBaselineReports,
  prewriteSessionMeta,
} from "./baselineReportGenerator.js";
import { readFileSync } from "fs";

interface CLIArgs {
  data?: string;
  config?: string;
  session?: string;
  budget?: string;
  profile?: string;
  autocalibrate?: boolean;
  applyCalibration?: boolean;
  help?: boolean;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {};

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];

    if (arg.startsWith("--data=")) {
      args.data = arg.split("=")[1];
    } else if (arg.startsWith("--config=")) {
      args.config = arg.split("=")[1];
    } else if (arg.startsWith("--session=")) {
      args.session = arg.split("=")[1];
    } else if (arg.startsWith("--budget=")) {
      args.budget = arg.split("=")[1];
    } else if (arg.startsWith("--profile=")) {
      args.profile = arg.split("=")[1];
    } else if (arg === "--autocalibrate") {
      args.autocalibrate = true;
    } else if (arg === "--apply-calibration") {
      args.applyCalibration = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
Baseline v1.5 Metrics Generator CLI

Usage: npx ts-node scripts/metrics/baseline_cli.ts [options]

Options:
  --data=<path>           Path to JSONL data file with QA items
  --config=<path>         Path to baseline_config.json (default: baseline_config.json)
  --session=<id>          Session ID for the report (default: baseline_<timestamp>)
  --budget=<amount>       Budget in USD for the analysis (default: 0)
  --profile=<name>        Profile for threshold evaluation (dev|stage|prod, default: dev)
  --autocalibrate         Enable threshold auto-calibration
  --apply-calibration     Auto-apply calibration changes (implies --autocalibrate)
  --help, -h              Show this help message

Examples:
  # Basic usage
  npx ts-node scripts/metrics/baseline_cli.ts --data=outputs/qa_items.jsonl

  # With threshold autocalibration
  npx ts-node scripts/metrics/baseline_cli.ts --data=outputs/qa_items.jsonl --profile=stage --autocalibrate

  # Apply threshold changes automatically
  npx ts-node scripts/metrics/baseline_cli.ts --data=outputs/qa_items.jsonl --profile=prod --apply-calibration

Output:
  - reports/baseline_report.jsonl    Machine-readable data
  - reports/baseline_report.md       Human-readable report
`);
}

function loadQAItems(dataPath: string): any[] {
  try {
    const content = readFileSync(dataPath, "utf-8");
    const lines = content.trim().split("\n");

    return lines
      .map((line, index) => {
        try {
          const item = JSON.parse(line);
          return {
            qa: item.qa || { q: item.question || "", a: item.answer || "" },
            evidence: item.evidence || item.evidence_text || "",
            cost_usd: item.cost_usd || 0,
            latency_ms: item.latency_ms || 0,
            index: index,
            source_text: item.source_text || "",
          };
        } catch (error) {
          console.warn(`Failed to parse line ${index + 1}: ${error}`);
          return null;
        }
      })
      .filter((item) => item !== null);
  } catch (error) {
    console.error(`Failed to load data from ${dataPath}: ${error}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  // 0) Prewrite minimal session meta as early as possible
  //    (so even on mid-pipeline failure, MODE/DRY_RUN/CASES_TOTAL stay consistent)
  await prewriteSessionMeta({
    profile: process.env.PROFILE ?? "dev",
    mode:
      process.env.BASELINE_MODE ??
      (process.argv.includes("--full") ? "full" : "smoke"),
    dryRun: process.argv.includes("--smoke")
      ? "true"
      : process.argv.includes("--full")
        ? "false"
        : "unknown",
    // cases will be filled after data load; write a provisional 0 now, then update later
    casesTotal: 0,
  });

  const args = parseArgs();

  if (args.help) {
    showHelp();
    process.exit(0);
  }

  if (!args.data) {
    console.error("Error: --data parameter is required");
    console.error("Use --help for usage information");
    process.exit(1);
  }

  const config = args.config || "baseline_config.json";
  const sessionId = args.session || `baseline_${Date.now()}`;
  const budget = args.budget ? parseFloat(args.budget) : 0;
  const profile = args.profile || "dev";
  const autocalibrate = args.autocalibrate || args.applyCalibration || false;
  const applyCalibration = args.applyCalibration || false;

  console.log("🚀 Starting Baseline v1.5 Metrics Generation");
  console.log(`📊 Data: ${args.data}`);
  console.log(`⚙️ Config: ${config}`);
  console.log(`🆔 Session: ${sessionId}`);
  console.log(`💰 Budget: $${budget}`);
  console.log(`🎯 Profile: ${profile}`);
  console.log(`📈 Auto-calibrate: ${autocalibrate ? "enabled" : "disabled"}`);
  console.log(`✅ Apply changes: ${applyCalibration ? "enabled" : "disabled"}`);
  console.log("");

  try {
    // Load QA items from JSONL file
    console.log(`📖 Loading QA items from: ${args.data}`);
    const qaItems = loadQAItems(args.data);
    console.log(`✅ Loaded ${qaItems.length} QA items`);

    // Generate reports with threshold validation
    const result = await generateBaselineReports(qaItems, {
      sessionId,
      budgetLimit: budget,
      profile,
      enableAutocalibration: autocalibrate,
      applyCalibration,
      enableSchemaValidation: true,
      includeFullData: true,
    });

    console.log("\n🎉 Generation Complete!");
    console.log(`📄 Markdown Report: ${result.markdownPath}`);
    console.log(`📊 JSONL Data: ${result.jsonlPath}`);
    console.log(`🔒 Integrity Hash: ${result.hash}`);
    console.log(
      `🏆 Quality Score: ${(result.summary.overall_quality_score * 100).toFixed(1)}%`,
    );

    if (result.gating) {
      console.log(`🚪 Gate Status: ${result.gating.gate_status}`);
      console.log(
        `✅ Can Proceed: ${result.gating.can_proceed ? "YES" : "NO"}`,
      );

      if (result.gating.p0_violations.length > 0) {
        console.log(`🚨 P0 Violations: ${result.gating.p0_violations.length}`);
      }
      if (result.gating.p1_warnings.length > 0) {
        console.log(`⚠️ P1 Warnings: ${result.gating.p1_warnings.length}`);
      }
      if (result.gating.p2_issues.length > 0) {
        console.log(`🟡 P2 Issues: ${result.gating.p2_issues.length}`);
      }
    }

    if (result.calibrationResults && result.calibrationResults.length > 0) {
      const appliedCount = result.calibrationResults.filter(
        (c: any) => c.applied,
      ).length;
      console.log(
        `📈 Calibration: ${appliedCount}/${result.calibrationResults.length} changes applied`,
      );
    }

    if (result.schemaValidationResults) {
      const validCount = result.schemaValidationResults.filter(
        (r: any) => r.valid,
      ).length;
      console.log(
        `📋 Schema: ${validCount}/${result.schemaValidationResults.length} records valid`,
      );
    }

    // Exit with appropriate code based on gating
    if (result.gating?.gate_status === "FAIL") {
      console.log("\n❌ Exiting with failure due to P0 violations");
      process.exit(1);
    } else if (result.gating?.gate_status === "PARTIAL") {
      console.log("\n🟡 Exiting with partial success (warnings present)");
      process.exit(2);
    } else {
      console.log("\n✅ Success!");
      process.exit(0);
    }
  } catch (error) {
    console.error("\n❌ Generation failed:", error);
    process.exit(1);
  }
}

// Run if called directly (ESM compatible)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
