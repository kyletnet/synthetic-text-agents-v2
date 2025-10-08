#!/usr/bin/env tsx

/**
 * Performance Benchmark for Fix Commands
 *
 * Compares old monolithic auto-fix-manager vs new Command Pattern
 */

import { FixOrchestrator } from "../src/application/fixes/fix-orchestrator.js";
import {
  TypeScriptFixCommand,
  ESLintFixCommand,
  ImportFixCommand,
} from "../src/domain/fixes/index.js";
import { Logger } from "../src/shared/logger.js";
import type { Issue } from "../src/domain/fixes/fix-command.js";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";

interface BenchmarkResult {
  name: string;
  duration: number;
  issuesFixed: number;
  changesMade: number;
  success: boolean;
}

class FixCommandBenchmark {
  private logger: Logger;
  private testDir: string = "";

  constructor() {
    this.logger = new Logger({ level: "error" }); // Suppress logs during benchmark
  }

  async run(): Promise<void> {
    console.log("🔥 Fix Commands Performance Benchmark");
    console.log("═".repeat(60));

    // Create test directory
    this.testDir = join(tmpdir(), `fix-benchmark-${Date.now()}`);
    await fs.mkdir(this.testDir, { recursive: true });

    try {
      // Generate test issues
      const testSizes = [10, 50, 100, 500];

      for (const size of testSizes) {
        console.log(`\n📊 Testing with ${size} issues:`);
        console.log("─".repeat(60));

        const issues = await this.generateTestIssues(size);

        // Sequential execution
        const sequentialResult = await this.benchmarkSequential(issues);
        this.printResult("Sequential", sequentialResult);

        // Parallel execution
        const parallelResult = await this.benchmarkParallel(issues);
        this.printResult("Parallel", parallelResult);

        // Calculate speedup
        const speedup =
          ((sequentialResult.duration - parallelResult.duration) /
            sequentialResult.duration) *
          100;
        console.log(`\n   ⚡ Speedup: ${speedup.toFixed(1)}%`);
      }

      console.log("\n" + "═".repeat(60));
      console.log("✅ Benchmark completed successfully");
    } finally {
      // Cleanup
      await fs.rm(this.testDir, { recursive: true, force: true });
    }
  }

  private async benchmarkSequential(issues: Issue[]): Promise<BenchmarkResult> {
    const orchestrator = new FixOrchestrator(this.logger);

    orchestrator.registerCommand(new TypeScriptFixCommand(this.logger));
    orchestrator.registerCommand(new ESLintFixCommand(this.logger));
    orchestrator.registerCommand(new ImportFixCommand(this.logger));

    const startTime = Date.now();

    const result = await orchestrator.execute(issues, {
      maxParallel: 1,
      transactional: false,
      createBackups: false,
      dryRun: true, // Don't actually modify files
    });

    const duration = Date.now() - startTime;

    return {
      name: "Sequential",
      duration,
      issuesFixed: result.totalFixed,
      changesMade: result.totalChanges,
      success: result.success,
    };
  }

  private async benchmarkParallel(issues: Issue[]): Promise<BenchmarkResult> {
    const orchestrator = new FixOrchestrator(this.logger);

    orchestrator.registerCommand(new TypeScriptFixCommand(this.logger));
    orchestrator.registerCommand(new ESLintFixCommand(this.logger));
    orchestrator.registerCommand(new ImportFixCommand(this.logger));

    const startTime = Date.now();

    const result = await orchestrator.execute(issues, {
      maxParallel: 5,
      transactional: false,
      createBackups: false,
      dryRun: true,
    });

    const duration = Date.now() - startTime;

    return {
      name: "Parallel",
      duration,
      issuesFixed: result.totalFixed,
      changesMade: result.totalChanges,
      success: result.success,
    };
  }

  private async generateTestIssues(count: number): Promise<Issue[]> {
    const issues: Issue[] = [];

    for (let i = 0; i < count; i++) {
      const category = ["typescript", "eslint", "import"][
        i % 3
      ] as Issue["category"];
      const testFile = join(this.testDir, `test${i}.ts`);

      // Create test file
      await fs.writeFile(testFile, `let var${i} = ${i};\n`);

      issues.push({
        id: `issue-${i}`,
        category,
        severity: i % 10 === 0 ? "high" : "medium",
        description: `Test issue ${i}`,
        filePath: testFile,
        line: 1,
        message: `var${i} is declared but never used`,
        autoFixable: true,
        metadata: {
          fixType: "unused-variable",
          variableName: `var${i}`,
        },
      });
    }

    return issues;
  }

  private printResult(label: string, result: BenchmarkResult): void {
    const status = result.success ? "✅" : "❌";
    console.log(`\n   ${status} ${label}:`);
    console.log(`      Duration:     ${result.duration}ms`);
    console.log(`      Issues Fixed: ${result.issuesFixed}`);
    console.log(`      Changes:      ${result.changesMade}`);
  }
}

// Run benchmark
const benchmark = new FixCommandBenchmark();
await benchmark.run();
