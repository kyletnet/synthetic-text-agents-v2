#!/usr/bin/env bash
set -Eeuo pipefail

# Synthetic Text Agents v2 - Complete System Documentation Generator
# Generates comprehensive documentation for system understanding

echo "📚 Generating complete system documentation..."

# Color helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in project root directory${NC}"
    exit 1
fi

# Create documentation directories
mkdir -p docs/SYSTEM_DOCS/{modules,architecture,operations,development}

print_section() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# 1. Generate Module Documentation
print_section "Generating module documentation..."

# Core modules
cat > docs/SYSTEM_DOCS/modules/README.md << 'EOF'
# System Modules Overview

## Core Architecture Modules

### `/src/core/` - System Core
- **orchestrator.ts**: Main system orchestrator, coordinates all agents
- **baseAgent.ts**: Abstract base class for all agents
- **metaController.ts**: Strategic decision-making and complexity analysis
- **performanceGuardian.ts**: Performance monitoring and optimization

### `/src/agents/` - Agent Implementations
- **qaGenerator.ts**: Q&A pair generation with LLM integration
- **qualityAuditor.ts**: Multi-level quality assessment
- **promptArchitect.ts**: Prompt optimization and engineering
- **psychologySpecialist.ts**: User psychology and communication
- **linguisticsEngineer.ts**: Language structure optimization
- **domainConsultant.ts**: Domain-specific expertise
- **cognitiveScientist.ts**: Expert thinking process modeling

### `/src/shared/` - Shared Infrastructure
- **types.ts**: All TypeScript interfaces and types
- **logger.ts**: Centralized logging system
- **registry.ts**: Agent registration and discovery
- **errors.ts**: Standardized error handling
- **env.ts**: Environment variable management

### `/src/clients/` - External Integrations
- **anthropicAdapter.ts**: Anthropic Claude API integration
- **llmAdapter.ts**: Unified LLM interface

### `/src/utils/` - Utility Functions
- **cost.ts**: Cost calculation and tracking
- **log.ts**: Log formatting utilities

## Agent Communication Flow

```mermaid
graph TD
    A[orchestrator.ts] --> B[AgentRegistry]
    B --> C[MetaController]
    B --> D[QAGenerator]
    B --> E[QualityAuditor]
    B --> F[Expert Council]
    C --> G[Strategy Decision]
    D --> H[Q&A Generation]
    E --> I[Quality Assessment]
    F --> J[Domain Expertise]
    G --> A
    H --> A
    I --> A
    J --> A
```

## Inter-Module Dependencies

- **Core → Shared**: Uses types, logger, registry
- **Agents → Core**: Extends BaseAgent
- **Agents → Shared**: Uses logger, types, errors
- **Clients → Shared**: Uses env, logger
- **Utils → Shared**: Uses types, logger
EOF

# 2. Generate Architecture Documentation
print_section "Generating architecture documentation..."

cat > docs/SYSTEM_DOCS/architecture/SYSTEM_OVERVIEW.md << 'EOF'
# System Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Synthetic Text Agents v2                │
├─────────────────────────────────────────────────────────────┤
│  CLI/API Interface                                          │
├─────────────────────────────────────────────────────────────┤
│  Orchestrator (Main Controller)                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Core Engine   │  │ Expert Council  │                   │
│  │                 │  │                 │                   │
│  │ • MetaController│  │ • Psychology    │                   │
│  │ • QAGenerator   │  │ • Linguistics   │                   │
│  │ • QualityAuditor│  │ • Domain Expert │                   │
│  │ • PromptArchitect│ │ • Cognitive Sci │                   │
│  └─────────────────┘  └─────────────────┘                   │
├─────────────────────────────────────────────────────────────┤
│  Shared Infrastructure                                      │
│  • Agent Registry  • Logger  • Error Handler  • Types     │
├─────────────────────────────────────────────────────────────┤
│  External Integrations                                     │
│  • Anthropic Claude  • LLM Adapters  • Cost Tracking     │
└─────────────────────────────────────────────────────────────┘
```

## Agent Orchestration Pattern

1. **Request Reception**: CLI/API receives QA generation request
2. **Complexity Analysis**: MetaController analyzes task complexity (1-10)
3. **Agent Selection**: Dynamic selection of 5-8 agents based on requirements
4. **Parallel Execution**: Agents work concurrently with shared memory
5. **Result Compilation**: Orchestrator extracts and formats Q&A pairs
6. **Quality Assessment**: Multi-level quality scoring and validation

## Data Flow Architecture

```
Input Request
     ↓
[Orchestrator] ← → [MetaController] (Strategy)
     ↓
[Agent Council] ← → [Shared Memory]
     ↓
[QA Generator] → [Quality Auditor]
     ↓
[Result Compilation]
     ↓
Formatted Output
```

## Error Handling Strategy

- **Graceful Degradation**: System continues if individual agents fail
- **Circuit Breaker**: Automatic fallback for repeated failures
- **Centralized Logging**: All errors logged with context
- **Type Safety**: TypeScript strict mode prevents runtime errors
EOF

# 3. Generate Operations Documentation
print_section "Generating operations documentation..."

cat > docs/SYSTEM_DOCS/operations/DEPLOYMENT_GUIDE.md << 'EOF'
# Deployment & Operations Guide

## Platform Deployments

### Replit Deployment
```bash
# Files: .replit, main.sh
npm install && npm run build && npm run dev
```
- Uses modules-based approach (no nix)
- Environment variables via .env
- Auto-restart on file changes

### Vercel Deployment
```bash
# File: vercel.json
vercel deploy
```
- Serverless functions support
- API routes: /api/health, /api/generate
- Environment variables in dashboard

### Netlify Deployment
```bash
# File: netlify.toml
netlify deploy
```
- Function deployment
- Headers and redirects configured
- Preview environment support

### Docker Deployment
```bash
# Files: Dockerfile, docker-compose.yml
docker-compose up
```
- Multi-stage builds
- Health checks included
- Production-ready configuration

## Environment Configuration

### Required Environment Variables
```bash
# Feature Flags
FEATURE_LLM_QA=false      # Enable/disable LLM integration
DRY_RUN=true              # Run without API calls

# LLM Configuration
OPENAI_API_KEY=           # OpenAI API key (optional)
LLM_MODEL=gpt-4o-mini     # Default model
LLM_TIMEOUT_MS=20000      # Request timeout
LLM_MAX_RETRIES=1         # Retry attempts
LLM_COST_CAP_USD=2        # Cost limit per session
```

## Monitoring & Observability

### Log Locations
- **Application Logs**: `logs/*.jsonl`
- **Performance Metrics**: Embedded in logs
- **Error Traces**: Structured error context

### Health Checks
```bash
# Basic health check
npm run smoke

# Full system validation
npm run ci:strict

# Performance monitoring
npm run guard:all
```

## Scaling Considerations

### Agent Performance
- Each agent runs asynchronously
- Shared memory prevents duplicate work
- Timeout handling prevents hanging

### Resource Management
- Memory usage monitored per agent
- Cost tracking prevents overspend
- Token usage logged for optimization

## Troubleshooting

### Common Issues
1. **Build Failures**: Run `npm run typecheck`
2. **Agent Timeouts**: Check network connectivity
3. **Quality Issues**: Review agent configuration
4. **Cost Overruns**: Adjust LLM_COST_CAP_USD

### Debug Commands
```bash
npm run dev          # Development mode
npm run test         # Run test suite
npm run lint:fix     # Fix code issues
npm run guard:env    # Check environment
```
EOF

# 4. Generate Development Documentation
print_section "Generating development documentation..."

cat > docs/SYSTEM_DOCS/development/DEVELOPER_REFERENCE.md << 'EOF'
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
EOF

# 5. Generate System Discovery Index
print_section "Generating system discovery index..."

cat > docs/SYSTEM_DOCS/README.md << 'EOF'
# 🔍 Synthetic Text Agents v2 - Complete System Discovery

> **Quick Start for New Developers**: Run `bash scripts/setup-dev-environment.sh` for instant setup

## 📋 Essential Documentation for System Understanding

### 🏗️ Architecture & Design
- **[System Overview](architecture/SYSTEM_OVERVIEW.md)** - High-level architecture, data flow, patterns
- **[Module Reference](modules/README.md)** - All modules, dependencies, communication flow
- **[Technical Architecture Guide](../technical_architecture_guide.md)** - Detailed technical specifications

### 🚀 Operations & Deployment
- **[Deployment Guide](operations/DEPLOYMENT_GUIDE.md)** - All platforms (Replit, Vercel, Netlify, Docker)
- **[Operations Brief](../OPS_BRIEF.md)** - Production operations and monitoring
- **[Final Handoff Checklist](../FINAL_HANDOFF_CHECKLIST.md)** - Deployment readiness

### 👨‍💻 Development
- **[Developer Reference](development/DEVELOPER_REFERENCE.md)** - Complete development guide
- **[Development Onboarding](../../DEVELOPMENT_ONBOARDING.md)** - Automated setup and standards
- **[TypeScript Guidelines](../TYPESCRIPT_GUIDELINES.md)** - Code quality standards

### 📚 Project Context
- **[CLAUDE.md](../../CLAUDE.md)** - Main project specification and standards
- **[System Blueprint](../system_blueprint.md)** - Project vision and goals
- **[Product Plan](../PRODUCT_PLAN.md)** - Roadmap and feature planning

## 🔧 System Understanding Commands

### Complete Documentation Sync
```bash
# Generate/update all system documentation
npm run docs:sync

# Quick system status
npm run docs:status

# Full system map
npm run system:map
```

### Development Environment
```bash
# One-command setup for new developers
bash scripts/setup-dev-environment.sh

# Verify everything is working
npm run ci:strict

# Start development
npm run dev
```

### System Validation
```bash
# Complete system health check
npm run guard:all

# Check documentation freshness
npm run docs:status

# Validate all configurations
npm run verify:all
```

## 🧩 Module Quick Reference

| Module | Purpose | Key Files |
|--------|---------|-----------|
| **Core** | System orchestration | `orchestrator.ts`, `baseAgent.ts`, `metaController.ts` |
| **Agents** | AI agent implementations | `qaGenerator.ts`, `qualityAuditor.ts`, `*Specialist.ts` |
| **Shared** | Infrastructure & utilities | `types.ts`, `logger.ts`, `registry.ts`, `errors.ts` |
| **Clients** | External integrations | `anthropicAdapter.ts`, `llmAdapter.ts` |
| **Scripts** | Build & deployment | `setup-dev-environment.sh`, `generate-system-docs.sh` |

## 🌐 Platform Deployment Status

| Platform | Status | Config File | Command |
|----------|--------|-------------|---------|
| **Replit** | ✅ Ready | `.replit`, `main.sh` | Auto-deploy on push |
| **Vercel** | ✅ Ready | `vercel.json` | `vercel deploy` |
| **Netlify** | ✅ Ready | `netlify.toml` | `netlify deploy` |
| **Docker** | ✅ Ready | `Dockerfile`, `docker-compose.yml` | `docker-compose up` |

## 🔄 Documentation Sync Process

The system automatically maintains documentation consistency:

1. **Code Changes** → Triggers documentation updates
2. **`npm run ship`** → Full CI/CD with doc sync
3. **GitHub Actions** → Auto-updates on push
4. **`npm run docs:sync`** → Manual sync all documentation

## 🆘 Need Help?

1. **Quick Issues**: Run `npm run guard:all` for system diagnostics
2. **Development Setup**: Use `bash scripts/setup-dev-environment.sh`
3. **Documentation**: All docs auto-update with `npm run docs:sync`
4. **System Understanding**: Start with this README, then architecture docs

---

**💡 Pro Tip**: Bookmark this README - it's your central hub for understanding and working with the entire system!
EOF

print_success "System documentation generated"

# 6. Update package.json with new commands
print_section "Adding documentation sync commands..."

# Check if docs:sync already exists
if ! grep -q "docs:sync" package.json; then
    # Use a temporary file for JSON manipulation
    node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

    // Add new scripts
    pkg.scripts = {
        ...pkg.scripts,
        'docs:sync': 'bash scripts/generate-system-docs.sh && npm run docs:refresh',
        'docs:status': 'bash scripts/check-docs-freshness.sh',
        'system:map': 'npm run docs:systemmap && echo \"📍 System map generated in docs/SYSTEM_ARCHITECTURE_MAP.md\"',
        'verify:all': 'npm run typecheck && npm run lint && npm run test && npm run guard:all'
    };

    fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "
    print_success "Added documentation sync commands to package.json"
fi

# 7. Create docs freshness checker
print_section "Creating documentation freshness checker..."

cat > scripts/check-docs-freshness.sh << 'EOF'
#!/usr/bin/env bash
set -euo pipefail

echo "📊 Checking documentation freshness..."

# Check if key files are newer than documentation
DOCS_DIR="docs/SYSTEM_DOCS"
STALE_FOUND=0

# Key source directories to monitor
SOURCE_DIRS=("src/core" "src/agents" "src/shared" "CLAUDE.md" "package.json")

if [ -d "$DOCS_DIR" ]; then
    for src in "${SOURCE_DIRS[@]}"; do
        if [ -e "$src" ]; then
            if [ "$src" -nt "$DOCS_DIR/README.md" ]; then
                echo "⚠️  $src is newer than system docs"
                STALE_FOUND=1
            fi
        fi
    done
else
    echo "❌ System documentation not found"
    STALE_FOUND=1
fi

if [ $STALE_FOUND -eq 1 ]; then
    echo ""
    echo "🔄 Run 'npm run docs:sync' to update documentation"
    exit 1
else
    echo "✅ Documentation is up to date"
fi
EOF

chmod +x scripts/check-docs-freshness.sh

print_success "Documentation freshness checker created"
print_success "System documentation generation complete!"

echo ""
echo -e "${PURPLE}📚 System Documentation Generated:${NC}"
echo "   • Complete system overview and architecture"
echo "   • Module documentation with dependencies"
echo "   • Development reference guide"
echo "   • Operations and deployment guide"
echo "   • Automated documentation sync system"
echo ""
echo -e "${BLUE}🔧 New Commands Available:${NC}"
echo "   npm run docs:sync     # Generate/update all documentation"
echo "   npm run docs:status   # Check documentation freshness"
echo "   npm run system:map    # Generate system architecture map"
echo "   npm run verify:all    # Complete system validation"
echo ""
echo -e "${GREEN}📍 Main Documentation Entry Point:${NC}"
echo "   docs/SYSTEM_DOCS/README.md"