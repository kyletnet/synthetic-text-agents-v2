/**
 * Log Aggregation and Analysis System
 * Provides centralized log collection, processing, and analysis
 */
import { EventEmitter } from "events";
export interface LogEntry {
    id: string;
    timestamp: Date;
    level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
    message: string;
    service: string;
    component: string;
    traceId?: string;
    spanId?: string;
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
    tags?: Record<string, string>;
    duration?: number;
    statusCode?: number;
    errorCode?: string;
    stackTrace?: string;
}
export interface LogFilter {
    levels?: LogEntry["level"][];
    services?: string[];
    components?: string[];
    timeRange?: {
        start: Date;
        end: Date;
    };
    userId?: string;
    traceId?: string;
    errorCode?: string;
    textSearch?: string;
    tags?: Record<string, string>;
}
export interface LogAggregationConfig {
    enabled: boolean;
    bufferSize: number;
    flushInterval: number;
    retentionDays: number;
    compressionEnabled: boolean;
    indexingEnabled: boolean;
    storageBackend: "file" | "elasticsearch" | "splunk" | "datadog";
    storagePath?: string;
    elasticsearchUrl?: string;
    maxLogSize: number;
    enableSampling: boolean;
    samplingRate: number;
}
export interface LogMetrics {
    totalLogs: number;
    logsByLevel: Record<LogEntry["level"], number>;
    logsByService: Record<string, number>;
    errorRate: number;
    averageLogSize: number;
    indexSize: number;
    oldestLog: Date | null;
    newestLog: Date | null;
}
export interface LogAnalysis {
    summary: {
        totalLogs: number;
        timeRange: {
            start: Date;
            end: Date;
        };
        topServices: Array<{
            service: string;
            count: number;
        }>;
        topComponents: Array<{
            component: string;
            count: number;
        }>;
        errorDistribution: Record<LogEntry["level"], number>;
    };
    patterns: {
        frequentErrors: Array<{
            message: string;
            count: number;
            services: string[];
            lastOccurrence: Date;
        }>;
        slowOperations: Array<{
            component: string;
            averageDuration: number;
            count: number;
        }>;
        volumeSpikes: Array<{
            timestamp: Date;
            count: number;
            services: string[];
        }>;
    };
    anomalies: Array<{
        type: "error_spike" | "slow_response" | "volume_anomaly" | "new_error";
        severity: "low" | "medium" | "high" | "critical";
        timestamp: Date;
        description: string;
        affectedServices: string[];
        suggestion?: string;
    }>;
}
export declare class LogAggregator extends EventEmitter {
    private config;
    private logger;
    private buffer;
    private flushTimer?;
    private logIndex;
    private metrics;
    constructor(config: LogAggregationConfig);
    /**
     * Add a log entry to the aggregation system
     */
    addLog(entry: Omit<LogEntry, "id" | "timestamp">): void;
    /**
     * Query logs with filters
     */
    queryLogs(filter: LogFilter, limit?: number, offset?: number): Promise<{
        logs: LogEntry[];
        total: number;
        hasMore: boolean;
    }>;
    /**
     * Analyze logs for patterns and anomalies
     */
    analyzeLogs(timeRange?: {
        start: Date;
        end: Date;
    }): Promise<LogAnalysis>;
    /**
     * Get current log metrics
     */
    getMetrics(): LogMetrics;
    /**
     * Search logs by text
     */
    searchLogs(query: string, limit?: number): Promise<LogEntry[]>;
    /**
     * Get logs by trace ID
     */
    getLogsByTrace(traceId: string): Promise<LogEntry[]>;
    /**
     * Export logs in various formats
     */
    exportLogs(filter: LogFilter, format?: "json" | "csv" | "jsonl"): Promise<string>;
    /**
     * Clean up old logs based on retention policy
     */
    cleanup(): Promise<{
        deletedCount: number;
        sizeFreed: number;
    }>;
    /**
     * Force flush pending logs
     */
    flush(): Promise<void>;
    /**
     * Shutdown the log aggregator
     */
    shutdown(): Promise<void>;
    private startFlushTimer;
    private setupStorageBackend;
    private writeToStorage;
    private writeToFileStorage;
    private writeToElasticsearch;
    private writeToSplunk;
    private writeToDatadog;
    private updateMetrics;
    private indexLog;
    private queryFromIndex;
    private queryFromStorage;
    private applyFilters;
    private generateSummary;
    private detectPatterns;
    private detectAnomalies;
    private getEmptyAnalysis;
    private convertToCSV;
    private compressOldFiles;
    private cleanupFileStorage;
    private setupElasticsearch;
    private setupSplunk;
    private setupDatadog;
    private generateLogId;
}
export declare function initializeLogAggregation(config: LogAggregationConfig): LogAggregator;
export declare function getLogAggregator(): LogAggregator | null;
//# sourceMappingURL=logAggregation.d.ts.map