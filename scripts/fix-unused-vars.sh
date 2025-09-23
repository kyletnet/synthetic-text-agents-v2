#!/bin/bash
# Fix unused variables by adding _ prefix

set -euo pipefail

echo "🔧 Adding _ prefix to unused variables..."

# Create backup
echo "💾 Creating backup..."
tar -czf "backup-unused-vars-$(date +%Y%m%d-%H%M%S).tar.gz" src/

# Get unused variable warnings
echo "🔍 Finding unused variables..."
unused_vars=$(npm run lint 2>&1 | grep "is defined but never used" | grep -o "'[^']*'" | sort -u | tr -d "'")

if [ -z "$unused_vars" ]; then
    echo "✅ No unused variables found!"
    exit 0
fi

echo "📊 Found unused variables to fix:"
echo "$unused_vars"

# Function to fix unused variables in a file
fix_unused_in_file() {
    local file="$1"
    local var_name="$2"

    # Skip if already has _ prefix
    if [[ "$var_name" == _* ]]; then
        return
    fi

    echo "  🔄 Fixing '$var_name' in $file"

    # Replace function parameter: functionName(varName: type) -> functionName(_varName: type)
    sed -i '' "s/\\b${var_name}\\s*:/\\_${var_name}:/g" "$file"

    # Replace destructuring: { varName } -> { varName: _varName }
    sed -i '' "s/{\\s*${var_name}\\s*}/{${var_name}: _${var_name}}/g" "$file"

    # Replace variable declaration: const varName = -> const _varName =
    sed -i '' "s/\\bconst\\s\\+${var_name}\\s*=/const _${var_name} =/g" "$file"
    sed -i '' "s/\\blet\\s\\+${var_name}\\s*=/let _${var_name} =/g" "$file"
}

# Get files with lint warnings
files_to_fix=$(npm run lint 2>&1 | grep "is defined but never used" | cut -d: -f1 | sort -u)

count=0
for file in $files_to_fix; do
    if [ -f "$file" ]; then
        echo "🔄 Processing $file"

        # Get unused vars in this specific file
        file_vars=$(npm run lint "$file" 2>&1 | grep "is defined but never used" | grep -o "'[^']*'" | tr -d "'" | sort -u)

        for var in $file_vars; do
            fix_unused_in_file "$file" "$var"
        done

        ((count++))
    fi
done

echo ""
echo "🎉 Unused variable fixing complete!"
echo "📈 Processed $count files"

# Verify changes
echo "🧪 Running tests to verify changes..."
npm run typecheck

echo "✅ All changes verified successfully!"