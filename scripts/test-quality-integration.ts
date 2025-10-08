#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Quality Governance Integration Test
 *
 * Tests:
 * 1. Quality Policy Manager
 * 2. Security Guard
 * 3. Governance Rules Integration
 * 4. Inspection Engine Integration
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getQualityPolicyManager } from "./lib/quality-policy.js";
import { getSecurityGuard } from "./lib/security-guard.js";

console.log("🧪 Quality Governance Integration Test");
console.log("═".repeat(60));

let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean | Promise<boolean>): void {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then((success) => {
        if (success) {
          console.log(`✅ ${name}`);
          passed++;
        } else {
          console.log(`❌ ${name}`);
          failed++;
        }
      });
    } else {
      if (result) {
        console.log(`✅ ${name}`);
        passed++;
      } else {
        console.log(`❌ ${name}`);
        failed++;
      }
    }
  } catch (error) {
    console.log(`❌ ${name} - ${(error as Error).message}`);
    failed++;
  }
}

// Test 1: Quality Policy Manager
console.log("\n📋 Test 1: Quality Policy Manager");
console.log("─".repeat(60));

test("Quality policy file exists", () => {
  return existsSync("quality-policy.json");
});

test("Quality policy manager loads correctly", () => {
  const pm = getQualityPolicyManager();
  const policy = pm.exportPolicy();
  return policy.schemaVersion === "2025-10-quality-v1";
});

test("Protected files defined", () => {
  const pm = getQualityPolicyManager();
  const policy = pm.exportPolicy();
  return policy.agentProtection.static.length > 0;
});

test("isProtectedFile works", () => {
  const pm = getQualityPolicyManager();
  return pm.isProtectedFile("src/agents/domainConsultant.ts");
});

test("getProtectionReason works", () => {
  const pm = getQualityPolicyManager();
  const reason = pm.getProtectionReason("src/agents/domainConsultant.ts");
  return reason !== null && reason.includes("QA 품질");
});

// Test 2: Security Guard
console.log("\n🛡️ Test 2: Security Guard");
console.log("─".repeat(60));

test("Security guard initializes", () => {
  const guard = getSecurityGuard();
  return guard !== null;
});

test("Lock mechanism works", async () => {
  const guard = getSecurityGuard();
  const acquired = await guard.acquireLock("test.txt", "test-holder");
  if (!acquired) return false;

  const released = guard.releaseLock("test.txt", "test-holder");
  return released;
});

test("Circular dependency detection works", () => {
  const guard = getSecurityGuard();
  const { cycles, graph } = guard.detectCircularDependencies();
  console.log(
    `   Analyzed ${graph.length} dependencies, found ${cycles.length} cycles`,
  );
  return graph.length > 0;
});

test("Security report generates", () => {
  const guard = getSecurityGuard();
  const report = guard.generateSecurityReport();
  console.log(
    `   Status: ${report.status}, Active locks: ${report.activeLocks}`,
  );
  return report.status === "safe" || report.status === "warning";
});

// Test 3: Governance Rules Integration
console.log("\n⚖️ Test 3: Governance Rules Integration");
console.log("─".repeat(60));

test("Governance rules file exists", () => {
  return existsSync("governance-rules.json");
});

test("Quality protection enabled in governance", () => {
  const governance = JSON.parse(readFileSync("governance-rules.json", "utf-8"));
  return governance.qualityProtection.enabled === true;
});

test("Governance points to quality-policy.json", () => {
  const governance = JSON.parse(readFileSync("governance-rules.json", "utf-8"));
  return governance.qualityProtection.policySource === "quality-policy.json";
});

test("Auto-check enabled", () => {
  const governance = JSON.parse(readFileSync("governance-rules.json", "utf-8"));
  return governance.qualityProtection.autoCheck.enabled === true;
});

// Test 4: CI/CD Integration
console.log("\n🔄 Test 4: CI/CD Integration");
console.log("─".repeat(60));

test("unified-quality-gate.yml exists", () => {
  return existsSync(".github/workflows/unified-quality-gate.yml");
});

test("weekly-radar.yml exists", () => {
  return existsSync(".github/workflows/weekly-radar.yml");
});

test("Quality protection check in CI", () => {
  const workflow = readFileSync(
    ".github/workflows/unified-quality-gate.yml",
    "utf-8",
  );
  return workflow.includes("Quality Protection Check");
});

test("Weekly radar has quality validation", () => {
  const workflow = readFileSync(".github/workflows/weekly-radar.yml", "utf-8");
  return workflow.includes("Quality Protection Validation");
});

// Test 5: File Structure
console.log("\n📁 Test 5: File Structure");
console.log("─".repeat(60));

const requiredFiles = [
  "quality-policy.json",
  "scripts/lib/quality-policy.ts",
  "scripts/lib/quality-history.ts",
  "scripts/lib/security-guard.ts",
  ".github/workflows/weekly-radar.yml",
];

for (const file of requiredFiles) {
  test(`File exists: ${file}`, () => {
    return existsSync(file);
  });
}

// Summary
setTimeout(() => {
  console.log("\n" + "═".repeat(60));
  console.log("📊 Test Summary");
  console.log("═".repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${passed + failed}`);

  if (failed === 0) {
    console.log("\n🎉 All tests passed!");
    process.exit(0);
  } else {
    console.log("\n⚠️  Some tests failed");
    process.exit(1);
  }
}, 1000);
