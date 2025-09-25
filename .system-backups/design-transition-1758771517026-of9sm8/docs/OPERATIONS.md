# Operations Guide

**Meta-Adaptive Expert Orchestration System - P0 Pre-P1 Operations**

> **Version:** Pre-P1 Final Patch | **Last Updated:** 2025-09-17 | **Status:** Production Ready

## Quick Start (Two-Button Execution)

### 🧪 Smoke Test (Dry Run)

```bash
# Basic smoke test (offline, no costs)
./run_v3.sh <target> --smoke --offline

# Examples
./run_v3.sh step4_2 --smoke --offline
./run_v3.sh build --smoke
```

### 🚀 Production Run

```bash
# Production execution (requires budget)
./run_v3.sh <target> --full --budget <USD> --profile prod

# Examples
./run_v3.sh step4_2 --full --budget 5.00 --profile prod
./run_v3.sh handoff --full --budget 1.50
```

### 📊 Baseline v1.5 Metrics Analysis

```bash
# Smoke test baseline metrics (small dataset)
./run_v3.sh baseline --smoke --budget 0.50

# Full baseline metrics analysis (larger dataset)
./run_v3.sh baseline --full --budget 5.00

# With custom data source
./run_v3.sh baseline --full --budget 2.00 --data outputs/custom_qa.jsonl

# With export to CSV/JSON formats
./run_v3.sh baseline --full --budget 2.00 --export csv,json

# With handoff package generation
./run_v3.sh baseline --full --budget 2.00 --handoff

# Complete workflow with all outputs
./run_v3.sh baseline --full --budget 5.00 --export csv,json --handoff
```

## Baseline Report Enhancements

### Enhanced Features (v1.5)

The baseline reporting system now includes several enhanced features for operational clarity:

**Threshold Summary Table**

- Current vs previous threshold comparison with delta calculations
- Visual status badges (PASS=✅, WARN=⚠️, FAIL=❌) for quick assessment
- P0 thresholds marked as "FIXED" (cannot be auto-calibrated)
- P1/P2 thresholds show auto-calibration source when applicable

**KPI Trend Analysis**

- Mini-sparklines for last 10 runs showing trends for key metrics:
  - Accuracy score (mean_score)
  - Cost per item (cost_per_item)
  - P95 latency (latency_p95_ms)
- Min/median/max values displayed alongside trends
- Graceful degradation when insufficient historical data

**Cross-linking & Navigation**

- Direct links between baseline_report.md ↔ session_report.md
- RUN_ID anchors for precise navigation
- Related reports section for operational reviews

**DLQ (Dead Letter Queue) Visibility**

- Current DLQ count prominently displayed
- Recent failed run IDs listed (up to 5)
- One-click reprocess command hint: `npm run dev -- --reprocess-dlq`
- Green status indicator when no DLQ items present

**BI Export Integration**

- Automatic CSV/JSON export to `reports/export/baseline_latest.{csv,json}`
- Flat record structure optimized for business intelligence tools
- Schema validation against `schema/baseline_export.schema.json`
- Excel-compatible CSV formatting with proper quoting

**Gate Mapping Policy Banner**

- Clear policy display: "P0→FAIL, many P1→WARN/PARTIAL, P2-only small→PASS"
- Current profile (dev/stage/prod) and auto-calibration status
- Threshold source-of-truth indication (profile overrides vs defaults)

### Running Enhanced Reports

    # Generate baseline report with all enhancements
    npm run report:baseline

    # Generate and validate BI export files
    npm run report:export

    # Or use the baseline report generator directly
    node dist/scripts/metrics/baseline_report_generator.js --render-md --export --validate

### Report Output Locations

- **Main Report**: `reports/baseline_report.md` (enhanced with new sections)
- **Data**: `reports/baseline_report.jsonl` (individual item records)
- **BI Exports**: `reports/export/baseline_latest.{csv,json}`
- **Schema**: `schema/baseline_export.schema.json` (validation)
- **Historical**: `reports/history/{timestamp}/` (trend data source)
- **DLQ**: `reports/dlq/index.jsonl` (failed runs tracking)

### Interpreting Enhanced Elements

**Sparklines**: Trend direction using ASCII: ▁▂▃▄▅▆▇ (low to high)
**Status Badges**: ✅ Pass, ⚠️ Warn, 🟡 Partial, ❌ Fail
**Delta Indicators**: 📈 Increase, 📉 Decrease, ➡️ No change
**Gate Policy**: Explains when runs can proceed vs require review

## Session Reports

**Location:** `reports/session_report.md`
**Archive:** `reports/history/YYYYMMDD_HHMMSS/session_report.md`

### Pipeline Execution Order (Fixed)

The baseline pipeline follows a **mandatory 9-step execution order** for consistency:

1. **Toolchain Verification** - nvm bootstrap + version validation
2. **Data Loading/Case Confirmation** - validate data source and count cases
3. **API Calls** - actual API calls or mocked calls in offline mode
4. **Schema Validation** - validate I/O schemas
5. **v1.5 Metrics Calculation** - run baseline metrics analysis
6. **Report Generation** - create baseline_report.{jsonl,md}
7. **Session Report (Atomic Write)** - single atomic write with tmp→rename
8. **Export Hooks (Non-blocking)** - CSV/JSON exports if requested
9. **Handoff Hooks (Non-blocking)** - handoff package if requested

### Session Report Features

**Atomic Writing:** All session reports use tmp→rename pattern to prevent corruption
**DLQ Integration:** Failed runs automatically added to Dead Letter Queue with full metadata
**Standardized Exit Codes (AC-4):**

- `0`: Normal completion
- `2`: Toolchain/environment failures (nvm_bootstrap, version validation)
- `3`: Schema validation failures (tools/validate_schema.mjs)
- `4`: Runtime/API/network failures (API calls, budget exceeded)
- `5`: Signal interruption or unexpected termination (SIGTERM, SIGINT)

**Additional Session Report Fields (AC-2):**

- `DLQ_COUNT`: Total number of failed runs in DLQ
- `LAST_DLQ_RUN_ID`: Most recent failed run identifier
- `RUN_STATE`: Pipeline execution state (QUEUED→RUNNING→SUCCESS/FAIL)
- `CASES_TOTAL`: Must be >0 even in smoke mode (enforced by AC-2)

### Sharing Session Reports

1. **For Reviews:** Copy the Summary Block from session_report.md
2. **For Incidents:** Include full report + logs path
3. **For Stakeholders:** Share RESULT, DURATION_MS, COST_USD only

### Required Checks After Each Run

- [ ] `RESULT: PASS` (not FAIL)
- [ ] `WARNINGS: 0` (or review warnings)
- [ ] `COST_USD` within budget expectations
- [ ] `ERROR_CLASS` empty (if present)
- [ ] `CASES_TOTAL > 0` (even in smoke mode)
- [ ] `DLQ_COUNT` not increasing unexpectedly

## 🚨 Incident Response Procedures

### 1. Secret Exposure (CRITICAL - 5 min response time)

**IMMEDIATE ACTIONS** (complete within 5 minutes):

1. **HALT ALL OPERATIONS** - Stop all builds, commits, pushes immediately
2. **Run security scan**: `npm run guard:git` to identify all exposed secrets
3. **Quarantine files**: `npm run hygiene:clean` to secure backup files
4. **Identify scope**: Check git history, logs, exports for secret presence
5. **Rotate credentials**: Immediately revoke and re-issue ALL exposed API keys
6. **Secure communication**: Use encrypted channels for coordination

**Post-Incident (within 30 minutes):**

- Document: Record what was exposed, when discovered, impact scope
- Audit: Review all systems that used the compromised credentials
- Notify: Alert security team and relevant stakeholders
- Monitor: Watch for unauthorized usage of compromised credentials

### 2. Budget Exceeded (HIGH - 15 min response time)

**IMMEDIATE ACTIONS:**

1. **STOP API CALLS**: Kill all running processes with `killall run_v3.sh`
2. **Check current spend**: Review session reports in `reports/history/`
3. **Assess impact**: Sum COST_USD from recent session reports
4. **Verify safeguards**: Ensure cost caps were functioning properly
5. **Rollback if needed**: Revert to last known good state if system compromised

**Budget Exceed Rollback Procedure:**

```bash
# Stop all processes
killall run_v3.sh node tsx || true

# Check recent costs
find reports/history -name "session_report.md" -mtime -1 -exec grep "COST_USD:" {} \;

# Emergency budget check
npm run guard:prod --check-only

# Check DLQ for budget-related failures
node scripts/lib/dlq.ts --stats | jq '.topFailReasons[] | select(.reason | contains("budget"))'

# If safeguards failed, investigate
grep -r "BUDGET_EXCEEDED" RUN_LOGS/ | tail -10
```

### 3. System Compromise (CRITICAL - immediate response)

**IMMEDIATE ACTIONS:**

1. **ISOLATE SYSTEM**: Disconnect from network if possible
2. **SECURE CREDENTIALS**: Rotate all API keys immediately
3. **AUDIT RECENT ACTIVITY**: Check session reports, git commits, file changes
4. **PRESERVE EVIDENCE**: Backup logs, session reports, git state
5. **RESTORE FROM BACKUP**: Use last known clean state

**System Recovery Checklist:**

- [ ] All API keys rotated and verified
- [ ] Git repository state verified clean
- [ ] Recent changes audited and approved
- [ ] CI/CD pipeline security verified
- [ ] Team access credentials reviewed

### 4. Key Rotation Procedures

**Scheduled Key Rotation (Monthly):**

1. **Generate new keys**: Create new API keys from provider console
2. **Test new keys**: Verify with `./run_v3.sh quick_api_check --smoke`
3. **Update configuration**:

   ```bash
   # Update .env.local (never .env)
   echo "ANTHROPIC_API_KEY=sk-ant-api03-new-key-here" > .env.local

   # Or for multi-key setup
   echo "ANTHROPIC_API_KEYS=key1,key2,key3" > .env.local
   ```

4. **Verify functionality**: Run full smoke test
5. **Deactivate old keys**: Wait 24h, then revoke old keys
6. **Document rotation**: Log date, reason, who performed

**Emergency Key Rotation:**

1. **IMMEDIATE**: Revoke compromised keys at provider console
2. **IMMEDIATE**: Generate replacement keys
3. **IMMEDIATE**: Update `.env.local` with new keys
4. **IMMEDIATE**: Test with smoke mode: `./run_v3.sh step4_2 --smoke --offline`
5. **WITHIN 1 HOUR**: Audit all systems using the old keys
6. **WITHIN 24 HOURS**: Complete incident documentation

### 5. CI/CD Pipeline Failures

**Pipeline Gate Failures:**

1. **guard:env failure**: Check environment loading and secret patterns

   ```bash
   npm run guard:env
   npm run guard:git
   ```

2. **schema validation failure**: Fix data format issues

   ```bash
   npm run schema --verbose
   ```

3. **regression failure**: Check baseline drift
   ```bash
   npm run regression:mini
   cat reports/regression_summary.md
   ```

**Recovery Actions:**

- Fix issues identified by specific gate failures
- Re-run individual gates: `npm run guard:all`
- For urgent fixes: Use feature flags to bypass temporarily
- For baseline drift: Consider `npm run regression:freeze` if changes are valid

## Connection Errors Playbook

### "TypeError (fetch failed)" Diagnosis & Resolution

**Immediate Steps:**

1. **Check connectivity**: Network diagnostics run automatically during preflight
2. **Review diagnostic report**: Check `reports/net_diag_last.md` for detailed analysis
3. **Apply hotfixes**: IPv4 preference and proxy bypass are automatic in run_v3.sh

**Root Cause Analysis:**

- **IPv6/IPv4 dual-stack issues**: Node.js may prefer IPv6 connections that fail
- **Corporate proxy interference**: HTTP(S)\_PROXY variables can block API calls
- **DNS resolution delays**: Slow DNS lookups cause connection timeouts
- **SSL/TLS handshake failures**: Network or proxy configuration issues

**Automatic Remediation (in run_v3.sh):**

- `NODE_OPTIONS="--dns-result-order=ipv4first"` forces IPv4 preference
- `unset HTTPS_PROXY HTTP_PROXY NO_PROXY` during execution context only
- Preflight connectivity check with detailed diagnostics
- Conservative timeouts (connect: 5s, total: 30s)

**Manual Troubleshooting:**

```bash
# Run preflight check only
./run_v3.sh guards

# View detailed network diagnostics
cat reports/net_diag_last.md

# Test specific connectivity
curl -sS -I --max-time 10 https://api.anthropic.com

# Check Node.js IPv4 preference
node -e "console.log(process.env.NODE_OPTIONS)"

# Test with proxy bypass
env -u HTTPS_PROXY -u HTTP_PROXY curl -sS -I https://api.anthropic.com
```

**If Issues Persist:**

1. **Network Configuration**: Check WiFi, VPN, or firewall settings
2. **DNS Issues**: Try alternative DNS servers (8.8.8.8, 1.1.1.1)
3. **Corporate Network**: Contact IT for API endpoint allowlist
4. **API Key Issues**: Verify ANTHROPIC_API_KEY is valid and not expired

**Emergency Bypass (Offline Mode):**

```bash
# Run in offline mode with mock responses
./run_v3.sh step4_2 --smoke --offline
```

## Troubleshooting

### 401 Authentication Error

**Cause:** Invalid or missing API key
**Fix:**

1. Check: `ls -la .env .env.local`
2. Verify: `ANTHROPIC_API_KEY` or `ANTHROPIC_API_KEYS` set
3. Test: `./run_v3.sh quick_api_check --smoke`
4. If broken: Update key via secure channel

### 429 Rate Limit

**Cause:** Too many requests per minute
**Fix:**

1. Wait 60 seconds, retry with `--smoke` first
2. Check for concurrent runs: `ps aux | grep run_v3`
3. Reduce load: Use smaller `--budget` amounts

### 529 Server Overload

**Cause:** Anthropic API unavailable
**Fix:**

1. Retry after 5-10 minutes
2. Use `--offline` mode for testing
3. Check status: https://status.anthropic.com

### Budget Exceeded (guard:prod)

**Cause:** Budget validation failed
**Fix:**

1. Check: `./run_v3.sh __validate_prod_guard --check-only`
2. Increase: `--budget <higher_amount>`
3. For production: Minimum budget 0.10 USD required

## CI Gates Status

**Check All Gates:** `npm run guard:all`

### Required Gates

- ✅ `guard:env` - Environment loading coverage
- ✅ `guard:no-direct-http` - Single API client enforcement
- ✅ `guard:prod` - Production profile validation
- ✅ `guard:git` - Secret scanning and git hygiene
- ✅ `schema` - I/O schema validation
- ✅ `regression:mini` - Regression test mini-set

### Gate Failure Actions

1. **guard:env fail:** Run `npm run guard:env` for details
2. **guard:no-direct-http fail:** Check `npm run guard:no-direct-http`
3. **schema fail:** Run `npm run schema` for validation errors
4. **regression fail:** Check `reports/regression_summary.md`

## Single API Client Architecture

### Mandatory API Client Rule

**All LLM calls must go through `tools/anthropic_client.sh`**. Direct API calls (fetch, axios, curl to api.anthropic.com) are prohibited.

**Benefits:**

- **Unified cost tracking** - All API costs flow through one client with budget enforcement
- **Consistent retry logic** - Standardized backoff, timeout, and error handling
- **Secret masking** - API keys automatically masked in logs and telemetry
- **Rate limiting** - Built-in rate limiting and concurrency controls
- **Governance** - Single point of control for API policy enforcement

### Adapter Implementation

For TypeScript/Node.js code, use the provided adapter:

```typescript
import { callAnthropic } from "../scripts/clients/anthropic_adapter";

// Replace direct API calls with adapter
const result = await callAnthropic(
  {
    model: "claude-3-5-sonnet-latest",
    max_tokens: 1000,
    system: "You are a helpful assistant",
    messages: [{ role: "user", content: "Hello" }],
  },
  {
    budgetCents: 500, // 5 USD budget cap
    timeoutMs: 30000,
    runId: "my-run-123",
    agentRole: "qa-generator",
  },
);
```

### Shell Script Integration

For shell scripts, call the client directly:

```bash
# Prepare API payload
payload='{
  "model": "claude-3-5-sonnet-latest",
  "max_tokens": 1000,
  "messages": [{"role": "user", "content": "Hello"}]
}'

# Call unified client
result=$(echo "$payload" | bash tools/anthropic_client.sh --chat)
```

### Adding New API Clients

When adding support for new LLM providers:

1. **Create wrapper script** - Follow `tools/anthropic_client.sh` pattern
2. **Add to allowlist** - Update `scripts/forbidden-direct-http.sh` allowlist
3. **Create adapter** - TypeScript adapter in `scripts/clients/`
4. **Update guard** - Ensure `guard:no-direct-http` detects direct calls
5. **Document usage** - Add examples to this operations guide

### Enforcement

The `guard:no-direct-http` gate automatically scans for violations:

- **Allowed:** Client scripts in `tools/`, adapters in `scripts/clients/`
- **Forbidden:** Direct fetch/curl to api.anthropic.com in other locations
- **Exceptions:** Network diagnostics, documentation examples
- **Run manually:** `npm run guard:no-direct-http`

## Session Report Access

### Standalone Session Report Command

Access session reports without full pipeline bootstrap:

```bash
# Get latest session summary (grep-friendly)
./run_v3.sh session-report

# Extract specific fields
./run_v3.sh session-report | grep "CASES_TOTAL:"

# Get full session report
./run_v3.sh session-report --format full

# Get specific run report
./run_v3.sh session-report --run-id <run_id>
```

### Session Report Fields

Standard fields always available for grep:

- `SESSION_ID`, `RUN_ID`, `TARGET`, `PROFILE`, `MODE`
- `DRY_RUN`, `OFFLINE_MODE`, `BUDGET_USD`, `COST_USD`
- `CASES_TOTAL`, `CASES_PASSED`, `PASS_RATE`, `MEAN_SCORE`
- `DURATION_MS`, `TIMESTAMP`, `STATUS`

### Integration Examples

```bash
# Check if last run passed
if ./run_v3.sh session-report | grep -q "STATUS: SUCCESS"; then
  echo "Last run successful"
fi

# Get case count for reporting
cases=$(./run_v3.sh session-report | grep "CASES_TOTAL:" | awk '{print $2}')
echo "Processed $cases cases"

# Extract cost information
cost=$(./run_v3.sh session-report | grep "COST_USD:" | awk '{print $2}')
echo "Run cost: \$$cost"
```

## Baseline Pipeline Hardening

### Fixed Execution Order

The baseline pipeline now enforces a **mandatory 9-step execution order** to ensure reproducibility:

```bash
# Every baseline run follows this exact sequence:
# 1. Toolchain verification (nvm_bootstrap)
# 2. Data loading/case confirmation
# 3. API calls (real or mocked)
# 4. Schema validation
# 5. v1.5 metrics calculation
# 6. Report generation (JSONL + MD)
# 7. Session report final write (atomic)
# 8. Export hooks (non-blocking)
# 9. Handoff hooks (non-blocking)
```

### DLQ (Dead Letter Queue) System (AC-3)

**Location:** `reports/dlq/`
**Index:** `reports/dlq/index.jsonl`
**Individual Runs:** `reports/dlq/<run_id>/`

**DLQ Operations:**

```bash
# View DLQ statistics
node scripts/lib/dlq.ts --stats

# Add failed run to DLQ (automatic)
# This happens automatically when runs fail

# Clean up old DLQ entries (keep last 30 days)
node scripts/lib/dlq.ts --cleanup 30

# Manual DLQ entry (for testing)
node scripts/lib/dlq.ts --to-dlq test_run_123 "manual_test" 4 --target baseline --mode smoke
```

**DLQ Entry Structure (AC-3):**

- `run_id`: Unique identifier for the failed run
- `timestamp`: ISO 8601 timestamp when failure occurred
- `target`: What was being executed (baseline, step4_2, etc.)
- `mode`: Execution mode (smoke or full)
- `reason`: Primary failure reason (schema_validation_failed, etc.)
- `exit_code`: Standardized exit code (2/3/4/5)
- `top_fail_reasons`: Array of detected failure patterns
- `budget_usd`: Budget that was set for the run
- `cost_usd`: Actual cost incurred before failure
- `session_id`: Session identifier for correlation

**DLQ Directory Structure:**

```
reports/dlq/
├── index.jsonl                    # Master index of all DLQ entries
├── run_20250917_162825_70936/     # Individual run artifacts
│   ├── dlq_metadata.json          # DLQ entry metadata
│   ├── session_report.md          # Partial session report
│   ├── baseline_report.jsonl      # Partial outputs (if any)
│   └── tmp/                       # Temporary files from failed run
└── run_20250917_163045_71203/     # Another failed run
    └── ...
```

### Export and Handoff Hooks (AC-5)

**Export Formats:**

```bash
# Generate CSV export
./run_v3.sh baseline --full --budget 2.00 --export csv

# Generate JSON export
./run_v3.sh baseline --full --budget 2.00 --export json

# Generate both formats
./run_v3.sh baseline --full --budget 2.00 --export csv,json

# Export with default formats (csv,json)
./run_v3.sh baseline --full --budget 2.00 --export
```

**Handoff Package:**

```bash
# Generate handoff package
./run_v3.sh baseline --full --budget 2.00 --handoff

# Creates: reports/handoff/INDEX.md with links to all artifacts
```

**Export CLI (scripts/export_cli.ts):**

```bash
# Manual export from existing baseline report
npx ts-node scripts/export_cli.ts --in reports/baseline_report.jsonl --out reports/export/baseline.csv --format csv
npx ts-node scripts/export_cli.ts --in reports/baseline_report.jsonl --out reports/export/baseline.json --format json
```

**Non-blocking Design (AC-5):** Export and handoff failures do not affect the main pipeline result. Failures are logged as warnings and increment the WARNINGS count in session reports, but the main RESULT remains unchanged.

### Error Handling and Exit Codes

**Standardized Exit Codes:**

- `0`: Success
- `2`: Toolchain/environment failures (nvm, versions)
- `3`: Schema validation failures
- `4`: Runtime failures (API, network, budget exceeded)
- `5`: Signal interruption or unexpected termination

**Trap Handling:** The system installs comprehensive error traps that:

- Capture failed commands with line numbers
- Write partial session reports before exit
- Add failed runs to DLQ automatically
- Clean up temporary files
- Map errors to standardized exit codes

### Atomic Operations

**Session Report Writing:**

- All session reports written atomically using tmp→rename pattern
- Prevents corruption from interrupted writes
- Single final write per execution (no duplicates)
- Includes DLQ count and last DLQ run ID

**Case Total Enforcement:**

- `CASES_TOTAL=0` triggers automatic RESULT=FAIL (even in smoke mode)
- Prevents false positives from empty runs
- Ensures quality metrics are based on actual data

## FAQ

### Q: What do GNU tool warnings mean?

**A:** macOS compatibility warnings. Install via: `brew install coreutils gnu-sed grep gnu-tar` or ignore (BSD fallback works).

### Q: How does offline mode work?

**A:** Offline mode (`--offline`) uses mock responses, costs $0.00, safe for testing. All API calls return realistic simulated data.

### Q: What are the key masking rules?

**A:** API keys masked to `sk-****` in logs. Full keys never appear in session reports or git commits.

### Q: How to add new targets?

**A:** Add entry to `scripts/entrypoints.jsonl` with required fields: `name`, `script`, `env_required`, `smoke_args`, `full_args`.

### Q: Session report shows ERROR_CLASS?

**A:** Check RUN_LOGS path in report. Common classes: `auth_error`, `rate_limit`, `budget_exceeded`, `network_timeout`.

### Q: How to run regression tests?

**A:** `npm run regression:mini` - runs offline, generates `reports/regression_summary.md`. Should pass with ±5% tolerance.

### Q: What are baseline v1.5 metrics?

**A:** Human-perceptible quality indicators: duplication rate, question type distribution, coverage analysis, evidence quality, hallucination detection, and PII/license compliance. Results in `reports/baseline_report.md`.

### Q: When should I run baseline metrics?

**A:** Before major releases, after significant changes to QA generation, or when quality issues are suspected. Use `--smoke` for quick checks, `--full` for comprehensive analysis.

### Q: How does the fixed pipeline order work?

**A:** Every baseline run follows the exact same 9-step sequence for reproducibility. Steps 8-9 (export/handoff) are non-blocking and won't fail the main pipeline.

### Q: What is the DLQ system?

**A:** Dead Letter Queue automatically captures failed runs with metadata, artifacts, and failure reasons. Check `reports/dlq/index.jsonl` for entries. Use `node scripts/lib/dlq.ts --stats` for analysis.

### Q: Why does CASES_TOTAL=0 cause failure?

**A:** Even smoke tests should process some cases if they actually execute. Zero cases usually indicates a pipeline error, not successful execution.

### Q: How do export hooks work?

**A:** Export hooks run after the main pipeline and convert baseline_report.jsonl to CSV/JSON formats. Failures are logged as warnings but don't affect the main result.

### Q: What are standardized exit codes?

**A:** `0`=success, `2`=toolchain, `3`=schema, `4`=runtime/API, `5`=signals. This allows automated systems to respond appropriately to different failure types.

## Testing the Hardened Pipeline (AC-6)

### T1: Smoke Mode Pipeline Consistency Test

```bash
# Test smoke mode with budget (should complete with CASES_TOTAL>0)
./run_v3.sh baseline --smoke --budget 0.5 --profile dev

# Verify required fields in session report
grep -E "(MODE: smoke|DRY_RUN: true|CASES_TOTAL: [1-9]|RESULT: PASS|RUN_STATE: SUCCESS)" reports/session_report.md

# Check that P50_MS and P95_MS are populated
grep -E "(P50_MS: [0-9]+|P95_MS: [0-9]+)" reports/session_report.md

# Verify single atomic write (check no .tmp files remain)
ls reports/*.tmp 2>/dev/null && echo "ERROR: tmp files found" || echo "OK: atomic write successful"
```

### T2: DLQ Handling with Forced Failures

```bash
# Force schema validation failure (create invalid JSON)
echo '{"invalid": json}' > baseline_config_invalid.json
./run_v3.sh baseline --smoke --budget 0.5 --config baseline_config_invalid.json

# Should exit with code 3 and add to DLQ
echo "Exit code: $?"

# Verify DLQ entry created
node scripts/lib/dlq.ts --stats | jq '.totalEntries'

# Check session report has DLQ_COUNT increased
grep "DLQ_COUNT:" reports/session_report.md

# Clean up
rm baseline_config_invalid.json
```

### T3: Reproducibility Test (±5% tolerance)

```bash
# Run baseline twice with same inputs and check consistency
BASELINE_DATA="apps/fe-web/dev/runs/baseline_2025-09-09_run1.jsonl"

# First run
./run_v3.sh baseline --full --budget 2.00 --data "$BASELINE_DATA" --config baseline_config.json
cp reports/baseline_report.jsonl reports/baseline_run1.jsonl

# Second run
./run_v3.sh baseline --full --budget 2.00 --data "$BASELINE_DATA" --config baseline_config.json
cp reports/baseline_report.jsonl reports/baseline_run2.jsonl

# Compare key metrics (should be within ±5%)
# This would typically be done with a metrics comparison script
echo "Compare the two runs manually or with custom comparison script"
```

### T4: Export/Handoff Non-blocking Test

```bash
# Run with export flags and force export failure
./run_v3.sh baseline --full --budget 2.00 --export csv,json --handoff

# Check main result is not affected by export failures
grep "RESULT:" reports/session_report.md

# Check warnings increased but result unchanged
grep "WARNINGS:" reports/session_report.md

# Manual export failure test (move baseline_report.jsonl temporarily)
mv reports/baseline_report.jsonl reports/baseline_report.jsonl.backup
./run_v3.sh baseline --full --budget 1.00 --export csv
# Should complete with warnings but not fail
mv reports/baseline_report.jsonl.backup reports/baseline_report.jsonl
```

## Monitoring and Alerting

### Health Check Commands

**Daily Health Check:**

```bash
# Run all guards
npm run guard:all

# Check regression status
npm run regression:mini

# Verify environment
npm run guard:env

# Check for secrets
npm run guard:git

# Quick baseline quality check
./run_v3.sh baseline --smoke --budget 0.25
```

**Weekly Quality Assessment:**

```bash
# Comprehensive baseline metrics analysis with exports
./run_v3.sh baseline --full --budget 2.00 --export csv,json --handoff

# Review quality trends
open reports/baseline_report.md

# Check for quality regressions
grep -E "(⚠️|❌)" reports/baseline_report.md || echo "Quality checks passed"

# Review DLQ trends
node scripts/lib/dlq.ts --stats | jq '.totalEntries, .topFailReasons[0:3]'
```

**Cost Monitoring:**

```bash
# Check recent spending
find reports/history -name "session_report.md" -mtime -7 -exec grep "COST_USD:" {} \;

# Monitor budget utilization
./run_v3.sh __validate_prod_guard --check-only

# Check for budget-related DLQ entries
node scripts/lib/dlq.ts --stats | jq '.topFailReasons[] | select(.reason | contains("budget"))'
```

**Performance Monitoring:**

```bash
# Check recent performance metrics
find reports/history -name "session_report.md" -mtime -1 -exec grep -E "(P50_MS|P95_MS|DURATION_MS):" {} \;

# Review regression trends
ls -la reports/regression_summary.*
```

### Alerting Setup

**CI/CD Slack Integration:**

- Set `SLACK_WEBHOOK_URL` secret in GitHub repository settings
- Notifications sent for all CI pipeline results
- Includes build status, commit info, and gate results

**Critical Alert Conditions:**

- Secret detected in code
- Budget exceeded threshold
- Regression tests failing
- API authentication failures
- System unavailability

### Logging and Audit Trail

**Log Locations:**

- Session reports: `reports/session_report.md` and `reports/history/`
- Runtime logs: `RUN_LOGS/session_*.log`
- Regression reports: `reports/regression_summary.*`
- Git activity: Standard git log

**Audit Requirements:**

- All API key rotations must be documented
- Budget exceeds require incident reports
- Secret exposures require full audit trail
- System changes require session report archival

## Emergency Contacts

### Escalation Path

**Level 1 - Development Team:**

- For: Normal operations, troubleshooting, feature issues
- Response: 2-4 hours during business hours

**Level 2 - Security Team:**

- For: Secret exposures, security incidents, compliance issues
- Response: 30 minutes for critical, 2 hours for high

**Level 3 - Executive:**

- For: Major system compromise, significant budget exceed, compliance violation
- Response: Immediate for critical security issues

### Communication Channels

**Normal Operations:**

- Slack: Development team channel
- Email: Team mailing list
- Documentation: This operations guide

**Emergency Situations:**

- Slack: Security incident channel
- Phone: Emergency contact list
- Encrypted chat: For sensitive coordination

---

**Document Version:** Pre-P1 Final Patch | **Last Updated:** 2025-09-17
**Status:** Production Ready | **Next Review:** 2025-10-17
**Maintainer:** DevOps Team | **Security Review:** 2025-09-17
