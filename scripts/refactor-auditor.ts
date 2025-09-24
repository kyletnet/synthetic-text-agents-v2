#!/usr/bin/env tsx

/**
 * 10-Point Structural and Operational Refactoring Auditor
 * Performs prioritized analysis of system structural integrity
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { glob } from "glob";

interface AuditFinding {
  category: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  severity: "P0" | "P1" | "P2";
  title: string;
  description: string;
  files: string[];
  impact: string;
  recommendation: string;
}

interface AuditConfig {
  priority: "P1" | "P2" | "P3" | "ALL";
  verbose: boolean;
  autoFix: boolean;
}

class RefactorAuditor {
  private findings: AuditFinding[] = [];
  private config: AuditConfig;
  private rootDir: string;

  constructor(config: AuditConfig) {
    this.config = config;
    this.rootDir = process.cwd();
  }

  async runAudit(): Promise<AuditFinding[]> {
    console.log(`🔍 Starting Refactor Audit (Priority: ${this.config.priority})`);

    if (this.config.priority === "P1" || this.config.priority === "ALL") {
      await this.auditP1Critical();
    }

    if (this.config.priority === "P2" || this.config.priority === "ALL") {
      await this.auditP2Core();
    }

    if (this.config.priority === "P3" || this.config.priority === "ALL") {
      await this.auditP3Maintainability();
    }

    this.generateReport();
    return this.findings;
  }

  private async auditP1Critical(): Promise<void> {
    console.log("🚨 Priority 1: Critical for LLM-Powered QA Systems");

    // 1. Execution Flow Consistency
    await this.checkExecutionFlowConsistency();

    // 2. Schema Structure Validation
    await this.validateSchemaStructures();

    // 3. LLM Input/Context Flow Alignment
    await this.checkLLMFlowAlignment();

    // 4. Runtime Guardrails
    await this.checkRuntimeGuardrails();
  }

  private async auditP2Core(): Promise<void> {
    console.log("⚠️ Priority 2: Core Structure and Developer Trust");

    // 5. Import/Export and Type Consistency
    await this.checkImportExportConsistency();

    // 6. Routing and Directory Integrity
    await this.checkRoutingIntegrity();

    // 7. Slash Command to Execution Mapping
    await this.validateSlashCommandMappings();
  }

  private async auditP3Maintainability(): Promise<void> {
    console.log("📋 Priority 3: Long-Term Maintainability");

    // 8. Naming and Cognitive Clarity
    await this.checkNamingClarity();

    // 9. Report Format and Output Quality
    await this.validateReportFormats();

    // 10. Release Safety and Changelog Integrity
    await this.checkReleaseSafety();
  }

  private async checkExecutionFlowConsistency(): Promise<void> {
    const slashCommands = this.findSlashCommands();
    const cliScripts = this.findCLIScripts();
    const apiRoutes = this.findAPIRoutes();

    // Check if all entry points invoke same core logic
    const coreInvocations = new Set<string>();

    for (const file of [...slashCommands, ...cliScripts, ...apiRoutes]) {
      const content = this.safeReadFile(file);
      if (content) {
        if (content.includes("runCouncil")) coreInvocations.add("runCouncil");
        if (content.includes("baseline")) coreInvocations.add("baseline");
        if (content.includes("processRequest")) coreInvocations.add("processRequest");
      }
    }

    if (coreInvocations.size === 0) {
      this.addFinding({
        category: "Execution Flow",
        priority: "HIGH",
        severity: "P0",
        title: "No Core Logic Invocations Found",
        description: "Entry points don't seem to invoke consistent core orchestration logic",
        files: [...slashCommands, ...cliScripts, ...apiRoutes],
        impact: "System may have divergent execution paths leading to inconsistent behavior",
        recommendation: "Ensure all entry points call standardized orchestration functions (runCouncil, processRequest)"
      });
    }
  }

  private async validateSchemaStructures(): Promise<void> {
    const configFiles = [
      "baseline_config.json",
      "baseline_report.jsonl",
      "package.json"
    ];

    const typeFiles = glob.sync("**/*.ts", {
      cwd: this.rootDir,
      ignore: ["node_modules/**", "dist/**"]
    });

    let schemaIssues = 0;

    for (const configFile of configFiles) {
      const path = join(this.rootDir, configFile);
      if (existsSync(path)) {
        try {
          const content = readFileSync(path, "utf-8");
          JSON.parse(content);
        } catch (error) {
          schemaIssues++;
          this.addFinding({
            category: "Schema Validation",
            priority: "HIGH",
            severity: "P1",
            title: `Invalid JSON Schema: ${configFile}`,
            description: `Configuration file contains invalid JSON: ${error}`,
            files: [path],
            impact: "System configuration may fail at runtime",
            recommendation: "Fix JSON syntax and validate against expected schema"
          });
        }
      }
    }
  }

  private async checkLLMFlowAlignment(): Promise<void> {
    const agentFiles = glob.sync("src/agents/**/*.ts", { cwd: this.rootDir });
    const promptFiles = glob.sync("**/*prompt*.ts", { cwd: this.rootDir, ignore: ["node_modules/**"] });

    let inconsistentFlows = 0;

    for (const agentFile of agentFiles) {
      const content = this.safeReadFile(agentFile);
      if (content && !content.includes("BaseAgent") && !content.includes("mock")) {
        inconsistentFlows++;
      }
    }

    if (inconsistentFlows > 0) {
      this.addFinding({
        category: "LLM Flow Alignment",
        priority: "HIGH",
        severity: "P1",
        title: "Inconsistent Agent Implementation",
        description: `${inconsistentFlows} agents don't extend BaseAgent or implement consistent patterns`,
        files: agentFiles,
        impact: "Agent coordination and context flow may be unpredictable",
        recommendation: "Ensure all agents extend BaseAgent and follow consistent prompt/context patterns"
      });
    }
  }

  private async checkRuntimeGuardrails(): Promise<void> {
    const sourceFiles = glob.sync("src/**/*.ts", {
      cwd: this.rootDir,
      ignore: ["**/*.test.ts", "**/*.spec.ts"]
    });

    let guardrailCoverage = 0;
    const totalFiles = sourceFiles.length;

    for (const file of sourceFiles) {
      const content = this.safeReadFile(file);
      if (content) {
        const hasErrorBoundary = content.includes("try") && content.includes("catch");
        const hasCircuitBreaker = content.includes("CircuitBreaker") || content.includes("circuit");
        const hasFallback = content.includes("fallback") || content.includes("mock");
        const hasTimeout = content.includes("timeout") || content.includes("setTimeout");

        if (hasErrorBoundary || hasCircuitBreaker || hasFallback || hasTimeout) {
          guardrailCoverage++;
        }
      }
    }

    const coveragePercent = (guardrailCoverage / totalFiles) * 100;

    if (coveragePercent < 30) {
      this.addFinding({
        category: "Runtime Guardrails",
        priority: "HIGH",
        severity: "P0",
        title: "Insufficient Runtime Protection",
        description: `Only ${coveragePercent.toFixed(1)}% of source files have runtime protection mechanisms`,
        files: sourceFiles.filter(f => !this.safeReadFile(f)?.includes("try")),
        impact: "System vulnerable to cascading failures and poor user experience",
        recommendation: "Add error boundaries, circuit breakers, fallback logic, and timeout handling"
      });
    }
  }

  private async checkImportExportConsistency(): Promise<void> {
    const tsFiles = glob.sync("src/**/*.ts", { cwd: this.rootDir });
    const duplicateExports = new Map<string, string[]>();
    const unusedImports = [];

    for (const file of tsFiles) {
      const content = this.safeReadFile(file);
      if (content) {
        // Check for duplicate type definitions
        const exportMatches = content.match(/export\\s+(interface|type|class)\\s+(\\w+)/g);
        if (exportMatches) {
          for (const match of exportMatches) {
            const name = match.split(/\\s+/)[2];
            if (!duplicateExports.has(name)) {
              duplicateExports.set(name, []);
            }
            duplicateExports.get(name)?.push(file);
          }
        }

        // Simple unused import detection
        if (content.includes("import") && !content.includes("export")) {
          const importLines = content.split("\\n").filter(line => line.trim().startsWith("import"));
          for (const importLine of importLines) {
            const importName = importLine.match(/import\\s+{([^}]+)}/)?.[1];
            if (importName && !content.includes(importName.trim())) {
              unusedImports.push({ file, import: importLine });
            }
          }
        }
      }
    }

    // Report duplicates
    for (const [name, files] of duplicateExports) {
      if (files.length > 1) {
        this.addFinding({
          category: "Import/Export Consistency",
          priority: "MEDIUM",
          severity: "P2",
          title: `Duplicate Export: ${name}`,
          description: `Type/interface "${name}" is exported from multiple files`,
          files,
          impact: "Type conflicts and build issues",
          recommendation: "Consolidate duplicate exports into shared types file"
        });
      }
    }
  }

  private async checkRoutingIntegrity(): Promise<void> {
    const appRoutes = glob.sync("apps/**/app/**/*.ts", { cwd: this.rootDir });
    const pageRoutes = glob.sync("apps/**/pages/**/*.ts", { cwd: this.rootDir });

    // Check for conflicting routes
    const routeConflicts = [];

    if (appRoutes.length > 0 && pageRoutes.length > 0) {
      this.addFinding({
        category: "Routing Integrity",
        priority: "MEDIUM",
        severity: "P2",
        title: "Mixed Routing Patterns",
        description: "Both app/ and pages/ directories exist, which may cause routing conflicts",
        files: [...appRoutes, ...pageRoutes],
        impact: "Unpredictable routing behavior and potential conflicts",
        recommendation: "Choose single routing pattern (app/ or pages/) and migrate accordingly"
      });
    }
  }

  private async validateSlashCommandMappings(): Promise<void> {
    const slashCommands = this.findSlashCommands();
    const packageJson = this.safeReadFile("package.json");

    if (!packageJson) return;

    const scripts = JSON.parse(packageJson).scripts || {};
    const unmappedCommands = [];

    for (const cmdFile of slashCommands) {
      const cmdName = cmdFile.split("/").pop()?.replace(".md", "");
      const hasScript = Object.keys(scripts).some(script =>
        script.includes(cmdName || "") || scripts[script].includes(cmdName || "")
      );

      if (!hasScript) {
        unmappedCommands.push(cmdFile);
      }
    }

    if (unmappedCommands.length > 0) {
      this.addFinding({
        category: "Slash Command Mapping",
        priority: "MEDIUM",
        severity: "P2",
        title: "Unmapped Slash Commands",
        description: `${unmappedCommands.length} slash commands don't have corresponding npm scripts`,
        files: unmappedCommands,
        impact: "Commands may not execute or have inconsistent behavior",
        recommendation: "Add corresponding npm scripts in package.json for all slash commands"
      });
    }
  }

  private async checkNamingClarity(): Promise<void> {
    const sourceFiles = glob.sync("src/**/*.ts", { cwd: this.rootDir });
    const ambiguousNames = [];

    const ambiguousPatterns = [
      /Agent\\w*Runner/,
      /Agent\\w*Coordinator/,
      /\\w*Manager\\w*/,
      /\\w*Handler\\w*/,
      /\\w*Helper\\w*/,
      /\\w*Util\\w*/
    ];

    for (const file of sourceFiles) {
      const filename = file.split("/").pop() || "";
      for (const pattern of ambiguousPatterns) {
        if (pattern.test(filename)) {
          ambiguousNames.push(file);
          break;
        }
      }
    }

    if (ambiguousNames.length > 0) {
      this.addFinding({
        category: "Naming Clarity",
        priority: "LOW",
        severity: "P2",
        title: "Ambiguous Module Names",
        description: `${ambiguousNames.length} modules have ambiguous or unclear names`,
        files: ambiguousNames,
        impact: "Reduced developer productivity and cognitive overhead",
        recommendation: "Use more specific, responsibility-clear naming conventions"
      });
    }
  }

  private async validateReportFormats(): Promise<void> {
    const reportFiles = glob.sync("reports/**/*.jsonl", { cwd: this.rootDir });
    const invalidReports = [];

    for (const reportFile of reportFiles) {
      const content = this.safeReadFile(reportFile);
      if (content) {
        const lines = content.split("\\n").filter(line => line.trim());
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            // Check for expected keys in reports
            if (!obj.timestamp && !obj.run_id && !obj.evidence) {
              invalidReports.push(reportFile);
              break;
            }
          } catch {
            invalidReports.push(reportFile);
            break;
          }
        }
      }
    }

    if (invalidReports.length > 0) {
      this.addFinding({
        category: "Report Format",
        priority: "MEDIUM",
        severity: "P2",
        title: "Invalid Report Formats",
        description: `${invalidReports.length} report files don't follow expected JSONL format`,
        files: invalidReports,
        impact: "Analysis tools may fail to process reports correctly",
        recommendation: "Ensure all reports follow structured JSONL format with required keys"
      });
    }
  }

  private async checkReleaseSafety(): Promise<void> {
    const ciFiles = glob.sync(".github/workflows/**/*.yml", { cwd: this.rootDir });
    const hasPreCommitHooks = existsSync(join(this.rootDir, ".husky"));
    const packageJson = this.safeReadFile("package.json");

    let safetyIssues = 0;

    if (!hasPreCommitHooks) {
      safetyIssues++;
    }

    if (packageJson) {
      const scripts = JSON.parse(packageJson).scripts || {};
      const hasPreflight = Object.keys(scripts).some(s => s.includes("preflight") || s.includes("ship"));
      if (!hasPreflight) {
        safetyIssues++;
      }
    }

    if (safetyIssues > 0) {
      this.addFinding({
        category: "Release Safety",
        priority: "MEDIUM",
        severity: "P1",
        title: "Insufficient Release Safety",
        description: `Missing ${safetyIssues} critical safety mechanisms`,
        files: [...ciFiles, "package.json"],
        impact: "Increased risk of releasing broken or unsafe code",
        recommendation: "Add pre-commit hooks, preflight checks, and automated safety validations"
      });
    }
  }

  // Helper methods
  private findSlashCommands(): string[] {
    return glob.sync(".claude/commands/*.md", { cwd: this.rootDir });
  }

  private findCLIScripts(): string[] {
    return glob.sync("src/cli/**/*.ts", { cwd: this.rootDir });
  }

  private findAPIRoutes(): string[] {
    return glob.sync("apps/**/api/**/*.ts", { cwd: this.rootDir });
  }

  private safeReadFile(filePath: string): string | null {
    try {
      const fullPath = filePath.startsWith("/") ? filePath : join(this.rootDir, filePath);
      return readFileSync(fullPath, "utf-8");
    } catch {
      return null;
    }
  }

  private addFinding(finding: AuditFinding): void {
    this.findings.push(finding);
  }

  private generateReport(): void {
    const highPriority = this.findings.filter(f => f.priority === "HIGH");
    const mediumPriority = this.findings.filter(f => f.priority === "MEDIUM");
    const lowPriority = this.findings.filter(f => f.priority === "LOW");

    console.log("\\n" + "=".repeat(80));
    console.log("🔍 REFACTOR AUDIT RESULTS");
    console.log("=".repeat(80));

    console.log(`\\n📊 Summary: ${this.findings.length} findings`);
    console.log(`   🚨 High Priority: ${highPriority.length}`);
    console.log(`   ⚠️  Medium Priority: ${mediumPriority.length}`);
    console.log(`   📋 Low Priority: ${lowPriority.length}`);

    if (highPriority.length > 0) {
      console.log("\\n🚨 HIGH PRIORITY FINDINGS:");
      console.log("-".repeat(50));
      for (const finding of highPriority) {
        console.log(`\\n[${finding.severity}] ${finding.title}`);
        console.log(`Category: ${finding.category}`);
        console.log(`Impact: ${finding.impact}`);
        console.log(`Recommendation: ${finding.recommendation}`);
        if (this.config.verbose) {
          console.log(`Files: ${finding.files.slice(0, 3).join(", ")}${finding.files.length > 3 ? "..." : ""}`);
        }
      }
    }

    if (mediumPriority.length > 0 && this.config.verbose) {
      console.log("\\n⚠️ MEDIUM PRIORITY FINDINGS:");
      console.log("-".repeat(50));
      for (const finding of mediumPriority) {
        console.log(`\\n[${finding.severity}] ${finding.title}`);
        console.log(`Recommendation: ${finding.recommendation}`);
      }
    }

    console.log("\\n" + "=".repeat(80));

    // Auto-trigger conditions
    const shouldTriggerShip = highPriority.length === 0 && mediumPriority.length < 3;
    if (shouldTriggerShip) {
      console.log("✅ System health is good - ready for ship process");
    } else {
      console.log("⚠️ Consider addressing findings before major releases");
    }
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const priority = (args[0] as "P1" | "P2" | "P3") || "ALL";
  const verbose = args.includes("--verbose");
  const autoFix = args.includes("--auto-fix");

  const auditor = new RefactorAuditor({ priority, verbose, autoFix });
  const findings = await auditor.runAudit();

  // Exit with error code if high priority findings exist
  const highPriorityCount = findings.filter(f => f.priority === "HIGH").length;
  process.exit(highPriorityCount > 0 ? 1 : 0);
}

// ES module compatibility
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RefactorAuditor };
export type { AuditFinding, AuditConfig };