#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Phase 1 Preflight - Entry Ritual (3-Stage Check)
 *
 * Purpose:
 * - Validate Phase 0 DNA integrity before Phase 1 entry
 * - Detect entropy drift and governance issues
 * - Ensure system stability for Multi-Agent Bus expansion
 *
 * Usage:
 *   npm run phase1:preflight        # Full 3-stage check
 *   npm run phase1:preflight -- --quick  # Skip stress test
 */

import { execSync } from "child_process";

interface StageResult {
  stage: string;
  status: "PASS" | "FAIL" | "WARN";
  message: string;
  details?: string;
}

const results: StageResult[] = [];

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║     Phase 1 Preflight - Entry Ritual (3-Stage Check)      ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

console.log("🔍 Validating Phase 0 DNA integrity...\n");

/**
 * Stage 1: DNA Re-Authentication
 */
function stage1_DNAAuth(): StageResult {
  console.log("=".repeat(60));
  console.log("Stage ①: DNA Re-Authentication");
  console.log("=".repeat(60));
  console.log("   Purpose: Verify Phase 0 signature integrity\n");

  try {
    const output = execSync("npm run sbom:verify -- --mode=strict", {
      encoding: "utf8",
      stdio: "pipe",
    });

    if (output.includes("✅") && output.includes("Hash matches")) {
      console.log("   ✅ PASS - All hash signatures verified\n");
      return {
        stage: "DNA Re-Authentication",
        status: "PASS",
        message: "Phase 0 signatures intact",
      };
    } else {
      console.log("   ❌ FAIL - Hash mismatch detected\n");
      return {
        stage: "DNA Re-Authentication",
        status: "FAIL",
        message: "SBOM integrity compromised",
        details: output.substring(0, 500),
      };
    }
  } catch (error) {
    const errorOutput = (error as any).stdout || (error as any).message;
    console.log("   ❌ FAIL - SBOM verification failed\n");
    return {
      stage: "DNA Re-Authentication",
      status: "FAIL",
      message: "SBOM verification error",
      details: errorOutput?.substring(0, 500),
    };
  }
}

/**
 * Stage 2: Adaptive Drift Monitoring
 */
function stage2_EntropyMonitor(): StageResult {
  console.log("=".repeat(60));
  console.log("Stage ②: Adaptive Drift Monitoring");
  console.log("=".repeat(60));
  console.log("   Purpose: Detect hash drift (>3 types = risk)\n");

  try {
    const output = execSync("npm run entropy:monitor", {
      encoding: "utf8",
      stdio: "pipe",
    });

    if (output.includes("LOW RISK")) {
      console.log("   ✅ PASS - No entropy drift detected\n");
      return {
        stage: "Adaptive Drift Monitoring",
        status: "PASS",
        message: "Entropy within acceptable range",
      };
    } else if (output.includes("MODERATE RISK")) {
      console.log("   ⚠️  WARN - Moderate drift detected\n");
      return {
        stage: "Adaptive Drift Monitoring",
        status: "WARN",
        message: "SBOM age exceeds 30 days - consider re-baseline",
        details: output.substring(0, 500),
      };
    } else {
      console.log("   ❌ FAIL - High entropy drift detected\n");
      return {
        stage: "Adaptive Drift Monitoring",
        status: "FAIL",
        message: "Entropy drift threshold exceeded",
        details: output.substring(0, 500),
      };
    }
  } catch (error) {
    const errorOutput = (error as any).stdout || (error as any).message;

    if (errorOutput?.includes("HIGH RISK")) {
      console.log("   ❌ FAIL - High entropy drift\n");
      return {
        stage: "Adaptive Drift Monitoring",
        status: "FAIL",
        message: "Entropy drift >3 types - re-lock required",
        details: errorOutput.substring(0, 500),
      };
    }

    console.log("   ❌ FAIL - Entropy monitor error\n");
    return {
      stage: "Adaptive Drift Monitoring",
      status: "FAIL",
      message: "Entropy monitor failed",
      details: errorOutput?.substring(0, 500),
    };
  }
}

/**
 * Stage 3: Governance Loop Stress Test
 */
function stage3_GovernanceStress(): StageResult {
  console.log("=".repeat(60));
  console.log("Stage ③: Governance Loop Stress Test");
  console.log("=".repeat(60));
  console.log("   Purpose: Verify no dead-lock (latency < 3s)\n");

  try {
    const startTime = Date.now();

    const output = execSync("npm run governance:recover", {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 5000, // 5s timeout
    });

    const latency = Date.now() - startTime;

    if (output.includes("No dead-lock detected")) {
      if (latency < 3000) {
        console.log(`   ✅ PASS - No dead-lock (latency: ${latency}ms)\n`);
        return {
          stage: "Governance Loop Stress Test",
          status: "PASS",
          message: `Governance operational (${latency}ms)`,
        };
      } else {
        console.log(`   ⚠️  WARN - Slow response (latency: ${latency}ms)\n`);
        return {
          stage: "Governance Loop Stress Test",
          status: "WARN",
          message: `Governance slow (${latency}ms > 3000ms)`,
        };
      }
    } else {
      console.log("   ❌ FAIL - Dead-lock detected\n");
      return {
        stage: "Governance Loop Stress Test",
        status: "FAIL",
        message: "Governance dead-lock detected",
        details: output.substring(0, 500),
      };
    }
  } catch (error) {
    const errorOutput = (error as any).stdout || (error as any).message;
    console.log("   ❌ FAIL - Governance check failed\n");
    return {
      stage: "Governance Loop Stress Test",
      status: "FAIL",
      message: "Governance check error",
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

  // Stage 1: DNA Re-Authentication
  results.push(stage1_DNAAuth());

  // Stage 2: Adaptive Drift Monitoring
  results.push(stage2_EntropyMonitor());

  // Stage 3: Governance Loop Stress Test (optional)
  if (!quick) {
    results.push(stage3_GovernanceStress());
  } else {
    console.log("⏭️  Skipping Stage 3 (--quick mode)\n");
  }

  // Summary
  console.log("=".repeat(60));
  console.log("📊 Preflight Summary");
  console.log("=".repeat(60));

  let failCount = 0;
  let warnCount = 0;

  for (const result of results) {
    const icon =
      result.status === "PASS" ? "✅" : result.status === "WARN" ? "⚠️ " : "❌";
    console.log(`${icon} ${result.stage}: ${result.status}`);
    console.log(`   ${result.message}`);

    if (result.status === "FAIL") failCount++;
    if (result.status === "WARN") warnCount++;
  }

  console.log();

  // Final verdict
  if (failCount > 0) {
    console.log("❌ PREFLIGHT FAILED");
    console.log(`   ${failCount} critical issue(s) detected\n`);
    console.log("⛔ Phase 1 entry blocked");
    console.log("   Fix issues above before proceeding\n");
    process.exit(1);
  } else if (warnCount > 0) {
    console.log("⚠️  PREFLIGHT PASSED WITH WARNINGS");
    console.log(`   ${warnCount} warning(s) detected\n`);
    console.log("💡 Recommendation:");
    console.log("   Address warnings before Phase 1 expansion\n");
    process.exit(0);
  } else {
    console.log("✅ PREFLIGHT PASSED");
    console.log("   All checks passed - ready for Phase 1\n");
    console.log("🚀 Phase 1 entry authorized");
    console.log("   Multi-Agent Bus expansion approved\n");
    process.exit(0);
  }
}

main();
