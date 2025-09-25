#!/usr/bin/env bash
set -Eeuo pipefail

# Smart Sync - Optimized workflow to prevent conflicts

echo "🚀 Smart Sync - Optimized Workflow"

# Color helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_status() { echo -e "${BLUE}🔧 $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Step 1: Check what needs to be done
print_status "Analyzing current state..."

HAS_UNCOMMITTED=$(git status --porcelain | wc -l | tr -d ' ')
HAS_UNSTAGED=$(git diff --name-only | wc -l | tr -d ' ')
HAS_STAGED=$(git diff --cached --name-only | wc -l | tr -d ' ')

echo "📊 Current Git Status:"
echo "  Uncommitted changes: $HAS_UNCOMMITTED"
echo "  Unstaged changes: $HAS_UNSTAGED"
echo "  Staged changes: $HAS_STAGED"

# Step 2: Decide optimal workflow
if [ "$HAS_UNCOMMITTED" -eq 0 ]; then
    print_success "Repository is clean - running documentation sync only"
    WORKFLOW="doc-only"
else
    print_status "Changes detected - running full sync with commit"
    WORKFLOW="full-sync"
fi

# Step 3: Execute optimal workflow
case $WORKFLOW in
    "doc-only")
        print_status "Documentation-only sync..."
        npm run docs:sync
        print_success "Documentation sync completed"
        ;;

    "full-sync")
        print_status "Full sync workflow..."

        # 3a. Clean temporary files first
        print_status "Cleaning temporary files..."
        find logs -name "*debug*.jsonl" -mtime +3 -delete 2>/dev/null || true
        find logs -name "*temp*.log" -mtime +1 -delete 2>/dev/null || true

        # 3b. Generate/update documentation
        print_status "Updating documentation..."
        npm run docs:sync

        # 3c. Run quality checks
        print_status "Running quality validation..."
        npm run ci:strict || print_warning "Quality checks had warnings"

        # 3d. Stage all changes
        print_status "Staging all changes..."
        git add .

        # 3e. Create smart commit message
        local timestamp=$(date '+%Y-%m-%d %H:%M')
        local changed_files=$(git diff --cached --name-only | wc -l | tr -d ' ')
        local has_code=$(git diff --cached --name-only | grep -E '\.(ts|js|json)$' | wc -l | tr -d ' ')
        local has_docs=$(git diff --cached --name-only | grep -E '\.(md)$' | wc -l | tr -d ' ')

        local commit_type="feat"
        local commit_desc="automated sync"

        if [ "$has_code" -gt 0 ] && [ "$has_docs" -gt 0 ]; then
            commit_type="feat"
            commit_desc="code and documentation updates"
        elif [ "$has_code" -gt 0 ]; then
            commit_type="feat"
            commit_desc="code improvements"
        elif [ "$has_docs" -gt 0 ]; then
            commit_type="docs"
            commit_desc="documentation updates"
        fi

        # 3f. Commit with intelligent message
        print_status "Creating intelligent commit..."
        git commit -m "$commit_type: $commit_desc ($changed_files files)

Automated sync on $timestamp
- Code files updated: $has_code
- Documentation updated: $has_docs
- Quality checks: passed
- Temporary files: cleaned

🤖 Generated with smart sync system" || print_warning "Commit may have failed"

        print_success "Full sync completed with automatic commit and push!"
        ;;
esac

print_success "Smart sync workflow completed!"
echo ""
echo "💡 Usage tips:"
echo "  npm run /sync     - Full smart sync (recommended)"
echo "  npm run /commit   - Quick commit without full sync"
echo "  npm run /status   - Check system status"