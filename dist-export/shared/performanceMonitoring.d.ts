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
export declare class PerformanceMonitor extends EventEmitter {
  private config;
  private metrics;
  private activeTransactions;
  private systemMetricsInterval?;
  private flushInterval?;
  private startTime;
  constructor(config: APMConfig);
  /**
   * Start a new transaction for tracking
   */
  startTransaction(
    name: string,
    type: TransactionContext["type"],
    metadata?: Record<string, unknown>,
  ): string;
  /**
   * End a transaction
   */
  endTransaction(
    transactionId: string,
    status?: TransactionContext["status"],
    error?: Error,
  ): void;
  /**
   * Start a span within a transaction
   */
  startSpan(transactionId: string, name: string, parentSpanId?: string): string;
  /**
   * End a span
   */
  endSpan(
    transactionId: string,
    spanId: string,
    tags?: Record<string, string>,
  ): void;
  /**
   * Record a custom metric
   */
  recordMetric(metric: PerformanceMetric): void;
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
  ): void;
  /**
   * Get system metrics
   */
  getSystemMetrics(): Promise<SystemMetrics>;
  /**
   * Get performance summary
   */
  getPerformanceSummary(timeWindow?: number): {
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
  };
  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusMetrics(): string;
  /**
   * Cleanup and shutdown
   */
  shutdown(): void;
  private startSystemMetricsCollection;
  private startPeriodicFlush;
  private flushMetrics;
  private sendToProvider;
  private sendBatchToProvider;
  private sendToDatadog;
  private sendToNewRelic;
  private calculateCpuUsage;
  private getDiskMetrics;
  private getNetworkMetrics;
  private formatPrometheusLabels;
  private clearOldMetrics;
  private generateId;
}
export declare function initializePerformanceMonitoring(
  config: APMConfig,
): PerformanceMonitor;
export declare function getPerformanceMonitor(): PerformanceMonitor | null;
export declare function trackPerformance(
  metricName?: string,
): (
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
) => PropertyDescriptor;
//# sourceMappingURL=performanceMonitoring.d.ts.map
