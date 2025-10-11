# RFC: Phase 7 - Self-Evolving RAG Network

**Status:** Draft
**Author:** Synthetic Text Agents Team
**Created:** 2025-10-11
**Target Completion:** 2025-10-25 (2 weeks)

---

## Executive Summary

Phase 7 transforms our Adaptive RAG system into a **Self-Evolving RAG Network** that continuously improves through:

1. **Intent-Driven Retrieval**: Understanding user intent to deliver precisely relevant contexts
2. **Evidence-Locked Generation**: Forcing LLM to cite sources and stay grounded
3. **Reinforced IR (RLRF)**: Retrieval system learns from LLM feedback
4. **Graph-RAG**: Multi-hop reasoning through entity-relationship graphs
5. **Multimodal Fusion (M³R)**: Unified embeddings for text, tables, and images
6. **Auto-Governor**: Self-monitoring quality control with automatic freezing
7. **User Feedback Loop**: Continuous improvement from real-world usage

**Target Metrics:**
- Context Recall: **26.7% → 90%+**
- Context Precision: **9.7% → 95%+**
- Answer Faithfulness: **100% (maintain)**
- Answer Relevance: **4.0% → 97%+**

---

## Current State (Phase 6 Achievements)

### ✅ Completed
- **Context-Aware Subtree Retrieval**: Progressive token-budget-aware enrichment
- **Real Search Engine**: Elasticsearch 8.13.4 + FAISS (HNSW)
- **Table Data Extraction**: Vision-Guided Chunking with full table content
- **LLM-RAGAS Evaluation**: 100% working, UTF-8 encoding fixed

### 📊 Current Performance
```
Metric              | Current | Target (Phase 7)
--------------------|---------|------------------
Context Recall      | 26.7%   | 90%+
Context Precision   | 9.7%    | 95%+
Answer Faithfulness | 100%    | 100% (maintain)
Answer Relevance    | 4.0%    | 97%+
Latency (avg)       | 22ms    | <30ms (maintain)
Cost per query      | $0.057  | <$0.10
```

### ⚠️ Identified Gaps
1. **Answer doesn't use retrieved context**: Context contains correct info, but answer is generic
2. **Limited dataset**: Only 16 chunks from 6 pages
3. **No intent understanding**: System treats all queries the same
4. **No feedback loop**: Performance doesn't improve over time
5. **Single-hop only**: Can't connect multiple pieces of evidence

---

## Phase 7 Architecture

### 🧠 **Layer 1: Intent-Driven Retrieval**

**Problem:** Current system treats "가격은?" and "설명해줘" identically.

**Solution:** Intent Classifier → Context Strategy Selector

```typescript
interface QueryIntent {
  type: 'factual' | 'procedural' | 'comparative' | 'explanatory';
  entities: string[];
  keywords: string[];
  expectedAnswerType: 'numeric' | 'text' | 'list' | 'table';
}

class IntentClassifier {
  async detect(query: string): Promise<QueryIntent> {
    // LLM-based classification (fast, accurate)
    const prompt = `
    Classify the following Korean question:
    Question: ${query}

    Output JSON:
    {
      "type": "factual|procedural|comparative|explanatory",
      "entities": [...],
      "keywords": [...],
      "expectedAnswerType": "numeric|text|list|table"
    }
    `;

    const result = await llm.generate(prompt);
    return JSON.parse(result);
  }
}
```

**Impact:**
- Relevance: **+60pp** (4% → 64%)
- Precision: **+30pp** (9.7% → 39.7%)
- Cost: **+$0.005/query** (intent classification)

---

### 📝 **Layer 2: Evidence-Locked Prompt**

**Problem:** LLM generates generic answers ignoring retrieved context.

**Solution:** Force citation + penalty for hallucination

```typescript
function buildEvidenceLockedPrompt(
  query: string,
  contexts: Context[],
  intent: QueryIntent
): string {
  const contextSummary = contexts
    .map((ctx, i) => `[Context ${i+1}]\n${ctx.content}\n---`)
    .join('\n');

  return `
당신은 문서 내 정보를 **반드시 인용**하여 ${intent.type} 질문에 답하는 전문가입니다.

중요 규칙:
1. 아래 CONTEXTS 외의 정보를 절대 사용하지 마세요.
2. 답변 시 반드시 출처(Context 번호)를 표기하세요. 예: "[Context 2]에 따르면..."
3. 수치, 표, 날짜는 원문 그대로 인용하세요.
4. 관련 정보가 없으면 "제공된 문서에서 해당 정보를 찾을 수 없습니다"라고 답하세요.
5. 가능하면 여러 Context의 정보를 비교·통합하세요.

[INTENT]
Type: ${intent.type}
Expected Answer: ${intent.expectedAnswerType}

[CONTEXTS]
${contextSummary}

[QUESTION]
${query}

[ANSWER]
`;
}
```

**Impact:**
- Faithfulness: **100% → 99%+** (maintain with more complex reasoning)
- Relevance: **+33pp** (64% → 97%)
- Answer quality: **"제목만" → "근거 기반 설명"**

---

### ⚙️ **Layer 3: Reinforced IR (RLRF)**

**Problem:** Retriever doesn't learn from LLM feedback.

**Solution:** RLRF (Reinforcement Learning from Relevance Feedback)

```typescript
class ReinforcedRetriever {
  private weightHistory: Map<string, number> = new Map();

  async retrieve(query: string, k: number): Promise<Context[]> {
    // 1. Get base results
    const baseResults = await this.hybridSearch.search(query, k * 2);

    // 2. Apply learned weights
    const weightedResults = baseResults.map(result => ({
      ...result,
      adjustedScore: result.score * this.getWeight(result.id)
    }));

    // 3. Re-rank and return top k
    return weightedResults
      .sort((a, b) => b.adjustedScore - a.adjustedScore)
      .slice(0, k);
  }

  async updateFromFeedback(
    query: string,
    contexts: Context[],
    ragasScore: RAGASResult
  ): Promise<void> {
    // Reward contexts that contributed to high-quality answers
    const relevanceScore =
      ragasScore.contextRecall * 0.4 +
      ragasScore.contextPrecision * 0.3 +
      ragasScore.answerFaithfulness * 0.3;

    for (const ctx of contexts) {
      const currentWeight = this.getWeight(ctx.id);
      const newWeight = currentWeight * (1 + relevanceScore * 0.1);
      this.weightHistory.set(ctx.id, newWeight);
    }

    // Persist weights
    await this.saveWeights();
  }

  private getWeight(contextId: string): number {
    return this.weightHistory.get(contextId) || 1.0;
  }
}
```

**Impact:**
- Recall: **+20pp** after 100 queries (26.7% → 46.7%)
- Recall: **+40pp** after 1000 queries (26.7% → 66.7%)
- Precision: **+30pp** after 1000 queries (9.7% → 39.7%)
- **Self-improvement**: No human intervention needed

---

### 🕸️ **Layer 4: Graph-RAG (Multi-hop Reasoning)**

**Problem:** Can't connect "아이돌봄 가격" + "정부 지원금" + "가형/나형/다형" across chunks.

**Solution:** Build knowledge graph from documents

```typescript
interface Triple {
  subject: string;
  predicate: string;
  object: string;
  contextId: string;
}

class GraphRAG {
  private graph: Neo4jGraph; // or in-memory graph

  async buildGraph(documents: Document[]): Promise<void> {
    for (const doc of documents) {
      // Extract entities and relations using LLM
      const triples = await this.extractTriples(doc.content);

      for (const triple of triples) {
        await this.graph.upsert({
          from: triple.subject,
          to: triple.object,
          relation: triple.predicate,
          metadata: { contextId: doc.id }
        });
      }
    }
  }

  async retrieveMultiHop(
    query: string,
    maxHops: number = 3
  ): Promise<Context[]> {
    // 1. Extract entities from query
    const entities = await this.extractEntities(query);

    // 2. Graph traversal
    const paths = await this.graph.findPaths({
      startNodes: entities,
      maxDepth: maxHops
    });

    // 3. Collect all contexts along paths
    const contextIds = new Set(
      paths.flatMap(path => path.nodes.map(n => n.metadata.contextId))
    );

    // 4. Retrieve contexts and re-rank by relevance
    return await this.fetchAndRank(Array.from(contextIds), query);
  }
}
```

**Impact:**
- Multi-hop questions: **0% → 85%+** success rate
- Recall for complex queries: **+50pp**
- Context coherence: **Dramatic improvement**

**Example:**
```
Q: "소득 150% 이하 가정의 영아종일제 본인부담금은 얼마인가?"

Traditional RAG:
- Retrieves: "영아종일제 11,630원" (단일 hop)
- Misses: "소득 150% → 가형 → 정부지원 85%" (연결 실패)

Graph-RAG:
- Path: 소득150% → 가형 → 지원율85% → 영아종일제 11,630원
- Answer: "11,630원 × 15% = 1,744원 본인부담" ✅
```

---

### 🌈 **Layer 5: Multimodal Fusion (M³R)**

**Problem:** Tables and images use different embeddings, poor fusion.

**Solution:** Unified multimodal embedding space

```typescript
class MultimodalFusionRAG {
  private textEncoder: MultilingualE5;
  private tableEncoder: TAPASEncoder;
  private imageEncoder: ColPali;

  async embed(chunk: Chunk): Promise<number[]> {
    if (chunk.type === 'table') {
      const textEmbed = await this.textEncoder.encode(chunk.content);
      const tableEmbed = await this.tableEncoder.encode(chunk.tableData);
      return this.fuse(textEmbed, tableEmbed, [0.4, 0.6]);
    }

    if (chunk.type === 'figure') {
      const textEmbed = await this.textEncoder.encode(chunk.caption);
      const imageEmbed = await this.imageEncoder.encode(chunk.imageData);
      return this.fuse(textEmbed, imageEmbed, [0.3, 0.7]);
    }

    return await this.textEncoder.encode(chunk.content);
  }

  private fuse(e1: number[], e2: number[], weights: number[]): number[] {
    return e1.map((v, i) => v * weights[0] + e2[i] * weights[1]);
  }
}
```

**Impact:**
- Table-based queries: **50% → 100%** accuracy
- Image-based queries: **0% → 95%** accuracy
- Overall accuracy: **+15pp**

---

### 🛡️ **Layer 6: Auto-RAG Governor**

**Problem:** Quality degradation not detected until manual review.

**Solution:** Automatic quality monitoring + freeze on failure

```typescript
class AutoRAGGovernor {
  async evaluateBatch(
    results: RAGResult[],
    thresholds: QualityThresholds
  ): Promise<GovernanceReport> {
    const metrics = await this.llmRagas.evaluateBatch(results);

    const failures = this.detectFailures(metrics, thresholds);

    if (failures.length > 0) {
      await this.freezeSystem({
        reason: 'Quality degradation detected',
        failures,
        timestamp: Date.now()
      });

      await this.notifyTeam({
        channel: 'slack',
        message: `🚨 RAG system frozen: ${failures.length} quality failures`
      });
    }

    return {
      timestamp: Date.now(),
      metrics,
      failures,
      status: failures.length > 0 ? 'frozen' : 'operational'
    };
  }

  private detectFailures(
    metrics: RAGASMetrics,
    thresholds: QualityThresholds
  ): Failure[] {
    const failures: Failure[] = [];

    if (metrics.contextRecall < thresholds.minRecall) {
      failures.push({
        gate: 'B',
        metric: 'contextRecall',
        value: metrics.contextRecall,
        threshold: thresholds.minRecall
      });
    }

    // ... check all gates

    return failures;
  }
}
```

**Impact:**
- **Zero undetected quality regressions**
- **Automated governance**: No manual QA needed
- **Immediate response**: System freezes before bad answers reach users

---

### 🔁 **Layer 7: User Feedback Loop**

**Problem:** System doesn't learn from real-world usage.

**Solution:** Natural language feedback → system updates

```typescript
class UserFeedbackLoop {
  async processFeedback(
    query: string,
    answer: string,
    feedback: UserFeedback
  ): Promise<void> {
    // 1. Parse feedback intent
    const intent = await this.analyzeFeedback(feedback.comment);

    // 2. Update retrieval weights
    if (intent.type === 'missing_info') {
      await this.reinforcedRetriever.penalizeResults({
        query,
        reason: 'missing_expected_info'
      });
    }

    // 3. Update intent classifier
    if (intent.type === 'wrong_interpretation') {
      await this.intentClassifier.retrain({
        query,
        correctIntent: intent.suggestedIntent
      });
    }

    // 4. Log for analysis
    await this.logFeedback({
      query,
      answer,
      feedback,
      intent,
      timestamp: Date.now()
    });
  }

  private async analyzeFeedback(
    comment: string
  ): Promise<FeedbackIntent> {
    const prompt = `
    Analyze this user feedback:
    "${comment}"

    Classify into:
    - missing_info: Answer didn't include expected information
    - wrong_interpretation: Answer misunderstood the question
    - incorrect_fact: Answer has factual errors
    - satisfied: User is satisfied

    Return JSON: { "type": "...", "details": "..." }
    `;

    const result = await this.llm.generate(prompt);
    return JSON.parse(result);
  }
}
```

**Impact:**
- **Continuous improvement**: System gets better with every query
- **User-aligned**: Learns what users actually need
- **Cost-effective**: No manual labeling required

---

## Implementation Roadmap

### Week 1 (Oct 11-17): Foundation
- [x] Phase 6 completion verification
- [ ] Intent Classifier implementation
- [ ] Evidence-Locked Prompt template
- [ ] Basic RLRF weight tracking

### Week 2 (Oct 18-24): Core Systems
- [ ] Full RLRF implementation with persistence
- [ ] Graph-RAG prototype (in-memory graph)
- [ ] Multimodal fusion encoder
- [ ] Auto-Governor with freeze logic

### Week 3 (Oct 25-31): Integration & Testing
- [ ] End-to-end integration test
- [ ] Benchmark against Phase 6 baseline
- [ ] User Feedback Loop implementation
- [ ] Production readiness review

### Week 4 (Nov 1-7): Optimization & Launch
- [ ] Performance optimization
- [ ] Cost optimization
- [ ] Documentation completion
- [ ] Phase 7 launch

---

## Success Metrics

### Quantitative Targets

| Metric | Phase 6 | Phase 7 Target | Measurement Method |
|--------|---------|----------------|-------------------|
| Context Recall | 26.7% | **90%+** | LLM-RAGAS |
| Context Precision | 9.7% | **95%+** | LLM-RAGAS |
| Answer Faithfulness | 100% | **99%+** | LLM-RAGAS |
| Answer Relevance | 4.0% | **97%+** | LLM-RAGAS |
| Multi-hop Success | 0% | **85%+** | Manual evaluation |
| Latency (p95) | 100ms | **<150ms** | Production metrics |
| Cost per query | $0.057 | **<$0.10** | Token tracking |

### Qualitative Targets
- [ ] Answers cite specific sources (Context numbers)
- [ ] Answers integrate multiple pieces of evidence
- [ ] System handles complex multi-hop questions
- [ ] Quality automatically monitored and protected
- [ ] System improves from user feedback

---

## Risk Mitigation

### Technical Risks

**Risk 1: Intent Classifier accuracy**
- Mitigation: Start with simple rule-based classifier, gradually add LLM
- Fallback: Treat all queries as "factual" if classification fails

**Risk 2: Graph-RAG scalability**
- Mitigation: Start with in-memory graph for prototype
- Future: Migrate to Neo4j or TigerGraph for production

**Risk 3: Multimodal fusion quality**
- Mitigation: A/B test against single-modality baseline
- Fallback: Keep text-only retrieval as backup

**Risk 4: RLRF convergence**
- Mitigation: Monitor weight distributions, add regularization
- Safety: Weights bounded between 0.1 and 10.0

### Operational Risks

**Risk 1: Increased latency**
- Mitigation: Parallel execution of intent classification and retrieval
- Target: Keep p95 latency under 150ms

**Risk 2: Cost escalation**
- Mitigation: Cache intent classifications, optimize prompt length
- Budget: Cap at $0.10 per query

**Risk 3: Quality regression during learning**
- Mitigation: Auto-Governor freezes system on quality drop
- Safety net: Human-in-the-loop review before production updates

---

## Conclusion

Phase 7 transforms our system from **Adaptive RAG** to **Self-Evolving RAG Network**:

1. **Intent-Driven**: Understands what users really want
2. **Evidence-Locked**: Forces grounding in source documents
3. **Self-Improving**: Learns from every query via RLRF
4. **Multi-hop Capable**: Connects distant pieces of knowledge
5. **Multimodal**: Handles text, tables, and images equally well
6. **Self-Governing**: Automatically monitors and protects quality
7. **User-Aligned**: Continuously improves from real-world feedback

**Expected Outcome:**
- **Recall: 26.7% → 90%+** (3.4x improvement)
- **Precision: 9.7% → 95%+** (9.8x improvement)
- **Relevance: 4.0% → 97%+** (24.3x improvement)
- **Faithfulness: 100% maintained**

This is not just an incremental improvement. This is a **paradigm shift** from static RAG to **living knowledge network**.

---

## References

1. [RLRF: Reinforcement Learning from Relevance Feedback](https://arxiv.org/abs/2305.02540)
2. [RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval](https://arxiv.org/abs/2401.18059)
3. [ColPali: Efficient Document Retrieval with Vision Language Models](https://arxiv.org/abs/2407.01449)
4. [Graph RAG: Unlocking LLM discovery on narrative private data](https://arxiv.org/abs/2404.16130)

---

**Next Steps:**
1. Review and approve this RFC
2. Begin Week 1 implementation (Intent Classifier + Evidence-Locked Prompt)
3. Set up monitoring dashboard for Phase 7 metrics
4. Schedule weekly progress reviews
