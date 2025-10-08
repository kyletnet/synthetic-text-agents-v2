#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Bus Optimizer - Agent Thermal Balance
 *
 * Purpose:
 * - Multi-Agent load balancing with adaptive throughput
 * - CPU/Memory monitoring with thermal throttling
 * - Automatic p-limit adjustment based on system load
 * - Target: Performance > 95%, Latency < 3s
 *
 * Usage:
 *   npm run bus:optimize                    # Check current optimization
 *   npm run bus:optimize -- --stress 5      # Stress test with 5 concurrent agents
 *   npm run bus:optimize -- --tune          # Auto-tune p-limit threshold
 *   npm run bus:optimize -- --monitor       # Continuous monitoring
 */

import { execSync } from "child_process";
import { cpus } from "os";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const OPTIMIZATION_REPORT = join(process.cwd(), "reports/bus-optimization.json");
const DEFAULT_P_LIMIT = 4; // Default concurrency limit
const MAX_P_LIMIT = 8; // Maximum concurrency
const MIN_P_LIMIT = 2; // Minimum concurrency
const TARGET_CPU_THRESHOLD = 75; // Target CPU usage %
const MAX_LATENCY_MS = 3000; // Maximum acceptable latency

interface OptimizationResult {
  timestamp: string;
  cpu_count: number;
  current_p_limit: number;
  recommended_p_limit: number;
  cpu_usage_percent: number;
  memory_usage_mb: number;
  estimated_latency_ms: number;
  performance_score: number; // 0-100
  status: "OPTIMAL" | "SUBOPTIMAL" | "THROTTLED";
  recommendation: string;
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║      Bus Optimizer - Agent Thermal Balance                ║");
console.log("╚════════════════════════════════════════════════════════════╝\n");

/**
 * Get CPU count
 */
function getCPUCount(): number {
  return cpus().length;
}

/**
 * Get current CPU usage (macOS)
 */
function getCPUUsage(): number {
  try {
    const output = execSync("ps -A -o %cpu | awk '{s+=$1} END {print s}'", {
      encoding: "utf8",
    });

    return parseFloat(output.trim()) || 0;
  } catch {
    return 0; // Fallback if command fails
  }
}

/**
 * Get memory usage (MB)
 */
function getMemoryUsage(): number {
  try {
    // Get Node.js process memory
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  } catch {
    return 0;
  }
}

/**
 * Calculate optimal p-limit based on CPU
 */
function calculateOptimalPLimit(cpuCount: number, cpuUsage: number): number {
  // Base on CPU count
  let optimal = Math.max(2, Math.floor(cpuCount / 2));

  // Adjust based on CPU usage
  if (cpuUsage > 80) {
    optimal = Math.max(MIN_P_LIMIT, optimal - 2); // Throttle
  } else if (cpuUsage < 50) {
    optimal = Math.min(MAX_P_LIMIT, optimal + 1); // Increase
  }

  return Math.min(MAX_P_LIMIT, Math.max(MIN_P_LIMIT, optimal));
}

/**
 * Estimate latency based on p-limit
 */
function estimateLatency(pLimit: number, agentCount: number = 8): number {
  // Simplified latency model
  // Latency increases with queue depth
  const queueDepth = Math.max(0, agentCount - pLimit);
  const baseLatency = 500; // ms
  const queueLatency = queueDepth * 300; // 300ms per queued agent

  return baseLatency + queueLatency;
}

/**
 * Calculate performance score
 */
function calculatePerformanceScore(
  cpuUsage: number,
  latency: number
): number {
  // Score based on CPU efficiency and latency
  const cpuScore = Math.max(0, 100 - Math.abs(cpuUsage - TARGET_CPU_THRESHOLD));
  const latencyScore = latency < MAX_LATENCY_MS ? 100 : (MAX_LATENCY_MS / latency) * 100;

  return Math.round((cpuScore + latencyScore) / 2);
}

/**
 * Run stress test
 */
async function runStressTest(concurrency: number): Promise<void> {
  console.log(`🔥 Stress Test Mode (${concurrency} concurrent agents)\n`);

  console.log("   [SIMULATION] Would execute:");
  console.log(`   1. Spawn ${concurrency} concurrent agent tasks`);
  console.log("   2. Monitor CPU/Memory usage");
  console.log("   3. Measure average latency");
  console.log("   4. Calculate optimal p-limit\n");

  // Simulate measurements
  const cpuCount = getCPUCount();
  const currentCPU = getCPUUsage();

  console.log(`📊 Simulated Results:`);
  console.log(`   CPU Count: ${cpuCount}`);
  console.log(`   Current CPU: ${currentCPU.toFixed(1)}%`);
  console.log(`   Concurrency: ${concurrency}`);

  const estimatedLatency = estimateLatency(concurrency, concurrency * 2);
  console.log(`   Estimated Latency: ${estimatedLatency}ms\n`);

  if (estimatedLatency > MAX_LATENCY_MS) {
    console.log(`⚠️  Latency exceeds target (${MAX_LATENCY_MS}ms)`);
    console.log(`   Recommendation: Reduce concurrency to ${Math.max(2, concurrency - 1)}\n`);
  } else {
    console.log(`✅ Latency within acceptable range\n`);
  }
}

/**
 * Auto-tune p-limit
 */
function autoTune(): OptimizationResult {
  console.log("🎯 Auto-tuning p-limit threshold...\n");

  const cpuCount = getCPUCount();
  const cpuUsage = getCPUUsage();
  const memoryUsage = getMemoryUsage();

  console.log(`📊 System State:`);
  console.log(`   CPU Count: ${cpuCount}`);
  console.log(`   CPU Usage: ${cpuUsage.toFixed(1)}%`);
  console.log(`   Memory Usage: ${memoryUsage}MB\n`);

  const currentPLimit = DEFAULT_P_LIMIT;
  const recommendedPLimit = calculateOptimalPLimit(cpuCount, cpuUsage);

  const estimatedLatency = estimateLatency(recommendedPLimit);
  const performanceScore = calculatePerformanceScore(cpuUsage, estimatedLatency);

  const status: OptimizationResult["status"] =
    performanceScore >= 95
      ? "OPTIMAL"
      : performanceScore >= 70
        ? "SUBOPTIMAL"
        : "THROTTLED";

  const recommendation =
    status === "OPTIMAL"
      ? "System optimally balanced - no changes needed"
      : status === "SUBOPTIMAL"
        ? `Adjust p-limit from ${currentPLimit} to ${recommendedPLimit} for better performance`
        : `System under heavy load - throttle to p-limit=${recommendedPLimit}`;

  const result: OptimizationResult = {
    timestamp: new Date().toISOString(),
    cpu_count: cpuCount,
    current_p_limit: currentPLimit,
    recommended_p_limit: recommendedPLimit,
    cpu_usage_percent: parseFloat(cpuUsage.toFixed(1)),
    memory_usage_mb: memoryUsage,
    estimated_latency_ms: estimatedLatency,
    performance_score: performanceScore,
    status,
    recommendation,
  };

  console.log("🎯 Optimization Results:");
  console.log(`   Current p-limit: ${currentPLimit}`);
  console.log(`   Recommended p-limit: ${recommendedPLimit}`);
  console.log(`   Estimated Latency: ${estimatedLatency}ms`);
  console.log(`   Performance Score: ${performanceScore}/100\n`);

  const statusIcon =
    status === "OPTIMAL" ? "✅" : status === "SUBOPTIMAL" ? "💡" : "⚠️ ";

  console.log(`${statusIcon} Status: ${status}`);
  console.log(`   ${recommendation}\n`);

  // Save report
  writeFileSync(OPTIMIZATION_REPORT, JSON.stringify(result, null, 2), "utf8");
  console.log(`📄 Report saved: ${OPTIMIZATION_REPORT}\n`);

  return result;
}

/**
 * Monitor mode
 */
async function monitorMode(): Promise<void> {
  console.log("🔍 Monitoring mode activated\n");
  console.log("   Checking every 30 seconds...");
  console.log("   Press Ctrl+C to stop\n");

  let iteration = 0;

  const check = () => {
    iteration++;
    console.log(`\n[${new Date().toISOString()}] Check #${iteration}`);

    const cpuUsage = getCPUUsage();
    const memoryUsage = getMemoryUsage();

    console.log(`   CPU: ${cpuUsage.toFixed(1)}%`);
    console.log(`   Memory: ${memoryUsage}MB`);

    if (cpuUsage > 80) {
      console.log(`   ⚠️  High CPU usage - consider throttling\n`);
    } else {
      console.log(`   ✅ System healthy\n`);
    }
  };

  // Initial check
  check();

  // Continuous monitoring (simulation)
  console.log("   [SIMULATION] Would monitor continuously every 30s\n");
  console.log("   Run with --tune to get optimization recommendations\n");
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const stressArg = args.find((arg) => arg.startsWith("--stress"));
  const tune = args.includes("--tune");
  const monitor = args.includes("--monitor");

  if (stressArg) {
    const concurrency = parseInt(args[args.indexOf(stressArg) + 1], 10) || 5;
    await runStressTest(concurrency);
    return;
  }

  if (monitor) {
    await monitorMode();
    return;
  }

  if (tune) {
    const result = autoTune();

    if (result.status === "THROTTLED") {
      process.exit(1);
    }

    return;
  }

  // Default: optimization check
  console.log("🔍 Bus Optimization Check\n");

  const cpuCount = getCPUCount();
  const cpuUsage = getCPUUsage();

  console.log(`📊 System Status:`);
  console.log(`   CPU Count: ${cpuCount}`);
  console.log(`   CPU Usage: ${cpuUsage.toFixed(1)}%\n`);

  const recommendedPLimit = calculateOptimalPLimit(cpuCount, cpuUsage);

  console.log(`💡 Recommendation:`);
  console.log(`   Optimal p-limit: ${recommendedPLimit}`);
  console.log(`   Run --tune for detailed optimization\n`);
}

main();
