# Runbook: Tenant Policy Conflict

**Scenario**: Tenant 정책 충돌 (예: HIPAA + SOX 동시 적용 시 모순)
**Severity**: P1 (High)
**Owner**: Platform Team + Compliance Team
**Last Updated**: 2025-10-09

---

## Detection

### Symptoms
- Event: `policy.conflict` OR `policy.validation_failed`
- Alert: Slack #policy + #compliance
- Threshold: 정책 업데이트 시 즉시
- Monitoring: `reports/policy/conflicts.json`

### Metrics
```bash
# Check policy conflicts
cat reports/policy/conflicts.json | jq '.conflicts'

# Check affected tenants
cat reports/policy/conflicts.json | jq '.affected_tenants'

# Check conflict details
cat logs/policy-validation.log | grep CONFLICT | tail -20
```

---

## Immediate Response (< 5min)

### Step 1: Freeze Policy Updates
```bash
# 즉시 정책 업데이트 중단
export POLICY_UPDATE_MODE="freeze"
npm run policy:freeze

# Log incident
echo "$(date): Policy conflict detected - $(cat reports/policy/conflicts.json | jq -r '.conflicts[0].description')" >> logs/policy-incidents.log
```

### Step 2: Identify Conflicting Policies
```bash
# Show conflict details
npm run policy:diagnose -- --conflict-id $(cat reports/policy/conflicts.json | jq -r '.conflicts[0].id')

# Example output:
# Conflict: HIPAA requires "PHI masking mandatory"
# Conflict: SOX requires "Financial data unmodified"
# → Cannot mask PHI if it's also financial data
```

### Step 3: Apply Conflict Resolution Rules
```typescript
// Automatic resolution (already implemented)
// PolicyResolver.resolve() applies:

1. Priority order: regulatory > security > tenant > default
2. If unresolvable: Freeze + Human approval
3. Log decision + Rationale
```

---

## Recovery Steps (< 30min)

### Step 1: Analyze Conflict

**View Policy Diff**:
```bash
# Show policy changes
git diff HEAD~1 config/tenant-policies/

# Show conflict source
cat reports/policy/conflicts.json | jq '.conflicts[0].policies'

# Example:
# Policy A: HIPAA (priority: regulatory)
# Policy B: SOX (priority: regulatory)
# → Both regulatory → Conflict
```

**Check Compliance Requirements**:
```bash
# Check HIPAA requirements
cat src/offline/genius-lab/gcg/rules/hipaa.yml | yq '.rules.phi_masking'

# Check SOX requirements
cat src/offline/genius-lab/gcg/rules/sox.yml | yq '.rules.financial_accuracy'
```

### Step 2: Apply Resolution Strategy

**Strategy 1: Priority-based (Automatic)**
```typescript
// config/policy-resolver.ts
const PRIORITY_ORDER = {
  regulatory: 100,   // HIPAA/SOX/GDPR
  security: 80,      // ISO 27001
  tenant: 60,        // Tenant-specific
  default: 40        // System defaults
};

// If both regulatory → Choose stricter rule
const resolution = chooseStricter(policyA, policyB);
```

**Strategy 2: Hybrid (Semi-automatic)**
```bash
# Create hybrid rule
npm run policy:merge -- \
  --policy-a hipaa.yml \
  --policy-b sox.yml \
  --strategy stricter

# Example output:
# Merged rule: "PHI masking + Financial data integrity"
# → Mask non-financial PHI, preserve financial PHI with access control
```

**Strategy 3: Human Approval (Manual)**
```bash
# Create approval ticket
npm run policy:approval -- \
  --conflict-id <id> \
  --approvers compliance-team,legal-team

# Wait for approval (SLA: 4 hours)
npm run policy:wait-approval -- --conflict-id <id>
```

### Step 3: Apply Resolution
```bash
# Apply merged policy
npm run policy:apply -- \
  --policy-file config/tenant-policies/<tenant>/merged-policy.yml \
  --validate

# Verify no conflicts
npm run policy:validate-all

# Reload policies
npm run policy:reload
```

---

## Rollback Procedure

### If Resolution Fails

```bash
# 1. Revert to last known good policy
git checkout HEAD~1 config/tenant-policies/<tenant>/
npm run policy:reload

# 2. Disable conflicting feature
export FEATURE_<CONFLICTING_FEATURE>=false
npm run runtime:restart

# 3. Notify stakeholders
npm run notify:stakeholders -- \
  --message "Policy conflict - reverted to previous version"
```

---

## Post-Incident Actions (< 2h)

### Step 1: Update Conflict Resolution Rules

```typescript
// config/policy-resolver.ts (enhanced)

export const CONFLICT_RESOLUTION = {
  // Priority order
  priority: [...EXISTING_PRIORITY],

  // Specific conflict handlers
  handlers: {
    "hipaa+sox": {
      strategy: "hybrid",
      rule: "mask_non_financial_phi_preserve_financial_with_acl"
    },

    "gdpr+ccpa": {
      strategy: "stricter",
      rule: "apply_gdpr"  // GDPR is stricter
    },

    "security+performance": {
      strategy: "security_first",
      rule: "prioritize_security"
    }
  },

  // Fallback
  fallback: "human_approval"
};
```

### Step 2: Add Pre-flight Validation
```bash
# Add pre-commit hook
cp scripts/pre-commit-policy-check.sh .githooks/pre-commit

# Script contents:
#!/bin/bash
npm run policy:validate-all || {
  echo "Policy validation failed - commit rejected"
  exit 1
}
```

### Step 3: Document Resolution
```bash
# Create resolution documentation
npm run docs:policy-resolution -- \
  --conflict-id <id> \
  --resolution <strategy> \
  --rationale "..."

# Output: docs/policy-resolutions/<conflict-id>.md
```

---

## Validation Checklist

- [ ] Policy conflict resolved (validation passing)
- [ ] No tenant SLA violations
- [ ] Compliance maintained (all regulatory checks passing)
- [ ] Human approval obtained (if required)
- [ ] Resolution documented (rationale recorded)
- [ ] Pre-flight checks added (prevent future conflicts)

---

## Prevention Measures

### Short-term (1 week)
1. Policy simulation environment (test conflicts before deploy)
2. Conflict detection in CI/CD (block merge if conflict)
3. Automated conflict resolution for common cases

### Medium-term (1 month)
1. Policy composition framework (define composition rules)
2. Multi-stage policy rollout (canary → beta → prod)
3. Compliance advisory system (proactive warnings)

### Long-term (3 months)
1. AI-powered policy analyzer (predict conflicts)
2. Self-healing policy system (auto-resolution)
3. Regulatory update monitoring (track law changes)

---

## Common Conflict Patterns

### Pattern 1: PHI Masking vs Financial Accuracy
```yaml
# Conflict
HIPAA: "Mask all PHI"
SOX: "Preserve financial data integrity"

# Resolution
hybrid:
  - Mask non-financial PHI
  - Preserve financial PHI with ACL
  - Add audit trail
```

### Pattern 2: Data Retention vs Privacy
```yaml
# Conflict
SOX: "Retain 7 years"
GDPR: "Delete on request"

# Resolution
stricter:
  - Retain 7 years (SOX compliance)
  - Anonymize on GDPR request (not delete)
  - Flag as "anonymized for privacy"
```

### Pattern 3: Security vs Performance
```yaml
# Conflict
ISO 27001: "Encrypt all data"
Performance: "Cache unencrypted for speed"

# Resolution
security_first:
  - Encrypt all data (always)
  - Cache encrypted data
  - Decrypt on-demand
```

---

## Escalation Path

1. **0-15min**: Platform Team + Compliance Team
2. **15-30min**: Legal Team (if regulatory impact)
3. **30-60min**: CISO + CFO (if high-risk)
4. **>60min**: CEO (if multi-tenant impact)

---

## Related Runbooks
- `ROUTER_FAILURE.md` - Model router 장애
- `COMPLIANCE_AUDIT.md` - 규제 감사

---

## Contact Information
- **Slack**: #policy + #compliance
- **PagerDuty**: Platform Team (primary) + Compliance Team (secondary)
- **Escalation**: Legal → CISO → CEO

---

**Status**: ✅ Active
**Test Schedule**: Monthly (3rd Monday)
**Last Test**: 2025-09-15
**Next Test**: 2025-11-01
