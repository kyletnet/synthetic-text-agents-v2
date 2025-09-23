/**
 * Log Forwarder
 * Forwards logs to external systems like ELK Stack, Splunk, or cloud providers
 */
import { EventEmitter } from "events";
import { Logger } from "./logger";
export class LogForwarder extends EventEmitter {
  config;
  logger;
  targets = new Map();
  queues = new Map();
  flushTimers = new Map();
  rateLimiters = new Map();
  status = new Map();
  constructor(config) {
    super();
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
  forwardLog(logEntry) {
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
  forwardBatch(logEntries) {
    for (const logEntry of logEntries) {
      this.forwardLog(logEntry);
    }
  }
  /**
   * Get forwarding status for all targets
   */
  getForwardingStatus() {
    const statusObj = {};
    for (const [name, status] of this.status.entries()) {
      statusObj[name] = { ...status };
    }
    return statusObj;
  }
  /**
   * Manually flush all queues
   */
  async flushAll() {
    const flushPromises = [];
    for (const targetName of this.targets.keys()) {
      flushPromises.push(this.flushTarget(targetName));
    }
    await Promise.allSettled(flushPromises);
  }
  /**
   * Flush logs for a specific target
   */
  async flushTarget(targetName) {
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
      this.updateStatus(targetName, "error", error);
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
  setTargetEnabled(targetName, enabled) {
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
  updateTarget(targetName, updates) {
    const target = this.targets.get(targetName);
    if (target) {
      Object.assign(target, updates);
      this.logger.info(`Target ${targetName} configuration updated`);
    }
  }
  /**
   * Shutdown the log forwarder
   */
  async shutdown() {
    // Clear all timers
    for (const timer of this.flushTimers.values()) {
      clearInterval(timer);
    }
    this.flushTimers.clear();
    // Flush all remaining logs
    await this.flushAll();
    this.emit("shutdown");
  }
  initializeTargets() {
    for (const target of this.config.targets) {
      this.targets.set(target.name, { ...target });
      this.queues.set(target.name, []);
      this.initializeRateLimiter(target);
      this.updateStatus(target.name, target.enabled ? "active" : "disabled");
    }
  }
  startFlushTimers() {
    for (const targetName of this.targets.keys()) {
      const timer = setInterval(() => {
        this.flushTarget(targetName).catch((error) => {
          this.logger.error(`Scheduled flush failed for ${targetName}:`, error);
        });
      }, this.config.flushInterval);
      this.flushTimers.set(targetName, timer);
    }
  }
  shouldForwardToTarget(logEntry, target) {
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
  addToQueue(targetName, logEntry) {
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
  transformLogEntry(logEntry, targetName) {
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
          transformed[to] = transformed[from];
          if (from !== to) {
            delete transformed[from];
          }
        }
      }
    }
    // Add fields
    if (transformation.addFields) {
      for (const [field, value] of Object.entries(transformation.addFields)) {
        transformed[field] = value;
      }
    }
    // Remove fields
    if (transformation.removeFields) {
      for (const field of transformation.removeFields) {
        delete transformed[field];
      }
    }
    return transformed;
  }
  async sendToTarget(target, logs) {
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
  async sendToElasticsearch(target, logs) {
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
  async sendToSplunk(target, logs) {
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
  async sendToDatadog(target, logs) {
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
  async sendToNewRelic(target, logs) {
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
  async sendToCloudWatch(target, logs) {
    // AWS CloudWatch Logs implementation would go here
    throw new Error("CloudWatch forwarding not yet implemented");
  }
  async sendToFluentd(target, logs) {
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
  async sendToWebhook(target, logs) {
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
  buildHeaders(target) {
    const headers = {};
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
  initializeRateLimiter(target) {
    if (target.rateLimiting) {
      this.rateLimiters.set(target.name, {
        tokens: target.rateLimiting.burstSize,
        lastRefill: Date.now(),
      });
    }
  }
  checkRateLimit(target) {
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
  updateStatus(targetName, status, error, sentCount) {
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
let globalForwarder = null;
export function initializeLogForwarder(config) {
  if (globalForwarder) {
    globalForwarder.shutdown();
  }
  globalForwarder = new LogForwarder(config);
  return globalForwarder;
}
export function getLogForwarder() {
  return globalForwarder;
}
//# sourceMappingURL=logForwarder.js.map
