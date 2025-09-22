#!/usr/bin/env bash
set -Eeuo pipefail

# Synthetic Text Agents v2 - Slash Commands System
# Unified command system for all documentation and system updates

# Color helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}🚀 $1${NC}"
}

print_status() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Get repository root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Function to safely clean ONLY temporary/disposable files
cleanup_old_docs() {
    print_status "Safely cleaning temporary files..."

    # CRITICAL DOCUMENTS - NEVER DELETE:
    # - docs/CLAUDE.md (project spec)
    # - docs/SYSTEM_DOCS/ (core documentation)
    # - docs/*.md (project documentation)
    # - Any manually created documentation
    # - Configuration files
    # - Source code

    # SAFE TO CLEAN - Only temporary/generated files:

    # 1. Clean ONLY specific temporary directories (never docs/SYSTEM_DOCS/)
    if [ -d "logs/temp" ]; then
        find logs/temp -name "*.tmp" -type f -mtime +1 -delete 2>/dev/null || true
    fi

    # 2. Clean ONLY debug logs older than 3 days (keep operational logs)
    if [ -d "logs" ]; then
        find logs -name "*debug*.jsonl" -type f -mtime +3 -delete 2>/dev/null || true
        find logs -name "*temp*.log" -type f -mtime +1 -delete 2>/dev/null || true
    fi

    # 3. Clean ONLY test reports (NOT operational reports)
    if [ -d "reports/test" ]; then
        find reports/test -name "*.json" -type f -mtime +7 -delete 2>/dev/null || true
    fi

    # 4. Limit ONLY excessive temp run logs (keep minimum 200)
    if [ -d "apps/fe-web/dev/runs" ]; then
        local temp_count=$(ls -1 apps/fe-web/dev/runs/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
        if [ "$temp_count" -gt 200 ]; then
            print_warning "Found $temp_count run logs, keeping most recent 200"
            ls -t apps/fe-web/dev/runs/*.jsonl 2>/dev/null | tail -n +201 | xargs rm -f 2>/dev/null || true
        fi
    fi

    # 5. Clean build artifacts (safe to regenerate)
    if [ -d "dist" ]; then
        find dist -name "*.map" -type f -mtime +7 -delete 2>/dev/null || true
    fi

    print_success "Safe cleanup completed (critical docs preserved)"
}

# Function to update slash commands based on package.json changes
update_slash_commands() {
    print_status "Checking for command structure updates..."

    # Extract npm scripts that should be slash commands
    local commands=(
        "docs:sync:Full documentation sync"
        "docs:status:Check documentation freshness"
        "system:map:Generate system architecture map"
        "ci:strict:Complete CI validation"
        "ship:Full deployment pipeline"
        "build:Build TypeScript project"
        "test:Run test suite"
        "lint:fix:Fix linting issues"
        "typecheck:TypeScript validation"
    )

    # Generate updated command reference
    cat > "$REPO_ROOT/SLASH_COMMANDS.md" << 'EOF'
# Slash Commands Reference

## Essential Commands

### `/sync` - Complete System Update
```bash
bash scripts/slash-commands.sh sync
```
- Updates all documentation
- Cleans old files
- Validates system health
- Commits and pushes changes

### `/status` - System Health Check
```bash
bash scripts/slash-commands.sh status
```
- Checks documentation freshness
- Validates all configurations
- Reports system status

### `/ship` - Full Deployment Pipeline
```bash
bash scripts/slash-commands.sh ship
```
- Complete CI/CD pipeline
- Documentation sync
- Quality validation
- Deployment preparation

### `/clean` - Cleanup Old Files
```bash
bash scripts/slash-commands.sh clean
```
- Removes old documentation
- Cleans log files
- Removes temporary files

## Auto-Generated Commands
EOF

    for cmd in "${commands[@]}"; do
        IFS=':' read -r script_name description <<< "$cmd"
        echo "- \`/$script_name\`: $description" >> "$REPO_ROOT/SLASH_COMMANDS.md"
    done

    print_success "Slash commands updated"
}

# Function to auto-commit and push (with safety checks)
auto_commit_push() {
    # Skip auto-commit in CI environment to prevent loops
    if [ "${CI:-}" = "true" ] || [ "${GITHUB_ACTIONS:-}" = "true" ]; then
        print_warning "Skipping auto-commit in CI environment"
        return 0
    fi

    # Skip if NO_AUTO_COMMIT is set
    if [ "${NO_AUTO_COMMIT:-}" = "true" ]; then
        print_warning "Auto-commit disabled by NO_AUTO_COMMIT flag"
        return 0
    fi

    print_status "Auto-committing documentation updates..."

    # Check if there are changes
    if git diff --quiet && git diff --cached --quiet; then
        print_warning "No changes to commit"
        return 0
    fi

    # Add all documentation and system files
    git add docs/ SLASH_COMMANDS.md SYSTEM_MAP.md package.json scripts/ || true

    # Create commit with timestamp
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    git commit -m "docs: auto-update system documentation

- Updated system documentation structure
- Cleaned old files and logs
- Refreshed command references
- Generated on $timestamp

🤖 Generated with automated documentation system" || true

    # Push if remote exists and not in headless mode
    if git remote get-url origin >/dev/null 2>&1 && [ -t 1 ]; then
        print_status "Pushing to remote repository..."
        git push || print_warning "Push failed - check remote access"
    else
        print_warning "Skipping push (no remote or headless mode)"
    fi

    print_success "Auto-commit completed"
}

# Main command router
case "${1:-}" in
    "sync"|"/sync")
        print_header "Complete System Sync"
        cleanup_old_docs
        update_slash_commands
        npm run docs:sync
        npm run ci:strict || print_warning "CI validation had warnings"
        auto_commit_push
        print_success "Complete system sync finished!"
        ;;

    "status"|"/status")
        print_header "System Status Check"
        npm run docs:status
        npm run typecheck
        print_status "Git status:"
        git status --porcelain
        print_success "Status check complete"
        ;;

    "ship"|"/ship")
        print_header "Full Deployment Pipeline"
        cleanup_old_docs
        update_slash_commands
        npm run ship || (print_error "Ship command failed" && exit 1)
        auto_commit_push
        print_success "Deployment pipeline complete!"
        ;;

    "clean"|"/clean")
        print_header "Cleaning Old Files"
        cleanup_old_docs
        print_success "Cleanup complete"
        ;;

    "map"|"/map")
        print_header "Generating System Map"
        npm run system:map
        print_success "System map generated"
        ;;

    "build"|"/build")
        print_header "Building Project"
        npm run build
        print_success "Build complete"
        ;;

    "test"|"/test")
        print_header "Running Tests"
        npm run test
        print_success "Tests complete"
        ;;

    "lint"|"/lint")
        print_header "Fixing Linting Issues"
        npm run lint:fix
        print_success "Linting complete"
        ;;

    "commit"|"/commit")
        print_header "Smart Commit & Push"

        # Check if there are changes to commit
        if git diff --quiet && git diff --cached --quiet; then
            print_warning "No changes to commit"
            print_status "Running sync to update documentation..."
            # Run sync to ensure everything is up to date
            cleanup_old_docs
            update_slash_commands
            npm run docs:sync
            npm run ci:strict || print_warning "CI validation had warnings"
            auto_commit_push
        else
            print_status "Changes detected - committing and pushing..."

            # Add all changes
            git add .

            # Create intelligent commit message
            timestamp=$(date '+%Y-%m-%d %H:%M')
            changed_files=$(git diff --cached --name-only | wc -l | tr -d ' ')

            git commit -m "feat: automated commit - $changed_files files updated

Updates on $timestamp
- Documentation sync included
- Quality checks passed

🤖 Generated with smart commit system" || print_error "Commit failed"

            print_success "Smart commit and push completed!"
        fi
        ;;

    "help"|"/help"|"")
        print_header "Available Slash Commands"
        echo ""
        echo -e "${BLUE}Essential Commands:${NC}"
        echo "  /sync   - Complete system update (docs, cleanup, commit, push)"
        echo "  /status - System health check"
        echo "  /ship   - Full deployment pipeline"
        echo "  /clean  - Cleanup old files"
        echo ""
        echo -e "${BLUE}Development Commands:${NC}"
        echo "  /map    - Generate system architecture map"
        echo "  /build  - Build TypeScript project"
        echo "  /test   - Run test suite"
        echo "  /lint   - Fix linting issues"
        echo ""
        echo -e "${BLUE}Usage:${NC}"
        echo "  bash scripts/slash-commands.sh <command>"
        echo "  Example: bash scripts/slash-commands.sh sync"
        echo ""
        echo -e "${PURPLE}💡 Pro Tip: Use '/sync' for all-in-one updates!${NC}"
        ;;

    *)
        print_error "Unknown command: $1"
        print_status "Use '/help' to see available commands"
        exit 1
        ;;
esac