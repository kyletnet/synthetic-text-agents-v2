#!/usr/bin/env bash
# Full Run Preflight — Report Validation Script
# Validates session reports against new baseline criteria (7 elements + 3-layer orchestration)
# Usage: ./validate_report.sh [reports/session_report.md]

# Ensure we're using bash 4+ for associative arrays
if [ "${BASH_VERSION%%.*}" -lt 4 ]; then
    echo "ERROR: This script requires bash 4.0 or later for associative arrays" >&2
    echo "Current bash version: $BASH_VERSION" >&2
    echo "On macOS, install bash via: brew install bash" >&2
    exit 1
fi

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
declare -A results
declare -A details
OVERALL_STATUS="PASS"
FAIL_COUNT=0
WARN_COUNT=0

# Utility functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }

set_result() {
    local key="$1"
    local status="$2"
    local detail="$3"

    results["$key"]="$status"
    details["$key"]="$detail"

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

# Convert to associative array
declare -A fields
while IFS='=' read -r key value; do
    [[ -n "$key" ]] && fields["$key"]="$value"
done <<< "$PARSED_FIELDS"

# Validation functions
validate_cases_total() {
    local cases_total="${fields[CASES_TOTAL]:-0}"
    if [[ "$cases_total" =~ ^[0-9]+$ ]] && [[ "$cases_total" -gt 0 ]]; then
        set_result "CASES_TOTAL" "PASS" "Found $cases_total test cases"
    else
        set_result "CASES_TOTAL" "FAIL" "CASES_TOTAL must be > 0, found: $cases_total"
    fi
}

validate_field_consistency() {
    local result="${fields[RESULT]:-unknown}"
    local run_state="${fields[RUN_STATE]:-unknown}"
    local dry_run="${fields[DRY_RUN]:-unknown}"
    local model_id="${fields[MODEL_ID]:-unknown}"

    local issues=()

    # Check for placeholder values
    [[ "$result" == "unknown" || "$result" == "" ]] && issues+=("RESULT is unknown/empty")
    [[ "$run_state" == "UNKNOWN" || "$run_state" == "" ]] && issues+=("RUN_STATE is unknown/empty")
    [[ "$dry_run" == "unknown" || "$dry_run" == "" ]] && issues+=("DRY_RUN is unknown/empty")
    [[ "$model_id" == "default" || "$model_id" == "unknown" ]] && issues+=("MODEL_ID is default/unknown")

    if [[ ${#issues[@]} -eq 0 ]]; then
        set_result "FIELD_CONSISTENCY" "PASS" "All execution fields properly set"
    else
        local issue_text=$(printf ", %s" "${issues[@]}")
        set_result "FIELD_CONSISTENCY" "FAIL" "Field issues: ${issue_text:2}"
    fi
}

validate_dlq_retry_policy() {
    local dlq_count="${fields[DLQ_COUNT]:-0}"
    local has_retry_policy="${fields[RETRY_POLICY]:-}"
    local dlq_dir_exists=""

    # Check for DLQ directory
    if [[ -d "$REPORTS_DIR/dlq" ]]; then
        dlq_dir_exists="true"
    fi

    if [[ "$dlq_count" -gt 0 ]] || [[ -n "$has_retry_policy" ]] || [[ "$dlq_dir_exists" == "true" ]]; then
        set_result "DLQ_RETRY_POLICY" "PASS" "DLQ/retry mechanisms present (count: $dlq_count, policy: ${has_retry_policy:-none}, dir: ${dlq_dir_exists:-false})"
    else
        set_result "DLQ_RETRY_POLICY" "WARN" "No DLQ/retry policy evidence found"
    fi
}

validate_budget_guard() {
    local budget_usd="${fields[BUDGET_USD]:-0.00}"
    local has_budget_guard="${fields[BUDGET_GUARD]:-}"

    # Check if budget is set and guard mechanisms exist
    if [[ "$budget_usd" != "0.00" ]] && [[ "$budget_usd" != "0" ]]; then
        if [[ -n "$has_budget_guard" ]]; then
            set_result "BUDGET_GUARD" "PASS" "Budget set ($budget_usd) with guard mechanisms"
        else
            set_result "BUDGET_GUARD" "WARN" "Budget set ($budget_usd) but no guard evidence in logs"
        fi
    else
        set_result "BUDGET_GUARD" "WARN" "No budget limit configured"
    fi
}

validate_data_manifest() {
    local has_manifest="${fields[DATA_MANIFEST]:-}"
    local run_id="${fields[RUN_ID]:-unknown}"

    # Check for manifest files or checksum references
    local manifest_files=(
        "$REPO_ROOT/baseline_config.json"
        "$REPORTS_DIR/baseline_report.jsonl"
        "$REPORTS_DIR"/*.manifest
    )

    local found_manifest=""
    for file in "${manifest_files[@]}"; do
        if [[ -f "$file" ]]; then
            found_manifest="$file"
            break
        fi
    done

    if [[ -n "$found_manifest" ]] || [[ -n "$has_manifest" ]]; then
        set_result "DATA_MANIFEST" "PASS" "Data manifest/checksum found: ${found_manifest:-log-reference}"
    else
        set_result "DATA_MANIFEST" "WARN" "No data manifest or checksum evidence found"
    fi
}

validate_seed_fixed() {
    local has_seed="${fields[SEED_FIXED]:-}"
    local session_id="${fields[SESSION_ID]:-unknown}"

    # Look for seed files or fixed values
    local seed_indicators=(
        "seed" "random" "sampling"
    )

    if [[ -n "$has_seed" ]] || [[ "$session_id" != "unknown" ]]; then
        set_result "SEED_FIXED" "PASS" "Randomness/sampling seed indicators found"
    else
        set_result "SEED_FIXED" "WARN" "No seed/randomness fixation evidence"
    fi
}

validate_standard_fields() {
    local has_standard="${fields[STANDARD_FIELDS]:-}"
    local run_id="${fields[RUN_ID]:-unknown}"
    local cost_usd="${fields[COST_USD]:-0.00}"
    local duration_ms="${fields[DURATION_MS]:-0}"

    # Check if key logging fields are present
    local field_count=0
    [[ "$run_id" != "unknown" ]] && ((field_count++))
    [[ "$cost_usd" != "0.00" ]] && ((field_count++))
    [[ "$duration_ms" != "0" ]] && ((field_count++))

    if [[ "$field_count" -ge 2 ]] || [[ -n "$has_standard" ]]; then
        set_result "STANDARD_FIELDS" "PASS" "Standard log fields present ($field_count/3 core fields)"
    else
        set_result "STANDARD_FIELDS" "WARN" "Minimal standard log fields found"
    fi
}

validate_orchestration_contract() {
    local has_contract="${fields[ORCHESTRATION_CONTRACT]:-}"
    local run_state="${fields[RUN_STATE]:-unknown}"

    # Check for state transitions or envelope patterns
    if [[ -n "$has_contract" ]] || [[ "$run_state" =~ (QUEUED|RUNNING|DONE|RETRYING) ]]; then
        set_result "ORCHESTRATION_CONTRACT" "PASS" "Contract/envelope patterns found"
    else
        set_result "ORCHESTRATION_CONTRACT" "WARN" "No orchestration contract evidence"
    fi
}

validate_orchestration_checkpoint() {
    local has_checkpoint="${fields[ORCHESTRATION_CHECKPOINT]:-}"

    # Check for checkpoint directory or restart capabilities
    local checkpoint_dir="$REPORTS_DIR/checkpoints"
    if [[ -d "$checkpoint_dir" ]] || [[ -n "$has_checkpoint" ]]; then
        set_result "ORCHESTRATION_CHECKPOINT" "PASS" "Checkpoint mechanisms present"
    else
        set_result "ORCHESTRATION_CHECKPOINT" "WARN" "No checkpoint evidence found"
    fi
}

validate_orchestration_policy() {
    local has_policy="${fields[ORCHESTRATION_POLICY]:-}"
    local cost_usd="${fields[COST_USD]:-0.00}"
    local panel_size="${fields[PANEL_SIZE]:-1}"

    # Check for per-agent policies or cost caps
    if [[ -n "$has_policy" ]] || [[ "$panel_size" -gt 1 ]]; then
        set_result "ORCHESTRATION_POLICY" "PASS" "Per-agent policy mechanisms present"
    else
        set_result "ORCHESTRATION_POLICY" "WARN" "No per-agent policy evidence"
    fi
}

validate_gate_mapping() {
    local gate_status="${fields[GATE_STATUS]:-}"
    local result="${fields[RESULT]:-unknown}"

    # Check for P0/P1/P2 gate mapping consistency
    if [[ -n "$gate_status" ]]; then
        case "$gate_status" in
            "PASS")
                [[ "$result" == "PASS" ]] && set_result "GATE_MAPPING" "PASS" "Gate status ($gate_status) matches result ($result)"
                [[ "$result" != "PASS" ]] && set_result "GATE_MAPPING" "WARN" "Gate status ($gate_status) vs result ($result) mismatch"
                ;;
            "FAIL")
                [[ "$result" == "FAIL" ]] && set_result "GATE_MAPPING" "PASS" "Gate status ($gate_status) matches result ($result)"
                [[ "$result" != "FAIL" ]] && set_result "GATE_MAPPING" "WARN" "Gate status ($gate_status) vs result ($result) mismatch"
                ;;
            *)
                set_result "GATE_MAPPING" "PASS" "Gate status found: $gate_status"
                ;;
        esac
    else
        set_result "GATE_MAPPING" "WARN" "No explicit gate mapping status found"
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
for check in "CASES_TOTAL" "FIELD_CONSISTENCY" "DLQ_RETRY_POLICY" "BUDGET_GUARD" "DATA_MANIFEST" "SEED_FIXED" "STANDARD_FIELDS"; do
    status="${results[$check]:-SKIP}"
    detail="${details[$check]:-No detail}"

    case "$status" in
        "PASS") icon="✅" ;;
        "WARN") icon="⚠️" ;;
        "FAIL") icon="❌" ;;
        *) icon="❓" ;;
    esac

    echo "- $icon **$check**: $detail" >> "$OUTPUT_MD"
done

cat >> "$OUTPUT_MD" << EOF

### Orchestration Layers (3)

EOF

for check in "ORCHESTRATION_CONTRACT" "ORCHESTRATION_CHECKPOINT" "ORCHESTRATION_POLICY"; do
    status="${results[$check]:-SKIP}"
    detail="${details[$check]:-No detail}"

    case "$status" in
        "PASS") icon="✅" ;;
        "WARN") icon="⚠️" ;;
        "FAIL") icon="❌" ;;
        *) icon="❓" ;;
    esac

    echo "- $icon **$check**: $detail" >> "$OUTPUT_MD"
done

cat >> "$OUTPUT_MD" << EOF

### Gate Mapping

- $([[ "${results[GATE_MAPPING]}" == "PASS" ]] && echo "✅" || echo "⚠️") **GATE_MAPPING**: ${details[GATE_MAPPING]:-No detail}

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
    bash scripts/preflight/validate_report.sh

    # Run smoke rehearsal
    bash scripts/preflight/smoke_rehearsal.sh

    # View this report
    open reports/preflight_check.md

---

*Generated by Preflight Validator v1.0*
*Target: Baseline v1.5 + 3-Layer Orchestration*
EOF

# Generate JSON report
cat > "$OUTPUT_JSON" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")",
  "source_report": "$REPORT_FILE",
  "overall_status": "$OVERALL_STATUS",
  "fail_count": $FAIL_COUNT,
  "warn_count": $WARN_COUNT,
  "results": {
EOF

# Add JSON results
first=true
for key in "${!results[@]}"; do
    [[ "$first" == true ]] && first=false || echo "," >> "$OUTPUT_JSON"
    echo -n "    \"$key\": {\"status\": \"${results[$key]}\", \"detail\": \"${details[$key]}\"}" >> "$OUTPUT_JSON"
done

cat >> "$OUTPUT_JSON" << EOF

  }
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