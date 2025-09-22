#!/usr/bin/env bash
set -euo pipefail

# Standalone session report reader
# Safely reads and displays session report information without relying on runtime variables

# Standard logging
ok()   { printf "\033[32m[OK]\033[0m %s\n" "$*"; }
warn() { printf "\033[33m[WARN]\033[0m %s\n" "$*"; }
fail() { printf "\033[31m[FAIL]\033[0m %s\n" "$*"; }

# Parse command line arguments
RUN_ID=""
FIELD=""
FORMAT="summary"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-id)
      if [[ $# -lt 2 ]]; then
        fail "--run-id requires a value"
        exit 1
      fi
      RUN_ID="$2"
      shift 2
      ;;
    --field)
      if [[ $# -lt 2 ]]; then
        fail "--field requires a value"
        exit 1
      fi
      FIELD="$2"
      shift 2
      ;;
    --format)
      if [[ $# -lt 2 ]]; then
        fail "--format requires a value"
        exit 1
      fi
      FORMAT="$2"
      shift 2
      ;;
    --help|-h)
      echo "Standalone Session Report Reader"
      echo "Usage: $0 [options]"
      echo ""
      echo "Options:"
      echo "  --run-id <id>    Read specific run ID from history"
      echo "  --field <name>   Extract specific field (e.g., CASES_TOTAL, RESULT)"
      echo "  --format <fmt>   Output format: summary|json|raw (default: summary)"
      echo ""
      echo "Examples:"
      echo "  $0                           # Show latest session summary"
      echo "  $0 --field CASES_TOTAL       # Extract CASES_TOTAL field"
      echo "  $0 --run-id 20250918_123456  # Show specific run"
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Determine which session report to read
REPORT_FILE=""
if [[ -n "$RUN_ID" ]]; then
  # Look for specific run in history
  HISTORY_PATTERN="reports/history/*${RUN_ID}*/session_report.md"
  FOUND_FILES=($HISTORY_PATTERN)
  if [[ ${#FOUND_FILES[@]} -eq 1 && -f "${FOUND_FILES[0]}" ]]; then
    REPORT_FILE="${FOUND_FILES[0]}"
  else
    fail "Run ID $RUN_ID not found in history"
    exit 1
  fi
else
  # Use latest session report
  if [[ -f "reports/session_report.md" ]]; then
    REPORT_FILE="reports/session_report.md"
  else
    fail "No session report found at reports/session_report.md"
    exit 1
  fi
fi

# Parse session report safely
parse_report_field() {
  local field_name="$1"
  local default_value="${2:-N/A}"

  if [[ ! -f "$REPORT_FILE" ]]; then
    echo "$default_value"
    return
  fi

  # Extract field from summary block
  local value
  value=$(grep "^$field_name:" "$REPORT_FILE" 2>/dev/null | cut -d: -f2- | sed 's/^ *//' | sed 's/ *$//' || echo "$default_value")

  if [[ -z "$value" ]]; then
    echo "$default_value"
  else
    echo "$value"
  fi
}

# Extract specific field if requested
if [[ -n "$FIELD" ]]; then
  parse_report_field "$FIELD"
  exit 0
fi

# Output based on format
case "$FORMAT" in
  "summary")
    echo "Session Report Summary (from $REPORT_FILE)"
    echo "----------------------------------------"
    echo "SESSION_ID:   $(parse_report_field SESSION_ID)"
    echo "RUN_ID:       $(parse_report_field RUN_ID)"
    echo "TARGET:       $(parse_report_field TARGET)"
    echo "RESULT:       $(parse_report_field RESULT)"
    echo "CASES_TOTAL:  $(parse_report_field CASES_TOTAL)"
    echo "COST_USD:     $(parse_report_field COST_USD)"
    echo "DURATION_MS:  $(parse_report_field DURATION_MS)"
    echo "DRY_RUN:      $(parse_report_field DRY_RUN)"
    echo "WARNINGS:     $(parse_report_field WARNINGS)"
    ;;
  "json")
    # Output as JSON
    cat <<EOF
{
  "session_id": "$(parse_report_field SESSION_ID)",
  "run_id": "$(parse_report_field RUN_ID)",
  "target": "$(parse_report_field TARGET)",
  "result": "$(parse_report_field RESULT)",
  "cases_total": "$(parse_report_field CASES_TOTAL)",
  "cost_usd": "$(parse_report_field COST_USD)",
  "duration_ms": "$(parse_report_field DURATION_MS)",
  "dry_run": "$(parse_report_field DRY_RUN)",
  "warnings": "$(parse_report_field WARNINGS)"
}
EOF
    ;;
  "raw")
    # Output raw file contents
    cat "$REPORT_FILE"
    ;;
  *)
    fail "Unknown format: $FORMAT"
    exit 1
    ;;
esac

ok "Session report read successfully"