# LLM-Friendly System Summary
*Generated: 2025-09-19T15:47 | Bundle: aa5c594a11ae0e8d | Commit: 1204475c*

## 🎯 System Overview
**Meta-Adaptive Expert Orchestration System** - AI-powered QA generation using 8-Agent collaboration for production-ready TypeScript workflows.

## 📋 Core Architecture

### Taxonomy & Standards
- **Execution Pipeline**: STEP_1_TYPESCRIPT → STEP_2_LINT → STEP_3_SANITY → STEP_4_SMOKE_PAID → STEP_5_GATING → STEP_6_OBSERVABILITY → STEP_7_FULL_RUN
- **Severity Levels**: P0 (Critical), P1 (High), P2 (Medium)
- **Roadmap Phases**: P2, P3, P4, P5 (product planning only)
- **Success Criteria**: CASES_TOTAL > 0 and RESULT ∈ {PASS, PARTIAL}

### 8-Agent Council
**Core Engine (4)**:
- Meta-Controller: Process orchestration and strategy
- Prompt Architect: Expert advice integration and prompt design
- QA Generator: Bulk QA creation from optimized prompts
- Quality Auditor: Multi-level verification and improvement

**Expert Council (4)**:
- Psychology Specialist: User psychology and communication strategy
- Linguistics Engineer: LLM optimization and language structure
- Domain Consultant: Domain-specific expertise (CS/marketing/sales/etc)
- Cognitive Scientist: Expert thinking process modeling

## 🛠️ Current Implementation Status

### P2 - Baseline Secured & Quality Loop ✅ COMPLETE
- **Goal**: ±5% reproducible baselines with one-click measurement loop
- **Command**: `./run_v3.sh baseline --smoke | --full --budget ... --profile stage`
- **Reports**: `reports/baseline_report.{jsonl,md}` with session_report integration
- **Agents**: Evidence Extractor → Answer Generator → Audit Agent + Budget Guardian + Retry Router + Diversity Planner

### Key Systems Operational
- **Budget Guardian**: Cost tracking and kill switches
- **DLQ Manager**: Failed item retry with intelligent routing
- **Observability Exporter**: HTML reports and trace analysis
- **Seed Manager**: Reproducible randomization
- **Threshold Manager**: P0/P1/P2 gating with auto-calibration
- **Manifest Manager**: Data integrity and versioning

## 🔄 Workflow Commands

### Verification Pipeline
```bash
/verify-taxonomy     # Canonical compliance check
/verify-observability # Cross-system consistency
/verify-bundle       # Artifact integrity
```

### Execution Pipeline
```bash
# Smoke test (quick validation)
npm run dev -- --mode smoke --budget 2.00 --profile stage

# Full production run
node dist/scripts/preflight_pack.js --profile stage --budget-full 50.00

# Emergency procedures
/handoff → /export → /verify-bundle
```

### Development Tools
```bash
npm run build       # TypeScript compilation
npm run taxo:check  # Taxonomy validation
npm run test        # Test suite
```

## 📊 Quality Metrics (v1.5)
- **Duplication Rate**: < 15% threshold
- **Evidence Presence**: > 80% target
- **Hallucination Rate**: < 5% critical
- **PII Violations**: 0 tolerance (P0)
- **Coverage Score**: > 70% acceptable
- **Cost per Item**: Dynamic by profile (dev/stage/prod)

## 🏗️ Development Principles
- **Quality > Complexity**: 9.5/10 target QA quality
- **Adaptability > Efficiency**: Dynamic 5-8 agent selection
- **Transparency > Automation**: Full audit trails
- **Thought-Process Programming**: Expert reasoning patterns

## 📁 Key File Locations
```
src/
  shared/     # Types, logger, bus, registry
  core/       # BaseAgent, orchestrator, meta-controller
  agents/     # 8 specialized agent implementations
  scripts/    # CLI tools and automation

reports/
  session_report.md           # Latest run summary
  baseline_report.jsonl       # Detailed metrics
  handoff_bundle.json         # Complete artifact manifest
  observability/*/index.html  # Interactive analysis
```

## 🔒 Safety & Compliance
- **Feature Flags**: All new features guarded with env vars
- **Backward Compatibility**: Existing paths preserved
- **Mandatory Documentation**: RFC/CHANGELOG/MIGRATION for all changes
- **Smoke Payloads**: Auto-testing for regression detection
- **Release Gates**: FLAG validation before production promotion

## 🎯 Next Phases Preview
- **P3**: Production scaling and auto-deployment
- **P4**: Advanced expert summoning and domain expansion
- **P5**: Full autonomous operation with human oversight

---
*This summary reflects the current state as of commit 1204475c. For detailed implementation, see CLAUDE.md and docs/PRODUCT_PLAN.md*