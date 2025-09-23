# SYSTEM OVERVIEW — Operations & Handover (Root)

> 이 문서는 **루트 인수인계 문서**입니다. 실행 현황과 운영 방법을 1장으로 파악할 수 있습니다.  
> 마지막 업데이트: <!-- 채우기 --> 2025-08-29 KST

## 0) 무엇을 하는 시스템인가?

- 멀티에이전트로 **QA 합성/증강 → 자동 심사 → 품질 게이트**를 수행
- 사람 피드백(HITL)을 받아 점차 **사람의 기대 품질에 수렴**하도록 반복 실행

## 1) 현재 상태 (Completed vs To-Extend)

| 영역        | 현재(Completed)                                                 | 확장 예정(To-Extend)           |
| ----------- | --------------------------------------------------------------- | ------------------------------ |
| 생성 엔진   | Meta→Prompt Architect→QA Generator **동작**                     | 문서 기반 템플릿 강화          |
| 품질 심사   | Quality Auditor **동작** (PASS/FAIL, 이슈 라벨)                 | 피드백 연동 가중치 튜닝        |
| 품질 게이트 | Performance Guardian **동작** (minScore 7.0, maxLatency 2000ms) | 태스크별 임계값 실험           |
| 입력 모드   | 골든셋 / 단일문서 주입 **가능**                                 | 검색-라이트 / 풀 RAG 슬롯      |
| 로그·리포트 | 결과 요약, 이슈 Top-3 **저장**                                  | Decision 카드 자동 초안·인덱스 |
| HITL        | 피드백 수용 프로세스 **정의**                                   | 자연어→태그 정규화 고도화      |
| 문서        | 5대 문서 뼈대 **존재**                                          | 루트 문서 링크 자동 갱신(선택) |

## 2) 운영 루프(7단계) — 비개발자용

1. **목표/가이드 작성**(난이도·금칙·톤)
2. 실행(자동): 생성 → 심사 → 게이트
3. **결과 확인**: 통과율/평점/이슈 Top-3
4. **피드백 작성**(자연어 한두 줄)
5. 반영(반자동): 태그화 → 전문가 소환/전략 조정 → Decision 카드 초안
6. 재실행(자동)
7. **승인 또는 재시도**

## 3) 운영 트리거(경고등)

| 항목               |    Green |       Amber |      Red | Red 시 권장 액션(자연어 예시)     |
| ------------------ | -------: | ----------: | -------: | --------------------------------- |
| PASS Rate          |    ≥ 80% |      70–79% |    < 70% | "난이도 조정/형식 강화 부탁"      |
| Avg Score          |    ≥ 7.5 |    7.0–7.49 |    < 7.0 | "근거 부족/모호—인용 강제·명료화" |
| Avg Latency        | ≤ 2000ms | 2001–2300ms | > 2300ms | "Guardian 지연 한도 재검토"       |
| Hallucination 비율 |     ≤ 5% |       5–10% |    > 10% | "근거 요구, factuality 가중 ↑"    |

## 4) 이번 주 해야 할 일 (주 1회, 30초)

- [ ] **"최근 3건 링크" 갱신** (아래 Quick Links에 최신 파일 3개를 연결)
- [ ] **Red 지표 발생 시** 피드백 한 줄 작성 → 다음 러닝 때 반영

## 5) Quick Links

**Latest Run Logs (3)**

- docs/RUN_LOGS/2025-08-30_run-001.md
- docs/RUN_LOGS/YYYY-MM-DD_run-002.md
- docs/RUN_LOGS/YYYY-MM-DD_run-003.md

**Latest Decision Cards (3)**

- docs/LEDGER/dec-20250830-001.md
- docs/LEDGER/dec-YYYYMMDD-002.md
- docs/LEDGER/dec-YYYYMMDD-003.md

**Planning Artifacts**

- docs/PLAN_super.md
- docs/FE_MVP_SPEC.md
- docs/FLAGS_WIRING.md
- docs/TEST_PLAN.md
- docs/ROLLOUT_PLAN.md
- docs/PLAN_rag_lite.md (optional)
- docs/PLAN_guardian_profiles.md (optional)

**Frontend & Integration**

- apps/fe-web/README.md
- docs/FE_WIRING_RUNBOOK.md

## 6) 데이터 계약(요약)

- 입력: seedQAs(골든셋), 선택적 doc/context, guidelines
- 출력: passed/failed, report(avgScore/passRate/vetoed), issues  
  자세한 스키마: [agent_implementation_spec.md](../agent_implementation_spec.md)

## 7) 문서 허브

- [system_blueprint.md](../system_blueprint.md)
- [agent_implementation_spec.md](../agent_implementation_spec.md)
- [technical_architecture_guide.md](../technical_architecture_guide.md)
- [claude_md_file.md](../claude_md_file.md)
- [final_documentation_strategy.md](../final_documentation_strategy.md)
- [RUN_LOGS/](./RUN_LOGS/README.md) · [LEDGER/](./LEDGER/README.md)

## 8) Strategy Profile — One-Page Summary (비개발자용)

**Why**: 실험할 때 "얼마나 조정이 안전한가"를 정한 규칙서. 과튜닝/품질하락/호환성 문제를 방지.  
**What**: 조정 가능한 키와 범위/디폴트, 언제 올리고/내리는지, 리스크, 관련 지표.  
**When**: 운영 리포트에서 Red/Amber 경고 → 피드백 후에도 개선 안 되면 **소폭 조정**.  
**Who**: 조정은 운영 오너가 승인, 실행은 개발/도구 담당이 수행, 결과는 Run Log·Ledger로 기록.  
**How**: 아래 표의 범위·스텝을 지키고, 한 번에 1~2개 노브만 변경 → 소규모(20~50) 재실행 → 비교.

| Key                        | Range / Default | 의미(무엇을 조정?)    | 언제 ↑ / ↓                                 | 리스크                    | 지표(확인)           |
| -------------------------- | --------------- | --------------------- | ------------------------------------------ | ------------------------- | -------------------- |
| architect.styleStrictness  | [0..1] / 0.5    | 스타일·톤 일치 엄격도 | ↑ 스타일 미스매치/용어 과다, ↓ 다양성 부족 | 과도 ↑ 시 표현 다양성↓    | Pass/Style 이슈율    |
| architect.citeRequired     | bool / false    | 문서/사실 인용 강제   | ↑ 근거 부족·추정발언                       | 속도↓, 자료 없으면 Fail↑  | Hallucination 이슈율 |
| auditor.weights.factuality | [0..2] / 1.0    | 사실성 가중치         | ↑ 근거 부족, ↓ 과도 보수                   | ↑ 시 Pass↓ 가능           | AvgScore/Fail 사유   |
| auditor.weights.format     | [0..2] / 1.0    | 형식/명료성 가중치    | ↑ 포맷/모호 이슈                           | 과형식화                  | Format 이슈율        |
| auditor.weights.difficulty | [0..2] / 1.0    | 난이도 평가 가중치    | ↑ 너무 쉬움, ↓ 너무 어려움                 | 목표 분포 이탈            | 난이도 분포          |
| guardian.minScore          | ≥7.0 / 7.0      | 품질 하한선           | ↑ 품질 바닥 끌어올림                       | Pass 급감                 | PassRate/Reject 사유 |
| guardian.maxLatency(ms)    | ≥0 / 2000       | 지연 상한선           | ↓ 지연 엄격, ↑ 실험관대                    | 과도↓ 시 좋은 샘플도 Drop | AvgLatency/Veto%     |
| generator.diversity        | [0..1] / 0.6    | 표현·내용 다양성      | ↑ 중복↑일 때, ↓ 일탈/헛소리                | 과도↑ 시 일탈↑            | 중복률/이슈율        |
| generator.negativeSampling | bool / true     | 중복 방지 샘플링      | ↑ (on) 중복 감소                           | 속도↓                     | 중복률               |

**Tuning 규칙(안전선)**

- 스텝: `±0.05~0.15` 이내. 한 번에 1~2개만 조정. 20~50 샘플로 미니 재실행 후 비교.
- 성공 기준(예): PassRate +5%p 이상 또는 Hallucination/Format 이슈 30%↓, AvgLatency 목표 내.
- 실패 시: 이전 Ledger-ID 기준 **즉시 롤백**(Run Log 링크 참고).

**자주 쓰는 조합 (예시)**

- Hallucination↑ → `citeRequired=true`, `factuality +0.15`, `minScore=max(현재,7.5)`
- Too Easy↑ → `difficulty +0.1`
- Jargon↑/Style 미스 → `styleStrictness +0.1`
- 모호/형식 이슈↑ → `format +0.1`
- Latency↑ → 생성 길이/컨텍스트 축소(가이드 수정), 필요 시 `maxLatency` 완화 테스트

자세한 정의와 주의사항은 **STRATEGY_PROFILE.md**를 참고.

## 9) Compatibility — One-Page Summary (비개발자용)

**Why**: 새 기능/리팩토링을 해도 기존 엔진이 깨지지 않게 하려면, 미리 정한 규칙이 필요합니다.  
**What**: 역호환 원칙, 플러그인(슬롯) 확장 방식, 기능 플래그, 버저닝·롤백 절차, 머지 전 체크리스트.  
**When**: 기능 아이디어가 생겼을 때, PR 열기 전에 이 섹션과 COMPATIBILITY.md를 먼저 확인합니다.  
**Who**: 제안자(PLAN) → 리뷰어(검토/위험) → 운영 오너(승인) → 구현자(코드) → 모두가 기록(로그/레저).

**How — 핵심 원칙 표**
| 원칙 | 요지 | 실무 규칙 |
|---|---|---|
| Backward-Compat | 기존 스키마/의미는 유지 | 새 필드는 **optional**; 제거/의미변경 금지(Deprecation 절차 필수) |
| Plugin Slots | 핵심 I/O를 건드리지 말고 옆에 꽂기 | Architect/Generator/Auditor/Guardian/Meta **injection point**로 어댑터 추가 |
| Feature Flags | 새 기능은 기본 OFF | gradual rollout(내부→옵트인→기본값), 즉시 OFF 가능해야 함 |
| Data Contract Versioning | 데이터/산출물 추적 | `dataset_meta.json`: {version, strategyHash, ledgerId, createdAt} |
| Rollback | 항상 안전하게 되돌릴 수 있어야 함 | 이전 버전 아티팩트/설정 유지, 레저 링크로 복원 경로 명시 |
| Test Gates | 깨짐 방지 | 계약/스키마 테스트, 호환성 스냅샷, 커버리지 임계 준수 |
| Migration Docs | 깨지는 변경이 불가피할 때 | 마이그레이션 가이드·스크립트·타임라인·리스크·롤백 포함 |
| Tracing Keys | 변경 추적 | 로그에 `ledgerId`, `strategyHash`, `featureFlags` 기록 |

**Merge 전 체크(요약)**

- [ ] 기존 I/O/스키마 안 깨짐(옵셔널 추가만)
- [ ] 새 기능은 플래그로 보호, 기본 OFF
- [ ] 테스트·벤치마크 통과, 롤백 경로 문서화
- [ ] COMPATIBILITY.md 체크리스트 통과, PLAN/REVIEW 링크 첨부

## 10) HITL — Feedback → Action Map (비개발자용)

**Why**: 사용자가 "너무 쉬움/근거 부족/용어 과다"처럼 말하면, 시스템이 **항상 같은 방식**으로 반응해야 품질이 오른다.  
**What**: 자연어 피드백 → **표준 태그**로 정규화 → 적절한 **전문가 소환**과 **전략 노브 조정**.  
**When**: 실행 리포트에 Red/Amber가 보이거나, 사람이 개선하고 싶을 때.  
**Who**: 사용자는 자연어로 말하면 되고, 시스템이 태그/조치 초안을 만들고 Decision 카드에 기록한다.

**How — 대표 매핑표**
| 문제(태그) | 소환 전문가 | 개입 지점 | 전략 조정(예) | 기대 효과 |
|---|---|---|---|---|
| hallucination (근거 부족) | Domain Consultant, Architect, Auditor | Architect+Auditor | `architect.citeRequired=true`, `auditor.weights.factuality +0.15`, `guardian.minScore ≥7.5` | 출처 요구·사실성↑ |
| too_easy | Cognitive Scientist | Architect | `auditor.weights.difficulty +0.1` | 난이도 상향 |
| overuse_jargon | Linguistics Engineer, Psychology Specialist | Architect | `architect.styleStrictness +0.1` | 가독성↑·전문용어↓ |
| ambiguous / format_issue | Linguistics Engineer, Auditor | Architect+Auditor | `auditor.weights.format +0.1` | 명료성·형식↑ |
| length_too_long | Architect, Guardian | Architect(+가이드) | 응답 길이 지침 축소, 필요 시 `guardian.maxLatency` 재검토 | 지연↓·불필요 장황함↓ |
| length_too_short | Architect | Architect | 길이 지침 확대, `styleStrictness` 소폭↓ | 정보량↑ |

**피드백 작성 예시(그대로 타이핑 OK)**

- "근거 부족. 인용 강제하고 사실성 가중 올려줘." → `hallucination` 매핑 적용
- "너무 쉬움. 상·중 난이도 섞어서 상향." → `too_easy` 매핑 적용

자세한 정의·예시·안티패턴은 **HITL_SPEC.md** 참고.
