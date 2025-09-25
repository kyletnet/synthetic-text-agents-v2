# System Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Synthetic Text Agents v2                │
├─────────────────────────────────────────────────────────────┤
│  CLI/API Interface                                          │
├─────────────────────────────────────────────────────────────┤
│  Orchestrator (Main Controller)                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Core Engine   │  │ Expert Council  │                   │
│  │                 │  │                 │                   │
│  │ • MetaController│  │ • Psychology    │                   │
│  │ • QAGenerator   │  │ • Linguistics   │                   │
│  │ • QualityAuditor│  │ • Domain Expert │                   │
│  │ • PromptArchitect│ │ • Cognitive Sci │                   │
│  └─────────────────┘  └─────────────────┘                   │
├─────────────────────────────────────────────────────────────┤
│  Shared Infrastructure                                      │
│  • Agent Registry  • Logger  • Error Handler  • Types     │
├─────────────────────────────────────────────────────────────┤
│  External Integrations                                     │
│  • Anthropic Claude  • LLM Adapters  • Cost Tracking     │
└─────────────────────────────────────────────────────────────┘
```

## Agent Orchestration Pattern

1. **Request Reception**: CLI/API receives QA generation request
2. **Complexity Analysis**: MetaController analyzes task complexity (1-10)
3. **Agent Selection**: Dynamic selection of 5-8 agents based on requirements
4. **Parallel Execution**: Agents work concurrently with shared memory
5. **Result Compilation**: Orchestrator extracts and formats Q&A pairs
6. **Quality Assessment**: Multi-level quality scoring and validation

## Data Flow Architecture

```
Input Request
     ↓
[Orchestrator] ← → [MetaController] (Strategy)
     ↓
[Agent Council] ← → [Shared Memory]
     ↓
[QA Generator] → [Quality Auditor]
     ↓
[Result Compilation]
     ↓
Formatted Output
```

## Error Handling Strategy

- **Graceful Degradation**: System continues if individual agents fail
- **Circuit Breaker**: Automatic fallback for repeated failures
- **Centralized Logging**: All errors logged with context
- **Type Safety**: TypeScript strict mode prevents runtime errors
