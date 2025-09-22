#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
out="reports/SYSTEM_MAP.md"
mkdir -p reports
{
  echo "# System Map ($(date -u +%FT%TZ))"
  echo "## Repo tree (top 2 levels)"
  if command -v tree >/dev/null 2>&1; then
    tree -L 2 -a -I "node_modules|.git|RUN_LOGS|reports/_archive"
  else
    find . -maxdepth 2 -type d \( -name .git -o -name node_modules -o -path ./reports/_archive \) -prune -o -print
  fi
  echo -e "\n## Git status"
  git rev-parse --abbrev-ref HEAD 2>/dev/null || true
  git log -1 --pretty=fuller 2>/dev/null || true
  git status -s 2>/dev/null || true
  echo -e "\n## Key docs"
  ls -1 reports/HANDOFF_ONE*.md reports/STATUS.md 2>/dev/null || true
} > "$out"
echo "Wrote $out"
