/**
 * Audit Orchestrator - Application Layer
 * Orchestrates the refactoring audit workflow using Command Pattern
 */

import type { Issue } from "../../domain/refactoring/issue-detector.js";
import type { Suggestion } from "../../domain/refactoring/suggestion-generator.js";
import * as CodeAnalyzer from "../../domain/refactoring/code-analyzer.js";
import * as IssueDetector from "../../domain/refactoring/issue-detector.js";
import * as SuggestionGenerator from "../../domain/refactoring/suggestion-generator.js";
import * as FileScanner from "../../infrastructure/refactoring/file-scanner.js";

export interface AuditConfig {
  priority: "P1" | "P2" | "P3" | "ALL";
  verbose: boolean;
  autoFix: boolean;
  rootDir?: string;
}

export interface AuditResult {
  findings: Issue[];
  suggestions: Suggestion[];
  summary: AuditSummary;
  metadata: AuditMetadata;
}

export interface AuditSummary {
  totalFindings: number;
  highPriority: number;
  mediumPriority: number;
  lowPriority: number;
  autoFixable: number;
  categoryCounts: Record<string, number>;
}

export interface AuditMetadata {
  duration: number;
  filesScanned: number;
  timestamp: Date;
  config: AuditConfig;
}

/**
 * Command interface for audit operations
 */
export interface AuditCommand {
  execute(): Promise<Issue[]>;
  getPriority(): "P1" | "P2" | "P3";
  getCategory(): string;
}

/**
 * Base class for audit commands
 */
abstract class BaseAuditCommand implements AuditCommand {
  constructor(
    protected rootDir: string,
    protected fileCache: FileScanner.FileContentCache,
  ) {}

  abstract execute(): Promise<Issue[]>;
  abstract getPriority(): "P1" | "P2" | "P3";
  abstract getCategory(): string;

  protected readFiles(files: string[]): Map<string, string> {
    const contents = new Map<string, string>();
    for (const file of files) {
      const content = this.fileCache.getOrRead(file);
      if (content) {
        contents.set(file, content);
      }
    }
    return contents;
  }
}

/**
 * P1: TypeScript Compilation Check
 */
class TypeScriptCompilationCommand extends BaseAuditCommand {
  getPriority() {
    return "P1" as const;
  }
  getCategory() {
    return "TypeScript Compilation";
  }

  async execute(): Promise<Issue[]> {
    const issues: Issue[] = [];

    try {
      const { execSync } = await import("child_process");
      execSync("npx tsc --noEmit --pretty false", {
        encoding: "utf8",
        stdio: "pipe",
        cwd: this.rootDir,
      });
    } catch (error: any) {
      const output = error.stdout || error.stderr || "";
      const errorLines = output
        .split("\n")
        .filter(
          (line: string) => line.includes("error TS") && line.trim().length > 0,
        );

      if (errorLines.length > 0) {
        const errorsByFile: Record<string, string[]> = {};
        errorLines.forEach((line: string) => {
          const match = line.match(/^([^(]+)\((\d+),(\d+)\): (.+)$/);
          if (match) {
            const [, file] = match;
            if (!errorsByFile[file]) errorsByFile[file] = [];
            errorsByFile[file].push(line);
          }
        });

        issues.push({
          category: "TypeScript Compilation",
          priority: "HIGH",
          severity: "P0",
          title: "TypeScript Compilation Errors",
          description: `${errorLines.length} compilation errors found`,
          files: Object.keys(errorsByFile),
          impact: "System cannot compile and will fail at runtime",
          recommendation:
            "Fix all TypeScript errors to ensure successful compilation",
          metadata: { errorCount: errorLines.length },
        });
      }
    }

    return issues;
  }
}

/**
 * P1: Execution Flow Consistency Check
 */
class ExecutionFlowCommand extends BaseAuditCommand {
  getPriority() {
    return "P1" as const;
  }
  getCategory() {
    return "Execution Flow";
  }

  async execute(): Promise<Issue[]> {
    const slashCommands = FileScanner.findSlashCommands(this.rootDir);
    const cliScripts = FileScanner.findCLIScripts(this.rootDir);
    const apiRoutes = FileScanner.findAPIRoutes(this.rootDir);

    const allFiles = [...slashCommands, ...cliScripts, ...apiRoutes];
    const contents = this.readFiles(allFiles);

    const flowIssue = IssueDetector.detectExecutionFlowIssues(
      { slashCommands, cliScripts, apiRoutes },
      contents,
    );

    if (flowIssue) {
      return [
        {
          category: "Execution Flow",
          priority: "HIGH",
          severity: "P0",
          title: "No Core Logic Invocations Found",
          description:
            "Entry points don't invoke consistent core orchestration logic",
          files: flowIssue.files,
          impact:
            "System may have divergent execution paths leading to inconsistent behavior",
          recommendation:
            "Ensure all entry points call standardized orchestration functions (runCouncil, processRequest)",
        },
      ];
    }

    return [];
  }
}

/**
 * P1: Schema Validation Check
 */
class SchemaValidationCommand extends BaseAuditCommand {
  getPriority() {
    return "P1" as const;
  }
  getCategory() {
    return "Schema Validation";
  }

  async execute(): Promise<Issue[]> {
    const issues: Issue[] = [];

    const configFiles = [
      {
        file: "baseline_config.json",
        required: ["run_id", "routing_path", "quality_target"],
      },
      { file: "package.json", required: ["name", "version", "scripts"] },
      { file: "tsconfig.json", required: ["compilerOptions", "include"] },
    ];

    const contents = this.readFiles(configFiles.map((c) => c.file));
    const schemaIssues = IssueDetector.detectSchemaIssues(
      configFiles,
      contents,
    );

    for (const issue of schemaIssues) {
      if (issue.type === "missing-required-fields") {
        issues.push({
          category: "Schema Validation",
          priority: "HIGH",
          severity: "P1",
          title: `Missing Required Fields: ${issue.file}`,
          description: `Required fields missing: ${issue.missing?.join(", ")}`,
          files: [issue.file],
          impact: "Application may fail to start or behave unexpectedly",
          recommendation: "Add missing required fields to configuration",
        });
      } else if (issue.type === "invalid-json") {
        issues.push({
          category: "Schema Validation",
          priority: "HIGH",
          severity: "P1",
          title: `Invalid JSON: ${issue.file}`,
          description: issue.issue || "JSON parsing failed",
          files: [issue.file],
          impact: "Configuration cannot be loaded",
          recommendation: "Fix JSON syntax errors",
        });
      }
    }

    // Check JSONL reports
    const reportFiles = FileScanner.findReportFiles(this.rootDir);
    const reportContents = this.readFiles(reportFiles);
    const jsonlIssues = IssueDetector.detectJSONLIssues(
      reportFiles,
      reportContents,
    );

    if (jsonlIssues.length > 0) {
      issues.push({
        category: "Schema Validation",
        priority: "MEDIUM",
        severity: "P2",
        title: "Invalid Report Formats",
        description: `${jsonlIssues.length} report files have structural issues`,
        files: jsonlIssues.map((i) => i.file),
        impact: "Analysis tools may fail to process reports",
        recommendation:
          "Ensure all reports follow JSONL format with required keys",
      });
    }

    // Check TypeScript interfaces
    const typeFiles = FileScanner.findTypeFiles(this.rootDir);
    const typeContents = this.readFiles(typeFiles);

    for (const [file, content] of typeContents) {
      const interfaces = CodeAnalyzer.extractAllInterfaces(content);
      const interfaceIssues = IssueDetector.detectInterfaceIssues(
        interfaces,
        file,
      );

      if (interfaceIssues.length > 0) {
        issues.push({
          category: "Schema Validation",
          priority: "MEDIUM",
          severity: "P2",
          title: "Interface Structure Issues",
          description: `${interfaceIssues.length} interface issues found`,
          files: [file],
          impact: "Type safety may be compromised",
          recommendation: "Fix interface structure issues",
        });
      }
    }

    return issues;
  }
}

/**
 * P1: LLM Flow Alignment Check
 */
class LLMFlowAlignmentCommand extends BaseAuditCommand {
  getPriority() {
    return "P1" as const;
  }
  getCategory() {
    return "LLM Flow Alignment";
  }

  async execute(): Promise<Issue[]> {
    const agentFiles = FileScanner.findAgentFiles(this.rootDir);
    const contents = this.readFiles(agentFiles);

    const issue = IssueDetector.detectLLMFlowIssues(agentFiles, contents);
    return issue ? [issue] : [];
  }
}

/**
 * P1: Runtime Guardrails Check
 */
class RuntimeGuardrailsCommand extends BaseAuditCommand {
  getPriority() {
    return "P1" as const;
  }
  getCategory() {
    return "Runtime Guardrails";
  }

  async execute(): Promise<Issue[]> {
    const sourceFiles = FileScanner.findTypeScriptFiles(this.rootDir);
    const contents = this.readFiles(sourceFiles);

    const guardrails = new Map<string, CodeAnalyzer.GuardrailInfo>();
    const criticalFiles: string[] = [];

    for (const [file, content] of contents) {
      const info = CodeAnalyzer.analyzeGuardrails(content);
      guardrails.set(file, info);

      if (CodeAnalyzer.isCriticalFile(file)) {
        criticalFiles.push(file);
      }
    }

    const guardrailIssues = IssueDetector.detectGuardrailIssues(
      guardrails,
      criticalFiles,
    );
    const issues: Issue[] = [];

    for (const issue of guardrailIssues) {
      if (issue.type === "insufficient-protection") {
        issues.push({
          category: "Runtime Guardrails",
          priority: "HIGH",
          severity: "P0",
          title: "Insufficient Runtime Protection",
          description: `Only ${issue.coverage.toFixed(
            1,
          )}% of files have runtime protection (Target: ${
            issue.targetCoverage
          }%+)`,
          files: issue.files,
          impact: "System vulnerable to cascading failures",
          recommendation:
            "Add error boundaries, circuit breakers, fallback logic, timeout handling, retry mechanisms, and input validation",
        });
      } else if (issue.type === "critical-file-vulnerable") {
        issues.push({
          category: "Runtime Guardrails",
          priority: "HIGH",
          severity: "P0",
          title: "Critical Files Lack Adequate Protection",
          description: `${issue.files.length} critical files have insufficient guardrails`,
          files: issue.files,
          impact: "Core system components vulnerable to failures",
          recommendation:
            "Critical files need multiple protection layers: error handling + timeout + validation + retry",
        });
      }
    }

    return issues;
  }
}

/**
 * P2: Import/Export Consistency Check
 */
class ImportExportConsistencyCommand extends BaseAuditCommand {
  getPriority() {
    return "P2" as const;
  }
  getCategory() {
    return "Import/Export Consistency";
  }

  async execute(): Promise<Issue[]> {
    const tsFiles = FileScanner.findTypeScriptFiles(this.rootDir);
    const contents = this.readFiles(tsFiles);

    const issues: Issue[] = [];

    // Analyze exports
    const exportsByFile = new Map<string, CodeAnalyzer.ExportInfo[]>();
    for (const [file, content] of contents) {
      const exports = CodeAnalyzer.extractExports(content);
      exportsByFile.set(file, exports);
    }

    const duplicateIssues = IssueDetector.detectDuplicateExports(exportsByFile);
    for (const issue of duplicateIssues) {
      issues.push({
        category: "Import/Export Consistency",
        priority: "MEDIUM",
        severity: "P2",
        title: `Duplicate Export: ${issue.name}`,
        description: issue.details || "Type exported from multiple files",
        files: issue.files,
        impact: "Type conflicts and build issues",
        recommendation: "Consolidate duplicate exports into shared types file",
      });
    }

    // Analyze imports and detect unused
    const unusedByFile = new Map<
      string,
      Array<{ import: string; unused: string }>
    >();
    for (const [file, content] of contents) {
      const imports = CodeAnalyzer.extractImports(content);
      const unused = CodeAnalyzer.detectUnusedImports(content, imports);
      if (unused.length > 0) {
        unusedByFile.set(file, unused);
      }
    }

    const unusedIssue = IssueDetector.detectUnusedImportIssues(unusedByFile);
    if (unusedIssue) {
      issues.push({
        category: "Import/Export Consistency",
        priority: "MEDIUM",
        severity: "P2",
        title: "Unused Imports Detected",
        description: unusedIssue.details || "Unused imports found",
        files: unusedIssue.files,
        impact: "Bundle size bloat and maintainability issues",
        recommendation: "Remove unused imports",
      });
    }

    // Detect circular imports
    const importsByFile = new Map<string, CodeAnalyzer.ImportInfo[]>();
    for (const [file, content] of contents) {
      const imports = CodeAnalyzer.extractImports(content);
      importsByFile.set(file, imports);
    }

    const circular = CodeAnalyzer.detectCircularImports(
      importsByFile,
      contents,
    );
    const circularIssue = IssueDetector.detectCircularImportIssues(circular);
    if (circularIssue) {
      issues.push({
        category: "Import/Export Consistency",
        priority: "HIGH",
        severity: "P1",
        title: "Circular Import Dependencies",
        description: circularIssue.details || "Circular imports detected",
        files: circularIssue.files,
        impact: "Build failures and runtime module loading issues",
        recommendation: "Refactor to eliminate circular dependencies",
      });
    }

    return issues;
  }
}

/**
 * P2: Method Signature Check
 */
class MethodSignatureCommand extends BaseAuditCommand {
  getPriority() {
    return "P2" as const;
  }
  getCategory() {
    return "Method Signatures";
  }

  async execute(): Promise<Issue[]> {
    const tsFiles = FileScanner.findTypeScriptFiles(this.rootDir);
    const contents = this.readFiles(tsFiles);

    const signatureIssues = IssueDetector.detectMethodSignatureIssues(contents);
    const issues: Issue[] = [];

    for (const issue of signatureIssues) {
      issues.push({
        category: "Method Signatures",
        priority: "HIGH",
        severity: "P1",
        title: `Method Signature Mismatch: ${issue.method}`,
        description: issue.details,
        files: [issue.file],
        impact: "Runtime errors and method call failures",
        recommendation: "Update method signatures to match current interface",
      });
    }

    return issues;
  }
}

/**
 * P2: Node.js Compatibility Check
 */
class NodeCompatibilityCommand extends BaseAuditCommand {
  getPriority() {
    return "P2" as const;
  }
  getCategory() {
    return "Node.js Compatibility";
  }

  async execute(): Promise<Issue[]> {
    const jsFiles = FileScanner.scanFiles({
      rootDir: this.rootDir,
      patterns: ["scripts/**/*.{ts,js}"],
    }).files;

    const contents = this.readFiles(jsFiles);
    const compatIssues = IssueDetector.detectCompatibilityIssues(contents);
    const issues: Issue[] = [];

    for (const issue of compatIssues) {
      issues.push({
        category: "Node.js Compatibility",
        priority: "MEDIUM",
        severity: "P2",
        title: `Compatibility Issue: ${issue.type}`,
        description: issue.description,
        files: [issue.file],
        impact: "Runtime errors and unstable behavior",
        recommendation: "Fix Node.js compatibility issues",
      });
    }

    return issues;
  }
}

/**
 * P3: Naming Clarity Check
 */
class NamingClarityCommand extends BaseAuditCommand {
  getPriority() {
    return "P3" as const;
  }
  getCategory() {
    return "Naming Clarity";
  }

  async execute(): Promise<Issue[]> {
    const sourceFiles = FileScanner.findTypeScriptFiles(this.rootDir);
    const ambiguous = IssueDetector.detectNamingIssues(sourceFiles);

    if (ambiguous.length > 0) {
      return [
        {
          category: "Naming Clarity",
          priority: "LOW",
          severity: "P2",
          title: "Ambiguous Module Names",
          description: `${ambiguous.length} modules have ambiguous names`,
          files: ambiguous,
          impact: "Reduced developer productivity",
          recommendation: "Use more specific, responsibility-clear naming",
        },
      ];
    }

    return [];
  }
}

/**
 * Main Audit Orchestrator
 */
export class AuditOrchestrator {
  private config: AuditConfig;
  private rootDir: string;
  private fileCache: FileScanner.FileContentCache;
  private commands: AuditCommand[] = [];

  constructor(config: AuditConfig) {
    this.config = config;
    this.rootDir = config.rootDir || process.cwd();
    this.fileCache = new FileScanner.FileContentCache(this.rootDir);
    this.initializeCommands();
  }

  private initializeCommands(): void {
    // P1 Commands
    const p1Commands = [
      new TypeScriptCompilationCommand(this.rootDir, this.fileCache),
      new ExecutionFlowCommand(this.rootDir, this.fileCache),
      new SchemaValidationCommand(this.rootDir, this.fileCache),
      new LLMFlowAlignmentCommand(this.rootDir, this.fileCache),
      new RuntimeGuardrailsCommand(this.rootDir, this.fileCache),
    ];

    // P2 Commands
    const p2Commands = [
      new ImportExportConsistencyCommand(this.rootDir, this.fileCache),
      new MethodSignatureCommand(this.rootDir, this.fileCache),
      new NodeCompatibilityCommand(this.rootDir, this.fileCache),
    ];

    // P3 Commands
    const p3Commands = [new NamingClarityCommand(this.rootDir, this.fileCache)];

    // Filter based on priority config
    if (this.config.priority === "P1" || this.config.priority === "ALL") {
      this.commands.push(...p1Commands);
    }
    if (this.config.priority === "P2" || this.config.priority === "ALL") {
      this.commands.push(...p2Commands);
    }
    if (this.config.priority === "P3" || this.config.priority === "ALL") {
      this.commands.push(...p3Commands);
    }
  }

  async runAudit(): Promise<AuditResult> {
    const startTime = Date.now();
    const allFindings: Issue[] = [];

    console.log(
      `🔍 Starting Refactor Audit (Priority: ${this.config.priority})`,
    );

    // Execute all commands
    for (const command of this.commands) {
      if (this.config.verbose) {
        console.log(`\n  Running: ${command.getCategory()}...`);
      }

      const findings = await command.execute();
      allFindings.push(...findings);

      if (this.config.verbose && findings.length > 0) {
        console.log(`    Found ${findings.length} issues`);
      }
    }

    // Generate suggestions
    const suggestions = allFindings.map((issue) =>
      SuggestionGenerator.generateSuggestions(issue),
    );

    // Build summary
    const summary = this.buildSummary(allFindings, suggestions);

    // Build metadata
    const metadata: AuditMetadata = {
      duration: Date.now() - startTime,
      filesScanned: this.fileCache.size(),
      timestamp: new Date(),
      config: this.config,
    };

    return {
      findings: allFindings,
      suggestions,
      summary,
      metadata,
    };
  }

  private buildSummary(
    findings: Issue[],
    suggestions: Suggestion[],
  ): AuditSummary {
    const categoryCounts: Record<string, number> = {};

    for (const finding of findings) {
      categoryCounts[finding.category] =
        (categoryCounts[finding.category] || 0) + 1;
    }

    return {
      totalFindings: findings.length,
      highPriority: findings.filter((f) => f.priority === "HIGH").length,
      mediumPriority: findings.filter((f) => f.priority === "MEDIUM").length,
      lowPriority: findings.filter((f) => f.priority === "LOW").length,
      autoFixable: suggestions.filter((s) => s.autoFixable).length,
      categoryCounts,
    };
  }

  printReport(result: AuditResult): void {
    console.log("\n" + "=".repeat(80));
    console.log("🔍 REFACTOR AUDIT RESULTS");
    console.log("=".repeat(80));

    console.log(`\n📊 Summary: ${result.summary.totalFindings} findings`);
    console.log(`   🚨 High Priority: ${result.summary.highPriority}`);
    console.log(`   ⚠️  Medium Priority: ${result.summary.mediumPriority}`);
    console.log(`   📋 Low Priority: ${result.summary.lowPriority}`);
    console.log(`   ✨ Auto-fixable: ${result.summary.autoFixable}`);

    if (result.summary.highPriority > 0) {
      console.log("\n🚨 HIGH PRIORITY FINDINGS:");
      console.log("-".repeat(50));

      const highPriority = result.findings.filter((f) => f.priority === "HIGH");
      for (const finding of highPriority) {
        console.log(`\n[${finding.severity}] ${finding.title}`);
        console.log(`Category: ${finding.category}`);
        console.log(`Impact: ${finding.impact}`);
        console.log(`Recommendation: ${finding.recommendation}`);
        if (this.config.verbose) {
          console.log(
            `Files: ${finding.files.slice(0, 3).join(", ")}${
              finding.files.length > 3 ? "..." : ""
            }`,
          );
        }
      }
    }

    console.log(`\n⏱️  Duration: ${result.metadata.duration}ms`);
    console.log(`📁 Files scanned: ${result.metadata.filesScanned}`);
    console.log("\n" + "=".repeat(80));
  }
}
