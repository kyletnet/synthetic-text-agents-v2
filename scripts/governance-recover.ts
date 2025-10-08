#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Governance Recovery - Dead-Lock Prevention
 *
 * Purpose:
 * - Detect and recover from Governance Kernel dead-lock
 * - Switch to SAFE_MODE when Parser → Kernel → Policy Loader循環 발생
 * - Log-only mode: Bypass sandbox, allow policy load
 *
 * Usage:
 *   npm run governance:recover          # Check for dead-lock
 *   npm run governance:recover -- --fix # Auto-fix dead-lock
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const SAFE_MODE_FLAG = join(process.cwd(), ".governance-safe-mode");
const SAFE_MODE_COUNTER = join(process.cwd(), ".governance-safe-mode-counter");
const GOVERNANCE_RULES = join(process.cwd(), "governance-rules.yaml");
const MAX_SAFE_MODE_COUNT = 3; // Max 3 consecutive SAFE_MODE entries

interface RecoveryResult {
  deadlockDetected: boolean;
  safeModeActive: boolean;
  policyLoadable: boolean;
  recommendations: string[];
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║     Governance Recovery - Dead-Lock Prevention             ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

/**
 * Detect dead-lock conditions
 */
function detectDeadLock(): boolean {
  console.log("🔍 Detecting dead-lock conditions...\n");

  const conditions = [];

  // Check 1: Governance rules file exists
  if (!existsSync(GOVERNANCE_RULES)) {
    conditions.push("❌ governance-rules.yaml missing");
  } else {
    conditions.push("✅ governance-rules.yaml exists");
  }

  // Check 2: Safe mode flag
  const safeModeActive = existsSync(SAFE_MODE_FLAG);
  if (safeModeActive) {
    conditions.push("⚠️  SAFE_MODE flag active");
  } else {
    conditions.push("✅ SAFE_MODE flag not active");
  }

  // Check 3: Try to load governance rules
  let policyLoadable = true;
  try {
    // Simple YAML parse test
    const content = readFileSync(GOVERNANCE_RULES, "utf8");
    if (content.includes("policies:") && content.includes("rules:")) {
      conditions.push("✅ Policy structure valid");
    } else {
      conditions.push("⚠️  Policy structure incomplete");
      policyLoadable = false;
    }
  } catch (error) {
    conditions.push("❌ Policy load failed");
    policyLoadable = false;
  }

  // Check 4: Circular dependency test
  // (Simplified: check if governance-check fails)
  let circularDependency = false;
  try {
    execSync("npm run governance:check 2>&1", {
      stdio: "pipe",
      timeout: 5000,
    });
    conditions.push("✅ Governance check passed");
  } catch (error) {
    const output = (error as any).stdout?.toString() || "";
    if (output.includes("circular") || output.includes("deadlock")) {
      conditions.push("❌ Circular dependency detected");
      circularDependency = true;
    } else {
      conditions.push("⚠️  Governance check failed (non-circular)");
    }
  }

  // Print conditions
  for (const condition of conditions) {
    console.log(`   ${condition}`);
  }
  console.log();

  // Dead-lock = safe mode active OR policy not loadable OR circular dependency
  return safeModeActive || !policyLoadable || circularDependency;
}

/**
 * Get SAFE_MODE counter
 */
function getSafeModeCounter(): number {
  if (!existsSync(SAFE_MODE_COUNTER)) {
    return 0;
  }

  try {
    const content = readFileSync(SAFE_MODE_COUNTER, "utf8");
    return parseInt(content.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Increment SAFE_MODE counter
 */
function incrementSafeModeCounter(): number {
  const count = getSafeModeCounter() + 1;
  writeFileSync(SAFE_MODE_COUNTER, count.toString(), "utf8");
  return count;
}

/**
 * Reset SAFE_MODE counter
 */
function resetSafeModeCounter(): void {
  if (existsSync(SAFE_MODE_COUNTER)) {
    execSync(`rm ${SAFE_MODE_COUNTER}`);
  }
}

/**
 * Enable SAFE_MODE
 */
function enableSafeMode(): void {
  console.log("🔧 Enabling SAFE_MODE...\n");

  // Check counter
  const currentCount = getSafeModeCounter();
  const newCount = currentCount + 1;

  console.log(`📊 SAFE_MODE History:`);
  console.log(`   Previous count: ${currentCount}`);
  console.log(`   New count:      ${newCount}`);
  console.log(`   Threshold:      ${MAX_SAFE_MODE_COUNT}\n`);

  // Check if exceeds threshold
  if (newCount >= MAX_SAFE_MODE_COUNT) {
    console.log("🚨 SAFE_MODE FATIGUE DETECTED!\n");
    console.log(`   ⚠️  SAFE_MODE has been activated ${newCount} times`);
    console.log(`   ⚠️  This indicates recurring governance issues\n`);
    console.log("⛔ Admin approval required:");
    console.log("   1. Investigate root cause of repeated dead-locks");
    console.log("   2. Fix underlying governance policy issues");
    console.log("   3. Approve: npm run governance:recover -- --admin-approve\n");
    console.log("🔒 SAFE_MODE activation blocked - admin approval needed\n");
    process.exit(1);
  }

  // Increment counter
  incrementSafeModeCounter();

  // Create safe mode flag file
  writeFileSync(
    SAFE_MODE_FLAG,
    `# Governance SAFE_MODE
# Created: ${new Date().toISOString()}
# Reason: Dead-lock prevention
# Activation count: ${newCount}/${MAX_SAFE_MODE_COUNT}

# Effects:
# - Sandbox bypass (log-only)
# - Policy loading allowed without full validation
# - All governance operations logged but not blocked

# To exit SAFE_MODE:
# - Fix underlying dead-lock issue
# - Run: npm run governance:recover -- --restore
`,
    "utf8"
  );

  console.log("✅ SAFE_MODE enabled");
  console.log(`   Flag file created: ${SAFE_MODE_FLAG}`);
  console.log(`   Activation count: ${newCount}/${MAX_SAFE_MODE_COUNT}\n`);
  console.log("   ⚠️  Effects:");
  console.log("   - Sandbox: BYPASS (log-only)");
  console.log("   - Policy validation: RELAXED");
  console.log("   - Governance: LOG mode\n");

  if (newCount === MAX_SAFE_MODE_COUNT - 1) {
    console.log("⚠️  WARNING: This is the last automatic SAFE_MODE activation");
    console.log("   Next time will require admin approval\n");
  }
}

/**
 * Disable SAFE_MODE
 */
function disableSafeMode(): void {
  console.log("🔧 Disabling SAFE_MODE...\n");

  if (existsSync(SAFE_MODE_FLAG)) {
    execSync(`rm ${SAFE_MODE_FLAG}`);
    console.log("✅ SAFE_MODE disabled");
    console.log(`   Flag file removed: ${SAFE_MODE_FLAG}\n`);
  } else {
    console.log("⚠️  SAFE_MODE was not active\n");
  }

  // Reset counter on successful restore
  resetSafeModeCounter();
  console.log("✅ SAFE_MODE counter reset\n");
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const fix = args.includes("--fix");
  const restore = args.includes("--restore");
  const adminApprove = args.includes("--admin-approve");

  // Admin approval - force enable SAFE_MODE bypassing counter
  if (adminApprove) {
    console.log("🔐 Admin approval granted - bypassing counter\n");

    const currentCount = getSafeModeCounter();
    console.log(`📊 Current SAFE_MODE count: ${currentCount}/${MAX_SAFE_MODE_COUNT}\n`);

    // Reset counter
    resetSafeModeCounter();
    console.log("✅ Counter reset by admin\n");

    // Enable SAFE_MODE (will now have count=1)
    enableSafeMode();

    console.log("📋 Next steps:");
    console.log("   1. Fix underlying policy issues");
    console.log("   2. Test: npm run governance:check");
    console.log("   3. Restore: npm run governance:recover -- --restore\n");
    return;
  }

  if (restore) {
    disableSafeMode();
    console.log("🔄 Verifying governance after SAFE_MODE exit...\n");

    try {
      execSync("npm run governance:check", { stdio: "inherit" });
      console.log("\n✅ Governance check passed - system recovered\n");
    } catch (error) {
      console.log("\n❌ Governance check failed - manual intervention required\n");
      process.exit(1);
    }

    return;
  }

  const deadlockDetected = detectDeadLock();

  if (!deadlockDetected) {
    console.log("✅ No dead-lock detected");
    console.log("   Governance system operational\n");
    process.exit(0);
  }

  console.log("⚠️  Dead-lock condition detected!\n");

  if (fix) {
    enableSafeMode();

    console.log("📋 Next steps:");
    console.log("   1. Fix underlying policy issues");
    console.log("   2. Test: npm run governance:check");
    console.log("   3. Restore: npm run governance:recover -- --restore\n");
  } else {
    console.log("📋 Recommendations:");
    console.log("   1. Enable SAFE_MODE to unblock:");
    console.log("      → npm run governance:recover -- --fix");
    console.log("   2. Or manually fix governance-rules.yaml");
    console.log("   3. Or bypass governance temporarily:");
    console.log("      → GOVERNANCE_BYPASS=true npm run ...\n");

    console.log("⚠️  Run with --fix to automatically enable SAFE_MODE\n");
    process.exit(1);
  }
}

main();
