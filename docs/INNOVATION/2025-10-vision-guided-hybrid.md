# Vision-Guided Chunking & Hybrid Retrieval - Technical Specification

**Version**: 1.0.0
**Author**: Kay Ko
**Date**: 2025-10-10
**Phase**: 3
**Category**: Innovation

---

## 🎯 Executive Summary

**Problem**: Current PDF chunking loses 27% of sections, 0% section alignment, and cannot detect tables.

**Solution**: Vision-Guided Chunking + Hybrid Search to preserve structure and improve retrieval accuracy.

**Expected Impact**:
- Section Alignment: 0% → **85%+**
- Missing Sections: 27% → **<5%**
- Table Detection: 0% → **95%+**
- Retrieval Precision: +25%
- Cost: -60% (Adaptive RAG)

---

## 📊 Baseline Analysis (Current State)

### Current Chunking Issues

From `reports/pdf-structure/baseline-report.json`:

```json
{
  "chunkingQuality": {
    "chunk_completeness": 104.14,
    "section_alignment": 0.0,      ← CRITICAL
    "overlap_ratio": 4.04
  },
  "structuralIssues": {
    "missing_sections": 2948,      ← 27% loss
    "sections_split": 212           ← 19% fragmentation
  },
  "typeDistribution": {
    "table": 0,                     ← No table detection
    "paragraph": 156,
    "list": 76
  }
}
```

### Root Causes

1. **pdf-parse**: Plain text extraction, no layout info
2. **Paragraph splitting**: Physical (\\n\\n), not semantic
3. **No vision**: Cannot see tables, diagrams, section headers
4. **Page estimation**: `chunkIndex / 3` heuristic, inaccurate

---

## 🏗️ Architecture Design

### System Overview

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│   PDF       │────▶│  Vision      │────▶│  Structured    │
│  Document   │     │  Extraction  │     │  Chunks        │
└─────────────┘     └──────────────┘     └────────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Layout      │
                    │  Analysis    │
                    │  - Sections  │
                    │  - Tables    │
                    │  - Figures   │
                    └──────────────┘
```

### Three-Phase Approach

#### Phase 1: PDF → Image Conversion
- Convert PDF pages to images (300 DPI)
- Preserve visual layout
- Tools: pdf-poppler, PyMuPDF

#### Phase 2: Vision-Based Layout Analysis
- Use Vision LLM to analyze layout
- Extract structured information
- Tools: Gemini-2.5 Pro, Qwen2-VL, LayoutLMv3

#### Phase 3: Structure-Preserving Chunking
- Respect section boundaries
- Keep tables intact
- Maintain hierarchical relationships

---

## 🔧 Technical Implementation

### 1. PDF → Image Conversion

**Requirements**:
- Resolution: 300 DPI (quality vs file size balance)
- Format: PNG (lossless) or JPEG (smaller)
- Metadata: Page number, dimensions

**Implementation**:

```typescript
interface PDFImageConfig {
  dpi: number;          // 300
  format: 'png' | 'jpeg';
  quality: number;      // 90 for JPEG
}

interface PDFImage {
  pageNumber: number;
  imagePath: string;
  width: number;
  height: number;
  dpi: number;
}

class PDFImageConverter {
  async convertPage(pdf: string, page: number): Promise<PDFImage>;
  async convertAll(pdf: string): Promise<PDFImage[]>;
}
```

**Tools**:
- **pdf-poppler**: Node bindings for Poppler utils
- **sharp**: Image processing (resize, format conversion)

**Cost**: ~5MB per page @ 300 DPI → 1.6GB for 320-page PDF

---

### 2. Vision-Based Layout Analysis

**Vision LLM Options**:

| Model | Pros | Cons | Cost |
|-------|------|------|------|
| **Gemini-2.5 Pro** | Best accuracy, table understanding | Paid API | $0.0025/image |
| **Qwen2-VL-7B** | Fast, local inference | Needs GPU | Free |
| **LayoutLMv3** | Document-specific | Limited vision | Free |

**Recommended**: Gemini-2.5 Pro for production, Qwen2-VL for development

**Vision Prompt Template**:

```
Analyze this document page and extract:

1. **Sections**: Identify section headers (제1장, 1., etc.)
   - Title
   - Level (1, 2, 3...)
   - Bounding box [x, y, w, h]

2. **Tables**: Detect all tables
   - Caption
   - Rows/columns
   - Bounding box
   - Cell contents

3. **Lists**: Bullet/numbered lists
   - Items
   - Nesting level

4. **Paragraphs**: Body text
   - Content
   - Associated section

5. **Figures**: Images, diagrams
   - Caption
   - Description

Output as JSON:
{
  "sections": [...],
  "tables": [...],
  "lists": [...],
  "paragraphs": [...],
  "figures": [...]
}
```

**Output Schema**:

```typescript
interface VisionAnalysisResult {
  pageNumber: number;
  sections: Array<{
    title: string;
    level: number;  // 1, 2, 3...
    bbox: [number, number, number, number];  // x, y, w, h
    text: string;
  }>;
  tables: Array<{
    caption?: string;
    rows: number;
    cols: number;
    bbox: [number, number, number, number];
    cells: string[][];  // 2D array
  }>;
  lists: Array<{
    items: string[];
    type: 'bullet' | 'numbered';
    level: number;
  }>;
  paragraphs: Array<{
    text: string;
    sectionId?: string;  // Link to parent section
    bbox: [number, number, number, number];
  }>;
  figures: Array<{
    caption?: string;
    description: string;
    bbox: [number, number, number, number];
  }>;
}
```

---

### 3. Structure-Preserving Chunking

**Chunking Strategy**:

```typescript
interface ChunkingStrategy {
  // 1. Respect section boundaries
  respectSections: boolean;  // true

  // 2. Keep tables intact
  keepTablesIntact: boolean;  // true

  // 3. Merge small sections
  minSectionSize: number;  // 200 chars

  // 4. Split large sections
  maxChunkSize: number;  // 2000 chars

  // 5. Context window
  contextBefore: number;  // 100 chars (section title)
  contextAfter: number;   // 50 chars (next section preview)
}

interface StructuredChunk {
  id: string;
  type: 'section' | 'table' | 'list' | 'paragraph';
  content: string;

  // Hierarchical context
  sectionPath: string[];  // ["제1장", "1.1", "가"]

  // Visual metadata
  pageNumber: number;
  bbox: [number, number, number, number];

  // Links
  previousChunk?: string;
  nextChunk?: string;
  parentSection?: string;

  // Metadata
  metadata: {
    tableRows?: number;
    tableCols?: number;
    listItems?: number;
    hasEquations?: boolean;
    hasFigures?: boolean;
  };
}
```

**Chunking Algorithm**:

```
FOR each page in PDF:
  1. Convert page to image (300 DPI)
  2. Analyze with Vision LLM → VisionAnalysisResult
  3. Build document tree:
     - Section hierarchy
     - Table relationships
     - Paragraph grouping
  4. Create chunks:
     a. Section = 1 chunk (if size < maxChunkSize)
     b. Table = 1 chunk (always intact)
     c. Large section → split by paragraphs
  5. Add context:
     - Prepend: Parent section titles
     - Append: Next section preview
```

**Expected Output**:

```json
{
  "chunk": {
    "id": "doc-ch1-sec1-1",
    "type": "section",
    "content": "제1장 사업 개요\n\n1. 목적\n아이돌봄 지원사업은...",
    "sectionPath": ["제1장", "1."],
    "pageNumber": 1,
    "bbox": [50, 100, 500, 800],
    "metadata": {
      "hasEquations": false,
      "hasFigures": false
    }
  }
}
```

---

## 🔍 Hybrid Retrieval Architecture

### Retrieval Stack

```
┌────────────────────────────────────────────┐
│           User Query                       │
└────────────┬───────────────────────────────┘
             │
     ┌───────┴────────┐
     │                │
     ▼                ▼
┌─────────┐      ┌──────────────┐
│  BM25   │      │  Embedding   │
│ (Lexical)│      │  (Semantic)  │
└────┬────┘      └──────┬───────┘
     │                  │
     │  ┌───────────────┤
     │  │               │
     ▼  ▼               ▼
   ┌────────────────────────┐
   │  Reciprocal Rank       │
   │  Fusion (RRF)          │
   └───────────┬────────────┘
               │
               ▼
         ┌──────────┐
         │  Top-K   │
         │  Results │
         └──────────┘
```

### 1. BM25 (Lexical Search)

**Purpose**: Find exact keyword matches

**Implementation**:
- ElasticSearch with Korean analyzer
- TF-IDF + document length normalization
- Parameters: k1=1.5, b=0.75

**Example**:
```
Query: "아이돌봄 이용요금"
BM25 scores documents containing exact keywords
```

### 2. Embedding (Semantic Search)

**Purpose**: Find semantically similar content

**Models**:
| Model | Dim | Language | F1 |
|-------|-----|----------|-----|
| **multilingual-e5-large** | 1024 | Multi | 0.85 |
| **ko-sbert-multitask** | 768 | KR | 0.82 |

**Dual-Vector Strategy**:
```typescript
interface DualVector {
  korean: number[];      // Korean text embedding
  english: number[];     // Translated English embedding
}

// Improves recall for Korean queries
```

### 3. Reciprocal Rank Fusion (RRF)

**Formula**:

```
RRF(d) = Σ (1 / (k + rank_i(d)))
```

Where:
- `d` = document
- `k` = 60 (constant)
- `rank_i(d)` = rank of `d` in result list `i`

**Example**:

```
BM25 results:      [doc1, doc3, doc5, doc2]
Embedding results: [doc3, doc1, doc4, doc2]

RRF scores:
doc1: 1/(60+1) + 1/(60+2) = 0.0325
doc3: 1/(60+2) + 1/(60+1) = 0.0325
doc2: 1/(60+4) + 1/(60+4) = 0.0313
...

Final ranking: [doc1, doc3, doc2, doc5, doc4]
```

---

## ⚙️ Adaptive RAG

**Problem**: Fixed k=5 wastes tokens on irrelevant chunks

**Solution**: Start with k=2, expand only if needed

### Algorithm

```typescript
async function adaptiveRAG(query: string, maxK: number = 6): Promise<string> {
  let k = 2;  // Start small

  while (k <= maxK) {
    // Retrieve top-k chunks
    const chunks = await hybridSearch(query, k);

    // Generate answer
    const answer = await llm.generate({
      system: "Answer based on context only. Say '정보 부족' if unsure.",
      user: `Context: ${chunks.join('\n\n')}\n\nQuestion: ${query}`,
    });

    // Check if answer is complete
    if (!answer.includes('정보 부족') && answer.length > 50) {
      return answer;
    }

    // Expand context
    k += 2;
  }

  return "충분한 정보를 찾을 수 없습니다.";
}
```

**Benefits**:
- Simple queries: k=2 (2x faster, 60% cost savings)
- Complex queries: k=6 (full context)
- Average: k=3.5 (45% cost savings)

---

## 📈 Expected Improvements

### Chunking Quality

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Section Alignment** | 0% | **85%** | +85pp |
| **Missing Sections** | 27% | **<5%** | -22pp |
| **Table Detection** | 0% | **95%** | +95pp |
| **Sections Split** | 19% | **<5%** | -14pp |

### Retrieval Performance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Precision@10** | 72% | **91%** | +19pp |
| **Recall@10** | 68% | **88%** | +20pp |
| **Groundedness** | 78% | **92%** | +14pp |

### Cost & Performance

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Avg Tokens/Query** | 3500 | **1400** | -60% |
| **Latency (p95)** | 8.6s | **6.2s** | -28% |
| **Cost/Query** | $0.15 | **$0.06** | -60% |

---

## 🛠️ Implementation Plan

### Phase 1: Foundation (Week 1)

**Tasks**:
1. ✅ PDF Structure Reporter
2. ⏳ PDF → Image Converter
3. ⏳ Vision LLM Integration (Gemini API)

**Deliverable**: Image extraction + Vision analysis working

### Phase 2: Chunking (Week 2)

**Tasks**:
1. ⏳ Structure-Preserving Chunker
2. ⏳ Section Hierarchy Builder
3. ⏳ Table Extraction

**Deliverable**: Structured chunks with 85% section alignment

### Phase 3: Hybrid Search (Week 3)

**Tasks**:
1. ⏳ BM25 Index (ElasticSearch)
2. ⏳ Embedding Index (FAISS/Pinecone)
3. ⏳ RRF Fusion Engine

**Deliverable**: Hybrid search with 90% precision

### Phase 4: Adaptive RAG (Week 4)

**Tasks**:
1. ⏳ Adaptive k-selection
2. ⏳ Answer completeness detection
3. ⏳ Cost tracking

**Deliverable**: 60% cost savings vs fixed k=5

### Phase 5: Integration & Testing (Week 5)

**Tasks**:
1. ⏳ End-to-end pipeline
2. ⏳ Benchmark suite
3. ⏳ Documentation

**Deliverable**: Production-ready system

---

## 🧪 Testing Strategy

### Unit Tests

- PDF → Image conversion (quality, metadata)
- Vision analysis (section detection, table extraction)
- Chunking logic (alignment, size, hierarchy)
- RRF fusion (ranking correctness)

### Integration Tests

- Full pipeline: PDF → Chunks → Search → Answer
- Multi-document consistency
- Error handling (corrupted PDF, API failures)

### Benchmark Suite

```typescript
interface BenchmarkCase {
  name: string;
  pdf: string;
  queries: Array<{
    query: string;
    expected_chunks: string[];  // Ground truth
    expected_answer: string;
  }>;
}

// Example
{
  name: "아이돌봄 지원사업",
  pdf: "2024년_아이돌봄지원사업_안내.pdf",
  queries: [
    {
      query: "시간제 기본형 이용요금은?",
      expected_chunks: ["chunk-ch2-sec3"],
      expected_answer: "11,630원"
    }
  ]
}
```

**Metrics**:
- Chunk Hit Rate: % of expected chunks retrieved
- Answer Accuracy: Exact match or semantic similarity
- Latency: p50, p95, p99
- Cost: Tokens used, API calls

---

## 🔐 Compliance & Gates

### Gate Integration

| Gate | Metric | Target | Status |
|------|--------|--------|--------|
| **A (Evidence)** | Hit Rate | ≥85% | ⏳ |
| **B (Retrieval)** | Precision@10 | ≥90% | ⏳ |
| **C (Consistency)** | Section Align | ≥85% | ⏳ |
| **D (Diversity)** | Type Coverage | ≥80% | ⏳ |
| **F (Performance)** | Latency p95 | ≤8s | ⏳ |
| **G (Quality)** | Compliance | ≥90% | ✅ |

### Audit Automation

```typescript
// Pre-deploy hook
async function predeployAudit() {
  // 1. Run structure analysis
  const structureReport = await runStructureReport();

  // 2. Run benchmark suite
  const benchmarkResults = await runBenchmarks();

  // 3. Check gates
  const gateResults = await checkAllGates();

  // 4. Freeze if any gate fails
  if (gateResults.failed.length > 0) {
    throw new Error(`Gates failed: ${gateResults.failed.join(', ')}`);
  }

  // 5. Log results
  await logAuditReport({
    structure: structureReport,
    benchmark: benchmarkResults,
    gates: gateResults,
  });
}
```

---

## 📚 References

- **RFC/2025-07-rag-hybrid-architecture**: Original RAG design
- **Phase 3 Option C**: Execution plan
- **reports/pdf-structure/baseline-report.json**: Current baseline
- **Gemini API**: https://ai.google.dev/gemini-api/docs/vision
- **Qwen2-VL**: https://github.com/QwenLM/Qwen2-VL
- **RRF Paper**: "Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods"

---

**Status**: ⏳ In Progress
**Next**: Implement PDF → Image Converter
