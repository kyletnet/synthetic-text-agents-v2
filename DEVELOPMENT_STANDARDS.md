# 🎯 Development Standards & Enforcement

> **완전체 시스템을 위한 개발 표준 및 자동 강제 시스템**

## 🚀 **표준화 완료 상태**

### ✅ **환경 설정 표준화**
```bash
LLM_PROVIDER=anthropic    # 명시적 프로바이더 선언
ANTHROPIC_API_KEY=xxx     # 주 LLM
LLM_MODEL=claude-3-haiku  # 프로덕션 모델
OPENAI_API_KEY=placeholder # 백업/테스트만
```

### ✅ **코드 품질 표준**
- **TypeScript**: strict mode, 모든 public 함수 return type 명시
- **ESLint**: 미사용 변수 `_prefix` 적용, non-null assertion 제거
- **로깅**: CLI 제외하고 `console.log` → `logger.info()` 사용

---

## 🔧 **LLM 개발자를 위한 강제 가이드라인**

### **MANDATORY 규칙 (절대 준수)**

#### **1. 타입 안전성**
```typescript
// ❌ 금지
function process(data: any): any { }
const result = data!.value;

// ✅ 필수
function process(data: ProcessRequest): ProcessResult {
  const result = data.value ?? defaultValue;
}
```

#### **2. 미사용 파라미터 처리**
```typescript
// ❌ 금지 - ESLint 경고 발생
function handler(request: Request, context: Context) {
  return request.data;
}

// ✅ 필수 - _ prefix 적용
function handler(request: Request, _context: Context) {
  return request.data;
}
```

#### **3. 로깅 시스템**
```typescript
// ❌ 금지 - CLI 파일 외 사용 금지
console.log('Debug info');

// ✅ 필수 - 구조화된 로깅
import { Logger } from '../shared/logger.js';
private logger = new Logger({ level: 'info' });
this.logger.info('Debug info', { context: data });
```

#### **4. 에러 처리**
```typescript
// ❌ 금지 - 에러 무시
const result = await apiCall();

// ✅ 필수 - 적절한 에러 처리
try {
  const result = await apiCall();
} catch (error) {
  this.logger.error('API call failed', { error: error.message });
  throw new ProcessingError('Failed to process request', error);
}
```

---

## 🔄 **자동 강제 시스템**

### **Pre-commit Hook (이미 설정됨)**
```bash
# 모든 커밋 전 자동 실행
npm run typecheck    # TS 컴파일 오류 = 커밋 차단
npm run lint         # ESLint 오류 = 커밋 차단
npm run test         # 테스트 실패 = 커밋 차단
```

### **개발 워크플로우**
```bash
# 1. 개발 시작
npm run dev          # 시스템 테스트

# 2. 코드 작성 (표준 준수)
# - TypeScript strict mode
# - Logger 사용
# - _ prefix for unused vars

# 3. 개발 완료
npm run lint:fix     # 자동 수정 가능한 것들
npm run docs:refresh # 문서 자동 갱신
npm run /sync        # 변경사항 커밋

# 4. 품질 검증 (자동)
# - pre-commit hook 실행
# - 모든 검증 통과 시에만 커밋 성공
```

---

## 📊 **표준 준수 모니터링**

### **현재 품질 지표 (2025-09-23)**
```
✅ TypeScript 컴파일: 0 errors
⚠️  ESLint 경고: ~400개 (기존 코드, 신규는 0 목표)
✅ 테스트 통과율: 100% (49/49)
✅ 핵심 기능: 완전 작동 (8-Agent 시스템)
```

### **Zero-Warning 정책 (신규 코드)**
- **새 파일**: ESLint 경고 0개 필수
- **기존 파일 수정**: 새 경고 추가 금지
- **리팩토링 시**: 기존 경고도 함께 수정

---

## 🎯 **LLM Assistant 개발 지침**

### **파일 생성/수정 시**
1. **파일 읽기 먼저**: 기존 코드 스타일 파악
2. **Import 패턴 준수**: 상대 경로, .js 확장자
3. **타입 정의 명시**: 모든 public interface
4. **로거 추가**: `private logger = new Logger()`
5. **에러 처리**: try-catch + 구조화된 로깅

### **코드 리뷰 체크리스트**
- [ ] TypeScript strict 모드 준수
- [ ] 미사용 변수 `_prefix` 적용
- [ ] console.log 사용 금지 (CLI 제외)
- [ ] non-null assertion (!) 사용 금지
- [ ] 적절한 에러 처리 포함
- [ ] 문서 업데이트 (필요시)

### **자동 문서 갱신**
```bash
# 개발 완료 후 필수 실행
npm run docs:refresh
# → 자동으로 docs/SYSTEM_ARCHITECTURE_MAP.md 갱신
# → 모든 인덱스 파일 리빌드
# → CLAUDE.md 변경사항 감지 및 반영
```

---

## 🔗 **참조 문서**

- **핸드오프 가이드**: `HANDOFF_NAVIGATION.md`
- **시스템 아키텍처**: `CLAUDE.md`
- **타입 가이드라인**: `docs/TYPESCRIPT_GUIDELINES.md`
- **건강 진단**: `SYSTEM_HEALTH_DIAGNOSIS.md`

---

## 🚀 **성공 지표**

### **완전체 달성 기준**
- ✅ **기능성**: 모든 핵심 시나리오 정상 작동
- 🔄 **품질**: 신규 코드 ESLint warning 0개
- ✅ **일관성**: 단일 로깅/환경 시스템
- ✅ **안정성**: pre-commit hook 100% 통과율
- ✅ **표준화**: 개발 가이드라인 자동 강제

**결론**: 이제 시스템이 완전체 상태입니다. 모든 새로운 개발은 이 표준을 자동으로 준수하며, 기존 코드도 점진적으로 개선됩니다.