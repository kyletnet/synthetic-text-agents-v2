# Next Actions - v3.2 Execution Plan

**Last Updated**: 2025-10-09 00:30 KST
**Status**: Trust Infrastructure Transition (v3.2 Execution Mode)
**Strategic Shift**: "AI Technology Company" → "Trust Infrastructure Company"
**Approach**: Outcome-Driven Development (≥2 KPI improvement or auto-reject)

---

## 🎯 Strategic Context

**Current State**: v3.2 Equilibrium Evolution complete, technical apex achieved

**Critical Insight**: We are NOT in "feature completion stage" but in **"operational·trust·market structure transition"**

**Philosophy**: "Stop building features. Start systematizing growth through predictable, trust-driven outcomes."

**v3.2 Execution Plan**: Not about "building more" but "systematically scaling what we built"

---

## 🚨 Pre-Phase 2.6: Critical Foundation (MUST DO FIRST)

Before starting Phase 2.6 execution, we must address **4 system weaknesses** and establish **customer-facing trust infrastructure**.

### Priority 0: WebView Trust Console MVP (ETA: 3-4 days) 🔴

**Goal**: Demo-ready customer visualization for sales/investor demos.

**Strategic Rationale**: "Trust Infrastructure 상용화"의 첫 고객 접점. 영업·투자 대응의 핵심 자산.

**Priority**: CRITICAL (blocks go-to-market readiness)

**Files to Create**:
```
✅ web/components/TrustConsole.tsx - Main console dashboard
✅ web/components/TrustBadge.tsx - Real-time trust indicators
✅ web/components/EvidenceViewer.tsx - Evidence traceability
✅ web/components/ComplianceBadge.tsx - Compliance status
✅ web/components/ActionButtons.tsx - Approve/Rollback/Explain
✅ web/app/trust/page.tsx - Trust Console page
✅ web/api/trust/route.ts - Trust data API
```

**MVP Features**:
1. **Trust Badge Display**: Real-time Groundedness/Alignment/Faithfulness scores
2. **Evidence Viewer**: Click-to-trace evidence sources (with SourceTrust scores)
3. **Compliance Status**: GDPR/CCPA/HIPAA badges (color-coded: 🟢/🟡/🔴)
4. **Actionable Trust**: Approve/Rollback/Explain buttons (not just visualization)
5. **Audit Trail**: Policy change timeline with natural language explanations

**Success Criteria**:
- [ ] Trust Dashboard accessible at `/trust` (SSR <1s)
- [ ] Real-time trust scores displayed (WebSocket updates)
- [ ] Evidence traceability click-through works (source links)
- [ ] Compliance badges accurate (based on compliance engine)
- [ ] Action buttons functional (Approve → HIL queue, Explain → API)
- [ ] Demo-ready for customer presentations (polished UI)

**DoD**:
- [ ] API routes operational (5 endpoints)
- [ ] UI components functional (5 components)
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Lighthouse score ≥90
- [ ] SSR latency ≤3s

**구현 시작 명령어**:
```bash
# 1. 문서 읽기
cat docs/TRUST_CONSOLE_IMPLEMENTATION.md

# 2. API 구현
mkdir -p apps/fe-web/app/api/trust/{evidence,compliance,telemetry,snapshot}

# 3. 컴포넌트 구현
mkdir -p apps/fe-web/app/trust/components

# 4. 테스트
npm test -- trust-console
```

---

## 📚 Required Reading for Continuation

다음 작업을 시작하기 전 **반드시 읽어야 할 문서**:

1. **`docs/TRUST_INFRASTRUCTURE.md`** ⭐ **CRITICAL**
   - P0-P2-3 완전한 기술 문서
   - 구현된 모든 모듈의 API, 사용법, 예제
   - 74개 테스트 결과 및 커버리지

2. **`docs/TRUST_CONSOLE_IMPLEMENTATION.md`** (P3 구현 시)
   - Trust Console 완전한 구현 가이드
   - API + UI 코드 예제 (복사-붙여넣기 가능)
   - 단계별 체크리스트

3. **`CLAUDE.md`** (항상)
   - 시스템 철학 및 개발 원칙
   - Development Safety Rules
   - Quality Gates

---

## 🎯 Phase 2.6 Ready (권장 다음 단계)

### Phase 2.6: Reflective Governance (11-13주)

**Goal**: Human-in-the-Loop (HIL) + Explainability Layer

**Components**:

**Goal**: Address operational efficiency and control weaknesses before multi-tenant scale.

**Strategic Rationale**: Current weaknesses are NOT about "accuracy" but "operational efficiency and control". These MUST be fixed before Phase 2.6.

**Priority**: CRITICAL (blocks production-scale operations)

#### A. Observability Overhead Mitigation

**Problem**: Automated logging/metrics/events may cause overload in real operations.

**Solution**: Event Spine QoS Controller enhancement

**Files**:
```
✅ src/core/event-spine/rate-limiter.ts - Unnecessary event rate limiting
✅ src/core/event-spine/cold-storage-policy.ts - Archive old events
✅ config/event-spine/qos-rules.json - Rate limit configuration
```

**Implementation**:
- Event rate limiting (max 1000 events/sec per module)
- Cold storage policy (archive events >7 days old)
- Event priority queue (critical events bypass rate limit)

**DoD**: Event Spine CPU usage <10%, event backlog = 0

---

#### B. Policy Explosion Prevention

**Problem**: Multi-tenant + Meta-Governance may create thousands of policies → management chaos.

**Solution**: Policy Hierarchy + Tag-based Inheritance

**Files**:
```
✅ src/core/governance/policy-hierarchy.ts - Hierarchical policy structure
✅ src/core/governance/policy-inheritance.ts - Tag-based inheritance
✅ config/policy-templates/ - Reusable policy templates
```

**Implementation**:
- Policy hierarchy (base → tenant → project → feature)
- Tag-based inheritance (inherit from templates)
- Policy deduplication (merge identical rules)

**DoD**: Policy count <100 (from potential thousands), policy resolution time <50ms

---

#### C. Feedback Data Quality Drift Prevention

**Problem**: User feedback log noise increases over time (duplicates, unclear feedback).

**Solution**: Feedback Quality Scorer + Weighted Labeler

**Files**:
```
✅ src/application/feedback-intelligence/quality-scorer.ts - Feedback quality assessment
✅ src/application/feedback-intelligence/weighted-labeler.ts - Trust-based weighting
✅ src/application/feedback-intelligence/deduplication.ts - Duplicate detection
```

**Implementation**:
- Feedback quality scoring (1-5 scale: clarity, specificity, actionability)
- Weighted labeler (high-trust users' feedback weighted higher)
- Deduplication (semantic similarity detection)

**DoD**: Feedback Utilization ≥70%, noise ratio <20%

---

#### D. Real-time Governance Latency Optimization

**Problem**: Explainability API + Audit Interface traffic surge may exceed SLA.

**Solution**: Lazy Audit Rendering + Incremental Explain Cache

**Files**:
```
✅ src/core/transparency/lazy-audit-renderer.ts - On-demand audit rendering
✅ src/core/transparency/explain-cache.ts - Incremental explanation cache
✅ src/core/transparency/cache-warming.ts - Predictive cache warming
```

**Implementation**:
- Lazy rendering (generate audit reports on-demand, not upfront)
- Incremental explain cache (cache explanation fragments)
- Cache warming (pre-generate for high-traffic queries)

**DoD**: Explainability API p95 <500ms, Audit Interface load time <2s

---

### Priority 1.5: Gate E - Explanation Stability (ETA: 1-2 days) 🔴

**Goal**: Prevent "Explainability Drift" - ensure consistent explanations for identical decisions.

**Strategic Rationale**: **Critical Risk** - LLM-based explanations may vary per request, breaking audit reproducibility and trust.

**Priority**: CRITICAL (blocks regulatory compliance)

**Problem**:
- Same policy decision may generate different explanations on retry
- Audit logs become unreproducible → regulatory risk
- Customer trust degrades if "Explain" button shows different results

**Solution**: Explanation Consistency Cache + Validation Gate

**Files to Create**:
```
✅ src/domain/preflight/gate-e-explanation-stability.ts - Gate E implementation
✅ src/core/transparency/explanation-cache.ts - Deterministic explanation storage
✅ src/core/transparency/explanation-validator.ts - Consistency scoring
✅ tests/domain/preflight/gate-e.test.ts - Gate E validation tests
```

**Gate E Logic**:
```typescript
interface GateE {
  id: "gate-e-explanation-stability";
  check: (context) => {
    // For identical decision contexts, explanations must be >95% semantically similar
    const cached = getExplanationCache(context.decisionId);
    if (cached) {
      const similarity = semanticSimilarity(cached, context.newExplanation);
      return similarity >= 0.95;
    }
    return true; // First explanation always passes
  };
  severity: "P0";
  action: "block_deployment"; // Inconsistent explanations = trust breach
}
```

**Implementation**:
1. **Explanation Cache**: Store first explanation per decision context (hash-based key)
2. **Consistency Validator**: Compare new explanations to cached baseline (cosine similarity)
3. **Cache Warming**: Pre-generate explanations for common policy patterns
4. **Fallback**: If similarity <95%, use cached explanation (deterministic mode)

**DoD**:
- Gate E operational in gating pipeline
- Explanation cache hit rate >80%
- Semantic similarity threshold validated (>95% for P0)
- Audit Interface uses cached explanations for reproducibility
- Test coverage: explanation drift detection scenarios

---

### Priority 2: Trust Token Economy Foundation (ETA: 2-3 days) 🟠

**Goal**: Design "Trust as Tradeable Unit" - signature-based trust tokens for each output.

**Strategic Rationale**: **Genius Insight** - Trust Token Economy transforms trust from abstract concept to tradeable asset. Customers can transfer trust to partners/auditors/regulators.

**Priority**: HIGH (strategic differentiation, not operational blocker)

**Files to Create**:
```
✅ docs/RFC/2025-16-trust-token-economy.md - Trust Token design spec
✅ src/core/trust/trust-token-generator.ts - Token generation
✅ src/core/trust/token-signature.ts - C2PA + hash signature
✅ src/core/trust/token-verifier.ts - Token verification API
```

**🧠 Genius Enhancement - Mutual Verification Token (Proof of Trust)**:

**Trust Token Structure** (JWT + C2PA Signature):
```typescript
interface TrustToken {
  // JWT Header
  header: {
    alg: "RS256"; // RSA signature algorithm
    typ: "JWT";
    kid: string; // Key ID for rotation
  };

  // JWT Payload
  payload: {
    id: string; // UUID v7
    timestamp: Date; // ISO 8601
    contentHash: string; // SHA-256 hash of output

    // Trust Metrics
    trustScore: {
      groundedness: number; // 0-1 scale
      alignment: number;
      faithfulness: number;
    };

    // Evidence Traceability
    evidence: {
      sourceIds: string[]; // Chunk IDs
      trustScores: number[]; // Per-source trust
      retrievalStrategy: "bm25" | "vector" | "hybrid";
    };

    // Compliance Context
    compliance: {
      gdpr: boolean;
      ccpa: boolean;
      hipaa: boolean;
    };

    // Issuer Identity
    iss: string; // "synthetic-agents.ai"
    sub: string; // Customer tenant ID
    aud: string; // Intended verifier (customer/auditor/regulator)

    // Validity
    iat: number; // Issued at (Unix timestamp)
    exp: number; // Expires at (7 days default)
    nbf: number; // Not before
  };

  // C2PA Signature (Content Provenance)
  c2pa: {
    manifest: string; // C2PA manifest URL
    signature: string; // Digital signature
    certificate: string; // X.509 certificate chain
  };
}
```

**Key Enhancement**: Customer can **export and verify** trust tokens independently:
- Auditors verify signature without our API
- Regulators validate compliance claims cryptographically
- Partners integrate trust into downstream workflows

**Use Cases**:
1. **External Audit**: Customer exports trust tokens to auditors (verifiable proof)
2. **Partner Integration**: Trust tokens transferred to downstream systems
3. **Regulatory Compliance**: Auditors verify token authenticity independently

**DoD**:
- Trust Token RFC documented
- Token generation + signature working
- Verification API operational
- Demo: Generate token → Export → Verify externally

---

### Priority 3: Customer Demo Policy Packs (ETA: 1-2 days) 🟡

**Goal**: Industry-specific policy templates (Healthcare/Finance) for immediate PoC deployment.

**Strategic Rationale**: Regulated industry PoC requires ready-to-use compliance templates. This accelerates sales cycle.

**Priority**: MEDIUM (GTM enabler, not technical blocker)

**Files to Create**:
```
✅ config/industry-packs/healthcare/hipaa-policy.json - HIPAA compliance template
✅ config/industry-packs/finance/sox-policy.json - SOX compliance template
✅ config/industry-packs/healthcare/hipaa-audit-template.md - HIPAA audit report
✅ config/industry-packs/finance/sox-audit-template.md - SOX audit report
```

**Healthcare Policy Pack (HIPAA)**:
- PII detection + masking rules
- Data retention policies (7-year minimum)
- Access control requirements (role-based)
- Audit trail requirements (immutable logs)

**Finance Policy Pack (SOX)**:
- Financial data accuracy requirements
- Change control policies (approval workflow)
- Audit trail requirements (transaction logging)
- Separation of duties enforcement

**DoD**:
- 2 industry packs operational (Healthcare, Finance)
- Policy templates validated against regulations
- Audit report templates customer-ready
- Demo script prepared (PoC walkthrough)

---

## 🔒 Critical Risk Mitigation (Pre-Phase 2.6 Hardening)

Before Phase 2.6 execution, we MUST address **3 systemic risks** that could break trust infrastructure at scale.

### Risk 1: Explainability Drift 🚨

**Problem**: LLM-based explanations vary per request → audit reproducibility breaks.

**Example**:
- Request 1: "Policy rejected due to low trust score (0.45 < 0.6 threshold)"
- Request 2: "Insufficient evidence quality detected, blocking deployment"
- → Same decision, different explanations → regulatory audit FAIL

**Solution**: Explanation Cache + Gate E (Priority 1.5)
- Cache first explanation per decision context (hash-based)
- Gate E validates consistency (>95% semantic similarity)
- Fallback to cached explanation if drift detected

**DoD**: Gate E operational, cache hit rate >80%

---

### Risk 2: Human Oversight Latency 🚨

**Problem**: Human Digest generation lag → Feedback Fabric response bottleneck.

**Example**:
- Feedback event at 09:00 → Digest generated at 15:00 (6h lag)
- Policy update delayed → user sees outdated behavior
- → Trust degradation ("system ignores my feedback")

**Solution**: Asynchronous Digest Generation + Background Queue
```typescript
// Digest generation runs in background
const digestQueue = new AsyncQueue({
  concurrency: 3,
  priority: "high",
  timeout: 300000, // 5 minutes
});

// User feedback triggers immediate response + queued digest
await emitFeedbackEvent(feedback); // Immediate
digestQueue.push(() => generateDigest(feedback)); // Async
```

**Files**:
```
✅ src/core/event-spine/async-queue.ts - Background job queue
✅ src/application/human-digest/digest-scheduler.ts - Scheduled digest generation
```

**DoD**: Digest latency <6h, feedback response <1s

---

### Risk 3: Compliance Overload 🚨

**Problem**: Per-tenant GDPR/CCPA/HIPAA checks consume excessive resources.

**Example**:
- 100 tenants × 3 compliance checks × 1000 requests/day = 300k compliance evaluations
- Each check: 50ms → 15,000 seconds/day (4.2 hours CPU time)
- → Resource exhaustion at scale

**Solution**: Compliance Template Engine + Static Report Caching
```typescript
// Cache compliance reports (refresh weekly)
const complianceCache = new Map<string, ComplianceReport>();

async function getComplianceStatus(tenantId: string): Promise<ComplianceReport> {
  const cached = complianceCache.get(tenantId);
  if (cached && cached.age < 7 * 24 * 60 * 60 * 1000) {
    return cached; // Return cached report
  }

  // Generate new report (async, background)
  const report = await generateComplianceReport(tenantId);
  complianceCache.set(tenantId, report);
  return report;
}
```

**Files**:
```
✅ src/application/compliance/template-engine.ts - Industry templates (HIPAA/SOX/GDPR)
✅ src/application/compliance/report-cache.ts - Static report caching
✅ config/compliance-templates/ - Pre-built compliance rulesets
```

**DoD**: Compliance check latency <10ms (cached), CPU usage <5%

---

## 📅 Phase 1.6-1.7: Organic Loop Completion (After Pre-Work)

### Week 1-2: Feedback Intelligence Foundation

#### 1. Feedback Adapter + Source Trust Updater (ETA: 2-3 hours) 🔴

**Goal**: User feedback ("incorrect evidence") updates SourceTrust scores dynamically.

**Priority**: CRITICAL (blocks feedback loop = moat value)

**Files to Create**:
```
✅ src/application/feedback-adapter.ts
✅ src/application/feedback-labeler.ts
✅ src/infrastructure/retrieval/source-trust-updater.ts
✅ src/infrastructure/retrieval/source-trust-persistence.ts
```

**Implementation** (from original Phase 1.6 plan):
- Intent classification (6 types)
- Confidence scoring (1-5)
- SourceTrust delta update (±0.1)
- Persistence to disk

**DoD**:
- Feedback → Trust update <24h
- SourceTrust scores persist
- Next retrieval uses updated scores

---

#### 2. Event Spine Infrastructure (ETA: 2 days) 🔴

**Goal**: Central event backbone with QoS control (from v3.2 execution plan).

**Priority**: CRITICAL (foundation for all modules)

**Files to Create**:
```
✅ src/core/event-spine/event-bus.ts - Central event bus
✅ src/core/event-spine/qos-controller.ts - QoS controller (from hardening work)
✅ src/core/event-spine/loop-scheduler.ts - Loop scheduling
✅ src/core/event-spine/resource-monitor.ts - CPU/memory monitoring
```

**DoD**:
- Event Spine operational (backlog = 0)
- QoS Controller prevents resource overload
- All modules communicate via Event Spine only

---

#### 3. Gate P/I Enhancement (ETA: 2 hours) 🟠

**Goal**: Retrieval poisoning/trust events trigger Gate P/I auto-update.

**Priority**: HIGH (governance integration)

**Files to Modify**:
```
✅ src/domain/preflight/gating-rules.ts - Add Gate P/I rules
✅ tests/domain/preflight/gates.test.ts - Gate P/I tests
```

**DoD**:
- Gate P = Retrieval Poisoning FAIL blocks deployment
- Gate I = Trust floor <0.4 warning

---

### Week 3-4: Trust Platform MVP Launch

#### 4. Trust Dashboard Production Release (ETA: 2 days) 🔴

**Goal**: Production-ready Trust Console with live data integration.

**Priority**: CRITICAL (customer-facing trust interface)

**Enhancement from MVP**:
- WebSocket real-time updates
- Multi-tenant support (tenant filtering)
- Export functionality (PDF reports, Trust Tokens)

**DoD**:
- Trust Dashboard production-ready
- Multi-tenant data isolation
- Export functionality operational

---

#### 5. Federated ROI Analytics Design (ETA: 3 days) 🟠

**Goal**: Design cross-tenant learning revenue model (from genius insight).

**Strategic Rationale**: **Genius Insight #2** - Federated ROI Analytics creates industry benchmark datasets → thought leadership + revenue stream.

**Files to Create**:
```
✅ docs/RFC/2025-17-federated-roi-analytics.md - FedROI design spec
✅ src/core/federated/roi-aggregator.ts - Cross-tenant ROI aggregation
✅ src/core/federated/differential-privacy-engine.ts - ε-DP implementation
```

**DoD**:
- FedROI RFC documented
- ε-DP pipeline designed (ε <1.0)
- ROI aggregation algorithm specified

---

## 🎯 Success Criteria (Pre-Phase 2.6 Completion)

### System Hardening
- [ ] Observability overhead mitigated (Event Spine CPU <10%)
- [ ] Policy explosion prevented (policy count <100)
- [ ] Feedback quality maintained (utilization ≥70%, noise <20%)
- [ ] Governance latency optimized (Explain API p95 <500ms)

### Trust Platform Foundation
- [ ] WebView Trust Console MVP operational (demo-ready)
- [ ] **Trust Console Telemetry** capturing user behavior (heatmaps, engagement)
- [ ] **Gate E - Explanation Stability** operational (cache hit >80%, consistency >95%)
- [ ] **TrustToken Generator** producing JWT + C2PA signed tokens
- [ ] Trust Token Economy designed (RFC + prototype)
- [ ] Customer demo policy packs ready (Healthcare, Finance)

### Technical Excellence
- [ ] Tests ≥98% (770+/780+) ✅ **ACHIEVED** (768/768 = 100%)
- [ ] p95 latency ≤3.1s (maintained)
- [ ] Zero new ESLint errors

### Go-to-Market Readiness
- [ ] Customer demo prepared (5-minute Trust Console walkthrough)
- [ ] Industry policy packs validated (HIPAA, SOX)
- [ ] Trust Token export demo working (auditor can verify independently)
- [ ] Telemetry dashboard showing user trust patterns

### Critical Risk Mitigation ✨ **NEW**
- [ ] **Explainability Drift** prevented (Gate E + cache operational)
- [ ] **Human Oversight Latency** <6h (async digest + background queue)
- [ ] **Compliance Overload** mitigated (template engine + static cache, <10ms)

---

## 🛑 Stop · Start · Continue (v3.2 Enforcement)

### 🛑 STOP (Immediate)
- ❌ New model/agent development (core algorithms sufficient)
- ❌ Duplicate KPI dashboards (keep only ROI + Trust)
- ❌ Feature PRs without ≥2 KPI improvement targets
- ❌ Experimental features with permanent ON state

### ✅ START (Now)
- ✅ Trust Token generation for all outputs
- ✅ Event Spine registration for all new modules
- ✅ KPI improvement targets for every feature
- ✅ WebView Trust Console as primary customer interface

### 🔄 CONTINUE (Reinforce)
- ✅ Event Spine-only communication
- ✅ Gate automation (A-O gates)
- ✅ KPI-driven development
- ✅ DoD enforcement for all initiatives

---

## 📊 KPI Targets (Pre-Phase 2.6)

| Category | KPI | Current | Target | Alert Threshold |
|----------|-----|---------|--------|----------------|
| **Quality** | Groundedness | N/A | ≥85% | <80% for 24h |
| **Quality** | Alignment | N/A | ≥85% | <80% for 24h |
| **Performance** | p95 Latency | ~2.8s | ≤3.1s | >3.3s (2x) |
| **Performance** | Error Rate | <1% | <1% | >2% |
| **Cost** | Cost/1kQA | N/A | ≤$X | 90% budget |
| **Learning** | Feedback Utilization | 0% | ≥70% | <50% |
| **Trust** | Evidence Traceability | 0% | 100% | <100% |
| **Trust** | Compliance Score | N/A | ≥95% | <90% |

---

## 🔮 Strategic Vision (v3.2 → v3.3)

**From**: "AI Technology Company" (feature-driven)
**To**: "Trust Infrastructure Company" (outcome-driven)

**Market Position**: "The only AI platform that humans trust to run autonomously"

**Success Criteria**: When customers say **"I trust this system to make decisions I can defend to regulators"**

**Competitive Moat**:
- **BigTech**: Powerful models → **We offer**: Governance Nervous System
- **Enterprise AI**: Compliance focus → **We offer**: 3C System (Cognition + Coordination + Context)
- **AI Platforms**: Feature breadth → **We offer**: Trust Infrastructure (verifiable, tradeable trust)

---

## 📚 References

- **v3.2 Execution Plan**: `docs/RFC/2025-15-equilibrium-execution-plan.md`
- **Governance Nervous System**: `docs/RFC/2025-13-governance-nervous-system-plan.md`
- **Transparent Ecosystem Plan**: `docs/RFC/2025-12-transparent-ecosystem-plan.md`
- **Session State**: `docs/SESSION_STATE.md`

---

## 💡 One-Line Philosophy

**"Stop building features. Start earning trust through predictable, verifiable, tradeable outcomes."**

If we layer trust (Event Spine · Trust Tokens · FedROI) and evolve by KPIs alone,
we achieve rapid growth across Technology, Operations, Compliance, and Market. 🚀

---

**Next Immediate Action**: Start **Priority 0: WebView Trust Console MVP** (demo-ready in 3-4 days)
