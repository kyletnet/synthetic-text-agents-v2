/**
 * Issue Detector - Domain Layer
 * Responsible for detecting code quality issues and violations
 */

import type {
  CodeMetrics,
  ImportInfo,
  ExportInfo,
  InterfaceInfo,
  MethodSignature,
  GuardrailInfo,
} from "./code-analyzer.js";

export interface Issue {
  category: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  severity: "P0" | "P1" | "P2";
  title: string;
  description: string;
  files: string[];
  impact: string;
  recommendation: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutionFlowIssue {
  type: "no-core-invocation" | "inconsistent-paths";
  files: string[];
  invocations: string[];
}

export interface SchemaIssue {
  type: "missing-required-fields" | "invalid-structure" | "invalid-json";
  file: string;
  missing?: string[];
  issue?: string;
}

export interface ImportIssue {
  type:
    | "duplicate-export"
    | "unused-import"
    | "circular-dependency"
    | "stale-type-import";
  files: string[];
  name?: string;
  details?: string;
}

export interface GuardrailIssue {
  type: "insufficient-protection" | "critical-file-vulnerable";
  files: string[];
  coverage: number;
  targetCoverage: number;
}

export interface CompatibilityIssue {
  type: "mixed-module-system" | "invalid-file-watch-pattern";
  file: string;
  description: string;
}

export interface MethodSignatureIssue {
  type: "outdated-signature" | "missing-method";
  file: string;
  method: string;
  details: string;
}

/**
 * Detects execution flow consistency issues
 */
export function detectExecutionFlowIssues(
  entryPoints: {
    slashCommands: string[];
    cliScripts: string[];
    apiRoutes: string[];
  },
  fileContents: Map<string, string>,
): ExecutionFlowIssue | null {
  const coreInvocations = new Set<string>();
  const allFiles = [
    ...entryPoints.slashCommands,
    ...entryPoints.cliScripts,
    ...entryPoints.apiRoutes,
  ];

  for (const file of allFiles) {
    const content = fileContents.get(file);
    if (content) {
      if (content.includes("runCouncil")) coreInvocations.add("runCouncil");
      if (content.includes("baseline")) coreInvocations.add("baseline");
      if (content.includes("processRequest"))
        coreInvocations.add("processRequest");
    }
  }

  if (coreInvocations.size === 0) {
    return {
      type: "no-core-invocation",
      files: allFiles,
      invocations: [],
    };
  }

  return null;
}

/**
 * Detects schema validation issues
 */
export function detectSchemaIssues(
  configFiles: Array<{ file: string; required: string[] }>,
  fileContents: Map<string, string>,
): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const configDef of configFiles) {
    const content = fileContents.get(configDef.file);
    if (!content) {
      if (configDef.required.length > 0) {
        issues.push({
          type: "missing-required-fields",
          file: configDef.file,
          missing: configDef.required,
        });
      }
      continue;
    }

    try {
      const parsed = JSON.parse(content);

      // Check required fields
      const missing = configDef.required.filter((field) => !(field in parsed));
      if (missing.length > 0) {
        issues.push({
          type: "missing-required-fields",
          file: configDef.file,
          missing,
        });
      }

      // Additional validation for package.json
      if (configDef.file === "package.json") {
        const scripts = parsed.scripts || {};
        const criticalScripts = ["build", "test", "typecheck", "lint"];
        const missingScripts = criticalScripts.filter((s) => !scripts[s]);
        if (missingScripts.length > 0) {
          issues.push({
            type: "invalid-structure",
            file: configDef.file,
            issue: `Missing critical scripts: ${missingScripts.join(", ")}`,
          });
        }
      }
    } catch (error) {
      issues.push({
        type: "invalid-json",
        file: configDef.file,
        issue: `Invalid JSON: ${error}`,
      });
    }
  }

  return issues;
}

/**
 * Detects JSONL report format issues
 */
export function detectJSONLIssues(
  reportFiles: string[],
  fileContents: Map<string, string>,
): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const reportFile of reportFiles) {
    const content = fileContents.get(reportFile);
    if (!content) continue;

    const lines = content.split("\n").filter((line) => line.trim());
    let lineNum = 0;

    for (const line of lines) {
      lineNum++;
      try {
        const obj = JSON.parse(line);
        const expectedKeys = ["timestamp", "run_id"];
        const hasRequiredKeys = expectedKeys.some((key) => key in obj);
        if (!hasRequiredKeys) {
          issues.push({
            type: "invalid-structure",
            file: reportFile,
            issue: `Line ${lineNum} missing required keys: ${expectedKeys.join(
              " or ",
            )}`,
          });
        }
      } catch {
        issues.push({
          type: "invalid-json",
          file: reportFile,
          issue: `Line ${lineNum} contains invalid JSON`,
        });
      }
    }
  }

  return issues;
}

/**
 * Detects interface structure issues
 */
export function detectInterfaceIssues(
  interfaces: InterfaceInfo[],
  filePath: string,
): SchemaIssue[] {
  const issues: SchemaIssue[] = [];

  for (const iface of interfaces) {
    // Config interfaces should have id or name
    if (iface.name.includes("Config") || iface.name.includes("Setting")) {
      if (!iface.fields.includes("id") && !iface.fields.includes("name")) {
        issues.push({
          type: "invalid-structure",
          file: filePath,
          issue: `Config interface ${iface.name} should have id or name field`,
        });
      }
    }
  }

  return issues;
}

/**
 * Detects LLM flow alignment issues
 */
export function detectLLMFlowIssues(
  agentFiles: string[],
  fileContents: Map<string, string>,
): Issue | null {
  let inconsistentFlows = 0;

  for (const agentFile of agentFiles) {
    const content = fileContents.get(agentFile);
    if (
      content &&
      !content.includes("BaseAgent") &&
      !content.includes("mock")
    ) {
      inconsistentFlows++;
    }
  }

  if (inconsistentFlows > 0) {
    return {
      category: "LLM Flow Alignment",
      priority: "HIGH",
      severity: "P1",
      title: "Inconsistent Agent Implementation",
      description: `${inconsistentFlows} agents don't extend BaseAgent or implement consistent patterns`,
      files: agentFiles,
      impact: "Agent coordination and context flow may be unpredictable",
      recommendation:
        "Ensure all agents extend BaseAgent and follow consistent prompt/context patterns",
    };
  }

  return null;
}

/**
 * Detects runtime guardrail issues
 */
export function detectGuardrailIssues(
  guardrails: Map<string, GuardrailInfo>,
  criticalFiles: string[],
): GuardrailIssue[] {
  const issues: GuardrailIssue[] = [];
  const vulnerableFiles: string[] = [];
  const criticalVulnerable: string[] = [];

  let totalFiles = 0;
  let protectedFiles = 0;

  for (const [file, info] of guardrails) {
    totalFiles++;
    if (info.score >= 1) protectedFiles++;
    if (info.score === 0) vulnerableFiles.push(file);

    const isCritical = criticalFiles.includes(file);
    if (isCritical && info.score < 2) {
      criticalVulnerable.push(file);
    }
  }

  const coveragePercent = (protectedFiles / totalFiles) * 100;

  if (coveragePercent < 60) {
    issues.push({
      type: "insufficient-protection",
      files: vulnerableFiles.slice(0, 10),
      coverage: coveragePercent,
      targetCoverage: 60,
    });
  }

  if (criticalVulnerable.length > 0) {
    issues.push({
      type: "critical-file-vulnerable",
      files: criticalVulnerable,
      coverage: 0,
      targetCoverage: 2,
    });
  }

  return issues;
}

/**
 * Detects duplicate exports
 */
export function detectDuplicateExports(
  exports: Map<string, ExportInfo[]>,
): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const exportsByName = new Map<string, string[]>();

  for (const [file, exportList] of exports) {
    for (const exp of exportList) {
      if (!exportsByName.has(exp.name)) {
        exportsByName.set(exp.name, []);
      }
      exportsByName.get(exp.name)?.push(file);
    }
  }

  for (const [name, files] of exportsByName) {
    if (files.length > 1) {
      issues.push({
        type: "duplicate-export",
        name,
        files,
        details: `Type/interface/class "${name}" is exported from ${files.length} files`,
      });
    }
  }

  return issues;
}

/**
 * Detects circular imports
 */
export function detectCircularImportIssues(
  circular: Array<{ file1: string; file2: string }>,
): ImportIssue | null {
  if (circular.length === 0) return null;

  return {
    type: "circular-dependency",
    files: circular.flatMap((c) => [c.file1, c.file2]),
    details: `${circular.length} potential circular imports detected`,
  };
}

/**
 * Detects unused imports
 */
export function detectUnusedImportIssues(
  unused: Map<string, Array<{ import: string; unused: string }>>,
): ImportIssue | null {
  const totalUnused = Array.from(unused.values()).reduce(
    (sum, items) => sum + items.length,
    0,
  );

  if (totalUnused === 0) return null;

  return {
    type: "unused-import",
    files: Array.from(unused.keys()),
    details: `${totalUnused} unused imports found across codebase`,
  };
}

/**
 * Detects method signature mismatches
 */
export function detectMethodSignatureIssues(
  fileContents: Map<string, string>,
): MethodSignatureIssue[] {
  const issues: MethodSignatureIssue[] = [];

  for (const [file, content] of fileContents) {
    // Check for outdated requestApproval signatures
    const requestApprovalCalls =
      content.match(/requestApproval\s*\([^)]+\)/g) || [];
    for (const call of requestApprovalCalls) {
      // Old signature: 2 parameters without object destructuring
      if (call.includes(",") && !call.includes("{")) {
        issues.push({
          type: "outdated-signature",
          file,
          method: "requestApproval",
          details: "Using outdated 2-parameter signature",
        });
      }
    }

    // Check for listSnapshots vs getSnapshots
    if (
      content.includes("listSnapshots(") &&
      !content.includes("getSnapshots(")
    ) {
      issues.push({
        type: "missing-method",
        file,
        method: "listSnapshots",
        details: "listSnapshots() doesn't exist, use getSnapshots() instead",
      });
    }
  }

  return issues;
}

/**
 * Detects Node.js compatibility issues
 */
export function detectCompatibilityIssues(
  fileContents: Map<string, string>,
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];

  for (const [file, content] of fileContents) {
    // ESM/CommonJS mixing
    const hasESMImports = /^import\s+.*from\s+['"].+['"];?\s*$/m.test(content);
    const hasCommonJSRequire = /require\s*\(\s*['"].+['"]\s*\)/.test(content);

    if (hasESMImports && hasCommonJSRequire) {
      issues.push({
        type: "mixed-module-system",
        file,
        description: "ESM and CommonJS imports mixed in same file",
      });
    }

    // Invalid file watch patterns
    if (content.includes("fs.watch(") && content.includes("**/*.ts")) {
      issues.push({
        type: "invalid-file-watch-pattern",
        file,
        description:
          "File watch using glob pattern (not supported by fs.watch)",
      });
    }
  }

  return issues;
}

/**
 * Detects ambiguous naming issues
 */
export function detectNamingIssues(files: string[]): string[] {
  const ambiguousPatterns = [
    /Agent\w*Runner/,
    /Agent\w*Coordinator/,
    /\w*Manager\w*/,
    /\w*Handler\w*/,
    /\w*Helper\w*/,
    /\w*Util\w*/,
  ];

  return files.filter((file) => {
    const filename = file.split("/").pop() || "";
    return ambiguousPatterns.some((pattern) => pattern.test(filename));
  });
}

/**
 * Detects task scheduling logic issues (Phase 6 follow-up)
 */
export function detectTaskSchedulingIssues(
  fileContents: Map<string, string>,
): Issue[] {
  const issues: Issue[] = [];

  for (const [file, content] of fileContents) {
    if (!file.includes("maintenance")) continue;

    // Issue 1: before-commit always returns false
    if (
      content.includes('case "before-commit":') &&
      content.includes("return false")
    ) {
      issues.push({
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

    // Issue 2: Critical tasks filtered by time
    if (
      content.includes("getTasksDue") &&
      !content.includes('task.priority === "critical"')
    ) {
      const hasTimeFilter =
        content.includes("timeSinceLastRun") && content.includes("oneDayMs");
      if (hasTimeFilter) {
        issues.push({
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

  return issues;
}

/**
 * Detects interactive approval system issues
 */
export function detectApprovalSystemIssues(
  fileContents: Map<string, string>,
): Issue[] {
  const issues: Issue[] = [];

  for (const [file, content] of fileContents) {
    if (!file.includes("approval")) continue;

    // Issue 1: process.stdin without isTTY check
    if (
      content.includes("process.stdin") &&
      !content.includes("process.stdin.isTTY")
    ) {
      issues.push({
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

    // Issue 2: Timeout without queuing
    if (
      content.includes("setTimeout") &&
      content.includes("readline") &&
      !content.includes("queue")
    ) {
      issues.push({
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

  return issues;
}

/**
 * Detects output visibility issues
 */
export function detectOutputVisibilityIssues(
  fileContents: Map<string, string>,
): Issue[] {
  const issues: Issue[] = [];

  for (const [file, content] of fileContents) {
    if (!file.includes("orchestrator")) continue;

    // Issue 1: stdio:pipe hides output
    if (content.includes("execSync") && content.includes('stdio: "pipe"')) {
      issues.push({
        category: "Output Visibility",
        priority: "MEDIUM",
        severity: "P2",
        title: `Command output hidden with stdio:pipe in ${file}`,
        description: "execSync with stdio:pipe hides command output from user",
        files: [file],
        impact: "User cannot see progress or errors during maintenance tasks",
        recommendation:
          "Use stdio:inherit for user-facing commands, or log output explicitly",
      });
    }

    // Issue 2: execSync without error handling
    if (content.includes("execSync") && !content.includes("catch")) {
      issues.push({
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

  return issues;
}

/**
 * Detects self-healing infinite loop issues
 */
export function detectSelfHealingIssues(
  fileContents: Map<string, string>,
): Issue[] {
  const issues: Issue[] = [];

  for (const [file, content] of fileContents) {
    if (!file.includes("healing")) continue;

    // Issue 1: No failure tracking
    if (
      content.includes("performAutomaticHealingInternal") &&
      content.includes("filter(r => r.success)") &&
      !content.includes("consecutiveFailures++")
    ) {
      issues.push({
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

    // Issue 2: No immediate dormant for unrecoverable errors
    if (
      content.includes("performAPIKeyRotation") &&
      content.includes("No API keys found") &&
      !content.includes("enterDormantMode")
    ) {
      issues.push({
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

    // Issue 3: No dormant mode check at entry
    if (
      content.includes("performAutomaticHealing") &&
      content.includes("async performAutomaticHealing") &&
      !content.includes("if (this.dormantMode)")
    ) {
      issues.push({
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

    // Issue 4: Dormant doesn't cancel tasks
    if (
      content.includes("enterDormantMode") &&
      content.includes("backgroundTaskManager") &&
      !content.includes("cancelTasksByPattern")
    ) {
      issues.push({
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

  return issues;
}
