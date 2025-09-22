#!/usr/bin/env bash

# P0 Hardening: Forbidden Direct HTTP Guard
# Scans for direct HTTP calls (fetch/axios/curl/request) in src/ directory
# Enforces AC8: [AC-CLIENT-ONLY] 저장소 내 direct HTTP 호출 0건

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

error() {
  echo -e "${RED}ERROR: $*${NC}" >&2
}

warn() {
  echo -e "${YELLOW}WARN: $*${NC}" >&2
}

info() {
  echo -e "${BLUE}INFO: $*${NC}" >&2
}

success() {
  echo -e "${GREEN}SUCCESS: $*${NC}" >&2
}

# Main guard function
guard_no_direct_http() {
  local src_dir="$PROJECT_ROOT/src"
  local violations=0
  local total_files=0

  info "P0 Hardening: Scanning for forbidden direct HTTP calls"
  info "Target directory: $src_dir"

  if [[ ! -d "$src_dir" ]]; then
    warn "src/ directory not found, skipping HTTP guard"
    return 0
  fi

  # Patterns to detect direct HTTP calls
  local patterns=(
    "fetch\s*\("
    "axios\."
    "curl\s"
    "\.get\s*\(\s*['\"]https?://"
    "\.post\s*\(\s*['\"]https?://"
    "\.put\s*\(\s*['\"]https?://"
    "\.delete\s*\(\s*['\"]https?://"
    "node-fetch"
    "require\s*\(\s*['\"]node-fetch['\"]"
    "import.*from.*['\"]node-fetch['\"]"
    "https?://api\."
    "XMLHttpRequest"
    "new\s+Request\s*\("
  )

  # Allowlist patterns (legitimate uses)
  local allowlist=(
    "// GUARD: allowed direct HTTP"
    "# GUARD: allowed direct HTTP"
    "/\\* GUARD: allowed direct HTTP"
  )

  echo
  info "Scanning for forbidden HTTP patterns..."

  while IFS= read -r -d '' file; do
    ((total_files++))

    local file_violations=0
    local relative_path="${file#$PROJECT_ROOT/}"

    for pattern in "${patterns[@]}"; do
      local matches
      matches=$(grep -n -E "$pattern" "$file" 2>/dev/null || true)

      if [[ -n "$matches" ]]; then
        # Check if any matches are in allowlist
        local allowed_matches=""
        for allow_pattern in "${allowlist[@]}"; do
          local line_numbers
          line_numbers=$(echo "$matches" | grep -E "$allow_pattern" | cut -d: -f1 || true)
          if [[ -n "$line_numbers" ]]; then
            allowed_matches="$allowed_matches $line_numbers"
          fi
        done

        # Filter out allowed matches
        if [[ -n "$allowed_matches" ]]; then
          local filtered_matches=""
          while IFS= read -r line; do
            local line_num
            line_num=$(echo "$line" | cut -d: -f1)
            if [[ ! " $allowed_matches " =~ " $line_num " ]]; then
              filtered_matches="$filtered_matches$line\n"
            fi
          done <<< "$matches"
          matches="$filtered_matches"
        fi

        if [[ -n "$matches" && "$matches" != "\n" ]]; then
          if [[ $file_violations -eq 0 ]]; then
            error "Forbidden direct HTTP calls found in: $relative_path"
          fi

          echo -e "$matches" | while IFS= read -r match; do
            if [[ -n "$match" ]]; then
              echo "  Line ${match%%:*}: ${match#*:}"
              ((violations++))
            fi
          done

          ((file_violations++))
        fi
      fi
    done

  done < <(find "$src_dir" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \) -print0)

  echo
  info "HTTP Guard Summary:"
  info "- Files scanned: $total_files"

  if [[ $violations -eq 0 ]]; then
    success "✅ No forbidden direct HTTP calls detected"
    success "✅ AC8 [AC-CLIENT-ONLY] compliance verified"
    return 0
  else
    error "❌ Found $violations forbidden direct HTTP call(s)"
    error "❌ AC8 [AC-CLIENT-ONLY] compliance FAILED"
    echo
    error "Resolution steps:"
    error "1. Replace direct HTTP calls with adapter layer:"
    error "   - Use callAnthropicViaSingleClient() from ../clients/anthropicAdapter"
    error "   - Use callOpenAI() from ../clients/openaiAdapter"
    error "2. Or add allowlist comment: // GUARD: allowed direct HTTP"
    error "3. Re-run: $0"
    return 1
  fi
}

# Help function
show_help() {
  cat <<EOF
P0 Hardening: Forbidden Direct HTTP Guard

USAGE:
  $0 [OPTIONS]

DESCRIPTION:
  Scans src/ directory for forbidden direct HTTP calls to enforce
  AC8 [AC-CLIENT-ONLY] compliance. All API calls must route through
  the single client adapter layer.

OPTIONS:
  -h, --help    Show this help message

PATTERNS DETECTED:
  - fetch() calls
  - axios.* methods
  - curl commands
  - HTTP method calls (.get, .post, etc.)
  - node-fetch imports
  - Direct API URLs (https://api.*)

ALLOWLIST:
  Add comment to allow specific lines:
    // GUARD: allowed direct HTTP

EXAMPLES:
  $0                    # Run HTTP guard
  $0 --help            # Show help

EXIT CODES:
  0 - No violations found (AC8 compliant)
  1 - Violations detected (AC8 non-compliant)
  2 - Script error

EOF
}

# Main execution
main() {
  case "${1:-}" in
    -h|--help)
      show_help
      exit 0
      ;;
    "")
      guard_no_direct_http
      ;;
    *)
      error "Unknown option: $1"
      show_help
      exit 2
      ;;
  esac
}

# Only run if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi