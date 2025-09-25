#!/usr/bin/env bash
# P0 Security: Safe Snapshot Commit with Session Report Integration
# BSD-compatible for macOS, includes comprehensive guards and session metadata

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }

# Find git root
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

info "Starting safe snapshot commit process..."

# Step 1: Pre-commit guards (comprehensive validation)
info "Running comprehensive security and quality guards..."

GUARD_COMMANDS=(
  "npm run guard:git"
  "npm run guard:no-direct-http"
  "npm run guard:toolchain"
  "npm run schema"
  "npm run regression:mini"
)

for cmd in "${GUARD_COMMANDS[@]}"; do
  info "Executing: $cmd"
  if ! $cmd; then
    fail "Guard failed: $cmd"
    fail "Snapshot commit BLOCKED - fix issues above before proceeding"
    exit 1
  fi
  ok "Guard passed: $cmd"
done

ok "All pre-commit guards passed successfully"

# Step 2: Extract session metadata from latest session report (BSD-compatible)
info "Extracting session metadata from reports/session_report.md..."

SESSION_REPORT="reports/session_report.md"
TARGET="unknown"
MODE="unknown"
PROFILE="dev"
RESULT="n/a"
TRACE_ID="n/a"
RUN_ID="n/a"
COST_USD="0.00"
DURATION_MS="0"

if [[ -f "$SESSION_REPORT" ]]; then
  # Use BSD-compatible grep and sed to extract values
  TARGET=$(grep "^TARGET:" "$SESSION_REPORT" 2>/dev/null | head -1 | sed 's/TARGET: *//' || echo "unknown")
  MODE=$(grep "^MODE:" "$SESSION_REPORT" 2>/dev/null | head -1 | sed 's/MODE: *//' || echo "unknown")
  PROFILE=$(grep "^PROFILE:" "$SESSION_REPORT" 2>/dev/null | head -1 | sed 's/PROFILE: *//' || echo "dev")
  RESULT=$(grep "^RESULT:" "$SESSION_REPORT" 2>/dev/null | head -1 | sed 's/RESULT: *//' || echo "n/a")
  TRACE_ID=$(grep "^TRACE_ID:" "$SESSION_REPORT" 2>/dev/null | head -1 | sed 's/TRACE_ID: *//' || echo "n/a")
  RUN_ID=$(grep "^RUN_ID:" "$SESSION_REPORT" 2>/dev/null | head -1 | sed 's/RUN_ID: *//' || echo "n/a")
  COST_USD=$(grep "^COST_USD:" "$SESSION_REPORT" 2>/dev/null | head -1 | sed 's/COST_USD: *//' || echo "0.00")
  DURATION_MS=$(grep "^DURATION_MS:" "$SESSION_REPORT" 2>/dev/null | head -1 | sed 's/DURATION_MS: *//' || echo "0")

  ok "Session metadata extracted:"
  info "  TARGET: $TARGET"
  info "  MODE: $MODE"
  info "  PROFILE: $PROFILE"
  info "  RESULT: $RESULT"
  info "  RUN_ID: $RUN_ID"
  info "  COST_USD: $COST_USD"
  info "  DURATION_MS: $DURATION_MS"
  info "  TRACE_ID: $TRACE_ID"
else
  warn "Session report not found, using default values"
fi

# Step 3: Stage all changes
info "Staging all changes for commit..."
git add -A

# Check if there are any changes to commit
if git diff --cached --quiet; then
  warn "No changes to commit - repository is already up to date"
  exit 0
fi

# Show what will be committed
info "Changes to be committed:"
git diff --cached --name-only | sed 's/^/    /'

# Step 4: Create standardized commit message
COMMIT_MSG="p1-snapshot-$(date +%Y%m%d%H%M%S): ${TARGET} ${MODE} result=${RESULT}

RUN_ID: ${RUN_ID}
COST_USD: ${COST_USD}
DURATION_MS: ${DURATION_MS}
TRACE_ID: ${TRACE_ID}

🛡️ P1 Full Implementation guards passed:
- Git security and secret scanning ✅
- Direct HTTP call enforcement ✅
- Toolchain version compliance ✅
- Schema validation ✅
- Regression testing (25 cases) ✅

🤖 Generated with P1 Enhanced System"

info "Commit message:"
echo "$COMMIT_MSG" | sed 's/^/    /'

# Step 5: Create commit
info "Creating commit..."
git commit -m "$COMMIT_MSG"

COMMIT_HASH=$(git rev-parse HEAD)
ok "Commit created: $COMMIT_HASH"

# Step 6: Create timestamped tag
TAG_NAME="p0p1-hygiene-$(date +%Y%m%d%H%M%S)"
info "Creating tag: $TAG_NAME"
git tag -a "$TAG_NAME" -m "P0→P1 bridge hygiene snapshot

Target: $TARGET
Mode: $MODE
Profile: $PROFILE
Result: $RESULT
Trace: $TRACE_ID
Commit: $COMMIT_HASH

Security validation passed:
✅ Secret scanning
✅ HTTP call enforcement
✅ Schema validation
✅ Regression testing"

ok "Tag created: $TAG_NAME"

# Step 7: Next steps guidance
echo
ok "Snapshot commit completed successfully!"
echo
info "NEXT STEPS:"
echo "  1. Review the commit and tag created:"
echo "     git show --stat"
echo "     git tag -l | tail -5"
echo
echo "  2. Push to remote repository:"
echo "     git push"
echo "     git push --tags"
echo
echo "  3. Verify CI pipeline passes:"
echo "     # Check GitHub Actions after push"
echo
echo "  4. Optional: Run final validation trio:"
echo "     ./run_v3.sh --help | sed -n '1,120p'"
echo "     ./run_v3.sh step4_2 --smoke --offline"
echo "     npm run guard:no-direct-http && npm run guard:prod"

# Final security reminder
echo
warn "SECURITY REMINDER:"
echo "  - Review .backup_quarantine/ contents before secure deletion"
echo "  - Rotate any API keys if secrets were found during cleanup"
echo "  - Monitor CI pipeline for any unexpected failures"

exit 0