import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
export class AgentLogger {
  logsDir;
  config;
  logBuffer = [];
  flushTimer;
  constructor(config = {}) {
    this.config = {
      base_dir: config.base_dir || process.cwd(),
      flush_interval_ms: config.flush_interval_ms || 5000,
      max_buffer_size: config.max_buffer_size || 100,
      compress_old_logs: config.compress_old_logs || false,
      retention_days: config.retention_days || 30,
    };
    this.logsDir = join(
      this.config.base_dir || process.cwd(),
      "logs",
      "agents",
    );
    this.ensureDirectoryExists();
    this.startFlushTimer();
  }
  ensureDirectoryExists() {
    if (!existsSync(this.logsDir)) {
      mkdirSync(this.logsDir, { recursive: true });
    }
  }
  /**
   * Create a new trace context for a run/item
   */
  createTraceContext(runId, itemId, sessionId) {
    const ctx = {
      run_id: runId,
      item_id: itemId,
      correlation_id: this.generateCorrelationId(),
    };
    if (typeof sessionId === "string") ctx.session_id = sessionId;
    return ctx;
  }
  /**
   * Create child trace context
   */
  createChildTrace(parent) {
    const ctx = {
      run_id: parent.run_id,
      item_id: parent.item_id,
      correlation_id: this.generateCorrelationId(),
      parent_trace_id: parent.correlation_id,
    };
    if (typeof parent.session_id === "string")
      ctx.session_id = parent.session_id;
    return ctx;
  }
  /**
   * Log agent operation start
   */
  logOperationStart(
    context,
    agentId,
    agentRole,
    operation,
    inputData,
    additionalFields,
  ) {
    const correlationId = this.generateCorrelationId();
    const logEntry = {
      timestamp: new Date().toISOString(),
      run_id: context.run_id,
      item_id: context.item_id,
      agent_id: agentId,
      agent_role: agentRole,
      operation,
      status: "started",
      cost_usd: 0,
      latency_ms: 0,
      retries: 0,
      log_level: "info",
      correlation_id: correlationId,
      context_size: inputData ? JSON.stringify(inputData).length : 0,
      ...additionalFields,
    };
    if (typeof context.session_id === "string")
      logEntry.session_id = context.session_id;
    if (typeof context.correlation_id === "string")
      logEntry.parent_trace_id = context.correlation_id;
    if (inputData) {
      logEntry.input_data = this.sanitizeData(inputData);
      logEntry.input_hash = this.calculateHash(inputData);
    }
    this.addToBuffer(logEntry);
    return correlationId;
  }
  /**
   * Log agent operation completion
   */
  logOperationComplete(
    context,
    agentId,
    agentRole,
    operation,
    startTime,
    result,
    additionalFields,
  ) {
    const latencyMs = Date.now() - startTime;
    const logEntry = {
      timestamp: new Date().toISOString(),
      run_id: context.run_id,
      item_id: context.item_id,
      agent_id: agentId,
      agent_role: agentRole,
      operation,
      status: "completed",
      cost_usd: result.cost_usd || 0,
      latency_ms: latencyMs,
      retries: 0,
      log_level: "info",
      ...additionalFields,
    };
    if (typeof context.session_id === "string")
      logEntry.session_id = context.session_id;
    if (typeof context.correlation_id === "string")
      logEntry.correlation_id = context.correlation_id;
    if (typeof context.parent_trace_id === "string")
      logEntry.parent_trace_id = context.parent_trace_id;
    if (typeof result.tokens_in === "number")
      logEntry.tokens_in = result.tokens_in;
    if (typeof result.tokens_out === "number")
      logEntry.tokens_out = result.tokens_out;
    if (result.output_data) {
      logEntry.output_data = this.sanitizeData(result.output_data);
      logEntry.output_hash = this.calculateHash(result.output_data);
    }
    if (typeof result.quality_score === "number")
      logEntry.quality_score = result.quality_score;
    if (typeof result.confidence_score === "number")
      logEntry.confidence_score = result.confidence_score;
    if (result.validation_result)
      logEntry.validation_result = result.validation_result;
    this.addToBuffer(logEntry);
  }
  /**
   * Log agent operation failure
   */
  logOperationFailure(
    context,
    agentId,
    agentRole,
    operation,
    startTime,
    error,
    retryCount = 0,
    additionalFields,
  ) {
    const latencyMs = Date.now() - startTime;
    const errorType = this.classifyError(error);
    const logEntry = {
      timestamp: new Date().toISOString(),
      run_id: context.run_id,
      item_id: context.item_id,
      agent_id: agentId,
      agent_role: agentRole,
      operation,
      status: retryCount > 0 ? "retrying" : "failed",
      cost_usd: 0,
      latency_ms: latencyMs,
      retries: retryCount,
      log_level: "error",
      error_type: errorType,
      error_message: error.message,
      ...additionalFields,
    };
    if (typeof context.session_id === "string")
      logEntry.session_id = context.session_id;
    if (typeof context.correlation_id === "string")
      logEntry.correlation_id = context.correlation_id;
    if (typeof context.parent_trace_id === "string")
      logEntry.parent_trace_id = context.parent_trace_id;
    this.addToBuffer(logEntry);
  }
  /**
   * Log workflow step completion
   */
  logWorkflowStep(
    context,
    workflowStep,
    agentsInvolved,
    stepResult,
    additionalFields,
  ) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      run_id: context.run_id,
      item_id: context.item_id,
      agent_id: "workflow_orchestrator",
      agent_role: "orchestrator",
      operation: "workflow_step",
      status: stepResult.success ? "completed" : "failed",
      cost_usd: stepResult.cost_usd,
      latency_ms: stepResult.duration_ms,
      retries: 0,
      log_level: "info",
      workflow_step: workflowStep,
      dependencies: agentsInvolved,
      ...additionalFields,
    };
    if (typeof context.session_id === "string")
      logEntry.session_id = context.session_id;
    if (typeof context.correlation_id === "string")
      logEntry.correlation_id = context.correlation_id;
    if (stepResult.output_data)
      logEntry.output_data = this.sanitizeData(stepResult.output_data);
    this.addToBuffer(logEntry);
  }
  /**
   * Log performance metrics
   */
  logPerformanceMetrics(context, metrics) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      run_id: context.run_id,
      item_id: context.item_id,
      agent_id: "performance_tracker",
      agent_role: "tracker",
      operation: "performance_summary",
      status: "completed",
      cost_usd: metrics.total_cost_usd,
      latency_ms: metrics.total_duration_ms,
      retries: 0,
      log_level: "info",
      output_data: metrics.agent_breakdown,
    };
    if (typeof context.session_id === "string")
      logEntry.session_id = context.session_id;
    if (typeof context.correlation_id === "string")
      logEntry.correlation_id = context.correlation_id;
    this.addToBuffer(logEntry);
  }
  /**
   * Add log entry to buffer
   */
  addToBuffer(entry) {
    this.logBuffer.push(entry);
    // Flush if buffer is full
    if (this.logBuffer.length >= (this.config.max_buffer_size || 100)) {
      this.flush();
    }
  }
  /**
   * Flush log buffer to file
   */
  flush() {
    if (this.logBuffer.length === 0) return;
    // Group logs by run_id for file organization
    const logsByRun = new Map();
    for (const entry of this.logBuffer) {
      if (!logsByRun.has(entry.run_id)) {
        logsByRun.set(entry.run_id, []);
      }
      const runLogs = logsByRun.get(entry.run_id);
      if (runLogs) {
        runLogs.push(entry);
      }
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
  startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flush_interval_ms || 5000);
  }
  /**
   * Stop logger and flush remaining logs
   */
  stop() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.flush();
  }
  /**
   * Classify error type for logging
   */
  classifyError(error) {
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
  generateCorrelationId() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
  /**
   * Calculate hash of data for consistency checking
   */
  calculateHash(data) {
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
  sanitizeData(data) {
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
  queryLogs(criteria) {
    // This is a simple implementation - for production, consider using a proper log aggregation system
    const results = [];
    try {
      const logFiles = criteria.run_id
        ? [`${criteria.run_id}.jsonl`]
        : require("fs")
            .readdirSync(this.logsDir)
            .filter((f) => f.endsWith(".jsonl"));
      for (const file of logFiles) {
        const filePath = join(this.logsDir, file);
        if (!existsSync(filePath)) continue;
        const content = require("fs").readFileSync(filePath, "utf-8");
        const lines = content
          .trim()
          .split("\n")
          .filter((line) => line.trim());
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
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
  getAgentPerformanceSummary(runId) {
    const logs = this.queryLogs({ run_id: runId });
    const summary = {};
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
let globalLogger = null;
/**
 * Initialize global agent logger
 */
export function initializeAgentLogger(config) {
  globalLogger = new AgentLogger(config);
  return globalLogger;
}
/**
 * Get global agent logger
 */
export function getAgentLogger() {
  if (!globalLogger) {
    globalLogger = new AgentLogger();
  }
  return globalLogger;
}
/**
 * Convenience function for creating operation tracker
 */
export function createOperationTracker(context, agentId, agentRole, operation) {
  const logger = getAgentLogger();
  const startTime = Date.now();
  const correlationId = logger.logOperationStart(
    context,
    agentId,
    agentRole,
    operation,
  );
  return {
    complete: (result) => {
      logger.logOperationComplete(
        context,
        agentId,
        agentRole,
        operation,
        startTime,
        result,
      );
    },
    fail: (error, retryCount = 0) => {
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
//# sourceMappingURL=agent_logger.js.map
