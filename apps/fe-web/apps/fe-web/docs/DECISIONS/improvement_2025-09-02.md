# Improvement Plan — 2025-09-02 2025-09-02T04:35:03.030Z

## Top-3 Failed (K=3)
```json
{
  "runTs": "2025-09-02T04:35:03.030Z",
  "topKFailed": [
    {
      "id": "sample-001",
      "status": "failed",
      "score": 6.1,
      "latencyMs": 1777,
      "issues": [
        "hallucination",
        "too_easy"
      ]
    },
    {
      "id": "sample-002",
      "status": "failed",
      "score": 7.1,
      "latencyMs": 2117,
      "issues": [
        "hallucination",
        "too_easy"
      ]
    },
    {
      "id": "sample-003",
      "status": "vetoed",
      "score": 8.2,
      "latencyMs": 2521,
      "issues": [
        "hallucination",
        "too_easy",
        "format_issue"
      ]
    }
  ]
}
```

## Agent Summoning Plan
```json
{
  "plan": [
    {
      "sampleId": "sample-001",
      "issues": [
        "hallucination",
        "too_easy"
      ],
      "modules": [
        "FactChecker",
        "DifficultyTuner"
      ],
      "actions": [
        "verify sources",
        "add citations",
        "re-answer",
        "raise constraints",
        "increase complexity"
      ]
    },
    {
      "sampleId": "sample-002",
      "issues": [
        "hallucination",
        "too_easy"
      ],
      "modules": [
        "FactChecker",
        "DifficultyTuner"
      ],
      "actions": [
        "verify sources",
        "add citations",
        "re-answer",
        "raise constraints",
        "increase complexity"
      ]
    },
    {
      "sampleId": "sample-003",
      "issues": [
        "hallucination",
        "too_easy",
        "format_issue"
      ],
      "modules": [
        "FactChecker",
        "DifficultyTuner",
        "Formatter"
      ],
      "actions": [
        "verify sources",
        "add citations",
        "re-answer",
        "raise constraints",
        "increase complexity",
        "apply schema",
        "fix formatting",
        "validate output"
      ]
    }
  ]
}
```

---
