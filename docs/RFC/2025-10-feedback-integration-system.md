# RFC: User Feedback Integration System

**Date**: 2025-10-06
**Status**: DRAFT
**Priority**: HIGH (Pre-requisite for P3 Web View)

---

## 📋 Executive Summary

**Problem**: 데이터 구축자가 증강 결과에 자연어 피드백을 제공해도 시스템이 반영하지 못함
**Solution**: Feedback Loop Agent 시스템 구축 (8-Agent Council → 11-Agent Extended)
**Impact**:

- 사용자 만족도 증가 (피드백 반영 자동화)
- 품질 점진적 개선 (Iterative refinement)
- 학습 데이터 축적 (Feedback corpus)

---

## 🎯 Goals

### Primary

1. 자연어 피드백 파싱 및 의도 이해
2. 피드백 기반 파라미터 자동 조정
3. Re-augmentation 자동 트리거
4. 개선 전후 비교 및 승인 워크플로우

### Secondary

1. 피드백 품질 평가 (유용성 점수)
2. 패턴 학습 및 자동 최적화
3. 피드백 히스토리 추적 (audit trail)

---

## 🏗️ Architecture

### New Agents (3개 추가)

#### 1. Feedback Parser Agent

**Role**: 자연어 피드백 구조화
**Input**:

```typescript
{
  qaId: string;
  userFeedback: string; // "이 답변이 너무 길어요. 핵심만 요약해주세요."
  timestamp: Date;
}
```

**Output**:

```typescript
{
  intent: "shorten_answer" | "add_detail" | "fix_error" | "change_tone" | "other";
  targetField: "answer" | "question" | "evidence";
  specificRequest: string;
  confidence: number; // 0-1
  suggestedParameters: {
    maxLength?: number;
    detailLevel?: "brief" | "detailed";
    tone?: "formal" | "casual";
  };
}
```

**Implementation**:

```typescript
export class FeedbackParserAgent extends BaseAgent {
  constructor(logger: Logger) {
    super(
      "feedback-parser",
      "nlp_feedback_analysis",
      ["nlp", "intent-recognition", "parameter-extraction"],
      logger,
    );
  }

  protected async handle(
    content: UserFeedback,
    context?: AgentContext,
  ): Promise<ParsedFeedback> {
    // 1. Intent classification (LLM-based)
    const intent = await this.classifyIntent(content.userFeedback);

    // 2. Parameter extraction
    const params = await this.extractParameters(content.userFeedback, intent);

    // 3. Confidence assessment
    const confidence = await this.assessConfidence(intent, params);

    return {
      intent,
      targetField: this.identifyTargetField(content),
      specificRequest: content.userFeedback,
      confidence,
      suggestedParameters: params,
    };
  }
}
```

---

#### 2. Adjustment Orchestrator Agent

**Role**: 피드백 기반 재생성 파라미터 결정
**Input**: ParsedFeedback + Original QAPair
**Output**:

```typescript
{
  adjustmentPlan: {
    agentsToInvoke: string[]; // ["answer-generator", "quality-auditor"]
    parameterOverrides: Record<string, unknown>;
    qualityTarget: number;
    expectedImprovement: string;
  };
  executionStrategy: "full-regenerate" | "partial-edit" | "parameter-tune";
  rollbackPlan: {
    originalQAPair: QAPair;
    fallbackStrategy: string;
  };
}
```

**Logic**:

```typescript
export class AdjustmentOrchestratorAgent extends BaseAgent {
  protected async handle(
    content: { feedback: ParsedFeedback; original: QAPair },
    context?: AgentContext,
  ): Promise<AdjustmentPlan> {
    const { feedback, original } = content;

    // 1. Determine strategy based on intent
    const strategy = this.determineStrategy(feedback.intent);

    // 2. Select agents to re-invoke
    const agents = await this.selectAgents(feedback, strategy);

    // 3. Calculate parameter overrides
    const overrides = await this.calculateOverrides(feedback, original);

    // 4. Assess expected improvement
    const expectedImprovement = await this.projectImprovement(
      original.qualityScore,
      overrides,
    );

    return {
      adjustmentPlan: {
        agentsToInvoke: agents,
        parameterOverrides: overrides,
        qualityTarget: original.qualityScore + 0.5, // Incremental improvement
        expectedImprovement,
      },
      executionStrategy: strategy,
      rollbackPlan: {
        originalQAPair: original,
        fallbackStrategy: "revert-on-quality-decrease",
      },
    };
  }
}
```

---

#### 3. Feedback Quality Assessor Agent

**Role**: 피드백 유용성 및 적용 가능성 평가
**Input**: ParsedFeedback
**Output**:

```typescript
{
  usefulnessScore: number; // 0-10
  feasibility: "easy" | "moderate" | "difficult";
  estimatedImpact: number; // Expected quality delta
  recommendation: "apply" | "clarify" | "ignore";
  reasoning: string;
}
```

---

### Integration with Existing System

**Modified Flow**:

```typescript
// Phase 1: Initial Generation (Existing)
const qaResult = await metaController.orchestrate(request);

// Phase 2: User Feedback (NEW)
const userFeedback = await collectUserFeedback(qaResult);

// Phase 3: Feedback Processing (NEW)
const parsedFeedback = await feedbackParserAgent.receive(userFeedback);
const qualityAssessment = await feedbackQualityAgent.receive(parsedFeedback);

if (qualityAssessment.recommendation === "apply") {
  // Phase 4: Adjustment Planning (NEW)
  const adjustmentPlan = await adjustmentOrchestratorAgent.receive({
    feedback: parsedFeedback,
    original: qaResult,
  });

  // Phase 5: Re-generation (Modified Existing)
  const improvedResult = await metaController.orchestrate(
    request,
    adjustmentPlan.parameterOverrides,
  );

  // Phase 6: Comparison & Approval (NEW)
  const comparison = await compareResults(qaResult, improvedResult);

  if (comparison.improvedQuality) {
    return improvedResult;
  } else {
    return qaResult; // Rollback
  }
}
```

---

## 📊 Data Models

### Feedback Schema

```typescript
export const UserFeedbackSchema = z.object({
  id: z.string().uuid(),
  qaId: z.string(),
  userId: z.string(),
  feedbackText: z.string().min(1).max(1000),
  timestamp: z.date(),
  context: z.object({
    sessionId: z.string(),
    iterationNumber: z.number(), // How many times this QA was regenerated
  }),
});

export const ParsedFeedbackSchema = z.object({
  intent: z.enum([
    "shorten_answer",
    "add_detail",
    "fix_error",
    "change_tone",
    "improve_clarity",
    "add_examples",
    "remove_redundancy",
    "other",
  ]),
  targetField: z.enum(["answer", "question", "evidence"]),
  specificRequest: z.string(),
  confidence: z.number().min(0).max(1),
  suggestedParameters: z.record(z.unknown()),
});

export const AdjustmentPlanSchema = z.object({
  adjustmentPlan: z.object({
    agentsToInvoke: z.array(z.string()),
    parameterOverrides: z.record(z.unknown()),
    qualityTarget: z.number(),
    expectedImprovement: z.string(),
  }),
  executionStrategy: z.enum([
    "full-regenerate",
    "partial-edit",
    "parameter-tune",
  ]),
  rollbackPlan: z.object({
    originalQAPair: z.unknown(), // QAPairSchema
    fallbackStrategy: z.string(),
  }),
});
```

---

## 🚀 Implementation Phases

### Phase A: Foundation (Week 1)

- [ ] Feedback Parser Agent 구현
- [ ] ParsedFeedback schema 정의
- [ ] Intent classification LLM prompt 작성
- [ ] Unit tests (10+ cases)

### Phase B: Orchestration (Week 2)

- [ ] Adjustment Orchestrator Agent 구현
- [ ] Parameter override logic
- [ ] Strategy selection algorithm
- [ ] Integration tests with MetaController

### Phase C: Quality Loop (Week 3)

- [ ] Feedback Quality Assessor Agent
- [ ] Comparison & rollback logic
- [ ] Feedback history tracking (JSONL)
- [ ] End-to-end tests

### Phase D: Optimization (Week 4)

- [ ] Pattern learning (feedback → parameter mapping)
- [ ] Auto-optimization (frequent feedback patterns)
- [ ] Performance monitoring
- [ ] Production rollout (canary)

---

## 📈 Success Metrics

### Primary KPIs

- **Feedback application rate**: > 80%
- **Quality improvement rate**: > 70% (after feedback)
- **User satisfaction**: > 8/10
- **Iteration count**: < 2 per QA (average)

### Secondary KPIs

- **Intent classification accuracy**: > 85%
- **Rollback rate**: < 15%
- **Processing latency**: < 5s per feedback
- **Cost per feedback**: < $0.05

---

## 🔒 Safety & Rollback

### Guardrails

1. **Quality gate**: Reject if improved score < original - 0.5
2. **Cost limit**: Max $0.50 per feedback iteration
3. **Iteration cap**: Max 3 regenerations per QA
4. **Timeout**: 30s per feedback processing

### Rollback Conditions

- Quality degradation
- Timeout exceeded
- Cost threshold breached
- User explicit reject

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
describe("FeedbackParserAgent", () => {
  test("should parse shortening request", async () => {
    const feedback = "이 답변이 너무 길어요. 핵심만 요약해주세요.";
    const result = await parser.receive({ userFeedback: feedback });

    expect(result.intent).toBe("shorten_answer");
    expect(result.confidence).toBeGreaterThan(0.8);
    expect(result.suggestedParameters.detailLevel).toBe("brief");
  });

  test("should handle ambiguous feedback", async () => {
    const feedback = "별로예요";
    const result = await parser.receive({ userFeedback: feedback });

    expect(result.intent).toBe("other");
    expect(result.confidence).toBeLessThan(0.5);
  });
});
```

### Integration Tests

```typescript
describe("Feedback Loop End-to-End", () => {
  test("should improve answer based on feedback", async () => {
    const original = await generateQA(request);
    const feedback = "답변에 구체적인 예시를 추가해주세요";

    const improved = await processFeedback(original, feedback);

    expect(improved.qualityScore).toBeGreaterThan(original.qualityScore);
    expect(improved.answer).toContain("예를 들어");
  });
});
```

---

## 🔗 Integration Points

### With Quality System (Phase 3)

- Feedback triggers quality re-assessment
- Hybrid search re-runs with adjusted parameters
- Evidence alignment re-checked

### With Governance

- Feedback logs → governance audit trail
- Parameter changes tracked
- Cost/quality tradeoffs logged

### With Web View (P3)

- Real-time feedback UI
- Before/after comparison view
- Approval/reject buttons

---

## 💡 Performance Optimizations

### 1. Caching Strategy

```typescript
// Cache parsed feedback patterns
const feedbackCache = new LRU<string, ParsedFeedback>({
  max: 1000,
  ttl: 3600000, // 1 hour
});

// Cache parameter adjustments
const parameterCache = new Map<string, AdjustmentPlan>();
```

### 2. Batch Processing

```typescript
// Process multiple feedback items in parallel
const feedbackBatch = await Promise.all(
  feedbacks.map((fb) => feedbackParserAgent.receive(fb)),
);
```

### 3. Lazy Regeneration

```typescript
// Only regenerate if quality gain > threshold
if (expectedImprovement > 0.3) {
  await regenerate();
} else {
  return original; // Skip regeneration
}
```

---

## 🛠️ Required Infrastructure

### New Components

1. **Feedback Store**: PostgreSQL table or JSONL log
2. **Pattern Learner**: Batch job (daily) to learn feedback → parameter mappings
3. **Feedback Queue**: Redis queue for async processing
4. **Comparison Engine**: Side-by-side QA comparison utility

### Existing Components (Modified)

1. **MetaController**: Accept parameter overrides
2. **Quality Ledger**: Log feedback events
3. **Governance Rules**: Add feedback approval rules

---

## 📝 Open Questions

1. **Feedback UI**: Web view vs API-only?
2. **Real-time vs Batch**: Process feedback immediately or in batches?
3. **Cost control**: Hard limit or soft warning?
4. **Multi-turn feedback**: Support iterative refinement?
5. **Feedback training data**: Use for future model fine-tuning?

---

## 🎯 Next Steps

1. **Approval**: Review this RFC with stakeholders
2. **Implementation**: Start with Phase A (Foundation)
3. **Testing**: TDD approach with comprehensive test suite
4. **Integration**: Integrate with existing Phase 3 Quality System
5. **Deployment**: Canary rollout with 10% → 50% → 100%

---

**Author**: Claude Code Agent
**Reviewers**: [TBD]
**References**:

- CLAUDE.md (8-Agent Council)
- QUALITY_SYSTEM_ARCHITECTURE.md (Phase 3)
- PRODUCT_PLAN.md (P3 Web View)
