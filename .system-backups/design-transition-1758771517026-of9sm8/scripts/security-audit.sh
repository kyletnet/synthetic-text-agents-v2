#!/bin/bash
# Comprehensive Security Audit Script

echo "🔒 Starting comprehensive security audit..."

ERRORS=0
WARNINGS=0

# Function to log errors and warnings
log_error() {
    echo "❌ ERROR: $1"
    ERRORS=$((ERRORS + 1))
}

log_warning() {
    echo "⚠️  WARNING: $1"
    WARNINGS=$((WARNINGS + 1))
}

log_success() {
    echo "✅ $1"
}

# 1. Environment Security Check
echo ""
echo "🔍 1. Environment Security Check"
echo "================================"

# Check for .env files in git
if git ls-files | grep -E "\.env$"; then
    log_error ".env file is tracked in git - this exposes secrets"
else
    log_success ".env file is not tracked in git"
fi

# Check for hardcoded secrets
echo ""
echo "🔍 Scanning for hardcoded secrets..."
SECRET_PATTERNS=(
    "sk-ant-api-[a-zA-Z0-9]+"
    "sk-[a-zA-Z0-9]{20,}"
    "AKIA[0-9A-Z]{16}"
    "password\s*=\s*['\"][^'\"]+['\"]"
    "secret\s*=\s*['\"][^'\"]+['\"]"
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -E "$pattern" --exclude-dir=node_modules --exclude-dir=.git --exclude="*.md" . 2>/dev/null; then
        log_error "Found potential hardcoded secret matching pattern: $pattern"
    fi
done

# 2. Dependencies Security
echo ""
echo "🔍 2. Dependencies Security"
echo "=========================="

# Run npm audit
if command -v npm &> /dev/null; then
    echo "Running npm audit..."
    if npm audit --audit-level=moderate 2>/dev/null; then
        log_success "No moderate or higher severity vulnerabilities found"
    else
        log_warning "Dependencies have security vulnerabilities - run 'npm audit fix'"
    fi
else
    log_warning "npm not found - cannot check dependencies"
fi

# Check for outdated dependencies
if command -v npm &> /dev/null; then
    OUTDATED=$(npm outdated --json 2>/dev/null)
    if [[ "$OUTDATED" != "{}" && -n "$OUTDATED" ]]; then
        log_warning "Some dependencies are outdated - consider updating"
    else
        log_success "Dependencies are up to date"
    fi
fi

# 3. File Permissions Check
echo ""
echo "🔍 3. File Permissions Check"
echo "=========================="

# Check for overly permissive files
find . -type f -perm 777 2>/dev/null | grep -v node_modules | while read -r file; do
    log_warning "File has 777 permissions: $file"
done

# Check script files have execute permissions
SCRIPT_FILES=(
    "scripts/validate-environment.sh"
    "scripts/security-audit.sh"
)

for script in "${SCRIPT_FILES[@]}"; do
    if [[ -f "$script" ]]; then
        if [[ -x "$script" ]]; then
            log_success "$script has execute permissions"
        else
            log_warning "$script missing execute permissions"
        fi
    fi
done

# 4. Configuration Security
echo ""
echo "🔍 4. Configuration Security"
echo "=========================="

# Check .env.example doesn't have real values
if [[ -f .env.example ]]; then
    if grep -E "(sk-ant-api-[a-zA-Z0-9]+|AKIA[0-9A-Z]{16})" .env.example; then
        log_error ".env.example contains real API keys"
    else
        log_success ".env.example doesn't contain real secrets"
    fi
fi

# Check for debug settings in production configs
PROD_FILES=(".env.production" "config/production.js")
for file in "${PROD_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        if grep -i "debug.*true\|verbose.*true" "$file"; then
            log_warning "$file has debug settings enabled"
        else
            log_success "$file doesn't have debug settings enabled"
        fi
    fi
done

# 5. GitHub Security Settings
echo ""
echo "🔍 5. GitHub Security Settings"
echo "============================"

# Check for security-related files
SECURITY_FILES=(
    ".github/dependabot.yml"
    "SECURITY.md"
    ".github/workflows/ci.yml"
)

for file in "${SECURITY_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        log_success "$file exists"
    else
        log_warning "$file is missing"
    fi
done

# Check CI workflow has security scanning
if [[ -f .github/workflows/ci.yml ]]; then
    if grep -q "secret scanning" .github/workflows/ci.yml; then
        log_success "CI includes secret scanning"
    else
        log_warning "CI missing secret scanning"
    fi

    if grep -q "npm audit" .github/workflows/ci.yml; then
        log_success "CI includes vulnerability scanning"
    else
        log_warning "CI missing vulnerability scanning"
    fi
fi

# 6. Code Security Patterns
echo ""
echo "🔍 6. Code Security Patterns"
echo "=========================="

# Check for dangerous eval usage
if grep -r "eval(" --include="*.ts" --include="*.js" src/ 2>/dev/null; then
    log_error "Found eval() usage - potential security risk"
else
    log_success "No eval() usage found"
fi

# Check for SQL injection patterns
if grep -r "SELECT.*+\|INSERT.*+\|UPDATE.*+" --include="*.ts" --include="*.js" src/ 2>/dev/null; then
    log_warning "Found potential SQL injection patterns"
else
    log_success "No obvious SQL injection patterns found"
fi

# Check for unsafe deserialization
if grep -r "JSON.parse.*req\|eval.*req" --include="*.ts" --include="*.js" src/ 2>/dev/null; then
    log_warning "Found potential unsafe deserialization"
else
    log_success "No unsafe deserialization patterns found"
fi

# 7. Security Headers Check
echo ""
echo "🔍 7. Security Headers Check"
echo "=========================="

# Check for security header configurations
SECURITY_HEADERS=(
    "helmet"
    "X-Frame-Options"
    "Content-Security-Policy"
    "X-Content-Type-Options"
)

for header in "${SECURITY_HEADERS[@]}"; do
    if grep -r "$header" --include="*.ts" --include="*.js" src/ 2>/dev/null >/dev/null; then
        log_success "Found $header configuration"
    else
        log_warning "Missing $header configuration"
    fi
done

# 8. Final Report
echo ""
echo "🔍 8. Security Audit Summary"
echo "=========================="

if [[ $ERRORS -eq 0 && $WARNINGS -eq 0 ]]; then
    echo "🎉 EXCELLENT: No security issues found!"
    echo "🔒 Security posture is strong"
    exit 0
elif [[ $ERRORS -eq 0 ]]; then
    echo "🟡 GOOD: No critical issues, but $WARNINGS warnings found"
    echo "💡 Consider addressing warnings for better security"
    exit 0
else
    echo "🔴 CRITICAL: $ERRORS errors and $WARNINGS warnings found"
    echo "🚨 Address errors immediately before production deployment"
    exit 1
fi