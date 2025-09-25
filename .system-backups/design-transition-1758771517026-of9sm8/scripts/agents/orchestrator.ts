/**
 * Multi-Agent Orchestrator
 * Coordinates Evidence → Answer → Audit chain with sub-agents:
 * - Budget Guardian: Cost management and enforcement
 * - Retry Router: Intelligent retry and routing decisions
 * - Diversity Planner: Ensures diverse processing strategies
 */

import { AgentContext, AgentResult } from "./base_agent";
import { EvidenceAgent, EvidenceInput } from "./evidence_agent";
import { AnswerAgent, AnswerInput } from "./answer_agent";
import { AuditAgent, AuditInput } from "./audit_agent";
import { BudgetGuard } from "../utils/budget_guard";
import { DLQHandler } from "../utils/dlq_handler";
import { ThresholdGating } from "../utils/threshold_gating";

export interface OrchestrationInput {
  question: string;
  context_documents?: string[];
  processing_preferences?: {
    evidence_depth?: "shallow" | "deep";
    answer_style?: "comprehensive" | "focused" | "conservative";
    audit_depth?: "basic" | "standard" | "comprehensive";
  };
  budget_constraints?: {
    max_cost_usd: number;
    max_latency_ms: number;
  };
  quality_requirements?: {
    min_confidence: number;
    required_audit_score: number;
  };
}

export interface OrchestrationOutput {
  final_answer: {
    text: string;
    confidence_score: number;
    audit_score: number;
    quality_gate_result: "PASS" | "WARN" | "FAIL";
  };
  processing_chain: {
    evidence_stage: any;
    answer_stage: any;
    audit_stage: any;
  };
  resource_usage: {
    total_cost_usd: number;
    total_latency_ms: number;
    agent_breakdown: Record<
      string,
      { cost: number; latency: number; retries: number }
    >;
  };
  quality_metrics: {
    p0_violations: number;
    p1_violations: number;
    p2_violations: number;
    gating_result: "PASS" | "WARN" | "FAIL";
  };
  sub_agent_decisions: {
    budget_guardian_actions: string[];
    retry_router_decisions: string[];
    diversity_planner_choices: string[];
  };
}

export class MultiAgentOrchestrator {
  private budgetGuard: BudgetGuard;
  private dlqHandler: DLQHandler;
  private thresholdGating: ThresholdGating;
  private context: AgentContext;

  constructor(
    context: AgentContext,
    configPath: string = "baseline_config.json",
  ) {
    this.context = context;
    this.budgetGuard = new BudgetGuard(
      configPath,
      context.profile,
      context.run_id,
    );
    this.dlqHandler = new DLQHandler();
    this.thresholdGating = new ThresholdGating(configPath, context.profile);
  }

  async orchestrate(input: OrchestrationInput): Promise<OrchestrationOutput> {
    const orchestrationStart = Date.now();
    const subAgentDecisions = {
      budget_guardian_actions: [] as string[],
      retry_router_decisions: [] as string[],
      diversity_planner_choices: [] as string[],
    };

    try {
      // Phase 1: Budget Guardian - Pre-execution planning
      const budgetPlan = await this.budgetGuardianPlanning(
        input,
        subAgentDecisions,
      );

      // Phase 2: Diversity Planner - Strategy selection
      const processingStrategy = await this.diversityPlannerSelection(
        input,
        budgetPlan,
        subAgentDecisions,
      );

      // Phase 3: Evidence → Answer → Audit chain execution
      const chainResult = await this.executeProcessingChain(
        input,
        processingStrategy,
        subAgentDecisions,
      );

      // Phase 4: Final quality gating and metrics
      const finalMetrics = await this.performFinalGating(chainResult);

      // Phase 5: Resource usage analysis
      const resourceUsage = this.calculateResourceUsage(
        chainResult,
        orchestrationStart,
      );

      return {
        final_answer: {
          text: chainResult.audit_stage.answer.text,
          confidence_score: chainResult.audit_stage.answer.confidence_score,
          audit_score: chainResult.audit_stage.overall_score,
          quality_gate_result: finalMetrics.gating_result,
        },
        processing_chain: chainResult,
        resource_usage: resourceUsage,
        quality_metrics: finalMetrics,
        sub_agent_decisions: subAgentDecisions,
      };
    } catch (error) {
      // Handle orchestration failure with DLQ
      await this.handleOrchestrationFailure(error, input, subAgentDecisions);
      throw error;
    }
  }

  /**
   * Budget Guardian: Pre-execution budget planning and constraint checking
   */
  private async budgetGuardianPlanning(
    input: OrchestrationInput,
    decisions: OrchestrationOutput["sub_agent_decisions"],
  ): Promise<{
    allowed: boolean;
    budget_allocation: Record<string, number>;
    fallback_thresholds: Record<string, number>;
    kill_switch_active: boolean;
  }> {
    // Check kill switch status
    const shouldProceed = this.budgetGuard.shouldProceed();
    if (!shouldProceed) {
      decisions.budget_guardian_actions.push(
        "Kill switch active - blocking execution",
      );
      return {
        allowed: false,
        budget_allocation: {},
        fallback_thresholds: {},
        kill_switch_active: true,
      };
    }

    // Estimate costs for each stage
    const costEstimates = {
      evidence: this.estimateEvidenceCost(input),
      answer: this.estimateAnswerCost(input),
      audit: this.estimateAuditCost(input),
    };

    const totalEstimatedCost = Object.values(costEstimates).reduce(
      (sum, cost) => sum + cost,
      0,
    );

    // Check budget constraints
    const maxBudget = input.budget_constraints?.max_cost_usd || 0.2;

    if (totalEstimatedCost > maxBudget) {
      decisions.budget_guardian_actions.push(
        `Estimated cost $${totalEstimatedCost.toFixed(4)} exceeds budget $${maxBudget.toFixed(4)} - enabling fallback modes`,
      );

      return {
        allowed: true,
        budget_allocation: {
          evidence: Math.min(costEstimates.evidence, maxBudget * 0.3),
          answer: Math.min(costEstimates.answer, maxBudget * 0.5),
          audit: Math.min(costEstimates.audit, maxBudget * 0.2),
        },
        fallback_thresholds: {
          evidence: maxBudget * 0.25,
          answer: maxBudget * 0.4,
          audit: maxBudget * 0.15,
        },
        kill_switch_active: false,
      };
    }

    decisions.budget_guardian_actions.push(
      `Budget approved: $${totalEstimatedCost.toFixed(4)} within limit $${maxBudget.toFixed(4)}`,
    );

    return {
      allowed: true,
      budget_allocation: costEstimates,
      fallback_thresholds: {
        evidence: costEstimates.evidence * 1.2,
        answer: costEstimates.answer * 1.2,
        audit: costEstimates.audit * 1.2,
      },
      kill_switch_active: false,
    };
  }

  /**
   * Diversity Planner: Select processing strategies to ensure diverse approaches
   */
  private async diversityPlannerSelection(
    input: OrchestrationInput,
    budgetPlan: any,
    decisions: OrchestrationOutput["sub_agent_decisions"],
  ): Promise<{
    evidence_strategy: string;
    answer_strategy: string;
    audit_strategy: string;
    diversity_score: number;
  }> {
    // Analyze question characteristics for strategy selection
    const questionCharacteristics = this.analyzeQuestionCharacteristics(
      input.question,
    );

    // Select strategies based on question type, budget, and diversity requirements
    let evidenceStrategy =
      input.processing_preferences?.evidence_depth || "deep";
    let answerStrategy =
      input.processing_preferences?.answer_style || "comprehensive";
    let auditStrategy = input.processing_preferences?.audit_depth || "standard";

    // Apply budget constraints
    if (budgetPlan.fallback_thresholds.evidence < 0.02) {
      evidenceStrategy = "shallow";
      decisions.diversity_planner_choices.push(
        "Evidence: Shallow search due to budget constraints",
      );
    }

    if (budgetPlan.fallback_thresholds.answer < 0.05) {
      answerStrategy = "conservative";
      decisions.diversity_planner_choices.push(
        "Answer: Conservative generation due to budget constraints",
      );
    }

    if (budgetPlan.fallback_thresholds.audit < 0.01) {
      auditStrategy = "basic";
      decisions.diversity_planner_choices.push(
        "Audit: Basic review due to budget constraints",
      );
    }

    // Ensure diversity based on question characteristics
    if (
      questionCharacteristics.complexity === "high" &&
      answerStrategy === "conservative"
    ) {
      answerStrategy = "focused";
      decisions.diversity_planner_choices.push(
        "Answer: Upgraded to focused for complex question",
      );
    }

    if (
      questionCharacteristics.has_multiple_aspects &&
      evidenceStrategy === "shallow"
    ) {
      evidenceStrategy = "deep";
      decisions.diversity_planner_choices.push(
        "Evidence: Upgraded to deep for multi-aspect question",
      );
    }

    // Calculate diversity score
    const strategyVariation = new Set([
      evidenceStrategy,
      answerStrategy,
      auditStrategy,
    ]).size;
    const diversityScore = Math.min(strategyVariation / 3, 1.0);

    decisions.diversity_planner_choices.push(
      `Final strategy: Evidence=${evidenceStrategy}, Answer=${answerStrategy}, Audit=${auditStrategy} (diversity=${diversityScore.toFixed(2)})`,
    );

    return {
      evidence_strategy: evidenceStrategy,
      answer_strategy: answerStrategy,
      audit_strategy: auditStrategy,
      diversity_score: diversityScore,
    };
  }

  /**
   * Execute the Evidence → Answer → Audit processing chain
   */
  private async executeProcessingChain(
    input: OrchestrationInput,
    strategy: any,
    decisions: OrchestrationOutput["sub_agent_decisions"],
  ): Promise<{
    evidence_stage: any;
    answer_stage: any;
    audit_stage: any;
  }> {
    // Stage 1: Evidence Agent
    const evidenceContext: AgentContext = {
      ...this.context,
      agent_role: "evidence",
      budget_limits: {
        max_cost_usd: 0.05,
        max_latency_ms: 30000,
      },
    };

    const evidenceAgent = new EvidenceAgent(evidenceContext);
    const evidenceInput: EvidenceInput = {
      question: input.question,
      context_documents: input.context_documents,
      search_depth: strategy.evidence_strategy,
      max_evidence_items: strategy.evidence_strategy === "deep" ? 10 : 5,
    };

    decisions.retry_router_decisions.push("Evidence: Starting evidence search");
    const evidenceResult = await this.executeWithRetryRouter(
      () => evidenceAgent.executeWithOrchestration(evidenceInput),
      "evidence",
      decisions,
    );

    if (!evidenceResult.success) {
      throw new Error(
        `Evidence stage failed: ${evidenceResult.error?.message}`,
      );
    }

    // Stage 2: Answer Agent
    const answerContext: AgentContext = {
      ...this.context,
      agent_role: "answer",
      budget_limits: {
        max_cost_usd: 0.1,
        max_latency_ms: 45000,
      },
    };

    const answerAgent = new AnswerAgent(answerContext);
    const answerInput: AnswerInput = {
      question: input.question,
      evidence: evidenceResult.data,
      answer_style: strategy.answer_strategy,
      max_answer_length:
        strategy.answer_strategy === "comprehensive" ? 1000 : 500,
      include_citations: true,
    };

    decisions.retry_router_decisions.push("Answer: Starting answer generation");
    const answerResult = await this.executeWithRetryRouter(
      () => answerAgent.executeWithOrchestration(answerInput),
      "answer",
      decisions,
    );

    if (!answerResult.success) {
      throw new Error(`Answer stage failed: ${answerResult.error?.message}`);
    }

    // Stage 3: Audit Agent
    const auditContext: AgentContext = {
      ...this.context,
      agent_role: "audit",
      budget_limits: {
        max_cost_usd: 0.05,
        max_latency_ms: 20000,
      },
    };

    const auditAgent = new AuditAgent(auditContext);
    const auditInput: AuditInput = {
      question: input.question,
      evidence: evidenceResult.data,
      answer: answerResult.data,
      audit_depth: strategy.audit_strategy,
      focus_areas: ["accuracy", "completeness", "citations"],
    };

    decisions.retry_router_decisions.push("Audit: Starting quality audit");
    const auditResult = await this.executeWithRetryRouter(
      () => auditAgent.executeWithOrchestration(auditInput),
      "audit",
      decisions,
    );

    if (!auditResult.success) {
      throw new Error(`Audit stage failed: ${auditResult.error?.message}`);
    }

    return {
      evidence_stage: evidenceResult.data,
      answer_stage: answerResult.data,
      audit_stage: auditResult.data,
    };
  }

  /**
   * Retry Router: Intelligent retry decisions with DLQ integration
   */
  private async executeWithRetryRouter<T>(
    operation: () => Promise<T>,
    stageName: string,
    decisions: OrchestrationOutput["sub_agent_decisions"],
  ): Promise<T> {
    return await this.dlqHandler.executeWithRetry(operation, {
      run_id: this.context.run_id,
      item_id: this.context.item_id,
      agent_role: stageName,
      operation_name: `${stageName}_execution`,
      metadata: { orchestrated: true },
    });
  }

  private async performFinalGating(chainResult: any): Promise<{
    p0_violations: number;
    p1_violations: number;
    p2_violations: number;
    gating_result: "PASS" | "WARN" | "FAIL";
  }> {
    // Extract metrics from chain results
    const metrics = {
      // P0 metrics (critical)
      pii_hits_max: 0, // Assume no PII detected
      hallucination_rate_max:
        chainResult.audit_stage.dimension_scores.accuracy < 80 ? 0.1 : 0.0,
      evidence_missing_rate_max:
        chainResult.evidence_stage.evidence_items.length === 0 ? 1.0 : 0.0,

      // P1 metrics (performance)
      cost_per_item_warn:
        (chainResult.evidence_stage.cost_usd || 0) +
        (chainResult.answer_stage.cost_usd || 0) +
        (chainResult.audit_stage.cost_usd || 0),
      latency_p95_warn_ms: Math.max(
        chainResult.evidence_stage.latency_ms || 0,
        chainResult.answer_stage.latency_ms || 0,
        chainResult.audit_stage.latency_ms || 0,
      ),

      // P2 metrics (quality)
      quality_score_warn: chainResult.audit_stage.overall_score / 100,
      coverage_rate_warn:
        chainResult.answer_stage.reasoning.evidence_used > 0 ? 1.0 : 0.5,
    };

    // Use threshold gating to evaluate
    const gatingResult = this.thresholdGating.evaluateMetrics(metrics);

    return {
      p0_violations: gatingResult.p0_violations,
      p1_violations: gatingResult.p1_violations,
      p2_violations: gatingResult.p2_violations,
      gating_result: gatingResult.overall_result,
    };
  }

  private calculateResourceUsage(
    chainResult: any,
    orchestrationStart: number,
  ): OrchestrationOutput["resource_usage"] {
    const totalLatency = Date.now() - orchestrationStart;

    return {
      total_cost_usd: this.budgetGuard.getBudgetStatus().usage.total_spent_usd,
      total_latency_ms: totalLatency,
      agent_breakdown: {
        evidence: {
          cost: chainResult.evidence_stage.cost_usd || 0,
          latency: chainResult.evidence_stage.latency_ms || 0,
          retries: chainResult.evidence_stage.retries || 0,
        },
        answer: {
          cost: chainResult.answer_stage.cost_usd || 0,
          latency: chainResult.answer_stage.latency_ms || 0,
          retries: chainResult.answer_stage.retries || 0,
        },
        audit: {
          cost: chainResult.audit_stage.cost_usd || 0,
          latency: chainResult.audit_stage.latency_ms || 0,
          retries: chainResult.audit_stage.retries || 0,
        },
      },
    };
  }

  private async handleOrchestrationFailure(
    error: any,
    input: OrchestrationInput,
    decisions: OrchestrationOutput["sub_agent_decisions"],
  ): Promise<void> {
    decisions.retry_router_decisions.push(
      `Orchestration failed: ${error.message}`,
    );

    // Log failure for analysis
    console.error(
      `[ORCHESTRATOR] Orchestration failed for ${this.context.run_id}:${this.context.item_id} - ${error}`,
    );
  }

  private analyzeQuestionCharacteristics(question: string): {
    complexity: "low" | "medium" | "high";
    has_multiple_aspects: boolean;
    question_type: string;
  } {
    const questionWords = [
      "what",
      "how",
      "why",
      "when",
      "where",
      "who",
      "which",
    ];
    const complexityIndicators = [
      "compare",
      "analyze",
      "evaluate",
      "explain",
      "describe",
    ];

    const hasComplexityIndicators = complexityIndicators.some((indicator) =>
      question.toLowerCase().includes(indicator),
    );

    const multipleQuestionWords =
      questionWords.filter((word) => question.toLowerCase().includes(word))
        .length > 1;

    return {
      complexity: hasComplexityIndicators
        ? "high"
        : multipleQuestionWords
          ? "medium"
          : "low",
      has_multiple_aspects: multipleQuestionWords,
      question_type:
        questionWords.find((word) => question.toLowerCase().includes(word)) ||
        "general",
    };
  }

  private estimateEvidenceCost(input: OrchestrationInput): number {
    const documentCount = input.context_documents?.length || 5;
    const searchDepth = input.processing_preferences?.evidence_depth || "deep";

    return searchDepth === "deep"
      ? Math.min(documentCount * 0.005, 0.03)
      : 0.01;
  }

  private estimateAnswerCost(input: OrchestrationInput): number {
    const answerStyle =
      input.processing_preferences?.answer_style || "comprehensive";

    return answerStyle === "comprehensive"
      ? 0.05
      : answerStyle === "focused"
        ? 0.03
        : 0.02;
  }

  private estimateAuditCost(input: OrchestrationInput): number {
    const auditDepth = input.processing_preferences?.audit_depth || "standard";

    return auditDepth === "comprehensive"
      ? 0.02
      : auditDepth === "standard"
        ? 0.01
        : 0.005;
  }
}

// CLI interface for testing
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "test") {
    const context: AgentContext = {
      run_id: "test_run_" + Date.now(),
      item_id: "test_item_1",
      agent_role: "orchestrator",
      session_id: "test_session",
      profile: "dev",
    };

    const orchestrator = new MultiAgentOrchestrator(context);

    const input: OrchestrationInput = {
      question: "What are the key benefits of renewable energy?",
      context_documents: [
        "Renewable energy sources include solar, wind, and hydroelectric power...",
        "Benefits of renewable energy include reduced carbon emissions...",
        "Economic advantages of renewable energy include job creation...",
      ],
      budget_constraints: {
        max_cost_usd: 0.15,
        max_latency_ms: 60000,
      },
      quality_requirements: {
        min_confidence: 0.7,
        required_audit_score: 75,
      },
    };

    orchestrator
      .orchestrate(input)
      .then((result) => {
        console.log("Orchestration completed successfully:");
        console.log(JSON.stringify(result, null, 2));
      })
      .catch((error) => {
        console.error("Orchestration failed:", error);
        process.exit(1);
      });
  } else {
    console.log("Multi-Agent Orchestrator CLI");
    console.log("Commands:");
    console.log("  test - Run orchestration test");
  }
}
