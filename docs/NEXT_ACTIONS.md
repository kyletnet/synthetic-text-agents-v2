# Next Actions - Detailed Checklist

**Last Updated**: 2025-10-08 18:30 KST
**Status**: Ready for Phase 1.6 prep

---

## 🚨 Critical Path (Must Do First)

### 1. Governance Loop 재결선 (ETA: 1-2 hours) 🔴

**Goal**: Connect Retrieval events to Governance kernel for automatic Gate I/P updates.

**Files to Create/Modify**:
```
✅ Create: src/application/retrieval-feedback-bridge.ts
✅ Modify: src/infrastructure/retrieval/bm25-adapter.ts (add event emission)
✅ Modify: src/core/governance/meta-kernel.ts (add event handler)
```

**Implementation Steps**:
1. Create `retrieval-feedback-bridge.ts`:
   ```typescript
   export async function reportRetrievalEvent(result: RetrievalResult) {
     await emitGovernanceEvent({
       event: "retrieval_assessment",
       trust_avg: result.metadata.avgTrustScore,
       poisoned_blocked: result.metadata.poisonedBlocked,
       timestamp: result.metadata.timestamp.toISOString()
     });
   }
   ```

2. Integrate into BM25Adapter:
   ```typescript
   // After retrieval, before return
   await reportRetrievalEvent(result);
   return result;
   ```

3. Add handler in meta-kernel:
   ```typescript
   on("retrieval_assessment", (data) => {
     updateGateStatus("gate-i", data.trust_avg >= 0.6);
     updateGateStatus("gate-p", data.poisoned_blocked === 0);
   });
   ```

**Success Criteria**:
- [ ] Retrieval events appear in governance logs
- [ ] Gate I/P status auto-updates
- [ ] RG report includes retrieval metrics

---

### 2. Feedback ↔ RetrievalPort 동기화 (ETA: 2-3 hours) 🔴

**Goal**: User feedback ("근거 부적절") updates SourceTrust scores dynamically.

**Files to Create/Modify**:
```
✅ Create: src/application/feedback-adapter.ts
✅ Create: src/infrastructure/retrieval/source-trust-updater.ts
✅ Modify: src/infrastructure/retrieval/source-trust.ts (add update methods)
```

**Implementation Steps**:
1. Create `feedback-adapter.ts`:
   ```typescript
   export async function processFeedback(feedback: UserFeedback) {
     if (feedback.intent === "evidence_incorrect") {
       const { domain, chunkId } = feedback.context;
       await updateSourceTrust({ domain, delta: -0.1 });
     }
   }
   ```

2. Create `source-trust-updater.ts`:
   ```typescript
   export async function updateSourceTrust(params: {
     domain?: string;
     author?: string;
     delta: number;
   }) {
     // Update SourceTrust config
     // Persist to file/DB
     // Emit event
   }
   ```

3. Add persistence to SourceTrust:
   ```typescript
   async saveToDisk(path: string): Promise<void>
   async loadFromDisk(path: string): Promise<void>
   ```

**Success Criteria**:
- [ ] Feedback intent "evidence_incorrect" detected
- [ ] SourceTrust domain scores updated (-0.1)
- [ ] Changes persisted to `reports/source-trust.json`
- [ ] Next retrieval uses updated scores

---

### 3. 테스트 체인 통합 (ETA: 1 hour) 🟠

**Goal**: Sequential test execution to catch regressions properly.

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

## 🎯 Phase 1.6 Roadmap (Next)

### 4. Phase 1.6 RFC 문서화 (ETA: 1 hour)

**File**: `docs/RFC/2025-10-phase1.6-hybrid-ragas.md`

**Sections**:
- Purpose & Motivation
- VectorAdapter design
- HybridOrchestrator design
- RAGAS Bridge design
- Gate P/I specification
- Rollout strategy (Canary)
- Success criteria

---

### 5. VectorAdapter 구현 (ETA: 4-6 hours)

**Features**:
- Embedding API integration (OpenAI/Voyage/local)
- Embedding cache (LRU, TTL, versioned keys)
- p-limit(4) for parallel requests
- Cosine similarity scoring
- Batch support

**Files**:
- `src/infrastructure/retrieval/vector-adapter.ts`
- `src/infrastructure/retrieval/embedding-cache.ts`
- Tests: `tests/integration/vector-adapter.test.ts`

---

### 6. HybridOrchestrator 구현 (ETA: 3-4 hours)

**Features**:
- Weighted fusion: α·BM25 + β·Vector
- Reciprocal Rank Fusion (RRF) as alternative
- Feature Flag: `FEATURE_HYBRID_RETRIEVAL`
- Adaptive weight tuning (Phase 2.2)

**Files**:
- `src/infrastructure/retrieval/hybrid-orchestrator.ts`
- Tests: `tests/integration/hybrid-orchestrator.test.ts`

---

### 7. RAGAS Bridge 구현 (ETA: 4-6 hours)

**Metrics**:
- Recall@K (K=1,5,10)
- MRR (Mean Reciprocal Rank)
- Groundedness (answer grounded in context)
- Faithfulness (answer faithful to context)

**Files**:
- `src/application/evaluation/ragas-bridge.ts`
- `src/application/evaluation/ragas-metrics.ts`
- Feature Flag: `FEATURE_RAGAS_EVAL`
- Tests: `tests/integration/ragas.test.ts`

---

### 8. Gate P/I 확장 (ETA: 2 hours)

**Gate P (NEW)**:
```typescript
{
  id: "gate-p-retrieval-poisoning",
  check: (context) => {
    return context.retrieval.poisonedBlocked === 0;
  },
  severity: "P0"
}
```

**Gate I (ENHANCE)**:
```typescript
{
  id: "gate-i-source-trust",
  check: (context) => {
    return context.retrieval.avgTrustScore >= 0.6;
  },
  severity: "P1"
}
```

**Files**:
- `src/domain/preflight/gating-rules.ts` (add Gate P, update Gate I)
- Tests: `tests/domain/preflight/gates.test.ts`

---

### 9. Retrieval Metrics Report (ETA: 2 hours)

**Report**: `reports/retrieval-metrics.json`

**Schema**:
```json
{
  "timestamp": "2025-10-08T10:30:00Z",
  "strategy": "hybrid",
  "recallAt10": 0.85,
  "mrr": 0.72,
  "groundedness": 0.88,
  "faithfulness": 0.91,
  "avgTrustScore": 0.74,
  "poisonedBlocked": 3,
  "cacheHitRate": 0.73
}
```

**Files**:
- `src/application/reporting/retrieval-reporter.ts`
- `scripts/generate-retrieval-report.ts`

---

### 10. Evidence Viewer (WebView SSR) (ETA: 8-12 hours)

**Components**:
- Evidence snippet display (200-char limit)
- Trust badge (🟢 High / 🟡 Medium / 🔴 Low)
- Source link + timestamp
- "부적절" feedback button

**Tech Stack**:
- Next.js 14 (SSR)
- React Server Components
- Tailwind CSS

**Files**:
- `web/components/EvidenceViewer.tsx`
- `web/components/TrustBadge.tsx`
- `web/components/FeedbackButton.tsx`
- `web/app/evidence/[id]/page.tsx`

---

## 🧱 Deeper Enhancements (Phase 2+)

### Data Lineage Ledger
- `reports/lineage.jsonl` - Complete trace from source to output
- Schema: `{source_id, query_id, trust_score, feedback_link, timestamp}`

### Adaptive Cost Router
- Dynamic model selection (Claude/OpenAI/Mistral)
- Cost/performance trade-offs
- Circuit breaker integration

### Retrieval Drift Guard
- 30-day reindex schedule
- Recall drift detection (>15% triggers alert)
- Auto re-embedding queue

### Self-Tuning Planner
- Weekly weight adjustment based on metrics
- Domain-specific query strategies
- Reinforcement learning (Phase 3)

---

## 📊 Progress Tracking

### Completed ✅
- [x] Phase 2C (Policy + Sandbox + Evolution)
- [x] Phase 1 (MBC: Handshake + Token + Scheduler)
- [x] Phase 1.5 (Retrieval: Port + Trust + Guard + BM25)

### In Progress 🚧
- [ ] Governance Loop 재결선
- [ ] Feedback 동기화
- [ ] Test Chain 통합

### Planned 📋
- [ ] Phase 1.6 RFC
- [ ] VectorAdapter
- [ ] HybridOrchestrator
- [ ] RAGAS Bridge
- [ ] Gate P/I
- [ ] Retrieval Metrics
- [ ] Evidence Viewer

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

## 📞 Contact & Resources

- **RFC Directory**: `docs/RFC/`
- **Architecture Docs**: `docs/llm_friendly_summary.md`
- **Development Standards**: `DEVELOPMENT_STANDARDS.md`
- **Product Plan**: `docs/PRODUCT_PLAN.md`

---

**Remember**: Always update `docs/SESSION_STATE.md` after completing a major task!
