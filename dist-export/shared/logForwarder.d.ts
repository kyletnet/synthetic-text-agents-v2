/**
 * Log Forwarder
 * Forwards logs to external systems like ELK Stack, Splunk, or cloud providers
 */
import { EventEmitter } from "events";
import { LogEntry } from "./logAggregation";
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
export declare class LogForwarder extends EventEmitter {
  private config;
  private logger;
  private targets;
  private queues;
  private flushTimers;
  private rateLimiters;
  private status;
  constructor(config: LogForwarderConfig);
  /**
   * Forward a log entry to configured targets
   */
  forwardLog(logEntry: LogEntry): void;
  /**
   * Forward multiple log entries in batch
   */
  forwardBatch(logEntries: LogEntry[]): void;
  /**
   * Get forwarding status for all targets
   */
  getForwardingStatus(): Record<string, ForwardingStatus>;
  /**
   * Manually flush all queues
   */
  flushAll(): Promise<void>;
  /**
   * Flush logs for a specific target
   */
  flushTarget(targetName: string): Promise<void>;
  /**
   * Enable or disable a specific target
   */
  setTargetEnabled(targetName: string, enabled: boolean): void;
  /**
   * Update configuration for a target
   */
  updateTarget(targetName: string, updates: Partial<LogForwardingTarget>): void;
  /**
   * Shutdown the log forwarder
   */
  shutdown(): Promise<void>;
  private initializeTargets;
  private startFlushTimers;
  private shouldForwardToTarget;
  private addToQueue;
  private transformLogEntry;
  private sendToTarget;
  private sendToElasticsearch;
  private sendToSplunk;
  private sendToDatadog;
  private sendToNewRelic;
  private sendToCloudWatch;
  private sendToFluentd;
  private sendToWebhook;
  private buildHeaders;
  private initializeRateLimiter;
  private checkRateLimit;
  private updateStatus;
}
export declare function initializeLogForwarder(
  config: LogForwarderConfig,
): LogForwarder;
export declare function getLogForwarder(): LogForwarder | null;
//# sourceMappingURL=logForwarder.d.ts.map
