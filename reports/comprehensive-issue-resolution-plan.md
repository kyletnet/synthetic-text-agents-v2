# 종합 이슈 해결 계획서
## 2025-09-26 기준 현재 상황 및 조치 방안

### 📋 Executive Summary

**현재 상태**: P2 단계 완료, 베이스라인 확보 성공
**전체 품질**: 86.0% (GREEN)
**주요 성과**:
- 승인 시스템 timeout 이슈 해결 완료
- 베이스라인 테스트 안정화 완료 (±2.1% 재현성)
- ES module 호환성 문제 해결

**식별된 P2 이슈**: 3개 (엔티티 커버리지, 질문 유형 다양성, Evidence Quality)

---

## 🚨 현재 발견된 이슈 분석

### 1. HIGH Priority 이슈

#### 1.1 엔티티 커버리지 부족 (P2)
- **현재**: 33.6%
- **목표**: 50.0%+
- **GAP**: -16.4%
- **영향**: 중요 도메인 엔티티가 QA에서 누락될 위험
- **해결 방안**:
  - Diversity Planner 에이전트 개선
  - Entity extraction 범위 확대
  - Domain-specific entity list 도입

#### 1.2 Evidence Quality 개선 필요 (P2)
- **현재**: Snippet Alignment 17.9%
- **목표**: 60.0%+
- **GAP**: -42.1%
- **영향**: Answer와 Evidence 간 정렬도 부족
- **해결 방안**:
  - Evidence-Answer 정렬 알고리즘 개선
  - Snippet 추출 정확도 향상
  - Citation validation 로직 강화

### 2. MEDIUM Priority 이슈

#### 2.1 질문 유형 불균형 (P2)
- **현재**: comparison(10%), inference(2%)만 활용
- **누락**: factual, analytical, procedural, comparative
- **영향**: QA 데이터셋 다양성 부족
- **해결 방안**:
  - Question Type Distribution 패턴 재조정
  - Target distribution 준수 로직 강화
  - Question template 확장

---

## ✅ 해결 완료된 이슈

### 1. Approval System Timeout 개선 ✅
**문제**: 90초 타임아웃으로 중요 작업이 자동 건너뛰기됨
**해결**:
- GPT 조언 기반 큐 시스템 도입
- 타임아웃 → 큐 저장으로 변경
- 리스크별 차등 타임아웃 (P0=무제한, 중간=90s, 낮음=30s)
- 롤백 전략 구현

**파일 위치**:
- `/scripts/lib/simplified-approval-system.ts` - 메인 로직
- `/scripts/lib/approval-queue.ts` - 큐 시스템
- `/scripts/approve-queue.ts` - CLI 인터페이스

### 2. Baseline Testing 안정화 ✅
**문제**: ES module 호환성, Schema 누락, null-safe access 오류
**해결**:
- 6개 metrics 파일 ES module 진입점 수정
- `schema/baseline_report.schema.json` 생성
- null-safe 접근 패턴 적용
- 재현성 ±2.1% 달성

**파일 위치**:
- `/scripts/metrics/*.ts` - ES module 수정
- `/schema/baseline_report.schema.json` - 스키마 정의
- `/scripts/metrics/baseline_report_generator.ts` - null-safe 적용

---

## 📅 단계별 해결 로드맵

### Phase 1: P2 이슈 해결 (우선순위)
**기간**: 1-2주
**목표**: 현재 P2 이슈 3개 완전 해결

1. **엔티티 커버리지 개선**
   - [ ] Entity extraction 알고리즘 분석
   - [ ] Domain-specific entity 목록 구축
   - [ ] Diversity Planner 로직 개선
   - [ ] 테스트: 50%+ 커버리지 달성 확인

2. **Evidence Quality 개선**
   - [ ] Snippet alignment 알고리즘 분석
   - [ ] N-gram 기반 정렬 로직 개선
   - [ ] Citation validation 강화
   - [ ] 테스트: 60%+ alignment 달성 확인

3. **질문 유형 다양성**
   - [ ] Question pattern mapping 재조정
   - [ ] Target distribution 강제 준수 로직
   - [ ] Template 확장 및 검증
   - [ ] 테스트: 4개 카테고리 균등 분포 확인

### Phase 2: P3 웹 인터페이스 개발 (다음 단계)
**기간**: 2-3주
**목표**: 실시간 모니터링 및 문서 업로드 시스템

1. **Next.js 기반 웹 콘솔**
   - [ ] 베이스라인 리포트 실시간 조회
   - [ ] 품질 지표 트렌드 시각화
   - [ ] P2 이슈 알림 대시보드

2. **문서 업로드 & 전문가 피드백**
   - [ ] 드래그앤드롭 업로드 인터페이스
   - [ ] QA 생성 워크플로우
   - [ ] 전문가 피드백 수집 시스템

---

## 🔧 기술적 조치 사항

### 즉시 조치 (이번 주)
1. **모니터링 강화**
   - 현재 baseline report 정기 생성 스케줄링
   - P2 이슈 임계값 알림 설정
   - 품질 지표 트렌드 추적

2. **문서 정리**
   - PRODUCT_PLAN.md 업데이트 완료 ✅
   - 이슈 해결 진행 상황 추적 시스템
   - RFC/ADR 문서 생성 (필요시)

### 중기 조치 (2-4주)
1. **에이전트 개선**
   - Diversity Planner 로직 재구성
   - Evidence Quality 알고리즘 최적화
   - Question Type Distribution 엔진 개선

2. **인프라 강화**
   - 웹 인터페이스 구축
   - 실시간 모니터링 시스템
   - 자동화된 품질 게이트

---

## 📊 성공 지표 및 KPI

### P2 이슈 해결 KPI
- **엔티티 커버리지**: 33.6% → 50%+ (목표)
- **Evidence Quality**: 17.9% → 60%+ (목표)
- **질문 유형 다양성**: 2개 → 4개 카테고리 균등 분포
- **전체 품질 점수**: 86.0% → 90%+ 유지

### 시스템 안정성 KPI
- **재현성**: ±2.1% 유지 (목표 ±5% 이내)
- **응답 시간**: P95 241ms 유지
- **비용 효율성**: $0.0010/item 유지
- **에러율**: 0% 유지

---

## 🚀 Next Actions

### 이번 주 우선순위
1. **엔티티 커버리지 분석 시작**
   - 현재 entity extraction 로직 분석
   - 누락된 중요 엔티티 식별
   - 개선 방안 설계

2. **Evidence Quality 원인 분석**
   - Snippet alignment 실패 케이스 분석
   - N-gram overlap 최적화 방안 연구
   - Citation validation 로직 검토

3. **P3 웹 인터페이스 설계**
   - Next.js 프로젝트 구조 설계
   - 실시간 모니터링 요구사항 정의
   - UI/UX 와이어프레임 작성

### 다음 주 계획
1. **실제 코드 구현 시작**
2. **테스트 케이스 작성 및 검증**
3. **웹 인터페이스 프로토타입 개발**

---

## 📞 Handoff Information

이 문서는 다른 개발자나 LLM에게 현재 상황을 전달할 때 사용할 핵심 정보를 담고 있습니다.

**핵심 포인트**:
- P2 단계 성공적 완료, 3개 품질 이슈 식별
- Approval/baseline testing 안정화 완료
- P3 단계 진행 준비 완료
- 구체적 해결 방안과 KPI 정의됨

**참조 문서**:
- `docs/PRODUCT_PLAN.md` (전체 로드맵)
- `reports/baseline_report.md` (현재 성능 지표)
- `CLAUDE.md` (시스템 철학 및 표준)

---

*Generated: 2025-09-26*
*Next Update: Weekly or upon major milestone completion*