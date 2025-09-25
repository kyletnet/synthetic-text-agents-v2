# /fix - AI 자동 수정 시스템

TypeScript 오류를 AI가 자동으로 분석하고 수정을 시도합니다.

## 사용법

```bash
/fix                    # 모든 TypeScript 오류 자동 수정 시도
/fix typescript         # 타입 관련 오류만 수정
/fix imports           # import 관련 오류만 수정
/fix syntax            # 구문 오류만 수정
/fix plugins           # 플러그인 관련 오류만 수정
/fix rollback          # 마지막 수정사항 롤백
```

## 🤖 자동 수정 가능한 오류들

### ✅ **높은 성공률 (80-90%)**

- **Missing semicolons**: 세미콜론 누락 → 자동 추가
- **Unterminated strings**: 문자열 미종료 → 따옴표 추가
- **Common imports**: fs, path, glob 등 → import 문 추가
- **Empty object fixes**: `{}` → 올바른 인터페이스 객체

### ✅ **중간 성공률 (60-80%)**

- **Invalid property names**: 잘못된 속성 → 주석 처리 또는 수정
- **Type assertion needs**: 타입 불일치 → 안전한 타입 변환
- **Optional chaining**: 속성 접근 오류 → `?.` 추가

### ⚠️ **수동 검토 필요 (낮은 성공률)**

- **복잡한 인터페이스 확장**
- **제네릭 타입 해결**
- **복잡한 타입 호환성**

## 🔧 수정 예시

### Before:

```typescript
// TS2304: Cannot find name 'fs'
const content = fs.readFile("file.txt");

// TS2345: Argument '{}' not assignable to 'DocSyncContext'
const context = {};

// TS1005: ';' expected
const name = "test";

// TS2339: Property 'config' does not exist
obj.config.setting = true;
```

### After (자동 수정):

```typescript
// ✅ Added import
import { promises as fs } from "fs";
const content = fs.readFile("file.txt");

// ✅ Fixed empty object
const context = {
  projectRoot: process.cwd(),
  projectScope: "default",
  changedFiles: [],
  documentMap: {},
  environment: "development" as const,
  cache: new Map(),
  tempFiles: [],
  logger: console,
  traceId: "trace-" + Date.now(),
};

// ✅ Added semicolon
const name = "test";

// ✅ Added optional chaining
obj.config?.setting = true;
```

## 📊 수정 리포트

```
🤖 AI Fix Report
================
🔍 Total errors found: 18
🔧 Fix attempts: 15
✅ Successful fixes: 12
❌ Remaining errors: 6
📊 Success rate: 80.0%

✅ Successfully applied fixes:
   • src/shared/pluginLoader.ts:84 - Fixed empty object to DocSyncContext
   • src/shared/pluginLoader.ts:118 - Fixed invalid DocPermission value
   • scripts/docs/llm-signal-injector.ts:199 - Added missing semicolon

💾 Backup files created with .backup extension
🔄 Run npm run typecheck to verify fixes
```

## 🛡️ 안전장치

### 백업 & 롤백 시스템

- **자동 백업**: 모든 수정 전 타임스탬프 백업 파일 생성
- **세션 추적**: 수정 세션별로 변경사항 추적 및 기록
- **안전한 롤백**: `/fix rollback`으로 마지막 세션의 모든 변경사항 취소
- **복구 검증**: 롤백 후 TypeScript 컴파일 자동 재실행으로 복구 확인

### 신뢰도 기반 수정

- **High confidence (80%+)**: 자동 적용
- **Medium confidence (60-80%)**: 적용 후 사용자 알림
- **Low confidence (<60%)**: 제안만 하고 수동 검토 요청

### 검증 시스템

- **수정 후 재검증**: TypeScript 컴파일 자동 재실행
- **성공률 추적**: 수정 성공률 모니터링
- **패턴 학습**: 실패한 수정 패턴 학습하여 개선

## 💡 사용 팁

1. **점진적 수정**: 한 번에 모든 오류보다는 카테고리별로 수정
2. **검증 필수**: 수정 후 반드시 `npm run typecheck`로 확인
3. **백업 활용**: 문제가 생기면 `.backup` 파일에서 복원
4. **학습 효과**: 자주 사용할수록 AI가 프로젝트 패턴을 학습해 정확도 향상

이 시스템으로 **"오류 메시지 보고 어떻게 고쳐야 할지 고민"**하는 시간을 대폭 줄일 수 있습니다! 🤖✨
