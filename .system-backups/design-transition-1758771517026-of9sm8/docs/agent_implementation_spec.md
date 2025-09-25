# Agent Implementation Specification

## Meta-Adaptive Expert Orchestration System

---

## 1. Agent 정의 원칙

### 1.1 기능적 역할 기반 정의

각 Agent는 학문적 분류가 아닌 시스템 내 구체적 기능으로 정의됩니다.

- **예시**: "Psychology Expert" → "Customer Emotion Analyzer & Response Strategy Planner"
- **목적**: Claude Code가 명확한 구현 목표를 가질 수 있도록

### 1.2 Agent 독립성과 협업 균형

- **독립성**: 각 Agent는 독립적으로 실행 가능한 완전한 기능 단위
- **협업**: 표준화된 인터페이스를 통해 다른 Agent와 정보 교환
- **확장성**: 새로운 Agent 추가 시 기존 Agent 수정 최소화

---

## 2. Core Engine Agents (4개) 상세 명세

### 2.1 Meta-Controller Agent

**업무 역할**: 전체 프로세스의 지휘자 및 전략 수립자
**핵심 책임**:

- 사용자 요구사항 분석 및 복잡도 평가
- 최적 전문가 조합 결정 (5개 vs 8개 Agent)
- Expert Council 협의 진행 및 조율
- Agent 간 충돌 해결 및 최종 결정

**입력 인터페이스**:

```python
class MetaControllerInput:
    user_requirements: str          # 사용자 요구사항
    domain_context: str            # 도메인 맥락 (CS, 마케팅, 세일즈 등)
    quality_target: float          # 목표 품질 수준 (1-10)
    quantity_target: int           # 생성 목표 수량
    priority_factors: list         # 우선순위 요소들
```

**출력 인터페이스**:

```python
class MetaControllerOutput:
    expert_combination: list       # 선택된 전문가 조합
    collaboration_strategy: str    # 협업 전략
    quality_standards: dict        # 품질 기준
    timeline_estimate: str         # 예상 완료 시간
```

**핵심 프롬프트 템플릿**:

```
당신은 Meta-Controller로서 다음 QA 생성 요청을 분석하고 최적의 전문가 팀을 구성해야 합니다.

요청 내용: {user_requirements}
도메인: {domain_context}
품질 목표: {quality_target}/10
수량 목표: {quantity_target}개

분석해야 할 요소:
1. 이 요청의 복잡도 (1-10점)
2. 필요한 전문성 영역 (최대 3개)
3. 예상되는 도전과제
4. 적정 Agent 조합 (5개 vs 8개)

출력 형식:
- 복잡도 점수: [점수]/10
- 필요 전문가: [전문가1], [전문가2], [전문가3]
- 협업 전략: [구체적 프로세스]
- 예상 결과: [품질 및 특성 예측]
```

**구현 로직**:

- 복잡도 7점 이상 → 8개 Agent 총동원
- 복잡도 5-6점 → 7개 Agent (Cognitive Scientist 제외)
- 복잡도 4점 이하 → 5개 Agent (Core + 1개 Domain)

### 2.2 Prompt Architect Agent

**업무 역할**: Expert Council의 조언을 통합하여 최적의 QA 생성 프롬프트 설계
**핵심 책임**:

- Expert Council의 다양한 관점을 하나의 프롬프트로 통합
- 생성 목표에 최적화된 프롬프트 구조 설계
- QA 품질과 다양성의 균형점 확보

**입력 인터페이스**:

```python
class PromptArchitectInput:
    expert_recommendations: dict   # 각 전문가의 조언
    meta_strategy: str            # Meta-Controller의 전략
    target_specifications: dict   # QA 생성 목표 사양
    quality_constraints: list     # 품질 제약사항
```

**핵심 프롬프트 템플릿**:

```
당신은 Prompt Architect로서 다음 전문가들의 조언을 통합하여 최적의 QA 생성 프롬프트를 설계해야 합니다.

전문가 조언:
- Psychology Specialist: {psychology_advice}
- Linguistics Engineer: {linguistics_advice}
- Domain Consultant: {domain_advice}
- Cognitive Scientist: {cognitive_advice}

통합 요구사항:
1. 모든 전문가 조언을 반영하되 상충점은 우선순위에 따라 조정
2. LLM이 이해하기 쉬운 구조화된 프롬프트 설계
3. 품질과 다양성을 동시에 확보할 수 있는 지시사항 포함

출력해야 할 최종 프롬프트:
[QA Generator가 바로 사용할 수 있는 완성된 프롬프트]
```

### 2.3 QA Generator Agent

**업무 역할**: 설계된 프롬프트를 기반으로 고품질 QA 대량 생성
**핵심 책임**:

- Prompt Architect가 설계한 프롬프트 정확한 실행
- 목표 수량의 QA를 일관된 품질로 생성
- 생성 과정에서 다양성 확보 (중복 방지)

**입력 인터페이스**:

```python
class QAGeneratorInput:
    optimized_prompt: str         # 최적화된 생성 프롬프트
    source_materials: list        # 참조할 전문가 텍스트 자료
    generation_count: int         # 생성할 QA 개수
    diversity_settings: dict      # 다양성 확보 설정
```

**핵심 프롬프트 템플릿**:

```
다음은 전문가 팀이 설계한 최적화된 QA 생성 지시사항입니다:

{optimized_prompt}

참고 자료:
{source_materials}

생성 요구사항:
- 수량: {generation_count}개
- 품질 기준: 전문가 수준의 정확성과 실용성
- 다양성: 유사한 QA 5% 이하로 제한
- 형식: 명확한 Q: / A: 구조

각 QA는 다음을 반드시 포함해야 합니다:
1. 실제 상황에서 발생 가능한 현실적 질문
2. 전문가가 실제로 제공할 법한 구체적이고 실용적인 답변
3. 해당 도메인의 전문성이 명확히 드러나는 내용

[QA 1개 생성 후 잠시 멈춰서 품질 자가 검증 후 계속 진행]
```

### 2.4 Quality Auditor Agent

**업무 역할**: 생성된 QA의 다층 품질 검증 및 개선점 도출
**핵심 책임**:

- 전문성, 실용성, 언어 품질 등 다각도 검증
- 목표 기준 미달 QA 식별 및 개선 방안 제시
- 전체 QA 세트의 일관성 및 다양성 평가

**입력 인터페이스**:

```python
class QualityAuditorInput:
    generated_qa_set: list        # 생성된 QA 목록
    quality_standards: dict       # 품질 기준
    target_domain: str           # 목표 도메인
    expert_benchmarks: dict       # 전문가 수준 벤치마크
```

**품질 검증 기준**:

```
Level 1: 구조적 품질 (형식, 완성도, 길이)
- Q와 A가 명확히 구분되는가?
- 질문이 모호하지 않고 구체적인가?
- 답변이 실행 가능한 수준으로 상세한가?

Level 2: 전문성 품질 (도메인 정확성, 용어 사용)
- 해당 도메인의 전문 용어가 정확히 사용되었는가?
- 전문가가 실제로 이런 방식으로 답변할 것 같은가?
- 업계 표준이나 모범사례가 반영되었는가?

Level 3: 실용성 품질 (현실성, 적용 가능성)
- 실제 상황에서 발생할 법한 현실적 질문인가?
- 답변을 따라 했을 때 실제 문제가 해결되는가?
- 사용자가 이해하고 적용할 수 있는 수준인가?

Level 4: 차별성 품질 (새로운 가치, 통찰)
- 기존 FAQ나 매뉴얼에 없는 새로운 가치가 있는가?
- 전문가의 암묵적 지식이 명시화되었는가?
- 예상치 못한 상황에 대한 대응책이 포함되었는가?
```

---

## 3. Expert Council Agents (4개) 상세 명세

### 3.1 Psychology Specialist Agent

**업무 역할**: 인간 심리 및 의사결정 패턴 분석 전문가
**전문성 영역**:

- 고객/직원의 감정 상태 분석 및 대응 전략
- 의사결정 과정에서의 인지 편향 고려
- 상황별 동기 부여 및 설득 메커니즘

**핵심 프롬프트 템플릿**:

```
당신은 Psychology Specialist로서 다음 QA 생성 상황을 심리학적 관점에서 분석해야 합니다.

상황: {context}
도메인: {domain}
타겟 사용자: {target_user}

분석해야 할 요소:
1. 타겟 사용자의 심리적 상태 (불안, 기대, 압박감 등)
2. 질문을 하게 된 동기 (무엇이 궁금한가, 무엇을 해결하려 하는가)
3. 효과적인 답변 스타일 (공감적, 지시적, 분석적 등)
4. 주의해야 할 인지 편향이나 감정적 요소

출력 형식:
- 심리적 맥락: [사용자의 심리 상태 분석]
- 커뮤니케이션 전략: [효과적인 소통 방법]
- 주의사항: [피해야 할 표현이나 접근법]
- QA 설계 조언: [프롬프트에 반영해야 할 심리학적 요소]
```

### 3.2 Linguistics Engineer Agent

**업무 역할**: LLM 최적화 및 언어 구조 설계 전문가
**전문성 영역**:

- LLM이 이해하기 쉬운 프롬프트 구조 설계
- 자연어 처리 관점에서의 최적화
- 다국어 및 전문 용어 처리

**핵심 프롬프트 템플릿**:

```
당신은 Linguistics Engineer로서 LLM 성능 최적화 관점에서 QA 생성을 분석해야 합니다.

현재 프롬프트 초안: {current_prompt}
목표 도메인: {domain}
사용 LLM: {llm_type}

최적화해야 할 요소:
1. 프롬프트 구조의 LLM 이해도 (토큰 효율성, 명확성)
2. 생성될 QA의 언어적 품질 (명확성, 일관성, 전문성)
3. 도메인 특화 용어의 정확한 사용
4. 다양성 확보를 위한 언어적 장치

출력 형식:
- 구조 개선안: [프롬프트 구조 최적화 제안]
- 언어 가이드라인: [QA 언어 품질 기준]
- 전문 용어 처리: [도메인 용어 사용 원칙]
- LLM 최적화 팁: [성능 향상을 위한 구체적 조언]
```

### 3.3 Domain Consultant Agent

**업무 역할**: 특정 도메인의 전문성 및 실무 지식 제공
**전문성 영역**: 상황에 따라 동적 결정 (CS, 마케팅, 세일즈, 의료, 법률 등)

**핵심 프롬프트 템플릿** (CS 도메인 예시):

```
당신은 고객서비스(CS) Domain Consultant로서 다음 QA 생성 과제에 전문적 조언을 제공해야 합니다.

요청 맥락: {context}
참고 자료: {reference_materials}
품질 목표: {quality_target}

제공해야 할 전문성:
1. CS 업계 표준 프로세스 및 모범사례
2. 고객 유형별 대응 전략 (B2B vs B2C, 산업별 특성)
3. 상황별 에스컬레이션 절차 및 권한
4. 실무에서 자주 발생하는 예외 상황들

출력 형식:
- 도메인 특성: [해당 도메인의 핵심 특징]
- 전문 프로세스: [표준 업무 절차]
- 실무 노하우: [경험 기반 조언]
- QA 설계 가이드: [도메인 특화 QA 작성 원칙]
```

### 3.4 Cognitive Scientist Agent

**업무 역할**: 인간 사고 과정 및 학습 패턴 분석 전문가  
**전문성 영역**:

- 전문가의 사고 과정 모델링
- 암묵적 지식의 명시화 방법론
- 효과적인 지식 전달 구조 설계

**핵심 프롬프트 템플릿**:

```
당신은 Cognitive Scientist로서 전문가의 사고 과정을 분석하고 이를 QA 구조로 변환하는 방법을 제안해야 합니다.

전문가 자료: {expert_materials}
사고 패턴: {thinking_patterns}
학습 목표: {learning_objectives}

분석 요소:
1. 전문가가 문제를 어떤 순서로 분석하는가?
2. 어떤 정보를 먼저 확인하고 어떤 것을 나중에 보는가?
3. 경험과 직감이 어떤 지점에서 작동하는가?
4. 의사결정 과정에서 가장 중요한 판단 기준은?

출력 형식:
- 사고 구조: [단계별 사고 과정]
- 핵심 판단점: [중요한 의사결정 지점들]
- 암묵지 요소: [명시화되지 않은 중요 지식]
- QA 구조 제안: [사고 과정을 반영한 QA 설계]
```

---

## 4. 동적 전문가 확장 시스템

### 4.1 50개 기본 전문가 Pool

**Category A: 핵심 전문성 (10개)**

```python
CORE_EXPERTS = {
    "psychology": "인간 심리 및 행동 분석",
    "linguistics": "언어 구조 및 LLM 최적화",
    "cognitive_science": "사고 과정 및 학습 모델링",
    "behavioral_economics": "의사결정 및 경제 심리",
    "communication_theory": "효과적 소통 전략",
    "ux_design": "사용자 경험 및 인터페이스",
    "quality_assurance": "품질 관리 및 검증",
    "performance_analytics": "성과 측정 및 분석",
    "innovation_strategy": "창신 및 차별화 전략",
    "systems_thinking": "시스템적 사고 및 통합"
}
```

**Category B: 도메인 전문성 (25개)**

```python
DOMAIN_EXPERTS = {
    # 업계별 (15개)
    "healthcare": "의료 및 건강관리",
    "finance": "금융 및 투자",
    "legal": "법률 및 규정",
    "education": "교육 및 학습",
    "retail": "소매 및 상거래",
    "technology": "기술 및 IT",
    "manufacturing": "제조 및 생산",
    "consulting": "컨설팅 및 전략",
    "media": "미디어 및 콘텐츠",
    "real_estate": "부동산",
    "automotive": "자동차 및 모빌리티",
    "hospitality": "숙박 및 서비스",
    "logistics": "물류 및 운송",
    "energy": "에너지 및 환경",
    "agriculture": "농업 및 식품",

    # 기능별 (10개)
    "customer_service": "고객 서비스 및 지원",
    "marketing": "마케팅 및 브랜딩",
    "sales": "영업 및 세일즈",
    "hr": "인사 및 조직 관리",
    "operations": "운영 및 프로세스",
    "product_management": "제품 기획 및 관리",
    "project_management": "프로젝트 관리",
    "risk_management": "리스크 관리",
    "compliance": "컴플라이언스 및 규제",
    "data_analytics": "데이터 분석 및 인사이트"
}
```

**Category C: 스타일 전문성 (15개)**

```python
STYLE_EXPERTS = {
    "empathy": "공감적 소통",
    "authority": "권위적 지시",
    "innovation": "혁신적 사고",
    "efficiency": "효율성 중심",
    "collaboration": "협업적 접근",
    "analytical": "분석적 논리",
    "creative": "창의적 발상",
    "strategic": "전략적 사고",
    "practical": "실용적 접근",
    "educational": "교육적 설명",
    "consultative": "컨설팅 방식",
    "supportive": "지원적 자세",
    "decisive": "결단력 있는 판단",
    "diplomatic": "외교적 소통",
    "entrepreneurial": "기업가적 사고"
}
```

### 4.2 Deep Specialization 자동 생성 로직

**트리거 조건**: 기본 전문가로 충분하지 않은 고도로 특화된 상황
**생성 방식**: 기본 전문가 + 특화 맥락 → 새로운 전문가 Agent

**자동 생성 프롬프트**:

```
다음 상황에서 필요한 초특화 전문가를 생성해야 합니다:

기본 전문가: {base_expert}
특화 맥락: {specialization_context}
요구사항: {specific_requirements}

생성할 전문가 사양:
1. 전문가 명: [기본 전문가 + 특화 분야]
2. 전문성 범위: [구체적 지식 영역]
3. 핵심 역량: [이 전문가만의 고유 능력]
4. 프롬프트 템플릿: [이 전문가가 사용할 표준 프롬프트]

예시:
기본: Psychology → 특화: "밀레니얼 B2B SaaS 구매 의사결정 심리 전문가"
```

---

## 5. Agent 품질 관리

### 5.1 Performance Guardian 통합 방식

**독립적 Agent**: 다른 Agent들의 성과를 객관적으로 평가
**핵심 기능**:

- 각 Agent의 기여도 실시간 측정
- Agent 간 협업 효율성 모니터링
- 전체 시스템 성능 균형 유지
- 성능 저하 시 원인 진단 및 개선안 제시

### 5.2 Agent별 성과 측정 기준

**Meta-Controller**: 전문가 조합 적절성, 전략 수립 정확성
**Prompt Architect**: 프롬프트 품질, 전문가 조언 통합도
**QA Generator**: 생성 속도, 품질 일관성, 다양성 확보
**Quality Auditor**: 검증 정확성, 개선 제안의 효과성
**Expert Council**: 조언의 전문성, 실용성, 협업 기여도

### 5.3 협업 충돌 해결 메커니즘

**충돌 유형별 해결 방식**:

```
Type 1: 전문가 간 의견 상충
해결: Meta-Controller가 사용자 요구사항 기반으로 우선순위 결정

Type 2: 품질 vs 효율성 트레이드오프
해결: "성능 > 복잡성" 원칙에 따라 품질 우선 선택

Type 3: 전문성 vs 일반성 균형
해결: 타겟 사용자 수준에 맞춘 적정점 탐색

충돌 해결 프로세스:
1. 충돌 감지 (Performance Guardian)
2. 조율 시도 (Meta-Controller)
3. 우선순위 적용 (시스템 원칙 기반)
4. 결과 검증 (Quality Auditor)
```

---

_이 명세서는 Claude Code가 각 Agent를 정확히 구현할 수 있도록 상세한 기능 정의와 프롬프트 템플릿을 제공합니다. 구체적인 기술 구현 방법은 Technical Architecture Guide를 참조하십시오._
