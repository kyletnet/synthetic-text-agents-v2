/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Base Agent for Multi-Agent Orchestration
 * Implements common orchestration contract with standardized fields:
 * RUN_ID, ITEM_ID, AGENT_ROLE, COST, LAT_MS, RETRIES
 */

export interface AgentContext {
  run_id: string;
  item_id: string;
  agent_role: string;
  session_id: string;
  profile: string;
  budget_limits?: {
    max_cost_usd: number;
    max_latency_ms: number;
  };
  checkpoint_stream?: string; // JSONL stream path for checkpoints
  metadata?: Record<string, any>;
}

export interface AgentResult {
  success: boolean;
  data?: any;
  error?: {
    type: string;
    message: string;
    retryable: boolean;
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
  checkpoint?: {
    stage: string;
    progress: number; // 0-1
    resumable_state?: any;
  };
  telemetry: {
    timestamp: string;
    agent_version: string;
    fallback_used: boolean;
    [key: string]: any;
  };
}

export interface OrchestrationEvent {
  event_type:
    | "agent_start"
    | "agent_complete"
    | "agent_error"
    | "checkpoint"
    | "fallback";
  run_id: string;
  item_id: string;
  agent_role: string;
  timestamp: string;
  data: any;
  cost_usd: number;
  latency_ms: number;
  retries: number;
}

export abstract class BaseAgent {
  protected context: AgentContext;
  protected startTime: number;
  protected totalRetries: number = 0;
  protected totalCost: number = 0;

  constructor(context: AgentContext) {
    this.context = context;
    this.startTime = Date.now();
  }

  /**
   * Main execution method - must be implemented by subclasses
   */
  abstract execute(input: any): Promise<AgentResult>;

  /**
   * Fallback execution when budget/time constraints require simpler processing
   */
  abstract executeFallback(input: any): Promise<AgentResult>;

  /**
   * Validate input before execution
   */
  protected validateInput(input: any): { valid: boolean; error?: string } {
    if (!input) {
      return { valid: false, error: "Input is required" };
    }
    return { valid: true };
  }

  /**
   * Execute with full orchestration features (retries, budget tracking, checkpoints)
   */
  public async executeWithOrchestration(
    input: any,
    options: {
      use_fallback?: boolean;
      max_retries?: number;
      checkpoint_frequency?: number;
    } = {},
  ): Promise<AgentResult> {
    const maxRetries = options.max_retries || 3;
    let lastError: any;

    // Emit start event
    this.emitOrchestrationEvent("agent_start", {
      input_summary: this.summarizeInput(input),
      options,
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.totalRetries = attempt - 1;

      try {
        // Check budget/constraints before each attempt
        const constraintCheck = this.checkConstraints();
        if (!constraintCheck.allowed) {
          if (constraintCheck.use_fallback && !options.use_fallback) {
            console.log(
              `[${this.context.agent_role}] Switching to fallback mode: ${constraintCheck.reason}`,
            );
            options.use_fallback = true;
          } else if (!constraintCheck.allowed) {
            throw new Error(`Constraints violated: ${constraintCheck.reason}`);
          }
        }

        // Execute (main or fallback)
        const result = options.use_fallback
          ? await this.executeFallback(input)
          : await this.execute(input);

        // Update metrics
        result.metrics.retries = this.totalRetries;
        this.totalCost += result.metrics.cost_usd;

        // Emit completion event
        this.emitOrchestrationEvent("agent_complete", {
          success: result.success,
          metrics: result.metrics,
          fallback_used: options.use_fallback || false,
        });

        // Create checkpoint if successful
        if (result.success && result.checkpoint) {
          this.createCheckpoint(result.checkpoint, result.data);
        }

        return result;
      } catch (error) {
        lastError = error;
        console.log(
          `[${this.context.agent_role}] Attempt ${attempt}/${maxRetries} failed: ${error}`,
        );

        // Emit error event
        this.emitOrchestrationEvent("agent_error", {
          attempt,
          max_attempts: maxRetries,
          error: String(error),
        });

        // If this isn't the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const backoffMs = this.calculateBackoff(attempt);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries failed
    const latencyMs = Date.now() - this.startTime;
    return {
      success: false,
      error: {
        type: "max_retries_exceeded",
        message: `Failed after ${maxRetries} attempts: ${lastError}`,
        retryable: false,
      },
      metrics: {
        cost_usd: this.totalCost,
        latency_ms: latencyMs,
        retries: this.totalRetries,
      },
      telemetry: {
        timestamp: new Date().toISOString(),
        agent_version: this.getVersion(),
        fallback_used: options.use_fallback || false,
        final_error: String(lastError),
      },
    };
  }

  /**
   * Check budget and timing constraints
   */
  protected checkConstraints(): {
    allowed: boolean;
    use_fallback?: boolean;
    reason?: string;
  } {
    const limits = this.context.budget_limits;
    if (!limits) return { allowed: true };

    // Check cost constraint
    if (this.totalCost >= limits.max_cost_usd) {
      return {
        allowed: false,
        reason: `Cost limit exceeded: $${this.totalCost.toFixed(
          4,
        )} >= $${limits.max_cost_usd.toFixed(4)}`,
      };
    }

    // Check if approaching cost limit (suggest fallback)
    if (this.totalCost >= limits.max_cost_usd * 0.8) {
      return {
        allowed: true,
        use_fallback: true,
        reason: `Approaching cost limit, suggesting fallback mode`,
      };
    }

    // Check latency constraint
    const currentLatency = Date.now() - this.startTime;
    if (currentLatency >= limits.max_latency_ms) {
      return {
        allowed: false,
        reason: `Latency limit exceeded: ${currentLatency}ms >= ${limits.max_latency_ms}ms`,
      };
    }

    // Check if approaching latency limit (suggest fallback)
    if (currentLatency >= limits.max_latency_ms * 0.8) {
      return {
        allowed: true,
        use_fallback: true,
        reason: `Approaching latency limit, suggesting fallback mode`,
      };
    }

    return { allowed: true };
  }

  /**
   * Calculate exponential backoff with jitter
   */
  protected calculateBackoff(attempt: number): number {
    const baseBackoff = 1000; // 1 second
    const exponentialBackoff = Math.min(
      baseBackoff * Math.pow(2, attempt - 1),
      30000,
    );
    const jitter = exponentialBackoff * 0.1 * Math.random();
    return Math.round(exponentialBackoff + jitter);
  }

  /**
   * Emit orchestration event for monitoring
   */
  protected emitOrchestrationEvent(
    eventType: OrchestrationEvent["event_type"],
    data: any,
  ): void {
    const event: OrchestrationEvent = {
      event_type: eventType,
      run_id: this.context.run_id,
      item_id: this.context.item_id,
      agent_role: this.context.agent_role,
      timestamp: new Date().toISOString(),
      data,
      cost_usd: this.totalCost,
      latency_ms: Date.now() - this.startTime,
      retries: this.totalRetries,
    };

    // Log to orchestration stream
    this.logOrchestrationEvent(event);
  }

  /**
   * Create checkpoint for resumable execution
   */
  protected createCheckpoint(
    checkpoint: AgentResult["checkpoint"],
    data: any,
  ): void {
    if (!this.context.checkpoint_stream) return;

    const checkpointEntry = {
      run_id: this.context.run_id,
      item_id: this.context.item_id,
      agent_role: this.context.agent_role,
      timestamp: new Date().toISOString(),
      stage: checkpoint!.stage,
      progress: checkpoint!.progress,
      resumable_state: checkpoint!.resumable_state,
      output_data: data,
      metrics: {
        cost_usd: this.totalCost,
        latency_ms: Date.now() - this.startTime,
        retries: this.totalRetries,
      },
    };

    try {
      const fs = require("fs");
      const path = require("path");

      // Ensure directory exists
      fs.mkdirSync(path.dirname(this.context.checkpoint_stream), {
        recursive: true,
      });

      // Append checkpoint to JSONL stream
      fs.appendFileSync(
        this.context.checkpoint_stream,
        JSON.stringify(checkpointEntry) + "\n",
      );

      this.emitOrchestrationEvent("checkpoint", {
        stage: checkpoint!.stage,
        progress: checkpoint!.progress,
      });
    } catch (error) {
      console.warn(
        `[${this.context.agent_role}] Failed to create checkpoint: ${error}`,
      );
    }
  }

  /**
   * Log orchestration event to monitoring stream
   */
  protected logOrchestrationEvent(event: OrchestrationEvent): void {
    try {
      // Log to console with structured format
      console.log(`[ORCHESTRATION] ${JSON.stringify(event)}`);

      // Also log to file if orchestration logging is enabled
      if (process.env.ORCHESTRATION_LOG_PATH) {
        const fs = require("fs");
        const path = require("path");

        fs.mkdirSync(path.dirname(process.env.ORCHESTRATION_LOG_PATH), {
          recursive: true,
        });
        fs.appendFileSync(
          process.env.ORCHESTRATION_LOG_PATH,
          JSON.stringify(event) + "\n",
        );
      }
    } catch (error) {
      console.warn(
        `[${this.context.agent_role}] Failed to log orchestration event: ${error}`,
      );
    }
  }

  /**
   * Summarize input for logging (avoid logging sensitive data)
   */
  protected summarizeInput(input: any): any {
    if (typeof input === "string") {
      return { type: "string", length: input.length };
    } else if (Array.isArray(input)) {
      return { type: "array", length: input.length };
    } else if (typeof input === "object" && input !== null) {
      return { type: "object", keys: Object.keys(input) };
    }
    return { type: typeof input };
  }

  /**
   * Get agent version for telemetry
   */
  protected getVersion(): string {
    return "1.0.0"; // Override in subclasses
  }

  /**
   * Create standardized result structure
   */
  protected createResult(params: {
    success: boolean;
    data?: any;
    error?: { type: string; message: string; retryable: boolean };
    cost_usd: number;
    tokens_used?: { input: number; output: number };
    checkpoint?: { stage: string; progress: number; resumable_state?: any };
    fallback_used?: boolean;
  }): AgentResult {
    const latencyMs = Date.now() - this.startTime;

    return {
      success: params.success,
      data: params.data,
      error: params.error,
      metrics: {
        cost_usd: params.cost_usd,
        latency_ms: latencyMs,
        retries: this.totalRetries,
        tokens_used: params.tokens_used,
      },
      checkpoint: params.checkpoint,
      telemetry: {
        timestamp: new Date().toISOString(),
        agent_version: this.getVersion(),
        fallback_used: params.fallback_used || false,
        context: {
          run_id: this.context.run_id,
          item_id: this.context.item_id,
          agent_role: this.context.agent_role,
          profile: this.context.profile,
        },
      },
    };
  }
}
