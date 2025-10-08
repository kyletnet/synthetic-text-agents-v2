#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * MBC Go/No-Go Validation Script
 *
 * Purpose:
 * - Automated validation before Open-Core launch
 * - 7 Technical Gates + 4 Operational Gates
 * - Exit 0 if all PASS, Exit 1 if any FAIL
 *
 * Usage:
 *   npm run mbc:gonogo
 *   # or
 *   tsx scripts/mbc-gonogo-check.ts
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface GateResult {
  gate: string;
  name: string;
  passed: boolean;
  message: string;
  metric?: string | number;
  threshold?: string | number;
}

const projectRoot = process.cwd();

/**
 * Run command and return output + success
 */
function runCommand(
  cmd: string,
  options: { timeout?: number } = {},
): { success: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd: projectRoot,
      encoding: "utf8",
      timeout: options.timeout || 120000, // 2min default
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { success: true, output };
  } catch (error: any) {
    return {
      success: false,
      output: error.stdout || error.stderr || error.message,
    };
  }
}

/**
 * Gate A: 3-Agent Council Integration Test
 */
async function gateA(): Promise<GateResult> {
  console.log("\n🔍 Gate A: 3-Agent Council Integration Test");

  // Check if integration test exists
  const testFile = join(
    projectRoot,
    "tests/application/agent-council-integration.test.ts",
  );

  if (!existsSync(testFile)) {
    return {
      gate: "A",
      name: "3-Agent Council",
      passed: false,
      message: "Integration test not found (not yet implemented)",
      metric: "N/A",
      threshold: "≥90% pass",
    };
  }

  const result = runCommand(`npm run test -- ${testFile}`);

  if (!result.success) {
    return {
      gate: "A",
      name: "3-Agent Council",
      passed: false,
      message: "Integration test failed",
      metric: "FAIL",
      threshold: "≥90% pass",
    };
  }

  // Parse test results
  const passMatch = result.output.match(/(\d+) passed/);
  const totalMatch = result.output.match(/\((\d+)\)/);

  if (!passMatch || !totalMatch) {
    return {
      gate: "A",
      name: "3-Agent Council",
      passed: false,
      message: "Cannot parse test results",
      metric: "Unknown",
      threshold: "≥90% pass",
    };
  }

  const passed = parseInt(passMatch[1], 10);
  const total = parseInt(totalMatch[1], 10);
  const passRate = (passed / total) * 100;

  return {
    gate: "A",
    name: "3-Agent Council",
    passed: passRate >= 90,
    message: `${passed}/${total} tests passed (${passRate.toFixed(1)}%)`,
    metric: `${passRate.toFixed(1)}%`,
    threshold: "≥90%",
  };
}

/**
 * Gate B: NL Feedback E2E Pipeline
 */
async function gateB(): Promise<GateResult> {
  console.log("\n🔍 Gate B: NL Feedback E2E Pipeline");

  const testFile = join(
    projectRoot,
    "tests/application/feedback-e2e.test.ts",
  );

  if (!existsSync(testFile)) {
    return {
      gate: "B",
      name: "NL Feedback E2E",
      passed: false,
      message: "E2E test not found (not yet implemented)",
      metric: "N/A",
      threshold: "100% pass",
    };
  }

  const result = runCommand(`npm run test -- ${testFile}`);

  return {
    gate: "B",
    name: "NL Feedback E2E",
    passed: result.success,
    message: result.success ? "All E2E tests passed" : "E2E tests failed",
    metric: result.success ? "PASS" : "FAIL",
    threshold: "100% pass",
  };
}

/**
 * Gate C: Governance Guard --strict
 */
async function gateC(): Promise<GateResult> {
  console.log("\n🔍 Gate C: Governance Guard --strict");

  const result = runCommand("npm run guard -- --strict", { timeout: 180000 });

  // Parse guard output
  const decisionMatch = result.output.match(/Decision:\s+(PASS|FAIL)/);
  const decision = decisionMatch ? decisionMatch[1] : "UNKNOWN";

  return {
    gate: "C",
    name: "Governance",
    passed: decision === "PASS",
    message: `Guard decision: ${decision}`,
    metric: decision,
    threshold: "PASS",
  };
}

/**
 * Gate D: Performance (Latency p95)
 */
async function gateD(): Promise<GateResult> {
  console.log("\n🔍 Gate D: Performance (Latency p95)");

  const result = runCommand("npm run rg:run", { timeout: 300000 });

  // Parse latency from output
  const latencyMatch = result.output.match(/Latency:\s+([\d.]+)s/);

  if (!latencyMatch) {
    return {
      gate: "D",
      name: "Performance",
      passed: false,
      message: "Cannot parse latency",
      metric: "Unknown",
      threshold: "≤3.1s",
    };
  }

  const latency = parseFloat(latencyMatch[1]);

  return {
    gate: "D",
    name: "Performance",
    passed: latency <= 3.1,
    message: `Latency: ${latency.toFixed(2)}s`,
    metric: `${latency.toFixed(2)}s`,
    threshold: "≤3.1s",
  };
}

/**
 * Gate E: Reliability (Error Rate)
 */
async function gateE(): Promise<GateResult> {
  console.log("\n🔍 Gate E: Reliability (Error Rate)");

  // Check if baseline report exists
  const reportPath = join(
    projectRoot,
    "reports/baseline-phase2c-launch-final.json",
  );

  if (!existsSync(reportPath)) {
    return {
      gate: "E",
      name: "Reliability",
      passed: false,
      message: "Baseline report not found",
      metric: "N/A",
      threshold: "<1%",
    };
  }

  try {
    const report = JSON.parse(readFileSync(reportPath, "utf8"));
    const errorRate = report.error_rate || 0;

    return {
      gate: "E",
      name: "Reliability",
      passed: errorRate < 1,
      message: `Error rate: ${errorRate.toFixed(2)}%`,
      metric: `${errorRate.toFixed(2)}%`,
      threshold: "<1%",
    };
  } catch (error) {
    return {
      gate: "E",
      name: "Reliability",
      passed: false,
      message: "Cannot parse baseline report",
      metric: "Unknown",
      threshold: "<1%",
    };
  }
}

/**
 * Gate F: Security (Secret Exposure)
 */
async function gateF(): Promise<GateResult> {
  console.log("\n🔍 Gate F: Security (Secret Exposure)");

  // Check for common secret patterns
  const patterns = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "sk-",
    "api_key",
    "secret",
  ];

  const publicFiles = [
    "demo-ui/**/*",
    "open-template/**/*",
    "docs/**/*",
    "README.md",
  ];

  let violations = 0;

  for (const pattern of patterns) {
    for (const fileGlob of publicFiles) {
      const result = runCommand(
        `grep -r "${pattern}" ${fileGlob} 2>/dev/null || true`,
      );

      if (result.output.trim().length > 0) {
        violations++;
        console.log(`   ⚠️  Found "${pattern}" in ${fileGlob}`);
      }
    }
  }

  return {
    gate: "F",
    name: "Security",
    passed: violations === 0,
    message: `${violations} secret violations found`,
    metric: violations,
    threshold: "0",
  };
}

/**
 * Gate G: Baseline Generation
 */
async function gateG(): Promise<GateResult> {
  console.log("\n🔍 Gate G: Baseline Generation");

  const result = runCommand('npm run baseline:generate -- --tag "mbc-gonogo"', {
    timeout: 300000,
  });

  return {
    gate: "G",
    name: "Baseline",
    passed: result.success,
    message: result.success
      ? "Baseline generated successfully"
      : "Baseline generation failed",
    metric: result.success ? "SUCCESS" : "FAIL",
    threshold: "SUCCESS",
  };
}

/**
 * Gate H: Documentation
 */
async function gateH(): Promise<GateResult> {
  console.log("\n🔍 Gate H: Documentation");

  const requiredDocs = [
    "README.md",
    "docs/ARCHITECTURE.md",
    "docs/ROLLBACK.md",
    "docs/FAQ.md",
  ];

  const missing = requiredDocs.filter(
    (doc) => !existsSync(join(projectRoot, doc)),
  );

  return {
    gate: "H",
    name: "Documentation",
    passed: missing.length === 0,
    message:
      missing.length === 0
        ? "All required docs exist"
        : `Missing: ${missing.join(", ")}`,
    metric: `${requiredDocs.length - missing.length}/${requiredDocs.length}`,
    threshold: `${requiredDocs.length}/${requiredDocs.length}`,
  };
}

/**
 * Gate I: Demo (SSR WebView)
 */
async function gateI(): Promise<GateResult> {
  console.log("\n🔍 Gate I: Demo (SSR WebView)");

  const demoPath = join(projectRoot, "demo-ui");

  if (!existsSync(demoPath)) {
    return {
      gate: "I",
      name: "Demo",
      passed: false,
      message: "demo-ui/ directory not found",
      metric: "N/A",
      threshold: "EXISTS",
    };
  }

  // Check for key files
  const requiredFiles = [
    "demo-ui/package.json",
    "demo-ui/pages/index.tsx",
    "demo-ui/vercel.json",
  ];

  const missing = requiredFiles.filter((file) => !existsSync(join(projectRoot, file)));

  return {
    gate: "I",
    name: "Demo",
    passed: missing.length === 0,
    message:
      missing.length === 0
        ? "Demo structure complete"
        : `Missing: ${missing.join(", ")}`,
    metric: missing.length === 0 ? "COMPLETE" : "INCOMPLETE",
    threshold: "COMPLETE",
  };
}

/**
 * Gate J: Monitoring
 */
async function gateJ(): Promise<GateResult> {
  console.log("\n🔍 Gate J: Monitoring");

  // Check if monitoring config exists
  const monitoringFiles = [
    "monitoring/grafana.json",
    "monitoring/sentry.config.js",
  ];

  const exists = monitoringFiles.filter((file) =>
    existsSync(join(projectRoot, file)),
  );

  return {
    gate: "J",
    name: "Monitoring",
    passed: exists.length > 0,
    message:
      exists.length > 0
        ? `${exists.length} monitoring configs found`
        : "No monitoring configs found",
    metric: `${exists.length}/${monitoringFiles.length}`,
    threshold: "≥1",
  };
}

/**
 * Gate K: Rollback Plan
 */
async function gateK(): Promise<GateResult> {
  console.log("\n🔍 Gate K: Rollback Plan");

  const rollbackDoc = join(projectRoot, "docs/ROLLBACK.md");

  return {
    gate: "K",
    name: "Rollback",
    passed: existsSync(rollbackDoc),
    message: existsSync(rollbackDoc)
      ? "Rollback plan documented"
      : "Rollback plan missing",
    metric: existsSync(rollbackDoc) ? "EXISTS" : "MISSING",
    threshold: "EXISTS",
  };
}

/**
 * Main execution
 */
async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         MBC Go/No-Go Validation                            ║");
  console.log("║         Phase 2C → Open-Core Launch                        ║");
  console.log("╚════════════════════════════════════════════════════════════╝");

  const gates = [
    await gateA(), // 3-Agent Council
    await gateB(), // NL Feedback E2E
    await gateC(), // Governance
    await gateD(), // Performance
    await gateE(), // Reliability
    await gateF(), // Security
    await gateG(), // Baseline
    await gateH(), // Documentation
    await gateI(), // Demo
    await gateJ(), // Monitoring
    await gateK(), // Rollback
  ];

  console.log("\n" + "=".repeat(60));
  console.log("📊 Go/No-Go Results");
  console.log("=".repeat(60));

  const passedCount = gates.filter((g) => g.passed).length;
  const totalCount = gates.length;

  for (const gate of gates) {
    const icon = gate.passed ? "✅" : "❌";
    console.log(
      `${icon} Gate ${gate.gate}: ${gate.name.padEnd(20)} ${gate.metric} (threshold: ${gate.threshold})`,
    );
    console.log(`   ${gate.message}`);
  }

  console.log("=".repeat(60));

  const allPassed = passedCount === totalCount;

  if (allPassed) {
    console.log(`\n✅ GO: ${passedCount}/${totalCount} gates PASSED`);
    console.log("\n🚀 MBC is ready for Open-Core launch");
    process.exit(0);
  } else {
    console.log(`\n❌ NO-GO: ${passedCount}/${totalCount} gates passed`);
    console.log(
      `\n⚠️  ${totalCount - passedCount} gate(s) failed - DO NOT LAUNCH`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
