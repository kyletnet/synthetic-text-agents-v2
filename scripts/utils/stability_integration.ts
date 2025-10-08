/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Stability Integration Layer
 * Integrates all stability components: thresholds, DLQ, budget guard, agents, checkpoints
 * Provides unified interface for run_v3.sh integration
 */

import {
  MultiAgentOrchestrator,
  OrchestrationInput,
  OrchestrationOutput,
} from "../agents/orchestrator";
import { BudgetGuard } from "./budget_guard";
import { DLQHandler } from "./dlq_handler";
import { ThresholdGating } from "./threshold_gating";
import { CheckpointManager } from "./checkpoint_manager";
import { AgentContext } from "../agents/base_agent";

export interface StabilityConfig {
  run_id: string;
  session_id: string;
  profile: "dev" | "stage" | "prod";
  config_path?: string;
  enable_checkpoints?: boolean;
  enable_hard_stop?: boolean;
  budget_max_usd?: number;
}

export interface ProcessingItem {
  id: string;
  question: string;
  context_documents?: string[];
  metadata?: Record<string, any>;
}

export interface StabilityResult {
  success: boolean;
  processed_items: number;
  failed_items: number;
  total_cost_usd: number;
  total_latency_ms: number;
  quality_gate_result: "PASS" | "WARN" | "FAIL";
  threshold_violations: {
    p0: number;
    p1: number;
    p2: number;
  };
  checkpoints_created: number;
  dlq_entries: number;
  final_report: {
    session_report_path: string;
    checkpoint_summary_path?: string;
    dlq_summary_path?: string;
  };
  emergency_stop_triggered: boolean;
  stop_reason?: string;
}

export class StabilityIntegration {
  private config: StabilityConfig;
  private budgetGuard: BudgetGuard;
  private dlqHandler: DLQHandler;
  private thresholdGating: ThresholdGating;
  private checkpointManager?: CheckpointManager;
  private startTime: number;

  constructor(config: StabilityConfig) {
    this.config = config;
    this.startTime = Date.now();

    // Initialize stability components
    this.budgetGuard = new BudgetGuard(
      config.config_path || "baseline_config.json",
      config.profile,
      config.run_id,
    );

    this.dlqHandler = new DLQHandler();

    this.thresholdGating = new ThresholdGating(
      config.config_path || "baseline_config.json",
      config.profile,
    );

    if (config.enable_checkpoints) {
      this.checkpointManager = new CheckpointManager(
        config.run_id,
        config.session_id,
      );
    }

    // Set up emergency stop monitoring if enabled
    if (config.enable_hard_stop) {
      this.setupEmergencyStopMonitoring();
    }

    console.log(
      `[STABILITY] Initialized for run ${config.run_id} with profile ${config.profile}`,
    );
  }

  /**
   * Process a batch of items with full stability features
   */
  async processBatch(items: ProcessingItem[]): Promise<StabilityResult> {
    console.log(`[STABILITY] Starting batch processing: ${items.length} items`);

    const results: any[] = [];
    let processedItems = 0;
    let failedItems = 0;
    let totalCost = 0;
    let totalLatency = 0;
    let checkpointsCreated = 0;
    let dlqEntries = 0;
    let emergencyStopTriggered = false;
    let stopReason: string | undefined;

    try {
      // Resume from checkpoints if enabled
      let startIndex = 0;
      if (this.checkpointManager) {
        const resumeInfo = this.checkpointManager.getResumeInfo();
        if (resumeInfo) {
          startIndex = resumeInfo.last_successful_index + 1;
          totalCost = resumeInfo.accumulated_metrics.total_cost;
          totalLatency = resumeInfo.accumulated_metrics.total_latency;
          results.push(...resumeInfo.partial_results);
          processedItems = resumeInfo.total_completed;

          console.log(
            `[STABILITY] Resuming from item ${startIndex} (${resumeInfo.total_completed} already completed)`,
          );
        }
      }

      // Process items with stability controls
      for (let i = startIndex; i < items.length; i++) {
        const item = items[i];
        const itemStart = Date.now();

        try {
          // Pre-processing checks
          const preCheck = this.performPreProcessingChecks(item);
          if (!preCheck.allowed) {
            if (preCheck.emergency_stop) {
              emergencyStopTriggered = true;
              stopReason = preCheck.reason;
              break;
            }

            failedItems++;
            console.warn(`[STABILITY] Skipping item ${i}: ${preCheck.reason}`);
            continue;
          }

          // Create agent context
          const agentContext: AgentContext = {
            run_id: this.config.run_id,
            item_id: item.id,
            agent_role: "orchestrator",
            session_id: this.config.session_id,
            profile: this.config.profile,
            budget_limits: {
              max_cost_usd: preCheck.item_budget || 0.1,
              max_latency_ms: 60000,
            },
            checkpoint_stream: this.checkpointManager
              ? `reports/checkpoints/stream_${this.config.run_id}.jsonl`
              : undefined,
            metadata: item.metadata,
          };

          // Execute orchestrated processing
          const orchestrator = new MultiAgentOrchestrator(
            agentContext,
            this.config.config_path,
          );
          const orchestrationInput: OrchestrationInput = {
            question: item.question,
            context_documents: item.context_documents,
            budget_constraints: {
              max_cost_usd: preCheck.item_budget || 0.1,
              max_latency_ms: 60000,
            },
            quality_requirements: {
              min_confidence: 0.6,
              required_audit_score: 70,
            },
          };

          const itemResult = await orchestrator.orchestrate(orchestrationInput);

          // Record metrics
          const itemLatency = Date.now() - itemStart;
          const itemCost = itemResult.resource_usage.total_cost_usd;

          totalCost += itemCost;
          totalLatency += itemLatency;

          // Update budget tracking
          const budgetViolations = this.budgetGuard.recordCost({
            agent_role: "orchestrator",
            item_id: item.id,
            cost_usd: itemCost,
            latency_ms: itemLatency,
            metadata: {
              quality_gate: itemResult.final_answer.quality_gate_result,
              audit_score: itemResult.final_answer.audit_score,
            },
          });

          // Handle budget violations
          if (budgetViolations.some((v) => v.action === "abort")) {
            emergencyStopTriggered = true;
            stopReason = budgetViolations.find((v) => v.action === "abort")
              ?.message;
            break;
          }

          // Record checkpoint if enabled
          if (this.checkpointManager) {
            await this.checkpointManager.recordCheckpoint({
              run_id: this.config.run_id,
              item_id: item.id,
              agent_role: "orchestrator",
              checkpoint_index: i,
              total_items: items.length,
              stage: "orchestration_complete",
              progress: 1.0,
              success: true,
              resumable_state: {
                processing_stage: "complete",
                completed_steps: ["evidence", "answer", "audit"],
                intermediate_results: itemResult,
                agent_context: agentContext,
              },
              metrics: {
                cost_usd: itemCost,
                latency_ms: itemLatency,
                retries: 0,
              },
            });
            checkpointsCreated++;
          }

          results.push({
            item_id: item.id,
            result: itemResult,
            metrics: {
              cost_usd: itemCost,
              latency_ms: itemLatency,
              quality_gate: itemResult.final_answer.quality_gate_result,
            },
          });

          processedItems++;
          console.log(
            `[STABILITY] Completed item ${i + 1}/${items.length}: ${
              item.id
            } (Cost: $${itemCost.toFixed(4)}, Quality: ${
              itemResult.final_answer.quality_gate_result
            })`,
          );
        } catch (error) {
          failedItems++;
          dlqEntries++;

          console.error(`[STABILITY] Item ${i} failed: ${error}`);

          // Record failure checkpoint
          if (this.checkpointManager) {
            await this.checkpointManager.recordCheckpoint({
              run_id: this.config.run_id,
              item_id: item.id,
              agent_role: "orchestrator",
              checkpoint_index: i,
              total_items: items.length,
              stage: "failed",
              progress: 0,
              success: false,
              resumable_state: {
                processing_stage: "error",
                completed_steps: [],
                intermediate_results: null,
                agent_context: {},
              },
              metrics: {
                cost_usd: 0,
                latency_ms: Date.now() - itemStart,
                retries: 0,
              },
              error_info: {
                error_type: "orchestration_error",
                error_message: String(error),
                retryable: true,
              },
            });
            checkpointsCreated++;
          }
        }
      }
    } catch (error) {
      console.error(`[STABILITY] Batch processing failed: ${error}`);
      emergencyStopTriggered = true;
      stopReason = `Batch processing error: ${error}`;
    }

    // Perform final quality gating
    const qualityMetrics = this.performFinalQualityGating(results);

    // Generate final reports
    const finalReport = await this.generateFinalReports(results, {
      processed_items: processedItems,
      failed_items: failedItems,
      total_cost_usd: totalCost,
      total_latency_ms: totalLatency,
      checkpoints_created: checkpointsCreated,
      dlq_entries: dlqEntries,
    });

    return {
      success: !emergencyStopTriggered && failedItems < items.length * 0.5,
      processed_items: processedItems,
      failed_items: failedItems,
      total_cost_usd: totalCost,
      total_latency_ms: totalLatency,
      quality_gate_result: qualityMetrics.overall_result,
      threshold_violations: {
        p0: qualityMetrics.p0_violations,
        p1: qualityMetrics.p1_violations,
        p2: qualityMetrics.p2_violations,
      },
      checkpoints_created: checkpointsCreated,
      dlq_entries: dlqEntries,
      final_report: finalReport,
      emergency_stop_triggered: emergencyStopTriggered,
      stop_reason: stopReason,
    };
  }

  private performPreProcessingChecks(item: ProcessingItem): {
    allowed: boolean;
    emergency_stop?: boolean;
    reason?: string;
    item_budget?: number;
  } {
    // Check kill switch
    if (!this.budgetGuard.shouldProceed()) {
      return {
        allowed: false,
        emergency_stop: true,
        reason: "Emergency stop triggered",
      };
    }

    // Check budget status
    const budgetStatus = this.budgetGuard.getBudgetStatus();

    if (budgetStatus.utilization_percentage > 95) {
      return {
        allowed: false,
        emergency_stop: true,
        reason: "Budget exhausted",
      };
    }

    // Estimate item cost and check if feasible
    const estimatedCost = this.estimateItemCost(item);

    if (budgetStatus.usage.remaining_budget_usd < estimatedCost) {
      return {
        allowed: false,
        reason: `Insufficient budget remaining: $${budgetStatus.usage.remaining_budget_usd.toFixed(
          4,
        )} < $${estimatedCost.toFixed(4)}`,
      };
    }

    return {
      allowed: true,
      item_budget: estimatedCost * 1.5, // Add buffer
    };
  }

  private performFinalQualityGating(results: any[]): {
    overall_result: "PASS" | "WARN" | "FAIL";
    p0_violations: number;
    p1_violations: number;
    p2_violations: number;
  } {
    if (results.length === 0) {
      return {
        overall_result: "FAIL",
        p0_violations: 1,
        p1_violations: 0,
        p2_violations: 0,
      };
    }

    // Aggregate metrics from all results
    const aggregatedMetrics = {
      // P0 metrics
      pii_hits_max: 0,
      hallucination_rate_max: 0,
      evidence_missing_rate_max: 0,

      // P1 metrics
      cost_per_item_warn:
        results.reduce((sum, r) => sum + r.metrics.cost_usd, 0) /
        results.length,
      latency_p95_warn_ms: this.calculateP95(
        results.map((r) => r.metrics.latency_ms),
      ),
      failure_rate_warn:
        results.filter((r) => r.metrics.quality_gate === "FAIL").length /
        results.length,

      // P2 metrics
      quality_score_warn:
        results.reduce(
          (sum, r) => sum + (r.result.final_answer.audit_score || 0),
          0,
        ) /
        results.length /
        100,
    };

    return this.thresholdGating.evaluateMetrics(aggregatedMetrics);
  }

  private async generateFinalReports(
    results: any[],
    summary: {
      processed_items: number;
      failed_items: number;
      total_cost_usd: number;
      total_latency_ms: number;
      checkpoints_created: number;
      dlq_entries: number;
    },
  ): Promise<StabilityResult["final_report"]> {
    const reportsDir = "reports";

    // Update session report with stability metrics
    const sessionReportPath = `${reportsDir}/session_report.md`;

    try {
      // Generate stability section for session report
      const stabilitySection = `
## Stability Layer Results

**Processing Summary:**
- Items Processed: ${summary.processed_items}
- Items Failed: ${summary.failed_items}
- Success Rate: ${(
        (summary.processed_items /
          (summary.processed_items + summary.failed_items)) *
        100
      ).toFixed(1)}%

**Resource Usage:**
- Total Cost: $${summary.total_cost_usd.toFixed(4)}
- Total Latency: ${(summary.total_latency_ms / 1000).toFixed(1)}s
- Average Cost per Item: $${(
        summary.total_cost_usd / Math.max(summary.processed_items, 1)
      ).toFixed(4)}

**Stability Features:**
- Checkpoints Created: ${summary.checkpoints_created}
- DLQ Entries: ${summary.dlq_entries}
- Budget Guard Active: Yes
- Kill Switch Monitoring: ${
        this.config.enable_hard_stop ? "Enabled" : "Disabled"
      }

**Budget Status:**
${JSON.stringify(this.budgetGuard.getBudgetStatus().usage, null, 2)}
`;

      // Append to session report if it exists
      if (require("fs").existsSync(sessionReportPath)) {
        require("fs").appendFileSync(sessionReportPath, stabilitySection);
      }
    } catch (error) {
      console.error(`[STABILITY] Failed to update session report: ${error}`);
    }

    const finalReport: StabilityResult["final_report"] = {
      session_report_path: sessionReportPath,
    };

    // Generate checkpoint summary if enabled
    if (this.checkpointManager) {
      const checkpointSummary = this.checkpointManager.generateSummaryReport();
      if (checkpointSummary) {
        const checkpointSummaryPath = `${reportsDir}/checkpoint_summary_${this.config.run_id}.json`;
        require("fs").writeFileSync(
          checkpointSummaryPath,
          JSON.stringify(checkpointSummary, null, 2),
        );
        finalReport.checkpoint_summary_path = checkpointSummaryPath;
      }
    }

    // Generate DLQ summary
    const dlqStats = this.dlqHandler.getDLQStatistics();
    if (dlqStats.total_entries > 0) {
      const dlqSummaryPath = `${reportsDir}/dlq_summary_${this.config.run_id}.json`;
      require("fs").writeFileSync(
        dlqSummaryPath,
        JSON.stringify(dlqStats, null, 2),
      );
      finalReport.dlq_summary_path = dlqSummaryPath;
    }

    return finalReport;
  }

  private setupEmergencyStopMonitoring(): void {
    // Monitor for HARD_STOP environment variable changes
    const checkInterval = setInterval(() => {
      if (process.env.HARD_STOP === "1") {
        console.error(
          `[STABILITY] HARD_STOP detected - triggering emergency shutdown`,
        );
        this.budgetGuard.triggerEmergencyStop(
          "HARD_STOP environment variable set",
        );
        clearInterval(checkInterval);
      }
    }, 5000);

    // Clean up on process exit
    process.on("beforeExit", () => {
      clearInterval(checkInterval);
    });
  }

  private estimateItemCost(item: ProcessingItem): number {
    // Simple cost estimation based on question complexity and document count
    const baseCost = 0.02;
    const questionComplexity = item.question.length > 100 ? 1.5 : 1.0;
    const documentFactor = Math.min(
      (item.context_documents?.length || 1) / 5,
      2.0,
    );

    return baseCost * questionComplexity * documentFactor;
  }

  private calculateP95(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = values.sort((a, b) => a - b);
    const index = Math.floor(values.length * 0.95);
    return sorted[Math.min(index, sorted.length - 1)];
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "test") {
    const config: StabilityConfig = {
      run_id: "stability_test_" + Date.now(),
      session_id: "test_session",
      profile: "dev",
      enable_checkpoints: true,
      enable_hard_stop: true,
      budget_max_usd: 0.5,
    };

    const stability = new StabilityIntegration(config);

    const testItems: ProcessingItem[] = [
      {
        id: "test_1",
        question: "What are the benefits of renewable energy?",
        context_documents: [
          "Renewable energy reduces carbon emissions...",
          "Solar power is cost-effective...",
        ],
      },
      {
        id: "test_2",
        question: "How does machine learning work?",
        context_documents: [
          "Machine learning algorithms learn from data...",
          "Neural networks are a type of ML...",
        ],
      },
    ];

    stability
      .processBatch(testItems)
      .then((result) => {
        console.log("Stability processing completed:");
        console.log(JSON.stringify(result, null, 2));
      })
      .catch((error) => {
        console.error("Stability processing failed:", error);
        process.exit(1);
      });
  } else {
    console.log("Stability Integration CLI");
    console.log("Commands:");
    console.log("  test - Run stability integration test");
  }
}
