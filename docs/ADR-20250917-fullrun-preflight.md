# ADR: Full Run Pre-flight Checklist v1 (Final Integration)

**Date**: 2025-09-17 (Updated with Final Integration Brief)
**Status**: Accepted
**Context**: Baseline v1.5 Metrics System Full Run Preparation

## Context

Full run execution requires comprehensive pre-flight validation based on the **Final Integration Brief (2025-09-17)**:

### Critical Requirements

- **P0 Absolute Fixed**: PII violations, license violations, hallucination excess, evidence gaps - these thresholds are immutable
- **P1/P2 Auto-calibration**: Recent N-run smoke/full distribution-based warn/fail threshold percentile estimation
- **Profile-based Differentiation**: dev/stage/prod environment-specific threshold application
- **Orchestration Contracts**: Fixed agent envelope standards with state machine governance
- **Data Freeze & Reproducibility**: ±5% reproducibility with checksum-fixed datasets and seed standardization

Without systematic pre-flight validation implementing these integrated requirements, full runs risk budget overruns, quality degradation, and production incidents.

## Decision

We implement the **7 Essential Pre-flight Requirements + 3-Layer Multi-Agent Orchestration** as specified in the Final Integration Brief:

### Essential Pre-flight Requirements (7 Core Elements)

1. **Report Consistency Guarantee**

   - CASES_TOTAL > 0 enforcement
   - session_report.md RESULT/RUN_STATE/DRY_RUN/MODEL_ID ↔ actual execution result alignment
   - Bidirectional linking between baseline_report.md and session_report.md

2. **DLQ & Retry Policy**

   - 429/5xx/timeout → exponential backoff then final DLQ isolation
   - DLQ file storage (reports/dlq/\*) and reprocessing CLI provision
   - Transient vs. permanent error classification

3. **Budget Guards & Kill Switch**

   - Run/item-level budget ceiling configuration
   - Environment variable `HARD_STOP=1` → immediate runtime termination
   - Profile-specific limits with 95% utilization triggers

4. **Data Freeze & Manifest**

   - Input dataset/gold set checksum fixation
   - Same input ±5% reproducibility guarantee
   - Manifest validation and integrity checking

5. **Random Sampling Seed Fixation**

   - Batch sampling, diversity sampling, retriever tie-break seed values fixed
   - Deterministic reproduction of sampling decisions
   - Seed documentation and version control

6. **Log & Trace Standardization**

   - All agent call logs with common fields: `RUN_ID, ITEM_ID, AGENT_ROLE, COST, LAT_MS, RETRIES`
   - Structured logging for audit trail and debugging
   - Centralized log aggregation and analysis

7. **Threshold Gate Integration**
   - P0 violations → FAIL (immutable thresholds)
   - P1 multiple violations → WARN/PARTIAL (auto-calibrated thresholds)
   - P2 minor violations → PASS (auto-calibrated thresholds)

### Multi-Agent Orchestration Architecture (3-Layer Enhanced Structure)

**Lightweight MA Chain Application:**

- **Evidence → Answer → Audit** (core processing pipeline)
- **+ Budget Guardian / Retry-Router / Diversity Planner** (cross-cutting services)

**Orchestration Contract Specifications:**

- **Envelope Standard**: `RUN_ID, ITEM_ID, AGENT_ID, ROLE, CONTEXT_REF, COST_BUDGET, TIMEBOX_MS`
- **State Machine**: `QUEUED → RUNNING → RETRYING → DLQ|DONE`
- **Error Classification**: TRANSIENT / PERMANENT / POLICY
- **Output Common Fields**: `metrics, citations, warnings, verdict, cost, latency`

**Checkpoint & Recovery System:**

- JSONL stream last success index recording
- Restart from interruption point continuation (idempotency guarantee)
- Incremental progress preservation and rollback capability

**Cost & Time Governance:**

- Per-agent ceilings (e.g., Answer $0.05, Audit 6s)
- Batch cumulative cost/latency overflow → early termination or downscale mode transition

## Consequences

### Positive Outcomes

- **Reliability**: P0 violations prevented, automated quality assurance
- **Adaptability**: P1/P2 thresholds evolve with system performance
- **Cost Control**: Profile-based budgets prevent overruns
- **Reproducibility**: Standardized datasets and manifest validation
- **Operational Visibility**: Comprehensive logging and DLQ monitoring

### Risks & Mitigations

- **Complexity**: Systematic checkpoint design reduces operational burden
- **False Positives**: Drift guard prevents excessive auto-calibration
- **Performance Impact**: Lightweight agent design minimizes overhead

### Implementation Requirements

- Pre-flight validation in ./run_v3.sh baseline pipeline
- session_report.md metadata standardization
- Multi-agent state machine implementation
- Profile-based threshold configuration
- DLQ integration and reprocessing workflows

### Full Run Workflow Execution Order

1. P0 threshold fixation, P1/P2 auto-calibration logic final verification
2. Report consistency confirmation + CASES_TOTAL > 0 validation
3. DLQ/retry/budget guard/kill switch operation verification
4. Data manifest·seed·log standardization application
5. Internal lightweight MA chain (E→A→Audit + Budget/Retry/Diversity) connection
6. Orchestration contract·checkpoint·per-agent policy setup
7. Smoke run validation followed by full run execution

## Status

**Accepted** - Final Integration Brief implementation (2025-09-17).

**Summary**: P0 = Fixed, P1/P2 = Auto-calibration. Essential enhancement 7 elements + Multi-agent orchestration 3-layer (Evidence/Answer/Audit) application. Smoke validation → full run execution.

Core infrastructure established:

- 8-metric quality assessment system with P0/P1/P2 classification
- Profile-based threshold policies with auto-calibration (dev/stage/prod)
- Enhanced multi-agent pipeline with orchestration contracts
- DLQ, retry mechanisms, and budget governance
- Data freeze, seed fixation, and reproducibility guarantees

Next phase: Complete implementation of 7 essential requirements and 3-layer orchestration contracts for production-ready full runs.
