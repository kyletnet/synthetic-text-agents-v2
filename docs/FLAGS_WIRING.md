# FLAGS WIRING — A~F 배선 설계 (UI ↔ 엔진 ↔ 문서)

## 1) 목적/범위
- 플래그 A~F가 **어디에 노출되고**, **무엇을 제어하며**, **어떤 데이터 키로 전달/기록**되는지 정의.
- Core I/O 불변. 모든 변경은 플러그인/플래그/옵셔널 필드로만.

## 2) 플래그 요약
| Flag | Key | Default | 노출 | 주입 지점 / 효과 | 리스크·가드 |
|---|---|---|---|---|---|
| A | feature.searchLite | false | 토글(beta) | Architect.beforePrompt → `plugins/searchLite` 요약 1~3개 주입 | 지연↑, 컨텍스트 오염 → 길이 제한, 즉시 OFF |
| B | feature.guardianProfiles | true | 셀렉트 | Guardian 임계 로딩(minScore/maxLatency) | Pass 급감→미니 벤치, 즉시 기본 프로파일 복귀 |
| C | feature.autoTagging | true | UI 비노출 | Auditor/Orchestrator가 태그 초안 제안 | 과잉 태깅 방지: 최대 2개 |
| D | feature.difficultyDistribution | true | UI 비노출 | Architect/Generator 난이도 타깃(예 3:4:3) | 자연스러움↓ → step 작게 |
| E | feature.styleGuard | true | 토글+룰파일 | Auditor 스타일/용어 룰 검사, Architect 스타일 지침 | 과형식화→step 작게, PM 태그 우선 |
| F | feature.mode | "exploit" | 탭 | Generator 프리셋(explore 다양성↑ / exploit 안정성↑) | 탐색 변동↑ → Guardian 보호 |

## 3) UI ↔ FE 저장 ↔ 엔진 전달 ↔ 로그/레저 매핑

### 공통 키(세션/로그)
- FE 저장: `session.config.json`
- FE→엔진: `run_request.flags`
- 엔진→FE: `run_result.metrics/issuesTop3/samples/links`
- 메타 기록: `outputs/dataset_meta.json` → `{ version, strategyHash, featureFlags, guardianProfileId, createdAt }`
- 레저(Decision 카드): Problem/Tag(s)/Experts/Knob Changes/Expected Effects

### A) searchLite (근거 강화)
- UI: `toggle-searchlite`
- FE 저장: `session.config.searchLite: boolean`
- run_request.flags: `feature.searchLite`
- 주입: Architect.beforePrompt → `plugins/searchLite` (요약 ≤3개)
- 로그: `dataset_meta.featureFlags.searchLite`
- 레저: Tag가 `hallucination`일 때 권장. Knob: `architect.citeRequired=true`, `auditor.weights.factuality +0.1`

### B) guardianProfiles (프로파일 임계)
- UI: `select-guardian (default|strict|fast)`
- FE 저장: `session.config.guardianProfileId`
- constraints: `{ minScore, maxLatency }`를 프로파일에서 유도
- run_request.flags: `feature.guardianProfiles=true`
- 로그: `dataset_meta.guardianProfileId`
- 레저: Guardian 사유/임계 변화 기록

### C) autoTagging (자동 태그 초안)
- UI: 비노출(칩으로만 표시) / 이벤트 `auto_tags_suggested`
- run_request.flags: `feature.autoTagging=true`
- 엔진: Auditor 이슈 분포→태그 후보(최대 2) 생성
- 로그: `run_result.suggestedTags`
- 레저: Tag 확정 후 Experts/Knobs 자동 초안

### D) difficultyDistribution (난이도 분포)
- UI: 비노출, 내부 타깃 3:4:3
- run_request.flags: `feature.difficultyDistribution=true`
- 엔진: Architect/Generator 샘플링 제약 + Auditor가 분포/KL 리포트
- 로그: `run_result.difficultyReport`
- 레저: 필요 시 `auditor.weights.difficulty ±step` 기록

### E) styleGuard (스타일/용어 가드)
- UI: `toggle-style-guard` + `upload-style-rules`
- FE 저장: `session.config.styleRulesPath`, (ON/OFF는 flags)
- run_request.flags: `feature.styleGuard`
- 엔진: Auditor 스타일 룰 검사, Architect 스타일 지침 강화
- 로그: `run_result.styleViolations[]`
- 레저: `architect.styleStrictness ±step`, `auditor.weights.format ±step`

### F) mode (탐색/수렴)
- UI: `tab-mode-explore|exploit`
- FE 저장: `session.config.mode`
- run_request.flags: `feature.mode`
- 엔진: Generator 프리셋(temperature/diversity 등) 선택
- 로그: `dataset_meta.featureFlags.mode`
- 레저: 모드 전환 이유·예상 효과 기록

## 4) 프리셋 매핑(요약)
- Strict: guardian=strict(7.5/2000), mode=exploit, styleGuard=ON, citeRequired=true
- Default: guardian=default(7.0/2000), mode=exploit, styleGuard=ON
- Fast: guardian=fast(7.0/1800), mode=explore, styleGuard=OFF

## 5) 이벤트 → 액션 브리지
- run_clicked → run_request({inputs, session.config, flags, constraints})
- feedback_submitted → autoTagging 제안 → tags_confirmed → Experts/Knobs 초안 → rerun_clicked
- rollback_clicked → 이전 Ledger/flags/overrides 복원

## 6) 테스트 훅(testIDs)
- `toggle-searchlite`, `select-guardian`, `tab-mode-explore`, `toggle-style-guard`, `btn-run`, `chip-tag-hallucination`, `btn-rerun`, `btn-rollback`

## 7) 실패/폴백
- 플래그 ON 실패 시 → 즉시 OFF + 기본 경로 실행
- 룰파일 파싱 실패 → styleGuard 자동 OFF, 경고 표시
- searchLite 타임아웃 → 주입 생략, 본문만 실행

## 8) 문서/PR 연결
- COMPATIBILITY 체크리스트 통과 필수
- PR 템플릿: HITL/Strategy/Compatibility 업데이트 여부 체크
- SYSTEM_OVERVIEW Quick Links에 본 문서 링크