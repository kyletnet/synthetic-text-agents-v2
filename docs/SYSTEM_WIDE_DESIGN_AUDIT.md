# 시스템 전반 근본 설계 감사

**작성일**: 2025-10-01
**목적**: 명령어/코드/CI/거버넌스/문서/워크플로우 전 계층 일관성 검증

---

## 🔴 치명적 발견 사항 (즉시 수정 필요)

### 1. 명령어 단 - 구조적 불일치

#### 문제 A: 중복 명령어

```json
// package.json
{
  "arch:validate": "tsx scripts/validate-architecture.ts",
  "patterns:scan": "tsx scripts/validate-architecture.ts" // 똑같음!
}
```

**치명도**: 🟡 P1
**영향**: 사용자 혼란, 문서 불일치
**해결**: `patterns:scan` 제거 또는 명확한 별칭으로 문서화

#### 문제 B: SlashCommand 체계 불완전

```json
// 현재
"/inspect": "...",   ✅ 4단계 워크플로우
"/maintain": "...",  ✅
"/fix": "...",       ✅
"/ship": "...",      ✅

"arch:validate": "..."  ❌ 체계 밖
"migration:status": "..." ❌ 체계 밖
```

**치명도**: 🔴 P0
**영향**:

- 워크플로우 일관성 깨짐
- 사용자가 언제 무엇을 써야 할지 모름
- `/inspect`에서 Architecture 검증 안 함

**해결**:

```json
{
  "/inspect": "tsx scripts/inspection-engine.ts --with-arch",

  // 내부 명령어 (고급 사용자용)
  "_arch:validate": "tsx scripts/validate-architecture.ts",
  "_migration:status": "cat .migration/progress.json | jq '.statistics'"
}
```

---

### 2. 코드 단 - Governance 미적용

#### 문제: 6개 엔진이 GovernanceRunner 미사용

```bash
✅ Using GovernanceRunner:
- fix-engine.ts
- inspection-engine.ts
- maintain-engine.ts
- refactor-engine.ts
- refactor-preview-engine.ts
- verify-engine.ts

❌ NOT using GovernanceRunner:
- ai-fix-engine.ts                    # AI 기반 자동 수정
- architectural-evolution-engine.ts   # 아키텍처 진화
- design-principle-engine.ts          # 설계 원칙 검증
- integration-improvement-engine.ts   # 통합 개선
- optimization-engine.ts              # 최적화
- validate-engine.ts                  # 검증 엔진
```

**치명도**: 🔴 P0
**영향**:

- 이 6개 엔진은 **스냅샷/롤백/검증 없이** 실행됨
- Architecture 위반 코드 생성 가능
- Governance 정책 우회 가능
- 감사 추적(audit trail) 없음

**예시 시나리오 (재앙적)**:

```bash
# 1. 사용자가 AI 자동 수정 실행
npm run fix:ai

# 2. ai-fix-engine이 코드 수정
# → GovernanceRunner 없음
# → 스냅샷 없음
# → Architecture 검증 없음

# 3. deprecated 파일 수정됨
# → 감지 안 됨

# 4. Pattern 위반 코드 생성
# → 차단 안 됨

# 5. 커밋
# → Pre-commit hook만 차단 (우회 가능)

# 6. 시스템 붕괴
```

**해결**:

```typescript
// ai-fix-engine.ts
import { GovernanceRunner } from "./lib/governance/governance-runner.js";

const governance = new GovernanceRunner(process.cwd());

await governance.executeWithGovernance(
  async () => {
    // AI 수정 로직
    await performAIFix();
  },
  {
    operation: "ai-fix",
    requiresApproval: true, // AI 수정은 항상 승인 필요
  },
);
```

---

### 3. 코드 단 - Architecture 통합 누락

#### 문제: /inspect가 Architecture를 검증하지 않음

```typescript
// scripts/inspection-engine.ts 현재 상태
async function runInspection() {
  const results = {
    typescript: await checkTypeScript(),
    eslint: await checkESLint(),
    tests: await runTests(),
    workarounds: await detectWorkarounds(),
    // ❌ architecture: await validateArchitecture(),  // 없음!
  };
}
```

**치명도**: 🔴 P0
**영향**:

- 개발자가 `/inspect` 실행 → "모든 검사 통과" 메시지
- 하지만 Architecture 위반이 숨어있음
- CI에서 차단됨
- "내 컴퓨터에선 되는데요" 문제

**해결**:

```typescript
async function runInspection() {
  const results = {
    typescript: await checkTypeScript(),
    eslint: await checkESLint(),
    tests: await runTests(),

    // NEW: Architecture 통합
    architecture: await validateArchitecture(),
    patterns: await scanPatterns(),
    migrations: await checkMigrationStatus(),

    workarounds: await detectWorkarounds(),
  };

  // Architecture P0 위반 시 healthScore 대폭 하락
  if (results.architecture?.p0 > 0) {
    results.healthScore -= 30;
  }
}
```

---

### 4. CI/CD 단 - 중복 및 누락

#### 문제 A: TypeScript 중복 실행

```yaml
# ci.yml
- name: TypeScript Check
  run: npm run typecheck

# architecture-validation.yml
- name: TypeScript Compilation
  run: npm run typecheck # 또 실행!
```

**치명도**: 🟡 P1
**영향**: CI 시간 2배, 비용 2배
**해결**: unified-quality-gate.yml 생성 (Phase 2)

#### 문제 B: Architecture 검증 누락

```yaml
# gap-prevention.yml에는 Architecture 검증 없음
# doc-quality-gate.yml에도 없음
```

**치명도**: 🔴 P0
**영향**: 일부 워크플로우에서 Architecture 위반 통과
**해결**: 모든 워크플로우에 Architecture 검증 필수화

---

### 5. 거버넌스 단 - 연결 미약

#### 문제: Pattern Registry ↔ governance-rules.json 연결 부재

```json
// .patterns/cli-mandates.json
{
  "patterns": [
    {
      "id": "ENV_DETECTION_READLINE",
      "enforcement": "error"
    }
  ]
}

// governance-rules.json
{
  "rules": [
    {
      "id": "CHECK_ENVIRONMENT_BEFORE_STDIN",
      // ❌ 문제: Pattern Registry와 ID 다름!
      // ❌ 문제: 어느 것이 SSOT인가?
    }
  ]
}
```

**치명도**: 🔴 P0
**영향**:

- 정책 충돌 가능
- 어느 것을 따라야 할지 모름
- 한쪽 업데이트 시 다른 쪽 미동기화

**해결**:

```json
// governance-rules.json이 SSOT
{
  "rules": [...],
  "patterns": {
    "$ref": ".patterns/cli-mandates.json"  // 참조만
  }
}

// 또는
// Pattern Registry를 governance-rules.json 안으로 통합
{
  "rules": [...],
  "architecturePatterns": [...]  // Pattern Registry 통합
}
```

---

### 6. 문서 단 - 자동 추적 미구현

#### 문제: 문서-코드 연결이 수동

```markdown
<!-- docs/ENVIRONMENT_DETECTION_ANALYSIS.md -->

관련 코드: `scripts/lib/env-detection.ts`

❌ 문제: 이 연결이 텍스트로만 존재
❌ 문제: env-detection.ts가 삭제되어도 감지 안 됨
❌ 문제: 파일 이름 변경 시 끊어짐
```

**치명도**: 🟡 P1
**영향**: 문서 오래됨, 신뢰도 하락
**해결**:

```json
// .docrc.json (새 제안)
{
  "docs": [
    {
      "path": "docs/ENVIRONMENT_DETECTION_ANALYSIS.md",
      "type": "technical-analysis",
      "relatedCode": [
        "scripts/lib/env-detection.ts",
        ".patterns/cli-mandates.json"
      ],
      "autoSyncEnabled": true,
      "lastVerified": "2025-10-01"
    }
  ]
}
```

---

### 7. 워크플로우 단 - 단계별 Architecture 검증 부재

#### 문제: /refactor가 Architecture를 재검증하지 않음

```typescript
// scripts/refactor-engine.ts
async function refactor() {
  await performRefactoring();

  // ❌ Architecture 재검증 없음!
  // → 리팩토링이 패턴 위반할 수 있음
}
```

**치명도**: 🔴 P0
**영향**:

- 리팩토링 후 Architecture 위반 발생 가능
- `/ship`에서 차단됨
- 개발자 시간 낭비

**해결**:

```typescript
async function refactor() {
  // 1. Before 스냅샷
  const before = await captureState();

  // 2. 리팩토링 실행
  await performRefactoring();

  // 3. Architecture 즉시 검증
  const violations = await validateArchitecture();

  if (violations.p0 > 0) {
    // 4. 자동 롤백 또는 수정
    await rollbackOrFix(before, violations);
  }

  // 5. 최종 재검증
  await validateArchitecture();
}
```

---

## 📊 계층별 완성도

| 계층              | 현재 | 문제                       | 목표 |
| ----------------- | ---- | -------------------------- | ---- |
| **명령어 단**     | 60%  | 중복, SlashCommand 미통합  | 95%  |
| **코드 단**       | 65%  | 6개 엔진 Governance 미적용 | 98%  |
| **CI/CD 단**      | 70%  | 중복 실행, 일부 누락       | 95%  |
| **거버넌스 단**   | 75%  | Pattern Registry 연결 미약 | 98%  |
| **문서 단**       | 30%  | 자동 추적 없음             | 90%  |
| **워크플로우 단** | 70%  | Architecture 재검증 부재   | 95%  |

**전체 평균**: 61.7% → **목표**: 95%

---

## 🛠️ 근본 설계 원칙 (재정의)

### 원칙 1: Single Source of Truth (SSOT)

```
governance-rules.json
    ↓
├─ Pattern Registry (.patterns/*)
├─ Migration Tracker (.migration/*)
├─ Architecture Invariants
├─ Design Validator
└─ All Engines

모든 정책은 governance-rules.json에서 파생
```

### 원칙 2: Defense in Depth (다층 방어)

```
Layer 1 (IDE):     실시간 피드백
Layer 2 (Code):    GovernanceRunner (모든 엔진)
Layer 3 (Pre-commit): Architecture + Design
Layer 4 (CI):      Unified Quality Gate
Layer 5 (Server):  Branch Protection (우회 불가)
```

**현재 문제**: Layer 2가 50% 구멍 (6개 엔진 미적용)

### 원칙 3: Fail Fast, Fail Loud

```
/inspect → Architecture 위반 즉시 표시
/refactor → 리팩토링 후 즉시 재검증
/fix → 수정 후 즉시 검증
/ship → 최종 gating

모든 단계에서 Architecture 검증
```

**현재 문제**: /inspect, /refactor에서 검증 없음

### 원칙 4: Self-Healing Architecture

```
위반 감지 → Auto-fix 시도 → 실패 시 롤백
```

**현재 문제**: Auto-fix 미구현

### 원칙 5: Continuous Verification

```
코드 변경 → 즉시 검증 (Drift Watcher)
문서 변경 → 관련 코드 체크 (Drift Detector)
정책 변경 → 전체 재검증
```

**현재 문제**: 사후 검증만 (CI), 실시간 없음

---

## 🚨 즉시 조치 필요 (P0)

### 1. 6개 엔진에 GovernanceRunner 적용

```typescript
// ai-fix-engine.ts, architectural-evolution-engine.ts 등
import { GovernanceRunner } from "./lib/governance/governance-runner.js";

const governance = new GovernanceRunner(process.cwd());
await governance.executeWithGovernance(
  async () => {
    // 기존 로직
  },
  { operation: "operation-name" },
);
```

**예상 소요**: 2시간
**우선순위**: 🔴 최우선

---

### 2. /inspect에 Architecture 통합

```typescript
// scripts/inspection-engine.ts
import { validateArchitecture } from "./validate-architecture.js";

async function runInspection() {
  const results = {
    // 기존...
    architecture: await validateArchitecture(),
    patterns: await scanPatterns(),
    migrations: await checkMigrations(),
  };
}
```

**예상 소요**: 1시간
**우선순위**: 🔴 최우선

---

### 3. /refactor에 재검증 추가

```typescript
// scripts/refactor-engine.ts
async function refactor() {
  await performRefactoring();

  // NEW: 즉시 검증
  const violations = await validateArchitecture();
  if (violations.p0 > 0) {
    await handleViolations(violations);
  }
}
```

**예상 소요**: 1시간
**우선순위**: 🔴 P0

---

### 4. 명령어 정리

```json
// package.json
{
  "scripts": {
    // === 사용자 명령어 (SlashCommand) ===
    "/inspect": "tsx scripts/inspection-engine.ts",
    "/maintain": "tsx scripts/maintain-engine.ts",
    "/fix": "tsx scripts/fix-engine.ts",
    "/refactor": "tsx scripts/refactor-engine.ts",
    "/ship": "npm run prepare-release",

    // === 별칭 (하위 호환) ===
    "status": "npm run /inspect",
    "maintain": "npm run /maintain",
    "fix": "npm run /fix",
    "refactor": "npm run /refactor",
    "ship": "npm run /ship",

    // === 내부 명령어 (고급 사용자/CI) ===
    "_arch:validate": "tsx scripts/validate-architecture.ts",
    "_arch:fix": "tsx scripts/validate-architecture.ts --fix",
    "_migration:status": "cat .migration/progress.json | jq '.statistics'"

    // === patterns:scan 제거 (중복) ===
    // "patterns:scan": "...",  // REMOVED
  }
}
```

**예상 소요**: 30분
**우선순위**: 🟡 P1

---

## 📋 Phase 2 작업 (이번 주)

### 5. unified-quality-gate.yml 생성

단일 워크플로우로 통합:

- TypeScript (1회만)
- ESLint
- Architecture
- Tests
- GAP Scanner
- Doc Quality

**예상 효과**:

- CI 시간: 15분 → 8분
- 비용: 75% 절감

---

### 6. governance-rules.json 통합

Pattern Registry를 governance로 통합:

```json
{
  "rules": [...],
  "architecturePatterns": [
    // .patterns/cli-mandates.json 내용 이동
  ],
  "deprecatedFiles": [...],
  "migrationTracking": {
    "$ref": ".migration/progress.json"
  }
}
```

---

### 7. .docrc.json 구현

```json
{
  "docs": [
    {
      "path": "docs/ENVIRONMENT_DETECTION_ANALYSIS.md",
      "relatedCode": ["scripts/lib/env-detection.ts"],
      "autoSync": true
    }
  ]
}
```

---

## 📈 Phase 3 작업 (이번 달)

### 8. Realtime Drift Watcher

```bash
npm run drift:watch
→ 파일 저장 시 즉시 Architecture 검증
```

### 9. Auto-fix 구현

```bash
npm run arch:fix
→ 실제로 자동 수정
```

### 10. Architecture Dashboard

```bash
npm run arch:dashboard
→ 웹 기반 시각화
```

---

## 🎯 최종 목표

### 근본 설계 완성도: 95%

모든 계층이 다음 조건 만족:

- ✅ SSOT에서 파생
- ✅ 다층 방어
- ✅ Fail Fast
- ✅ Self-Healing
- ✅ Continuous Verification

---

## 📊 실행 우선순위

| 작업                       | 우선순위 | 소요 | 영향도 |
| -------------------------- | -------- | ---- | ------ |
| 6개 엔진 Governance 적용   | 🔴 P0    | 2h   | 치명적 |
| /inspect Architecture 통합 | 🔴 P0    | 1h   | 치명적 |
| /refactor 재검증           | 🔴 P0    | 1h   | 치명적 |
| 명령어 정리                | 🟡 P1    | 30m  | 높음   |
| unified-quality-gate       | 🟡 P1    | 3h   | 높음   |
| .docrc.json                | 🟢 P2    | 2h   | 중간   |
| Drift Watcher              | 🟢 P2    | 4h   | 중간   |

---

**핵심 교훈**:

_"시스템의 완성도는 가장 약한 계층에 의해 결정된다"_

현재 가장 약한 계층:

1. **코드 단** (6개 엔진 미적용)
2. **워크플로우 단** (Architecture 재검증 부재)
3. **문서 단** (자동 추적 없음)

→ 이 3가지 먼저 해결해야 85% → 95% 도약 가능
