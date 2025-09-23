/**
 * Error Tracking System - Centralized error monitoring and reporting
 */
/**
 * Error tracking service
 */
export class ErrorTracker {
    config;
    errorBuffer = [];
    maxBufferSize = 100;
    constructor(config) {
        this.config = config;
        this.setupGlobalErrorHandlers();
    }
    /**
     * Track an error with context
     */
    async trackError(error, context = {}, severity = "medium") {
        try {
            const errorObj = typeof error === "string" ? new Error(error) : error;
            const report = {
                id: this.generateErrorId(),
                timestamp: new Date(),
                error: {
                    name: errorObj.name,
                    message: errorObj.message,
                    stack: errorObj.stack,
                    code: errorObj.code,
                },
                context: {
                    ...context,
                    environment: this.config.environment,
                },
                severity,
                fingerprint: this.generateFingerprint(errorObj, context),
                environment: this.config.environment,
                tags: this.generateTags(errorObj, context, severity),
            };
            // Apply beforeSend filter if configured
            const processedReport = this.config.beforeSend
                ? this.config.beforeSend(report)
                : report;
            if (!processedReport) {
                return; // Error was filtered out
            }
            // Buffer the error
            this.bufferError(processedReport);
            // Log to console if enabled
            if (this.config.enableConsoleLogging) {
                this.logToConsole(processedReport);
            }
            // Send to remote tracking services
            if (this.config.enableRemoteTracking) {
                await this.sendToRemoteServices(processedReport);
            }
        }
        catch (trackingError) {
            console.error("Error tracking failed:", trackingError);
        }
    }
    /**
     * Track a critical error that requires immediate attention
     */
    async trackCriticalError(error, context = {}) {
        await this.trackError(error, context, "critical");
        // Send immediate notification for critical errors
        await this.sendImmediateNotification(error, context);
    }
    /**
     * Add breadcrumb for debugging context
     */
    addBreadcrumb(message, category = "default", level = "info", data) {
        const breadcrumb = {
            timestamp: new Date().toISOString(),
            message,
            category,
            level,
            data,
        };
        // Store breadcrumbs in context for next error
        if (!globalThis.__errorTrackingBreadcrumbs) {
            globalThis.__errorTrackingBreadcrumbs = [];
        }
        globalThis.__errorTrackingBreadcrumbs.push(breadcrumb);
        // Keep only last 20 breadcrumbs
        if (globalThis.__errorTrackingBreadcrumbs.length > 20) {
            globalThis.__errorTrackingBreadcrumbs.shift();
        }
    }
    /**
     * Set user context for error tracking
     */
    setUserContext(context) {
        globalThis.__errorTrackingUserContext = context;
    }
    /**
     * Get error statistics
     */
    getErrorStats() {
        const totalErrors = this.errorBuffer.length;
        const errorsByType = this.errorBuffer.reduce((acc, report) => {
            acc[report.error.name] = (acc[report.error.name] || 0) + 1;
            return acc;
        }, {});
        const errorsBySeverity = this.errorBuffer.reduce((acc, report) => {
            acc[report.severity] = (acc[report.severity] || 0) + 1;
            return acc;
        }, {});
        const recentErrors = this.errorBuffer
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 10);
        return {
            totalErrors,
            errorsByType,
            errorsBySeverity,
            recentErrors,
        };
    }
    /**
     * Setup global error handlers
     */
    setupGlobalErrorHandlers() {
        // Handle unhandled promise rejections
        if (typeof process !== "undefined") {
            process.on("unhandledRejection", (reason, promise) => {
                this.trackCriticalError(reason instanceof Error ? reason : new Error(String(reason)), {
                    operation: "unhandledRejection",
                    additionalData: { promise: promise.toString() },
                });
            });
            process.on("uncaughtException", (error) => {
                this.trackCriticalError(error, {
                    operation: "uncaughtException",
                });
            });
        }
        // Handle browser errors
        if (typeof globalThis !== "undefined" && globalThis.window) {
            globalThis.window.addEventListener("error", (event) => {
                this.trackError(new Error(event.message), {
                    operation: "windowError",
                    additionalData: {
                        filename: event.filename,
                        lineno: event.lineno,
                        colno: event.colno,
                    },
                });
            });
            globalThis.window.addEventListener("unhandledrejection", (event) => {
                this.trackCriticalError(event.reason instanceof Error
                    ? event.reason
                    : new Error(String(event.reason)), {
                    operation: "unhandledRejection",
                });
            });
        }
    }
    /**
     * Generate unique error ID
     */
    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
    /**
     * Generate error fingerprint for deduplication
     */
    generateFingerprint(error, context) {
        const hashInput = [
            error.name,
            error.message,
            context.operation || "",
            context.agentId || "",
        ].join("|");
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < hashInput.length; i++) {
            const char = hashInput.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
    /**
     * Generate tags for error categorization
     */
    generateTags(error, context, severity) {
        const tags = [
            `severity:${severity}`,
            `environment:${this.config.environment}`,
            `error_type:${error.name}`,
        ];
        if (context.agentId) {
            tags.push(`agent:${context.agentId}`);
        }
        if (context.operation) {
            tags.push(`operation:${context.operation}`);
        }
        if (context.userId) {
            tags.push(`user:${context.userId}`);
        }
        return tags;
    }
    /**
     * Buffer error for local storage
     */
    bufferError(report) {
        this.errorBuffer.push(report);
        // Maintain buffer size
        if (this.errorBuffer.length > this.maxBufferSize) {
            this.errorBuffer.shift();
        }
    }
    /**
     * Log error to console
     */
    logToConsole(report) {
        const logLevel = report.severity === "critical" || report.severity === "high"
            ? "error"
            : "warn";
        console[logLevel](`[ErrorTracker] ${report.severity.toUpperCase()}:`, {
            id: report.id,
            error: report.error.message,
            context: report.context,
            timestamp: report.timestamp.toISOString(),
        });
    }
    /**
     * Send error to remote tracking services
     */
    async sendToRemoteServices(report) {
        const promises = [];
        // Send to Sentry
        if (this.config.sentryDsn) {
            promises.push(this.sendToSentry(report));
        }
        // Send to Datadog
        if (this.config.datadogApiKey) {
            promises.push(this.sendToDatadog(report));
        }
        // Send to custom webhook (if configured)
        promises.push(this.sendToWebhook(report));
        try {
            await Promise.allSettled(promises);
        }
        catch (error) {
            console.error("Failed to send error to remote services:", error);
        }
    }
    /**
     * Send error to Sentry
     */
    async sendToSentry(report) {
        // Implementation would depend on Sentry SDK
        // For now, just log that we would send to Sentry
        console.debug(`Would send error ${report.id} to Sentry`);
    }
    /**
     * Send error to Datadog
     */
    async sendToDatadog(report) {
        // Implementation would depend on Datadog SDK
        console.debug(`Would send error ${report.id} to Datadog`);
    }
    /**
     * Send error to custom webhook
     */
    async sendToWebhook(report) {
        const webhookUrl = process.env.ERROR_WEBHOOK_URL;
        if (!webhookUrl) {
            return;
        }
        try {
            await fetch(webhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(report),
            });
        }
        catch (error) {
            console.debug("Failed to send error to webhook:", error);
        }
    }
    /**
     * Send immediate notification for critical errors
     */
    async sendImmediateNotification(error, context) {
        const slackWebhook = process.env.SLACK_ERROR_WEBHOOK;
        if (!slackWebhook) {
            return;
        }
        const errorMessage = typeof error === "string" ? error : error.message;
        const slackMessage = {
            text: `🚨 Critical Error in ${this.config.environment}`,
            attachments: [
                {
                    color: "danger",
                    fields: [
                        {
                            title: "Error",
                            value: errorMessage,
                            short: false,
                        },
                        {
                            title: "Context",
                            value: JSON.stringify(context, null, 2),
                            short: false,
                        },
                        {
                            title: "Environment",
                            value: this.config.environment,
                            short: true,
                        },
                        {
                            title: "Timestamp",
                            value: new Date().toISOString(),
                            short: true,
                        },
                    ],
                },
            ],
        };
        try {
            await fetch(slackWebhook, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(slackMessage),
            });
        }
        catch (notificationError) {
            console.error("Failed to send critical error notification:", notificationError);
        }
    }
}
/**
 * Global error tracker instance
 */
let globalErrorTracker;
/**
 * Initialize error tracking
 */
export function initializeErrorTracking(config) {
    const defaultConfig = {
        environment: process.env.ENVIRONMENT || process.env.NODE_ENV || "development",
        enableConsoleLogging: true,
        enableRemoteTracking: process.env.NODE_ENV === "production",
        sampleRate: 1.0,
        sentryDsn: process.env.SENTRY_DSN,
        datadogApiKey: process.env.DATADOG_API_KEY,
        ...config,
    };
    globalErrorTracker = new ErrorTracker(defaultConfig);
    return globalErrorTracker;
}
/**
 * Get global error tracker instance
 */
export function getErrorTracker() {
    if (!globalErrorTracker) {
        globalErrorTracker = initializeErrorTracking();
    }
    return globalErrorTracker;
}
/**
 * Convenience functions
 */
export async function trackError(error, context, severity) {
    const tracker = getErrorTracker();
    await tracker.trackError(error, context, severity);
}
export async function trackCriticalError(error, context) {
    const tracker = getErrorTracker();
    await tracker.trackCriticalError(error, context);
}
export function addBreadcrumb(message, category, level, data) {
    const tracker = getErrorTracker();
    tracker.addBreadcrumb(message, category, level, data);
}
export function setUserContext(context) {
    const tracker = getErrorTracker();
    tracker.setUserContext(context);
}
//# sourceMappingURL=errorTracking.js.map