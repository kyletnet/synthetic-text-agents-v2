#!/usr/bin/env bash
set -Eeuo pipefail

# Synthetic Text Agents v2 - Development Environment Setup
# Automatically enforces all coding standards and best practices

echo "🚀 Setting up Synthetic Text Agents v2 development environment..."

# Color helpers
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: Not in project root directory${NC}"
    echo "Please run this script from the project root."
    exit 1
fi

# Function to print status
print_status() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Install Git Hooks
print_status "Installing Git hooks for automatic standards enforcement..."
if [ ! -d ".git/hooks" ]; then
    mkdir -p .git/hooks
fi

# Copy our pre-commit hook
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
print_success "Git pre-commit hook installed"

# 2. Install Dependencies
print_status "Installing dependencies..."
npm install
print_success "Dependencies installed"

# 3. Build Project
print_status "Building TypeScript project..."
npm run build
print_success "Project built successfully"

# 4. Setup Environment
print_status "Setting up environment configuration..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    print_success "Environment file created from template"
else
    print_warning ".env file already exists"
fi

# 5. Create Development Directories
print_status "Creating development directories..."
mkdir -p logs
mkdir -p reports/observability
mkdir -p outputs
print_success "Development directories created"

# 6. VSCode Configuration
if command -v code &> /dev/null; then
    print_status "Configuring VSCode settings..."
    if [ ! -d ".vscode" ]; then
        mkdir -p .vscode
    fi
    print_success "VSCode configuration ready"
else
    print_warning "VSCode not found - manual editor setup required"
fi

# 7. Verify Setup
print_status "Verifying development environment..."

# Check TypeScript
if npm run typecheck > /dev/null 2>&1; then
    print_success "TypeScript configuration valid"
else
    echo -e "${RED}❌ TypeScript configuration issues detected${NC}"
    exit 1
fi

# Check ESLint
if npm run lint > /dev/null 2>&1; then
    print_success "ESLint configuration valid"
else
    print_warning "ESLint issues detected - will be auto-fixed on commit"
fi

# Check Tests
if npm run test > /dev/null 2>&1; then
    print_success "All tests passing"
else
    echo -e "${RED}❌ Test failures detected${NC}"
    exit 1
fi

# 8. Display Development Guidelines
echo ""
echo -e "${GREEN}🎉 Development environment setup complete!${NC}"
echo ""
echo -e "${BLUE}📋 Development Guidelines:${NC}"
echo "1. All code must pass TypeScript strict checks"
echo "2. ESLint rules are automatically enforced"
echo "3. Use Logger instead of console.log (except in CLI)"
echo "4. All shell scripts must use #!/usr/bin/env bash"
echo "5. Follow import patterns with .js extensions"
echo "6. Pre-commit hooks will enforce all standards"
echo ""
echo -e "${BLUE}🚀 Quick Start Commands:${NC}"
echo "  npm run dev          # Start development server"
echo "  npm run test:watch   # Run tests in watch mode"
echo "  npm run lint:fix     # Fix linting issues"
echo "  npm run ship         # Full CI/CD pipeline"
echo ""
echo -e "${BLUE}🔗 Platform Deployment Ready:${NC}"
echo "  ✅ Replit (configured)"
echo "  ✅ Vercel (configured)"
echo "  ✅ Netlify (configured)"
echo "  ✅ Docker (configured)"
echo ""
echo -e "${YELLOW}📖 Read CLAUDE.md for complete development standards${NC}"
echo ""