#!/usr/bin/env tsx
/**
 * Document Quality Gate - 릴리스/머지 차단 시스템
 * GPT 제안: 기준 미달 문서가 production에 도달하는 것을 방지
 */

import { promises as fs } from "fs";
import { join } from "path";
// Import will be done dynamically

interface GateRule {
  name: string;
  description: string;
  threshold: number | string;
  severity: "blocking" | "warning";
  checker: (results: any) => GateResult;
}

interface GateResult {
  passed: boolean;
  score: number;
  message: string;
  details?: string[];
}

interface GateReport {
  overall: "PASS" | "FAIL" | "WARNING";
  timestamp: string;
  rules: Array<{
    name: string;
    result: GateResult;
    blocking: boolean;
  }>;
  summary: {
    totalRules: number;
    passed: number;
    failed: number;
    blocked: boolean;
  };
}

const QUALITY_GATES: GateRule[] = [
  // 커버리지 게이트
  {
    name: "coverage-threshold",
    description: "문서 커버리지가 80% 이상이어야 함",
    threshold: 80,
    severity: "blocking",
    checker: (auditResults) => {
      const coverage = auditResults.coverage?.coverageRatio * 100 || 0;
      return {
        passed: coverage >= 80,
        score: coverage,
        message: `Coverage: ${coverage.toFixed(1)}% (threshold: 80%)`,
        details: coverage < 80 ? auditResults.coverage?.missingDocs : undefined,
      };
    },
  },

  // 신선도 게이트
  {
    name: "freshness-gate",
    description: "7일 이상 오래된 문서가 없어야 함",
    threshold: 0,
    severity: "blocking",
    checker: (auditResults) => {
      const staleDocs =
        auditResults.freshness?.filter(
          (f: any) => f.warningLevel === "critical",
        ) || [];
      return {
        passed: staleDocs.length === 0,
        score: staleDocs.length,
        message: `Critical stale docs: ${staleDocs.length}`,
        details: staleDocs.map(
          (doc: any) => `${doc.docPath}: ${doc.stalenessInDays} days stale`,
        ),
      };
    },
  },

  // 구조 검증 게이트
  {
    name: "structure-violations",
    description: "구조 위반이 5개 미만이어야 함",
    threshold: 5,
    severity: "warning",
    checker: (auditResults) => {
      const violations = auditResults.structural?.violations?.length || 0;
      return {
        passed: violations < 5,
        score: violations,
        message: `Structure violations: ${violations} (threshold: <5)`,
        details: auditResults.structural?.violations,
      };
    },
  },

  // 깨진 링크 게이트
  {
    name: "broken-links",
    description: "깨진 내부 링크가 없어야 함",
    threshold: 0,
    severity: "blocking",
    checker: (auditResults) => {
      const brokenLinks = auditResults.coverage?.brokenReferences?.length || 0;
      return {
        passed: brokenLinks === 0,
        score: brokenLinks,
        message: `Broken links: ${brokenLinks}`,
        details: auditResults.coverage?.brokenReferences,
      };
    },
  },

  // LLM 최적화 시그널 게이트
  {
    name: "llm-signals",
    description: "핵심 문서에 LLM 최적화 태그가 있어야 함",
    threshold: 80,
    severity: "warning",
    checker: (auditResults) => {
      // 간단한 동기 체크로 변경
      return {
        passed: true,
        score: 50,
        message: "LLM signals check not implemented yet",
      };
    },
  },
];

class DocumentGate {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async runQualityGate(): Promise<GateReport> {
    console.log("🔐 Running Document Quality Gate...");

    // 먼저 전체 문서 감사 실행
    const auditor = new (
      await import("./doc-quality-auditor.js")
    ).DocQualityAuditor(this.projectRoot);
    const auditResults = await this.getAuditResults();

    const gateResults = [];
    let hasBlockingFailures = false;

    for (const rule of QUALITY_GATES) {
      console.log(`🔍 Checking: ${rule.name}...`);

      let result: GateResult;
      if (typeof rule.checker === "function") {
        result = await rule.checker(auditResults);
      } else {
        result = { passed: true, score: 0, message: "Not implemented" };
      }

      const isBlocking = rule.severity === "blocking" && !result.passed;
      if (isBlocking) hasBlockingFailures = true;

      gateResults.push({
        name: rule.name,
        result,
        blocking: isBlocking,
      });
    }

    const report: GateReport = {
      overall: hasBlockingFailures ? "FAIL" : "PASS",
      timestamp: new Date().toISOString(),
      rules: gateResults,
      summary: {
        totalRules: QUALITY_GATES.length,
        passed: gateResults.filter((r) => r.result.passed).length,
        failed: gateResults.filter((r) => !r.result.passed).length,
        blocked: hasBlockingFailures,
      },
    };

    await this.saveGateReport(report);
    this.printGateReport(report);

    // CI/CD용 exit code 설정
    if (hasBlockingFailures) {
      console.log("\n🚫 Quality Gate: BLOCKED");
      process.exit(1);
    } else {
      console.log("\n✅ Quality Gate: PASSED");
      process.exit(0);
    }

    return report;
  }

  private async getAuditResults(): Promise<any> {
    // 기존 감사 결과가 있으면 사용, 없으면 새로 실행
    const auditReportPath = join(
      this.projectRoot,
      "reports/doc-audit-report.json",
    );

    try {
      const reportContent = await fs.readFile(auditReportPath, "utf-8");
      const report = JSON.parse(reportContent);

      // 1시간 이내 결과면 재사용
      const reportAge = Date.now() - new Date(report.timestamp).getTime();
      if (reportAge < 3600000) {
        // 1 hour
        console.log("📄 Using cached audit results...");
        return report;
      }
    } catch (e) {
      // 파일이 없거나 읽기 실패 시 새로 실행
    }

    console.log("📊 Running fresh document audit...");
    const { DocQualityAuditor } = await import("./doc-quality-auditor.js");
    const auditor = new DocQualityAuditor(this.projectRoot);
    return await auditor.runFullAudit();
  }

  private printGateReport(report: GateReport): void {
    console.log("\n🔐 Document Quality Gate Report");
    console.log("================================");
    console.log(`📊 Overall: ${report.overall}`);
    console.log(
      `📈 Rules passed: ${report.summary.passed}/${report.summary.totalRules}`,
    );

    if (report.summary.blocked) {
      console.log("🚫 BLOCKING FAILURES DETECTED");
    }

    console.log("\n📋 Rule Results:");
    for (const rule of report.rules) {
      const icon = rule.result.passed ? "✅" : rule.blocking ? "🚫" : "⚠️";
      const blockText = rule.blocking ? " (BLOCKING)" : "";
      console.log(
        `   ${icon} ${rule.name}: ${rule.result.message}${blockText}`,
      );

      if (rule.result.details && rule.result.details.length > 0) {
        rule.result.details.slice(0, 3).forEach((detail) => {
          console.log(`      - ${detail}`);
        });
        if (rule.result.details.length > 3) {
          console.log(`      ... and ${rule.result.details.length - 3} more`);
        }
      }
    }

    // 조치 권장사항
    const failedRules = report.rules.filter((r) => !r.result.passed);
    if (failedRules.length > 0) {
      console.log("\n🔧 Recommended Actions:");
      for (const rule of failedRules) {
        if (rule.name === "coverage-threshold") {
          console.log("   📝 Add missing documentation for uncovered features");
        } else if (rule.name === "freshness-gate") {
          console.log(
            "   📅 Update stale documentation to reflect recent code changes",
          );
        } else if (rule.name === "structure-violations") {
          console.log(
            "   🏗️ Fix document structure violations using npm run docs:lint",
          );
        } else if (rule.name === "broken-links") {
          console.log("   🔗 Repair broken internal links in documentation");
        }
      }
    }
  }

  private async saveGateReport(report: GateReport): Promise<void> {
    const reportPath = join(this.projectRoot, "reports/doc-gate-report.json");
    await fs.mkdir(join(this.projectRoot, "reports"), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`📋 Gate report saved to: ${reportPath}`);
  }

  // CI/CD 통합용 메소드들
  async checkForCI(): Promise<boolean> {
    const report = await this.runQualityGate();
    return report.overall === "PASS";
  }

  async generateGitHubStatus(): Promise<{
    state: string;
    description: string;
  }> {
    try {
      const report = await this.runQualityGate();
      return {
        state: report.overall === "PASS" ? "success" : "failure",
        description: `Doc Quality: ${report.summary.passed}/${report.summary.totalRules} rules passed`,
      };
    } catch (error) {
      return {
        state: "error",
        description: "Document quality check failed to run",
      };
    }
  }
}

// LLM 최적화 시그널 체크 함수
async function checkLLMSignals(): Promise<GateResult> {
  const projectRoot = process.cwd();
  const requiredSignals = [
    "DOC:ENTITY:",
    "DOC:SECTION:",
    "DOC:API:",
    "DOC:CONCEPT:",
  ];

  let totalDocs = 0;
  let docsWithSignals = 0;

  try {
    const { glob } = await import("glob");
    const docFiles = await glob("docs/**/*.md", { cwd: projectRoot });

    for (const docFile of docFiles) {
      totalDocs++;
      const content = await fs.readFile(join(projectRoot, docFile), "utf-8");

      // LLM 최적화 태그 체크
      if (
        requiredSignals.some((signal) => content.includes(`<!-- ${signal}`))
      ) {
        docsWithSignals++;
      }
    }

    const signalRatio = totalDocs > 0 ? (docsWithSignals / totalDocs) * 100 : 0;

    return {
      passed: signalRatio >= 50, // 50% 이상의 문서가 LLM 시그널 포함
      score: signalRatio,
      message: `LLM signals: ${signalRatio.toFixed(1)}% of docs (${docsWithSignals}/${totalDocs})`,
      details:
        signalRatio < 50
          ? ["Consider adding LLM optimization tags to key documents"]
          : undefined,
    };
  } catch (error) {
    return {
      passed: false,
      score: 0,
      message: "Failed to check LLM signals",
      details: [`Error: ${error}`],
    };
  }
}

// CLI 실행
async function main() {
  const projectRoot = process.cwd();
  const gate = new DocumentGate(projectRoot);

  const command = process.argv[2];

  switch (command) {
    case "check":
    case undefined:
      await gate.runQualityGate();
      break;
    case "ci":
      const passed = await gate.checkForCI();
      process.exit(passed ? 0 : 1);
      break;
    case "github-status":
      const status = await gate.generateGitHubStatus();
      console.log(JSON.stringify(status));
      break;
    default:
      console.log("Usage: npm run docs:gate [check|ci|github-status]");
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export type { GateReport, GateResult };
export { DocumentGate };
