# 🚀 Quick Start Guide for Next Session

**Last Updated:** 2025-10-10T04:10:00Z
**Current Phase:** 2.7 (Performance Optimization)
**Status:** Ready to Start

---

## ⚡ Fast Recovery (30 seconds)

### 1. Load Essential Context
```bash
# Load these files at session start:
@HANDOFF_PHASE_2.7.md              # Main handoff document (READ THIS FIRST)
@SESSION_STATE.json                # Current state
@PHASE_2.7_ROADMAP.md              # Detailed roadmap
@reports/perf-baseline.json        # Performance baseline
```

### 2. Verify System State
```bash
# Verify Phase 2.6 is complete
npm test -- tests/integration/option-a/
# Expected: 68/68 passing (100%)

# Check current state
cat SESSION_STATE.json
# Expected: "currentPhase": "2.7", "status": "Ready to Start"
```

### 3. Start Phase 2.7
```bash
# Week 1, Day 1: GPU Domain Detector
npm install onnxruntime-node

# Create new file
touch src/runtime/l2-synthesizer/domain/gpu-domain-detector.ts

# Run baseline benchmark
npm test -- tests/integration/option-a/layer-profiling.test.ts
```

---

## 📋 What Was Accomplished (Phase 2.6)

✅ **68/68 Integration Tests Passing (100%)**
✅ **Performance Baseline Saved** (`reports/perf-baseline.json`)
✅ **Bottlenecks Identified:**
  - Domain Detection: 50ms (target: 20ms)
  - Feedback Filter: 50ms (target: 30ms)
✅ **New Tests Added:**
  - Layer-wise profiling (10 tests)
  - Edge cases (20 tests)
  - Real implementation tests (12 tests)

---

## 🎯 What To Do Next (Phase 2.7)

### Week 1: Latency Optimization
**Goal:** Reduce Domain Detection 50ms → 20ms, Feedback Filter 50ms → 30ms

**Day 1-2:** GPU Domain Detector
- Install: `npm install onnxruntime-node`
- File: `src/runtime/l2-synthesizer/domain/gpu-domain-detector.ts`
- Target: p95 < 20ms

**Day 3-4:** Vectorized Feedback Filter
- Install: `npm install piscina`
- File: `src/runtime/l4-optimizer/vectorized-feedback-filter.ts`
- Target: p95 < 30ms (100 items)

**Day 5:** Integration & Testing
- Validate E2E latency < 2s
- All tests still passing

---

## 📊 Success Criteria (Phase 2.7)

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Latency (p95) | 1.8-2.5s | `npm test -- tests/integration/option-a/layer-profiling.test.ts` |
| Groundedness | +10%p | Quality metrics from test runs |
| Recall@10 | +12% | Retrieval tests |
| Cost | -25% | API call reduction |
| Throughput | +40% | Stress tests |

---

## 🔧 Commands Cheat Sheet

```bash
# Verify current state
npm test -- tests/integration/option-a/
cat SESSION_STATE.json

# Check performance baseline
cat reports/perf-baseline.json | jq '.performance'

# Start Week 1 tasks
npm install onnxruntime-node piscina

# Run specific test suites
npm test -- tests/integration/option-a/layer-profiling.test.ts
npm test -- tests/integration/option-a/feedback-loop-real.test.ts

# Check GPU availability (if applicable)
nvidia-smi
```

---

## 📁 Critical Files Location

```
PROJECT_ROOT/
├── HANDOFF_PHASE_2.7.md          ← MAIN HANDOFF (read first)
├── PHASE_2.7_ROADMAP.md          ← Detailed roadmap
├── SESSION_STATE.json            ← Current state
├── PHASE_2.6_COMPLETE.md         ← Previous phase summary
├── reports/
│   └── perf-baseline.json        ← Performance baseline
└── tests/integration/option-a/
    ├── feedback-loop-real.test.ts (12 tests)
    ├── layer-profiling.test.ts    (10 tests)
    ├── edge-cases.test.ts         (20 tests)
    └── INTEGRATION_REPORT.md      ← Test report
```

---

## 🚨 If Something Goes Wrong

### Tests Failing?
```bash
# Check what changed
git status
git diff

# Revert to known good state
git checkout tests/integration/option-a/
npm test
```

### Can't Find Context?
```bash
# All critical files are in project root
ls -la *.md | grep -E "(HANDOFF|PHASE|SESSION)"

# Load handoff document
cat HANDOFF_PHASE_2.7.md
```

### Performance Baseline Missing?
```bash
# Check if file exists
cat reports/perf-baseline.json

# Regenerate if needed
npm test -- tests/integration/option-a/
```

---

## 💡 Pro Tips

1. **Always start by loading `@HANDOFF_PHASE_2.7.md`** - It has all the context
2. **Verify tests pass before starting new work** - `npm test`
3. **Use layer-profiling tests to measure improvements** - Baseline comparison
4. **Check SESSION_STATE.json for current phase status**
5. **Refer to PHASE_2.7_ROADMAP.md for detailed week-by-week plan**

---

**Next Action:** Load `@HANDOFF_PHASE_2.7.md` and start Week 1, Day 1
**Estimated Time to Start:** <2 minutes
**Expected Output:** GPU Domain Detector implementation ready
