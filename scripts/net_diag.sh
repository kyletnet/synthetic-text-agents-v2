#!/usr/bin/env bash
set -euo pipefail

# Network diagnostics for connectivity troubleshooting
OUT="reports/net_diag_$(date -u +%Y%m%dT%H%M%SZ).md"
mkdir -p reports

API_HOST="${API_HOST:-${API_HOST_DEFAULT:-https://api.anthropic.com}}"

echo "# Connectivity Diagnostic" > "$OUT"
echo "- TS: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUT"
echo "- API_HOST: $API_HOST" >> "$OUT"
echo "- PROXY: \`${HTTPS_PROXY:-} | ${HTTP_PROXY:-}\` NO_PROXY: \`${NO_PROXY:-}\`" >> "$OUT"

echo "" >> "$OUT"
echo "## DNS Resolution (scutil)" >> "$OUT"
{ scutil --dns 2>&1 | head -n 50; } >> "$OUT" || echo "scutil failed" >> "$OUT"

echo "" >> "$OUT"
echo "## Curl HEAD Request" >> "$OUT"
{ curl -sS -I --max-time 10 "$API_HOST" | head -n 20; } >> "$OUT" || echo "Curl HEAD failed" >> "$OUT"

echo "" >> "$OUT"
echo "## Node.js Options" >> "$OUT"
echo "NODE_OPTIONS: \`${NODE_OPTIONS:-}\`" >> "$OUT"

echo "" >> "$OUT"
echo "## IPv4/IPv6 Socket Test" >> "$OUT"
{
  echo "Testing IPv4 resolution..."
  nslookup "$(echo "$API_HOST" | sed 's|https://||' | sed 's|/.*||')" 2>&1 | head -n 10
} >> "$OUT" || echo "nslookup failed" >> "$OUT"

# Create symlink to latest diagnostic
ln -sf "$(basename "$OUT")" reports/net_diag_last.md

echo "$OUT"