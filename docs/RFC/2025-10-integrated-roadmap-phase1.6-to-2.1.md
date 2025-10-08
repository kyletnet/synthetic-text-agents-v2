# RFC: Integrated Development Roadmap (Phase 1.6 → 2.1) - v2

**Status**: Active Roadmap (v2 - Ecosystem Evolution)
**Created**: 2025-10-08
**Last Updated**: 2025-10-08 (v2 - Critical Weaknesses + Fundamental Structures)
**Owner**: System Architecture Team
**Approach**: Evolutionary Expansion (NOT Rewrite) → "Living DNA → Adaptive Ecosystem"

---

## Executive Summary

**Current State**: Phase 1.5 complete with Governance Loop connected. **System is strong but single-loop centered.**

**Strategy**: Evolutionary expansion - strengthen integration loops + address 4 critical weaknesses + add 3 fundamental structures.

**Timeline (v2 Updated)**:
- Phase 1.6 (2 weeks) → **Phase 1.7 (2 weeks)** → **Phase 1.8 (3 weeks)** → Phase 2.0 (3 weeks) → Phase 2.1 (4-6 weeks)

**Key Evolution**:
- v1: Single-loop system
- v2: **Multi-domain adaptive ecosystem** with Event Spine, Feedback Fabric, and Control Plane

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
| **Event Spine** | **Missing** | 🔴 **v2 Addition - Critical** |
| **Feedback Intelligence Fabric** | **Partial (Adapter pending)** | 🟡 **v2 Enhancement** |
| **Multi-Tenant Control Plane** | **Not started** | 🔴 **v2 Addition - Critical** |

**Conclusion**: System is a "living organism with genetic structure" - NOT a house needing rebuild.
**v2 Diagnosis**: Strong foundation, but needs **Event Spine, Feedback Fabric, and Control Plane** to scale to multi-domain adaptive ecosystem.

---

## 🚨 4 Critical Weaknesses (v2 Identified)

These weaknesses must be addressed in Phase 1.6-1.8 to prevent system limitations:

| # | Weakness | Current Risk | v2 Solution | Target Phase |
|---|----------|--------------|-------------|--------------|
| **1** | **Feedback Loop Closure** | Loop repeats indefinitely without convergence detection → unnecessary compute waste | ✅ **Feedback Convergence Detector**: Stop when drift <5% & convergence >90% | Phase 1.6-1.8 |
| **2** | **Multi-Tenant Context Separation** | All events/logs/policies use "default" tenant → multi-domain expansion blocked | ✅ **Tenant-aware Context Propagation**: Auto-inject tenant/domain/usecase to all events | Phase 1.8-2.0 |
| **3** | **Policy Drift Early Warning** | DSL drift detected reactively, no prediction → policy conflicts discovered too late | ✅ **Policy Trend Analyzer**: Semantic diff + hash trend analysis for early warning | Phase 1.7-1.8 |
| **4** | **Gate Automation** | Gates A-D run manually → QA/deployment bottleneck | ✅ **Autonomous Gate Executor**: Auto-trigger on commit/merge/deploy | Phase 1.6-1.7 |

**Impact if not addressed**: Single-loop system cannot scale to multiple domains/clients without collision, drift, or manual overhead.

---

## Phase 1.6: Organic Loop Completion + Critical Weakness #1, #4 (2 weeks)

### Goal
Complete Retrieval ↔ Feedback ↔ Governance circular flow + address **Feedback Loop Closure** and **Gate Automation**.

### Top-3 Priority (v2 Enhanced)

1. **Feedback Adapter + Source Trust Updater + Convergence Detector** (CRITICAL 🔴)
   - User feedback ("incorrect evidence") → SourceTrust DB
   - Trust score delta (±0.1) automatic adjustment
   - Feedback logs → Governance events
   - **🆕 v2: Feedback Convergence Detector** - Stop loop when drift <5% & convergence >90%

2. **Test Chain Integration** (MEDIUM 🟠)
   - `/guard --strict` auto-runs Phase2C + 1 + 1.5
   - Regression detection automation
   - `scripts/test-sequence.ts` implementation

3. **Gate P/I Enhancement + Autonomous Gate Executor** (CRITICAL 🔴)
   - Poisoning/Trust events → Governance metrics
   - Gate P: Retrieval Poisoning FAIL = deployment block
   - Gate I: Trust floor <0.4 = warning
   - **🆕 v2: Autonomous Gate Executor** - Auto-trigger gates on commit/merge/deploy

### Full Implementation Checklist (v2 Enhanced)

#### Feedback Intelligence Layer + Convergence (Weakness #1)
- [ ] `src/application/feedback-adapter.ts` - Intent classification (6 types)
- [ ] `src/application/feedback-labeler.ts` - Confidence scoring (1-5)
- [ ] `src/infrastructure/retrieval/source-trust-updater.ts` - Trust DB updates
- [ ] `src/infrastructure/retrieval/source-trust-persistence.ts` - Save/load to disk
- [ ] `reports/source-trust.json` - Trust score history
- [ ] `reports/feedback-graph.jsonl` - Feedback intelligence log
- [ ] **🆕 v2: `src/application/feedback-convergence-detector.ts`** - Drift/convergence analysis
- [ ] **🆕 v2: Loop termination logic** - Stop condition (drift <5%, convergence >90%)
- [ ] **🆕 v2: Convergence metrics in RG report**

#### Test Chain Integration
- [ ] `scripts/test-sequence.ts` - Sequential test runner
- [ ] Update `scripts/guard.ts` - Call test sequence in strict mode
- [ ] Update `package.json` - Add `test:sequence` script
- [ ] CI integration - GitHub Actions workflow update
- [ ] Performance monitoring - Test duration tracking

#### Gate Enhancement + Automation (Weakness #4)
- [ ] Update `src/domain/preflight/gating-rules.ts` - Add Gate P
- [ ] Enhance Gate I - Trust floor check (≥0.6)
- [ ] `tests/domain/preflight/gates.test.ts` - Gate P/I tests
- [ ] Governance event handler - Update gate status on events
- [ ] RG report - Include retrieval metrics
- [ ] **🆕 v2: `src/core/governance/autonomous-gate-executor.ts`** - Auto-trigger engine
- [ ] **🆕 v2: Git hooks integration** - Pre-commit/pre-merge gate execution
- [ ] **🆕 v2: CI/CD pipeline integration** - Automatic gate checks

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

### Definition of Done (DoD) - v2 Enhanced

**Quality**:
- Tests ≥ 98% (target: 770+/780+)
- p95 latency ≤ 3.1s (maintained)
- Zero new ESLint errors
- **🆕 v2: Convergence detection accuracy ≥95%**

**Functionality**:
- Feedback → Trust update within 24h
- Gate P/I auto-updates on retrieval events
- Test chain catches regressions (proven)
- Evidence Viewer accessible via web
- **🆕 v2: Feedback loop auto-terminates when converged**
- **🆕 v2: Gates auto-trigger on commit/merge (100% coverage)**

**Documentation**:
- README updated with Phase 1.6 features
- `docs/SESSION_STATE.md` updated
- `docs/NEXT_ACTIONS.md` updated

---

## Phase 1.7: Event Spine + Policy Drift Warning (Critical Weakness #3) (2 weeks) 🆕 v2

### Goal
Establish central event backbone for all modules + enable proactive policy drift detection.

### Top-3 Priority

1. **Event Spine (Central Event Backbone)** (CRITICAL 🔴)
   - Unified pub/sub for Retrieval, Feedback, Governance, and Gate events
   - Tenant-aware event routing
   - Event replay and trace capabilities

2. **Policy Trend Analyzer** (HIGH 🔴)
   - Semantic diff + hash trend analysis
   - Early warning system for policy drift (before conflicts occur)
   - Policy conflict prediction

3. **Test Chain Full Integration** (MEDIUM 🟠)
   - Complete Phase2C + 1 + 1.5 + RG chain automation
   - Regression dashboard
   - Performance baseline tracking

### Full Implementation Checklist

#### Event Spine Infrastructure
- [ ] `src/core/event-spine/event-types.ts` - Standard event definitions
- [ ] `src/core/event-spine/emitter.ts` - Unified publish interface
- [ ] `src/core/event-spine/subscriber-registry.ts` - Subscriber management
- [ ] `src/core/event-spine/router.ts` - Tenant/domain-aware routing
- [ ] `src/core/event-spine/trace.ts` - Event lineage tracking
- [ ] `src/core/event-spine/replay.ts` - Event replay for debugging

#### Policy Drift Detection
- [ ] `src/core/governance/policy-trend-analyzer.ts` - Drift prediction
- [ ] `src/core/governance/policy-semantic-diff.ts` - Semantic comparison
- [ ] `src/core/governance/policy-hash-tracker.ts` - Hash trend analysis
- [ ] `reports/policy-drift-warnings.json` - Early warning reports
- [ ] Alert system - Slack/email integration for drift warnings

#### Test Chain Automation
- [ ] Complete `scripts/test-sequence.ts` - All phase coverage
- [ ] `scripts/regression-dashboard.ts` - Visual regression reports
- [ ] `reports/regression-baseline.json` - Performance baselines
- [ ] CI/CD full integration - All gates + tests automated

### Definition of Done (DoD)

**Quality**:
- All events flow through Event Spine
- Zero event loss (proven via tests)
- Policy drift prediction accuracy ≥80%

**Functionality**:
- Event trace from source to all consumers
- Policy drift warnings 7+ days before conflict
- Regression tests fully automated (no manual triggers)

**Documentation**:
- Event Spine architecture documented
- Policy drift monitoring guide
- Test chain playbook

---

## Phase 1.8: Feedback Intelligence Fabric (Critical Weakness #2) (3 weeks) 🆕 v2

### Goal
Transform user feedback into learning assets + enable tenant-aware context propagation.

### Top-3 Priority

1. **Feedback Intelligence Fabric** (CRITICAL 🔴)
   - Feedback vectorization (embeddings)
   - Semantic feedback memory and clustering
   - Auto-integration with SourceTrust and Planner

2. **Tenant-aware Context Propagation** (CRITICAL 🔴)
   - Auto-inject tenant/domain/usecase to ALL events/logs/policies
   - Namespace key enforcement
   - Context validation at all boundaries

3. **Feedback-Driven Retrieval Improvement** (HIGH 🔴)
   - Feedback Score >0.7 → SourceTrust boost
   - Negative feedback → RetrievalPort query adjustment
   - Weekly feedback-driven tuning cycle

### Full Implementation Checklist

#### Feedback Intelligence Fabric
- [ ] `src/application/feedback-fabric/feedback-ingestor.ts` - Text → structured signal
- [ ] `src/application/feedback-fabric/feedback-vectorizer.ts` - Embeddings generation
- [ ] `src/application/feedback-fabric/feedback-memory.ts` - Session-based cache
- [ ] `src/application/feedback-fabric/feedback-analyzer.ts` - Pattern/cluster analysis
- [ ] `src/application/feedback-fabric/feedback-scorer.ts` - Quality scoring (0-1)
- [ ] Integration with SourceTrust - Auto trust score adjustment
- [ ] Integration with Planner - Query strategy tuning

#### Tenant-aware Context
- [ ] `src/shared/context/tenant-context.ts` - Context injection middleware
- [ ] `src/shared/context/namespace-validator.ts` - Key enforcement
- [ ] Update all event emitters - Auto-inject tenant/domain/usecase
- [ ] Update all log statements - Include tenant context
- [ ] Update all metrics - Namespace by tenant
- [ ] Context boundary validation - Entry/exit point checks

#### Feedback-Driven Loop
- [ ] `src/application/feedback-loop/trust-adjuster.ts` - Feedback → Trust
- [ ] `src/application/feedback-loop/planner-tuner.ts` - Feedback → Planner
- [ ] Weekly tuning schedule - Cron job setup
- [ ] Performance tracking - Before/after metrics
- [ ] Rollback mechanism - Revert bad adjustments

### Definition of Done (DoD)

**Quality**:
- Feedback vectorization accuracy ≥90%
- Tenant context coverage: 100% (all events/logs/metrics)
- Zero cross-tenant leakage (proven via tests)

**Functionality**:
- Feedback patterns auto-detected (cluster analysis)
- SourceTrust auto-adjusts from feedback (weekly cycle)
- All logs/events include tenant/domain/usecase

**Documentation**:
- Feedback Intelligence Fabric architecture
- Tenant context propagation guide
- Feedback-driven tuning playbook

---

## Phase 2.0: Multi-Tenant Control Plane (3 weeks) - v2 Enhanced

### Goal
Support multiple clients/domains/projects with centralized governance + complete **Multi-Tenant Control Plane** architecture.

### Top-3 Priority (v2 Enhanced)

1. **Multi-Tenant Control Plane (Central Governance Hub)** (CRITICAL 🔴)
   - Tenant Registry + Feature Flag Service + Model Router + Cost/Quota Management
   - Observability Hub (per-tenant dashboards)
   - Policy Manager (GitOps + version control)
   - **Centralized control of all tenant configurations**

2. **Data Plane Isolation (Zero Leakage Guarantee)** (CRITICAL 🔴)
   - Tenant-scoped storage (buckets/namespaces)
   - Tenant-scoped queues (isolated work queues)
   - Tenant-scoped caches (Redis namespaces)
   - Retrieval Fabric tenant isolation
   - **Proven 0% data leakage via tests**

3. **Lineage Ledger V2 (Complete Audit Trail)** (HIGH 🔴)
   - retrieval_id, feedback_id, policy_id, model_version linkage
   - Cross-tenant drift map
   - Per-tenant audit reports (legally presentable)
   - **Regulation-ready compliance tracking**

### Full Implementation Checklist (v2 Enhanced)

#### Multi-Tenant Control Plane (🆕 v2 Central Hub)
- [ ] `src/core/control-plane/tenant-registry.ts` - Tenant CRUD + status management
- [ ] `src/core/control-plane/feature-flag-service.ts` - Per-tenant FF management
- [ ] `src/core/control-plane/model-router.ts` - LLM selection + cost balancing
- [ ] `src/core/control-plane/policy-manager.ts` - GitOps + version control
- [ ] `src/core/control-plane/observability-hub.ts` - Centralized monitoring
- [ ] `src/core/control-plane/quota-manager.ts` - Cost/request quotas per tenant
- [ ] Central dashboard - Multi-tenant overview (cost/quality/latency heatmap)
- [ ] CLI commands - `npm run control:sync --tenant <id>`

#### Policy & Configuration (GitOps)
- [ ] `tenants/<tenant>/policies/*.yaml` - GitOps policy structure
- [ ] `src/core/governance/namespaced-policy-dsl.ts` - Tenant-aware DSL
- [ ] `src/core/governance/policy-acl.ts` - Anti-corruption layer enhancement
- [ ] Policy signature validation - Per-tenant signing keys
- [ ] Policy version control - Git-based approval workflow

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

#### Lineage Ledger V2 (🆕 v2 Enhanced)
- [ ] Update `reports/lineage.jsonl` schema - Add tenant/retrieval_id/feedback_id/policy_id/model_version
- [ ] Cross-tenant drift map - `reports/tenant-drift-map.json`
- [ ] Per-tenant audit reports - `reports/tenants/<tenant>/audit.json` (legally presentable)
- [ ] Lineage trace depth ≥3 hops (source → retrieval → feedback → policy → output)
- [ ] OTel trace tags - Complete tenant/domain/usecase coverage
- [ ] Audit log enhancement - Tenant-scoped + regulation-compliant
- [ ] PDF report generator - Compliance audit trail (HIPAA/SOX/ISO27001)

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

## Future Roadmap (Phase 2.2+)

### ⭐ Phase 2.2-2.5: Adaptive Ecosystem Evolution 🆕 v3.1

**See detailed specifications**:
- Phase 2.2-2.4: `docs/RFC/2025-11-adaptive-ecosystem-development-plan.md`
- Phase 2.5 + HIL: `docs/RFC/2025-12-transparent-ecosystem-plan.md` 🆕 v3.1

**Strategic Evolution**:
- v3: "Living Organism → Self-Learning Ecosystem"
- v3.1: **"Self-Learning → Self-Explaining Ecosystem"** 🆕

**3 Evolution Axes (Phase 2.2-2.4)**:
1. **Meta-Governance Engine** (Phase 2.2) - Self-optimizing policies + **Human Override** 🆕
2. **Synthetic Ecosystem Simulator** (Phase 2.3) - Zero-risk expansion + **Convergence Detector** 🆕
3. **Cross-Tenant Intelligence Exchange** (Phase 2.4) - Collective learning + **Differential Privacy** 🆕

**NEW: Phase 2.5 - Transparency & Trust Layer** 🆕 v3.1:
- **Human-in-the-Loop (HIL) Governance Layer**
- **Transparent Logging + Explainability API**
- **Audit Interface + Compliance Reporter**
- **Philosophy**: "Intelligence after, Trust comes" (지능화 이후는 신뢰화)

**5 Self-* Capabilities**:
- **Self-Correcting**: Each layer diagnoses and repairs itself
- **Self-Learning**: Continuous improvement from feedback/logs
- **Self-Protecting**: Proactive security/compliance enforcement
- **Self-Adaptive**: Auto-adjust to load/domain/tenant changes
- **Self-Explaining** 🆕 v3.1: Natural language audit trail + human oversight

**Timeline**: 19-25 weeks total (Phase 2.2: 3w, Phase 2.3: 4w, Phase 2.4: 4-6w, Phase 2.5: 4-6w)

---

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

## Implementation Timeline (v2 Updated)

### Week 1-2 (Phase 1.6 Sprint 1) - Loop Completion
- Feedback Adapter + Source Trust Updater + **Convergence Detector** 🆕
- Test Chain Integration
- Gate P/I Enhancement + **Autonomous Gate Executor** 🆕

### Week 3-4 (Phase 1.6 Sprint 2) - Loop Verification
- Evidence Viewer (WebView SSR)
- Retrieval Metrics Reporting
- Phase 1.6 DoD verification

### Week 5-6 (Phase 1.7 Sprint 1) - Event Spine 🆕 v2
- Event Spine infrastructure (emitter, router, trace, replay)
- **Policy Trend Analyzer** 🆕 (drift early warning)
- Test Chain full automation

### Week 7 (Phase 1.7 Sprint 2) - Event Spine Verification 🆕 v2
- Event Spine integration testing
- Policy drift detection validation
- Phase 1.7 DoD verification

### Week 8-10 (Phase 1.8 Sprint 1) - Feedback Fabric 🆕 v2
- **Feedback Intelligence Fabric** (vectorizer, analyzer, scorer) 🆕
- **Tenant-aware Context Propagation** 🆕
- Feedback-Driven Loop (trust adjuster, planner tuner)

### Week 11 (Phase 1.8 Sprint 2) - Fabric Verification 🆕 v2
- Feedback fabric integration testing
- Tenant context coverage validation
- Phase 1.8 DoD verification

### Week 12-14 (Phase 2.0 Sprint 1) - Control Plane
- **Multi-Tenant Control Plane** (registry, FF service, model router, policy manager) 🆕
- GitOps policy structure
- Observability Hub

### Week 15-16 (Phase 2.0 Sprint 2) - Data Plane Isolation
- Tenant-scoped storage/queues/caches
- Retrieval Fabric tenant isolation
- **Lineage Ledger V2** 🆕

### Week 17 (Phase 2.0 Sprint 3) - Control Plane Verification
- Data leakage tests (target: 0%)
- Per-tenant dashboards
- Phase 2.0 DoD verification

### Week 18-23 (Phase 2.1) - Hybrid Intelligence
- VectorAdapter + HybridOrchestrator (weeks 18-19)
- RAGAS Bridge (weeks 20-21)
- Self-Tuning Planner (weeks 22-23)
- Compliance-Aware Evaluator (weeks 22-23)

---

## Success Metrics (v2 Updated)

### Phase 1.6
- Tests: ≥98% (770+/780+)
- Feedback → Trust update: ≤24h
- Gate P/I auto-update: 100%
- Evidence Viewer: accessible
- **🆕 v2: Convergence detection accuracy ≥95%**
- **🆕 v2: Gate auto-trigger coverage: 100%**

### Phase 1.7 🆕 v2
- **Event Spine event loss: 0%**
- **Policy drift prediction accuracy: ≥80%**
- **Policy drift early warning: 7+ days before conflict**
- **Regression test automation: 100% (no manual triggers)**

### Phase 1.8 🆕 v2
- **Feedback vectorization accuracy: ≥90%**
- **Tenant context coverage: 100% (all events/logs/metrics)**
- **Cross-tenant leakage: 0% (proven via tests)**
- **Feedback-driven trust adjustment: weekly cycle operational**

### Phase 2.0
- Data leakage: 0% (proven via tests)
- Tenant gate pass rate: ≥95%
- Lineage trace depth: ≥3 hops
- Policies in Git: 100%
- **🆕 v2: Control Plane uptime: ≥99.9%**
- **🆕 v2: Per-tenant dashboard latency: ≤500ms**

### Phase 2.1
- Groundedness: ≥85%
- Recall@10: +10~20%
- Drift detection: <6h
- Compliance coverage: ≥95%
- **🆕 v2: Self-tuning accuracy: ≥85%**

---

## Key Principles (v2 Enhanced)

1. **Evolutionary Expansion, NOT Rewrite**
   - Current structure is a "living organism with genetic structure"
   - Add layers, don't rebuild foundation
   - **🆕 v2: "Living DNA → Adaptive Ecosystem" transformation**

2. **Top-3 + Full Backlog**
   - Top-3 for immediate action
   - Full checklist for complete visibility
   - N-point design (not artificially limited)

3. **4 Critical Weaknesses → 3 Fundamental Structures** 🆕 v2
   - **Weaknesses**: Loop Closure, Tenant Separation, Policy Drift, Gate Automation
   - **Structures**: Event Spine, Feedback Fabric, Multi-Tenant Control Plane
   - **Result**: Single-loop → Multi-domain adaptive ecosystem

4. **Control Plane / Data Plane**
   - Separate governance from execution
   - Enable multi-tenant without complexity explosion
   - **🆕 v2: Centralized control + distributed execution**

5. **Governance First, Features Second**
   - Every feature must pass Gate checks
   - DNA Lock-In + Adaptive Mode maintained
   - Security/compliance non-negotiable

6. **Feedback-Driven Evolution** 🆕 v2 Enhanced
   - User feedback → Trust scores → Retrieval quality
   - **Feedback Intelligence Fabric**: Vectorization + Pattern Analysis + Auto-tuning
   - Self-tuning loops for continuous improvement
   - **Data becomes competitive moat (data asset transformation)**

7. **Event-Driven Architecture** 🆕 v2
   - All modules communicate via Event Spine
   - Event trace + replay for debugging
   - Tenant-aware routing for isolation

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

**Document Status**: Active roadmap for Phase 1.6 → 2.1 (v2 - Ecosystem Evolution)
**Version**: v2.0 (2025-10-08)
**Next Review**: After Phase 1.6 completion
**Owner**: System Architecture Team

---

## v2 Change Summary

**Key Additions**:
1. **4 Critical Weaknesses identified and solutions provided**
2. **Phase 1.7** (Event Spine + Policy Drift Warning) - NEW
3. **Phase 1.8** (Feedback Intelligence Fabric) - NEW
4. **3 Fundamental Structures**: Event Spine, Feedback Fabric, Multi-Tenant Control Plane
5. **Updated Timeline**: Week 1-23 (from Week 1-17)
6. **Enhanced DoD criteria** for all phases

**Strategic Shift**: Single-loop system → Multi-domain adaptive ecosystem

**Next Steps**: Begin Phase 1.6 implementation with v2 enhancements
