#!/usr/bin/env bash
set -Eeuo pipefail

# Auto-update command system for detecting changes and updating slash commands

# Color helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}🔧 $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Check if package.json has been modified recently
check_package_changes() {
    local last_mod=$(stat -f "%m" package.json 2>/dev/null || stat -c "%Y" package.json 2>/dev/null)
    local current_time=$(date +%s)
    local diff=$((current_time - last_mod))

    # If modified in last 5 minutes, update commands
    if [ $diff -lt 300 ]; then
        return 0
    fi
    return 1
}

# Extract npm scripts and update slash commands
update_slash_commands_from_package() {
    print_status "Detecting package.json script changes..."

    # Get current npm scripts
    local scripts=$(npm run 2>/dev/null | grep -E "^\s\s" | grep -v "^$" | head -20)

    # Check if any critical scripts are missing from slash commands
    local missing_commands=()

    # Essential commands that should always be available as slash commands
    local essential_commands=(
        "docs:sync"
        "docs:status"
        "system:map"
        "ci:strict"
        "ship"
        "build"
        "test"
        "lint:fix"
        "typecheck"
        "guard:all"
    )

    for cmd in "${essential_commands[@]}"; do
        if ! grep -q "\"/$cmd\":" package.json; then
            missing_commands+=("$cmd")
        fi
    done

    # Add missing slash commands to package.json
    if [ ${#missing_commands[@]} -gt 0 ]; then
        print_status "Adding missing slash commands: ${missing_commands[*]}"

        # Create backup
        cp package.json package.json.backup

        # Add missing commands before the closing brace of scripts
        for cmd in "${missing_commands[@]}"; do
            # Skip if already exists with different format
            if grep -q "\"$cmd\":" package.json; then
                local cmd_escaped=$(echo "$cmd" | sed 's/:/\\:/g')
                sed -i.tmp "s/\"$cmd\":/\"\\/$cmd\": \"bash scripts\\/slash-commands.sh ${cmd//:*/}\",\n    \"$cmd\":/" package.json
            else
                # Add before the last script entry
                sed -i.tmp "/\"verify:all\":/a\\
    \"/$cmd\": \"bash scripts/slash-commands.sh ${cmd//:*/}\"," package.json
            fi
        done

        rm -f package.json.tmp
        print_success "Updated package.json with missing slash commands"
    fi
}

# Update slash-commands.sh with new functionality
update_slash_script() {
    print_status "Checking for new npm scripts to add to slash commands..."

    # Get all npm scripts
    local all_scripts=$(npm run 2>/dev/null | grep -E "^\s\s" | awk '{print $1}' | head -30)

    # Commands that should be easily accessible via slash
    local priority_commands=(
        "verify:all"
        "guard:all"
        "preflight"
        "dx:smoke"
        "ab-test"
        "regression:mini"
    )

    # Check if we need to add any new priority commands
    for cmd in "${priority_commands[@]}"; do
        if ! grep -q "\"$cmd\"|\"/$cmd\"" scripts/slash-commands.sh; then
            print_status "Adding new command: $cmd"

            # Add to the case statement in slash-commands.sh
            local cmd_clean=$(echo "$cmd" | sed 's/://')
            sed -i.backup "/\"lint\"|\"\/lint\"/a\\
\\
    \"$cmd_clean\"|\"/$cmd_clean\")\\
        print_header \"Running $cmd\"\\
        npm run $cmd\\
        print_success \"$cmd complete\"\\
        ;;" scripts/slash-commands.sh
        fi
    done

    rm -f scripts/slash-commands.sh.backup 2>/dev/null || true
}

# Auto-detect environment changes and update documentation
detect_environment_changes() {
    print_status "Detecting environment and configuration changes..."

    local changed_files=()

    # Check for recent changes to key configuration files
    local config_files=(
        "package.json"
        "tsconfig.json"
        "eslint.config.js"
        ".env.example"
        "vercel.json"
        "netlify.toml"
        "Dockerfile"
        ".replit"
    )

    for file in "${config_files[@]}"; do
        if [ -f "$file" ]; then
            local last_mod=$(stat -f "%m" "$file" 2>/dev/null || stat -c "%Y" "$file" 2>/dev/null)
            local current_time=$(date +%s)
            local diff=$((current_time - last_mod))

            # If modified in last hour
            if [ $diff -lt 3600 ]; then
                changed_files+=("$file")
            fi
        fi
    done

    if [ ${#changed_files[@]} -gt 0 ]; then
        print_warning "Detected changes in: ${changed_files[*]}"
        print_status "Triggering documentation update..."
        return 0
    fi

    return 1
}

# Main execution
main() {
    print_status "Running auto-update command detection..."

    local needs_update=false

    # Check for package.json changes
    if check_package_changes; then
        update_slash_commands_from_package
        needs_update=true
    fi

    # Check for environment changes
    if detect_environment_changes; then
        needs_update=true
    fi

    # Update slash script with new commands
    update_slash_script

    # If any changes detected, run documentation sync
    if [ "$needs_update" = true ]; then
        print_status "Changes detected - running documentation sync..."
        bash scripts/slash-commands.sh sync
    else
        print_success "No updates needed - system is current"
    fi
}

# Run main function
main "$@"