#!/usr/bin/env bash
set -euo pipefail

echo "📊 Checking documentation freshness..."

# Check if key files are newer than documentation
DOCS_DIR="docs/SYSTEM_DOCS"
STALE_FOUND=0

# Key source directories to monitor
SOURCE_DIRS=("src/core" "src/agents" "src/shared" "CLAUDE.md" "package.json")

if [ -d "$DOCS_DIR" ]; then
    for src in "${SOURCE_DIRS[@]}"; do
        if [ -e "$src" ]; then
            if [ "$src" -nt "$DOCS_DIR/README.md" ]; then
                echo "⚠️  $src is newer than system docs"
                STALE_FOUND=1
            fi
        fi
    done
else
    echo "❌ System documentation not found"
    STALE_FOUND=1
fi

if [ $STALE_FOUND -eq 1 ]; then
    echo ""
    echo "🔄 Run 'npm run docs:sync' to update documentation"
    exit 1
else
    echo "✅ Documentation is up to date"
fi
