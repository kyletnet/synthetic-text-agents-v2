# DxLoop v1 — Pre-Full-Run Quality & Stability Guard

## Overview

DxLoop (Diagnostic Loop) v1 is an automated quality and stability guard system that runs comprehensive checks before full production runs. It analyzes metrics, detects anomalies, calibrates thresholds, and provides actionable recommendations to ensure system health.

## Purpose

- **Quality Assurance**: Prevent poor-quality runs by detecting issues early
- **Cost Control**: Avoid expensive failures through proactive monitoring
- **Stability**: Ensure system reliability before scaling operations
- **Automation**: Reduce manual oversight through intelligent threshold management

## Architecture

### Core Components

    scripts/dx/
    ├── cli.ts                 # Main CLI orchestrator
    ├── types.ts              # TypeScript interfaces
    ├── collect_session.ts    # Session data collection
    ├── check_consistency.ts  # Report consistency validation
    ├── load_thresholds.ts    # Configuration management
    ├── autocalibrate.ts      # Threshold auto-calibration
    ├── analyze_metrics.ts    # v1.5 metrics analysis
    ├── detect_anomalies.ts   # Statistical anomaly detection
    ├── recommend_actions.ts  # Action recommendation engine
    ├── gating.ts            # P0/P1/P2 gating logic
    └── persist_reports.ts    # Report generation & persistence

### Execution Flow

    1. Smoke Test        → Basic environment validation
    2. Data Collection   → Scan session/baseline/LLM reports
    3. Consistency Check → Verify report alignment
    4. Threshold Loading → Load profile-specific configs
    5. Auto-Calibration → Adjust P1/P2 thresholds (optional)
    6. Metrics Analysis  → Calculate v1.5 quality indicators
    7. Anomaly Detection → Statistical outlier identification
    8. Recommendations   → Generate actionable advice
    9. Gating Decision   → PASS/WARN/PARTIAL/FAIL determination
    10. Report Persistence → Generate JSONL + Markdown reports

## Threshold System

### P0 Thresholds (Critical - Fixed)

- **PII Hits**: Must be 0
- **License Violations**: Max 2
- **Evidence Missing Rate**: Max 20%
- **Hallucination Rate**: Max 5%

**Violation = FAIL (blocks run)**

### P1 Thresholds (Performance - Auto-calibratable)

- **Cost per Item**: Warn/Fail levels
- **P95 Latency**: Performance targets
- **Failure Rate**: Reliability thresholds

**Multiple violations = PARTIAL (proceed with caution)**

### P2 Thresholds (Quality - Auto-calibratable)

- **Duplication Rate**: Content redundancy
- **Coverage Rate**: Comprehensiveness
- **Quality Score**: Overall assessment

**High violations = WARN (monitor closely)**

## Auto-Calibration

### Process

    1. Load last N runs from reports/history/
    2. Calculate percentile-based thresholds
    3. Apply drift guard (max ±20% change)
    4. Generate proposed changes
    5. Apply if approved (--approve flag)

### Configuration

    baseline_config.json → dxloop.autocalibration:
    - enabled: true/false
    - lookback_runs: 10
    - percentile_warn: 75
    - percentile_fail: 90
    - drift_guard_max_delta: 0.20

## Usage

### Command Line Interface

    # Basic smoke test
    npx tsx scripts/dx/cli.ts run --profile dev --budget 0.50

    # Full diagnostic with auto-calibration
    npx tsx scripts/dx/cli.ts run --profile stage --budget 2.00 --autocalib --approve

    # View last report
    npx tsx scripts/dx/cli.ts report

### NPM Scripts

    npm run dx:smoke      # Quick smoke test (dev profile)
    npm run dx:full       # Full diagnostic (stage profile)
    npm run dx:approve    # Auto-calibration with approval
    npm run dx:report     # Display last report summary

### run_v3.sh Integration

    ./run_v3.sh dxloop_smoke --profile dev --budget 0.50
    ./run_v3.sh dxloop_full --profile stage --budget 2.00 --autocalib --approve

## Profiles

### Development (dev)

- **Budget**: $1.00 max
- **Timeout**: 30s
- **Agent Limits**: Answer $0.05, Audit 6s
- **Use Case**: Local development, feature testing

### Staging (stage)

- **Budget**: $2.00 max
- **Timeout**: 45s
- **Agent Limits**: Answer $0.10, Audit 10s
- **Use Case**: Pre-production validation, integration testing

### Production (prod)

- **Budget**: $5.00 max
- **Timeout**: 60s
- **Agent Limits**: Answer $0.20, Audit 15s
- **Use Case**: Live system monitoring, release validation

## Output Files

### Generated Reports

    reports/
    ├── dxloop_report.jsonl    # Machine-readable diagnostic data
    ├── dxloop_report.md       # Human-readable dashboard
    └── history/               # Timestamped backups
        └── YYYYMMDD_HHMMSS/
            ├── dxloop_report.jsonl
            └── dxloop_report.md

### Report Sections

1. **Executive Summary** - Status, top issues, recommendations
2. **Gating Decision** - PASS/WARN/PARTIAL/FAIL with reasoning
3. **Consistency Check** - Report alignment validation
4. **Metrics Summary** - Quality, performance, security indicators
5. **Anomaly Detection** - Statistical outliers and spikes
6. **Threshold Calibration** - Proposed configuration changes
7. **Action Recommendations** - Prioritized improvement suggestions
8. **DLQ Status** - Failed run analysis and retry candidates

## Gating Logic

### Decision Matrix

    Status    | P0 Violations | P1 Warnings | P2 Issues | Action
    ----------|---------------|--------------|-----------|------------------
    FAIL      | Any           | -            | -         | Block run
    PARTIAL   | None          | 3+ or 1+FAIL | -         | Proceed cautiously
    WARN      | None          | <3           | 2+        | Monitor closely
    PASS      | None          | <3           | <2        | Proceed normally

### Exit Codes

    0: PASS/WARN - Safe to proceed
    1: FAIL - Critical issues, block run
    2: PARTIAL - Warnings, proceed with caution

## Anomaly Detection

### Methods

- **Z-Score**: Statistical outliers (>2σ = medium, >3σ = high)
- **IQR**: Robust outliers using quartile ranges
- **Trend Analysis**: Recent vs historical comparisons
- **Spike Detection**: Sudden increases in cost/latency/failures

### Historical Data

- Sources: `reports/history/*/session_report.md`
- Lookback: 7 days default
- Minimum: 3 runs for statistical significance

## Action Recommendations

### Categories

- **Data**: Input quality, coverage, diversity
- **Prompt**: LLM instruction optimization
- **Cache**: Caching strategy improvements
- **Retriever**: Search and retrieval tuning
- **Agent**: Multi-agent workflow optimization
- **System**: Infrastructure and performance

### Severity Levels

- **Critical**: Immediate action required
- **High**: Address before next run
- **Medium**: Important but not blocking
- **Low**: Nice-to-have improvements

### Effort Estimates

- **Low**: < 1 day implementation
- **Medium**: 1-3 days implementation
- **High**: > 3 days implementation

## Integration Points

### With Baseline Metrics

- Reads: `reports/baseline_report.jsonl`
- Analyzes: v1.5 quality indicators
- Maps: Existing thresholds to P0/P1/P2 levels

### With Session Reports

- Reads: `reports/session_report.md`
- Extracts: Cost, latency, case counts
- Validates: Consistency with actual execution

### With LLM Analysis

- Reads: `reports/LLM_ANALYSIS_*.json`
- Uses: Panel scores, confidence metrics
- Cross-validates: Against session data

## Configuration Management

### Profile Selection

    baseline_config.json → dxloop.profiles:
    - dev: Development settings
    - stage: Pre-production settings
    - prod: Production settings

### Threshold Overrides

    # Manual threshold adjustment
    baseline_config.json → dxloop.thresholds.p1.cost_per_item_warn: 0.08

### Feature Flags

    # Enable/disable auto-calibration
    baseline_config.json → dxloop.autocalibration.enabled: true

## Development Safety

### Feature Flag First

All new DxLoop features use environment-based flags:

    FEATURE_DXLOOP_ENABLED=true    # Master toggle
    FEATURE_AUTOCALIB_ENABLED=true # Auto-calibration toggle

### Backward Compatibility

- DxLoop is additive - doesn't break existing flows
- Graceful degradation when components unavailable
- Fall-back to manual thresholds if auto-calibration fails

### Testing Strategy

    # Unit tests for individual modules
    npm test scripts/dx/

    # Integration tests with mock data
    npx tsx scripts/dx/cli.ts run --skip-smoke

    # End-to-end validation
    ./run_v3.sh dxloop_smoke --profile dev --budget 0.10

## Troubleshooting

### Common Issues

**"No session report found"**
Solution: Run a baseline execution first
Command: ./run_v3.sh baseline --smoke --budget 0.50

**"Schema validation failed"**
Solution: Check report format compatibility
Command: npm run schema

**"Auto-calibration disabled"**
Solution: Enable in configuration
Edit: baseline_config.json → dxloop.autocalibration.enabled: true

**"Budget exceeded profile limits"**
Solution: Adjust budget or profile
Command: --profile stage --budget 2.00

### Debug Mode

    # Enable verbose logging
    DEBUG=dx:* npx tsx scripts/dx/cli.ts run

    # Check individual modules
    npx tsx scripts/dx/collect_session.ts collect
    npx tsx scripts/dx/check_consistency.ts check

### Manual Report Review

    # Generated markdown report
    open reports/dxloop_report.md

    # Raw data inspection
    cat reports/dxloop_report.jsonl | jq '.'

## Future Enhancements

### v1.1 Planned Features

- Real-time monitoring dashboard
- Slack/email alerting integration
- Custom threshold policies per target
- Multi-environment comparison views
- Automated remediation workflows

### v2.0 Vision

- Machine learning-based anomaly detection
- Predictive failure analysis
- Auto-scaling recommendations
- Cross-system correlation analysis
- Continuous optimization loops

---

**Implementation Status**: ✅ Complete
**Schema Version**: 1.0.0
**Last Updated**: 2025-09-18
**Maintainer**: DxLoop Development Team
