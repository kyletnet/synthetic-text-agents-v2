Title: 제품 개발 계획 (정밀 총합본)
Version: 2025-09-19
Commit: 1204475
Profile: stage

# 📑 제품 개발 계획 (정밀 총합본, 2025-09-17 기준)

## Terminology

    Roadmap phases: P2, P3, P4, P5  (제품 로드맵 전용)
    Execution pipeline: STEP_1_TYPESCRIPT … STEP_7_FULL_RUN  (리포트/로그/관측성 전용)
    혼용 금지. 생성기/리포트/관측성은 STEP_*, 계획서는 P2~P5만 사용.
    자세한 기준: CLAUDE.md의 "Taxonomy Owner & Canonical Map" 참고.

## P2 — 베이스라인 확보 & 품질 측정 루프 ✅ COMPLETED

### 🎯 목표 ✅

- 같은 입력에 대해 ±5% 이내 변동으로 재현 가능한 베이스라인 확보
- 원클릭 측정 루프: 데이터 로딩 → API 호출 → 스키마 검증 → 지표 산출 → 보고서

### 🛠️ 완료된 작업 ✅

- ✅ baseline 런 목표 확정: `npm run baseline:generate` 실행 가능
- ✅ 골드셋/시드/메트릭 정의: v1.5 지표 포함한 baseline_config.json 구성 완료
- ✅ 리포트 표준화: reports/baseline_report.{jsonl,md} 자동 생성, 스키마 검증 포함
- ✅ ES module 호환성 수정: 6개 metrics 파일의 entry point detection 수정
- ✅ 스키마 파일 생성: schema/baseline_report.schema.json 완전 구현

### 🧩 에이전트 적용 상태

- ✅ Evidence Extractor → Answer Generator → Audit Agent 체인 구현
- ✅ Budget Guardian 비용 추적 완료 ($0.0010/item, 총 $0.1000)
- ✅ Quality Auditor 86.0% 품질 점수 달성
- 🔄 Diversity Planner 개선 필요 (Question Type 불균형 감지)

### 🔑 주안점

- ✅ macOS/BSD 차이 흡수 완료
- ✅ baseline_config.json 단일 소스 유지
- ✅ 재현성 검증: ±2.1% deviation (목표 ±5% 충족)

### 📊 현재 시스템 성능 (2025-09-26 기준)

**전체 품질 점수**: 86.0% (GREEN)
**게이트 상태**: PASS (DEV 프로필)
**처리된 항목**: 100개
**총 비용**: $0.1000 (항목당 $0.0010)
**지연시간**: P50 202ms, P95 241ms

**주요 지표 현황**:
- 🔥 **P2 이슈**: 엔티티 커버리지 33.6% (목표 50.0%)
- ✅ PII/라이선스 위반: 0건
- ✅ 환각률: 0.00%
- ⚠️ 질문 유형 불균형: 4개 카테고리 중 2개만 활용

### ✅ DoD 달성 현황

- ✅ baseline 실행 시 보고서/요약 자동 생성
- ✅ 재현성 ±5% 충족 (실제 ±2.1%)
- ✅ 스키마 검증 Required 통과
- 📈 **다음 단계**: P3 웹뷰 개발로 진행 가능

---

## 🚨 현재 발견된 이슈 & 해결 계획 (2025-09-26)

### P2 급함 이슈 해결

**1. 엔티티 커버리지 개선 (33.6% → 50%+)**
- 문제: 중요 엔티티 커버리지가 목표치 미달
- 해결: Diversity Planner 에이전트 개선으로 엔티티 추출 범위 확대
- 우선순위: HIGH (P2)

**2. 질문 유형 다양성 확보**
- 문제: comparison(10%), inference(2%)만 활용, factual/analytical/procedural/comparative 누락
- 해결: Question Type Distribution 패턴 매핑 재조정
- 우선순위: MEDIUM (P2)

**3. Evidence Quality 개선**
- 문제: Snippet Alignment 17.9% (목표 60%+)
- 해결: Evidence-Answer 정렬 알고리즘 개선
- 우선순위: HIGH (P2)

### 즉시 조치 항목

1. **approval system timeout 개선 완료** ✅
   - GPT 조언 기반 큐 시스템 도입 완료
   - 타임아웃 시 건너뛰기 → 큐 저장으로 변경
   - 리스크별 차등 타임아웃 적용

2. **baseline testing 안정화 완료** ✅
   - ES module 호환성 수정
   - Schema 파일 생성 및 검증 로직 구현
   - 재현성 ±2.1% 달성

---

## P3 — 웹뷰/운영 콘솔 📋 NEXT PHASE

### 🎯 목표

- 브라우저에서 베이스라인/세션 리포트를 직관적으로 조회·관리
- **P2 이슈 해결을 위한 실시간 모니터링 대시보드 포함**

### 🛠️ 우선 해야 할 일

**Phase 3.1: 기본 웹 인터페이스**
- Next.js 기반 웹 콘솔 구축
  - 베이스라인 리포트 실시간 조회
  - 품질 지표 트렌드 시각화 (엔티티 커버리지, 질문 유형 분포)
  - P2 이슈 알림 및 해결 진행 상황 추적

**Phase 3.2: 문서 업로드 & 전문가 피드백**
- 드래그앤드롭 문서 업로드 인터페이스
- 전문가 피드백 수집 시스템
- QA 데이터셋 증강 워크플로우

### 🧩 외부 플랫폼 파일럿 연계

- 옵션 A: Google Vertex Agent Engine + A2A (세션/메모리/평가 내장)
- 옵션 B: AWS Bedrock Agents/AgentCore (감독자-작업자, 코드 실행, RAG 내장)
- Port/Adapter 패턴으로 외부 호출부 모듈화 → 락인 회피

### ✅ DoD

- 브라우저에서 최근 실행 → 상세 리포트 → 베이스라인 비교가 동작
- P2 이슈 실시간 모니터링 및 해결 진행 상황 추적
- 문서 업로드 → QA 생성 → 전문가 피드백 완전 워크플로우 동작

---

## P4 — 모듈 경계/계약 & SLO (이전 Step B)

### 🎯 목표

- 이후 멀티에이전트 전환을 위해 모듈 간 계약(Contract)과 SLO를 코드/테스트로 고정

### 🛠️ 해야 할 일

- JSON Schema/Zod로 모든 모듈 입출력 고정
- SLO (지연/성공률/비용) + 실패 코드/재시도 규약 명시
- 메시지 버스 전환 추상화 (큐/버스 기반 인터페이스 계층)
- 트레이스/감사: JSONL 스트림 + RUN_LOGS 연계
- Feature Flag/Canary/Rollback 기본 장착

### ✅ DoD

- 계약 테스트 100% 통과, 인터페이스 깨짐 0
- 카나리 릴리즈·롤백 스크립트 검증 완료

---

## P5 — 멀티에이전트 전환 & 프레임워크 파일럿 (이전 Step C)

### 🎯 목표

- 8-Agent Council 골격 도입, Anthropic Agents/AWS Agents 등 파일럿

### 🛠️ 해야 할 일

- 역할 매핑: Meta-Controller, Prompt Architect, QA Generator, Quality Auditor + Expert 4
- Dynamic Expert Summoning & Performance Guardian 구현
- 파일럿 1개 에이전트(Auditor 등)만 먼저 올려 평행 운용
- Feature Flag/Telemetry/Alerting 연동

### ✅ DoD

- 파일럿 결과/운영성 지표에서 정량 이득 확인
- Council 전 흐름에서 트레이스·SLO 알림 정상 동작

---

## 공통 운영 습관 (모든 단계)

- 한 줄 실행 패턴 유지 (./run_v3.sh <target> …)
- 세션 리포트 요약 블록 공유 (스크린샷 지양)
- ADR/RFC 문서화
- freeze+manifest로 데이터 안정성 보장
- SYSTEM_MAP.md 최신화 + handoff 문서 유지

---

## 빠뜨림 보강 체크 (기업 담당자 관점)

1. 안정성

- 백프레셔/드레인 절차, 완전 멱등성 (중복 과금 방지)
- 장애 주입 리허설(429/5xx 시나리오)

2. 보안/컴플라이언스

- PII 마스킹 훅은 P3 말에 넣기 (스키마 확정 후)
- 시크릿 스캐닝/Pre-commit/CI gates 계속 Required

3. 품질/성능 지표

- 정확도/비용/지연 외에 인용 품질 지표(citation_presence, snippet_alignment) Guardian 체크로 정의
- Baseline + WebView에서 뱃지/경고로 노출

4. 구매자 관점

- TCO/ROI 계산 쉽게: baseline_report + session_report에 비용 합산 필드 반영
- 벤더 락인 방지: JSON Schema 계약, Export 기능 내장 (reports/export)
- SLA 모니터링: P95 지연/성공률 로그화

---

## 운영 로드맵

- P2: Baseline 확보 (내부 경량 MA + v1.5 지표)
- P3: WebView + 외부 플랫폼 파일럿(AWS/Google)
- P4: 계약·SLO·트레이스 고정
- P5: 멀티에이전트 Council 파일럿
- 공통: Export API, Alert 튜닝, ADR/RFC, SYSTEM_MAP 최신화

---

## 에이전트 적용 전략 v2 (내부+외부 통합)

• 내부 경량 MA: Evidence → Answer → Audit + Budget/Retry/Diversity (baseline v1.5 지표 직결)
• 외부 플랫폼 파일럿(P3~): Vertex Agent Engine/Agentspace, Bedrock Agents/AgentCore
• 의사결정 기준: 보안/컴플라이언스, 연동성, 운영 편의, 상호운용(A2A/AgentCore), 비용·SLA
• 락인 회피: Port/Adapter, 필요 시 Vertex ↔ Bedrock ↔ LangGraph/AutoGen 전환
• 로드맵 연계: P2(지표 안정화) → P3(웹뷰·세션/평가 레일·파일럿1) → P4(계약/SLO/카나리) → P5(8-Agent Council, A2A/AgentCore)

---

## Changelog

- 2025-09-26: **P2 COMPLETED** - 베이스라인 확보 완료, 현재 시스템 성능 분석, P2 이슈 및 P3 계획 수립
  - 베이스라인 테스트 성공 (86.0% 품질, ±2.1% 재현성)
  - Approval system timeout 개선 완료 (큐 시스템 도입)
  - P2 이슈 발견: 엔티티 커버리지 33.6%, 질문 유형 불균형, Evidence Quality 17.9%
- 2025-09-19: commit 1204475 – preflight v1.5+ verified; taxonomy pinned; observability checker integrated
- 2025-09-19: Terminology 정책 고정(P2~P5 vs STEP_1~7), Agent v2 통합, observability/gating 연계. Commit: 4a4dc2e
- 2025-09-17: Added PRODUCT_PLAN (P2~P5 + agent strategy v2 integrated). Commit: 0682ae0
