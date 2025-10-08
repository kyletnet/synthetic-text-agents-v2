# RFC: v4 Hardening + Operator Registry - "Cathedral & Forge"

**Status**: Design Specification
**Created**: 2025-10-09
**Owner**: System Architecture Team
**Approach**: Evolutionary Enhancement (Phase 2.6-3.0)
**Philosophy**: "느림을 허용하되, 깊이를 선택하자" - 최고 품질·최고 신뢰

---

## Executive Summary

### Strategic Shift

**From**: Single-loop, real-time constrained system
**To**: Dual-track architecture - offline depth (Cathedral) + runtime precision (Forge)

**Goal**: 도메인 전문가·데이터 구축 전문가·프롬프트 장인을 능가하는 결과물을 안정적·독창적으로 생산

### Key Innovation

1. **Cathedral (오프라인)**: 8 페르소나의 지성을 규칙·연산자·보상으로 증류
2. **Forge (런타임)**: 리트리벌 중심 4-Layer 배치 파이프라인
3. **Feedback as Program**: 자연어 피드백을 즉시 시스템 명령으로 변환
4. **Evidence-Locked Generation**: 모든 생성은 근거에 잠금

### Target KPIs

| Metric | Current | Target | Phase |
|--------|---------|--------|-------|
| Groundedness | 73% | ≥85% | 2.7 |
| Recall@10 | baseline | +20% | 2.6 |
| Readability | baseline | +10% | 2.7 |
| Cost/1kQA | baseline | -25% | 2.8 |
| Feedback Utilization | - | ≥70% | 2.6 |
| Evidence-UI Match | - | ≥90% | 3.0 |

---

## 0. Principles (Non-Negotiable)

1. **Retrieval-First**: 모든 생성은 근거에 잠금 (evidence-locked)
2. **Feedback as Program**: 자연어 피드백 → 룰+벡터 → 연산자/제약/가중치 매핑
3. **Audit-by-Design**: 모든 산출물은 TrustToken + C2PA + Snapshot 서명
4. **Outcome-over-Feature**: KPI ≥2개 개선 없으면 자동 reject
5. **Mock 금지**: 항상 실제 파이프라인으로 검증, WebView는 마지막 단계

---

## 1. Architecture v4 - "Cathedral & Forge"

### 1.1 Cathedral (오프라인 창의성 & 전문성 증류)

**Purpose**: 8 페르소나의 지성을 객체화하여 재사용 가능한 자산으로 변환

#### 8 페르소나 보드

1. **Linguistics Board**: 의미·화용·톤·문체 정밀화
2. **Psychology & UX Board**: 독자 인지부하·설득·감정
3. **Logic & Verification Board**: 추론·반례·형식적 검증
4. **Rhetoric & Style Board**: 수사장치·서사·예시 다변화
5. **Domain Boards** (산업별): 의료/금융/법률 정책·규정
6. **Evidence & RAG Board**: 리트리벌/근거 보존·중독 방어
7. **Safety & Compliance Board**: 금지·민감·규제 컨스티튜션
8. **Editorial Board**: 최종 편집·일관성·감동 완결

#### 산출물 (Genius Lab Output)

```
src/offline/genius-lab/
├── persona-canon/           # 규칙·패턴·예시 코퍼스
│   ├── linguistics.yml
│   ├── psychology.yml
│   ├── logic.yml
│   ├── rhetoric.yml
│   ├── domain/{healthcare,finance,legal}.yml
│   ├── evidence.yml
│   ├── safety.yml
│   └── editorial.yml
│
├── aol/                     # Augmentation Operator Library
│   ├── registry.json        # 메타데이터 (카테고리, 버전, 호환성)
│   ├── operators/
│   │   ├── paraphrase-with-citation.ts
│   │   ├── contrast-set-generator.ts
│   │   ├── question-decomposer.ts
│   │   ├── tone-adapter.ts
│   │   ├── cognitive-load-limiter.ts
│   │   ├── domain-lexicon-fixer.ts
│   │   └── ... (≥30 operators)
│   └── experiments/         # Canary operators
│
├── gcg/                     # Guideline → Constraint Grammar
│   ├── grammar.yml          # 토큰/문장/구조 제약 규칙
│   ├── compiler.ts          # 가이드라인 → 제약문법 자동 생성
│   └── rules/
│       ├── number-unit.yml  # 숫자/단위 정규식
│       ├── tone-markers.yml # 톤/억양 표식
│       ├── forbidden-ngrams.yml # 금지 패턴
│       ├── structure.yml    # SVO, bullet, step 구조
│       └── citation.yml     # 인용/근거 의무
│
├── rewards/                 # Reward Models
│   ├── naturalness.pt       # 자연성 스코어러
│   ├── groundedness.pt      # 근거성 스코어러
│   ├── originality.pt       # 독창성 스코어러
│   ├── compliance.pt        # 규정 준수 스코어러
│   ├── tone-consistency.pt  # 톤 일관성 스코어러
│   └── composite.ts         # 가중합 스코어러
│
└── tournament/              # ELO/보상 리그
    ├── harness.ts
    ├── champion-challenger.ts
    └── results/
```

---

### 1.2 Forge (런타임 배치 정련 4-Layer)

**Purpose**: 리트리벌 중심으로 최고 품질 생성, 피드백 기반 최적화

#### Layer 1: Retrieval Cognition

```
src/runtime/l1-retrieval/
├── hybrid-orchestrator.ts   # BM25(α) + Vector(β) 하이브리드
├── source-trust.ts          # 4-factor trust scoring
├── poisoning-guard.ts       # 5-layer detection
├── rerank-mmr.ts           # Maximal Marginal Relevance
├── multi-view-embed.ts     # Multi-view embedding
└── cross-evidence-voter.ts # ≥2 출처 투표
```

**Inputs**: Query, Domain, Tenant Context
**Outputs**: Trusted chunks with evidence hash

**KPIs**: Recall@10 +20%, SourceTrust ≥0.6, PoisonCheck pass rate ≥99%

---

#### Layer 2: Semantic Synthesizer

```
src/runtime/l2-synthesizer/
├── intent-slot-extractor.ts # 의도/슬롯 추출
├── context-normalizer.ts    # 근거 의미 정규화
└── ambiguity-resolver.ts    # 모호성 해소
```

**Inputs**: Query + Evidence chunks
**Outputs**: Normalized intent + evidence slots

**KPIs**: Disambiguation accuracy ≥90%, Slot filling F1 ≥0.85

---

#### Layer 3: Augmentation Planner

```
src/runtime/l3-planner/
├── operator-registry.ts     # AOL 디스패치
├── apply-aol.ts            # 연산자 적용
├── apply-gcg.ts            # 제약문법 강제
└── reward-scorer.ts        # 보상 가중합 계산
```

**Inputs**: Intent + evidence slots + Feedback context
**Outputs**: Augmented candidates with scores

**Decision Logic**:
- Feedback intent → AOL 연산자 세트 활성화
- GCG 제약 → 생성 제한 (숫자/톤/구조)
- Reward model → 후보 순위 결정

**KPIs**: Augmentation diversity ≥0.7, GCG compliance ≥98%

---

#### Layer 4: Reflective Optimizer

```
src/runtime/l4-optimizer/
├── feedback-interpreter.ts  # Neuro-symbolic intent 분류
├── bandit-policy.ts        # 모델/연산자/프롬프트 선택
├── pareto-router.ts        # 품질·비용·다양성 최적화
└── graceful-degradation.ts # 예산 초과 시 축소
```

**Inputs**: User feedback, system metrics
**Outputs**: Updated α/β, AOL/GCG switches, Reward weights

**Feedback Processing**:
1. Intent classification (10 classes)
2. Modifiers extraction (brevity, structure, lexicon)
3. Mapping to system parameters:
   - `α/β` (retrieval weights)
   - Active AOL set
   - GCG switches
   - Reward delta

**KPIs**: Feedback utilization ≥70%, Bandit regret ≤0.1, Cost/1kQA -25%

---

## 2. Feedback as Program (Neuro-Symbolic)

### 2.1 Intent Classification (10 Classes)

```typescript
enum FeedbackIntent {
  INCORRECT = "incorrect",           // 잘못된 정보
  INSUFFICIENT = "insufficient",     // 불충분한 정보
  UNCLEAR = "unclear",               // 불명확한 표현
  STYLE = "style",                   // 문체/톤 문제
  EVIDENCE = "evidence",             // 근거 부족/부적절
  EXPAND = "expand",                 // 확장 필요
  CONTRAST = "contrast",             // 대비/비교 추가
  STRUCTURE = "structure",           // 구조 개선
  TONE = "tone",                     // 톤 조정
  DOMAIN_LEXICON = "domain_lexicon"  // 도메인 용어 문제
}
```

### 2.2 Modifiers

```typescript
interface FeedbackModifiers {
  brevity?: boolean;                 // 간결하게
  structure?: "bullet" | "step" | "narrative";
  rhetorical_move?: string;          // "definition→example"
  lexicon_strict?: boolean;          // 도메인 용어 엄격 적용
  coverage?: "comprehensive" | "focused";
  evidence_level?: "minimal" | "standard" | "extensive";
}
```

### 2.3 Mapping to System Parameters

```typescript
// feedback-mapping.json
{
  "incorrect": {
    "retrieval": { "alpha": 0.8, "beta": 0.2 },  // 더 정확한 검색
    "operators": ["verify-facts", "cross-reference"],
    "gcg": { "citation_mandatory": true },
    "reward": { "groundedness_weight": 1.5 }
  },
  "brevity": {
    "operators": ["summarize", "cognitive-load-limit"],
    "gcg": { "max_sentence_length": 20, "structure": "bullet" },
    "reward": { "readability_weight": 1.3 }
  },
  "evidence": {
    "retrieval": { "alpha": 0.7, "beta": 0.3, "min_sources": 2 },
    "operators": ["multi-source-citation", "evidence-lock"],
    "gcg": { "citation_mandatory": true, "min_citations": 2 }
  }
}
```

**Implementation**:
```bash
src/runtime/l4-optimizer/feedback-interpreter.ts
└── Maps intent + modifiers → system parameters
```

---

## 3. Core Components (ABI/Registry)

### 3.1 Retrieval Fabric Registry

```typescript
// src/control/retrieval-registry.ts
interface RetrievalAdapter {
  id: string;
  type: "bm25" | "vector" | "hybrid" | "mmr" | "multi-view";
  version: string;
  status: "canary" | "champion" | "deprecated";
  config: Record<string, unknown>;
  metrics: {
    recall_at_10: number;
    latency_p95: number;
    cost_per_query: number;
  };
}

class RetrievalRegistry {
  register(adapter: RetrievalAdapter): void;
  get(id: string): RetrievalAdapter;
  getBest(metric: string): RetrievalAdapter;
  promote(id: string): void; // Canary → Champion
}
```

---

### 3.2 Operator Registry (AOL)

```typescript
// src/runtime/l3-planner/operator-registry.ts
interface OperatorMeta {
  id: string;
  category: "semantic" | "style" | "cognitive" | "structure";
  version: string;
  status: "canary" | "champion" | "deprecated";
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  evidence_level: "required" | "optional" | "none";
  cost_tier: 1 | 2 | 3 | 4 | 5;
  risk_level: "low" | "medium" | "high";
}

class OperatorRegistry {
  register(op: Operator, meta: OperatorMeta): void;
  get(id: string): Operator;
  getByCategory(category: string): Operator[];
  dispatch(intent: string, modifiers: object): Operator[];
}
```

**Registry File**: `src/offline/genius-lab/aol/registry.json`

---

### 3.3 GCG Compiler

```typescript
// src/offline/genius-lab/gcg/compiler.ts
class GCGCompiler {
  /**
   * 가이드라인 문서 → 제약문법 자동 생성
   *
   * Input: Markdown guideline file
   * Output: grammar.yml (formal constraints)
   */
  compile(guideline: string): Grammar;

  /**
   * 제약문법 검증
   */
  validate(text: string, grammar: Grammar): ValidationResult;

  /**
   * 버전 관리 및 역호환
   */
  getVersion(grammar: Grammar): string;
  ensureBackwardCompatibility(v1: Grammar, v2: Grammar): boolean;
}
```

**Grammar Schema**:
```yaml
# grammar.yml
version: "1.0.0"
rules:
  number_format:
    pattern: "^[0-9,]+$"
    unit_required: true

  tone:
    allowed: ["formal", "informal", "technical"]
    markers: ["!", "?", "..."]

  structure:
    type: "svo" # Subject-Verb-Object
    bullet_max: 5

  citation:
    mandatory: true
    min_sources: 1
    format: "[Source: {title}]"

  forbidden:
    ngrams: ["absolutely", "definitely"]
    patterns: ["password.*:", "secret.*="]
```

---

### 3.4 Model Router & QoS/Cost

```typescript
// src/control/model-router.ts
interface ModelPolicy {
  tenant_id: string;
  domain: string;
  budget_limit: number;    // 달러/월
  latency_sla: number;     // 초
  quality_floor: number;   // 0-1
  models: Array<{
    id: string;
    weight: number;
    fallback?: string;
  }>;
}

class ModelRouter {
  route(query: string, policy: ModelPolicy): ModelSelection;
  trackCost(tenant_id: string, cost: number): void;
  enforceQuota(tenant_id: string): boolean;
  gracefulDegrade(reason: string): ModelSelection;
}
```

---

### 3.5 Experiment Catalog

```typescript
// src/control/experiment-catalog.ts
interface Experiment {
  id: string;
  type: "model" | "operator" | "retrieval" | "reward";
  status: "canary" | "ab_test" | "champion" | "deprecated";
  start_date: Date;
  metrics: {
    groundedness_delta: number;
    cost_delta: number;
    latency_delta: number;
  };
  promotion_criteria: {
    min_samples: number;
    confidence: number;
    kpi_improvement: number;
  };
}

class ExperimentCatalog {
  create(exp: Experiment): void;
  promote(id: string): void; // Canary → Champion
  rollback(id: string): void;
  getActive(): Experiment[];
}
```

---

## 4. Performance Optimization (배치 지향)

### 4.1 Latency Budget per Layer

```typescript
// 배치 파이프라인이므로 throughput 우선, 하지만 각 Layer 예산 설정
const LAYER_BUDGETS = {
  L1_RETRIEVAL: 800,      // ms
  L2_SYNTHESIZER: 500,    // ms
  L3_PLANNER: 1000,       // ms (연산자 다수 실행)
  L4_OPTIMIZER: 300,      // ms
  TOTAL_P95: 3000         // ms (p95 목표)
};
```

**Graceful Degradation**:
- 예산 초과 시: 연산자 세트 축소, 토큰 상한, 요약 우선, 캐시 재사용

---

### 4.2 Bandit Orchestration

```typescript
// src/runtime/l4-optimizer/bandit-policy.ts
class BanditPolicy {
  /**
   * 모델/연산자/프롬프트 선택 자동화
   *
   * UCB (Upper Confidence Bound):
   * score = empirical_mean + sqrt(2*ln(t)/n)
   */
  select(context: Context): Action;

  /**
   * 보상 업데이트
   * reward = w1*Groundedness + w2*Readability + w3*Diversity
   *          - w4*Cost - w5*Latency
   */
  update(action: Action, reward: number): void;

  /**
   * Tenant/Domain별 정책 분리
   */
  getPolicyForTenant(tenant_id: string): BanditPolicy;
}
```

---

### 4.3 Pareto Router

```typescript
// src/runtime/l4-optimizer/pareto-router.ts
interface Candidate {
  text: string;
  quality: number;   // Composite score
  cost: number;      // 달러
  diversity: number; // 0-1
}

class ParetoRouter {
  /**
   * 품질·비용·다양성 동시 최적화
   * Pareto 최적 후보만 선택
   */
  selectParetoOptimal(candidates: Candidate[]): Candidate[];

  /**
   * 결측치 처리: 최근 3회 평균
   */
  handleMissing(candidate: Candidate): Candidate;
}
```

---

### 4.4 Caching Strategy

```
reports/cache/
├── evidence/           # 증거 캐시 (해시 기반)
├── embeddings/         # 임베딩 캐시
├── explanations/       # 설명 캐시 (재현성)
└── trust-scores/       # Trust 점수 캐시
```

**Cache Policy**:
- Evidence: 해시 기반, 7일 TTL
- Embeddings: 90일 TTL, LRU eviction
- Explanations: 30일 TTL, checksum 검증

---

## 5. Gate System (확장)

### 5.1 Existing Gates (Phase 2C, P1, P2)

| Gate | Purpose | Threshold | Phase |
|------|---------|-----------|-------|
| A-O | Preflight validation | Pass/Fail | 2C |
| P | Poisoning detection | PoisonCheck pass ≥99% | 1.6 |
| I | Trust floor | SourceTrust ≥0.6 | 1.6 |
| E | Explanation stability | Consistency ≥95% | P2-2 |

### 5.2 New Gates (v4)

#### Gate Q: Quality-Cost Pareto

```typescript
// src/domain/preflight/gate-q-pareto.ts
class GateQ {
  /**
   * Pareto 최적성 검증
   *
   * FAIL if:
   * - Dominated by other candidate (worse in all dimensions)
   * - Cost > budget * 1.2
   * - Quality < quality_floor
   */
  check(candidates: Candidate[]): GateResult;
}
```

**Criteria**:
- Pareto-optimal candidates only
- Cost ≤ budget × 1.2
- Quality ≥ quality_floor (0.7)

---

#### Gate T: Telemetry Insight Rate

```typescript
// src/domain/preflight/gate-t-telemetry.ts
class GateT {
  /**
   * 피드백 활용도 검증
   *
   * FAIL if:
   * - Feedback utilization < 80%
   * - Intent classification accuracy < 85%
   */
  check(telemetry: TelemetryData): GateResult;
}
```

**Criteria**:
- Feedback utilization ≥80%
- Intent classification accuracy ≥85%
- Reward update frequency ≥daily

---

#### Gate V: Evidence-UI Match

```typescript
// src/domain/preflight/gate-v-evidence-ui.ts
class GateV {
  /**
   * WebView와 증거 일치도 검증 (Phase 3.0)
   *
   * FAIL if:
   * - Evidence hash mismatch
   * - TrustToken signature invalid
   * - UI 렌더링 오류 > 5%
   */
  check(ui_state: UIState, evidence: Evidence[]): GateResult;
}
```

**Criteria**:
- Evidence-UI match ≥90%
- TrustToken signature valid 100%
- SSR latency ≤3s

---

## 6. Multi-Tenant Isolation (상세 규정)

### 6.1 Storage & KMS

```
tenants/
├── <tenant-id>/
│   ├── corpus/              # Corpus bucket
│   ├── vectordb/            # VectorDB namespace
│   ├── evidence/            # Evidence store
│   ├── snapshots/           # Audit snapshots
│   ├── logs/                # Tenant logs
│   └── kms/                 # KMS key per tenant
│       ├── encryption_key
│       └── signature_key
```

**Isolation Rules**:
1. Storage: 별도 버킷/네임스페이스
2. KMS: Tenant별 암호화/서명 키
3. Logs/Metrics: `tenant_id` 필수 키
4. Router/Feature Flags: `tenants/<id>/*.yaml`

---

### 6.2 Metric Keys

```typescript
// All metrics MUST include tenant context
interface MetricContext {
  tenant_id: string;
  domain: string;
  usecase: string;
  timestamp: Date;
}

// Example
metrics.record("retrieval.recall_at_10", 0.85, {
  tenant_id: "healthcare-tenant-1",
  domain: "medical",
  usecase: "qa-generation"
});
```

---

### 6.3 Policy DSL (Tenant-aware)

```typescript
// docs/ARCHITECTURE_MULTI_TENANT.md에 이미 정의됨
interface TenantPolicy {
  tenant_id: string;
  domain_id: string;
  usecase_id: string;
  policy_semver: string;
  origin_signature: string;
  rules: PolicyRule[];
  metadata: {
    created_at: Date;
    updated_at: Date;
    author: string;
    approval_status: "pending" | "approved" | "rejected";
  };
}
```

---

## 7. Regulatory Packs (GCG Rule Sets)

### 7.1 Healthcare (HIPAA)

```yaml
# src/offline/genius-lab/gcg/rules/hipaa.yml
version: "1.0.0"
domain: "healthcare"
compliance: "HIPAA"

rules:
  phi_masking:
    patterns:
      - "\\b\\d{3}-\\d{2}-\\d{4}\\b"  # SSN
      - "\\b[A-Z]{2}\\d{6}\\b"        # Medical Record Number
    action: "mask"

  data_retention:
    minimum: "7 years"
    location: "US-only"

  access_control:
    type: "role-based"
    roles: ["physician", "nurse", "admin"]

  audit_trail:
    mandatory: true
    immutable: true
    storage: "append-only"

  evidence_requirements:
    min_sources: 2
    source_types: ["peer-reviewed", "clinical-guideline"]
```

---

### 7.2 Finance (SOX)

```yaml
# src/offline/genius-lab/gcg/rules/sox.yml
version: "1.0.0"
domain: "finance"
compliance: "SOX"

rules:
  financial_accuracy:
    number_verification: "mandatory"
    unit_consistency: "enforced"
    rounding: "two_decimal_places"

  change_control:
    approval_workflow: "required"
    reviewer_count: 2
    separation_of_duties: true

  audit_trail:
    transaction_logging: "mandatory"
    retention: "7 years"
    tamper_proof: true

  evidence_requirements:
    min_sources: 2
    document_versioning: "locked"
```

---

## 8. Provenance & Evidence-UI Verification

### 8.1 API Response Schema

```typescript
// All /api/trust/* responses MUST include provenance
interface TrustAPIResponse {
  data: unknown;
  provenance: {
    trust_token: string;       // JWT + C2PA
    evidence_hash: string;     // SHA-256
    snapshot_id: string;       // Audit snapshot ID
    timestamp: Date;
    signature: string;         // Cryptographic signature
  };
}
```

---

### 8.2 Gate V Implementation

```typescript
// src/domain/preflight/gate-v-evidence-ui.ts
class GateV {
  async check(ui_state: UIState, evidence: Evidence[]): Promise<GateResult> {
    // 1. Hash verification
    const uiHash = computeHash(ui_state);
    const evidenceHash = evidence.map(e => e.hash).join("");

    if (uiHash !== evidenceHash) {
      return { passed: false, reason: "Hash mismatch" };
    }

    // 2. TrustToken signature validation
    const tokenValid = await this.verifier.verify(ui_state.trustToken);
    if (!tokenValid) {
      return { passed: false, reason: "Invalid TrustToken" };
    }

    // 3. Rendering error rate
    const errorRate = ui_state.errors / ui_state.total;
    if (errorRate > 0.05) {
      return { passed: false, reason: `Error rate ${errorRate} > 5%` };
    }

    return { passed: true };
  }
}
```

---

## 9. Chaos/Recovery Runbooks

### 9.1 Scenario 1: LLM Timeout

```markdown
# docs/RUNBOOKS/LLM_TIMEOUT.md

## Scenario
LLM API 타임아웃 (>10s) 또는 rate limit 초과

## Detection
- Event: `llm.timeout` OR `llm.rate_limit`
- Alert: Slack #alerts
- Threshold: 5회/분

## Recovery Steps
1. **Immediate**: Fallback to cached response (if available)
2. **Auto-retry**: Exponential backoff (1s, 2s, 4s)
3. **Router switch**: 다른 모델로 자동 전환
4. **Graceful degrade**: 연산자 세트 축소
5. **Budget enforcement**: 비용 캡 확인

## Validation
- [ ] Response delivered (cached or fallback)
- [ ] Cost within budget
- [ ] No cascade failures

## Rollback
- Restore original model after 5분
- Monitor for 30분
```

---

### 9.2 Scenario 2: Router Failure

```markdown
# docs/RUNBOOKS/ROUTER_FAILURE.md

## Scenario
Model Router 장애 또는 정책 충돌

## Detection
- Event: `router.failure`
- Alert: PagerDuty
- Threshold: 즉시

## Recovery Steps
1. **Immediate**: 직전 안정 정책으로 롤백
2. **Policy freeze**: 정책 업데이트 중단
3. **Manual override**: 관리자 승인 모드
4. **Diagnostics**: 정책 diff 분석

## Validation
- [ ] Router operational
- [ ] Policy conflict resolved
- [ ] No tenant impact

## Post-mortem
- Policy Watchdog 로그 분석
- 충돌 방지 규칙 추가
```

---

### 9.3 Scenario 3: Corpus Poisoning

```markdown
# docs/RUNBOOKS/CORPUS_POISONING.md

## Scenario
RAG corpus에 악의적 문서 삽입 감지

## Detection
- Event: `poisoning_guard.blocked`
- Alert: Security team + Slack #security
- Threshold: 3회/시간

## Recovery Steps
1. **Immediate**: PoisoningGuard → strict mode
2. **Quarantine**: 의심 문서 격리
3. **Re-validate**: SourceTrust 재계산
4. **Snapshot restore**: 최근 안전 스냅샷으로 복구

## Validation
- [ ] No poisoned docs in corpus
- [ ] SourceTrust scores recalculated
- [ ] Evidence hash verified

## Prevention
- Domain allowlist 강화
- Signature 의무화
- 주간 audit
```

---

### 9.4 Scenario 4: Policy Conflict

```markdown
# docs/RUNBOOKS/POLICY_CONFLICT.md

## Scenario
Tenant 정책 충돌 (예: HIPAA + SOX 동시 적용 시 모순)

## Detection
- Event: `policy.conflict`
- Alert: Slack #policy
- Threshold: 정책 업데이트 시

## Recovery Steps
1. **Immediate**: 정책 freeze
2. **Conflict resolution**: 우선순위 규칙 적용
3. **Watchdog alert**: Policy Watchdog 재검증
4. **Human approval**: 고위험 정책은 승인 대기

## Validation
- [ ] Policy conflict resolved
- [ ] Compliance 유지
- [ ] No tenant SLA 위반

## Post-mortem
- 충돌 패턴 분석
- 정책 템플릿 개선
```

---

## 10. Implementation Roadmap (18 Weeks)

### Phase 2.6 (3 weeks): 4-Layer Runtime + Feedback Interpreter

**Goal**: 리트리벌 중심 4-Layer 파이프라인 도입 + Feedback as Program

**Deliverables**:
```
src/runtime/
├── l1-retrieval/
│   ├── hybrid-orchestrator.ts
│   ├── source-trust.ts (기존 재사용)
│   ├── poisoning-guard.ts (기존 재사용)
│   ├── rerank-mmr.ts
│   └── multi-view-embed.ts
│
├── l2-synthesizer/
│   ├── intent-slot-extractor.ts
│   └── context-normalizer.ts
│
├── l3-planner/
│   ├── operator-registry.ts
│   ├── apply-aol.ts (stub)
│   └── apply-gcg.ts (stub)
│
└── l4-optimizer/
    ├── feedback-interpreter.ts  # Neuro-symbolic
    ├── feedback-mapping.json
    └── parameter-updater.ts     # α/β, weights 업데이트
```

**KPIs**:
- Recall@10: +10%
- Feedback Utilization: ≥70%
- Intent classification accuracy: ≥85%

**Tests**:
- [ ] L1-L4 단위 테스트 (≥95% coverage)
- [ ] 통합 테스트 (Retrieval → Synthesizer → Planner → Optimizer)
- [ ] Feedback pipeline test (자연어 → 시스템 파라미터)

---

### Phase 2.7 (4 weeks): Genius Lab v1

**Goal**: AOL ≥30, GCG v1, Reward v1 구축

**Deliverables**:
```
src/offline/genius-lab/
├── persona-canon/
│   ├── linguistics.yml
│   ├── psychology.yml
│   ├── logic.yml
│   ├── rhetoric.yml
│   ├── domain/ (healthcare, finance)
│   ├── evidence.yml
│   ├── safety.yml
│   └── editorial.yml
│
├── aol/
│   ├── registry.json
│   └── operators/ (≥30 operators)
│
├── gcg/
│   ├── grammar.yml
│   ├── compiler.ts
│   └── rules/ (number, tone, structure, citation, forbidden)
│
└── rewards/
    ├── naturalness.pt
    ├── groundedness.pt
    ├── originality.pt
    ├── compliance.pt
    └── composite.ts
```

**KPIs**:
- Groundedness: +12%p (from 73% → 85%)
- Readability: +10%
- GCG compliance: ≥98%

**Tests**:
- [ ] AOL 연산자 개별 테스트
- [ ] GCG 컴파일러 테스트
- [ ] Reward model validation (RAGAS, BLANC)
- [ ] ELO tournament harness

---

### Phase 2.8 (3 weeks): Bandit + Pareto + Optimization

**Goal**: 프로덕션 최적화 (비용·품질·다양성)

**Deliverables**:
```
src/runtime/l4-optimizer/
├── bandit-policy.ts
├── pareto-router.ts
└── graceful-degradation.ts

src/control/
├── experiment-catalog.ts
├── model-router.ts
└── cost-tracker.ts

reports/cache/
├── evidence/
├── embeddings/
├── explanations/
└── trust-scores/
```

**KPIs**:
- Cost/1kQA: -25%
- p95 latency: ≤3s (Layer budget 준수)
- Diversity score: ≥0.7

**Tests**:
- [ ] Bandit regret ≤0.1
- [ ] Pareto optimality verification
- [ ] Cache hit rate ≥60%
- [ ] Graceful degradation simulation

---

### Phase 2.9 (3 weeks): Regulatory Packs + Multi-tenant Isolation

**Goal**: 의료/금융 규정 준수 + Tenant 격리

**Deliverables**:
```
src/offline/genius-lab/gcg/rules/
├── hipaa.yml
└── sox.yml

src/control/policy/
├── watchdog.ts
└── compliance-checker.ts

tenants/<id>/
├── kms/ (per-tenant keys)
├── corpus/
├── vectordb/
└── snapshots/
```

**KPIs**:
- Compliance accuracy: ≥95%
- Tenant drift: ≤2%
- Policy conflict detection: 100%

**Tests**:
- [ ] HIPAA/SOX 규칙 검증
- [ ] Tenant isolation test (cross-tenant leakage = 0)
- [ ] Policy Watchdog 변경 감지 (100%)

---

### Phase 3.0 (2 weeks): Trust Console SSR (마지막)

**Goal**: WebView 연동 (실 API만, Mock 없음)

**Deliverables**:
```
apps/fe-web/app/trust/
├── page.tsx                      # SSR
└── components/
    ├── TrustBadge.tsx
    ├── EvidenceViewer.tsx
    ├── ComplianceBadge.tsx
    ├── ActionButtons.tsx
    └── AuditTimeline.tsx

apps/fe-web/app/api/trust/
├── route.ts                      # Main API
├── evidence/route.ts
├── compliance/route.ts
├── telemetry/route.ts
└── snapshot/route.ts
```

**KPIs**:
- Evidence-UI match: ≥90%
- SSR latency: ≤3s
- Lighthouse score: ≥90
- Gate V: Pass 100%

**Tests**:
- [ ] API integration tests (실 API)
- [ ] UI E2E tests (Playwright)
- [ ] Gate V validation
- [ ] Provenance verification (TrustToken + hash)

---

## 11. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| 창의성 저하 (규칙 과적합) | Medium | High | Bandit 탐색 + Diversity regularizer + Contrast sets |
| 비용 급증 | High | High | Pareto Router + 탐색 깊이 동적 제어 + 캐시 |
| 피드백 노이즈 | Medium | Medium | 신뢰도 라벨(1-5) + 반감기 decay + outlier 필터 |
| 규제 변경 | Low | High | Policy Watchdog → 자동 재검증/리포트 |
| 도메인 편향 | Medium | Medium | Federated ROI/Trust Analytics 교차 보정 |
| LLM 타임아웃/Rate limit | High | Medium | Router fallback + 캐시 + graceful degrade |
| RAG Poisoning | Low | High | PoisoningGuard + 2+ 출처 투표 + 서명 의무화 |
| Policy 충돌 | Medium | High | Watchdog + 우선순위 규칙 + Human approval |

---

## 12. Success Criteria (DoD)

### Phase 2.6
- [ ] L1-L4 runtime operational
- [ ] Feedback interpreter: Intent accuracy ≥85%
- [ ] Recall@10 improvement ≥10%
- [ ] Tests: 765 → 800+ passing (≥95% coverage)

### Phase 2.7
- [ ] AOL: ≥30 operators deployed
- [ ] GCG: Compiler operational, compliance ≥98%
- [ ] Rewards: Composite scorer trained
- [ ] Groundedness: +12%p (73% → 85%)

### Phase 2.8
- [ ] Bandit: Regret ≤0.1
- [ ] Pareto: Cost/1kQA -25%
- [ ] Cache: Hit rate ≥60%
- [ ] p95 latency: ≤3s

### Phase 2.9
- [ ] HIPAA/SOX packs: Compliance ≥95%
- [ ] Tenant isolation: Cross-tenant leakage = 0
- [ ] Policy Watchdog: Conflict detection 100%

### Phase 3.0
- [ ] Trust Console: Evidence-UI match ≥90%
- [ ] SSR latency: ≤3s
- [ ] Gate V: Pass 100%
- [ ] Lighthouse: ≥90

---

## 13. Integration with Existing Systems

### 13.1 Trust Infrastructure (P0-P2-3)

**Status**: ✅ Complete (842/842 tests passing)

**Components**:
- TrustToken Generator (P0) → **재사용** (L4 Provenance)
- Evidence Store (P1) → **재사용** (L1 Retrieval)
- Telemetry Interpreter (P2-1) → **확장** (L4 Feedback)
- Gate E (P2-2) → **재사용** (Explanation Stability)
- Snapshot Logger (P2-3) → **재사용** (Audit Trail)

**Integration Points**:
```typescript
// L1 Retrieval → Evidence Store
const evidence = await evidenceStore.queryEvidence({
  sourceIds: chunks.map(c => c.id),
  minTrustScore: 0.6
});

// L4 Optimizer → Telemetry Interpreter
const insights = await telemetryInterpreter.interpret(feedbackEvents);

// All layers → TrustToken + Snapshot
const token = await trustTokenGenerator.generate(output, trustMetrics, evidence, compliance);
await snapshotLogger.log(token);
```

---

### 13.2 Phase 1.5 (Retrieval Integration)

**Status**: ✅ Complete (765/768 tests, 99.6%)

**Components**:
- RetrievalPort V1 (frozen) → **재사용**
- SourceTrust → **재사용** (L1)
- PoisoningGuard → **재사용** (L1)
- BM25Adapter → **재사용** (L1)

**Integration Points**:
```typescript
// L1 Retrieval orchestrator
const hybridOrchestrator = new HybridOrchestrator({
  bm25: bm25Adapter,
  vector: vectorAdapter,
  sourceTrust: sourceTrust,
  poisoningGuard: poisoningGuard,
  alpha: 0.6,  // BM25 weight
  beta: 0.4    // Vector weight
});
```

---

### 13.3 Phase 2C (Policy/DNA Lock)

**Status**: ✅ Complete (748/748 tests)

**Components**:
- Policy Parser/Interpreter/Runtime → **확장** (GCG 통합)
- DNA Lock-In → **유지** (Architecture stability)

**Integration Points**:
```typescript
// GCG Compiler → Policy Runtime
const grammar = await gcgCompiler.compile(policyDocument);
const validationResult = await policyRuntime.validate(output, grammar);
```

---

## 14. Documentation Updates

### 14.1 New Documents

1. `docs/RFC/2025-16-v4-hardening-and-operator-registry.md` (이 문서)
2. `docs/GUIDELINES_TO_GCG.md` - 가이드라인 → 제약문법 컴파일
3. `docs/REGULATORY_PACKS.md` - HIPAA/SOX/ISO 규칙 샘플
4. `docs/RUNBOOKS/LLM_TIMEOUT.md` - 타임아웃 복구
5. `docs/RUNBOOKS/ROUTER_FAILURE.md` - 라우터 장애
6. `docs/RUNBOOKS/CORPUS_POISONING.md` - 코퍼스 중독
7. `docs/RUNBOOKS/POLICY_CONFLICT.md` - 정책 충돌

### 14.2 Updated Documents

1. `docs/RFC/2025-10-integrated-roadmap-phase1.6-to-2.1.md`
   - Add: Phase 2.6-3.0 (v4 implementation)
   - Add: AOL Registry, GCG Compiler, Feedback Mapping sections

2. `docs/ARCHITECTURE_MULTI_TENANT.md`
   - Add: KMS/버킷 분리 상세 규정
   - Add: Metric keys 필수 필드
   - Add: Router/Feature Flags tenancy

3. `docs/SESSION_STATE.md`
   - Update: v3.2 → v4 evolution
   - Add: Cathedral & Forge architecture
   - Add: Gate Q/T/V

4. `docs/NEXT_ACTIONS.md`
   - Update: Priority 0 → Trust Console (Phase 3.0)
   - Add: v4 Phases 2.6-2.9

---

## 15. Appendix

### 15.1 AOL Operator Examples

```typescript
// 1. Paraphrase with Citation
class ParaphraseWithCitation implements Operator {
  async apply(text: string, evidence: Evidence[]): Promise<string> {
    const paraphrased = await this.llm.paraphrase(text);
    const citations = evidence.map(e => `[Source: ${e.title}]`).join(" ");
    return `${paraphrased} ${citations}`;
  }
}

// 2. Contrast Set Generator
class ContrastSetGenerator implements Operator {
  async apply(text: string): Promise<string[]> {
    return await this.llm.generateContrasts(text, { count: 3 });
  }
}

// 3. Cognitive Load Limiter
class CognitiveLoadLimiter implements Operator {
  apply(text: string): string {
    const sentences = text.split(". ");
    return sentences
      .filter(s => s.split(" ").length <= 20)  // Max 20 words/sentence
      .join(". ");
  }
}
```

---

### 15.2 GCG Grammar Examples

```yaml
# Example: Number + Unit constraint
number_unit:
  pattern: "^[0-9,]+\\s+(kg|lb|m|ft)$"
  enforcement: "strict"
  replacement: "<NUMBER> <UNIT>"

# Example: Forbidden patterns
forbidden:
  ngrams:
    - "absolutely"
    - "definitely"
    - "always"
  action: "reject"

# Example: Citation format
citation:
  mandatory: true
  format: "[Source: {title}, {date}]"
  min_per_paragraph: 1
```

---

### 15.3 Reward Model Weights (Default)

```typescript
const DEFAULT_REWARD_WEIGHTS = {
  naturalness: 0.25,      // 자연성
  groundedness: 0.30,     // 근거성 (최우선)
  originality: 0.15,      // 독창성
  compliance: 0.20,       // 규정 준수
  tone_consistency: 0.10  // 톤 일관성
};

// Composite score
function computeReward(scores: Scores): number {
  return Object.entries(DEFAULT_REWARD_WEIGHTS)
    .reduce((sum, [key, weight]) => sum + scores[key] * weight, 0);
}
```

---

## 16. Conclusion

이 RFC는 현재 시스템(Trust Infrastructure P0-P2-3 완료)을 기반으로, **최고 품질·최고 신뢰** 데이터 증강 배치 파이프라인을 완성하는 v4 설계를 제시합니다.

**핵심 원칙**:
1. **Retrieval-First**: 모든 생성은 근거에 잠금
2. **Feedback as Program**: 자연어 피드백을 즉시 시스템 명령으로 변환
3. **Cathedral & Forge**: 오프라인 창의성 증류 + 런타임 정련
4. **Audit-by-Design**: 모든 산출물은 TrustToken + C2PA + Snapshot 서명

**타임라인**: 18주 (Phase 2.6-3.0)
**Mock 금지**: 항상 실제 파이프라인으로 검증
**WebView**: 마지막 단계(Phase 3.0)에서만 연결

**Target KPIs**:
- Groundedness ≥85% (+12%p)
- Recall@10 +20%
- Readability +10%
- Cost/1kQA -25%
- Evidence-UI Match ≥90%

---

**Status**: ✅ Design Complete
**Next Step**: Phase 2.6 구현 시작 (4-Layer Runtime + Feedback Interpreter)
**Approval**: Pending review

---

**Last Updated**: 2025-10-09 00:15 KST
**Author**: Claude Code + ChatGPT collaboration
**Version**: 1.0
