# Phase 2.7 Roadmap - Performance Optimization

**Duration:** 3 weeks
**Status:** Not Started
**Dependencies:** Phase 2.6 (Complete ✅)

---

## 🎯 Mission Statement

**Optimize system performance through GPU acceleration, vectorization, adaptive algorithms, and intelligent caching to achieve:**
- Latency: p95 < 2s (현재 <3s)
- Cost: -25% reduction
- Throughput: +40% increase
- Quality: Groundedness +10%p, Recall +12%

---

## 📊 Current Baseline (Phase 2.6)

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Domain Detection | 50ms (p95) | 20ms | -60% |
| Feedback Filter | 50ms (100 items) | 30ms | -40% |
| E2E Latency | <3s (p95) | 1.8-2.5s | -25% |
| Throughput | Baseline | +40% | +40% |
| Cost | Baseline | -25% | -25% |
| Groundedness | Baseline | +10%p | +10%p |
| Recall@10 | Baseline | +12% | +12% |

**Source:** `reports/perf-baseline.json`

---

## 🗓️ Week 1: Latency Optimization (GPU + Vectorization)

### Goals
- Reduce L2 Domain Detection: 50ms → 20ms
- Reduce L4 Feedback Filter: 50ms → 30ms
- Achieve E2E latency: p95 < 2s

### Tasks

#### Day 1-2: GPU Accelerated Domain Detector
**File:** `src/runtime/l2-synthesizer/domain/gpu-domain-detector.ts`

```typescript
/**
 * GPU-Accelerated Domain Detector
 *
 * Uses ONNX Runtime with GPU support for:
 * - Fast embedding generation (CUDA)
 * - Vectorized similarity search
 * - Batch processing for multiple queries
 *
 * Expected: 50ms → 20ms (60% reduction)
 */

import * as ort from 'onnxruntime-node';

export class GPUDomainDetector {
  private session: ort.InferenceSession;

  async initialize(modelPath: string) {
    this.session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cuda', 'cpu'], // Fallback to CPU
      graphOptimizationLevel: 'all',
    });
  }

  async detectBatch(queries: string[]): Promise<DomainSignature[]> {
    // Batch processing with GPU
  }
}
```

**Implementation Steps:**
1. Install ONNX Runtime: `npm install onnxruntime-node`
2. Convert existing detector to use GPU embeddings
3. Implement batch processing (process 10 queries at once)
4. Add GPU utilization monitoring
5. Fallback to CPU if GPU unavailable

**Success Criteria:**
- [ ] Domain Detection p95 < 20ms
- [ ] GPU utilization > 70%
- [ ] Batch processing 10x faster than sequential
- [ ] No accuracy regression vs baseline

**Testing:**
```bash
npm test -- tests/integration/option-a/layer-profiling.test.ts
# Verify: L2 Domain Detection p95 < 20ms
```

---

#### Day 3-4: Vectorized Feedback Filter
**File:** `src/runtime/l4-optimizer/vectorized-feedback-filter.ts`

```typescript
/**
 * Vectorized Feedback Filter
 *
 * SIMD-optimized implementation:
 * - Batched confidence scoring (all items at once)
 * - Vectorized temporal decay (exponential batch calc)
 * - Parallel outlier detection (3-sigma vectorized)
 *
 * Expected: 50ms → 30ms (40% reduction) for 100 items
 */

import { Worker } from 'piscina';

export class VectorizedFeedbackFilter {
  private workerPool: Worker;

  constructor() {
    this.workerPool = new Worker({
      filename: './feedback-filter-worker.js',
      minThreads: 4,
      maxThreads: 8,
    });
  }

  async filterBatch(feedbacks: UserFeedback[]): Promise<FilteredFeedback[]> {
    // Vectorized operations in worker threads
    return this.workerPool.run({ feedbacks, operation: 'filter' });
  }
}
```

**Implementation Steps:**
1. Install Piscina: `npm install piscina`
2. Extract pure functions from FeedbackNoiseFilter
3. Implement worker thread for batch operations
4. Vectorize confidence scoring (process all at once)
5. Optimize temporal decay (single exp() call for all)

**Success Criteria:**
- [ ] Feedback Filter p95 < 30ms (100 items)
- [ ] Throughput > 3,000 items/sec
- [ ] Worker pool scales to 8 threads
- [ ] No filtering accuracy loss

**Testing:**
```bash
npm test -- tests/integration/option-a/feedback-loop-real.test.ts
# Verify: Performance test <500ms for 1,000 items
```

---

#### Day 5: Integration & Validation
- Run full integration test suite (68 tests)
- Benchmark before/after comparison
- Generate Week 1 performance report
- Validate E2E latency < 2s

**Expected Results:**
- ✅ Domain Detection: 50ms → 20ms ✅
- ✅ Feedback Filter: 50ms → 30ms ✅
- ✅ E2E Latency: <3s → <2s ✅
- ✅ All 68 tests still passing ✅

---

## 🗓️ Week 2: Adaptive Optimization (Bandit + Pareto)

### Goals
- Auto-tune retrieval parameters (α/β) per domain
- Implement cost-quality-diversity trade-off
- Achieve Recall@10 +12%, Cost -20%

### Tasks

#### Day 1-3: Adaptive Bandit Policy
**File:** `src/runtime/l4-optimizer/adaptive-bandit-policy.ts`

```typescript
/**
 * Adaptive Bandit Policy with Thompson Sampling
 *
 * Auto-tunes α (BM25 weight) and β (Vector weight) per domain:
 * - Healthcare: α=0.7, β=0.3 (precision over recall)
 * - Finance: α=0.5, β=0.5 (balanced)
 * - General: α=0.4, β=0.6 (semantic similarity)
 *
 * Expected: Recall@10 +12%, Cost -20%
 */

export class AdaptiveBanditPolicy {
  private arms: Map<string, BanditArm>;  // domain → arm

  async selectAction(context: Context): Promise<Action> {
    const domain = context.domain;
    const arm = this.arms.get(domain) || this.initializeArm(domain);

    // Thompson Sampling
    const alpha = arm.sampleAlpha();
    const beta = 1 - alpha;

    return { retrieval: { alpha, beta }, ...context };
  }

  async updateReward(action: Action, reward: Reward) {
    // Online learning: update arm distributions
  }
}
```

**Implementation Steps:**
1. Implement Thompson Sampling bandit algorithm
2. Define reward signal: f(groundedness, recall, cost)
3. Domain-specific arm initialization
4. Online reward collection from QA generation
5. Performance tracking per domain

**Success Criteria:**
- [ ] Auto-tuned α/β outperforms static config
- [ ] Recall@10 improvement +12% across domains
- [ ] Cost reduction -20% (fewer API calls)
- [ ] Convergence within 100 queries per domain

**Testing:**
```bash
# New test file
touch tests/integration/option-a/adaptive-bandit.test.ts
npm test -- tests/integration/option-a/adaptive-bandit.test.ts
```

---

#### Day 4-5: Pareto Router
**File:** `src/runtime/economy/pareto-router.ts`

```typescript
/**
 * Pareto Router for Multi-Objective Optimization
 *
 * Balances 3 objectives:
 * - Cost: Minimize API calls + compute
 * - Quality: Maximize groundedness + readability
 * - Diversity: Maximize answer variety
 *
 * Selects Pareto-optimal point based on user preference
 */

export class ParetoRouter {
  private paretoFront: ParetoPoint[];

  computeParetoFront(actions: Action[]): ParetoPoint[] {
    // NSGA-II inspired algorithm
    // Returns non-dominated solutions
  }

  selectOptimalAction(
    front: ParetoPoint[],
    preference: { cost: number; quality: number; diversity: number }
  ): Action {
    // Weighted distance to ideal point
  }
}
```

**Implementation Steps:**
1. Define 3D objective space (cost, quality, diversity)
2. Implement Pareto frontier computation (NSGA-II style)
3. Integrate with MacroEconomyRouter
4. Add user preference configuration
5. Dashboard visualization (Plotly 3D scatter)

**Success Criteria:**
- [ ] Pareto front computed correctly (non-dominated solutions)
- [ ] User-configurable trade-off preferences
- [ ] Cost/quality balance visible in dashboard
- [ ] 0% waste (all solutions on frontier)

**Testing:**
```bash
touch tests/integration/option-a/pareto-router.test.ts
npm test -- tests/integration/option-a/pareto-router.test.ts
```

---

## 🗓️ Week 3: Infrastructure & Monitoring

### Goals
- Implement Redis caching (TTL 30min)
- Auto-collect performance metrics
- Achieve Latency -30%, Cost -25%

### Tasks

#### Day 1-2: Redis Cache Manager
**File:** `src/runtime/cache/redis-cache-manager.ts`

```typescript
/**
 * Redis Cache Manager
 *
 * Cache layers:
 * - Evidence: Retrieved chunks (TTL 30min)
 * - Embeddings: Vector representations (TTL 60min)
 * - Explanations: Generated answers (TTL 15min)
 *
 * Expected: Cache hit rate >60%, Latency -30%, Cost -25%
 */

import { createClient } from 'redis';

export class RedisCacheManager {
  private client: RedisClient;

  async initialize() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    await this.client.connect();
  }

  async getEvidence(query: string): Promise<Evidence[] | null> {
    const key = `evidence:${hash(query)}`;
    const cached = await this.client.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setEvidence(query: string, evidence: Evidence[], ttl: number = 1800) {
    const key = `evidence:${hash(query)}`;
    await this.client.setEx(key, ttl, JSON.stringify(evidence));
  }
}
```

**Implementation Steps:**
1. Install Redis: `npm install redis @types/redis`
2. Set up local Redis (Docker): `docker run -d -p 6379:6379 redis`
3. Implement cache layers: Evidence, Embeddings, Explanations
4. Configure TTL policies (30min default)
5. Add cache hit/miss metrics

**Success Criteria:**
- [ ] Cache hit rate > 60% for repeated queries
- [ ] Latency reduction -30% (cached queries)
- [ ] Cost reduction -25% (fewer API calls)
- [ ] Cache invalidation working (TTL expiry)

**Testing:**
```bash
# Start Redis
docker run -d -p 6379:6379 redis:latest

# Run cache tests
touch tests/integration/option-a/redis-cache.test.ts
npm test -- tests/integration/option-a/redis-cache.test.ts
```

---

#### Day 3-4: Performance Metrics Collector
**File:** `scripts/metrics/perf-tracker.ts`

```typescript
/**
 * Performance Metrics Auto-Collector
 *
 * Automatically tracks:
 * - Layer-wise latency (L1-L4)
 * - Cache hit rates
 * - API call counts & costs
 * - GPU utilization
 * - Error rates
 *
 * Saves to: reports/metrics/{timestamp}.json
 */

export class PerformanceTracker {
  private metrics: MetricsCollection;

  async startTracking(runId: string) {
    this.metrics = {
      runId,
      timestamp: new Date(),
      layers: {},
      cache: {},
      costs: {},
    };
  }

  async recordLayerLatency(layer: string, duration: number) {
    this.metrics.layers[layer].push(duration);
  }

  async saveMetrics() {
    const path = `reports/metrics/${this.metrics.timestamp.toISOString()}.json`;
    await fs.writeFile(path, JSON.stringify(this.metrics, null, 2));
  }
}
```

**Implementation Steps:**
1. Create metrics collection schema
2. Integrate with all layer functions (L1-L4)
3. Add cache hit/miss tracking
4. GPU utilization monitoring (nvidia-smi)
5. Dashboard integration (Grafana/Plotly)

**Success Criteria:**
- [ ] Metrics auto-collected every test run
- [ ] Historical data saved (30 days retention)
- [ ] Dashboard showing real-time metrics
- [ ] Alert system for performance degradation

**Testing:**
```bash
npm run test -- --coverage
# Verify metrics saved to reports/metrics/
```

---

#### Day 5: Final Integration & Phase 2.7 Completion
- Run full integration test suite (all 68+ tests)
- Generate performance comparison report (baseline vs optimized)
- Validate all targets achieved
- Create Phase 2.8 handoff document

**Deliverables:**
- [ ] Performance Optimization Report (`PHASE_2.7_COMPLETE.md`)
- [ ] Benchmark Comparison (`reports/phase-2.7-benchmarks.json`)
- [ ] Updated architecture diagrams
- [ ] Phase 2.8 handoff document

---

## 📊 Expected Final Metrics (Phase 2.7 Complete)

| Metric | Baseline | Target | Expected | Status |
|--------|----------|--------|----------|--------|
| Groundedness | Baseline | ≥90% | 91-93% | 🎯 |
| Recall@10 | Baseline | +20% | +22% | 🎯 |
| Readability | Baseline | +10% | +11% | 🎯 |
| Latency (p95) | <3s | ≤3s | 1.8-2.5s | 🎯 |
| Cost / 1k QA | Baseline | -25% | -30% | 🎯 |
| Throughput | Baseline | +40% | +45% | 🎯 |
| Cache Hit Rate | 0% | >60% | >60% | 🎯 |

---

## 🚨 Risk Mitigation

### Risks
1. **GPU Availability:** CUDA may not be available on all systems
   - **Mitigation:** Fallback to CPU, detect GPU at runtime

2. **Redis Dependency:** External Redis service required
   - **Mitigation:** In-memory cache fallback, Docker setup guide

3. **Performance Regression:** Optimizations may break accuracy
   - **Mitigation:** Run full test suite after each change, rollback if needed

4. **Integration Complexity:** 5 upgrades with dependencies
   - **Mitigation:** Incremental rollout, feature flags for each upgrade

---

## 📚 References

**Critical Files:**
- `@HANDOFF_PHASE_2.7.md` - Session handoff
- `@reports/perf-baseline.json` - Baseline metrics
- `@tests/integration/option-a/INTEGRATION_REPORT.md` - Test report
- `@PHASE_2.6_COMPLETE.md` - Previous phase summary

**Technical Docs:**
- `@docs/llm_friendly_summary.md` - Architecture
- `@CLAUDE.md` - Development philosophy
- `@LLM_DEVELOPMENT_CONTRACT.md` - Standards

---

**Created:** 2025-10-10T04:10:00Z
**Owner:** Development Team
**Status:** Ready to Execute
**Next:** Start Week 1, Day 1 - GPU Domain Detector
