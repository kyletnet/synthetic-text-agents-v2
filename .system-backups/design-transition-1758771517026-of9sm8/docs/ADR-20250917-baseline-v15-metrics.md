# ADR-20250917: Baseline v1.5 Human-Perceptible Quality Metrics

**Status:** Accepted
**Date:** 2025-09-17
**Author:** Claude Code Assistant
**Reviewers:** System Operator

## Context

The existing baseline system (v1.0) provided basic quality metrics (sentence length, copy rate, keyword matching) but lacked human-perceptible quality indicators that stakeholders could easily understand and act upon. There was a need for comprehensive quality assessment that could:

1. **Surface Quality Issues**: Detect problems that users would actually notice
2. **Provide Actionable Insights**: Give specific guidance on what needs improvement
3. **Ensure Reproducibility**: Maintain ±5% consistency across runs
4. **Support Operational Decisions**: Enable go/no-go decisions for releases

## Decision

We have implemented Baseline v1.5 with six core human-perceptible quality metrics:

### 1. Duplication Detection

- **Rationale**: Content repetition directly impacts user experience
- **Implementation**: 3-5gram Jaccard/cosine similarity with optional LLM semantic judging
- **Threshold**: <15% duplication rate triggers alerts
- **Output**: Top duplicate pairs with similarity scores

### 2. Question Type Distribution

- **Rationale**: Balanced question types indicate comprehensive coverage
- **Implementation**: Rule-based classification (what/why/how/when/where/who/comparison/inference)
- **Threshold**: Imbalance score >30% or >2 missing categories triggers alerts
- **Output**: Distribution table with entropy and balance metrics

### 3. Coverage Analysis

- **Rationale**: Ensures important content from source material is addressed
- **Implementation**: Entity/keyphrase extraction with section mapping
- **Threshold**: <60% entity coverage or <70% section coverage triggers alerts
- **Output**: Coverage rates with lists of missed important entities

### 4. Evidence Quality Assessment

- **Rationale**: Poor answer-evidence alignment indicates potential hallucinations
- **Implementation**: Hit-rate calculation + snippet alignment scoring
- **Threshold**: <80% evidence presence or <50% mean alignment triggers alerts
- **Output**: Presence rates and alignment quality scores

### 5. Hallucination Detection

- **Rationale**: Unsupported claims directly impact trustworthiness
- **Implementation**: Rule-based similarity checks for claim support
- **Threshold**: >5% hallucination rate or >3 high-risk cases triggers alerts
- **Output**: Risk distribution and flagged cases with evidence

### 6. PII/License Compliance

- **Rationale**: Privacy and legal compliance are non-negotiable
- **Implementation**: Pattern matching for PII, keyword scanning for license terms
- **Threshold**: Any PII violations or >2 license risks trigger alerts
- **Output**: Violation counts and masked examples

## Implementation Architecture

### Core Principles

- **Feature Flags**: All metrics can be disabled via `FEATURE_*` flags
- **Budget Controls**: LLM-based analysis respects cost limits
- **Atomic Reports**: Generate both JSONL (data) and Markdown (human-readable) outputs
- **Schema Validation**: All outputs validated against JSON schemas
- **Reproducibility**: ±5% tolerance for key metrics across runs

### Integration Points

- **CLI Integration**: `./run_v3.sh baseline --smoke|--full --budget <USD>`
- **Session Reports**: Baseline summaries automatically added to session reports
- **Regression Testing**: Comprehensive test suite with performance benchmarks
- **Documentation**: Full operational procedures in OPERATIONS.md

### File Structure

```
baseline_config.json              # Single source configuration
scripts/metrics/
  duplication_metrics.ts          # N-gram similarity analysis
  qtype_distribution.ts           # Question classification
  coverage_metrics.ts             # Entity/section coverage
  evidence_quality.ts             # Answer-evidence alignment
  hallucination_rules.ts          # Unsupported claim detection
  pii_license_scan.ts             # Compliance scanning
  baseline_report_generator.ts    # Report orchestration
  __all__.ts                      # Metrics coordination
schema/
  baseline_report.schema.json     # JSONL record validation
  session_report.schema.json      # Updated session schema
reports/
  baseline_report.jsonl           # Raw metrics data
  baseline_report.md              # Human-readable report
```

## Consequences

### Positive

- **Stakeholder Visibility**: Non-technical stakeholders can understand quality status
- **Proactive Quality Control**: Issues caught before they reach users
- **Operational Confidence**: Clear go/no-go criteria for releases
- **Cost Transparency**: Budget tracking and cost-per-item analysis
- **Reproducible Results**: Consistent metrics support reliable decision-making

### Negative

- **Added Complexity**: More moving parts in the quality assessment pipeline
- **Execution Time**: Full baseline analysis takes 30-60 seconds for large datasets
- **Cost Overhead**: LLM-based similarity analysis adds to operational costs
- **Configuration Maintenance**: Thresholds and patterns require periodic tuning

### Mitigation Strategies

- **Smoke Mode**: Quick quality checks for daily monitoring
- **Budget Caps**: Configurable limits prevent runaway costs
- **Feature Flags**: Ability to disable expensive operations
- **Clear Documentation**: Comprehensive operational procedures and troubleshooting

## Alternatives Considered

### 1. Statistical-Only Approach

- **Rejected**: Lacked semantic understanding and actionable insights
- **Reason**: Pure statistics don't correlate well with human-perceived quality

### 2. Full LLM-Based Analysis

- **Rejected**: Too expensive and slow for routine operations
- **Reason**: Cost would be prohibitive for regular quality monitoring

### 3. External Quality Service

- **Rejected**: Added external dependencies and potential vendor lock-in
- **Reason**: Need for customization and control over quality criteria

## Monitoring and Evolution

### Success Metrics

- **Adoption Rate**: Teams using baseline metrics before major releases
- **Issue Detection**: Quality problems caught before user reports
- **Decision Speed**: Time from metrics to go/no-go decision
- **Cost Efficiency**: Quality improvement per dollar spent

### Review Schedule

- **Monthly**: Threshold tuning based on production data
- **Quarterly**: Metric effectiveness review and potential additions
- **Annually**: Full architecture review and modernization

### Planned Enhancements

- **Advanced Entity Recognition**: Move beyond simple n-gram extraction
- **Multi-language Support**: Expand beyond Korean/English patterns
- **ML-Based Classification**: Supplement rule-based question typing
- **Trend Analysis**: Historical quality tracking and degradation alerts

## Preflight Gate System

### Overview

To ensure quality and reliability before full production runs, we have implemented a comprehensive preflight validation system that verifies both baseline metrics compliance and operational readiness.

### Required Elements (7)

All production runs must satisfy these critical requirements:

1. **CASES_TOTAL > 0**: Actual test cases executed (not just configuration validation)
2. **Field Consistency**: All execution metadata (RESULT, RUN_STATE, DRY_RUN, MODEL_ID) must reflect actual run parameters
3. **DLQ/Retry Policy**: Evidence of dead letter queue handling and retry mechanisms for 429/5xx/timeout scenarios
4. **Budget Guard**: Cost limits and killswitch mechanisms properly configured and logged
5. **Data Manifest**: Fixed data checksums or manifest files ensuring reproducible inputs
6. **Seed Fixation**: Randomness/sampling seeds properly configured for reproducible results
7. **Standard Fields**: Presence of core logging fields (RUN_ID, ITEM_ID, AGENT_ROLE, COST, LAT_MS, RETRIES)

### 3-Layer Orchestration

Advanced system validation covering:

**A) Contract Layer**: Envelope field validation and state transition logging (QUEUED→RUNNING→RETRYING→DLQ|DONE)
**B) Checkpoint Layer**: Mid-execution restart capabilities and progress persistence
**C) Policy Layer**: Per-agent cost/time caps with enforcement logging

### Gate Mapping Policy

Quality assessment follows a strict priority hierarchy:

    P0 violations → FAIL (immediate halt, cannot proceed)
    Many P1 violations → WARN/PARTIAL (review recommended, proceed with caution)
    P2-only small issues → PASS (monitor but can proceed)

**P0 Fixed Criteria**: PII violations, license violations, evidence missing (high), hallucination (high-risk cases)
**P1 Adaptive**: Cost/item thresholds, latency P95, duplication rates (auto-calibrated from recent runs)
**P2 Monitoring**: Minor duplication, coverage gaps, question type imbalances

### Preflight Tools

**Validation Script**: `scripts/preflight/validate_report.sh` - Automated validation of all 7 required elements + 3-layer orchestration - Generates both human-readable (reports/preflight_check.md) and structured (preflight_check.json) outputs - Exit codes: 0 (pass), 1 (fail) for CI/CD integration

**Smoke Rehearsal**: `scripts/preflight/smoke_rehearsal.sh` - End-to-end validation via baseline --smoke execution - Parameter consistency verification (DRY_RUN, MODEL_ID, BUDGET) - Automatic preflight validation execution and reporting

**Integration**: Optional run_v3.sh alias 'preflight_smoke' for one-command rehearsal

### Operational Workflow

1. **Before Full Run**: Execute `bash scripts/preflight/smoke_rehearsal.sh`
2. **Validation**: Review generated `reports/preflight_check.md` for any FAIL items
3. **Resolution**: Address any P0 violations before proceeding
4. **Full Run**: Only proceed if overall preflight status is PASS or WARN

## References

- [Original Requirements](../CLAUDE.md) - System architecture and quality principles
- [Baseline Config](../baseline_config.json) - Detailed threshold definitions
- [Test Suite](../tests/regression/baseline_v15_tests.ts) - Comprehensive validation
- [Operations Guide](OPERATIONS.md) - Daily operational procedures
- [Preflight Scripts](../scripts/preflight/) - Validation and rehearsal tools

---

**Decision Record Status**: This ADR represents the current implementation as of 2025-09-17. Any significant changes to the baseline metrics system should be documented in a new ADR with appropriate cross-references.
