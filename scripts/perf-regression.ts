#!/usr/bin/env tsx

/**
 * Performance Regression Detection
 *
 * Purpose:
 * - Track build time, test execution time
 * - Detect 10%+ performance degradation
 * - Auto-create GitHub issues for regressions
 *
 * Usage:
 *   npm run perf:baseline    # Save current as baseline
 *   npm run perf:check       # Check for regressions
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

interface PerfMetrics {
  timestamp: string;
  buildTime: number;
  testTime: number;
  typecheckTime: number;
  lintTime: number;
}

class PerfRegressionDetector {
  private projectRoot: string;
  private perfDir: string;
  private baselineFile: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.perfDir = join(this.projectRoot, "reports", "performance");
    this.baselineFile = join(this.perfDir, "baseline.json");

    if (!existsSync(this.perfDir)) {
      mkdirSync(this.perfDir, { recursive: true });
    }
  }

  async saveBaseline(): Promise<void> {
    console.log("📊 Measuring performance baseline...\n");

    const metrics = await this.measurePerformance();

    writeFileSync(this.baselineFile, JSON.stringify(metrics, null, 2));

    console.log("✅ Baseline saved:");
    this.displayMetrics(metrics);
  }

  async checkRegression(): Promise<void> {
    console.log("🔍 Performance Regression Detection");
    console.log("═".repeat(60));

    if (!existsSync(this.baselineFile)) {
      console.error("❌ No baseline found. Run: npm run perf:baseline");
      process.exit(1);
    }

    const baseline: PerfMetrics = JSON.parse(
      readFileSync(this.baselineFile, "utf-8"),
    );
    const current = await this.measurePerformance();

    console.log("\n📊 Performance Comparison:\n");
    this.compareMetrics(baseline, current);

    const regressions = this.detectRegressions(baseline, current);

    if (regressions.length > 0) {
      console.log("\n❌ Performance regressions detected!");
      await this.createIssue(regressions);
      process.exit(1);
    } else {
      console.log("\n✅ No performance regressions detected");
    }
  }

  private async measurePerformance(): Promise<PerfMetrics> {
    const metrics: PerfMetrics = {
      timestamp: new Date().toISOString(),
      buildTime: 0,
      testTime: 0,
      typecheckTime: 0,
      lintTime: 0,
    };

    // Measure build time
    console.log("⚙️  Measuring build time...");
    metrics.buildTime = this.measureCommand("npm run build");

    // Measure typecheck time
    console.log("⚙️  Measuring typecheck time...");
    metrics.typecheckTime = this.measureCommand("npm run typecheck");

    // Measure lint time
    console.log("⚙️  Measuring lint time...");
    metrics.lintTime = this.measureCommand("npm run lint || true");

    // Measure test time
    console.log("⚙️  Measuring test time...");
    metrics.testTime = this.measureCommand("npm run test");

    return metrics;
  }

  private measureCommand(command: string): number {
    const startTime = Date.now();

    try {
      execSync(command, {
        cwd: this.projectRoot,
        stdio: "pipe",
        timeout: 300000, // 5 min timeout
      });
    } catch (error) {
      // Command failed, but we still measure time
    }

    return Date.now() - startTime;
  }

  private displayMetrics(metrics: PerfMetrics): void {
    console.log(`   Build:     ${(metrics.buildTime / 1000).toFixed(1)}s`);
    console.log(`   Typecheck: ${(metrics.typecheckTime / 1000).toFixed(1)}s`);
    console.log(`   Lint:      ${(metrics.lintTime / 1000).toFixed(1)}s`);
    console.log(`   Test:      ${(metrics.testTime / 1000).toFixed(1)}s`);
  }

  private compareMetrics(baseline: PerfMetrics, current: PerfMetrics): void {
    this.compareMetric("Build", baseline.buildTime, current.buildTime);
    this.compareMetric(
      "Typecheck",
      baseline.typecheckTime,
      current.typecheckTime,
    );
    this.compareMetric("Lint", baseline.lintTime, current.lintTime);
    this.compareMetric("Test", baseline.testTime, current.testTime);
  }

  private compareMetric(name: string, baseline: number, current: number): void {
    const diff = current - baseline;
    const diffPercent = ((diff / baseline) * 100).toFixed(1);
    const icon = diff > 0 ? "📈" : "📉";

    const baselineStr = (baseline / 1000).toFixed(1);
    const currentStr = (current / 1000).toFixed(1);
    const diffStr = (Math.abs(diff) / 1000).toFixed(1);

    console.log(
      `${icon} ${name.padEnd(10)} ${baselineStr}s → ${currentStr}s (${Number(diffPercent) >= 0 ? "+" : ""}${diffPercent}%, ${diff > 0 ? "+" : "-"}${diffStr}s)`,
    );
  }

  private detectRegressions(
    baseline: PerfMetrics,
    current: PerfMetrics,
  ): Array<{
    name: string;
    baseline: number;
    current: number;
    percent: number;
  }> {
    const regressions: Array<{
      name: string;
      baseline: number;
      current: number;
      percent: number;
    }> = [];
    const threshold = 0.1; // 10% threshold

    const checks = [
      {
        name: "Build",
        baseline: baseline.buildTime,
        current: current.buildTime,
      },
      {
        name: "Typecheck",
        baseline: baseline.typecheckTime,
        current: current.typecheckTime,
      },
      { name: "Lint", baseline: baseline.lintTime, current: current.lintTime },
      { name: "Test", baseline: baseline.testTime, current: current.testTime },
    ];

    for (const check of checks) {
      const percent = (check.current - check.baseline) / check.baseline;
      if (percent > threshold) {
        regressions.push({ ...check, percent: percent * 100 });
      }
    }

    return regressions;
  }

  private async createIssue(
    regressions: Array<{
      name: string;
      baseline: number;
      current: number;
      percent: number;
    }>,
  ): Promise<void> {
    const body = `## Performance Regression Detected

${regressions
  .map(
    (r) =>
      `- **${r.name}**: ${(r.baseline / 1000).toFixed(1)}s → ${(r.current / 1000).toFixed(1)}s (+${r.percent.toFixed(1)}%)`,
  )
  .join("\n")}

## Threshold
10% increase

## Action Required
Investigate recent changes that may have degraded performance.

---
🤖 Auto-generated by \`npm run perf:check\`
`;

    try {
      execSync(
        `gh issue create --title "[Performance] Regression detected in ${regressions.map((r) => r.name).join(", ")}" --body "${body}" --label "performance,P1,auto-generated"`,
        { cwd: this.projectRoot, stdio: "inherit" },
      );
    } catch (error) {
      console.error("Failed to create GitHub issue:", error);
    }
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

const detector = new PerfRegressionDetector();

if (command === "baseline") {
  await detector.saveBaseline();
} else if (command === "check" || !command) {
  await detector.checkRegression();
} else {
  console.error("Unknown command. Usage: npm run perf:{baseline|check}");
  process.exit(1);
}
