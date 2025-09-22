# Changelog

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