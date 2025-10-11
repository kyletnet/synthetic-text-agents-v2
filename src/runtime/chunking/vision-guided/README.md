# Vision-Guided Chunker (Phase 3 Week 3)

**Status:** 🚧 Foundation Created (Week 2) → Week 3 Implementation Pending

---

## Purpose

Traditional text chunkers **destroy document structure**:
- ❌ Split tables across chunks (headers separated from data)
- ❌ Break sections mid-content (context loss)
- ❌ Ignore visual hierarchy (all text treated equally)

**Vision-Guided Chunking preserves structure:**
- ✅ Keep tables intact (never split)
- ✅ Respect section boundaries (align chunks to sections)
- ✅ Maintain visual hierarchy (preserve nesting)

---

## How It Works

### Input: Vision Analysis Results

```json
{
  "pageNumber": 5,
  "sections": [
    {"title": "제1장 사업 개요", "level": 1, "text": "..."}
  ],
  "tables": [
    {"caption": "요금표", "rows": 5, "cols": 3}
  ],
  "paragraphs": [
    {"text": "...", "sectionId": "제1장"}
  ]
}
```

### Process: Structure-Aware Chunking

1. **Section-Based Mode**
   - Create chunks aligned to section boundaries
   - Never split mid-section (unless exceeds maxChunkSize)
   - Preserve section hierarchy

2. **Table-Based Mode**
   - Each table = 1 chunk
   - Include table caption + surrounding context
   - Never split tables

3. **Hybrid Mode** (Recommended)
   - Prioritize sections for text
   - Isolate tables as standalone chunks
   - Group related paragraphs

### Output: Vision-Guided Chunks

```typescript
{
  id: 'chunk-5-section-1',
  content: '제1장 사업 개요\n\n아이돌봄 지원사업은...',
  type: 'section',
  metadata: {
    page: 5,
    sectionTitle: '제1장 사업 개요',
    sectionLevel: 1,
    startChar: 0,
    endChar: 1250
  }
}
```

---

## Chunking Strategies

### 1️⃣ Section-Based Strategy

**Best for:** Narrative documents, guides, manuals

```typescript
const strategy: ChunkingStrategy = {
  mode: 'section-based',
  maxChunkSize: 2000,
  minChunkSize: 500,
  preserveSection: true,
  preserveTable: true,
  overlapSize: 100
};
```

**Behavior:**
- Align chunks to section headers
- Include all content until next section
- Split oversized sections at paragraph boundaries

**Example Output:**
```
Chunk 1: 제1장 사업 개요 (all subsections)
Chunk 2: 제2장 정부지원 신청 (all subsections)
```

---

### 2️⃣ Table-Based Strategy

**Best for:** Reference documents, specifications, data sheets

```typescript
const strategy: ChunkingStrategy = {
  mode: 'table-based',
  maxChunkSize: 3000,
  minChunkSize: 100,
  preserveSection: false,
  preserveTable: true, // CRITICAL
  overlapSize: 50
};
```

**Behavior:**
- Extract each table as standalone chunk
- Include table caption + 2 paragraphs context
- Never split tables across chunks

**Example Output:**
```
Chunk 1: 요금표 (Table: 5 rows × 3 cols)
Chunk 2: 지원 대상 (Table: 10 rows × 4 cols)
```

---

### 3️⃣ Hybrid Strategy (Recommended)

**Best for:** Mixed documents (text + tables + figures)

```typescript
const strategy: ChunkingStrategy = {
  mode: 'hybrid',
  maxChunkSize: 2500,
  minChunkSize: 500,
  preserveSection: true,
  preserveTable: true,
  overlapSize: 100
};
```

**Behavior:**
1. **First Pass:** Extract tables as standalone chunks
2. **Second Pass:** Chunk remaining text by sections
3. **Third Pass:** Add overlap for context continuity

**Example Output:**
```
Chunk 1: 제1장 사업 개요 (section)
Chunk 2: 지원 대상 요금표 (table)
Chunk 3: 제2장 정부지원 신청 (section)
Chunk 4: 소득 기준표 (table)
```

---

## Quality Metrics

### Preservation Rate

```
Preservation Rate = (intact_structures / total_structures) × 100
```

**Baseline (Traditional):**
- Section Alignment: 0%
- Table Preservation: 0%
- Overall: **0%** ❌

**Vision-Guided (Target):**
- Section Alignment: 85%+
- Table Preservation: 95%+
- Overall: **90%+** ✅

---

## Implementation Plan

### Week 3: Core Implementation
1. ✅ Create types and interfaces
2. ⏳ Implement `VisionGuidedChunker` class
3. ⏳ Add section-based strategy
4. ⏳ Add table-based strategy
5. ⏳ Add hybrid strategy
6. ⏳ Write unit tests

### Week 4: Optimization
1. ⏳ Tune chunk size parameters
2. ⏳ Add overlap strategy
3. ⏳ Benchmark preservation rate
4. ⏳ Integrate with Hybrid Search

### Week 5: Integration
1. ⏳ Connect to existing pipeline
2. ⏳ Replace legacy chunker
3. ⏳ Run E2E tests
4. ⏳ Measure quality improvement

---

## Usage Example (Week 3 Target)

```typescript
import { VisionGuidedChunker } from './vision-guided-chunker';
import { VisionAnalysisResult } from '../../../infrastructure/vision/gemini-vision-client';

const chunker = new VisionGuidedChunker();

// Load Vision results from pipeline
const visionResults: VisionAnalysisResult[] = JSON.parse(
  fs.readFileSync('reports/pdf-vision/test-5-10.json')
).visionAnalysis;

// Chunk with hybrid strategy
const result = await chunker.chunk(visionResults, {
  mode: 'hybrid',
  maxChunkSize: 2500,
  minChunkSize: 500,
  preserveSection: true,
  preserveTable: true,
  overlapSize: 100
});

console.log(result.stats);
// {
//   totalChunks: 12,
//   avgChunkSize: 1850,
//   sectionChunks: 8,
//   tableChunks: 4,
//   preservationRate: 92%
// }
```

---

## Files to Create (Week 3)

- [ ] `vision-guided-chunker.ts` - Main implementation
- [ ] `strategies/section-based.ts` - Section strategy
- [ ] `strategies/table-based.ts` - Table strategy
- [ ] `strategies/hybrid.ts` - Hybrid strategy
- [ ] `utils/boundary-detection.ts` - Chunk boundary helpers
- [ ] `types.ts` - ✅ Already created
- [ ] `README.md` - ✅ This file

---

## References

- **Vision Pipeline:** `scripts/pdf-vision-pipeline.ts`
- **Vision Results:** `reports/pdf-vision/test-5-10.json`
- **RFC:** `designs/rfc/rfc-integrate-multimodal-rag-augmentation.md`
- **Comparison:** `reports/pdf-vision/comparison-report.md`

---

**Next Session Command:**
```bash
# Week 3: Start Vision-Guided Chunker implementation
# 1. Implement main class
code src/runtime/chunking/vision-guided/vision-guided-chunker.ts

# 2. Run tests
npm run test -- vision-guided-chunker
```

---

**Status:** ✅ Foundation complete, ready for Week 3 implementation
