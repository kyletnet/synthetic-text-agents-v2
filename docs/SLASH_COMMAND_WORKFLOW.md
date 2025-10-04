# 슬래시 명령어 워크플로우 가이드

## 📋 전체 워크플로우 (4단계 시스템)

```
┌─────────────────────────────────────────────────────────────┐
│                   일상 개발 워크플로우                         │
└─────────────────────────────────────────────────────────────┘

1️⃣  /inspect  →  2️⃣  /maintain  →  3️⃣  /fix  →  4️⃣  /ship
   (진단)         (자동수정)        (승인필요)      (배포)

```

---

## 1️⃣ /inspect - 시스템 진단 (항상 첫 단계)

### 언제 사용?

- 작업 시작 전 **항상 먼저** 실행
- 현재 시스템 상태 확인 필요할 때
- 오류 발생 시 원인 파악

### 실행 방법

```bash
npm run status
# 또는
/inspect
```

### 수행 작업

- ✅ TypeScript 컴파일 검사
- ✅ ESLint 검사
- ✅ Prettier 포맷팅 검사
- ✅ 테스트 실행
- ✅ 보안 스캔
- ✅ Architecture 검증
- ✅ **품질 필수 파일 보호 확인** (NEW!)
- ✅ Workaround 탐지
- ✅ 문서화 누락 확인

### 출력

```
📊 Inspection Results
═══════════════════════════════════════════════
🟢 Overall Health Score: 85/100

🎯 Quality Gates:
   TypeScript: ✅ PASS
   Code Style: ❌ FAIL
   Tests: ✅ PASS
   Security: ✅ PASS

🛡️  Quality Protection: 3 essential files protected
   (Auto-refactoring disabled for quality-critical components)

📋 Issues Found:
   Total: 5개
   ✅ Auto-fixable: 2개
   ⚠️  Needs Approval: 3개
```

### 결과 캐싱

- 결과는 `reports/inspection-results.json`에 저장
- **TTL: 30분** (이후 재검사 필요)
- 모든 후속 명령어(`/maintain`, `/fix`)는 이 캐시를 사용

---

## 2️⃣ /maintain - 자동 수정 (승인 불필요)

### 언제 사용?

- `/inspect`에서 auto-fixable 항목이 있을 때
- 코드 스타일 정리
- ESLint 경고 제거

### 실행 방법

```bash
npm run maintain
# 또는
/maintain
```

### 수행 작업 (자동)

```bash
npx prettier --write .          # 포맷팅
npm run lint:fix                # ESLint 자동 수정
npm run design:validate         # 설계 원칙 검증
```

### 특징

- ✅ **승인 불필요** - 자동 실행
- ✅ 안전한 변경만 수행 (코드 로직 미변경)
- ✅ 품질 필수 파일 자동 스킵
- ⚠️ 캐시 만료 시 자동으로 `/inspect` 재실행

---

## 3️⃣ /fix - 대화형 수정 (승인 필요)

### 언제 사용?

- TypeScript 오류 수정
- Architecture 위반 수정
- Workaround 해결
- 문서화 누락 보완

### 실행 방법

```bash
npm run fix
# 또는
/fix
```

### 수행 작업 (승인 필요)

1. 캐시에서 manual-approval 항목 로드
2. 각 항목별로 **사용자 승인 대기**
3. 승인 시 AI가 수정 제안
4. 제안 검토 후 적용 여부 결정

### 예시 대화

```
⚠️  Manual Approval Needed:

1. 🔴 TypeScript 컴파일 오류 12개
   Impact: 타입 안정성 복구 필요, 빌드 실패 가능

   Fix this issue? (y/n/s=skip all):
```

### 품질 보호 통합

- 🛡️ **품질 필수 파일** 수정 시 경고 표시
- 예: `src/agents/domainConsultant.ts` 수정 시

  ```
  ⚠️  WARNING: This file is quality-essential
  Reason: 도메인 지식 데이터 (QA 품질 핵심)
  Auto-refactor: Disabled
  Manual approval: Required

  Proceed with caution? (y/n):
  ```

---

## 4️⃣ /ship - 배포 준비 + 배포

### 언제 사용?

- 모든 수정 완료 후
- PR 생성 전
- 배포 전 최종 검증

### 실행 방법

```bash
npm run ship
# 또는
/ship
```

### 수행 작업

```bash
# 1. 최종 검증
npm run typecheck
npm run lint
npm run test

# 2. 문서 동기화
npm run docs:refresh

# 3. 시스템 분석
npm run _system:map

# 4. 최적화
npm run _optimize:bundle

# 5. Git 작업
git add -A
git commit -m "feat: quality governance implementation"
git push origin main
```

### 주의사항

- ⚠️ `/inspect` 결과가 깨끗해야 실행 가능
- ⚠️ 품질 필수 파일 변경 시 추가 확인

---

## 🔍 /radar - 주간 품질 스캔 (선택적)

### 언제 사용?

- 매주 월요일 자동 실행 (CI/CD)
- 수동 실행: 심층 기술 부채 탐지

### 실행 방법

```bash
npm run radar
# 또는
/radar
```

### 수행 작업

- 🔍 Architecture 깊이 분석
- 🔍 품질 필수 파일 변경 이력 추적
- 🔍 품질 트렌드 분석
- 🔍 P0/P1 이슈 자동 이슈 생성 (GitHub)

### 출력

```
🔍 Weekly Quality Radar Summary

Run Date: 2025-10-05 09:00 UTC

- 🛡️  Quality Violations: 0 ✅
- 📊 Quality Trend: Stable
- 🔴 P0 Issues: 0
- 🟡 P1 Issues: 2

Full Report: See artifacts
```

---

## 🔄 /refactor - 구조적 리팩토링 (선택적)

### 언제 사용?

- `/inspect`에서 refactor-pending 항목이 있을 때
- 대규모 코드 정리 필요 시

### 실행 방법

```bash
npm run /refactor-preview   # 미리보기 (안전)
npm run /refactor           # 실제 적용
```

### 특징

- ⚠️ **품질 필수 파일은 자동 제외**
- ✅ 미리보기 모드로 안전성 확보
- ✅ 승인 후 적용

---

## 📊 실전 시나리오

### 시나리오 1: 일상 개발 (코드 작성 후)

```bash
1. npm run status          # 현재 상태 확인
2. npm run maintain        # 자동 수정 (포맷팅, 린트)
3. git add -A && git commit -m "feat: new feature"
4. git push
```

### 시나리오 2: 오류 수정 필요

```bash
1. npm run status          # 오류 진단
   # TypeScript 오류 5개, ESLint 경고 10개 발견

2. npm run maintain        # ESLint 경고 자동 수정
3. npm run fix             # TypeScript 오류 대화형 수정
   # 각 오류 확인 후 승인

4. npm run status          # 재검증
5. git add -A && git commit -m "fix: resolve type errors"
```

### 시나리오 3: 배포 전 점검

```bash
1. npm run status          # 최종 상태 확인
2. npm run maintain        # 마지막 정리
3. npm run fix             # 남은 이슈 수정
4. npm run status          # 재검증
   # Health Score: 100/100 ✅

5. npm run ship            # 배포 준비 + Push
```

### 시나리오 4: 품질 필수 파일 수정 (주의 필요)

```bash
1. npm run status
   # src/agents/domainConsultant.ts 수정 필요

2. vim src/agents/domainConsultant.ts
   # 조심스럽게 수정

3. npm run status
   # ⚠️  Quality-essential file modified
   # Impact: QA generation quality may change

4. npm run test            # 품질 테스트 확인
5. npm run fix             # 추가 검증
   # WARNING: This file is quality-essential
   # Proceed with caution? (y/n):

6. git add -A && git commit -m "refactor(agents): improve domain knowledge"
   # Commit message에 이유 명시
```

---

## ⚠️ 중요 규칙

### 1. 항상 /inspect 먼저

```bash
❌ BAD:  npm run maintain  (캐시 없음)
✅ GOOD: npm run status → npm run maintain
```

### 2. 캐시 TTL 준수

- Inspection 캐시: **30분**
- 30분 경과 시 자동으로 `/inspect` 재실행 요구

### 3. 품질 필수 파일 주의

- `src/agents/*.ts` - QA 생성 핵심 로직
- 수정 시 **반드시** 테스트 실행
- 자동 리팩토링 비활성화됨

### 4. CI/CD 자동 검증

- PR 생성 시 자동으로 `unified-quality-gate.yml` 실행
- 품질 보호 위반 시 **PR 블록**

---

## 📚 추가 명령어

### 디버깅

```bash
npm run _arch:validate     # Architecture 상세 검증
npm run _migration:status  # Migration 상태
npm run security:scan      # 보안 스캔
```

### 보고서

```bash
npm run docs:refresh       # 문서 동기화
npm run _system:map        # 시스템 맵 생성
npm run baseline:report    # Baseline 메트릭
```

### 개발 도구

```bash
npm run dev                # 개발 모드 실행
npm run test:watch         # 테스트 watch 모드
npm run typecheck:watch    # TypeScript watch
```

---

## 🎯 요약

| 명령어      | 승인     | 용도        | 빈도         |
| ----------- | -------- | ----------- | ------------ |
| `/inspect`  | 불필요   | 진단        | 매번 첫 단계 |
| `/maintain` | 불필요   | 자동 수정   | 필요 시      |
| `/fix`      | **필요** | 대화형 수정 | 필요 시      |
| `/ship`     | 불필요   | 배포        | 배포 전      |
| `/radar`    | 불필요   | 심층 스캔   | 주 1회       |
| `/refactor` | **필요** | 리팩토링    | 선택적       |

**Golden Rule**: `/inspect` → `/maintain` → `/fix` → `/ship` 순서 준수!
