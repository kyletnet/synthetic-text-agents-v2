# Phase 6: 탐정모드 하드닝 (Detective Mode Hardening)

**일자:** 2025-10-11
**기간:** 2주 (10일 작업일)
**목표:** 잔여 리스크 4가지 정밀 교정 → 진짜 '원 오브 원' 완성

---

## 🎯 Executive Summary

Phase 5에서 **모든 성능 목표를 초과 달성**했으나, **4가지 잔여 리스크**가 남아있습니다.
Phase 6에서는 이를 정밀 교정하여 **프로덕션 완전 강건화**를 달성합니다.

### 🔍 잔여 리스크 (4가지)

| 리스크 | 현재 상태 | 목표 | 우선순위 |
|--------|----------|------|----------|
| **1. Gate B/D/E 낮음** | 40% | 70-90% | P0 |
| **2. OOV 법률 용어** | 0% | 50%+ | P1 |
| **3. 버전/한영 혼합** | 50% | 80%+ | P1 |
| **4. Mock 혼합 인덱스** | 혼합 | Pure Vision | P2 |

---

## 📋 Phase 6 액션 플랜 (7가지)

### A. 평가·거버넌스 정밀화 (2일)

#### 1️⃣ LLM-based RAGAS 샘플링 (20%) - P0
**목적:** 휴리스틱 RAGAS 한계 극복, Gate B/D/E 40% → 70-90% 개선

**방법:**
- GPT-4 또는 Claude를 사용한 실제 품질 평가
- 20% 샘플링 (비용 최소화)
- 오프라인 배치 (야간 운용)

**메트릭:**
- Context Recall (Gate B)
- Context Precision (Gate D)
- Answer Relevance (Gate E)
- Answer Faithfulness (Gate G)

**구현:**
```typescript
// src/evaluation/ragas/llm-ragas-evaluator.ts
interface LLMRAGASConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  samplingRate: number; // 0.2 for 20%
  batchSize: number;
  timeout: number;
}

class LLMRAGASEvaluator {
  async evaluate(input: RAGASInput): Promise<RAGASResult> {
    // LLM-Judge로 Context Recall/Precision/Relevance/Faithfulness 평가
  }
}
```

**스크립트:**
```bash
# 실행
LLM_RAGAS_PROVIDER=anthropic \\
LLM_RAGAS_MODEL=claude-3-5-sonnet-20241022 \\
LLM_RAGAS_SAMPLING_RATE=0.2 \\
npx tsx scripts/run-llm-ragas-benchmark.ts

# 결과
reports/ragas/llm-ragas-phase6.json
```

**성공 기준:**
- ✅ Gate B (Context Recall): ≥ 70%
- ✅ Gate D (Context Precision): ≥ 75%
- ✅ Gate E (Answer Relevance): ≥ 85%
- ✅ Gate G (Answer Faithfulness): ≥ 90%

**예산:** $5-10 (20% 샘플링 × 100 queries)

---

#### 2️⃣ IR Metrics 병행 (NDCG, mAP, F1@K, MRR) - P1
**목적:** 휴리스틱 한계 상쇄, 0원 리트리벌 척도

**메트릭:**
- **NDCG@K:** Normalized Discounted Cumulative Gain (순위 고려)
- **mAP@K:** Mean Average Precision (정밀도 평균)
- **F1@K:** Precision + Recall 조화 평균
- **MRR:** Mean Reciprocal Rank (첫 정답 위치)

**구현:**
```typescript
// src/evaluation/ir/ir-metrics.ts
interface IRMetrics {
  ndcg: number;   // Normalized DCG
  map: number;    // Mean Average Precision
  f1: number;     // F1 Score
  mrr: number;    // Mean Reciprocal Rank
}

class IRMetricsEvaluator {
  evaluate(results: SearchResult[], groundTruth: string[]): IRMetrics {
    // NDCG, mAP, F1, MRR 계산
  }
}
```

**스크립트:**
```bash
npx tsx scripts/run-ir-benchmark.ts
# 결과: reports/ir/phase6-ir-metrics.json
```

**성공 기준:**
- ✅ NDCG@5 ≥ 0.7
- ✅ mAP@5 ≥ 0.6
- ✅ F1@5 ≥ 0.65
- ✅ MRR ≥ 0.75

---

### B. 검색 품질 튜닝 (3일)

#### 3️⃣ RRF/가중치 그리드서치 - P1
**목적:** Elastic:FAISS 가중치 최적화, Gate B/D +10-15pp 개선

**파라미터:**
- `k` (RRF constant): [30, 60, 90] (현재 60)
- `elasticWeight`: [0.4, 0.5, 0.6, 0.7]
- `faissWeight`: [0.3, 0.5, 0.6] (= 1 - elasticWeight)
- `topKElastic`: [300, 500, 1000]
- `topKFAISS`: [200, 400, 600]

**Grid Search:**
- 총 조합: 3 × 4 × 3 × 3 = 108개
- 샘플링: 20 queries × 108 = 2,160 searches
- 예상 시간: ~30분

**구현:**
```typescript
// scripts/rrf-grid-search.ts
interface RRFConfig {
  k: number;
  elasticWeight: number;
  faissWeight: number;
  topKElastic: number;
  topKFAISS: number;
}

async function gridSearch(
  configs: RRFConfig[],
  queries: TestQuery[]
): Promise<RRFConfig> {
  // Best config 찾기
}
```

**스크립트:**
```bash
npx tsx scripts/rrf-grid-search.ts \\
  --queries reports/hybrid-benchmark/real-benchmark-ragas.json \\
  --output reports/rrf/best-config.json
```

**성공 기준:**
- ✅ Gate B +10pp (40% → 50%)
- ✅ Gate D +15pp (40% → 55%)
- ✅ Latency 변화 < 20%

---

#### 4️⃣ Context-Aware Subtree Retrieval - P2
**목적:** 매칭 청크 주변 서브트리 자동 첨부, Recall 안정화

**전략:**
- Section 청크 → 상위 Section 제목 첨부
- Table 청크 → Table 헤더/캡션 첨부
- Paragraph 청크 → 주변 ±1 문단 첨부

**구현:**
```typescript
// src/infrastructure/retrieval/hybrid/subtree-retriever.ts
class SubtreeRetriever {
  async enrichContext(
    matchedChunks: RankedResult[]
  ): Promise<RankedResult[]> {
    // 매칭 청크 주변 서브트리 첨부
    // Section → 상위 제목
    // Table → 헤더/캡션
    // Paragraph → ±1 문단
  }
}
```

**성공 기준:**
- ✅ Long-Form 질의 Recall +20%
- ✅ Table-Only 질의 100% 유지
- ✅ Token 증가 < 30%

---

### C. OOV/혼합언어/버전 충돌 대응 (3일)

#### 5️⃣ OOV Fallback 전략 - P1
**목적:** 도메인 외 전문 용어 처리, OOV 0% → 50%+

**전략:**
1. **Nori 사용자 사전 추가**
   - 법률 용어: "긴급돌봄", "질병감염아동" 등
   - 구매 용어: "종합형", "기관연계" 등

2. **동의어 사전**
   - "아이돌봄" ↔ "돌봄서비스"
   - "맞벌이" ↔ "취업가구"

3. **영문 표기 변형표**
   - "COVID-19" → "코로나19"
   - "emergency" → "긴급"

4. **Confidence Fallback**
   - Confidence < 0.3 → "문서에 해당 정보가 없습니다"

**구현:**
```typescript
// configs/elasticsearch/nori-user-dict.txt
긴급돌봄
질병감염아동
종합형
기관연계

// configs/elasticsearch/synonyms.txt
아이돌봄, 돌봄서비스
맞벌이, 취업가구
COVID-19, 코로나19
```

**Elasticsearch 설정:**
```json
{
  "settings": {
    "analysis": {
      "analyzer": {
        "korean_analyzer": {
          "type": "custom",
          "tokenizer": "nori_tokenizer",
          "filter": ["nori_user_dict", "synonym_filter"]
        }
      },
      "filter": {
        "nori_user_dict": {
          "type": "nori_user_dictionary",
          "path": "nori-user-dict.txt"
        },
        "synonym_filter": {
          "type": "synonym",
          "synonyms_path": "synonyms.txt"
        }
      }
    }
  }
}
```

**성공 기준:**
- ✅ OOV Legal Terms: 0% → 50%+
- ✅ Korean/English Mixed: 50% → 80%+

---

#### 6️⃣ ko/en 혼합 및 버전 충돌 방지 - P1
**목적:** 문서 버전/개정판 충돌 방지, 한영 혼합 질의 처리

**전략:**
1. **문서 메타필드 색인**
   ```json
   {
     "year": 2024,
     "revision": "2024-03-15",
     "jurisdiction": "전국",
     "documentType": "guideline"
   }
   ```

2. **쿼리 전처리**
   - "2023년 vs 2024년" → `year:2024` 필터 추가
   - "최신판" → `sort: revision DESC`

3. **구판 히트 시 경고**
   - Gate R (Provenance) 연동
   - "이 정보는 2023년 기준입니다" 배지

**구현:**
```typescript
// src/infrastructure/retrieval/hybrid/query-preprocessor.ts
class QueryPreprocessor {
  preprocess(query: string): ProcessedQuery {
    // 연도 추출 → year 필터
    // "최신판" 감지 → revision sort
    // ko/en 혼합 → normalize
  }
}
```

**성공 기준:**
- ✅ Version Conflict: 50% → 80%+
- ✅ Latest Document Hit Rate: ≥ 95%

---

### D. 데이터·인덱스 정리 (2일)

#### 7️⃣ Pure Vision 재색인 (Mock 제거) - P2
**목적:** Mock 데이터 제거, 평가 왜곡 방지

**현재 상태:**
- Real Vision chunks: 16개
- Mock fallback: 5개
- **혼합 비율:** 76% Vision / 24% Mock

**조치:**
1. Mock 데이터 완전 제거
2. Pure Vision chunks만 색인
3. 전체 벤치마크 재실행

**스크립트:**
```bash
# Mock 제거
npx tsx scripts/remove-mock-data.ts

# Pure Vision 재색인
USE_REAL_CLIENTS=true \\
PURE_VISION_ONLY=true \\
npx tsx scripts/real-hybrid-benchmark.ts

# 결과
reports/hybrid-benchmark/pure-vision-benchmark.json
```

**성공 기준:**
- ✅ Gate B/D/E 자연 상승 (40% → 70%+)
- ✅ Mock 데이터 0%

---

## 🧪 검증 절차 (반나절 자동 루틴)

### 1. 실벤치
```bash
USE_REAL_CLIENTS=true npx tsx scripts/real-hybrid-benchmark.ts
```
**체크:**
- p50/p95 < 200ms
- Recall/Precision ≥ 70%
- Groundedness ≥ 90%
- token/QA ≤ 300

### 2. IR Metrics
```bash
npx tsx scripts/run-ir-benchmark.ts
```
**체크:**
- NDCG@5 ≥ 0.7
- mAP@5 ≥ 0.6
- F1@5 ≥ 0.65
- MRR ≥ 0.75

### 3. LLM RAGAS 샘플
```bash
LLM_RAGAS_SAMPLING_RATE=0.2 npx tsx scripts/run-llm-ragas-benchmark.ts
```
**체크:**
- Context Recall ≥ 70%
- Context Precision ≥ 75%
- Answer Relevance ≥ 85%
- Answer Faithfulness ≥ 90%

### 4. Adversarial (강화판)
```bash
npx tsx scripts/run-adversarial-suite.ts
```
**체크:**
- OOV: 0% → 50%+
- ko-en: 50% → 80%+
- Version: 50% → 80%+
- Overall: ≥ 80%

### 5. Gate System
```bash
npx tsx scripts/audit/full-audit.ts
```
**체크:**
- Gate 실패율 < 5%
- Gate B/D/E ≥ 70%
- Gate F/G = 100%

**Gate Freeze:**
- 실패율 > 5% → 배포 중단, 알림

---

## 📊 Phase 6 성공 기준

| 메트릭 | Phase 5 | Phase 6 목표 | 우선순위 |
|--------|---------|-------------|----------|
| **Gate B (Recall)** | 40% | **70%+** | P0 |
| **Gate D (Precision)** | 40% | **75%+** | P0 |
| **Gate E (Relevance)** | 40% | **85%+** | P0 |
| **Gate G (Faithfulness)** | 100% | **90%+** | P0 |
| **OOV Pass Rate** | 0% | **50%+** | P1 |
| **Version Conflict** | 50% | **80%+** | P1 |
| **ko/en Mixed** | 50% | **80%+** | P1 |
| **Adversarial Overall** | 75% | **80%+** | P1 |
| **NDCG@5** | N/A | **≥ 0.7** | P2 |
| **mAP@5** | N/A | **≥ 0.6** | P2 |
| **Latency p50** | 18.18ms | **< 25ms** | P2 |
| **Token/QA** | 229 | **< 300** | P2 |

---

## 📅 2주 일정 (10일 작업일)

### Week 1: 평가·거버넌스 + 검색 품질

| Day | 작업 | 산출물 |
|-----|------|--------|
| **D1** | LLM-based RAGAS 구현 | `src/evaluation/ragas/llm-ragas-evaluator.ts` |
| **D2** | LLM RAGAS 벤치마크 실행 | `reports/ragas/llm-ragas-phase6.json` |
| **D3** | IR Metrics 구현 | `src/evaluation/ir/ir-metrics.ts` |
| **D4** | RRF 그리드서치 스크립트 | `scripts/rrf-grid-search.ts` |
| **D5** | RRF 그리드서치 실행 + 최적 설정 | `reports/rrf/best-config.json` |

### Week 2: OOV/혼합언어 + Pure Vision

| Day | 작업 | 산출물 |
|-----|------|--------|
| **D6** | Nori 사전 + 동의어 설정 | `configs/elasticsearch/nori-user-dict.txt` |
| **D7** | Query Preprocessor 구현 | `src/infrastructure/retrieval/hybrid/query-preprocessor.ts` |
| **D8** | Pure Vision 재색인 | `reports/hybrid-benchmark/pure-vision-benchmark.json` |
| **D9** | 전체 시스템 재검증 | `reports/phase6-validation.json` |
| **D10** | Phase 6 완료 리포트 | `PHASE_6_COMPLETE_REPORT.md` |

---

## 🚨 리스크 & 완화 전략

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|----------|
| **LLM RAGAS 비용 초과** | High | 20% 샘플링, 야간 배치, 캐싱 |
| **RRF 그리드서치 시간 초과** | Medium | 20 queries 샘플링, 병렬 실행 |
| **Nori 사전 효과 미미** | Medium | Fallback: BM25 boost, Query expansion |
| **Pure Vision 데이터 부족** | Low | 추가 Vision 분석 (pages 11-20) |
| **Latency 증가** | Medium | Subtree Retrieval 선택적 적용 |

---

## 🎯 Go/No-Go 기준

### ✅ GO (프로덕션 배포 승인)

**필수 조건 (All Pass):**
- ✅ Gate B/D/E ≥ 70%
- ✅ Gate G ≥ 90%
- ✅ Adversarial Overall ≥ 80%
- ✅ OOV Pass Rate ≥ 50%
- ✅ Latency p50 < 25ms
- ✅ Gate 실패율 < 5%

**권장 조건:**
- ✅ NDCG@5 ≥ 0.7
- ✅ mAP@5 ≥ 0.6
- ✅ Version/ko-en ≥ 80%

### ❌ NO-GO (추가 개선 필요)

**어느 하나라도 실패 시:**
- ❌ Gate B/D/E < 60%
- ❌ Gate G < 80%
- ❌ Adversarial < 70%
- ❌ Latency p50 > 50ms
- ❌ Gate 실패율 > 10%

---

## 📁 산출물

### 코드
- `src/evaluation/ragas/llm-ragas-evaluator.ts`
- `src/evaluation/ir/ir-metrics.ts`
- `src/infrastructure/retrieval/hybrid/query-preprocessor.ts`
- `src/infrastructure/retrieval/hybrid/subtree-retriever.ts`
- `scripts/run-llm-ragas-benchmark.ts`
- `scripts/run-ir-benchmark.ts`
- `scripts/rrf-grid-search.ts`
- `scripts/remove-mock-data.ts`

### 설정
- `configs/elasticsearch/nori-user-dict.txt`
- `configs/elasticsearch/synonyms.txt`
- `configs/rrf/best-config.json`

### 리포트
- `reports/ragas/llm-ragas-phase6.json`
- `reports/ir/phase6-ir-metrics.json`
- `reports/rrf/best-config.json`
- `reports/hybrid-benchmark/pure-vision-benchmark.json`
- `reports/phase6-validation.json`
- `PHASE_6_COMPLETE_REPORT.md`

---

## 🔄 Elasticsearch 버전 정책

### 현재 버전
- **8.13.4** (PIN)
- nori + ICU 플러그인

### 업그레이드 정책
1. **Minor 업데이트 (8.14+):**
   - 전용 브랜치에서 성능 회귀 테스트
   - 플러그인 호환성 확인
   - Gate 시스템 통과 후 승격

2. **Major 업데이트 (9.x):**
   - Elastic Hybrid API 등 이점 분석
   - R&D 분기에서 실험
   - 안정성 확보 후 고려

3. **자동화:**
   - CI/CD에서 자동 성능 회귀 테스트
   - Gate 실패 시 업그레이드 중단

---

## 🎓 학습 목표

### Technical
- LLM-Judge를 사용한 품질 평가
- IR Metrics 이론 및 구현
- RRF 파라미터 튜닝
- Elasticsearch 사용자 사전/동의어 관리

### Process
- 2주 스프린트 관리
- Go/No-Go 의사결정
- 자동화된 검증 파이프라인

---

## 🚀 Next Steps

### Phase 7: Production Deployment (예정)
- CI/CD 파이프라인 구축
- 모니터링 대시보드 (Grafana)
- 알림 시스템 (Slack/Email)
- 롤백 프로시저
- 운영 매뉴얼

---

**작성자:** Claude Code
**일자:** 2025-10-11
**Phase:** 6 (Detective Mode Hardening)
**기간:** 2주 (10일 작업일)
**목표:** 잔여 리스크 4가지 → 0 (원 오브 원 완성)
