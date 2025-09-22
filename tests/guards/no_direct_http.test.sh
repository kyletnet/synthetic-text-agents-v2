#!/usr/bin/env bash
set -euo pipefail

# Test script for no-direct-http guard
# Ensures that no unauthorized direct API calls exist in the codebase

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Standard test functions
ok()   { printf "\033[32m[OK]\033[0m %s\n" "$*"; }
fail() { printf "\033[31m[FAIL]\033[0m %s\n" "$*"; }
info() { printf "\033[34m[INFO]\033[0m %s\n" "$*"; }

cd "$PROJECT_ROOT"

# Test 1: Guard should pass on current codebase
info "Test 1: Running no-direct-http guard on clean codebase"
if npm run guard:no-direct-http >/dev/null 2>&1; then
    ok "Guard passes on clean codebase"
else
    fail "Guard should pass on clean codebase"
    exit 1
fi

# Test 2: Guard should detect direct API calls
info "Test 2: Testing detection of forbidden patterns"

# Create a temporary test file with forbidden content
TEST_FILE="test_forbidden_api.sh"
cat > "$TEST_FILE" <<'EOF'
#!/bin/bash
# This file should trigger the guard
curl -X POST https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -d '{"model": "claude-3-sonnet"}'
EOF

# Run guard and expect failure
if npm run guard:no-direct-http >/dev/null 2>&1; then
    fail "Guard should detect forbidden API call in test file"
    rm -f "$TEST_FILE"
    exit 1
else
    ok "Guard correctly detected forbidden API call"
fi

# Clean up test file
rm -f "$TEST_FILE"

# Test 3: Guard should allow legitimate patterns
info "Test 3: Testing allowlisted patterns"

# Create test file with allowed patterns
ALLOWED_TEST_FILE="test_allowed_api.sh"
cat > "$ALLOWED_TEST_FILE" <<'EOF'
#!/bin/bash
# These patterns should be allowed
export API_HOST="${API_HOST:-https://api.anthropic.com}"
echo "Preflight connectivity check to $API_HOST"
# Diagnostic check
curl -sS -I --max-time 10 "$API_HOST"
EOF

# Run guard and expect success
if npm run guard:no-direct-http >/dev/null 2>&1; then
    ok "Guard correctly allows legitimate API references"
else
    fail "Guard should allow legitimate API references"
    rm -f "$ALLOWED_TEST_FILE"
    exit 1
fi

# Clean up test file
rm -f "$ALLOWED_TEST_FILE"

# Test 4: Check specific allowlisted files exist and are properly excluded
info "Test 4: Verifying allowlisted files are properly excluded"

ALLOWLISTED_FILES=(
    "tools/anthropic_client.sh"
    "scripts/net_diag.sh"
    "scripts/forbidden-direct-http.sh"
)

for file in "${ALLOWLISTED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        info "Verified allowlisted file exists: $file"
    else
        fail "Allowlisted file missing: $file"
        exit 1
    fi
done

# Test 5: Verify that adapter files are properly allowlisted
info "Test 5: Testing adapter allowlist patterns"

# Create test adapter file
mkdir -p "src/clients"
ADAPTER_TEST="src/clients/TestAdapter.ts"
cat > "$ADAPTER_TEST" <<'EOF'
// This should be allowed in adapter files
import fetch from 'node-fetch';
fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});
EOF

# Run guard and expect success
if npm run guard:no-direct-http >/dev/null 2>&1; then
    ok "Guard correctly allows API calls in adapter files"
else
    fail "Guard should allow API calls in adapter files"
    rm -f "$ADAPTER_TEST"
    exit 1
fi

# Clean up
rm -f "$ADAPTER_TEST"

ok "All no-direct-http guard tests passed"
exit 0