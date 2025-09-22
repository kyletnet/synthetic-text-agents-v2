#!/bin/bash
# Full Run Preflight — Report Validation Script (macOS compatible)
# Validates session reports against new baseline criteria (7 elements + 3-layer orchestration)
# Usage: ./validate_report_simple.sh [reports/session_report.md]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPORTS_DIR="$REPO_ROOT/reports"
DEFAULT_REPORT="$REPORTS_DIR/session_report.md"
OUTPUT_MD="$REPORTS_DIR/preflight_check.md"
OUTPUT_JSON="$REPORTS_DIR/preflight_check.json"

# Input validation
REPORT_FILE="${1:-$DEFAULT_REPORT}"
if [[ ! -f "$REPORT_FILE" ]]; then
    echo "ERROR: Report file not found: $REPORT_FILE" >&2
    exit 1
fi

# Color codes for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Initialize results
OVERALL_STATUS="PASS"
FAIL_COUNT=0
WARN_COUNT=0
RESULTS=""

# Utility functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }

add_result() {
    local key="$1"
    local status="$2"
    local detail="$3"

    RESULTS="$RESULTS$key|$status|$detail\n"

    case "$status" in
        "FAIL")
            FAIL_COUNT=$((FAIL_COUNT + 1))
            OVERALL_STATUS="FAIL"
            log_error "$key: $detail"
            ;;
        "WARN")
            WARN_COUNT=$((WARN_COUNT + 1))
            if [[ "$OVERALL_STATUS" == "PASS" ]]; then
                OVERALL_STATUS="WARN"
            fi
            log_warn "$key: $detail"
            ;;
        "PASS")
            log_info "$key: $detail"
            ;;
    esac
}

# Extract fields using AWK utility
log_info "Parsing report file: $REPORT_FILE"
PARSED_FIELDS=$(awk -f "$SCRIPT_DIR/_lib_report_grep.awk" "$REPORT_FILE")

# Simple field extraction function
get_field() {
    local field_name="$1"
    echo "$PARSED_FIELDS" | grep "^$field_name=" | cut -d'=' -f2- | head -1
}

# Validation functions
validate_cases_total() {
    local cases_total=$(get_field "CASES_TOTAL")
    cases_total="${cases_total:-0}"

    if [[ "$cases_total" =~ ^[0-9]+$ ]] && [[ "$cases_total" -gt 0 ]]; then
        add_result "CASES_TOTAL" "PASS" "Found $cases_total test cases"
    else
        add_result "CASES_TOTAL" "FAIL" "CASES_TOTAL must be > 0, found: $cases_total"
    fi
}

validate_field_consistency() {
    local result=$(get_field "RESULT")
    local run_state=$(get_field "RUN_STATE")
    local dry_run=$(get_field "DRY_RUN")
    local model_id=$(get_field "MODEL_ID")

    result="${result:-unknown}"
    run_state="${run_state:-unknown}"
    dry_run="${dry_run:-unknown}"
    model_id="${model_id:-unknown}"

    local issues=""

    # Check for placeholder values
    [[ "$result" == "unknown" || "$result" == "" ]] && issues="$issues RESULT-unknown"
    [[ "$run_state" == "UNKNOWN" || "$run_state" == "" ]] && issues="$issues RUN_STATE-unknown"
    [[ "$dry_run" == "unknown" || "$dry_run" == "" ]] && issues="$issues DRY_RUN-unknown"
    [[ "$model_id" == "default" || "$model_id" == "unknown" ]] && issues="$issues MODEL_ID-default"

    if [[ -z "$issues" ]]; then
        add_result "FIELD_CONSISTENCY" "PASS" "All execution fields properly set"
    else
        add_result "FIELD_CONSISTENCY" "FAIL" "Field issues:$issues"
    fi
}

validate_dlq_retry_policy() {
    local dlq_count=$(get_field "DLQ_COUNT")
    dlq_count="${dlq_count:-0}"

    local has_retry_policy=$(get_field "RETRY_POLICY")
    local dlq_dir_exists=""

    # Check for DLQ directory
    if [[ -d "$REPORTS_DIR/dlq" ]]; then
        dlq_dir_exists="true"
    fi

    if [[ "$dlq_count" -gt 0 ]] || [[ -n "$has_retry_policy" ]] || [[ "$dlq_dir_exists" == "true" ]]; then
        add_result "DLQ_RETRY_POLICY" "PASS" "DLQ/retry mechanisms present (count: $dlq_count)"
    else
        add_result "DLQ_RETRY_POLICY" "WARN" "No DLQ/retry policy evidence found"
    fi
}

validate_budget_guard() {
    local budget_usd=$(get_field "BUDGET_USD")
    budget_usd="${budget_usd:-0.00}"

    local has_budget_guard=$(get_field "BUDGET_GUARD")

    # Check if budget is set and guard mechanisms exist
    if [[ "$budget_usd" != "0.00" ]] && [[ "$budget_usd" != "0" ]]; then
        if [[ -n "$has_budget_guard" ]]; then
            add_result "BUDGET_GUARD" "PASS" "Budget set ($budget_usd) with guard mechanisms"
        else
            add_result "BUDGET_GUARD" "WARN" "Budget set ($budget_usd) but no guard evidence in logs"
        fi
    else
        add_result "BUDGET_GUARD" "WARN" "No budget limit configured"
    fi
}

validate_data_manifest() {
    local has_manifest=$(get_field "DATA_MANIFEST")
    local run_id=$(get_field "RUN_ID")
    run_id="${run_id:-unknown}"

    # Check for manifest files
    local found_manifest=""
    if [[ -f "$REPO_ROOT/baseline_config.json" ]]; then
        found_manifest="baseline_config.json"
    elif [[ -f "$REPORTS_DIR/baseline_report.jsonl" ]]; then
        found_manifest="baseline_report.jsonl"
    fi

    if [[ -n "$found_manifest" ]] || [[ -n "$has_manifest" ]]; then
        add_result "DATA_MANIFEST" "PASS" "Data manifest/checksum found: ${found_manifest:-log-reference}"
    else
        add_result "DATA_MANIFEST" "WARN" "No data manifest or checksum evidence found"
    fi
}

validate_seed_fixed() {
    local has_seed=$(get_field "SEED_FIXED")
    local session_id=$(get_field "SESSION_ID")
    session_id="${session_id:-unknown}"

    if [[ -n "$has_seed" ]] || [[ "$session_id" != "unknown" ]]; then
        add_result "SEED_FIXED" "PASS" "Randomness/sampling seed indicators found"
    else
        add_result "SEED_FIXED" "WARN" "No seed/randomness fixation evidence"
    fi
}

validate_standard_fields() {
    local has_standard=$(get_field "STANDARD_FIELDS")
    local run_id=$(get_field "RUN_ID")
    local cost_usd=$(get_field "COST_USD")
    local duration_ms=$(get_field "DURATION_MS")

    run_id="${run_id:-unknown}"
    cost_usd="${cost_usd:-0.00}"
    duration_ms="${duration_ms:-0}"

    # Check if key logging fields are present
    local field_count=0
    [[ "$run_id" != "unknown" ]] && field_count=$((field_count + 1))
    [[ "$cost_usd" != "0.00" ]] && field_count=$((field_count + 1))
    [[ "$duration_ms" != "0" ]] && field_count=$((field_count + 1))

    if [[ "$field_count" -ge 2 ]] || [[ -n "$has_standard" ]]; then
        add_result "STANDARD_FIELDS" "PASS" "Standard log fields present ($field_count/3 core fields)"
    else
        add_result "STANDARD_FIELDS" "WARN" "Minimal standard log fields found"
    fi
}

validate_orchestration_contract() {
    local has_contract=$(get_field "ORCHESTRATION_CONTRACT")
    local run_state=$(get_field "RUN_STATE")
    run_state="${run_state:-unknown}"

    # Check for state transitions or envelope patterns
    if [[ -n "$has_contract" ]] || [[ "$run_state" =~ (QUEUED|RUNNING|DONE|RETRYING) ]]; then
        add_result "ORCHESTRATION_CONTRACT" "PASS" "Contract/envelope patterns found"
    else
        add_result "ORCHESTRATION_CONTRACT" "WARN" "No orchestration contract evidence"
    fi
}

validate_orchestration_checkpoint() {
    local has_checkpoint=$(get_field "ORCHESTRATION_CHECKPOINT")

    # Check for checkpoint directory or restart capabilities
    local checkpoint_dir="$REPORTS_DIR/checkpoints"
    if [[ -d "$checkpoint_dir" ]] || [[ -n "$has_checkpoint" ]]; then
        add_result "ORCHESTRATION_CHECKPOINT" "PASS" "Checkpoint mechanisms present"
    else
        add_result "ORCHESTRATION_CHECKPOINT" "WARN" "No checkpoint evidence found"
    fi
}

validate_orchestration_policy() {
    local has_policy=$(get_field "ORCHESTRATION_POLICY")
    local panel_size=$(get_field "PANEL_SIZE")
    panel_size="${panel_size:-1}"

    # Check for per-agent policies or cost caps
    if [[ -n "$has_policy" ]] || [[ "$panel_size" -gt 1 ]]; then
        add_result "ORCHESTRATION_POLICY" "PASS" "Per-agent policy mechanisms present"
    else
        add_result "ORCHESTRATION_POLICY" "WARN" "No per-agent policy evidence"
    fi
}

validate_gate_mapping() {
    local gate_status=$(get_field "GATE_STATUS")
    local result=$(get_field "RESULT")
    result="${result:-unknown}"

    # Check for P0/P1/P2 gate mapping consistency
    if [[ -n "$gate_status" ]]; then
        case "$gate_status" in
            "PASS")
                if [[ "$result" == "PASS" ]]; then
                    add_result "GATE_MAPPING" "PASS" "Gate status ($gate_status) matches result ($result)"
                else
                    add_result "GATE_MAPPING" "WARN" "Gate status ($gate_status) vs result ($result) mismatch"
                fi
                ;;
            "FAIL")
                if [[ "$result" == "FAIL" ]]; then
                    add_result "GATE_MAPPING" "PASS" "Gate status ($gate_status) matches result ($result)"
                else
                    add_result "GATE_MAPPING" "WARN" "Gate status ($gate_status) vs result ($result) mismatch"
                fi
                ;;
            *)
                add_result "GATE_MAPPING" "PASS" "Gate status found: $gate_status"
                ;;
        esac
    else
        add_result "GATE_MAPPING" "WARN" "No explicit gate mapping status found"
    fi
}

# Run all validations
log_info "Running preflight validation checks..."

# 7 Essential Elements
validate_cases_total
validate_field_consistency
validate_dlq_retry_policy
validate_budget_guard
validate_data_manifest
validate_seed_fixed
validate_standard_fields

# 3-Layer Orchestration
validate_orchestration_contract
validate_orchestration_checkpoint
validate_orchestration_policy

# Gate Mapping
validate_gate_mapping

# Generate markdown report
cat > "$OUTPUT_MD" << EOF
# Preflight Validation Report

**Report Generated**: $(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
**Source Report**: $REPORT_FILE
**Overall Status**: $OVERALL_STATUS
**Failures**: $FAIL_COUNT
**Warnings**: $WARN_COUNT

## Summary

EOF

case "$OVERALL_STATUS" in
    "PASS")
        echo "✅ **PREFLIGHT PASSED** - All critical validations successful" >> "$OUTPUT_MD"
        ;;
    "WARN")
        echo "⚠️ **PREFLIGHT WARNING** - Some non-critical issues found" >> "$OUTPUT_MD"
        ;;
    "FAIL")
        echo "❌ **PREFLIGHT FAILED** - Critical issues must be resolved" >> "$OUTPUT_MD"
        ;;
esac

cat >> "$OUTPUT_MD" << EOF

## Validation Results

### Required Elements (7)

EOF

# Write detailed results
echo -e "$RESULTS" | while IFS='|' read -r check status detail; do
    [[ -z "$check" ]] && continue

    # Only process required elements
    case "$check" in
        "CASES_TOTAL"|"FIELD_CONSISTENCY"|"DLQ_RETRY_POLICY"|"BUDGET_GUARD"|"DATA_MANIFEST"|"SEED_FIXED"|"STANDARD_FIELDS")
            case "$status" in
                "PASS") icon="✅" ;;
                "WARN") icon="⚠️" ;;
                "FAIL") icon="❌" ;;
                *) icon="❓" ;;
            esac
            echo "- $icon **$check**: $detail" >> "$OUTPUT_MD"
            ;;
    esac
done

cat >> "$OUTPUT_MD" << EOF

### Orchestration Layers (3)

EOF

# Process orchestration layers
echo -e "$RESULTS" | while IFS='|' read -r check status detail; do
    [[ -z "$check" ]] && continue

    case "$check" in
        "ORCHESTRATION_CONTRACT"|"ORCHESTRATION_CHECKPOINT"|"ORCHESTRATION_POLICY")
            case "$status" in
                "PASS") icon="✅" ;;
                "WARN") icon="⚠️" ;;
                "FAIL") icon="❌" ;;
                *) icon="❓" ;;
            esac
            echo "- $icon **$check**: $detail" >> "$OUTPUT_MD"
            ;;
    esac
done

cat >> "$OUTPUT_MD" << EOF

### Gate Mapping

EOF

# Process gate mapping
echo -e "$RESULTS" | while IFS='|' read -r check status detail; do
    [[ -z "$check" ]] && continue

    case "$check" in
        "GATE_MAPPING")
            case "$status" in
                "PASS") icon="✅" ;;
                *) icon="⚠️" ;;
            esac
            echo "- $icon **$check**: $detail" >> "$OUTPUT_MD"
            ;;
    esac
done

cat >> "$OUTPUT_MD" << EOF

## Next Steps

EOF

if [[ "$OVERALL_STATUS" == "FAIL" ]]; then
    cat >> "$OUTPUT_MD" << EOF
❌ **Action Required**: Resolve the $FAIL_COUNT critical failure(s) before proceeding with full run.

    Typical fixes:
    - Ensure CASES_TOTAL > 0 by running actual test scenarios
    - Set proper execution context (MODE, DRY_RUN, MODEL_ID)
    - Configure budget limits and retry policies
    - Check DLQ directory exists: mkdir -p reports/dlq

EOF
elif [[ "$OVERALL_STATUS" == "WARN" ]]; then
    cat >> "$OUTPUT_MD" << EOF
⚠️ **Review Recommended**: $WARN_COUNT warning(s) found. Full run can proceed but monitoring recommended.

EOF
else
    cat >> "$OUTPUT_MD" << EOF
✅ **Ready for Full Run**: All preflight checks passed successfully.

EOF
fi

cat >> "$OUTPUT_MD" << EOF

## Commands

    # Re-run preflight validation
    bash scripts/preflight/validate_report_simple.sh

    # Run smoke rehearsal
    bash scripts/preflight/smoke_rehearsal.sh

    # View this report
    open reports/preflight_check.md

---

*Generated by Preflight Validator v1.0 (macOS compatible)*
*Target: Baseline v1.5 + 3-Layer Orchestration*
EOF

# Generate simplified JSON report
cat > "$OUTPUT_JSON" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
  "source_report": "$REPORT_FILE",
  "overall_status": "$OVERALL_STATUS",
  "fail_count": $FAIL_COUNT,
  "warn_count": $WARN_COUNT,
  "summary": "Preflight validation completed"
}
EOF

# Final output
echo
log_info "Preflight validation complete"
log_info "Report: $OUTPUT_MD"
log_info "JSON: $OUTPUT_JSON"
echo

if [[ "$OVERALL_STATUS" == "FAIL" ]]; then
    log_error "Preflight FAILED - exit code 1"
    exit 1
else
    log_info "Preflight $OVERALL_STATUS - exit code 0"
    exit 0
fi