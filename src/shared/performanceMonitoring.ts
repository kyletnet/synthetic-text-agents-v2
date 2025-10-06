/**
 * Performance Monitoring and APM Integration
 * Provides comprehensive application performance monitoring with multiple provider support
 */

import { EventEmitter } from "events";

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: "ms" | "bytes" | "count" | "percent" | "ops/sec";
  timestamp: Date;
  tags?: Record<string, string>;
  labels?: Record<string, string>;
}

export interface TransactionContext {
  id: string;
  name: string;
  type: "agent_execution" | "api_request" | "database_query" | "external_call";
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: "pending" | "success" | "error" | "timeout";
  metadata?: Record<string, unknown>;
  errors?: Error[];
  spans?: Span[];
}

export interface Span {
  id: string;
  parentId?: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  tags?: Record<string, string>;
  logs?: LogEntry[];
}

export interface LogEntry {
  timestamp: Date;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  fields?: Record<string, unknown>;
}

export interface APMConfig {
  provider: "datadog" | "newrelic" | "prometheus" | "custom";
  enabled: boolean;
  samplingRate: number;
  flushInterval: number;
  batchSize: number;
  apiKey?: string;
  endpoint?: string;
  serviceName: string;
  environment: string;
  version: string;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    heapUsed: number;
    heapTotal: number;
  };
  disk: {
    used: number;
    total: number;
    freeSpace: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
}

export class PerformanceMonitor extends EventEmitter {
  private config: APMConfig;
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private activeTransactions: Map<string, TransactionContext> = new Map();
  private systemMetricsInterval?: NodeJS.Timeout;
  private flushInterval?: NodeJS.Timeout;
  private startTime: Date = new Date();

  constructor(config: APMConfig) {
    super();
    this.setMaxListeners(50);
    this.config = config;

    if (config.enabled) {
      this.startSystemMetricsCollection();
      this.startPeriodicFlush();
    }
  }

  /**
   * Start a new transaction for tracking
   */
  startTransaction(
    name: string,
    type: TransactionContext["type"],
    metadata?: Record<string, unknown>,
  ): string {
    const transactionId = this.generateId();
    const transaction: TransactionContext = {
      id: transactionId,
      name,
      type,
      startTime: new Date(),
      status: "pending",
      metadata,
      spans: [],
    };

    this.activeTransactions.set(transactionId, transaction);
    this.emit("transaction:start", transaction);

    return transactionId;
  }

  /**
   * End a transaction
   */
  endTransaction(
    transactionId: string,
    status: TransactionContext["status"] = "success",
    error?: Error,
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      console.warn(`Transaction ${transactionId} not found`);
      return;
    }

    transaction.endTime = new Date();
    transaction.duration =
      transaction.endTime.getTime() - transaction.startTime.getTime();
    transaction.status = status;

    if (error) {
      transaction.errors = transaction.errors || [];
      transaction.errors.push(error);
    }

    this.recordMetric({
      name: `transaction.duration`,
      value: transaction.duration,
      unit: "ms",
      timestamp: transaction.endTime,
      tags: {
        transaction_name: transaction.name,
        transaction_type: transaction.type,
        status: transaction.status,
      },
    });

    this.activeTransactions.delete(transactionId);
    this.emit("transaction:end", transaction);
  }

  /**
   * Start a span within a transaction
   */
  startSpan(
    transactionId: string,
    name: string,
    parentSpanId?: string,
  ): string {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    const spanId = this.generateId();
    const span: Span = {
      id: spanId,
      parentId: parentSpanId,
      name,
      startTime: new Date(),
      tags: {},
      logs: [],
    };

    transaction.spans = transaction.spans || [];
    transaction.spans.push(span);

    return spanId;
  }

  /**
   * End a span
   */
  endSpan(
    transactionId: string,
    spanId: string,
    tags?: Record<string, string>,
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return;

    const span = transaction.spans?.find((s) => s.id === spanId);
    if (!span) return;

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    if (tags) {
      span.tags = { ...span.tags, ...tags };
    }
  }

  /**
   * Record a custom metric
   */
  recordMetric(metric: PerformanceMetric): void {
    if (!this.config.enabled) return;

    const key = metric.name;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const metricArray = this.metrics.get(key);
    if (metricArray) {
      metricArray.push(metric);
    }
    this.emit("metric:recorded", metric);

    // Apply sampling
    if (Math.random() > this.config.samplingRate) {
      return;
    }

    // Send to APM provider if configured
    this.sendToProvider(metric);
  }

  /**
   * Record agent performance metrics
   */
  recordAgentMetrics(
    agentId: string,
    metrics: {
      executionTime: number;
      tokensUsed: number;
      memoryUsage: number;
      qualityScore?: number;
    },
  ): void {
    const timestamp = new Date();
    const tags = { agent_id: agentId };

    this.recordMetric({
      name: "agent.execution_time",
      value: metrics.executionTime,
      unit: "ms",
      timestamp,
      tags,
    });

    this.recordMetric({
      name: "agent.tokens_used",
      value: metrics.tokensUsed,
      unit: "count",
      timestamp,
      tags,
    });

    this.recordMetric({
      name: "agent.memory_usage",
      value: metrics.memoryUsage,
      unit: "bytes",
      timestamp,
      tags,
    });

    if (metrics.qualityScore !== undefined) {
      this.recordMetric({
        name: "agent.quality_score",
        value: metrics.qualityScore,
        unit: "count",
        timestamp,
        tags,
      });
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      cpu: {
        usage: this.calculateCpuUsage(cpuUsage),
        loadAverage: require("os").loadavg(),
      },
      memory: {
        used: memUsage.rss,
        total: require("os").totalmem(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
      },
      disk: await this.getDiskMetrics(),
      network: await this.getNetworkMetrics(),
    };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(timeWindow: number = 300000): {
    transactions: {
      total: number;
      successful: number;
      failed: number;
      averageDuration: number;
    };
    agents: {
      totalExecutions: number;
      averageExecutionTime: number;
      averageQualityScore: number;
    };
    system: SystemMetrics;
  } {
    const now = Date.now();
    const cutoff = now - timeWindow;

    // Aggregate transaction metrics
    const transactionMetrics = Array.from(
      this.metrics.get("transaction.duration") || [],
    ).filter((m) => m.timestamp.getTime() > cutoff);

    const successful = transactionMetrics.filter(
      (m) => m.tags?.status === "success",
    ).length;
    const failed = transactionMetrics.filter(
      (m) => m.tags?.status !== "success",
    ).length;
    const avgDuration =
      transactionMetrics.reduce((sum, m) => sum + m.value, 0) /
        transactionMetrics.length || 0;

    // Aggregate agent metrics
    const agentExecutionMetrics = Array.from(
      this.metrics.get("agent.execution_time") || [],
    ).filter((m) => m.timestamp.getTime() > cutoff);

    const qualityMetrics = Array.from(
      this.metrics.get("agent.quality_score") || [],
    ).filter((m) => m.timestamp.getTime() > cutoff);

    const avgExecutionTime =
      agentExecutionMetrics.reduce((sum, m) => sum + m.value, 0) /
        agentExecutionMetrics.length || 0;
    const avgQualityScore =
      qualityMetrics.reduce((sum, m) => sum + m.value, 0) /
        qualityMetrics.length || 0;

    return {
      transactions: {
        total: transactionMetrics.length,
        successful,
        failed,
        averageDuration: avgDuration,
      },
      agents: {
        totalExecutions: agentExecutionMetrics.length,
        averageExecutionTime: avgExecutionTime,
        averageQualityScore: avgQualityScore,
      },
      system: {} as SystemMetrics, // Will be populated by real-time call
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string {
    const lines: string[] = [];

    for (const [metricName, metricArray] of this.metrics.entries()) {
      const sanitizedName = metricName.replace(/[^a-zA-Z0-9_]/g, "_");

      // Add help text
      lines.push(
        `# HELP ${sanitizedName} Performance metric for ${metricName}`,
      );
      lines.push(`# TYPE ${sanitizedName} gauge`);

      // Add recent metrics
      const recentMetrics = metricArray.slice(-100); // Last 100 entries
      for (const metric of recentMetrics) {
        const labels = this.formatPrometheusLabels(metric.tags || {});
        lines.push(
          `${sanitizedName}${labels} ${
            metric.value
          } ${metric.timestamp.getTime()}`,
        );
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Cleanup and shutdown
   */
  shutdown(): void {
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    // Flush remaining metrics
    this.flushMetrics();
    this.emit("shutdown");
  }

  private startSystemMetricsCollection(): void {
    this.systemMetricsInterval = setInterval(async () => {
      try {
        const metrics = await this.getSystemMetrics();

        this.recordMetric({
          name: "system.cpu.usage",
          value: metrics.cpu.usage,
          unit: "percent",
          timestamp: new Date(),
        });

        this.recordMetric({
          name: "system.memory.usage",
          value: (metrics.memory.used / metrics.memory.total) * 100,
          unit: "percent",
          timestamp: new Date(),
        });

        this.recordMetric({
          name: "system.disk.usage",
          value: (metrics.disk.used / metrics.disk.total) * 100,
          unit: "percent",
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Failed to collect system metrics:", error);
      }
    }, 60000); // Every minute
  }

  private startPeriodicFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, this.config.flushInterval);
  }

  private flushMetrics(): void {
    if (!this.config.enabled) return;

    // Batch metrics for efficient sending
    const batches: PerformanceMetric[][] = [];
    const allMetrics = Array.from(this.metrics.values()).flat();

    for (let i = 0; i < allMetrics.length; i += this.config.batchSize) {
      batches.push(allMetrics.slice(i, i + this.config.batchSize));
    }

    for (const batch of batches) {
      this.sendBatchToProvider(batch);
    }

    // Clear old metrics to prevent memory leaks
    this.clearOldMetrics();
  }

  private sendToProvider(metric: PerformanceMetric): void {
    switch (this.config.provider) {
      case "datadog":
        this.sendToDatadog([metric]);
        break;
      case "newrelic":
        this.sendToNewRelic([metric]);
        break;
      case "prometheus":
        // Prometheus pulls metrics, no push needed
        break;
      case "custom":
        this.emit("metric:send", metric);
        break;
    }
  }

  private sendBatchToProvider(metrics: PerformanceMetric[]): void {
    switch (this.config.provider) {
      case "datadog":
        this.sendToDatadog(metrics);
        break;
      case "newrelic":
        this.sendToNewRelic(metrics);
        break;
      case "custom":
        this.emit("metrics:batch", metrics);
        break;
    }
  }

  private async sendToDatadog(metrics: PerformanceMetric[]): Promise<void> {
    if (!this.config.apiKey || !this.config.endpoint) return;

    const payload = {
      series: metrics.map((metric) => ({
        metric: `synthetic_agents.${metric.name}`,
        points: [[metric.timestamp.getTime() / 1000, metric.value]],
        tags: Object.entries(metric.tags || {}).map(([k, v]) => `${k}:${v}`),
        host: require("os").hostname(),
        type: "gauge",
      })),
    };

    try {
      await fetch(`${this.config.endpoint}/api/v1/series`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "DD-API-KEY": this.config.apiKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to send metrics to Datadog:", error);
    }
  }

  private async sendToNewRelic(metrics: PerformanceMetric[]): Promise<void> {
    if (!this.config.apiKey || !this.config.endpoint) return;

    const payload = metrics.map((metric) => ({
      metrics: [
        {
          name: `synthetic.agents.${metric.name}`,
          type: "gauge",
          value: metric.value,
          timestamp: metric.timestamp.getTime(),
          attributes: {
            ...metric.tags,
            service: this.config.serviceName,
            environment: this.config.environment,
          },
        },
      ],
    }));

    try {
      await fetch(`${this.config.endpoint}/metric/v1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": this.config.apiKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to send metrics to New Relic:", error);
    }
  }

  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    const total = cpuUsage.user + cpuUsage.system;
    return (total / 1000000) * 100; // Convert microseconds to percentage
  }

  private async getDiskMetrics(): Promise<{
    used: number;
    total: number;
    freeSpace: number;
  }> {
    try {
      const fs = require("fs").promises;
      const stats = await fs.statfs("./");
      const total = stats.blocks * stats.blksize;
      const free = stats.bavail * stats.blksize;
      const used = total - free;

      return { used, total, freeSpace: free };
    } catch {
      return { used: 0, total: 0, freeSpace: 0 };
    }
  }

  private async getNetworkMetrics(): Promise<{
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  }> {
    // Simplified network metrics - would need platform-specific implementation
    return { bytesIn: 0, bytesOut: 0, connectionsActive: 0 };
  }

  private formatPrometheusLabels(tags: Record<string, string>): string {
    const entries = Object.entries(tags);
    if (entries.length === 0) return "";

    const labelPairs = entries.map(([key, value]) => `${key}="${value}"`);
    return `{${labelPairs.join(",")}}`;
  }

  private clearOldMetrics(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago

    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter((m) => m.timestamp.getTime() > cutoff);
      this.metrics.set(key, filtered);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global performance monitor instance
let globalMonitor: PerformanceMonitor | null = null;

export function initializePerformanceMonitoring(
  config: APMConfig,
): PerformanceMonitor {
  if (globalMonitor) {
    globalMonitor.shutdown();
  }

  globalMonitor = new PerformanceMonitor(config);
  return globalMonitor;
}

export function getPerformanceMonitor(): PerformanceMonitor | null {
  return globalMonitor;
}

// Decorator for automatic performance tracking
export function trackPerformance(metricName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const name = metricName || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const monitor = getPerformanceMonitor();
      if (!monitor) {
        return originalMethod.apply(this, args);
      }

      const transactionId = monitor.startTransaction(name, "agent_execution", {
        class: target.constructor.name,
        method: propertyKey,
        args: args.length,
      });

      try {
        const startTime = Date.now();
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - startTime;

        monitor.recordMetric({
          name: `method.duration`,
          value: duration,
          unit: "ms",
          timestamp: new Date(),
          tags: {
            class: target.constructor.name,
            method: propertyKey,
          },
        });

        monitor.endTransaction(transactionId, "success");
        return result;
      } catch (error) {
        monitor.endTransaction(transactionId, "error", error as Error);
        throw error;
      }
    };

    return descriptor;
  };
}
