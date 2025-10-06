# ⚖️ Manual Approval vs Auto-Apply Criteria

**Purpose**: Clear decision boundaries for human approval requirements

---

## 🎯 Core Principle

> **"사람이 판단해야 하는 것 vs 시스템이 자동 적용할 수 있는 것"**
>
> - 시스템은 **안전성을 보장**하고
> - 사람은 **전략적 결정**을 내립니다

---

## 📊 Decision Matrix

| Action Type                | Auto-Apply | Manual Approval | Blocking      |
| -------------------------- | ---------- | --------------- | ------------- |
| **Formatting** (Prettier)  | ✅         | -               | -             |
| **Linting** (ESLint --fix) | ✅         | -               | -             |
| **TypeScript Errors**      | -          | ✅              | ✅ (P0)       |
| **Architecture P0**        | -          | -               | ✅ BLOCK      |
| **Architecture P1**        | -          | ✅              | -             |
| **Refactoring**            | -          | ✅              | -             |
| **Security Issues**        | -          | ✅              | ✅ (Critical) |
| **Doc Drift (30+ days)**   | -          | ✅              | -             |

---

## 🔄 Command-by-Command Criteria

### `/inspect` (npm run status)

**Type**: Read-only diagnosis

- **Auto-Apply**: Nothing (read-only)
- **Manual Approval**: N/A
- **Output**: Creates inspection cache for other commands

**Governance**:

- ✅ Snapshot: Yes (for audit trail)
- ❌ Verification: No (read-only)

---

### `/maintain` (npm run maintain)

**Type**: Auto-fix styling

- **Auto-Apply**:

  - ✅ Prettier formatting
  - ✅ ESLint --fix (safe rules)
  - ✅ Design pattern validation (warnings only)

- **Manual Approval**: None
- **Blocking**: None (cosmetic changes only)

**Governance**:

- ✅ Snapshot: Yes
- ✅ Verification: Yes
- ✅ Auto-rollback: If verification fails

**Safety**: High - Only applies mechanical fixes, no logic changes

---

### `/fix` (npm run fix)

**Type**: Interactive fixes with approval

- **Auto-Apply**: Nothing
- **Manual Approval** (Interactive):
  - ⚠️ TypeScript type errors
  - ⚠️ Workaround/TODO resolution
  - ⚠️ Component documentation gaps
  - ⚠️ Test failures

**Blocking**:

- 🔴 P0 TypeScript errors in production code
- 🔴 Critical security issues

**Governance**:

- ✅ Snapshot: Yes
- ✅ Verification: Yes
- ✅ Approval Required: Yes (user confirmation per item)
- ✅ Rollback: Available on failure

**Safety**: Medium - Requires user judgment for each fix

---

### `/refactor` (npm run /refactor)

**Type**: Structural improvements

- **Auto-Apply**: Nothing
- **Manual Approval**:
  - ⚠️ Cross-module refactoring
  - ⚠️ Duplicate code consolidation
  - ⚠️ Config drift resolution

**Blocking**:

- 🔴 P0 Architecture violations after refactoring
- 🔴 Breaking TypeScript errors

**Governance**:

- ✅ Snapshot: Yes (critical!)
- ✅ Verification: Yes
- ✅ Re-validation: Architecture check after changes
- ✅ Approval Required: Yes (preview + confirmation)
- ✅ Rollback: Auto-rollback if P0 violations

**Safety**: Low - Structural changes, high rollback capability

---

### `/ship` (npm run ship)

**Type**: Pre-deployment validation + deploy

- **Auto-Apply**:

  - ✅ Documentation sync
  - ✅ Optimization (if enabled)
  - ✅ Build verification

- **Manual Approval**:
  - ⚠️ Deployment confirmation (final gate)

**Blocking**:

- 🔴 Health score < 80
- 🔴 Any P0 violations
- 🔴 TypeScript compilation errors
- 🔴 Test failures
- 🔴 Unfinished migrations

**Governance**:

- ✅ Snapshot: Yes
- ✅ Verification: Yes
- ✅ Approval Required: Yes (final confirmation)
- ✅ Full Audit Log: Yes

**Safety**: Maximum - All gates must pass

---

## 🚦 Approval Flow

### Auto-Apply Path (No Human Needed)

```
Code Issue → Detect → Auto-Fix → Verify → Success
                                    ↓
                                 [Rollback if verification fails]
```

**Examples**:

- Prettier formatting
- ESLint auto-fixable issues
- Safe refactors with 100% certainty

---

### Manual Approval Path (Human Judgment Required)

```
Code Issue → Detect → Preview Changes → [Human Reviews]
                                              ↓
                                         Approve/Reject
                                              ↓
                                    Apply → Verify → Success
                                              ↓
                                    [Rollback if fails]
```

**Examples**:

- TypeScript type errors (may need design decisions)
- Refactoring (may change behavior)
- Architecture violations (may need architectural decisions)

---

### Blocking Path (Cannot Proceed)

```
Critical Issue → Detect → ⛔ BLOCK → [Human Must Fix First]
```

**Examples**:

- P0 Architecture violations
- Critical security vulnerabilities
- Production-breaking errors

---

## 📋 Decision Criteria

### When to Auto-Apply ✅

- [x] Change is **mechanical** (no logic decisions)
- [x] Change is **reversible** (snapshot exists)
- [x] Change has **deterministic outcome** (always correct)
- [x] Change is **low risk** (cosmetic only)
- [x] Change follows **established patterns** (no invention)

**Examples**:

- Prettier: Always the same output
- ESLint --fix: Predefined safe transformations
- Import sorting: Deterministic

---

### When to Require Approval ⚠️

- [x] Change requires **judgment** (multiple valid solutions)
- [x] Change affects **behavior** (not just style)
- [x] Change crosses **boundaries** (multiple files/modules)
- [x] Change has **side effects** (may break something)
- [x] Change requires **context** (why/how decisions)

**Examples**:

- TypeScript errors: May need type design
- Refactoring: May change behavior
- Security fixes: May need security expertise

---

### When to Block 🔴

- [x] Issue is **P0 critical** (system broken)
- [x] Issue prevents **compilation** (cannot build)
- [x] Issue is **security critical** (data leak, etc)
- [x] Issue violates **architecture invariants** (fundamental rules)
- [x] Fix requires **architectural change** (design review needed)

**Examples**:

- P0 Architecture violations
- Build-breaking TypeScript errors
- Critical security vulnerabilities
- Partial migrations (inconsistent state)

---

## 🎓 Team Guidelines

### For Developers

1. **Trust auto-apply**: System won't break anything
2. **Review approval items**: Understand what system suggests
3. **Ask when unsure**: Manual approval = requires your expertise
4. **Don't bypass blocks**: P0 blocks protect production

### For Reviewers

1. **Check approval log**: What did user approve?
2. **Verify governance snapshots**: Can we rollback if needed?
3. **Review P1 exceptions**: Are they documented?
4. **Question missing approvals**: Was auto-apply appropriate?

---

## 🔄 Continuous Improvement

### Track Approval Patterns

```bash
# See what gets approved most
grep "approved" reports/operations/governance.jsonl | \
  jq -r '.metadata.itemType' | sort | uniq -c
```

### Evolve Criteria

- If same approval repeats 10+ times → Consider auto-apply
- If auto-apply causes rollback 3+ times → Require approval
- If blocking causes frustration → Re-evaluate severity

---

## 📚 Related

- **Command Guide**: `docs/COMMAND_GUIDE.md`
- **Ship Checklist**: `docs/SHIP_COMPLETION_CHECKLIST.md`
- **Governance System**: `docs/ARCHITECTURE_ENFORCEMENT_SYSTEM.md`

---

**Remember**:

- Automation is for **confidence**, not **control**
- Approval is for **judgment**, not **obstruction**
- Blocking is for **safety**, not **bureaucracy**

**The goal**: Maximize velocity while maintaining quality ✅
