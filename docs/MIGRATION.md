# Migration Guide - Unified Launcher System

## Overview
The system has been migrated to use a unified launcher (`./run.sh`) that standardizes all script execution with consistent safety procedures.

## Key Changes

### New Unified Launcher
All major scripts should now be executed through the unified launcher:

    # Old way (still works but deprecated)
    ./step4_2.sh
    bash handoff_one.sh
    npm run build

    # New standardized way
    ./run.sh step4_2
    ./run.sh handoff
    ./run.sh build

### Automatic Safety Procedures
Every execution now follows the same safety pipeline:
1. **Environment Loading** - Automatic .env file loading with API key validation
2. **Preflight Checks** - Environment validation before execution
3. **Smoke Testing** - Optional API connectivity validation
4. **Execution** - The actual script/command with standardized logging

## Migration Steps

### For End Users
1. **Replace direct script calls with unified launcher:**

        # Before
        MODE=SMOKE ./step4_2.sh

        # After
        ./run.sh step4_2 --smoke

2. **Use new execution modes:**

        ./run.sh step4_2 --smoke    # Quick smoke test
        ./run.sh step4_2 --full     # Full execution
        ./run.sh build              # Standard build

## Build-excluded Paths

The following directories are excluded from TypeScript build validation via `tsconfig.build.json`:

### Excluded from Build
- `experimental/` - Experimental and prototype code
- `legacy/` - Legacy code not part of current build
- `tools/` - Development and utility tools
- `apps/` - Standalone applications
- `cli/` - Legacy CLI implementations
- `config/` - Configuration files and templates
- `dev/` - Development-only scripts and data
- `test/`, `tests/` - Test files and test utilities
- `**/*.test.ts` - Individual test files

### Runtime/Data Directories (Excluded)
- `exports/`, `handoff/`, `logs/`, `outputs/`, `reports/` - Generated data
- `RUN_LOGS/`, `REVIEW_LOGS/` - Runtime logs
- `ops/`, `prompts/`, `runtime_guards/` - Operational data
- `schemas/`, `validators/` - Schema definitions
- `tmp/` - Temporary files

### Build Scope
Only these paths are included in build validation:
- `src/**/*.ts` - Core application source
- `scripts/**/*.ts` - Production scripts

## Environment Flags (Legacy)
- FEATURE_<FEATURE_NAME>=false (default)

## Runbook (Legacy)
- Toggle on staging, verify smoke payloads, check RUN_LOGS/DECISIONS.