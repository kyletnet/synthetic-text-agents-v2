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

## P2 — 베이스라인 확보 & 품질 측정 루프 (이전 Step A)

### 🎯 목표

- 같은 입력에 대해 ±5% 이내 변동으로 재현 가능한 베이스라인 확보
- 원클릭 측정 루프: 데이터 로딩 → API 호출 → 스키마 검증 → 지표 산출 → 보고서

### 🛠️ 해야 할 일

- baseline 런 목표 확정:
  ./run_v3.sh baseline --smoke | --full --budget … --profile stage
- 골드셋/시드/메트릭 정의: tests/regression/\* 재구성 (정확도/비용/지연 + v1.5 지표)
- 리포트 표준화: reports/baseline_report.{jsonl,md} 생성, session_report와 상호 링크
- 스케줄링: PR 시 smoke / daily stage full / weekly 요약(10~20줄)

### 🧩 에이전트 적용 (내부 경량 MA, v1.5 지표와 직결)

- Evidence Extractor → Answer Generator → Audit Agent 체인
- Budget Guardian (예산 가드·케이스 단가 추적)
- Retry Router (재시도·대체 모델 라우팅)
- Diversity Planner (질문 유형 분포·중복도 관리)

### 🔑 주안점

- macOS/BSD 차이 흡수(이미 P1 기반)
- 데이터/지표 명세 ADR로 고정, baseline_config.json 단일 소스 유지

### ✅ DoD

- ./run_v3.sh baseline … 실행 시 보고서/요약 자동 생성
- 재현성 ±5% 충족, CI에 baseline smoke/스키마 검증 Required

---

## P3 — 웹뷰/운영 콘솔 (P2 직후 착수)

### 🎯 목표

- 브라우저에서 베이스라인/세션 리포트를 직관적으로 조회·관리

### 🛠️ 해야 할 일

- index.html 초기 프로토타입
  - 최근 실행 카드(상태/비용/지연/PASS-FAIL)
  - 실행 상세(표준 필드 45+, 로그 링크, 재시도 버튼)
  - 베이스라인 대시보드(점수/비용/지연 트렌드, ±5% 뱃지)
  - 회귀 미니셋 결과 테이블
- 필요 시 경량 서버 + 권한/필터/다운로드

### 🧩 외부 플랫폼 파일럿 연계

- 옵션 A: Google Vertex Agent Engine + A2A (세션/메모리/평가 내장)
- 옵션 B: AWS Bedrock Agents/AgentCore (감독자-작업자, 코드 실행, RAG 내장)
- Port/Adapter 패턴으로 외부 호출부 모듈화 → 락인 회피

### ✅ DoD

- 브라우저에서 최근 실행 → 상세 리포트 → 베이스라인 비교가 동작
- 표준 리포트 데이터 소스와 100% 동일

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

- 2025-09-19: commit 1204475 – preflight v1.5+ verified; taxonomy pinned; observability checker integrated
- 2025-09-19: Terminology 정책 고정(P2~P5 vs STEP_1~7), Agent v2 통합, observability/gating 연계. Commit: 4a4dc2e
- 2025-09-17: Added PRODUCT_PLAN (P2~P5 + agent strategy v2 integrated). Commit: 0682ae0
