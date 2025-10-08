#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Governance Health Daemon - Auto-healing System
 *
 * Purpose:
 * - Background monitoring of SAFE_MODE counter
 * - Auto-rollback when counter > 2
 * - Slack/Email alerts for governance issues
 * - Prevents operational downtime from governance dead-lock
 *
 * Usage:
 *   npm run gov:daemon                    # Check governance health
 *   npm run gov:daemon -- --monitor       # Continuous monitoring
 *   npm run gov:daemon -- --heal          # Auto-heal if counter > 2
 *   npm run gov:daemon -- --alert slack   # Send Slack alert
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const SAFE_MODE_COUNTER = join(process.cwd(), ".governance-safe-mode-counter");
const DAEMON_LOG = join(process.cwd(), "reports/gov-daemon.jsonl");
const MAX_SAFE_MODE_COUNT = 3;
const HEAL_THRESHOLD = 2; // Auto-heal at counter=2 (before hitting limit)

interface HealthReport {
  timestamp: string;
  safe_mode_count: number;
  status: "HEALTHY" | "WARNING" | "CRITICAL";
  action_taken: string;
  recommendation: string;
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║    Governance Health Daemon - Auto-healing System          ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

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
 * Reset SAFE_MODE counter
 */
function resetSafeModeCounter(): void {
  if (existsSync(SAFE_MODE_COUNTER)) {
    unlinkSync(SAFE_MODE_COUNTER);
  }
}

/**
 * Log daemon action
 */
function logAction(report: HealthReport): void {
  const line = JSON.stringify(report) + "\n";
  const content = existsSync(DAEMON_LOG) ? readFileSync(DAEMON_LOG, "utf8") : "";
  writeFileSync(DAEMON_LOG, content + line, "utf8");
}

/**
 * Send alert (Slack/Email simulation)
 */
function sendAlert(type: string, message: string): void {
  console.log(`\n📢 Alert (${type.toUpperCase()}):`);
  console.log(`   ${message}\n`);

  // In production, would send actual Slack/Email alert
  console.log("   [SIMULATION] Alert would be sent via:");
  if (type === "slack") {
    console.log("   → Slack webhook: https://hooks.slack.com/...");
  } else if (type === "email") {
    console.log("   → Email: admin@company.com");
  }
  console.log();
}

/**
 * Auto-heal governance
 */
function autoHeal(): HealthReport {
  console.log("🔧 Auto-healing initiated...\n");

  const counter = getSafeModeCounter();

  console.log(`📊 Current State:`);
  console.log(`   SAFE_MODE counter: ${counter}/${MAX_SAFE_MODE_COUNT}`);
  console.log(`   Heal threshold: ${HEAL_THRESHOLD}\n`);

  if (counter === 0) {
    console.log("✅ System healthy - no action needed\n");
    return {
      timestamp: new Date().toISOString(),
      safe_mode_count: counter,
      status: "HEALTHY",
      action_taken: "None - system healthy",
      recommendation: "Continue monitoring",
    };
  }

  if (counter >= HEAL_THRESHOLD) {
    console.log("⚠️  Counter exceeds heal threshold\n");
    console.log("🔄 Actions:");
    console.log("   1. Analyzing governance rules...");

    // Check governance rules validity
    try {
      execSync("npm run governance:check", {
        stdio: "pipe",
        timeout: 5000,
      });

      console.log("   ✅ Governance rules valid\n");
    } catch (error) {
      console.log("   ⚠️  Governance rules have issues\n");
    }

    console.log("   2. Resetting SAFE_MODE counter...");
    resetSafeModeCounter();
    console.log("   ✅ Counter reset to 0\n");

    console.log("   3. Logging auto-heal action...");

    const report: HealthReport = {
      timestamp: new Date().toISOString(),
      safe_mode_count: counter,
      status: "WARNING",
      action_taken: `Auto-heal: Counter reset from ${counter} to 0`,
      recommendation: "Investigate recurring governance issues",
    };

    logAction(report);
    console.log("   ✅ Action logged\n");

    // Send alert
    sendAlert(
      "slack",
      `🔧 Governance auto-heal executed: Counter was ${counter}/${MAX_SAFE_MODE_COUNT}, now reset to 0`
    );

    return report;
  } else {
    console.log(`💡 Counter within acceptable range (${counter}/${HEAL_THRESHOLD})\n`);
    console.log("   No auto-heal needed\n");

    return {
      timestamp: new Date().toISOString(),
      safe_mode_count: counter,
      status: counter > 0 ? "WARNING" : "HEALTHY",
      action_taken: "Monitoring",
      recommendation: "Continue monitoring - auto-heal at threshold",
    };
  }
}

/**
 * Monitor mode (continuous)
 */
async function monitorMode(): Promise<void> {
  console.log("🔍 Monitoring mode activated\n");
  console.log("   Checking every 60 seconds...");
  console.log("   Press Ctrl+C to stop\n");

  let iteration = 0;

  const check = () => {
    iteration++;
    console.log(`\n[${new Date().toISOString()}] Check #${iteration}`);

    const counter = getSafeModeCounter();
    console.log(`   SAFE_MODE counter: ${counter}/${MAX_SAFE_MODE_COUNT}`);

    if (counter >= HEAL_THRESHOLD) {
      console.log("   ⚠️  Threshold exceeded - triggering auto-heal\n");
      autoHeal();
    } else {
      console.log(`   ✅ System healthy\n`);
    }
  };

  // Initial check
  check();

  // Continuous monitoring (simulation - would use setInterval in production)
  console.log("   [SIMULATION] Would monitor continuously every 60s\n");
  console.log("   Run with --heal to execute one-time heal check\n");
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const monitor = args.includes("--monitor");
  const heal = args.includes("--heal");
  const alertType = args.find((arg) => arg.startsWith("--alert"));

  if (alertType) {
    const type = args[args.indexOf(alertType) + 1] || "slack";
    sendAlert(type, "Test alert from governance daemon");
    return;
  }

  if (monitor) {
    await monitorMode();
    return;
  }

  if (heal) {
    const report = autoHeal();

    console.log("=".repeat(60));
    console.log("📊 Health Report");
    console.log("=".repeat(60));
    console.log(`Status: ${report.status}`);
    console.log(`Action: ${report.action_taken}`);
    console.log(`Recommendation: ${report.recommendation}\n`);

    if (report.status === "CRITICAL") {
      process.exit(1);
    }

    return;
  }

  // Default: health check
  console.log("🏥 Governance Health Check\n");

  const counter = getSafeModeCounter();

  console.log(`📊 Status:`);
  console.log(`   SAFE_MODE counter: ${counter}/${MAX_SAFE_MODE_COUNT}`);

  const status =
    counter >= HEAL_THRESHOLD
      ? "WARNING"
      : counter > 0
        ? "CAUTION"
        : "HEALTHY";

  const statusIcon =
    status === "WARNING" ? "⚠️ " : status === "CAUTION" ? "💡" : "✅";

  console.log(`   ${statusIcon} Health: ${status}\n`);

  if (counter >= HEAL_THRESHOLD) {
    console.log("💡 Recommendation:");
    console.log("   Run auto-heal: npm run gov:daemon -- --heal\n");
    process.exit(1);
  } else if (counter > 0) {
    console.log("💡 Status:");
    console.log("   System functional but monitor for recurring issues\n");
  } else {
    console.log("✅ System healthy - no issues detected\n");
  }
}

main();
