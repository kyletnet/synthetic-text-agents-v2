# RFC: Advanced Quality Enhancement Approaches

## Context

현재 QA 생성 시스템은 규칙 기반 품질 측정을 사용하고 있으나, 데이터 구축 전문가의 가이드라인(docs/guidelines/qa-generation-guidelines.md)에서 요구하는 고급 품질 기준을 완전히 충족하지 못하고 있습니다.

**현재 상황:**

- ✅ 규칙 기반 검증 (패턴 매칭, 정규표현식)
- ✅ Evidence-Answer 정렬 측정 (17.9% baseline)
- ❌ 의미적 품질 측정 부재
- ❌ 사람다움(naturalness) 평가 부재
- ❌ 편향 검출 메커니즘 부재

**필요성:**
데이터 품질을 "기계적 정확도"에서 "인간 수준의 질감"으로 끌어올리기 위한 선진 기술 도입이 필요합니다.

---

## Goals / Non-Goals

### Goals

1. **Semantic Quality 측정**: 의미 보존, 유사도, 일관성 평가
2. **Advanced Metrics 도입**: [여기에 당신의 기술 목록을 추가하세요]
3. **Plugin Architecture**: 새로운 품질 측정 기법을 쉽게 추가
4. **Progressive Enhancement**: 기존 시스템을 해치지 않고 점진적 개선
5. **Cost Control**: Feature Flag로 비용 제어 가능

### Non-Goals

- 기존 규칙 기반 시스템 대체 (보완만 할 것)
- 실시간 처리 요구 (배치 처리로 충분)
- 100% 자동화된 품질 판단 (사람의 최종 검토 필요)

---

## Design (Flags, Fallbacks, Data flows)

### Architecture Overview

```
┌─────────────────────────────────────┐
│   Quality Orchestrator              │
│   (scripts/quality/orchestrator.ts) │
└──────────────┬──────────────────────┘
               │
       ┌───────┴────────┐
       │                │
       ▼                ▼
┌─────────────┐  ┌──────────────────┐
│ Rule-Based  │  │ Advanced Checkers│
│ Checker     │  │ (Feature Flagged)│
│ (Always On) │  │                  │
└─────────────┘  └──────────────────┘
       │                │
       └────────┬───────┘
                ▼
    ┌───────────────────────┐
    │  baseline_report.json │
    └───────────────────────┘
```

### 1. Multi-View Embedding (다중 뷰포인트 임베딩)

**설명:**
원본 청크를 다양한 관점(뷰포인트)으로 변환하여 여러 임베딩 벡터를 생성하고, 모든 벡터가 하나의 원본 청크를 가리키도록 하는 기법. 검색 증거(Evidence)를 확장하여 검색 정확도를 향상시킴.

**적용 방식 (QA 품질):**

- QA 쌍에서 질문을 여러 패러프레이즈로 변환
- 각 패러프레이즈를 임베딩하여 다중 검색 경로 생성
- 답변의 Evidence와의 매칭률 향상

**Feature Flag:**

```bash
FEATURE_QUALITY_MULTIVIEW_EMBEDDING=false  # default off
```

**구현:**

```typescript
// scripts/quality/checkers/multiview-embedding-checker.ts
export class MultiViewEmbeddingChecker implements QualityChecker {
  name = "multiview-embedding";
  version = "1.0.0";

  async check(qaPairs: QAPair[]): Promise<QualityMetric[]> {
    const results = await Promise.all(
      qaPairs.map(async (qa) => {
        // 1. 질문을 다양한 뷰포인트로 변환
        const viewpoints = await this.generateViewpoints(qa.question);

        // 2. 각 뷰포인트 임베딩
        const embeddings = await this.embedder.embed(viewpoints);

        // 3. Evidence와의 유사도 계산
        const alignmentScores = embeddings.map((emb) =>
          this.computeAlignment(emb, qa.evidence),
        );

        // 4. 최대 정렬 점수 반환
        return Math.max(...alignmentScores);
      }),
    );

    return [
      {
        dimension: "multiview_alignment",
        score: average(results),
        confidence: 0.9,
        evidence: results,
      },
    ];
  }
}
```

**Fallback:**

- Feature Flag off 시 건너뜀
- 임베딩 API 실패 시 규칙 기반 체커로 폴백
- 타임아웃(5초) 시 기본 점수 0.5 반환

---

### 2. Query-Side Embedding (쿼리 사이드 임베딩)

**설명:**
문서를 그대로 임베딩하는 대신, LLM을 사용하여 "문서에서 사용자가 할 만한 질문, 중요한 제목, 키워드"를 추출하여 임베딩하는 방식. 쿼리와 도큐먼트 간의 거리를 줄여 검색 정확도 향상.

**적용 방식 (QA 품질):**

- 답변에서 가능한 질문들을 역으로 생성
- 실제 질문과 생성된 질문들의 유사도 측정
- 질문-답변 정합성 평가

**Feature Flag:**

```bash
FEATURE_QUALITY_QUERYSIDE_EMBEDDING=false  # default off
```

**구현:**

```typescript
// scripts/quality/checkers/queryside-embedding-checker.ts
export class QuerySideEmbeddingChecker implements QualityChecker {
  name = "queryside-embedding";
  version = "1.0.0";

  async check(qaPairs: QAPair[]): Promise<QualityMetric[]> {
    const results = await Promise.all(
      qaPairs.map(async (qa) => {
        // 1. 답변으로부터 가능한 질문 생성
        const generatedQuestions = await this.llm.generateQuestions(qa.answer);

        // 2. 실제 질문과 생성된 질문들 임베딩
        const [actualEmb, ...generatedEmbs] = await this.embedder.embed([
          qa.question,
          ...generatedQuestions,
        ]);

        // 3. 유사도 계산
        const similarities = generatedEmbs.map((emb) =>
          this.cosineSimilarity(actualEmb, emb),
        );

        return Math.max(...similarities);
      }),
    );

    return [
      {
        dimension: "queryside_alignment",
        score: average(results),
        confidence: 0.85,
        evidence: results,
      },
    ];
  }
}
```

**Fallback:**

- LLM 호출 실패 시 단순 키워드 매칭으로 폴백
- 비용 한도 초과 시 자동 비활성화
- 결과 캐싱으로 중복 호출 방지

---

### 3. Translation-Based Embedding (번역 기반 임베딩)

**설명:**
한글 문서의 복잡성(한문, 한글, 영어 혼재)을 해결하기 위해 LLM으로 문서를 영어로 번역한 뒤 임베딩. 추상화가 잘 되어 검색 향상.

**적용 방식 (QA 품질):**

- 한글 QA를 영어로 번역
- 번역된 버전의 임베딩과 원본 임베딩 비교
- 다국어 품질 일관성 측정

**Feature Flag:**

```bash
FEATURE_QUALITY_TRANSLATION_EMBEDDING=false  # default off
```

**구현:**

```typescript
// scripts/quality/checkers/translation-embedding-checker.ts
export class TranslationEmbeddingChecker implements QualityChecker {
  name = "translation-embedding";
  version = "1.0.0";

  async check(qaPairs: QAPair[]): Promise<QualityMetric[]> {
    const results = await Promise.all(
      qaPairs.map(async (qa) => {
        // 1. 한글 → 영어 번역
        const translatedQ = await this.llm.translate(qa.question, "en");
        const translatedA = await this.llm.translate(qa.answer, "en");

        // 2. 원본 및 번역본 임베딩
        const [origQEmb, origAEmb, transQEmb, transAEmb] =
          await this.embedder.embed([
            qa.question,
            qa.answer,
            translatedQ,
            translatedA,
          ]);

        // 3. 일관성 측정
        const qConsistency = this.cosineSimilarity(origQEmb, transQEmb);
        const aConsistency = this.cosineSimilarity(origAEmb, transAEmb);

        return (qConsistency + aConsistency) / 2;
      }),
    );

    return [
      {
        dimension: "translation_consistency",
        score: average(results),
        confidence: 0.8,
        evidence: results,
      },
    ];
  }
}
```

**Fallback:**

- 번역 API 실패 시 원본만 사용
- 한글 전용 임베딩 모델로 대체 가능
- 비용 절감 모드: 샘플링만 번역

---

### 4. Hybrid Search (Vector + BM25)

**설명:**
임베딩 벡터 검색과 렉시컬 검색(단어 기반)을 병행하는 하이브리드 검색. 법률/구매 문서 등 명확한 단어 매칭이 중요한 경우 Elasticsearch(BM25) 계열 필수.

**적용 방식 (QA 품질):**

- 질문-답변 간 키워드 매칭 (BM25)
- 의미적 유사도 (Vector)
- 두 점수의 가중 평균으로 최종 정렬 점수 산출

**Feature Flag:**

```bash
FEATURE_QUALITY_HYBRID_SEARCH=false  # default off
```

**구현:**

```typescript
// scripts/quality/checkers/hybrid-search-checker.ts
export class HybridSearchChecker implements QualityChecker {
  name = "hybrid-search";
  version = "1.0.0";

  async check(qaPairs: QAPair[]): Promise<QualityMetric[]> {
    const results = await Promise.all(
      qaPairs.map(async (qa) => {
        // 1. BM25 스코어 (렉시컬)
        const bm25Score = this.calculateBM25(qa.question, qa.answer);

        // 2. 벡터 유사도 (시맨틱)
        const vectorScore = await this.calculateVectorSimilarity(
          qa.question,
          qa.answer,
        );

        // 3. 하이브리드 스코어 (가중 평균)
        const alpha = 0.7; // 벡터 가중치
        const hybridScore = alpha * vectorScore + (1 - alpha) * bm25Score;

        return hybridScore;
      }),
    );

    return [
      {
        dimension: "hybrid_search_alignment",
        score: average(results),
        confidence: 0.95,
        evidence: results,
      },
    ];
  }

  private calculateBM25(query: string, doc: string): number {
    // BM25 알고리즘 구현
    const k1 = 1.5,
      b = 0.75;
    const queryTerms = this.tokenize(query);
    const docTerms = this.tokenize(doc);
    // ... BM25 계산
  }
}
```

**Fallback:**

- BM25 계산 실패 시 단순 TF-IDF 사용
- 벡터 검색 실패 시 BM25만 사용
- 둘 다 실패 시 규칙 기반으로 폴백

---

### 5. Ragas-Based Evaluation (다단계 평가 시스템)

**설명:**
Ragas 오픈소스 툴을 활용한 3단계 평가 시스템:

1. Context Recall/Precision (검색 품질)
2. Groundness (컨텍스트 기반 여부)
3. Faithfulness (사실 충실도)

**적용 방식 (QA 품질):**

- 답변이 제공된 Evidence에 얼마나 기반하는지 측정
- Hallucination 검출
- 종합 품질 점수 산출

**Feature Flag:**

```bash
FEATURE_QUALITY_RAGAS_EVAL=false  # default off
```

**구현:**

```typescript
// scripts/quality/checkers/ragas-evaluation-checker.ts
import { Ragas } from "ragas"; // 가상의 라이브러리

export class RagasEvaluationChecker implements QualityChecker {
  name = "ragas-evaluation";
  version = "1.0.0";

  async check(qaPairs: QAPair[]): Promise<QualityMetric[]> {
    const ragas = new Ragas();

    const results = await Promise.all(
      qaPairs.map(async (qa) => {
        // 1. Context Recall (정보량 충실도)
        const contextRecall = await ragas.contextRecall(
          qa.question,
          qa.evidence,
        );

        // 2. Context Precision (검색 정확도)
        const contextPrecision = await ragas.contextPrecision(
          qa.question,
          qa.evidence,
        );

        // 3. Groundness (컨텍스트 기반)
        const groundness = await ragas.groundness(qa.answer, qa.evidence);

        // 4. Faithfulness (사실 충실도)
        const faithfulness = await ragas.faithfulness(qa.answer, qa.evidence);

        // 종합 점수
        return {
          contextRecall,
          contextPrecision,
          groundness,
          faithfulness,
          overall:
            (contextRecall + contextPrecision + groundness + faithfulness) / 4,
        };
      }),
    );

    return [
      {
        dimension: "ragas_context_recall",
        score: average(results.map((r) => r.contextRecall)),
        confidence: 0.95,
      },
      {
        dimension: "ragas_groundness",
        score: average(results.map((r) => r.groundness)),
        confidence: 0.95,
      },
      {
        dimension: "ragas_overall",
        score: average(results.map((r) => r.overall)),
        confidence: 0.95,
      },
    ];
  }
}
```

**Fallback:**

- Ragas 라이브러리 없으면 자체 구현 휴리스틱 사용
- LLM 기반 평가 실패 시 규칙 기반 검증
- 점진적 degradation: 일부 메트릭만 실패해도 나머지는 정상 진행

---

## Compatibility & Rollback

### Backward Compatibility

- ✅ 기존 baseline_report 포맷 유지 (신규 필드 추가만)
- ✅ Feature Flag off 시 기존 동작 100% 재현
- ✅ 기존 CI/CD 파이프라인 영향 없음

### Rollback Strategy

```bash
# 즉시 롤백
FEATURE_QUALITY_ALL=false npm run quality:assess

# 점진적 롤백
FEATURE_QUALITY_[이름1]=false
FEATURE_QUALITY_[이름2]=true  # 하나씩 테스트
```

### Data Migration

- 신규 메트릭은 별도 필드에 저장
- 기존 메트릭과 충돌 없음
- 버전 관리: `quality.version: "2.0"`

---

## Risks & Mitigations

| Risk            | Probability | Impact | Mitigation                    |
| --------------- | ----------- | ------ | ----------------------------- |
| **높은 비용**   | Medium      | High   | Feature Flag + 예산 한도 설정 |
| **성능 저하**   | Low         | Medium | 비동기 처리 + 캐싱            |
| **정확도 이슈** | Medium      | High   | A/B 테스트 + Fallback         |
| **의존성 증가** | Low         | Medium | Plugin 격리 + 독립 실행 가능  |
| **기술 부채**   | Medium      | Medium | 문서화 + 정기 리뷰            |

---

## Test Plan (Smoke payloads, metrics)

### Unit Tests

```typescript
// tests/quality/advanced-checkers.test.ts
describe('[기술이름]Checker', () => {
  it('should measure semantic quality', async () => {
    const checker = new [기술이름]Checker();
    const result = await checker.check(sampleQAPairs);

    expect(result.score).toBeGreaterThan(0.8);
    expect(result.confidence).toBeGreaterThan(0.9);
  });
});
```

### Integration Tests

- baseline_report에 정상 통합 확인
- Feature Flag on/off 동작 검증
- Fallback 메커니즘 테스트

### Performance Benchmarks

- 처리 시간: < 5초 per 100 QA pairs
- 메모리 사용: < 500MB
- API 비용: < $0.10 per 1000 QA pairs

### Smoke Payloads

```json
// apps/fe-web/dev/runs/quality-enhancement-smoke.json
{
  "mode": "quality-assessment",
  "features": {
    "FEATURE_QUALITY_[이름1]": true,
    "FEATURE_QUALITY_[이름2]": false
  },
  "payload": {
    "qaPairs": [...],
    "expected": {
      "overall_score": ">= 0.85",
      "violations": "< 5"
    }
  }
}
```

---

## Rollout Plan

### Phase 1: Experimental (Week 1-2)

- Feature Flag: ALL=false (수동 테스트만)
- 대상: 개발 환경
- 목표: 기능 검증, 성능 측정

### Phase 2: Canary (Week 3)

- Feature Flag: 10% 활성화
- 대상: 내부 QA 데이터 일부
- 목표: 실제 데이터로 검증

### Phase 3: Staged Rollout (Week 4)

- 25% → 50% → 100% 점진적 확대
- 목표: 전체 시스템 적용

### Phase 4: Monitoring (Ongoing)

- 메트릭 모니터링
- 비용 추적
- 품질 지표 개선 확인

---

## Metrics & Success Criteria

### Success Metrics

**Phase 1: 규칙 기반 (기준선)**

- [ ] Guideline compliance score: 80% → 90%
- [ ] Evidence-answer alignment: 17.9% → 40% (규칙 기반)

**Phase 2: 고급 기술 (선택적)**

- [ ] Multi-View Embedding: Evidence alignment 40% → 60%
- [ ] Query-Side Embedding: Question-Answer coherence 70% → 85%
- [ ] Hybrid Search: Overall alignment 50% → 75%
- [ ] Ragas Evaluation:
  - Context Recall: ≥ 0.8
  - Groundness: ≥ 0.85
  - Faithfulness: ≥ 0.9

**비용 목표:**

- [ ] 기본 규칙 기반: $0 (로컬 처리)
- [ ] 고급 기술 (모두 활성화): < $0.10 per 100 QA pairs

### Monitoring

```typescript
// 대시보드에 표시될 메트릭
{
  "quality_enhancement": {
    "enabled_features": ["semantic", "..."],
    "overall_improvement": "+12.5%",
    "cost_per_qa": "$0.003",
    "processing_time": "2.3s/100pairs"
  }
}
```

---

## Implementation Checklist

### Week 1

- [ ] Domain models 정의 (scripts/quality/models/)
- [ ] Plugin registry 구현
- [ ] Feature Flag 시스템 통합

### Week 2

- [ ] [기술1] Checker 구현
- [ ] [기술2] Checker 구현
- [ ] Unit tests 작성

### Week 3

- [ ] baseline_report 통합
- [ ] CI/CD 파이프라인 추가
- [ ] Integration tests

### Week 4

- [ ] 문서화
- [ ] Rollout 시작
- [ ] 모니터링 대시보드

---

## References

- Guideline: `docs/guidelines/qa-generation-guidelines.md`
- Architecture: `docs/technical_architecture_guide.md`
- Integration Map: `docs/technical/INTEGRATION_MAP.md`
- Existing Quality System: `scripts/metrics/baseline_report_generator.ts`

---

## Appendix: 기술별 상세 명세

### F. A/B Test → MetricRegistry 자동 연동 스펙 (Phase 4)

**목적:**
A/B 테스트 결과가 MetricRegistry와 Gate 임계치에 자동 반영되어, 시스템이 스스로 품질 기준을 진화시킬 수 있도록 함.

**데이터 구조:**

```typescript
// reports/quality/ab-tests/v1.0-v1.1/result.json
interface ABTestResult {
  testId: string;
  timestamp: string;
  versionA: {
    version: string;
    metrics: QualityMetrics;
  };
  versionB: {
    version: string;
    metrics: QualityMetrics;
  };
  delta: {
    guideline_compliance: number; // -0.05 ~ +0.05
    retrieval_quality: number;
    semantic_quality: number;
  };
  winner: "A" | "B" | "NEUTRAL";
  confidence: number; // 0~1 (통계적 유의성)
  recommendation: {
    action: "승격" | "보류" | "롤백";
    reason: string;
    target_metric?: string;
    suggested_threshold?: number;
  };
}

// scripts/metrics/metric-registry.ts
export function applyABTestResults(result: ABTestResult): void {
  const auditLog: AuditEntry[] = [];

  // 1. 승격 판정 조건
  if (result.winner === "B" && result.confidence > 0.8) {
    // 2. 임계치 자동 조정 (10% 완화)
    for (const [metric, delta] of Object.entries(result.delta)) {
      if (delta > 0.05) {
        // 5% 이상 개선 시
        const registry = getMetricRegistry();
        const currentThreshold = registry.getThreshold(metric);
        const newThreshold = currentThreshold * (1 + delta * 0.1);

        registry.updateThreshold(metric, newThreshold);

        auditLog.push({
          type: "threshold_adjustment",
          source: "ABTest",
          testId: result.testId,
          metric: metric,
          oldThreshold: currentThreshold,
          newThreshold: newThreshold,
          delta: delta,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // 3. Audit Log 기록
  appendToFile("reports/quality/ab-tests/audit.jsonl", auditLog);

  // 4. Governance 알림
  notifyGovernance({
    event: "ab_test_threshold_update",
    testId: result.testId,
    changes: auditLog.length,
    recommendation: result.recommendation,
  });
}
```

**실행 흐름:**

```
1. A/B Test 실행 (Phase 4)
   ↓
2. result.json 생성
   ↓
3. scripts/quality/process-ab-results.ts (자동 실행)
   ↓
4. applyABTestResults() 호출
   ↓
5. MetricRegistry 업데이트
   ↓
6. 다음 Gate 평가 시 신규 임계치 적용
```

**안전장치:**

- **Confidence Threshold**: 통계적 유의성 0.8 이상만 반영
- **Delta Limit**: 임계치 변경폭 10% 제한
- **Rollback Policy**: 3회 연속 실패 시 자동 롤백
- **Human Approval**: P0 메트릭 변경 시 승인 필요

**Cost:**

- $0 (결과 분석은 로컬 처리)

---

### A. Multi-View Embedding - Detailed Specification

**Input:**

```typescript
interface MultiViewInput {
  question: string;
  answer: string;
  evidence: string[];
}
```

**Output:**

```typescript
interface MultiViewOutput {
  score: number; // 0~1
  viewpoints: string[];
  alignmentScores: number[];
  bestViewpoint: string;
}
```

**Algorithm:**

1. 원본 질문을 3~5개의 패러프레이즈로 변환 (LLM 사용)
2. 각 패러프레이즈를 임베딩 (Sentence Transformer)
3. Evidence 임베딩과 코사인 유사도 계산
4. 최대 유사도를 최종 점수로 반환

**Dependencies:**

- `@huggingface/transformers` (v4.x): 임베딩 모델
- `sentence-transformers/paraphrase-multilingual-mpnet-base-v2`: 다국어 임베딩

**Cost Estimate:**

- LLM 호출 (패러프레이즈): $0.0002 per QA
- 임베딩: 로컬 (무료)

---

### B. Query-Side Embedding - Detailed Specification

**Input:**

```typescript
interface QuerySideInput {
  answer: string;
  actualQuestion: string;
}
```

**Output:**

```typescript
interface QuerySideOutput {
  score: number; // 0~1
  generatedQuestions: string[];
  similarities: number[];
}
```

**Algorithm:**

1. 답변으로부터 가능한 질문 3~5개 생성 (LLM)
2. 실제 질문 + 생성된 질문들 모두 임베딩
3. 실제 질문과 각 생성 질문의 유사도 계산
4. 최대 유사도 반환

**Dependencies:**

- Anthropic Claude API (질문 생성)
- 임베딩 모델 (Multi-View와 동일)

**Cost Estimate:**

- LLM 호출: $0.0003 per QA
- 임베딩: 로컬 (무료)

---

### C. Hybrid Search - Detailed Specification

**Input:**

```typescript
interface HybridSearchInput {
  query: string;
  document: string;
}
```

**Output:**

```typescript
interface HybridSearchOutput {
  bm25Score: number;
  vectorScore: number;
  hybridScore: number; // 최종 점수
  alpha: number; // 가중치
}
```

**Algorithm:**

1. BM25 스코어 계산:
   - TF: 단어 빈도
   - IDF: 역문서 빈도
   - 문서 길이 정규화
2. 벡터 유사도 계산:
   - 쿼리/문서 임베딩
   - 코사인 유사도
3. 하이브리드 스코어 = α _ vector + (1-α) _ bm25

**Dependencies:**

- 없음 (순수 구현)

**Cost Estimate:**

- $0 (로컬 처리)

---

### D. Ragas Evaluation - Detailed Specification

**Input:**

```typescript
interface RagasInput {
  question: string;
  answer: string;
  evidence: string[];
  groundTruth?: string;
}
```

**Output:**

```typescript
interface RagasOutput {
  contextRecall: number; // 0~1
  contextPrecision: number; // 0~1
  groundness: number; // 0~1
  faithfulness: number; // 0~1
  overall: number; // 평균
}
```

**Algorithm:**

1. Context Recall: Evidence가 답변에 필요한 정보를 모두 포함하는지
2. Context Precision: Evidence 중 실제 사용된 비율
3. Groundness: 답변이 Evidence에 기반하는지 (LLM 판단)
4. Faithfulness: 답변이 사실에 충실한지 (LLM 판단)

**Dependencies:**

- `ragas` (Python 라이브러리를 TypeScript로 포팅 필요)
- 또는 자체 구현

**Cost Estimate:**

- LLM 호출 (Groundness/Faithfulness): $0.0005 per QA
- Context 메트릭: $0 (로컬)

---

### E. 비용 최적화 전략

**캐싱:**

```typescript
// 동일 질문/답변에 대한 중복 계산 방지
const cache = new Map<string, QualityMetric[]>();

async check(qaPairs: QAPair[]): Promise<QualityMetric[]> {
  const cacheKey = this.generateKey(qaPairs);
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  const results = await this.computeMetrics(qaPairs);
  cache.set(cacheKey, results, { ttl: 3600 }); // 1시간
  return results;
}
```

**배치 처리:**

```typescript
// 100개씩 묶어서 처리 (API 효율)
const batches = chunk(qaPairs, 100);
const results = await Promise.all(
  batches.map((batch) => this.processBatch(batch)),
);
```

**샘플링:**

```typescript
// 전체가 아닌 샘플만 고급 기술 적용
if (process.env.QUALITY_SAMPLING_RATE) {
  const rate = parseFloat(process.env.QUALITY_SAMPLING_RATE);
  const samples = qaPairs.filter(() => Math.random() < rate);
  return this.check(samples);
}
```

---

## Approval

- [ ] Technical Review: @[reviewer]
- [ ] Cost Approval: @[budget-owner]
- [ ] Security Review: @[security-team]
- [ ] Ready for Implementation: @[lead-engineer]

---

## 📝 RAW INPUT SECTION (여기에 자유롭게 복붙하세요)

**사용 방법:**

1. 아래 구분선 사이에 준비하신 기술 내용을 그냥 복붙하세요
2. 형식, 구조 신경 쓰지 마세요
3. 저장하시면 제가 알아서 파싱해서 위 섹션들에 정리합니다

**복붙 형식 예시:**

```
기술1: Semantic Similarity
- 설명: 임베딩을 사용해서 의미 유사도 측정
- 장점: 패러프레이즈 감지 가능
- 단점: 비용이 좀 듦

기술2: LLM Judge
- GPT-4로 품질 평가
- 자연스러움 점수 매김
```

위처럼 아무렇게나 작성하셔도 됩니다!

---

### ⬇️ 여기 아래에 복붙하세요 ⬇️

```

# RAG 시스템 개발 기술 참고 문서 (서치독 접근 방식 기반)

RAG 시스템의 정확도는 **인덱싱 타임**과 **검색 타임**을 확장하고 정교화하는 방식으로 개선해야 함.

### 1. 인덱싱 타임(Indexing Time) 파이프라인 확장

#### A. 청킹 및 문서 증거 확장
*   **최적 청킹:** **사람이 섹션이나 특정 큰 정보 주체를 보는 것과 가장 유사하게 청킹**하는 것이 검색 품질에 가장 좋음.
*   **피처(Feature) 확장:** 검색 정확도를 높이기 위해 임베딩 벡터 외에 **증거(Evidence)**를 늘려야 함 (검색 회사들은 수천 개의 증거를 사용함).
*   **다중 뷰포인트 임베딩:** 원본 청크를 다른 뷰포인트로 뜯어내어 또 다른 임베딩 벡터를 만들고, 이 벡터들이 하나의 원본 청크를 가리키도록 하는 **트릭**을 통해 증거를 확장할 수 있음.

#### B. 검색 정확도 개선을 위한 임베딩 기법 (단기 개선 권장)
1.  **추상화를 위한 번역 임베딩:** 한글 문서의 복잡성(한문, 한글, 영어 혼재)을 해결하기 위해 **LLM을 사용하여 문서를 영어로 번역**한 뒤 임베딩 값을 구하면 추상화가 잘 되어 검색이 향상될 수 있음.
2.  **쿼리 사이드 임베딩:** 문서를 그대로 임베딩하는 대신, LLM을 사용하여 **문서에서 사용자가 할 만한 질문, 중요한 제목, 키워드**를 뽑아내어 **그것들을 임베딩**하고 저장하는 방식. 이 방식은 도큐먼트를 **쿼리 사이드로 바꿔서** 쿼리와 도큐먼트 간의 거리를 줄이는 효과가 있음.

### 2. 검색 타임(Search Time) 및 엔진 선택

*   **하이브리드 검색:** 임베딩 벡터 검색뿐만 아니라 **렉시컬 검색(단어 기반 검색)**을 병행하는 하이브리드 검색 방식을 반드시 사용해야 함.
*   **엘라스틱 서치(Elasticsearch) 계열 권장:** 법률, 구매 문서와 같이 명확한 단어 검색이 중요한 기업 문서의 경우, 벡터 DB의 한계가 명확하므로 **BM25 수식**이 작동하는 **엘라스틱 서치/오픈 서치(Lucene 엔진 기반)** 계열이 정답임. 순수 벡터 DB만으로는 기업 문서의 검색 문제가 잘 풀리지 않았던 경험이 있음.

### 3. 이미지 문서 처리
*   **VLM (Vision-Language Model)** 모델을 사용하여 이미지에서 **메타성 정보**를 추출함.
*   검색 결과가 이미지와 관련될 경우, 청크 안에 이미지 레이어의 **레퍼런스(Reference)**를 제공하여 최종 답변에 참고하도록 처리함 (메타성 처리).

---

## III. RAG 시스템 평가 방법론 (스코어링)

단순 키워드 카운트(TF 형식) 기반의 스코어링은 의미가 없으며, **Ragas(라가스)**와 같은 오픈 소스 툴을 활용한 다단계 평가 시스템이 필요함.

### 1. 다단계 평가 지표 (Three Taps)
| 단계 | 평가 목적 | 주요 지표 |
| :--- | :--- | :--- |
| **1단계: 에이전트 선택** | 질문에 가장 적합한 에이전트(RAG, 컨플루언스 등)가 선택되었는지 평가. | 클래시피케이션 (Classification) |
| **2단계: 검색 성능 (Retrieval)** | 검색된 본문 문서(Context)의 질 평가. | **Context Recall** (정보량 충실도) 및 **Context Precision** (검색된 정보의 정답 관련 비율) |
| **3단계: 최종 결과 생성** | 생성된 답변이 얼마나 정확하고 근거에 충실한지 평가. | **Groundness** (제공된 컨텍스트에 기반하고 있는지) 및 **Faithfulness** (사실에 충실한지) |

---

## IV. LLM 운영 및 효율성 고려 사항

### 1. K값 조절 및 레이턴시
*   검색 품질(Retrieval)이 좋아지면, 가져오는 문서의 수(**K값**)를 줄여야 함.
*   K값이 줄면 LLM 입력 프롬프트 길이가 짧아져 **비용, 성능, 레이턴시** 모두에 긍정적인 영향을 미치므로, K값 조절 실험이 중요함.

### 2. 모델 선택 및 구축형 모델의 한계
*   현재 오픈AI 및 KT 클라우드 상품 모델(카나, 솔라프 2, 엑사원 미드)을 연결하여 비교 중.
*   **경험적으로 GPT 계열 모델이 성능이 더 잘 나오는 경향**이 있음.
*   **폐쇄망 구축형 모델의 한계:** 구축형 모델은 개발자 시간을 지속적으로 소모시키고, 모델 업데이트가 느리거나 불가하여 기술 발전 속도를 따라가지 못함 (3개월 단위로 모델 업데이트가 일어남).
*   **보안 이슈 설득:** 보안 규정을 준수하면서 퍼블릭 클라우드 LLM을 사용하는 것이 가능하며, 최근 금융법 개정 사례 등을 들어 고객에게 보안 우려가 설득 가능한 영역임을 인지시켜야 한다고 조언함.

---












```

### ⬆️ 여기 위에 복붙하세요 ⬆️

---
