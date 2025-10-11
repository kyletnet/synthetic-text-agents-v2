# 🚀 Phase 2.7 Handoff Document - Performance Optimization

**Status:** Ready to Start
**Previous Phase:** 2.6 Integration Tests (✅ COMPLETE - 68/68 passing)
**Current Phase:** 2.7 Performance Optimization
**Timestamp:** 2025-10-10T04:10:00Z

---

## 📊 Current System State

### Integration Tests (Phase 2.6 완료)
- **Coverage:** 68/68 tests passing (100%)
- **Performance Baseline:** Saved to `reports/perf-baseline.json`
- **Bottlenecks Identified:**
  1. Domain Detection: p95 = 50ms → Target: 20ms
  2. Feedback Filter: p95 = 50ms → Target: 30ms

### Test Suites
1. ✅ feedback-loop-real.test.ts (12) - Real implementation
2. ✅ layer-profiling.test.ts (10) - Layer-wise profiling
3. ✅ edge-cases.test.ts (20) - Edge case robustness
4. ✅ l1-l4-pipeline.test.ts (17)
5. ✅ trust-e2e.test.ts (4)
6. ✅ stress-batch.test.ts (3)
7. ✅ compliance-regulations.test.ts (2)

### Performance Metrics (Baseline)
```json
{
  "L1 (Retrieval)": {
    "BM25": "p95 < 10ms",
    "Vector": "p95 < 15ms",
    "RRF Fusion": "p95 < 5ms"
  },
  "L2 (Synthesis)": {
    "Answer Gen": "p95 < 10ms",
    "Domain Detection": "p95 = 50ms ⚠️ BOTTLENECK"
  },
  "L3 (Planning)": {
    "NLI Gate": "p95 < 10ms",
    "Proof Gen": "p95 < 5ms"
  },
  "L4 (Optimization)": {
    "Feedback Filter": "p95 = 50ms ⚠️ BOTTLENECK",
    "Bandit Policy": "p95 < 5ms"
  },
  "E2E Total": "p95 < 100ms (mock-based)"
}
```

---

## 🎯 Phase 2.7 Objectives

### Performance Targets
| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **Groundedness** | Baseline | +10%p | Critical |
| **Recall@10** | Baseline | +12% | High |
| **Readability** | Baseline | +10% | Medium |
| **Latency (p95)** | <3s | 1.8-2.5s | High |
| **Cost / 1k QA** | Baseline | -25% | High |
| **Throughput** | Baseline | +40% | High |

### 5 Precision Upgrades (순서대로 실행)

#### 1️⃣ GPU Accelerated Domain Detector
**Goal:** Reduce L2 Domain Detection from 50ms → 20ms

**Implementation:**
```typescript
// File: src/runtime/l2-synthesizer/domain/gpu-domain-detector.ts
// Use: CUDA / ONNX Runtime for vector search acceleration
// Expected: Groundedness +10%p, Latency -60%
```

**Tasks:**
- [ ] Install ONNX Runtime dependencies
- [ ] Convert DomainDetector to use GPU-accelerated embeddings
- [ ] Benchmark: Compare CPU vs GPU performance
- [ ] Integrate with existing L2 pipeline
- [ ] Add GPU utilization metrics

**Success Criteria:**
- Domain Detection p95 < 20ms
- No accuracy regression
- GPU utilization > 70%

---

#### 2️⃣ Vectorized Feedback Filter
**Goal:** Reduce L4 Feedback Filter from 50ms → 30ms (100 items)

**Implementation:**
```typescript
// File: src/runtime/l4-optimizer/vectorized-feedback-filter.ts
// Use: SIMD + batched vectorization
// Expected: Feedback Throughput +3x
```

**Tasks:**
- [ ] Implement SIMD-optimized confidence scoring
- [ ] Batch temporal decay calculations
- [ ] Vectorize outlier detection (numpy-style)
- [ ] Benchmark: 100, 1000, 10000 feedbacks
- [ ] Integrate with existing FeedbackInterpreter

**Success Criteria:**
- Feedback Filter p95 < 30ms (100 items)
- Throughput > 3,000 items/sec
- No filtering accuracy regression

---

#### 3️⃣ Adaptive Bandit Policy (Online Learning)
**Goal:** Auto-tune α/β parameters per domain

**Implementation:**
```typescript
// File: src/runtime/l4-optimizer/adaptive-bandit-policy.ts
// Use: Multi-armed bandit with Thompson Sampling
// Expected: Dynamic Recall +12%, Cost -20%
```

**Tasks:**
- [ ] Implement Thompson Sampling bandit
- [ ] Domain-aware context modeling
- [ ] Online reward signal collection
- [ ] Automatic α/β exploration
- [ ] Performance tracking per domain

**Success Criteria:**
- Auto-tuned α/β outperforms static config
- Recall@10 improvement +12%
- Cost reduction -20%

---

#### 4️⃣ Pareto Router (Cost-Quality-Diversity Trade-off)
**Goal:** Optimize 3D Pareto front (cost vs quality vs diversity)

**Implementation:**
```typescript
// File: src/runtime/economy/pareto-router.ts
// Use: Multi-objective optimization (NSGA-II inspired)
// Expected: Optimal balance, 0% waste
```

**Tasks:**
- [ ] Define 3D objective space (cost, quality, diversity)
- [ ] Implement Pareto frontier computation
- [ ] Auto-select best point on frontier per query
- [ ] Integrate with MacroEconomyRouter
- [ ] Dashboard for Pareto visualization

**Success Criteria:**
- Pareto-optimal routing for all queries
- User-configurable trade-off preferences
- Cost/quality balance visualization

---

#### 5️⃣ Persistent Redis Cache + Metrics Collector
**Goal:** Cache evidence/embeddings, auto-collect performance metrics

**Implementation:**
```typescript
// File: src/runtime/cache/redis-cache-manager.ts
// File: scripts/metrics/perf-tracker.ts
// Use: Redis TTL 30min, auto-metrics collection
// Expected: Latency -30%, Cost -25%, Visibility ↑
```

**Tasks:**
- [ ] Set up Redis connection (local + cloud)
- [ ] Implement cache layers: Evidence, Embeddings, Explanations
- [ ] Configure TTL policies (30min default)
- [ ] Build perf-tracker.ts for auto-metrics
- [ ] Dashboard integration

**Success Criteria:**
- Cache hit rate > 60%
- Latency reduction -30% (cached queries)
- Cost reduction -25% (API calls)
- Metrics auto-collected every run

---

## 📋 Execution Plan (3 Weeks)

### Week 1: Latency Optimization
**Focus:** GPU Domain Detector + Vectorized Feedback Filter

**Day 1-2:** GPU Domain Detector
- Install dependencies, convert to GPU
- Benchmark and integrate

**Day 3-4:** Vectorized Feedback Filter
- SIMD optimization, batching
- Performance testing

**Day 5:** Integration Testing
- Run full test suite
- Validate p95 < 1.8s target

**Expected:** Latency -40%, Groundedness +10%p

---

### Week 2: Adaptive Optimization
**Focus:** Bandit Policy + Pareto Router

**Day 1-3:** Adaptive Bandit Policy
- Implement Thompson Sampling
- Domain-aware tuning
- Online learning integration

**Day 4-5:** Pareto Router
- 3D optimization
- Auto-selection logic
- Dashboard visualization

**Expected:** Recall +12%, Cost -20%

---

### Week 3: Infrastructure & Monitoring
**Focus:** Redis Cache + Metrics Collector

**Day 1-2:** Redis Cache Setup
- Local + cloud deployment
- Cache layer implementation
- TTL policy configuration

**Day 3-4:** Metrics Collector
- Auto-tracking implementation
- Dashboard integration
- Alert configuration

**Day 5:** Final Integration & Testing
- Full system validation
- Performance report generation
- Phase 2.7 completion

**Expected:** Latency -30%, Cost -25%, Throughput +40%

---

## 🔧 Technical Context

### Key Files to Modify
```
src/runtime/l2-synthesizer/domain/
  ├── domain-detector.ts (existing)
  └── gpu-domain-detector.ts (NEW)

src/runtime/l4-optimizer/
  ├── feedback-noise-filter.ts (existing)
  ├── vectorized-feedback-filter.ts (NEW)
  ├── bandit-policy.ts (existing)
  └── adaptive-bandit-policy.ts (NEW)

src/runtime/economy/
  ├── macro-economy-router.ts (existing)
  └── pareto-router.ts (NEW)

src/runtime/cache/ (NEW directory)
  └── redis-cache-manager.ts

scripts/metrics/
  └── perf-tracker.ts (NEW)
```

### Dependencies to Add
```json
{
  "onnxruntime-node": "^1.17.0",  // GPU acceleration
  "redis": "^4.6.0",               // Cache
  "@types/redis": "^4.0.11",
  "piscina": "^4.0.0"              // Worker threads for SIMD
}
```

### Environment Variables
```bash
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_TTL=1800  # 30 minutes

# GPU
GPU_ENABLED=true
GPU_DEVICE_ID=0

# Performance
ENABLE_METRICS_COLLECTION=true
METRICS_OUTPUT_PATH=reports/metrics/
```

---

## 📊 Success Criteria (Phase 2.7 Complete)

### Performance Metrics
- [ ] Groundedness: 91-93% (target: ≥90%)
- [ ] Recall@10: +22% (target: +20%)
- [ ] Readability: +11% (target: +10%)
- [ ] Latency p95: 1.8-2.5s (target: ≤3s)
- [ ] Cost/1k QA: -30% (target: -25%)
- [ ] Throughput: +45% (target: +40%)

### Technical Validation
- [ ] All 68 integration tests still passing
- [ ] New performance tests added (GPU, cache, bandit)
- [ ] Benchmarks show improvement vs baseline
- [ ] No accuracy/quality regression
- [ ] Metrics auto-collection working

### Documentation
- [ ] Performance optimization report
- [ ] Benchmark comparison (before/after)
- [ ] Updated architecture diagrams
- [ ] Phase 2.8 handoff document

---

## 🚨 Important Notes for Next Session

### Context to Load
```bash
# Essential files to read at session start:
@HANDOFF_PHASE_2.7.md           # This file
@PHASE_2.6_COMPLETE.md          # Previous phase summary
@reports/perf-baseline.json     # Performance baseline
@tests/integration/option-a/INTEGRATION_REPORT.md  # Test details
```

### Commands to Run
```bash
# Verify current state
npm test -- tests/integration/option-a/
cat reports/perf-baseline.json

# Install new dependencies (when ready)
npm install onnxruntime-node redis @types/redis piscina

# Start Redis (local development)
docker run -d -p 6379:6379 redis:latest
```

### State Preservation
All critical state is saved in:
- `reports/perf-baseline.json` - Performance baseline
- `tests/integration/option-a/` - All integration tests
- `PHASE_2.6_COMPLETE.md` - Phase 2.6 summary
- `HANDOFF_PHASE_2.7.md` - This handoff document

---

## 🎯 First Task in Next Session

**Start with:** GPU Accelerated Domain Detector

**Command:**
```bash
# 1. Verify dependencies
npm list onnxruntime-node || npm install onnxruntime-node

# 2. Create GPU Domain Detector
touch src/runtime/l2-synthesizer/domain/gpu-domain-detector.ts

# 3. Run baseline benchmark
npm test -- tests/integration/option-a/layer-profiling.test.ts
```

**Expected Output:**
- Domain Detection baseline: p95 = 50ms
- After GPU optimization: p95 < 20ms

---

## 📖 Additional References

**Technical Docs:**
- `@docs/llm_friendly_summary.md` - System architecture
- `@CLAUDE.md` - Development philosophy
- `@LLM_DEVELOPMENT_CONTRACT.md` - Development standards

**Related Issues:**
- Performance bottlenecks: Domain Detection, Feedback Filter
- Next phase: Phase 2.8 (Audit/Regulation Automation)

---

**Generated:** 2025-10-10T04:10:00Z
**Phase:** 2.6 → 2.7 Transition
**Status:** ✅ Ready to Execute
**Owner:** Next session Claude Code agent
