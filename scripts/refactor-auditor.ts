#!/usr/bin/env tsx

/**
 * 10-Point Structural and Operational Refactoring Auditor
 * Performs prioritized analysis of system structural integrity
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import { DesignPrincipleMapper } from "./lib/design-principle-mapper.js";
import { detectEnvironment } from "./lib/env-detection.js";

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
  private designPrincipleMapper: DesignPrincipleMapper;

  constructor(config: AuditConfig) {
    this.config = config;
    this.rootDir = process.cwd();
    this.designPrincipleMapper = new DesignPrincipleMapper();
  }

  async runAudit(): Promise<AuditFinding[]> {
    console.log(
      `🔍 Starting Refactor Audit (Priority: ${this.config.priority})`,
    );

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

    // 0. TypeScript Compilation Errors (자동 탐지)
    await this.checkTypeScriptCompilation();

    // 1. Execution Flow Consistency
    await this.checkExecutionFlowConsistency();

    // 2. Schema Structure Validation
    await this.validateSchemaStructures();

    // 3. LLM Input/Context Flow Alignment
    await this.checkLLMFlowAlignment();

    // 4. Runtime Guardrails
    await this.checkRuntimeGuardrails();

    // 5. Task Scheduling Logic (NEW - Phase 6 후속조치)
    await this.checkTaskSchedulingLogic();

    // 6. Interactive Approval System (NEW - Phase 6 후속조치)
    await this.checkInteractiveApprovalSystem();

    // 7. Output Visibility (NEW - Phase 6 후속조치)
    await this.checkOutputVisibility();

    // 8. Self-Healing Infinite Loop (NEW - Phase 6 후속조치)
    await this.checkSelfHealingInfiniteLoop();
  }

  private async auditP2Core(): Promise<void> {
    console.log("⚠️ Priority 2: Core Structure and Developer Trust");

    // 4.1. Method Signature Consistency (자동 탐지)
    await this.checkMethodSignatures();

    // 4.2. Node.js Compatibility Issues (자동 탐지)
    await this.checkNodeCompatibility();

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
        if (content.includes("processRequest"))
          coreInvocations.add("processRequest");
      }
    }

    if (coreInvocations.size === 0) {
      this.addFinding({
        category: "Execution Flow",
        priority: "HIGH",
        severity: "P0",
        title: "No Core Logic Invocations Found",
        description:
          "Entry points don't seem to invoke consistent core orchestration logic",
        files: [...slashCommands, ...cliScripts, ...apiRoutes],
        impact:
          "System may have divergent execution paths leading to inconsistent behavior",
        recommendation:
          "Ensure all entry points call standardized orchestration functions (runCouncil, processRequest)",
      });
    }
  }

  private async validateSchemaStructures(): Promise<void> {
    const configFiles = [
      {
        file: "baseline_config.json",
        required: ["run_id", "routing_path", "quality_target"],
      },
      { file: "package.json", required: ["name", "version", "scripts"] },
      { file: "tsconfig.json", required: ["compilerOptions", "include"] },
    ];

    const reportFiles = glob.sync("reports/**/*.jsonl", { cwd: this.rootDir });
    const typeFiles = glob.sync("src/**/*types*.ts", { cwd: this.rootDir });

    let schemaIssues = 0;
    const missingRequiredFields = [];
    const invalidStructures = [];

    // Validate config files
    for (const configDef of configFiles) {
      const path = join(this.rootDir, configDef.file);
      if (existsSync(path)) {
        try {
          const content = readFileSync(path, "utf-8");
          const parsed = JSON.parse(content);

          // Check required fields
          const missing = configDef.required.filter(
            (field) => !(field in parsed),
          );
          if (missing.length > 0) {
            missingRequiredFields.push({ file: configDef.file, missing });
          }

          // Additional validation for specific files
          if (configDef.file === "package.json") {
            const scripts = parsed.scripts || {};
            const criticalScripts = ["build", "test", "typecheck", "lint"];
            const missingScripts = criticalScripts.filter((s) => !scripts[s]);
            if (missingScripts.length > 0) {
              invalidStructures.push({
                file: configDef.file,
                issue: `Missing critical scripts: ${missingScripts.join(", ")}`,
              });
            }
          }
        } catch (error) {
          schemaIssues++;
          this.addFinding({
            category: "Schema Validation",
            priority: "HIGH",
            severity: "P1",
            title: `Invalid JSON Schema: ${configDef.file}`,
            description: `Configuration file contains invalid JSON: ${error}`,
            files: [path],
            impact: "System configuration may fail at runtime",
            recommendation:
              "Fix JSON syntax and validate against expected schema",
          });
        }
      } else if (configDef.required.length > 0) {
        this.addFinding({
          category: "Schema Validation",
          priority: "HIGH",
          severity: "P1",
          title: `Missing Critical Config: ${configDef.file}`,
          description: `Required configuration file not found`,
          files: [configDef.file],
          impact: "System may fail to initialize or operate correctly",
          recommendation: `Create ${configDef.file} with required fields: ${configDef.required.join(", ")}`,
        });
      }
    }

    // Validate JSONL report files
    for (const reportFile of reportFiles) {
      const content = this.safeReadFile(reportFile);
      if (content) {
        const lines = content.split("\n").filter((line) => line.trim());
        let lineNum = 0;
        for (const line of lines) {
          lineNum++;
          try {
            const obj = JSON.parse(line);
            // Check for expected keys in reports
            const expectedKeys = ["timestamp", "run_id"];
            const hasRequiredKeys = expectedKeys.some((key) => key in obj);
            if (!hasRequiredKeys) {
              invalidStructures.push({
                file: reportFile,
                issue: `Line ${lineNum} missing required keys: ${expectedKeys.join(" or ")}`,
              });
            }
          } catch {
            invalidStructures.push({
              file: reportFile,
              issue: `Line ${lineNum} contains invalid JSON`,
            });
          }
        }
      }
    }

    // Validate TypeScript type definitions
    for (const typeFile of typeFiles) {
      const content = this.safeReadFile(typeFile);
      if (content) {
        // Check for proper export structure
        const hasExports =
          content.includes("export interface") ||
          content.includes("export type");
        const hasImports = content.includes("import");

        if (!hasExports && content.length > 100) {
          invalidStructures.push({
            file: typeFile,
            issue: "Type file should export interfaces or types",
          });
        }

        // Check for common schema patterns
        const interfaces = content.match(/export interface (\w+)/g);
        if (interfaces) {
          for (const interfaceMatch of interfaces) {
            const interfaceName = interfaceMatch.split(" ")[2];
            const interfaceContent = this.extractInterfaceContent(
              content,
              interfaceName,
            );

            // Validate common required fields for domain objects
            if (
              interfaceName.includes("Config") ||
              interfaceName.includes("Setting")
            ) {
              if (
                !interfaceContent.includes("id") &&
                !interfaceContent.includes("name")
              ) {
                invalidStructures.push({
                  file: typeFile,
                  issue: `Config interface ${interfaceName} should have id or name field`,
                });
              }
            }
          }
        }
      }
    }

    // Report findings
    if (missingRequiredFields.length > 0) {
      this.addFinding({
        category: "Schema Validation",
        priority: "HIGH",
        severity: "P1",
        title: "Missing Required Configuration Fields",
        description: `${missingRequiredFields.length} config files missing required fields`,
        files: missingRequiredFields.map((m) => m.file),
        impact: "Application may fail to start or behave unexpectedly",
        recommendation: "Add missing required fields to configuration files",
      });
    }

    if (invalidStructures.length > 0) {
      this.addFinding({
        category: "Schema Validation",
        priority: "MEDIUM",
        severity: "P2",
        title: "Invalid Data Structures",
        description: `${invalidStructures.length} files have structural issues`,
        files: invalidStructures.map((s) => s.file),
        impact: "Data processing and validation may fail",
        recommendation:
          "Fix structural issues in data files and type definitions",
      });
    }
  }

  private extractInterfaceContent(
    content: string,
    interfaceName: string,
  ): string {
    const interfaceStart = content.indexOf(`interface ${interfaceName}`);
    if (interfaceStart === -1) return "";

    let braceCount = 0;
    let index = content.indexOf("{", interfaceStart);
    const start = index;

    while (index < content.length) {
      if (content[index] === "{") braceCount++;
      if (content[index] === "}") braceCount--;
      if (braceCount === 0) break;
      index++;
    }

    return content.substring(start, index + 1);
  }

  private async checkLLMFlowAlignment(): Promise<void> {
    const agentFiles = glob.sync("src/agents/**/*.ts", { cwd: this.rootDir });
    const promptFiles = glob.sync("**/*prompt*.ts", {
      cwd: this.rootDir,
      ignore: ["node_modules/**"],
    });

    let inconsistentFlows = 0;

    for (const agentFile of agentFiles) {
      const content = this.safeReadFile(agentFile);
      if (
        content &&
        !content.includes("BaseAgent") &&
        !content.includes("mock")
      ) {
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
        recommendation:
          "Ensure all agents extend BaseAgent and follow consistent prompt/context patterns",
      });
    }
  }

  private async checkRuntimeGuardrails(): Promise<void> {
    const sourceFiles = glob.sync("src/**/*.ts", {
      cwd: this.rootDir,
      ignore: ["**/*.test.ts", "**/*.spec.ts"],
    });

    let guardrailCoverage = 0;
    const vulnerableFiles = [];
    const criticalFiles = [];
    const totalFiles = sourceFiles.length;

    for (const file of sourceFiles) {
      const content = this.safeReadFile(file);
      if (content) {
        // More sophisticated guardrail detection
        const hasErrorBoundary =
          content.includes("try") && content.includes("catch");
        const hasCircuitBreaker =
          content.includes("CircuitBreaker") ||
          content.includes("circuitBreaker");
        const hasFallback =
          content.includes("fallback") ||
          content.includes("defaultValue") ||
          content.includes("|| ");
        const hasTimeout =
          content.includes("timeout") ||
          content.includes("setTimeout") ||
          content.includes("AbortController");
        const hasRetry =
          content.includes("retry") || content.includes("attempt");
        const hasValidation =
          content.includes("validate") ||
          content.includes("assert") ||
          content.includes("schema");

        const guardrailCount = [
          hasErrorBoundary,
          hasCircuitBreaker,
          hasFallback,
          hasTimeout,
          hasRetry,
          hasValidation,
        ].filter(Boolean).length;

        // Critical files need more protection (agents, core, API)
        const isCritical =
          file.includes("agents/") ||
          file.includes("core/") ||
          file.includes("api/") ||
          file.includes("orchestrator");

        if (guardrailCount >= 1) {
          guardrailCoverage++;
        }

        if (guardrailCount === 0) {
          vulnerableFiles.push(file);
        }

        if (isCritical && guardrailCount < 2) {
          criticalFiles.push(file);
        }
      }
    }

    const coveragePercent = (guardrailCoverage / totalFiles) * 100;

    // Stricter thresholds
    if (coveragePercent < 60) {
      this.addFinding({
        category: "Runtime Guardrails",
        priority: "HIGH",
        severity: "P0",
        title: "Insufficient Runtime Protection",
        description: `Only ${coveragePercent.toFixed(1)}% of source files have runtime protection mechanisms (Target: 60%+)`,
        files: vulnerableFiles.slice(0, 10),
        impact:
          "System vulnerable to cascading failures and poor user experience",
        recommendation:
          "Add error boundaries, circuit breakers, fallback logic, timeout handling, retry mechanisms, and input validation",
      });
    }

    if (criticalFiles.length > 0) {
      this.addFinding({
        category: "Runtime Guardrails",
        priority: "HIGH",
        severity: "P0",
        title: "Critical Files Lack Adequate Protection",
        description: `${criticalFiles.length} critical system files have insufficient guardrails (need 2+ mechanisms)`,
        files: criticalFiles,
        impact: "Core system components vulnerable to failures",
        recommendation:
          "Critical files (agents, core, API) need multiple protection layers: error handling + timeout + validation + retry",
      });
    }
  }

  private async checkImportExportConsistency(): Promise<void> {
    const tsFiles = glob.sync("src/**/*.ts", { cwd: this.rootDir });
    const duplicateExports = new Map<string, string[]>();
    const unusedImports = [];
    const circularImports = [];
    const staleImports = [];

    for (const file of tsFiles) {
      const content = this.safeReadFile(file);
      if (content) {
        // Enhanced duplicate export detection
        const exportMatches = content.match(
          /export\s+(interface|type|class|function|const)\s+(\w+)/g,
        );
        if (exportMatches) {
          for (const match of exportMatches) {
            const parts = match.split(/\s+/);
            const name = parts[2];
            if (!duplicateExports.has(name)) {
              duplicateExports.set(name, []);
            }
            duplicateExports.get(name)?.push(file);
          }
        }

        // More sophisticated unused import detection
        const importLines = content
          .split("\n")
          .filter((line) => line.trim().startsWith("import"));
        for (const importLine of importLines) {
          // Named imports
          const namedImports = importLine.match(/import\s*{\s*([^}]+)\s*}/);
          if (namedImports) {
            const imports = namedImports[1].split(",").map((i) => i.trim());
            for (const imp of imports) {
              const cleanImport = imp.replace(/\s+as\s+\w+/, "").trim();
              if (cleanImport && !content.includes(cleanImport)) {
                unusedImports.push({
                  file,
                  import: importLine,
                  unused: cleanImport,
                });
              }
            }
          }

          // Default imports
          const defaultImport = importLine.match(/import\s+(\w+)\s+from/);
          if (defaultImport) {
            const imp = defaultImport[1];
            if (!content.includes(imp) && !importLine.includes("type")) {
              unusedImports.push({ file, import: importLine, unused: imp });
            }
          }

          // Check for potential circular imports (basic heuristic)
          const fromMatch = importLine.match(/from\s+['"](.+?)['"]/);
          if (fromMatch) {
            const importPath = fromMatch[1];
            if (importPath.startsWith("./") || importPath.startsWith("../")) {
              const reverseImportPattern = new RegExp(
                `from\\s+['"].*${file.split("/").pop()?.replace(".ts", "")}.*['"]`,
              );
              const targetFile = this.resolveImportPath(file, importPath);
              const targetContent = this.safeReadFile(targetFile);
              if (targetContent && reverseImportPattern.test(targetContent)) {
                circularImports.push({ file1: file, file2: targetFile });
              }
            }
          }
        }

        // Check for stale type imports (imported but used in comments only)
        const typeImports = content.match(/import\s+type\s*{\s*([^}]+)\s*}/g);
        if (typeImports) {
          for (const typeImport of typeImports) {
            const types = typeImport
              .match(/{\s*([^}]+)\s*}/)?.[1]
              .split(",")
              .map((t) => t.trim());
            if (types) {
              for (const type of types) {
                const usagePattern = new RegExp(`\\b${type}\\b`, "g");
                const matches = content.match(usagePattern) || [];
                if (matches.length <= 1) {
                  // Only the import itself
                  staleImports.push({ file, type, import: typeImport });
                }
              }
            }
          }
        }
      }
    }

    // Report findings
    for (const [name, files] of duplicateExports) {
      if (files.length > 1) {
        this.addFinding({
          category: "Import/Export Consistency",
          priority: "MEDIUM",
          severity: "P2",
          title: `Duplicate Export: ${name}`,
          description: `Type/interface/class "${name}" is exported from ${files.length} files`,
          files,
          impact: "Type conflicts, build issues, and developer confusion",
          recommendation:
            "Consolidate duplicate exports into shared types file or use unique naming",
        });
      }
    }

    if (unusedImports.length > 0) {
      this.addFinding({
        category: "Import/Export Consistency",
        priority: "MEDIUM",
        severity: "P2",
        title: "Unused Imports Detected",
        description: `${unusedImports.length} unused imports found across codebase`,
        files: unusedImports.map((u) => u.file),
        impact: "Bundle size bloat and code maintainability issues",
        recommendation:
          "Remove unused imports to improve build performance and code clarity",
      });
    }

    if (circularImports.length > 0) {
      this.addFinding({
        category: "Import/Export Consistency",
        priority: "HIGH",
        severity: "P1",
        title: "Circular Import Dependencies",
        description: `${circularImports.length} potential circular imports detected`,
        files: circularImports.flatMap((c) => [c.file1, c.file2]),
        impact: "Build failures and runtime module loading issues",
        recommendation:
          "Refactor to eliminate circular dependencies through abstraction or dependency inversion",
      });
    }
  }

  private resolveImportPath(currentFile: string, importPath: string): string {
    // Basic path resolution (can be enhanced)
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf("/"));
    if (importPath.startsWith("./")) {
      return join(currentDir, importPath.substring(2) + ".ts");
    } else if (importPath.startsWith("../")) {
      return join(currentDir, importPath + ".ts");
    }
    return importPath;
  }

  private async checkRoutingIntegrity(): Promise<void> {
    const appRoutes = glob.sync("apps/**/app/**/*.ts", { cwd: this.rootDir });
    const pageRoutes = glob.sync("apps/**/pages/**/*.ts", {
      cwd: this.rootDir,
    });

    // Check for conflicting routes
    const routeConflicts = [];

    if (appRoutes.length > 0 && pageRoutes.length > 0) {
      this.addFinding({
        category: "Routing Integrity",
        priority: "MEDIUM",
        severity: "P2",
        title: "Mixed Routing Patterns",
        description:
          "Both app/ and pages/ directories exist, which may cause routing conflicts",
        files: [...appRoutes, ...pageRoutes],
        impact: "Unpredictable routing behavior and potential conflicts",
        recommendation:
          "Choose single routing pattern (app/ or pages/) and migrate accordingly",
      });
    }
  }

  private async validateSlashCommandMappings(): Promise<void> {
    const slashCommands = this.findSlashCommands();
    const packageJson = this.safeReadFile("package.json");

    if (!packageJson) return;

    const scripts = JSON.parse(packageJson).scripts || {};
    const unmappedCommands = [];
    const brokenMappings = [];
    const missingExecutables = [];

    for (const cmdFile of slashCommands) {
      const cmdName = cmdFile.split("/").pop()?.replace(".md", "");
      const cmdContent = this.safeReadFile(cmdFile);

      if (!cmdContent || !cmdName) continue;

      // Check if command has npm script mapping
      const directScript = scripts[cmdName];
      const relatedScripts = Object.keys(scripts).filter(
        (script) =>
          script.includes(cmdName) || scripts[script].includes(cmdName),
      );

      if (!directScript && relatedScripts.length === 0) {
        unmappedCommands.push(cmdFile);
        continue;
      }

      // Validate script targets exist
      const scriptToCheck = directScript || scripts[relatedScripts[0]];
      if (scriptToCheck) {
        // Extract potential file references from script
        const fileRefs = scriptToCheck.match(
          /(?:tsx?|node)\s+([^\s]+\.(?:ts|js|mjs|cjs))/g,
        );
        if (fileRefs) {
          for (const ref of fileRefs) {
            const filePath = ref.split(/\s+/).pop();
            if (filePath && !existsSync(join(this.rootDir, filePath))) {
              missingExecutables.push({
                command: cmdName,
                script: scriptToCheck,
                missingFile: filePath,
              });
            }
          }
        }
      }

      // Check for command documentation completeness
      const hasUsage =
        cmdContent.includes("## 사용법") || cmdContent.includes("## Usage");
      const hasActions =
        cmdContent.includes("## Actions") || cmdContent.includes("## 기능");
      const hasBashCode = cmdContent.includes("```bash");

      if (!hasUsage || !hasActions || !hasBashCode) {
        brokenMappings.push({
          command: cmdName,
          file: cmdFile,
          issues: [
            !hasUsage && "Missing usage section",
            !hasActions && "Missing actions section",
            !hasBashCode && "Missing executable code",
          ].filter(Boolean),
        });
      }
    }

    // Report findings
    if (unmappedCommands.length > 0) {
      this.addFinding({
        category: "Slash Command Mapping",
        priority: "MEDIUM",
        severity: "P2",
        title: "Unmapped Slash Commands",
        description: `${unmappedCommands.length} slash commands don't have corresponding npm scripts`,
        files: unmappedCommands,
        impact: "Commands may not execute or have inconsistent behavior",
        recommendation:
          "Add corresponding npm scripts in package.json for all slash commands",
      });
    }

    if (missingExecutables.length > 0) {
      this.addFinding({
        category: "Slash Command Mapping",
        priority: "HIGH",
        severity: "P1",
        title: "Broken Script Executables",
        description: `${missingExecutables.length} npm scripts reference non-existent files`,
        files: missingExecutables.map((m) => `${m.command}: ${m.missingFile}`),
        impact: "Commands will fail at runtime with file not found errors",
        recommendation: "Fix script paths or create missing executable files",
      });
    }

    if (brokenMappings.length > 0) {
      this.addFinding({
        category: "Slash Command Mapping",
        priority: "MEDIUM",
        severity: "P2",
        title: "Incomplete Command Documentation",
        description: `${brokenMappings.length} slash commands have incomplete documentation`,
        files: brokenMappings.map((b) => b.file),
        impact: "Developers may not understand how to use commands correctly",
        recommendation:
          "Add missing sections: usage examples, action descriptions, and executable code blocks",
      });
    }

    // Additional check: Validate commands work with slash-commands.sh
    const slashScript = this.safeReadFile("scripts/slash-commands.sh");
    if (slashScript) {
      const commandsInScript = slashScript.match(/\$1.*=.*"([^"]+)"/g) || [];
      const scriptCommands = commandsInScript
        .map((m) => m.match(/"([^"]+)"/)?.[1])
        .filter(Boolean);

      const missingFromScript = slashCommands
        .map((f) => f.split("/").pop()?.replace(".md", ""))
        .filter((cmd) => cmd && !scriptCommands.includes(cmd));

      if (missingFromScript.length > 0) {
        this.addFinding({
          category: "Slash Command Mapping",
          priority: "MEDIUM",
          severity: "P2",
          title: "Commands Missing from Dispatcher",
          description: `${missingFromScript.length} commands not registered in slash-commands.sh`,
          files: ["scripts/slash-commands.sh"],
          impact:
            "Commands may not be discoverable or executable via slash interface",
          recommendation:
            "Add missing commands to scripts/slash-commands.sh dispatcher",
        });
      }
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
      /\\w*Util\\w*/,
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
        recommendation:
          "Use more specific, responsibility-clear naming conventions",
      });
    }
  }

  private async validateReportFormats(): Promise<void> {
    const reportFiles = glob.sync("reports/**/*.jsonl", { cwd: this.rootDir });
    const invalidReports = [];

    for (const reportFile of reportFiles) {
      const content = this.safeReadFile(reportFile);
      if (content) {
        const lines = content.split("\\n").filter((line) => line.trim());
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
        recommendation:
          "Ensure all reports follow structured JSONL format with required keys",
      });
    }
  }

  private async checkReleaseSafety(): Promise<void> {
    const ciFiles = glob.sync(".github/workflows/**/*.yml", {
      cwd: this.rootDir,
    });
    const hasPreCommitHooks = existsSync(join(this.rootDir, ".husky"));
    const packageJson = this.safeReadFile("package.json");
    const changelog = this.safeReadFile("CHANGELOG.md");

    const safetyIssues = [];
    const criticalMissing = [];

    // Check GitHub Actions workflows
    let hasReleaseWorkflow = false;
    let hasTestWorkflow = false;
    let hasSecurityCheck = false;

    for (const ciFile of ciFiles) {
      const content = this.safeReadFile(ciFile);
      if (content) {
        if (content.includes("release") || content.includes("publish")) {
          hasReleaseWorkflow = true;
        }
        if (
          content.includes("test") ||
          content.includes("vitest") ||
          content.includes("jest")
        ) {
          hasTestWorkflow = true;
        }
        if (
          content.includes("security") ||
          content.includes("vulnerability") ||
          content.includes("audit")
        ) {
          hasSecurityCheck = true;
        }

        // Check for missing critical steps in workflows
        if (content.includes("release") || content.includes("deploy")) {
          const missingSteps = [];
          if (!content.includes("test")) missingSteps.push("tests");
          if (!content.includes("lint") && !content.includes("eslint"))
            missingSteps.push("linting");
          if (!content.includes("build")) missingSteps.push("build");
          if (!content.includes("typecheck") && !content.includes("tsc"))
            missingSteps.push("type-checking");

          if (missingSteps.length > 0) {
            safetyIssues.push({
              file: ciFile,
              issue: `Release workflow missing: ${missingSteps.join(", ")}`,
            });
          }
        }
      }
    }

    if (!hasReleaseWorkflow && ciFiles.length > 0) {
      criticalMissing.push("Automated release workflow");
    }
    if (!hasTestWorkflow && ciFiles.length > 0) {
      criticalMissing.push("Test automation workflow");
    }
    if (!hasSecurityCheck) {
      criticalMissing.push("Security vulnerability checks");
    }

    // Check pre-commit hooks
    if (!hasPreCommitHooks) {
      criticalMissing.push("Pre-commit hooks");
    } else {
      const huskyConfig = this.safeReadFile(".husky/pre-commit");
      if (huskyConfig) {
        const missingHooks = [];
        if (!huskyConfig.includes("lint") && !huskyConfig.includes("eslint")) {
          missingHooks.push("linting");
        }
        if (!huskyConfig.includes("test")) {
          missingHooks.push("testing");
        }
        if (!huskyConfig.includes("typecheck")) {
          missingHooks.push("type-checking");
        }

        if (missingHooks.length > 0) {
          safetyIssues.push({
            file: ".husky/pre-commit",
            issue: `Pre-commit missing: ${missingHooks.join(", ")}`,
          });
        }
      }
    }

    // Check package.json safety scripts
    if (packageJson) {
      const scripts = JSON.parse(packageJson).scripts || {};
      const requiredSafetyScripts = [
        { name: "typecheck", patterns: ["tsc", "type"] },
        { name: "lint", patterns: ["eslint", "lint"] },
        { name: "test", patterns: ["test", "vitest", "jest"] },
        { name: "build", patterns: ["build", "tsc"] },
      ];

      const missingScripts = requiredSafetyScripts.filter(
        (req) =>
          !Object.keys(scripts).some((script) =>
            req.patterns.some(
              (pattern) =>
                script.includes(pattern) || scripts[script].includes(pattern),
            ),
          ),
      );

      if (missingScripts.length > 0) {
        safetyIssues.push({
          file: "package.json",
          issue: `Missing scripts: ${missingScripts.map((s) => s.name).join(", ")}`,
        });
      }

      // Check for ship/preflight workflow
      const hasShipCommand = Object.keys(scripts).some(
        (s) => s.includes("ship") || s.includes("preflight"),
      );
      if (!hasShipCommand) {
        criticalMissing.push("Ship/preflight command");
      }
    }

    // Check changelog maintenance
    if (!changelog) {
      criticalMissing.push("CHANGELOG.md");
    } else {
      const lines = changelog.split("\n");
      const hasVersionEntries = lines.some((line) =>
        line.match(/##?\s+\[?\d+\.\d+\.\d+/),
      );
      const hasUnreleased = lines.some((line) =>
        line.toLowerCase().includes("unreleased"),
      );

      if (!hasVersionEntries) {
        safetyIssues.push({
          file: "CHANGELOG.md",
          issue: "No version entries found",
        });
      }
      if (!hasUnreleased) {
        safetyIssues.push({
          file: "CHANGELOG.md",
          issue: "No 'Unreleased' section for tracking changes",
        });
      }
    }

    // Check for semantic versioning in package.json
    if (packageJson) {
      const pkg = JSON.parse(packageJson);
      const version = pkg.version;
      if (!version || !version.match(/^\d+\.\d+\.\d+/)) {
        safetyIssues.push({
          file: "package.json",
          issue: "Version doesn't follow semantic versioning (x.y.z)",
        });
      }
    }

    // Report findings
    if (criticalMissing.length > 0) {
      this.addFinding({
        category: "Release Safety",
        priority: "HIGH",
        severity: "P0",
        title: "Critical Release Safety Missing",
        description: `Missing ${criticalMissing.length} critical release safety mechanisms: ${criticalMissing.join(", ")}`,
        files: [...ciFiles, "package.json", ".husky/pre-commit"],
        impact: "High risk of releasing broken, untested, or vulnerable code",
        recommendation:
          "Implement missing safety mechanisms: automated testing, pre-commit hooks, release workflows, and security checks",
      });
    }

    if (safetyIssues.length > 0) {
      this.addFinding({
        category: "Release Safety",
        priority: "MEDIUM",
        severity: "P1",
        title: "Release Safety Gaps",
        description: `${safetyIssues.length} release safety improvements needed`,
        files: safetyIssues.map((s) => s.file),
        impact: "Moderate risk of releasing code with quality issues",
        recommendation:
          "Address safety gaps in workflows, scripts, and documentation",
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
      const fullPath = filePath.startsWith("/")
        ? filePath
        : join(this.rootDir, filePath);
      return readFileSync(fullPath, "utf-8");
    } catch {
      return null;
    }
  }

  private addFinding(finding: AuditFinding): void {
    this.findings.push(finding);
  }

  /**
   * 자동 TypeScript 컴파일 오류 탐지
   */
  private async checkTypeScriptCompilation(): Promise<void> {
    console.log("🔍 TypeScript 컴파일 오류 자동 탐지...");

    try {
      // TypeScript 컴파일 실행
      const { execSync } = await import("child_process");
      const result = execSync("npx tsc --noEmit --pretty false", {
        encoding: "utf8",
        stdio: "pipe",
      });

      console.log("✅ TypeScript 컴파일 성공 - 오류 없음");
    } catch (error: any) {
      const output = error.stdout || error.stderr || "";
      const errorLines = output
        .split("\n")
        .filter(
          (line: string) => line.includes("error TS") && line.trim().length > 0,
        );

      if (errorLines.length > 0) {
        const criticalErrors = errorLines.filter(
          (line: string) =>
            line.includes("TS2304") || // Cannot find name
            line.includes("TS2339") || // Property does not exist
            line.includes("TS2345") || // Argument not assignable
            line.includes("TS2322") || // Type not assignable
            line.includes("TS2393"), // Duplicate function implementation
        );

        // 파일별로 그룹화
        const errorsByFile: Record<string, string[]> = {};
        errorLines.forEach((line: string) => {
          const match = line.match(/^([^(]+)\((\d+),(\d+)\): (.+)$/);
          if (match) {
            const [, file] = match;
            if (!errorsByFile[file]) errorsByFile[file] = [];
            errorsByFile[file].push(line);
          }
        });

        this.addFinding({
          category: "TypeScript Compilation",
          priority: "HIGH",
          severity: "P0",
          title: "TypeScript Compilation Errors",
          description: `${errorLines.length}개의 컴파일 오류 발견 (Critical: ${criticalErrors.length}개)`,
          files: Object.keys(errorsByFile),
          impact: "시스템이 컴파일되지 않아 실행 불가능",
          recommendation:
            "모든 TypeScript 오류를 수정하여 컴파일을 성공시켜야 함",
        });

        console.log(
          `❌ TypeScript 오류 ${errorLines.length}개 발견 (Critical: ${criticalErrors.length}개)`,
        );
      }
    }
  }

  /**
   * 메서드 시그니처 불일치 자동 탐지
   */
  private async checkMethodSignatures(): Promise<void> {
    console.log("🔍 메서드 시그니처 불일치 자동 탐지...");

    const tsFiles = glob.sync("scripts/**/*.ts", { cwd: this.rootDir });
    const methodIssues: string[] = [];

    for (const file of tsFiles) {
      const content = this.safeReadFile(file);
      if (!content) continue;

      // requestApproval 메서드 호출 패턴 검사
      const requestApprovalCalls =
        content.match(/requestApproval\s*\([^)]+\)/g) || [];
      requestApprovalCalls.forEach((call) => {
        // 2개 파라미터 패턴 (구식)
        if (call.includes(",") && !call.includes("{")) {
          methodIssues.push(`${file}: 구식 requestApproval 시그니처 사용`);
        }
      });

      // listSnapshots vs getSnapshots
      if (
        content.includes("listSnapshots(") &&
        !content.includes("getSnapshots(")
      ) {
        methodIssues.push(
          `${file}: listSnapshots() 메서드가 존재하지 않음 (getSnapshots() 사용 필요)`,
        );
      }
    }

    if (methodIssues.length > 0) {
      this.addFinding({
        category: "Method Signatures",
        priority: "HIGH",
        severity: "P1",
        title: "Method Signature Mismatches",
        description: `${methodIssues.length}개의 메서드 시그니처 불일치`,
        files: methodIssues.map((issue) => issue.split(":")[0]),
        impact: "런타임 오류 및 메서드 호출 실패",
        recommendation: "모든 메서드 시그니처를 최신 인터페이스에 맞춰 수정",
      });

      console.log(`❌ 메서드 시그니처 문제 ${methodIssues.length}개 발견`);
    }
  }

  /**
   * Node.js 호환성 문제 자동 탐지
   */
  private async checkNodeCompatibility(): Promise<void> {
    console.log("🔍 Node.js 호환성 문제 자동 탐지...");

    const jsFiles = glob.sync("scripts/**/*.{ts,js}", { cwd: this.rootDir });
    const compatibilityIssues: string[] = [];

    for (const file of jsFiles) {
      const content = this.safeReadFile(file);
      if (!content) continue;

      // ESM/CommonJS 혼재 사용
      const hasESMImports = /^import\s+.*from\s+['"].+['"];?\s*$/m.test(
        content,
      );
      const hasCommonJSRequire = /require\s*\(\s*['"].+['"]\s*\)/.test(content);

      if (hasESMImports && hasCommonJSRequire) {
        compatibilityIssues.push(`${file}: ESM과 CommonJS 혼재 사용`);
      }

      // 파일 감시 glob 패턴 잘못된 사용
      if (content.includes("fs.watch(") && content.includes("**/*.ts")) {
        compatibilityIssues.push(`${file}: 파일 감시에서 glob 패턴 잘못 사용`);
      }
    }

    if (compatibilityIssues.length > 0) {
      this.addFinding({
        category: "Node.js Compatibility",
        priority: "MEDIUM",
        severity: "P2",
        title: "Node.js Compatibility Issues",
        description: `${compatibilityIssues.length}개의 Node.js 호환성 문제`,
        files: compatibilityIssues.map((issue) => issue.split(":")[0]),
        impact: "런타임 오류 및 불안정한 동작",
        recommendation: "Node.js 호환성 문제 수정 및 표준 패턴 사용",
      });

      console.log(
        `⚠️ Node.js 호환성 문제 ${compatibilityIssues.length}개 발견`,
      );
    }
  }

  private generateReport(): void {
    const highPriority = this.findings.filter((f) => f.priority === "HIGH");
    const mediumPriority = this.findings.filter((f) => f.priority === "MEDIUM");
    const lowPriority = this.findings.filter((f) => f.priority === "LOW");

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
          console.log(
            `Files: ${finding.files.slice(0, 3).join(", ")}${finding.files.length > 3 ? "..." : ""}`,
          );
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

    // 설계 원칙 위반 요약 출력
    const enhancedFindings =
      this.designPrincipleMapper.enhanceIssuesWithDesignPrinciples(
        this.findings,
      );
    const violationSummary =
      this.designPrincipleMapper.generateViolationSummary(enhancedFindings);
    console.log(violationSummary);

    // Auto-trigger conditions
    const shouldTriggerShip =
      highPriority.length === 0 && mediumPriority.length < 3;
    if (shouldTriggerShip) {
      console.log("✅ System health is good - ready for ship process");
    } else {
      console.log("⚠️ Consider addressing findings before major releases");
    }
  }

  /**
   * NEW: Task Scheduling Logic 검사
   * Phase 6 후속조치 - getTasksDue() 로직 문제 방지
   */
  private async checkTaskSchedulingLogic(): Promise<void> {
    const maintenanceFiles = glob.sync("scripts/*maintenance*.ts", {
      cwd: this.rootDir,
    });

    for (const file of maintenanceFiles) {
      const content = this.safeReadFile(join(this.rootDir, file));
      if (!content) continue;

      // 문제 1: before-commit frequency가 항상 false 리턴
      if (
        content.includes('case "before-commit":') &&
        content.includes("return false")
      ) {
        this.addFinding({
          category: "Task Scheduling Logic",
          priority: "HIGH",
          severity: "P0",
          title: `before-commit tasks always skipped in ${file}`,
          description:
            "before-commit frequency returns false, preventing critical tasks from running",
          files: [file],
          impact:
            "Critical validation tasks (typecheck, lint, test) never execute",
          recommendation:
            "Implement mode-based execution (SMART/FORCE) or remove before-commit frequency",
        });
      }

      // 문제 2: Critical tasks 시간 필터링으로 스킵
      if (
        content.includes("getTasksDue") &&
        !content.includes('task.priority === "critical"')
      ) {
        const hasTimeFilter =
          content.includes("timeSinceLastRun") && content.includes("oneDayMs");
        if (hasTimeFilter) {
          this.addFinding({
            category: "Task Scheduling Logic",
            priority: "HIGH",
            severity: "P1",
            title: `Critical tasks can be skipped by time filter in ${file}`,
            description:
              "Critical priority tasks filtered by lastRun time, may not execute when needed",
            files: [file],
            impact:
              "Critical tasks (Self-Healing check, TypeScript validation) may be skipped",
            recommendation:
              "Always execute critical priority tasks regardless of lastRun time",
          });
        }
      }
    }
  }

  /**
   * NEW: Interactive Approval System 검사
   * Phase 6 후속조치 - process.stdin 사용 문제 방지
   */
  private async checkInteractiveApprovalSystem(): Promise<void> {
    const approvalFiles = glob.sync("scripts/**/*approval*.ts", {
      cwd: this.rootDir,
    });

    for (const file of approvalFiles) {
      const content = this.safeReadFile(join(this.rootDir, file));
      if (!content) continue;

      // 문제: process.stdin 사용하지만 isTTY 체크 없음
      if (
        content.includes("process.stdin") &&
        !content.includes("process.stdin.isTTY")
      ) {
        this.addFinding({
          category: "Interactive Approval System",
          priority: "HIGH",
          severity: "P0",
          title: `Non-interactive execution not handled in ${file}`,
          description:
            "Uses process.stdin without checking isTTY, fails in background/CI environments",
          files: [file],
          impact:
            "Approval requests block or timeout in non-interactive environments",
          recommendation:
            "Check process.stdin.isTTY and queue approvals in non-interactive mode",
        });
      }

      // 문제: readline timeout 후 자동 건너뛰기
      if (
        content.includes("setTimeout") &&
        content.includes("readline") &&
        !content.includes("queue")
      ) {
        this.addFinding({
          category: "Interactive Approval System",
          priority: "MEDIUM",
          severity: "P2",
          title: `Timeout without queuing in ${file}`,
          description: "Approval timeout skips items without saving to queue",
          files: [file],
          impact: "User unaware of skipped approval items",
          recommendation: "Always queue timed-out approvals for later review",
        });
      }
    }
  }

  /**
   * NEW: Output Visibility 검사
   * Phase 6 후속조치 - stdio: pipe 문제 방지
   */
  private async checkOutputVisibility(): Promise<void> {
    const orchestratorFiles = glob.sync("scripts/**/*orchestrator*.ts", {
      cwd: this.rootDir,
    });

    for (const file of orchestratorFiles) {
      const content = this.safeReadFile(join(this.rootDir, file));
      if (!content) continue;

      // 문제: stdio: pipe로 출력 숨김
      if (content.includes("execSync") && content.includes('stdio: "pipe"')) {
        this.addFinding({
          category: "Output Visibility",
          priority: "MEDIUM",
          severity: "P2",
          title: `Command output hidden with stdio:pipe in ${file}`,
          description:
            "execSync with stdio:pipe hides command output from user",
          files: [file],
          impact: "User cannot see progress or errors during maintenance tasks",
          recommendation:
            "Use stdio:inherit for user-facing commands, or log output explicitly",
        });
      }

      // 문제: 에러 출력 캡처 안됨
      if (content.includes("execSync") && !content.includes("catch")) {
        const lines = content.split("\n");
        let inExecSync = false;
        let hasCatch = false;

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes("execSync")) {
            inExecSync = true;
          }
          if (inExecSync && lines[i].includes("catch")) {
            hasCatch = true;
            break;
          }
          if (inExecSync && lines[i].includes("}")) {
            break;
          }
        }

        if (inExecSync && !hasCatch) {
          this.addFinding({
            category: "Output Visibility",
            priority: "MEDIUM",
            severity: "P2",
            title: `execSync without error handling in ${file}`,
            description:
              "execSync without try-catch may crash without showing error details",
            files: [file],
            impact: "Maintenance fails without clear error messages",
            recommendation: "Wrap execSync in try-catch and log error details",
          });
        }
      }
    }
  }

  /**
   * 🔄 Self-Healing 무한 루프 감지 (NEW - Phase 6 후속조치)
   */
  private async checkSelfHealingInfiniteLoop(): Promise<void> {
    const healingFiles = glob.sync("apps/**/lib/*healing*.ts", {
      cwd: this.rootDir,
    });

    for (const file of healingFiles) {
      const content = this.safeReadFile(join(this.rootDir, file));
      if (!content) continue;

      // 문제 1: Healing 실패 시 연속 실패 카운터 증가 없음
      if (
        content.includes("performAutomaticHealingInternal") &&
        content.includes("filter(r => r.success)") &&
        !content.includes("consecutiveFailures++")
      ) {
        this.addFinding({
          category: "Self-Healing Infinite Loop",
          priority: "HIGH",
          severity: "P0",
          title: `Self-Healing lacks failure tracking in ${file}`,
          description:
            "Healing cycle doesn't increment consecutive failures when all actions fail",
          files: [file],
          impact:
            "System will retry healing indefinitely without dormant mode activation",
          recommendation:
            "Increment consecutiveFailures counter when successCount === 0",
        });
      }

      // 문제 2: 복구 불가능한 에러(API Key 없음 등)에 대한 즉시 dormant mode 진입 없음
      if (
        content.includes("performAPIKeyRotation") &&
        content.includes("No API keys found") &&
        !content.includes("enterDormantMode")
      ) {
        this.addFinding({
          category: "Self-Healing Infinite Loop",
          priority: "HIGH",
          severity: "P1",
          title: `Unrecoverable failures not handled in ${file}`,
          description:
            "API key absence should trigger immediate dormant mode, not retry",
          files: [file],
          impact: "System wastes resources retrying unrecoverable issues",
          recommendation:
            "Call enterDormantMode() immediately for external configuration errors",
        });
      }

      // 문제 3: Dormant mode 체크 없이 healing 재시도
      if (
        content.includes("performAutomaticHealing") &&
        content.includes("async performAutomaticHealing") &&
        !content.includes("if (this.dormantMode)")
      ) {
        this.addFinding({
          category: "Self-Healing Infinite Loop",
          priority: "HIGH",
          severity: "P0",
          title: `Missing dormant mode check at entry point in ${file}`,
          description:
            "performAutomaticHealing() doesn't check dormant mode, allowing healing to continue",
          files: [file],
          impact:
            "System wastes resources on healing attempts while in dormant state",
          recommendation:
            "Add 'if (this.dormantMode) return []' check at start of performAutomaticHealing()",
        });
      }

      // 문제 4: enterDormantMode()에서 백그라운드 태스크 취소 누락
      if (
        content.includes("enterDormantMode") &&
        content.includes("backgroundTaskManager") &&
        !content.includes("cancelTasksByPattern")
      ) {
        this.addFinding({
          category: "Self-Healing Infinite Loop",
          priority: "HIGH",
          severity: "P1",
          title: `Dormant mode doesn't cancel pending tasks in ${file}`,
          description:
            "enterDormantMode() only pauses tasks but doesn't cancel pending timeouts",
          files: [file],
          impact:
            "Scheduled healing-alert timeouts continue to fire after dormant mode activation",
          recommendation:
            "Call cancelTasksByPattern('healing-alert-*') in enterDormantMode()",
        });
      }
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
  const highPriorityCount = findings.filter(
    (f) => f.priority === "HIGH",
  ).length;
  process.exit(highPriorityCount > 0 ? 1 : 0);
}

// ES module compatibility
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RefactorAuditor };
export type { AuditFinding, AuditConfig };
