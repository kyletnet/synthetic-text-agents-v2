# 🚀 Ship Completion Checklist

**Purpose**: Pre-deployment self-audit checklist for quality assurance

**When to use**: Before running `/ship` or `npm run ship`

---

## 📋 Pre-Ship Checklist

### 1️⃣ Code Quality (MUST PASS)

```bash
# Run full inspection
npm run status
```

**Success Criteria**:

- [ ] **Health Score ≥ 80/100**
- [ ] **TypeScript**: ✅ PASS (0 errors)
- [ ] **ESLint**: ✅ PASS (0 blocking issues)
- [ ] **Tests**: ✅ PASS (all passing)
- [ ] **Security**: ✅ PASS (no vulnerabilities)

**If Failed**: Run `npm run maintain` → `npm run fix` first

---

### 2️⃣ Architecture Integrity (MUST PASS)

```bash
# Validate architecture invariants
npm run _arch:validate
```

**Success Criteria**:

- [ ] **P0 Critical**: 0 violations
- [ ] **P1 High**: 0 violations (or approved exceptions)
- [ ] **Architecture**: ✅ "All architecture invariants satisfied"

**If Failed**: Fix P0 violations immediately. P1 violations may be approved but should be documented.

---

### 3️⃣ Documentation Sync (RECOMMENDED)

```bash
# Check doc-code drift
npm run docs:drift-scan
```

**Success Criteria**:

- [ ] **Drift Errors**: 0 (no docs older than 30 days)
- [ ] **Drift Warnings**: < 5 (docs between 7-30 days)
- [ ] **Coverage**: All major features documented

**If Failed**: Update stale documentation before shipping.

---

### 4️⃣ Governance Compliance (AUTO-VERIFIED)

```bash
# Check governance logs
tail -10 reports/operations/governance.jsonl
```

**Success Criteria**:

- [ ] **Recent Operations**: All status = "success"
- [ ] **Snapshots**: Before/after snapshots exist
- [ ] **Rollback Capability**: Snapshots ≤ 7 days old

**If Failed**: Re-run failed operations with governance enforcement.

---

### 5️⃣ Migration Status (IF APPLICABLE)

```bash
# Check migration progress
npm run _migration:status
```

**Success Criteria**:

- [ ] **In-Progress Migrations**: 0 (all completed or none started)
- [ ] **Partial Migrations**: 0 (no half-done migrations)

**If Failed**: Complete or revert in-progress migrations before shipping.

---

## 🎯 Quick Pre-Ship Command

Run all checks at once:

```bash
# Comprehensive pre-ship validation
npm run status && \
npm run _arch:validate && \
npm run docs:drift-scan:report && \
echo "✅ All pre-ship checks passed!"
```

---

## 🚦 Decision Matrix

| Health Score | P0 Violations | Drift Errors | Decision                 |
| ------------ | ------------- | ------------ | ------------------------ |
| ≥ 80         | 0             | 0            | ✅ **SHIP**              |
| ≥ 80         | 0             | 1-5          | ⚠️ **SHIP with WARNING** |
| ≥ 80         | 1+            | any          | 🔴 **BLOCK**             |
| < 80         | 0             | 0            | ⚠️ **REVIEW REQUIRED**   |
| < 80         | 1+            | any          | 🔴 **BLOCK**             |

---

## 📊 Self-Audit Log Template

Copy this after running checks:

```markdown
## Ship Audit Log

**Date**: YYYY-MM-DD
**Branch**: main/develop
**Commit**: <git sha>

### Quality Metrics

- Health Score: XX/100
- TypeScript: ✅/❌
- Architecture P0: X violations
- Documentation Drift: X errors, X warnings

### Governance

- Recent Operations: X success, X failed
- Snapshots Available: Yes/No
- Rollback Tested: Yes/No

### Decision

- [ ] ✅ APPROVED for shipping
- [ ] ⚠️ APPROVED with conditions: ******\_\_\_******
- [ ] 🔴 BLOCKED - Reason: ******\_\_\_******

**Approved by**: [Your Name]
**Next Review**: [Date if blocked]
```

---

## 🔄 Post-Ship Verification

After deployment:

```bash
# 1. Verify deployment
git log -1 --oneline

# 2. Check CI passed
# View GitHub Actions status

# 3. Create deployment snapshot
npm run _arch:validate > reports/deployment-$(date +%Y%m%d).log

# 4. Update documentation
npm run docs:drift-scan:fix
```

---

## 🚨 Emergency Rollback

If issues found after shipping:

```bash
# 1. Check governance snapshots
ls -la reports/snapshots/ | tail -5

# 2. Load latest snapshot
# (Manual rollback procedure - use governance snapshot IDs)

# 3. Revert commit
git revert HEAD
git push origin main

# 4. Re-run validation
npm run status
```

---

## 📚 Related Documentation

- **Command Guide**: `docs/COMMAND_GUIDE.md`
- **Architecture System**: `docs/ARCHITECTURE_ENFORCEMENT_SYSTEM.md`
- **CI Migration**: `docs/CI_MIGRATION_COMPLETE.md`
- **Critical Fixes**: `docs/CRITICAL_FIXES_APPLIED.md`

---

## 💡 Best Practices

### ✅ DO:

- Run `/inspect` (npm run status) before every ship
- Fix P0 violations immediately
- Keep documentation within 30-day freshness
- Review governance logs for anomalies
- Create deployment snapshots

### ❌ DON'T:

- Ship with P0 architecture violations
- Ignore health scores < 80
- Skip pre-ship checks "just this once"
- Deploy with unfinished migrations
- Bypass governance enforcement

---

**Remember**: This checklist is not bureaucracy—it's your safety net.

**System Confidence**: 99/100 when checklist passes ✅
