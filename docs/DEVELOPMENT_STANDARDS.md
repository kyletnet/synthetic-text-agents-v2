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

## 🔍 근본 원인 우선 문제 해결 (Root-Cause-First Approach)

### 원칙: 설계부터 건드려서 유기적으로 통합 관점으로 해결

모든 버그와 이슈는 **증상이 아닌 근본 원인**을 찾아 **설계 관점**에서 해결해야 합니다.

#### ❌ 잘못된 접근법 (하드코딩/우회)

```typescript
// BAD: 증상만 막는 임시방편
if (taskName === 'typescript-validation') {
  forceExecute = true; // 강제 실행 하드코딩
}

// BAD: 우회 처리
if (approvalTimeout) {
  skipApproval = true; // 타임아웃 시 자동 건너뛰기
}

// BAD: 출력 숨기기
execSync(command, { stdio: 'pipe' }); // 문제 안보이게 숨김
```

#### ✅ 올바른 접근법 (근본 원인 해결)

```typescript
// GOOD: 스케줄링 설계 자체를 수정
private getTasksDue(tasks: MaintenanceTask[], mode: string): MaintenanceTask[] {
  // Critical 작업은 시간과 무관하게 항상 실행되도록 설계
  if (task.priority === 'critical') {
    return true;
  }
  // 시간 기반 필터링은 non-critical에만 적용
}

// GOOD: 대화형/비대화형 환경 감지하여 적절히 처리
if (!process.stdin.isTTY) {
  // 비대화형: 큐에 저장 (블로킹 방지)
  approvalQueue.addToQueue(request);
} else {
  // 대화형: 실시간 사용자 입력
  await getUserInput();
}

// GOOD: 사용자에게 진행상황을 투명하게 표시
execSync(command, { stdio: 'inherit' }); // 실시간 출력
```

### 문제 해결 프로세스

#### 1단계: 근본 원인 식별

증상을 발견하면 즉시 **왜 이런 현상이 발생했는지** 추적:

```
증상: typescript-validation 작업이 실행되지 않음
  ↓ 왜?
lastRun이 최근이라 시간 필터에 걸림
  ↓ 왜?
getTasksDue()가 모든 작업에 시간 필터를 동일하게 적용
  ↓ 근본 원인
Critical 작업은 시간과 무관하게 항상 실행되어야 하는데
우선순위 개념이 스케줄링 로직에 반영되지 않음
```

#### 2단계: 설계 관점에서 해결

시스템 아키텍처와 통합 관점에서 해결책 설계:

- **하드코딩 금지**: 특정 작업 이름을 하드코딩하지 말고, priority 속성 기반 동작
- **범용성**: 새로운 critical 작업이 추가되어도 자동으로 동작
- **일관성**: 다른 시스템(approval, output)과 동일한 철학 적용

#### 3단계: 자동 감지 메커니즘 추가

동일한 문제가 재발하지 않도록 refactor-auditor.ts에 진단 규칙 추가:

```typescript
// scripts/refactor-auditor.ts에 추가
private async checkTaskSchedulingLogic(): Promise<void> {
  // before-commit frequency가 항상 false 리턴하는지 감지
  if (content.includes('case "before-commit":') && content.includes('return false')) {
    this.addFinding({
      severity: "P0",
      title: "before-commit tasks always skipped",
      recommendation: "Implement mode-based execution (SMART/FORCE)"
    });
  }

  // Critical 작업이 시간 필터링으로 스킵될 수 있는지 감지
  if (content.includes('getTasksDue') && !content.includes('task.priority === "critical"')) {
    this.addFinding({
      severity: "P1",
      title: "Critical tasks can be skipped by time filter",
      recommendation: "Always execute critical priority tasks regardless of lastRun"
    });
  }
}
```

### 실제 사례 연구 (Case Study)

#### Case 1: Task Scheduling Logic

**증상**: Critical 작업들(typescript-validation, lint-validation, test-execution)이 /maintain 실행 시 건너뛰어짐

**잘못된 해결**:
```typescript
// 각 작업마다 강제 실행 플래그 추가 (하드코딩)
if (task.name === 'typescript-validation' || task.name === 'lint-validation') {
  forceRun = true;
}
```

**올바른 해결**:
```typescript
// Priority 기반 스케줄링 설계 개선
private getTasksDue(tasks: MaintenanceTask[], mode: string): MaintenanceTask[] {
  return tasks.filter(task => {
    // SMART 모드: Critical 우선순위는 항상 실행
    if (mode === 'smart' && task.priority === 'critical') {
      return true;
    }
    // 시간 기반 필터링은 non-critical에만
    return this.isTimeDue(task);
  });
}
```

**자동 감지 추가**: scripts/refactor-auditor.ts:1310-1352

#### Case 2: Interactive Approval System

**증상**: 승인 요청이 사용자에게 표시되지 않고 타임아웃

**잘못된 해결**:
```typescript
// 타임아웃 시 자동 승인 (보안 위험)
if (timeoutElapsed) {
  return { approved: true, reason: 'timeout' };
}
```

**올바른 해결**:
```typescript
// TTY 환경 감지 후 적절한 처리
if (!process.stdin.isTTY) {
  // 비대화형: 큐에 저장하여 나중에 처리
  approvalQueue.addToQueue(request);
  return { approved: false, reason: '비대화형 환경 - 큐에 저장' };
} else {
  // 대화형: 실시간 사용자 입력 대기
  return await getUserDecision(request);
}
```

**자동 감지 추가**: scripts/refactor-auditor.ts:1354-1393

#### Case 3: Output Visibility

**증상**: 명령어 실행 중 아무 출력도 안보여서 멈춘 것처럼 보임

**잘못된 해결**:
```typescript
// setInterval로 "작업중..." 메시지만 표시 (실제 진행상황 숨김)
setInterval(() => console.log('작업중...'), 1000);
execSync(command, { stdio: 'pipe' });
```

**올바른 해결**:
```typescript
// 실제 명령어 출력을 사용자에게 투명하게 전달
execSync(command, {
  stdio: 'inherit',  // stdout/stderr를 부모 프로세스에 직접 전달
  encoding: 'utf8'
});
```

**자동 감지 추가**: scripts/refactor-auditor.ts:1395-1453

#### Case 4: Self-Healing Infinite Loop

**증상**: Self-Healing 엔진이 5초마다 healing 시도하지만 0/3 성공률로 무한 반복

**잘못된 해결**:
```typescript
// 매번 재시도하면서 로그만 쌓임 (리소스 낭비)
setInterval(() => {
  tryHealing(); // 실패해도 계속 재시도
}, 5000);
```

**올바른 해결**:
```typescript
// 1. 연속 실패 카운터 추가
if (successCount > 0) {
  this.consecutiveFailures = 0;
} else {
  this.consecutiveFailures++;

  // 최대 실패 횟수 도달 시 dormant mode
  if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
    this.enterDormantMode(
      `Maximum consecutive failures (${this.maxConsecutiveFailures}) reached`,
      'max_failures'
    );
  }
}

// 2. 복구 불가능한 이슈는 즉시 dormant mode
if (stats.activeKeys === 0) {
  this.enterDormantMode(
    'No API keys found - requires manual configuration',
    'api_key_rotation'
  );
  return { success: false, dormantModeTriggered: true };
}

// 3. Dormant mode 체크 후 healing 시작
if (this.dormantMode) {
  console.log('🛌 [SelfHealing] In dormant mode - skipping healing');
  return [];
}
```

**자동 감지 추가**: scripts/refactor-auditor.ts:1458-1531

**추가 개선 (Dormant Mode 체크 & 백그라운드 태스크 취소)**:
```typescript
// 문제 5: Dormant mode에 진입해도 healing이 계속 실행됨
async performAutomaticHealing(): Promise<HealingResult[]> {
  // ❌ BAD: dormant mode 체크 없음
  return await this.performHealingInternal();
}

// ✅ GOOD: Dormant mode 최우선 체크
async performAutomaticHealing(): Promise<HealingResult[]> {
  if (this.dormantMode) {
    console.log('🛌 System in dormant mode - healing suspended');
    return [];
  }
  return await this.performHealingInternal();
}

// 문제 6: Dormant mode 진입 시 예약된 백그라운드 태스크 취소 안함
private enterDormantMode(reason: string, triggeredBy: string): void {
  this.dormantMode = { reason, timestamp: new Date(), ... };
  // ❌ BAD: 이미 예약된 healing-alert 타임아웃이 계속 실행됨
  backgroundTaskManager.pauseTask('self-healing-preventive');
}

// ✅ GOOD: 패턴 매칭으로 모든 pending 태스크 취소
private enterDormantMode(reason: string, triggeredBy: string): void {
  this.dormantMode = { reason, timestamp: new Date(), ... };
  backgroundTaskManager.pauseTask('self-healing-preventive');
  backgroundTaskManager.cancelTasksByPattern('healing-alert-*');

  console.error('🛌 DORMANT MODE ACTIVATED');
  console.error('💡 Recovery: npm run healing:resume');
}
```

**자동 감지 추가**:
- scripts/refactor-auditor.ts:1501-1514 (Dormant mode 체크)
- scripts/refactor-auditor.ts:1517-1530 (백그라운드 태스크 취소)

### 체크리스트: 모든 수정 시 확인

- [ ] 증상이 아닌 **근본 원인**을 찾았는가?
- [ ] 하드코딩/우회가 아닌 **설계 수정**으로 해결했는가?
- [ ] **통합 관점**에서 다른 시스템과 일관성이 있는가?
- [ ] 새로운 케이스가 추가되어도 **자동으로 동작**하는가?
- [ ] **refactor-auditor.ts에 진단 규칙**을 추가했는가?
- [ ] **문서(CHANGELOG, RFC)**에 근본 원인과 해결책을 기록했는가?

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
1. RFC 문서 작성 (docs/RFC\_새패턴.md)
2. 팀 리뷰 및 승인
3. 이 문서 업데이트
4. 기존 코드 마이그레이션 계획 수립
```

### 3. **버그 발견 시**

```markdown
1. 근본 원인 식별 ("왜?" 질문 반복)
2. 설계 관점에서 해결책 수립
3. 통합 관점에서 일관성 확인
4. refactor-auditor.ts에 진단 규칙 추가
5. 문서에 Case Study 추가 (docs/DEVELOPMENT_STANDARDS.md)
```

---

**이 표준을 따르지 않는 PR은 자동으로 거부됩니다.**
**질문이 있으면 이 문서를 먼저 확인한 후 팀에 문의하세요.**
