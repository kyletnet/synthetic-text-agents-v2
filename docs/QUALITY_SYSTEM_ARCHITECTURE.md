# Quality System Architecture

**Single Source of Truth for Quality System Development**

이 문서는 QA 품질 시스템의 중심 설계 문서이며, 모든 개발·운영·확장의 기준입니다.

---

## 0. 배경과 원칙

### 설계 원칙

**1. 단일 기준 문서 (Single Source)**

- 이 문서가 모든 변경의 기준
- 외부 지식은 "참조·확장 레이어"로 흡수

**2. 점진·가드 방식**

- Phase 1: 규칙 기반 (즉시 가동)
- Phase 2-4: Feature Flag로 보호 (단계적 확장)

**3. 성공 기준 (공통 게이트)**

```
CASES_TOTAL > 0 ∧ RESULT ∈ {PASS, PARTIAL}
```

---

## 1. 목표 (What)

### Primary Goals

1. **규칙 기반 Guideline Compliance** (Phase 1)
   - "바로 작동하는" 품질 측정 체계 구축

2. **Evidence-Answer Alignment v2** (Phase 2)
   - 신뢰도 강화 (17.9% → 60%)

3. **Semantic Quality Layer** (Phase 3-4)
   - 의미·자연도·일관성까지 확장 가능한 구조

4. **CI 통합 및 거버넌스**
   - 품질 게이트 연동
   - 리포트·추적 체계

---

## 2. 산출물 (Deliverables)

### 코드 구조

```
scripts/quality/
├── orchestrator.ts              # 실행점 (@tool-mode: analyze)
├── models/
│   ├── quality-domain.ts        # Domain models
│   └── guideline-version.ts     # 버전 관리
├── parsers/
│   └── guideline-parser.ts      # MD → 규칙셋 변환
├── checkers/
│   ├── rule-based-checker.ts    # Phase 1
│   ├── evidence-aligner.ts      # Phase 2
│   ├── hybrid-search-checker.ts # Phase 2-3
│   └── semantic-checker.ts      # Phase 4 (플러그인)
├── registries/
│   ├── plugin-registry.ts       # 플러그인 관리
│   └── metric-registry.ts       # 메트릭 관리
├── compliance-score.ts          # Phase 1 스코어링
└── integrated-quality-index.ts  # Phase 3+ 통합 지표
```

### 리포트 구조

```
reports/
├── baseline_report.jsonl        # 확장됨
└── quality/
    ├── compliance-summary.json
    ├── violations.jsonl
    ├── metrics-history.json
    └── trends/
        ├── 2024-10-w1.json
        └── ...
```

---

## 3. Phase별 실행 전략

### Phase 0: RFC 구조 수용 (지금 바로)

**목적**: 이후 단계를 빠르게 붙일 레일 구축

**작업**:

```bash
npm run rfc:sync-governance  # 거버넌스 규칙 생성
npm run rfc:scaffold         # 코드 템플릿 생성
```

**주의**: 모든 Feature Flag = `false` (기본)

**산출물**:

- `scripts/quality/` 디렉토리 구조
- 코드 템플릿 (구현 대기)
- `governance-rules.json` 업데이트

---

### Phase 1: 규칙 기반 Compliance (Week 1)

**목표**:

```
guideline_compliance ≥ 0.85
```

**구현 항목**:

1. **guideline-parser.ts**
   - 가이드라인 문서 파싱
   - 규칙셋 JSON 캐시 생성 (`docs/guidelines/cache/rules.v1.0.json`)
   - 버전 관리 (`versions.json`)

2. **rule-based-checker.ts**
   - `questionTypeCheck`: 7가지 질문 유형
   - `numberFormatCheck`: "15일", "50만원" 형식
   - `prohibitedPatternCheck`: 금지 패턴 검출
   - `answerStructureCheck`: 답변 구조 검증

3. **compliance-score.ts**
   - 가중치 (초기값):
     - 질문 유형: 40%
     - 답변 구조: 30%
     - 숫자 표현: 20%
     - 금지 사항: 10%
   - 설정 외부화

4. **baseline_report 통합**

```json
{
  "guideline_compliance": {
    "score": 0.87,
    "version": "1.0",
    "breakdown": {
      "question_types": 0.90,
      "answer_structure": 0.85,
      "number_formats": 0.88,
      "prohibitions": 0.95
    },
    "violations": [...],
    "recommendations": [...]
  }
}
```

5. **CI 게이트**

```yaml
# .github/workflows/unified-quality-gate.yml
- name: 🎯 Quality Assessment
  run: npm run quality:assess

- name: 🚦 Quality Gate
  run: npm run quality:gate
```

**Feature Flags**:

```bash
FEATURE_GUIDELINE_GATE=true  # ← 유일하게 ON
```

**Gate A (진행 조건)**:

- [ ] `CASES_TOTAL > 0 ∧ RESULT ∈ {PASS, PARTIAL}`
- [ ] `guideline_compliance ≥ 0.85`
- [ ] Violations/Recommendations 리포트 정상
- [ ] CI 게이트 정상 동작

---

### Phase 2: Evidence + Retrieval (Week 2, 섀도우)

**목표**:

```
snippet_alignment ≥ 0.60
citation_presence ≥ 0.90
retrieval_quality_score ≥ 0.70
Hybrid 섀도우 개선 Δ ≥ +5%
```

**구현 항목**:

1. **evidence-aligner.ts**
   - `snippet_alignment`: 문장 단위 매칭 + 키워드 중첩 + 역검증
   - `citation_presence`: 인용 존재 여부
   - `context_precision`: Evidence 중 사용 비율
   - `context_recall`: 필요 정보 포함도

2. **hybrid-search-checker.ts (섀도우)**
   - BM25 스코어 (렉시컬)
   - Vector 유사도 (시맨틱)
   - 하이브리드 스코어: `α * vector + (1-α) * bm25`
   - **응답 미반영, 리포트만 기록**

3. **Ragas 샘플 평가 (20%)**

```typescript
if (Math.random() < 0.2) {
  // Context Recall, Precision, Groundness, Faithfulness
  await ragas.evaluate(qa);
}
```

4. **baseline_report 확장**

```json
{
  "evidence_metrics": {
    "snippet_alignment": 0.62,
    "citation_presence": 0.91,
    "context_precision": 0.75,
    "context_recall": 0.8,
    "retrieval_quality_score": 0.72
  },
  "shadow_metrics": {
    "hybrid_search": {
      "improvement_delta": 0.08,
      "bm25_avg": 0.65,
      "vector_avg": 0.7,
      "hybrid_avg": 0.73
    }
  }
}
```

**Feature Flags**:

```bash
FEATURE_EVIDENCE_GATE=false        # 섀도우 (리포트만)
FEATURE_QUALITY_HYBRID_SEARCH=false  # 섀도우
FEATURE_QUALITY_RAGAS_EVAL=false     # 내부 샘플링만
QUALITY_SAMPLING_RATE=0.2            # Ragas 20%
```

**Gate B (승격 조건)**:

- [ ] `snippet_alignment ≥ 0.60`
- [ ] `citation_presence ≥ 0.90`
- [ ] `retrieval_quality_score ≥ 0.70`
- [ ] Hybrid 섀도우 `Δ ≥ +5%`
- [ ] 비용 추정 < $0.10 per 100 QA

---

### Phase 3: Hybrid 활성화 (Week 3, 카나리)

**목표**:

```
Hybrid 품질 Δ ≥ +5%
비용/지연 ≤ +10%
회귀 없음
```

**실행 전략**:

1. **카나리 배포**

```typescript
// 10% 트래픽부터 시작
const canaryRate = parseFloat(process.env.HYBRID_CANARY_RATE || "0.1");

if (Math.random() < canaryRate) {
  return hybridSearchChecker.check(qaPairs);
} else {
  return ruleBasedChecker.check(qaPairs);
}
```

2. **점진적 확대**
   - 10% (1일) → 50% (2일) → 100% (3일)
   - 각 단계에서 메트릭 모니터링

3. **Ragas 샘플 확대**
   - 20% → 30%

**Feature Flags**:

```bash
FEATURE_QUALITY_HYBRID_SEARCH=true   # ← 활성화
HYBRID_CANARY_RATE=0.1               # 카나리 비율
QUALITY_SAMPLING_RATE=0.3            # Ragas 30%
```

**Gate C (승격 조건)**:

- [ ] Hybrid 품질 `Δ ≥ +5%`
- [ ] 비용 증가 `≤ +10%`
- [ ] 레이턴시 증가 `≤ +10%`
- [ ] 기존 메트릭 회귀 없음
  - duplication, hallucination, PII 기존 임계 통과

**롤백 조건**:

```
if (quality_delta < 0 || cost_increase > 0.15 || latency > threshold) {
  FEATURE_QUALITY_HYBRID_SEARCH=false  # 즉시 롤백
}
```

---

### Phase 4: 고급 임베딩 (선택적, A/B)

**목표**:

- 플러그인 검증
- 통계적 유의미한 개선 확인

**구현 항목**:

1. **플러그인만 탑재**

```typescript
// scripts/quality/checkers/multiview-embedding-checker.ts
// scripts/quality/checkers/queryside-embedding-checker.ts
// scripts/quality/checkers/translation-embedding-checker.ts
```

2. **A/B 테스트 프레임워크**

```typescript
// scripts/quality/ab-testing.ts
async function comparePlugins(
  baseline: QualityChecker,
  experimental: QualityChecker,
  qaPairs: QAPair[],
): Promise<ABTestResult> {
  // 통계 검정 (t-test)
  // 효과 크기 (Cohen's d)
  // 비용 분석
}
```

3. **승격 조건**
   - p-value < 0.05
   - Cohen's d > 0.3 (medium effect)
   - ROI > 1.5 (비용 대비 효과)

**Feature Flags**:

```bash
FEATURE_QUALITY_MULTIVIEW_EMBEDDING=false   # A/B 대기
FEATURE_QUALITY_QUERYSIDE_EMBEDDING=false   # A/B 대기
FEATURE_QUALITY_TRANSLATION_EMBEDDING=false # A/B 대기
```

**승격 프로세스**:

1. 섀도우 A/B 테스트 (1주)
2. 통계 분석 및 의사결정
3. 승인 시 카나리 10% → 100%

---

## 4. 문서 간 연결 (Integration Map)

### 문서 레이어

```
[중심 설계]
QUALITY_SYSTEM_ARCHITECTURE.md  ← 이 문서
   ↓
[참조 지식]
├── docs/guidelines/qa-generation-guidelines.md  ← 규칙 소스
└── docs/research/rag-architecture-reference.md  ← RAG 기술 참조
   ↓
[매핑 가이드]
docs/QUALITY_EXTENSION_GUIDE.md  ← 지식 → 코드 연결
   ↓
[기술 스펙]
docs/RFC/2024-10-quality-enhancement-approaches.md
```

### 참조 흐름

**가이드라인 → 규칙 기반 Checker**

```
qa-generation-guidelines.md
   ↓ (파싱)
parsers/guideline-parser.ts
   ↓ (규칙 추출)
docs/guidelines/cache/rules.v1.0.json
   ↓ (로드)
checkers/rule-based-checker.ts
```

**RAG 연구 → Semantic Checker**

```
rag-architecture-reference.md
   ↓ (설계 참조)
checkers/semantic-checker.ts
   ↓ (인터페이스 정의)
EmbeddingModel, HybridSearch, RagasEvaluation
```

---

## 5. Feature Flags 전략

### 초기값 (Phase 1)

```bash
# Phase 1: 규칙 기반 (ON)
FEATURE_GUIDELINE_GATE=true

# Phase 2: 섀도우 (리포트만, 게이트 OFF)
FEATURE_EVIDENCE_GATE=false
FEATURE_QUALITY_HYBRID_SEARCH=false
FEATURE_QUALITY_RAGAS_EVAL=false

# Phase 3: 카나리 대기
HYBRID_CANARY_RATE=0.0

# Phase 4: 실험 전용
FEATURE_QUALITY_MULTIVIEW_EMBEDDING=false
FEATURE_QUALITY_QUERYSIDE_EMBEDDING=false
FEATURE_QUALITY_TRANSLATION_EMBEDDING=false

# 샘플링
QUALITY_SAMPLING_RATE=0.2
```

### 하위 호환 보장

```typescript
// Feature Flag OFF 시 기존 동작 100% 재현
if (!process.env.FEATURE_QUALITY_HYBRID_SEARCH) {
  return ruleBasedChecker.check(qaPairs);
}
```

---

## 6. 품질 목표 (KPI)

### Phase 1 목표

- [ ] `guideline_compliance ≥ 0.85`
- [ ] Violation 리포트 생성
- [ ] CI 게이트 정상 작동

### Phase 2 목표

- [ ] `snippet_alignment ≥ 0.60`
- [ ] `citation_presence ≥ 0.90`
- [ ] `retrieval_quality_score ≥ 0.70`
- [ ] Hybrid 섀도우 `Δ ≥ +5%`

### Phase 3 목표

- [ ] Hybrid 품질 `Δ ≥ +5%`
- [ ] 비용 증가 `≤ +10%`
- [ ] 레이턴시 증가 `≤ +10%`

### Phase 4 목표 (선택적)

- [ ] Plugin 효과 크기 `Cohen's d > 0.3`
- [ ] ROI > 1.5

---

## 7. 리스크 및 완화

### 주요 리스크

| Risk                | Mitigation                                        |
| ------------------- | ------------------------------------------------- |
| **비용 폭증**       | Ragas 샘플 평가 (20%), 임베딩 플러그인 A/B만      |
| **유지보수 과밀**   | 플러그인 최소화, Gate 통과 후 승격만              |
| **메트릭 드리프트** | 버전 관리 + 변경 로그 필수                        |
| **거버넌스 충돌**   | `@tool-mode: analyze` 명시, 배포 차단은 CI 게이트 |
| **캐시 만료 실패**  | Orchestrator 자동 재실행                          |

---

## 8. 실행 체크리스트

### Week 1: Phase 1

- [ ] `orchestrator.ts` 생성 (`@tool-mode: analyze`)
- [ ] `guideline-parser.ts` 구현
- [ ] `rule-based-checker.ts` + `compliance-score.ts`
- [ ] `baseline_report` 통합
- [ ] CI 게이트 추가 (`FEATURE_GUIDELINE_GATE=true`)
- [ ] Gate A 통과 확인

### Week 2: Phase 2

- [ ] `evidence-aligner.ts` 구현
- [ ] `hybrid-search-checker.ts` (섀도우)
- [ ] Ragas 샘플 평가 (20%)
- [ ] `reports/quality/*` 구성
- [ ] Trend 저장 시스템
- [ ] Gate B 평가

### Week 3: Phase 3

- [ ] Hybrid Search 카나리 배포
- [ ] Ragas 샘플 30%
- [ ] K값 최적화 실험
- [ ] Gate C 평가
- [ ] 롤백 메커니즘 검증

### Week 4+: Phase 4 (선택적)

- [ ] 플러그인 인터페이스 정의
- [ ] A/B 테스트 프레임워크
- [ ] 통계 분석
- [ ] 승격 의사결정

---

## 9. 승인 및 변경 관리

### 변경 절차

1. RFC 작성 (기술 스펙)
2. 이 문서 업데이트 (실행 전략)
3. `CHANGELOG.md` 기록
4. `versions.json` 업데이트
5. 승인 후 구현

### 승인 주체

- Technical Review: @engineer
- Cost Approval: @budget-owner
- Gate 통과 확인: @qa-lead

---

## 10. References

- **가이드라인**: `docs/guidelines/qa-generation-guidelines.md`
- **RAG 참조**: `docs/research/rag-architecture-reference.md`
- **매핑 가이드**: `docs/QUALITY_EXTENSION_GUIDE.md`
- **기술 스펙**: `docs/RFC/2024-10-quality-enhancement-approaches.md`
- **기존 시스템**: `scripts/metrics/baseline_report_generator.ts`

---

## Appendix: 명령어 참조

```bash
# 품질 평가
npm run quality:assess

# 품질 게이트 (CI 용)
npm run quality:gate

# 리포트 생성
npm run quality:report

# RFC 동기화
npm run rfc:sync
npm run rfc:sync-governance
npm run rfc:scaffold
```

---

**Last Updated**: 2024-10-06
**Version**: 1.0.0
**Status**: Active
