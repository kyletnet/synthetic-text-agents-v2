#!/usr/bin/env bash
# P1: Toolchain Version Validation
# Ensures all development tools are pinned to compatible versions

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

info() { echo -e "${BLUE}[TOOLCHAIN]${NC} $*"; }
warn() { echo -e "${YELLOW}[TOOLCHAIN]${NC} $*"; }
ok() { echo -e "${GREEN}[TOOLCHAIN]${NC} $*"; }
fail() { echo -e "${RED}[TOOLCHAIN]${NC} $*"; }

# Version requirements
REQUIRED_NODE="18.18.0"
REQUIRED_NPM="8.19.0"
REQUIRED_PYTHON="3.9"

# Validation functions
validate_node() {
  info "Validating Node.js version..."

  if ! command -v node >/dev/null 2>&1; then
    fail "Node.js not found. Please install Node.js $REQUIRED_NODE"
    return 1
  fi

  local current_node
  current_node=$(node --version | sed 's/^v//')
  local required_node="$REQUIRED_NODE"

  # Check .nvmrc if it exists
  if [[ -f ".nvmrc" ]]; then
    required_node=$(cat .nvmrc)
    info "Using .nvmrc version: $required_node"
  fi

  # Simple version comparison (assumes semantic versioning)
  if [[ "$current_node" != "$required_node"* ]]; then
    warn "Node.js version mismatch:"
    warn "  Current: $current_node"
    warn "  Required: $required_node"
    warn "  Consider: nvm use $required_node"
    return 1
  fi

  ok "Node.js version: $current_node ✓"
  return 0
}

validate_npm() {
  info "Validating npm version..."

  if ! command -v npm >/dev/null 2>&1; then
    fail "npm not found. Please install npm $REQUIRED_NPM or higher"
    return 1
  fi

  local current_npm
  current_npm=$(npm --version)

  # Extract major.minor version for comparison
  local current_major_minor
  current_major_minor=$(echo "$current_npm" | cut -d. -f1-2)
  local required_major_minor
  required_major_minor=$(echo "$REQUIRED_NPM" | cut -d. -f1-2)

  if ! printf '%s\n' "$required_major_minor" "$current_major_minor" | sort -V -C; then
    warn "npm version may be too old:"
    warn "  Current: $current_npm"
    warn "  Required: >=$REQUIRED_NPM"
    return 1
  fi

  ok "npm version: $current_npm ✓"
  return 0
}

validate_python() {
  info "Validating Python version..."

  local python_cmd=""
  for cmd in python3 python; do
    if command -v "$cmd" >/dev/null 2>&1; then
      python_cmd="$cmd"
      break
    fi
  done

  if [[ -z "$python_cmd" ]]; then
    fail "Python not found. Please install Python $REQUIRED_PYTHON or higher"
    return 1
  fi

  local current_python
  current_python=$($python_cmd --version 2>&1 | awk '{print $2}')

  # Check .python-version if it exists
  local required_python="$REQUIRED_PYTHON"
  if [[ -f ".python-version" ]]; then
    required_python=$(cat .python-version)
    info "Using .python-version: $required_python"
  fi

  # Extract major.minor version for comparison
  local current_major_minor
  current_major_minor=$(echo "$current_python" | cut -d. -f1-2)
  local required_major_minor
  required_major_minor=$(echo "$required_python" | cut -d. -f1-2)

  if [[ "$current_major_minor" != "$required_major_minor" ]]; then
    warn "Python version mismatch:"
    warn "  Current: $current_python"
    warn "  Required: $required_python"
    warn "  Consider: pyenv install $required_python && pyenv local $required_python"
    return 1
  fi

  ok "Python version: $current_python ✓"
  return 0
}

validate_package_lock() {
  info "Validating package-lock.json..."

  if [[ ! -f "package-lock.json" ]]; then
    fail "package-lock.json not found. Run 'npm install' to generate it."
    return 1
  fi

  # Check if package-lock.json is up to date
  if [[ "package.json" -nt "package-lock.json" ]]; then
    warn "package-lock.json is older than package.json"
    warn "Run 'npm install' to update package-lock.json"
    return 1
  fi

  ok "package-lock.json is present and up to date ✓"
  return 0
}

validate_dependencies() {
  info "Validating npm dependencies..."

  if [[ ! -d "node_modules" ]]; then
    warn "node_modules not found. Installing dependencies..."
    if ! npm ci; then
      fail "Failed to install dependencies with 'npm ci'"
      return 1
    fi
  fi

  # Check for security vulnerabilities
  if npm audit --audit-level=high >/dev/null 2>&1; then
    ok "No high-severity security vulnerabilities found ✓"
  else
    warn "Security vulnerabilities detected. Run 'npm audit' for details."
    warn "Consider running 'npm audit fix' to resolve issues."
  fi

  return 0
}

validate_git_hooks() {
  info "Validating git hooks..."

  if [[ ! -f ".git/hooks/pre-commit" ]]; then
    warn "Pre-commit hook not found"
    warn "Git security features may not be active"
    return 1
  fi

  if [[ ! -x ".git/hooks/pre-commit" ]]; then
    warn "Pre-commit hook is not executable"
    chmod +x ".git/hooks/pre-commit"
    ok "Fixed pre-commit hook permissions"
  fi

  ok "Git hooks are properly configured ✓"
  return 0
}

# Show toolchain information
show_toolchain_info() {
  info "Current Toolchain Information:"
  echo

  # Node.js
  if command -v node >/dev/null 2>&1; then
    echo "  Node.js: $(node --version)"
  else
    echo "  Node.js: Not installed"
  fi

  # npm
  if command -v npm >/dev/null 2>&1; then
    echo "  npm: $(npm --version)"
  else
    echo "  npm: Not installed"
  fi

  # Python
  for cmd in python3 python; do
    if command -v "$cmd" >/dev/null 2>&1; then
      echo "  Python ($cmd): $($cmd --version 2>&1 | awk '{print $2}')"
      break
    fi
  done

  # Git
  if command -v git >/dev/null 2>&1; then
    echo "  Git: $(git --version | awk '{print $3}')"
  else
    echo "  Git: Not installed"
  fi

  echo

  # Version files
  if [[ -f ".nvmrc" ]]; then
    echo "  .nvmrc: $(cat .nvmrc)"
  fi

  if [[ -f ".python-version" ]]; then
    echo "  .python-version: $(cat .python-version)"
  fi

  if [[ -f "package-lock.json" ]]; then
    echo "  package-lock.json: Present ($(stat -f%Sm -t%Y-%m-%d package-lock.json))"
  fi

  echo
}

# Validate all toolchain components
validate_all() {
  info "🔧 Validating development toolchain..."
  echo

  local validation_count=0
  local success_count=0

  # Run all validations
  for validation in validate_node validate_npm validate_python validate_package_lock validate_dependencies validate_git_hooks; do
    ((validation_count++))
    if $validation; then
      ((success_count++))
    fi
    echo
  done

  # Summary
  info "Toolchain Validation Summary:"
  info "  Checks passed: $success_count/$validation_count"

  if [[ $success_count -eq $validation_count ]]; then
    ok "🎉 All toolchain validations PASSED"
    ok "Development environment is properly configured"
    return 0
  else
    fail "💥 Some toolchain validations FAILED"
    fail "Please fix the issues above before proceeding"
    return 1
  fi
}

# Setup development environment
setup_dev_env() {
  info "🚀 Setting up development environment..."

  # Use Node.js version from .nvmrc if available
  if [[ -f ".nvmrc" && -n "${NVM_DIR:-}" ]]; then
    info "Loading Node.js version from .nvmrc..."
    if source "$NVM_DIR/nvm.sh" && nvm use; then
      ok "Switched to Node.js $(cat .nvmrc)"
    else
      warn "Could not switch Node.js version. Install manually: nvm install $(cat .nvmrc)"
    fi
  fi

  # Install dependencies
  info "Installing npm dependencies..."
  if npm ci; then
    ok "Dependencies installed successfully"
  else
    fail "Failed to install dependencies"
    return 1
  fi

  # Run validation
  validate_all
}

# Show help
show_help() {
  cat <<EOF
Toolchain Validation - Development Environment Setup

USAGE:
  $0 [COMMAND]

COMMANDS:
  validate          Validate all toolchain versions and dependencies
  info              Show current toolchain information
  setup             Setup development environment (nvm + npm ci)
  node              Validate Node.js version only
  npm               Validate npm version only
  python            Validate Python version only
  deps              Validate dependencies only

EXAMPLES:
  $0 validate       # Full validation
  $0 setup          # Setup dev environment
  $0 info           # Show version info

TOOLCHAIN REQUIREMENTS:
  Node.js: $REQUIRED_NODE (from .nvmrc)
  npm: >=$REQUIRED_NPM
  Python: $REQUIRED_PYTHON+ (from .python-version)

VERSION FILES:
  .nvmrc            Node.js version pin
  .python-version   Python version pin
  package-lock.json Dependency version lock

EXIT CODES:
  0 - All validations passed
  1 - One or more validations failed

EOF
}

# Main execution
main() {
  case "${1:-validate}" in
    validate)
      validate_all
      ;;
    info)
      show_toolchain_info
      ;;
    setup)
      setup_dev_env
      ;;
    node)
      validate_node
      ;;
    npm)
      validate_npm
      ;;
    python)
      validate_python
      ;;
    deps)
      validate_dependencies
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