# Runbook: RAG Corpus Poisoning Attack

**Scenario**: RAG corpus에 악의적/오염된 문서 삽입 감지
**Severity**: P0 (Critical - Security)
**Owner**: Security Team + Platform Team
**Last Updated**: 2025-10-09

---

## Detection

### Symptoms
- Event: `poisoning_guard.blocked` OR `source_trust.anomaly`
- Alert: Slack #security + #platform-critical + PagerDuty
- Threshold: 3회/시간 이상
- Monitoring: `reports/security/poisoning-alerts.json`

### Metrics
```bash
# Check blocked documents
cat reports/security/poisoning-alerts.json | jq '.blocked_docs'

# Check SourceTrust scores
cat reports/source-trust.json | jq '.[] | select(.score < 0.4)'

# Check anomaly patterns
cat reports/security/anomaly-patterns.json
```

---

## Immediate Response (< 5min)

### Step 1: Activate Strict Mode
```bash
# 즉시 PoisoningGuard strict mode 활성화
export POISONING_GUARD_MODE="strict"
export SOURCE_TRUST_MIN=0.8  # Raise threshold
npm run runtime:restart

# Log incident
echo "$(date): Poisoning incident detected by $(whoami)" >> logs/security-incidents.log
```

### Step 2: Quarantine Suspicious Documents
```bash
# Identify suspicious docs
cat reports/security/poisoning-alerts.json | jq -r '.blocked_docs[].id' > /tmp/quarantine-list.txt

# Move to quarantine
npm run security:quarantine -- --input /tmp/quarantine-list.txt

# Output: quarantine/<date>/
```

### Step 3: Notify Security Team
```typescript
// Automatic notifications (already implemented)
// PoisoningGuard.onBlock() triggers:

1. Slack #security (immediate)
2. Security team email
3. Incident ticket creation
4. Freeze corpus updates
```

---

## Recovery Steps (< 30min)

### Step 1: Identify Attack Vector

**External Source**:
```bash
# Check document origins
cat reports/security/poisoning-alerts.json | jq -r '.blocked_docs[].meta.domain'

# Check ingestion logs
grep "corpus_ingest" logs/app.log | grep -i "$(cat /tmp/quarantine-list.txt)" | tail -50

# Identify attacker IP/domain
cat logs/ingestion-source.log | grep -f /tmp/quarantine-list.txt
```

**Internal Compromise**:
```bash
# Check access logs
cat logs/corpus-access.log | grep -E "(write|update|delete)" | tail -100

# Check user activity
cat reports/audit/user-activity.json | jq '.[] | select(.action == "corpus_update")'

# Identify compromised accounts
npm run security:audit -- --suspicious-activity
```

### Step 2: Validate Corpus Integrity

```bash
# Run full corpus validation
npm run corpus:validate -- --full

# Check document hashes
cat reports/corpus-integrity.json | jq '.mismatches'

# Re-calculate SourceTrust scores
npm run source-trust:recalculate -- --all
```

### Step 3: Restore from Snapshot

```bash
# List available snapshots
ls -lt reports/trust-snapshots/ | head -10

# Load last known good snapshot
npm run snapshot:restore -- \
  --snapshot reports/trust-snapshots/snapshot-2025-10-08-stable.json \
  --verify

# Verify restoration
npm run corpus:validate -- --quick
```

---

## Rollback Procedure

### If Poisoning Persists

```bash
# 1. Full corpus reset (LAST RESORT)
export CORPUS_MODE="read-only"
npm run corpus:freeze

# 2. Restore from backup
npm run corpus:restore -- --date 2025-10-07

# 3. Re-ingest from verified sources only
npm run corpus:ingest -- --sources-verified-only

# 4. Notify all tenants
npm run notify:tenants -- \
  --message "Corpus restored from backup, re-verification in progress"
```

---

## Post-Incident Actions (< 24h)

### Step 1: Security Audit
```bash
# Generate security audit report
npm run security:audit -- \
  --incident corpus_poisoning_$(date +%Y%m%d) \
  --full

# Output: reports/security/audit-YYYYMMDD.json
```

### Step 2: Strengthen Defenses

**Update Domain Allowlist**:
```typescript
// config/source-trust.ts
export const TRUSTED_DOMAINS = {
  allowlist: [
    "docs.company.com",
    "internal.company.com",
    // Remove compromised domain
    // "external-source.com"  ← REMOVED
  ],

  // Add signature requirement
  signature_required: true,

  // Increase trust threshold
  min_trust_score: 0.7  // Raised from 0.6
};
```

**Add Forbidden Patterns**:
```typescript
// config/poisoning-guard.ts
export const FORBIDDEN_PATTERNS = [
  ...EXISTING_PATTERNS,

  // Add attack patterns
  /malicious-keyword/gi,
  /attack-vector-pattern/gi,

  // Add more SQL injection patterns
  /UNION\s+SELECT/gi,
  /DROP\s+DATABASE/gi
];
```

### Step 3: Implement Additional Safeguards

```bash
# 1. Enable 2-source voting
export MIN_EVIDENCE_SOURCES=2

# 2. Add signature verification
export SIGNATURE_VERIFICATION=mandatory

# 3. Enable weekly audits
crontab -e
# Add: 0 0 * * 0 npm run corpus:audit-weekly
```

---

## Validation Checklist

- [ ] No poisoned docs in corpus (validation passing)
- [ ] SourceTrust scores recalculated (all docs scored)
- [ ] Evidence hash verified (100% match)
- [ ] Quarantine reviewed (security team sign-off)
- [ ] Attack vector identified (root cause documented)
- [ ] Defenses strengthened (allowlist updated, patterns added)

---

## Prevention Measures

### Short-term (1 week)
1. Mandatory signature verification for all sources
2. 2-source voting requirement
3. Daily automated corpus integrity checks

### Medium-term (1 month)
1. ML-based anomaly detection
2. Content similarity analysis (detect duplicates/variations)
3. Automated threat intelligence integration

### Long-term (3 months)
1. Zero-trust corpus architecture
2. Blockchain-based document provenance
3. Real-time threat detection

---

## Escalation Path

1. **0-5min**: Security Team Lead + Platform Team
2. **5-15min**: CISO (Chief Information Security Officer)
3. **15-30min**: Legal Team (if data breach)
4. **>30min**: CEO + Board (if major compromise)

---

## Forensics & Legal

### Evidence Collection
```bash
# Preserve evidence for legal/forensic analysis
npm run forensics:collect -- \
  --incident corpus_poisoning_$(date +%Y%m%d) \
  --preserve-logs \
  --hash-chain

# Output: forensics/<incident-id>/
# - logs/
# - snapshots/
# - access-logs/
# - hash-chain.json
```

### Legal Notification
```bash
# If data breach detected
npm run legal:notify -- \
  --type data_breach \
  --severity high \
  --affected-tenants <list>
```

---

## Related Runbooks
- `SECURITY_BREACH.md` - 전반적 보안 침해
- `DATA_LEAK.md` - 데이터 유출

---

## Contact Information
- **Slack**: #security (immediate) + #platform-critical
- **PagerDuty**: Security Team (primary) + Platform Team (secondary)
- **Escalation**: CISO → Legal → CEO
- **External**: FBI Cyber Division (if major attack)

---

**Status**: ✅ Active
**Test Schedule**: Quarterly (1st week of Q)
**Last Test**: 2025-07-15
**Next Test**: 2025-10-15
