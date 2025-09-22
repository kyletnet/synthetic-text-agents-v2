#!/usr/bin/env bash
# P0 Security: Comprehensive Backup File Cleanup
# BSD-compatible for macOS, moves backup/temp files to quarantine and untracks from git

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
ok() { echo -e "${GREEN}[OK]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }

# Find git root or use current directory
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

QUARANTINE_DIR=".backup_quarantine"

info "Starting comprehensive backup cleanup from: $ROOT"

# Create quarantine directory if it doesn't exist
mkdir -p "$QUARANTINE_DIR"

# Backup/temp file patterns that often contain secrets
BACKUP_PATTERNS=(
  "*.bak"
  "*.backup"
  "*.old"
  "*.original"
  "*.orig"
  "*~"
  "*.tmp"
  "*.temp"
  "*.swp"
  "*.swo"
  ".env.bak*"
  ".env.backup*"
  "*.save"
  "*.copy"
  "*.cp"
  "*_backup"
  "*_backup.*"
  "*-backup"
  "*-backup.*"
  "*_original"
  "*_original.*"
  "*-original"
  "*-original.*"
)

# Counters
MOVED_COUNT=0
UNTRACKED_COUNT=0
SKIPPED_COUNT=0

# Function to safely move file to quarantine
quarantine_file() {
  local file="$1"
  local dest_name="$(basename "$file")"
  local dest_path="$QUARANTINE_DIR/$dest_name"

  # If destination exists, add timestamp
  if [[ -f "$dest_path" ]]; then
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    dest_path="$QUARANTINE_DIR/${dest_name}_${timestamp}"
  fi

  info "Quarantining: $file -> $dest_path"
  mv "$file" "$dest_path"
  ((MOVED_COUNT++))

  # If file was tracked by git, remove from index
  if git ls-files --error-unmatch "$file" >/dev/null 2>&1; then
    git rm --cached "$file" >/dev/null 2>&1 || true
    info "Untracked from git: $file"
    ((UNTRACKED_COUNT++))
  fi
}

# Function to find and quarantine files by pattern
process_pattern() {
  local pattern="$1"

  # Use find to locate files matching pattern, excluding quarantine directory
  find . -name "$pattern" -type f -not -path "./$QUARANTINE_DIR/*" 2>/dev/null | while read -r file; do
    if [[ -f "$file" ]]; then
      quarantine_file "$file"
    fi
  done
}

info "Scanning for backup and temporary files..."

# Process each backup pattern
for pattern in "${BACKUP_PATTERNS[@]}"; do
  info "Processing pattern: $pattern"
  process_pattern "$pattern"
done

# Process environment backup files specifically
info "Processing environment backup files..."
find . -name ".env.*" -type f -not -path "./$QUARANTINE_DIR/*" 2>/dev/null | while read -r file; do
  # Only quarantine backup-like env files
  if [[ "$file" =~ \.(bak|backup|old|orig|save|tmp)[^/]*$ ]]; then
    quarantine_file "$file"
  else
    info "Skipping legitimate env file: $file"
    ((SKIPPED_COUNT++))
  fi
done

# Process exports directory (contains sensitive exports)
info "Processing exports directory..."
if [[ -d "exports" ]]; then
  find exports -type f 2>/dev/null | while read -r file; do
    if [[ -f "$file" ]]; then
      quarantine_file "$file"
    fi
  done
  # Remove empty exports directory if it exists
  if [[ -d "exports" && -z "$(ls -A exports 2>/dev/null || true)" ]]; then
    rmdir exports
    info "Removed empty exports directory"
  fi
fi

# Process other sensitive file patterns
info "Processing sensitive file patterns..."
SENSITIVE_PATTERNS=(
  "*.key"
  "*.keys"
  "secret.*"
  "secrets.*"
  "credentials.*"
  "*.pem"
  "*.p12"
  "*.pfx"
  "*.jks"
  "id_rsa*"
  "id_dsa*"
  "id_ecdsa*"
  "id_ed25519*"
)

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  find . -name "$pattern" -type f -not -path "./$QUARANTINE_DIR/*" -not -path "./node_modules/*" 2>/dev/null | while read -r file; do
    if [[ -f "$file" ]]; then
      warn "Found sensitive file: $file"
      quarantine_file "$file"
    fi
  done
done

# Show quarantine contents
echo
if [[ -d "$QUARANTINE_DIR" ]] && [[ -n "$(ls -A "$QUARANTINE_DIR" 2>/dev/null || true)" ]]; then
  ok "Quarantine directory contents:"
  ls -la "$QUARANTINE_DIR" | sed 's/^/    /'
else
  info "Quarantine directory is empty"
fi

# Final summary
echo
info "Cleanup Summary:"
info "  Files moved to quarantine: $MOVED_COUNT"
info "  Files untracked from git: $UNTRACKED_COUNT"
info "  Files skipped (legitimate): $SKIPPED_COUNT"

# Check for any remaining tracked backup files
echo
info "Checking for remaining tracked backup files..."
TRACKED_BACKUPS=$(git ls-files | grep -E '\.(bak|backup|old|orig|tmp|temp|swp|swo)$|~$' || true)

if [[ -n "$TRACKED_BACKUPS" ]]; then
  warn "Found remaining tracked backup files:"
  echo "$TRACKED_BACKUPS" | sed 's/^/    /'
  warn "Consider manual review and removal with: git rm --cached <file>"
else
  ok "No tracked backup files found"
fi

# Security recommendations
echo
if [[ $MOVED_COUNT -gt 0 ]]; then
  warn "SECURITY REVIEW REQUIRED:"
  echo "  1. Review quarantined files for sensitive data"
  echo "  2. If files contain secrets, rotate those credentials immediately"
  echo "  3. Run 'npm run guard:git' to verify no secrets remain in repo"
  echo "  4. Consider secure deletion: rm -P .backup_quarantine/* (after review)"
  echo "  5. Commit changes to update git index"
else
  ok "No backup files found - repository is clean"
fi

echo
ok "Backup cleanup completed"
exit 0