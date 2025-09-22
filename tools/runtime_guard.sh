#!/usr/bin/env bash
# P1: Runtime Guards - Concurrency, QPS, Budget Limits & Killswitch
# Enforces runtime policies to prevent resource exhaustion and cost overruns

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

info() { echo -e "${BLUE}[GUARD]${NC} $*"; }
warn() { echo -e "${YELLOW}[GUARD]${NC} $*"; }
ok() { echo -e "${GREEN}[GUARD]${NC} $*"; }
fail() { echo -e "${RED}[GUARD]${NC} $*"; }

# Runtime guard configuration
GUARD_DIR="runtime_guards"
CONCURRENCY_LIMIT="${CONCURRENCY_LIMIT:-3}"
QPS_LIMIT="${QPS_LIMIT:-5}"
DAILY_BUDGET_LIMIT="${DAILY_BUDGET_LIMIT:-50.00}"
KILLSWITCH_FILE="$GUARD_DIR/killswitch"
CONCURRENCY_FILE="$GUARD_DIR/active_runs"
QPS_FILE="$GUARD_DIR/qps_tracker"
BUDGET_FILE="$GUARD_DIR/daily_budget"

# Initialize guard directories
setup_runtime_guards() {
  mkdir -p "$GUARD_DIR"

  # Initialize files if they don't exist
  [[ ! -f "$CONCURRENCY_FILE" ]] && echo "0" > "$CONCURRENCY_FILE"
  [[ ! -f "$QPS_FILE" ]] && echo "$(date +%s):0" > "$QPS_FILE"
  [[ ! -f "$BUDGET_FILE" ]] && echo "$(date +%Y-%m-%d):0.00" > "$BUDGET_FILE"

  info "Runtime guards initialized"
}

# Check killswitch status
check_killswitch() {
  if [[ -f "$KILLSWITCH_FILE" ]]; then
    local reason
    reason=$(cat "$KILLSWITCH_FILE" 2>/dev/null || echo "emergency_stop")
    fail "🔴 KILLSWITCH ACTIVATED: $reason"
    fail "All runs are blocked. Remove $KILLSWITCH_FILE to resume operations."
    return 1
  fi
  return 0
}

# Activate killswitch
activate_killswitch() {
  local reason="${1:-manual_activation}"
  echo "$reason" > "$KILLSWITCH_FILE"
  fail "🔴 KILLSWITCH ACTIVATED: $reason"

  # Kill all active runs
  info "Terminating all active runs..."
  pkill -f "run_v3.sh" || true
  pkill -f "step4_2" || true

  # Reset concurrency counter
  echo "0" > "$CONCURRENCY_FILE"

  warn "All operations halted. Manual intervention required."
}

# Deactivate killswitch
deactivate_killswitch() {
  if [[ -f "$KILLSWITCH_FILE" ]]; then
    local reason
    reason=$(cat "$KILLSWITCH_FILE" 2>/dev/null || echo "unknown")
    rm -f "$KILLSWITCH_FILE"
    ok "🟢 KILLSWITCH DEACTIVATED (was: $reason)"
  else
    warn "Killswitch was not active"
  fi
}

# Check and enforce concurrency limits
check_concurrency() {
  local current_runs
  current_runs=$(cat "$CONCURRENCY_FILE" 2>/dev/null || echo "0")

  if [[ $current_runs -ge $CONCURRENCY_LIMIT ]]; then
    fail "Concurrency limit exceeded: $current_runs/$CONCURRENCY_LIMIT active runs"
    return 1
  fi

  return 0
}

# Increment concurrency counter
increment_concurrency() {
  local current_runs
  current_runs=$(cat "$CONCURRENCY_FILE" 2>/dev/null || echo "0")
  echo $((current_runs + 1)) > "$CONCURRENCY_FILE"
  info "Concurrency: $((current_runs + 1))/$CONCURRENCY_LIMIT active runs"
}

# Decrement concurrency counter
decrement_concurrency() {
  local current_runs
  current_runs=$(cat "$CONCURRENCY_FILE" 2>/dev/null || echo "0")
  local new_count=$((current_runs - 1))
  [[ $new_count -lt 0 ]] && new_count=0
  echo "$new_count" > "$CONCURRENCY_FILE"
  info "Concurrency: $new_count/$CONCURRENCY_LIMIT active runs"
}

# Check and enforce QPS limits
check_qps() {
  local now=$(date +%s)
  local qps_data
  qps_data=$(cat "$QPS_FILE" 2>/dev/null || echo "$now:0")

  local last_timestamp="${qps_data%:*}"
  local request_count="${qps_data#*:}"

  # Reset counter if we're in a new second
  if [[ $now -ne $last_timestamp ]]; then
    echo "$now:1" > "$QPS_FILE"
    return 0
  fi

  # Check if we've exceeded QPS limit
  if [[ $request_count -ge $QPS_LIMIT ]]; then
    fail "QPS limit exceeded: $request_count/$QPS_LIMIT requests in current second"
    return 1
  fi

  # Increment request count
  echo "$now:$((request_count + 1))" > "$QPS_FILE"
  return 0
}

# Check and enforce daily budget limits
check_daily_budget() {
  local cost="${1:-0.00}"
  local today=$(date +%Y-%m-%d)
  local budget_data
  budget_data=$(cat "$BUDGET_FILE" 2>/dev/null || echo "$today:0.00")

  local budget_date="${budget_data%:*}"
  local current_spend="${budget_data#*:}"

  # Reset budget if it's a new day
  if [[ "$today" != "$budget_date" ]]; then
    echo "$today:$cost" > "$BUDGET_FILE"
    return 0
  fi

  # Calculate new total spend
  local new_spend
  new_spend=$(echo "$current_spend + $cost" | bc -l 2>/dev/null || echo "$cost")

  # Check if adding this cost would exceed daily limit
  if (( $(echo "$new_spend > $DAILY_BUDGET_LIMIT" | bc -l) )); then
    fail "Daily budget exceeded: \$${new_spend} > \$${DAILY_BUDGET_LIMIT}"

    # Trigger killswitch on budget exceed
    activate_killswitch "daily_budget_exceeded_${new_spend}_USD"
    return 1
  fi

  # Update budget tracking
  echo "$today:$new_spend" > "$BUDGET_FILE"
  info "Daily budget: \$${new_spend}/\$${DAILY_BUDGET_LIMIT} (${cost} added)"

  return 0
}

# Comprehensive runtime guard check
enforce_runtime_guards() {
  local estimated_cost="${1:-0.00}"
  local skip_offline="${2:-false}"

  setup_runtime_guards

  info "Enforcing runtime guards (cost=$estimated_cost, offline_mode=${OFFLINE_MODE:-false})"

  # Skip all guards in offline mode except killswitch
  if [[ "${OFFLINE_MODE:-false}" == "true" && "$skip_offline" != "true" ]]; then
    check_killswitch
    ok "Offline mode - runtime guards bypassed except killswitch"
    return 0
  fi

  # Check killswitch first
  if ! check_killswitch; then
    return 1
  fi

  # Check concurrency limits
  if ! check_concurrency; then
    warn "Consider waiting for active runs to complete or increasing CONCURRENCY_LIMIT"
    return 1
  fi

  # Check QPS limits
  if ! check_qps; then
    warn "Rate limit exceeded - wait 1 second and retry"
    return 1
  fi

  # Check daily budget
  if ! check_daily_budget "$estimated_cost"; then
    return 1
  fi

  # All guards passed - increment concurrency
  increment_concurrency

  ok "All runtime guards passed - execution approved"
  return 0
}

# Monitor for emergency conditions and auto-activate killswitch
emergency_monitor() {
  local duration="${1:-300}"  # Monitor for 5 minutes by default
  local start_time=$(date +%s)

  info "Starting emergency monitor for ${duration}s"

  while true; do
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))

    # Exit if duration exceeded
    [[ $elapsed -gt $duration ]] && break

    # Check for emergency conditions
    local high_load=false
    local budget_critical=false

    # Check system load
    if command -v uptime >/dev/null 2>&1; then
      local load
      load=$(uptime | grep -o 'load average:.*' | cut -d' ' -f3 | cut -d',' -f1)
      if (( $(echo "$load > 4.0" | bc -l 2>/dev/null || echo "0") )); then
        high_load=true
      fi
    fi

    # Check budget proximity
    local today=$(date +%Y-%m-%d)
    local budget_data
    budget_data=$(cat "$BUDGET_FILE" 2>/dev/null || echo "$today:0.00")
    local current_spend="${budget_data#*:}"

    if (( $(echo "$current_spend > ($DAILY_BUDGET_LIMIT * 0.8)" | bc -l 2>/dev/null || echo "0") )); then
      budget_critical=true
    fi

    # Activate killswitch if emergency detected
    if [[ "$high_load" == "true" ]]; then
      activate_killswitch "high_system_load_${load}"
      break
    fi

    if [[ "$budget_critical" == "true" ]]; then
      warn "Budget critical: \$${current_spend}/\$${DAILY_BUDGET_LIMIT} (80% threshold)"
    fi

    # Brief sleep before next check
    sleep 10
  done

  info "Emergency monitor completed"
}

# Show guard status
show_guard_status() {
  info "Runtime Guard Status Report"
  echo

  setup_runtime_guards

  # Killswitch status
  if [[ -f "$KILLSWITCH_FILE" ]]; then
    local reason
    reason=$(cat "$KILLSWITCH_FILE" 2>/dev/null || echo "unknown")
    fail "🔴 Killswitch: ACTIVE ($reason)"
  else
    ok "🟢 Killswitch: INACTIVE"
  fi

  # Concurrency status
  local current_runs
  current_runs=$(cat "$CONCURRENCY_FILE" 2>/dev/null || echo "0")
  info "🔄 Concurrency: $current_runs/$CONCURRENCY_LIMIT active runs"

  # QPS status
  local qps_data
  qps_data=$(cat "$QPS_FILE" 2>/dev/null || echo "$(date +%s):0")
  local request_count="${qps_data#*:}"
  info "⚡ QPS: $request_count/$QPS_LIMIT requests/second"

  # Budget status
  local today=$(date +%Y-%m-%d)
  local budget_data
  budget_data=$(cat "$BUDGET_FILE" 2>/dev/null || echo "$today:0.00")
  local current_spend="${budget_data#*:}"
  local budget_percentage
  budget_percentage=$(echo "scale=1; $current_spend * 100 / $DAILY_BUDGET_LIMIT" | bc -l 2>/dev/null || echo "0")
  info "💰 Daily Budget: \$${current_spend}/\$${DAILY_BUDGET_LIMIT} (${budget_percentage}%)"

  echo

  # Active processes
  local active_processes
  active_processes=$(pgrep -f "run_v3.sh" | wc -l | xargs)
  info "Active processes: $active_processes"

  if [[ $active_processes -gt 0 ]]; then
    info "Running processes:"
    pgrep -f "run_v3.sh" | while read -r pid; do
      ps -p "$pid" -o pid,ppid,etime,command --no-headers | sed 's/^/  /'
    done
  fi
}

# Reset all guards
reset_guards() {
  info "Resetting all runtime guards"

  # Remove killswitch
  rm -f "$KILLSWITCH_FILE"

  # Reset counters
  echo "0" > "$CONCURRENCY_FILE"
  echo "$(date +%s):0" > "$QPS_FILE"
  echo "$(date +%Y-%m-%d):0.00" > "$BUDGET_FILE"

  ok "All guards reset to initial state"
}

# Show help
show_help() {
  cat <<EOF
Runtime Guards - Resource and Budget Protection

USAGE:
  $0 [COMMAND] [OPTIONS]

COMMANDS:
  enforce [cost]      Enforce all runtime guards (default cost: 0.00)
  status              Show current guard status
  killswitch on|off  Activate/deactivate emergency killswitch
  reset               Reset all guards to initial state
  monitor [duration]  Monitor for emergency conditions (default: 300s)
  decrement           Decrement concurrency counter (cleanup)

EXAMPLES:
  $0 enforce 0.25     # Check guards for a \$0.25 operation
  $0 status           # Show current status
  $0 killswitch on    # Emergency stop all operations
  $0 reset            # Reset all counters

ENVIRONMENT VARIABLES:
  CONCURRENCY_LIMIT     Max parallel runs (default: 3)
  QPS_LIMIT            Max requests per second (default: 5)
  DAILY_BUDGET_LIMIT   Max daily spend in USD (default: 50.00)
  OFFLINE_MODE         Skip resource guards (default: false)

EXIT CODES:
  0 - Guards passed / operation successful
  1 - Guards failed / killswitch active
  2 - Configuration error

EOF
}

# Main execution
main() {
  case "${1:-status}" in
    enforce)
      enforce_runtime_guards "${2:-0.00}"
      ;;
    status)
      show_guard_status
      ;;
    killswitch)
      case "${2:-}" in
        on|activate)
          activate_killswitch "${3:-manual_activation}"
          ;;
        off|deactivate)
          deactivate_killswitch
          ;;
        *)
          if [[ -f "$KILLSWITCH_FILE" ]]; then
            fail "Killswitch is ACTIVE"
            exit 1
          else
            ok "Killswitch is INACTIVE"
          fi
          ;;
      esac
      ;;
    reset)
      reset_guards
      ;;
    monitor)
      emergency_monitor "${2:-300}"
      ;;
    decrement)
      decrement_concurrency
      ;;
    help|--help|-h)
      show_help
      ;;
    *)
      fail "Unknown command: $1"
      show_help
      exit 2
      ;;
  esac
}

# Only run if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi