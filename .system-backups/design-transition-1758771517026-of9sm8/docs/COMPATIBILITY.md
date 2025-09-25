# COMPATIBILITY — 확장·리팩토링 호환성 가이드

## 1. 목적

- 새 기능/리팩토링이 **기존 파이프라인을 깨뜨리지 않도록** 안전레일 제공
- 추적·롤백 가능성, 점진 롤아웃, 데이터 계약의 안정성 보장

## 2. 시스템 경계(Architecture Boundaries)

- Core I/O(입력: seedQAs/guidelines/context, 출력: passed/failed/report/issues)는 **안정 계약**
- 확장 지점: Architect/Generator/Auditor/Guardian/Meta의 **injection point**
- 외부 통합(검색·RAG 등)은 **Plugin Slot**으로 연결

## 3. 규칙(필수)

1. **Backward Compatibility**
   - 기존 필드/의미 유지, 새 필드는 **optional**
   - 제거/의미변경은 Deprecation 정책 따름(§6)
2. **Plugin & Adapter**
   - 새 기능은 별도 모듈/어댑터로 추가, Core I/O 미변경
3. **Feature Flags**
   - 기본 OFF → 내부 검증 → 옵트인 → 기본값 전환
   - 비상 시 즉시 OFF 가능해야 함
4. **Data Contract Versioning**
   - `dataset_meta.json`: `{ version, strategyHash, ledgerId, createdAt }`
5. **Rollback**
   - 이전 아티팩트/설정 유지, 레저 링크로 되돌리기 절차 문서화
6. **Test Gates**
   - 계약/스냅샷 테스트, 커버리지 임계, 회귀 테스트(대표 샘플 N)
7. **Tracing**
   - 로그 키: `ledgerId`, `strategyHash`, `featureFlags`, `compatVersion`

## 4. 머지 전 체크리스트

- [ ] 기존 계약/스키마 불변(옵셔널 추가만)
- [ ] 플래그로 보호되고 기본 OFF
- [ ] 마이그레이션 불필요 **또는** 가이드·롤백 포함
- [ ] 테스트/벤치마크 통과(수치 기입)
- [ ] PLAN/REVIEW 링크, Run Log/Decision 카드 링크
- [ ] CHANGELOG 항목(커밋 트레일러 포함)

## 5. 예시 시나리오

- **검색-라이트 추가**: Generator 앞단 Plugin, featureFlag `searchLite`; dataset_meta에 전략/플래그 기록
- **Guardian 임계 상향 실험**: 플래그 `guardianMinScore75`; 실패 시 레저 기준 즉시 복원
- **RAG 도입(PoC)**: Architect/DomainConsultant용 Adapter; Core I/O 미변경

## 6. Deprecation 정책

- 단계: Announce → Dual Support → Default Switch → Removal
- 각 단계에 마이그레이션 가이드/롤백/타임라인 명시

## 7. 버저닝

- 코드: SemVer / 문서: doc-semver / 데이터셋: `dataset_meta.version`
- 변경시 COMPATIBILITY 체크리스트를 링크
