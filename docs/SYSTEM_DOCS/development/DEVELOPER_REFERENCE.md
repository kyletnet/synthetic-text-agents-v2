# Developer Reference Guide

## Quick Start for New Developers

### 1. Environment Setup (One Command)
```bash
bash scripts/setup-dev-environment.sh
```
This automatically:
- Installs all dependencies
- Sets up Git hooks for quality gates
- Configures VSCode settings
- Creates development directories
- Validates all configurations

### 2. Understanding the Codebase

#### Module Responsibilities
```typescript
// Core orchestration
src/core/orchestrator.ts    // Main system controller
src/core/baseAgent.ts       // Agent base class
src/core/metaController.ts  // Strategy and complexity analysis

// Agent implementations
src/agents/qaGenerator.ts   // Q&A generation
src/agents/qualityAuditor.ts // Quality assessment
src/agents/*Specialist.ts   // Expert council members

// Infrastructure
src/shared/registry.ts      // Agent discovery
src/shared/logger.ts        // Centralized logging
src/shared/types.ts         // Type definitions
```

#### Adding New Agents

1. **Create Agent Class**
```typescript
import { BaseAgent } from '../core/baseAgent.js';

export class MyAgent extends BaseAgent {
  constructor() {
    super('my-agent', 'MyAgent', ['tag1', 'tag2'], new Logger());
  }

  protected async handle(content: unknown, context?: AgentContext): Promise<unknown> {
    // Implementation here
    return { result: 'agent output' };
  }
}
```

2. **Register Agent**
```typescript
// In src/shared/registry.ts
import { MyAgent } from '../agents/myAgent.js';

// Add to constructor
this.register(new MyAgent());
```

3. **Update Orchestrator**
```typescript
// In src/core/orchestrator.ts
// Add to selectAgents() method based on requirements
```

### 3. Development Standards (Auto-Enforced)

#### Pre-commit Hooks
Every commit automatically:
- Runs TypeScript compilation
- Fixes ESLint issues
- Validates import standards
- Checks for console.log usage
- Scans for security issues

#### Code Patterns
```typescript
// ✅ Good: Proper error handling
import { AgentSystemError, ErrorCode } from '../shared/errors.js';

throw new AgentSystemError(
  ErrorCode.AGENT_EXECUTION_FAILED,
  'Agent processing failed',
  { agentId: this.id, context: { input } }
);

// ✅ Good: Logging with context
this.logger.info('Processing request', {
  agentId: this.id,
  complexity,
  timestamp: new Date().toISOString()
});

// ✅ Good: Type safety
interface QARequest {
  topic: string;
  complexity: number;
  count: number;
}
```

### 4. Testing Strategy

#### Unit Tests
```bash
npm run test:watch    # Watch mode for development
npm run test          # Full test suite
```

#### Integration Tests
```bash
npm run ci:strict     # Full CI pipeline
npm run smoke         # Quick smoke tests
```

#### Quality Gates
```bash
npm run typecheck     # TypeScript validation
npm run lint          # Code quality
npm run guard:all     # Security and environment
```

### 5. Debugging & Troubleshooting

#### Debug Commands
```bash
# Development server with hot reload
npm run dev

# Check specific issues
npm run guard:env          # Environment problems
npm run verify:obs         # Observability issues
npm run taxo:check         # Taxonomy compliance
```

#### Log Analysis
```bash
# View recent logs
ls -la logs/
tail -f logs/*.jsonl | jq .    # Pretty print JSON logs

# Find specific issues
grep -r "ERROR" logs/
grep -r "agent.*failed" logs/
```

### 6. Performance Optimization

#### Agent Performance
- Monitor agent execution time in logs
- Check memory usage patterns
- Optimize shared memory usage
- Review timeout configurations

#### System Performance
- Use Performance Guardian metrics
- Monitor cost per request
- Track token usage efficiency
- Analyze quality vs. speed tradeoffs

### 7. Contributing Guidelines

#### Before Submitting PRs
1. All tests must pass: `npm run ci:strict`
2. Documentation updated if needed
3. No console.log in production code
4. Proper error handling implemented
5. Type definitions updated

#### Code Review Checklist
- [ ] TypeScript strict mode compliance
- [ ] Proper error handling
- [ ] Logging with appropriate context
- [ ] Test coverage for new features
- [ ] Documentation updates
- [ ] Performance impact considered

## Architecture Decision Records (ADRs)

For major changes, create ADRs in `docs/ADR-YYYYMMDD-description.md`:

```markdown
# ADR-YYYYMMDD: Title

## Status
Proposed/Accepted/Deprecated

## Context
What is the issue motivating this decision?

## Decision
What is the change we're proposing?

## Consequences
What becomes easier or more difficult?
```
