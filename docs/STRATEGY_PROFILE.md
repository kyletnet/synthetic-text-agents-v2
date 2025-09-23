# STRATEGY PROFILE — 사양서(Spec)

본 문서는 "조정 가능한 전략 파라미터"의 **정의/범위/디폴트/효과/리스크/예시**를 담는 기준(SOT)입니다.

## 1. 목적

- 실험·튜닝의 **안전 가드레일** 제공, 재현성·호환성 보장, 과튜닝·품질하락 방지.

## 2. 파라미터 표 (상세)

- architect.styleStrictness: [0..1], default 0.5
  - ↑: 스타일/톤 엄격, ↓: 다양성·자유도
  - 리스크: 과도↑ 시 창의성·다양성 하락
- architect.citeRequired: boolean, default false
  - true: 근거/출처 필수. 리스크: 자료 없는 문서에선 Fail↑
- auditor.weights.{factuality|format|difficulty}: [0..2], default 1.0
  - 범위를 넘지 말 것. 상호작용(예: factuality↑는 PassRate↓ 가능)
- guardian.{minScore≥7.0, maxLatency ms=2000}
  - minScore↑: 품질 하한↑/통과↓, maxLatency↓: 속도↑/통과↓
- generator.{diversity[0..1]=0.6, negativeSampling:boolean=true}
  - diversity↑: 중복↓·표현다양성↑/일탈 위험↑

## 3. 조정 원칙

- 스텝: ±0.05~0.15. 한 번에 1~2개. 변경마다 Run Log/Decision 카드 필수.
- 검증: 20~50 샘플 미니 러닝→전/후 지표 비교(PassRate, AvgScore, Latency, 이슈율).
- 롤백: 실패 시 이전 Ledger-ID로 즉시 복원.

## 4. 태그→전략 예시(운영 연결)

- hallucination: citeRequired=true, factuality+0.15, minScore≥7.5
- ambiguous/format: format+0.1
- too_easy/too_hard: difficulty ±0.1
- jargon/style_mismatch: styleStrictness+0.1
- latency 문제: 길이/컨텍스트 조정 우선, 필요 시 maxLatency 조절

## 5. 상호작용 주의

- diversity↑ ↔ hallucination 위험↑ → factuality 보강 필요
- minScore↑는 PassRate↓ 가능 → 샘플 수 확대 전 단계적으로 적용
- format↑는 가독성↑/표현 자유도↓ → styleStrictness와 함께 과도↑ 금지

## 6. 성공 판단 & 보고

- 성공 조건 템플릿: PassRate +5%p↑ **또는** 이슈율 30%↓, AvgLatency ≤ 목표
- 보고: `docs/TEMPLATES/STRATEGY_TUNING_log.md`로 기록 → `RUN_LOGS/`/`LEDGER/`에서 링크

## 7. 변경 이력(Changelog)

- 변경 시점, 변경값(before→after), 근거(Decision ID), 결과지표 요약, 롤백여부 기재.
