# Hybrid Search Module (Phase 3 Week 3-4)

**Status:** 🚧 Foundation Created (Week 2) → Week 3 Implementation Pending

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Hybrid Search Engine                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Elasticsearch │  │    FAISS     │  │  Reranker    │  │
│  │   (BM25F)    │  │   (HNSW)     │  │ (BGE-v2-m3)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         └──────────┬───────┘                  │          │
│                    │                          │          │
│              ┌─────▼─────┐                    │          │
│              │    RRF    │                    │          │
│              │  Merger   │                    │          │
│              └─────┬─────┘                    │          │
│                    │                          │          │
│                    └──────────┬───────────────┘          │
│                               │                          │
│                         ┌─────▼─────┐                    │
│                         │  Results  │                    │
│                         └───────────┘                    │
└─────────────────────────────────────────────────────────┘
```

---

## Components

### 1️⃣ Elasticsearch Client (`elastic-client.ts`)

**Purpose:** Lexical search with Korean morphological analysis

**Features:**
- BM25F ranking with field boosting
- Korean tokenizer (nori_tokenizer)
- Field-specific weights (title > heading > body > table)
- Metadata filtering

**Implementation Status:** ⏳ Pending (Week 3)

---

### 2️⃣ FAISS Client (`faiss-client.ts`)

**Purpose:** Fast semantic search with dense vectors

**Features:**
- HNSW index for sub-linear search
- Multilingual-E5-Large embeddings
- Cosine similarity
- GPU-free operation

**Implementation Status:** ⏳ Pending (Week 3)

---

### 3️⃣ RRF Merger (`rrf-merger.ts`)

**Purpose:** Combine Elasticsearch + FAISS results

**Algorithm:** Reciprocal Rank Fusion (RRF)
```
RRF(d) = Σ (1 / (k + rank_i(d)))
```

**Parameters:**
- `k = 60` (standard RRF constant)
- Weights: Elastic 0.6, FAISS 0.4 (tunable)

**Implementation Status:** ⏳ Pending (Week 3)

---

### 4️⃣ Reranker (`reranker.ts`)

**Purpose:** Final accuracy layer with cross-encoder

**Model:** `BAAI/bge-reranker-v2-m3`
**Input:** Top 30-50 results from RRF
**Output:** Top 10 re-ranked results

**Implementation Status:** ⏳ Pending (Week 4)

---

## Expected Performance (RFC Targets)

| Metric | Baseline | Hybrid | Improvement |
|--------|----------|--------|-------------|
| Recall@10 | 65% | 85%+ | +20 pp |
| Precision@10 | 70% | 90%+ | +20 pp |
| Latency (p95) | 150ms | <200ms | Acceptable |
| Cost/Query | $0.001 | $0.002 | 2x (justified) |

---

## Integration Plan

### Week 3: Core Implementation
1. ✅ Create module structure
2. ⏳ Implement `ElasticsearchClient`
3. ⏳ Implement `FAISSClient`
4. ⏳ Implement `RRFMerger`
5. ⏳ Write integration tests

### Week 4: Optimization
1. ⏳ Add `BGEReranker`
2. ⏳ Tune RRF weights
3. ⏳ Benchmark vs. baseline
4. ⏳ Connect to Vision-Guided Chunker

### Week 5: Adaptive RAG
1. ⏳ Implement `adaptiveRAG(k=2→6)`
2. ⏳ Token cost monitoring
3. ⏳ Gate F (Throughput) integration

---

## Usage Example (Week 3 Target)

```typescript
import { HybridSearchEngine } from './hybrid-search-engine';

const engine = new HybridSearchEngine({
  elasticsearch: {
    url: process.env.ELASTICSEARCH_URL,
    indexName: 'qa-documents',
    fieldBoosts: { title: 2.0, heading: 1.5, body: 1.0, table: 1.2 }
  },
  faiss: {
    indexPath: 'data/faiss.index',
    embeddingModel: 'intfloat/multilingual-e5-large',
    dimension: 1024
  },
  rrf: {
    k: 60,
    weights: { elastic: 0.6, faiss: 0.4 }
  }
});

// Search
const results = await engine.search({
  query: '아이돌봄 서비스 요금은 얼마인가요?',
  k: 10
});

console.log(results); // Top 10 ranked results
```

---

## Dependencies

**Required Packages:**
```json
{
  "@elastic/elasticsearch": "^8.0.0",
  "faiss-node": "^0.5.0",
  "@xenova/transformers": "^2.0.0",
  "sentence-transformers": "^1.0.0"
}
```

**Installation:**
```bash
npm install @elastic/elasticsearch faiss-node @xenova/transformers
```

---

## Testing Strategy

### Unit Tests
- Each client in isolation
- RRF algorithm correctness
- Reranker accuracy

### Integration Tests
- End-to-end search flow
- Performance benchmarks
- Comparison vs. baseline

### Evaluation Metrics (RAGAS)
- Context Recall (Gate B)
- Context Precision (Gate D)
- Answer Faithfulness (Gate G)
- Answer Relevance (Gate E)

---

## Files to Create (Week 3)

- [ ] `elastic-client.ts` - Elasticsearch wrapper
- [ ] `faiss-client.ts` - FAISS wrapper
- [ ] `rrf-merger.ts` - RRF implementation
- [ ] `reranker.ts` - BGE reranker (Week 4)
- [ ] `hybrid-search-engine.ts` - Main orchestrator
- [ ] `types.ts` - ✅ Already created
- [ ] `README.md` - ✅ This file

---

## References

- **RFC:** `designs/rfc/rfc-integrate-multimodal-rag-augmentation.md`
- **Vision Results:** `reports/pdf-vision/test-5-10.json`
- **Baseline:** `reports/pdf-structure/baseline-report.json`
- **Comparison:** `reports/pdf-vision/comparison-report.md`

---

**Next Session Command:**
```bash
# Week 3: Start Hybrid Search implementation
# 1. Install dependencies
npm install @elastic/elasticsearch faiss-node @xenova/transformers

# 2. Implement ElasticsearchClient
code src/infrastructure/retrieval/hybrid/elastic-client.ts

# 3. Run tests
npm run test -- hybrid-search
```

---

**Status:** ✅ Foundation complete, ready for Week 3 implementation
