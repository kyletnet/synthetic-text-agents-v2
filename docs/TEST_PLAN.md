# TEST PLAN — Vitest 기반 품질/호환성 테스트 전략

## 0) 목적 & 원칙
- Core I/O **불변** 확인, 기능 플래그(A~F) on/off시 기대 동작, 성능/호환성 가드 확보.
- 모든 변경은 Run Log/Decision 카드 기록, STRATEGY_PROFILE step(±0.05~0.15) 준수.
- 실패 시 즉시 플래그 OFF/이전 Ledger 복원 가능한지 확인.

## 1) 범위 (In/Out)
- In: QA 생성 파이프라인(Generator→Auditor→Guardian), 플래그 A~F, 세션/메타 기록.
- Out: 외부 인덱싱/DB(풀 RAG), 배치/스케줄러, FE 렌더링(별도 E2E로 커버).

## 2) 테스트 매트릭스 (요약)
| Suite | 목적 | 주요 케이스 | 성공 기준 |
|---|---|---|---|
| contract | Core I/O 스키마/필수키 불변 | run_request/ run_result 필드 유무 & 타입 | 스냅샷/스키마 검증 통과 |
| feature-A | searchLite on/off | on: 근거 1~3개 주입, off: 순수 본문 | 스키마 동일, on에서 factuality↑, latency Δ≤+10% |
| feature-B | guardianProfiles | default/strict/fast 임계 반영 | veto 사유 로깅/임계치 반영 |
| feature-C | autoTagging | 태그 후보 ≤2개, 상반 태그 금지 | 제안 규칙 준수 |
| feature-D | difficultyDistribution | 목표 3:4:3 수렴 | 분포 KL-divergence ↓ |
| feature-E | styleGuard | 룰 위반 리포트 | 위반 항목 배열/카운트 노출 |
| feature-F | mode | explore vs exploit 프리셋 | 중복률/다양성/점수 균형 변동 |
| perf | 성능/지연 | maxLatency, 토큰/샘플 | 프로파일 기준 충족 |
| compat | 플래그 OFF fallback | A~F off 시 기존 경로 동일 | 결과 스냅샷 일치 |
| regression | 회귀 | 최근 Ledger/flags 재현 | 재현 성공 |

## 3) 계약/스냅샷 테스트
- run_request: `inputs`, `flags`, `constraints` 존재 및 타입.
- run_result: `metrics{passRate,avgScore,avgLatency,vetoedPct}`, `issuesTop3[]`, `samples[]`, `links{runLogPath,decisionPath}`.
- 스냅샷 키: `metrics`, `issuesTop3`, `samples.length`, 필수 필드 존재.
- 위치: `tests/contract/*.spec.ts` (코드 생성은 추후; 본 문서는 기준만 정의).

## 4) 기능 테스트 (상세)
### A) searchLite
- on: citeRequired=true 권장, factuality 가중 +0.1 반영 여부.
- off: 근거 미주입, 결과 스키마 동일.
- 성능 가드: AvgLatency on/off Δ ≤ +10%.
### B) guardianProfiles
- default(7.0/2000), strict(7.5/2000), fast(7.0/1800) 임계 적용.
- veto 사유/임계 로그 확인.
### C) autoTagging
- 제안 태그 ≤2, 상반 태그 조합 금지.
- 태그 → Experts/Knobs 초안 매핑 생성 여부(초안 객체 유무).
### D) difficultyDistribution
- 목표 3:4:3 설정 → Auditor 분포 리포트 수집 → 이전 대비 KL 감소.
### E) styleGuard
- 룰파일 주입 시 위반 리포트(`styleViolations[]`) 발생.
- 룰 파싱 실패 시 자동 OFF & 경고.
### F) mode
- explore: 다양성↑/중복률↓, exploit: 점수 안정↑.
- 중복률/점수 표본 통계 비교.

## 5) 성능/벤치마크 (미니)
- 샘플 수 N=30, seed 고정(재현성).
- 목표: hallucination 또는 상위 이슈율 −30% 이상, PassRate ≥ −2%p, AvgLatency 프로파일 목표 이내.
- 기록: `docs/RUN_LOGS/*`, `docs/LEDGER/*`, `outputs/dataset_meta.json`.

## 6) 호환성/폴백
- 플래그 OFF → 기존 경로/스냅샷과 동일.
- searchLite 타임아웃 → 주입 생략하고 성공적으로 완료.

## 7) 시드/결정성
- `TEST_SEED` 환경변수로 seed 고정, 난수 사용 경로 문서화.
- 동일 seed 동일 결과(허용 오차 내) 확인.

## 8) CI/보고
- CI 목표: 빠른 계약/기능 서브셋(≤5분) + 일일 미니 벤치(스케줄).
- 리포트: passRate/avgScore/avgLatency/veto% 추이, 이슈 Top-3 변화.

## 9) 커버리지 & 플레이키
- 최소 라인/브랜치 70% 목표(핵심 경로 우선).
- flaky 기준: 3회 중 1회 이상 실패 → 재시도/원인 기록/격리.

## 10) 산출물/링크
- 테스트 스펙 경로 제안, 스냅샷 보관 폴더, 템플릿 파일들(아래).