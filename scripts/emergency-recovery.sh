#!/usr/bin/env bash
set -Eeuo pipefail

# Emergency Recovery System for Non-Developers

echo "🚨 Emergency System Recovery"
echo "=============================="

# Function to create emergency backup
create_emergency_backup() {
    local backup_dir="backups/emergency/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$backup_dir"

    echo "📦 Creating emergency backup in: $backup_dir"

    # Backup critical files
    cp -r src/ "$backup_dir/" 2>/dev/null || true
    cp -r docs/ "$backup_dir/" 2>/dev/null || true
    cp package.json "$backup_dir/" 2>/dev/null || true
    cp CLAUDE.md "$backup_dir/" 2>/dev/null || true
    cp .env "$backup_dir/" 2>/dev/null || true

    echo "✅ Emergency backup created: $backup_dir"
}

# Function to check system health
check_system_health() {
    echo "🔍 Checking system health..."

    local issues=0

    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js not found"
        ((issues++))
    else
        echo "✅ Node.js: $(node --version)"
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        echo "❌ npm not found"
        ((issues++))
    else
        echo "✅ npm: $(npm --version)"
    fi

    # Check package.json
    if [ ! -f "package.json" ]; then
        echo "❌ package.json missing"
        ((issues++))
    else
        echo "✅ package.json exists"
    fi

    # Check dependencies
    if [ ! -d "node_modules" ]; then
        echo "❌ node_modules missing - run 'npm install'"
        ((issues++))
    else
        echo "✅ node_modules exists"
    fi

    # Check critical files
    local critical_files=("src/core/orchestrator.ts" "CLAUDE.md" ".env")
    for file in "${critical_files[@]}"; do
        if [ ! -f "$file" ]; then
            echo "❌ Critical file missing: $file"
            ((issues++))
        else
            echo "✅ $file exists"
        fi
    done

    if [ $issues -eq 0 ]; then
        echo "🎉 System health: ALL GOOD"
        return 0
    else
        echo "⚠️ System health: $issues issues found"
        return 1
    fi
}

# Function to fix common issues
fix_common_issues() {
    echo "🔧 Attempting to fix common issues..."

    # Install dependencies if missing
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing dependencies..."
        npm install || echo "❌ npm install failed"
    fi

    # Create missing directories
    mkdir -p logs reports outputs backups/daily backups/weekly

    # Fix permissions on scripts
    chmod +x scripts/*.sh 2>/dev/null || true

    # Create missing schema if needed
    if [ ! -f "schemas/input.schema.json" ]; then
        mkdir -p schemas
        echo '{"type": "object", "properties": {}}' > schemas/input.schema.json
    fi

    echo "✅ Common fixes applied"
}

# Function to show recovery options
show_recovery_options() {
    echo ""
    echo "🛠️ Recovery Options:"
    echo "1. backup     - Create emergency backup"
    echo "2. health     - Check system health"
    echo "3. fix        - Fix common issues"
    echo "4. reset      - Reset to clean state"
    echo "5. contact    - Show emergency contacts"
    echo ""
}

# Function to reset system
reset_system() {
    echo "⚠️ Resetting system to clean state..."
    read -p "Are you sure? This will reset configurations (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Create backup first
        create_emergency_backup

        # Reset configurations
        git checkout -- package.json 2>/dev/null || true
        git checkout -- .env 2>/dev/null || true

        # Reinstall dependencies
        rm -rf node_modules
        npm install

        echo "✅ System reset completed"
    else
        echo "❌ Reset cancelled"
    fi
}

# Function to show emergency contacts
show_contacts() {
    echo "📞 Emergency Contacts & Resources:"
    echo ""
    echo "🔧 Self-Help Commands:"
    echo "  npm run /sync     - Fix most issues"
    echo "  npm run /status   - Check system status"
    echo "  npm install       - Fix dependencies"
    echo ""
    echo "📖 Documentation:"
    echo "  CLAUDE.md                    - Main project spec"
    echo "  DEVELOPER_HANDOFF_COMPLETE.md - Complete guide"
    echo "  CRITICAL_SYSTEM_ANALYSIS.md  - This analysis"
    echo ""
    echo "🆘 If system is completely broken:"
    echo "  1. Create backup: bash scripts/emergency-recovery.sh backup"
    echo "  2. Check health: bash scripts/emergency-recovery.sh health"
    echo "  3. Try fixes: bash scripts/emergency-recovery.sh fix"
    echo "  4. Last resort: bash scripts/emergency-recovery.sh reset"
}

# Main script logic
case "${1:-help}" in
    "backup")
        create_emergency_backup
        ;;
    "health")
        check_system_health
        ;;
    "fix")
        fix_common_issues
        ;;
    "reset")
        reset_system
        ;;
    "contact")
        show_contacts
        ;;
    "help"|*)
        echo "🚨 Emergency Recovery System"
        echo ""
        check_system_health
        echo ""
        show_recovery_options
        show_contacts
        ;;
esac