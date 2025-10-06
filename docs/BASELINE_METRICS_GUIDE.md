# 베이스라인 평가 메트릭 가이드

## 개요

베이스라인 평가 시스템은 Q&A 데이터셋의 품질을 6개 핵심 영역에서 측정합니다. 각 메트릭은 실제 운영에서 중요한 품질 지표를 반영합니다.

## 📊 핵심 메트릭 상세 분석

### 1. Duplication Analysis (중복 분석)

**측정 내용**: Q&A 쌍 간의 중복도 검사

- **Duplication Rate**: 텍스트 기반 중복 비율
- **Semantic Duplication Rate**: 의미상 중복 비율 (LLM 판정)
- **High Similarity Pairs**: 높은 유사도 쌍 개수

**✅ 양호한 결과**: 중복률 < 10%
**⚠️ 주의 필요**: 중복률 10-15%
**❌ 문제 상황**: 중복률 > 15%

**의미**: 중복이 높으면 데이터셋의 다양성 부족, 훈련 효율성 저하

### 2. Question Type Distribution (질문 유형 분포)

**측정 내용**: 질문 유형의 균형성 분석

- **Factual**: 사실 확인 질문 (what, who, when)
- **Analytical**: 분석형 질문 (why, how, analyze)
- **Procedural**: 절차형 질문 (how to, steps)
- **Comparative**: 비교형 질문 (vs, difference)

**이상적인 분포**:

- Factual: 30%, Analytical: 30%, Procedural: 20%, Comparative: 20%

**Imbalance Score**: 1.0에 가까울수록 불균형 (나쁨)
**Missing Categories**: 빠진 질문 유형 개수

### 3. Coverage Analysis (커버리지 분석)

**측정 내용**: 소스 텍스트의 중요 정보 커버리지

- **Entity Coverage**: 핵심 개체 언급 비율
- **Section Coverage**: 텍스트 섹션 커버 비율
- **Overall Coverage Score**: 종합 커버리지 점수

**✅ 양호한 결과**: > 60%
**⚠️ 주의 필요**: 50-60%
**❌ 문제 상황**: < 50%

### 4. Evidence Quality Assessment (근거 품질 평가)

**측정 내용**: 답변과 근거의 정합성

- **Citation Presence**: 인용/근거 존재 비율
- **Snippet Alignment**: 답변-근거 텍스트 일치도
- **95th Percentile Alignment**: 상위 95% 일치도

**P0 임계점**: Evidence missing rate > 20% (치명적)
**P2 임계점**: Alignment < 60% (개선 필요)

### 5. Hallucination Detection (환각 현상 탐지)

**측정 내용**: 근거 없는 정보 생성 탐지

- **Hallucination Rate**: 전체 환각 비율
- **Risk Distribution**: 위험도별 분포 (low/medium/high)

**✅ 양호한 결과**: < 3%
**⚠️ 주의 필요**: 3-5%
**❌ 문제 상황**: > 5%

### 6. PII and License Compliance (개인정보/라이선스 준수)

**측정 내용**: 민감 정보 및 저작권 위반 검사

- **PII Violations**: 개인정보 노출 건수 (주민번호, 이메일 등)
- **License Violations**: 저작권 위험 키워드 건수

**P0 임계점**: 위반 건수 > 0 (즉시 차단)

## 🎯 종합 품질 점수 해석

### 현재 결과: 55.0% (❌ RED)

**점수 구간별 의미**:

- **90-100%**: 🟢 EXCELLENT - 운영 준비 완료
- **80-89%**: 🟢 GOOD - minor 개선 후 운영 가능
- **70-79%**: 🟡 ACCEPTABLE - 주요 개선 필요
- **60-69%**: 🟡 POOR - 상당한 개선 필요
- **< 60%**: 🔴 UNACCEPTABLE - 운영 불가

### 55% 점수의 구체적 문제점

1. **Evidence Missing (P0 위반)**: 100% 근거 누락

   - 원인: 변환 과정에서 evidence 필드 매핑 오류
   - 영향: 답변 신뢰도 검증 불가

2. **Coverage 0%**: 소스 텍스트 커버리지 부재

   - 원인: 한국어 엔터티 추출 시스템 미작동
   - 영향: 중요 정보 누락 여부 판단 불가

3. **Question Type Imbalance**: 4개 유형 중 2개만 존재
   - 원인: 평가 데이터의 질문 패턴 제한
   - 영향: 다양성 부족으로 편향된 학습

## 🚦 Gating 시스템 (진행 차단)

### Priority 등급별 차단 기준

**P0 (Critical)** - 즉시 차단:

- Evidence missing rate > 20%
- PII/License 위반 > 0건
- Cases total < minimum

**P1 (High)** - 운영 차단:

- Quality score < 75% (dev) / 80% (stage) / 85% (prod)
- Latency P95 > threshold

**P2 (Medium)** - 경고:

- Coverage < 50%
- Duplication > 10%

## 🔧 개선 방안

### 즉시 해결 (P0)

1. **Evidence 매핑 수정**: 변환 스크립트에서 context를 evidence로 올바르게 매핑
2. **스키마 검증**: 베이스라인 시스템의 스키마 파일 경로 수정

### 중장기 개선 (P1-P2)

1. **한국어 NLP 강화**: 엔터티 추출 및 커버리지 분석 개선
2. **질문 유형 다양화**: 평가 데이터에 더 다양한 질문 패턴 추가
3. **성능 최적화**: 응답 시간 개선

## 📈 웹뷰 시각화 요구사항

사용자가 이해하기 쉽도록 다음 요소들을 포함해야 합니다:

### 대시보드 구성

1. **종합 점수 게이지**: 55% with color coding
2. **메트릭별 상세 카드**: 각 6개 메트릭의 현재값, 임계값, 상태
3. **시간별 트렌드**: 이전 실행 결과와 비교 차트
4. **Alert 패널**: P0/P1/P2 위반 사항 우선순위별 표시
5. **개선 권고사항**: 각 문제별 구체적 해결 방안

### 상호작용 기능

- 각 메트릭 클릭 시 상세 분석 뷰
- Historical 데이터 비교 기능
- Export 기능 (PDF, CSV)
- Real-time 업데이트 (WebSocket 연결)

---

이 문서는 베이스라인 평가 시스템의 모든 메트릭을 이해하고 결과를 해석하는 완전한 가이드입니다.
