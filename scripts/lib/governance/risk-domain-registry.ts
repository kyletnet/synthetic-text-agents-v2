/**
 * Risk Domain Registry - Track high-risk code areas
 *
 * Purpose:
 * - Identify high-risk code domains
 * - Warn before modifying critical areas
 * - Require approval for risky changes
 *
 * Design:
 * - Configurable via governance-rules.json
 * - Pattern-based matching
 * - Severity-based warnings
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import type { GovernanceRulesConfig, RiskDomain, Severity } from "./governance-types.js";

export interface RiskAssessment {
  path: string;
  risk: RiskDomain | null;
  requiresApproval: boolean;
}

export class RiskDomainRegistry {
  private projectRoot: string;
  private rules: GovernanceRulesConfig | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Check if operation touches risk domains
   */
  async check(context: { name: string }): Promise<void> {
    console.log(`   ⚠️  Risk domain check...`);

    const changedFiles = this.getChangedFiles();
    const risks = this.assessRisks(changedFiles);

    if (risks.length === 0) {
      console.log("      ✓ No risk domains affected");
      return;
    }

    // Display warnings
    console.log(`      ⚠️  ${risks.length} risk domain(s) affected:\n`);

    for (const risk of risks) {
      if (risk.risk) {
        console.log(`      ${this.getSeverityIcon(risk.risk.severity)} ${risk.path}`);
        console.log(`         ${risk.risk.reason}`);

        if (risk.requiresApproval) {
          console.log(`         ⚠️  Requires manual approval`);
        }
      }
    }

    console.log("");
  }

  /**
   * Assess risks for files
   */
  assessRisks(filePaths: string[]): RiskAssessment[] {
    const rules = this.loadRules();
    const assessments: RiskAssessment[] = [];

    for (const filePath of filePaths) {
      const risk = this.getRiskForPath(filePath);
      assessments.push({
        path: filePath,
        risk,
        requiresApproval: risk?.requiresApproval || false,
      });
    }

    return assessments.filter((a) => a.risk !== null);
  }

  /**
   * Get risk domain for specific path
   */
  getRiskForPath(filePath: string): RiskDomain | null {
    const rules = this.loadRules();

    for (const risk of rules.riskDomains) {
      if (this.matchesPattern(filePath, risk.path)) {
        return risk;
      }
    }

    return null;
  }

  /**
   * Check if any risk domains require approval
   */
  requiresApproval(filePaths: string[]): boolean {
    const risks = this.assessRisks(filePaths);
    return risks.some((r) => r.requiresApproval);
  }

  /**
   * Get all risk domains
   */
  getAllRiskDomains(): RiskDomain[] {
    const rules = this.loadRules();
    return rules.riskDomains;
  }

  /**
   * Add risk domain
   */
  addRiskDomain(risk: RiskDomain): void {
    const rules = this.loadRules();

    // Check if already exists
    const exists = rules.riskDomains.some((r) => r.path === risk.path);
    if (exists) {
      console.warn(`⚠️  Risk domain already exists: ${risk.path}`);
      return;
    }

    rules.riskDomains.push(risk);
    this.saveRules(rules);

    console.log(`✅ Added risk domain: ${risk.path}`);
  }

  /**
   * Remove risk domain
   */
  removeRiskDomain(path: string): void {
    const rules = this.loadRules();

    const index = rules.riskDomains.findIndex((r) => r.path === path);
    if (index === -1) {
      console.warn(`⚠️  Risk domain not found: ${path}`);
      return;
    }

    rules.riskDomains.splice(index, 1);
    this.saveRules(rules);

    console.log(`✅ Removed risk domain: ${path}`);
  }

  /**
   * Get changed files from git
   */
  private getChangedFiles(): string[] {
    try {
      const output = execSync("git diff --name-only HEAD", {
        encoding: "utf8",
        cwd: this.projectRoot,
      });

      return output.trim().split("\n").filter(Boolean);
    } catch {
      // Not a git repo or no changes
      return [];
    }
  }

  /**
   * Check if path matches pattern
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Simple glob pattern matching
    const regex = new RegExp(
      "^" + pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$",
    );
    return regex.test(path);
  }

  /**
   * Get severity icon
   */
  private getSeverityIcon(severity: Severity): string {
    const icons = {
      critical: "🔴",
      high: "🟡",
      medium: "🟠",
      low: "🔵",
    };
    return icons[severity] || "⚪";
  }

  /**
   * Load governance rules
   */
  private loadRules(): GovernanceRulesConfig {
    if (this.rules) return this.rules;

    const rulesPath = join(this.projectRoot, "governance-rules.json");
    if (!existsSync(rulesPath)) {
      throw new Error(
        `governance-rules.json not found at ${rulesPath}`,
      );
    }

    const content = readFileSync(rulesPath, "utf8");
    this.rules = JSON.parse(content) as GovernanceRulesConfig;
    return this.rules;
  }

  /**
   * Save governance rules
   */
  private saveRules(rules: GovernanceRulesConfig): void {
    const rulesPath = join(this.projectRoot, "governance-rules.json");
    const content = JSON.stringify(rules, null, 2);

    // Import at usage time to avoid circular dependency
    const { writeFileSync } = require("fs");
    writeFileSync(rulesPath, content, "utf8");

    this.rules = rules;
  }

  /**
   * Display risk domain summary
   */
  displaySummary(): void {
    const rules = this.loadRules();

    console.log("\n📊 Risk Domain Registry:");
    console.log(`   Total domains: ${rules.riskDomains.length}\n`);

    const bySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const risk of rules.riskDomains) {
      bySeverity[risk.severity]++;
    }

    console.log("   By severity:");
    console.log(`      🔴 Critical: ${bySeverity.critical}`);
    console.log(`      🟡 High: ${bySeverity.high}`);
    console.log(`      🟠 Medium: ${bySeverity.medium}`);
    console.log(`      🔵 Low: ${bySeverity.low}\n`);

    console.log("   Top risk domains:");
    rules.riskDomains
      .filter((r) => r.severity === "critical" || r.severity === "high")
      .slice(0, 5)
      .forEach((risk, i) => {
        console.log(`      ${i + 1}. ${this.getSeverityIcon(risk.severity)} ${risk.path}`);
        console.log(`         ${risk.reason}`);
      });

    console.log("");
  }
}

/**
 * Global singleton instance
 */
let globalRiskDomainRegistry: RiskDomainRegistry | null = null;

export function getRiskDomainRegistry(
  projectRoot?: string,
): RiskDomainRegistry {
  if (!globalRiskDomainRegistry) {
    globalRiskDomainRegistry = new RiskDomainRegistry(projectRoot);
  }
  return globalRiskDomainRegistry;
}
