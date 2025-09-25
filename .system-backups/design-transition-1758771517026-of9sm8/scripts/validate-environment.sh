#!/bin/bash
# Essential Environment Validation Script

# Load .env file if it exists
if [[ -f .env ]]; then
    echo "📄 Loading .env file..."
    export $(grep -v '^#' .env | xargs)
fi

echo "🔍 Validating production environment..."

# Check required environment variables
REQUIRED_VARS=(
    "ANTHROPIC_API_KEY"
    "NODE_ENV"
    "SERVICE_NAME"
)

MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        MISSING_VARS+=("$var")
    fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    echo "❌ Missing required environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "📋 Create .env file from .env.example and set these variables"
    exit 1
fi

# Validate API key format
if [[ ! "$ANTHROPIC_API_KEY" =~ ^sk-ant- ]]; then
    echo "⚠️  ANTHROPIC_API_KEY format may be invalid (should start with 'sk-ant-')"
fi

# Check NODE_ENV
if [[ "$NODE_ENV" != "production" && "$NODE_ENV" != "staging" && "$NODE_ENV" != "development" ]]; then
    echo "⚠️  NODE_ENV should be 'development', 'staging', or 'production'"
fi

echo "✅ Environment validation passed"
echo "📊 Current environment: $NODE_ENV"
echo "🔧 Service: ${SERVICE_NAME:-synthetic-agents}"