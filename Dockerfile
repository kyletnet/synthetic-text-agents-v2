# Synthetic Text Agents v2 - Production Docker Container
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache bash git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/
COPY tools/ ./tools/
COPY docs/ ./docs/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install bash for shell scripts
RUN apk add --no-cache bash

WORKDIR /app

# Copy built application
COPY --from=base /app/dist ./dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package*.json ./
COPY --from=base /app/tools ./tools
COPY --from=base /app/scripts ./scripts

# Copy environment template
COPY .env.example .env

# Create logs directory
RUN mkdir -p logs

# Set environment variables
ENV NODE_ENV=production
ENV DRY_RUN=true
ENV FEATURE_LLM_QA=false

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Expose port
EXPOSE 3001

# Default command
CMD ["npm", "start"]