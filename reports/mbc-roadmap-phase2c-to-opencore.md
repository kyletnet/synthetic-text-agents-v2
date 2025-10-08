# MBC Roadmap: Phase 2C → Open-Core Launch

**전략**: Option A-Prime (Minimum-Believable Core)
**기간**: 10-14일 (D+0 ~ D+14)
**목표**: 핵심 3-Agent + NL Feedback 완성 → Go/No-Go 검증 → Open-Core 공개

**작성일**: 2025-10-08
**현재 브랜치**: phase2c-launch
**목표 브랜치**: mbc-launch → opencore-release

---

## 🎯 MBC (Minimum-Believable Core) 정의

**핵심 가치 전달에 필요한 최소 완성 기준**

### 1. 3-Agent Council (멀티에이전트 핵심)

```
┌─────────────────────────────────────────┐
│         3-Agent Council                 │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │Retriever │→ │Evaluator │→ │Planner│ │
│  └──────────┘  └──────────┘  └───────┘ │
│       ↓             ↓            ↓      │
│   Evidence      Quality      Diversity  │
│   Collection    Assessment   Planning   │
└─────────────────────────────────────────┘
```

| Agent | 역할 | 현재 상태 | 필요 작업 |
|-------|------|-----------|----------|
| **Retriever** | Hybrid(BM25+Vector) 근거 수집 | ⚠️ RAG 인프라 있음 | Agent 래핑 필요 |
| **Evaluator** | Ragas/Alignment 품질 평가 | ⚠️ 기본 구현만 | Ragas 통합 필요 |
| **Planner** | Diversity + MetricsPort 연계 | ✅ 완전 구현 | 통합 테스트만 |

**목표**: 8-Agent 생태계의 "증거·품질·계획" 축만 먼저 구현해도 멀티에이전트 본질 전달 가능

---

### 2. NL Feedback Adapter (사람 → 정책 브리지)

**Intent 6종 정의**:

| Intent | 우선순위 | Cooldown | 예시 |
|--------|---------|----------|------|
| **improvement_request** | P2 | 60s | "답변 품질을 더 높여주세요" |
| **error_report** | P1 | 30s | "이 답변에 오류가 있습니다" |
| **policy_modification** | P1 | 120s | "정책을 수정해주세요" |
| **evidence_addition** | P2 | 60s | "이 문서를 추가해주세요" |
| **performance_degradation** | P0 | 0s | "시스템이 느려졌습니다" |
| **cost_warning** | P1 | 300s | "비용이 너무 높습니다" |

**Pipeline**:
```
User NL Input
    ↓ Intent Classification (GPT-4o-mini, <$0.001)
Intent 6-type
    ↓ Cooldown Check (60s default)
Event Creation
    ↓ parseOnly → validate → sandbox
Policy Interpreter
    ↓ Approval Required
Governance Kernel Commit
    ↓
System Adaptation (logged)
```

**현재 상태**: Feedback Adapter 기본 구조 있음, Intent 분류 및 파이프라인 연결 필요

---

### 3. 거버넌스 게이트 & 안전망

**이미 준비된 안전 장치**:

| 컴포넌트 | 상태 | 설명 |
|---------|------|------|
| Gate A-D | ✅ | TypeScript, Lint, Sanity, Smoke |
| Feature Matrix | ✅ | 기능별 활성화 제어 |
| Parser Trust Boundary | ✅ | parseOnly → validate → sandbox |
| Loop Scheduler | ✅ | 2-10s adaptive, queue limit 20 |
| Sandbox Runner | ✅ | VM isolation, 1s timeout, 50MB limit |
| Self-Tuning Agent | ✅ | Advisor mode, no auto-apply |

**추가 필요**:
- [ ] Canary 배포 설정 (10% → 50% → 100%)
- [ ] Go/No-Go 자동 검증 스크립트

---

## 📊 현재 에이전트 구현 상태 분석

### 기존 8-Agent 상태

| Agent | 파일 | 구현도 | MBC 포함 여부 |
|-------|------|--------|-------------|
| Quality Auditor | `src/agents/qualityAuditor.ts` | 20% | ✅ (확장 필요) |
| Prompt Architect | `src/agents/promptArchitect.ts` | 100% | ❌ (Phase 2D) |
| QA Generator | `src/agents/qaGenerator.ts` | 100% | ❌ (Phase 2D) |
| Psychology Specialist | `src/agents/psychologySpecialist.ts` | 100% | ❌ (Phase 2D) |
| Linguistics Engineer | `src/agents/linguisticsEngineer.ts` | 100% | ❌ (Phase 2D) |
| Domain Consultant | `src/agents/domainConsultant.ts` | 100% | ❌ (Phase 2D) |
| Cognitive Scientist | `src/agents/cognitiveScientist.ts` | 100% | ❌ (Phase 2D) |
| Diversity Planner | `src/application/agents/diversity-planner-service.ts` | 100% | ✅ (완성) |

### RAG/Retrieval 인프라

| 컴포넌트 | 파일 | 구현도 | 용도 |
|---------|------|--------|------|
| Retrieval | `src/rag/retrieve.ts` | 90% | BM25+Vector 하이브리드 |
| Chunking | `src/rag/chunk.ts` | 100% | 문서 분할 |
| Embeddings | `src/rag/embeddings.ts` | 100% | Vector 생성 |
| RAG Service | `src/rag/service.ts` | 100% | 통합 서비스 |

**결론**: Retriever Agent는 RAG 인프라를 Agent 인터페이스로 래핑하기만 하면 됨 (1-2일)

---

## 🗓️ 10-14일 일정 (세부 작업)

### **Phase 1: D+0 ~ D+2 (3-Agent Council 완성)**

#### Day 0 (오늘)
- [x] 전략 방향 확정 (Option A-Prime)
- [x] MBC 로드맵 문서 작성
- [x] 현재 에이전트 상태 분석 완료
- [ ] 3-Agent Council 아키텍처 설계 문서

**목표**: 설계 완료 및 작업 착수

---

#### Day 1-2
**Retriever Agent 구현** (우선순위: P1)

```typescript
// src/application/agents/retriever-agent-service.ts

/**
 * Retriever Agent - Evidence Collection
 *
 * Hybrid Retrieval Strategy:
 * - BM25 (keyword-based)
 * - Dense Vector (semantic)
 * - Reranking (cross-encoder)
 */
export class RetrieverAgentService {
  constructor(
    private readonly ragService: RAGService,
    private readonly logger: Logger
  ) {}

  async retrieveEvidence(
    query: string,
    options: {
      topK?: number;        // Default: 5
      hybridAlpha?: number; // BM25 vs Vector weight, default: 0.5
      rerank?: boolean;     // Default: true
    }
  ): Promise<EvidenceResult> {
    // 1. Hybrid retrieval (BM25 + Vector)
    // 2. Reranking (cross-encoder)
    // 3. Evidence quality scoring
    // 4. Return top-K with confidence scores
  }
}
```

**작업 항목**:
- [ ] RetrieverAgentService 클래스 생성
- [ ] RAGService 통합 (이미 구현됨)
- [ ] Evidence quality scoring 로직
- [ ] 통합 테스트 (5개 쿼리, 정확도 >80%)

**예상 소요**: 1-2일
**완료 기준**: 테스트 통과, latency <500ms, precision >80%

---

**Evaluator Agent 확장** (우선순위: P1)

```typescript
// src/application/agents/evaluator-agent-service.ts

/**
 * Evaluator Agent - Quality Assessment
 *
 * Multi-dimensional Quality Evaluation:
 * - Alignment Score (Answer ↔ Evidence)
 * - Completeness Score (Coverage)
 * - Accuracy Score (Factual correctness)
 * - Clarity Score (Readability)
 *
 * Based on: Ragas framework + Custom rubric
 */
export class EvaluatorAgentService {
  async evaluateQuality(
    question: string,
    answer: string,
    evidence: Evidence[],
    rubric: QualityRubric
  ): Promise<QualityScore> {
    // 1. Alignment score (Ragas-inspired)
    // 2. Completeness check
    // 3. Accuracy verification
    // 4. Clarity assessment
    // 5. Aggregate score (weighted average)
  }
}
```

**작업 항목**:
- [ ] EvaluatorAgentService 클래스 생성
- [ ] Alignment score 구현 (Ragas-inspired)
- [ ] Multi-dimensional scoring (4 dimensions)
- [ ] QualityRubric 스키마 정의
- [ ] 통합 테스트 (10개 QA pair, correlation >0.7)

**예상 소요**: 2일
**완료 기준**: Human correlation >0.7, latency <1s

---

**3-Agent Council 통합** (우선순위: P0)

```typescript
// src/application/agents/agent-council.ts

/**
 * 3-Agent Council Orchestrator
 *
 * Workflow:
 * 1. Retriever: Collect evidence
 * 2. Evaluator: Assess quality
 * 3. Planner: Create diversity plan
 */
export class AgentCouncil {
  constructor(
    private readonly retriever: RetrieverAgentService,
    private readonly evaluator: EvaluatorAgentService,
    private readonly planner: DiversityPlannerService,
    private readonly logger: Logger
  ) {}

  async deliberate(
    input: CouncilInput
  ): Promise<CouncilDecision> {
    // 1. Parallel: Retriever + current metrics
    // 2. Evaluator: Quality assessment
    // 3. Planner: Diversity plan (if needed)
    // 4. Aggregate decision
  }
}
```

**작업 항목**:
- [ ] AgentCouncil 클래스 생성
- [ ] 3-Agent 통합 로직
- [ ] Parallel execution 최적화 (p-limit)
- [ ] Decision aggregation 로직
- [ ] 통합 테스트 (E2E workflow)

**예상 소요**: 1일
**완료 기준**: E2E 테스트 통과, latency <3s

---

### **Phase 2: D+3 ~ D+6 (NL Feedback Adapter)**

#### Day 3-4
**Intent Classification 구현**

```typescript
// src/application/feedback/intent-classifier.ts

/**
 * NL Feedback Intent Classifier
 *
 * Uses: GPT-4o-mini (fast, cheap)
 * Cost: <$0.001 per classification
 */
export class IntentClassifier {
  private readonly intentSchema = {
    improvement_request: { priority: 2, cooldown: 60000 },
    error_report: { priority: 1, cooldown: 30000 },
    policy_modification: { priority: 1, cooldown: 120000 },
    evidence_addition: { priority: 2, cooldown: 60000 },
    performance_degradation: { priority: 0, cooldown: 0 },
    cost_warning: { priority: 1, cooldown: 300000 }
  };

  async classify(
    userInput: string
  ): Promise<{
    intent: keyof typeof this.intentSchema;
    confidence: number;
    extractedData: Record<string, unknown>;
  }> {
    // 1. GPT-4o-mini classification
    // 2. Confidence scoring
    // 3. Data extraction (entities, metrics, etc.)
  }
}
```

**작업 항목**:
- [ ] IntentClassifier 클래스 생성
- [ ] Intent 6종 스키마 정의
- [ ] GPT-4o-mini 프롬프트 작성
- [ ] Confidence threshold (>0.7)
- [ ] 테스트 (20개 샘플, accuracy >90%)

**예상 소요**: 1-2일
**완료 기준**: Accuracy >90%, latency <500ms, cost <$0.001

---

#### Day 5-6
**Feedback → Policy Bridge 구현**

```typescript
// src/application/feedback/feedback-policy-bridge.ts

/**
 * Feedback → Policy Event Bridge
 *
 * Converts NL feedback intent to governance policy events
 * with approval-required workflow
 */
export class FeedbackPolicyBridge {
  constructor(
    private readonly classifier: IntentClassifier,
    private readonly policyInterpreter: PolicyInterpreter,
    private readonly sandbox: SandboxRunner,
    private readonly logger: Logger
  ) {}

  async processFeedback(
    feedback: UserFeedback
  ): Promise<PolicyEventResult> {
    // 1. Intent classification
    // 2. Cooldown check (per intent type)
    // 3. Create policy event
    // 4. parseOnly → validate → sandbox
    // 5. Await human approval
    // 6. Commit to governance kernel
    // 7. Log decision
  }
}
```

**작업 항목**:
- [ ] FeedbackPolicyBridge 클래스 생성
- [ ] Cooldown 관리 (Intent별 차등)
- [ ] parseOnly → validate → sandbox 파이프라인
- [ ] Approval workflow (manual gate)
- [ ] Decision logging
- [ ] 통합 테스트 (E2E feedback → policy)

**예상 소요**: 2일
**완료 기준**: E2E 테스트 통과, no sandbox bypass, approval required

---

### **Phase 3: D+7 ~ D+10 (WebView + Go/No-Go)**

#### Day 7-8
**WebView v1 (SSR Feedback Console)**

```typescript
// demo-ui/pages/feedback-console.tsx

/**
 * Feedback Console (SSR only)
 *
 * Features:
 * - Intent submission form
 * - Real-time status (pending/approved/rejected)
 * - Historical feedback log (static mock data)
 * - NO internal API exposure
 */
```

**작업 항목**:
- [ ] Next.js 프로젝트 초기화 (demo-ui/)
- [ ] Feedback submission form
- [ ] Status dashboard (SSR, static data)
- [ ] Mock results generation (10개 샘플)
- [ ] Vercel 배포 설정
- [ ] Secret lint (no API keys exposed)

**예상 소요**: 2일
**완료 기준**: SSR 동작, no secrets, Vercel deployed

---

#### Day 9-10
**Go/No-Go 검증**

```bash
# scripts/mbc-gonogo-check.ts

/**
 * MBC Go/No-Go Validation
 *
 * Checks:
 * 1. 3-Agent Council integration test ≥90% pass
 * 2. NL Feedback pipeline E2E test pass
 * 3. /guard --strict PASS
 * 4. Latency p95 ≤ 3.1s
 * 5. Error rate < 1%
 * 6. WebView secret lint PASS
 * 7. Baseline generation success
 */
```

**작업 항목**:
- [ ] Go/No-Go 체크리스트 스크립트 작성
- [ ] 3-Agent Council 통합 테스트 실행
- [ ] NL Feedback E2E 테스트 실행
- [ ] /guard --strict 검증
- [ ] Performance 측정 (latency, error rate)
- [ ] WebView secret lint
- [ ] baseline:generate --tag "mbc-prelaunch"

**예상 소요**: 2일
**완료 기준**: 모든 체크리스트 PASS

---

### **Phase 4: D+11 ~ D+14 (Canary + Soft Launch)**

#### Day 11-12
**Canary 배포 (10% 트래픽)**

```typescript
// src/infrastructure/canary/canary-controller.ts

/**
 * Canary Deployment Controller
 *
 * Traffic split:
 * - 10% → MBC version (new)
 * - 90% → Phase 2C baseline (stable)
 *
 * Monitoring:
 * - Error rate diff < 0.5%
 * - Latency diff < 200ms
 * - Quality score diff < 2%
 */
```

**작업 항목**:
- [ ] Canary controller 구현
- [ ] Traffic split 설정 (10%)
- [ ] Monitoring dashboard (Grafana/Datadog)
- [ ] Error/latency/quality 비교
- [ ] Rollback trigger 정의

**예상 소요**: 2일
**완료 기준**: Canary 10% stable, no regressions

---

#### Day 13-14
**Open-Core 준비 + Soft Launch**

```bash
# Final preparation

1. baseline:generate --tag "mbc-launch"
2. Create opencore-release branch
3. Prepare GitHub repo structure (spec-only brief)
4. README + ARCHITECTURE.md
5. Soft launch: GitHub public + Demo link
6. Monitor first 48h (error rate, feedback)
```

**작업 항목**:
- [ ] baseline:generate --tag "mbc-launch"
- [ ] opencore-release 브랜치 생성
- [ ] Open-Core 구조 생성 (Spec-only brief → Claude Code)
- [ ] README.md (Free vs SaaS 비교표)
- [ ] ARCHITECTURE.md (high-level only)
- [ ] GitHub 저장소 생성 및 public 전환
- [ ] Demo 링크 공유 (LinkedIn/Twitter/HN)
- [ ] 48h monitoring (Sentry + Custom dashboard)

**예상 소요**: 2일
**완료 기준**: GitHub public, demo live, no critical issues in 48h

---

## ✅ Go/No-Go 체크리스트 (상세)

### Technical Gates

| Gate | 기준 | 측정 방법 | PASS 조건 |
|------|------|----------|----------|
| **A. 3-Agent Council** | 통합 테스트 통과율 | `npm run test:council` | ≥90% pass |
| **B. NL Feedback** | E2E 파이프라인 동작 | `npm run test:feedback-e2e` | 100% pass |
| **C. Governance** | /guard --strict | `npm run guard -- --strict` | PASS |
| **D. Performance** | Latency p95 | `npm run baseline:generate` | ≤3.1s |
| **E. Reliability** | Error rate | Production logs | <1% |
| **F. Security** | Secret exposure | `npm run secret:lint` | 0 violations |
| **G. Baseline** | Generation success | `baseline:generate --tag mbc` | Success |

### Operational Gates

| Gate | 기준 | 담당 | PASS 조건 |
|------|------|------|----------|
| **H. Documentation** | README + ARCH complete | Kay | Both files exist |
| **I. Demo** | SSR WebView live | Vercel | 200 OK |
| **J. Monitoring** | Dashboard ready | DevOps | Grafana/Sentry live |
| **K. Rollback** | Plan documented | Kay | docs/ROLLBACK.md exists |

### Business Gates

| Gate | 기준 | 담당 | PASS 조건 |
|------|------|------|----------|
| **L. PoC Ready** | Demo + README | Kay | Both ready |
| **M. Support** | Response plan | Kay | Defined in docs |
| **N. Pricing** | Free vs SaaS clear | Kay | Comparison table exists |

---

## 🔒 보안/유출 방지 (재확인)

### 공개 영역 (Open-Core)

```
public/
├── open-template/
│   ├── agent-skeleton.ts          # Abstract structure only
│   ├── prompt-examples/           # 2-3 samples
│   │   ├── sample-retrieval.json
│   │   ├── sample-evaluation.json
│   │   └── sample-planning.json
│   └── quality-rubric.md          # Assessment criteria
├── demo-ui/                       # SSR only, static results
│   ├── pages/
│   ├── components/
│   └── public/mock-results.json
├── docs/
│   ├── README.md                  # Intro + Free vs SaaS
│   ├── ARCHITECTURE.md            # High-level only
│   └── CONTRIBUTING.md
└── .vercel.json
```

### 비공개 영역 (Proprietary)

```
private/ (NOT in public repo)
├── src/core/orchestrator.ts       # Multi-agent coordination
├── src/core/governance/           # Governance kernel
├── src/feedback/                  # Quality feedback loop
├── src/infrastructure/governance/ # Policy DSL
├── governance-rules.yaml          # Production policies
├── .env                           # API keys
├── feature-flags.json             # Feature toggles
└── reports/                       # Internal metrics
```

---

## 📊 성능 KPI (Demo vs SaaS)

| Metric | Demo (Open-Core) | SaaS (Production) | 측정 방법 |
|--------|------------------|-------------------|----------|
| **Alignment** | ≥60% | ≥85% | Ragas score |
| **Latency p95** | ≤3.1s | ≤2.5s | Baseline report |
| **Coverage** | ≥70% | ≥90% | Entity coverage |
| **Cost/1k QA** | ≤$0.10 | ≤$0.07 | Budget Guardian |
| **Error Rate** | <2% | <0.5% | Sentry logs |
| **Quality Score** | 7.5/10 | 9.2/10 | Quality Auditor |

**전략**: Demo는 70% 성능 + 30% 미스터리 → SaaS 전환 유도

---

## 🚨 위험 시나리오 + 대응

| 시나리오 | 리스크 레벨 | 선제 대비 (이미 보유) | 추가 조치 |
|---------|------------|---------------------|----------|
| **외부 문서 대량 투입** | High | Loop Scheduler (queue limit 20) | Rate limiting API |
| **정책 충돌** | Medium | Policy conflict map | Auto-rollback |
| **피드백 과적응** | High | Cooldown 60s + batch 3 | Convergence detection |
| **WebView 내부 노출** | Critical | SSR only | Secret lint (pre-commit) |
| **로그 폭증** | Medium | Rotation 7d/1GB | Async batch append |
| **Canary 실패** | High | Rollback trigger | Auto-revert <5min |

---

## 💼 영업 대응 준비

### PoC 요청 시

**제공 자료**:
1. GitHub Open-Core 링크
2. Demo WebView URL (SSR)
3. README (Free vs SaaS 비교)
4. ARCHITECTURE.md (high-level)

**대응 스크립트**:
```
"Our open-core repo demonstrates the core architecture.
For production deployment with full multi-agent orchestration,
governance kernel, and adaptive feedback loop,
please contact us for enterprise tier."
```

### 기술 질문 시

**FAQ**:
- Q: "How does multi-agent orchestration work?"
  - A: "We use a 3-agent council (Retriever, Evaluator, Planner) with governance-based coordination. Full details available in enterprise tier."

- Q: "Can I self-host?"
  - A: "Open-core version supports self-hosting with agent templates. Full orchestration engine requires SaaS license."

- Q: "What's the performance difference?"
  - A: "Open-core: ~70% quality, 3.1s latency. SaaS: 85%+ quality, 2.5s latency with adaptive feedback loop."

### 보안 검토 시

**제공 자료**:
- Governance architecture diagram
- Sandbox isolation spec (VM, timeout, memory limit)
- Parser trust boundary flow
- Audit log structure (decision ledger)

---

## 📋 최종 체크리스트 (D+14 완료 시)

### Code Quality
- [ ] TypeCheck: 0 errors
- [ ] Lint: 0 errors (warnings OK)
- [ ] Tests: ≥90% pass (3-Agent + Feedback)
- [ ] Secret lint: 0 violations

### Performance
- [ ] Latency p95: ≤3.1s
- [ ] Error rate: <1%
- [ ] Quality score: ≥7.5/10

### Security
- [ ] Sandbox isolation: ENFORCED
- [ ] Parser trust boundary: INTACT
- [ ] No secrets in public repo: VERIFIED
- [ ] SSR only (no internal API): CONFIRMED

### Documentation
- [ ] README.md: COMPLETE (Free vs SaaS)
- [ ] ARCHITECTURE.md: COMPLETE (high-level)
- [ ] ROLLBACK.md: COMPLETE
- [ ] FAQ.md: COMPLETE

### Deployment
- [ ] Vercel WebView: LIVE
- [ ] GitHub public: DONE
- [ ] Monitoring: Grafana + Sentry LIVE
- [ ] baseline:generate --tag "mbc-launch": SUCCESS

### Business Readiness
- [ ] Demo URL shareable: YES
- [ ] PoC response ready: YES
- [ ] Pricing clear: YES (README)
- [ ] Support plan: DEFINED

---

## 🎯 성공 지표 (First 30 Days)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **GitHub Stars** | >100 | GitHub insights |
| **Demo Visits** | >500/week | Vercel analytics |
| **SaaS Inquiries** | >10 | Contact form |
| **Conversion Rate** | >5% | Demo → Contact |
| **System Uptime** | >99.5% | Sentry uptime |
| **Error Rate** | <1% | Sentry logs |

---

## 💡 최종 권고

**현재 시점**: Phase 2C 완성 → MBC 완성 → Open-Core 공개

**권장 전략**: Option A-Prime (10-14일 집중)

**핵심 원칙**:
1. **최소 완성 기준(MBC)** - 3-Agent + NL Feedback
2. **Go/No-Go 검증** - 7개 Technical Gates 통과
3. **투명한 껍데기** - Open-Core 신뢰 확보
4. **불투명한 핵심** - Orchestration/Governance IP 보호
5. **자연스러운 전환** - Demo → SaaS 유도

**다음 액션**:
1. 이 로드맵 검토 및 승인
2. Day 0 작업 착수 (3-Agent Council 설계)
3. Daily standup (진행 상황 체크)
4. D+10 Go/No-Go 결정
5. D+14 Soft Launch

---

**작성자**: Claude Code (MBC Roadmap)
**승인 대기**: Kay (Technical Lead)
**목표**: 10-14일 내 Open-Core Launch 준비 완료
