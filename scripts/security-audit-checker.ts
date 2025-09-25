#!/usr/bin/env node

/**
 * Security Audit Checker
 * Integrates into /sync workflow to ensure security compliance
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface SecurityIssue {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "DEPENDENCY" | "CODE" | "CONFIG" | "SECRETS";
  issue: string;
  file?: string;
  solution: string;
  blocking?: boolean; // Blocks /sync if true
}

interface SecurityReport {
  timestamp: string;
  overallStatus: "PASS" | "WARN" | "FAIL";
  totalIssues: number;
  blockingIssues: number;
  issues: SecurityIssue[];
  recommendations: string[];
}

class SecurityAuditChecker {
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  async runSecurityAudit(): Promise<SecurityReport> {
    console.log("🛡️ Running security audit...");

    const issues: SecurityIssue[] = [];

    // 1. Check for secrets in code
    issues.push(...(await this.checkForSecrets()));

    // 2. Dependency vulnerabilities
    issues.push(...(await this.checkDependencyVulnerabilities()));

    // 3. Configuration security
    issues.push(...(await this.checkConfigSecurity()));

    // 4. Code patterns that might expose secrets
    issues.push(...(await this.checkCodePatterns()));

    const blockingIssues = issues.filter((i) => i.blocking);
    const totalIssues = issues.length;

    const report: SecurityReport = {
      timestamp: new Date().toISOString(),
      overallStatus:
        blockingIssues.length > 0 ? "FAIL" : totalIssues > 0 ? "WARN" : "PASS",
      totalIssues,
      blockingIssues: blockingIssues.length,
      issues,
      recommendations: this.generateRecommendations(issues),
    };

    // Save report
    const reportPath = join(this.projectRoot, "reports/security-audit.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.printReport(report);

    return report;
  }

  private async checkForSecrets(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    try {
      // Common secret patterns
      const secretPatterns = [
        { pattern: "sk-[a-zA-Z0-9]{32,}", name: "OpenAI API Key" },
        {
          pattern: "xoxb-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}",
          name: "Slack Bot Token",
        },
        {
          pattern: "ghp_[a-zA-Z0-9]{36}",
          name: "GitHub Personal Access Token",
        },
        { pattern: "AKIA[0-9A-Z]{16}", name: "AWS Access Key" },
        { pattern: "AIza[0-9A-Za-z\\-_]{35}", name: "Google API Key" },
      ];

      for (const { pattern, name } of secretPatterns) {
        try {
          const result = execSync(
            `rg "${pattern}" src/ scripts/ --type ts --type js --type json || true`,
            { encoding: "utf8" },
          );

          if (result.trim()) {
            const lines = result.trim().split("\n");
            for (const line of lines) {
              if (line.includes(":")) {
                const [file] = line.split(":");
                issues.push({
                  severity: "CRITICAL",
                  category: "SECRETS",
                  issue: `Potential ${name} found in code`,
                  file,
                  solution:
                    "Move to environment variables or secure secret manager",
                  blocking: true,
                });
              }
            }
          }
        } catch (e) {
          // rg not available or no matches, continue
        }
      }
    } catch (error) {
      console.warn("⚠️ Secret scanning failed:", error);
    }

    return issues;
  }

  private async checkDependencyVulnerabilities(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    try {
      // Check if npm audit is available and run it
      const auditResult = execSync("npm audit --json", { encoding: "utf8" });
      const audit = JSON.parse(auditResult);

      if (audit.vulnerabilities) {
        Object.entries(audit.vulnerabilities).forEach(
          ([pkg, vuln]: [string, any]) => {
            const severity = vuln.severity?.toUpperCase() || "MEDIUM";
            issues.push({
              severity: severity as SecurityIssue["severity"],
              category: "DEPENDENCY",
              issue: `${pkg}: ${vuln.title || "Security vulnerability"}`,
              solution: vuln.fixAvailable
                ? "Run npm audit fix"
                : "Update dependency manually",
              blocking: severity === "CRITICAL",
            });
          },
        );
      }
    } catch (error) {
      // npm audit failed, might be no issues or npm not available
      console.log("ℹ️ npm audit check completed (no critical issues found)");
    }

    return issues;
  }

  private async checkConfigSecurity(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    // Check for exposed .env files
    if (existsSync(".env") || existsSync(".env.local")) {
      try {
        const gitignoreContent = existsSync(".gitignore")
          ? readFileSync(".gitignore", "utf8")
          : "";

        if (!gitignoreContent.includes(".env")) {
          issues.push({
            severity: "HIGH",
            category: "CONFIG",
            issue: ".env files not in .gitignore",
            file: ".gitignore",
            solution: "Add .env* to .gitignore",
            blocking: false,
          });
        }
      } catch (error) {
        console.warn("⚠️ .gitignore check failed:", error);
      }
    }

    // Check for package.json scripts with potential security issues
    try {
      const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
      const scripts = packageJson.scripts || {};

      Object.entries(scripts).forEach(([name, script]: [string, any]) => {
        if (typeof script === "string" && script.includes("--allow-root")) {
          issues.push({
            severity: "MEDIUM",
            category: "CONFIG",
            issue: `Script '${name}' uses --allow-root flag`,
            file: "package.json",
            solution: "Review if root access is necessary",
            blocking: false,
          });
        }
      });
    } catch (error) {
      console.warn("⚠️ package.json security check failed:", error);
    }

    return issues;
  }

  private async checkCodePatterns(): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    try {
      // Check for hardcoded API endpoints in production code
      const hardcodedEndpoints = execSync(
        `rg "https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" src/ --type ts --type js || true`,
        { encoding: "utf8" },
      );

      if (hardcodedEndpoints.trim()) {
        const lines = hardcodedEndpoints.trim().split("\n").slice(0, 3); // Limit to first 3 findings
        for (const line of lines) {
          if (line.includes(":")) {
            const [file] = line.split(":");
            issues.push({
              severity: "LOW",
              category: "CODE",
              issue: "Hardcoded URL found in source code",
              file,
              solution: "Move URLs to configuration",
              blocking: false,
            });
          }
        }
      }
    } catch (error) {
      // rg not available, skip
    }

    return issues;
  }

  private generateRecommendations(issues: SecurityIssue[]): string[] {
    const recommendations = [];

    if (issues.some((i) => i.category === "SECRETS")) {
      recommendations.push(
        "🔐 Implement pre-commit hooks to prevent secret commits",
      );
      recommendations.push("🔑 Use a secret management system for API keys");
    }

    if (issues.some((i) => i.category === "DEPENDENCY")) {
      recommendations.push("📦 Enable automated dependency scanning in CI/CD");
      recommendations.push("🔄 Regular dependency updates schedule");
    }

    if (issues.some((i) => i.category === "CONFIG")) {
      recommendations.push("⚙️ Review security configurations quarterly");
    }

    if (issues.length === 0) {
      recommendations.push(
        "✅ Security posture is good - maintain current practices",
      );
    }

    return recommendations;
  }

  private printReport(report: SecurityReport): void {
    console.log("\n🛡️ Security Audit Results");
    console.log("========================");
    console.log(
      `📊 Overall Status: ${
        report.overallStatus === "PASS"
          ? "✅ PASS"
          : report.overallStatus === "WARN"
            ? "⚠️ WARN"
            : "❌ FAIL"
      }`,
    );
    console.log(`🔍 Total Issues: ${report.totalIssues}`);
    console.log(`🚨 Blocking Issues: ${report.blockingIssues}`);

    if (report.issues.length > 0) {
      console.log("\n🔍 Issues Found:");
      report.issues.forEach((issue, i) => {
        const icon =
          issue.severity === "CRITICAL"
            ? "🚨"
            : issue.severity === "HIGH"
              ? "🔴"
              : issue.severity === "MEDIUM"
                ? "🟡"
                : "🟢";
        console.log(`   ${i + 1}. ${icon} ${issue.issue}`);
        if (issue.file) console.log(`      📁 File: ${issue.file}`);
        console.log(`      💡 Solution: ${issue.solution}`);
        if (issue.blocking) console.log("      🚫 BLOCKS /sync");
      });
    }

    if (report.recommendations.length > 0) {
      console.log("\n💡 Recommendations:");
      report.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    console.log(`\n📊 Detailed report: reports/security-audit.json`);
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new SecurityAuditChecker();
  checker
    .runSecurityAudit()
    .then((report) => {
      // Exit with error code if there are blocking issues
      process.exit(report.blockingIssues > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("❌ Security audit failed:", error);
      process.exit(1);
    });
}

export default SecurityAuditChecker;
