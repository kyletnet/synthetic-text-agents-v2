# LinguisticsEngineer Quick Reference Guide

## Overview
The LinguisticsEngineer has been refactored using Strategy + Template patterns. This guide provides quick access to the new architecture.

---

## File Locations

### Main Agent
```
src/agents/linguisticsEngineer.ts (170 lines)
```

### Service Layer
```
src/application/agents/linguistics-engineer-service.ts (145 lines)
```

### Domain Strategies
```
src/domain/agents/linguistics-strategies/
├── base-strategy.ts              (37 lines)   - Strategy interface
├── prompt-optimization.ts        (248 lines)  - LLM optimization
├── terminology-validation.ts     (204 lines)  - Terminology management
├── structure-analysis.ts         (345 lines)  - Language quality analysis
└── index.ts                      (11 lines)   - Exports
```

### Templates
```
src/domain/agents/templates/
└── linguistics-prompts.ts        (225 lines)  - Prompt templates
```

### Tests
```
tests/domain/agents/linguistics-strategies/
├── prompt-optimization.test.ts   (341 lines, 15 tests)
├── terminology-validation.test.ts (318 lines, 15 tests)
└── structure-analysis.test.ts    (395 lines, 22 tests)

tests/linguisticsEngineer.test.ts (25 lines, 3 tests)
```

---

## Usage Examples

### Standard Usage (Recommended)
```typescript
import { LinguisticsEngineer } from "./agents/linguisticsEngineer.js";
import { Logger } from "./shared/logger.js";

const logger = new Logger();
const agent = new LinguisticsEngineer(logger);

const result = await agent.process({
  targetLLM: "claude",
  domain: "customer_service",
  complexityLevel: 7,
  qualityTarget: 9,
  outputFormat: "qa-pairs"
}, context);
```

### Service Layer Usage
```typescript
import { LinguisticsEngineerService } from "./application/agents/linguistics-engineer-service.js";
import { Logger } from "./shared/logger.js";

const logger = new Logger();
const service = new LinguisticsEngineerService(logger);

// Full analysis
const result = await service.analyze(request);

// Individual strategies
const optimization = await service.optimizePrompt(request);
const terminology = await service.validateTerminology(request);
const structure = await service.analyzeStructure(request);
```

### Direct Strategy Usage
```typescript
import {
  PromptOptimizationStrategy,
  TerminologyValidationStrategy,
  StructureAnalysisStrategy
} from "./domain/agents/linguistics-strategies/index.js";

const promptStrategy = new PromptOptimizationStrategy();
const result = await promptStrategy.execute(request);
```

### Template Usage
```typescript
import {
  buildLinguisticsPrompt,
  MODEL_INSTRUCTION_TEMPLATES,
  DOMAIN_TERMINOLOGY_TEMPLATES
} from "./domain/agents/templates/linguistics-prompts.js";

const prompt = buildLinguisticsPrompt({
  targetLLM: "claude",
  instructionLevel: "excellent",
  domain: "customer_service",
  qualityLevel: "high_quality",
  complexityLevel: "high_complexity",
  outputFormat: "qa-pairs",
  tokenOptimization: "moderate"
});
```

---

## Strategy Responsibilities

### PromptOptimizationStrategy
**Purpose**: Optimizes prompts for specific LLM models
- Analyzes LLM characteristics (Claude, GPT, Gemini, Generic)
- Optimizes prompt structure based on instruction following capability
- Estimates and optimizes token usage
- Designs output parsing strategies

**Key Methods**:
- `execute(request)` - Returns `LLMOptimization`
- `analyzeLLMCharacteristics(targetLLM)` - Model characteristics
- `optimizePromptStructure(request, modelChar)` - Prompt structure
- `optimizeTokenUsage(request, structure)` - Token optimization
- `designOutputParsing(request, modelChar)` - Output parsing

### TerminologyValidationStrategy
**Purpose**: Manages domain-specific terminology
- Builds domain vocabulary (customer_service, sales, marketing)
- Creates usage guidelines
- Establishes consistency rules

**Key Methods**:
- `execute(request)` - Returns `TerminologyFramework`
- `buildDomainVocabulary(domain, requirements)` - Domain vocabulary
- `createUsageGuidelines(request, vocabulary)` - Usage guidelines
- `establishConsistencyRules(vocabulary)` - Consistency rules

### StructureAnalysisStrategy
**Purpose**: Analyzes language quality and structure
- Assesses clarity, consistency, precision, naturalness
- Generates structural recommendations
- Predicts performance

**Key Methods**:
- `execute(request)` - Returns `StructureAnalysisResult`
- `executeWithOptimization(request, optimization)` - With LLM optimization
- `analyzeLanguageQuality(request)` - Language quality assessment
- `generateStructuralRecommendations(request, optimization)` - Recommendations
- `predictPerformance(request, optimization, quality)` - Performance predictions

---

## Extending the System

### Adding a New LLM Model
1. Add to `MODEL_INSTRUCTION_TEMPLATES` in `linguistics-prompts.ts`
2. Extend `analyzeLLMCharacteristics()` in `prompt-optimization.ts`
3. Add test cases in `prompt-optimization.test.ts`

### Adding a New Domain
1. Add to `DOMAIN_TERMINOLOGY_TEMPLATES` in `linguistics-prompts.ts`
2. Extend `vocabularyMaps` in `terminology-validation.ts`
3. Add test cases in `terminology-validation.test.ts`

### Creating a New Strategy
1. Create new file in `src/domain/agents/linguistics-strategies/`
2. Implement `LinguisticsStrategy` interface
3. Add to service orchestration in `linguistics-engineer-service.ts`
4. Create corresponding test file
5. Export from `index.ts`

---

## Testing

### Run All Linguistics Tests
```bash
npm test -- tests/linguisticsEngineer.test.ts
npm test -- tests/domain/agents/linguistics-strategies/
```

### Run Specific Strategy Tests
```bash
npm test -- tests/domain/agents/linguistics-strategies/prompt-optimization.test.ts
npm test -- tests/domain/agents/linguistics-strategies/terminology-validation.test.ts
npm test -- tests/domain/agents/linguistics-strategies/structure-analysis.test.ts
```

### TypeScript Check
```bash
npm run typecheck
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     LinguisticsEngineer                     │
│                        (170 lines)                          │
│  • Extends BaseAgent                                        │
│  • Delegates to Service Layer                               │
│  • Maintains backward compatibility                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              LinguisticsEngineerService                     │
│                   (145 lines)                               │
│  • Orchestrates strategies                                  │
│  • Manages dependencies                                     │
│  • Provides individual strategy access                      │
└────────┬─────────────────┬──────────────────┬───────────────┘
         │                 │                  │
         ▼                 ▼                  ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐
│   Prompt     │  │  Terminology    │  │    Structure     │
│ Optimization │  │   Validation    │  │    Analysis      │
│ (248 lines)  │  │  (204 lines)    │  │  (345 lines)     │
└──────────────┘  └─────────────────┘  └──────────────────┘
         │                 │                  │
         └─────────────────┴──────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ Linguistics Prompts    │
              │    Templates           │
              │    (225 lines)         │
              └────────────────────────┘
```

---

## Performance Characteristics

| Operation | Time Complexity | Notes |
|-----------|----------------|-------|
| Full Analysis | O(1) | Parallel execution where possible |
| Prompt Optimization | O(1) | Deterministic calculations |
| Terminology Validation | O(n) | n = terminology requirements |
| Structure Analysis | O(1) | Deterministic calculations |

**Memory**: ~1385 lines loaded (vs 1020 before), but modular and maintainable

---

## Migration Checklist

If you're migrating code that uses LinguisticsEngineer:

- ✅ No changes required - 100% backward compatible
- ✅ All existing imports still work
- ✅ All existing API calls unchanged
- ✅ Same input/output contracts
- ✅ New capabilities available if needed

---

## Common Tasks

### Task: Add Support for New LLM (e.g., "llama")

1. **Update Templates** (`linguistics-prompts.ts`):
```typescript
export const MODEL_INSTRUCTION_TEMPLATES = {
  // ... existing
  llama: {
    excellent: "Optimized instructions for Llama..."
  }
};
```

2. **Update Strategy** (`prompt-optimization.ts`):
```typescript
private analyzeLLMCharacteristics(targetLLM: string) {
  const characteristics = {
    // ... existing
    llama: {
      contextWindow: 4096,
      tokenEfficiency: 3.5,
      instructionFollowing: "good" as const,
      reasoningCapability: "standard" as const,
      creativityLevel: "medium" as const,
    }
  };
  // ...
}
```

3. **Add Tests** (`prompt-optimization.test.ts`):
```typescript
describe("Llama LLM Optimization", () => {
  it("should optimize for Llama with correct characteristics", async () => {
    const request: LinguisticsAnalysisRequest = {
      targetLLM: "llama",
      // ... rest of request
    };
    const result = await strategy.execute(request);
    expect(result.modelCharacteristics.contextWindow).toBe(4096);
  });
});
```

4. **Update Types** (`linguisticsEngineer.ts`):
```typescript
export interface LinguisticsAnalysisRequest {
  targetLLM: "claude" | "gpt" | "gemini" | "llama" | "generic";
  // ... rest
}
```

---

## Troubleshooting

### Issue: Strategy not executing
**Solution**: Check that service layer is properly instantiated in agent constructor

### Issue: Missing template
**Solution**: Ensure template is exported from `linguistics-prompts.ts` and imported in strategy

### Issue: Tests failing
**Solution**: Run `npm run typecheck` first, then check test assertions match new structure

### Issue: Performance degradation
**Solution**: Check if strategies are being parallelized in service layer

---

## Best Practices

1. **Always use the Agent**: For standard operations, use the LinguisticsEngineer agent
2. **Service for Granular Control**: Use service layer when you need specific strategies
3. **Direct Strategies Rarely**: Only use direct strategy access for testing or special cases
4. **Test Each Layer**: Test strategies, service, and agent separately
5. **Extend, Don't Modify**: Add new strategies rather than modifying existing ones
6. **Externalize Templates**: Never hard-code prompts in strategy logic

---

## Related Documentation

- Full Report: `/reports/linguistics-engineer-refactoring-phase7.md`
- Architecture Guide: `/docs/technical_architecture_guide.md`
- Development Standards: `/DEVELOPMENT_STANDARDS.md`
- CLAUDE.md: Project philosophy and guidelines

---

**Last Updated**: 2025-10-07
**Version**: Phase 7 Refactoring Complete
