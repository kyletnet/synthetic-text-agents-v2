# Phase 2B Step 3: QA Feedback Loop + Plugin Integration

**Status**: Registered (Spec-only)
**Registration Date**: 2025-10-08
**Execution Trigger**: Phase 2B Step 3 착수 시 (`/refactor` 명령 또는 수동 시작)
**Base Commit**: aa340d4 (Phase 2B Step 2 완료)

---

## 목적

**Feedback Loop Core + Plugin Registry + Governance Bridge** 구축

현재 main 기준(aa340d4) 상태를 기반으로:

- Domain 계층 보호 (변경 금지)
- Application과 Infrastructure 계층에만 변경
- 안전 장치: Gate A–D, Regression Guard, Feature Matrix 정책 준수

---

## 실행 계획

### 1. 파일 생성/수정 목록

| 파일                                            | 작업          | 목적                             |
| ----------------------------------------------- | ------------- | -------------------------------- |
| `src/application/qa-feedback-manager.ts`        | **신규 생성** | Feedback Loop 핵심 로직          |
| `scripts/quality/orchestrator.ts`               | 수정          | Plugin Registry 확장             |
| `src/core/governance/kernel.ts`                 | 수정          | `evaluateExternalPolicy` 훅 추가 |
| `reports/metrics-drift.json`                    | **신규 생성** | 드리프트 감시                    |
| `configs/quality/feature-matrix.yml`            | 수정          | 플러그인 순차 활성 규칙          |
| `tests/application/qa-feedback-manager.test.ts` | **신규 생성** | 테스트                           |

### 2. QA Feedback Manager (핵심)

**역할**: Diversity Planner → Metrics → Governance 루프에 자동 피드백 추가

```typescript
// src/application/qa-feedback-manager.ts

import type { MetricsService } from "./metrics/metrics-service.js";
import type { DiversityPlannerService } from "./agents/diversity-planner-service.js";

export class QAFeedbackManager {
  constructor(
    private metricsService: MetricsService,
    private diversityPlanner: DiversityPlannerService,
    private config: FeedbackConfig,
  ) {}

  async runFeedbackLoop(): Promise<FeedbackResult> {
    // 1. Get current metrics
    const currentReport = await this.metricsService.getCurrentReport();

    // 2. Compare with baseline
    const baseline = await this.metricsService.getBaselineMetrics(
      "integration-base",
    );

    // 3. Detect drift
    const drift = this.detectDrift(currentReport, baseline);

    // 4. Generate diversity plan if drift detected
    if (drift.exceeded) {
      const plan = await this.diversityPlanner.createPlan(/*...*/);

      // 5. Record feedback to Governance
      await this.recordFeedback(drift, plan);
    }

    // 6. Return result
    return { drift, plan, adjustments };
  }

  private detectDrift(current, baseline): DriftResult {
    // Calculate drift for each metric
    // Use Feature Matrix thresholds
  }

  private async recordFeedback(drift, plan): Promise<void> {
    // Log to governance ledger
    // Update metrics-drift.json
  }
}
```

### 3. Plugin Registry (Orchestrator 확장)

**역할**: Advanced Checkers를 플러그인으로 등록/관리

```typescript
// scripts/quality/orchestrator.ts

export class QualityOrchestrator {
  private checkers: Map<string, QualityChecker> = new Map();
  private featureMatrix: FeatureMatrix;

  registerChecker(checker: QualityChecker): void {
    // Check Feature Matrix for conflicts
    const conflicts = this.featureMatrix.getConflicts(checker.name);

    if (conflicts.length > 0) {
      logger.warn(`Checker ${checker.name} conflicts with: ${conflicts}`);
      return;
    }

    // Register if enabled
    if (checker.enabled()) {
      this.checkers.set(checker.name, checker);
      logger.info(`Registered checker: ${checker.name}`);
    }
  }

  async runCheckers(qaItems: QAItem[]): Promise<QualityReport> {
    const results = [];

    // Run checkers in priority order (from Feature Matrix)
    for (const checker of this.getCheckersInPriorityOrder()) {
      const result = await checker.check(qaItems);
      results.push(result);

      // Record metrics
      await this.metricsService.recordAdvancedQualityMetrics({
        activeCheckers: [checker.name],
        costPerQA: result.cost,
        latencyMs: result.duration,
        errorRate: result.errorRate,
        // ...
      });
    }

    return { results, aggregated: this.aggregate(results) };
  }
}
```

### 4. Governance Kernel Hook

**역할**: 외부 정책 평가 훅 추가

```typescript
// src/core/governance/kernel.ts

export class GovernanceKernel {
  // ...existing code...

  /**
   * Evaluate external policy (Phase 2C 준비)
   *
   * 외부 문서/정책을 평가하고 Feature Flag로 등록
   */
  async evaluateExternalPolicy(
    policyDoc: ExternalPolicy,
  ): Promise<PolicyEvaluation> {
    // 1. Parse policy document
    const parsed = this.policyParser.parse(policyDoc);

    // 2. Validate against current governance rules
    const validation = await this.validatePolicy(parsed);

    if (!validation.safe) {
      return { approved: false, reason: validation.reason };
    }

    // 3. Create Feature Flag
    const flag = this.createFeatureFlag(parsed);

    // 4. Log to governance ledger
    await this.recordPolicyEvaluation(parsed, flag);

    return {
      approved: true,
      flag,
      recommendations: validation.recommendations,
    };
  }

  private async validatePolicy(policy): Promise<Validation> {
    // Check against Gate A-D
    // Check for conflicts with existing policies
    // Estimate cost/performance impact
  }
}
```

### 5. Metrics Drift Detection

**역할**: 품질 메트릭 드리프트 자동 감지

```json
// reports/metrics-drift.json

{
  "timestamp": "2025-10-08T05:30:00Z",
  "baseline_tag": "integration-base",
  "drift_threshold": 0.15,
  "current_metrics": {
    "entity_coverage": 0.85,
    "evidence_alignment": 0.75,
    "question_type_balance": 0.88
  },
  "baseline_metrics": {
    "entity_coverage": 0.0,
    "evidence_alignment": 0.179,
    "question_type_balance": 0.0
  },
  "drift_detected": [
    {
      "metric": "evidence_alignment",
      "drift": 0.571,
      "threshold": 0.15,
      "exceeded": true,
      "direction": "improvement",
      "action": "none"
    }
  ],
  "auto_actions": []
}
```

---

## 안전 메커니즘

### Feature Flags (기본 OFF)

```yaml
# configs/quality/feature-matrix.yml (추가)

feedback_loop:
  enabled: false
  canary_percentage: 10
  auto_adjustment: false
  drift_threshold: 0.15

plugin_registry:
  enabled: false
  max_concurrent_plugins: 1
  auto_registration: false
```

### Regression Guard Integration

- **Gate C (Stability)**: Drift 감지 시 자동 경고
- **Gate D (Budget)**: 비용 초과 시 auto-disable
- **Gate B (Autonomy)**: Feedback Loop 무한 루프 방지

### Fallback Mechanism

```typescript
// QA Feedback Manager fallback

if (feedbackLoopFailed) {
  logger.warn("Feedback loop failed, using manual mode");
  return await this.manualQualityCheck(qaItems);
}
```

---

## 실행 조건

### Prerequisites

- ✅ Phase 2B Step 2 완료 (Metrics Refactoring)
- ✅ Integration Brief 등록 (RFC 2024-10)
- ✅ Feature Matrix 정의
- ✅ Metrics Port V1 안정화

### Execution Triggers

1. **수동 시작**: `npm run phase2b:step3`
2. **자동 시작**: `/refactor` 명령 (Cursor/Claude Code)
3. **조건부 시작**: Health Score ≥80 AND RG All Gates PASS

### Success Criteria

- ✅ QA Feedback Manager 구현 (6+ tests passing)
- ✅ Plugin Registry 작동 (1개 이상 checker 등록)
- ✅ Governance Kernel hook 추가
- ✅ Metrics drift detection 작동
- ✅ Baseline: `reports/baseline-phase2b-step3.json` 생성
- ✅ RG All Gates PASS (성능 회귀 <15%)

---

## Timeline

| Step | 작업                     | 예상 시간 | 산출물                   |
| ---- | ------------------------ | --------- | ------------------------ |
| 1    | QA Feedback Manager 구현 | 1-2h      | `qa-feedback-manager.ts` |
| 2    | Plugin Registry 확장     | 1h        | `orchestrator.ts` 수정   |
| 3    | Governance Kernel hook   | 1h        | `kernel.ts` 수정         |
| 4    | Metrics Drift Detection  | 30m       | `metrics-drift.json`     |
| 5    | 테스트 작성              | 1h        | 6+ tests                 |
| 6    | 통합 검증 + Baseline     | 30m       | RG PASS + baseline       |

**Total**: 4-6 hours

---

## Governance 통합

### Event Logging

```typescript
// Governance events to log

{
  "type": "qa_feedback_loop_registered",
  "timestamp": "2025-10-08T...",
  "enabled": false,
  "canary_percentage": 10
}

{
  "type": "plugin_registered",
  "timestamp": "2025-10-08T...",
  "plugin_name": "hybrid_search",
  "conflicts": [],
  "enabled": true
}

{
  "type": "metrics_drift_detected",
  "timestamp": "2025-10-08T...",
  "metric": "evidence_alignment",
  "drift": 0.571,
  "action": "none"
}
```

### Policy Updates

```yaml
# governance-rules.yaml (추가)

feedback_loop_policy:
  name: "Feedback Loop Auto-Adjustment"
  enabled: false
  conditions:
    - drift > 0.15
    - health_score >= 80
  actions:
    - log_to_governance
    - create_diversity_plan
    - adjust_thresholds (manual approval)
```

---

## Post-Execution

### Verification Steps

1. **Commit 확인**:

   ```bash
   git log -1 --oneline
   # Expected: "feat: Phase 2B Step 3 - QA Feedback Loop + Plugin Integration"
   ```

2. **Health Check**:

   ```bash
   npm run status
   # Expected: Health Score ≥80
   ```

3. **Regression Guard**:

   ```bash
   npm run rg:run
   # Expected: All Gates PASS
   ```

4. **Baseline**:
   ```bash
   ls reports/baseline-phase2b-step3.json
   # Expected: File exists
   ```

### Next Phase

**Phase 2C**: Policy Parser + Interpreter + Sandbox

- 외부 문서 자동 해석
- Policy DSL 구현
- Sandbox 검증 환경

---

## Notes

- ✅ **Spec-only**: 이 문서는 실행 계획만 등록 (즉시 실행 안 함)
- ✅ **Feature Flags**: 모든 새 기능은 기본 OFF
- ✅ **Domain 보호**: Domain 계층 변경 금지
- ✅ **Governance 우선**: Gate A-D 자동 감시
- ✅ **Rollback 준비**: Feature Flag OFF로 즉시 복구 가능

---

**등록 모드**: Spec-only (Phase 2B Step 3 시작 시 적용)
**Feature Flags**: 기본 OFF, Canary 10% 활성
**Governance 로그**: "qa_feedback_loop_registered"

**작성자**: Claude Code
**검토자**: Architecture Team
**참고**: GPT advice on "spec-only registration" strategy
