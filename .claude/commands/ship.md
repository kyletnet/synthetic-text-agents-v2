---
description: Full deployment pipeline with validation, docs sync, and git push (Step 4 of 4-step workflow)
argument-hint: none
allowed-tools: Bash(npm run ship:*), Bash(/ship)
---

# /ship - Full Deployment Pipeline + Deploy

**Step 4 of 4-step Quality Workflow**

Complete deployment process: validation → documentation → optimization → commit → push

## Usage

```bash
/ship             # Via bash script (full pipeline + deploy)
npm run ship      # Via npm (validation + docs only, no deploy)
```

## What it does

**3-Phase Deployment Process:**

### Phase 1: Pre-ship Validation

- Cleanup old files
- Update command references
- Prepare release artifacts

### Phase 2: Ship Pipeline (npm run ship)

1. Design principles validation (`design:validate`)
2. System validation (`validate`)
3. Verification checks (`verify`)
4. Integration guard (`_hidden:integration-guard`)
5. System integration analysis (`_hidden:system-integration`)
6. Advanced audit (`advanced:audit`)
7. Documentation sync (`docs:refresh`)
8. Optimization analysis (`optimize:analyze`)

### Phase 3: Deploy

- Auto-commit all changes with timestamp
- Push to remote repository
- Create deployment record

## Prerequisites

**MUST complete first:**

```bash
/inspect   # Diagnosis
/maintain  # Auto-fixes
/fix       # Manual fixes
```

## Success Criteria

- ✅ TypeScript: 0 errors
- ✅ Tests: All passing
- ✅ Design principles: Validated
- ✅ Documentation: Synced
- ✅ Security: No P0/P1 issues

## Output

```
🚢 Deployment complete! Changes pushed to remote.
```

## Workflow

```bash
/inspect   → /maintain → /fix → /ship
                                  ↓
                            (Deploy to prod)
```

**IMPORTANT**: This is the final step. Only run when ready to deploy!

_Last updated: 2025-10-01_
