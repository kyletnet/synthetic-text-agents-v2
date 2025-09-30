#!/usr/bin/env tsx

/**
 * Documentation Quality Gate for CI/CD
 *
 * Orchestrates all documentation checks and blocks CI if critical issues found
 * This is the final gate that runs: audit → signals → lint
 */

import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { DocumentationAuditor, AuditReport } from "./doc-audit.js";
import {
  LLMSignalsValidator,
  SignalsValidationReport,
} from "./doc-signals-validator.js";
import { DocumentationLinter, LintReport } from "./doc-linter.js";

interface GateReport {
  overall: "PASS" | "FAIL";
  timestamp: string;
  stages: {
    audit: {
      status: "PASS" | "FAIL";
      report: AuditReport | null;
    };
    signals: {
      status: "PASS" | "FAIL";
      report: SignalsValidationReport | null;
    };
    lint: {
      status: "PASS" | "FAIL";
      report: LintReport | null;
    };
  };
  summary: {
    totalIssues: number;
    blockingIssues: number;
  };
}

class DocQualityGate {
  private rootDir: string;

  constructor() {
    this.rootDir = process.cwd();
  }

  async execute(): Promise<GateReport> {
    console.log("🔐 Running Documentation Quality Gate...\n");
    console.log("=".repeat(60));

    const report: GateReport = {
      overall: "PASS",
      timestamp: new Date().toISOString(),
      stages: {
        audit: { status: "PASS", report: null },
        signals: { status: "PASS", report: null },
        lint: { status: "PASS", report: null },
      },
      summary: {
        totalIssues: 0,
        blockingIssues: 0,
      },
    };

    // Stage 1: Documentation Audit
    console.log("\n📋 STAGE 1: Documentation Audit");
    console.log("-".repeat(60));
    try {
      const auditor = new DocumentationAuditor();
      const auditReport = await auditor.execute();
      report.stages.audit.report = auditReport;
      report.stages.audit.status = auditReport.overall;

      if (auditReport.overall === "FAIL") {
        report.overall = "FAIL";
        report.summary.blockingIssues += auditReport.summary.critical;
      }
      report.summary.totalIssues +=
        auditReport.summary.critical +
        auditReport.summary.warning +
        auditReport.summary.info;
    } catch (error) {
      console.error("❌ Audit stage failed:", error);
      report.stages.audit.status = "FAIL";
      report.overall = "FAIL";
      report.summary.blockingIssues++;
    }

    // Stage 2: LLM Signals Validation
    console.log("\n\n🔍 STAGE 2: LLM Signals Validation");
    console.log("-".repeat(60));
    try {
      const validator = new LLMSignalsValidator();
      const signalsReport = await validator.execute();
      report.stages.signals.report = signalsReport;
      report.stages.signals.status = signalsReport.overall;

      if (signalsReport.overall === "FAIL") {
        // Signals validation is non-blocking but logged
        console.log("⚠️  LLM Signals validation failed (non-blocking)");
      }
      report.summary.totalIssues += signalsReport.checks.filter(
        (c) => !c.result.passed,
      ).length;
    } catch (error) {
      console.error("⚠️  Signals validation failed (non-blocking):", error);
      report.stages.signals.status = "FAIL";
    }

    // Stage 3: Documentation Linting
    console.log("\n\n🔎 STAGE 3: Documentation Linting");
    console.log("-".repeat(60));
    try {
      const linter = new DocumentationLinter();
      const lintReport = await linter.execute();
      report.stages.lint.report = lintReport;
      report.stages.lint.status = lintReport.overall;

      if (lintReport.overall === "FAIL") {
        report.overall = "FAIL";
        report.summary.blockingIssues += lintReport.summary.errors;
      }
      report.summary.totalIssues += lintReport.summary.totalIssues;
    } catch (error) {
      console.error("❌ Linting stage failed:", error);
      report.stages.lint.status = "FAIL";
      report.overall = "FAIL";
      report.summary.blockingIssues++;
    }

    // Write consolidated report
    const reportsDir = join(this.rootDir, "reports");
    if (!existsSync(reportsDir)) {
      require("fs").mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = join(reportsDir, "doc-gate-report.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Final summary
    console.log("\n\n" + "=".repeat(60));
    console.log("📊 DOCUMENTATION QUALITY GATE SUMMARY");
    console.log("=".repeat(60));
    console.log(
      `   Overall: ${report.overall === "PASS" ? "✅" : "❌"} ${report.overall}`,
    );
    console.log(`   Total issues: ${report.summary.totalIssues}`);
    console.log(`   Blocking issues: ${report.summary.blockingIssues}`);
    console.log("\n   Stage Results:");
    console.log(
      `   - Audit: ${report.stages.audit.status === "PASS" ? "✅" : "❌"} ${report.stages.audit.status}`,
    );
    console.log(
      `   - Signals: ${report.stages.signals.status === "PASS" ? "✅" : "⚠️"} ${report.stages.signals.status} (non-blocking)`,
    );
    console.log(
      `   - Linting: ${report.stages.lint.status === "PASS" ? "✅" : "❌"} ${report.stages.lint.status}`,
    );
    console.log(`\n📄 Report saved to: ${reportPath}`);
    console.log("=".repeat(60));

    return report;
  }
}

// CLI execution
async function main() {
  const gate = new DocQualityGate();
  const report = await gate.execute();

  if (report.overall === "FAIL") {
    console.log("\n❌ Documentation Quality Gate FAILED");
    console.log("💡 Fix blocking issues before proceeding");
    process.exit(1);
  }

  console.log("\n✅ Documentation Quality Gate PASSED");
  if (report.summary.totalIssues > report.summary.blockingIssues) {
    console.log(
      "⚠️  Some non-blocking issues found - consider addressing them",
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

export { DocQualityGate };
export type { GateReport };
