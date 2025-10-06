/**
 * Checkpoint Manager with JSONL Streaming
 * Implements resumable execution with checkpoint streaming
 * Records last successful index for resumption on failure/restart
 */

import * as fs from "fs";
import * as path from "path";

export interface CheckpointEntry {
  run_id: string;
  item_id: string;
  agent_role: string;
  timestamp: string;
  checkpoint_index: number;
  total_items: number;
  stage: string;
  progress: number; // 0-1
  success: boolean;
  resumable_state: {
    processing_stage: string;
    completed_steps: string[];
    intermediate_results: any;
    agent_context: any;
  };
  metrics: {
    cost_usd: number;
    latency_ms: number;
    retries: number;
    tokens_used?: {
      input: number;
      output: number;
    };
  };
  error_info?: {
    error_type: string;
    error_message: string;
    retryable: boolean;
  };
}

export interface ResumeInfo {
  last_successful_index: number;
  total_completed: number;
  remaining_items: number;
  partial_results: any[];
  accumulated_metrics: {
    total_cost: number;
    total_latency: number;
    total_retries: number;
  };
}

export class CheckpointManager {
  private checkpointPath: string;
  private runId: string;
  private sessionId: string;

  constructor(
    runId: string,
    sessionId: string,
    checkpointDir: string = "reports/checkpoints",
  ) {
    this.runId = runId;
    this.sessionId = sessionId;
    this.checkpointPath = path.join(checkpointDir, `checkpoint_${runId}.jsonl`);

    // Ensure checkpoint directory exists
    fs.mkdirSync(path.dirname(this.checkpointPath), { recursive: true });
  }

  /**
   * Record a checkpoint for an item/agent combination
   */
  async recordCheckpoint(
    checkpoint: Omit<CheckpointEntry, "timestamp">,
  ): Promise<void> {
    const fullCheckpoint: CheckpointEntry = {
      ...checkpoint,
      timestamp: new Date().toISOString(),
    };

    try {
      // Append checkpoint to JSONL stream
      const checkpointLine = JSON.stringify(fullCheckpoint) + "\n";
      fs.appendFileSync(this.checkpointPath, checkpointLine);

      console.log(
        `[CHECKPOINT] Recorded: ${checkpoint.agent_role}:${checkpoint.item_id} (${checkpoint.stage}) - Success: ${checkpoint.success}`,
      );
    } catch (error) {
      console.error(`[CHECKPOINT] Failed to record checkpoint: ${error}`);
    }
  }

  /**
   * Get resume information from existing checkpoints
   */
  getResumeInfo(): ResumeInfo | null {
    if (!fs.existsSync(this.checkpointPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.checkpointPath, "utf8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line);

      if (lines.length === 0) {
        return null;
      }

      const checkpoints: CheckpointEntry[] = lines.map((line) =>
        JSON.parse(line),
      );

      // Find last successful checkpoint for each item
      const itemCheckpoints = new Map<string, CheckpointEntry>();
      const allResults: any[] = [];
      let totalCost = 0;
      let totalLatency = 0;
      let totalRetries = 0;

      for (const checkpoint of checkpoints) {
        const itemKey = `${checkpoint.item_id}:${checkpoint.agent_role}`;

        // Track all results
        if (
          checkpoint.success &&
          checkpoint.resumable_state.intermediate_results
        ) {
          allResults.push({
            item_id: checkpoint.item_id,
            agent_role: checkpoint.agent_role,
            stage: checkpoint.stage,
            result: checkpoint.resumable_state.intermediate_results,
          });
        }

        // Accumulate metrics
        totalCost += checkpoint.metrics.cost_usd;
        totalLatency += checkpoint.metrics.latency_ms;
        totalRetries += checkpoint.metrics.retries;

        // Keep track of latest checkpoint per item
        if (checkpoint.success) {
          const existing = itemCheckpoints.get(itemKey);
          if (
            !existing ||
            checkpoint.checkpoint_index > existing.checkpoint_index
          ) {
            itemCheckpoints.set(itemKey, checkpoint);
          }
        }
      }

      // Find the minimum successful index (for safe resumption)
      const successfulIndices = Array.from(itemCheckpoints.values())
        .map((cp) => cp.checkpoint_index)
        .sort((a, b) => a - b);

      const lastSuccessfulIndex =
        successfulIndices.length > 0 ? Math.min(...successfulIndices) : -1;
      const totalItems =
        checkpoints.length > 0
          ? Math.max(...checkpoints.map((cp) => cp.total_items))
          : 0;

      return {
        last_successful_index: lastSuccessfulIndex,
        total_completed: successfulIndices.length,
        remaining_items:
          totalItems > lastSuccessfulIndex + 1
            ? totalItems - (lastSuccessfulIndex + 1)
            : 0,
        partial_results: allResults,
        accumulated_metrics: {
          total_cost: totalCost,
          total_latency: totalLatency,
          total_retries: totalRetries,
        },
      };
    } catch (error) {
      console.error(`[CHECKPOINT] Failed to read resume info: ${error}`);
      return null;
    }
  }

  /**
   * Stream checkpoints as they're created (for real-time monitoring)
   */
  streamCheckpoints(
    callback: (checkpoint: CheckpointEntry) => void,
  ): () => void {
    if (!fs.existsSync(this.checkpointPath)) {
      return () => {}; // Return empty cleanup function
    }

    // Watch file for changes
    let lastPosition = 0;

    const watcher = fs.watchFile(
      this.checkpointPath,
      { interval: 1000 },
      () => {
        try {
          const stats = fs.statSync(this.checkpointPath);
          if (stats.size <= lastPosition) {
            return; // No new data
          }

          const stream = fs.createReadStream(this.checkpointPath, {
            start: lastPosition,
            encoding: "utf8",
          });

          let buffer = "";
          stream.on("data", (chunk: string | Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() || ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const checkpoint: CheckpointEntry = JSON.parse(line);
                  callback(checkpoint);
                } catch (parseError) {
                  console.warn(
                    `[CHECKPOINT] Failed to parse checkpoint line: ${parseError}`,
                  );
                }
              }
            }
          });

          stream.on("end", () => {
            lastPosition = stats.size;
          });
        } catch (error) {
          console.error(`[CHECKPOINT] Stream error: ${error}`);
        }
      },
    );

    // Return cleanup function
    return () => {
      fs.unwatchFile(this.checkpointPath);
    };
  }

  /**
   * Clean up old checkpoints (archive completed runs)
   */
  archiveCheckpoints(): void {
    if (!fs.existsSync(this.checkpointPath)) {
      return;
    }

    try {
      const archiveDir = path.join(
        path.dirname(this.checkpointPath),
        "archived",
      );
      fs.mkdirSync(archiveDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const archivePath = path.join(
        archiveDir,
        `checkpoint_${this.runId}_${timestamp}.jsonl`,
      );

      // Move current checkpoint to archive
      fs.renameSync(this.checkpointPath, archivePath);

      console.log(`[CHECKPOINT] Archived checkpoints to: ${archivePath}`);
    } catch (error) {
      console.error(`[CHECKPOINT] Failed to archive checkpoints: ${error}`);
    }
  }

  /**
   * Generate checkpoint summary report
   */
  generateSummaryReport(): {
    run_id: string;
    total_checkpoints: number;
    successful_checkpoints: number;
    failed_checkpoints: number;
    agents_summary: Record<
      string,
      { total: number; successful: number; avg_cost: number }
    >;
    timeline: Array<{ timestamp: string; stage: string; success: boolean }>;
    total_metrics: { cost: number; latency: number; retries: number };
  } | null {
    if (!fs.existsSync(this.checkpointPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.checkpointPath, "utf8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line);

      if (lines.length === 0) {
        return null;
      }

      const checkpoints: CheckpointEntry[] = lines.map((line) =>
        JSON.parse(line),
      );

      // Calculate summary statistics
      const totalCheckpoints = checkpoints.length;
      const successfulCheckpoints = checkpoints.filter(
        (cp) => cp.success,
      ).length;
      const failedCheckpoints = totalCheckpoints - successfulCheckpoints;

      // Agent-level summaries
      const agentsSummary: Record<
        string,
        { total: number; successful: number; avg_cost: number }
      > = {};

      for (const checkpoint of checkpoints) {
        const agentRole = checkpoint.agent_role;

        if (!agentsSummary[agentRole]) {
          agentsSummary[agentRole] = { total: 0, successful: 0, avg_cost: 0 };
        }

        agentsSummary[agentRole].total++;
        if (checkpoint.success) {
          agentsSummary[agentRole].successful++;
        }
        agentsSummary[agentRole].avg_cost += checkpoint.metrics.cost_usd;
      }

      // Calculate averages
      for (const agent in agentsSummary) {
        agentsSummary[agent].avg_cost /= agentsSummary[agent].total;
      }

      // Timeline
      const timeline = checkpoints.map((cp) => ({
        timestamp: cp.timestamp,
        stage: cp.stage,
        success: cp.success,
      }));

      // Total metrics
      const totalMetrics = checkpoints.reduce(
        (acc, cp) => ({
          cost: acc.cost + cp.metrics.cost_usd,
          latency: acc.latency + cp.metrics.latency_ms,
          retries: acc.retries + cp.metrics.retries,
        }),
        { cost: 0, latency: 0, retries: 0 },
      );

      return {
        run_id: this.runId,
        total_checkpoints: totalCheckpoints,
        successful_checkpoints: successfulCheckpoints,
        failed_checkpoints: failedCheckpoints,
        agents_summary: agentsSummary,
        timeline,
        total_metrics: totalMetrics,
      };
    } catch (error) {
      console.error(`[CHECKPOINT] Failed to generate summary report: ${error}`);
      return null;
    }
  }

  /**
   * Resume execution from last successful checkpoint
   */
  async resumeExecution<T>(
    items: T[],
    processItem: (
      item: T,
      index: number,
      resumeState?: any,
    ) => Promise<{
      success: boolean;
      result?: any;
      error?: any;
      checkpoint?: {
        stage: string;
        progress: number;
        resumable_state?: any;
      };
      metrics: {
        cost_usd: number;
        latency_ms: number;
        retries: number;
      };
    }>,
    agentRole: string,
  ): Promise<{
    results: any[];
    completed_count: number;
    failed_count: number;
    total_metrics: { cost: number; latency: number; retries: number };
    resumed_from_index: number;
  }> {
    const resumeInfo = this.getResumeInfo();
    const startIndex = resumeInfo ? resumeInfo.last_successful_index + 1 : 0;

    console.log(
      `[CHECKPOINT] Resuming execution from index ${startIndex} (${
        items.length - startIndex
      } remaining)`,
    );

    const results: any[] = [];
    let completedCount = 0;
    let failedCount = 0;
    const totalMetrics = {
      cost: resumeInfo?.accumulated_metrics.total_cost || 0,
      latency: resumeInfo?.accumulated_metrics.total_latency || 0,
      retries: resumeInfo?.accumulated_metrics.total_retries || 0,
    };

    // Add previously completed results
    if (resumeInfo) {
      results.push(...resumeInfo.partial_results);
      completedCount = resumeInfo.total_completed;
    }

    // Process remaining items
    for (let i = startIndex; i < items.length; i++) {
      const item = items[i];
      const startTime = Date.now();

      try {
        // Check for existing resumable state
        const resumeState = this.findResumeStateForItem(i, agentRole);

        // Process item
        const itemResult = await processItem(item, i, resumeState);

        // Update metrics
        totalMetrics.cost += itemResult.metrics.cost_usd;
        totalMetrics.latency += itemResult.metrics.latency_ms;
        totalMetrics.retries += itemResult.metrics.retries;

        // Record checkpoint
        await this.recordCheckpoint({
          run_id: this.runId,
          item_id: `item_${i}`,
          agent_role: agentRole,
          checkpoint_index: i,
          total_items: items.length,
          stage: itemResult.checkpoint?.stage || "completed",
          progress: itemResult.checkpoint?.progress || 1.0,
          success: itemResult.success,
          resumable_state: {
            processing_stage: itemResult.checkpoint?.stage || "completed",
            completed_steps: [`process_item_${i}`],
            intermediate_results: itemResult.result,
            agent_context: itemResult.checkpoint?.resumable_state || {},
          },
          metrics: itemResult.metrics,
          error_info: itemResult.error
            ? {
                error_type: itemResult.error.type || "unknown",
                error_message:
                  itemResult.error.message || String(itemResult.error),
                retryable: itemResult.error.retryable !== false,
              }
            : undefined,
        });

        if (itemResult.success) {
          results.push(itemResult.result);
          completedCount++;
        } else {
          failedCount++;
          console.warn(`[CHECKPOINT] Item ${i} failed: ${itemResult.error}`);
        }
      } catch (error) {
        failedCount++;
        console.error(
          `[CHECKPOINT] Unexpected error processing item ${i}: ${error}`,
        );

        // Record failure checkpoint
        await this.recordCheckpoint({
          run_id: this.runId,
          item_id: `item_${i}`,
          agent_role: agentRole,
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
            latency_ms: Date.now() - startTime,
            retries: 0,
          },
          error_info: {
            error_type: "unexpected_error",
            error_message: String(error),
            retryable: true,
          },
        });
      }
    }

    return {
      results,
      completed_count: completedCount,
      failed_count: failedCount,
      total_metrics: totalMetrics,
      resumed_from_index: startIndex,
    };
  }

  private findResumeStateForItem(
    itemIndex: number,
    agentRole: string,
  ): any | null {
    const resumeInfo = this.getResumeInfo();
    if (!resumeInfo) return null;

    const relevantResult = resumeInfo.partial_results.find(
      (result) =>
        result.item_id === `item_${itemIndex}` &&
        result.agent_role === agentRole,
    );

    return relevantResult?.result || null;
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "summary") {
    const runId = args[1] || "test_run";
    const sessionId = args[2] || "test_session";

    const checkpointManager = new CheckpointManager(runId, sessionId);
    const summary = checkpointManager.generateSummaryReport();

    if (summary) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log("No checkpoints found for this run");
    }
  } else if (command === "resume-info") {
    const runId = args[1] || "test_run";
    const sessionId = args[2] || "test_session";

    const checkpointManager = new CheckpointManager(runId, sessionId);
    const resumeInfo = checkpointManager.getResumeInfo();

    if (resumeInfo) {
      console.log(JSON.stringify(resumeInfo, null, 2));
    } else {
      console.log("No resume information available");
    }
  } else if (command === "test") {
    const runId = "test_" + Date.now();
    const sessionId = "session_" + Date.now();

    const checkpointManager = new CheckpointManager(runId, sessionId);

    // Simulate processing with checkpoints
    const testItems = ["item1", "item2", "item3", "item4", "item5"];

    const processItem = async (item: string, index: number) => {
      // Simulate processing time
      await new Promise((resolve) =>
        setTimeout(resolve, 100 + Math.random() * 200),
      );

      // Simulate occasional failures
      const success = Math.random() > 0.2; // 80% success rate

      return {
        success,
        result: success ? `Processed ${item}` : null,
        error: success
          ? null
          : { type: "processing_error", message: `Failed to process ${item}` },
        checkpoint: {
          stage: "processing_complete",
          progress: 1.0,
          resumable_state: { item_data: item },
        },
        metrics: {
          cost_usd: 0.01 + Math.random() * 0.02,
          latency_ms: 100 + Math.random() * 200,
          retries: Math.random() > 0.8 ? 1 : 0,
        },
      };
    };

    checkpointManager
      .resumeExecution(testItems, processItem, "test_agent")
      .then((result) => {
        console.log("Processing completed:");
        console.log(`Completed: ${result.completed_count}/${testItems.length}`);
        console.log(`Failed: ${result.failed_count}`);
        console.log(`Total cost: $${result.total_metrics.cost.toFixed(4)}`);
        console.log(`Resumed from index: ${result.resumed_from_index}`);
      })
      .catch((error) => {
        console.error("Processing failed:", error);
      });
  } else {
    console.log("Checkpoint Manager CLI");
    console.log("Commands:");
    console.log(
      "  summary [run_id] [session_id]     - Generate checkpoint summary",
    );
    console.log(
      "  resume-info [run_id] [session_id] - Show resume information",
    );
    console.log("  test                               - Run checkpoint test");
  }
}
