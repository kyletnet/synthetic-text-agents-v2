#!/usr/bin/env node

/**
 * Workflow Prevention System
 * Prevents future workflow gaps by enforcing completeness checks
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

interface PreventionRule {
  id: string;
  name: string;
  category: "WORKFLOW" | "INTEGRATION" | "VALIDATION" | "DOCUMENTATION";
  description: string;
  checkFunction: () => boolean;
  fixSuggestion: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

interface PreventionReport {
  timestamp: string;
  rulesChecked: number;
  violations: PreventionViolation[];
  overallStatus: "PASS" | "WARN" | "FAIL";
  preventionScore: number; // 0-100
}

interface PreventionViolation {
  ruleId: string;
  ruleName: string;
  severity: string;
  description: string;
  fixSuggestion: string;
}

class WorkflowPreventionSystem {
  private projectRoot: string;
  private preventionRules: PreventionRule[] = [];

  constructor() {
    this.projectRoot = process.cwd();
    this.initializeRules();
  }

  private initializeRules(): void {
    this.preventionRules = [
      {
        id: "WF001",
        name: "Sync Workflow Completeness",
        category: "WORKFLOW",
        description: "Ensure /sync includes all essential system updates",
        checkFunction: () => this.checkSyncWorkflowCompleteness(),
        fixSuggestion:
          "Add missing steps to /sync workflow in scripts/slash-commands.sh",
        severity: "CRITICAL",
      },
      {
        id: "WF002",
        name: "Command Documentation Sync",
        category: "DOCUMENTATION",
        description: "Verify all commands are documented in help",
        checkFunction: () => this.checkCommandDocumentation(),
        fixSuggestion: "Update help text in scripts/slash-commands.sh",
        severity: "HIGH",
      },
      {
        id: "WF003",
        name: "Security Integration",
        category: "INTEGRATION",
        description: "Security checks must be part of main workflows",
        checkFunction: () => this.checkSecurityIntegration(),
        fixSuggestion: "Add security:audit:check to CI and sync workflows",
        severity: "HIGH",
      },
      {
        id: "WF004",
        name: "Core Document Updates",
        category: "DOCUMENTATION",
        description: "Core documents must be auto-updated by /sync",
        checkFunction: () => this.checkCoreDocumentUpdates(),
        fixSuggestion: "Ensure docs:update-core is called in /sync workflow",
        severity: "CRITICAL",
      },
      {
        id: "WF005",
        name: "Failure Recovery System",
        category: "VALIDATION",
        description: "Critical workflows must have rollback mechanisms",
        checkFunction: () => this.checkFailureRecovery(),
        fixSuggestion: "Implement transaction system for critical workflows",
        severity: "HIGH",
      },
      {
        id: "WF006",
        name: "Quality Gate Integration",
        category: "VALIDATION",
        description: "TypeScript/lint checks must be enforced",
        checkFunction: () => this.checkQualityGates(),
        fixSuggestion: "Add typecheck and lint to critical workflows",
        severity: "HIGH",
      },
      {
        id: "WF007",
        name: "Package.json Script Consistency",
        category: "INTEGRATION",
        description: "All workflow steps must have corresponding npm scripts",
        checkFunction: () => this.checkPackageJsonConsistency(),
        fixSuggestion: "Add missing npm scripts to package.json",
        severity: "MEDIUM",
      },
      {
        id: "WF008",
        name: "Audit Trail Completeness",
        category: "DOCUMENTATION",
        description: "All critical operations must be logged/auditable",
        checkFunction: () => this.checkAuditTrail(),
        fixSuggestion: "Add logging to critical workflow steps",
        severity: "MEDIUM",
      },
    ];
  }

  async runPreventionCheck(): Promise<PreventionReport> {
    console.log("🛡️ Running workflow prevention check...");

    const violations: PreventionViolation[] = [];

    for (const rule of this.preventionRules) {
      try {
        console.log(`   Checking: ${rule.name}`);
        const passed = rule.checkFunction();

        if (!passed) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            description: rule.description,
            fixSuggestion: rule.fixSuggestion,
          });
        }
      } catch (error) {
        console.warn(`⚠️ Rule ${rule.id} check failed:`, error);
        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: "MEDIUM",
          description: `Check failed: ${error}`,
          fixSuggestion: "Review rule implementation",
        });
      }
    }

    const criticalViolations = violations.filter(
      (v) => v.severity === "CRITICAL",
    ).length;
    const highViolations = violations.filter(
      (v) => v.severity === "HIGH",
    ).length;

    const preventionScore = Math.max(
      0,
      100 -
        (criticalViolations * 30 + highViolations * 20 + violations.length * 5),
    );

    const overallStatus =
      criticalViolations > 0 ? "FAIL" : highViolations > 0 ? "WARN" : "PASS";

    const report: PreventionReport = {
      timestamp: new Date().toISOString(),
      rulesChecked: this.preventionRules.length,
      violations,
      overallStatus,
      preventionScore,
    };

    // Save report
    const reportsDir = join(this.projectRoot, "reports");
    if (!existsSync(reportsDir)) {
      mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = join(reportsDir, "workflow-prevention.json");
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    this.printReport(report);
    return report;
  }

  private checkSyncWorkflowCompleteness(): boolean {
    try {
      const slashCommandsContent = readFileSync(
        join(this.projectRoot, "scripts/slash-commands.sh"),
        "utf8",
      );

      // Check for essential sync components
      const requiredSteps = [
        "docs:sync", // Documentation generation
        "docs:update-core", // Core document updates
        "security:audit:check", // Security validation
        "ci:strict", // Quality validation
        "health:report", // Health reporting
      ];

      return requiredSteps.every((step) => slashCommandsContent.includes(step));
    } catch (error) {
      return false;
    }
  }

  private checkCommandDocumentation(): boolean {
    try {
      const packageJsonContent = readFileSync(
        join(this.projectRoot, "package.json"),
        "utf8",
      );
      const slashCommandsContent = readFileSync(
        join(this.projectRoot, "scripts/slash-commands.sh"),
        "utf8",
      );

      const packageJson = JSON.parse(packageJsonContent);
      const scripts = Object.keys(packageJson.scripts || {});

      // Check that major slash commands are documented in help
      const helpSection = slashCommandsContent.match(/case "help"[\s\S]*?;;/);
      if (!helpSection) return false;

      const helpText = helpSection[0];

      // Essential commands should be documented
      const essentialCommands = ["/sync", "/status", "/ship", "/clean"];
      return essentialCommands.every((cmd) => helpText.includes(cmd));
    } catch (error) {
      return false;
    }
  }

  private checkSecurityIntegration(): boolean {
    try {
      const slashCommandsContent = readFileSync(
        join(this.projectRoot, "scripts/slash-commands.sh"),
        "utf8",
      );
      const packageJsonContent = readFileSync(
        join(this.projectRoot, "package.json"),
        "utf8",
      );

      // Security audit should be in both /sync and package.json
      return (
        slashCommandsContent.includes("security:audit:check") &&
        packageJsonContent.includes("security:audit:check")
      );
    } catch (error) {
      return false;
    }
  }

  private checkCoreDocumentUpdates(): boolean {
    try {
      const slashCommandsContent = readFileSync(
        join(this.projectRoot, "scripts/slash-commands.sh"),
        "utf8",
      );

      // /sync should include core document updates
      return slashCommandsContent.includes("docs:update-core");
    } catch (error) {
      return false;
    }
  }

  private checkFailureRecovery(): boolean {
    try {
      const slashCommandsContent = readFileSync(
        join(this.projectRoot, "scripts/slash-commands.sh"),
        "utf8",
      );
      const packageJsonContent = readFileSync(
        join(this.projectRoot, "package.json"),
        "utf8",
      );

      // Transaction system should be available
      return (
        slashCommandsContent.includes("sync:tx:rollback") &&
        packageJsonContent.includes("sync:tx:rollback")
      );
    } catch (error) {
      return false;
    }
  }

  private checkQualityGates(): boolean {
    try {
      const slashCommandsContent = readFileSync(
        join(this.projectRoot, "scripts/slash-commands.sh"),
        "utf8",
      );

      // Quality checks should be in critical workflows
      return slashCommandsContent.includes("ci:strict");
    } catch (error) {
      return false;
    }
  }

  private checkPackageJsonConsistency(): boolean {
    try {
      const packageJsonContent = readFileSync(
        join(this.projectRoot, "package.json"),
        "utf8",
      );

      const packageJson = JSON.parse(packageJsonContent);
      const scripts = packageJson.scripts || {};

      // Essential scripts should exist
      const essentialScripts = [
        "sync",
        "status:smart",
        "docs:update-core",
        "security:audit:check",
        "health:report",
        "fix",
        "sync:tx:rollback",
      ];

      return essentialScripts.every((script) => scripts[script]);
    } catch (error) {
      return false;
    }
  }

  private checkAuditTrail(): boolean {
    try {
      // Check if critical operations create logs/reports
      const reportsDir = join(this.projectRoot, "reports");

      // Should have mechanism for creating audit logs
      return (
        existsSync(join(this.projectRoot, "scripts/sync-health-reporter.ts")) &&
        existsSync(
          join(this.projectRoot, "scripts/workflow-completeness-auditor.ts"),
        )
      );
    } catch (error) {
      return false;
    }
  }

  private printReport(report: PreventionReport): void {
    console.log("\n🛡️ Workflow Prevention Report");
    console.log("============================");
    console.log(
      `📊 Overall Status: ${this.getStatusIcon(report.overallStatus)} ${report.overallStatus}`,
    );
    console.log(`🎯 Prevention Score: ${report.preventionScore}/100`);
    console.log(`🔍 Rules Checked: ${report.rulesChecked}`);
    console.log(`⚠️ Violations Found: ${report.violations.length}`);

    if (report.violations.length > 0) {
      console.log("\n❌ Violations:");
      report.violations.forEach((violation, i) => {
        const icon =
          violation.severity === "CRITICAL"
            ? "🚨"
            : violation.severity === "HIGH"
              ? "🔴"
              : violation.severity === "MEDIUM"
                ? "🟡"
                : "🟢";

        console.log(
          `   ${i + 1}. ${icon} [${violation.ruleId}] ${violation.ruleName}`,
        );
        console.log(`      📝 ${violation.description}`);
        console.log(`      💡 ${violation.fixSuggestion}`);
      });

      console.log("\n🎯 Next Steps:");
      const criticalCount = report.violations.filter(
        (v) => v.severity === "CRITICAL",
      ).length;
      const highCount = report.violations.filter(
        (v) => v.severity === "HIGH",
      ).length;

      if (criticalCount > 0) {
        console.log(
          `   1. 🚨 Fix ${criticalCount} CRITICAL violations immediately`,
        );
      }
      if (highCount > 0) {
        console.log(
          `   ${criticalCount > 0 ? "2" : "1"}. 🔴 Address ${highCount} HIGH priority violations`,
        );
      }
      console.log(
        `   ${criticalCount + highCount > 0 ? "3" : "1"}. 📋 Review remaining ${report.violations.length - criticalCount - highCount} violations`,
      );
    } else {
      console.log(
        "\n✅ No violations found - workflow prevention is effective!",
      );
    }

    console.log(`\n📊 Detailed report: reports/workflow-prevention.json`);
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case "PASS":
        return "✅";
      case "WARN":
        return "⚠️";
      case "FAIL":
        return "❌";
      default:
        return "❓";
    }
  }

  async installPreventionHooks(): Promise<void> {
    console.log("🔧 Installing workflow prevention hooks...");

    // Add pre-commit hook to check workflow completeness
    const hookContent = `#!/bin/bash
# Workflow Prevention Check
echo "🛡️ Checking workflow completeness..."
npm run workflow:prevention:check --silent
if [ $? -ne 0 ]; then
    echo "❌ Workflow prevention check failed - commit blocked"
    echo "💡 Run 'npm run workflow:prevention:check' for details"
    exit 1
fi
`;

    const hooksDir = join(this.projectRoot, ".git/hooks");
    if (existsSync(hooksDir)) {
      const preCommitHook = join(hooksDir, "pre-commit");
      writeFileSync(preCommitHook, hookContent);

      // Make executable
      try {
        execSync(`chmod +x "${preCommitHook}"`);
        console.log("✅ Pre-commit hook installed");
      } catch (error) {
        console.warn("⚠️ Could not make hook executable:", error);
      }
    }

    console.log("✅ Prevention hooks installed successfully");
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const system = new WorkflowPreventionSystem();
  const command = process.argv[2];

  switch (command) {
    case "check":
      system
        .runPreventionCheck()
        .then((report) => {
          process.exit(report.overallStatus === "FAIL" ? 1 : 0);
        })
        .catch((error) => {
          console.error("❌ Prevention check failed:", error);
          process.exit(1);
        });
      break;

    case "install-hooks":
      system.installPreventionHooks().catch((error) => {
        console.error("❌ Hook installation failed:", error);
        process.exit(1);
      });
      break;

    default:
      console.log(
        "Usage: tsx workflow-prevention-system.ts <check|install-hooks>",
      );
      process.exit(1);
  }
}

export default WorkflowPreventionSystem;
