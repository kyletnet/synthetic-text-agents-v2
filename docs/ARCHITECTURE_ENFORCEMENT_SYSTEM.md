# Architecture Enforcement System

**설치일**: 2025-10-01
**목적**: 아키텍처 일관성 자동 검증 및 강제 적용

---

## 개요

이 시스템은 **"한 번 고치면 다시는 같은 문제가 발생하지 않는"** 구조를 보장합니다.

### 핵심 컴포넌트

1. **Pattern Registry** - 올바른 패턴 중앙 관리
2. **Migration Tracker** - 마이그레이션 진행률 추적
3. **Architecture Invariants** - 아키텍처 불변 조건 검증
4. **CI/PR Enforcement** - 빌드/PR 차단

---

## 사용법

### 로컬 개발

```bash
# 아키텍처 검증
npm run arch:validate

# 빠른 검증 (느린 체크 스킵)
npm run arch:validate:quick

# 자동 수정 시도
npm run arch:fix

# 마이그레이션 상태 확인
npm run migration:status

# 패턴 스캔
npm run patterns:scan
```

### Pre-commit Hook

자동으로 실행됩니다:

```bash
git commit -m "feat: add new feature"
# → Design Validator (ENFORCED)
# → TypeScript Check
# → ESLint
```

### CI/CD

모든 PR에서 자동 실행:

- Architecture Invariants 검증
- Design Principles 검증
- TypeScript 컴파일
- Migration 상태 체크

**P0 위반 시 PR 자동 차단**

---

## Pattern Registry

### 위치

`.patterns/cli-mandates.json`

### 정의된 패턴

#### 1. ENV_DETECTION_READLINE (P0)

**문제**: readline 사용 시 환경 감지 없이 hang 발생

**안티패턴**:

```typescript
if (!process.stdin.isTTY) {
  // ...
}
```

**올바른 패턴**:

```typescript
import { detectEnvironment } from "./lib/env-detection.js";

const env = detectEnvironment();
if (!env.isInteractive) {
  // ...
}
```

#### 2. GOVERNANCE_WRAPPER (P1)

**문제**: 작업이 추적/롤백 불가능

**올바른 패턴**:

```typescript
import { GovernanceRunner } from "./lib/governance/governance-runner.js";

const governance = new GovernanceRunner(process.cwd());
await governance.executeWithGovernance(
  async () => {
    // Your logic
  },
  { operation: "operation-name" },
);
```

#### 3. INSPECTION_CACHE_FIRST (P0)

**문제**: 일관성 없는 상태에서 작업 실행

**올바른 패턴**:

```typescript
import { InspectionCache } from "./lib/inspection-cache.js";

this.cache.enforceInspectFirst("fix");
const { results } = this.cache.validateCache();
```

---

## Migration Tracker

### 위치

`.migration/progress.json`

### 현재 마이그레이션

#### ENV_DETECTION_2025_10 (완료)

- **상태**: Completed ✅
- **진행률**: 5/5 (100%)
- **완료일**: 2025-10-01

**마이그레이션된 파일**:

- ✅ scripts/fix-engine.ts
- ✅ scripts/lib/simplified-approval-system.ts
- ✅ scripts/test-readline-approval.ts
- ✅ scripts/interactive-approval-handler.ts
- ✅ scripts/interactive-maintenance-handler.ts

---

## Architecture Invariants

### 정의된 불변 조건

#### SINGLE_ENV_DETECTION (P0)

모든 환경 감지는 `env-detection.ts`를 사용해야 함

**검증**:

- ❌ 직접 `process.stdin.isTTY` 체크
- ❌ 직접 `process.env.CLAUDECODE` 체크
- ✅ `detectEnvironment()` 사용 필수

#### NO_DUPLICATE_ENV_LOGIC (P1)

환경 감지 로직이 중복되어서는 안 됨

**검증**:

- 패턴 매칭으로 중복 로직 감지
- `env-detection.ts` 외부에서 발견 시 위반

#### READLINE_REQUIRES_ENV_DETECTION (P0)

readline 사용하는 모든 파일은 환경 감지 필수

**검증**:

- `readline.createInterface` 사용 감지
- `detectEnvironment` import 확인

#### CONSISTENT_MIGRATION (P0)

마이그레이션은 전체 완료되거나 시작 전 상태여야 함

**검증**:

- 부분적으로 마이그레이션된 상태 차단
- 모든 타겟 파일이 동시에 마이그레이션되어야 함

---

## 강제 적용 계층

### Level 1: IDE (권장)

- ESLint 플러그인
- TypeScript 타입 체크
- 실시간 경고

### Level 2: Pre-commit (강제)

```bash
.git/hooks/pre-commit
  → Design Validator (ENFORCED)
  → TypeScript Check
  → ESLint
```

**우회 방법**:

```bash
git commit --no-verify  # NOT RECOMMENDED
```

### Level 3: CI/CD (강제)

```yaml
.github/workflows/architecture-validation.yml
→ Architecture Invariants
→ Design Principles
→ TypeScript Compilation
```

**우회 불가능** - PR 머지 차단

---

## 예외 처리

### Exemptions

특정 파일은 검증에서 제외 가능:

```json
{
  "exemptions": [
    {
      "file": "scripts/lib/env-detection.ts",
      "pattern": "ENV_DETECTION_READLINE",
      "reason": "This is the source of truth"
    }
  ]
}
```

### Bypass (긴급 상황)

```bash
# Pre-commit bypass (로컬만)
git commit --no-verify

# Design validator bypass (로컬만)
DESIGN_VALIDATOR_ENFORCE=false npm run design:validate

# CI는 우회 불가능
```

---

## 트러블슈팅

### "P0 violations detected - build blocked"

1. 위반 내역 확인:

```bash
npm run arch:validate
```

2. 자동 수정 시도:

```bash
npm run arch:fix
```

3. 수동 수정:

- 각 위반 항목의 suggestion 따라 수정
- Pattern Registry 참조

4. 재검증:

```bash
npm run arch:validate
```

### "Migration incomplete"

```bash
# 마이그레이션 상태 확인
npm run migration:status

# 남은 파일 확인
npm run migration:list
```

### "Design validation failed"

```bash
# 상세 내역
npm run design:validate

# 특정 룰 비활성화 (비추천)
DESIGN_VALIDATOR_ENFORCE=false npm run design:validate
```

---

## 확장

### 새 패턴 추가

1. `.patterns/cli-mandates.json`에 패턴 정의
2. `architecture-invariants.ts`에 Invariant 추가
3. 테스트 추가
4. Documentation 업데이트

### 새 마이그레이션 시작

1. `.migration/progress.json`에 마이그레이션 항목 추가
2. 타겟 파일 목록 작성
3. 마이그레이션 스크립트 작성 (선택)
4. 진행 상황 추적

---

## FAQ

**Q: 기존 코드에 적용하면 빌드가 깨지나요?**
A: 아니요. 기존 위반은 경고로 표시되고, 새 코드만 강제 적용됩니다.

**Q: 특정 파일을 예외 처리할 수 있나요?**
A: 네, `.patterns/*.json`의 `exemptions`에 추가하세요.

**Q: CI를 우회할 수 있나요?**
A: 아니요. CI 우회는 불가능하며, 이것이 설계 의도입니다.

**Q: 어떤 위반이 P0인가요?**
A: 시스템 hang, 보안 취약점, 데이터 손실 가능성이 있는 위반.

**Q: 마이그레이션 데드라인을 놓치면?**
A: CI가 차단하지는 않지만, Migration Tracker에서 경고합니다.

---

## 참고 문서

- **상세 분석**: `docs/ENVIRONMENT_DETECTION_ANALYSIS.md`
- **Pattern Registry**: `.patterns/cli-mandates.json`
- **Migration Progress**: `.migration/progress.json`
- **Governance Rules**: `governance-rules.json`

---

## 성공 지표

✅ **목표 달성**:

- ✅ P0 위반 0건 유지
- ✅ 새 PR에서 아키텍처 위반 자동 차단
- ✅ 마이그레이션 100% 완료
- ✅ 환경 감지 버그 재발 방지

✅ **부수 효과**:

- 코드 일관성 향상
- 온보딩 시간 단축 (패턴이 명시됨)
- 리뷰 시간 감소 (자동 검증)

---

**핵심 원칙**:
_"실수할 수 없는 시스템 > 실수하지 않는 개발자"_
