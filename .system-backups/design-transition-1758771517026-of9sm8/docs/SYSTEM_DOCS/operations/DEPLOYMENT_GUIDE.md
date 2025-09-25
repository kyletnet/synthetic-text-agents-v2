# Deployment & Operations Guide

## Platform Deployments

### Replit Deployment
```bash
# Files: .replit, main.sh
npm install && npm run build && npm run dev
```
- Uses modules-based approach (no nix)
- Environment variables via .env
- Auto-restart on file changes

### Vercel Deployment
```bash
# File: vercel.json
vercel deploy
```
- Serverless functions support
- API routes: /api/health, /api/generate
- Environment variables in dashboard

### Netlify Deployment
```bash
# File: netlify.toml
netlify deploy
```
- Function deployment
- Headers and redirects configured
- Preview environment support

### Docker Deployment
```bash
# Files: Dockerfile, docker-compose.yml
docker-compose up
```
- Multi-stage builds
- Health checks included
- Production-ready configuration

## Environment Configuration

### Required Environment Variables
```bash
# Feature Flags
FEATURE_LLM_QA=false      # Enable/disable LLM integration
DRY_RUN=true              # Run without API calls

# LLM Configuration
OPENAI_API_KEY=           # OpenAI API key (optional)
LLM_MODEL=gpt-4o-mini     # Default model
LLM_TIMEOUT_MS=20000      # Request timeout
LLM_MAX_RETRIES=1         # Retry attempts
LLM_COST_CAP_USD=2        # Cost limit per session
```

## Monitoring & Observability

### Log Locations
- **Application Logs**: `logs/*.jsonl`
- **Performance Metrics**: Embedded in logs
- **Error Traces**: Structured error context

### Health Checks
```bash
# Basic health check
npm run smoke

# Full system validation
npm run ci:strict

# Performance monitoring
npm run guard:all
```

## Scaling Considerations

### Agent Performance
- Each agent runs asynchronously
- Shared memory prevents duplicate work
- Timeout handling prevents hanging

### Resource Management
- Memory usage monitored per agent
- Cost tracking prevents overspend
- Token usage logged for optimization

## Troubleshooting

### Common Issues
1. **Build Failures**: Run `npm run typecheck`
2. **Agent Timeouts**: Check network connectivity
3. **Quality Issues**: Review agent configuration
4. **Cost Overruns**: Adjust LLM_COST_CAP_USD

### Debug Commands
```bash
npm run dev          # Development mode
npm run test         # Run test suite
npm run lint:fix     # Fix code issues
npm run guard:env    # Check environment
```
