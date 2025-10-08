#!/usr/bin/env tsx
/**
 * Architecture Drift Monitor
 *
 * Continuously monitors codebase for architecture violations using dependency-cruiser.
 * Automatically detects:
 * - Circular dependencies
 * - DDD boundary violations
 * - Orphan modules
 *
 * Integrates with CI/CD and reports to governance system.
 */

import { execSync } from "child_process";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

interface ArchitectureViolation {
  rule: string;
  severity: "error" | "warn" | "info";
  from: string;
  to: string;
  comment: string;
}

interface ArchitectureReport {
  timestamp: string;
  violations: ArchitectureViolation[];
  summary: {
    errors: number;
    warnings: number;
    info: number;
    circularDependencies: number;
    dddViolations: number;
  };
  status: "pass" | "fail" | "warn";
}

class ArchitectureDriftMonitor {
  private projectRoot: string;
  private reportPath: string;

  constructor() {
    this.projectRoot = process.cwd();
    this.reportPath = join(this.projectRoot, "reports/architecture-drift.json");
  }

  /**
   * Run architecture validation using dependency-cruiser
   */
  runValidation(): ArchitectureReport {
    console.log("🔍 Running architecture validation...\n");

    try {
      // Run dependency-cruiser with JSON output
      const result = execSync(
        "npx depcruise --config .dependency-cruiser.cjs --output-type json src/",
        {
          cwd: this.projectRoot,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      const analysis = JSON.parse(result);
      const violations = this.extractViolations(analysis);
      const summary = this.summarizeViolations(violations);

      const report: ArchitectureReport = {
        timestamp: new Date().toISOString(),
        violations,
        summary,
        status:
          summary.errors > 0 ? "fail" : summary.warnings > 0 ? "warn" : "pass",
      };

      // Save report
      this.saveReport(report);

      // Display results
      this.displayReport(report);

      // Report to governance if violations found
      if (summary.errors > 0 || summary.warnings > 0) {
        this.reportToGovernance(report);
      }

      return report;
    } catch (error: any) {
      // depcruise exits with non-zero code if violations found
      if (error.stdout) {
        const analysis = JSON.parse(error.stdout);
        const violations = this.extractViolations(analysis);
        const summary = this.summarizeViolations(violations);

        const report: ArchitectureReport = {
          timestamp: new Date().toISOString(),
          violations,
          summary,
          status: summary.errors > 0 ? "fail" : "warn",
        };

        this.saveReport(report);
        this.displayReport(report);
        this.reportToGovernance(report);

        return report;
      }

      throw error;
    }
  }

  /**
   * Extract violations from dependency-cruiser output
   */
  private extractViolations(analysis: any): ArchitectureViolation[] {
    const violations: ArchitectureViolation[] = [];

    if (analysis.summary?.error > 0 || analysis.summary?.warn > 0) {
      for (const module of analysis.modules || []) {
        for (const dep of module.dependencies || []) {
          if (dep.valid === false) {
            for (const rule of dep.rules || []) {
              violations.push({
                rule: rule.name,
                severity: rule.severity,
                from: module.source,
                to: dep.resolved,
                comment: rule.comment || "",
              });
            }
          }
        }
      }
    }

    return violations;
  }

  /**
   * Summarize violations by type and severity
   */
  private summarizeViolations(violations: ArchitectureViolation[]) {
    const errors = violations.filter((v) => v.severity === "error").length;
    const warnings = violations.filter((v) => v.severity === "warn").length;
    const info = violations.filter((v) => v.severity === "info").length;

    const circularDependencies = violations.filter((v) =>
      v.rule.includes("circular"),
    ).length;
    const dddViolations = violations.filter(
      (v) =>
        v.rule.includes("domain") ||
        v.rule.includes("application") ||
        v.rule.includes("infrastructure"),
    ).length;

    return {
      errors,
      warnings,
      info,
      circularDependencies,
      dddViolations,
    };
  }

  /**
   * Display report in CLI
   */
  private displayReport(report: ArchitectureReport) {
    const { summary, violations, status } = report;

    console.log("\n📊 Architecture Analysis Results\n");
    console.log(
      `Status: ${this.getStatusEmoji(status)} ${status.toUpperCase()}`,
    );
    console.log(`Timestamp: ${report.timestamp}\n`);

    console.log("Summary:");
    console.log(`  ❌ Errors: ${summary.errors}`);
    console.log(`  ⚠️  Warnings: ${summary.warnings}`);
    console.log(`  🔄 Circular Dependencies: ${summary.circularDependencies}`);
    console.log(`  🏗️  DDD Violations: ${summary.dddViolations}\n`);

    if (violations.length > 0) {
      console.log("Violations:\n");
      for (const violation of violations.slice(0, 10)) {
        const emoji = violation.severity === "error" ? "❌" : "⚠️";
        console.log(`${emoji} [${violation.rule}] ${violation.comment}`);
        console.log(`   ${violation.from}`);
        console.log(`   → ${violation.to}\n`);
      }

      if (violations.length > 10) {
        console.log(`... and ${violations.length - 10} more violations\n`);
      }

      console.log(`\n💡 Full report: ${this.reportPath}\n`);
    } else {
      console.log("✅ No architecture violations found!\n");
    }

    // Exit with error code if critical violations
    if (summary.errors > 0) {
      process.exit(1);
    }
  }

  /**
   * Get status emoji
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case "pass":
        return "✅";
      case "warn":
        return "⚠️";
      case "fail":
        return "❌";
      default:
        return "❓";
    }
  }

  /**
   * Save report to file
   */
  private saveReport(report: ArchitectureReport) {
    const dir = join(this.projectRoot, "reports");
    if (!existsSync(dir)) {
      execSync(`mkdir -p ${dir}`);
    }

    writeFileSync(this.reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved to: ${this.reportPath}`);
  }

  /**
   * Report violations to governance system
   */
  private reportToGovernance(report: ArchitectureReport) {
    const { summary } = report;

    // Governance event format
    const event = {
      type: "architecture.drift.detected",
      timestamp: report.timestamp,
      actor: "ArchitectureDriftMonitor",
      severity: summary.errors > 0 ? "P1" : "P2",
      data: {
        errors: summary.errors,
        warnings: summary.warnings,
        circularDependencies: summary.circularDependencies,
        dddViolations: summary.dddViolations,
        status: report.status,
      },
      message:
        summary.errors > 0
          ? `⚠️ Architecture drift detected: ${summary.errors} errors, ${summary.warnings} warnings`
          : `⚠️ Architecture warnings: ${summary.warnings} warnings`,
    };

    // Append to governance log
    const governanceLog = join(
      this.projectRoot,
      "reports/governance/architecture-events.jsonl",
    );
    const dir = join(this.projectRoot, "reports/governance");
    if (!existsSync(dir)) {
      execSync(`mkdir -p ${dir}`);
    }

    const existingContent = existsSync(governanceLog)
      ? readFileSync(governanceLog, "utf8")
      : "";
    writeFileSync(
      governanceLog,
      existingContent + JSON.stringify(event) + "\n",
    );

    console.log(`\n📝 Reported to governance: ${governanceLog}`);
  }

  /**
   * Generate visual dependency graph
   */
  generateGraph() {
    console.log("🎨 Generating architecture graph...\n");

    try {
      execSync(
        "npx depcruise --config .dependency-cruiser.cjs --output-type dot src/ | dot -T svg > reports/architecture-graph.svg",
        {
          cwd: this.projectRoot,
          stdio: "inherit",
        },
      );

      console.log("\n✅ Graph generated: reports/architecture-graph.svg");
    } catch (error) {
      console.error("❌ Failed to generate graph. Is graphviz installed?");
      console.log(
        "   Install: brew install graphviz (macOS) or apt-get install graphviz (Linux)",
      );
    }
  }
}

// CLI
const monitor = new ArchitectureDriftMonitor();

const command = process.argv[2] || "check";

switch (command) {
  case "check":
    monitor.runValidation();
    break;
  case "graph":
    monitor.generateGraph();
    break;
  case "help":
    console.log(`
Architecture Drift Monitor

Usage:
  npm run arch:check       Check for architecture violations
  npm run arch:graph       Generate dependency graph

Violations:
  - Circular dependencies (error)
  - DDD boundary violations (error)
  - Orphan modules (warn)
`);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}
