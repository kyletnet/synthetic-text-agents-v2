# 명령어 가이드

## 🎯 올인원 워크플로우

### `/fix` - 하나의 명령어로 모든 것

```bash
npm run fix          # 전체 프로세스 (권장)
npm run fix --check-only   # 진단만
npm run fix --skip-tests   # 테스트 생략
npm run fix --skip-docs    # 문서 동기화 생략
```

**철학**: 하나의 명령어로 진단 → 수정 → 테스트 → 문서화 → 검증

**자동 실행 순서**:

1. 📊 **진단**: 시스템 건강도 측정 (status 포함)
2. 🔧 **수정**: 대화형 품질 수정 (y/n/m/a 승인)
3. 🧪 **테스트**: 자동 테스트 실행
4. 📚 **문서화**: 문서 인덱스 동기화
5. 🏥 **검증**: 최종 건강도 확인

**수정 항목**:

- Code Quality (Prettier, ESLint, TypeScript)
- Component Documentation (자동 템플릿 생성)
- Workarounds (TODO/FIXME/HACK)
- Refactoring (리팩토링 대기)

**대화형 승인 옵션**:

- `y/Y`: 승인하고 실행
- `n/N`: 건너뛰기
- `m/M`: 수동 처리
- `a/A`: 전체 중단
- `i/I`: 자세한 정보

**사용 시점**:

- 개발 중 품질 관리
- 배포 전 최종 정리
- 코드 리뷰 전 준비

**기본 워크플로우**:

```bash
npm run fix          # 모든 것을 한 번에
git add -A
git commit -m "fix: 품질 개선"
npm run ship         # 배포 준비
```

---

## 🔄 다른 명령어들

### `/maintain` - CI/CD 자동 유지보수

```bash
npm run maintain       # 스마트 모드 (안전한 것만 자동)
npm run maintain:safe  # 안전 모드 (진단만)
npm run maintain:quick # 빠른 모드 (핵심만)
```

**목적**: CI/CD 파이프라인에서 자동 실행 (사람 개입 없음)
**사용 시점**: GitHub Actions (daily), Pre-commit hook

### `/ship` - 배포 준비

```bash
npm run ship
```

**목적**: 배포 직전 최종 준비 (문서 동기화 + 건강도 + 최적화)
**사용 시점**: 배포 직전, PR 머지 후

---

## 🚀 권장 워크플로우

### 개발 중 (사람)

```bash
npm run fix          # 진단 → 수정 → 테스트 → 문서화 (올인원)
git add -A
git commit -m "fix: 품질 개선"
npm run ship         # 배포 준비
```

### CI/CD (자동)

```bash
npm run maintain     # 자동 유지보수
npm run test         # 테스트
npm run ship         # 배포 준비 (main 브랜치)
```

---

## 💡 FAQ

### Q1: `/fix` 하나로 충분한가?

**A**: 개발자가 직접 실행하는 경우 `/fix` 하나로 충분합니다. 진단 → 수정 → 테스트 → 문서화를 한 번에 처리합니다.

### Q2: `/maintain`은 언제 사용?

**A**: CI/CD 자동화 전용입니다. 사람이 직접 실행할 필요는 없습니다.

### Q3: 문서는 언제 업데이트?

**A**: `/fix`는 수정 후 자동으로 문서를 동기화합니다. `--skip-docs` 옵션으로 생략 가능합니다.

### Q4: 진단만 하고 싶으면?

**A**: `npm run fix --check-only` 또는 `npm run status`를 사용하세요.

### Q5: 테스트 생략하려면?

**A**: `npm run fix --skip-tests`를 사용하세요.

### Q6: 워크어라운드는 어떻게 처리?

**A**: `/fix` 실행 시 워크어라운드가 자동 검출됩니다. 대화형 승인에서 선택:

- `y`: 수동 검토 안내 (grep 명령어 제공)
- `n`: 건너뛰기
- `m`: 직접 처리

---

_최종 업데이트: 2025-09-30_
