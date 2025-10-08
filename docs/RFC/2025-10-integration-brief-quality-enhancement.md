# Integration Brief: Advanced Quality Enhancement (RFC 2024-10)

**Status**: Registered - Pending Phase 2B Step 3
**Date**: 2025-10-08
**Integration Target**: Phase 2B Step 3 (QA Feedback Loop)
**Reference**: `docs/RFC/2024-10-quality-enhancement-approaches.md`

---

## Context

현재 시스템은 **Phase 2B Step 2 (Metrics 리팩토링)** 단계이며,
Domain ↔ Application ↔ Governance 루프가 완전히 정렬된 상태입니다.

**현재 아키텍처**:

```
Domain Layer (순수 로직)
  └─ Diversity Planner ✅
  └─ Value Objects, Specifications ✅

Application Layer (오케스트레이션)
  └─ Diversity Planner Service ✅
  └─ Metrics Service (리팩토링 중) 🟡

Infrastructure Layer (외부 기술)
  └─ RAG (BM25) ✅
  └─ Embeddings (Python bridge) ✅
  └─ Advanced Checkers (예정) ⏳

Governance Layer (자율 제어)
  └─ Gate A-D ✅
  └─ Feature Flags ✅
  └─ Regression Guard ✅
```

**이제 할 일**: 외부 기술(RAG/Ragas/Hybrid Embedding 등)을
Infrastructure 계층의 **"Quality Checkers"** 형태로 통합합니다.

---

## Goal

RFC 2024-10의 기술 명세를 기반으로,
**"기존 품질 측정 시스템"**에 고급 품질 평가 플러그인(Advanced Checkers)을 안전하게 추가합니다.

### Success Criteria

- ✅ 기존 Rule-Based Checker 유지 (100% 호환)
- ✅ Domain 계층 변경 금지 (순수 비즈니스 로직 보호)
- ✅ Feature Flag로 점진적 활성화 (Canary 10% → 50% → 100%)
- ✅ Governance Gate C/D 통합 (성능/비용 자동 감시)
- ✅ Fallback 메커니즘 (실패 시 즉시 Rule-Based로 복귀)

---

## Integration Scope

### 1. Domain 계층: **변경 금지**

순수 비즈니스 로직은 그대로 유지:

- `src/domain/agents/diversity-planner.ts` - 변경 없음
- `src/domain/alignment/alignment-specification.ts` - 변경 없음
- `src/domain/extraction/value-objects.ts` - 변경 없음

### 2. Application 계층: **Plugin Registry 확장**

`scripts/quality/orchestrator.ts`에 Advanced Checkers 등록:

```typescript
// Before (Rule-Based only)
const checkers = [ruleBasedChecker];

// After (Plugin Registry)
const checkers = [
  ruleBasedChecker, // Always enabled
  ...loadAdvancedCheckers(), // Feature Flag controlled
];

interface QualityChecker {
  name: string;
  check(qa: QAItem): Promise<QualityResult>;
  fallback?: QualityChecker; // Fallback to Rule-Based
  enabled: () => boolean; // Feature Flag check
}
```

### 3. Infrastructure 계층: **Advanced Checkers 추가**

새로운 플러그인 모듈 (`scripts/quality/checkers/`):

| Checker                         | 기능                            | Feature Flag                            | 비용/QA | Baseline 개선 목표 |
| ------------------------------- | ------------------------------- | --------------------------------------- | ------- | ------------------ |
| **MultiViewEmbeddingChecker**   | 질문 패러프레이즈 + 다중 임베딩 | `FEATURE_QUALITY_MULTIVIEW_EMBEDDING`   | $0.001  | Alignment +15%     |
| **QuerySideEmbeddingChecker**   | 질문만 임베딩 (경량화)          | `FEATURE_QUALITY_QUERYSIDE_EMBEDDING`   | $0.0005 | Alignment +10%     |
| **TranslationEmbeddingChecker** | 번역 기반 의미 검증             | `FEATURE_QUALITY_TRANSLATION_EMBEDDING` | $0.002  | Naturalness +20%   |
| **HybridSearchChecker**         | BM25 + Vector 하이브리드        | `FEATURE_QUALITY_HYBRID_SEARCH`         | $0.0015 | Coverage +25%      |
| **RagasEvaluationChecker**      | Ragas 프레임워크 통합           | `FEATURE_QUALITY_RAGAS_EVAL`            | $0.003  | Overall +30%       |

### 4. Governance 계층: **Feature Flags + Gates**

**Feature Flags** (`governance-rules.yaml`):

```yaml
quality_enhancement:
  multiview_embedding:
    enabled: false
    canary_percentage: 0 # 0% → 10% → 50% → 100%
    cost_limit_per_qa: 0.001

  queryside_embedding:
    enabled: false
    canary_percentage: 0
    cost_limit_per_qa: 0.0005

  translation_embedding:
    enabled: false
    canary_percentage: 0
    cost_limit_per_qa: 0.002

  hybrid_search:
    enabled: false
    canary_percentage: 0
    cost_limit_per_qa: 0.0015

  ragas_evaluation:
    enabled: false
    canary_percentage: 0
    cost_limit_per_qa: 0.003
```

**Regression Guard Gates**:

- **Gate C (Stability)**: 성능 저하 >15% 감지 시 자동 비활성화
- **Gate D (Budget)**: 비용 초과 시 rollback
- **Gate B (Autonomy)**: 품질 개선율 추적 (목표: +20%)

---

## Implementation Steps

### Phase 2B Step 2 (현재): Metrics 리팩토링

- Port/Adapter 패턴 적용
- Domain ← Application ← Infrastructure 의존성 역전
- **외부 기술 통합 경로만 등록** (실제 적용 안 함)

### Phase 2B Step 3: QA Feedback Loop + Plugin Integration

1. **Plugin Registry 구축**

   ```typescript
   // scripts/quality/orchestrator.ts
   export class QualityOrchestrator {
     private checkers: Map<string, QualityChecker> = new Map();

     registerChecker(checker: QualityChecker) {
       if (checker.enabled()) {
         this.checkers.set(checker.name, checker);
       }
     }
   }
   ```

2. **Advanced Checkers 구현**

   ```bash
   scripts/quality/checkers/
   ├── multiview-embedding-checker.ts
   ├── queryside-embedding-checker.ts
   ├── translation-embedding-checker.ts
   ├── hybrid-search-checker.ts
   └── ragas-evaluation-checker.ts
   ```

3. **Feature Flags 추가**

   ```bash
   governance-rules.yaml 업데이트
   governance-objectives.yaml에 품질 목표 추가
   ```

4. **Baseline Report 확장**

   ```typescript
   // baseline_report_generator.ts
   interface BaselineReport {
     quality_enhancement: {
       overall_improvement: number; // vs rule-based baseline
       cost_per_qa: number;
       latency_ms: number;
       active_checkers: string[];
     };
   }
   ```

5. **Regression Guard 통합**

   ```typescript
   // scripts/rg/check-architecture.ts
   const qualityGate = {
     name: "Gate C - Quality Enhancement",
     check: () => {
       const improvement = getQualityImprovement();
       const cost = getCostPerQA();

       if (improvement < 0.1) return "WARN: Low improvement";
       if (cost > 0.005) return "FAIL: Cost too high";
       return "PASS";
     },
   };
   ```

### Phase 2C: Policy Parser + Interpreter + Sandbox

- 외부 지식을 자동 반영하는 상위 정책 층 추가
- Sandbox 환경에서 새 기술 안전성 검증
- Policy Interpreter로 Feature Flag 자동 조율

---

## Safety Mechanisms

### 1. Feature Flag Default: OFF

모든 Advanced Checkers는 기본적으로 비활성화:

```bash
FEATURE_QUALITY_MULTIVIEW_EMBEDDING=false
FEATURE_QUALITY_QUERYSIDE_EMBEDDING=false
FEATURE_QUALITY_TRANSLATION_EMBEDDING=false
FEATURE_QUALITY_HYBRID_SEARCH=false
FEATURE_QUALITY_RAGAS_EVAL=false
```

### 2. Fallback to Rule-Based

Advanced Checker 실패 시 즉시 Rule-Based로 복귀:

```typescript
async check(qa: QAItem): Promise<QualityResult> {
  try {
    return await this.advancedCheck(qa);
  } catch (error) {
    logger.warn(`Advanced check failed, falling back to rule-based`);
    return this.ruleBasedChecker.check(qa);
  }
}
```

### 3. Regression Guard Gates

- **Gate A (Static/DNA)**: 아키텍처 무결성 검사
- **Gate B (Autonomy Loop)**: 품질 개선율 추적
- **Gate C (Stability)**: 성능 저하 감지 → 자동 비활성화
- **Gate D (Budget)**: 비용 초과 → rollback

### 4. Emergency Rollback

```bash
# 모든 Advanced Checkers 비활성화
npm run quality:disable-all

# 또는 개별 비활성화
export FEATURE_QUALITY_MULTIVIEW_EMBEDDING=false
```

---

## Testing Strategy

### Smoke Tests (5 QA pairs)

```bash
npm run quality:test -- --smoke --checker=multiview-embedding
```

- 목표: 100% 성공률
- 시간: <2초
- 비용: <$0.01

### Batch Tests (100 QA pairs)

```bash
npm run quality:test -- --batch --checker=all
```

- 목표: >95% 성공률
- 시간: <5초
- 비용: <$0.50

### Performance Tests

```bash
npm run quality:benchmark -- --samples=1000
```

- 비용/QA: <$0.10 per 1000 QA
- Latency P95: <500ms
- Quality Improvement: >+20%

### Quality Targets

| Metric      | Baseline | Target        | Advanced Checkers  |
| ----------- | -------- | ------------- | ------------------ |
| Alignment   | 17.9%    | 37.9% (+20%)  | MultiView + Hybrid |
| Naturalness | N/A      | >80%          | Translation        |
| Coverage    | N/A      | >90%          | Hybrid Search      |
| Overall     | 6.0/10   | 8.0/10 (+33%) | Ragas              |

---

## Documentation

### Primary References

- **RFC 명세**: `docs/RFC/2024-10-quality-enhancement-approaches.md`
- **가이드라인**: `docs/guidelines/qa-generation-guidelines.md`
- **통합 맵**: `docs/technical/INTEGRATION_MAP.md`

### Implementation Docs

- **Plugin Architecture**: `docs/architecture/QUALITY_PLUGIN_SYSTEM.md` (생성 예정)
- **Feature Flags**: `docs/FEATURE_FLAGS.md`
- **Regression Guard**: `docs/REGRESSION_GUARD.md`

---

## Outcome

이 브리프가 실행되면:

### ✅ 외부 기술이 시스템에 안전하게 통합

- Plugin 형태로 독립적 관리
- Feature Flag로 생명주기 제어
- Governance가 자동 조율

### ✅ 기존 품질 체계 유지 + 확장성 확보

- Rule-Based Checker 100% 유지
- Domain 계층 변경 없음
- Progressive Enhancement

### ✅ 거버넌스가 비용·성능 자동 조율

- Gate C/D로 성능 감시
- 자동 rollback 메커니즘
- 품질 개선율 추적

### ✅ 메타 품질 단계 진입

- "좋은 결과를 만드는 시스템" → "좋은 결과를 자율적으로 개선하는 시스템"
- 외부 지식 흡수 + 내부 지능 진화
- 완전 자율 품질 관리

---

## Timeline

| Phase      | 시점       | 작업                   | 산출물                |
| ---------- | ---------- | ---------------------- | --------------------- |
| **Step 2** | D+0 (오늘) | Metrics 리팩토링       | Port/Adapter 구조     |
| **Step 3** | D+1~2      | Plugin Registry 구축   | Quality Orchestrator  |
| **Step 4** | D+3        | Advanced Checkers 구현 | 5개 Checker 모듈      |
| **Step 5** | D+4        | Feature Flags + Gates  | governance-rules.yaml |
| **Step 6** | D+5        | 통합 테스트 + /ship    | baseline-phase2c.json |

---

## Approval

**Prerequisites**:

- ✅ Phase 2B Step 2 완료 (Metrics 리팩토링)
- ✅ Regression Guard All Gates PASS
- ✅ Health Score ≥80/100

**Activation**:

- Feature Flag: Canary 10% → 성공 시 50% → 100%
- Governance 정책 업데이트 로그 기록
- Baseline Report에 품질 개선율 반영

**Success Criteria**:

- 품질 개선: >+20% vs Rule-Based baseline
- 비용 제어: <$0.10 per 1000 QA
- 성능 유지: Latency P95 <500ms
- 안정성: Rollback rate <5%

---

**작성자**: Claude Code
**검토자**: Architecture Team
**참고**: GPT 조언 기반 병렬 예열 → 단일 통합 전략

**핵심 통찰**:

> 이건 "작업을 새로 시작"하는 게 아니라,
> "다음 진화를 예고하고 거버넌스에 등록하는 행위"입니다.
> 지금 Phase 2B-2는 "감각 기관" 만드는 단계,
> RFC 2024-10 브리프는 "세상으로부터의 감각 신호" 등록,
> Phase 2C에서 이 감각 신호와 자율 지능이 결합되어
> 완전한 "지식 흡수형 자율 거버넌스"가 됩니다. 🚀
