#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

mkdir -p .backup_quarantine

# Move suspicious backups into quarantine (kept locally, not committed)
find . -type f \( -name "*.bak" -o -name "*.backup" -o -name "*.old" -o -name "*~" -o -name "*.tmp" \) \
  -not -path "./.backup_quarantine/*" -print -exec mv {} .backup_quarantine/ \;

# Report
echo "[INFO] Quarantined backups:"
ls -la .backup_quarantine || true