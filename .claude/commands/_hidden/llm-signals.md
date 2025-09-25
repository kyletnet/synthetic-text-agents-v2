# /llm-signals - LLM 최적화 문서 시그널링

RAG/LLM ingestion 최적화를 위한 문서 구조 태그 시스템입니다.

## 사용법

```bash
/llm-signals inject      # 문서에 최적화 태그 삽입
/llm-signals remove      # 모든 태그 제거 (롤백)
/llm-signals validate    # 태그 무결성 검증
```

## 🧩 LLM 최적화 태그 종류

### DOC:ENTITY - 엔터티 식별

```html
<!-- DOC:ENTITY:Agent-QAGenerator -->
<!-- DOC:ENTITY:Core-Orchestrator -->
<!-- DOC:ENTITY:System-MetaController -->
```

### DOC:SECTION - 섹션 분류

```html
<!-- DOC:SECTION:API-Reference -->
<!-- DOC:SECTION:Usage-Guide -->
<!-- DOC:SECTION:Configuration -->
```

### DOC:API - API 문서 표시

```html
<!-- DOC:API:REST-Endpoints -->
<!-- DOC:API:GraphQL-Schema -->
```

### DOC:CONCEPT - 개념 설명

```html
<!-- DOC:CONCEPT:Agent-Architecture -->
<!-- DOC:CONCEPT:Thought-Process-Programming -->
```

### DOC:EXAMPLE - 코드 예시

```html
<!-- DOC:EXAMPLE:Config-Examples -->
<!-- DOC:EXAMPLE:Usage-Patterns -->
```

### DOC:CONFIG - 설정 문서

```html
<!-- DOC:CONFIG:System-Configuration -->
```

## 📋 자동 삽입 규칙

| 문서 패턴             | 자동 삽입 태그                    | 배치 위치  |
| --------------------- | --------------------------------- | ---------- |
| `docs/**/*agent*.md`  | `DOC:ENTITY:Agent-{filename}`     | 문서 상단  |
| `docs/**/API*.md`     | `DOC:API:REST-Endpoints`          | 문서 상단  |
| `docs/**/*config*.md` | `DOC:CONFIG:System-Configuration` | 첫 헤딩 앞 |
| `docs/**/SYSTEM*.md`  | `DOC:CONCEPT:System-Architecture` | 문서 상단  |

## 💡 LLM 최적화 효과

### RAG 개선

- **정확한 청킹**: 엔터티/섹션 경계 인식
- **컨텍스트 보존**: 관련 정보 그룹핑
- **검색 정확도**: 태그 기반 필터링

### LLM Ingestion 최적화

- **의미적 구조**: 문서 내용의 목적 명시
- **참조 해결**: 엔터티 간 관계 추론
- **지식 추출**: 개념과 예시 분리

## 📊 생성되는 파일

### `.llm-signals-index.json`

```json
{
  "generated": "2025-09-25T10:30:00Z",
  "totalDocs": 45,
  "signaledDocs": 32,
  "signals": {
    "docs/AGENT_ARCHITECTURE.md": [
      { "type": "ENTITY", "identifier": "Agent-Architecture" },
      { "type": "CONCEPT", "identifier": "System-Architecture" }
    ]
  }
}
```

## 예시: 태그가 삽입된 문서

````markdown
<!-- DOC:ENTITY:Agent-QAGenerator -->
<!-- DOC:CONCEPT:Agent-Architecture -->
<!-- DOC:GENERATED:2025-09-25T10:30:00Z -->
<!-- DOC:SOURCE:docs/agents/qa-generator.md -->

# QA Generator Agent

## Overview

<!-- DOC:SECTION:Overview -->

QA Generator는 최적화된 프롬프트에서 대량의 QA 쌍을 생성합니다.

## Usage

<!-- DOC:SECTION:Usage-Guide -->

```typescript
<!-- DOC:EXAMPLE:Usage-Patterns -->
const generator = new QAGenerator(config);
const result = await generator.execute(context);
```
````

```

## 🔍 검증 및 품질 관리

### 자동 검증
- **중복 식별자 감지**: 같은 identifier 중복 사용 방지
- **필수 태그 누락 체크**: Agent 문서의 ENTITY 태그 등
- **태그 형식 검증**: 올바른 마크다운 주석 형식

### 품질 메트릭
- **시그널 커버리지**: 전체 문서 대비 태그 보유율
- **태그 밀도**: 문서당 평균 태그 수
- **일관성 점수**: 규칙 준수 정도

이 시스템으로 **LLM이 문서를 더 정확하게 이해하고 활용**할 수 있습니다! 🧩🤖
```
