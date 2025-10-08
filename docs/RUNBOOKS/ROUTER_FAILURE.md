# Runbook: Model Router Failure

**Scenario**: Model Router 장애 또는 정책 충돌
**Severity**: P0 (Critical)
**Owner**: Platform Team
**Last Updated**: 2025-10-09

---

## Detection

### Symptoms
- Event: `router.failure` OR `router.policy_conflict`
- Alert: PagerDuty (immediate) + Slack #critical
- Threshold: 즉시 (any failure)
- Monitoring: `reports/metrics/router-health.json`

### Metrics
```bash
# Check router status
cat reports/metrics/router-health.json | jq '.status'

# Check routing decisions
cat reports/logs/router-decisions.jsonl | tail -20
```

---

## Immediate Response (< 2min)

### Step 1: Freeze Router
```bash
# 즉시 라우팅 중단
export ROUTER_MODE="freeze"
npm run runtime:restart

# Log entry
echo "$(date): Router frozen by $(whoami)" >> logs/incidents.log
```

### Step 2: Assess Impact
```bash
# Check affected requests
cat reports/metrics/router-health.json | jq '.failed_requests'

# Check tenant impact
cat reports/metrics/tenant-impact.json | jq '.affected_tenants'
```

### Step 3: Enable Emergency Mode
```typescript
// Automatic emergency routing (already implemented)
// ModelRouter.emergencyMode() triggers:

1. Fixed routing (no dynamic selection)
2. Default to safest model (Claude Sonnet)
3. Bypass policy checks (log only)
4. Manual approval required
```

---

## Recovery Steps (< 15min)

### Step 1: Identify Root Cause

**Policy Conflict**:
```bash
# Check policy diff
git diff HEAD~1 config/tenant-policies/

# Check conflict logs
cat logs/policy-conflicts.log | tail -50

# Validate policy syntax
npm run policy:validate
```

**Code Failure**:
```bash
# Check router logs
cat logs/router.log | grep ERROR | tail -20

# Check stack trace
cat logs/router-error-stack.log
```

### Step 2: Apply Fix

**If Policy Conflict**:
```bash
# Rollback to last known good policy
git checkout HEAD~1 config/tenant-policies/
npm run policy:reload

# Or: Manual resolution
vim config/tenant-policies/<tenant-id>/policy.yml
npm run policy:validate
npm run policy:reload
```

**If Code Failure**:
```bash
# Rollback router to last stable version
git checkout <last-stable-commit> src/control/model-router.ts
npm run build
npm run runtime:restart

# Or: Hotfix deployment
vim src/control/model-router.ts
npm run build:quick
npm run runtime:restart
```

### Step 3: Verify Fix
```bash
# Test routing decision
npm run router:test -- --tenant healthcare-tenant-1

# Check routing logs
tail -f logs/router-decisions.jsonl

# Expected: status = "success"
```

---

## Rollback Procedure

### If Fix Fails

```bash
# 1. Restore previous stable version
git log --oneline -10
git checkout <stable-commit>
npm run build
npm run runtime:restart

# 2. Manual routing mode
export MANUAL_ROUTING=true
npm run runtime:restart

# 3. Notify stakeholders
npm run notify:stakeholders -- \
  --message "Router in manual mode, ETA 30min"
```

---

## Post-Incident Actions (< 2h)

### Step 1: Policy Audit
```bash
# Generate policy diff report
npm run policy:audit -- --since HEAD~5

# Check for conflicting rules
npm run policy:validate-all

# Output: reports/policy-audit.json
```

### Step 2: Update Conflict Resolution Rules
```typescript
// config/policy-resolver.ts
export const CONFLICT_RESOLUTION = {
  // Priority order (highest → lowest)
  priority: [
    "regulatory",    // HIPAA/SOX overrides all
    "security",      // Security rules override performance
    "tenant",        // Tenant-specific overrides defaults
    "default"        // System defaults
  ],

  // Strict mode: reject on conflict
  strict_mode: true
};
```

### Step 3: Add Safeguards
```bash
# 1. Pre-commit policy validation
git config core.hooksPath .githooks
cp scripts/pre-commit-policy-check.sh .githooks/pre-commit

# 2. Canary deployment for router changes
npm run deploy:canary -- --target router
```

---

## Validation Checklist

- [ ] Router operational (routing decisions succeeding)
- [ ] Policy conflict resolved (validation passing)
- [ ] No tenant SLA violations
- [ ] Compliance maintained (HIPAA/SOX checks passing)
- [ ] Manual approval queue cleared

---

## Prevention Measures

### Short-term (1 week)
1. Policy syntax validator (pre-commit hook)
2. Conflict detection in CI/CD
3. Canary deployment for policy changes

### Long-term (1 month)
1. Policy simulation environment
2. Multi-stage policy rollout (canary → beta → prod)
3. Automated conflict resolution engine

---

## Escalation Path

1. **0-15min**: Platform Team Lead
2. **15-30min**: Engineering Manager
3. **30-60min**: CTO + Legal (if compliance impact)
4. **>60min**: CEO (if multi-tenant outage)

---

## Related Runbooks
- `POLICY_CONFLICT.md` - 정책 충돌 상세
- `LLM_TIMEOUT.md` - LLM 타임아웃

---

## Contact Information
- **Slack**: #platform-critical
- **PagerDuty**: Platform Team (primary)
- **Escalation**: Engineering Manager → CTO

---

**Status**: ✅ Active
**Test Schedule**: Monthly (2nd Monday)
**Last Test**: 2025-09-15
**Next Test**: 2025-11-01
