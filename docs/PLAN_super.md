# PLAN_super — UX 4단계 기반 릴리스 청사진

## Scope & Goals
- UX: 원문 입력 → 증강 실행 → PM 자연어 피드백 → 반영 재출력
- 포함 기능(토글 가능): A(searchLite), B(guardianProfiles), C(autoTagging), D(difficultyDistribution), E(styleGuard), F(mode)
- Core I/O 불변, 모든 확장은 플러그인/플래그 원칙 준수

## UX Flow(요약)
1) 입력: 업로드 + 가이드 + 프리셋(strict/default/fast), A=off(기본), E/F/B 노출
2) 실행: 생성→심사→게이트; D/E/B/F 적용, 로그 저장
3) 피드백: PM 자연어 1–2줄 → C가 태그 초안 제안 → 확인/수정
4) 재출력: 변경 요약(예상효과) 표시 → 재실행/롤백

## Feature Flags (초기값)
- feature.searchLite = false
- feature.guardianProfiles = true
- feature.autoTagging = true
- feature.difficultyDistribution = true
- feature.styleGuard = true
- feature.mode = "exploit"

## Plugin/Injection Points
- Architect.beforePrompt: plugins/searchLite (A)
- Generator.sampler: diversity/negSampling presets (F)
- Auditor.rules: style/format/difficulty weights (D,E)
- Guardian.profile: per-task thresholds (B)

## Session Config (키 정의)
- mode: "explore"|"exploit"
- guardianProfileId: "default"|"strict"|"fast"
- searchLite: bool
- styleRulesPath: string
- strategyOverrides: { factuality?: number, format?: number, difficulty?: number, styleStrictness?: number }

## Tests (Vitest)
- 계약/스냅샷: Core I/O 불변, 플래그 ON/OFF시 동일 스키마
- 기능: A on/off, B 프로파일별 veto/score/latency 차이, C 태그 제안 1–2개 제한, D 목표분포 수렴, E 룰 위반 리포트
- 성능: maxLatency, veto율 경계
- 호환: 플래그 OFF 시 기존 경로와 동일 결과

## Benchmarks (Mini)
- N=30, 성공 기준: hallucination −30% 또는 이슈율 −30%, PassRate ≥ −2%p, AvgLatency ≤ 목표

## Rollout & Rollback
- 내부 → opt-in → default, 모든 변경은 Run Log/Decision 기록
- 즉시 OFF 가능한 플래그, 이전 Ledger로 롤백 경로 문서화

## Risks
- A 지연↑/컨텍스트 오염, D 과튜닝 위험, E 과형식화 → STRATEGY_PROFILE 스텝(±0.05~0.15), 플래그·리뷰로 완화

## Artifacts
- 이 계획과 함께 아래 템플릿을 사용:
  - docs/TEMPLATES/session_config_example.json
  - docs/TEMPLATES/style_rules.yaml