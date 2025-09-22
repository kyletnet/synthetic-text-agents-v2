#!/usr/bin/env bash
set -euo pipefail
AUTO=${AUTO_COMMIT:-false}
CHANGED=$(git status --porcelain | wc -l | tr -d ' ')
if [[ "$CHANGED" -eq 0 ]]; then echo "[post-run] no changes"; exit 0; fi
MSG="${1:-chore(run): artifacts & configs}"
if [[ "$AUTO" == "true" ]]; then
  git add -A && git commit -m "$MSG" || true
  echo "[post-run] auto-committed"
else
  echo "[post-run] commit now? (y/N)"; read -r a
  if [[ "${a:-N}" =~ ^[Yy]$ ]]; then git add -A && git commit -m "$MSG" || true; echo "[post-run] committed"; else echo "[post-run] skipped"; fi
fi
