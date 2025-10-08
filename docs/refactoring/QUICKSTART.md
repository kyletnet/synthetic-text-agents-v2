# Refactoring Audit System - Quick Start

## Installation

No additional installation required - uses existing project dependencies.

## Basic Usage

### Run Full Audit

```bash
# Using the new modular system
npm run tsx src/application/refactoring/audit-orchestrator.ts
```

Or programmatically:

```typescript
import { AuditOrchestrator } from "./src/application/refactoring";

const orchestrator = new AuditOrchestrator({
  priority: "ALL",
  verbose: true,
  autoFix: false,
  rootDir: process.cwd(),
});

const result = await orchestrator.runAudit();
orchestrator.printReport(result);
```

### Run Priority-Specific Audit

```typescript
// P1 only (critical issues)
const orchestrator = new AuditOrchestrator({
  priority: "P1",
  verbose: false,
  autoFix: false,
});

const result = await orchestrator.runAudit();
```

## Understanding Results

### Result Structure

```typescript
{
  findings: [
    {
      category: "TypeScript Compilation",
      priority: "HIGH",
      severity: "P0",
      title: "TypeScript Compilation Errors",
      description: "5 compilation errors found",
      files: ["src/file.ts", "src/other.ts"],
      impact: "System cannot compile",
      recommendation: "Fix all TypeScript errors"
    }
  ],
  suggestions: [
    {
      issue: { /* finding object */ },
      actions: [
        {
          type: "modify",
          target: "src/file.ts",
          description: "Fix type annotation",
          codeExample: "// Add type annotation..."
        }
      ],
      autoFixable: false,
      estimatedEffort: "MEDIUM"
    }
  ],
  summary: {
    totalFindings: 10,
    highPriority: 3,
    mediumPriority: 5,
    lowPriority: 2,
    autoFixable: 2,
    categoryCounts: {
      "TypeScript Compilation": 3,
      "Runtime Guardrails": 2
    }
  },
  metadata: {
    duration: 8234,
    filesScanned: 156,
    timestamp: "2024-10-07T20:00:00.000Z",
    config: { /* audit config */ }
  }
}
```

### Priority Levels

- **P1**: Critical issues (blocking)

  - TypeScript compilation errors
  - Execution flow inconsistencies
  - Schema validation failures
  - LLM flow misalignment
  - Missing runtime guardrails

- **P2**: Core structure (important)

  - Import/export consistency
  - Method signature mismatches
  - Node.js compatibility issues

- **P3**: Maintainability (recommended)
  - Naming clarity
  - Report format issues
  - Release safety gaps

## Common Use Cases

### 1. Pre-commit Check

```typescript
const orchestrator = new AuditOrchestrator({
  priority: "P1",
  verbose: false,
  autoFix: false,
});

const result = await orchestrator.runAudit();

if (result.summary.highPriority > 0) {
  console.error(`❌ ${result.summary.highPriority} high priority issues found`);
  process.exit(1);
}
```

### 2. CI/CD Integration

```typescript
const orchestrator = new AuditOrchestrator({
  priority: "ALL",
  verbose: true,
  autoFix: false,
});

const result = await orchestrator.runAudit();

// Export results for CI
const fs = require("fs");
fs.writeFileSync("audit-results.json", JSON.stringify(result, null, 2));

// Fail if high priority issues
if (result.summary.highPriority > 0) {
  process.exit(1);
}
```

### 3. Code Review Assistant

````typescript
const orchestrator = new AuditOrchestrator({
  priority: "P2",
  verbose: true,
  autoFix: false,
});

const result = await orchestrator.runAudit();

// Generate code review comments
for (const suggestion of result.suggestions) {
  console.log(`\n## ${suggestion.issue.title}`);
  console.log(`**Priority**: ${suggestion.issue.priority}`);
  console.log(`**Effort**: ${suggestion.estimatedEffort}`);
  console.log(`\n${suggestion.issue.recommendation}`);

  for (const action of suggestion.actions) {
    console.log(`\n### ${action.description}`);
    if (action.codeExample) {
      console.log("```typescript");
      console.log(action.codeExample);
      console.log("```");
    }
  }
}
````

### 4. Module-Specific Analysis

```typescript
// Analyze code metrics only
import * as CodeAnalyzer from "./src/domain/refactoring/code-analyzer";
import * as FileScanner from "./src/infrastructure/refactoring/file-scanner";

const files = FileScanner.findTypeScriptFiles(process.cwd());
const contents = FileScanner.readFiles(files, process.cwd());

for (const [file, content] of contents) {
  const metrics = CodeAnalyzer.analyzeCodeMetrics(content);
  const guardrails = CodeAnalyzer.analyzeGuardrails(content);

  console.log(`${file}:`);
  console.log(`  Lines: ${metrics.lineCount}`);
  console.log(`  Functions: ${metrics.functionCount}`);
  console.log(`  Complexity: ${metrics.complexity}`);
  console.log(`  Guardrail Score: ${guardrails.score}/6`);
}
```

## Performance Tips

### 1. Use File Caching

```typescript
import { FileContentCache } from "./src/infrastructure/refactoring/file-scanner";

const cache = new FileContentCache(process.cwd());

// First read: from disk
const content1 = cache.getOrRead("src/file.ts");

// Subsequent reads: from cache (instant)
const content2 = cache.getOrRead("src/file.ts");
```

### 2. Run Incremental Audits

```typescript
// Only audit changed files
const orchestrator = new AuditOrchestrator({
  priority: "P1",
  verbose: false,
  autoFix: false,
});

// Future enhancement: pass changed files list
const result = await orchestrator.runAudit();
```

### 3. Parallel Priority Audits

```typescript
// Run P1 and P2 in parallel (future enhancement)
const [p1Result, p2Result] = await Promise.all([
  new AuditOrchestrator({
    priority: "P1",
    verbose: false,
    autoFix: false,
  }).runAudit(),
  new AuditOrchestrator({
    priority: "P2",
    verbose: false,
    autoFix: false,
  }).runAudit(),
]);
```

## Interpreting Suggestions

### Auto-fixable Issues

```typescript
const autoFixable = result.suggestions.filter((s) => s.autoFixable);

console.log(`\n✨ Auto-fixable: ${autoFixable.length} issues`);
for (const suggestion of autoFixable) {
  console.log(`  - ${suggestion.issue.title}`);
  console.log(`    Effort: ${suggestion.estimatedEffort}`);
}
```

### Effort Estimation

- **LOW**: < 1 hour, mechanical changes
- **MEDIUM**: 1-4 hours, requires understanding
- **HIGH**: > 4 hours, significant refactoring

### Design Principles

Many suggestions link to design principles:

```typescript
for (const suggestion of result.suggestions) {
  if (suggestion.designPrinciples) {
    console.log(`\n${suggestion.issue.title}`);
    console.log(`Design Principles: ${suggestion.designPrinciples.join(", ")}`);
  }
}
```

## Troubleshooting

### Issue: Audit Takes Too Long

**Solution**: Run priority-specific audits

```typescript
// Instead of "ALL", run P1 only
const orchestrator = new AuditOrchestrator({ priority: "P1", ... });
```

### Issue: Too Many False Positives

**Solution**: Filter by severity

```typescript
const critical = result.findings.filter((f) => f.severity === "P0");
```

### Issue: Can't Find Specific Files

**Solution**: Check file patterns in infrastructure layer

```typescript
import * as FileScanner from "./src/infrastructure/refactoring/file-scanner";

// Add custom pattern
const files = FileScanner.scanFiles({
  rootDir: process.cwd(),
  patterns: ["custom/path/**/*.ts"],
}).files;
```

## Migration from Old System

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed migration instructions.

Quick migration:

```typescript
// Old
import { RefactorAuditor } from "./scripts/refactor-auditor";
const auditor = new RefactorAuditor(config);
const findings = await auditor.runAudit();

// New
import { AuditOrchestrator } from "./src/application/refactoring";
const orchestrator = new AuditOrchestrator({
  ...config,
  rootDir: process.cwd(),
});
const result = await orchestrator.runAudit();
const findings = result.findings;
```

## Next Steps

1. **Run first audit**: `npm run tsx src/application/refactoring/audit-orchestrator.ts`
2. **Review results**: Focus on high priority findings first
3. **Apply suggestions**: Use code examples from suggestions
4. **Re-audit**: Verify fixes resolved issues
5. **Automate**: Integrate into CI/CD pipeline

## Resources

- [README.md](./README.md) - Complete documentation
- [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) - Migration instructions
- [SUMMARY.md](./SUMMARY.md) - Project overview

## Support

For questions or issues:

- Check test examples in `tests/integration/refactoring-audit.test.ts`
- Review individual module documentation
- Open GitHub issue
