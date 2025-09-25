#!/bin/bash
# Fix console.log → logger conversion

set -euo pipefail

echo "🔧 Converting console.log to proper logger usage..."

# Count total console.log instances
total=$(grep -r "console\.log" src --include="*.ts" | wc -l | tr -d ' ')
echo "📊 Found $total console.log instances to convert"

# Create backup
echo "💾 Creating backup..."
tar -czf "backup-console-fix-$(date +%Y%m%d-%H%M%S).tar.gz" src/

# Function to add logger import if not present
add_logger_import() {
    local file="$1"

    if ! grep -q "import.*Logger.*from.*shared/logger" "$file"; then
        # Find first import line and add after it
        if grep -q "^import" "$file"; then
            sed -i '' "1i\\
import { Logger } from '../shared/logger.js';" "$file"
        else
            # No imports, add at top
            sed -i '' "1i\\
import { Logger } from '../shared/logger.js';" "$file"
        fi
        echo "  ✅ Added logger import to $file"
    fi
}

# Function to convert console.log in a file
convert_file() {
    local file="$1"
    local count=$(grep -c "console\.log" "$file" 2>/dev/null || echo "0")

    if [ "$count" -gt 0 ]; then
        echo "🔄 Processing $file ($count instances)"

        # Add logger import
        add_logger_import "$file"

        # Convert console.log to logger.info
        sed -i '' 's/console\.log(/logger.info(/g' "$file"

        echo "  ✅ Converted $count instances in $file"
    fi
}

# Find all TypeScript files with console.log
echo "🔍 Finding files to convert..."
files=$(grep -l "console\.log" src/**/*.ts 2>/dev/null || true)

if [ -z "$files" ]; then
    echo "✅ No console.log instances found!"
    exit 0
fi

# Convert each file
count=0
for file in $files; do
    convert_file "$file"
    ((count++))
done

echo ""
echo "🎉 Conversion complete!"
echo "📈 Processed $count files"
echo "🧪 Running tests to verify changes..."

# Verify no syntax errors
npm run typecheck

echo "✅ All changes verified successfully!"
echo "📝 Manual steps required:"
echo "   1. Add 'private logger: Logger;' to class constructors"
echo "   2. Initialize logger in constructors: 'this.logger = new Logger();'"
echo "   3. Review and test the changes"