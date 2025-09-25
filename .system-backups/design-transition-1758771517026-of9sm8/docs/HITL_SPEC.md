# HITL SPEC — 사람 피드백 ↔ 시스템 조치 표준

본 문서는 자연어 피드백을 **태그/목표**로 정규화하고, 태그에 따른 **전문가 소환·개입 지점·전략 조정**을 규정한다.

## 1. 목적

- 사람 입력을 **일관된 시스템 행동**으로 변환해 품질을 안정적으로 끌어올림
- 운영자가 기술 디테일 없이 **문장 한두 줄**로 개선을 유도

## 2. 태그 분류(대표)

- `hallucination`, `too_easy`, `too_hard`, `overuse_jargon`, `style_mismatch`, `ambiguous`, `format_issue`, `length_too_long`, `length_too_short`

## 3. 태그 → 조치 매핑(상세)

| Tag                      | Experts & Persona                                             | Injection Point              | Strategy Knobs(예)                                    | Rationale & Expected Effects   |
| ------------------------ | ------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------- | ------------------------------ |
| hallucination            | Domain Consultant(검증), Architect(프롬프트), Auditor(사실성) | Architect+Auditor            | citeRequired=true; factuality +0.15; minScore ≥7.5    | 출처 강제·사실성↑·무근거 발언↓ |
| too_easy                 | Cognitive Scientist(난이도 설계)                              | Architect                    | difficulty +0.1                                       | 쉬운 샘플 비율↓                |
| too_hard                 | Cognitive Scientist                                           | Architect                    | difficulty -0.1                                       | 과난도↓·접근성↑                |
| overuse_jargon           | Linguistics Engineer, Psychology Specialist                   | Architect                    | styleStrictness +0.1                                  | 전문용어↓·친화적 톤↑           |
| style_mismatch           | Linguistics Engineer                                          | Architect                    | styleStrictness +0.05                                 | 톤/스타일 일치                 |
| ambiguous / format_issue | Linguistics Engineer, Auditor                                 | Architect+Auditor            | format +0.1                                           | 명료성·구조화↑                 |
| length_too_long          | Architect, Guardian                                           | Architect(+가이드), Guardian | 응답 길이 가이드 축소; 필요 시 maxLatency 재설정 실험 | 지연/장황함↓                   |
| length_too_short         | Architect                                                     | Architect                    | 길이 가이드 확대; styleStrictness -0.05               | 정보량↑                        |

## 4. 태깅 규칙(정규화)

- 자연어를 **한두 개 태그**로 매핑(과도 태깅 금지).
- **금칙**: 상반되는 태그 동시 선택(`too_easy`+`too_hard`)은 허용 안 함(분리 피드백).
- 모델이 초안을 제안하고, 운영자가 확인·수정 가능.

## 5. 운영 연결

- 태그는 Decision 카드의 **Problem/Tag(s)**에 기록 → 소환/노브/기대효과가 자동 채워진 초안 생성.
- 조정값은 **STRATEGY_PROFILE** 범위·스텝을 반드시 준수.

## 6. 예시 & 안티패턴

- 예시: "근거가 없어요 → hallucination", "모호해요 → ambiguous", "전문용어 줄여줘 → overuse_jargon"
- 안티패턴: "다 고쳐줘"처럼 **포괄적 요청**(구체 태그 최소 1개 필요).
