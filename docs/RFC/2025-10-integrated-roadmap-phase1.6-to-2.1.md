# RFC: Integrated Development Roadmap (Phase 1.6 → 2.1)

**Status**: Active Roadmap
**Created**: 2025-10-08
**Owner**: System Architecture Team
**Approach**: Evolutionary Expansion (NOT Rewrite)

---

## Executive Summary

**Current State**: Phase 1.5 complete with Governance Loop connected.
**Strategy**: Evolutionary expansion - strengthen integration loops + prepare multi-tenant foundation.
**Timeline**: Phase 1.6 (2 weeks) → Phase 2.0 (3 weeks) → Phase 2.1 (4-6 weeks)

**Key Principle**: "Top-3 Priority + Full Backlog" approach
- Top-3 serves as immediate action headline
- Full checklist maintains complete visibility
- N-point design (not artificially limited to 3)

---

## Current System Health Assessment

| Layer | Status | Evaluation |
|-------|--------|------------|
| Domain/Application (DDD) | Port/Adapter complete | ✅ Structurally complete |
| Governance Kernel | DNA Lock + Adaptive Mode | ✅ Stable |
| Retrieval/Trust/Guard | V1 + Event Bridge | ✅ Integration started |
| Feedback/Metrics Loop | Intelligence Layer next | ⚠️ Partial connection |
| Multi-Agent Bus (MBC) | Token + Scheduler working | ✅ Solid |
| Test Chain / Gates | Separate execution | 🟡 Integration needed |
| Multi-Domain / Tenant | Single "default" tenant | 🔴 Design enhancement needed |
| WebView / Integration | SSR planned | ⚪ Normal progress |

**Conclusion**: System is a "living organism with genetic structure" - NOT a house needing rebuild.

---

## Phase 1.6: Organic Loop Completion (2 weeks)

### Goal
Complete Retrieval ↔ Feedback ↔ Governance circular flow.

### Top-3 Priority

1. **Feedback Adapter + Source Trust Updater** (HIGH 🔴)
   - User feedback ("incorrect evidence") → SourceTrust DB
   - Trust score delta (±0.1) automatic adjustment
   - Feedback logs → Governance events

2. **Test Chain Integration** (MEDIUM 🟠)
   - `/guard --strict` auto-runs Phase2C + 1 + 1.5
   - Regression detection automation
   - `scripts/test-sequence.ts` implementation

3. **Gate P/I Enhancement** (HIGH 🔴)
   - Poisoning/Trust events → Governance metrics
   - Gate P: Retrieval Poisoning FAIL = deployment block
   - Gate I: Trust floor <0.4 = warning

### Full Implementation Checklist

#### Feedback Intelligence Layer
- [ ] `src/application/feedback-adapter.ts` - Intent classification (6 types)
- [ ] `src/application/feedback-labeler.ts` - Confidence scoring (1-5)
- [ ] `src/infrastructure/retrieval/source-trust-updater.ts` - Trust DB updates
- [ ] `src/infrastructure/retrieval/source-trust-persistence.ts` - Save/load to disk
- [ ] `reports/source-trust.json` - Trust score history
- [ ] `reports/feedback-graph.jsonl` - Feedback intelligence log

#### Test Chain Integration
- [ ] `scripts/test-sequence.ts` - Sequential test runner
- [ ] Update `scripts/guard.ts` - Call test sequence in strict mode
- [ ] Update `package.json` - Add `test:sequence` script
- [ ] CI integration - GitHub Actions workflow update
- [ ] Performance monitoring - Test duration tracking

#### Gate Enhancement
- [ ] Update `src/domain/preflight/gating-rules.ts` - Add Gate P
- [ ] Enhance Gate I - Trust floor check (≥0.6)
- [ ] `tests/domain/preflight/gates.test.ts` - Gate P/I tests
- [ ] Governance event handler - Update gate status on events
- [ ] RG report - Include retrieval metrics

#### Evidence Viewer (WebView SSR)
- [ ] `web/components/EvidenceViewer.tsx` - Main viewer
- [ ] `web/components/TrustBadge.tsx` - Trust indicator (🟢🟡🔴)
- [ ] `web/components/SourceLink.tsx` - Source attribution
- [ ] `web/components/FeedbackButton.tsx` - "부적절" button
- [ ] `web/app/evidence/[id]/page.tsx` - Evidence detail page
- [ ] API endpoint - `/api/evidence/:id` (SSR data fetch)
- [ ] API endpoint - `/api/feedback` (POST feedback)

#### Metrics & Reporting
- [ ] `src/application/reporting/retrieval-reporter.ts` - Metrics collector
- [ ] `reports/retrieval-metrics.json` - Retrieval KPIs
- [ ] `reports/evidence-trust.jsonl` - Per-chunk trust scores
- [ ] Dashboard integration - Governance dashboard update

### Definition of Done (DoD)

**Quality**:
- Tests ≥ 98% (target: 770+/780+)
- p95 latency ≤ 3.1s (maintained)
- Zero new ESLint errors

**Functionality**:
- Feedback → Trust update within 24h
- Gate P/I auto-updates on retrieval events
- Test chain catches regressions (proven)
- Evidence Viewer accessible via web

**Documentation**:
- README updated with Phase 1.6 features
- `docs/SESSION_STATE.md` updated
- `docs/NEXT_ACTIONS.md` updated

---

## Phase 2.0: Multi-Tenant Foundation (3 weeks)

### Goal
Support multiple clients/domains/projects with centralized governance.

### Top-3 Priority

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

### Full Implementation Checklist

#### Control Plane Components
- [ ] `src/core/tenancy/tenant-registry.ts` - Tenant CRUD
- [ ] `src/core/tenancy/tenant-types.ts` - Tenant schemas
- [ ] `tenants/<tenant>/policies/*.yaml` - GitOps policy structure
- [ ] `src/core/governance/namespaced-policy-dsl.ts` - Tenant-aware DSL
- [ ] `src/core/governance/policy-acl.ts` - Anti-corruption layer enhancement
- [ ] Policy signature validation - Per-tenant signing keys

#### Feature Matrix / Model Router
- [ ] `src/infrastructure/tenancy/feature-matrix.ts` - Per-tenant FF
- [ ] `src/infrastructure/tenancy/model-router.ts` - Tenant-scoped routing
- [ ] `tenants/<tenant>/router.yaml` - Model routing config
- [ ] `tenants/<tenant>/features.yaml` - Feature flags config
- [ ] Cost/performance policies - Tenant SLO enforcement

#### Data Plane Isolation
- [ ] Tenant-scoped storage - Separate buckets/namespaces
- [ ] Tenant-scoped queues - Isolated work queues
- [ ] Tenant-scoped caches - Separate Redis namespaces
- [ ] Retrieval Fabric isolation - Per-tenant corpus/index
- [ ] Trust/Poisoning Guard - Tenant allowlist injection

#### Lineage & Observability
- [ ] Update `reports/lineage.jsonl` schema - Add tenant fields
- [ ] Cross-tenant drift map - `reports/tenant-drift-map.json`
- [ ] Per-tenant metrics - Separate dashboards
- [ ] OTel trace tags - tenant/domain/usecase
- [ ] Audit log enhancement - Tenant-scoped logs

#### RBAC/ABAC + Data Sovereignty
- [ ] `src/core/tenancy/rbac.ts` - Role-based access control
- [ ] `src/core/tenancy/abac.ts` - Attribute-based access control
- [ ] `tenants/<tenant>/data-sovereignty.yaml` - Region/retention policies
- [ ] KMS per tenant - Separate encryption keys
- [ ] Key rotation - Automated 90-day rotation

### Definition of Done (DoD)

**Isolation**:
- Data leakage: 0% (proven via tests)
- Tenant gate pass rate: ≥95%
- Lineage trace depth: ≥3 hops

**Configuration**:
- All tenant policies in Git
- PR + signature required for prod
- Canary deployment (10→50→100%)

**Observability**:
- Per-tenant dashboards live
- Cross-tenant drift map generated
- Cost/performance per tenant tracked

---

## Phase 2.1: Hybrid Intelligence (4-6 weeks)

### Goal
Feedback + Retrieval + Planner autonomous learning/correction loop.

### Top-3 Priority

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

### Full Implementation Checklist

#### Vector & Hybrid Retrieval
- [ ] `src/infrastructure/retrieval/vector-adapter.ts` - Embedding-based retrieval
- [ ] `src/infrastructure/retrieval/embedding-cache.ts` - LRU cache (TTL, versioned keys)
- [ ] `src/infrastructure/retrieval/hybrid-orchestrator.ts` - Weighted fusion
- [ ] `src/infrastructure/retrieval/reciprocal-rank-fusion.ts` - RRF algorithm
- [ ] Feature Flag: FEATURE_HYBRID_RETRIEVAL (default: false)
- [ ] p-limit(4) for parallel embedding requests
- [ ] Cosine similarity implementation
- [ ] Batch embedding support

#### RAGAS Bridge
- [ ] `src/application/evaluation/ragas-bridge.ts` - RAGAS integration
- [ ] `src/application/evaluation/ragas-metrics.ts` - Metric calculations
- [ ] Feature Flag: FEATURE_RAGAS_EVAL (default: false)
- [ ] Recall@K (K=1,5,10) implementation
- [ ] MRR (Mean Reciprocal Rank) calculation
- [ ] Groundedness scoring (answer grounded in context)
- [ ] Faithfulness scoring (answer faithful to context)
- [ ] `reports/ragas-metrics.json` - RAGAS report

#### Self-Tuning Components
- [ ] `src/application/planning/self-tuning-planner.ts` - Auto-tuning logic
- [ ] `src/application/planning/weight-learner.ts` - Feedback-based learning
- [ ] `src/application/planning/query-strategy.ts` - Domain-specific strategies
- [ ] Weekly tuning schedule - Cron job setup
- [ ] Performance tracking - Before/after metrics
- [ ] Rollback mechanism - Revert bad tuning

#### Compliance-Aware Evaluator
- [ ] `src/domain/evaluation/evaluation-schema.ts` - Regulation schemas
- [ ] `src/domain/evaluation/compliance-templates/hipaa.ts` - Healthcare
- [ ] `src/domain/evaluation/compliance-templates/sox.ts` - Financial
- [ ] `src/domain/evaluation/compliance-templates/iso27001.ts` - Security
- [ ] `src/infrastructure/policy-watchdog.ts` - Policy document monitoring
- [ ] `reports/compliance-score.json` - Compliance report
- [ ] Hash-based change detection - Auto re-eval on policy change

### Definition of Done (DoD)

**Quality Metrics**:
- Groundedness: ≥85%
- Faithfulness: ≥85%
- Recall@10: +10~20% improvement
- MRR: +10~20% improvement

**Automation**:
- Drift detection latency: <6h
- Auto-tuning cycle: weekly
- Compliance coverage: ≥95%

**Performance**:
- p95 latency: ≤3.1s (maintained)
- Cost/1kQA: ≤target (maintained or improved)
- Cache hit rate: ≥70%

---

## Critical Weaknesses & Preventive Measures

| Weakness | Risk | Prevention/Mitigation |
|----------|------|----------------------|
| Loop complexity explosion | Agent/Governance/Retrieval path duplication | Event Bus queue integration + TraceID-based lineage |
| Incomplete tenant isolation | Data/policy contamination | Namespace key enforcement + Policy Kernel validation |
| Over-aggressive poisoning | Dropping legitimate data | Sampling + manual override window |
| Feedback loop bias | User feedback noise distortion | Weighted decay (feedback half-life: 7 days) |
| Policy drift | Outdated DSL application | 30-day policy hash validation (Entropy Monitor) |
| Performance/cost increase | Vector/BM25 parallelization load | p-limit + LRU Cache + Router-level Cost Balancer |
| Noisy Neighbor (multi-tenant) | Tenant resource starvation | Per-tenant quota + cost circuit breaker |
| Tenant data leakage | Cross-tenant data exposure | Storage/log/metrics namespace keys forced |
| Policy conflict/surge | Conflicting tenant policies | Conflict Map + Canary + central approval |
| Regulatory conflicts (region) | Data sovereignty violations | data_sovereignty.yaml → Policy Kernel real-time check |

---

## Future Roadmap (Phase 2+)

### Q1 2026: Multimodal Evidence
- RetrievalPort V2 - Image/code/table support
- Evidence Viewer - Visual evidence display

### Q2 2026: External Agent Platform Integration
- Multi-Agent Bridge Adapter - AWS Agents, Vertex AI
- AC Layer drivers - LangChain, AutoGen, Anthropic Agents

### Q3 2026: Regulatory Compliance Hardening
- EU AI Act compliance - Complete audit trail
- Compliance Evaluator expansion - 10+ regulation templates
- Lineage Ledger enhancement - Legally presentable PDF reports

### Q4 2026: SaaS/Open-Core Model
- Control Plane commercial offering
- Demo WebView public launch
- Open-source template repository

---

## Migration Strategy (Zero-Downtime)

### Step 1: Namespace Introduction (Non-disruptive)
- Add tenant/domain/usecase fields to existing schemas (default: "default")
- Backward compatibility maintained

### Step 2: Policy DSL GitOps Transition (Parallel)
- Migrate current DSL to `tenants/default/`
- New tenants start with GitOps from day 1

### Step 3: Retrieval Fabric Isolation
- Move existing corpus to `default/` namespace
- New tenants get dedicated buckets/indexes

### Step 4: Router/FF Tenant-ization
- Split Feature Matrix/Router into per-tenant files
- Apply gradually (tenant by tenant)

### Step 5: WebView Multi-Tenant Mode
- Login/role-based view (users see own tenant only)
- Central operator view (multi-tenant dashboard)

---

## Implementation Timeline

### Week 1-2 (Phase 1.6 Sprint 1)
- Feedback Adapter + Source Trust Updater
- Test Chain Integration
- Gate P/I Enhancement

### Week 3-4 (Phase 1.6 Sprint 2)
- Evidence Viewer (WebView SSR)
- Retrieval Metrics Reporting
- Phase 1.6 DoD verification

### Week 5-7 (Phase 2.0 Sprint 1)
- Tenant Registry + Namespaced DSL
- GitOps policy structure
- Retrieval Fabric isolation

### Week 8-9 (Phase 2.0 Sprint 2)
- Feature Matrix / Model Router tenant-ization
- Lineage Ledger enhancement
- RBAC/ABAC implementation

### Week 10-11 (Phase 2.0 Sprint 3)
- Data sovereignty policies
- Per-tenant dashboards
- Phase 2.0 DoD verification

### Week 12-17 (Phase 2.1)
- VectorAdapter + HybridOrchestrator (weeks 12-13)
- RAGAS Bridge (weeks 14-15)
- Self-Tuning Planner (weeks 16-17)
- Compliance-Aware Evaluator (weeks 16-17)

---

## Success Metrics

### Phase 1.6
- Tests: ≥98% (770+/780+)
- Feedback → Trust update: ≤24h
- Gate P/I auto-update: 100%
- Evidence Viewer: accessible

### Phase 2.0
- Data leakage: 0%
- Tenant gate pass rate: ≥95%
- Lineage trace depth: ≥3 hops
- Policies in Git: 100%

### Phase 2.1
- Groundedness: ≥85%
- Recall@10: +10~20%
- Drift detection: <6h
- Compliance coverage: ≥95%

---

## Key Principles (Repeated for Emphasis)

1. **Evolutionary Expansion, NOT Rewrite**
   - Current structure is a "living organism with genetic structure"
   - Add layers, don't rebuild foundation

2. **Top-3 + Full Backlog**
   - Top-3 for immediate action
   - Full checklist for complete visibility
   - N-point design (not artificially limited)

3. **Control Plane / Data Plane**
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

## References

- Phase 0-1.5 Docs: `docs/PHASE_*.md`, `docs/RFC/2025-10-phase*.md`
- Session State: `docs/SESSION_STATE.md`
- Next Actions: `docs/NEXT_ACTIONS.md`
- Product Plan: `docs/PRODUCT_PLAN.md`
- Architecture: `docs/llm_friendly_summary.md`
- Development Standards: `DEVELOPMENT_STANDARDS.md`

---

## Approval Checklist

- [ ] Technical Review (Architecture Team)
- [ ] Security Review (Security Team)
- [ ] Product Review (Product Team)
- [ ] Go/No-Go (11 items) - Pre-deployment checklist

---

**Document Status**: Active roadmap for Phase 1.6 → 2.1
**Next Review**: After Phase 1.6 completion
**Owner**: System Architecture Team
