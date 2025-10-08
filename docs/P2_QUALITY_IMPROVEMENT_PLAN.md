# P2 품질 개선 계획

**작성일**: 2025-10-07
**목표**: P3 웹뷰 개발 전 데이터 품질 확보

---

## 📊 현재 상태 (2025-10-02 Baseline)

```
Overall Quality: 81.5% ✅
Gate Status: PASS (DEV)
Items Analyzed: 3
```

---

## 🎯 개선 목표

| 지표               | 현재  | 목표       | 차이  | 우선순위  |
| ------------------ | ----- | ---------- | ----- | --------- |
| 엔티티 커버리지    | 46.7% | 50%+       | +3.3% | 🔥 HIGH   |
| Evidence Alignment | ~46%  | 60%+       | +14%  | 🔥 HIGH   |
| 질문 유형 분류     | null  | 4가지 균형 | N/A   | ⚠️ MEDIUM |

---

## 🔥 Issue 1: 엔티티 커버리지 개선 (46.7% → 50%+)

### 📝 문제 분석

**증상**:

- entity_coverage_score: 0.467 (46.7%)
- missing_entities: ["구이디", "건축에서의", "브루넬레스키나"]

**원인**:

- Diversity Planner가 엔티티 추출 범위가 좁음
- 중요 인명, 지명, 전문 용어 누락

### 🔧 해결 방안

**1. Diversity Planner 개선** (src/agents/diversityPlanner.ts)

```typescript
// 현재: 단순 키워드 추출
extractEntities(text: string) {
  // 개선 필요
}

// 개선: 고급 엔티티 인식
extractEntities(text: string) {
  // 1. 인명 패턴 강화 (한자 이름, 외국 이름)
  // 2. 지명 패턴 추가
  // 3. 전문 용어 사전 활용
  // 4. 복합어 처리 ("건축에서의" → "건축", "에서의")
}
```

**2. 엔티티 사전 구축**

```typescript
// src/agents/entity-dictionary.ts (신규)
export const ENTITY_PATTERNS = {
  person_names: /[가-힣]{2,4}|[A-Z][a-z]+/g,
  locations: /시칠리아|베네치아|밀라노/g,
  art_terms: /르네상스|고딕|유화|명암표현법/g,
};
```

**3. 테스트 추가**

```typescript
// tests/agents/diversity-planner.test.ts
test("엔티티 커버리지 50% 이상", () => {
  const result = diversityPlanner.plan(input);
  expect(result.entity_coverage).toBeGreaterThan(0.5);
});
```

### 📊 성공 지표

- [ ] entity_coverage_score ≥ 0.50
- [ ] missing_entities.length ≤ 3
- [ ] 100개 샘플 평균 커버리지 ≥ 50%

### ⏱️ 예상 소요

- 분석: 1시간
- 구현: 2-3시간
- 테스트: 1시간
- **총 4-5시간**

---

## 🔥 Issue 2: Evidence Alignment 개선 (~46% → 60%+)

### 📝 문제 분석

**증상**:

- alignment_score 분포: 26.9%, 52.3%, 59.0%
- 평균: ~46%

**원인**:

- Evidence와 Answer의 텍스트 정렬 알고리즘이 약함
- 의역/확장된 답변이 원본 Evidence와 매칭 안 됨

**예시**:

```
Evidence: "브루넬레스키나 도나텔로와 함께"
Answer: "마사초는 15세기 초 유행하던 국제고딕양식을 따르지 않았어요"
Alignment: 26.9% ❌ (너무 낮음)
```

### 🔧 해결 방안

**1. 정렬 알고리즘 개선** (src/scripts/metrics/evidenceQuality.ts)

```typescript
// 현재: 단순 문자열 유사도
function calculateAlignment(evidence, answer) {
  // 개선 필요
}

// 개선: 의미 기반 정렬
function calculateAlignment(evidence, answer) {
  // 1. 토큰 레벨 매칭 (형태소 분석)
  // 2. 동의어 고려
  // 3. 의역 탐지 (semantic similarity)
  // 4. 인용구 추출 및 직접 매칭
}
```

**2. Citation Quality 개선**

```typescript
// src/agents/qaGenerator.ts
// Answer 생성 시 Evidence를 더 직접적으로 인용하도록 유도

const prompt = `
Evidence를 최대한 직접 인용하세요.
원문: "${evidence}"
답변 예시: "문서에 따르면 '${직접인용}' 합니다."
`;
```

**3. 검증 로직 추가**

```typescript
// alignment_score가 낮으면 재생성
if (alignment_score < 0.5) {
  // 더 직접적인 인용 요청
  regenerateAnswer({ mode: "direct_quote" });
}
```

### 📊 성공 지표

- [ ] alignment_score 평균 ≥ 0.60
- [ ] alignment_score < 0.50인 항목 ≤ 20%
- [ ] 100개 샘플 평균 ≥ 60%

### ⏱️ 예상 소요

- 분석: 1시간
- 구현: 3-4시간
- 테스트: 1-2시간
- **총 5-7시간**

---

## ⚠️ Issue 3: 질문 유형 다양성 (null → 4가지 균형)

### 📝 문제 분석

**증상**:

- classified_type: null (모든 항목)
- qtype 분류기 미작동

**원인**:

- Question Type Distribution 모듈 비활성화 또는 오류
- 분류 로직 미구현

### 🔧 해결 방안

**1. QType 분류기 활성화** (src/scripts/metrics/qtypeDistribution.ts)

```typescript
// 현재: 항상 null 반환
classifyQuestionType(question: string) {
  return null; // ❌
}

// 개선: 실제 분류 로직
classifyQuestionType(question: string) {
  if (question.includes('왜')) return 'analytical';
  if (question.includes('어떻게')) return 'procedural';
  if (question.includes('차이')) return 'comparative';
  return 'factual';
}
```

**2. 패턴 기반 분류**

```typescript
const QTYPE_PATTERNS = {
  factual: /^(무엇|누가|언제|어디)/,
  analytical: /왜|이유|원인/,
  procedural: /어떻게|방법|과정/,
  comparative: /차이|비교|다른/,
};
```

**3. Diversity Planner 연동**

```typescript
// 질문 생성 시 유형 균형 유지
diversityPlanner.generateQuestions({
  target_distribution: {
    factual: 0.3,
    analytical: 0.3,
    procedural: 0.2,
    comparative: 0.2,
  },
});
```

### 📊 성공 지표

- [ ] classified_type ≠ null (100%)
- [ ] 4가지 유형 분포: 각 15-35%
- [ ] 유형 불균형 ≤ 20%

### ⏱️ 예상 소요

- 분석: 30분
- 구현: 2-3시간
- 테스트: 1시간
- **총 3.5-4.5시간**

---

## 📅 실행 계획

### Week 1 (현재 주)

**Day 1-2: Issue 1 (엔티티 커버리지)**

- [ ] Diversity Planner 분석
- [ ] 엔티티 추출 로직 개선
- [ ] 엔티티 사전 구축
- [ ] 테스트 및 검증

**Day 3-4: Issue 2 (Evidence Alignment)**

- [ ] 정렬 알고리즘 분석
- [ ] 의미 기반 매칭 구현
- [ ] Citation 품질 개선
- [ ] 테스트 및 검증

**Day 5: Issue 3 (질문 유형)**

- [ ] QType 분류기 활성화
- [ ] 패턴 기반 분류 구현
- [ ] Diversity Planner 연동
- [ ] 전체 통합 테스트

### Week 2 (다음 주)

**Day 1-2: 통합 검증**

- [ ] 100개 샘플 생성
- [ ] 전체 메트릭 측정
- [ ] Baseline 업데이트

**Day 3-4: P3 웹뷰 착수**

- [ ] Next.js 기본 구조
- [ ] Baseline 리포트 조회
- [ ] P2 메트릭 대시보드

---

## 🚨 리스크 & 대응

### Risk 1: 시간 부족

**영향**: 품질 개선 미완성
**확률**: Medium
**대응**: 우선순위대로 진행, Issue 1+2만 완료해도 OK

### Risk 2: 알고리즘 복잡도

**영향**: 구현 지연
**확률**: Medium
**대응**: 간단한 패턴 기반 → 점진적 개선

### Risk 3: 데이터 부족

**영향**: 테스트 샘플 부족
**확률**: Low
**대응**: 기존 seed 데이터 활용

---

## ✅ 완료 조건 (DoD)

- [ ] 엔티티 커버리지 ≥ 50%
- [ ] Evidence Alignment ≥ 60%
- [ ] 질문 유형 분류 작동 (4가지)
- [ ] 100개 샘플 테스트 통과
- [ ] Baseline 리포트 업데이트
- [ ] `/guard` (RG) PASS 유지

---

## 📚 참고 파일

- `src/agents/diversityPlanner.ts` - 엔티티 추출
- `src/scripts/metrics/evidenceQuality.ts` - 정렬 알고리즘
- `src/scripts/metrics/qtypeDistribution.ts` - 질문 유형 분류
- `src/agents/qaGenerator.ts` - QA 생성
- `reports/baseline_report.jsonl` - 현재 상태

---

**다음 단계**: Issue 1 (엔티티 커버리지) 개선부터 시작 🚀
