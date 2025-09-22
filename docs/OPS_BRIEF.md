# Operations Brief

**Last synced commit:** 3ed212028b76f13783a90ada1e1ac2fb27f59943
**Last reviewed date:** 2025-09-20
**Owner:** Kyle

Single-source operations brief for Meta-Adaptive Expert Orchestration System.

## 1. Terminology Canonical Map

All code generators, validators, and reports MUST use these exact canonical terms. No custom severity levels or stage names are permitted.

### Severities (P0/P1/P2)
- **P0 - Critical**: System broken, blocking all progress
  - Action: Immediate fix required before any proceeding
  - Examples: Build completely fails, core API unavailable, data corruption
- **P1 - High**: Significant impact, major feature broken
  - Action: Fix required within current milestone
  - Examples: Key feature non-functional, performance severely degraded, security vulnerability
- **P2 - Medium**: Moderate impact, minor feature issues
  - Action: Fix recommended but not blocking
  - Examples: Edge case failures, minor performance issues, non-critical feature gaps

### Stages (STEP_1~7)
1. **STEP_1_TYPESCRIPT** - TypeScript validation and type checking
2. **STEP_2_LINT** - Code linting and style validation
3. **STEP_3_SANITY** - Basic sanity checks and configuration validation
4. **STEP_4_SMOKE_PAID** - Paid smoke tests against live APIs
5. **STEP_5_GATING** - P0/P1/P2 policy evaluation and gating decisions
6. **STEP_6_OBSERVABILITY** - Observability export and consistency validation
7. **STEP_7_FULL_RUN** - Full production run with complete dataset

**Enforcement:** Import from `scripts/metrics/taxonomy.ts`. Run `npm run taxo:check` to verify compliance.

## 2. Run Modes & Commands

Quick reference for standard execution patterns:

### Smoke Test (Stage, $0.50 budget)
```bash
bash run_v3.sh baseline --smoke --profile stage --budget 0.50
```

### Baseline Mini Run (Stage, sample data)
```bash
bash run_v3.sh baseline --smoke --profile stage --budget 0.50 --data data/inputs/sample.jsonl
```

### Full Production Run (Prod, $50.00 budget)
```bash
bash run_v3.sh baseline --full --profile prod --budget 50.00
```

### Preflight & Verification
```bash
npm run preflight
npm run verify:obs
npm run verify:handoff
npm run verify:export
```

## 3. Required Artifacts Matrix

### Handoff Bundle (Internal Transfer)
**Must include:**
- `reports/session_report.md` - Session summary and metrics
- `reports/baseline_report.jsonl` - Core baseline metrics data
- `reports/observability/*/index.html` - Observability dashboards + trace JSON
- `RUN_LOGS/*` - Complete execution logs
- `reports/dlq/*` - Dead letter queue files (if any)
- `reports/manifests/manifest_*.json` - Data manifests + `reports/manifest_current.json`
- `docs/PRODUCT_PLAN.md` - Product roadmap and planning
- `baseline_config.json` - Baseline configuration
- `.env*.redacted` - Environment templates (secrets removed)
- `tsconfig*.json` - TypeScript configurations
- `data_manifest.json` - Dataset manifest
- `docs/OPS_BRIEF.md` - This operations brief

### Export Bundle (Full Code + Artifacts)
**Includes handoff bundle PLUS:**
- `src/` - Complete source code
- `scripts/` - Automation and utility scripts
- `validators/` - Validation schemas and tools
- `schemas/` - Data schemas
- `dashboards/` - (if present) Monitoring dashboards

## 4. Paths Index

Key directories and their purposes:

- **`src/`** - Core TypeScript source code
  - `src/shared/` - Common types, logger, bus, registry
  - `src/core/` - BaseAgent, orchestrator, meta-controller
  - `src/agents/` - Specialized agent implementations
  - `src/cli/` - Command-line interface
- **`scripts/`** - Automation and tooling
  - `scripts/metrics/` - Baseline metrics and reporting
  - `scripts/ci/` - Continuous integration tools
  - `scripts/dx/` - Developer experience tools
- **`docs/`** - Documentation and specifications
- **`reports/`** - Generated reports and observability
  - `reports/observability/` - Runtime observability exports
  - `reports/manifests/` - Data and run manifests
- **`RUN_LOGS/`** - Execution logs and traces
- **`outputs/`** - Generated artifacts and data
- **`validators/`** - JSON schemas and validation tools
- **`tests/`** - Test suites and regression tests
- **`tools/`** - Development and maintenance utilities
- **`config/`** - Configuration files and templates
- **`runtime_guards/`** - Budget and rate limiting

## 5. Preflight Gates

All gates must be GREEN before proceeding:

### TypeScript Validation (STEP_1)
```bash
npm run typecheck
```
**Gate criteria:** Zero TypeScript compilation errors

### Linting (STEP_2)
```bash
npm run lint
```
**Gate criteria:** Zero linting errors, warnings acceptable

### Sanity Checks (STEP_3)
```bash
npm run sanity
```
**Gate criteria:** All sanity checks pass

### Manifest Presence
**Gate criteria:** `reports/manifest_current.json` exists and valid

### Smoke Resolution (STEP_4)
**Gate criteria:** Smoke tests pass within budget constraints

### Gating Policy (STEP_5)
**Gate criteria:** RESULT ∈ {PASS, PARTIAL}, no P0 violations

### Observability (STEP_6)
**Gate criteria:**
- `run_id` present and valid
- `cost` tracking functional
- `duration` metrics recorded
- Consistency validation passes

## 6. Update Rules

### When to Update This Brief
- Changes to `scripts/metrics/taxonomy.ts` (canonical definitions)
- Changes to `baseline_config.json` (run configuration)
- Changes to `run_v3.sh` (execution scripts)
- Changes to `scripts/preflight_pack.ts` (preflight pipeline)
- Changes to `docs/PRODUCT_PLAN.md` (roadmap updates)

### Ownership & Process
- **Owner:** Kyle
- **Update trigger:** Any of the above files change
- **Process:** Update "Last synced commit" to current `git rev-parse HEAD`
- **Review:** Update "Last reviewed date" monthly or on major changes
- **Verification:** Ensure `npm run verify:ops` passes after updates

### Version Control
This file is tracked in git and included in both handoff and export bundles. Changes should be committed with clear descriptions of what operational aspects changed.

---

*This operations brief serves as the single source of truth for operational procedures, terminology, and artifact requirements.*