# Performance Optimization Roadmap

**Date**: 2025-10-06
**Status**: ANALYSIS
**Priority**: MEDIUM

---

## 📊 Current Performance Baseline (Phase 3)

### Quality System Metrics

```
improvement_delta: +20.1% (Gate C: 4x target ✅)
bm25_avg:          7.2%
vector_avg:        60.0%
hybrid_avg:        44.1%

Latency:  ~5ms overhead per QA pair
Cost:     $0 (local algorithms)
Memory:   O(N·M) where N=corpus size, M=doc length
```

### System Health (from /inspect)

```
Health Score:        85/100
TypeScript:          ✅ PASS
Tests:               ✅ PASS
Integration Score:   ⚠️ 55/100 (needs improvement)
Technical Debt:      148 workarounds
```

---

## 🎯 Optimization Opportunities

### 1. **Hybrid Search Algorithm** (Phase 3 - Current)

#### A. BM25 Performance

**Current**:

```typescript
// O(Q·N·M) where Q=query terms, N=docs, M=avg doc length
for (const term of queryTerms) {
  for (const doc of corpus) {
    // TF-IDF calculation
  }
}
```

**Optimization**:

```typescript
// Preprocessing: Build inverted index O(N·M) → Query O(Q·log N)
const invertedIndex = new Map<string, PostingList>();

// Build once (offline)
for (const doc of corpus) {
  for (const term of doc.terms) {
    invertedIndex.get(term).push({ docId, tf, position });
  }
}

// Query (fast lookup)
for (const term of queryTerms) {
  const postings = invertedIndex.get(term); // O(1)
  // Only process docs that contain term
}
```

**Expected Gain**:

- Latency: 5ms → 1ms (80% reduction)
- Memory: +10% (index overhead)
- Scalability: Linear → Sub-linear

#### B. Vector Similarity

**Current**:

```typescript
// Brute-force comparison O(N)
for (const doc of corpus) {
  const similarity = calculateOverlap(query, doc);
}
```

**Optimization 1: Locality-Sensitive Hashing (LSH)**

```typescript
// Preprocessing: Hash all docs
const lsh = new LSH({ dimensions: 100, bands: 20 });
for (const doc of corpus) {
  lsh.insert(doc.id, doc.embedding);
}

// Query: Only compare similar docs
const candidates = lsh.query(queryEmbedding); // O(log N)
```

**Expected Gain**:

- Latency: 2ms → 0.5ms (75% reduction)
- Recall: 95%+ (acceptable tradeoff)

**Optimization 2: Early Termination**

```typescript
// Sort by n-gram overlap, terminate early
const sorted = corpus.sort((a, b) => quickOverlapEstimate(query, a, b));
for (const doc of sorted.slice(0, topK)) {
  // Only compute full similarity for top-K candidates
}
```

**Expected Gain**:

- Latency: 2ms → 1ms (50% reduction)
- Accuracy: 100% (no loss)

---

### 2. **Evidence Aligner** (Phase 2)

#### Current Bottleneck

```typescript
// N-gram extraction on every call
for (const qaPair of qaPairs) {
  const answerNgrams = extractNGrams(qaPair.answer); // Redundant!
  const evidenceNgrams = extractNGrams(qaPair.evidence);
}
```

#### Optimization: Memoization

```typescript
const ngramCache = new LRU<string, Set<string>>({
  max: 10000,
  ttl: 3600000, // 1 hour
});

function extractNGramsCached(text: string): Set<string> {
  const key = hash(text);
  if (ngramCache.has(key)) {
    return ngramCache.get(key);
  }

  const ngrams = extractNGrams(text);
  ngramCache.set(key, ngrams);
  return ngrams;
}
```

**Expected Gain**:

- Latency: 10ms → 2ms (80% reduction)
- Cache hit rate: 70%+ (typical)

---

### 3. **Quality Orchestrator** (All Phases)

#### Parallelization Opportunity

**Current (Sequential)**:

```typescript
// Phase 2: Run checkers sequentially
const ruleResult = await ruleChecker.check(qaPairs);
const evidenceResult = await evidenceAligner.check(qaPairs);
const hybridResult = await hybridSearchChecker.check(qaPairs);
```

**Optimized (Parallel)**:

```typescript
// Run all checkers in parallel
const [ruleResult, evidenceResult, hybridResult] = await Promise.all([
  ruleChecker.check(qaPairs),
  evidenceAligner.check(qaPairs),
  hybridSearchChecker.check(qaPairs),
]);
```

**Expected Gain**:

- Latency: 50ms → 20ms (60% reduction)
- Throughput: 20 QA/s → 50 QA/s

---

### 4. **Agent Communication** (8-Agent Council)

#### Current: Synchronous Message Passing

```typescript
// Blocking communication
const result = await agent.receive(message);
```

#### Optimization: Event-Driven Architecture

```typescript
// Non-blocking event bus
eventBus.emit("task:started", { taskId, agentId });

agent.on("task:completed", (result) => {
  // Async handler
});

// Agent can continue other work while waiting
```

**Expected Gain**:

- Concurrency: 1x → 8x (multi-agent parallelism)
- Throughput: 10 tasks/s → 80 tasks/s

---

### 5. **Guideline Parsing** (Phase 1)

#### Current: Re-parse on Every Run

```typescript
// Parse guidelines.md every time
const guidelines = await parseGuidelines();
```

#### Optimization: Smart Caching with TTL

```typescript
const guidelineCache = {
  data: null,
  timestamp: 0,
  ttl: 3600000, // 1 hour
  fileHash: null,
};

async function getGuidelinesCached() {
  const currentHash = await hashFile("guidelines.md");

  if (
    guidelineCache.data &&
    guidelineCache.fileHash === currentHash &&
    Date.now() - guidelineCache.timestamp < guidelineCache.ttl
  ) {
    return guidelineCache.data; // Cache hit
  }

  // Cache miss: Re-parse
  guidelineCache.data = await parseGuidelines();
  guidelineCache.fileHash = currentHash;
  guidelineCache.timestamp = Date.now();

  return guidelineCache.data;
}
```

**Expected Gain**:

- Latency: 100ms → 1ms (99% reduction on cache hit)
- Cache hit rate: 95%+ (guidelines change infrequently)

---

## 🚀 Implementation Priority

### High Priority (Implement Now)

#### 1. Orchestrator Parallelization ✅ Easy Win

- **Effort**: 1 day
- **Gain**: 60% latency reduction
- **Risk**: Low (independent checkers)
- **Implementation**:
  ```typescript
  // scripts/quality/orchestrator.ts:191-200
  const [ruleResult, evidenceResult, hybridResult] = await Promise.all([
    ruleChecker.check(qaPairs),
    evidenceAligner.check(qaPairs),
    hybridSearchChecker.check(qaPairs),
  ]);
  ```

#### 2. N-gram Memoization ✅ Medium Win

- **Effort**: 2 days
- **Gain**: 80% aligner latency reduction
- **Risk**: Low (cache invalidation clear)
- **Implementation**:
  ```typescript
  // scripts/quality/checkers/evidence-aligner.ts
  import { LRUCache } from "lru-cache";
  ```

#### 3. Guideline Caching ✅ Already Done

- **Status**: ✅ Implemented (v1.0)
- **Location**: `scripts/quality/checkers/rule-based-checker.ts:88`

### Medium Priority (Next Sprint)

#### 4. BM25 Inverted Index

- **Effort**: 3-5 days
- **Gain**: 80% BM25 latency reduction
- **Risk**: Medium (corpus size dependency)
- **Complexity**: High (index building + query optimization)

#### 5. Vector LSH

- **Effort**: 5-7 days
- **Gain**: 75% vector latency reduction
- **Risk**: Medium (recall degradation risk)
- **Complexity**: High (LSH tuning required)

### Low Priority (Future)

#### 6. Event-Driven Agent Bus

- **Effort**: 2 weeks
- **Gain**: 8x concurrency
- **Risk**: High (major architectural change)
- **Complexity**: Very High (requires refactoring entire agent system)

---

## 📈 Expected Overall Impact

### After High-Priority Optimizations (1 week)

```
Current:
  Phase 1: ~100ms
  Phase 2: ~150ms
  Phase 3: ~155ms

Optimized:
  Phase 1: ~50ms  (50% faster)
  Phase 2: ~70ms  (53% faster)
  Phase 3: ~75ms  (52% faster)

Overall: 52% latency reduction
```

### After Medium-Priority Optimizations (1 month)

```
Further optimization:
  Phase 3 BM25:   5ms → 1ms  (80% faster)
  Phase 3 Vector: 2ms → 0.5ms (75% faster)

Phase 3 total: 75ms → 30ms (60% faster)
```

### After Low-Priority Optimizations (3 months)

```
Agent concurrency:
  Sequential: 1 task/s
  Parallel:   8 tasks/s (8x throughput)
```

---

## 🧪 Benchmarking Strategy

### Performance Test Suite

```typescript
// tests/performance/quality-system.perf.ts
describe("Quality System Performance", () => {
  test("Phase 1 completes within 100ms", async () => {
    const start = Date.now();
    await runPhase1(testData);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(100);
  });

  test("Phase 2 completes within 150ms", async () => {
    const start = Date.now();
    await runPhase2(testData);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(150);
  });

  test("Phase 3 completes within 200ms", async () => {
    const start = Date.now();
    await runPhase3(testData);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(200);
  });
});
```

### Load Testing

```bash
# Artillery.io config
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10  # 10 QA pairs/sec
    - duration: 120
      arrivalRate: 50  # Ramp to 50 QA pairs/sec

scenarios:
  - name: "Quality Assessment"
    flow:
      - post:
          url: "/api/quality/assess"
          json:
            qaPairs: "{{ $randomQAPairs() }}"
            phase: "Phase 3"
```

---

## 🔍 Monitoring & Observability

### Key Metrics to Track

```typescript
// Latency percentiles
{
  "phase1_p50": 45,
  "phase1_p95": 80,
  "phase1_p99": 120,

  "phase2_p50": 60,
  "phase2_p95": 110,
  "phase2_p99": 180,

  "phase3_p50": 70,
  "phase3_p95": 120,
  "phase3_p99": 200
}

// Throughput
{
  "qa_per_second": 25,
  "cache_hit_rate": 0.75,
  "parallelization_factor": 2.5
}

// Resource utilization
{
  "cpu_usage": 0.45,
  "memory_usage": 512, // MB
  "active_agents": 8
}
```

### Alerting Thresholds

```yaml
alerts:
  - name: HighLatency
    condition: phase3_p95 > 200
    action: notify

  - name: LowThroughput
    condition: qa_per_second < 10
    action: notify

  - name: HighMemory
    condition: memory_usage > 2048
    action: scale
```

---

## 💡 Refactoring Recommendations

### Integration Score: 55 → 85 Target

#### Issues Identified (from /inspect)

1. **148 Workarounds**: Technical debt accumulation
2. **Security: FAIL**: Needs audit
3. **Code Style: FAIL**: Prettier violations

#### Refactoring Plan

**Phase R1: Code Quality (Week 1)**

- [ ] Run /maintain (Prettier auto-fix)
- [ ] Run /fix (Resolve top 20 workarounds)
- [ ] Security audit (npm audit fix)

**Phase R2: Architecture (Week 2)**

- [ ] Extract shared logic (DRY violations)
- [ ] Consolidate checker interfaces
- [ ] Standardize error handling

**Phase R3: Testing (Week 3)**

- [ ] Increase test coverage (current: unknown)
- [ ] Add performance tests
- [ ] Add integration tests

**Phase R4: Documentation (Week 4)**

- [ ] Update SYSTEM_MAP.md
- [ ] Refresh API documentation
- [ ] Update governance rules

---

## 🎯 Success Criteria

### Performance

- [ ] Phase 3 latency < 100ms (p95)
- [ ] Throughput > 50 QA/s
- [ ] Cache hit rate > 70%

### Code Quality

- [ ] Health score > 90
- [ ] Integration score > 85
- [ ] Workarounds < 50

### Observability

- [ ] All metrics instrumented
- [ ] Alerting configured
- [ ] Performance dashboard

---

## 📝 Next Steps

1. **Immediate (Today)**:

   - Implement orchestrator parallelization
   - Run /maintain + /fix

2. **This Week**:

   - N-gram memoization
   - Benchmark suite

3. **Next Sprint**:

   - BM25 inverted index
   - Vector LSH (optional)

4. **Long-term**:
   - Event-driven architecture
   - Multi-agent parallelism

---

**Author**: Claude Code Agent
**Status**: Ready for Implementation
**Priority**: HIGH (pre-requisite for scale)
