# Citation Generation Policy

**Version**: 2.0.0
**Status**: ENFORCED
**Last Updated**: 2025-10-02
**Enforcement**: MANDATORY for all QA generation

---

## 🎯 Core Policy

**ALL answers MUST include citations.**

No exceptions. Empty citations = **FAIL**.

---

## 📜 Policy Requirements

### Minimum Requirements (P0)

| Requirement              | Threshold | Enforcement        |
| ------------------------ | --------- | ------------------ |
| **Citations per answer** | ≥ 1       | ❌ FAIL if 0       |
| **Evidence referenced**  | ≥ 1       | ❌ FAIL if 0       |
| **Valid structure**      | 100%      | ❌ FAIL if invalid |

### Quality Requirements (P1)

| Requirement               | Threshold | Enforcement      |
| ------------------------- | --------- | ---------------- |
| **Avg alignment score**   | ≥ 0.4     | ⚠️ WARN if < 0.4 |
| **Citation coverage**     | ≥ 50%     | ⚠️ WARN if < 50% |
| **Evidence traceability** | ≥ 80%     | ⚠️ WARN if < 80% |

### Enhanced Fields (P2)

| Field             | Requirement | Penalty     |
| ----------------- | ----------- | ----------- |
| `evidence_idx`    | Present     | -5% quality |
| `alignment_score` | Present     | -5% quality |
| `span_in_answer`  | Present     | -5% quality |

---

## 🚨 Policy Violations

### Critical (FAIL)

```
❌ No citations provided
❌ Hallucinated span (doesn't exist in answer)
❌ >30% citations structurally invalid
```

### Warnings (WARN)

```
⚠️ Alignment score < 0.3
⚠️ Citation coverage < 50%
⚠️ Missing enhanced fields (>20%)
```

---

## 🔧 Enforcement Mechanisms

### 1. Answer Agent Prompt

**CRITICAL REQUIREMENTS** section:

- MUST reference at least 1-2 pieces of evidence
- Each major claim MUST be traceable
- MUST indicate evidence numbers
- Answers without citations will be rejected

### 2. Citation Validator

```typescript
if (citations.length === 0) {
  // POLICY VIOLATION
  return { valid: false, errors: [...] };
}
```

### 3. Failure Logging

All violations logged to `logs/citation-failures/citation-failures.jsonl`:

```json
{
  "timestamp": "2025-10-02T...",
  "qa_id": "qa-123",
  "failure_reason": "no_citations",
  "details": { ... }
}
```

### 4. Quality Gates

```typescript
if (citationGate.status === "FAIL") {
  process.exit(1); // Block deployment
}
```

---

## 📊 Monitoring & Alerts

### Real-time Monitoring

- ✅ Every QA validated immediately
- ✅ Failures logged automatically
- ✅ Summary reports generated on demand

### Periodic Review

```bash
# Check failure patterns
npm run citation:failures

# Generate summary
npx tsx scripts/lib/citation-failure-logger.ts summary
```

### Common Failure Patterns

| Pattern             | Cause           | Fix                        |
| ------------------- | --------------- | -------------------------- |
| >30% no citations   | Weak prompt     | Strengthen requirements    |
| >10% hallucinations | LLM fabrication | Add validation penalty     |
| >40% low quality    | Poor evidence   | Improve evidence selection |

---

## 🛠️ Developer Guidelines

### When Writing Answer Prompts

```typescript
// ❌ WRONG: Optional language
"Please cite your sources if possible";

// ✅ CORRECT: Mandatory language
"You MUST reference at least 1-2 pieces of evidence";
```

### When Validating QA

```typescript
// Always validate with options
validateCitations(citations, answer, evidenceCount, {
  qaId: "qa-123",
  question: "What is...",
  enableLogging: true, // Log failures
});
```

### When Generating Baselines

```typescript
// Check quality gate before proceeding
if (citationGate.status === "FAIL") {
  console.error(`Citation quality gate failed: ${citationGate.reason}`);
  // DO NOT proceed to deployment
}
```

---

## 📈 Success Metrics

### Target Metrics (Production)

| Metric                 | Target | Current | Status |
| ---------------------- | ------ | ------- | ------ |
| Citation presence rate | 100%   | TBD     | 🔄     |
| Avg alignment score    | ≥0.6   | TBD     | 🔄     |
| Citation coverage      | ≥60%   | TBD     | 🔄     |
| Hallucination rate     | <1%    | 0%      | ✅     |

### Baseline Quality Gate

Before allowing baseline to pass:

- ✅ Zero empty citations
- ✅ <10% invalid citations
- ✅ Avg alignment ≥ 0.4
- ✅ Coverage ≥ 50%

---

## 🔄 Continuous Improvement

### Weekly Review

1. Check failure logs
2. Identify common patterns
3. Adjust prompts if needed
4. Update thresholds based on data

### Monthly Audit

1. Review all QA quality metrics
2. Assess citation quality trends
3. Update policy thresholds
4. Document lessons learned

---

## 🚀 Next Steps

After citation policy enforcement:

1. ✅ **Validate on small batch** (10-20 QA)
   - Measure policy compliance rate
   - Check failure patterns
   - Adjust thresholds if needed

2. ✅ **Full baseline test** (100+ QA)
   - Monitor citation coverage
   - Validate quality gates
   - Generate failure reports

3. ✅ **Deploy to production**
   - All policies enforced
   - All gates passing
   - Monitoring active

---

## 📚 Related Documents

- `docs/CITATION_VALIDATION.md` - Validation system
- `docs/LLM_IO_CONVENTION.md` - I/O standards
- `scripts/lib/citation-validator.ts` - Core validator
- `scripts/lib/citation-failure-logger.ts` - Failure logging

---

**Enforcement**: This policy is MANDATORY. All QA generation must comply.

**Violations**: Will be automatically detected, logged, and reported.

**Quality Gate**: Deployment blocked if policy compliance < 90%.
