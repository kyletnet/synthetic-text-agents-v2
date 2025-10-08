/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Suggestion Generator - Domain Layer
 * Responsible for generating actionable recommendations from detected issues
 */

import type { Issue } from "./issue-detector.js";

export interface Suggestion {
  issue: Issue;
  actions: Action[];
  autoFixable: boolean;
  estimatedEffort: "LOW" | "MEDIUM" | "HIGH";
  designPrinciples?: string[];
}

export interface Action {
  type: "add" | "remove" | "modify" | "refactor";
  target: string;
  description: string;
  codeExample?: string;
  beforeAfter?: { before: string; after: string };
}

/**
 * Generates suggestions for execution flow issues
 */
export function generateExecutionFlowSuggestions(issue: Issue): Suggestion {
  return {
    issue,
    actions: [
      {
        type: "add",
        target: "Entry point files",
        description: "Add standardized orchestration function calls",
        codeExample: `
// Add to all entry points (CLI, API, slash commands):
import { runCouncil } from './core/orchestrator';

async function main() {
  const result = await runCouncil(config);
  return result;
}`,
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
    designPrinciples: ["Single Responsibility", "DRY"],
  };
}

/**
 * Generates suggestions for schema issues
 */
export function generateSchemaIssueSuggestions(issue: Issue): Suggestion {
  if (issue.title.includes("Missing Required")) {
    return {
      issue,
      actions: [
        {
          type: "add",
          target: "Configuration files",
          description: "Add missing required fields",
          codeExample: `
// Add to config file:
{
  "run_id": "generated-uuid",
  "routing_path": "default",
  "quality_target": 9.5,
  ...existingFields
}`,
        },
      ],
      autoFixable: true,
      estimatedEffort: "LOW",
    };
  }

  if (issue.title.includes("Invalid JSON")) {
    return {
      issue,
      actions: [
        {
          type: "modify",
          target: "JSON files",
          description: "Fix JSON syntax errors",
          codeExample: "Run: npm run lint:json --fix",
        },
      ],
      autoFixable: true,
      estimatedEffort: "LOW",
    };
  }

  return {
    issue,
    actions: [
      {
        type: "modify",
        target: "Schema files",
        description: "Fix structural issues in data files",
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
  };
}

/**
 * Generates suggestions for LLM flow issues
 */
export function generateLLMFlowSuggestions(issue: Issue): Suggestion {
  return {
    issue,
    actions: [
      {
        type: "refactor",
        target: "Agent files",
        description: "Refactor agents to extend BaseAgent",
        codeExample: `
// Before:
export class CustomAgent {
  async process(input: string) { ... }
}

// After:
import { BaseAgent } from './core/BaseAgent';

export class CustomAgent extends BaseAgent {
  async process(input: string) {
    const context = this.getContext();
    return await this.executeWithContext(input, context);
  }
}`,
      },
    ],
    autoFixable: false,
    estimatedEffort: "HIGH",
    designPrinciples: ["Open/Closed Principle", "Liskov Substitution"],
  };
}

/**
 * Generates suggestions for guardrail issues
 */
export function generateGuardrailSuggestions(issue: Issue): Suggestion {
  if (issue.title.includes("Critical Files")) {
    return {
      issue,
      actions: [
        {
          type: "add",
          target: "Critical files (agents, core, API)",
          description: "Add multiple protection layers",
          codeExample: `
// Add to critical files:
import { CircuitBreaker } from './utils/circuit-breaker';

export class CriticalService {
  private circuitBreaker = new CircuitBreaker({ threshold: 3 });

  async process(input: string): Promise<Result> {
    // 1. Input validation
    if (!this.validate(input)) {
      throw new ValidationError('Invalid input');
    }

    // 2. Circuit breaker
    return await this.circuitBreaker.execute(async () => {
      // 3. Timeout protection
      const timeout = setTimeout(() => {
        throw new TimeoutError();
      }, 5000);

      try {
        // 4. Error boundary
        const result = await this.doWork(input);
        return result;
      } catch (error) {
        // 5. Retry logic
        return await this.retryWithBackoff(input);
      } finally {
        clearTimeout(timeout);
      }
    });
  }
}`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "HIGH",
      designPrinciples: ["Fail-Safe Defaults", "Defense in Depth"],
    };
  }

  return {
    issue,
    actions: [
      {
        type: "add",
        target: "Source files",
        description: "Add basic error handling and validation",
        codeExample: `
// Add try-catch blocks:
try {
  const result = await operation();
  return result || defaultValue; // fallback
} catch (error) {
  logger.error('Operation failed', error);
  return defaultValue;
}`,
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
  };
}

/**
 * Generates suggestions for import/export issues
 */
export function generateImportExportSuggestions(issue: Issue): Suggestion {
  if (issue.title.includes("Duplicate Export")) {
    return {
      issue,
      actions: [
        {
          type: "refactor",
          target: "Type definition files",
          description: "Consolidate duplicate exports into shared types file",
          codeExample: `
// Create src/shared/types/common.ts
export interface SharedType {
  // consolidated definition
}

// Update other files to import:
import type { SharedType } from '../shared/types/common';`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "MEDIUM",
      designPrinciples: ["DRY", "Single Source of Truth"],
    };
  }

  if (issue.title.includes("Unused Imports")) {
    return {
      issue,
      actions: [
        {
          type: "remove",
          target: "Import statements",
          description: "Remove unused imports",
          codeExample: "Run: npm run lint:fix",
        },
      ],
      autoFixable: true,
      estimatedEffort: "LOW",
    };
  }

  if (issue.title.includes("Circular")) {
    return {
      issue,
      actions: [
        {
          type: "refactor",
          target: "Module dependencies",
          description: "Break circular dependencies using dependency inversion",
          codeExample: `
// Before: A imports B, B imports A

// After: Extract shared interface
// shared/interfaces.ts
export interface SharedInterface {
  method(): void;
}

// A.ts
import type { SharedInterface } from './shared/interfaces';
export class A {
  constructor(private dep: SharedInterface) {}
}

// B.ts
import type { SharedInterface } from './shared/interfaces';
export class B implements SharedInterface {
  method() { ... }
}`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "HIGH",
      designPrinciples: ["Dependency Inversion", "Acyclic Dependencies"],
    };
  }

  return {
    issue,
    actions: [
      {
        type: "modify",
        target: "Import/export statements",
        description: "Fix import/export consistency issues",
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
  };
}

/**
 * Generates suggestions for method signature issues
 */
export function generateMethodSignatureSuggestions(issue: Issue): Suggestion {
  if (issue.description.includes("requestApproval")) {
    return {
      issue,
      actions: [
        {
          type: "modify",
          target: "Method calls",
          description: "Update to new signature with object parameter",
          beforeAfter: {
            before: 'await requestApproval("message", { key: "value" })',
            after:
              'await requestApproval({ message: "message", metadata: { key: "value" } })',
          },
        },
      ],
      autoFixable: true,
      estimatedEffort: "LOW",
    };
  }

  if (issue.description.includes("listSnapshots")) {
    return {
      issue,
      actions: [
        {
          type: "modify",
          target: "Method calls",
          description: "Replace listSnapshots with getSnapshots",
          beforeAfter: {
            before: "const snapshots = await listSnapshots();",
            after: "const snapshots = await getSnapshots();",
          },
        },
      ],
      autoFixable: true,
      estimatedEffort: "LOW",
    };
  }

  return {
    issue,
    actions: [
      {
        type: "modify",
        target: "Method signatures",
        description: "Update method signatures to match current interface",
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
  };
}

/**
 * Generates suggestions for Node.js compatibility issues
 */
export function generateCompatibilitySuggestions(issue: Issue): Suggestion {
  if (issue.description.includes("ESM and CommonJS")) {
    return {
      issue,
      actions: [
        {
          type: "refactor",
          target: "Module imports",
          description: "Convert to consistent ESM imports",
          beforeAfter: {
            before: `
const module = require('./module');
import { something } from './other';`,
            after: `
import module from './module.js';
import { something } from './other.js';`,
          },
        },
      ],
      autoFixable: false,
      estimatedEffort: "MEDIUM",
    };
  }

  if (issue.description.includes("file watch")) {
    return {
      issue,
      actions: [
        {
          type: "modify",
          target: "File watching code",
          description: "Use chokidar for glob pattern support",
          codeExample: `
// Replace fs.watch with chokidar:
import chokidar from 'chokidar';

const watcher = chokidar.watch('**/*.ts', {
  ignored: /node_modules/,
  persistent: true
});

watcher.on('change', (path) => {
  console.log(\`File \${path} changed\`);
});`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "LOW",
    };
  }

  return {
    issue,
    actions: [
      {
        type: "modify",
        target: "Compatibility issues",
        description: "Fix Node.js compatibility issues",
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
  };
}

/**
 * Generates suggestions for naming clarity issues
 */
export function generateNamingClaritySuggestions(issue: Issue): Suggestion {
  return {
    issue,
    actions: [
      {
        type: "refactor",
        target: "File and class names",
        description: "Use more specific, responsibility-clear naming",
        codeExample: `
// Avoid ambiguous suffixes:
❌ AgentRunner → ✅ AgentExecutionEngine
❌ DataManager → ✅ DataRepository
❌ StringHelper → ✅ StringFormatter
❌ ApiHandler → ✅ ApiRequestProcessor

// Be specific about responsibility:
❌ Util → ✅ DateTimeConverter
❌ Manager → ✅ ConfigurationProvider`,
      },
    ],
    autoFixable: false,
    estimatedEffort: "LOW",
    designPrinciples: ["Single Responsibility", "Clarity"],
  };
}

/**
 * Generates suggestions for report format issues
 */
export function generateReportFormatSuggestions(issue: Issue): Suggestion {
  return {
    issue,
    actions: [
      {
        type: "modify",
        target: "Report generation code",
        description:
          "Ensure all reports follow JSONL format with required keys",
        codeExample: `
// Ensure every report line has:
const reportEntry = {
  timestamp: new Date().toISOString(),
  run_id: runId,
  evidence: { ... },
  ...otherFields
};

fs.appendFileSync(reportPath, JSON.stringify(reportEntry) + '\\n');`,
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
  };
}

/**
 * Generates suggestions for release safety issues
 */
export function generateReleaseSafetySuggestions(issue: Issue): Suggestion {
  if (issue.title.includes("Critical Release Safety")) {
    return {
      issue,
      actions: [
        {
          type: "add",
          target: "CI/CD and pre-commit hooks",
          description: "Implement comprehensive release safety mechanisms",
          codeExample: `
# .github/workflows/release.yml
name: Release
on:
  push:
    branches: [main]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test
      - run: npm audit
      - run: npm run build

# .husky/pre-commit
npm run typecheck
npm run lint:staged
npm run test:affected`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "HIGH",
      designPrinciples: ["Fail-Fast", "Defense in Depth"],
    };
  }

  return {
    issue,
    actions: [
      {
        type: "add",
        target: "CI workflows and documentation",
        description: "Add missing safety checks and documentation",
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
  };
}

/**
 * Generates suggestions for task scheduling issues
 */
export function generateTaskSchedulingSuggestions(issue: Issue): Suggestion {
  if (issue.title.includes("before-commit tasks always skipped")) {
    return {
      issue,
      actions: [
        {
          type: "modify",
          target: "Task scheduling logic",
          description: "Implement mode-based execution for before-commit tasks",
          codeExample: `
// Add mode check:
case "before-commit":
  const mode = process.env.MAINTENANCE_MODE || "SMART";
  if (mode === "FORCE") return true;
  if (mode === "SMART") {
    // Check if critical files changed
    return hasTypeScriptChanges || hasConfigChanges;
  }
  return false;`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "MEDIUM",
    };
  }

  if (issue.title.includes("Critical tasks can be skipped")) {
    return {
      issue,
      actions: [
        {
          type: "modify",
          target: "getTasksDue function",
          description: "Always execute critical priority tasks",
          codeExample: `
function getTasksDue(): Task[] {
  return tasks.filter(task => {
    // Always run critical tasks
    if (task.priority === "critical") return true;

    // Time-based filtering for non-critical
    const timeSinceLastRun = Date.now() - task.lastRun;
    return timeSinceLastRun >= task.frequency;
  });
}`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "LOW",
    };
  }

  return {
    issue,
    actions: [
      {
        type: "modify",
        target: "Task scheduling logic",
        description: "Fix task scheduling logic issues",
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
  };
}

/**
 * Generates suggestions for approval system issues
 */
export function generateApprovalSystemSuggestions(issue: Issue): Suggestion {
  if (issue.title.includes("Non-interactive execution")) {
    return {
      issue,
      actions: [
        {
          type: "add",
          target: "Approval request code",
          description:
            "Check for TTY and queue approvals in non-interactive mode",
          codeExample: `
async function requestApproval(options: ApprovalOptions): Promise<boolean> {
  if (!process.stdin.isTTY) {
    // Non-interactive: queue for later
    await queueApproval(options);
    console.log('⏸️ Approval queued for later review');
    return false;
  }

  // Interactive: prompt user
  return await promptUser(options);
}`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "MEDIUM",
    };
  }

  if (issue.title.includes("Timeout without queuing")) {
    return {
      issue,
      actions: [
        {
          type: "add",
          target: "Timeout handling",
          description: "Queue timed-out approvals for later review",
          codeExample: `
const timeout = setTimeout(async () => {
  rl.close();
  await queueApproval({ ...options, reason: 'timeout' });
  console.log('⏸️ Approval timed out and queued for review');
  resolve(false);
}, TIMEOUT_MS);`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "LOW",
    };
  }

  return {
    issue,
    actions: [
      {
        type: "modify",
        target: "Approval system",
        description: "Fix approval system issues",
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
  };
}

/**
 * Generates suggestions for output visibility issues
 */
export function generateOutputVisibilitySuggestions(issue: Issue): Suggestion {
  if (issue.title.includes("stdio:pipe")) {
    return {
      issue,
      actions: [
        {
          type: "modify",
          target: "execSync calls",
          description: "Use stdio:inherit for user-facing commands",
          beforeAfter: {
            before: 'execSync(command, { stdio: "pipe" })',
            after: 'execSync(command, { stdio: "inherit" })',
          },
        },
      ],
      autoFixable: true,
      estimatedEffort: "LOW",
    };
  }

  if (issue.title.includes("without error handling")) {
    return {
      issue,
      actions: [
        {
          type: "add",
          target: "execSync calls",
          description: "Add try-catch with detailed error logging",
          codeExample: `
try {
  execSync(command, { stdio: "inherit" });
} catch (error) {
  console.error('❌ Command failed:', command);
  console.error('Error details:', error.message);
  throw error;
}`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "LOW",
    };
  }

  return {
    issue,
    actions: [
      {
        type: "modify",
        target: "Command execution",
        description: "Improve output visibility",
      },
    ],
    autoFixable: false,
    estimatedEffort: "LOW",
  };
}

/**
 * Generates suggestions for self-healing infinite loop issues
 */
export function generateSelfHealingSuggestions(issue: Issue): Suggestion {
  if (issue.title.includes("lacks failure tracking")) {
    return {
      issue,
      actions: [
        {
          type: "add",
          target: "Healing cycle logic",
          description: "Track consecutive failures",
          codeExample: `
const successCount = results.filter(r => r.success).length;

if (successCount === 0) {
  this.consecutiveFailures++;
  if (this.consecutiveFailures >= MAX_FAILURES) {
    await this.enterDormantMode();
  }
} else {
  this.consecutiveFailures = 0;
}`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "LOW",
    };
  }

  if (issue.title.includes("Unrecoverable failures")) {
    return {
      issue,
      actions: [
        {
          type: "add",
          target: "Error handling",
          description:
            "Enter dormant mode immediately for unrecoverable errors",
          codeExample: `
if (error.message.includes("No API keys found")) {
  await this.enterDormantMode({
    reason: "unrecoverable_error",
    details: "Missing API keys - requires manual configuration"
  });
  return;
}`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "LOW",
    };
  }

  if (issue.title.includes("Missing dormant mode check")) {
    return {
      issue,
      actions: [
        {
          type: "add",
          target: "Entry point",
          description: "Check dormant mode at function entry",
          codeExample: `
async performAutomaticHealing(): Promise<HealingResult[]> {
  if (this.dormantMode) {
    console.log('⏸️ Healing skipped: dormant mode active');
    return [];
  }

  // Continue with healing...
}`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "LOW",
    };
  }

  if (issue.title.includes("doesn't cancel pending tasks")) {
    return {
      issue,
      actions: [
        {
          type: "add",
          target: "enterDormantMode function",
          description: "Cancel pending background tasks",
          codeExample: `
async enterDormantMode(options: DormantOptions): Promise<void> {
  this.dormantMode = true;

  // Cancel all healing-related tasks
  await this.backgroundTaskManager.cancelTasksByPattern('healing-alert-*');
  await this.backgroundTaskManager.cancelTasksByPattern('healing-retry-*');

  console.log('⏸️ Entered dormant mode:', options.reason);
}`,
        },
      ],
      autoFixable: false,
      estimatedEffort: "LOW",
    };
  }

  return {
    issue,
    actions: [
      {
        type: "modify",
        target: "Self-healing logic",
        description: "Fix self-healing infinite loop issues",
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
  };
}

/**
 * Master function to generate suggestions for any issue
 */
export function generateSuggestions(issue: Issue): Suggestion {
  const category = issue.category.toLowerCase();

  if (category.includes("execution flow")) {
    return generateExecutionFlowSuggestions(issue);
  }
  if (category.includes("schema")) {
    return generateSchemaIssueSuggestions(issue);
  }
  if (category.includes("llm flow")) {
    return generateLLMFlowSuggestions(issue);
  }
  if (category.includes("guardrail")) {
    return generateGuardrailSuggestions(issue);
  }
  if (category.includes("import") || category.includes("export")) {
    return generateImportExportSuggestions(issue);
  }
  if (category.includes("method signature")) {
    return generateMethodSignatureSuggestions(issue);
  }
  if (category.includes("compatibility")) {
    return generateCompatibilitySuggestions(issue);
  }
  if (category.includes("naming")) {
    return generateNamingClaritySuggestions(issue);
  }
  if (category.includes("report format")) {
    return generateReportFormatSuggestions(issue);
  }
  if (category.includes("release safety")) {
    return generateReleaseSafetySuggestions(issue);
  }
  if (category.includes("task scheduling")) {
    return generateTaskSchedulingSuggestions(issue);
  }
  if (category.includes("approval")) {
    return generateApprovalSystemSuggestions(issue);
  }
  if (category.includes("output visibility")) {
    return generateOutputVisibilitySuggestions(issue);
  }
  if (category.includes("self-healing")) {
    return generateSelfHealingSuggestions(issue);
  }

  // Default suggestion
  return {
    issue,
    actions: [
      {
        type: "modify",
        target: issue.files[0] || "affected files",
        description: issue.recommendation,
      },
    ],
    autoFixable: false,
    estimatedEffort: "MEDIUM",
  };
}
