#!/usr/bin/env bash
set -Eeuo pipefail

# Synthetic Text Agents v2 - Replit Startup Script
echo "🚀 Starting Synthetic Text Agents v2..."

# Check if we're in the root directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project root."
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install || {
        echo "❌ npm install failed"
        exit 1
    }
fi

# Build TypeScript if needed
if [ ! -d "dist" ] || [ "src" -nt "dist" ]; then
    echo "🔨 Building TypeScript..."
    npm run build || {
        echo "❌ Build failed"
        exit 1
    }
fi

# Start the CLI demo
echo "🎯 Starting CLI demo..."
npm run dev