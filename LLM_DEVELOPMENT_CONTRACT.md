# 🤖 LLM Development Contract

> **모든 LLM 어시스턴트(Claude Code 포함)가 반드시 준수해야 하는 개발 계약**

## 🚨 **MANDATORY READING**

이 파일은 **CLAUDE.md와 함께 모든 개발 세션에서 필수 참조 문서**입니다.

## 📋 **자동 체크리스트 (매 코드 작성 시)**

### **코드 작성 전 (MUST READ)**
- [ ] `DEVELOPMENT_STANDARDS.md` 확인
- [ ] 기존 파일 패턴 분석 (import 방식, 타입 정의 등)
- [ ] 관련 테스트 파일 존재 여부 확인

### **코드 작성 중 (MUST FOLLOW)**
```typescript
// ✅ REQUIRED PATTERN
import { Logger } from '../shared/logger.js';

export class MyAgent extends BaseAgent {
  private logger = new Logger({ level: 'info' });

  async process(request: Request, _context?: Context): Promise<Result> {
    try {
      this.logger.info('Processing started', { requestId: request.id });
      // 실제 로직
      return result;
    } catch (error) {
      this.logger.error('Processing failed', { error: error.message });
      throw new ProcessingError('Failed to process', error);
    }
  }
}
```

### **코드 작성 후 (MUST EXECUTE)**
```bash
# 1. 필수 검증 명령어
npm run typecheck    # 0 errors 필수
npm run lint         # 새 warning 금지
npm run test         # 100% pass 필수

# 2. 문서 갱신 (코드 변경 시)
npm run docs:refresh

# 3. 최종 확인
npm run dev          # 시스템 동작 확인
```

## 🚫 **금지사항 (NEVER DO)**

### **절대 금지**
```typescript
// ❌ FORBIDDEN
console.log('anything');           // CLI 파일 외 금지
const result = data!.value;        // non-null assertion 금지
function process(data: any): any   // any 타입 금지
```

### **환경 변수 혼용 금지**
```bash
# ❌ FORBIDDEN - 일관성 없는 설정
OPENAI_API_KEY=primary
ANTHROPIC_API_KEY=backup

# ✅ REQUIRED - 명확한 우선순위
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=primary
OPENAI_API_KEY=backup_only
```

## 🔒 **자동 강제 메커니즘**

### **Pre-commit Hook (자동 실행)**
모든 커밋 시 자동으로 다음 검증:
- TypeScript 컴파일 오류 → 커밋 차단
- ESLint 새 경고 → 커밋 차단
- 테스트 실패 → 커밋 차단
- 문서 갱신 → 자동 실행

### **런타임 검증**
```bash
# 시스템 시작 시 자동 검증
npm run dev
# → 환경 변수 일관성 체크
# → API 클라이언트 충돌 감지
# → 로깅 시스템 정합성 확인
```

## 📊 **준수 모니터링**

### **개발 세션 시작 시 실행**
```bash
# 현재 표준 준수 상태 확인
npm run typecheck && npm run lint && npm run test
echo "Current standards compliance: $(echo $?)"
```

### **기준점 (2025-09-23 표준화 완료 후)**
- ✅ TypeScript: 0 errors
- ⚠️ ESLint: ~400 warnings (기존), 신규 0 목표
- ✅ Tests: 49/49 pass
- ✅ System: 완전 작동

## 🎯 **LLM 어시스턴트 특별 규칙**

### **파일 수정 시 패턴**
1. **Read first**: 수정할 파일 전체 읽기
2. **Pattern analysis**: 기존 코드 스타일 파악
3. **Standard compliance**: 표준 패턴 적용
4. **Verification**: 수정 후 검증 명령어 실행

### **새 기능 추가 시**
1. **관련 파일 탐색**: Glob, Grep 활용
2. **아키텍처 확인**: `docs/llm_friendly_summary.md` 참조
3. **테스트 추가**: 새 기능에 대한 테스트 작성
4. **문서 갱신**: `npm run docs:refresh` 실행

## 🔗 **참조 우선순위**

### **필수 읽기 순서 (매 세션)**
1. **`CLAUDE.md`** - 전체 시스템 철학
2. **`LLM_DEVELOPMENT_CONTRACT.md`** (이 파일)
3. **`DEVELOPMENT_STANDARDS.md`** - 구체적 표준
4. **`docs/llm_friendly_summary.md`** - 기술 구조

### **문제 발생 시 참조**
- 타입 오류: `docs/TYPESCRIPT_GUIDELINES.md`
- 시스템 이슈: `SYSTEM_HEALTH_DIAGNOSIS.md`
- 핸드오프: `HANDOFF_NAVIGATION.md`

## ⚖️ **계약 위반 시 처리**

### **자동 차단 사항**
- 컴파일 오류 → 즉시 차단
- 테스트 실패 → 즉시 차단
- 표준 위반 → ESLint 경고

### **수동 확인 필요**
- 아키텍처 변경 → 문서 갱신 확인
- 새 의존성 추가 → 보안 검토
- 레거시 코드 수정 → 하위 호환성 확인

---

## 🚀 **최종 목표**

**완전체 시스템 유지**: 모든 새 코드가 기존 품질을 유지하거나 향상시키며, 레거시 문제는 점진적으로 해결하되 시스템 안정성은 절대 해치지 않는다.

**이 계약을 통해 어떤 LLM이 와도, 어떤 개발자가 와도 시스템의 일관성과 품질이 보장됩니다.**