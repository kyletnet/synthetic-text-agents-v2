#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Phase 1 Readiness Check - 10-Minute Pre-Launch Routine
 *
 * Purpose:
 * - Comprehensive validation before Phase 1 Multi-Agent expansion
 * - Validates all 3 predictive systems: Entropy, Governance, Bus
 * - Generates readiness report with GO/NO-GO decision
 *
 * Usage:
 *   npm run phase1:readiness          # Full 10-minute check
 *   npm run phase1:readiness -- --quick # Skip stress tests (5-minute)
 */

import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";

const READINESS_REPORT = join(process.cwd(), "reports/phase1-readiness.json");

interface CheckResult {
  check: string;
  status: "PASS" | "FAIL" | "WARN";
  message: string;
  details?: string;
}

interface ReadinessReport {
  timestamp: string;
  duration_seconds: number;
  checks: CheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  decision: "GO" | "NO-GO" | "CONDITIONAL-GO";
  recommendation: string;
  next_steps: string[];
}

const results: CheckResult[] = [];

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║   Phase 1 Readiness - 10-Minute Pre-Launch Routine        ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

const startTime = Date.now();

/**
 * Check 1: Predictive Entropy Analysis
 */
function check1_EntropyPrediction(): CheckResult {
  console.log("=".repeat(60));
  console.log("Check 1/3: Predictive Entropy Analysis");
  console.log("=".repeat(60));
  console.log("   Purpose: Predict SBOM drift for next 4 weeks\n");

  try {
    const output = execSync("npm run entropy:predictor -- --weeks 4", {
      encoding: "utf8",
      stdio: "pipe",
    });

    if (output.includes("LOW RISK") || output.includes("Learning phase")) {
      console.log("   ✅ PASS - Entropy prediction within safe range\n");
      return {
        check: "Predictive Entropy Analysis",
        status: "PASS",
        message: "Drift prediction safe for 4 weeks",
      };
    } else if (output.includes("MODERATE")) {
      console.log("   ⚠️  WARN - Moderate drift predicted\n");
      return {
        check: "Predictive Entropy Analysis",
        status: "WARN",
        message: "Moderate drift predicted - monitor closely",
        details: output.substring(0, 500),
      };
    } else {
      console.log("   ❌ FAIL - High drift predicted\n");
      return {
        check: "Predictive Entropy Analysis",
        status: "FAIL",
        message: "High drift predicted - strict re-lock recommended",
        details: output.substring(0, 500),
      };
    }
  } catch (error) {
    const errorOutput = (error as any).stdout || (error as any).message;

    if (errorOutput?.includes("HIGH RISK") || errorOutput?.includes("CRITICAL")) {
      console.log("   ❌ FAIL - Critical drift risk\n");
      return {
        check: "Predictive Entropy Analysis",
        status: "FAIL",
        message: "Critical drift risk detected",
        details: errorOutput?.substring(0, 500),
      };
    }

    console.log("   ❌ FAIL - Entropy predictor error\n");
    return {
      check: "Predictive Entropy Analysis",
      status: "FAIL",
      message: "Entropy predictor failed",
      details: errorOutput?.substring(0, 500),
    };
  }
}

/**
 * Check 2: Governance Health Status
 */
function check2_GovernanceHealth(): CheckResult {
  console.log("=".repeat(60));
  console.log("Check 2/3: Governance Health Status");
  console.log("=".repeat(60));
  console.log("   Purpose: Verify SAFE_MODE counter health\n");

  try {
    const output = execSync("npm run gov:daemon -- --heal", {
      encoding: "utf8",
      stdio: "pipe",
    });

    if (output.includes("HEALTHY") || output.includes("system healthy")) {
      console.log("   ✅ PASS - Governance health optimal\n");
      return {
        check: "Governance Health Status",
        status: "PASS",
        message: "Governance system healthy",
      };
    } else if (output.includes("WARNING")) {
      console.log("   ⚠️  WARN - Governance warning\n");
      return {
        check: "Governance Health Status",
        status: "WARN",
        message: "Governance auto-heal activated",
        details: output.substring(0, 500),
      };
    } else {
      console.log("   ❌ FAIL - Governance critical\n");
      return {
        check: "Governance Health Status",
        status: "FAIL",
        message: "Governance health critical",
        details: output.substring(0, 500),
      };
    }
  } catch (error) {
    const errorOutput = (error as any).stdout || (error as any).message;

    if (errorOutput?.includes("Auto-heal")) {
      console.log("   ⚠️  WARN - Auto-heal executed\n");
      return {
        check: "Governance Health Status",
        status: "WARN",
        message: "Governance auto-heal executed successfully",
        details: errorOutput?.substring(0, 500),
      };
    }

    console.log("   ❌ FAIL - Governance daemon error\n");
    return {
      check: "Governance Health Status",
      status: "FAIL",
      message: "Governance daemon failed",
      details: errorOutput?.substring(0, 500),
    };
  }
}

/**
 * Check 3: Bus Optimization
 */
function check3_BusOptimization(): CheckResult {
  console.log("=".repeat(60));
  console.log("Check 3/3: Bus Optimization");
  console.log("=".repeat(60));
  console.log("   Purpose: Verify Multi-Agent load balance\n");

  try {
    const output = execSync("npm run bus:optimize -- --tune", {
      encoding: "utf8",
      stdio: "pipe",
    });

    if (output.includes("OPTIMAL")) {
      console.log("   ✅ PASS - Bus optimization optimal\n");
      return {
        check: "Bus Optimization",
        status: "PASS",
        message: "Multi-Agent bus optimally balanced",
      };
    } else if (output.includes("SUBOPTIMAL")) {
      console.log("   ⚠️  WARN - Bus suboptimal\n");
      return {
        check: "Bus Optimization",
        status: "WARN",
        message: "Bus optimization suboptimal - tuning recommended",
        details: output.substring(0, 500),
      };
    } else {
      console.log("   ❌ FAIL - Bus throttled\n");
      return {
        check: "Bus Optimization",
        status: "FAIL",
        message: "Bus under heavy load - throttling required",
        details: output.substring(0, 500),
      };
    }
  } catch (error) {
    const errorOutput = (error as any).stdout || (error as any).message;

    if (errorOutput?.includes("THROTTLED")) {
      console.log("   ❌ FAIL - System throttled\n");
      return {
        check: "Bus Optimization",
        status: "FAIL",
        message: "System under heavy load",
        details: errorOutput?.substring(0, 500),
      };
    }

    console.log("   ❌ FAIL - Bus optimizer error\n");
    return {
      check: "Bus Optimization",
      status: "FAIL",
      message: "Bus optimizer failed",
      details: errorOutput?.substring(0, 500),
    };
  }
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const quick = args.includes("--quick");

  console.log(`⏱️  Starting ${quick ? "quick (5-min)" : "full (10-min)"} readiness check...\n`);

  // Run all checks
  results.push(check1_EntropyPrediction());
  results.push(check2_GovernanceHealth());
  results.push(check3_BusOptimization());

  const duration = Math.round((Date.now() - startTime) / 1000);

  // Calculate summary
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const warnings = results.filter((r) => r.status === "WARN").length;

  // Make decision
  let decision: ReadinessReport["decision"];
  let recommendation: string;
  let nextSteps: string[];

  if (failed === 0 && warnings === 0) {
    decision = "GO";
    recommendation = "All systems optimal - Phase 1 expansion authorized";
    nextSteps = [
      "Create git tag: phase1-ready",
      "Begin Multi-Agent Bus expansion",
      "Monitor entropy/governance/bus during expansion",
    ];
  } else if (failed === 0 && warnings > 0) {
    decision = "CONDITIONAL-GO";
    recommendation = `${warnings} warning(s) detected - proceed with caution`;
    nextSteps = [
      "Address warnings before full expansion",
      "Increase monitoring frequency during expansion",
      "Have rollback plan ready",
    ];
  } else {
    decision = "NO-GO";
    recommendation = `${failed} critical issue(s) detected - resolve before proceeding`;
    nextSteps = [
      "Fix all FAIL checks",
      "Re-run readiness check",
      "Consider Phase 0.9 adjustments",
    ];
  }

  const report: ReadinessReport = {
    timestamp: new Date().toISOString(),
    duration_seconds: duration,
    checks: results,
    summary: {
      total: results.length,
      passed,
      failed,
      warnings,
    },
    decision,
    recommendation,
    next_steps: nextSteps,
  };

  // Save report
  writeFileSync(READINESS_REPORT, JSON.stringify(report, null, 2), "utf8");

  // Print summary
  console.log("=".repeat(60));
  console.log("📊 Readiness Summary");
  console.log("=".repeat(60));

  for (const result of results) {
    const icon =
      result.status === "PASS" ? "✅" : result.status === "WARN" ? "⚠️ " : "❌";
    console.log(`${icon} ${result.check}: ${result.status}`);
    console.log(`   ${result.message}`);
  }

  console.log();
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log(`📊 Results: ${passed} passed, ${failed} failed, ${warnings} warnings\n`);

  const decisionIcon = decision === "GO" ? "🚀" : decision === "CONDITIONAL-GO" ? "⚠️ " : "🛑";

  console.log("=".repeat(60));
  console.log(`${decisionIcon} Decision: ${decision}`);
  console.log("=".repeat(60));
  console.log(`${recommendation}\n`);

  console.log("📋 Next Steps:");
  for (const step of nextSteps) {
    console.log(`   • ${step}`);
  }
  console.log();

  console.log(`📄 Report saved: ${READINESS_REPORT}\n`);

  // Exit codes
  if (decision === "NO-GO") {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
