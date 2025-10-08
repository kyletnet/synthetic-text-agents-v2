# 근본 원인 분석 보고서

**날짜**: 2025-10-07
**분석 범위**: TypeScript 오류 22개, ESLint 오류 12개, 아키텍처 위반 4건
**Health Score**: 60/100

---

## Executive Summary

Phase 7 LinguisticsEngineer 리팩토링 과정에서 **타입 정의와 실제 구현이 동기화되지 않아** TypeScript 컴파일 오류가 발생했습니다. 실제 런타임 동작은 정상이지만, 타입 안정성이 손상된 상태입니다.

### 핵심 문제

1. **타입 불일치 (22개 오류)**: Phase 7 리팩토링에서 구현은 변경되었으나 타입 정의 미업데이트
2. **DDD 위반 (4건)**: Application 계층이 Infrastructure 세부사항을 직접 import
3. **ESLint 오류 (12개)**: 중복 import, throw literal 등 코드 스타일 문제

---

## 문제 1: LinguisticsEngineer 타입 불일치

### 근본 원인

**Phase 7 리팩토링** (2025-10-07 완료)에서:

- ✅ **구현 변경**: `structure-analysis.ts`가 새로운 필드 반환
- ❌ **타입 정의**: `linguistics-types.ts` 업데이트 누락
- ⚠️ **사용 코드**: `linguistics-engineer-service.ts`가 새 필드 사용하지만 타입 체크 실패

### 타입 불일치 세부 사항

#### A. LanguageQuality 타입 불일치

**타입 정의** (`src/domain/agents/linguistics-types.ts:44-60`):

```typescript
export interface LanguageQuality {
  clarity: {
    score: number;
    improvements: string[];
    readabilityLevel: string;
  };
  consistency: {
    score: number;
    terminologyAlignment: string[];
    styleConsistency: string[]; // ❌ 실제 구현과 불일치
  };
  precision: {
    score: number;
    ambiguityDetection: string[]; // ❌ 실제 구현과 불일치
    clarityRecommendations: string[];
  };
  // ❌ naturalness 필드 누락!
}
```

**실제 구현** (`src/domain/agents/linguistics-strategies/structure-analysis.ts:114-128`):

```typescript
private async analyzeLanguageQuality(
  request: LinguisticsAnalysisRequest,
): Promise<LanguageQuality> {
  const clarity = await this.assessClarity(request);
  const consistency = await this.assessConsistency(request);
  const precision = await this.assessPrecision(request);
  const naturalness = await this.assessNaturalness(request);  // ✅ 구현에 존재

  return {
    clarity,
    consistency,
    precision,
    naturalness,  // ❌ 타입 정의에 없음!
  };
}
```

**실제 반환 구조** (`structure-analysis.ts:167-203`):

```typescript
// consistency 실제 반환
{
  score: number,
  terminologyAlignment: string[],
  styleCoherence: string[]  // ❌ 타입 정의는 styleConsistency
}

// precision 실제 반환
{
  score: number,
  specificityEnhancements: string[],  // ❌ 타입 정의는 ambiguityDetection
  ambiguityReduction: string[]        // ❌ 타입 정의는 clarityRecommendations
}
```

**영향받는 파일**:

- `src/application/agents/linguistics-engineer-service.ts:117` - `languageQuality.naturalness` 접근 불가
- `src/application/agents/linguistics-engineer-service.ts:141` - `languageQuality.naturalness` 접근 불가
- `src/application/agents/linguistics-engineer-service.ts:155` - `languageQuality.naturalness` 접근 불가
- `src/domain/agents/linguistics-strategies/structure-analysis.ts:367` - 타입 체크 실패

#### B. LinguisticsEngineerOutput 타입 불일치

**타입 정의** (`src/domain/agents/linguistics-types.ts:91-98`):

```typescript
export interface LinguisticsEngineerOutput {
  llmOptimization: LLMOptimization;
  languageQuality: LanguageQuality;
  terminologyFramework: TerminologyFramework;
  structureOptimization: StructureOptimization; // ❌ 실제 사용하지 않음
  overallRecommendations: string[]; // ❌ 실제 사용하지 않음
  confidence: number; // ❌ 실제 사용하지 않음
}
```

**실제 사용** (`src/application/agents/linguistics-engineer-service.ts:55-61`):

```typescript
const output: LinguisticsEngineerOutput = {
  llmOptimization,
  languageQuality: structureResult.languageQuality,
  terminologyFramework,
  structuralRecommendations: structureResult.structuralRecommendations, // ❌ 타입에 없음!
  performancePredictions: structureResult.performancePredictions, // ❌ 타입에 없음!
  // ❌ structureOptimization, overallRecommendations, confidence 누락
};
```

**영향받는 파일**:

- `src/application/agents/linguistics-engineer-service.ts:59` - `structuralRecommendations` 타입 오류
- `src/application/agents/linguistics-engineer-service.ts:121` - `performancePredictions` 접근 불가
- `src/application/agents/linguistics-engineer-service.ts:157` - `performancePredictions` 접근 불가
- `src/application/agents/linguistics-engineer-service.ts:159` - `performancePredictions` 접근 불가

### 왜 이런 일이 발생했는가?

**Phase 7 리팩토링 과정 (reports/linguistics-engineer-refactoring-phase7.md)**:

1. ✅ **Step 1**: Strategy Pattern 구현 (prompt-optimization, terminology-validation, structure-analysis)
2. ✅ **Step 2**: 구현 완료 및 테스트 작성 (55개 테스트 통과)
3. ❌ **Step 3**: 타입 정의 업데이트 누락

   - `linguistics-types.ts`가 **리팩토링 전 구조**를 그대로 유지
   - 새로운 `structuralRecommendations`, `performancePredictions` 필드 미반영
   - `LanguageQuality`의 `naturalness` 필드 미반영

4. ⚠️ **Step 4**: Application 계층 코드는 새 구조 사용 → 타입 체크 실패

**리팩토링 체크리스트 미완료**:

```
✅ Strategy Pattern 구현
✅ 테스트 작성 (55개)
✅ 서비스 계층 통합
❌ 타입 정의 동기화  ⬅️ 누락!
❌ 타입 체크 검증
```

---

## 문제 2: Policy Interpreter 타입 정의 누락

### 근본 원인

`policy-interpreter.ts`에서 정책 객체의 타입이 `{}`(빈 객체)로 추론되어 속성 접근이 불가능합니다.

**문제 코드** (`src/infrastructure/governance/policy-interpreter.ts:231-286`):

```typescript
// policy 타입이 {}로 추론됨
policy.name; // ❌ Property 'name' does not exist on type '{}'
policy.description; // ❌ Property 'description' does not exist on type '{}'
policy.level; // ❌ Property 'level' does not exist on type '{}'
```

**영향받는 파일**:

- `src/infrastructure/governance/policy-interpreter.ts` (10개 오류)

### 해결 방법

명시적 타입 정의 추가:

```typescript
interface PolicyDefinition {
  name: string;
  description: string;
  level: string;
  type: string;
  condition: unknown;
  action?: unknown;
}
```

---

## 문제 3: DDD 아키텍처 위반

### 근본 원인

**DDD 계층 분리 원칙**: Application 계층은 Infrastructure 세부사항에 직접 의존하면 안 됩니다.

**위반 사례 (dependency-cruiser 검출)**:

1. `src/application/refactoring/audit-orchestrator.ts`

   ```typescript
   import { FileScanner } from "../../infrastructure/refactoring/file-scanner.js";
   // ❌ Application → Infrastructure 직접 의존
   ```

2. `src/application/metrics/threshold-manager-service.ts`

   ```typescript
   import { ReportWriter } from "../../infrastructure/filesystem/report-writer.js";
   // ❌ Application → Infrastructure 직접 의존
   ```

3. `src/application/backup/backup-manager.ts`, `restore-manager.ts`
   ```typescript
   import { FileOperations } from "../../infrastructure/backup/file-operations.js";
   // ❌ Application → Infrastructure 직접 의존
   ```

### 올바른 구조

```typescript
// ✅ Application 계층
import { IFileScanner } from "../../domain/refactoring/file-scanner.interface.js";

// ✅ Infrastructure 계층에서 인터페이스 구현
export class FileScanner implements IFileScanner { ... }

// ✅ 의존성 주입으로 연결 (orchestrator 등에서)
```

---

## 문제 4: ESLint 오류

### 근본 원인

코드 스타일 및 베스트 프랙티스 위반.

**오류 분류**:

1. **중복 import (4건)**:

   ```typescript
   import { A } from "module";
   // ... 중간 코드
   import { B } from "module"; // ❌ no-duplicate-imports
   ```

2. **throw literal (2건)**:

   ```typescript
   throw "error message"; // ❌ no-throw-literal
   // ✅ throw new Error("error message");
   ```

3. **사용하지 않는 변수 (6건)**:
   ```typescript
   catch (error) {  // ❌ 'error' is defined but never used
   ```

---

## 문제 5: file-scanner.ts Promise 타입 오류

### 근본 원인

`src/infrastructure/refactoring/file-scanner.ts:397`에서 비동기 함수 반환값을 동기적으로 사용.

**문제 코드**:

```typescript
const result: string = await someAsyncFunction(); // Promise<string | null>
// ❌ Type 'Promise<string | null>' is not assignable to type 'string'
```

---

## 영향 분석

### 현재 상태

| 항목            | 상태         | 설명                                    |
| --------------- | ------------ | --------------------------------------- |
| **런타임 동작** | ✅ 정상      | 실제 구현은 올바르게 작동               |
| **타입 안정성** | ❌ 손상됨    | TypeScript 타입 체크 실패               |
| **빌드**        | ❌ 실패      | `npm run typecheck` 22개 오류           |
| **테스트**      | ⚠️ 부분 성공 | Unit 테스트는 통과하지만 타입 체크 실패 |
| **배포 준비도** | ❌ 불가      | 타입 오류 해결 필수                     |

### Health Score 분석

```json
{
  "healthScore": 60,
  "typescript": "fail", // ← 22개 오류
  "codeStyle": "fail", // ← 12개 ESLint 오류
  "tests": "fail", // ← 타입 체크 실패로 인한 전체 실패
  "security": "fail",
  "integrationScore": 55
}
```

---

## 해결 전략

### 우선순위 1: 타입 정의 동기화 (P0 - Critical)

**작업 범위**:

1. `linguistics-types.ts` 업데이트

   - `LanguageQuality`에 `naturalness` 필드 추가
   - `consistency`, `precision` 필드 구조 수정
   - `LinguisticsEngineerOutput` 필드 수정

2. `structure-analysis.ts` 반환 타입 검증
3. `linguistics-engineer-service.ts` 타입 체크 검증

**예상 소요 시간**: 30-45분
**영향 범위**: TypeScript 오류 12개 해결

### 우선순위 2: Policy Interpreter 타입 정의 (P0 - Critical)

**작업 범위**:

1. `PolicyDefinition` 인터페이스 정의
2. `policy-interpreter.ts`에 타입 적용
3. `policy-runtime.ts` 타입 체크

**예상 소요 시간**: 20-30분
**영향 범위**: TypeScript 오류 10개 해결

### 우선순위 3: DDD 아키텍처 수정 (P1 - High)

**작업 범위**:

1. 도메인 인터페이스 정의 (`IFileScanner`, `IReportWriter`, `IFileOperations`)
2. Application 계층 리팩토링 (인터페이스 사용)
3. 의존성 주입 설정

**예상 소요 시간**: 1-1.5시간
**영향 범위**: 아키텍처 품질 개선, 테스트 용이성 향상

### 우선순위 4: ESLint 오류 수정 (P2 - Medium)

**작업 범위**:

1. 중복 import 병합
2. throw literal → throw new Error()
3. 미사용 변수 제거 또는 `_` prefix 추가

**예상 소요 시간**: 15-20분
**영향 범위**: 코드 품질 개선

---

## 검증 계획

### 1. 타입 체크

```bash
npm run typecheck  # 0 errors 목표
```

### 2. 린트

```bash
npm run lint       # 0 errors, 0 warnings 목표
```

### 3. 테스트

```bash
npm run test       # 모든 테스트 통과 목표
```

### 4. 빌드

```bash
npm run build      # 빌드 성공 목표
```

### 5. 아키텍처 검증

```bash
npx depcruise src --validate  # 0 violations 목표
```

---

## 교훈 및 예방 조치

### 1. 리팩토링 체크리스트 강화

**Phase 7에서 누락된 항목**:

```
✅ 구현 변경
✅ 테스트 작성
❌ 타입 정의 동기화  ⬅️ 추가 필요
❌ 타입 체크 검증
❌ 아키텍처 검증
```

**개선된 체크리스트**:

```
1. ✅ 구현 변경
2. ✅ 타입 정의 업데이트
3. ✅ npm run typecheck 통과
4. ✅ 테스트 작성 및 통과
5. ✅ npx depcruise 검증
6. ✅ npm run ci:quality 통과
```

### 2. Pre-commit Hook 강화

현재 `.git/hooks/pre-commit`:

```bash
npm run typecheck    # ✅ 타입 체크
npm run lint         # ✅ 린트 체크
npm run test         # ✅ 테스트
# ❌ depcruise 검증 누락
```

**추가 필요**:

```bash
npx depcruise src --validate  # 아키텍처 검증 추가
```

### 3. CI/CD 파이프라인

**추가 검증 단계**:

```yaml
- name: TypeScript Strict Check
  run: npm run typecheck

- name: Architecture Validation
  run: npx depcruise src --validate

- name: Type Coverage
  run: npx type-coverage --at-least 95
```

---

## 다음 단계

1. **즉시 실행**: 타입 정의 동기화 (30-45분)
2. **즉시 실행**: Policy Interpreter 타입 정의 (20-30분)
3. **오늘 완료**: ESLint 오류 수정 (15-20분)
4. **내일 실행**: DDD 아키텍처 수정 (1-1.5시간)
5. **금주 완료**: 리팩토링 체크리스트 강화 및 Pre-commit Hook 업데이트

---

## 결론

Phase 7 리팩토링은 **구현 측면에서는 성공**했지만, **타입 안정성 측면에서는 미완성** 상태입니다.

핵심 문제는 **"리팩토링 체크리스트에서 타입 정의 동기화 단계가 누락"**된 것입니다.

타입 오류 22개는 모두 **30분~1시간 내 해결 가능**한 단순 타입 동기화 작업이며, 런타임 동작에는 영향을 주지 않습니다.

**권장 조치**: 타입 정의 동기화 → ESLint 수정 → 빌드 검증 순서로 즉시 진행.

---

**작성자**: Claude Code
**검토 필요**: Phase 7 리팩토링 담당자
**관련 문서**:

- `reports/linguistics-engineer-refactoring-phase7.md`
- `reports/inspection-results.json`
- `src/domain/agents/linguistics-types.ts`
