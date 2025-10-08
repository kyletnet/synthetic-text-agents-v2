# Changelog

## 2025-10-08 - Integrated Roadmap & Multi-Tenant Architecture

- **docs**: Add integrated development roadmap (Phase 1.6 → 2.1)
  - Evolutionary expansion strategy (NOT rewrite)
  - Top-3 Priority + Full Backlog approach
  - Phase 1.6: Organic Loop Completion (2 weeks)
  - Phase 2.0: Multi-Tenant Foundation (3 weeks)
  - Phase 2.1: Hybrid Intelligence (4-6 weeks)
- **docs**: Add multi-tenant governance architecture specification
  - Control Plane / Data Plane separation
  - Tenant Registry + Namespaced Policy DSL
  - Tenant-scoped Retrieval Fabric design
  - RBAC/ABAC + Data Sovereignty
  - Zero data leakage guarantees
- **docs**: Update SESSION_STATE.md with integrated roadmap
  - Current state: Phase 1.5 complete, roadmap documented
  - Next focus: Phase 1.6 (Feedback Loop + Test Chain + Gate P/I)
  - Future phases overview (2.0, 2.1)
  - Key metrics targets per phase
- **docs**: Update NEXT_ACTIONS.md with Phase 1.6-2.1 priorities
  - Top-3 critical path items for Phase 1.6
  - Full implementation checklists per phase
  - Success criteria and Definition of Done
  - Key principles and resources

## 2025-09-16 - Unified Launcher System

- **feat**: Add unified launcher (run.sh) for standardized script execution
- **feat**: Centralized environment loading (tools/load_env.sh) with API key masking
- **feat**: Automated preflight checks (tools/preflight.sh) for environment validation
- **feat**: Smoke testing framework (tools/smoke_anthropic.sh) for API connectivity
- **feat**: Script registry system (scripts/entrypoints.jsonl) for execution standardization
- **feat**: Health check system (tools/health_check.sh) for environment coverage validation
- **feat**: npm run guard:env command for CI/local environment checking
- **chore**: Update documentation with migration guide and usage examples
- **fix**: Fixed step4_2.sh missing environment variable loading (API 401 errors resolved)

## 2025-09-02 - Development Safety Rules

- (2025-09-02) chore(docs): add Development Safety Rules; add RFC/Migration templates
