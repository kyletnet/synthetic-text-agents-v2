#!/usr/bin/env bash
# P1: Dead Letter Queue (DLQ) Manager
# Manages failed runs for retry and analysis

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[DLQ]${NC} $*"; }
warn() { echo -e "${YELLOW}[DLQ]${NC} $*"; }
ok() { echo -e "${GREEN}[DLQ]${NC} $*"; }
fail() { echo -e "${RED}[DLQ]${NC} $*"; }

DLQ_DIR="DLQ"
MAX_RETRIES=3

# Show DLQ status
show_dlq_status() {
  info "DLQ Status Report"
  echo

  if [[ ! -d "$DLQ_DIR" ]] || [[ -z "$(ls -A "$DLQ_DIR" 2>/dev/null || true)" ]]; then
    ok "DLQ is empty - no failed runs"
    return 0
  fi

  local total_entries=$(ls -1 "$DLQ_DIR" | wc -l | xargs)
  info "Total failed runs in DLQ: $total_entries"
  echo

  info "Failed runs (newest first):"
  ls -lt "$DLQ_DIR" | head -10 | while read -r line; do
    echo "  $line"
  done

  echo
  info "DLQ disk usage: $(du -sh "$DLQ_DIR" 2>/dev/null | cut -f1)"
}

# Retry a specific DLQ entry
retry_dlq_entry() {
  local dlq_entry="$1"
  local dlq_path="$DLQ_DIR/$dlq_entry"

  if [[ ! -d "$dlq_path" ]]; then
    fail "DLQ entry not found: $dlq_entry"
    return 1
  fi

  info "Retrying DLQ entry: $dlq_entry"

  # Check retry count
  local retry_count=0
  if [[ -f "$dlq_path/retry_count" ]]; then
    retry_count=$(cat "$dlq_path/retry_count")
  fi

  if [[ $retry_count -ge $MAX_RETRIES ]]; then
    warn "Maximum retries ($MAX_RETRIES) exceeded for: $dlq_entry"
    warn "Moving to permanent failure directory"

    mkdir -p "DLQ/permanent_failures"
    mv "$dlq_path" "DLQ/permanent_failures/"
    return 1
  fi

  # Increment retry count
  echo $((retry_count + 1)) > "$dlq_path/retry_count"

  # Extract original run parameters from DLQ metadata
  local original_target="unknown"
  local original_mode="smoke"
  local original_budget="0.00"

  if [[ -f "$dlq_path/metadata" ]]; then
    source "$dlq_path/metadata"
  fi

  # Retry the run with --retry flag
  info "Retrying with: target=$original_target mode=$original_mode budget=$original_budget"

  # Set environment variables for retry
  export RETRY_FROM_DLQ=true
  export RETRY_DLQ_ENTRY="$dlq_entry"
  export RETRY_COUNT=$((retry_count + 1))
  export RUN_STATE="QUEUED"  # Reset state for retry

  if ./run_v3.sh "$original_target" --"$original_mode" --budget "$original_budget" --retry; then
    ok "DLQ retry successful for: $dlq_entry"
    # Remove from DLQ on success
    rm -rf "$dlq_path"
    return 0
  else
    warn "DLQ retry failed for: $dlq_entry (attempt $((retry_count + 1))/$MAX_RETRIES)"
    return 1
  fi
}

# Retry all DLQ entries
retry_all_dlq() {
  info "Retrying all DLQ entries"

  if [[ ! -d "$DLQ_DIR" ]] || [[ -z "$(ls -A "$DLQ_DIR" 2>/dev/null || true)" ]]; then
    ok "No DLQ entries to retry"
    return 0
  fi

  local success_count=0
  local failure_count=0

  # Process entries from oldest to newest
  ls -t "$DLQ_DIR" | tail -r | while read -r entry; do
    # Skip permanent failures directory
    [[ "$entry" == "permanent_failures" ]] && continue

    if retry_dlq_entry "$entry"; then
      ((success_count++))
    else
      ((failure_count++))
    fi

    # Add delay between retries to avoid overwhelming the system
    sleep 2
  done

  echo
  info "DLQ retry summary:"
  info "  Successful: $success_count"
  info "  Failed: $failure_count"
}

# Clean old DLQ entries
clean_dlq() {
  local days_old="${1:-7}"

  info "Cleaning DLQ entries older than $days_old days"

  if [[ ! -d "$DLQ_DIR" ]]; then
    ok "No DLQ directory to clean"
    return 0
  fi

  local cleaned_count=0
  find "$DLQ_DIR" -maxdepth 1 -type d -mtime +$days_old | while read -r old_entry; do
    # Don't clean the DLQ root directory itself
    [[ "$old_entry" == "$DLQ_DIR" ]] && continue

    info "Removing old DLQ entry: $(basename "$old_entry")"
    rm -rf "$old_entry"
    ((cleaned_count++))
  done

  ok "Cleaned $cleaned_count old DLQ entries"
}

# Add a run to DLQ (called by run_v3.sh)
add_to_dlq() {
  local run_id="$1"
  local target="$2"
  local mode="$3"
  local budget="$4"
  local error_reason="$5"

  local dlq_entry="failed_$(date +%Y%m%d_%H%M%S)_${run_id}"
  local dlq_path="$DLQ_DIR/$dlq_entry"

  mkdir -p "$dlq_path"

  # Store metadata for retry
  cat > "$dlq_path/metadata" <<EOF
original_target="$target"
original_mode="$mode"
original_budget="$budget"
error_reason="$error_reason"
failed_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
run_id="$run_id"
EOF

  # Initialize retry count
  echo "0" > "$dlq_path/retry_count"

  info "Added to DLQ: $dlq_entry (reason: $error_reason)"
}

# Show help
show_help() {
  cat <<EOF
DLQ Manager - Dead Letter Queue for Failed Runs

USAGE:
  $0 [COMMAND] [OPTIONS]

COMMANDS:
  status              Show DLQ status and failed runs
  retry <entry>       Retry a specific DLQ entry
  retry-all           Retry all DLQ entries
  clean [days]        Clean DLQ entries older than N days (default: 7)
  add <run_id> <target> <mode> <budget> <reason>
                      Add a run to DLQ (internal use)

EXAMPLES:
  $0 status
  $0 retry failed_20250917_090000_12345
  $0 retry-all
  $0 clean 14

EXIT CODES:
  0 - Success
  1 - General error
  2 - DLQ entry not found or max retries exceeded

EOF
}

# Main execution
main() {
  case "${1:-status}" in
    status)
      show_dlq_status
      ;;
    retry)
      if [[ $# -lt 2 ]]; then
        fail "retry command requires DLQ entry name"
        show_help
        exit 1
      fi
      retry_dlq_entry "$2"
      ;;
    retry-all)
      retry_all_dlq
      ;;
    clean)
      clean_dlq "${2:-7}"
      ;;
    add)
      if [[ $# -lt 6 ]]; then
        fail "add command requires: run_id target mode budget reason"
        exit 1
      fi
      add_to_dlq "$2" "$3" "$4" "$5" "$6"
      ;;
    help|--help|-h)
      show_help
      ;;
    *)
      fail "Unknown command: $1"
      show_help
      exit 1
      ;;
  esac
}

# Only run if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi