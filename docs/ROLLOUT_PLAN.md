# ROLLOUT & ROLLBACK PLAN — 점진 배포와 안전 복귀 전략

## 0) 목적/범위

- 기능 A~F(플래그 기반)를 **내부 → 옵트인 → 기본값** 순서로 안전하게 확장한다.
- 실패 시 **즉시 OFF** 및 **이전 Green Ledger 기준**으로 복원한다.
- Core I/O 불변, COMPATIBILITY/HITL/STRATEGY_PROFILE 규칙을 따른다.

## 1) 단계별 롤아웃 (Stages)

- Stage 0 — Internal (개발자/테스트 전용, N≲10)
- Stage 1 — Dogfood (내부 PM/운영, N≲30)
- Stage 2 — Opt-in Beta (희망 사용자, N≲100)
- Stage 3 — Default-On (신규 세션 기본 ON, 필요시 OFF 가능)
- Stage 4 — Full (전면 기본)
  각 스테이지는 **게이트 조건**을 충족하면 다음 단계로 승급한다.

## 2) 게이트 조건(Exit Criteria)

- 품질: PassRate Δ≥−2%p 유지, AvgScore Δ≥0, 상위 이슈율(예: hallucination) −30% 이상
- 성능: AvgLatency ≤ 프로파일 목표, p95 ≤ 목표 +10%
- 안정성: vetoedPct 비중 증가 없음, 에러/타임아웃 비율 ≤ 1%
- 운영성: 태그 제안 정밀도(수동 수정률) ≤ 30%
- 문서/테스트: TEST_PLAN의 해당 스위트 통과, FLAGS_WIRING/PLAN_super 반영 완료

## 3) 스테이지별 기능 토글 플랜

- Stage 0: B/E/F ON, C/D ON(내부만), A OFF
- Stage 1: B/E/F ON, C/D ON(로그 노출), A OFF
- Stage 2: B/E/F ON, C/D ON, A **Opt-in ON**
- Stage 3: B/E/F ON, C/D ON, A **Default ON (옵트아웃 가능)**
- Stage 4: 모든 기능 Default ON, 변화는 Decision/Run Log로 지속 기록
  Note: A(searchLite)는 **마지막**에 기본값 전환.

## 4) 모니터링/리포트 (일간)

- 지표: passRate, avgScore, avgLatency, vetoedPct, issuesTop3
- 분포: 난이도 분포(KL), 스타일 위반(건/샘플)
- 기능별: A on/off Latency Δ, B 프로파일별 veto 사유 분포
- 보고: `docs/RUN_LOGS/*`, `docs/LEDGER/*`, `outputs/dataset_meta.json` 링크를 SYSTEM_OVERVIEW에 집계

## 5) Go/No-Go Check (스테이지 전환 직전)

- [ ] TEST_PLAN 해당 스위트 통과
- [ ] 품질/성능 게이트 충족 (지난 3회 평균)
- [ ] 실패/사건(incident) 없는 48시간
- [ ] COMPATIBILITY/HITL/STRATEGY_PROFILE 변경분 반영
- [ ] 커뮤니케이션(릴리즈 노트) 배포 준비 완료

## 6) Rollback 절차 (Kill-Switch)

- 트리거: 지표 악화, 에러 폭증, 사용자 블로킹 리포트
- 즉시 조치:
  1. `feature.searchLite=false` 등 문제 기능 **OFF**
  2. `guardianProfileId="default"`로 복귀
  3. 직전 Green Ledger(승인된 Decision)로 **재현 실행**하여 결과 고정
- 기록: `docs/LEDGER/dec-YYYYMMDD-rollback-###.md` 템플릿으로 이유/영향/복원 포인트 남김
- 커뮤니케이션: 릴리즈 노트 템플릿에 "Rollback Notice" 섹션 포함

## 7) 위험/완화 (Risk Register)

| 위험        | 신호               | 완화                                |
| ----------- | ------------------ | ----------------------------------- |
| A 지연 증가 | AvgLatency Δ>+10%  | 요약 길이/개수 제한, 캐시, 즉시 OFF |
| D 과튜닝    | 자연스러움↓, 중복↑ | step 축소(±0.05), F=exploit로 전환  |
| E 과형식화  | 가독성↓            | styleStrictness −0.05, PM 태그 우선 |
| B 임계 과도 | Pass 급감          | 프로파일 완화, Fast 프리셋 제공     |
| C 과잉태깅  | 태그 혼잡          | 최대 2개 강제, 상반 태그 금지       |

## 8) 일정(예시)

- W1: Stage 0 (내부), 미니 벤치 N=30
- W2: Stage 1, Go/No-Go → Stage 2
- W3: Stage 2(Opt-in), A Opt-in 시작
- W4: Stage 3(Default-On), A 기본값 전환 후보
- W5: Stage 4(Full), 회고/표준화

## 9) 역할/책임 (RACI)

- PM(책임): Go/No-Go, 커뮤니케이션, 태그 정책
- 엔진(수행): 지표 수집, 플래그 배선, 롤백 실행
- QA(검토): TEST_PLAN 검증, 회귀 확인
- 오너(승인): Stage 승급 승인

## 10) 문서/PR 요구사항

- PR 템플릿의 Tests/Impact/Rollback 섹션 필수
- SYSTEM_OVERVIEW Quick Links 최신 3건 갱신
- Decision/Run Log 링크 포함, dataset_meta에 featureFlags/strategyHash 기록

## 11) 참고/링크

- PLAN_super.md, FE_MVP_SPEC.md, FLAGS_WIRING.md, TEST_PLAN.md, HITL_SPEC.md, STRATEGY_PROFILE.md
