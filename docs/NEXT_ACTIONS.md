# Next Actions - Detailed Checklist

**Last Updated**: 2025-10-08 20:30 KST
**Status**: Phase 1.6 Roadmap Integrated
**Approach**: Evolutionary Expansion (NOT Rewrite)

---

## 🎯 Strategy Overview

**Current State**: Phase 1.5 complete, Integrated Roadmap documented
**Next Focus**: Phase 1.6 (Organic Loop Completion, 2 weeks)
**Approach**: Top-3 Priority + Full Backlog visibility

**Key Principle**: Current structure is a "living organism with genetic structure" - add layers, don't rebuild foundation.

---

## 🚨 Phase 1.6: Top-3 Critical Path (Start Here)

### 1. Feedback Adapter + Source Trust Updater (ETA: 2-3 hours) 🔴

**Goal**: User feedback ("incorrect evidence") updates SourceTrust scores dynamically.

**Priority**: CRITICAL (blocks feedback loop = moat value)

**Files to Create**:
```
✅ Create: src/application/feedback-adapter.ts
✅ Create: src/application/feedback-labeler.ts
✅ Create: src/infrastructure/retrieval/source-trust-updater.ts
✅ Create: src/infrastructure/retrieval/source-trust-persistence.ts
```

**Implementation Steps**:
1. Create `feedback-adapter.ts`:
   ```typescript
   export async function processFeedback(feedback: UserFeedback): Promise<void> {
     // Intent classification (6 types: evidence_incorrect, answer_wrong, etc.)
     const intent = await classifyIntent(feedback);

     if (intent === "evidence_incorrect") {
       const { domain, chunkId } = feedback.context;
       await updateSourceTrust({ domain, delta: -0.1 });
       await emitGovernanceEvent({
         event: "feedback_processed",
         intent,
         trust_delta: -0.1,
         timestamp: new Date().toISOString()
       });
     }
   }
   ```

2. Create `feedback-labeler.ts`:
   ```typescript
   export async function classifyIntent(feedback: UserFeedback): Promise<FeedbackIntent> {
     // Confidence scoring (1-5)
     const confidence = scoreConfidence(feedback);

     // Intent types: evidence_incorrect, answer_wrong, format_issue,
     //               request_clarification, positive_feedback, other
     const intent = await detectIntent(feedback.text, confidence);

     return intent;
   }
   ```

3. Create `source-trust-updater.ts`:
   ```typescript
   export async function updateSourceTrust(params: {
     domain?: string;
     author?: string;
     delta: number;
   }): Promise<void> {
     // Update SourceTrust config
     const trust = await loadSourceTrust();
     trust.updateScore(params);

     // Persist to disk
     await trust.saveToDisk("reports/source-trust.json");

     // Emit event
     await emitEvent("source_trust_updated", params);
   }
   ```

4. Create `source-trust-persistence.ts`:
   ```typescript
   export class SourceTrustPersistence {
     async save(trust: SourceTrust, path: string): Promise<void> {
       const data = trust.serialize();
       await fs.writeFile(path, JSON.stringify(data, null, 2));
     }

     async load(path: string): Promise<SourceTrust> {
       const data = await fs.readFile(path, "utf-8");
       return SourceTrust.deserialize(JSON.parse(data));
     }
   }
   ```

**Success Criteria**:
- [ ] Feedback intent "evidence_incorrect" detected
- [ ] SourceTrust domain scores updated (delta: ±0.1)
- [ ] Changes persisted to `reports/source-trust.json`
- [ ] Next retrieval uses updated scores
- [ ] Governance events include feedback data

---

### 2. Test Chain Integration (ETA: 1 hour) 🟠

**Goal**: Sequential test execution to catch regressions properly.

**Priority**: HIGH (blocks regression detection automation)

**Files to Create**:
```
✅ Create: scripts/test-sequence.ts
✅ Modify: package.json (add test:sequence script)
✅ Modify: scripts/guard.ts (call test:sequence)
```

**Implementation Steps**:
1. Create `test-sequence.ts`:
   ```typescript
   async function runTestSequence() {
     console.log("Running Phase 2C tests...");
     await exec("npm test -- tests/phase0 tests/governance");

     console.log("Running Phase 1 tests...");
     await exec("npm test -- tests/integration/phase1-mbc.test.ts");

     console.log("Running Phase 1.5 tests...");
     await exec("npm test -- tests/integration/phase1.5-retrieval.test.ts");

     console.log("Running RG...");
     await exec("npm run rg:run");
   }
   ```

2. Add to package.json:
   ```json
   "test:sequence": "tsx scripts/test-sequence.ts"
   ```

3. Integrate into guard:
   ```typescript
   if (strict) {
     await runTestSequence();
   }
   ```

**Success Criteria**:
- [ ] Tests run sequentially (Phase2C → 1 → 1.5)
- [ ] RG detects regressions
- [ ] `/guard --strict` includes sequence

---

### 3. Gate P/I Enhancement (ETA: 2 hours) 🔴

**Goal**: Poisoning/Trust events automatically update Governance metrics and gate status.

**Priority**: CRITICAL (blocks deployment automation)

**Gate P (NEW)**:
```typescript
{
  id: "gate-p-retrieval-poisoning",
  check: (context) => {
    // FAIL if any poisoned content attempted delivery
    return context.retrieval.poisonedBlocked === 0;
  },
  severity: "P0",
  action: "block_deployment"
}
```

**Gate I (ENHANCE)**:
```typescript
{
  id: "gate-i-source-trust",
  check: (context) => {
    // WARNING if trust score below 0.6 threshold
    return context.retrieval.avgTrustScore >= 0.6;
  },
  severity: "P1",
  action: "warning"
}
```

**Files to Modify**:
```
✅ Modify: src/domain/preflight/gating-rules.ts (add Gate P, update Gate I)
✅ Modify: src/core/governance/meta-kernel.ts (add event handlers)
✅ Create: tests/domain/preflight/gates-retrieval.test.ts
```

**Implementation Steps**:
1. Add Gate P to gating-rules.ts
2. Enhance Gate I with trust floor check
3. Connect governance event handler:
   ```typescript
   on("retrieval_assessment", (data) => {
     updateGateStatus("gate-p", data.poisoned_blocked === 0);
     updateGateStatus("gate-i", data.trust_avg >= 0.6);
   });
   ```
4. Update RG report to include retrieval metrics

**Success Criteria**:
- [ ] Gate P defined and operational
- [ ] Gate I enhanced with trust floor check
- [ ] Retrieval events auto-update gate status
- [ ] RG report includes retrieval metrics (trust_avg, poisoned_blocked)
- [ ] Deployment blocked if Gate P fails

---

## 📋 Phase 1.6: Full Implementation Checklist

### Feedback Intelligence Layer
- [ ] `src/application/feedback-adapter.ts` - Intent classification (6 types)
- [ ] `src/application/feedback-labeler.ts` - Confidence scoring (1-5)
- [ ] `src/infrastructure/retrieval/source-trust-updater.ts` - Trust DB updates
- [ ] `src/infrastructure/retrieval/source-trust-persistence.ts` - Save/load to disk
- [ ] `reports/source-trust.json` - Trust score history
- [ ] `reports/feedback-graph.jsonl` - Feedback intelligence log

### Test Chain Integration
- [ ] `scripts/test-sequence.ts` - Sequential test runner
- [ ] Update `scripts/guard.ts` - Call test sequence in strict mode
- [ ] Update `package.json` - Add `test:sequence` script
- [ ] CI integration - GitHub Actions workflow update
- [ ] Performance monitoring - Test duration tracking

### Gate Enhancement
- [ ] Update `src/domain/preflight/gating-rules.ts` - Add Gate P
- [ ] Enhance Gate I - Trust floor check (≥0.6)
- [ ] `tests/domain/preflight/gates-retrieval.test.ts` - Gate P/I tests
- [ ] Governance event handler - Update gate status on events
- [ ] RG report - Include retrieval metrics

### Evidence Viewer (WebView SSR)
- [ ] `web/components/EvidenceViewer.tsx` - Main viewer
- [ ] `web/components/TrustBadge.tsx` - Trust indicator (🟢🟡🔴)
- [ ] `web/components/SourceLink.tsx` - Source attribution
- [ ] `web/components/FeedbackButton.tsx` - "부적절" button
- [ ] `web/app/evidence/[id]/page.tsx` - Evidence detail page
- [ ] API endpoint - `/api/evidence/:id` (SSR data fetch)
- [ ] API endpoint - `/api/feedback` (POST feedback)

### Metrics & Reporting
- [ ] `src/application/reporting/retrieval-reporter.ts` - Metrics collector
- [ ] `reports/retrieval-metrics.json` - Retrieval KPIs
- [ ] `reports/evidence-trust.jsonl` - Per-chunk trust scores
- [ ] Dashboard integration - Governance dashboard update

---

## 🗺️ Phase 2.0: Multi-Tenant Foundation (3 weeks, ETA: 2025-11-12)

**Goal**: Support multiple clients/domains/projects with centralized governance.

### Top-3 Priority (Phase 2.0)

1. **Control Plane / Data Plane Architecture** (CRITICAL 🔴)
   - Tenant Registry + Namespaced Policy DSL
   - Separate governance (control) from execution (data)
   - Config-as-Code + GitOps for tenant policies

2. **Tenant-Scoped Retrieval Fabric** (HIGH 🔴)
   - Per-tenant corpus/index/cache isolation
   - Trust/Poisoning Guard tenant allowlists
   - Zero data leakage guarantee

3. **Lineage Ledger Enhancement** (HIGH 🔴)
   - Add tenant/domain/usecase to all traces
   - Cross-tenant drift map
   - Per-tenant audit reports

### Key Components (Phase 2.0)
- `src/core/tenancy/tenant-registry.ts` - Tenant CRUD
- `tenants/<tenant>/policies/*.yaml` - GitOps policy structure
- `src/core/governance/namespaced-policy-dsl.ts` - Tenant-aware DSL
- `src/infrastructure/tenancy/feature-matrix.ts` - Per-tenant FF
- `src/infrastructure/tenancy/model-router.ts` - Tenant-scoped routing

### Definition of Done (Phase 2.0)
- Data leakage: 0% (proven via tests)
- Tenant gate pass rate: ≥95%
- Lineage trace depth: ≥3 hops
- All tenant policies in Git
- PR + signature required for prod

---

## 🤖 Phase 2.1: Hybrid Intelligence (4-6 weeks, ETA: 2025-12-24)

**Goal**: Feedback + Retrieval + Planner autonomous learning/correction loop.

### Top-3 Priority (Phase 2.1)

1. **HybridOrchestrator (BM25+Vector+RAGAS)** (HIGH 🔴)
   - α·β automatic learning from feedback
   - "Evidence Quality" driven weight adjustment
   - Feature Flag: FEATURE_HYBRID_RETRIEVAL

2. **RAGAS Bridge Integration** (HIGH 🔴)
   - Recall@K, MRR, Groundedness, Faithfulness
   - Auto-report to governance metrics
   - Gate C/D connection (stability/cost)

3. **Self-Tuning Planner** (MEDIUM 🟠)
   - Retrieval results → Planner query strategy adjustment
   - Periodic feedback-driven weight learning
   - Weekly auto-tuning cycle

### Key Components (Phase 2.1)
- `src/infrastructure/retrieval/vector-adapter.ts` - Embedding-based retrieval
- `src/infrastructure/retrieval/hybrid-orchestrator.ts` - Weighted fusion
- `src/application/evaluation/ragas-bridge.ts` - RAGAS integration
- `src/application/planning/self-tuning-planner.ts` - Auto-tuning logic

### Definition of Done (Phase 2.1)
- Groundedness: ≥85%
- Faithfulness: ≥85%
- Recall@10: +10~20% improvement
- MRR: +10~20% improvement
- Drift detection latency: <6h
- Compliance coverage: ≥95%

---

## 📊 Progress Tracking

### Completed ✅
- [x] Phase 2C (Policy + Sandbox + Evolution)
- [x] Phase 1 (MBC: Handshake + Token + Scheduler)
- [x] Phase 1.5 (Retrieval: Port + Trust + Guard + BM25)
- [x] Integrated Roadmap Documentation (Phase 1.6 → 2.1)

### In Progress 🚧 (Phase 1.6)
- [ ] Feedback Adapter + Source Trust Updater (Top-3 #1)
- [ ] Test Chain Integration (Top-3 #2)
- [ ] Gate P/I Enhancement (Top-3 #3)

### Planned 📋 (Phase 1.6)
- [ ] Evidence Viewer (WebView SSR)
- [ ] Retrieval Metrics Reporting
- [ ] Documentation updates (README, SESSION_STATE, NEXT_ACTIONS)

### Future Phases 🔮
- [ ] Phase 2.0: Multi-Tenant Foundation (3 weeks)
- [ ] Phase 2.1: Hybrid Intelligence (4-6 weeks)

---

## 🆘 Emergency Rollback

**If Phase 1.6 breaks tests**:
```bash
git checkout phase1.5-retrieval-complete
npm install
npm test
```

**Recovery checklist**:
1. Read `docs/SESSION_STATE.md`
2. Check `git log --oneline -10`
3. Review `docs/NEXT_ACTIONS.md` (this file)
4. Start from Critical Path item #1

---

## 📞 Key Documents & Resources

### Primary References
- **Integrated Roadmap**: `docs/RFC/2025-10-integrated-roadmap-phase1.6-to-2.1.md` ⭐ **NEW**
- **Multi-Tenant Architecture**: `docs/ARCHITECTURE_MULTI_TENANT.md` ⭐ **NEW**
- **Session State**: `docs/SESSION_STATE.md` (updated with roadmap)
- **Product Plan**: `docs/PRODUCT_PLAN.md`

### Development Standards
- **Development Contract**: `LLM_DEVELOPMENT_CONTRACT.md`
- **Development Standards**: `DEVELOPMENT_STANDARDS.md`
- **TypeScript Guidelines**: `docs/TYPESCRIPT_GUIDELINES.md`
- **System Philosophy**: `CLAUDE.md`

### Architecture & Design
- **Architecture Summary**: `docs/llm_friendly_summary.md`
- **RFC Directory**: `docs/RFC/`
- **Phase Documentation**: `docs/PHASE_*.md`

### Commands & Tools
- **Command Guide**: `docs/COMMAND_GUIDE.md`
- **Super Claude Runbook**: `docs/super_claude_runbook.md`

---

## 💡 Key Principles (Reminder)

1. **Evolutionary Expansion, NOT Rewrite**
   - Current structure is a "living organism with genetic structure"
   - Add layers, don't rebuild foundation

2. **Top-3 + Full Backlog**
   - Top-3 for immediate action
   - Full checklist for complete visibility
   - N-point design (not artificially limited)

3. **Control Plane / Data Plane** (Phase 2.0)
   - Separate governance from execution
   - Enable multi-tenant without complexity explosion

4. **Governance First, Features Second**
   - Every feature must pass Gate checks
   - DNA Lock-In + Adaptive Mode maintained
   - Security/compliance non-negotiable

5. **Feedback-Driven Evolution**
   - User feedback → Trust scores → Retrieval quality
   - Self-tuning loops for continuous improvement
   - Data becomes competitive moat

---

**Remember**: Always update `docs/SESSION_STATE.md` after completing a major task!

**Last Updated**: 2025-10-08 20:30 KST
