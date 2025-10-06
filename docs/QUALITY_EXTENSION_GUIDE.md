# Quality Extension Guide

**외부 지식을 시스템에 매핑하는 가이드**

이 문서는 외부 참조 문서(가이드라인, 연구 자료)를 품질 시스템 코드에 연결하는 방법을 설명합니다.

---

## 📚 외부 지식 소스

### 1. QA Generation Guidelines

**위치**: `docs/guidelines/qa-generation-guidelines.md`

**내용**:

- 7가지 질문 유형
- 숫자 표현 규칙
- 금지 패턴
- 답변 구조 기준

**적용 위치**:
| 소스 섹션 | 적용 코드 | Phase |
|-----------|---------|-------|
| 질문 유형 7가지 | `checkers/rule-based-checker.ts` | Phase 1 |
| 숫자 표현 규칙 | `checkers/rule-based-checker.ts` | Phase 1 |
| 금지 패턴 | `checkers/rule-based-checker.ts` | Phase 1 |
| 답변 구조 | `checkers/rule-based-checker.ts` | Phase 1 |

**파싱 흐름**:

```
qa-generation-guidelines.md
   ↓
parsers/guideline-parser.ts
   ↓
docs/guidelines/cache/rules.v1.0.json
   ↓
checkers/rule-based-checker.ts
```

---

### 2. RAG Architecture Reference

**위치**: `docs/research/rag-architecture-reference.md`

**내용**:

- Multi-View Embedding
- Query-Side Embedding
- Hybrid Search (BM25 + Vector)
- Ragas Evaluation

**적용 위치**:
| 소스 섹션 | 적용 코드 | Phase |
|-----------|---------|-------|
| Multi-View Embedding | `checkers/multiview-embedding-checker.ts` | Phase 4 |
| Query-Side Embedding | `checkers/queryside-embedding-checker.ts` | Phase 4 |
| Hybrid Search | `checkers/hybrid-search-checker.ts` | Phase 2-3 |
| Ragas Evaluation | `checkers/ragas-evaluation-checker.ts` | Phase 2-3 |
| Evidence Alignment | `checkers/evidence-aligner.ts` | Phase 2 |

**설계 참조 흐름**:

```
rag-architecture-reference.md
   ↓ (설계 원칙 참조)
checkers/semantic-checker.ts
   ↓ (인터페이스 정의)
EmbeddingModel, HybridSearch
```

---

## 🔌 매핑 규칙

### Rule 1: 직접 코드 복사 금지

❌ **잘못된 예시**:

```typescript
// 문서 내용을 하드코딩
const questionTypes = [
  "기본정보",
  "조건부",
  "비교",
  "절차",
  "계산",
  "복합",
  "기간",
];
```

✅ **올바른 예시**:

```typescript
// 문서 파싱 결과를 사용
const rules = await parseGuideline(
  "docs/guidelines/qa-generation-guidelines.md",
);
const questionTypes = rules.questionTypes;
```

---

### Rule 2: 버전 관리 필수

모든 참조 문서는 버전을 명시합니다.

```json
// docs/guidelines/versions.json
{
  "active": "1.0",
  "versions": [
    {
      "version": "1.0",
      "path": "qa-generation-guidelines.md",
      "effectiveDate": "2024-10-06",
      "rulesCount": 42
    }
  ]
}
```

코드에서 사용:

```typescript
const version = await getActiveGuidelineVersion(); // "1.0"
const rules = await loadRules(version);
```

---

### Rule 3: 캐시 활용

파싱 결과는 캐시하여 재사용합니다.

```
docs/guidelines/
├── qa-generation-guidelines.md     ← 원본
├── versions.json                   ← 버전 관리
└── cache/
    ├── rules.v1.0.json             ← 파싱 캐시
    └── hash.v1.0.txt               ← 변경 감지
```

**캐시 갱신 조건**:

- 원본 문서 해시 변경
- 버전 번호 변경
- 명시적 재파싱 요청

---

## 🔄 업데이트 프로세스

### 가이드라인 업데이트 시

1. **문서 수정**

```bash
vi docs/guidelines/qa-generation-guidelines.md
```

2. **버전 업데이트**

```json
// docs/guidelines/versions.json
{
  "active": "1.1",
  "versions": [
    {
      "version": "1.1",
      "path": "qa-generation-guidelines.md",
      "effectiveDate": "2024-10-13",
      "rulesCount": 45,
      "changes": ["새로운 질문 유형 추가", "숫자 표현 규칙 강화"]
    },
    ...
  ]
}
```

3. **캐시 재생성**

```bash
npm run quality:parse-guidelines
```

4. **검증**

```bash
npm run quality:assess
```

---

### RAG 기술 업데이트 시

1. **연구 문서 업데이트**

```bash
vi docs/research/rag-architecture-reference.md
```

2. **RFC 작성** (필요시)

```bash
docs/RFC/2024-10-new-rag-technique.md
```

3. **Checker 구현**

```bash
scripts/quality/checkers/new-technique-checker.ts
```

4. **Feature Flag 추가**

```bash
FEATURE_QUALITY_NEW_TECHNIQUE=false
```

5. **A/B 테스트**

```bash
npm run quality:ab-test -- --experimental=new-technique
```

---

## 📊 추적 및 모니터링

### 문서-코드 일치성 검증

```bash
npm run quality:validate-mapping
```

**검증 항목**:

- [ ] 가이드라인의 모든 규칙이 checker에 구현됨
- [ ] RAG 문서의 기술이 인터페이스로 정의됨
- [ ] 버전 관리 정합성
- [ ] 캐시 최신성

---

## 🎯 Quick Reference

| 작업            | 명령어                             |
| --------------- | ---------------------------------- |
| 가이드라인 파싱 | `npm run quality:parse-guidelines` |
| 캐시 정리       | `npm run quality:clear-cache`      |
| 매핑 검증       | `npm run quality:validate-mapping` |
| 버전 확인       | `npm run quality:version`          |

---

## 예시: 새로운 규칙 추가

### Scenario

가이드라인에 "대화형 질문 유형" 추가

### Step 1: 가이드라인 업데이트

```markdown
### 8. 대화형 질문 (난이도: 중)

**특징**

- 이전 맥락을 참조하는 질문
- 대화 흐름이 자연스러움

**예시**

- Q: 연차는 몇 일인가요?
- A: 15일입니다.
- Q: 그럼 3년차는요? ← 대화형 질문
```

### Step 2: 버전 업데이트

```json
{
  "version": "1.1",
  "changes": ["대화형 질문 유형 추가"]
}
```

### Step 3: 파싱 및 검증

```bash
npm run quality:parse-guidelines
npm run quality:assess
```

### Step 4: Checker 자동 적용

```typescript
// 파싱된 규칙이 자동으로 포함됨
const rules = await loadRules("1.1");
// rules.questionTypes에 '대화형' 추가됨
```

---

**Last Updated**: 2024-10-06
**Version**: 1.0.0
