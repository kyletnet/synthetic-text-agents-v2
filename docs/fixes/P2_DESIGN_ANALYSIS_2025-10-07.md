# P2 품질 이슈 설계 관점 심층 분석

**날짜**: 2025-10-07
**분석 범위**: 엔티티 커버리지, Evidence Alignment, 질문 유형 분류
**방법론**: 아키텍처 분석, 알고리즘 검증, 코드 리뷰

---

## Executive Summary

**P2 품질 이슈의 근본 원인은 "설계 수준"의 문제입니다.**

| 이슈                   | 증상             | 근본 원인        | 설계 문제                        |
| ---------------------- | ---------------- | ---------------- | -------------------------------- |
| **엔티티 커버리지**    | 46.7% (목표 50%) | 단순 n-gram 추출 | NER 부재, Agent 분리             |
| **Evidence Alignment** | ~46% (목표 60%)  | 문자 기반 유사도 | 의미 이해 부재, 피드백 루프 없음 |
| **질문 유형 분류**     | null (100%)      | 버그 + 패턴 한계 | 메트릭 계층 분리                 |

---

## 아키텍처 분석

### 현재 구조 (분산된 책임)

```
src/
├── agents/                    # QA 생성 (메트릭 무관)
│   ├── qaGenerator.ts
│   ├── diversityPlanner.ts   # ❌ 존재하지 않음!
│   └── ...
│
├── scripts/metrics/          # 메트릭 계산 (사후 평가)
│   ├── coverageMetrics.ts    # 엔티티 추출
│   ├── evidenceQuality.ts    # Alignment 계산
│   └── qtypeDistribution.ts  # ❌ 질문 유형 (미작동)
│
└── tools/                    # 외부 분석 도구
    └── diversity_analyzer.js # 질문 유형 분류 (정규식)
```

### 핵심 설계 문제

1. **Agent와 Metric의 분리**

   - QA 생성 시 품질 목표를 고려하지 못함
   - Metric 계산은 사후 평가만 가능
   - **피드백 루프 부재** ← 가장 큰 문제

2. **Diversity Planner 부재**

   - P2 계획에는 `diversityPlanner.ts` 언급
   - 실제로는 `tools/diversity_analyzer.js` (외부 도구)
   - Agent 계층에 통합되지 않음

3. **단순한 알고리즘**
   - 엔티티: 단순 n-gram (NER 없음)
   - Alignment: 문자 유사도 (의미 없음)
   - 유형: 정규식 (LLM 미사용)

---

## Issue 1: 엔티티 커버리지 (46.7% → 50%)

### 근본 원인 분석

#### 현재 구현 (`coverageMetrics.ts`)

```typescript
// Line 61-96: 단순 n-gram 추출
function extractKeyPhrases(
  text: string,
  minLength: number,
  maxLength: number,
): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, " ") // ❌ 한자 제거됨!
    .trim();

  // n-gram 추출 (1-3 단어)
  for (let n = minLength; n <= maxLength; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const phrase = words.slice(i, i + n).join(" ");
      phrases.push(phrase);
    }
  }

  return phrases; // ❌ 빈도순 정렬, NER 없음
}
```

**문제점**:

1. **한자 처리 부재**: "구이디" (본명) → 정규식에서 제거됨
2. **복합어 처리 실패**: "건축에서의" → "건축", "에서의" 분리 안 됨
3. **고유명사 인식 없음**: "브루넬레스키나" → 일반 n-gram으로만 처리
4. **빈도 기반 추출**: 중요하지만 빈도 낮은 엔티티 누락

#### 누락된 엔티티 분석

**Baseline 데이터**:

```json
{
  "missing_entities": ["구이디", "건축에서의", "브루넬레스키나"],
  "evidence": "본명 구이디. 건축에서의 브루넬레스키나 조각에서의 도나텔로와 함께..."
}
```

**근본 원인**:

- "구이디": 한자 이름 → 정규식 `/[^\w\s가-힣]/` 에서 제거
- "건축에서의": 복합어 → 분리 처리 안 됨
- "브루넬레스키나": 외국 고유명사 → NER 없어서 인식 실패

### 설계 개선 방향

#### A. Named Entity Recognition (NER) 도입

```typescript
// src/domain/extraction/entity-recognizer.ts (신규)

export interface EntityRecognizer {
  extractEntities(text: string): Entity[];
}

export interface Entity {
  text: string;
  type: "PERSON" | "LOCATION" | "TERM" | "OTHER";
  confidence: number;
  span: [number, number];
}

// 한국어 특화 NER
export class KoreanNER implements EntityRecognizer {
  private patterns = {
    person: /([가-힣]{2,4}|[A-Z][a-z]+\s*[A-Z][a-z]+)/g, // 한국 이름 + 외국 이름
    location: /(시칠리아|베네치아|밀라노|[가-힣]+시|[가-힣]+도)/g,
    term: /(르네상스|고딕|유화|명암표현법|원근법)/g,
  };

  extractEntities(text: string): Entity[] {
    const entities: Entity[] = [];

    // 패턴 매칭
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        entities.push({
          text: match[0],
          type: type.toUpperCase() as any,
          confidence: 0.8,
          span: [match.index!, match.index! + match[0].length],
        });
      }
    }

    // 한자 이름 처리
    const hanjaNames = text.match(/[一-龥]{2,4}/g) || [];
    entities.push(
      ...hanjaNames.map((name) => ({
        text: name,
        type: "PERSON",
        confidence: 0.7,
        span: [0, 0], // 실제 구현 시 정확한 위치
      })),
    );

    return this.deduplicateEntities(entities);
  }
}
```

#### B. 도메인 엔티티 사전

```typescript
// src/domain/extraction/entity-dictionary.ts (신규)

export const DOMAIN_ENTITIES = {
  art_renaissance: {
    persons: ["마사초", "브루넬레스키", "도나텔로", "안토넬로", "두초"],
    locations: ["시칠리아", "베네치아", "밀라노", "메시나", "시에나"],
    terms: ["르네상스", "고딕", "국제고딕양식", "유화", "명암표현법", "원근법"],
  },
  // 다른 도메인 추가 가능
};

export class DictionaryBasedExtractor implements EntityRecognizer {
  extractEntities(text: string, domain: string): Entity[] {
    const dict = DOMAIN_ENTITIES[domain] || {};
    const entities: Entity[] = [];

    for (const [type, keywords] of Object.entries(dict)) {
      for (const keyword of keywords as string[]) {
        const regex = new RegExp(keyword, "g");
        const matches = [...text.matchAll(regex)];
        for (const match of matches) {
          entities.push({
            text: match[0],
            type: type.toUpperCase() as any,
            confidence: 0.9, // 사전 기반은 신뢰도 높음
            span: [match.index!, match.index! + match[0].length],
          });
        }
      }
    }

    return entities;
  }
}
```

#### C. Agent 계층 통합

```typescript
// src/agents/diversityPlanner.ts (신규 생성)

import { KoreanNER } from "../domain/extraction/entity-recognizer.js";
import { DictionaryBasedExtractor } from "../domain/extraction/entity-dictionary.js";

export class DiversityPlanner {
  private ner = new KoreanNER();
  private dictExtractor = new DictionaryBasedExtractor();

  async planDiversity(sourceTexts: string[], domain: string) {
    // 1. 엔티티 추출 (NER + 사전 결합)
    const nerEntities = sourceTexts.flatMap((text) =>
      this.ner.extractEntities(text),
    );
    const dictEntities = sourceTexts.flatMap((text) =>
      this.dictExtractor.extractEntities(text, domain),
    );

    // 2. 엔티티 병합 및 우선순위 결정
    const allEntities = this.mergeEntities([...nerEntities, ...dictEntities]);

    // 3. QA 생성 목표 설정
    const coverageTarget = 0.5; // 50% 목표
    const targetEntities = this.selectTargetEntities(
      allEntities,
      coverageTarget,
    );

    return {
      targetEntities,
      coverageGoal: coverageTarget,
      generationStrategy: this.createGenerationStrategy(targetEntities),
    };
  }

  private selectTargetEntities(
    entities: Entity[],
    targetRate: number,
  ): Entity[] {
    // 신뢰도 기반 정렬
    const sorted = entities.sort((a, b) => b.confidence - a.confidence);

    // 상위 N개 선택 (목표 커버리지 달성)
    const count = Math.ceil(entities.length * targetRate);
    return sorted.slice(0, count);
  }
}
```

---

## Issue 2: Evidence Alignment (~46% → 60%)

### 근본 원인 분석

#### 현재 구현 (`evidenceQuality.ts`)

```typescript
// Line 157-178: 단순 문자 기반 유사도
function calculateSnippetAlignment(
  answer: string,
  evidence: string,
  config: EvidenceConfig,
): number {
  // 1. n-gram overlap (3-gram)
  const ngramOverlap = calculateNgramOverlap(answer, evidence, 3);

  // 2. Character-level cosine similarity
  const cosineSim = calculateCosineSimilarity(answer, evidence);

  // 3. 가중 평균 (40% + 60%)
  const alignmentScore = ngramOverlap * 0.4 + cosineSim * 0.6;

  return Math.min(alignmentScore, 1.0);
}
```

**문제점**:

1. **의미 무시**: "브루넬레스키와 함께" ≠ "15세기 초 유행하던 국제고딕양식"

   - 문자적으로 완전히 다름 → Alignment 0%
   - 하지만 의미상 관련있음 (Evidence에서 추론 가능)

2. **의역 처리 불가**:

   ```
   Evidence: "브루넬레스키나 도나텔로와 함께"
   Answer: "마사초는 15세기 초 유행하던 국제고딕양식을 따르지 않았어요"
   Alignment: 26.9% ❌
   ```

   - 답변이 Evidence를 의역/확장 → 문자 매칭 실패

3. **인용구 추출 없음**: 직접 인용 부분을 감지하지 못함

#### Baseline 데이터 분석

```json
{
  "alignment_score": 0.2687, // 26.9% (매우 낮음)
  "evidence": "본명 구이디. 건축에서의 브루넬레스키나...",
  "answer": "마사초는 15세기 초 유행하던 국제고딕양식을 따르지 않았어요..."
}
```

**왜 낮은가?**:

- Evidence에는 "브루넬레스키", "도나텔로" 언급
- Answer에는 "국제고딕양식", "15세기 초" 언급
- **겹치는 단어 거의 없음** → n-gram overlap 0%
- **문자 분포도 다름** → cosine similarity 낮음

### 설계 개선 방향

#### A. 의미 기반 Alignment (Semantic Similarity)

```typescript
// src/domain/alignment/semantic-aligner.ts (신규)

export interface SemanticAligner {
  calculateAlignment(answer: string, evidence: string): AlignmentResult;
}

export interface AlignmentResult {
  score: number;
  method: "direct_quote" | "paraphrase" | "inference" | "unrelated";
  matchedSpans: Array<{
    answerSpan: string;
    evidenceSpan: string;
    similarity: number;
  }>;
}

// LLM 기반 의미 정렬
export class LLMSemanticAligner implements SemanticAligner {
  async calculateAlignment(
    answer: string,
    evidence: string,
  ): Promise<AlignmentResult> {
    // 1. 직접 인용 검사
    const directQuotes = this.extractDirectQuotes(answer, evidence);
    if (directQuotes.length > 0) {
      return {
        score: 0.95,
        method: "direct_quote",
        matchedSpans: directQuotes,
      };
    }

    // 2. 의역 검사 (LLM 사용)
    const paraphraseScore = await this.checkParaphrase(answer, evidence);
    if (paraphraseScore > 0.7) {
      return {
        score: paraphraseScore,
        method: "paraphrase",
        matchedSpans: [],
      };
    }

    // 3. 추론 검사 (Evidence에서 추론 가능한가?)
    const inferenceScore = await this.checkInference(answer, evidence);
    return {
      score: inferenceScore,
      method: inferenceScore > 0.5 ? "inference" : "unrelated",
      matchedSpans: [],
    };
  }

  private async checkParaphrase(
    answer: string,
    evidence: string,
  ): Promise<number> {
    const prompt = `
다음 두 문장이 같은 의미인지 0-1 사이 점수로 평가하세요:

Evidence: "${evidence}"
Answer: "${answer}"

점수 (0.0-1.0):`;

    // LLM 호출
    const response = await this.llm.complete(prompt);
    return parseFloat(response) || 0;
  }

  private async checkInference(
    answer: string,
    evidence: string,
  ): Promise<number> {
    const prompt = `
Evidence에서 Answer를 추론할 수 있는지 0-1 사이 점수로 평가하세요:

Evidence: "${evidence}"
Answer: "${answer}"

추론 가능성 (0.0-1.0):`;

    const response = await this.llm.complete(prompt);
    return parseFloat(response) || 0;
  }
}
```

#### B. Citation 직접성 강화 (Prompt 개선)

```typescript
// src/agents/qaGenerator.ts (개선)

export class QAGenerator {
  async generateQA(evidence: string, domain: string): Promise<QAItem> {
    const prompt = `
Evidence를 **직접 인용**하여 QA를 생성하세요.

Evidence: "${evidence}"

요구사항:
1. Answer는 Evidence의 문장을 **그대로 포함**해야 합니다.
2. "문서에 따르면 '${직접 인용}' 합니다" 형식 사용.
3. 의역보다는 직접 인용 우선.

Q:
A:`;

    const qa = await this.llm.complete(prompt);

    // 생성 후 Alignment 검증
    const alignment = await this.aligner.calculateAlignment(qa.a, evidence);

    // Alignment가 낮으면 재생성
    if (alignment.score < 0.5) {
      return this.regenerateWithDirectQuote(evidence, qa);
    }

    return qa;
  }

  private async regenerateWithDirectQuote(evidence: string, failedQA: QAItem): Promise<QAItem> {
    const prompt = `
이전 답변의 Alignment가 낮습니다. Evidence를 **더 직접적으로 인용**하세요.

Evidence: "${evidence}"
이전 답변: "${failedQA.a}"

개선된 답변 (Evidence의 핵심 문장을 그대로 포함):`;

    const improved = await this.llm.complete(prompt);
    return { ...failedQA, a: improved };
  }
}
```

#### C. Alignment 기반 피드백 루프

```
┌─────────────┐
│ QA 생성     │
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Alignment   │ ─── score < 0.5 ───┐
│ 계산        │                    │
└─────┬───────┘                    │
      │ score ≥ 0.5                │
      ▼                            ▼
┌─────────────┐            ┌─────────────┐
│ 품질 검증   │            │ 재생성      │
│ 통과        │            │ (직접 인용) │
└─────────────┘            └─────┬───────┘
                                  │
                                  │
                                  └──────┐
                                         │
                                         ▼
                                   (최대 3회 재시도)
```

---

## Issue 3: 질문 유형 분류 (null → 4가지 균형)

### 근본 원인 분석

#### 현재 구현 (`tools/diversity_analyzer.js`)

```javascript
// Line 17-34: 정규식 기반 분류
function judgeType(q) {
  const s = (q || "").toLowerCase();
  if (/[?]\s*$/.test(s) === false && /^q[:：]/.test(s) === false)
    return "other";
  if (/[왜|why]/.test(s)) return "why";
  if (/[어떻게|how]/.test(s)) return "how";
  if (/[누가|who]/.test(s)) return "who";
  if (/[언제|when]/.test(s)) return "when";
  if (/[어디|where]/.test(s)) return "where";
  if (/[무엇|what]/.test(s)) return "what";
  if (/[정의|정의하|define]/.test(s)) return "define";
  if (/(맞|맞나요|참|거짓|true|false|yes|no)/.test(s)) return "yesno";
  return "what";
}
```

**문제점**:

1. **외부 도구**: `tools/` 폴더 (Agent 계층 밖)
2. **Baseline에서 미사용**: `classified_type: null` (100%)
3. **패턴 한계**:
   - "마사초가 르네상스 양식의 창시자라는데 왜 그런거야?"
   - → `/왜/` 매칭 → "why" ✅
   - 하지만 baseline에서는 `null` 반환 ❌

#### 버그 추적

**Baseline 생성 흐름**:

```typescript
// baselineReportGenerator.ts 확인 필요
{
  "qtype": {
    "classified_type": null,  // ❌ 항상 null
    "confidence": 0.8,
    "unclassified": false
  }
}
```

**추정 원인**:

- `qtypeDistribution.ts` 모듈이 실제로 호출되지 않음
- 또는 호출되지만 결과가 null 반환
- Baseline 생성 시 qtype 계산 로직 누락

### 설계 개선 방향

#### A. 버그 수정 및 통합

```typescript
// src/scripts/metrics/qtypeDistribution.ts (수정)

export function classifyQuestionType(question: string): string {
  const q = question.toLowerCase();

  // 패턴 매칭
  if (/왜|이유|원인/.test(q)) return "analytical";
  if (/어떻게|방법|과정/.test(q)) return "procedural";
  if (/차이|비교|다른/.test(q)) return "comparative";
  if (/무엇|누가|언제|어디/.test(q)) return "factual";

  return "factual"; // 기본값
}

// baseline 생성 시 호출되도록 수정
export function analyzeQTypeDistribution(qaItems: QAItem[]): QTypeMetrics {
  const distribution = {
    analytical: 0,
    procedural: 0,
    comparative: 0,
    factual: 0,
  };

  for (const item of qaItems) {
    const type = classifyQuestionType(item.qa.q); // ✅ 실제 분류
    distribution[type] = (distribution[type] || 0) + 1;
  }

  return {
    distribution,
    balance_score: calculateBalanceScore(distribution),
  };
}
```

#### B. Agent 계층 연동

```typescript
// src/agents/diversityPlanner.ts (추가)

export class DiversityPlanner {
  async planQuestionDiversity(targetCount: number) {
    // 목표 분포 설정
    const targetDistribution = {
      analytical: Math.floor(targetCount * 0.3), // 30%
      procedural: Math.floor(targetCount * 0.3), // 30%
      comparative: Math.floor(targetCount * 0.2), // 20%
      factual: Math.floor(targetCount * 0.2), // 20%
    };

    return {
      targetDistribution,
      generationPlan: this.createGenerationPlan(targetDistribution),
    };
  }

  private createGenerationPlan(distribution: Record<string, number>) {
    const plan = [];

    for (const [type, count] of Object.entries(distribution)) {
      for (let i = 0; i < count; i++) {
        plan.push({
          type,
          prompt: this.createPromptForType(type),
        });
      }
    }

    return plan;
  }

  private createPromptForType(type: string): string {
    const prompts = {
      analytical: "왜 ...인가요? 이유를 설명하는 질문을 생성하세요.",
      procedural: "어떻게 ...하나요? 과정을 묻는 질문을 생성하세요.",
      comparative: "...와 ...의 차이는 무엇인가요? 비교하는 질문을 생성하세요.",
      factual: "...는 무엇인가요? 사실을 묻는 질문을 생성하세요.",
    };

    return prompts[type] || prompts.factual;
  }
}
```

---

## 근본 설계 개선 전략

### 1. 계층 재구조화

#### Before (분산됨)

```
src/
├── agents/          # QA 생성
├── scripts/metrics/ # 메트릭 (사후)
└── tools/           # 외부 도구
```

#### After (통합됨)

```
src/
├── domain/
│   ├── extraction/         # NER, 엔티티 사전
│   ├── alignment/          # 의미 기반 정렬
│   └── classification/     # 질문 유형 분류
│
├── agents/
│   └── diversityPlanner.ts  # ✅ 품질 목표 설정
│       ├── 엔티티 커버리지 목표
│       ├── Alignment 목표
│       └── 질문 유형 목표
│
└── scripts/metrics/        # 검증만 담당
    ├── coverageMetrics.ts
    ├── evidenceQuality.ts
    └── qtypeDistribution.ts
```

### 2. 피드백 루프 구축

```
┌──────────────────┐
│ Diversity Planner│
│ (목표 설정)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ QA Generator     │
│ (생성)           │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Quality Validator│
│ (검증)           │
└────────┬─────────┘
         │
    목표 미달?
         │
         ├── Yes ──► Regenerate (최대 3회)
         │
         └── No  ──► Accept
```

### 3. LLM 활용 강화

| 현재 (규칙 기반) | 개선 (LLM 기반)     |
| ---------------- | ------------------- |
| n-gram 추출      | NER + 도메인 사전   |
| 문자 유사도      | 의미 기반 Alignment |
| 정규식 분류      | LLM 분류 + 패턴     |

---

## 구현 우선순위

### Phase 1: 긴급 수정 (1-2시간)

1. ✅ **버그 수정**: QType 분류 null 반환 수정
2. ✅ **Baseline 통합**: qtypeDistribution 호출 확인

### Phase 2: 핵심 개선 (4-6시간)

1. ✅ **NER 도입**: KoreanNER + 도메인 사전
2. ✅ **Diversity Planner 생성**: Agent 계층 통합
3. ✅ **Alignment 개선**: 직접 인용 강화 (Prompt)

### Phase 3: 고도화 (향후)

1. ⏳ **Semantic Aligner**: LLM 기반 의미 정렬
2. ⏳ **피드백 루프**: Regeneration 메커니즘
3. ⏳ **임베딩 활용**: Vector similarity

---

## 예상 효과

| 지표                   | 현재  | 목표       | 개선 방법                  |
| ---------------------- | ----- | ---------- | -------------------------- |
| **엔티티 커버리지**    | 46.7% | 50%+       | NER + 도메인 사전          |
| **Evidence Alignment** | ~46%  | 60%+       | 직접 인용 강화 + 의미 정렬 |
| **질문 유형 분류**     | null  | 4가지 균형 | 버그 수정 + Agent 연동     |

---

## 다음 단계

1. **Phase 1 실행** (즉시)

   - qtypeDistribution 버그 수정
   - baseline 생성 흐름 확인

2. **Phase 2 설계** (오늘)

   - NER 시스템 설계
   - Diversity Planner 인터페이스 정의
   - Prompt 개선 전략 수립

3. **구현 및 검증** (내일~)
   - 단계별 구현
   - 100개 샘플 테스트
   - Baseline 업데이트

---

**작성자**: Claude Code
**검토 필요**: 아키텍처 팀
**관련 문서**:

- `docs/P2_QUALITY_IMPROVEMENT_PLAN.md` (기존 계획)
- `src/scripts/metrics/coverageMetrics.ts` (현재 구현)
- `src/scripts/metrics/evidenceQuality.ts` (현재 구현)
- `tools/diversity_analyzer.js` (현재 분류기)
