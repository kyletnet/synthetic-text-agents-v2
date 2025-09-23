# System Map

_Auto-generated: 2025-09-23T03:04:47.578Z_

## Input Routing

| Component | Status | Details |
|-----------|--------|---------|
| seed_doc_path | **missing** | No explicit doc ingestion routing found |
| gold_pairs_path | **missing** | No explicit gold pair routing found |
| mixed inputs | **missing** | Mixed = both routes present |
| default path | **ok** | Backward-compatible fallback retained |

## RAG/Chunking

| Component | Status | Details |
|-----------|--------|---------|
| chunking | **ok** | src/rag/chunk.ts |
| retriever | **ok** | src/rag/retriever.ts |

## Augmentation

| Component | Status | Details |
|-----------|--------|---------|
| paraphrase | **partial** | src/augmentation/ |

## Telemetry
- RUN_LOGS: apps/fe-web/docs/RUN_LOGS/
- DECISIONS: apps/fe-web/docs/DECISIONS/
- Cleanup: LOG_RETENTION_DAYS in .env.local
