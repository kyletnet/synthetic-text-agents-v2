#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

# File candidates: tracked + untracked (text only, size<2MB)
files=$(git ls-files -z; git ls-files -o -z --exclude-standard 2>/dev/null || true) | tr -d '\000' | while read -r f; do
  [ -f "$f" ] || continue
  # Skip binaries >2MB
  sz=$(wc -c < "$f" 2>/dev/null || echo 0)
  [ "$sz" -gt 2000000 ] && continue
  file "$f" 2>/dev/null | grep -qi "text" || continue
  echo "$f"
done

# Patterns (extendable): Anthropic/OpenAI keys, common tokens
pat='sk-(ant-api[0-9]+-[A-Za-z0-9_-]{40,}|[A-Za-z0-9_-]{40,})'

viol=0
while read -r f; do
  grep -I -nE "$pat" "$f" >/dev/null 2>&1 || continue
  echo "[SECRET] $f"
  viol=1
done <<<"$(git ls-files; git ls-files -o --exclude-standard 2>/dev/null || true)"

if [ "$viol" -ne 0 ]; then
  echo "[FAIL] Secrets detected. Clean or add to .gitignore, then rotate keys if exposed."
  exit 1
fi

echo "[OK] No secret patterns found."