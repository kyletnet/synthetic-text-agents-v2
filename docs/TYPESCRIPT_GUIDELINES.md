# TypeScript Development Guidelines

## 🎯 목적

이 가이드라인은 TypeScript 타입 안전성을 보장하고 기술 부채를 최소화하기 위해 작성되었습니다.

## 🚨 핵심 원칙

### 1. **Zero New TypeScript Errors**
- 새로운 코드는 TypeScript 오류를 발생시키지 않아야 합니다
- `npm run typecheck`가 실패하면 커밋이 차단됩니다

### 2. **점진적 개선**
- 기존 코드를 수정할 때 타입 안전성도 함께 개선합니다
- 주별 5-10개 파일씩 레거시 타입 오류를 해결합니다

### 3. **영역별 엄격도**
- `src/` (핵심 로직): 매우 엄격 (`strict: true`)
- `scripts/` (도구/유틸): 점진적 개선 (현재 관대하지만 개선 중)
- `tests/` (테스트): 적당히 엄격

## 🛠️ 개발 워크플로우

### 새 파일 작성 시
```bash
# 1. 엄격한 TypeScript 설정 준수
# 2. 명시적 타입 선언
# 3. any 타입 사용 금지 (src/ 폴더)

// ✅ 좋은 예
interface UserData {
  id: string;
  name: string;
  email: string;
}

function processUser(data: UserData): Promise<void> {
  // 구현
}

// ❌ 나쁜 예
function processUser(data: any): any {
  // 구현
}
```

### 기존 파일 수정 시
```bash
# 1. 수정하려는 함수/클래스의 타입부터 개선
# 2. any 타입을 구체적인 타입으로 교체
# 3. 관련된 타입 오류도 함께 수정

// ✅ 개선 예
// Before: function processData(data: any): any
// After:  function processData(data: InputData): ProcessedData
```

## 🔧 사용 가능한 도구

### 개발 중
```bash
npm run typecheck          # TypeScript 오류 체크
npm run lint               # ESLint 검사 (flat config 사용)
npm run lint:fix           # 자동 수정 가능한 린트 오류 수정
npm run ci:quality         # 전체 품질 검사
```

### ESLint 설정
- **Flat Config**: `eslint.config.js` 사용 (최신 ESLint 형식)
- **파일별 규칙**: src/ 폴더는 엄격, scripts/ 폴더는 점진적 개선

### 커밋 전
```bash
# Git hook이 자동으로 실행됩니다
git commit -m "message"    # TypeScript 검사 포함
git commit --no-verify     # 검사 생략 (권장하지 않음)
```

### CI 검증
```bash
npm run ci:strict          # 운영 배포 전 전체 검사
npm run ship:pre           # 배포 전 검증
```

## 📂 파일별 가이드라인

### `src/` 폴더 (핵심 비즈니스 로직)
- **엄격도**: 최고
- **any 타입**: 금지
- **함수 반환 타입**: 필수
- **인터페이스**: 명시적 정의 필수

```typescript
// ✅ src/ 폴더 예시
export interface AgentResult {
  success: boolean;
  data?: unknown;
  error?: AgentError;
}

export async function executeAgent(input: AgentInput): Promise<AgentResult> {
  // 구현
}
```

### `scripts/` 폴더 (도구/유틸리티)
- **엄격도**: 중간 (점진적 개선)
- **any 타입**: 경고 (금지 지향)
- **함수 반환 타입**: 권장
- **빠른 프로토타이핑**: 허용하되 후에 개선

```typescript
// ✅ scripts/ 폴더 예시 (개선 지향)
function parseConfig(rawConfig: string): Config | null {
  try {
    return JSON.parse(rawConfig) as Config;
  } catch {
    return null;
  }
}
```

### `tests/` 폴더 (테스트)
- **엄격도**: 중간
- **any 타입**: 테스트 목적으로 제한적 허용
- **Mock 객체**: 타입 안전성 보다 테스트 용이성 우선

## 🚫 금지 사항

### 절대 하지 말 것
```typescript
// ❌ any의 무분별한 사용
function processData(data: any): any { }

// ❌ 타입 단언의 남용
const result = data as any;

// ❌ @ts-ignore의 무분별한 사용
// @ts-ignore
someProblematicCode();
```

### 예외적으로 허용되는 경우
```typescript
// ✅ 외부 라이브러리 타입이 없는 경우
const thirdPartyResult = externalLib.someMethod() as ThirdPartyResult;

// ✅ 점진적 마이그레이션 중 임시 조치
// TODO: 2024-Q4 - 구체적인 타입으로 교체 예정
function legacyFunction(data: any): void {
  // 기존 로직 유지
}
```

## 🎯 마이그레이션 로드맵

### 단기 (완료)
- [x] `src/` 폴더 100% 타입 안전
- [x] 새 파일은 모두 엄격한 타입 적용
- [x] pre-commit hook으로 품질 보장
- [x] TypeScript 0 에러 달성
- [x] ESLint flat config 적용

### 중기 (진행 중)
- [x] `scripts/dx/` 폴더 타입 안전성 개선
- [x] `scripts/metrics/` 폴더 타입 안전성 개선
- [x] 주요 유틸리티 함수 타입 강화
- [ ] 누락된 에이전트 테스트 추가
- [ ] ESLint 규칙 점진적 강화

### 장기 (목표)
- [x] 전체 프로젝트 `strict: true` 적용
- [ ] any 타입 사용률 5% 이하 달성
- [ ] 자동화된 타입 품질 메트릭 시스템
- [ ] 에이전트별 100% 테스트 커버리지

## 🆘 문제 해결

### TypeScript 오류 발생 시
1. `npm run typecheck`로 전체 오류 확인
2. 해당 파일의 타입 정의 검토
3. 관련 인터페이스/타입 업데이트
4. 테스트 실행으로 동작 확인

### Pre-commit Hook이 실패할 때
1. `npm run typecheck`로 구체적 오류 확인
2. 오류 수정 후 다시 커밋 시도
3. 긴급한 경우 `--no-verify` 사용 (팀 합의 후)

### 도움이 필요한 경우
- TypeScript 공식 문서: https://www.typescriptlang.org/docs/
- 프로젝트 특정 질문: 팀 슬랙 #dev-typescript 채널
- 복잡한 타입 문제: 코드 리뷰 요청

---

**기억하세요**: 타입 안전성은 버그 예방과 개발자 경험 향상을 위한 투자입니다! 🚀