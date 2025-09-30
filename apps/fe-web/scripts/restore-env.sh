#!/bin/bash

# API Key Auto-Restore Script
# This script restores the API key if it's missing from .env.local

ENV_FILE=".env.local"
BACKUP_FILE=".env.backup"

echo "🔧 Checking API key configuration..."

if [ ! -f "$ENV_FILE" ] || ! grep -q "sk-ant-api03" "$ENV_FILE" 2>/dev/null; then
    echo "⚠️  API key missing or invalid. Restoring from backup..."

    if [ -f "$BACKUP_FILE" ]; then
        cp "$BACKUP_FILE" "$ENV_FILE"
        echo "✅ API key restored successfully!"
        echo "📊 Current configuration:"
        grep "ANTHROPIC_API_KEY" "$ENV_FILE" | sed 's/sk-ant-api03.*/sk-ant-api03-***[HIDDEN]***/'
    else
        echo "❌ Backup file not found. Please manually set the API key."
    fi
else
    echo "✅ API key is properly configured!"
fi