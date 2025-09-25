# /refactor-audit

**Smart Hybrid Refactor System** - Intelligent code analysis with automated fixes and guided confirmations.

## 🎯 Core Features

- **🤖 Smart Automation**: Auto-fixes safe issues (docs, imports, formatting)
- **🔶 Guided Confirmation**: Interactive review for structural changes
- **🧠 AI Learning System**: Adapts safety criteria based on error patterns (NEW!)
- **🔄 Rollback Support**: Safe recovery from any changes
- **📊 Context Recovery**: Resume interrupted sessions seamlessly
- **🎯 Pattern-Based Suggestions**: Learn from TypeScript errors and fix history (NEW!)
- **🔗 Integration**: Works with `/fix` command for comprehensive automation (NEW!)

## 사용법 (Usage)

### Main Commands (All You Need!)

```bash
# 1. Full AI-Enhanced Audit + Auto-fix
/refactor-audit

# 2. Learn from error patterns + suggest improvements
/refactor-audit --learn

# 3. Review items needing confirmation
/refactor-confirm

# 4. Get AI-powered next action recommendation
/refactor-next
```

### Advanced Options

```bash
# Simulation mode (no changes)
/refactor-audit --simulate

# Rollback last changes
/refactor-audit --rollback

# View system status + AI insights
/refactor-summary

# Pattern learning mode
/refactor-audit --learn

# Get smart suggestions based on error history
/refactor-suggest

# Integration with AI fix engine
/refactor-audit --with-fix    # Run audit + auto-fix TypeScript errors
```

## 🧠 NEW: AI-Enhanced Features

### Pattern Learning Integration

- **Auto-Learn**: Analyzes TypeScript compilation errors and fix success rates
- **Smart Suggestions**: Recommends refactoring based on recurring error patterns
- **Confidence Scoring**: Prioritizes suggestions by success probability
- **Context Awareness**: Understands your codebase patterns and conventions

### AI-Powered Next Actions

```
🎯 Smart Recommendations (based on your project):
   1. Fix 18 TypeScript errors (94% success rate) → /fix
   2. Update 4 stale documents → npm run docs:audit
   3. Refactor pluginLoader.ts (complexity: HIGH) → guided review
   4. Optimize import structure → 10% build time improvement
```

## 검사 항목 (Audit Categories)

### Priority 1: Critical for LLM-Powered QA Systems

1. **Execution Flow Consistency**
   - Ensure slash commands, CLI scripts, API routes, and web interfaces all invoke the same core logic (e.g. runCouncil, baseline, reproduce).
   - Identify any silent divergences or dead execution branches.

2. **Schema Structure Validation**
   - Validate that configuration and report files (e.g. baseline_config.json, baseline_report.jsonl, output.jsonl) follow expected key and structure formats.
   - Compare against TypeScript types (e.g. coverage_metrics.ts) or defined JSONSchemas.

3. **LLM Input/Context Flow Alignment**
   - Verify that prompts, context injection, and agent coordination are consistent across runs.
   - Ensure that evaluation flows reflect the actual user-provided or synthetic data.

4. **Runtime Guardrails**
   - Detect missing error boundaries, circuit breakers, fallback logic, timeouts, and safety defaults.

### Priority 2: Core Structure and Developer Trust

5. **Import/Export and Type Consistency**
   - Identify mismatched imports, duplicate types, redundant utility functions, and stale npm scripts.

6. **Routing and Directory Integrity**
   - Ensure app/api vs pages/api routes are not conflicting.
   - Validate test and report directory structures (e.g. seed, regression, smoke).

7. **Slash Command to Execution Mapping**
   - Confirm that every .claude/commands/\*.md is linked to a valid, executable command file and properly configured for Cursor session persistence.

### Priority 3: Long-Term Maintainability

8. **Naming and Cognitive Clarity**
   - Evaluate whether developers and LLMs can intuitively understand module responsibilities and naming consistency (e.g. AgentRunner vs AgentCoordinator).

9. **Report Format and Output Quality**
   - Verify that baseline reports and evaluation outputs contain all expected keys with correct formats (e.g. evidence, confidence, qtype, etc).

10. **Release Safety and Changelog Integrity**
    - Audit GitHub Actions release flows, semantic version tagging, changelog generation, and publish step consistency.

## 자동화 조건 (Auto-Trigger Conditions)

- After significant architectural changes
- Before major releases (pre-ship)
- When test failure rates exceed 10%
- After dependency updates
- Weekly scheduled maintenance

## 출력 (Output)

- Ranked findings by priority (High/Medium/Low)
- Broken/misaligned structural elements
- Refactoring recommendations with impact assessment
- Integration with existing reporting systems
