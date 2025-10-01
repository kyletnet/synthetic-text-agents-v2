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

        # 🔄 Start Transaction (NEW)
        print_status "Starting sync transaction with backup..."
        SYNC_TX_ID=$(npm run sync:tx:start --silent 2>/dev/null | grep -o 'sync-[a-zA-Z0-9-]*' || echo "")
        if [ -n "$SYNC_TX_ID" ]; then
            print_success "Transaction started: $SYNC_TX_ID"
        else
            print_warning "Transaction system not available - proceeding without backup"
        fi
        echo ""

        # Set trap for cleanup on failure
        cleanup_on_failure() {
            if [ -n "$SYNC_TX_ID" ]; then
                print_error "Sync failed - rolling back changes..."
                npm run sync:tx:rollback --silent 2>/dev/null
                print_success "Rollback completed"
            fi
            exit 1
        }
        trap cleanup_on_failure ERR

        # 🤖 Smart AI Fix Suggestions (NEW)
        print_status "Checking for AI-fixable issues..."
        npm run status:smart
        echo ""
        print_status "💡 Run '/fix' if TypeScript errors are auto-fixable"
        echo ""

        cleanup_old_docs
        update_slash_commands
        npm run docs:sync

        # 📚 Core Document Updates (NEW)
        print_status "Updating core project documentation..."
        npm run docs:update-core
        echo ""

        # 🛡️ Security Audit (NEW)
        print_status "Running security audit..."
        npm run security:audit:check || print_warning "Security issues found - check reports/security-audit.json"
        echo ""

        npm run ci:strict || print_warning "CI validation had warnings"

        # 🏥 System Health & Temporary Fixes Report (NEW)
        print_status "Analyzing system health and temporary fixes..."
        npm run health:report
        echo ""

        # 🛡️ Workflow Prevention Check (NEW)
        print_status "Checking workflow completeness to prevent future gaps..."
        npm run workflow:prevention:check || print_warning "Workflow gaps detected - check reports/workflow-prevention.json"
        echo ""

        # 📋 임시 처리 이슈 보고 (NEW)
        print_status "임시 처리된 이슈들 보고..."
        npm run issues:report 2>/dev/null || print_warning "이슈 추적 보고서 생성 실패"
        echo ""

        # 🔗 자동 통합 검사 (NEW)
        print_status "새 기능 통합 영향도 자동 검사..."
        npm run integration:quick 2>/dev/null || print_warning "통합 우려사항 있음 - integration:guard로 상세 확인"
        echo ""

        auto_commit_push

        # 🔄 Commit Transaction (NEW)
        if [ -n "$SYNC_TX_ID" ]; then
            print_status "Committing transaction..."
            npm run sync:tx:commit --silent 2>/dev/null
            print_success "Transaction committed successfully"
        fi

        # Clear trap
        trap - ERR

        print_success "Complete system sync finished!"
        ;;

    "inspect"|"/inspect")
        print_header "System Inspection - Comprehensive Diagnosis"
        print_status "Running full system diagnostics..."
        npm run status || print_error "Inspection failed"
        print_success "Inspection complete - check reports/inspection-results.json"
        ;;

    "maintain"|"/maintain")
        print_header "System Maintenance - Auto-fix"
        print_status "Running automatic fixes (no approval needed)..."
        npm run maintain || print_error "Maintenance failed"
        print_success "Auto-fixes complete"
        ;;

    "fix"|"/fix")
        print_header "System Fix - Interactive Approval"
        print_status "Running interactive fixes (approval required)..."
        npm run fix || print_error "Fix process failed"
        print_success "Interactive fixes complete"
        ;;

    "ship"|"/ship")
        print_header "Full Deployment Pipeline + Deploy"

        # 1. Pre-ship validation
        print_status "Phase 1: Pre-ship validation..."
        cleanup_old_docs
        update_slash_commands

        # 2. Run full ship pipeline (validation + docs + optimization)
        print_status "Phase 2: Running ship pipeline..."
        npm run ship || (print_error "Ship command failed" && exit 1)

        # 3. Deploy (commit + push)
        print_status "Phase 3: Deploying to repository..."
        auto_commit_push

        print_success "🚢 Deployment complete! Changes pushed to remote."
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

    "audit"|"/audit")
        print_header "10-Point Refactor Audit (Full)"
        print_status "Running complete structural and operational audit..."
        npm run refactor:audit
        print_success "Full audit complete - check findings above"
        ;;

    "audit-auto"|"/audit-auto")
        print_header "Smart Auto Audit"
        print_status "Detecting audit triggers and running if needed..."
        npm run refactor:audit:auto
        print_success "Smart audit complete"
        ;;

    "audit-p1"|"/audit-p1")
        print_header "Critical Issues Audit (P1)"
        print_status "Checking critical LLM and runtime issues..."
        npm run refactor:audit:p1
        print_success "P1 critical audit complete"
        ;;

    "audit-detect"|"/audit-detect")
        print_header "Audit Trigger Detection"
        print_status "Checking if audit is needed..."
        npm run refactor:audit:detect
        print_success "Trigger detection complete"
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
        echo -e "${BLUE}4-Step Quality Workflow (순서 준수 필수!):${NC}"
        echo "  /inspect  - 정밀 진단 (TypeScript, ESLint, Tests, Security, etc)"
        echo "  /maintain - 자동 수정 (Prettier, ESLint --fix)"
        echo "  /fix      - 대화형 수정 (TypeScript errors, Workarounds)"
        echo "  /ship     - 배포 준비 + 실제 배포 (검증 + 문서화 + commit + push)"
        echo ""
        echo -e "${BLUE}System Management:${NC}"
        echo "  /sync   - Complete system update (docs, cleanup, commit, push)"
        echo "  /clean  - Cleanup old files"
        echo ""
        echo -e "${BLUE}Development Commands:${NC}"
        echo "  /map    - Generate system architecture map"
        echo "  /build  - Build TypeScript project"
        echo "  /test   - Run test suite"
        echo "  /lint   - Fix linting issues"
        echo ""
        echo -e "${BLUE}Recovery Commands:${NC}"
        echo "  npm run sync:tx:rollback - Rollback failed sync"
        echo "  npm run sync:tx:status   - Show last sync status"
        echo ""
        echo -e "${BLUE}Issue Tracking Commands:${NC}"
        echo "  npm run issues:report    - 임시 처리된 이슈들 보고서"
        echo "  npm run issues:list      - 활성 이슈 목록"
        echo "  npm run issues:track     - 수동으로 이슈 추가"
        echo "  npm run issues:resolve   - 이슈 해결 완료 표시"
        echo ""
        echo -e "${BLUE}Refactor Audit Commands:${NC}"
        echo "  /audit       - Full 10-point structural audit (~2s)"
        echo "  /audit-auto  - Smart auto-audit with trigger detection"
        echo "  /audit-p1    - Critical issues only (LLM, runtime)"
        echo "  /audit-detect- Just check if audit is needed"
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