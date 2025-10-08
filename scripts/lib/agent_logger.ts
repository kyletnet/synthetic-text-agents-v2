/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Agent Logger
 * Standardized logging system for all agent operations
 * Provides common JSONL format with required fields for audit trails
 */

export interface BaseLogEntry {
  // Required common fields
  timestamp: string;
  run_id: string;
  item_id: string;
  agent_id: string;
  agent_role: string;
  session_id?: string;

  // Performance metrics
  cost_usd: number;
  latency_ms: number;
  tokens_in?: number;
  tokens_out?: number;
  retries: number;

  // Operation context
  operation: string;
  status: "started" | "completed" | "failed" | "retrying" | "skipped";
  error_type?: "TRANSIENT" | "PERMANENT" | "POLICY";
  error_message?: string;

  // Data context
  input_hash?: string;
  output_hash?: string;
  context_size?: number;

  // Metadata
  log_level: "trace" | "debug" | "info" | "warn" | "error";
  correlation_id?: string;
  parent_trace_id?: string;
}

export interface AgentOperationLog extends BaseLogEntry {
  // Agent-specific fields
  agent_version?: string;
  agent_config?: any;
  prompt_template?: string;
  model_name?: string;
  temperature?: number;

  // Input/Output data
  input_data?: any;
  output_data?: any;
  reasoning?: string;

  // Quality metrics
  quality_score?: number;
  confidence_score?: number;
  validation_result?: any;

  // Workflow context
  workflow_step?: string;
  dependencies?: string[];
  next_agents?: string[];
}

export interface TraceContext {
  run_id: string;
  item_id: string;
  session_id?: string;
  correlation_id?: string;
  parent_trace_id?: string;
}

export interface LoggerConfig {
  base_dir?: string;
  flush_interval_ms?: number;
  max_buffer_size?: number;
  compress_old_logs?: boolean;
  retention_days?: number;
}

export class AgentLogger {
  private logsDir: string;
  private config: LoggerConfig;
  private logBuffer: AgentOperationLog[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(config: LoggerConfig = {}) {
    this.config = {
      base_dir: config.base_dir || process.cwd(),
      flush_interval_ms: config.flush_interval_ms || 5000,
      max_buffer_size: config.max_buffer_size || 100,
      compress_old_logs: config.compress_old_logs || false,
      retention_days: config.retention_days || 30,
    };

    this.logsDir = join(this.config.base_dir!, "logs", "agents");
    this.ensureDirectoryExists();
    this.startFlushTimer();
  }

  private ensureDirectoryExists(): void {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Create a new trace context for a run/item
   */
  createTraceContext(
    runId: string,
    itemId: string,
    sessionId?: string,
  ): TraceContext {
    return {
      run_id: runId,
      item_id: itemId,
      session_id: sessionId,
      correlation_id: this.generateCorrelationId(),
      parent_trace_id: undefined,
    };
  }

  /**
   * Create child trace context
   */
  createChildTrace(parent: TraceContext): TraceContext {
    return {
      ...parent,
      correlation_id: this.generateCorrelationId(),
      parent_trace_id: parent.correlation_id,
    };
  }

  /**
   * Log agent operation start
   */
  logOperationStart(
    context: TraceContext,
    agentId: string,
    agentRole: string,
    operation: string,
    inputData?: any,
    additionalFields?: Partial<AgentOperationLog>,
  ): string {
    const correlationId = this.generateCorrelationId();

    const logEntry: AgentOperationLog = {
      timestamp: new Date().toISOString(),
      run_id: context.run_id,
      item_id: context.item_id,
      session_id: context.session_id,
      agent_id: agentId,
      agent_role: agentRole,
      operation,
      status: "started",
      cost_usd: 0,
      latency_ms: 0,
      retries: 0,
      log_level: "info",
      correlation_id: correlationId,
      parent_trace_id: context.correlation_id,
      input_data: this.sanitizeData(inputData),
      input_hash: inputData ? this.calculateHash(inputData) : undefined,
      context_size: inputData ? JSON.stringify(inputData).length : 0,
      ...additionalFields,
    };

    this.addToBuffer(logEntry);
    return correlationId;
  }

  /**
   * Log agent operation completion
   */
  logOperationComplete(
    context: TraceContext,
    agentId: string,
    agentRole: string,
    operation: string,
    startTime: number,
    result: {
      cost_usd?: number;
      tokens_in?: number;
      tokens_out?: number;
      output_data?: any;
      quality_score?: number;
      confidence_score?: number;
      validation_result?: any;
    },
    additionalFields?: Partial<AgentOperationLog>,
  ): void {
    const latencyMs = Date.now() - startTime;

    const logEntry: AgentOperationLog = {
      timestamp: new Date().toISOString(),
      run_id: context.run_id,
      item_id: context.item_id,
      session_id: context.session_id,
      agent_id: agentId,
      agent_role: agentRole,
      operation,
      status: "completed",
      cost_usd: result.cost_usd || 0,
      latency_ms: latencyMs,
      tokens_in: result.tokens_in,
      tokens_out: result.tokens_out,
      retries: 0,
      log_level: "info",
      correlation_id: context.correlation_id,
      parent_trace_id: context.parent_trace_id,
      output_data: this.sanitizeData(result.output_data),
      output_hash: result.output_data
        ? this.calculateHash(result.output_data)
        : undefined,
      quality_score: result.quality_score,
      confidence_score: result.confidence_score,
      validation_result: result.validation_result,
      ...additionalFields,
    };

    this.addToBuffer(logEntry);
  }

  /**
   * Log agent operation failure
   */
  logOperationFailure(
    context: TraceContext,
    agentId: string,
    agentRole: string,
    operation: string,
    startTime: number,
    error: Error,
    retryCount: number = 0,
    additionalFields?: Partial<AgentOperationLog>,
  ): void {
    const latencyMs = Date.now() - startTime;
    const errorType = this.classifyError(error);

    const logEntry: AgentOperationLog = {
      timestamp: new Date().toISOString(),
      run_id: context.run_id,
      item_id: context.item_id,
      session_id: context.session_id,
      agent_id: agentId,
      agent_role: agentRole,
      operation,
      status: retryCount > 0 ? "retrying" : "failed",
      cost_usd: 0,
      latency_ms: latencyMs,
      retries: retryCount,
      log_level: "error",
      correlation_id: context.correlation_id,
      parent_trace_id: context.parent_trace_id,
      error_type: errorType,
      error_message: error.message,
      ...additionalFields,
    };

    this.addToBuffer(logEntry);
  }

  /**
   * Log workflow step completion
   */
  logWorkflowStep(
    context: TraceContext,
    workflowStep: string,
    agentsInvolved: string[],
    stepResult: {
      duration_ms: number;
      cost_usd: number;
      success: boolean;
      output_data?: any;
    },
    additionalFields?: Partial<AgentOperationLog>,
  ): void {
    const logEntry: AgentOperationLog = {
      timestamp: new Date().toISOString(),
      run_id: context.run_id,
      item_id: context.item_id,
      session_id: context.session_id,
      agent_id: "workflow_orchestrator",
      agent_role: "orchestrator",
      operation: "workflow_step",
      status: stepResult.success ? "completed" : "failed",
      cost_usd: stepResult.cost_usd,
      latency_ms: stepResult.duration_ms,
      retries: 0,
      log_level: "info",
      correlation_id: context.correlation_id,
      workflow_step: workflowStep,
      dependencies: agentsInvolved,
      output_data: this.sanitizeData(stepResult.output_data),
      ...additionalFields,
    };

    this.addToBuffer(logEntry);
  }

  /**
   * Log performance metrics
   */
  logPerformanceMetrics(
    context: TraceContext,
    metrics: {
      total_duration_ms: number;
      total_cost_usd: number;
      agent_breakdown: {
        [agentRole: string]: {
          calls: number;
          total_cost: number;
          total_time: number;
          avg_latency: number;
        };
      };
    },
  ): void {
    const logEntry: AgentOperationLog = {
      timestamp: new Date().toISOString(),
      run_id: context.run_id,
      item_id: context.item_id,
      session_id: context.session_id,
      agent_id: "performance_tracker",
      agent_role: "tracker",
      operation: "performance_summary",
      status: "completed",
      cost_usd: metrics.total_cost_usd,
      latency_ms: metrics.total_duration_ms,
      retries: 0,
      log_level: "info",
      correlation_id: context.correlation_id,
      output_data: metrics.agent_breakdown,
    };

    this.addToBuffer(logEntry);
  }

  /**
   * Add log entry to buffer
   */
  private addToBuffer(entry: AgentOperationLog): void {
    this.logBuffer.push(entry);

    // Flush if buffer is full
    if (this.logBuffer.length >= this.config.max_buffer_size!) {
      this.flush();
    }
  }

  /**
   * Flush log buffer to file
   */
  flush(): void {
    if (this.logBuffer.length === 0) return;

    // Group logs by run_id for file organization
    const logsByRun = new Map<string, AgentOperationLog[]>();

    for (const entry of this.logBuffer) {
      if (!logsByRun.has(entry.run_id)) {
        logsByRun.set(entry.run_id, []);
      }
      logsByRun.get(entry.run_id)!.push(entry);
    }

    // Write to separate files per run
    for (const [runId, logs] of logsByRun) {
      const logFile = join(this.logsDir, `${runId}.jsonl`);
      const logLines = logs.map((log) => JSON.stringify(log)).join("\n") + "\n";

      try {
        if (existsSync(logFile)) {
          appendFileSync(logFile, logLines);
        } else {
          writeFileSync(logFile, logLines);
        }
      } catch (error) {
        console.error(`Failed to write agent logs for run ${runId}:`, error);
      }
    }

    // Clear buffer
    this.logBuffer = [];
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flush_interval_ms!);
  }

  /**
   * Stop logger and flush remaining logs
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.flush();
  }

  /**
   * Classify error type for logging
   */
  private classifyError(error: Error): "TRANSIENT" | "PERMANENT" | "POLICY" {
    const message = error.message.toLowerCase();

    if (
      message.includes("pii") ||
      message.includes("policy") ||
      message.includes("license")
    ) {
      return "POLICY";
    }

    if (
      message.includes("429") ||
      message.includes("timeout") ||
      message.includes("network")
    ) {
      return "TRANSIENT";
    }

    return "PERMANENT";
  }

  /**
   * Generate unique correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Calculate hash of data for consistency checking
   */
  private calculateHash(data: any): string {
    const crypto = require("crypto");
    const jsonString = JSON.stringify(data, Object.keys(data).sort());
    return crypto
      .createHash("sha256")
      .update(jsonString)
      .digest("hex")
      .substring(0, 16);
  }

  /**
   * Sanitize sensitive data for logging
   */
  private sanitizeData(data: any): any {
    if (!data) return data;

    try {
      const jsonString = JSON.stringify(data);

      // Remove potential PII patterns
      const sanitized = jsonString
        .replace(/\b\d{6}-\d{7}\b/g, "[SSN_REDACTED]")
        .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN_REDACTED]")
        .replace(
          /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
          "[EMAIL_REDACTED]",
        )
        .replace(
          /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
          "[CARD_REDACTED]",
        );

      return JSON.parse(sanitized);
    } catch (error) {
      console.warn("Failed to sanitize data for logging:", error);
      return "[SANITIZATION_FAILED]";
    }
  }

  /**
   * Query logs for specific run or criteria
   */
  queryLogs(criteria: {
    run_id?: string;
    agent_role?: string;
    operation?: string;
    status?: string;
    since?: string;
    limit?: number;
  }): AgentOperationLog[] {
    // This is a simple implementation - for production, consider using a proper log aggregation system
    const results: AgentOperationLog[] = [];

    try {
      const logFiles = criteria.run_id
        ? [`${criteria.run_id}.jsonl`]
        : require("fs")
            .readdirSync(this.logsDir)
            .filter((f: string) => f.endsWith(".jsonl"));

      for (const file of logFiles) {
        const filePath = join(this.logsDir, file);
        if (!existsSync(filePath)) continue;

        const content = require("fs").readFileSync(filePath, "utf-8");
        const lines = content
          .trim()
          .split("\n")
          .filter((line: string) => line.trim());

        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as AgentOperationLog;

            // Apply filters
            if (criteria.agent_role && entry.agent_role !== criteria.agent_role)
              continue;
            if (criteria.operation && entry.operation !== criteria.operation)
              continue;
            if (criteria.status && entry.status !== criteria.status) continue;
            if (
              criteria.since &&
              new Date(entry.timestamp) < new Date(criteria.since)
            )
              continue;

            results.push(entry);

            if (criteria.limit && results.length >= criteria.limit) {
              return results.slice(0, criteria.limit);
            }
          } catch (error) {
            // Skip malformed lines
          }
        }
      }
    } catch (error) {
      console.error("Failed to query logs:", error);
    }

    return results.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }

  /**
   * Get agent performance summary
   */
  getAgentPerformanceSummary(runId: string): {
    [agentRole: string]: {
      total_calls: number;
      total_cost: number;
      total_time: number;
      avg_latency: number;
      success_rate: number;
      error_count: number;
    };
  } {
    const logs = this.queryLogs({ run_id: runId });
    const summary: any = {};

    for (const log of logs) {
      const role = log.agent_role;

      if (!summary[role]) {
        summary[role] = {
          total_calls: 0,
          total_cost: 0,
          total_time: 0,
          avg_latency: 0,
          success_rate: 0,
          error_count: 0,
        };
      }

      summary[role].total_calls++;
      summary[role].total_cost += log.cost_usd;
      summary[role].total_time += log.latency_ms;

      if (log.status === "failed") {
        summary[role].error_count++;
      }
    }

    // Calculate averages and rates
    for (const role of Object.keys(summary)) {
      const data = summary[role];
      data.avg_latency =
        data.total_calls > 0 ? data.total_time / data.total_calls : 0;
      data.success_rate =
        data.total_calls > 0
          ? (data.total_calls - data.error_count) / data.total_calls
          : 0;
    }

    return summary;
  }
}

/**
 * Global logger instance
 */
let globalLogger: AgentLogger | null = null;

/**
 * Initialize global agent logger
 */
export function initializeAgentLogger(config?: LoggerConfig): AgentLogger {
  globalLogger = new AgentLogger(config);
  return globalLogger;
}

/**
 * Get global agent logger
 */
export function getAgentLogger(): AgentLogger {
  if (!globalLogger) {
    globalLogger = new AgentLogger();
  }
  return globalLogger;
}

/**
 * Convenience function for creating operation tracker
 */
export function createOperationTracker(
  context: TraceContext,
  agentId: string,
  agentRole: string,
  operation: string,
) {
  const logger = getAgentLogger();
  const startTime = Date.now();

  const correlationId = logger.logOperationStart(
    context,
    agentId,
    agentRole,
    operation,
  );

  return {
    complete: (result: any) => {
      logger.logOperationComplete(
        context,
        agentId,
        agentRole,
        operation,
        startTime,
        result,
      );
    },

    fail: (error: Error, retryCount: number = 0) => {
      logger.logOperationFailure(
        context,
        agentId,
        agentRole,
        operation,
        startTime,
        error,
        retryCount,
      );
    },

    correlationId,
  };
}
