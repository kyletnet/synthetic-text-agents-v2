# 명령어 가이드

## 🎯 4단계 워크플로우

모든 개발은 이 4단계를 순서대로 실행합니다:

```bash
1. npm run status      # 진단
2. npm run maintain    # 자동 수정
3. npm run fix         # 대화형 수정
4. npm run ship        # 배포 준비
```

---

## 1️⃣ `/status` - 시스템 진단

```bash
npm run status        # 전체 건강도 측정
npm run status:quick  # 빠른 체크 (TypeScript만)
```

**목적**: 현재 시스템 상태 파악 (읽기 전용)

**출력**:

- 건강도 점수 (0-100)
- TypeScript, Code Style, Tests, Security
- 컴포넌트 준수율
- 워크어라운드 개수

**사용 시점**: 작업 시작 전, 배포 전

---

## 2️⃣ `/maintain` - 자동 수정

```bash
npm run maintain       # 스마트 모드 (권장)
npm run maintain:safe  # 안전 모드 (진단만)
npm run maintain:quick # 빠른 모드 (핵심만)
```

**목적**: 안전한 항목 자동 수정 (승인 불필요)

**자동 수정 항목**:

- ✅ Prettier 포맷팅
- ✅ ESLint 자동 수정 가능 항목
- ✅ 설계 원칙 검증

**사용 시점**: status 직후, 안전한 품질 개선

---

## 3️⃣ `/fix` - 대화형 수정

```bash
npm run fix
```

**목적**: 위험한 항목 대화형 승인 후 수정

**수정 항목**:

- Code Quality (TypeScript 오류 등)
- Component Documentation (템플릿 생성)
- Workarounds (TODO/FIXME/HACK)
- Refactoring (리팩토링 대기)

**대화형 승인 옵션**:

- `y/Y`: 승인하고 실행
- `n/N`: 건너뛰기
- `m/M`: 수동 처리
- `a/A`: 전체 중단
- `i/I`: 자세한 정보

**사용 시점**: maintain 직후, 수동 검토 필요 항목

---

## 4️⃣ `/ship` - 배포 준비

```bash
npm run ship
```

**목적**: 배포 직전 최종 검증 및 준비

**실행 순서**:

1. 설계 원칙 검증 (`design:validate`)
2. 통합 가드 (`integration-guard`)
3. 시스템 통합 분석 (`system-integration`)
4. 고급 감사 (`advanced:audit`)
5. 문서 동기화 (`docs:refresh`)
6. 최종 건강도 체크 (`status:quick`)
7. 배포 최적화 (`optimize:analyze`)

**사용 시점**: 배포 직전, PR 머지 후

---

## 🚀 완전한 워크플로우

### 개발 중 (일상)

```bash
# 1. 진단
npm run status

# 2. 자동 수정 (Prettier, ESLint)
npm run maintain

# 3. 대화형 수정 (승인 필요 항목)
npm run fix

# 4. 커밋
git add -A
git commit -m "fix: 품질 개선"

# 5. 배포 준비 (배포할 때만)
npm run ship

# 6. 배포
git push origin main
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

- **일상 개발**: status → maintain → fix (3단계)
- **배포 전**: 위 3단계 + ship (4단계)

### Q2: 순서를 건너뛰면 안 되나요?

**A**: 권장하지 않습니다. 각 단계가 이전 단계의 결과를 기반으로 합니다.

### Q3: `/maintain` vs `/fix` 차이는?

**A**:

- `/maintain`: 자동 수정 (Prettier, ESLint --fix) - 승인 불필요
- `/fix`: 대화형 수정 (워크어라운드, 리팩토링) - 승인 필요

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

_최종 업데이트: 2025-09-30_
