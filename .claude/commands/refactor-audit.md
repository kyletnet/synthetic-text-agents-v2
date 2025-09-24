# /refactor-audit

10-Point Structural and Operational Refactoring Audit for LLM-powered QA systems.

## 기능 (Features)

1. **Prioritized Audit**: Execute critical issues first (P0→P1→P2)
2. **Modular Execution**: Run specific priority levels only
3. **Automated Detection**: Smart detection of when audit is needed
4. **Lightweight Reports**: Focused findings without heavy processing
5. **Integration Ready**: Works with existing CI/CD pipeline

## 사용법 (Usage)

```bash
# Full audit (all priorities)
npm run refactor:audit

# Priority-specific audits
npm run refactor:audit:p1    # Critical only
npm run refactor:audit:p2    # High priority only
npm run refactor:audit:p3    # Maintainability only

# Auto-detect mode (runs when needed)
npm run refactor:audit:auto
```

## 검사 항목 (Audit Categories)

### Priority 1: Critical for LLM-Powered QA Systems
1. **Execution Flow Consistency** - Slash/CLI/API/Web interface alignment
2. **Schema Structure Validation** - Config and report format verification
3. **LLM Input/Context Flow Alignment** - Prompt and agent coordination consistency
4. **Runtime Guardrails** - Error boundaries, circuit breakers, fallbacks

### Priority 2: Core Structure and Developer Trust
5. **Import/Export and Type Consistency** - Duplicate types, stale imports
6. **Routing and Directory Integrity** - Route conflicts, directory structure
7. **Slash Command to Execution Mapping** - Command file linkage validation

### Priority 3: Long-Term Maintainability
8. **Naming and Cognitive Clarity** - Module responsibility clarity
9. **Report Format and Output Quality** - Baseline report completeness
10. **Release Safety and Changelog Integrity** - CI/CD flow validation

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