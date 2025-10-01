# 🔄 Complete Workflow Guide

**Purpose**: Step-by-step guide for daily development workflow

---

## 🎯 Quick Start: The 4-Command Workflow

```bash
1. /inspect     # Diagnose (creates Single Source of Truth)
2. /maintain    # Auto-fix (no approval needed)
3. /fix         # Manual fixes (approval required)
4. /ship        # Deploy (final validation + push)
```

**진행 표시**: ✅ 모든 명령어가 Todo 리스트로 진행 상태 표시됨

---

## 📊 Workflow Decision Tree

```
Start Working
    ↓
[Run /inspect] ────→ Health Score?
    ↓                    ↓
    |              < 80? Fix issues first
    |              ≥ 80? Continue
    ↓
Auto-fixable items? ───→ Yes → [Run /maintain]
    |                              ↓
    No                        Success? → Continue
    ↓                            ↓
Manual items? ─────────→ Yes → [Run /fix]
    |                              ↓
    No                        All fixed? → Continue
    ↓
Need refactoring? ─────→ Yes → [Run /refactor]
    |                              ↓
    No                        P0 violations? → Rollback
    ↓
Ready to ship? ────────→ Yes → [Run /ship]
                                   ↓
                              Success? → Done! 🎉
```

---

## 1️⃣ /inspect - System Diagnosis

### Purpose

Creates **Single Source of Truth** for system health

### When to Run

- ✅ Start of every work session
- ✅ Before making changes
- ✅ After major changes
- ✅ Before running /fix or /refactor

### What It Does

```bash
npm run status
# or
/inspect
```

**Checks** (Parallel execution, ~2 minutes):

1. ✅ TypeScript compilation
2. ✅ ESLint validation
3. ✅ Prettier formatting
4. ✅ Test suite
5. ✅ Security scan
6. ✅ **Architecture validation** (NEW!)
7. ✅ Workarounds/TODOs
8. ✅ Documentation gaps
9. ✅ Refactoring queue

**Output**:

- `reports/inspection-results.json` (30-min TTL)
- Health Score (0-100)
- Classified issues:
  - Auto-fixable (for /maintain)
  - Manual approval (for /fix)

**Governance**:

- ✅ Snapshot: Yes (audit trail)
- ❌ Verification: No (read-only)

**진행 표시**:

```
🔍 System Inspection Engine v2.0
═══════════════════════════════════════════════════
📋 Single Source of Truth - Creating comprehensive diagnosis

⚡ Phase 1: Running Diagnostics...
   🚀 Running diagnostics in parallel...
   📊 Checking: Prettier, ESLint, TypeScript, Tests,
               Security, Architecture, Workarounds,
               Documentation, Refactoring
   ⏳ This may take 30-60 seconds...

   ✅ All checks complete!

📊 Inspection Results
═══════════════════════════════════════════════════
🟢 Overall Health Score: 85/100
...
```

### Next Steps

- **Health ≥ 80**: Continue to /maintain
- **Health < 80**: Review issues, fix critical ones first
- **P0 violations**: Fix immediately (blocking)

---

## 2️⃣ /maintain - Automatic Maintenance

### Purpose

Auto-fix **cosmetic issues** without approval

### When to Run

- ✅ After /inspect shows auto-fixable items
- ✅ Before committing
- ✅ As pre-commit hook (optional)

### What It Does

```bash
npm run maintain
# or
/maintain
```

**Auto-Applies** (No approval):

- ✅ Prettier formatting
- ✅ ESLint --fix (safe rules)
- ✅ Design pattern validation

**Governance**:

- ✅ Snapshot: Yes (before changes)
- ✅ Verification: Yes (after changes)
- ✅ Auto-rollback: If verification fails

**진행 표시**:

```
🔧 Maintenance Engine v2.0
═══════════════════════════════════════════════════
📋 Reading inspection results...
✅ Using inspection results from 2 minutes ago

🔍 Governance: Preflight checks for "maintain"
📸 Governance: Capturing before snapshot
⚡ Governance: Executing "maintain"

✨ Auto-fixable Items (3 found):
   1. 📝 Running: npx prettier --write .
      ✓ Formatted 12 files
   2. 🎨 Running: npm run lint:fix
      ✓ Fixed 5 issues
   3. 🏛️  Running: npm run design:validate
      ✓ Validated patterns

📸 Governance: Capturing after snapshot
🔍 Governance: Verifying changes
✅ Governance: "maintain" completed successfully

✅ All automatic fixes applied!
💡 Next: Run /inspect to verify, then /fix for manual items
```

### Safety

- **High**: Only mechanical fixes
- **Reversible**: Snapshot + rollback available
- **Verified**: Post-execution validation

---

## 3️⃣ /fix - Manual Fixes

### Purpose

Fix issues that **require human judgment**

### When to Run

- ✅ After /maintain completes
- ✅ When manual approval items remain
- ✅ For TypeScript errors
- ✅ For TODO/workaround resolution

### What It Does

```bash
npm run fix
# or (non-interactive mode)
npm run fix -- --non-interactive
```

**Interactive Mode** (Default):

- Shows one item at a time
- Asks for approval
- Applies if approved
- Skips if rejected

**Non-Interactive Mode** (AI/CI):

- Lists all items
- No changes applied
- For review only

**Handles**:

- ⚠️ TypeScript errors
- ⚠️ Workarounds/TODOs
- ⚠️ Documentation gaps
- ⚠️ Component violations

**Governance**:

- ✅ Snapshot: Yes
- ✅ Verification: Yes
- ✅ Approval Required: Yes
- ✅ Rollback: On verification failure

**진행 표시**:

```
⚙️  Fix Engine v2.0 - Manual Approval Mode
═══════════════════════════════════════════════════
📋 Checking inspection results...
✅ Using inspection results from 5 minutes ago

⚠️  Found 3 items needing approval

🔍 Governance: Preflight checks for "fix"
📸 Governance: Capturing before snapshot
⚡ Governance: Executing "fix"

─────────────────────────────────────────────────
Item 1/3: 🔴 TypeScript Error in src/agents/qa.ts

Description: Property 'validate' does not exist on type 'Agent'
Impact: Build failure - cannot compile
Suggested Fix: Add validate() method to Agent interface

📋 Options:
  [y] Apply fix
  [n] Skip this item
  [q] Quit

→ Your choice: y

✅ Applied fix: Added validate() method
✓ Verified: TypeScript compilation passed

─────────────────────────────────────────────────
Item 2/3: 🟡 TODO marker in src/core/processor.ts
...

📸 Governance: Capturing after snapshot
🔍 Governance: Verifying changes
✅ Governance: "fix" completed successfully

📊 Summary:
   Applied: 2
   Skipped: 1
   Success Rate: 100%

💡 Next: Run /inspect to verify, or /ship if ready
```

---

## 4️⃣ /refactor - Structural Improvements

### Purpose

Apply **cross-module refactoring** safely

### When to Run

- ✅ When refactoring queue has items
- ✅ For structural improvements
- ✅ To consolidate duplicates
- ⚠️ NOT for quick fixes (use /fix instead)

### What It Does

```bash
npm run /refactor
# or (preview mode)
npm run /refactor-preview
```

**Handles**:

- 🔄 Duplicate code consolidation
- 🔄 Config drift resolution
- 🔄 Module restructuring
- 🔄 Pattern standardization

**Safety Features**:

- ✅ Preview before apply
- ✅ Architecture re-validation after changes
- ✅ Auto-rollback on P0 violations
- ✅ Approval required

**Governance**:

- ✅ Snapshot: Yes (critical!)
- ✅ Verification: Yes
- ✅ **Re-validation: Architecture check** (NEW!)
- ✅ Approval: Yes
- ✅ Rollback: Auto on P0 violations

**진행 표시**:

```
🔧 Refactor Engine v1.0
═══════════════════════════════════════════════════
📐 Structural Improvement - Architecture-level fixes

🔍 Checking prerequisites...
✅ Prerequisites satisfied

📂 Loading inspection results...
📋 Refactoring Plan:
   Total items: 3

   1. Consolidate duplicate env detection
   2. Standardize error handling pattern
   3. Merge similar config files

🔍 Governance: Preflight checks for "refactor"
📸 Governance: Capturing before snapshot
⚡ Governance: Executing "refactor"

🚀 Executing smart refactoring...
[SmartRefactorAuditor output]
...

🏛️  Re-validating architecture...
📸 Creating codebase snapshot...
   ✓ Scanned 184 files
🔍 Validating architecture invariants...
   ✅ No architecture violations

📸 Governance: Capturing after snapshot
🔍 Governance: Verifying changes
✅ Governance: "refactor" completed successfully

✅ Refactoring complete!
✅ Architecture validation passed
💡 Next: Run /inspect to verify changes, then /ship to deploy
```

---

## 5️⃣ /ship - Pre-Deployment & Deploy

### Purpose

**Final validation** + documentation + deployment

### When to Run

- ✅ All fixes applied
- ✅ Health score ≥ 80
- ✅ No P0 violations
- ✅ Ready to deploy

### What It Does

```bash
npm run ship
```

**Steps** (Automatic):

1. ✅ **Validation Gate**:
   - Health score check
   - P0 violation check
   - TypeScript compilation
   - Test suite
   - Architecture validation

2. ✅ **Documentation Sync**:
   - Doc drift check
   - Update stale docs (if auto-fix enabled)

3. ✅ **Optimization** (optional):
   - Bundle size check
   - Performance metrics

4. ✅ **Build Verification**:
   - Production build test
   - Smoke tests

5. ✅ **Git Operations**:
   - Commit with governance footer
   - Push to remote (optional)

**Governance**:

- ✅ Snapshot: Yes
- ✅ Verification: Yes
- ✅ Approval: Final confirmation
- ✅ Full Audit Log: Yes

**진행 표시**:

```
🚀 Ship Engine - Production Deployment
═══════════════════════════════════════════════════

🔍 Phase 1: Pre-Flight Validation
   ✓ Health Score: 95/100
   ✓ P0 Violations: 0
   ✓ TypeScript: PASS
   ✓ Tests: PASS
   ✓ Architecture: PASS

🔍 Phase 2: Documentation Sync
   📚 Checking doc-code drift...
   ✓ All docs up to date

🔍 Phase 3: Build Verification
   🏗️  Running production build...
   ✓ Build successful (2.3MB)

🔍 Phase 4: Final Confirmation

   📋 Ship Summary:
      Files Changed: 12
      Lines Added: 234
      Lines Removed: 156
      Health Score: 95/100
      Ready to Deploy: YES

   🚀 Ready to ship?
   [y] Yes, deploy now
   [n] No, cancel

   → Your choice: y

🚀 Phase 5: Deployment
   📸 Creating deployment snapshot...
   🔍 Governance: Executing "ship"

   ✓ Committed: feat: Add new QA validation
   ✓ Pushed to: origin/main

   📊 Deployment Log saved to:
      reports/deployment-20251001.log

✅ Deployment successful! 🎉
```

**Blocking Conditions**:

- 🔴 Health score < 80
- 🔴 Any P0 violations
- 🔴 TypeScript errors
- 🔴 Test failures
- 🔴 Unfinished migrations

---

## 🎓 Best Practices

### Daily Workflow

```bash
# Morning: Start fresh
/inspect
/maintain

# Development: Fix issues as needed
# (make changes)
/inspect
/fix

# Before lunch: Check state
/inspect

# Afternoon: Refactor if needed
/refactor
/inspect

# End of day: Ship if ready
/ship
```

### Emergency Fixes

```bash
# Quick fix workflow
/inspect
/fix    # Fix only the critical item
/ship   # Deploy immediately
```

### Major Refactoring

```bash
# Safe refactoring workflow
/inspect                    # 1. Baseline
/refactor-preview           # 2. Preview changes
/refactor                   # 3. Apply if safe
/inspect                    # 4. Verify
/ship                       # 5. Deploy
```

---

## 📊 Progress Tracking

모든 명령어는 **실시간 진행 상태**를 표시합니다:

### Todo List Integration

- ✅ 각 단계가 Todo 항목으로 추가됨
- ✅ 진행 중인 작업은 `in_progress` 상태
- ✅ 완료된 작업은 `completed` 상태
- ✅ 대기 중인 작업은 `pending` 상태

### Visual Progress

```
[1/5] ⏳ Running TypeScript check...
[2/5] ✅ TypeScript: PASS
[3/5] ⏳ Running ESLint...
[4/5] ✅ ESLint: PASS
[5/5] ⏳ Running Tests...
```

### Governance Logs

```bash
# Real-time governance tracking
tail -f reports/operations/governance.jsonl
```

---

## 🔗 Related Documentation

- **Ship Checklist**: `docs/SHIP_COMPLETION_CHECKLIST.md`
- **Approval Criteria**: `docs/APPROVAL_CRITERIA.md`
- **Command Reference**: `docs/COMMAND_GUIDE.md`
- **Architecture System**: `docs/ARCHITECTURE_ENFORCEMENT_SYSTEM.md`

---

**Remember**:

- System shows progress in real-time ✅
- Every step is logged and traceable ✅
- Rollback is always available ✅
- Quality is automated, not manual ✅

**Happy Shipping! 🚀**
