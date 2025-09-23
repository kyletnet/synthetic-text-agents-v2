/**
 * Agent Logger
 * Standardized logging system for all agent operations
 * Provides common JSONL format with required fields for audit trails
 */
export interface BaseLogEntry {
    timestamp: string;
    run_id: string;
    item_id: string;
    agent_id: string;
    agent_role: string;
    session_id?: string;
    cost_usd: number;
    latency_ms: number;
    tokens_in?: number;
    tokens_out?: number;
    retries: number;
    operation: string;
    status: "started" | "completed" | "failed" | "retrying" | "skipped";
    error_type?: "TRANSIENT" | "PERMANENT" | "POLICY";
    error_message?: string;
    input_hash?: string;
    output_hash?: string;
    context_size?: number;
    log_level: "trace" | "debug" | "info" | "warn" | "error";
    correlation_id?: string;
    parent_trace_id?: string;
}
export interface AgentOperationLog extends BaseLogEntry {
    agent_version?: string;
    agent_config?: any;
    prompt_template?: string;
    model_name?: string;
    temperature?: number;
    input_data?: any;
    output_data?: any;
    reasoning?: string;
    quality_score?: number;
    confidence_score?: number;
    validation_result?: any;
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
export declare class AgentLogger {
    private logsDir;
    private config;
    private logBuffer;
    private flushTimer;
    constructor(config?: LoggerConfig);
    private ensureDirectoryExists;
    /**
     * Create a new trace context for a run/item
     */
    createTraceContext(runId: string, itemId: string, sessionId?: string): TraceContext;
    /**
     * Create child trace context
     */
    createChildTrace(parent: TraceContext): TraceContext;
    /**
     * Log agent operation start
     */
    logOperationStart(context: TraceContext, agentId: string, agentRole: string, operation: string, inputData?: any, additionalFields?: Partial<AgentOperationLog>): string;
    /**
     * Log agent operation completion
     */
    logOperationComplete(context: TraceContext, agentId: string, agentRole: string, operation: string, startTime: number, result: {
        cost_usd?: number;
        tokens_in?: number;
        tokens_out?: number;
        output_data?: any;
        quality_score?: number;
        confidence_score?: number;
        validation_result?: any;
    }, additionalFields?: Partial<AgentOperationLog>): void;
    /**
     * Log agent operation failure
     */
    logOperationFailure(context: TraceContext, agentId: string, agentRole: string, operation: string, startTime: number, error: Error, retryCount?: number, additionalFields?: Partial<AgentOperationLog>): void;
    /**
     * Log workflow step completion
     */
    logWorkflowStep(context: TraceContext, workflowStep: string, agentsInvolved: string[], stepResult: {
        duration_ms: number;
        cost_usd: number;
        success: boolean;
        output_data?: any;
    }, additionalFields?: Partial<AgentOperationLog>): void;
    /**
     * Log performance metrics
     */
    logPerformanceMetrics(context: TraceContext, metrics: {
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
    }): void;
    /**
     * Add log entry to buffer
     */
    private addToBuffer;
    /**
     * Flush log buffer to file
     */
    flush(): void;
    /**
     * Start automatic flush timer
     */
    private startFlushTimer;
    /**
     * Stop logger and flush remaining logs
     */
    stop(): void;
    /**
     * Classify error type for logging
     */
    private classifyError;
    /**
     * Generate unique correlation ID
     */
    private generateCorrelationId;
    /**
     * Calculate hash of data for consistency checking
     */
    private calculateHash;
    /**
     * Sanitize sensitive data for logging
     */
    private sanitizeData;
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
    }): AgentOperationLog[];
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
    };
}
/**
 * Initialize global agent logger
 */
export declare function initializeAgentLogger(config?: LoggerConfig): AgentLogger;
/**
 * Get global agent logger
 */
export declare function getAgentLogger(): AgentLogger;
/**
 * Convenience function for creating operation tracker
 */
export declare function createOperationTracker(context: TraceContext, agentId: string, agentRole: string, operation: string): {
    complete: (result: any) => void;
    fail: (error: Error, retryCount?: number) => void;
    correlationId: string;
};
//# sourceMappingURL=agent_logger.d.ts.map