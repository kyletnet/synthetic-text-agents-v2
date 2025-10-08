#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Performance Benchmark: Old vs New Refactor Auditor
 * Compares monolithic implementation vs modular DDD architecture
 */

import { performance } from "perf_hooks";
import { RefactorAuditor as OldAuditor } from "./refactor-auditor.js";
import { AuditOrchestrator as NewAuditor } from "../src/application/refactoring/audit-orchestrator.js";

interface BenchmarkResult {
  name: string;
  duration: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  findingsCount: number;
  filesScanned?: number;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

async function benchmarkOldAuditor(
  priority: "P1" | "P2" | "P3" | "ALL",
): Promise<BenchmarkResult> {
  // Force garbage collection if available
  if (global.gc) global.gc();

  const memBefore = process.memoryUsage();
  const start = performance.now();

  const auditor = new OldAuditor({
    priority,
    verbose: false,
    autoFix: false,
  });

  const findings = await auditor.runAudit();

  const end = performance.now();
  const memAfter = process.memoryUsage();

  return {
    name: `Old Auditor (${priority})`,
    duration: end - start,
    memory: {
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal,
      external: memAfter.external - memBefore.external,
    },
    findingsCount: findings.length,
  };
}

async function benchmarkNewAuditor(
  priority: "P1" | "P2" | "P3" | "ALL",
): Promise<BenchmarkResult> {
  // Force garbage collection if available
  if (global.gc) global.gc();

  const memBefore = process.memoryUsage();
  const start = performance.now();

  const orchestrator = new NewAuditor({
    priority,
    verbose: false,
    autoFix: false,
    rootDir: process.cwd(),
  });

  const result = await orchestrator.runAudit();

  const end = performance.now();
  const memAfter = process.memoryUsage();

  return {
    name: `New Auditor (${priority})`,
    duration: end - start,
    memory: {
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal,
      external: memAfter.external - memBefore.external,
    },
    findingsCount: result.findings.length,
    filesScanned: result.metadata.filesScanned,
  };
}

function calculateImprovement(oldValue: number, newValue: number): string {
  const improvement = ((oldValue - newValue) / oldValue) * 100;
  const sign = improvement > 0 ? "↓" : "↑";
  return `${sign} ${Math.abs(improvement).toFixed(1)}%`;
}

async function runBenchmark(
  priority: "P1" | "P2" | "P3" | "ALL",
  runs: number = 3,
) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🏁 Benchmarking ${priority} Audit (${runs} runs)`);
  console.log("=".repeat(80));

  const oldResults: BenchmarkResult[] = [];
  const newResults: BenchmarkResult[] = [];

  for (let i = 0; i < runs; i++) {
    console.log(`\n  Run ${i + 1}/${runs}...`);

    console.log("    Running old auditor...");
    const oldResult = await benchmarkOldAuditor(priority);
    oldResults.push(oldResult);

    // Wait a bit between runs
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("    Running new auditor...");
    const newResult = await benchmarkNewAuditor(priority);
    newResults.push(newResult);

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Calculate averages
  const avgOldDuration =
    oldResults.reduce((sum, r) => sum + r.duration, 0) / runs;
  const avgNewDuration =
    newResults.reduce((sum, r) => sum + r.duration, 0) / runs;

  const avgOldMemory =
    oldResults.reduce((sum, r) => sum + r.memory.heapUsed, 0) / runs;
  const avgNewMemory =
    newResults.reduce((sum, r) => sum + r.memory.heapUsed, 0) / runs;

  const avgOldFindings = Math.round(
    oldResults.reduce((sum, r) => sum + r.findingsCount, 0) / runs,
  );
  const avgNewFindings = Math.round(
    newResults.reduce((sum, r) => sum + r.findingsCount, 0) / runs,
  );

  // Print results
  console.log(`\n📊 Results Summary (${runs} runs average):`);
  console.log("-".repeat(80));

  console.log("\n⏱️  Duration:");
  console.log(`  Old: ${formatDuration(avgOldDuration)}`);
  console.log(`  New: ${formatDuration(avgNewDuration)}`);
  console.log(
    `  Improvement: ${calculateImprovement(avgOldDuration, avgNewDuration)}`,
  );

  console.log("\n💾 Memory Usage:");
  console.log(`  Old: ${formatBytes(avgOldMemory)}`);
  console.log(`  New: ${formatBytes(avgNewMemory)}`);
  console.log(
    `  Improvement: ${calculateImprovement(avgOldMemory, avgNewMemory)}`,
  );

  console.log("\n🔍 Findings:");
  console.log(`  Old: ${avgOldFindings} issues`);
  console.log(`  New: ${avgNewFindings} issues`);
  if (newResults[0].filesScanned) {
    console.log(`  Files Scanned: ${newResults[0].filesScanned}`);
  }

  return {
    priority,
    oldDuration: avgOldDuration,
    newDuration: avgNewDuration,
    durationImprovement: calculateImprovement(avgOldDuration, avgNewDuration),
    oldMemory: avgOldMemory,
    newMemory: avgNewMemory,
    memoryImprovement: calculateImprovement(avgOldMemory, avgNewMemory),
    oldFindings: avgOldFindings,
    newFindings: avgNewFindings,
  };
}

async function main() {
  console.log("🚀 Refactor Audit Performance Benchmark");
  console.log("Comparing monolithic vs modular DDD architecture\n");

  // Check if old auditor exists
  try {
    const testOld = new OldAuditor({
      priority: "P1",
      verbose: false,
      autoFix: false,
    });
  } catch (error) {
    console.error("❌ Old auditor not found. Skipping comparison.");
    console.log("Running new auditor only...\n");

    // Run only new auditor
    const priorities: Array<"P1" | "P2" | "P3" | "ALL"> = [
      "P1",
      "P2",
      "P3",
      "ALL",
    ];
    const results = [];

    for (const priority of priorities) {
      const result = await benchmarkNewAuditor(priority);
      console.log(
        `\n${priority}: ${formatDuration(result.duration)} (${
          result.findingsCount
        } findings)`,
      );
      results.push(result);
    }

    console.log("\n✅ Benchmark complete (new auditor only)");
    return;
  }

  // Run benchmarks
  const runs = 3;
  const priorities: Array<"P1" | "P2" | "P3" | "ALL"> = [
    "P1",
    "P2",
    "P3",
    "ALL",
  ];
  const results = [];

  for (const priority of priorities) {
    const result = await runBenchmark(priority, runs);
    results.push(result);
  }

  // Print overall summary
  console.log(`\n\n${"=".repeat(80)}`);
  console.log("📈 OVERALL BENCHMARK SUMMARY");
  console.log("=".repeat(80));

  console.log("\n| Priority | Old Duration | New Duration | Improvement |");
  console.log("|----------|--------------|--------------|-------------|");
  for (const result of results) {
    console.log(
      `| ${result.priority.padEnd(8)} | ${formatDuration(
        result.oldDuration,
      ).padEnd(12)} | ${formatDuration(result.newDuration).padEnd(
        12,
      )} | ${result.durationImprovement.padEnd(11)} |`,
    );
  }

  console.log("\n| Priority | Old Memory | New Memory | Improvement |");
  console.log("|----------|------------|------------|-------------|");
  for (const result of results) {
    console.log(
      `| ${result.priority.padEnd(8)} | ${formatBytes(result.oldMemory).padEnd(
        10,
      )} | ${formatBytes(result.newMemory).padEnd(
        10,
      )} | ${result.memoryImprovement.padEnd(11)} |`,
    );
  }

  console.log("\n🎯 Key Improvements:");
  const totalOldDuration = results.reduce((sum, r) => sum + r.oldDuration, 0);
  const totalNewDuration = results.reduce((sum, r) => sum + r.newDuration, 0);
  const totalOldMemory = results.reduce((sum, r) => sum + r.oldMemory, 0);
  const totalNewMemory = results.reduce((sum, r) => sum + r.newMemory, 0);

  console.log(
    `  Average Duration: ${calculateImprovement(
      totalOldDuration / 4,
      totalNewDuration / 4,
    )}`,
  );
  console.log(
    `  Average Memory: ${calculateImprovement(
      totalOldMemory / 4,
      totalNewMemory / 4,
    )}`,
  );

  console.log("\n✅ Benchmark complete!");
}

// Run benchmark
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
