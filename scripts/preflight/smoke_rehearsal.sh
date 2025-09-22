#!/bin/bash
# Full Run Preflight — Smoke Rehearsal Runner
# Performs end-to-end smoke test to verify ADR/Handoff requirements are met
# Usage: ./smoke_rehearsal.sh

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORTS_DIR="$REPO_ROOT/reports"
RUN_SCRIPT="$REPO_ROOT/run_v3.sh"

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Utility functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# Banner
echo
echo "=================================================================="
echo "                   PREFLIGHT SMOKE REHEARSAL"
echo "=================================================================="
echo "Purpose: Validate ADR/Handoff requirements before full run"
echo "Target:  Baseline v1.5 + 3-Layer Orchestration"
echo "=================================================================="
echo

# Step 1: Environment validation
log_step "1. Environment & Bootstrap Validation"

# Check Node.js version via nvm
if command -v nvm >/dev/null 2>&1; then
    log_info "NVM available, checking Node version..."
    # Source nvm if available
    if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
        source "$HOME/.nvm/nvm.sh"
    fi
    NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
    log_info "Node.js version: $NODE_VERSION"

    if [[ "$NODE_VERSION" =~ v18\.18\.0 ]]; then
        log_info "✅ Node.js 18.18.0 detected (as per nvm bootstrap)"
    else
        log_warn "⚠️ Expected Node.js v18.18.0, found: $NODE_VERSION"
    fi
else
    log_warn "NVM not found, checking direct Node.js installation"
    NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
    log_info "Node.js version: $NODE_VERSION"
fi

# Verify run script exists
if [[ ! -f "$RUN_SCRIPT" ]]; then
    log_error "❌ run_v3.sh not found at: $RUN_SCRIPT"
    exit 1
fi
log_info "✅ run_v3.sh found"

# Step 2: Pre-smoke cleanup
log_step "2. Pre-smoke Cleanup"

# Backup existing session report if present
if [[ -f "$REPORTS_DIR/session_report.md" ]]; then
    BACKUP_FILE="$REPORTS_DIR/session_report.backup.$(date +%s).md"
    cp "$REPORTS_DIR/session_report.md" "$BACKUP_FILE"
    log_info "Backed up existing session report to: $(basename "$BACKUP_FILE")"
fi

# Ensure reports directory exists
mkdir -p "$REPORTS_DIR"
log_info "Reports directory ready: $REPORTS_DIR"

# Step 3: Execute smoke test
log_step "3. Executing Baseline Smoke Test"

SMOKE_START_TIME=$(date +%s)
log_info "Starting baseline smoke test with budget limit..."

# Run baseline smoke test with specific parameters
cd "$REPO_ROOT"
log_info "Command: ./run_v3.sh baseline --smoke --budget 0.50 --profile stage"

if ./run_v3.sh baseline --smoke --budget 0.50 --profile stage; then
    SMOKE_EXIT_CODE=0
    log_info "✅ Smoke test completed successfully"
else
    SMOKE_EXIT_CODE=$?
    log_error "❌ Smoke test failed with exit code: $SMOKE_EXIT_CODE"
fi

SMOKE_END_TIME=$(date +%s)
SMOKE_DURATION=$((SMOKE_END_TIME - SMOKE_START_TIME))
log_info "Smoke test duration: ${SMOKE_DURATION}s"

# Step 4: Verify report generation
log_step "4. Report Generation Verification"

if [[ -f "$REPORTS_DIR/session_report.md" ]]; then
    log_info "✅ session_report.md generated/updated"

    # Check if file was modified recently (within last 5 minutes)
    if [[ $(uname) == "Darwin" ]]; then
        # macOS stat command
        FILE_MOD_TIME=$(stat -f %m "$REPORTS_DIR/session_report.md")
    else
        # Linux stat command
        FILE_MOD_TIME=$(stat -c %Y "$REPORTS_DIR/session_report.md")
    fi

    CURRENT_TIME=$(date +%s)
    TIME_DIFF=$((CURRENT_TIME - FILE_MOD_TIME))

    if [[ $TIME_DIFF -lt 300 ]]; then
        log_info "✅ Report recently modified (${TIME_DIFF}s ago)"
    else
        log_warn "⚠️ Report modification time seems old (${TIME_DIFF}s ago)"
    fi
else
    log_error "❌ session_report.md not found after smoke test"
fi

# Step 5: Run preflight validation
log_step "5. Preflight Validation"

VALIDATOR_SCRIPT="$SCRIPT_DIR/validate_report_simple.sh"
if [[ -f "$VALIDATOR_SCRIPT" ]]; then
    log_info "Running preflight validator..."

    if bash "$VALIDATOR_SCRIPT"; then
        VALIDATION_EXIT_CODE=0
        log_info "✅ Preflight validation passed"
    else
        VALIDATION_EXIT_CODE=$?
        log_error "❌ Preflight validation failed with exit code: $VALIDATION_EXIT_CODE"
    fi
else
    log_error "❌ Validator script not found: $VALIDATOR_SCRIPT"
    VALIDATION_EXIT_CODE=1
fi

# Step 6: Extract and display key metrics
log_step "6. Key Metrics Summary"

if [[ -f "$REPORTS_DIR/session_report.md" ]]; then
    log_info "Extracting key metrics from session report..."

    # Use the AWK utility to parse key fields
    METRICS=$(awk -f "$SCRIPT_DIR/_lib_report_grep.awk" "$REPORTS_DIR/session_report.md")

    # Extract key values
    RESULT=$(echo "$METRICS" | grep "^RESULT=" | cut -d'=' -f2 || echo "unknown")
    RUN_STATE=$(echo "$METRICS" | grep "^RUN_STATE=" | cut -d'=' -f2 || echo "unknown")
    DRY_RUN=$(echo "$METRICS" | grep "^DRY_RUN=" | cut -d'=' -f2 || echo "unknown")
    MODEL_ID=$(echo "$METRICS" | grep "^MODEL_ID=" | cut -d'=' -f2 || echo "unknown")
    CASES_TOTAL=$(echo "$METRICS" | grep "^CASES_TOTAL=" | cut -d'=' -f2 || echo "0")
    COST_USD=$(echo "$METRICS" | grep "^COST_USD=" | cut -d'=' -f2 || echo "0.00")
    DURATION_MS=$(echo "$METRICS" | grep "^DURATION_MS=" | cut -d'=' -f2 || echo "0")
    BUDGET_USD=$(echo "$METRICS" | grep "^BUDGET_USD=" | cut -d'=' -f2 || echo "0.00")

    echo
    echo "    📊 EXECUTION SUMMARY"
    echo "    ===================="
    echo "    RESULT:       $RESULT"
    echo "    RUN_STATE:    $RUN_STATE"
    echo "    DRY_RUN:      $DRY_RUN"
    echo "    MODEL_ID:     $MODEL_ID"
    echo "    CASES_TOTAL:  $CASES_TOTAL"
    echo "    COST_USD:     $COST_USD"
    echo "    DURATION_MS:  $DURATION_MS"
    echo "    BUDGET_USD:   $BUDGET_USD"
    echo

    # Check consistency with expected smoke test parameters
    log_info "Verifying execution parameter consistency..."

    CONSISTENCY_ISSUES=()

    # These checks verify that the report reflects actual execution parameters
    [[ "$DRY_RUN" != "false" ]] && CONSISTENCY_ISSUES+=("DRY_RUN should be 'false' for actual execution")
    [[ "$BUDGET_USD" != "0.50" ]] && CONSISTENCY_ISSUES+=("BUDGET_USD should be '0.50' as specified")
    [[ "$MODEL_ID" == "default" || "$MODEL_ID" == "unknown" ]] && CONSISTENCY_ISSUES+=("MODEL_ID should not be 'default' or 'unknown'")

    if [[ ${#CONSISTENCY_ISSUES[@]} -eq 0 ]]; then
        log_info "✅ Execution parameters are consistent with smoke test command"
    else
        log_warn "⚠️ Parameter consistency issues found:"
        for issue in "${CONSISTENCY_ISSUES[@]}"; do
            log_warn "  - $issue"
        done
    fi
else
    log_error "❌ Cannot extract metrics - session_report.md not found"
fi

# Step 7: Check for evidence of required features
log_step "7. Required Feature Evidence Check"

if [[ -f "$REPORTS_DIR/session_report.md" ]]; then
    FEATURE_EVIDENCE=$(awk -f "$SCRIPT_DIR/_lib_report_grep.awk" "$REPORTS_DIR/session_report.md")

    echo "    🔍 FEATURE EVIDENCE"
    echo "    ==================="

    # Check for DLQ evidence
    DLQ_COUNT=$(echo "$FEATURE_EVIDENCE" | grep "^DLQ_COUNT=" | cut -d'=' -f2 || echo "0")
    if [[ "$DLQ_COUNT" -gt 0 ]] || [[ -d "$REPORTS_DIR/dlq" ]]; then
        echo "    ✅ DLQ/Retry Policy: Evidence found (count: $DLQ_COUNT)"
    else
        echo "    ⚠️ DLQ/Retry Policy: No evidence found"
    fi

    # Check for budget guard evidence
    if echo "$FEATURE_EVIDENCE" | grep -q "BUDGET_GUARD=found"; then
        echo "    ✅ Budget Guard: Evidence found in logs"
    else
        echo "    ⚠️ Budget Guard: No evidence found in logs"
    fi

    # Check for orchestration evidence
    CONTRACT_FOUND=$(echo "$FEATURE_EVIDENCE" | grep -c "ORCHESTRATION_CONTRACT=found" || echo "0")
    CHECKPOINT_FOUND=$(echo "$FEATURE_EVIDENCE" | grep -c "ORCHESTRATION_CHECKPOINT=found" || echo "0")
    POLICY_FOUND=$(echo "$FEATURE_EVIDENCE" | grep -c "ORCHESTRATION_POLICY=found" || echo "0")

    echo "    📋 3-Layer Orchestration:"
    echo "      Contract:   $([[ "$CONTRACT_FOUND" -gt 0 ]] && echo "✅" || echo "⚠️") ($CONTRACT_FOUND indicators)"
    echo "      Checkpoint: $([[ "$CHECKPOINT_FOUND" -gt 0 ]] && echo "✅" || echo "⚠️") ($CHECKPOINT_FOUND indicators)"
    echo "      Policy:     $([[ "$POLICY_FOUND" -gt 0 ]] && echo "✅" || echo "⚠️") ($POLICY_FOUND indicators)"
    echo
fi

# Step 8: Final assessment and recommendations
log_step "8. Final Assessment"

echo
echo "    🎯 PREFLIGHT REHEARSAL RESULTS"
echo "    ==============================="
echo "    Smoke Test:        $([[ $SMOKE_EXIT_CODE -eq 0 ]] && echo "✅ PASS" || echo "❌ FAIL")"
echo "    Report Generation: $([[ -f "$REPORTS_DIR/session_report.md" ]] && echo "✅ PASS" || echo "❌ FAIL")"
echo "    Validation:        $([[ $VALIDATION_EXIT_CODE -eq 0 ]] && echo "✅ PASS" || echo "❌ FAIL")"
echo "    Duration:          ${SMOKE_DURATION}s"
echo

# Determine overall status
OVERALL_EXIT_CODE=0

if [[ $SMOKE_EXIT_CODE -ne 0 ]]; then
    log_error "❌ Smoke test execution failed"
    OVERALL_EXIT_CODE=1
fi

if [[ $VALIDATION_EXIT_CODE -ne 0 ]]; then
    log_error "❌ Preflight validation failed"
    OVERALL_EXIT_CODE=1
fi

if [[ ! -f "$REPORTS_DIR/session_report.md" ]]; then
    log_error "❌ Report generation failed"
    OVERALL_EXIT_CODE=1
fi

# Final recommendations
echo "    📋 NEXT STEPS"
echo "    ============="

if [[ $OVERALL_EXIT_CODE -eq 0 ]]; then
    echo "    ✅ Ready for full run - all preflight checks passed"
    echo "    📄 Detailed validation: open reports/preflight_check.md"
    echo "    🚀 Full run command: ./run_v3.sh baseline --budget 5.00 --profile prod"
else
    echo "    ❌ Full run NOT recommended - resolve issues first"
    echo "    📋 Review: reports/preflight_check.md"
    echo "    🔧 Fix issues and re-run: bash scripts/preflight/smoke_rehearsal.sh"
fi

echo
echo "=================================================================="
echo "                   PREFLIGHT REHEARSAL COMPLETE"
echo "=================================================================="

exit $OVERALL_EXIT_CODE