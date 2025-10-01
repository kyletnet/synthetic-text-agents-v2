# Environment Detection System - 근본적 분석 및 개선안

**작성일**: 2025-10-01
**배경**: `/fix` 실행 시 readline hang 이슈 해결 과정에서 시스템 전체의 구조적 문제 발견

---

## 문제 1: 현재 해결책의 설계 취약점

### 발견된 문제

#### A. 불완전한 적용 범위

- **환경 감지 로직이 필요한 파일**: 8개
  - `fix-engine.ts` ✅ (수정 완료)
  - `simplified-approval-system.ts` ✅ (수정 완료)
  - `test-readline-approval.ts` ✅ (수정 완료)
  - `approve-queue.ts` ❌ (미적용)
  - `interactive-approval-handler.ts` ❌ (미적용, 구식 isTTY만 체크)
  - `interactive-maintenance-handler.ts` ❌ (미적용)
  - `snapshot-browser.ts` ❌ (미적용)
  - `workflow-gap-detector.ts` ❌ (미적용)

**재발 위험**: 나머지 5개 파일에서 동일한 hang 문제 발생 가능

#### B. 검증 룰의 한계

현재 `design-validator.ts`의 룰:

```typescript
if (content.includes("process.stdin") && content.match(/readline|createInterface/)) {
  const hasEnvDetection = content.includes("detectEnvironment") || ...
  // ... 경고
}
```

**문제**:

- 정적 분석만 가능 (런타임 검증 불가)
- 파일 단위 체크만 가능 (아키텍처 전체 일관성 검증 불가)
- 위반 시 경고만 출력 (강제 차단 불가)

#### C. 명령어 체계 변경 시 재발 시나리오

**시나리오 1: 새 대화형 스크립트 추가**

```bash
# 개발자가 새로운 승인 스크립트 작성
scripts/new-approval-engine.ts
  → readline 사용
  → detectEnvironment() import 깜빡함
  → design-validator 경고 (차단은 안 됨)
  → 배포 후 hang 발생
```

**시나리오 2: 환경 변수 변경**

```bash
# Claude Code가 환경 변수를 변경
CLAUDECODE=1 → CLAUDE_CLI=1
  → env-detection.ts만 업데이트
  → 5개 미적용 파일은 여전히 구식 체크
  → 불일치 발생
```

**시나리오 3: 새로운 실행 환경 추가**

```bash
# GitHub Codespaces, Replit 등
  → 각자 다른 환경 변수
  → env-detection.ts에 추가 필요
  → 레거시 파일들은 업데이트 안 됨
```

---

## 문제 2: 미사용 코드/레거시 감지 시스템

### 현재 존재하는 메커니즘

#### A. Governance Rules (`governance-rules.json`)

```json
{
  "deprecatedFiles": [
    {
      "path": "scripts/unified-dashboard.ts",
      "replacement": "npm run status",
      "reason": "캐시 기반 아키텍처로 전환",
      "deprecatedSince": "2025-10-01"
    }
    // ... 6개 deprecated 파일
  ]
}
```

**평가**:

- ✅ 중앙 집중식 레지스트리
- ✅ 대체 방법 명시
- ❌ **자동 감지 없음** (수동 등록 필요)
- ❌ **사용처 추적 없음** (어디서 import되는지 모름)

#### B. Legacy Import Checker (`check-legacy-imports.ts`)

```typescript
check(filePath: string): LegacyImportWarning[]
```

**평가**:

- ✅ Import 감지 가능
- ❌ **수동 실행 필요** (자동 CI 통합 없음)
- ❌ **경고만 출력** (차단 불가)
- ❌ **코드 패턴은 감지 못함** (import는 없지만 동일 로직 중복)

#### C. Document Lifecycle Manager (`doc-lifecycle-manager.ts`)

```typescript
type DocStatus = "active" | "archived" | "deprecated";
```

**평가**:

- ✅ 문서 lifecycle 관리
- ❌ **코드 파일은 관리 안 됨**
- ❌ **문서-코드 연결 추적 없음**

### 문제점 종합

**지금 발생한 환경 감지 이슈처럼:**

1. 5개 파일에 구식 `isTTY` 체크만 존재
2. `detectEnvironment()` 중앙 유틸리티 생성
3. 3개 파일만 마이그레이션
4. 나머지 5개는 **아무도 몰랐음**

**왜?**

- ❌ 자동 감지 없음
- ❌ 마이그레이션 추적 없음
- ❌ 패턴 일관성 검증 없음

---

## 근본적 개선안

### Phase 1: 강제 적용 (즉시)

#### 1.1 남은 5개 파일 수정

```bash
scripts/approve-queue.ts
scripts/interactive-approval-handler.ts
scripts/interactive-maintenance-handler.ts
scripts/snapshot-browser.ts
scripts/workflow-gap-detector.ts
```

**액션**: 모두 `detectEnvironment()` 사용하도록 수정

#### 1.2 Design Validator 강화

```typescript
// BEFORE: 경고만
this.addViolation({ severity: "P0", ... });

// AFTER: 차단
if (!hasEnvDetection) {
  throw new Error(`BLOCKED: ${file} must use detectEnvironment()`);
}
```

**액션**: `design-validator.ts` 업데이트

#### 1.3 Pre-commit Hook 추가

```bash
#!/bin/bash
# .git/hooks/pre-commit
npm run design:validate || {
  echo "❌ Design validation failed"
  exit 1
}
```

**액션**: Git hook 설치

---

### Phase 2: 자동 감지 시스템 (1주 내)

#### 2.1 Pattern Registry 생성

```typescript
// scripts/lib/pattern-registry.ts
interface CodePattern {
  id: string;
  name: string;
  antipattern: RegExp;
  correctPattern: string;
  examples: {
    wrong: string;
    correct: string;
  };
  enforcement: "error" | "warning";
  autofix?: (code: string) => string;
}

const PATTERNS: CodePattern[] = [
  {
    id: "ENV_DETECTION_READLINE",
    name: "Environment Detection for readline",
    antipattern: /process\.stdin\.isTTY(?!.*detectEnvironment)/,
    correctPattern:
      "import { detectEnvironment } from './lib/env-detection.js'",
    enforcement: "error",
    autofix: (code) => {
      // ... 자동 수정 로직
    },
  },
  // ... 더 많은 패턴
];
```

**목적**:

- 모든 "올바른 패턴"을 중앙 관리
- 위반 시 자동 감지
- 가능하면 자동 수정

#### 2.2 Pattern Scanner (CI 통합)

```bash
npm run patterns:scan    # 전체 스캔
npm run patterns:fix     # 자동 수정
```

**구현**:

```typescript
class PatternScanner {
  scan(patterns: CodePattern[]): Violation[] {
    // 전체 codebase 스캔
    // antipattern 발견 시 위반 기록
    // autofix 가능하면 제안
  }

  enforce(violations: Violation[]): void {
    // enforcement="error"면 throw
    // enforcement="warning"이면 log
  }
}
```

#### 2.3 Legacy Migration Tracker

```json
// .migration-registry.json
{
  "migrations": [
    {
      "id": "ENV_DETECTION_2025_10",
      "name": "Centralized Environment Detection",
      "fromPattern": "process.stdin.isTTY",
      "toPattern": "detectEnvironment()",
      "status": "in_progress",
      "progress": {
        "total": 8,
        "completed": 3,
        "remaining": [
          "scripts/approve-queue.ts",
          "scripts/interactive-approval-handler.ts",
          "..."
        ]
      },
      "deadline": "2025-10-15",
      "criticalityReasons": [
        "Prevents hang in Claude Code",
        "Ensures consistent behavior across environments"
      ]
    }
  ]
}
```

**기능**:

- 마이그레이션 진행률 추적
- 완료되지 않은 파일 자동 감지
- 데드라인 알림

---

### Phase 3: 아키텍처 일관성 검증 (1개월 내)

#### 3.1 Architecture Invariants

```typescript
// scripts/lib/architecture-invariants.ts
interface ArchitectureRule {
  id: string;
  description: string;
  check: (codebase: Codebase) => Violation[];
}

const INVARIANTS: ArchitectureRule[] = [
  {
    id: "SINGLE_ENV_DETECTION",
    description: "All environment detection MUST use env-detection.ts",
    check: (codebase) => {
      const violations = [];
      for (const file of codebase.files) {
        if (file.usesReadline() && !file.imports("env-detection.ts")) {
          violations.push({ file, reason: "Missing env-detection import" });
        }
      }
      return violations;
    },
  },
  {
    id: "NO_DUPLICATE_LOGIC",
    description: "No duplicate environment detection logic",
    check: (codebase) => {
      // AST 분석으로 중복 로직 감지
      // process.env.CLAUDECODE 직접 체크하는 코드 발견 시 위반
    },
  },
  {
    id: "CONSISTENT_MIGRATION",
    description: "All files using old pattern must migrate together",
    check: (codebase) => {
      const oldPattern = codebase.filesMatching(/process\.stdin\.isTTY/);
      const newPattern = codebase.filesImporting("env-detection.ts");

      if (oldPattern.length > 0 && newPattern.length > 0) {
        // 중간 상태 감지 (일부만 마이그레이션됨)
        return [
          {
            reason: "Incomplete migration detected",
            files: oldPattern,
          },
        ];
      }
    },
  },
];
```

#### 3.2 Continuous Invariant Checking

```bash
# CI에서 매 커밋마다 실행
npm run arch:validate

# 로컬에서 pre-commit hook
.git/hooks/pre-commit:
  npm run arch:validate:quick
```

---

### Phase 4: 자가 진화 시스템 (장기)

#### 4.1 Pattern Learning

```typescript
// AI가 코드 변경 패턴 학습
class PatternLearner {
  async learnFromHistory(): Promise<CodePattern[]> {
    // Git history 분석
    // 반복되는 리팩토링 패턴 감지
    // 새로운 pattern registry 항목 제안
  }
}
```

#### 4.2 Auto-deprecation Detection

```typescript
// 사용되지 않는 코드 자동 감지
class DeprecationDetector {
  async detectUnusedExports(): Promise<DeprecatedFile[]> {
    // TypeScript 타입 그래프 분석
    // import되지 않는 export 감지
    // 90일 이상 변경 없으면 deprecated 제안
  }
}
```

#### 4.3 Self-healing Architecture

```typescript
// 아키텍처 위반 자동 수정
class ArchitectureHealer {
  async autofix(violations: Violation[]): Promise<void> {
    // 간단한 위반은 자동 수정 (PR 생성)
    // 복잡한 위반은 이슈 생성
    // 우선순위 기반 수정 스케줄링
  }
}
```

---

## 실행 계획

### Week 1 (즉시)

- [ ] 남은 5개 파일 `detectEnvironment()` 적용
- [ ] Design validator 강제 차단 모드 추가
- [ ] Pre-commit hook 설치
- [ ] CI에 pattern scan 추가

### Week 2

- [ ] Pattern Registry 구현
- [ ] Legacy Migration Tracker 구현
- [ ] `.migration-registry.json` 생성 및 현재 상태 등록

### Week 3-4

- [ ] Architecture Invariants 구현
- [ ] CI 통합 및 테스트
- [ ] 문서 업데이트

### Month 2+

- [ ] Pattern Learning 프로토타입
- [ ] Auto-deprecation Detection
- [ ] Self-healing 실험

---

## 결론

### 질문 1: 지금 해결책이 근본적인가?

**답**: ❌ **아니오**

- ✅ 3개 파일만 수정 (5개는 미적용)
- ✅ 중앙 유틸리티는 만들었지만
- ❌ **자동 적용/검증 메커니즘 없음**
- ❌ **재발 방지 시스템 없음**

### 질문 2: 전체 시스템 레거시 감지는?

**답**: ⚠️ **부분적으로만 존재**

**존재하는 것**:

- ✅ `governance-rules.json` (deprecated files)
- ✅ `doc-lifecycle-manager.ts` (문서만)
- ✅ `check-legacy-imports.ts` (import만)

**부족한 것**:

- ❌ 코드 패턴 중복 감지
- ❌ 마이그레이션 진행률 추적
- ❌ 아키텍처 일관성 검증
- ❌ 자동 cleanup

### 권장 사항

1. **즉시**: Phase 1 실행 (나머지 5개 파일 수정 + 강제 검증)
2. **이번 주**: Phase 2 설계 (Pattern Registry + Migration Tracker)
3. **이번 달**: Phase 3 구현 (Architecture Invariants)
4. **장기**: Phase 4 연구 (AI 기반 자가 진화)

---

**핵심 교훈**:
시스템은 **"한 번 고치면 끝"이 아니라**, **"지속적으로 일관성을 유지하는 메커니즘"**이 필요합니다.

지금처럼 수동으로 파일 3개 고치는 것은 **증상 치료**이고,
Pattern Registry + Invariant Checking이 **근본 치료**입니다.
