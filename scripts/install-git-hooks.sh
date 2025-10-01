#!/usr/bin/env bash
#
# Install Git hooks for Synthetic Text Agents v2
# Sets up quality gates and validation hooks
#

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🔧 Installing Git hooks...${NC}"

# Get repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Create hooks directory if it doesn't exist
mkdir -p .git/hooks

# Install pre-commit hook
if [ -f "scripts/git-hooks/pre-commit" ]; then
    cp "scripts/git-hooks/pre-commit" ".git/hooks/pre-commit"
    chmod +x ".git/hooks/pre-commit"
    echo -e "${GREEN}✅ Pre-commit hook installed${NC}"
else
    echo -e "${YELLOW}⚠️  Pre-commit hook template not found, creating basic one...${NC}"

    cat > ".git/hooks/pre-commit" << 'EOF'
#!/usr/bin/env bash
set -e

echo "🔍 Running pre-commit checks..."

# TypeScript check
echo "   Checking TypeScript..."
npm run typecheck

# ESLint check
echo "   Checking code style..."
npm run lint

# Documentation quality gate
echo "   Validating documentation..."
npm run docs:gate:ci

echo "✅ All pre-commit checks passed!"
EOF

    chmod +x ".git/hooks/pre-commit"
    echo -e "${GREEN}✅ Basic pre-commit hook created and installed${NC}"
fi

# Install commit-msg hook (for commit message validation)
cat > ".git/hooks/commit-msg" << 'EOF'
#!/usr/bin/env bash
#
# Commit message validation
#

commit_regex='^(feat|fix|docs|style|refactor|test|chore|perf)(\(.+\))?: .{1,50}'

if ! grep -qE "$commit_regex" "$1"; then
    echo "❌ Invalid commit message format!"
    echo "Expected: type(scope): description"
    echo "Types: feat, fix, docs, style, refactor, test, chore, perf"
    echo "Example: feat(auth): add user authentication system"
    exit 1
fi
EOF

chmod +x ".git/hooks/commit-msg"
echo -e "${GREEN}✅ Commit message validation hook installed${NC}"

# Install pre-push hook (for additional validation)
cat > ".git/hooks/pre-push" << 'EOF'
#!/usr/bin/env bash
#
# Pre-push validation
#

echo "🚀 Running pre-push validation..."

# Full CI validation
echo "   Running full CI checks..."
if ! npm run ci:quality; then
    echo "❌ CI quality checks failed!"
    echo "💡 Fix issues and try pushing again"
    exit 1
fi

echo "✅ Pre-push validation passed!"
EOF

chmod +x ".git/hooks/pre-push"
echo -e "${GREEN}✅ Pre-push validation hook installed${NC}"

echo -e "\n${GREEN}🎉 Git hooks installation complete!${NC}"
echo -e "${BLUE}Hooks installed:${NC}"
echo "  • pre-commit:  Design validation, TypeScript, ESLint, Tests, GAP Scanner (shadow mode)"
echo "  • commit-msg:  Conventional commit message validation"
echo "  • pre-push:    Full CI quality validation"
echo ""
echo -e "${YELLOW}💡 GAP Scanner runs in shadow mode (Week 1) - non-blocking${NC}"
echo -e "${YELLOW}💡 To bypass hooks temporarily: git commit --no-verify${NC}"