#!/usr/bin/env tsx

/**
 * Audit Trigger Detection System
 * Determines when refactor audit should be executed automatically
 */

import { execSync } from "child_process";
import { readFileSync, existsSync, statSync } from "fs";
import { RefactorAuditor } from "./refactor-auditor.js";

interface TriggerCondition {
  name: string;
  triggered: boolean;
  reason: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

class AuditTriggerDetector {
  private conditions: TriggerCondition[] = [];

  async detectTriggers(): Promise<{
    shouldRun: boolean;
    conditions: TriggerCondition[];
  }> {
    console.log("🔍 Detecting audit trigger conditions...");

    await this.checkArchitecturalChanges();
    await this.checkTestFailureRates();
    await this.checkDependencyUpdates();
    await this.checkScheduledMaintenance();
    await this.checkPreReleaseState();
    await this.checkSystemHealth();

    const highPriorityTriggers = this.conditions.filter(
      (c) => c.triggered && c.priority === "HIGH",
    );
    const shouldRun =
      highPriorityTriggers.length > 0 ||
      this.conditions.filter((c) => c.triggered).length >= 2;

    return { shouldRun, conditions: this.conditions };
  }

  private async checkArchitecturalChanges(): Promise<void> {
    try {
      // Check recent commits for architectural changes
      const recentCommits = execSync("git log --oneline -10", {
        encoding: "utf-8",
      });
      const architecturalKeywords = [
        "refactor",
        "restructure",
        "reorganize",
        "architect",
        "agent",
        "orchestrat",
        "workflow",
        "routing",
        "schema",
      ];

      const hasArchChanges = architecturalKeywords.some((keyword) =>
        recentCommits.toLowerCase().includes(keyword),
      );

      if (hasArchChanges) {
        this.addCondition({
          name: "Architectural Changes",
          triggered: true,
          reason: "Recent commits contain architectural modifications",
          priority: "HIGH",
        });
      }

      // Check for new/modified agent files
      const agentFiles = execSync(
        "find src/agents -name '*.ts' -mtime -7 2>/dev/null || true",
        { encoding: "utf-8" },
      );
      if (agentFiles.trim().length > 0) {
        this.addCondition({
          name: "Agent Modifications",
          triggered: true,
          reason: "Agent files modified in last 7 days",
          priority: "MEDIUM",
        });
      }
    } catch (error) {
      console.warn("Could not check architectural changes:", error);
    }
  }

  private async checkTestFailureRates(): Promise<void> {
    try {
      // Run quick test to check failure rate
      const testResult = execSync("npm run test 2>&1", { encoding: "utf-8" });
      const failureMatch = testResult.match(/(\\d+) failed/);
      const passMatch = testResult.match(/(\\d+) passed/);

      if (failureMatch && passMatch) {
        const failed = parseInt(failureMatch[1]);
        const passed = parseInt(passMatch[1]);
        const total = failed + passed;
        const failureRate = (failed / total) * 100;

        if (failureRate > 10) {
          this.addCondition({
            name: "High Test Failure Rate",
            triggered: true,
            reason: `${failureRate.toFixed(1)}% test failure rate (>${10}%)`,
            priority: "HIGH",
          });
        }
      }
    } catch (error) {
      // Test failures might be expected, so don't fail completely
      this.addCondition({
        name: "Test Execution Issues",
        triggered: true,
        reason: "Could not execute tests successfully",
        priority: "MEDIUM",
      });
    }
  }

  private async checkDependencyUpdates(): Promise<void> {
    try {
      const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
      const lockFile = existsSync("package-lock.json")
        ? "package-lock.json"
        : "yarn.lock";

      if (existsSync(lockFile)) {
        const lockStats = statSync(lockFile);
        const packageStats = statSync("package.json");

        // If package.json is newer than lock file, dependencies were updated
        if (packageStats.mtime > lockStats.mtime) {
          this.addCondition({
            name: "Dependency Updates",
            triggered: true,
            reason: "package.json modified after lock file",
            priority: "MEDIUM",
          });
        }
      }

      // Check for critical dependency updates
      const criticalDeps = ["@anthropic-ai/sdk", "typescript", "tsx", "vitest"];
      const hasUpdates = execSync(
        "npm outdated --json 2>/dev/null || echo '{}'",
        { encoding: "utf-8" },
      );
      const outdated = JSON.parse(hasUpdates);

      const criticalOutdated = Object.keys(outdated).filter((dep) =>
        criticalDeps.includes(dep),
      );
      if (criticalOutdated.length > 0) {
        this.addCondition({
          name: "Critical Dependencies Outdated",
          triggered: true,
          reason: `Critical dependencies need updates: ${criticalOutdated.join(
            ", ",
          )}`,
          priority: "MEDIUM",
        });
      }
    } catch (error) {
      console.warn("Could not check dependency updates:", error);
    }
  }

  private async checkScheduledMaintenance(): Promise<void> {
    try {
      const lastAuditFile = ".last-audit";
      if (existsSync(lastAuditFile)) {
        const lastAudit = statSync(lastAuditFile);
        const daysSinceAudit =
          (Date.now() - lastAudit.mtime.getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceAudit > 7) {
          this.addCondition({
            name: "Scheduled Maintenance",
            triggered: true,
            reason: `${Math.floor(daysSinceAudit)} days since last audit`,
            priority: "LOW",
          });
        }
      } else {
        this.addCondition({
          name: "Never Audited",
          triggered: true,
          reason: "No previous audit record found",
          priority: "MEDIUM",
        });
      }
    } catch (error) {
      console.warn("Could not check maintenance schedule:", error);
    }
  }

  private async checkPreReleaseState(): Promise<void> {
    try {
      // Check if we're about to ship
      const recentCommits = execSync("git log --oneline -5", {
        encoding: "utf-8",
      });
      const shipKeywords = ["ship", "release", "deploy", "publish"];

      const isPreShip = shipKeywords.some((keyword) =>
        recentCommits.toLowerCase().includes(keyword),
      );

      if (isPreShip) {
        this.addCondition({
          name: "Pre-Release State",
          triggered: true,
          reason: "Recent commits suggest upcoming release",
          priority: "HIGH",
        });
      }

      // Check package.json version vs git tags
      const packageJson = JSON.parse(readFileSync("package.json", "utf-8"));
      const currentVersion = packageJson.version;

      try {
        const latestTag = execSync("git describe --tags --abbrev=0", {
          encoding: "utf-8",
        }).trim();
        const tagVersion = latestTag.replace("v", "");

        if (currentVersion !== tagVersion) {
          this.addCondition({
            name: "Version Mismatch",
            triggered: true,
            reason: `Package version (${currentVersion}) differs from git tag (${tagVersion})`,
            priority: "MEDIUM",
          });
        }
      } catch {
        // No tags exist yet, that's okay
      }
    } catch (error) {
      console.warn("Could not check pre-release state:", error);
    }
  }

  private async checkSystemHealth(): Promise<void> {
    try {
      // Check for error patterns in logs
      const logFiles = execSync(
        "find logs -name '*.jsonl' -mtime -1 2>/dev/null || true",
        { encoding: "utf-8" },
      );
      if (logFiles.trim().length > 0) {
        const recentLogs = logFiles.split("\\n").filter((f) => f.trim());
        let errorCount = 0;

        for (const logFile of recentLogs.slice(0, 3)) {
          // Check last 3 log files
          try {
            const content = readFileSync(logFile.trim(), "utf-8");
            const lines = content.split("\\n").filter((l) => l.trim());
            const errors = lines.filter((line) => {
              try {
                const log = JSON.parse(line);
                return log.level === "error" || log.level === 50; // pino error level
              } catch {
                return false;
              }
            });
            errorCount += errors.length;
          } catch {
            // Skip unreadable log files
          }
        }

        if (errorCount > 10) {
          this.addCondition({
            name: "High Error Rate",
            triggered: true,
            reason: `${errorCount} errors in recent logs`,
            priority: "HIGH",
          });
        }
      }

      // Check CircuitBreaker state
      const sourceFiles = execSync("find src -name '*.ts' | head -10", {
        encoding: "utf-8",
      });
      let circuitBreakerIssues = 0;

      for (const file of sourceFiles.split("\\n").filter((f) => f.trim())) {
        try {
          const content = readFileSync(file.trim(), "utf-8");
          if (
            content.includes("CircuitState.OPEN") ||
            content.includes("circuit.*open")
          ) {
            circuitBreakerIssues++;
          }
        } catch {
          // Skip unreadable files
        }
      }

      if (circuitBreakerIssues > 0) {
        this.addCondition({
          name: "Circuit Breaker Issues",
          triggered: true,
          reason: `Potential circuit breaker problems in ${circuitBreakerIssues} files`,
          priority: "MEDIUM",
        });
      }
    } catch (error) {
      console.warn("Could not check system health:", error);
    }
  }

  private addCondition(condition: TriggerCondition): void {
    this.conditions.push(condition);
  }

  async executeAuditIfNeeded(): Promise<void> {
    const { shouldRun, conditions } = await this.detectTriggers();

    console.log("\\n" + "=".repeat(60));
    console.log("🎯 AUDIT TRIGGER ANALYSIS");
    console.log("=".repeat(60));

    console.log(`\\nConditions checked: ${conditions.length}`);
    console.log(
      `Triggered conditions: ${conditions.filter((c) => c.triggered).length}`,
    );

    const triggeredConditions = conditions.filter((c) => c.triggered);
    if (triggeredConditions.length > 0) {
      console.log("\\n🔥 TRIGGERED CONDITIONS:");
      for (const condition of triggeredConditions) {
        console.log(
          `  [${condition.priority}] ${condition.name}: ${condition.reason}`,
        );
      }
    }

    if (shouldRun) {
      console.log("\\n✅ EXECUTING AUTOMATIC AUDIT");
      console.log("=".repeat(60));

      // Determine audit level based on priority
      const hasHighPriority = triggeredConditions.some(
        (c) => c.priority === "HIGH",
      );
      const auditLevel = hasHighPriority ? "P1" : "ALL";

      const auditor = new RefactorAuditor({
        priority: auditLevel as any,
        verbose: hasHighPriority,
        autoFix: false,
      });

      await auditor.runAudit();

      // Update audit timestamp
      execSync("touch .last-audit");

      console.log("\\n🎯 AUTO-AUDIT COMPLETE");
    } else {
      console.log("\\n✅ No audit needed at this time");
      console.log("System appears healthy and stable");
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const detector = new AuditTriggerDetector();

  if (args.includes("--detect-only")) {
    const { shouldRun, conditions } = await detector.detectTriggers();
    console.log(JSON.stringify({ shouldRun, conditions }, null, 2));
  } else {
    await detector.executeAuditIfNeeded();
  }
}

// ES module compatibility
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { AuditTriggerDetector };
