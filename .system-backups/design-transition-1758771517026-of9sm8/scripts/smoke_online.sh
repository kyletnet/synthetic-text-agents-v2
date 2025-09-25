#!/usr/bin/env bash
# P1: Minimal Online Smoke Test
# Verifies online path with minimal cost/token usage

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

info() { echo -e "${BLUE}[SMOKE-ONLINE]${NC} $*"; }
warn() { echo -e "${YELLOW}[SMOKE-ONLINE]${NC} $*"; }
ok() { echo -e "${GREEN}[SMOKE-ONLINE]${NC} $*"; }
fail() { echo -e "${RED}[SMOKE-ONLINE]${NC} $*"; }

# Configuration - minimal costs for verification
TARGET="${1:-step4_2}"
BUDGET="${2:-0.05}"
PROFILE="${3:-stage}"

info "🌐 Running minimal online smoke test..."
info "Target: $TARGET"
info "Budget: $BUDGET USD (minimal)"
info "Profile: $PROFILE"
echo

# Verify environment
if [[ -z "${ANTHROPIC_API_KEY:-}" && -z "${ANTHROPIC_API_KEYS:-}" ]]; then
  fail "No API key configured for online testing"
  fail "Set ANTHROPIC_API_KEY or ANTHROPIC_API_KEYS environment variable"
  exit 1
fi

# Set online mode explicitly
export OFFLINE_MODE=false
export DRY_RUN=false

# Run the launcher with minimal settings
info "Executing: ./run_v3.sh $TARGET --smoke --budget $BUDGET --profile $PROFILE"
echo

if ./run_v3.sh "$TARGET" --smoke --budget "$BUDGET" --profile "$PROFILE"; then
  ok "✅ Online smoke test PASSED"
  echo

  # Verify session report shows online mode
  if [[ -f reports/session_report.md ]]; then
    local offline_mode
    offline_mode=$(grep "^OFFLINE_MODE:" reports/session_report.md | cut -d' ' -f2)
    local dry_run
    dry_run=$(grep "^DRY_RUN:" reports/session_report.md | cut -d' ' -f2)

    if [[ "$offline_mode" == "false" && "$dry_run" == "false" ]]; then
      ok "✅ Session report confirms online mode (OFFLINE_MODE=false, DRY_RUN=false)"
    else
      warn "⚠️  Session report shows unexpected mode: OFFLINE_MODE=$offline_mode, DRY_RUN=$dry_run"
    fi

    # Show key metrics
    info "📊 Session Metrics:"
    grep -E "^(COST_USD|DURATION_MS|RESULT|RUNTIME_GUARDS):" reports/session_report.md | sed 's/^/  /'
  fi

  echo
  ok "🎉 Online smoke test verification completed successfully"
  exit 0
else
  fail "❌ Online smoke test FAILED"
  echo

  if [[ -f reports/session_report.md ]]; then
    fail "📋 Session Report (last 10 lines):"
    tail -10 reports/session_report.md | sed 's/^/  /'
  fi

  exit 1
fi