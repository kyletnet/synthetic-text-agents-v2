/**
 * Log Forwarder
 * Forwards logs to external systems like ELK Stack, Splunk, or cloud providers
 */

import { EventEmitter } from "events";
import { LogEntry } from "./logAggregation";
import { Logger } from "./logger";

export interface LogForwarderConfig {
  enabled: boolean;
  targets: LogForwardingTarget[];
  batchSize: number;
  flushInterval: number;
  retryAttempts: number;
  retryDelay: number;
  enableCompression: boolean;
  enableEncryption: boolean;
}

export interface LogForwardingTarget {
  name: string;
  type:
    | "elasticsearch"
    | "splunk"
    | "datadog"
    | "newrelic"
    | "cloudwatch"
    | "fluentd"
    | "webhook";
  enabled: boolean;
  url: string;
  authentication?: {
    type: "apikey" | "basic" | "bearer" | "aws" | "none";
    credentials: Record<string, string>;
  };
  format: "json" | "jsonl" | "syslog" | "custom";
  filters?: {
    levels?: LogEntry["level"][];
    services?: string[];
    components?: string[];
  };
  transformation?: {
    fieldMapping?: Record<string, string>;
    addFields?: Record<string, string>;
    removeFields?: string[];
  };
  rateLimiting?: {
    requestsPerSecond: number;
    burstSize: number;
  };
}

export interface ForwardingStatus {
  target: string;
  status: "active" | "error" | "disabled" | "rate_limited";
  lastSuccess: Date | null;
  lastError: Date | null;
  errorMessage?: string;
  totalSent: number;
  totalErrors: number;
  currentBatchSize: number;
}

export class LogForwarder extends EventEmitter {
  private config: LogForwarderConfig;
  private logger: Logger;
  private targets: Map<string, LogForwardingTarget> = new Map();
  private queues: Map<string, LogEntry[]> = new Map();
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();
  private rateLimiters: Map<string, { tokens: number; lastRefill: number }> =
    new Map();
  private status: Map<string, ForwardingStatus> = new Map();

  constructor(config: LogForwarderConfig) {
    super();
    this.setMaxListeners(50);
    this.config = config;
    this.logger = new Logger({ level: "info" });

    if (config.enabled) {
      this.initializeTargets();
      this.startFlushTimers();
    }
  }

  /**
   * Forward a log entry to configured targets
   */
  forwardLog(logEntry: LogEntry): void {
    if (!this.config.enabled) return;

    for (const target of this.targets.values()) {
      if (!target.enabled || !this.shouldForwardToTarget(logEntry, target)) {
        continue;
      }

      if (!this.checkRateLimit(target)) {
        this.updateStatus(target.name, "rate_limited");
        continue;
      }

      this.addToQueue(target.name, logEntry);
    }
  }

  /**
   * Forward multiple log entries in batch
   */
  forwardBatch(logEntries: LogEntry[]): void {
    for (const logEntry of logEntries) {
      this.forwardLog(logEntry);
    }
  }

  /**
   * Get forwarding status for all targets
   */
  getForwardingStatus(): Record<string, ForwardingStatus> {
    const statusObj: Record<string, ForwardingStatus> = {};
    for (const [name, status] of this.status.entries()) {
      statusObj[name] = { ...status };
    }
    return statusObj;
  }

  /**
   * Manually flush all queues
   */
  async flushAll(): Promise<void> {
    const flushPromises: Promise<void>[] = [];

    for (const targetName of this.targets.keys()) {
      flushPromises.push(this.flushTarget(targetName));
    }

    await Promise.allSettled(flushPromises);
  }

  /**
   * Flush logs for a specific target
   */
  async flushTarget(targetName: string): Promise<void> {
    const target = this.targets.get(targetName);
    const queue = this.queues.get(targetName);

    if (!target || !queue || queue.length === 0) {
      return;
    }

    const logsToSend = queue.splice(0, this.config.batchSize);

    try {
      await this.sendToTarget(target, logsToSend);
      this.updateStatus(targetName, "active", undefined, logsToSend.length);
      this.emit("logs:forwarded", {
        target: targetName,
        count: logsToSend.length,
      });
    } catch (error) {
      this.logger.error(`Failed to forward logs to ${targetName}:`, error);
      this.updateStatus(targetName, "error", error as Error);

      // Return logs to queue for retry
      queue.unshift(...logsToSend);

      // Emit error event
      this.emit("forwarding:error", {
        target: targetName,
        error,
        count: logsToSend.length,
      });
    }
  }

  /**
   * Enable or disable a specific target
   */
  setTargetEnabled(targetName: string, enabled: boolean): void {
    const target = this.targets.get(targetName);
    if (target) {
      target.enabled = enabled;
      this.updateStatus(targetName, enabled ? "active" : "disabled");
      this.logger.info(
        `Target ${targetName} ${enabled ? "enabled" : "disabled"}`,
      );
    }
  }

  /**
   * Update configuration for a target
   */
  updateTarget(
    targetName: string,
    updates: Partial<LogForwardingTarget>,
  ): void {
    const target = this.targets.get(targetName);
    if (target) {
      Object.assign(target, updates);
      this.logger.info(`Target ${targetName} configuration updated`);
    }
  }

  /**
   * Shutdown the log forwarder
   */
  async shutdown(): Promise<void> {
    // Clear all timers
    for (const timer of this.flushTimers.values()) {
      clearInterval(timer);
    }
    this.flushTimers.clear();

    // Flush all remaining logs
    await this.flushAll();

    this.emit("shutdown");
  }

  private initializeTargets(): void {
    for (const target of this.config.targets) {
      this.targets.set(target.name, { ...target });
      this.queues.set(target.name, []);
      this.initializeRateLimiter(target);
      this.updateStatus(target.name, target.enabled ? "active" : "disabled");
    }
  }

  private startFlushTimers(): void {
    for (const targetName of this.targets.keys()) {
      const timer = setInterval(() => {
        this.flushTarget(targetName).catch((error) => {
          this.logger.error(`Scheduled flush failed for ${targetName}:`, error);
        });
      }, this.config.flushInterval);

      this.flushTimers.set(targetName, timer);
    }
  }

  private shouldForwardToTarget(
    logEntry: LogEntry,
    target: LogForwardingTarget,
  ): boolean {
    const filters = target.filters;
    if (!filters) return true;

    // Check level filter
    if (filters.levels && !filters.levels.includes(logEntry.level)) {
      return false;
    }

    // Check service filter
    if (filters.services && !filters.services.includes(logEntry.service)) {
      return false;
    }

    // Check component filter
    if (
      filters.components &&
      !filters.components.includes(logEntry.component)
    ) {
      return false;
    }

    return true;
  }

  private addToQueue(targetName: string, logEntry: LogEntry): void {
    const queue = this.queues.get(targetName);
    if (!queue) return;

    // Transform log entry if needed
    const transformedLog = this.transformLogEntry(logEntry, targetName);
    queue.push(transformedLog);

    // Auto-flush if queue is full
    if (queue.length >= this.config.batchSize) {
      this.flushTarget(targetName).catch((error) => {
        this.logger.error(`Auto-flush failed for ${targetName}:`, error);
      });
    }
  }

  private transformLogEntry(logEntry: LogEntry, targetName: string): LogEntry {
    const target = this.targets.get(targetName);
    if (!target?.transformation) {
      return logEntry;
    }

    const transformation = target.transformation;
    const transformed = { ...logEntry };

    // Apply field mapping
    if (transformation.fieldMapping) {
      for (const [from, to] of Object.entries(transformation.fieldMapping)) {
        if (from in transformed) {
          (transformed as any)[to] = (transformed as any)[from];
          if (from !== to) {
            delete (transformed as any)[from];
          }
        }
      }
    }

    // Add fields
    if (transformation.addFields) {
      for (const [field, value] of Object.entries(transformation.addFields)) {
        (transformed as any)[field] = value;
      }
    }

    // Remove fields
    if (transformation.removeFields) {
      for (const field of transformation.removeFields) {
        delete (transformed as any)[field];
      }
    }

    return transformed;
  }

  private async sendToTarget(
    target: LogForwardingTarget,
    logs: LogEntry[],
  ): Promise<void> {
    switch (target.type) {
      case "elasticsearch":
        await this.sendToElasticsearch(target, logs);
        break;

      case "splunk":
        await this.sendToSplunk(target, logs);
        break;

      case "datadog":
        await this.sendToDatadog(target, logs);
        break;

      case "newrelic":
        await this.sendToNewRelic(target, logs);
        break;

      case "cloudwatch":
        await this.sendToCloudWatch(target, logs);
        break;

      case "fluentd":
        await this.sendToFluentd(target, logs);
        break;

      case "webhook":
        await this.sendToWebhook(target, logs);
        break;

      default:
        throw new Error(`Unsupported target type: ${target.type}`);
    }
  }

  private async sendToElasticsearch(
    target: LogForwardingTarget,
    logs: LogEntry[],
  ): Promise<void> {
    const bulkBody = logs.flatMap((log) => [
      { index: { _index: `logs-${new Date().toISOString().split("T")[0]}` } },
      log,
    ]);

    const headers = this.buildHeaders(target);
    headers["Content-Type"] = "application/json";

    const response = await fetch(`${target.url}/_bulk`, {
      method: "POST",
      headers,
      body: bulkBody.map((item) => JSON.stringify(item)).join("\n") + "\n",
    });

    if (!response.ok) {
      throw new Error(
        `Elasticsearch forwarding failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  private async sendToSplunk(
    target: LogForwardingTarget,
    logs: LogEntry[],
  ): Promise<void> {
    const headers = this.buildHeaders(target);
    headers["Content-Type"] = "application/json";

    const events = logs.map((log) => ({
      event: log,
      time: Math.floor(log.timestamp.getTime() / 1000),
      source: log.service,
      sourcetype: "_json",
    }));

    const response = await fetch(`${target.url}/services/collector/event`, {
      method: "POST",
      headers,
      body: JSON.stringify(events),
    });

    if (!response.ok) {
      throw new Error(
        `Splunk forwarding failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  private async sendToDatadog(
    target: LogForwardingTarget,
    logs: LogEntry[],
  ): Promise<void> {
    const headers = this.buildHeaders(target);
    headers["Content-Type"] = "application/json";

    const response = await fetch(
      `${target.url}/v1/input/${target.authentication?.credentials.apikey}`,
      {
        method: "POST",
        headers,
        body: logs.map((log) => JSON.stringify(log)).join("\n"),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Datadog forwarding failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  private async sendToNewRelic(
    target: LogForwardingTarget,
    logs: LogEntry[],
  ): Promise<void> {
    const headers = this.buildHeaders(target);
    headers["Content-Type"] = "application/json";

    const payload = logs.map((log) => ({
      message: log.message,
      level: log.level,
      service: log.service,
      timestamp: log.timestamp.getTime(),
      attributes: {
        ...log.metadata,
        component: log.component,
        traceId: log.traceId,
        spanId: log.spanId,
      },
    }));

    const response = await fetch(`${target.url}/log/v1`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `New Relic forwarding failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  private async sendToCloudWatch(
    _target: LogForwardingTarget,
    _logs: LogEntry[],
  ): Promise<void> {
    // AWS CloudWatch Logs implementation would go here
    throw new Error("CloudWatch forwarding not yet implemented");
  }

  private async sendToFluentd(
    target: LogForwardingTarget,
    logs: LogEntry[],
  ): Promise<void> {
    const headers = this.buildHeaders(target);
    headers["Content-Type"] = "application/json";

    const events = logs.map((log) => [
      Math.floor(log.timestamp.getTime() / 1000),
      log,
    ]);

    const response = await fetch(target.url, {
      method: "POST",
      headers,
      body: JSON.stringify(events),
    });

    if (!response.ok) {
      throw new Error(
        `Fluentd forwarding failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  private async sendToWebhook(
    target: LogForwardingTarget,
    logs: LogEntry[],
  ): Promise<void> {
    const headers = this.buildHeaders(target);
    headers["Content-Type"] = "application/json";

    const payload = {
      timestamp: new Date().toISOString(),
      logs,
      count: logs.length,
      source: "synthetic-agents-log-forwarder",
    };

    const response = await fetch(target.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Webhook forwarding failed: ${response.status} ${response.statusText}`,
      );
    }
  }

  private buildHeaders(target: LogForwardingTarget): Record<string, string> {
    const headers: Record<string, string> = {};

    if (target.authentication) {
      switch (target.authentication.type) {
        case "apikey":
          headers["X-API-Key"] = target.authentication.credentials.apikey;
          break;

        case "basic": {
          const basic = Buffer.from(
            `${target.authentication.credentials.username}:${target.authentication.credentials.password}`,
          ).toString("base64");
          headers["Authorization"] = `Basic ${basic}`;
          break;
        }

        case "bearer":
          headers["Authorization"] =
            `Bearer ${target.authentication.credentials.token}`;
          break;

        case "aws":
          // AWS signature implementation would go here
          break;
      }
    }

    return headers;
  }

  private initializeRateLimiter(target: LogForwardingTarget): void {
    if (target.rateLimiting) {
      this.rateLimiters.set(target.name, {
        tokens: target.rateLimiting.burstSize,
        lastRefill: Date.now(),
      });
    }
  }

  private checkRateLimit(target: LogForwardingTarget): boolean {
    if (!target.rateLimiting) return true;

    const limiter = this.rateLimiters.get(target.name);
    if (!limiter) return true;

    const now = Date.now();
    const timePassed = now - limiter.lastRefill;
    const tokensToAdd = Math.floor(
      (timePassed * target.rateLimiting.requestsPerSecond) / 1000,
    );

    limiter.tokens = Math.min(
      target.rateLimiting.burstSize,
      limiter.tokens + tokensToAdd,
    );
    limiter.lastRefill = now;

    if (limiter.tokens > 0) {
      limiter.tokens--;
      return true;
    }

    return false;
  }

  private updateStatus(
    targetName: string,
    status: ForwardingStatus["status"],
    error?: Error,
    sentCount?: number,
  ): void {
    const currentStatus = this.status.get(targetName) || {
      target: targetName,
      status: "active",
      lastSuccess: null,
      lastError: null,
      totalSent: 0,
      totalErrors: 0,
      currentBatchSize: 0,
    };

    currentStatus.status = status;

    if (status === "active" && sentCount) {
      currentStatus.lastSuccess = new Date();
      currentStatus.totalSent += sentCount;
    }

    if (status === "error" && error) {
      currentStatus.lastError = new Date();
      currentStatus.errorMessage = error.message;
      currentStatus.totalErrors++;
    }

    const queue = this.queues.get(targetName);
    currentStatus.currentBatchSize = queue ? queue.length : 0;

    this.status.set(targetName, currentStatus);
  }
}

// Global log forwarder instance
let globalForwarder: LogForwarder | null = null;

export function initializeLogForwarder(
  config: LogForwarderConfig,
): LogForwarder {
  if (globalForwarder) {
    globalForwarder.shutdown();
  }

  globalForwarder = new LogForwarder(config);
  return globalForwarder;
}

export function getLogForwarder(): LogForwarder | null {
  return globalForwarder;
}
