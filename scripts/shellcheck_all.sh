#!/usr/bin/env bash
# Cross-OS Shell Script Validation
# Runs shellcheck on all shell scripts for compatibility verification

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[SHELLCHECK]${NC} $*"; }
warn() { echo -e "${YELLOW}[SHELLCHECK]${NC} $*"; }
ok() { echo -e "${GREEN}[SHELLCHECK]${NC} $*"; }
fail() { echo -e "${RED}[SHELLCHECK]${NC} $*"; }

# Find git root or use current directory
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

info "Starting shellcheck validation for cross-OS compatibility"

# Check if shellcheck is available
if ! command -v shellcheck >/dev/null 2>&1; then
    fail "shellcheck is not installed"
    echo "Install instructions:"
    echo "  macOS: brew install shellcheck"
    echo "  Ubuntu/Debian: sudo apt-get install shellcheck"
    echo "  RHEL/CentOS: sudo yum install shellcheck"
    exit 1
fi

# Find all shell scripts
SCRIPT_COUNT=0
ERROR_COUNT=0
WARNING_COUNT=0

info "Scanning for shell scripts..."

# Find shell scripts with various extensions and shebangs
SHELL_SCRIPTS=$(find . -type f \( -name "*.sh" -o -name "*.bash" -o -name "*.zsh" \) \
    ! -path "./node_modules/*" \
    ! -path "./.git/*" \
    ! -path "./.backup_quarantine/*" \
    ! -path "./apps/fe-web/node_modules/*" \
    2>/dev/null || true)

# Also find files with shell shebangs
SHEBANG_SCRIPTS=$(find . -type f -exec grep -l "^#!/.*sh" {} \; 2>/dev/null | \
    grep -v node_modules | \
    grep -v ".git/" | \
    grep -v ".backup_quarantine/" | \
    head -20 || true)

# Combine and deduplicate
ALL_SCRIPTS=$(echo -e "$SHELL_SCRIPTS\n$SHEBANG_SCRIPTS" | sort -u | grep -v "^$" || true)

if [[ -z "$ALL_SCRIPTS" ]]; then
    warn "No shell scripts found to validate"
    exit 0
fi

info "Found shell scripts to validate:"
echo "$ALL_SCRIPTS" | while read -r script; do
    if [[ -n "$script" ]]; then
        echo "  - $script"
    fi
done

# Process each script
echo "$ALL_SCRIPTS" | while read -r script; do
    if [[ -z "$script" || ! -f "$script" ]]; then
        continue
    fi

    ((SCRIPT_COUNT++))
    info "Checking: $script"

    # Run shellcheck with appropriate options
    if shellcheck \
        --severity=warning \
        --format=tty \
        --external-sources \
        --check-sourced \
        "$script" 2>/dev/null; then
        ok "✅ $script - clean"
    else
        # Capture shellcheck output for analysis
        SHELLCHECK_OUTPUT=$(shellcheck \
            --severity=warning \
            --format=tty \
            --external-sources \
            --check-sourced \
            "$script" 2>&1 || true)

        # Count errors vs warnings
        ERRORS_IN_FILE=$(echo "$SHELLCHECK_OUTPUT" | grep -c "error:" || echo "0")
        WARNINGS_IN_FILE=$(echo "$SHELLCHECK_OUTPUT" | grep -c "warning:" || echo "0")

        if [[ "$ERRORS_IN_FILE" -gt 0 ]]; then
            fail "❌ $script - $ERRORS_IN_FILE error(s), $WARNINGS_IN_FILE warning(s)"
            ((ERROR_COUNT += ERRORS_IN_FILE))
        else
            warn "⚠️ $script - $WARNINGS_IN_FILE warning(s)"
        fi

        ((WARNING_COUNT += WARNINGS_IN_FILE))

        # Show first few issues for context
        echo "$SHELLCHECK_OUTPUT" | head -10 | sed 's/^/    /'

        if [[ $(echo "$SHELLCHECK_OUTPUT" | wc -l) -gt 10 ]]; then
            echo "    ... (additional issues truncated)"
        fi
    fi
done

# Summary
echo
info "Shellcheck validation summary:"
info "  Scripts checked: $SCRIPT_COUNT"
info "  Total errors: $ERROR_COUNT"
info "  Total warnings: $WARNING_COUNT"

if [[ $ERROR_COUNT -eq 0 ]]; then
    if [[ $WARNING_COUNT -eq 0 ]]; then
        ok "🎉 All shell scripts are clean - excellent cross-OS compatibility!"
    else
        ok "✅ No errors found - cross-OS compatibility verified"
        warn "Consider addressing $WARNING_COUNT warning(s) for best practices"
    fi
    exit 0
else
    fail "💥 Found $ERROR_COUNT error(s) that may affect cross-OS compatibility"
    fail "Please fix errors before proceeding"
    exit 1
fi