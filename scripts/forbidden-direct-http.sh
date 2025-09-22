#!/bin/bash
# Guard script to prevent direct HTTP calls outside of designated client adapters
# Allowlisted: src/clients/*Adapter.(js|ts), tools/anthropic_client.sh, tools/openai_client.sh
# Forbidden: direct use of fetch, axios, curl, request in other locations
# Forbidden: direct API calls to anthropic.com or openai.com in shell scripts

set -euo pipefail

echo "🔍 Checking for forbidden direct HTTP calls..."

violations=()

# Function to check if file should be skipped (allowlisted)
is_allowlisted() {
    local file="$1"

    # Allow client adapters in src/clients/
    if [[ "$file" =~ src/clients/.*Adapter\.(js|ts)$ ]]; then
        return 0
    fi

    # Allow official API client tools
    if [[ "$file" == "./tools/anthropic_client.sh" ]] || [[ "$file" == "tools/anthropic_client.sh" ]] ||
       [[ "$file" == "./tools/openai_client.sh" ]] || [[ "$file" == "tools/openai_client.sh" ]]; then
        return 0
    fi

    # Allow the guard script itself (contains patterns in comments/usage examples)
    if [[ "$file" == "./scripts/forbidden-direct-http.sh" ]] || [[ "$file" == "scripts/forbidden-direct-http.sh" ]]; then
        return 0
    fi

    # Allow network diagnostic scripts (for connectivity checking)
    if [[ "$file" == "./scripts/net_diag.sh" ]] || [[ "$file" == "scripts/net_diag.sh" ]]; then
        return 0
    fi

    # Allow OPERATIONS.md (contains examples and troubleshooting commands)
    if [[ "$file" == "./docs/OPERATIONS.md" ]] || [[ "$file" == "docs/OPERATIONS.md" ]]; then
        return 0
    fi

    # Skip shimmed scripts (they contain blocking code and won't be executed directly)
    if grep -q "EXECUTION SHIM\|Direct execution blocked" "$file" 2>/dev/null; then
        return 0
    fi

    return 1
}

# Check JavaScript/TypeScript files for generic HTTP patterns
echo "📁 Scanning JavaScript/TypeScript files..."
js_patterns=(
    "fetch("
    "axios("
    "request("
    "node-fetch"
    "got("
    "superagent"
)

if [[ -d "src" ]]; then
    for pattern in "${js_patterns[@]}"; do
        while IFS= read -r -d '' file; do
            if is_allowlisted "$file"; then
                continue
            fi

            # Check if file contains the forbidden pattern
            if grep -q "$pattern" "$file" 2>/dev/null; then
                violations+=("$file: contains generic HTTP pattern '$pattern'")
            fi
        done < <(find src -name "*.js" -o -name "*.ts" -print0 2>/dev/null)
    done
fi

# Check shell scripts for API-specific patterns
echo "📁 Scanning shell scripts for API calls..."
api_patterns=(
    "anthropic\.com"
    "api\.anthropic\.com"
    "openai\.com"
    "api\.openai\.com"
)

http_tools=(
    "curl"
    "wget"
    "httpie"
    "http"
)

# Find all shell scripts
while IFS= read -r -d '' file; do
    if is_allowlisted "$file"; then
        continue
    fi

    # Check for API domain + HTTP tool combinations
    for api_pattern in "${api_patterns[@]}"; do
        for http_tool in "${http_tools[@]}"; do
            # Look for lines that contain both API domain and HTTP tool on the same line or nearby lines
            # This reduces false positives where they appear in unrelated contexts
            if grep -i -l "$api_pattern" "$file" 2>/dev/null | grep -q .; then
                # Check if there are lines that contain the HTTP tool in context of the API domain
                if grep -i -C2 "$api_pattern" "$file" 2>/dev/null | grep -i -q "$http_tool"; then
                    # Get specific line numbers where both patterns appear in context
                    line_numbers=$(grep -i -n -C2 "$api_pattern" "$file" 2>/dev/null | grep -i "$http_tool\|$api_pattern" | cut -d: -f1 | head -3 | tr '\n' ',' | sed 's/,$//')

                    # Additional filter: skip obvious false positives and properly guarded API calls
                    api_context=$(grep -i -C5 "$api_pattern" "$file" 2>/dev/null | grep -i "$http_tool")
                    if ! echo "$api_context" | grep -q -E "noreply@|email|mailto|comment|#.*anthropic|API_HOST|export.*API_HOST|preflight.*connectivity"; then
                        # Check if the API call is properly guarded by offline/dry-run checks
                        if ! grep -B10 -A5 "$api_pattern" "$file" 2>/dev/null | grep -q -E "OFFLINE_MODE.*true|DRY_RUN.*true|offline.*mode|mock.*response|connectivity.*check|diagnostic|preflight"; then
                            violations+=("$file:$line_numbers contains API call to $api_pattern using $http_tool")
                            break 2  # Found violation, no need to check other patterns for this file
                        fi
                    fi
                fi
            fi
        done
    done
done < <(find . -type f -name "*.sh" -not -path "./.git/*" -not -path "./node_modules/*" -print0 2>/dev/null)

# Report results
if [ ${#violations[@]} -eq 0 ]; then
    echo "✅ No forbidden direct HTTP calls found"
    exit 0
else
    echo "❌ Found ${#violations[@]} violation(s):"
    for violation in "${violations[@]}"; do
        echo "  $violation"
    done
    echo ""
    echo "Direct HTTP calls are only allowed in:"
    echo "  - src/clients/*Adapter.js"
    echo "  - src/clients/*Adapter.ts"
    echo "  - tools/anthropic_client.sh"
    echo "  - tools/openai_client.sh"
    echo ""
    echo "All API calls must go through the appropriate client wrapper."
    echo "For Anthropic API: use tools/anthropic_client.sh"
    echo "For OpenAI API: use tools/openai_client.sh"
    exit 1
fi