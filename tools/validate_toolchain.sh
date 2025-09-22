#!/usr/bin/env bash
# P1: Toolchain Version Guard
# Quick validation for CI/development environment consistency

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

info() { echo -e "${BLUE}[TOOLCHAIN-GUARD]${NC} $*"; }
warn() { echo -e "${YELLOW}[TOOLCHAIN-GUARD]${NC} $*"; }
ok() { echo -e "${GREEN}[TOOLCHAIN-GUARD]${NC} $*"; }
fail() { echo -e "${RED}[TOOLCHAIN-GUARD]${NC} $*"; }

# Parse arguments
STRICT_MODE=false
QUIET_MODE=false

for arg in "$@"; do
  case "$arg" in
    --strict) STRICT_MODE=true ;;
    --quiet)  QUIET_MODE=true ;;
    --help)
      cat <<EOF
Toolchain Version Guard - Quick CI/Development Environment Validation

USAGE:
  $0 [--strict] [--quiet]

OPTIONS:
  --strict    Exit with non-zero on any version mismatch
  --quiet     Suppress informational output

DESCRIPTION:
  Validates Node.js version against .nvmrc for consistency.
  In strict mode, fails CI/builds on version mismatches.
  In normal mode, provides warnings and guidance.

EXAMPLES:
  $0                    # Development mode - warnings only
  $0 --strict           # CI mode - fail on mismatch
  $0 --quiet --strict   # CI mode - minimal output

EXIT CODES:
  0 - All versions match or non-strict mode
  1 - Version mismatch in strict mode
EOF
      exit 0
      ;;
  esac
done

# Validation functions
validate_node_version() {
  if [[ ! -f ".nvmrc" ]]; then
    if [[ "$QUIET_MODE" != "true" ]]; then
      warn "No .nvmrc file found - skipping Node.js version validation"
    fi
    return 0
  fi

  local required_node
  required_node=$(cat .nvmrc | tr -d '\n\r')

  if ! command -v node >/dev/null 2>&1; then
    fail "Node.js not found. Please install Node.js $required_node"
    if [[ "$STRICT_MODE" == "true" ]]; then
      return 1
    fi
    return 0
  fi

  local current_node
  current_node=$(node --version | sed 's/^v//')

  # Simple version comparison (assumes semantic versioning)
  if [[ "$current_node" != "$required_node"* ]]; then
    fail "Node.js version mismatch:"
    fail "  Current: $current_node"
    fail "  Required: $required_node (from .nvmrc)"
    echo
    fail "🔧 To fix this issue:"
    fail "  1. Install nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    fail "  2. Reload shell: source ~/.bashrc (or restart terminal)"
    fail "  3. Use correct version: nvm use"
    fail "  4. Install dependencies: npm ci"
    echo

    if [[ "$STRICT_MODE" == "true" ]]; then
      fail "❌ STRICT MODE: Toolchain validation FAILED"
      return 1
    else
      warn "⚠️  Continuing in development mode despite version mismatch"
      return 0
    fi
  fi

  if [[ "$QUIET_MODE" != "true" ]]; then
    ok "Node.js version: $current_node ✓"
  fi
  return 0
}

# Main validation
main() {
  local exit_code=0

  if [[ "$QUIET_MODE" != "true" ]]; then
    info "🔍 Validating toolchain versions..."
  fi

  if ! validate_node_version; then
    exit_code=1
  fi

  if [[ $exit_code -eq 0 ]]; then
    if [[ "$QUIET_MODE" != "true" ]]; then
      ok "🎉 Toolchain validation PASSED"
    fi
  else
    fail "💥 Toolchain validation FAILED"
  fi

  return $exit_code
}

# Only run if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi