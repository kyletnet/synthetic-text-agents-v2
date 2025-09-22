# Development Onboarding Guide

## 🚀 Quick Start (1 Command Setup)

```bash
# Clone and setup everything automatically
git clone <repository-url>
cd synthetic-text-agents-v2
bash scripts/setup-dev-environment.sh
```

This single command:
- ✅ Installs all dependencies
- ✅ Sets up development environment
- ✅ Configures automatic code standards enforcement
- ✅ Validates all configurations
- ✅ Sets up Git hooks for quality gates

## 🛡️ Automatic Standards Enforcement

### Pre-commit Hooks (Always Active)
Every commit automatically:
- Runs TypeScript strict checking
- Enforces ESLint rules
- Auto-fixes code formatting with Prettier
- Validates import standards
- Blocks console.log usage (except CLI)
- Scans for security issues
- Checks shell script standards

### VSCode Integration (Auto-configured)
- Format on save enabled
- ESLint auto-fix on save
- TypeScript strict mode
- Organized imports
- Consistent terminal settings

## 🎯 Coding Standards (Auto-Enforced)

### TypeScript Standards
```typescript
// ✅ GOOD - Proper typing
function processData(input: string): Promise<QAResponse> {
  return orchestrator.processRequest({ topic: input });
}

// ❌ BAD - Will be blocked by pre-commit
function processData(input: any): any {
  return orchestrator.processRequest(input);
}
```

### Import Standards
```typescript
// ✅ GOOD - Consistent .js extensions
import { BaseAgent } from '../core/baseAgent.js';
import { Logger } from '../shared/logger.js';

// ❌ BAD - Will be flagged
import { BaseAgent } from '../core/baseAgent';
```

### Error Handling Standards
```typescript
// ✅ GOOD - Use standardized errors
import { AgentSystemError, ErrorCode } from '../shared/errors.js';

throw new AgentSystemError(
  ErrorCode.AGENT_EXECUTION_FAILED,
  'Agent failed to process request',
  { agentId: 'qa-generator', context: { topic } }
);

// ❌ BAD - Generic errors
throw new Error('Something went wrong');
```

### Logging Standards
```typescript
// ✅ GOOD - Use Logger
import { Logger } from '../shared/logger.js';
const logger = new Logger();
logger.info('Processing request', { topic, complexity });

// ❌ BAD - Will be blocked by pre-commit (except CLI)
console.log('Processing request');
```

## 🌐 Platform Deployment (Pre-configured)

### Replit
- ✅ `.replit` configured for modules-based deployment
- ✅ `main.sh` with proper error handling
- ✅ Environment variables template

### Vercel
- ✅ `vercel.json` with serverless function support
- ✅ Build configuration for TypeScript
- ✅ Environment variable management

### Netlify
- ✅ `netlify.toml` with function deployment
- ✅ Headers and redirects configured
- ✅ Preview environment settings

### Docker
- ✅ `Dockerfile` with multi-stage builds
- ✅ `docker-compose.yml` for local development
- ✅ Health checks and monitoring

## 🔄 Documentation Auto-Sync

### Ship Command Integration
```bash
npm run ship
```
This command:
1. Runs full CI/CD pipeline
2. Updates all documentation
3. Syncs system maps
4. Validates observability
5. Exports final package

### GitHub Actions
- Auto-updates documentation on code changes
- Validates all standards in CI
- Prevents merging of non-compliant code

## 👥 Multi-Developer Workflow

### Standards Override Prevention
The system automatically enforces standards regardless of:
- Individual developer preferences
- IDE configurations
- Local environment differences
- Coding style variations

### Conflict Resolution
When multiple developers work:
1. Pre-commit hooks ensure consistency
2. ESLint auto-fixes formatting conflicts
3. TypeScript strict mode prevents type issues
4. Import organization reduces merge conflicts

## 🆘 Troubleshooting

### Pre-commit Hook Blocked My Commit
```bash
# Check what failed
git commit -v

# Fix TypeScript issues
npm run typecheck

# Fix linting issues
npm run lint:fix

# Check for console.log usage
grep -r "console\." src/ --exclude-dir=cli

# Try commit again
git commit
```

### Environment Issues
```bash
# Reset environment
rm -rf node_modules package-lock.json
npm install
bash scripts/setup-dev-environment.sh
```

### Platform Deployment Issues
```bash
# Verify all configurations
npm run ci:strict

# Check platform-specific configs
npm run verify:handoff
npm run verify:export
```

## 📞 Getting Help

1. **Check Standards**: Read `CLAUDE.md` for complete standards
2. **Run Diagnostics**: `npm run guard:all`
3. **View Logs**: Check `logs/` directory for detailed traces
4. **Reset Environment**: Re-run `scripts/setup-dev-environment.sh`

## 🔧 Advanced Configuration

### Custom ESLint Rules
Edit `eslint.config.js` - changes are enforced automatically

### Additional Pre-commit Checks
Edit `.githooks/pre-commit` to add project-specific validations

### Platform-Specific Settings
- Replit: Edit `.replit` and `main.sh`
- Vercel: Edit `vercel.json`
- Netlify: Edit `netlify.toml`
- Docker: Edit `Dockerfile` and `docker-compose.yml`

---

**The system is designed to maintain consistency and quality automatically, allowing developers to focus on building features rather than managing configurations.**