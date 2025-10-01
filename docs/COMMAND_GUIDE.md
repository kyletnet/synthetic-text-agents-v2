# 명령어 가이드

## 🎯 4단계 워크플로우 (반드시 순서 준수!)

**⚠️ 중요**: 반드시 이 순서를 지켜야 합니다. 순서를 건너뛰면 오류가 발생합니다.

```bash
1. /inspect    # 정밀 진단 (Single Source of Truth 생성)
2. /maintain   # 자동 수정 (캐시 기반)
3. /fix        # 대화형 수정 (캐시 기반)
4. /ship       # 배포 준비 + 실제 배포
```

**핵심 원칙**: `/inspect`가 모든 진단을 수행하고, `/maintain`과 `/fix`는 그 결과를 사용합니다.

---

## 1️⃣ `/inspect` - 정밀 진단

```bash
bash scripts/slash-commands.sh inspect
# OR
npm run status
```

**목적**: Single Source of Truth - 모든 진단을 수행하고 결과를 캐싱

**출력**:

- `reports/inspection-results.json` (5분 TTL)
- 건강도 점수 (0-100)
- Auto-fixable 항목 목록
- Manual approval 항목 목록

**실행 내용**:

- TypeScript 컴파일 검사
- ESLint/Prettier 검사
- 테스트 실행 상태
- 보안 감사
- 워크어라운드 탐지
- 컴포넌트 문서화
- 리팩토링 대기 항목

**사용 시점**: 작업 시작 전, 코드 변경 후, 배포 전 (필수)

---

## 2️⃣ `/maintain` - 자동 수정

```bash
bash scripts/slash-commands.sh maintain
# OR
npm run maintain
```

**목적**: 자동 수정 가능 항목만 처리 (승인 불필요)

**전제조건**:

- ⚠️ **반드시 `/inspect` 먼저 실행** (5분 이내)
- ❌ 진단 안 함 - 캐시만 읽음

**자동 수정 항목** (캐시에서 읽음):

- ✅ Prettier 포맷팅
- ✅ ESLint 자동 수정 가능 경고

**오류 예시**:

```
⚠️ maintain를 실행하기 전에 /inspect를 먼저 실행하세요
⏰ 진단 결과가 오래되었습니다 (7분 전)
✅ 올바른 순서: /inspect → /maintain
```

**사용 시점**: `/inspect` 직후 (5분 이내)

---

## 3️⃣ `/fix` - 대화형 수정

```bash
bash scripts/slash-commands.sh fix
# OR
npm run fix
```

**목적**: 수동 승인 필요 항목 대화형 처리

**전제조건**:

- ⚠️ **반드시 `/inspect` 먼저 실행** (5분 이내)
- ❌ 진단 안 함 - 캐시만 읽음

**수정 항목** (캐시에서 읽음):

- Code Quality (TypeScript 오류, ESLint 에러)
- Component Documentation (문서화 누락)
- Workarounds (TODO/FIXME/HACK)
- Refactoring (리팩토링 대기)

**대화형 승인 옵션**:

- `y`: Approve (승인하고 실행)
- `n`: Skip (건너뛰기)
- `m`: Manual (수동 처리로 표시)
- `a`: Abort (전체 중단)
- `i`: Info (자세한 정보)

**사용 시점**: `/maintain` 직후 (5분 이내)

---

## 4️⃣ `/ship` - 배포 준비 + 실제 배포

```bash
bash scripts/slash-commands.sh ship
```

**목적**: 배포 직전 최종 검증 및 실제 배포

**실행 순서** (3단계):

### Phase 1: Pre-ship Validation

- 오래된 파일 정리
- 명령어 레퍼런스 업데이트

### Phase 2: Ship Pipeline

1. 설계 원칙 검증 (`design:validate`)
2. 시스템 검증 (`validate`)
3. 확인 (`verify`)
4. 통합 가드 (`integration-guard`)
5. 시스템 통합 분석 (`system-integration`)
6. 고급 감사 (`advanced:audit`)
7. 문서 동기화 (`docs:refresh`)
8. 최적화 분석 (`optimize:analyze`)

### Phase 3: Deploy

- Auto-commit with timestamp
- Push to remote repository

**사용 시점**: 배포 직전, PR 머지 후

---

## 🚀 완전한 워크플로우

### 일상 개발 (3단계)

```bash
# 1. 정밀 진단
/inspect

# 2. 자동 수정 (Prettier, ESLint)
/maintain

# 3. 대화형 수정 (승인 필요 항목)
/fix

# 4. 커밋
git add -A
git commit -m "fix: 품질 개선"
```

### 배포 직전 (4단계)

```bash
# 1-3. 일상 개발 워크플로우
/inspect
/maintain
/fix

# 4. 배포 준비 + 배포
/ship

# 완료!
# Changes pushed to remote repository
```

### CI/CD (자동)

```bash
npm run design:validate  # 설계 검증
npm run dev:lint         # ESLint
npm run dev:typecheck    # TypeScript
npm run test:coverage    # 테스트
npm run build            # 빌드
```

---

## 💡 FAQ

### Q1: 4단계를 모두 실행해야 하나요?

**A**:

- **일상 개발**: /inspect → /maintain → /fix (3단계)
- **배포 전**: 위 3단계 + /ship (4단계)

### Q2: 순서를 건너뛰면 안 되나요?

**A**: **절대 안 됩니다!** 순서를 건너뛰면 오류가 발생합니다.

- `/maintain`이나 `/fix`를 `/inspect` 없이 실행하면 강제 종료됩니다.
- 캐시가 5분 이상 오래되면 재실행을 요구합니다.

### Q3: `/maintain` vs `/fix` 차이는?

**A**:

- `/maintain`: 자동 수정 (Prettier, ESLint --fix) - 승인 불필요, 캐시 기반
- `/fix`: 대화형 수정 (TypeScript 오류, 워크어라운드) - 승인 필요, 캐시 기반
- **둘 다 진단하지 않음** - 오직 캐시에서만 읽음

### Q4: `/ship`은 언제 실행하나요?

**A**: 배포 직전에만 실행합니다. 일상 개발에서는 불필요합니다.

### Q5: 워크어라운드는 어떻게 처리?

**A**: `/fix` 실행 시 워크어라운드가 자동 검출됩니다. 대화형 승인에서 선택:

- `y`: 수동 검토 안내 (grep 명령어 제공)
- `n`: 건너뛰기
- `m`: 직접 처리

### Q6: 시스템 통합 검증은 언제?

**A**: `/ship` 실행 시 자동으로 통합 검증, 시스템 분석, 설계 검증이 실행됩니다.

---

## 🔧 추가 명령어

### System Management

```bash
/sync   # Complete system update (docs, cleanup, commit, push)
/clean  # Cleanup old files
```

### Development

```bash
/map    # Generate system architecture map
/build  # Build TypeScript project
/test   # Run test suite
/lint   # Fix linting issues
```

### Recovery

```bash
npm run sync:tx:rollback  # Rollback failed sync
npm run sync:tx:status    # Show last sync status
```

---

**🎯 핵심**: `/inspect` → `/maintain` → `/fix` → `/ship` 순서 준수!

_최종 업데이트: 2025-10-01_
