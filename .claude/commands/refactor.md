---
description: Structural refactoring for cross-module improvements (Step 4 of 5-step workflow)
argument-hint: none
allowed-tools: Bash(npm run refactor:*), Bash(/refactor)
---

# /refactor - Structural Refactoring Engine

**Step 4 of 5-step Quality Workflow**

Execute architecture-level refactoring to improve cross-module code structure and eliminate technical debt.

## Usage

```bash
/refactor          # Via bash script
npm run refactor   # Via npm (same command)
```

## What it does

**Handles structural improvements across files:**

1. **Cross-Module Issues**
   - Duplicate export elimination
   - Config file normalization
   - Module boundary violations

2. **Architecture Improvements**
   - Dependency graph optimization
   - Interface consolidation
   - Layer separation enforcement

3. **Technical Debt Reduction**
   - Dead code removal
   - Unused import cleanup
   - Pattern consistency enforcement

4. **Safety-First Approach**
   - Auto-fixes low-risk items
   - Prompts for high-risk changes
   - Rollback support via snapshots

## MECE Separation

**What /refactor handles vs other commands:**

| Command     | Scope                  | Example                           |
| ----------- | ---------------------- | --------------------------------- |
| `/maintain` | Code style             | Prettier formatting, ESLint --fix |
| `/fix`      | Single-file errors     | TypeScript errors, TODO markers   |
| `/refactor` | Cross-file structure   | Duplicate exports, config drift   |
| `/ship`     | System-wide validation | CI/CD, docs sync, deployment      |

**Key distinction:** `/refactor` handles **structural issues** that span multiple files, while `/fix` handles **logical errors** within single files.

## Prerequisites

**MUST complete first:**

```bash
/inspect   # Diagnosis (creates refactoringQueue)
/maintain  # Auto-fixes (style)
/fix       # Manual fixes (errors)
```

**Cache dependency:**

- Reads `inspection-results.json` (30min TTL)
- Reads `.refactor/state.json` for detailed items

## Output Example

```
🔧 Refactor Engine v1.0
════════════════════════════════════════════════════════
📐 Structural Improvement - Architecture-level fixes

🔍 Checking prerequisites...
✅ Prerequisites satisfied

📂 Loading inspection results...

📋 Refactoring Plan:
   Total items: 20

   1. Duplicate export in src/shared/types.ts
   2. Config drift: tsconfig.json vs tsconfig.build.json
   3. Unused import in 5 files
   ... and 17 more items

🚀 Executing smart refactoring...

✅ 15 items auto-fixed
🔶 5 items need confirmation → run /refactor-confirm

✅ Refactoring complete!
💡 Next: Run /inspect to verify changes, then /ship to deploy
```

## Governance Integration

**Full observability:**

- ✅ Preflight checks
- ✅ Before/after snapshots
- ✅ Timeout protection (10 min)
- ✅ Post-execution verification
- ✅ Operation logging

**Rollback support:**

```bash
npm run recovery:rollback
```

## Workflow

```bash
/inspect   → /maintain → /fix → /refactor → /ship
                                     ↓
                                (Structure)
```

## Success Criteria

- ✅ No duplicate exports
- ✅ Config files normalized
- ✅ Module boundaries enforced
- ✅ Unused imports removed
- ✅ All auto-fixes applied safely

## Next Steps

After `/refactor`:

1. Run `/inspect` to verify no new issues
2. Review changes with `git diff`
3. Run tests: `npm run test`
4. Deploy: `/ship`

**IMPORTANT:** This is a **structural** improvement step. Only run when ready to address architecture-level issues!

_Last updated: 2025-10-01_
