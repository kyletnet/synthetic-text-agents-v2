/**
 * Error Tracking System - Centralized error monitoring and reporting
 */
export interface ErrorContext {
    userId?: string;
    sessionId?: string;
    requestId?: string;
    agentId?: string;
    operation?: string;
    environment?: string;
    userAgent?: string;
    ipAddress?: string;
    additionalData?: Record<string, unknown>;
}
export interface ErrorReport {
    id: string;
    timestamp: Date;
    error: {
        name: string;
        message: string;
        stack?: string;
        code?: string | number;
    };
    context: ErrorContext;
    severity: "low" | "medium" | "high" | "critical";
    fingerprint: string;
    environment: string;
    tags: string[];
}
export interface ErrorTrackingConfig {
    sentryDsn?: string;
    datadogApiKey?: string;
    environment: string;
    enableConsoleLogging: boolean;
    enableRemoteTracking: boolean;
    sampleRate: number;
    beforeSend?: (report: ErrorReport) => ErrorReport | null;
}
/**
 * Error tracking service
 */
export declare class ErrorTracker {
    private config;
    private errorBuffer;
    private readonly maxBufferSize;
    constructor(config: ErrorTrackingConfig);
    /**
     * Track an error with context
     */
    trackError(error: Error | string, context?: ErrorContext, severity?: ErrorReport["severity"]): Promise<void>;
    /**
     * Track a critical error that requires immediate attention
     */
    trackCriticalError(error: Error | string, context?: ErrorContext): Promise<void>;
    /**
     * Add breadcrumb for debugging context
     */
    addBreadcrumb(message: string, category?: string, level?: "debug" | "info" | "warning" | "error", data?: Record<string, unknown>): void;
    /**
     * Set user context for error tracking
     */
    setUserContext(context: Pick<ErrorContext, "userId" | "sessionId">): void;
    /**
     * Get error statistics
     */
    getErrorStats(): {
        totalErrors: number;
        errorsByType: Record<string, number>;
        errorsBySeverity: Record<string, number>;
        recentErrors: ErrorReport[];
    };
    /**
     * Setup global error handlers
     */
    private setupGlobalErrorHandlers;
    /**
     * Generate unique error ID
     */
    private generateErrorId;
    /**
     * Generate error fingerprint for deduplication
     */
    private generateFingerprint;
    /**
     * Generate tags for error categorization
     */
    private generateTags;
    /**
     * Buffer error for local storage
     */
    private bufferError;
    /**
     * Log error to console
     */
    private logToConsole;
    /**
     * Send error to remote tracking services
     */
    private sendToRemoteServices;
    /**
     * Send error to Sentry
     */
    private sendToSentry;
    /**
     * Send error to Datadog
     */
    private sendToDatadog;
    /**
     * Send error to custom webhook
     */
    private sendToWebhook;
    /**
     * Send immediate notification for critical errors
     */
    private sendImmediateNotification;
}
/**
 * Initialize error tracking
 */
export declare function initializeErrorTracking(config?: Partial<ErrorTrackingConfig>): ErrorTracker;
/**
 * Get global error tracker instance
 */
export declare function getErrorTracker(): ErrorTracker;
/**
 * Convenience functions
 */
export declare function trackError(error: Error | string, context?: ErrorContext, severity?: ErrorReport["severity"]): Promise<void>;
export declare function trackCriticalError(error: Error | string, context?: ErrorContext): Promise<void>;
export declare function addBreadcrumb(message: string, category?: string, level?: "debug" | "info" | "warning" | "error", data?: Record<string, unknown>): void;
export declare function setUserContext(context: Pick<ErrorContext, "userId" | "sessionId">): void;
//# sourceMappingURL=errorTracking.d.ts.map