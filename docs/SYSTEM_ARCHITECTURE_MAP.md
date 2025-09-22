# 시스템 아키텍처 및 모듈 연관 관계 맵

> **목적**: 신규 개발자가 시스템 전체 구조와 모듈 간 연관 관계를 한눈에 파악할 수 있도록 함
> **업데이트**: 2025-09-22

## 📋 전체 시스템 흐름도

```
[입력] → [Meta-Controller] → [Agent Selection] → [8-Agent Council] → [Quality Gates] → [출력]
   ↓           ↓                   ↓                    ↓                ↓           ↓
사용자 요청   복잡도 분석        최적 에이전트 조합    협업 처리        품질 검증   최종 QA
```

## 🏗️ 핵심 모듈 구조

### 1. **Core Engine (핵심 엔진)**
```
src/core/
├── metaController.ts      # 전체 프로세스 오케스트레이션
├── orchestrator.ts        # 에이전트 조합 관리
├── baseAgent.ts          # 모든 에이전트의 기반 클래스
└── performanceGuardian.ts # 성능 모니터링 및 품질 게이트
```

**역할**: 시스템의 두뇌 역할, 모든 요청을 분석하고 적절한 에이전트를 선택해 협업 관리

### 2. **8-Agent Council (8개 에이전트 협의체)**

#### Core Engine Agents (4개)
```
src/agents/
├── promptArchitect.ts     # 프롬프트 설계 및 최적화
├── qaGenerator.ts         # QA 대량 생성
├── qualityAuditor.ts      # 다층 품질 검증
└── cognitiveScientist.ts  # 인지과학 기반 사고 모델링
```

#### Expert Council Agents (4개)
```
src/agents/
├── psychologySpecialist.ts  # 사용자 심리 분석
├── linguisticsEngineer.ts   # 언어학적 최적화
├── domainConsultant.ts      # 도메인 전문성
└── domainConsultant.llm.ts  # LLM 전용 도메인 로직
```

### 3. **Shared Infrastructure (공유 인프라)**
```
src/shared/
├── types.ts              # 시스템 전체 타입 정의
├── logger.ts             # 통합 로깅 시스템
├── bus.ts               # 에이전트 간 통신 버스
├── registry.ts          # 에이전트 등록 및 관리
└── llm.ts               # LLM 클라이언트 추상화
```

### 4. **Client & Services**
```
src/clients/
└── anthropicAdapter.ts   # Anthropic API 클라이언트

src/services/
└── [서비스 로직들]      # 비즈니스 서비스들
```

## 🔄 모듈 간 연관 관계

### 1. **요청 처리 흐름**
```
사용자 요청
    ↓
MetaController (복잡도 분석: 1-10)
    ↓
Orchestrator (에이전트 선택: 5-8개)
    ↓
Selected Agents (협업 처리)
    ↓
QualityAuditor (품질 검증)
    ↓
PerformanceGuardian (최종 검증)
    ↓
결과 반환
```

### 2. **에이전트 통신 패턴**
```
Agent A ←→ Bus ←→ Agent B
    ↓        ↑        ↓
  Logger  Registry  Logger
```

**주요 통신 인터페이스**:
- `AgentMessage`: 에이전트 간 메시지
- `AgentContext`: 공유 컨텍스트
- `AgentResult`: 처리 결과

### 3. **데이터 플로우**
```
Input Data → [Preprocessing] → [Multi-Agent Processing] → [Quality Control] → Output
     ↓              ↓                    ↓                      ↓           ↓
  타입 검증      컨텍스트 생성         협업 처리             품질 점수     최종 QA
```

## 🎯 핵심 설계 원칙 구현

### 1. **Quality > Complexity**
- QualityAuditor가 4단계 품질 검증 수행
- PerformanceGuardian이 최종 품질 게이트 역할
- 목표: QA 품질 9.5/10

### 2. **Adaptability > Efficiency**
- MetaController가 동적으로 에이전트 조합 결정
- 단순 요청: 5개 에이전트, 복잡 요청: 8개 에이전트
- 실시간 전문가 소환 시스템

### 3. **Transparency > Automation**
- 모든 결정이 추적 가능한 로그로 기록
- Agent 추론 과정이 구조화된 로그에 저장
- 감사(audit) 기능 내장

## 🔧 개발자 진입점

### 새로운 에이전트 추가 시
1. `BaseAgent` 상속
2. `handle()` 메서드 구현
3. `src/shared/registry.ts`에 등록
4. 테스트 파일 작성 (`tests/`)

### 시스템 확장 시
1. **새로운 서비스**: `src/services/`에 추가
2. **새로운 클라이언트**: `src/clients/`에 추가
3. **공유 유틸리티**: `src/shared/`에 추가

## 🚦 품질 게이트 시스템

### 자동 검증 단계
```
1. TypeScript 컴파일 ✓
2. ESLint 규칙 검증 ✓
3. 단위 테스트 실행 ✓
4. 통합 테스트 실행 ✓
5. 품질 메트릭 확인 ✓
```

### 실행 명령어
- `npm run ci:quality`: 전체 품질 검사
- `npm run check:standards`: 개발 표준 준수 검증
- `npm run test`: 모든 테스트 실행

## 📊 모니터링 및 성능

### 핵심 메트릭
- **처리 시간**: 평균 1200ms 이하
- **품질 점수**: 평균 8.5+ (목표: 9.5)
- **성공률**: 95% 이상
- **비용**: 요청당 $0.02 이하

### 로깅 구조
```
RUN_LOGS/          # 실행 로그
DECISIONS/         # 결정 과정 로그
reports/           # 성능 및 품질 리포트
```

## 🎓 새로운 개발자 학습 순서

1. **기본 이해**: 이 문서 + CLAUDE.md 읽기
2. **코드 구조**: `src/core/baseAgent.ts` 분석
3. **실습**: 기존 에이전트 코드 분석 (`src/agents/`)
4. **개발 표준**: `docs/DEVELOPMENT_STANDARDS.md` 숙지
5. **실전**: 새로운 에이전트 구현해보기

---

**이 맵을 통해 시스템의 전체적인 흐름과 각 모듈의 역할을 이해하고,
어떤 부분을 수정하거나 확장할 때 다른 모듈에 미치는 영향을 파악할 수 있습니다.**