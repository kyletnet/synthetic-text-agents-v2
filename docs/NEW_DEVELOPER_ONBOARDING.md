# 신규 개발자 온보딩 가이드

> **목적**: 새로운 개발자가 시스템을 완전히 이해하고 기여할 수 있도록 하는 체계적 가이드
> **예상 소요시간**: 2-3일

## 📚 필수 읽기 문서 순서

### 🔴 1단계: 시스템 이해 (1일차 오전)
1. **`CLAUDE.md`** - 시스템 전체 개요 및 철학 이해
2. **`docs/SYSTEM_ARCHITECTURE_MAP.md`** - 모듈 구조 및 연관 관계
3. **`docs/DEVELOPMENT_STANDARDS.md`** - 개발 표준 및 규칙

### 🟡 2단계: 실전 준비 (1일차 오후)
4. **`docs/SYSTEM_OVERVIEW.md`** - 운영 현황 및 프로세스
5. **`docs/PRODUCT_PLAN.md`** - 로드맵 및 우선순위
6. **`package.json`** - 사용 가능한 명령어들

### 🟢 3단계: 심화 학습 (2일차)
7. **`docs/OPERATIONS.md`** - 운영 및 배포 가이드
8. **`docs/MIGRATION.md`** - 환경 설정 및 마이그레이션
9. **기존 에이전트 코드 분석** - `src/agents/` 폴더

## 🛠️ 환경 설정 자동화

### 원클릭 온보딩
```bash
# 1. 자동 환경 설정 실행
npm run onboard:setup

# 2. 개발 표준 검증
npm run check:standards

# 3. 전체 테스트 실행
npm run test
```

### 수동 확인 사항
```bash
# Node.js 버전 확인 (18.18.0 이상 필요)
node --version

# 의존성 설치
npm install

# TypeScript 컴파일 확인
npm run typecheck

# 품질 검사
npm run ci:quality
```

## 🎯 핵심 개념 이해

### 1. **Meta-Adaptive Expert Orchestration**
- **목적**: 전문가의 사고방식을 AI에게 프로그래밍
- **방법**: 8개 에이전트가 협업하여 고품질 QA 생성
- **차별점**: 단순 데이터 생성이 아닌 "사고과정 재현"

### 2. **8-Agent Council 구조**
```
Core Engine (4):          Expert Council (4):
- Meta-Controller         - Psychology Specialist
- Prompt Architect        - Linguistics Engineer
- QA Generator           - Domain Consultant
- Quality Auditor        - Cognitive Scientist
```

### 3. **핵심 설계 원칙**
- **Quality > Complexity**: 품질을 위해 복잡성 수용
- **Adaptability > Efficiency**: 상황별 최적 에이전트 조합
- **Transparency > Automation**: 모든 결정 추적 가능

## 🔧 실습 과제

### 과제 1: 시스템 탐색 (1일차)
```bash
# 1. 프로젝트 구조 파악
tree src/
ls -la scripts/

# 2. 에이전트 목록 확인
find src/agents -name "*.ts" | head -10

# 3. 테스트 실행해보기
npm run test -- tests/qaGenerator.test.ts
```

### 과제 2: 코드 분석 (2일차)
1. **BaseAgent 클래스 분석**: `src/core/baseAgent.ts`
2. **간단한 에이전트 분석**: `src/agents/qaGenerator.ts`
3. **에이전트 테스트 분석**: `tests/qaGenerator.test.ts`

### 과제 3: 새 에이전트 생성 (3일차)
```bash
# 새 에이전트 자동 생성
npm run generate:agent -- --name=TestAgent --domain=testing

# 생성된 파일 확인
ls src/agents/testAgent.ts
ls tests/testAgent.test.ts

# 테스트 실행
npm run test -- tests/testAgent.test.ts
```

## 🚨 자주 발생하는 실수 및 해결

### 1. **파일 명명 규칙 위반**
```bash
❌ 잘못된 예: qa_generator.ts, prompt-architect.ts
✅ 올바른 예: qaGenerator.ts, promptArchitect.ts

# 자동 검증
npm run check:standards
```

### 2. **Import 경로 오류**
```typescript
❌ 잘못된 예: import { BaseAgent } from 'core/baseAgent';
✅ 올바른 예: import { BaseAgent } from '../core/baseAgent.js';
```

### 3. **TypeScript 타입 오류**
```bash
# 타입 검사 실행
npm run typecheck

# any 타입 남발 금지 (5% 이하 유지)
# ESLint로 자동 검증됨
npm run lint
```

## 📋 개발 워크플로우

### 새 기능 개발 시
```bash
1. git checkout -b feature/새기능명
2. 타입 정의 먼저 (src/shared/types.ts)
3. 테스트 작성 (tests/)
4. 구현 (src/)
5. npm run ci:quality
6. git commit
7. PR 생성
```

### 에이전트 추가 시
```bash
1. npm run generate:agent -- --name=NewAgent
2. TODO 항목들 구현
3. 테스트 작성
4. npm run test
5. 문서 업데이트
```

## 🎓 단계별 역량 체크리스트

### ✅ 초급 개발자 (1주)
- [ ] 8-Agent 구조 이해
- [ ] 기존 에이전트 코드 읽기 가능
- [ ] 간단한 테스트 작성 가능
- [ ] 개발 표준 준수 (자동 검증 통과)

### ✅ 중급 개발자 (2주)
- [ ] 새로운 에이전트 구현 가능
- [ ] Agent 간 통신 메커니즘 이해
- [ ] BaseAgent 확장 패턴 숙지
- [ ] 품질 메트릭 이해

### ✅ 고급 개발자 (1개월)
- [ ] Meta-Controller 로직 이해
- [ ] 시스템 아키텍처 개선 제안 가능
- [ ] 성능 최적화 수행 가능
- [ ] 새로운 설계 패턴 도입 가능

## 🆘 도움 요청 방법

### 1차 자료
- 위 필수 문서들 재확인
- `scripts/check-standards.sh` 실행 결과
- `npm run test` 오류 메시지 분석

### 2차 지원
- 기존 코드 패턴 참조 (`src/agents/` 폴더)
- 유사한 구현 사례 검색
- Git 커밋 히스토리 분석

### 3차 문의
- 구체적인 에러 메시지와 함께 문의
- 시도한 해결 방법들 명시
- 기대하는 동작 설명

## 📊 성공 지표

### 온보딩 완료 기준
- [ ] 모든 필수 문서 읽기 완료
- [ ] `npm run check:standards` 통과
- [ ] 새 에이전트 생성 및 테스트 통과
- [ ] 기존 코드 수정 없이 새 기능 추가 가능

### 품질 유지 지표
- TypeScript 에러: 0개
- 테스트 커버리지: 신규 코드 100%
- ESLint 규칙 준수: 100%
- 개발 표준 준수: 100%

---

**이 가이드를 따라하면 누구든 체계적으로 시스템을 이해하고
일관된 품질로 개발에 기여할 수 있습니다.**

**궁금한 점이 있으면 언제든 위 단계를 다시 확인하거나 문의하세요!**