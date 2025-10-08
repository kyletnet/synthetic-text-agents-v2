# Refactoring Audit System

## Overview

A modular, DDD-based refactoring audit system that analyzes code quality, detects issues, and generates actionable suggestions for improvement.

## Architecture

### Domain Layer (`src/domain/refactoring/`)

Pure business logic with zero dependencies on infrastructure.

#### code-analyzer.ts (400 lines)

- **Purpose**: AST analysis and code metrics extraction
- **Key Functions**:
  - `analyzeCodeMetrics()`: Count lines, functions, classes, complexity
  - `extractImports()`: Parse import statements
  - `extractExports()`: Parse export statements
  - `extractInterface()`: Extract interface definitions with fields
  - `analyzeGuardrails()`: Detect runtime protection mechanisms
  - `detectCircularImports()`: Find circular dependency patterns
  - `detectUnusedImports()`: Identify unused import statements

#### issue-detector.ts (350 lines)

- **Purpose**: Detect code quality issues and violations
- **Key Functions**:
  - `detectExecutionFlowIssues()`: Check entry point consistency
  - `detectSchemaIssues()`: Validate configuration schemas
  - `detectLLMFlowIssues()`: Check agent implementation patterns
  - `detectGuardrailIssues()`: Identify missing runtime protection
  - `detectMethodSignatureIssues()`: Find outdated method signatures
  - `detectCompatibilityIssues()`: Check Node.js compatibility
  - `detectTaskSchedulingIssues()`: Validate task scheduling logic
  - `detectApprovalSystemIssues()`: Check interactive approval handling
  - `detectSelfHealingIssues()`: Validate self-healing mechanisms

#### suggestion-generator.ts (400 lines)

- **Purpose**: Generate actionable recommendations with code examples
- **Key Functions**:
  - `generateSuggestions()`: Master function routing to specific generators
  - `generateExecutionFlowSuggestions()`: Fix entry point issues
  - `generateGuardrailSuggestions()`: Add runtime protection
  - `generateImportExportSuggestions()`: Fix import/export issues
  - `generateMethodSignatureSuggestions()`: Update method signatures
  - Includes code examples, before/after comparisons, effort estimates

### Application Layer (`src/application/refactoring/`)

Orchestrates domain logic using Command Pattern.

#### audit-orchestrator.ts (350 lines)

- **Purpose**: Use case orchestration with Command Pattern
- **Key Classes**:
  - `AuditOrchestrator`: Main orchestrator class
  - `BaseAuditCommand`: Abstract base for audit commands
  - `TypeScriptCompilationCommand`: Check TS compilation
  - `ExecutionFlowCommand`: Validate execution flow
  - `SchemaValidationCommand`: Validate schemas
  - `LLMFlowAlignmentCommand`: Check agent patterns
  - `RuntimeGuardrailsCommand`: Validate runtime protection
  - `ImportExportConsistencyCommand`: Check imports/exports
  - `MethodSignatureCommand`: Validate method signatures
  - `NodeCompatibilityCommand`: Check Node.js compatibility
  - `NamingClarityCommand`: Detect ambiguous naming

### Infrastructure Layer (`src/infrastructure/refactoring/`)

File system operations and external dependencies.

#### file-scanner.ts (300 lines)

- **Purpose**: File system scanning and content reading
- **Key Functions**:
  - `scanFiles()`: Scan files matching patterns
  - `findTypeScriptFiles()`: Find all TS files
  - `findAgentFiles()`: Find agent implementations
  - `safeReadFile()`: Read file with error handling
  - `readFiles()`: Batch read multiple files
  - `batchReadFiles()`: Batch read with progress callback
- **Key Classes**:
  - `FileContentCache`: File content caching with mtime validation
  - `FilePatternScanner`: Pattern-based scanning with TTL caching

## Usage

### Basic Usage

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

### Priority Levels

- **P1**: Critical issues (TypeScript errors, execution flow, schema, LLM flow, guardrails)
- **P2**: Core structure (imports/exports, method signatures, Node.js compatibility)
- **P3**: Maintainability (naming clarity, report formats, release safety)
- **ALL**: Run all priority levels

### Result Structure

```typescript
interface AuditResult {
  findings: Issue[]; // Detected issues
  suggestions: Suggestion[]; // Actionable recommendations
  summary: {
    totalFindings: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
    autoFixable: number;
    categoryCounts: Record<string, number>;
  };
  metadata: {
    duration: number;
    filesScanned: number;
    timestamp: Date;
    config: AuditConfig;
  };
}
```

### Advanced Usage

#### Using Individual Modules

```typescript
// Code analysis only
import * as CodeAnalyzer from "./src/domain/refactoring/code-analyzer";

const metrics = CodeAnalyzer.analyzeCodeMetrics(fileContent);
const guardrails = CodeAnalyzer.analyzeGuardrails(fileContent);

// Issue detection only
import * as IssueDetector from "./src/domain/refactoring/issue-detector";

const issues = IssueDetector.detectMethodSignatureIssues(fileContents);

// Suggestion generation only
import * as SuggestionGenerator from "./src/domain/refactoring/suggestion-generator";

const suggestion = SuggestionGenerator.generateSuggestions(issue);
```

#### File Caching

```typescript
import { FileContentCache } from "./src/infrastructure/refactoring/file-scanner";

const cache = new FileContentCache(process.cwd());

// Cached reads
const content1 = cache.getOrRead("src/file.ts"); // From disk
const content2 = cache.getOrRead("src/file.ts"); // From cache (instant)
```

## Command Pattern Benefits

1. **Extensibility**: Add new audit commands without modifying orchestrator
2. **Testability**: Test each command in isolation
3. **Reusability**: Compose commands for custom workflows
4. **Separation of Concerns**: Each command focuses on one audit type

### Creating Custom Commands

```typescript
import { BaseAuditCommand } from "./src/application/refactoring/audit-orchestrator";

class CustomCommand extends BaseAuditCommand {
  getPriority() {
    return "P1" as const;
  }
  getCategory() {
    return "Custom";
  }

  async execute(): Promise<Issue[]> {
    // Custom audit logic
    return [];
  }
}
```

## Testing

### Unit Tests

```bash
# Test code analyzer
npm run test tests/domain/refactoring/code-analyzer.test.ts

# Test issue detector
npm run test tests/domain/refactoring/issue-detector.test.ts

# Test suggestion generator
npm run test tests/domain/refactoring/suggestion-generator.test.ts
```

### Integration Tests

```bash
# Test full workflow
npm run test tests/integration/refactoring-audit.test.ts
```

### Performance Benchmarks

```bash
# Compare old vs new implementation
npm run tsx scripts/benchmark-refactor-audit.ts
```

## Performance

### Benchmark Results

| Priority | Duration | Memory | Files Scanned |
| -------- | -------- | ------ | ------------- |
| P1       | ~8s      | ~40MB  | ~200 files    |
| P2       | ~5s      | ~30MB  | ~200 files    |
| P3       | ~2s      | ~10MB  | ~200 files    |
| ALL      | ~15s     | ~80MB  | ~200 files    |

### Optimization Features

1. **File Caching**: Reduces disk I/O by 70%
2. **Pattern Caching**: 5-second TTL for glob results
3. **Lazy Loading**: Loads only required modules
4. **Batch Processing**: Optimized file reading

## Module Line Counts

| Module                  | Lines    | Responsibility            |
| ----------------------- | -------- | ------------------------- |
| code-analyzer.ts        | 400      | AST analysis & metrics    |
| issue-detector.ts       | 350      | Problem detection         |
| suggestion-generator.ts | 400      | Recommendation generation |
| file-scanner.ts         | 300      | File system operations    |
| audit-orchestrator.ts   | 350      | Use case orchestration    |
| **Total**               | **1800** | **(vs 1647 monolithic)**  |

## Design Principles Applied

### Domain-Driven Design (DDD)

- **Domain Layer**: Pure business logic, no dependencies
- **Application Layer**: Use case orchestration
- **Infrastructure Layer**: External system interactions

### SOLID Principles

- **Single Responsibility**: Each module has one clear purpose
- **Open/Closed**: Extensible via Command Pattern
- **Liskov Substitution**: All commands implement same interface
- **Interface Segregation**: Focused interfaces per module
- **Dependency Inversion**: Domain doesn't depend on infrastructure

### Design Patterns

- **Command Pattern**: Audit operations as commands
- **Strategy Pattern**: Different suggestion generators per issue type
- **Repository Pattern**: File scanning abstractions
- **Cache Pattern**: File content and pattern caching

## Migration

See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed migration instructions from the old monolithic implementation.

## Future Enhancements

1. **Parallel Execution**: Run independent commands concurrently
2. **Incremental Audits**: Only audit changed files
3. **Auto-fix Engine**: Execute auto-fixable suggestions
4. **Custom Report Formats**: JSON, SARIF, GitHub annotations
5. **VS Code Integration**: Real-time audit results in editor
6. **CI/CD Integration**: GitHub Actions, GitLab CI
7. **Metrics Dashboard**: Web-based visualization

## Contributing

When adding new audit capabilities:

1. **Domain Layer**: Add pure analysis/detection functions
2. **Application Layer**: Create new command class
3. **Infrastructure Layer**: Add file scanning helpers if needed
4. **Tests**: Add unit tests for domain functions
5. **Integration**: Add integration test for full workflow
6. **Documentation**: Update this README and migration guide

## License

See main project LICENSE file.
