# 🔍 Synthetic Text Agents v2 - Complete System Discovery

> **Quick Start for New Developers**: Run `bash scripts/setup-dev-environment.sh` for instant setup

## 📋 Essential Documentation for System Understanding

### 🏗️ Architecture & Design
- **[System Overview](architecture/SYSTEM_OVERVIEW.md)** - High-level architecture, data flow, patterns
- **[Module Reference](modules/README.md)** - All modules, dependencies, communication flow
- **[Technical Architecture Guide](../technical_architecture_guide.md)** - Detailed technical specifications

### 🚀 Operations & Deployment
- **[Deployment Guide](operations/DEPLOYMENT_GUIDE.md)** - All platforms (Replit, Vercel, Netlify, Docker)
- **[Operations Brief](../OPS_BRIEF.md)** - Production operations and monitoring
- **[Final Handoff Checklist](../FINAL_HANDOFF_CHECKLIST.md)** - Deployment readiness

### 👨‍💻 Development
- **[Developer Reference](development/DEVELOPER_REFERENCE.md)** - Complete development guide
- **[Development Onboarding](../../DEVELOPMENT_ONBOARDING.md)** - Automated setup and standards
- **[TypeScript Guidelines](../TYPESCRIPT_GUIDELINES.md)** - Code quality standards

### 📚 Project Context
- **[CLAUDE.md](../../CLAUDE.md)** - Main project specification and standards
- **[System Blueprint](../system_blueprint.md)** - Project vision and goals
- **[Product Plan](../PRODUCT_PLAN.md)** - Roadmap and feature planning

## 🔧 System Understanding Commands

### Complete Documentation Sync
```bash
# Generate/update all system documentation
npm run docs:sync

# Quick system status
npm run docs:status

# Full system map
npm run system:map
```

### Development Environment
```bash
# One-command setup for new developers
bash scripts/setup-dev-environment.sh

# Verify everything is working
npm run ci:strict

# Start development
npm run dev
```

### System Validation
```bash
# Complete system health check
npm run guard:all

# Check documentation freshness
npm run docs:status

# Validate all configurations
npm run verify:all
```

## 🧩 Module Quick Reference

| Module | Purpose | Key Files |
|--------|---------|-----------|
| **Core** | System orchestration | `orchestrator.ts`, `baseAgent.ts`, `metaController.ts` |
| **Agents** | AI agent implementations | `qaGenerator.ts`, `qualityAuditor.ts`, `*Specialist.ts` |
| **Shared** | Infrastructure & utilities | `types.ts`, `logger.ts`, `registry.ts`, `errors.ts` |
| **Clients** | External integrations | `anthropicAdapter.ts`, `llmAdapter.ts` |
| **Scripts** | Build & deployment | `setup-dev-environment.sh`, `generate-system-docs.sh` |

## 🌐 Platform Deployment Status

| Platform | Status | Config File | Command |
|----------|--------|-------------|---------|
| **Replit** | ✅ Ready | `.replit`, `main.sh` | Auto-deploy on push |
| **Vercel** | ✅ Ready | `vercel.json` | `vercel deploy` |
| **Netlify** | ✅ Ready | `netlify.toml` | `netlify deploy` |
| **Docker** | ✅ Ready | `Dockerfile`, `docker-compose.yml` | `docker-compose up` |

## 🔄 Documentation Sync Process

The system automatically maintains documentation consistency:

1. **Code Changes** → Triggers documentation updates
2. **`npm run ship`** → Full CI/CD with doc sync
3. **GitHub Actions** → Auto-updates on push
4. **`npm run docs:sync`** → Manual sync all documentation

## 🆘 Need Help?

1. **Quick Issues**: Run `npm run guard:all` for system diagnostics
2. **Development Setup**: Use `bash scripts/setup-dev-environment.sh`
3. **Documentation**: All docs auto-update with `npm run docs:sync`
4. **System Understanding**: Start with this README, then architecture docs

---

**💡 Pro Tip**: Bookmark this README - it's your central hub for understanding and working with the entire system!


_Last updated: 2025. 9. 25._