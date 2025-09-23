# Meta-Adaptive Expert Orchestration System

## AI-powered QA generation using 8-Agent collaboration

---

## 📋 프로젝트 핵심 개요

**목적**: 전문가 사고방식을 AI에게 프로그래밍하여 고품질 QA 데이터셋을 자동 생성하는 시스템

**핵심 차별점**: 고정된 AI가 아닌, 상황에 따라 최적의 전문가 조합을 동적 선택하는 Meta-Adaptive 구조

**성과 목표**:

- QA 품질: 9.5/10 (전문가 수준)
- 생성 효율: 1000개 QA를 3일 내 완성
- 비용 효율: 기존 솔루션 대비 60% 절감

---

## 🎯 시스템 설계 철학 (반드시 준수)

### 성능 > 복잡성 원칙

- **의미**: 품질이 최우선, 시스템이 복잡해져도 QA 품질 확보가 우선
- **구현시**: Agent 추가나 로직 복잡화보다 결과물 품질에 더 큰 가중치
- **측정**: 생성된 QA의 전문가 평가 점수가 핵심 지표

### 적응성 > 효율성 원칙

- **의미**: 상황별 최적화를 위해 일관된 효율성을 포기할 수 있음
- **구현시**: 단순 QA는 5개 Agent, 복잡 QA는 8개 Agent로 동적 조정
- **측정**: 요구사항 복잡도에 따른 Agent 조합 최적화 정확도

### 투명성 > 자동화 원칙

- **의미**: 완전 자동화보다 설명 가능한 AI 지향
- **구현시**: 모든 QA에 "어떤 Agent가 왜 이렇게 결정했는지" 로그 필수
- **측정**: 생성 과정 추적 가능성 및 사용자 이해도

---

## 🏗 핵심 아키텍처 구성

### 8-Agent Council 구조

```
Meta-Controller (지휘자)
├── Core Engine (4개)
│   ├── Meta-Controller: 전체 프로세스 조율 및 전략 수립
│   ├── Prompt Architect: Expert Council 조언을 통합한 프롬프트 설계
│   ├── QA Generator: 최적화된 프롬프트로 대량 QA 생성
│   └── Quality Auditor: 4단계 품질 검증 및 개선 제안
└── Expert Council (4개)
    ├── Psychology Specialist: 사용자 심리 분석 및 소통 전략
    ├── Linguistics Engineer: LLM 최적화 및 언어 구조 설계
    ├── Domain Consultant: 특정 도메인 전문성 (CS/마케팅/세일즈 등)
    └── Cognitive Scientist: 전문가 사고 과정 모델링
```

### Dynamic Expert Summoning

- 50개 기본 전문가 Pool에서 상황별 최적 조합 선택
- 필요시 Deep Specialization으로 특화 전문가 자동 생성
- Performance Guardian이 Agent 간 협업 및 품질 관리

---

## 📚 필수 참조 문서 및 읽기 순서

**1단계: `docs/system-blueprint.md`** (전체 이해)

- 프로젝트 목적과 Meta-Adaptive Expert Orchestration 개념 파악
- 전체 시스템 아키텍처와 워크플로우 이해
- 주요 리스크와 완화 전략 검토

**2단계: `docs/agent-implementation-spec.md`** (구현 명세)

- 8개 Agent별 상세 역할과 책임 숙지
- 입력/출력 인터페이스 및 프롬프트 템플릿 확인
- Agent 간 협업 방식과 충돌 해결 메커니즘 이해

**3단계: `docs/technical-architecture.md`** (기술 구현)

- LangChain 기반 Multi-Agent 구현 방식
- LLM 추상화 레이어와 Provider 교체 구조
- 테스트 프레임워크와 성능 최적화 방법

---

## ⚙️ 개발 원칙 및 표준

### 필수 구현 원칙

- **Agent 독립성**: 모든 Agent는 BaseExpertAgent를 상속받는 독립적 클래스
- **프롬프트 분리**: Agent 로직과 프롬프트는 `templates/` 폴더에서 분리 관리
- **성능 측정**: 모든 Agent에 성능 로깅 및 측정 코드 필수 포함
- **통신 표준**: Agent 간 통신은 AgentCommunication 인터페이스 준수
- **비동기 처리**: Multi-Agent 협업 최적화를 위한 async/await 구조

### 코드 품질 기준

- **타입 힌트**: 모든 함수 파라미터와 반환값에 타입 명시
- **문서화**: 모든 클래스와 메소드에 docstring 작성
- **테스트 커버리지**: Agent 구현 시 단위 테스트 필수 작성
- **에러 처리**: Agent 간 통신 실패에 대한 fallback 메커니즘 구현
- **로깅**: 모든 의사결정 과정을 추적 가능하도록 로깅

### LLM 추상화 요구사항

- **Provider 교체 가능**: Claude, GPT, Gemini 간 쉬운 교체 구조
- **비용 관리**: 각 Provider별 토큰 사용량과 비용 추적
- **성능 모니터링**: 응답 시간, 품질, 안정성 실시간 측정

---

## 🚀 즉시 시작할 구현 순서

### Phase 1: 기반 구조 (1-2일)

1. **BaseExpertAgent 클래스** 구현 (모든 Agent의 부모 클래스)
2. **LLM 추상화 레이어** 구축 (ClaudeProvider부터 시작)
3. **AgentCommunication** 인터페이스 구현
4. **기본 테스트 프레임워크** 설정

**첫 번째 지시**: "docs/agent-implementation-spec.md를 참조해서 BaseExpertAgent 추상 클래스를 구현해줘. analyze_request, provide_advice, collaborate 메소드를 추상 메소드로 정의하고, performance 로깅 기능을 포함해야 해."

### Phase 2: Core Engine 구현 (2-3일)

1. **Meta-Controller Agent** (전체 조율자 - 가장 중요)
2. **Quality Auditor Agent** (품질 검증자 - 품질 보장)
3. **Prompt Architect Agent** (프롬프트 설계자)
4. **QA Generator Agent** (실제 생성자)

**핵심 지시**: "Meta-Controller Agent를 구현해줘. 요구사항 복잡도 분석(1-10점)과 Agent 조합 결정 로직을 포함해야 해. 복잡도 7점 이상이면 8개 Agent, 5-6점이면 7개 Agent, 4점 이하면 5개 Agent를 선택하는 logic을 구현해."

### Phase 3: Expert Council 구현 (3-4일)

1. **Psychology Specialist** (사용자 심리 분석)
2. **Linguistics Engineer** (LLM 최적화)
3. **Domain Consultant** (도메인 전문성)
4. **Cognitive Scientist** (전문가 사고 모델링)

### Phase 4: 통합 및 최적화 (2-3일)

1. **Performance Guardian** 통합
2. **동적 전문가 소환** 시스템
3. **전체 워크플로우** 연결
4. **성능 최적화** 및 테스트

---

## 🔧 기술 스택 및 환경 설정

### 필수 라이브러리

```bash
pip install langchain==0.1.0 langchain-anthropic==0.1.0 pydantic==2.5.0 python-dotenv==1.0.0 pytest==7.4.0 asyncio==3.4.3
```

### 환경 변수 설정

```env
ANTHROPIC_API_KEY=your_api_key_here
MAX_AGENTS=8
DEFAULT_AGENT_COMBINATION=5
QUALITY_THRESHOLD=9.0
```

### 프로젝트 구조 생성

```
meta_adaptive_qa_system/
├── src/core/          # Meta-Controller, Prompt Architect, QA Generator, Quality Auditor
├── src/experts/       # Psychology, Linguistics, Domain, Cognitive Scientist
├── src/utils/         # LLM abstraction, Performance Guardian, Communication
├── templates/         # 모든 프롬프트 템플릿
└── tests/            # 단위 테스트, 통합 테스트, 성능 테스트
```

---

## ✅ 성공 측정 기준

### 기능적 성공

- [ ] 8개 Agent가 오류 없이 협업하여 QA 생성
- [ ] 복잡도에 따른 동적 Agent 조합 선택 정확도 95% 이상
- [ ] Agent 간 통신 실패율 1% 미만

### 품질적 성공

- [ ] 생성된 QA의 전문가 평가 점수 9.0/10 이상
- [ ] Quality Auditor의 4단계 검증 통과율 90% 이상
- [ ] 전문가 사고 과정 재현도 평가 8.5/10 이상

### 성능적 성공

- [ ] 1000개 QA 생성을 48시간 내 완료
- [ ] LLM API 비용 기존 솔루션 대비 60% 절감
- [ ] 시스템 가동 시간 99.5% 이상

### 확장적 성공

- [ ] 새로운 도메인 Agent 추가가 1시간 내 가능
- [ ] LLM Provider 교체가 30분 내 완료 가능
- [ ] 50개 기본 전문가 Pool 활용률 80% 이상

---

## ⚠️ 주의사항 및 제약조건

### 개발 시 반드시 고려해야 할 리스크

1. **Agent 간 협업 실패**: 의견 충돌 시 Meta-Controller의 조정 메커니즘 필수
2. **LLM 성능 한계**: Provider별 특성을 고려한 프롬프트 최적화 필요
3. **복잡성 관리**: 8개 Agent 시스템의 디버깅 복잡성 대비 로깅 강화

### 성능 최적화 우선순위

1. **첫 번째 Agent 패턴 완성**: Meta-Controller 구현이 전체 시스템 품질 결정
2. **프롬프트 템플릿 품질**: Agent의 역할 수행 능력은 프롬프트에 의해 좌우
3. **테스트 자동화**: 복잡한 Multi-Agent 시스템에서 수동 테스트는 비현실적

---

## 📞 Claude Code와의 효과적 소통 방법

### 효과적인 지시 패턴

```
✅ 좋은 예: "Agent Implementation Spec 문서의 Meta-Controller 명세를 참조해서, BaseExpertAgent를 상속받는 MetaController 클래스를 구현해줘. complexity analysis 메소드와 agent selection logic을 포함해야 해."

❌ 피할 예: "Meta-Controller 만들어줘" (너무 모호함)
```

### 단계적 개발 요청 방식

1. **구조 먼저**: "기본 클래스 구조와 인터페이스부터 만들어줘"
2. **핵심 로직**: "이제 핵심 비즈니스 로직을 구현해줘"
3. **테스트 추가**: "단위 테스트 코드도 함께 작성해줘"
4. **통합 연결**: "다른 Agent들과 통신하는 부분을 추가해줘"

### 문제 해결 시 접근법

- 에러 발생 시: 로그와 함께 구체적 에러 상황 공유
- 성능 문제 시: 병목 지점과 측정 데이터 제공
- 품질 문제 시: 기대 결과와 실제 결과 비교 분석

---

## 🎯 최우선 구현 목표

**즉시 시작**: BaseExpertAgent 클래스 구현 후 Meta-Controller Agent 개발
**핵심 성공 기준**: 첫 번째 QA 생성이 성공하면 나머지는 패턴 복제로 빠르게 진행

**다음 대화에서 바로 시작할 지시**:
_"docs 폴더의 agent-implementation-spec.md 문서를 읽고, BaseExpertAgent 추상 클래스부터 구현을 시작해줘. 이 클래스는 모든 Agent의 부모 클래스로, analyze_request, provide_advice, collaborate 추상 메소드와 performance logging 기능을 포함해야 해."_

---

_이 가이드를 기반으로 Meta-Adaptive Expert Orchestration System을 단계적으로 구현하여, 전문가 수준의 QA 생성 시스템을 완성하세요._
