#!/usr/bin/env bash
set -Eeuo pipefail

# Setup automatic commit and push hooks

echo "🔧 Setting up automatic Git commit/push system..."

# Create post-commit hook for automatic push
cat > .git/hooks/post-commit << 'EOF'
#!/bin/bash
# Auto-push after commit (non-blocking)
echo "🚀 Auto-pushing to remote..."
if git push origin main 2>/dev/null; then
    echo "✅ Successfully pushed to remote"
else
    echo "⚠️ Push failed, but commit is safe locally"
    echo "💡 Run 'git push' manually when ready"
fi
EOF

chmod +x .git/hooks/post-commit

# Create pre-push hook for safety checks
cat > .git/hooks/pre-push << 'EOF'
#!/bin/bash
# Safety checks before push
echo "🔍 Running safety checks before push..."

# Check if we're pushing to main branch
if [[ "$2" == *"main"* ]]; then
    echo "⚠️ Pushing to main branch - running quick checks..."

    # Quick TypeScript check
    if ! npm run typecheck > /dev/null 2>&1; then
        echo "❌ TypeScript errors detected - push cancelled"
        exit 1
    fi

    echo "✅ Safety checks passed"
fi
EOF

chmod +x .git/hooks/pre-push

# Test the setup
echo "✅ Auto-commit/push system configured!"
echo ""
echo "📋 What this does:"
echo "  - After each commit, automatically tries to push"
echo "  - Before push to main, runs TypeScript checks"
echo "  - Non-blocking: local commits always succeed"
echo ""
echo "🎯 Now when you commit, it will auto-push!"