#!/usr/bin/env bash
set -euo pipefail

# Test script for standalone session report functionality
# Ensures session reports can be read without runtime variables

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Standard test functions
ok()   { printf "\033[32m[OK]\033[0m %s\n" "$*"; }
fail() { printf "\033[31m[FAIL]\033[0m %s\n" "$*"; }
info() { printf "\033[34m[INFO]\033[0m %s\n" "$*"; }

cd "$PROJECT_ROOT"

# Test 1: Session report command available in run_v3.sh
info "Test 1: Checking session report command availability"
if ./run_v3.sh --help 2>&1 | grep -q session-report; then
    ok "Session report command is available"
else
    info "Session report command not in help (integrated as subcommand)"
fi

# Test 2: Create a mock session report for testing
info "Test 2: Creating mock session report"
mkdir -p reports
cat > "reports/session_report.md" <<'EOF'
# Session Report

## Summary Block (Copy for Operational Reviews)

```
SESSION_ID: test_session_123
RUN_ID: test_run_456
TARGET: test_target
PROFILE: dev
MODE: smoke
DRY_RUN: true (source: CLI)
OFFLINE_MODE: false
BUDGET_USD: 1.00
COST_USD: 0.00
DURATION_MS: 5000
RESULT: PASS
CASES_TOTAL: 5
WARNINGS: 0
```

## Additional Details
Test session report for validation.
EOF

ok "Mock session report created"

# Test 3: Test basic session report reading
info "Test 3: Testing basic session report reading"
if timeout 30 ./run_v3.sh session-report >/dev/null 2>&1; then
    ok "Session report command executes successfully"
else
    fail "Session report command failed"
    exit 1
fi

# Test 4: Test field extraction with grep (critical requirement)
info "Test 4: Testing field extraction with grep"
output=$(timeout 30 ./run_v3.sh session-report 2>/dev/null | grep "CASES_TOTAL:" | awk '{print $2}' || echo "")
if [[ -n "$output" && "$output" != "N/A" ]]; then
    ok "CASES_TOTAL field extraction works: $output"
else
    fail "CASES_TOTAL field extraction failed, got: '$output'"
    exit 1
fi

# Test 5: Test full format option
info "Test 5: Testing full format option"
if timeout 30 ./run_v3.sh session-report --format full >/dev/null 2>&1; then
    ok "Full format option works"
else
    fail "Full format option failed"
    exit 1
fi

# Test 6: Test error handling for missing session report
info "Test 6: Testing error handling for missing session report"
mv "reports/session_report.md" "reports/session_report.md.backup"
if ! timeout 30 ./run_v3.sh session-report >/dev/null 2>&1; then
    ok "Correctly handles missing session report"
else
    fail "Should fail gracefully when session report is missing"
    mv "reports/session_report.md.backup" "reports/session_report.md"
    exit 1
fi
mv "reports/session_report.md.backup" "reports/session_report.md"

# Test 7: Test fresh shell environment (no DRY_RUN variable)
info "Test 7: Testing in fresh shell environment"
fresh_output=$(timeout 30 env -i bash -c "cd '$PROJECT_ROOT' && ./run_v3.sh session-report 2>/dev/null | grep 'CASES_TOTAL:' | awk '{print \$2}'" || echo "")
if [[ -n "$fresh_output" ]]; then
    ok "Works in fresh shell environment: $fresh_output"
else
    fail "Should work in fresh shell environment"
    exit 1
fi

# Test 8: Test specific run-id lookup
info "Test 8: Testing run-id parameter"
if timeout 30 ./run_v3.sh session-report --run-id nonexistent 2>&1 | grep -q "not found"; then
    ok "Run-id parameter works (warns for missing ID)"
else
    info "Run-id parameter behavior different than expected (non-critical)"
fi

# Test 9: Test pipeline integration readiness
info "Test 9: Testing pipeline integration readiness"
# Session report should work without environment variables
unset DRY_RUN OFFLINE_MODE RUN_ID SESSION_ID 2>/dev/null || true
if timeout 30 ./run_v3.sh session-report >/dev/null 2>&1; then
    ok "Session report works without runtime environment variables"
else
    fail "Session report should work without runtime environment variables"
    exit 1
fi

# Clean up
rm -f "reports/session_report.md"

ok "All session report tests passed"
exit 0