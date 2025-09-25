#!/usr/bin/env bash
# EXECUTION SHIM: scripts/update_anthropic_key.sh
# This script has been shimmed to prevent direct execution.
# All scripts must go through the unified launcher for proper environment loading.

echo "[FAIL] Direct execution blocked. Use: ./run.sh update_anthropic_key [args]"
echo "[INFO] This ensures proper environment loading and API key management."
exit 1

# Helper script to safely update Anthropic API key
set -euo pipefail

ENV_FILE=".env"

echo "🔑 Anthropic API Key Updater"
echo "Current key status: INVALID (authentication_error)"
echo ""
echo "Steps to get a new key:"
echo "1. Visit: https://console.anthropic.com/"
echo "2. Go to API Keys section"
echo "3. Create a new key (starts with 'sk-ant-api')"
echo ""

# Backup current .env
cp "$ENV_FILE" "${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
echo "✅ Backed up current .env file"

# Prompt for new key
read -r -s -p "Enter your new ANTHROPIC_API_KEY (input hidden): " NEW_KEY
echo ""

if [[ -z "$NEW_KEY" ]]; then
    echo "❌ No key entered"
    exit 1
fi

if [[ ! "$NEW_KEY" =~ ^sk-ant-api ]]; then
    echo "❌ Key should start with 'sk-ant-api'"
    exit 1
fi

# Update the key in .env
sed -i.tmp "s/^ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$NEW_KEY/" "$ENV_FILE"
rm "${ENV_FILE}.tmp"

echo "✅ Updated ANTHROPIC_API_KEY in .env"
echo "🧪 Testing new key..."

# Test the new key
export ANTHROPIC_API_KEY="$NEW_KEY"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${ANTHROPIC_API_KEY}" \
    -H "anthropic-version: 2023-06-01" \
    -d '{"model": "claude-3-haiku-20240307", "max_tokens": 10, "messages": [{"role": "user", "content": "Test"}]}' \
    https://api.anthropic.com/v1/messages)

case "$HTTP_CODE" in
    200)
        echo "✅ New key is valid! (HTTP 200)"
        echo "You can now run the smoke test again."
        ;;
    401)
        echo "❌ New key is also invalid (HTTP 401)"
        echo "Please check the key and try again."
        exit 1
        ;;
    *)
        echo "⚠️ Unexpected response (HTTP $HTTP_CODE)"
        echo "Key might be valid but there could be other issues."
        ;;
esac