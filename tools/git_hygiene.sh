#!/usr/bin/env bash
set -Eeuo pipefail

# P0 Git Hygiene and Security Scanner
# - Secret scanning and prevention
# - Git configuration validation
# - Working tree cleanliness checks
# - Commit message format validation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Standard logging
step() { printf "\033[36m[STEP]\033[0m %s\n" "$*"; }
ok()   { printf "\033[32m[OK]\033[0m %s\n" "$*"; }
warn() { printf "\033[33m[WARN]\033[0m %s\n" "$*"; }
fail() { printf "\033[31m[FAIL]\033[0m %s\n" "$*"; }

# Secret patterns to scan for
SECRET_PATTERNS=(
  "sk-ant-[a-zA-Z0-9_-]{40,}"
  "sk-[a-zA-Z0-9]{40,}"
  "ANTHROPIC_API_KEY.*=.*sk-"
  "OPENAI_API_KEY.*=.*sk-"
  "bearer [a-zA-Z0-9_-]{20,}"
  "password.*=.*[^\\*]{8,}"
  "secret.*=.*[^\\*]{8,}"
  "token.*=.*[^\\*]{20,}"
)

# Files that should be ignored by git
REQUIRED_GITIGNORE_PATTERNS=(
  ".env"
  ".env.local"
  "*.log"
  "node_modules/"
  "dist/"
  "build/"
  ".DS_Store"
  "*.tmp"
  "*.cache"
)

# Scan for exposed secrets in repository
scan_for_secrets() {
  step "Scanning repository for exposed secrets"

  local secrets_found=false
  local total_violations=0

  for pattern in "${SECRET_PATTERNS[@]}"; do
    step "Scanning for pattern: ${pattern:0:20}..."

    # Search in tracked files, excluding known safe contexts
    local matches
    matches=$(git grep -n -E "$pattern" -- \
      ':(exclude)*.md' \
      ':(exclude)*test*' \
      ':(exclude)*spec*' \
      ':(exclude)*example*' \
      ':(exclude)*mock*' \
      2>/dev/null | \
      grep -v -E "mask_secret|example|test|\*\*\*\*|placeholder|sample" || true)

    if [[ -n "$matches" ]]; then
      fail "SECURITY VIOLATION: Potential secret found with pattern: $pattern"
      echo "$matches" | sed 's/^/       /'
      secrets_found=true
      ((total_violations++))
    fi
  done

  if [[ "$secrets_found" == "true" ]]; then
    fail "Found $total_violations secret pattern violations"
    echo "       Review the matches above and ensure secrets are properly masked"
    echo "       Use mask_secret() function from tools/load_env_v3.sh"
    return 1
  else
    ok "No exposed secrets found in repository"
    return 0
  fi
}

# Validate .gitignore configuration
validate_gitignore() {
  step "Validating .gitignore configuration"

  if [[ ! -f .gitignore ]]; then
    fail ".gitignore file missing"
    echo "       Create .gitignore with essential patterns"
    return 1
  fi

  local missing_patterns=()

  for pattern in "${REQUIRED_GITIGNORE_PATTERNS[@]}"; do
    if ! grep -q "^${pattern//\//\\/}" .gitignore; then
      missing_patterns+=("$pattern")
    fi
  done

  if [[ ${#missing_patterns[@]} -gt 0 ]]; then
    warn ".gitignore missing ${#missing_patterns[@]} important patterns:"
    for pattern in "${missing_patterns[@]}"; do
      echo "       - $pattern"
    done
    warn "Consider adding these patterns to .gitignore"
  else
    ok ".gitignore contains all essential patterns"
  fi

  # Check if .env files are properly ignored
  if git ls-files | grep -E '\.env(\.local)?$' >/dev/null 2>&1; then
    fail "SECURITY VIOLATION: .env files are tracked by git"
    echo "       Remove .env files from git tracking:"
    echo "       git rm --cached .env .env.local"
    echo "       Ensure .env patterns are in .gitignore"
    return 1
  else
    ok ".env files are properly ignored"
  fi

  return 0
}

# Check working tree cleanliness
check_working_tree() {
  step "Checking working tree cleanliness"

  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    warn "Not a git repository - skipping working tree check"
    return 0
  fi

  # Check for uncommitted changes
  local status_output
  status_output=$(git status --porcelain 2>/dev/null || true)

  if [[ -n "$status_output" ]]; then
    local modified_count
    modified_count=$(echo "$status_output" | wc -l)

    warn "Working tree has $modified_count uncommitted changes"
    echo "       Modified files:"
    echo "$status_output" | head -10 | sed 's/^/         /'
    if [[ $modified_count -gt 10 ]]; then
      echo "       ... and $((modified_count - 10)) more"
    fi
    echo "       Use --autocommit flag or commit manually before proceeding"
    return 1
  else
    ok "Working tree is clean"
    return 0
  fi
}

# Validate recent commit messages
validate_commit_messages() {
  step "Validating recent commit message format"

  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    warn "Not a git repository - skipping commit message validation"
    return 0
  fi

  # Check last 5 commits for format compliance
  local commit_count=0
  local compliant_count=0

  while IFS= read -r commit_msg; do
    ((commit_count++))

    # Standard format: type(scope): description
    # Examples: feat(run): add new feature, fix(api): resolve bug, chore(docs): update
    if echo "$commit_msg" | grep -qE "^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\([^)]+\))?: "; then
      ((compliant_count++))
    else
      warn "Non-standard commit message format: ${commit_msg:0:60}..."
    fi

  done < <(git log --oneline -5 --pretty=format:'%s' 2>/dev/null || true)

  if [[ $commit_count -eq 0 ]]; then
    warn "No commits found for validation"
    return 0
  fi

  local compliance_pct
  compliance_pct=$(( (compliant_count * 100) / commit_count ))

  if [[ $compliance_pct -ge 80 ]]; then
    ok "Commit message format compliance: $compliance_pct% ($compliant_count/$commit_count)"
  else
    warn "Low commit message format compliance: $compliance_pct% ($compliant_count/$commit_count)"
    echo "       Use format: type(scope): description"
    echo "       Examples: feat(api): add new endpoint, fix(auth): resolve login issue"
  fi

  return 0
}

# Check for large files that shouldn't be committed
check_large_files() {
  step "Checking for large files in repository"

  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    warn "Not a git repository - skipping large file check"
    return 0
  fi

  # Find files larger than 10MB
  local large_files
  large_files=$(git ls-files | xargs -I {} du -b {} 2>/dev/null | awk '$1 > 10485760 {print $2}' || true)

  if [[ -n "$large_files" ]]; then
    warn "Large files detected (>10MB):"
    echo "$large_files" | while IFS= read -r file; do
      local size_mb
      size_mb=$(du -m "$file" | cut -f1)
      echo "       - $file (${size_mb}MB)"
    done
    warn "Consider using Git LFS for large files"
    return 1
  else
    ok "No large files detected"
    return 0
  fi
}

# Validate branch protection and safety
check_branch_safety() {
  step "Checking branch safety and protection"

  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    warn "Not a git repository - skipping branch safety check"
    return 0
  fi

  local current_branch
  current_branch=$(git branch --show-current 2>/dev/null || echo "unknown")

  # Check if on main/master/develop
  if [[ "$current_branch" =~ ^(main|master|develop)$ ]]; then
    warn "Working directly on protected branch: $current_branch"
    echo "       Consider using feature branches for development"
    echo "       git checkout -b feature/your-feature-name"
  else
    ok "Working on feature branch: $current_branch"
  fi

  # Check if branch is ahead/behind origin
  if git rev-parse --abbrev-ref @{u} >/dev/null 2>&1; then
    local ahead behind
    ahead=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo "0")
    behind=$(git rev-list --count @{u}..HEAD 2>/dev/null || echo "0")

    if [[ "$ahead" -gt 0 ]]; then
      warn "Branch is $ahead commits behind origin"
      echo "       Consider: git pull --rebase"
    fi

    if [[ "$behind" -gt 0 ]]; then
      ok "Branch is $behind commits ahead of origin"
    fi
  else
    warn "No upstream branch set"
  fi

  return 0
}

# Main hygiene check function
run_git_hygiene() {
  step "Running comprehensive git hygiene checks"
  echo

  local checks_failed=0

  # Run all checks
  if ! scan_for_secrets; then
    ((checks_failed++))
  fi
  echo

  if ! validate_gitignore; then
    ((checks_failed++))
  fi
  echo

  if ! check_working_tree; then
    ((checks_failed++))
  fi
  echo

  validate_commit_messages  # This is informational only
  echo

  if ! check_large_files; then
    ((checks_failed++))
  fi
  echo

  check_branch_safety  # This is informational only
  echo

  # Final summary
  if [[ $checks_failed -eq 0 ]]; then
    ok "All critical git hygiene checks passed"
    return 0
  else
    fail "$checks_failed critical git hygiene check(s) failed"
    echo "       Address the issues above before proceeding"
    return 1
  fi
}

# CLI interface
show_usage() {
  echo "P0 Git Hygiene and Security Scanner"
  echo "Usage: $0 [command]"
  echo
  echo "Commands:"
  echo "  --secrets             Run secret scanning only"
  echo "  --gitignore           Validate .gitignore only"
  echo "  --working-tree        Check working tree cleanliness only"
  echo "  --commit-messages     Validate commit message format only"
  echo "  --large-files         Check for large files only"
  echo "  --branch-safety       Check branch safety only"
  echo "  --all                 Run all checks (default)"
  echo
  echo "Examples:"
  echo "  $0                    # Run all hygiene checks"
  echo "  $0 --secrets          # Run secret scanning only"
  echo "  $0 --working-tree     # Check if tree is clean"
}

# Main execution
main() {
  local command="${1:-all}"

  case "$command" in
    --secrets)
      scan_for_secrets
      ;;
    --gitignore)
      validate_gitignore
      ;;
    --working-tree)
      check_working_tree
      ;;
    --commit-messages)
      validate_commit_messages
      ;;
    --large-files)
      check_large_files
      ;;
    --branch-safety)
      check_branch_safety
      ;;
    --all|all|"")
      run_git_hygiene
      ;;
    --help|-h)
      show_usage
      return 0
      ;;
    *)
      fail "Unknown command: $command"
      show_usage
      return 1
      ;;
  esac
}

# Execute if called directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi