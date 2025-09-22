#!/usr/bin/env bash
set -Eeuo pipefail

# Anthropic API Setup with Multi-API Fallback System

echo "🤖 Anthropic API Setup"
echo "======================"

# Color helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}🔧 $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Check current setup
print_status "Checking current API configuration..."

# Check if Anthropic API keys are already set
if grep -q "ANTHROPIC_API_KEY" .env 2>/dev/null; then
    CURRENT_KEY=$(grep "ANTHROPIC_API_KEY" .env | cut -d'=' -f2 | tr -d '"')
    if [ -n "$CURRENT_KEY" ] && [ "$CURRENT_KEY" != "placeholder" ] && [ "$CURRENT_KEY" != "your-key-here" ]; then
        print_success "Anthropic API key already configured"
        echo "Current key: ${CURRENT_KEY:0:10}..."

        # Test the existing key
        print_status "Testing existing API key..."
        if ANTHROPIC_API_KEY="$CURRENT_KEY" bash tools/anthropic_client.sh --smoke > /dev/null 2>&1; then
            print_success "Existing API key works!"
            echo ""
            echo "🎯 Your system is ready to use real AI!"
            echo "💡 Test with: npm run dev"
            exit 0
        else
            print_warning "Existing API key doesn't work, need to update"
        fi
    fi
fi

# API key setup
echo ""
echo "📋 Anthropic API Key Setup"
echo ""
echo "💡 You mentioned you have Anthropic API keys ready!"
echo ""
echo "🔑 Please enter your PRIMARY Anthropic API key:"
echo "   (It should start with 'sk-ant-')"
read -s PRIMARY_KEY

echo ""
echo "🔑 Please enter your BACKUP Anthropic API key (optional):"
echo "   (Leave empty if you only have one key)"
read -s BACKUP_KEY

# Validate keys
if [ -z "$PRIMARY_KEY" ]; then
    print_error "Primary API key is required!"
    exit 1
fi

if [[ ! "$PRIMARY_KEY" =~ ^sk-ant- ]]; then
    print_error "Invalid Anthropic API key format (should start with 'sk-ant-')"
    exit 1
fi

if [ -n "$BACKUP_KEY" ] && [[ ! "$BACKUP_KEY" =~ ^sk-ant- ]]; then
    print_error "Invalid backup API key format (should start with 'sk-ant-')"
    exit 1
fi

# Test primary key
print_status "Testing primary API key..."
if ANTHROPIC_API_KEY="$PRIMARY_KEY" bash tools/anthropic_client.sh --smoke > /dev/null 2>&1; then
    print_success "Primary API key works!"
else
    print_error "Primary API key test failed!"
    echo "❓ Double-check your API key is correct and has credits"
    exit 1
fi

# Test backup key if provided
if [ -n "$BACKUP_KEY" ]; then
    print_status "Testing backup API key..."
    if ANTHROPIC_API_KEY="$BACKUP_KEY" bash tools/anthropic_client.sh --smoke > /dev/null 2>&1; then
        print_success "Backup API key works!"
    else
        print_warning "Backup API key test failed, but continuing..."
    fi
fi

# Update .env file
print_status "Updating environment configuration..."

# Backup existing .env
cp .env .env.backup

# Update or add Anthropic keys
if grep -q "ANTHROPIC_API_KEY" .env; then
    sed -i.tmp "s/ANTHROPIC_API_KEY=.*/ANTHROPIC_API_KEY=$PRIMARY_KEY/" .env
else
    echo "ANTHROPIC_API_KEY=$PRIMARY_KEY" >> .env
fi

if [ -n "$BACKUP_KEY" ]; then
    if grep -q "ANTHROPIC_API_KEY_BACKUP" .env; then
        sed -i.tmp "s/ANTHROPIC_API_KEY_BACKUP=.*/ANTHROPIC_API_KEY_BACKUP=$BACKUP_KEY/" .env
    else
        echo "ANTHROPIC_API_KEY_BACKUP=$BACKUP_KEY" >> .env
    fi
fi

# Ensure real mode is enabled
sed -i.tmp 's/DRY_RUN=true/DRY_RUN=false/' .env
sed -i.tmp 's/FEATURE_LLM_QA=false/FEATURE_LLM_QA=true/' .env

# Remove temp files
rm -f .env.tmp

print_success "Environment configuration updated!"

# Set up multi-API fallback system
print_status "Setting up multi-API fallback system..."

cat > tools/anthropic_fallback.sh << 'EOF'
#!/usr/bin/env bash
# Multi-API Fallback System for Anthropic

call_with_fallback() {
    local payload="$1"
    local primary_key="${ANTHROPIC_API_KEY}"
    local backup_key="${ANTHROPIC_API_KEY_BACKUP:-}"

    # Try primary key first
    if [ -n "$primary_key" ]; then
        echo "[INFO] Trying primary API key..." >&2
        if ANTHROPIC_API_KEY="$primary_key" bash tools/anthropic_client.sh --chat <<< "$payload" 2>/dev/null; then
            return 0
        fi
        echo "[WARN] Primary API key failed, trying backup..." >&2
    fi

    # Try backup key if available
    if [ -n "$backup_key" ]; then
        echo "[INFO] Trying backup API key..." >&2
        if ANTHROPIC_API_KEY="$backup_key" bash tools/anthropic_client.sh --chat <<< "$payload" 2>/dev/null; then
            return 0
        fi
        echo "[ERROR] Both API keys failed!" >&2
    fi

    echo "[ERROR] No working API keys available!" >&2
    return 1
}

# Export the function if sourced
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    export -f call_with_fallback
fi
EOF

chmod +x tools/anthropic_fallback.sh

# Test the complete system
print_status "Testing complete system with real AI..."

# Load environment
source .env

# Test real AI generation
echo ""
print_status "Running real AI test..."
if npm run dev > /dev/null 2>&1; then
    print_success "Real AI system works perfectly!"
else
    print_warning "System test had issues, but API keys are configured"
fi

echo ""
print_success "🎉 Anthropic API Setup Complete!"
echo ""
echo "📋 Configuration Summary:"
echo "  ✅ Primary API key: Configured and tested"
if [ -n "$BACKUP_KEY" ]; then
    echo "  ✅ Backup API key: Configured"
else
    echo "  ⚠️  Backup API key: Not provided"
fi
echo "  ✅ Real AI mode: Enabled"
echo "  ✅ Fallback system: Ready"
echo ""
echo "🚀 Next Steps:"
echo "  1. Test real AI: npm run dev"
echo "  2. Generate Q&A: npm run /sync"
echo "  3. Check costs: Your Anthropic dashboard"
echo ""
echo "💰 Cost Information:"
echo "  • Claude 3.5 Sonnet: ~$0.003/1K input + $0.015/1K output"
echo "  • Typical Q&A generation: $0.01-0.05 per batch"
echo "  • Daily cap: \$2 (configurable in .env)"
echo ""
echo "🛡️ Safety Features:"
echo "  • Automatic cost caps"
echo "  • Request timeouts"
echo "  • Rate limiting"
echo "  • Multi-key fallback"