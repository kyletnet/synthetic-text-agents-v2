# 개발 표준 및 일관성 가이드라인

## 🚨 배경: 일관성 부족 문제 해결

지금까지 다양한 개발자들이 서로 다른 명명 규칙, 문법, 형식으로 개발하여 시스템 일관성이 깨졌습니다.
이 문서는 **모든 개발자가 동일한 표준**을 따르도록 하여 혼란을 방지합니다.

## 📋 강제 표준 (Non-Negotiable Standards)

### 1. **파일 명명 규칙**

#### TypeScript/JavaScript 파일
```bash
✅ GOOD: camelCase
- qaGenerator.ts
- qualityAuditor.ts
- baseAgent.ts

❌ BAD: snake_case, kebab-case
- qa_generator.ts
- quality-auditor.ts
```

#### 설정 파일
```bash
✅ GOOD: kebab-case
- eslint.config.js
- baseline-config.json

❌ BAD: camelCase, snake_case
- eslintConfig.js
- baseline_config.json
```

#### Shell 스크립트
```bash
✅ GOOD: kebab-case
- forbidden-direct-http.sh
- check-observability.sh

❌ BAD: snake_case
- forbidden_direct_http.sh
```

### 2. **디렉토리 구조 표준**

```
src/
  shared/        # 공용 타입, 유틸리티
  core/          # 핵심 기반 클래스 (BaseAgent, 등)
  agents/        # 에이전트 구현체들
  clients/       # 외부 API 클라이언트
  services/      # 비즈니스 서비스
  utils/         # 헬퍼 함수들
  cli/           # CLI 도구
scripts/         # 빌드/운영 스크립트
  lib/           # 스크립트용 라이브러리
  metrics/       # 메트릭 관련 스크립트
  ci/            # CI/CD 스크립트
docs/            # 문서
tests/           # 테스트 파일
legacy/          # 구버전 코드 (빌드 제외)
```

### 3. **import/export 표준**

#### 절대 경로 vs 상대 경로
```typescript
✅ GOOD: 명확한 상대 경로
import { BaseAgent } from '../core/baseAgent.js';
import { Logger } from '../shared/logger.js';

❌ BAD: 모호한 경로
import { BaseAgent } from 'core/baseAgent';
import { Logger } from 'logger';
```

#### 파일 확장자
```typescript
✅ GOOD: .js 확장자 (TypeScript → JavaScript 컴파일 고려)
import { something } from './module.js';

❌ BAD: .ts 확장자
import { something } from './module.ts';
```

### 4. **타입 정의 표준**

#### 클래스 vs 인터페이스
```typescript
✅ GOOD: 명확한 구분
// 구현체는 클래스
export class QAGenerator extends BaseAgent {}

// 계약은 인터페이스
export interface AgentMessage {
  id: string;
  type: 'request' | 'response';
}

❌ BAD: 혼재 사용
export interface QAGenerator {} // 구현체를 인터페이스로
```

#### any 타입 사용
```typescript
✅ GOOD: 구체적 타입
function processData(data: AgentMessage): AgentResult {}

❌ BAD: any 남발
function processData(data: any): any {}
```

### 5. **문서 작성 표준**

#### README vs 가이드 구분
```
README.md              # 프로젝트 개요, 빠른 시작
docs/DEVELOPMENT_STANDARDS.md  # 개발 표준
docs/TYPESCRIPT_GUIDELINES.md  # TypeScript 특화 가이드
docs/API_REFERENCE.md   # API 문서
```

#### 문서 구조
```markdown
✅ GOOD: 표준화된 구조
# 제목

## 🎯 목적
## 📋 사용법
## ⚠️ 주의사항
## 🔧 설정
## 🆘 문제 해결

❌ BAD: 자유형식 문서
```

## 🛠️ 개발 워크플로우 표준

### 1. **새 기능 개발 순서**

```bash
# 1. 기능 브랜치 생성
git checkout -b feature/new-agent

# 2. 타입 정의 먼저
# - src/shared/types.ts에 인터페이스 추가
# - 에이전트 클래스 구조 설계

# 3. 테스트 작성
# - tests/newAgent.test.ts 생성
# - 실패하는 테스트 먼저 작성

# 4. 구현
# - src/agents/newAgent.ts 구현
# - BaseAgent 상속 필수

# 5. 문서화
# - docs/에 관련 문서 업데이트
# - CLAUDE.md에 구조 반영

# 6. 검증
npm run typecheck && npm run lint && npm run test

# 7. 커밋 (pre-commit hook 자동 실행)
git commit -m "feat: add new agent implementation"
```

### 2. **코드 리뷰 체크리스트**

```markdown
- [ ] 파일명이 camelCase인가?
- [ ] BaseAgent를 올바르게 상속했는가?
- [ ] 타입이 명시적으로 정의되었는가?
- [ ] 테스트가 작성되었는가?
- [ ] import 경로가 올바른가?
- [ ] 문서가 업데이트되었는가?
```

## 🔧 도구 및 자동화

### 1. **품질 검증 스크립트**

```bash
# 전체 품질 검사
npm run ci:quality

# 개별 검사
npm run typecheck      # TypeScript 검사
npm run lint          # ESLint 검사
npm run test          # 테스트 실행
npm run format        # 코드 포매팅
```

### 2. **Pre-commit Hook 검증**

Pre-commit hook은 다음을 자동 검사:
- TypeScript 컴파일 오류
- ESLint 규칙 위반
- Git secrets 누출
- 직접 HTTP 호출 금지
- 스키마 검증

### 3. **개발자 온보딩 자동화**

```bash
# 새 개발자 환경 설정
npm run onboard:setup

# 개발 표준 확인
npm run check:standards

# 샘플 에이전트 생성
npm run generate:agent -- --name=MyAgent
```

## 🚫 절대 금지 사항

### 1. **코드 스타일**
- ❌ `any` 타입 남발 (src/ 폴더에서 금지)
- ❌ `console.log` 직접 사용 (Logger 사용 필수)
- ❌ 하드코딩된 설정값
- ❌ 직접 HTTP 호출 (클라이언트 어댑터 사용)

### 2. **파일 구조**
- ❌ src/ 밖에서 비즈니스 로직 구현
- ❌ 테스트 없는 새 에이전트 추가
- ❌ legacy/ 폴더에 새 코드 추가
- ❌ 임시 파일을 git에 커밋

### 3. **문서화**
- ❌ 구현과 문서 불일치
- ❌ README 없는 새 모듈
- ❌ 주석 없는 복잡한 로직

## 📊 일관성 메트릭

### 자동 측정 지표
- TypeScript 에러 수: **0개 유지**
- 테스트 커버리지: **80% 이상**
- ESLint 경고: **10개 이하**
- any 타입 사용률: **5% 이하**
- 문서-코드 일치율: **100%**

## 🆘 문제 발생 시 대응

### 1. **표준 위반 발견 시**
```bash
# 자동 수정 시도
npm run lint:fix
npm run format

# 수동 수정 필요한 경우
# 1. 이 문서의 표준 확인
# 2. 기존 코드 패턴 참조
# 3. 팀에 문의
```

### 2. **새로운 패턴 필요 시**
```markdown
1. RFC 문서 작성 (docs/RFC_새패턴.md)
2. 팀 리뷰 및 승인
3. 이 문서 업데이트
4. 기존 코드 마이그레이션 계획 수립
```

---

**이 표준을 따르지 않는 PR은 자동으로 거부됩니다.**
**질문이 있으면 이 문서를 먼저 확인한 후 팀에 문의하세요.**