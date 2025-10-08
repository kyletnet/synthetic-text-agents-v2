#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Documentation Audit - Full Audit Mode
 *
 * Comprehensive audit of documentation structure and required files
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface AuditRule {
  name: string;
  severity: "critical" | "warning" | "info";
  check: () => { passed: boolean; message: string; details?: string[] };
}

interface AuditReport {
  overall: "PASS" | "FAIL";
  timestamp: string;
  summary: {
    critical: number;
    warning: number;
    info: number;
    totalRules: number;
  };
  rules: Array<{
    name: string;
    severity: string;
    result: {
      passed: boolean;
      message: string;
      details?: string[];
    };
  }>;
}

class DocumentationAuditor {
  private rootDir: string;
  private rules: AuditRule[];

  constructor() {
    this.rootDir = process.cwd();
    this.rules = [
      {
        name: "CLAUDE.md exists and has content",
        severity: "critical",
        check: () => this.checkCLAUDEmd(),
      },
      {
        name: "Core documentation files exist",
        severity: "critical",
        check: () => this.checkCoreDocsExist(),
      },
      {
        name: "DEVELOPMENT_STANDARDS.md completeness",
        severity: "warning",
        check: () => this.checkDevStandardsCompleteness(),
      },
      {
        name: "LLM_DEVELOPMENT_CONTRACT.md completeness",
        severity: "warning",
        check: () => this.checkLLMContractCompleteness(),
      },
      {
        name: "docs/ directory structure",
        severity: "info",
        check: () => this.checkDocsStructure(),
      },
    ];
  }

  private checkCLAUDEmd(): { passed: boolean; message: string } {
    const claudePath = join(this.rootDir, "CLAUDE.md");
    if (!existsSync(claudePath)) {
      return {
        passed: false,
        message: "CLAUDE.md is missing - required for project instructions",
      };
    }

    const content = readFileSync(claudePath, "utf-8");
    if (content.length < 100) {
      return {
        passed: false,
        message:
          "CLAUDE.md is too short - must contain meaningful instructions",
      };
    }

    return {
      passed: true,
      message: `CLAUDE.md exists with ${content.length} characters`,
    };
  }

  private checkCoreDocsExist(): {
    passed: boolean;
    message: string;
    details?: string[];
  } {
    const requiredDocs = [
      "DEVELOPMENT_STANDARDS.md",
      "LLM_DEVELOPMENT_CONTRACT.md",
      "docs/llm_friendly_summary.md",
      "HANDOFF_NAVIGATION.md",
    ];

    const missing: string[] = [];
    for (const doc of requiredDocs) {
      if (!existsSync(join(this.rootDir, doc))) {
        missing.push(doc);
      }
    }

    if (missing.length > 0) {
      return {
        passed: false,
        message: `${missing.length} core documentation files missing`,
        details: missing,
      };
    }

    return {
      passed: true,
      message: "All core documentation files exist",
    };
  }

  private checkDevStandardsCompleteness(): {
    passed: boolean;
    message: string;
  } {
    const path = join(this.rootDir, "DEVELOPMENT_STANDARDS.md");
    if (!existsSync(path)) {
      return { passed: false, message: "File not found" };
    }

    const content = readFileSync(path, "utf-8");
    const requiredSections = [
      "Logging Standards",
      "TypeScript Standards",
      "Error Handling",
      "Code Organization",
    ];

    const missingSections = requiredSections.filter(
      (section) => !content.includes(section),
    );

    if (missingSections.length > 0) {
      return {
        passed: false,
        message: `Missing sections: ${missingSections.join(", ")}`,
      };
    }

    return {
      passed: true,
      message: "All required sections present",
    };
  }

  private checkLLMContractCompleteness(): { passed: boolean; message: string } {
    const path = join(this.rootDir, "LLM_DEVELOPMENT_CONTRACT.md");
    if (!existsSync(path)) {
      return { passed: false, message: "File not found" };
    }

    const content = readFileSync(path, "utf-8");
    const requiredKeywords = ["Logger", "standards", "TypeScript", "testing"];

    const missingKeywords = requiredKeywords.filter(
      (keyword) => !content.toLowerCase().includes(keyword.toLowerCase()),
    );

    if (missingKeywords.length > 0) {
      return {
        passed: false,
        message: `Missing keywords: ${missingKeywords.join(", ")}`,
      };
    }

    return {
      passed: true,
      message: "All required keywords present",
    };
  }

  private checkDocsStructure(): {
    passed: boolean;
    message: string;
    details?: string[];
  } {
    const expectedDirs = ["docs/RFC", "docs/architecture", "docs/guides"];
    const existing: string[] = [];
    const missing: string[] = [];

    for (const dir of expectedDirs) {
      const fullPath = join(this.rootDir, dir);
      if (existsSync(fullPath)) {
        existing.push(dir);
      } else {
        missing.push(dir);
      }
    }

    if (existing.length === 0) {
      return {
        passed: false,
        message: "No standard docs directories found",
        details: missing,
      };
    }

    return {
      passed: true,
      message: `${existing.length}/${expectedDirs.length} standard directories exist`,
      details: missing.length > 0 ? missing : undefined,
    };
  }

  async execute(): Promise<AuditReport> {
    console.log("📋 Running Documentation Audit (Full Mode)...\n");

    const report: AuditReport = {
      overall: "PASS",
      timestamp: new Date().toISOString(),
      summary: {
        critical: 0,
        warning: 0,
        info: 0,
        totalRules: this.rules.length,
      },
      rules: [],
    };

    for (const rule of this.rules) {
      console.log(`📋 Auditing: ${rule.name}...`);
      const result = rule.check();

      report.rules.push({
        name: rule.name,
        severity: rule.severity,
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

        // Count by severity
        if (rule.severity === "critical") {
          report.summary.critical++;
          report.overall = "FAIL";
        } else if (rule.severity === "warning") {
          report.summary.warning++;
        } else {
          report.summary.info++;
        }
      }
    }

    // Write report
    const reportsDir = join(this.rootDir, "reports");
    if (!existsSync(reportsDir)) {
      require("fs").mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = join(reportsDir, "doc-audit-report.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n📊 Audit Summary:`);
    console.log(
      `   Overall: ${report.overall === "PASS" ? "✅" : "❌"} ${
        report.overall
      }`,
    );
    console.log(`   Critical issues: ${report.summary.critical}`);
    console.log(`   Warnings: ${report.summary.warning}`);
    console.log(`   Info: ${report.summary.info}`);
    console.log(`\n📄 Report saved to: ${reportPath}`);

    return report;
  }
}

// CLI execution
async function main() {
  const auditor = new DocumentationAuditor();
  const report = await auditor.execute();

  if (report.overall === "FAIL") {
    console.log("\n❌ Documentation Audit FAILED");
    console.log("💡 Fix critical issues before proceeding");
    process.exit(1);
  }

  console.log("\n✅ Documentation Audit PASSED");
  if (report.summary.warning > 0 || report.summary.info > 0) {
    console.log(
      "⚠️  Some non-critical issues found - consider addressing them",
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

export { DocumentationAuditor };
export type { AuditReport };
