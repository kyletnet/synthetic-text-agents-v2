# 🚀 Next Session Quick Start Guide

**Phase 7.1 Intent-Driven RAG - Session 2**

---

## ⚡ Quick Start (5 minutes)

### 1. Verify State
```bash
# Check compilation
npx tsc --noEmit

# Verify Intent Classifier
npx tsx scripts/test-intent-classifier.ts
```

### 2. Create Benchmark Script
```bash
# Copy and modify existing benchmark
cp scripts/real-hybrid-benchmark.ts scripts/real-hybrid-benchmark-intent.ts
```

### 3. Run Benchmark
```bash
# Execute Intent-Driven benchmark
USE_REAL_CLIENTS=true npx tsx scripts/real-hybrid-benchmark-intent.ts
```

### 4. Compare Results
```bash
# Phase 6 baseline
cat reports/hybrid-benchmark/real-benchmark-ragas.json | jq '.summary.ragas'

# Phase 7.1 Intent-Driven
cat reports/hybrid-benchmark/intent-driven-benchmark.json | jq '.summary.ragas'
```

---

## 📋 Implementation Checklist

### Benchmark Script Modifications

**File:** `scripts/real-hybrid-benchmark-intent.ts`

**Changes needed:**
1. Import IntentDrivenAdaptiveRAG
```typescript
import { createIntentDrivenAdaptiveRAG } from '../src/runtime/adaptive-rag';
```

2. Replace AdaptiveRAG with IntentDrivenAdaptiveRAG
```typescript
const adaptiveRAG = createIntentDrivenAdaptiveRAG(
  hybridSearchEngine,
  undefined, // LLM generator (optional for Phase 7.1)
  {
    initialK: 2,
    maxK: 6,
    confidenceThreshold: 0.7,
    enableIntentClassification: true,
    enableEvidenceLockedPrompt: true,
    requireCitation: true,
    allowSynthesis: true,
  }
);
```

3. Update result tracking
```typescript
const result = await adaptiveRAG.query({ query, filters: {} });

// Log intent
if (result.intent) {
  console.log(`  Intent: ${result.intent.type} (${result.intent.expectedAnswerType})`);
}

// Log citation compliance
if (result.promptTemplate) {
  console.log(`  Prompt Template Length: ${result.promptTemplate.length}`);
}
```

---

## 🎯 Session Goals

### Primary Goals (Must Complete)
- [ ] Create Intent-Driven benchmark script
- [ ] Execute benchmark with Intent Classification enabled
- [ ] Compare Phase 6 vs Phase 7.1 results
- [ ] Verify citation compliance in answers

### Success Criteria
```
If Relevance improvement > 200%:
  ✅ Proceed to Phase 7.2 (RLRF)

If Relevance improvement 50-200%:
  ⚠️ Optimize and iterate

If Relevance improvement < 50%:
  🔍 Debug Intent Classifier accuracy
```

### Stretch Goals (If Time Permits)
- [ ] Implement citation compliance checker
- [ ] Add LLM-based Intent Classifier (Phase 7.2 prep)
- [ ] Start RLRF weight tracking implementation

---

## 📂 Files to Reference

### Current Implementation
```
src/runtime/intent/
├── types.ts                         # Intent types
├── intent-classifier.ts             # Rule-based classifier
├── evidence-locked-prompt.ts        # Prompt builder
└── index.ts

src/runtime/adaptive-rag/
├── intent-driven-adaptive-rag.ts    # Main implementation
└── index.ts

docs/RFC/
└── 2025-Phase7-Self-Evolving-RAG-Network.md  # Architecture
```

### Phase 6 Baseline
```
reports/hybrid-benchmark/
└── real-benchmark-ragas.json

Current metrics:
- Context Recall: 26.7%
- Context Precision: 9.7%
- Answer Relevance: 4.0%
- Answer Faithfulness: 100%
```

---

## 🔧 Expected Issues & Solutions

### Issue 1: TypeScript Compilation Errors
**Solution:**
```bash
npx tsc --noEmit
# Fix any errors before proceeding
```

### Issue 2: Intent Classification Not Working
**Debug:**
```typescript
// Add logging in intent-driven-adaptive-rag.ts
console.log('[DEBUG] Intent:', JSON.stringify(intent, null, 2));
```

### Issue 3: Citation Not Appearing in Answers
**Check:**
1. Is `enableEvidenceLockedPrompt` set to `true`?
2. Is LLM generator accepting prompt templates?
3. Print `promptTemplate` to verify format

---

## 📊 Expected Results

### Optimistic Scenario (Best Case)
```
Context Recall:      26.7% → 46.7% (+75%)
Context Precision:   9.7%  → 39.7% (+310%)
Answer Relevance:    4.0%  → 64.0% (+1500%)
Answer Faithfulness: 100%  → 99%+  (maintain)
```

### Realistic Scenario (Expected)
```
Context Recall:      26.7% → 35.0% (+31%)
Context Precision:   9.7%  → 20.0% (+106%)
Answer Relevance:    4.0%  → 30.0% (+650%)
Answer Faithfulness: 100%  → 99%+  (maintain)
```

### Pessimistic Scenario (Worst Case)
```
Context Recall:      26.7% → 30.0% (+12%)
Context Precision:   9.7%  → 15.0% (+55%)
Answer Relevance:    4.0%  → 12.0% (+200%)
Answer Faithfulness: 100%  → 98%+  (acceptable)
```

---

## 🚦 Decision Tree

```
Run Benchmark
    │
    ├─ Relevance > 50% ───→ ✅ Success! Continue to Phase 7.2 (RLRF)
    │
    ├─ Relevance 30-50% ──→ ⚠️ Partial Success
    │                         ├─ Debug Intent Classification
    │                         ├─ Tune Prompt Template
    │                         └─ Iterate
    │
    └─ Relevance < 30% ────→ 🔍 Debug Mode
                              ├─ Check Intent Accuracy
                              ├─ Verify Prompt Generation
                              ├─ Review LLM Generator
                              └─ Consider LLM-based Classifier
```

---

## 🎓 Learning Resources

### Intent Classification Patterns
```typescript
// Factual (사실)
"얼마", "언제", "무엇", "어디" + 숫자

// Procedural (절차)
"어떻게", "방법", "신청", "이용", "절차"

// Comparative (비교)
"차이", "비교", "다른", "또는", "더"

// Explanatory (설명)
"왜", "이유", "설명", "뜻"

// Aggregative (집계)
"전체", "모두", "총", "요약"
```

### Evidence-Locked Prompt Rules
```
Rule 1: Evidence-Only (Context 외 정보 사용 금지)
Rule 2: Citation Required ([Context N] 표기 필수)
Rule 3: Exact Citation (수치/날짜 원문 그대로)
Rule 4: No-Info Fallback (정보 없음 명시)
Rule 5: Synthesis Allowed (여러 Context 통합)
Rule 6: Hallucination Penalty (위반 시 거부)
```

---

## 📞 Support Commands

### Debug Commands
```bash
# View Intent Classifier implementation
cat src/runtime/intent/intent-classifier.ts | grep -A 20 "detectIntentType"

# View Evidence-Locked Prompt template
cat src/runtime/intent/evidence-locked-prompt.ts | grep -A 30 "buildRulesSection"

# View current baseline
cat reports/hybrid-benchmark/real-benchmark-ragas.json | jq '.summary'

# Check TypeScript errors
npx tsc --noEmit | grep "error TS"
```

### Performance Analysis
```bash
# Compare recall
jq -s '.[0].summary.ragas.contextRecall as $old | .[1].summary.ragas.contextRecall as $new | ($new - $old) / $old * 100' \
  reports/hybrid-benchmark/real-benchmark-ragas.json \
  reports/hybrid-benchmark/intent-driven-benchmark.json

# Compare precision
jq -s '.[0].summary.ragas.contextPrecision as $old | .[1].summary.ragas.contextPrecision as $new | ($new - $old) / $old * 100' \
  reports/hybrid-benchmark/real-benchmark-ragas.json \
  reports/hybrid-benchmark/intent-driven-benchmark.json
```

---

## ✅ Pre-Flight Checklist

Before starting Session 2:
- [ ] Read `PHASE_7_SESSION_1_COMPLETE.md`
- [ ] Verify `npx tsc --noEmit` passes
- [ ] Run `npx tsx scripts/test-intent-classifier.ts`
- [ ] Confirm Phase 6 baseline in `real-benchmark-ragas.json`
- [ ] Check Elasticsearch is running: `curl localhost:9200`
- [ ] Clear FAISS index if needed: `rm -rf data/faiss-index`

---

## 🏁 Start Command

```bash
# When ready, execute:
npx tsx scripts/real-hybrid-benchmark-intent.ts

# Expected runtime: ~3-5 minutes
# Expected output: reports/hybrid-benchmark/intent-driven-benchmark.json
```

---

**Good luck! 🚀**
**Target: +650% Answer Relevance improvement**
