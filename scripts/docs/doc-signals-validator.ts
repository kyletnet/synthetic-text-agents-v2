#!/usr/bin/env tsx

/**
 * LLM Signals Validator
 *
 * Validates the .llm-signals-index.json file for correctness and completeness
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface LLMSignal {
  pattern: string;
  category: string;
  priority: number;
  action?: string;
}

interface LLMSignalsIndex {
  version: string;
  lastUpdated: string;
  signals: LLMSignal[];
}

interface ValidationResult {
  passed: boolean;
  message: string;
  details?: string[];
}

interface SignalsValidationReport {
  overall: "PASS" | "FAIL";
  timestamp: string;
  checks: Array<{
    name: string;
    result: ValidationResult;
  }>;
  summary: {
    totalSignals: number;
    categories: string[];
    avgPriority: number;
  };
}

class LLMSignalsValidator {
  private rootDir: string;
  private indexPath: string;

  constructor() {
    this.rootDir = process.cwd();
    this.indexPath = join(this.rootDir, "docs/.llm-signals-index.json");
  }

  private checkFileExists(): ValidationResult {
    if (!existsSync(this.indexPath)) {
      return {
        passed: false,
        message: "LLM signals index not found - run npm run docs:refresh",
      };
    }
    return {
      passed: true,
      message: "LLM signals index file exists",
    };
  }

  private checkValidJSON(): ValidationResult {
    try {
      const content = readFileSync(this.indexPath, "utf-8");
      JSON.parse(content);
      return {
        passed: true,
        message: "Valid JSON format",
      };
    } catch (error) {
      return {
        passed: false,
        message: `Invalid JSON: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  private checkRequiredFields(): ValidationResult {
    try {
      const content = readFileSync(this.indexPath, "utf-8");
      const index = JSON.parse(content) as Partial<LLMSignalsIndex>;

      const missing: string[] = [];
      if (!index.version) missing.push("version");
      if (!index.lastUpdated) missing.push("lastUpdated");
      if (!index.signals) missing.push("signals");

      if (missing.length > 0) {
        return {
          passed: false,
          message: "Missing required fields",
          details: missing,
        };
      }

      return {
        passed: true,
        message: "All required fields present",
      };
    } catch {
      return {
        passed: false,
        message: "Cannot validate - file read error",
      };
    }
  }

  private checkSignalsStructure(): ValidationResult {
    try {
      const content = readFileSync(this.indexPath, "utf-8");
      const index = JSON.parse(content) as LLMSignalsIndex;

      if (!Array.isArray(index.signals)) {
        return {
          passed: false,
          message: "signals field must be an array",
        };
      }

      if (index.signals.length === 0) {
        return {
          passed: false,
          message: "signals array is empty",
        };
      }

      const invalidSignals: string[] = [];
      for (let i = 0; i < index.signals.length; i++) {
        const signal = index.signals[i];
        if (
          !signal.pattern ||
          !signal.category ||
          signal.priority === undefined
        ) {
          invalidSignals.push(`Signal #${i + 1}`);
        }
      }

      if (invalidSignals.length > 0) {
        return {
          passed: false,
          message: `${invalidSignals.length} signals missing required fields`,
          details: invalidSignals.slice(0, 5),
        };
      }

      return {
        passed: true,
        message: `${index.signals.length} signals validated successfully`,
      };
    } catch (error) {
      return {
        passed: false,
        message: `Validation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  private checkFreshness(): ValidationResult {
    try {
      const content = readFileSync(this.indexPath, "utf-8");
      const index = JSON.parse(content) as LLMSignalsIndex;

      const lastUpdated = new Date(index.lastUpdated);
      const now = new Date();
      const daysSinceUpdate = Math.floor(
        (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceUpdate > 30) {
        return {
          passed: false,
          message: `Index is ${daysSinceUpdate} days old - consider refreshing`,
        };
      }

      return {
        passed: true,
        message: `Index is fresh (${daysSinceUpdate} days old)`,
      };
    } catch {
      return {
        passed: false,
        message: "Cannot check freshness - invalid lastUpdated field",
      };
    }
  }

  async execute(): Promise<SignalsValidationReport> {
    console.log("🔍 Validating LLM Signals Index...\n");

    const checks = [
      { name: "File exists", fn: () => this.checkFileExists() },
      { name: "Valid JSON", fn: () => this.checkValidJSON() },
      { name: "Required fields", fn: () => this.checkRequiredFields() },
      { name: "Signals structure", fn: () => this.checkSignalsStructure() },
      { name: "Freshness", fn: () => this.checkFreshness() },
    ];

    const report: SignalsValidationReport = {
      overall: "PASS",
      timestamp: new Date().toISOString(),
      checks: [],
      summary: {
        totalSignals: 0,
        categories: [],
        avgPriority: 0,
      },
    };

    for (const check of checks) {
      console.log(`🔍 ${check.name}...`);
      const result = check.fn();

      report.checks.push({
        name: check.name,
        result,
      });

      if (result.passed) {
        console.log(`   ✅ ${result.message}`);
      } else {
        console.log(`   ❌ ${result.message}`);
        if (result.details) {
          result.details.forEach((detail) => {
            console.log(`      - ${detail}`);
          });
        }
        report.overall = "FAIL";
      }
    }

    // Generate summary if validation passed
    if (report.overall === "PASS" && existsSync(this.indexPath)) {
      try {
        const content = readFileSync(this.indexPath, "utf-8");
        const index = JSON.parse(content) as LLMSignalsIndex;

        report.summary.totalSignals = index.signals.length;
        report.summary.categories = [
          ...new Set(index.signals.map((s) => s.category)),
        ];
        report.summary.avgPriority =
          index.signals.reduce((sum, s) => sum + s.priority, 0) /
          index.signals.length;
      } catch {
        // Ignore summary generation errors
      }
    }

    // Write report
    const reportsDir = join(this.rootDir, "reports");
    if (!existsSync(reportsDir)) {
      require("fs").mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = join(reportsDir, "doc-signals-report.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Validation Summary:`);
    console.log(
      `   Overall: ${report.overall === "PASS" ? "✅" : "❌"} ${
        report.overall
      }`,
    );
    if (report.overall === "PASS") {
      console.log(`   Total signals: ${report.summary.totalSignals}`);
      console.log(`   Categories: ${report.summary.categories.join(", ")}`);
      console.log(`   Avg priority: ${report.summary.avgPriority.toFixed(1)}`);
    }
    console.log(`\n📄 Report saved to: ${reportPath}`);

    return report;
  }
}

// CLI execution
async function main() {
  const validator = new LLMSignalsValidator();
  const report = await validator.execute();

  if (report.overall === "FAIL") {
    console.log("\n⚠️  LLM Signals Validation FAILED (non-blocking)");
    console.log(
      "💡 This is expected if docs:refresh hasn't been run. Run 'npm run maintain' to refresh.",
    );
    process.exit(0); // Non-blocking: exit 0 to allow CI to continue
  }

  console.log("\n✅ LLM Signals Validation PASSED");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

export { LLMSignalsValidator };
export type { SignalsValidationReport };
