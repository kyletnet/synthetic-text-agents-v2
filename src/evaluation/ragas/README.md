# RAGAS Evaluation Framework (Phase 4)

**Status:** 🚧 Foundation Created (Week 2) → Phase 4 Implementation Pending

---

## What is RAGAS?

**RAGAS** (Retrieval-Augmented Generation Assessment) is a framework for evaluating RAG systems using LLM-as-a-Judge.

**Key Metrics:**
1. **Context Recall** - Did retrieval get all necessary information?
2. **Context Precision** - Are retrieved contexts relevant?
3. **Answer Faithfulness** - Is answer grounded in retrieved contexts?
4. **Answer Relevance** - Does answer match question intent?

---

## Why RAGAS?

### Problem: Manual QA Evaluation is Expensive

**Traditional Approach:**
- ❌ Human reviewers rate each Q&A pair
- ❌ Time: ~5 min/pair × 1000 pairs = 83 hours
- ❌ Cost: $25/hour × 83 hours = $2,075
- ❌ Consistency: Inter-rater agreement ~70%

**RAGAS Approach:**
- ✅ LLM evaluates using structured prompts
- ✅ Time: ~5 sec/pair × 1000 pairs = 1.4 hours
- ✅ Cost: $0.01/pair × 1000 pairs = $10
- ✅ Consistency: Deterministic (same prompt → same score)

---

## RAGAS ↔ Gate Mapping

Our existing Gate system maps perfectly to RAGAS metrics:

| RAGAS Metric | Maps to Gate | What it Measures |
|--------------|--------------|-------------------|
| **Context Recall** | Gate B (Evidence Hit) | Retrieval coverage |
| **Context Precision** | Gate D (Diversity) | Retrieval relevance |
| **Answer Faithfulness** | Gate G (Compliance) | Grounding in evidence |
| **Answer Relevance** | Gate E (Explanation) | Answer quality |

**Benefit:** We can auto-generate Gate scores from RAGAS metrics!

---

## How RAGAS Works

### Input
```typescript
{
  question: "아이돌봄 서비스 요금은 얼마인가요?",
  answer: "기본형은 11,630원, 종합형은 15,110원입니다.",
  contexts: [
    "제3조 아이돌봄 서비스 요금\n기본형 11,630원\n종합형 15,110원",
    "정부 지원금은 소득에 따라 차등 지급됩니다."
  ],
  groundTruth: "기본형 11,630원, 종합형 15,110원" // Optional
}
```

### Process

1. **Context Recall** (LLM Evaluation)
   ```
   Prompt: "Based on the ground truth answer, what % of necessary
           information is present in the retrieved contexts?"
   Output: 100% (all pricing info retrieved)
   Score: 1.0
   ```

2. **Context Precision** (LLM Evaluation)
   ```
   Prompt: "For each retrieved context, is it relevant to answering
           the question?"
   Output:
     - Context 1: Relevant (pricing)
     - Context 2: Irrelevant (support, not pricing)
   Score: 0.5 (1/2 contexts relevant)
   ```

3. **Answer Faithfulness** (LLM Evaluation)
   ```
   Prompt: "Break down the answer into statements. For each statement,
           is it supported by the contexts?"
   Output:
     - "기본형은 11,630원" → Supported (Context 1)
     - "종합형은 15,110원" → Supported (Context 1)
   Score: 1.0 (2/2 statements grounded)
   ```

4. **Answer Relevance** (Embedding Similarity)
   ```
   Compute: cosine_similarity(embed(question), embed(answer))
   Score: 0.92 (highly relevant)
   ```

### Output
```typescript
{
  metrics: {
    contextRecall: 1.0,
    contextPrecision: 0.5,
    answerFaithfulness: 1.0,
    answerRelevance: 0.92,
    overall: 0.82 // Harmonic mean
  },
  gateMapping: {
    contextRecall: "Gate B: 1.0",
    contextPrecision: "Gate D: 0.5",
    answerFaithfulness: "Gate G: 1.0",
    answerRelevance: "Gate E: 0.92"
  }
}
```

---

## Expected Performance (RFC Targets)

| Metric | Baseline | Phase 3 (Vision+Hybrid) | Phase 4 (RAGAS) |
|--------|----------|------------------------|-----------------|
| Context Recall | 65% | 85% | **88%** ✅ |
| Context Precision | 70% | 85% | **87%** ✅ |
| Faithfulness | 80% | 90% | **92%** ✅ |
| Relevance | 75% | 88% | **90%** ✅ |

---

## Implementation Plan

### Phase 4 Week 1: Core RAGAS
1. ⏳ Implement `RAGASEvaluator` class
2. ⏳ Add LLM-based Context Recall evaluator
3. ⏳ Add LLM-based Context Precision evaluator
4. ⏳ Add LLM-based Answer Faithfulness evaluator
5. ⏳ Add embedding-based Answer Relevance

### Phase 4 Week 2: Gate Integration
1. ⏳ Auto-map RAGAS → Gate scores
2. ⏳ Update Gate reports with RAGAS metrics
3. ⏳ Add RAGAS to CI/CD pipeline

### Phase 4 Week 3: Automation
1. ⏳ Batch evaluation script
2. ⏳ Scheduled RAGAS runs (nightly)
3. ⏳ Quality regression detection

---

## Usage Example (Phase 4 Target)

```typescript
import { RAGASEvaluator } from './ragas-evaluator';

const evaluator = new RAGASEvaluator({
  llmProvider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  apiKey: process.env.ANTHROPIC_API_KEY,
  saveResults: true
});

// Single evaluation
const result = await evaluator.evaluate({
  question: "아이돌봄 서비스 요금은 얼마인가요?",
  answer: "기본형은 11,630원, 종합형은 15,110원입니다.",
  contexts: [
    "제3조 아이돌봄 서비스 요금\n기본형 11,630원\n종합형 15,110원"
  ]
});

console.log(result.metrics.overall); // 0.92

// Batch evaluation
const dataset = loadQAPairs('datasets/qa-test.json');
const results = await evaluator.evaluateBatch(dataset);

// Save report
await evaluator.saveReport(results, 'reports/ragas/phase4.json');
```

---

## Files to Create (Phase 4)

- [ ] `ragas-evaluator.ts` - Main evaluator
- [ ] `metrics/context-recall.ts` - Context Recall calculator
- [ ] `metrics/context-precision.ts` - Context Precision calculator
- [ ] `metrics/answer-faithfulness.ts` - Faithfulness calculator
- [ ] `metrics/answer-relevance.ts` - Relevance calculator
- [ ] `gate-integration.ts` - Map RAGAS → Gates
- [ ] `types.ts` - ✅ Already created
- [ ] `README.md` - ✅ This file

---

## References

- **RAGAS Paper:** https://arxiv.org/abs/2309.15217
- **RFC:** `designs/rfc/rfc-integrate-multimodal-rag-augmentation.md`
- **Gate System:** `src/core/quality/gating-system.ts`
- **Evaluation Guide:** `docs/EVALUATION_GUIDE.md`

---

**Next Session Command:**
```bash
# Phase 4: Start RAGAS implementation
# 1. Install dependencies
npm install @langchain/community @langchain/core

# 2. Implement evaluator
code src/evaluation/ragas/ragas-evaluator.ts

# 3. Run tests
npm run test -- ragas
```

---

**Status:** ✅ Foundation complete, ready for Phase 4 implementation
