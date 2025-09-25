# 사용자 가이드 - 설계 기반 시스템

## 🚀 **초간단 일상 운영 (슬래시 명령어)**

### 📅 **매일 체크**

```bash
npm run /status                  # 시스템 상태 체크
```

### 🔧 **작업 완료 후 (주 1-2회)**

```bash
npm run /update                  # 전체 시스템 업데이트 (자동화)
```

### 🚨 **문제 발견시**

```bash
npm run /fix                     # AI 자동 수정
```

### 🚀 **릴리즈 시**

```bash
npm run /ship                    # 배포 준비 및 실행
```

---

## 🎯 핵심 4개 명령어

### 1. `npm run sync`

**전체 시스템 동기화 (승인 기반)**

- 변경사항 자동 분석
- 영향도 평가 후 승인 요청
- `/confirm-sync`로 승인 필요

### 2. `npm run status`

**통합 시스템 대시보드**

- 모든 상태 한눈에 확인
- 이슈, 보안, 통합 점수 통합 표시
- 권장 액션 자동 제시

### 3. `npm run fix`

**AI 자동 수정**

- TypeScript 오류 자동 감지
- 안전한 수정만 자동 적용
- 복잡한 수정은 제안만 제공

### 4. `npm run ship`

**배포 준비**

- 최종 품질 검증
- 패키징 및 배포 준비
- 모든 검사 통과 후 실행

## 🔧 고급 명령어 (필요시)

### 복구 명령어

- `npm run recovery:rollback` - 시스템 롤백
- `npm run recovery:status` - 복구 상태 확인

### 분석 명령어

- `npm run advanced:integration` - 상세 통합 분석
- `npm run advanced:audit` - 시스템 감사

## 💡 사용 패턴

### 일상적 사용

1. `npm run status` - 현재 상태 확인
2. 문제 발견시 `npm run fix` - 자동 수정 시도
3. `npm run sync` - 변경사항 동기화 (승인 필요)

### 문제 발생시

1. `npm run recovery:status` - 상황 파악
2. `npm run recovery:rollback` - 필요시 롤백
3. `npm run advanced:integration` - 상세 분석

## 🚫 더 이상 사용하지 않는 것들

- ❌ 개별 보고서 명령어들 (통합 대시보드로 대체)
- ❌ 수많은 세부 명령어들 (4개 핵심으로 통합)
- ❌ 자동 실행 (모든 중요 변경은 승인 필요)

## 🎊 이점

- **단순함**: 4개 명령어만 기억
- **안전함**: 모든 변경사항 승인 후 실행
- **명확함**: 각 명령어의 역할이 명확
- **효율성**: 통합 대시보드로 한번에 확인
