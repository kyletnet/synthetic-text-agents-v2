# FE MVP SPEC — 원문 업로드 → 증강 실행 → PM 피드백 → 재출력 (플래그 기반)

## 0) 스코프 & 원칙

- 스코프: 단일 세션에서 4단계 UX 완주(업로드→실행→피드백→재출력)
- 노출 플래그: B/E/F 노출, C/D 내부 가동, A(RAG-Lite) 스텁(off)
- 안전선: STRATEGY_PROFILE step(±0.05~0.15), 모든 변경은 Run Log/Decision 기록

## 1) 화면 구성

1. Inputs 패널: 파일 업로드, 프리셋(Strict/Default/Fast), Guardian Profile(B) 셀렉트, Mode(F) 탭, Style Guard(E) 토글+룰파일 업로드, SearchLite(A) 토글(beta), 실행 버튼
2. Results 패널: 샘플 표, 통계(PassRate, AvgScore, AvgLatency, Veto%), Top-3 이슈 chips
3. Inspector 패널: 자동 태깅 제안(C), PM 피드백 입력, 변경 영향 요약, 재실행/롤백 버튼

## 2) 상태 흐름

- idle → ready → running → review → adjust → rerun/rollback
- 이벤트: upload_success, preset_changed, run_clicked, feedback_submitted, tags_confirmed 등

## 3) 프리셋 매핑

- Strict: guardianProfile=strict(7.5/2000), mode=exploit, styleGuard=ON, citeRequired=true
- Default: guardianProfile=default(7.0/2000), mode=exploit, styleGuard=ON
- Fast: guardianProfile=fast(7.0/1800), mode=explore, styleGuard=OFF

## 4) 플래그 노출 규칙

- B: 셀렉트
- E: 토글+룰파일
- F: 탭
- C: 내부만
- D: 내부만(리포트 표기)
- A: 토글(beta)

## 5) 데이터 계약

### 5.1 session.config 예시

```json
{
  "mode": "exploit",
  "guardianProfileId": "default",
  "searchLite": false,
  "styleRulesPath": "docs/style_rules.yaml",
  "strategyOverrides": {
    "factuality": 1.0,
    "format": 1.0,
    "difficulty": 1.0,
    "styleStrictness": 0.5
  },
  "feedback": "근거 부족. 인용 강제하고 사실성 가중 ↑"
}
```

### 5.2 run_request (FE→엔진)

- inputs: { files|text, guidelines, session.config }
- flags: { feature.searchLite, feature.guardianProfiles, feature.autoTagging, feature.difficultyDistribution, feature.styleGuard, feature.mode }
- constraints: { maxLatency, minScore } (Guardian 프로파일에서 유도)

### 5.3 run_result (엔진→FE)

- metrics: { passRate, avgScore, avgLatency, vetoedPct }
- issuesTop3: [ … ]
- samples: [ { id, status, score, latencyMs, issues[] } ]
- links: { runLogPath, decisionPath }

## 6) 피드백 매핑

- PM 피드백 → C가 태그 초안 → 확정 시 전략/플래그 diff → Decision 카드 초안 작성 → 변경 영향 요약 표시

## 7) 결과/리포트

- 분포 리포트(D), 스타일 위반 리포트(E)
- 내보내기: session.config.json, dataset_meta.json

## 8) 오류 처리

- 파일 과대/형식 미지원, 빈 가이드, 룰파일 파싱 실패
- 즉시 OFF 가능 플래그, 이전 Ledger로 롤백

## 9) 접근성/i18n

- 키보드 포커스, 라벨, 대비
- i18n 리소스: docs/TEMPLATES/ui_copy.json

## 10) 프론트 테스트

- testIDs: btn-run, chip-tag-hallucination, toggle-style-guard …
- 시나리오: 업로드→실행→자동태그→피드백→재실행→로그 확인
