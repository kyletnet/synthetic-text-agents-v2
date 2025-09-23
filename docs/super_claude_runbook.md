# Super Claude Runbook (Project-Official)

## TL;DR

- Use **Claude Code** for single-file edits, bugfixes, small tests.
- Use **Super Claude** for multi-file scaffolding (DocIngestor/Chunker/Retriever, Streamlit UI), broad refactors, or cross-cutting test rewrites.

## WHEN to switch

- You will create/modify ≥3 files or ≥2 folders.
- You need end-to-end scaffolding (e.g., Document Upload → RAG-lite → QA Generation → Audit → Guardian).
- You will introduce a UI (e.g., Streamlit) that changes build/test/dev flows.
- You will rewrite orchestrator tests across modules (fixed-length → dynamic routing + guardian gates).

## Pre-flight (must be green)

- `npm run build` ✅
- `npm run test` ✅ (qaGenerator/qualityAuditor/performanceGuardian)
- CLAUDE.md up to date ✅
- Create a working branch (e.g., `git checkout -b feat/super-claude-task`)
- Scope the session (30–60 min chunk) ✅

## Execution Sequence

1. **Plan (Prompt A)** — define scope, files, contracts (Generator tolerant JSON/plain, Auditor PASS/FAIL, Guardian thresholds), tests, acceptance criteria.
2. **Scaffold (Prompt B)** — generate new files/folders, keep build green, leave TODOs at integration points.
3. **Wire & Test (Prompt C)** — connect to pipeline, add tests, ensure `npm run test` is green.
4. **Demo & Report (Prompt D)** — `npm run build && npm run dev`, output last ~40 lines, short "What changed / What remains".

## Ready-to-paste Prompts

### Prompt A — Planning

You are Super Claude. Plan a minimal viable implementation for:

- Scope: RAG-lite for document → QA (DocIngestor/Chunker/Retriever + citations), optional Streamlit PoC shell.
- Contracts: QAGenerator flexible input; QualityAuditor PASS/FAIL; PerformanceGuardian minQuality=7, maxLatency=2000; logging via logger.ts.
- Deliverables: file list, dependency notes, module diagram, test plan (unit + light integration), acceptance criteria.
- Output plan only (no code yet).

### Prompt B — Scaffolding

Using the approved plan, create compilable scaffolding files/folders with TODOs, export clean interfaces, keep `npm run build` green.

### Prompt C — Wiring & Tests

Wire RAG-lite into pipeline (QAGenerator optionally consumes retrieved chunks). Keep Auditor/Guardian behavior. Add tests; `npm run test` must pass.

### Prompt D — Demo & Report

Run `npm run build` then `npm run dev`. Print last ~40 lines, show any guardian vetoes, and a bullet "What changed / What remains".
