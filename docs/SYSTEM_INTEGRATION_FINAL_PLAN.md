# 시스템 통합 최종 계획

**작성일**: 2025-10-01
**목적**: Architecture Enforcement를 기존 4단계 워크플로우에 완전 통합

---

## 🎯 핵심 문제 진단

GPT 조언이 정확합니다:

> **"품질 자동화 엔진은 완성, 하지만 확장 구조가 정렬되지 않아 재발 위험 높음"**

현재 상태:

- ✅ 뼈대(Architecture Invariants, Pattern Registry) = 튼튼함
- ❌ 표피(슬래시 명령어 통합) = 분산됨
- ❌ 동맥(CI 워크플로우) = 중복됨
- ❌ 신경망(문서-코드 연결) = 없음

---

## 🧠 빠진 치명적 사항 (GPT 지적 반영)

### 1. Refactor + Architecture 연계 미약 ⚠️ **P1 심각**

**문제**:

```typescript
// scripts/refactor-engine.ts - 구조 개선
await refactorCode(); // 코드 리팩토링

// scripts/validate-architecture.ts - 아키텍처 검증
await validateInvariants(); // 패턴 검증

// ❌ 문제: 두 시스템이 분리됨
// → 리팩토링 후 아키텍처 위반 발생 가능
// → 중복 검증 (refactor가 자체 검증 + architecture가 또 검증)
```

**시나리오**:

1. 개발자가 `/refactor` 실행
2. 코드 구조 개선됨
3. 하지만 env-detection 패턴 위반 발생
4. `/ship`에서 차단됨
5. 개발자 혼란: "refactor했는데 왜 안 돼?"

**해결**:

```typescript
// scripts/refactor-engine.ts에 통합
async function refactor() {
  // 1. 리팩토링 실행
  await performRefactoring();

  // 2. 즉시 Architecture 검증 (통합!)
  const violations = await validateArchitecture();

  if (violations.p0 > 0) {
    // 3. 자동 롤백 또는 수정
    await autoFixOrRollback(violations);
  }

  // 4. 최종 확인
  await validateArchitecture(); // 재검증
}
```

---

### 2. CI 워크플로우 중복 제거 🔴 **P0 최우선**

**현재 상태** (비효율):

```yaml
# ci.yml (11700 bytes)
- TypeScript ✓
- ESLint ✓
- Tests ✓
- Security Scan ✓

# architecture-validation.yml (1911 bytes)
- TypeScript ✓ # 중복!
- Design Validator ✓
- Architecture Invariants ✓

# gap-prevention.yml (7356 bytes)
- TypeScript ✓ # 또 중복!
- GAP Scanner ✓

# doc-quality-gate.yml (6322 bytes)
- TypeScript ✓ # 또또 중복!
- Doc Linter ✓
```

**비용**:

- PR 하나당: 4회 TypeScript 컴파일 = 12분
- 월 100 PR = 1200분 = **20시간 낭비**
- GitHub Actions 비용: $0.008/분 × 1200 = **$9.6/월 낭비**

**해결**: 단일 통합 워크플로우

```yaml
# .github/workflows/unified-quality-gate.yml
name: Unified Quality Gate

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main, develop]

jobs:
  # ========================================
  # Stage 1: 빠른 검증 (3분)
  # ========================================
  quick-checks:
    name: Quick Validation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - name: Install dependencies (ONCE)
        run: npm ci

      - name: TypeScript Compilation (ONCE)
        run: npm run typecheck

      - name: ESLint
        run: npm run lint

  # ========================================
  # Stage 2: 아키텍처 검증 (2분) - 병렬
  # ========================================
  architecture:
    name: Architecture & Design
    needs: quick-checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci

      - name: Architecture Invariants
        run: npm run arch:validate

      - name: Design Principles
        run: npm run design:validate
        env:
          DESIGN_VALIDATOR_ENFORCE: true

      - name: Pattern Compliance
        run: npm run patterns:scan

  # ========================================
  # Stage 3: 심층 검증 (5분) - 병렬
  # ========================================
  deep-validation:
    name: Tests & Security
    needs: quick-checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci

      - name: Tests with Coverage
        run: npm run test:coverage

      - name: Security Scan
        run: npm run security:scan

      - name: GAP Scanner
        run: npm run gap:scan

  # ========================================
  # Stage 4: 문서 품질 (2분) - 병렬
  # ========================================
  documentation:
    name: Documentation Quality
    needs: quick-checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci

      - name: Doc Linter
        run: npm run docs:lint

      - name: Doc Audit
        run: npm run docs:audit

  # ========================================
  # Stage 5: 최종 승인 (1분)
  # ========================================
  final-gate:
    name: Final Approval
    needs: [architecture, deep-validation, documentation]
    runs-on: ubuntu-latest
    steps:
      - name: All checks passed
        run: echo "✅ All quality gates passed!"
```

**개선**:

- TypeScript: 4회 → **1회** (75% 감소)
- 총 시간: 15분 → **8분** (47% 감소)
- 비용: $9.6/월 → **$2.4/월** (75% 절감)

---

### 3. 문서-코드 자동 연결 감지 ⚠️ **P2 중요**

**문제**:

```typescript
// 코드 변경
scripts / lib / env - detection.ts; // 업데이트됨

// 관련 문서
docs / ENVIRONMENT_DETECTION_ANALYSIS.md; // 오래됨 ❌

// ❌ 현재: 연결 추적 없음
// ❌ 새 개발자가 오래된 문서 읽고 잘못된 패턴 사용
```

**해결**: Code-Doc Drift Detector

```typescript
// scripts/lib/code-doc-drift-detector.ts
interface DocCodeMapping {
  doc: string;
  relatedFiles: string[];
  lastSync: Date;
}

const mappings: DocCodeMapping[] = [
  {
    doc: "docs/ENVIRONMENT_DETECTION_ANALYSIS.md",
    relatedFiles: [
      "scripts/lib/env-detection.ts",
      ".patterns/cli-mandates.json",
      "scripts/lib/patterns/architecture-invariants.ts",
    ],
    lastSync: new Date("2025-10-01"),
  },
  {
    doc: "docs/ARCHITECTURE_ENFORCEMENT_SYSTEM.md",
    relatedFiles: [
      "scripts/validate-architecture.ts",
      ".migration/progress.json",
    ],
    lastSync: new Date("2025-10-01"),
  },
];

async function detectDrift(): Promise<Drift[]> {
  const drifts: Drift[] = [];

  for (const mapping of mappings) {
    // 코드 최종 수정일 확인
    const codeModified = await getLastModified(mapping.relatedFiles);

    // 문서 최종 수정일 확인
    const docModified = await getLastModified([mapping.doc]);

    // 코드가 더 최신이면 drift 감지
    if (codeModified > docModified) {
      drifts.push({
        doc: mapping.doc,
        staleDays: Math.floor(
          (Date.now() - docModified.getTime()) / (1000 * 60 * 60 * 24),
        ),
        relatedChanges: mapping.relatedFiles.filter(
          (f) => getLastModified([f]) > docModified,
        ),
      });
    }
  }

  return drifts;
}
```

**CI 통합**:

```yaml
# unified-quality-gate.yml에 추가
- name: Check Doc-Code Sync
  run: |
    npm run docs:drift-check
    # → ⚠️ Warning if drift > 7 days
    # → ❌ Error if drift > 30 days
```

---

### 4. Realtime Drift Detection (Proactive) ⚡ **P2 혁신**

**현재**: 문제를 사후에 발견 (PR/CI에서)

**제안**: 실시간 감지

```typescript
// scripts/realtime-drift-watcher.ts
import chokidar from "chokidar";

// 감시 대상
const watchTargets = {
  patterns: ".patterns/**/*.json",
  env: ".env*",
  governance: "governance-rules.json",
  scripts: "scripts/**/*.ts",
};

// 감시 시작
const watcher = chokidar.watch(Object.values(watchTargets), {
  persistent: true,
});

watcher.on("change", async (path) => {
  console.log(`🔍 Detected change: ${path}`);

  // 1. 즉시 Architecture 검증
  const violations = await quickValidate(path);

  if (violations.length > 0) {
    // 2. 개발자에게 즉시 알림
    await notifyDeveloper({
      path,
      violations,
      suggestion: "Run /inspect before committing",
    });
  }

  // 3. 관련 문서 drift 체크
  const relatedDocs = findRelatedDocs(path);
  for (const doc of relatedDocs) {
    console.log(`💡 Consider updating: ${doc}`);
  }
});

console.log("👀 Watching for architecture drifts...");
```

**사용법**:

```bash
# 개발 중 백그라운드 실행
npm run drift:watch

# 파일 저장 시 즉시 피드백
# → ⚠️ Pattern violation in env-detection.ts
# → 💡 Consider updating: docs/ENVIRONMENT_DETECTION_ANALYSIS.md
```

---

## 📦 슬래시 명령어 통합 (최종안)

### 현재 (분산됨)

```bash
/inspect     # 진단
/maintain    # 자동 수정
/fix         # 수동 승인
/ship        # 배포

arch:validate    # 별도
patterns:scan    # 별도
migration:status # 별도
```

### 제안 (통합됨)

```bash
# ========================================
# /inspect - 확장
# ========================================
/inspect
  1. TypeScript ✓
  2. ESLint ✓
  3. Tests ✓
  4. Architecture Invariants ← NEW
  5. Pattern Compliance ← NEW
  6. Migration Status ← NEW
  7. Code-Doc Drift ← NEW
  8. Workarounds

# ========================================
# /fix - 확장
# ========================================
/fix
  - TypeScript errors
  - Workarounds
  - Architecture violations (auto-fixable) ← NEW

# ========================================
# /refactor - 확장
# ========================================
/refactor
  - Structural improvements
  - Architecture re-validation ← NEW (즉시)
  - Pattern compliance ← NEW

# ========================================
# /ship - 확장
# ========================================
/ship
  1. Validation
  2. Architecture health ← NEW
  3. Migration completeness ← NEW
  4. Docs sync
  5. Git push
```

### 구현

```typescript
// scripts/inspection-engine.ts
async function runInspection() {
  console.log("🔍 Running comprehensive inspection...\n");

  const results = {
    typescript: await checkTypeScript(),
    eslint: await checkESLint(),
    tests: await runTests(),

    // NEW: Architecture 통합
    architecture: await validateArchitecture(),
    patterns: await scanPatterns(),
    migrations: await checkMigrations(),
    docDrift: await detectDocDrift(),

    workarounds: await detectWorkarounds(),
  };

  // Architecture P0 위반 시 healthScore 대폭 하락
  let healthScore = 100;

  if (results.architecture.p0 > 0) {
    healthScore -= 30; // P0는 치명적
  }
  if (results.patterns.violations > 0) {
    healthScore -= 10;
  }
  if (results.migrations.incomplete > 0) {
    healthScore -= 20;
  }
  if (results.docDrift.staleDays > 7) {
    healthScore -= 5;
  }

  results.healthScore = Math.max(0, healthScore);

  // 캐시에 저장
  saveInspectionCache(results);

  return results;
}
```

---

## 🚀 실행 계획

### Phase 1: 즉시 (오늘)

```bash
✅ 1. Architecture Validator 자기 위반 수정
✅ 2. Migration Tracker 상태 수정
✅ 3. Deprecated 파일 차단 (ESM 호환)
✅ 4. Pre-commit hook 우회 방지
```

### Phase 2: 이번 주

```bash
☐ 5. CI 워크플로우 통합 (unified-quality-gate.yml)
☐ 6. /inspect에 Architecture 통합
☐ 7. /refactor에 Architecture 재검증 추가
☐ 8. Auto-fix 구현
```

### Phase 3: 이번 달

```bash
☐ 9. Code-Doc Drift Detector
☐ 10. Pattern Registry Schema 생성
☐ 11. Realtime Drift Watcher (선택)
☐ 12. Architecture Dashboard (시각화)
```

---

## 📊 성공 지표

### 정량적

- CI 실행 시간: 15분 → **8분** (목표)
- CI 비용: $9.6/월 → **$2.4/월** (목표)
- P0 위반: 8건 → **0건** (목표)
- 문서 drift: 알 수 없음 → **추적 가능** (목표)

### 정성적

- ✅ 새 개발자가 deprecated 파일 참조 불가
- ✅ 리팩토링 후 즉시 아키텍처 검증
- ✅ 문서-코드 불일치 자동 감지
- ✅ "내 컴퓨터에선 되는데요" 문제 근절

---

## 🎯 최종 목표

**"실수할 수 없는 시스템"** 완성:

1. ✅ **로컬**: Pre-commit hook (빠른 피드백)
2. ✅ **서버**: Branch Protection (강제 차단)
3. ✅ **CI**: Unified Quality Gate (효율적 검증)
4. ✅ **실시간**: Drift Watcher (사전 예방)
5. ✅ **통합**: 슬래시 명령어 (UX 일관성)

**결과**: 재발 가능성 **구조적으로 제거**

---

## 참고 문서

- `docs/CRITICAL_ISSUES_AND_IMPROVEMENTS.md` - 문제 분석
- `docs/ENVIRONMENT_DETECTION_ANALYSIS.md` - 근본 원인
- `docs/ARCHITECTURE_ENFORCEMENT_SYSTEM.md` - 사용 가이드
- `.github/BRANCH_PROTECTION.md` - GitHub 설정

---

**핵심**:
_"뼈대 + 표피 + 동맥 + 신경망 = 완전한 유기체"_
_"각 부분이 독립적이면서도 긴밀히 연결됨"_
