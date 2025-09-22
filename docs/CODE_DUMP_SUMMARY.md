# 코드 덤프 요약 (Code Dump Summary)

> **목적**: 신규 개발자가 빠르게 코드베이스 전체를 파악할 수 있도록 하는 요약

## 📊 시스템 규모

- **총 TypeScript 파일**: 75개 (src/ 폴더)
- **에이전트 구현**: 8개 (완전 구현)
- **테스트 파일**: 12개 (61개 테스트)
- **스크립트**: 91개 (자동화 도구들)

## 🏗️ 핵심 코드 구조

### BaseAgent (기반 클래스)
```typescript
// src/core/baseAgent.ts - 모든 에이전트의 부모 클래스
export abstract class BaseAgent {
  abstract handle(content: unknown, context?: AgentContext): Promise<unknown>;
  async processMessage(message: AgentMessage): Promise<AgentResult>;
  getPerformanceMetrics(): PerformanceMetrics;
}
```

### 8-Agent 구현 현황
```typescript
// 모든 에이전트가 BaseAgent를 상속하여 구현됨
src/agents/
├── promptArchitect.ts       ✅ 완성
├── qaGenerator.ts          ✅ 완성
├── qualityAuditor.ts       ✅ 완성
├── cognitiveScientist.ts   ✅ 완성
├── psychologySpecialist.ts ✅ 완성
├── linguisticsEngineer.ts  ✅ 완성
├── domainConsultant.ts     ✅ 완성
└── domainConsultant.llm.ts ✅ 보조 파일
```

### 통신 및 조정 시스템
```typescript
// src/shared/types.ts - 핵심 인터페이스들
interface AgentMessage {
  id: string;
  sender: string;
  receiver: string;
  type: 'request' | 'response' | 'broadcast' | 'collaboration';
  content: unknown;
  timestamp: Date;
  priority: 1 | 2 | 3 | 4 | 5;
}

// src/core/orchestrator.ts - 에이전트 협업 관리
// src/core/metaController.ts - 전체 프로세스 제어
```

## 🚀 주요 실행 포인트

### CLI 진입점
```typescript
// src/cli/main.ts - 메인 CLI 도구
// 사용법: npm run dev 또는 tsx src/cli/main.ts
```

### 핵심 워크플로우
1. **Request** → MetaController (복잡도 분석)
2. **Selection** → Orchestrator (에이전트 조합)
3. **Processing** → Multi-Agent (협업 처리)
4. **Quality** → QualityAuditor (품질 검증)
5. **Output** → PerformanceGuardian (최종 게이트)

## 🧪 테스트 전략

### 테스트 구조
```bash
tests/
├── *.test.ts           # 단위 테스트 (각 에이전트별)
├── integration/        # 통합 테스트
└── regression/         # 회귀 테스트
```

### 핵심 테스트 명령어
```bash
npm run test            # 모든 테스트 실행
npm run test:watch      # 개발 모드 테스트
npm run ci:quality      # 전체 품질 검사
```

## 🔒 코드 품질 및 표준

### TypeScript 설정
- **Strict Mode**: 활성화 (`src/` 폴더)
- **ESLint**: 1,309개 경고 (점진적 개선 중)
- **컴파일 상태**: ✅ 0 에러 (TypeScript 컴파일 성공)

### 개발 표준
- **파일명**: camelCase (예: qaGenerator.ts)
- **Import**: .js 확장자 사용 (ESM 호환)
- **타입**: any 타입 금지 (src/ 폴더)

## 📦 의존성 및 환경

### 주요 의존성
```json
{
  "@anthropic-ai/sdk": "0.61.0",    // LLM 클라이언트
  "typescript": "^5.0.0",           // 언어
  "vitest": "^1.6.1",              // 테스트 프레임워크
  "eslint": "^9.0.0"               // 린터
}
```

### 환경 요구사항
- **Node.js**: 18.18.0 이상
- **npm**: 8.19.0 이상
- **환경변수**: .env.local (API 키 등)

## ⚡ 성능 특성

### 처리 성능
- **평균 응답시간**: ~1200ms 목표
- **품질 점수**: 8.5+ (목표: 9.5)
- **동시 에이전트**: 최대 8개 협업
- **메모리 사용**: 적정 수준 (모니터링됨)

## 🚨 알려진 이슈

### 현재 기술 부채
1. **ESLint 경고**: 1,309개 (점진적 수정 중)
2. **Legacy 코드**: scripts/ 폴더에 일부 잔재
3. **파일 정리**: reports/ 폴더 과다 (180개 파일)

### 신규 개발자 주의사항
- ESLint 경고는 새 코드에서만 수정
- scripts/ 폴더는 개발 도구용 (품질 기준 완화)
- BaseAgent 상속 필수 (새 에이전트 시)

---

**이 요약으로 30분 내에 전체 코드베이스를 파악할 수 있습니다.**