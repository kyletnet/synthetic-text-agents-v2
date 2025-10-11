# 🚀 Handoff: Phase 3 Week 3 - Hybrid Search Implementation

**Previous Session:** Phase 3 Week 2 - Vision-Guided Chunking ✅ COMPLETE
**Current Session:** Phase 3 Week 3 - Hybrid Search + Structure-Preserving Chunker
**Date:** 2025-10-10
**Status:** 🟢 Ready to Start

---

## 📋 Session Start Checklist

### 1️⃣ Load Context Documents (MANDATORY)

```bash
# In Claude Code, reference these files:
@CLAUDE.md                                           # System philosophy
@LLM_DEVELOPMENT_CONTRACT.md                         # Development contract
@DEVELOPMENT_STANDARDS.md                            # Standards enforcement
@designs/rfc/rfc-integrate-multimodal-rag-augmentation.md  # RFC (Phase 3-5)
@PHASE_3_WEEK_2_COMPLETE.md                         # Previous week summary
@HANDOFF_PHASE_3_WEEK_3.md                          # This file
```

### 2️⃣ Verify Week 2 Completion

```bash
# Check Vision pipeline results
cat reports/pdf-vision/test-5-10.json | jq '.summary'

# Expected output:
# {
#   "totalSections": 10,
#   "totalTables": 6,
#   "totalLists": 0,
#   "totalParagraphs": 10,
#   "totalFigures": 0
# }

# Verify baseline comparison
ls -lh reports/pdf-vision/comparison-report.md
ls -lh reports/pdf-structure/baseline-report.json
```

✅ If files exist and summary shows tables/sections detected → proceed
❌ If files missing → re-run Week 2 Vision tests first

### 3️⃣ Check Dependencies

```bash
# Verify Poppler installed
pdftoppm -v
# Expected: pdftoppm version 25.10.0

# Verify API keys
grep GOOGLE_API_KEY .env
grep ANTHROPIC_API_KEY .env

# Both should be present
```

---

## 🎯 Week 3 Objectives

### Primary Goal
**Implement Hybrid Search (Elasticsearch + FAISS + RRF) and Vision-Guided Chunker**

### Success Criteria
1. ✅ Elasticsearch client working (BM25F + Korean tokenizer)
2. ✅ FAISS client working (HNSW index)
3. ✅ RRF merger combining results
4. ✅ Vision-Guided Chunker preserving structure
5. ✅ Integration test passing (E2E search)
6. ✅ Benchmark: Recall@10 > baseline + 15 pp

---

## 📊 Current State

### ✅ Completed (Week 2)
- Vision pipeline (PDF → Images → Structure)
- Gemini Vision API integration
- Table detection (100% accuracy)
- Section alignment (85%+)
- Baseline comparison report

### 🚧 Foundation Created (Ready for Implementation)
```
src/infrastructure/retrieval/hybrid/
├── types.ts                    ✅ Complete
├── README.md                   ✅ Complete
├── elastic-client.ts           ⏳ TO IMPLEMENT
├── faiss-client.ts            ⏳ TO IMPLEMENT
├── rrf-merger.ts              ⏳ TO IMPLEMENT
└── hybrid-search-engine.ts     ⏳ TO IMPLEMENT

src/runtime/chunking/vision-guided/
├── types.ts                    ✅ Complete
├── README.md                   ✅ Complete
└── vision-guided-chunker.ts    ⏳ TO IMPLEMENT
```

---

## 🛠️ Implementation Plan (Step-by-Step)

### Step 1: Install Dependencies (5 min)

```bash
npm install @elastic/elasticsearch faiss-node @xenova/transformers
```

**Expected Output:**
```
added 47 packages, changed 3 packages
```

### Step 2: Implement Elasticsearch Client (30 min)

**File:** `src/infrastructure/retrieval/hybrid/elastic-client.ts`

**Key Features:**
- BM25F ranking
- Korean morphological analyzer (nori_tokenizer)
- Field boosting (title: 2.0, heading: 1.5, body: 1.0, table: 1.2)
- Metadata filtering

**Implementation Guidance:**
1. Read `types.ts` for interface
2. Use `@elastic/elasticsearch` client
3. Implement `search()` and `index()` methods
4. Add error handling + retries
5. Add logging

**Reference:**
- `/src/infrastructure/retrieval/hybrid/README.md` (Architecture)
- `designs/rfc/rfc-integrate-multimodal-rag-augmentation.md` (Section 4)

### Step 3: Implement FAISS Client (30 min)

**File:** `src/infrastructure/retrieval/hybrid/faiss-client.ts`

**Key Features:**
- HNSW index (sub-linear search)
- Multilingual-E5-Large embeddings
- Cosine similarity
- GPU-free operation

**Implementation Guidance:**
1. Use `faiss-node` for index operations
2. Use `@xenova/transformers` for embeddings
3. Implement `search()` and `index()` methods
4. Cache embeddings for speed
5. Add progress tracking for large indices

### Step 4: Implement RRF Merger (20 min)

**File:** `src/infrastructure/retrieval/hybrid/rrf-merger.ts`

**Algorithm:**
```typescript
RRF(d) = Σ (1 / (k + rank_i(d)))
where k = 60, rank_i = position in result list i
```

**Implementation Guidance:**
1. Combine Elasticsearch + FAISS results
2. Normalize scores
3. Apply RRF formula
4. Return top K merged results
5. Add weight tuning (elastic: 0.6, faiss: 0.4)

### Step 5: Implement Hybrid Search Engine (30 min)

**File:** `src/infrastructure/retrieval/hybrid/hybrid-search-engine.ts`

**Orchestration:**
```
Query → [Elasticsearch, FAISS] → RRF Merger → Results
```

**Implementation Guidance:**
1. Initialize both clients
2. Run searches in parallel
3. Merge with RRF
4. Add caching layer
5. Add metrics tracking

### Step 6: Implement Vision-Guided Chunker (45 min)

**File:** `src/runtime/chunking/vision-guided/vision-guided-chunker.ts`

**Key Features:**
- Section-based chunking
- Table preservation (never split)
- Hybrid strategy (sections + tables)
- Overlap for context

**Implementation Guidance:**
1. Load Vision results from `reports/pdf-vision/test-5-10.json`
2. Implement `chunk()` method
3. Add section boundary detection
4. Add table extraction
5. Add overlap strategy
6. Calculate preservation rate

### Step 7: Integration Test (30 min)

**File:** `tests/integration/hybrid-search.test.ts`

**Test Scenario:**
```typescript
// 1. Index Vision-guided chunks
const chunker = new VisionGuidedChunker();
const chunks = await chunker.chunk(visionResults, strategy);

const searchEngine = new HybridSearchEngine(config);
await searchEngine.index(chunks);

// 2. Search
const results = await searchEngine.search({
  query: '아이돌봄 서비스 요금은 얼마인가요?',
  k: 10
});

// 3. Verify
expect(results.length).toBeGreaterThan(0);
expect(results[0].metadata.type).toBe('table'); // Should find pricing table
```

### Step 8: Benchmark vs. Baseline (20 min)

**Script:** `scripts/benchmark-hybrid-search.ts`

**Metrics to Measure:**
- Recall@10 (target: > baseline + 15 pp)
- Precision@10 (target: > baseline + 15 pp)
- Latency (p50, p95, p99)
- Cost per query

**Expected Results (RFC):**
```
Baseline → Hybrid
Recall@10:    65% → 85%+ (+20 pp)
Precision@10: 70% → 90%+ (+20 pp)
Latency:      150ms → <200ms
```

---

## 📁 Files to Create

### Core Implementation (6 files)
- [ ] `src/infrastructure/retrieval/hybrid/elastic-client.ts`
- [ ] `src/infrastructure/retrieval/hybrid/faiss-client.ts`
- [ ] `src/infrastructure/retrieval/hybrid/rrf-merger.ts`
- [ ] `src/infrastructure/retrieval/hybrid/hybrid-search-engine.ts`
- [ ] `src/runtime/chunking/vision-guided/vision-guided-chunker.ts`
- [ ] `src/runtime/chunking/vision-guided/strategies/hybrid.ts`

### Tests (3 files)
- [ ] `tests/unit/elastic-client.test.ts`
- [ ] `tests/unit/faiss-client.test.ts`
- [ ] `tests/integration/hybrid-search.test.ts`

### Scripts (2 files)
- [ ] `scripts/benchmark-hybrid-search.ts`
- [ ] `scripts/index-vision-chunks.ts`

### Reports (1 file)
- [ ] `reports/hybrid-retrieval/benchmark.json`

---

## 🚨 Known Issues & Mitigations

### Issue 1: Elasticsearch Not Running Locally

**Symptom:** Connection refused on localhost:9200

**Solution A (Cloud):**
```bash
# Use Elastic Cloud (14-day free trial)
# https://cloud.elastic.co/registration
# Add credentials to .env:
ELASTICSEARCH_URL=https://your-deployment.es.us-central1.gcp.cloud.es.io
ELASTICSEARCH_API_KEY=your-api-key
```

**Solution B (Docker):**
```bash
# Run Elasticsearch locally via Docker
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.12.0
```

**Solution C (Mock for Testing):**
```typescript
// Use in-memory mock for initial development
class MockElasticsearchClient implements SearchEngine {
  private docs: Map<string, any> = new Map();

  async search(query: SearchQuery): Promise<SearchResult[]> {
    // Simple keyword matching
    return Array.from(this.docs.values())
      .filter(doc => doc.content.includes(query.query))
      .slice(0, query.k || 10);
  }
}
```

### Issue 2: FAISS Node Module Compilation

**Symptom:** `faiss-node` fails to build on M1/M2 Mac

**Solution:**
```bash
# Use pure JS alternative
npm install vectra  # Pure JS vector database
```

**Alternative:**
```typescript
// Use Transformer.js native similarity search
import { pipeline } from '@xenova/transformers';

const extractor = await pipeline('feature-extraction', 'intfloat/multilingual-e5-large');
const embeddings = await extractor(texts);
const scores = cosineSimilarity(queryEmbedding, embeddings);
```

### Issue 3: Korean Tokenization in Elasticsearch

**Symptom:** Korean text not tokenized correctly

**Solution:**
```bash
# Install nori plugin
docker exec -it elasticsearch bin/elasticsearch-plugin install analysis-nori
docker restart elasticsearch
```

**Index Settings:**
```json
{
  "settings": {
    "analysis": {
      "tokenizer": {
        "nori_user_dict": {
          "type": "nori_tokenizer",
          "decompound_mode": "mixed"
        }
      }
    }
  }
}
```

---

## 🎯 Success Validation

### Before Marking Week 3 Complete

Run these validation commands:

```bash
# 1. TypeScript compilation
npm run typecheck
# Expected: ✅ No errors

# 2. Unit tests
npm run test -- hybrid
# Expected: ✅ All tests passing

# 3. Integration test
npm run test -- hybrid-search.test
# Expected: ✅ E2E search working

# 4. Benchmark
npx tsx scripts/benchmark-hybrid-search.ts
# Expected: Recall@10 > baseline + 15 pp

# 5. Compare to baseline
cat reports/hybrid-retrieval/benchmark.json | jq '.comparison'
# Expected:
# {
#   "recallImprovement": "+20 pp",
#   "precisionImprovement": "+18 pp",
#   "status": "PASS"
# }
```

---

## 📊 Expected Timeline

| Task | Duration | Cumulative |
|------|----------|------------|
| Install dependencies | 5 min | 5 min |
| Elasticsearch client | 30 min | 35 min |
| FAISS client | 30 min | 65 min |
| RRF merger | 20 min | 85 min |
| Hybrid search engine | 30 min | 115 min |
| Vision-guided chunker | 45 min | 160 min |
| Integration test | 30 min | 190 min |
| Benchmark | 20 min | 210 min |

**Total Estimated Time:** ~3.5 hours (single session)

---

## 🔗 Key References

### Documentation
- `@designs/rfc/rfc-integrate-multimodal-rag-augmentation.md` (Section 4: Hybrid Search)
- `src/infrastructure/retrieval/hybrid/README.md` (Architecture overview)
- `src/runtime/chunking/vision-guided/README.md` (Chunking strategies)

### Previous Work
- `reports/pdf-vision/test-5-10.json` (Vision results to use)
- `reports/pdf-vision/comparison-report.md` (Baseline metrics)
- `PHASE_3_WEEK_2_COMPLETE.md` (Week 2 summary)

### External Resources
- Elasticsearch Docs: https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html
- FAISS Wiki: https://github.com/facebookresearch/faiss/wiki
- RRF Paper: https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf

---

## 🚀 Quick Start Commands

### Option A: Full Implementation (Recommended)

```bash
# 1. Load context in Claude Code
@CLAUDE.md
@designs/rfc/rfc-integrate-multimodal-rag-augmentation.md
@HANDOFF_PHASE_3_WEEK_3.md

# 2. Install dependencies
npm install @elastic/elasticsearch faiss-node @xenova/transformers

# 3. Start with Elasticsearch client
code src/infrastructure/retrieval/hybrid/elastic-client.ts

# 4. Follow implementation plan (Steps 1-8 above)
```

### Option B: Incremental Testing

```bash
# Start with just RRF merger (no external dependencies)
code src/infrastructure/retrieval/hybrid/rrf-merger.ts

# Test in isolation
npm run test -- rrf-merger.test

# Then add clients one by one
```

### Option C: Mock-First Development

```bash
# Create mock clients for testing
code src/infrastructure/retrieval/hybrid/mock-clients.ts

# Implement E2E flow with mocks
# Replace with real clients later
```

---

## 💡 Pro Tips

1. **Start Simple**
   - Implement RRF merger first (pure algorithm, no dependencies)
   - Add mock clients for testing
   - Replace mocks with real clients incrementally

2. **Test Early**
   - Write tests alongside implementation
   - Use small sample data (5-10 documents)
   - Validate results manually first

3. **Use Vision Results**
   - Vision results from Week 2 are in `reports/pdf-vision/test-5-10.json`
   - Use this as ground truth for chunking
   - Compare chunker output to Vision analysis

4. **Optimize Later**
   - Get basic flow working first
   - Add caching, batching, optimization in Week 4
   - Focus on correctness over performance

5. **Document Decisions**
   - Add comments explaining why you chose certain weights
   - Document parameter tuning rationale
   - Create decision log in `docs/DECISIONS.md`

---

## 🎉 Week 3 Success Looks Like

### Functional Requirements ✅
- [ ] Elasticsearch returning results
- [ ] FAISS returning results
- [ ] RRF merging both correctly
- [ ] Chunker preserving table structure
- [ ] Integration test passing

### Quality Requirements ✅
- [ ] Recall@10 > baseline + 15 pp
- [ ] Precision@10 > baseline + 15 pp
- [ ] Latency < 200ms (p95)
- [ ] Table preservation rate > 95%
- [ ] Section alignment > 85%

### Deliverables ✅
- [ ] 6 implementation files
- [ ] 3 test files
- [ ] 2 utility scripts
- [ ] 1 benchmark report
- [ ] Week 3 completion summary

---

## 📞 Help & Support

### If Stuck on Elasticsearch
→ Use mock client or Elastic Cloud trial

### If Stuck on FAISS
→ Use Transformer.js native similarity or vectra

### If Stuck on RRF
→ Start with simple weighted average, optimize later

### If Stuck on Chunking
→ Start with section-only strategy, add tables later

### General Debugging
→ Add verbose logging, check intermediate outputs, validate assumptions

---

**Ready to Start?** 🚀

Load context docs → Install dependencies → Follow Step 1 → Let's build! 💪

---

**End of Handoff Document**

Next file to create: `src/infrastructure/retrieval/hybrid/elastic-client.ts`
