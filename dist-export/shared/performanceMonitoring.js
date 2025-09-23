/**
 * Performance Monitoring and APM Integration
 * Provides comprehensive application performance monitoring with multiple provider support
 */
import { EventEmitter } from "events";
export class PerformanceMonitor extends EventEmitter {
    config;
    metrics = new Map();
    activeTransactions = new Map();
    systemMetricsInterval;
    flushInterval;
    startTime = new Date();
    constructor(config) {
        super();
        this.config = config;
        if (config.enabled) {
            this.startSystemMetricsCollection();
            this.startPeriodicFlush();
        }
    }
    /**
     * Start a new transaction for tracking
     */
    startTransaction(name, type, metadata) {
        const transactionId = this.generateId();
        const transaction = {
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
    endTransaction(transactionId, status = "success", error) {
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
    startSpan(transactionId, name, parentSpanId) {
        const transaction = this.activeTransactions.get(transactionId);
        if (!transaction) {
            throw new Error(`Transaction ${transactionId} not found`);
        }
        const spanId = this.generateId();
        const span = {
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
    endSpan(transactionId, spanId, tags) {
        const transaction = this.activeTransactions.get(transactionId);
        if (!transaction)
            return;
        const span = transaction.spans?.find((s) => s.id === spanId);
        if (!span)
            return;
        span.endTime = new Date();
        span.duration = span.endTime.getTime() - span.startTime.getTime();
        if (tags) {
            span.tags = { ...span.tags, ...tags };
        }
    }
    /**
     * Record a custom metric
     */
    recordMetric(metric) {
        if (!this.config.enabled)
            return;
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
    recordAgentMetrics(agentId, metrics) {
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
    async getSystemMetrics() {
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
    getPerformanceSummary(timeWindow = 300000) {
        const now = Date.now();
        const cutoff = now - timeWindow;
        // Aggregate transaction metrics
        const transactionMetrics = Array.from(this.metrics.get("transaction.duration") || []).filter((m) => m.timestamp.getTime() > cutoff);
        const successful = transactionMetrics.filter((m) => m.tags?.status === "success").length;
        const failed = transactionMetrics.filter((m) => m.tags?.status !== "success").length;
        const avgDuration = transactionMetrics.reduce((sum, m) => sum + m.value, 0) /
            transactionMetrics.length || 0;
        // Aggregate agent metrics
        const agentExecutionMetrics = Array.from(this.metrics.get("agent.execution_time") || []).filter((m) => m.timestamp.getTime() > cutoff);
        const qualityMetrics = Array.from(this.metrics.get("agent.quality_score") || []).filter((m) => m.timestamp.getTime() > cutoff);
        const avgExecutionTime = agentExecutionMetrics.reduce((sum, m) => sum + m.value, 0) /
            agentExecutionMetrics.length || 0;
        const avgQualityScore = qualityMetrics.reduce((sum, m) => sum + m.value, 0) /
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
            system: {}, // Will be populated by real-time call
        };
    }
    /**
     * Export metrics in Prometheus format
     */
    exportPrometheusMetrics() {
        const lines = [];
        for (const [metricName, metricArray] of this.metrics.entries()) {
            const sanitizedName = metricName.replace(/[^a-zA-Z0-9_]/g, "_");
            // Add help text
            lines.push(`# HELP ${sanitizedName} Performance metric for ${metricName}`);
            lines.push(`# TYPE ${sanitizedName} gauge`);
            // Add recent metrics
            const recentMetrics = metricArray.slice(-100); // Last 100 entries
            for (const metric of recentMetrics) {
                const labels = this.formatPrometheusLabels(metric.tags || {});
                lines.push(`${sanitizedName}${labels} ${metric.value} ${metric.timestamp.getTime()}`);
            }
            lines.push("");
        }
        return lines.join("\n");
    }
    /**
     * Cleanup and shutdown
     */
    shutdown() {
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
    startSystemMetricsCollection() {
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
            }
            catch (error) {
                console.error("Failed to collect system metrics:", error);
            }
        }, 60000); // Every minute
    }
    startPeriodicFlush() {
        this.flushInterval = setInterval(() => {
            this.flushMetrics();
        }, this.config.flushInterval);
    }
    flushMetrics() {
        if (!this.config.enabled)
            return;
        // Batch metrics for efficient sending
        const batches = [];
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
    sendToProvider(metric) {
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
    sendBatchToProvider(metrics) {
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
    async sendToDatadog(metrics) {
        if (!this.config.apiKey || !this.config.endpoint)
            return;
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
        }
        catch (error) {
            console.error("Failed to send metrics to Datadog:", error);
        }
    }
    async sendToNewRelic(metrics) {
        if (!this.config.apiKey || !this.config.endpoint)
            return;
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
        }
        catch (error) {
            console.error("Failed to send metrics to New Relic:", error);
        }
    }
    calculateCpuUsage(cpuUsage) {
        const total = cpuUsage.user + cpuUsage.system;
        return (total / 1000000) * 100; // Convert microseconds to percentage
    }
    async getDiskMetrics() {
        try {
            const fs = require("fs").promises;
            const stats = await fs.statfs("./");
            const total = stats.blocks * stats.blksize;
            const free = stats.bavail * stats.blksize;
            const used = total - free;
            return { used, total, freeSpace: free };
        }
        catch {
            return { used: 0, total: 0, freeSpace: 0 };
        }
    }
    async getNetworkMetrics() {
        // Simplified network metrics - would need platform-specific implementation
        return { bytesIn: 0, bytesOut: 0, connectionsActive: 0 };
    }
    formatPrometheusLabels(tags) {
        const entries = Object.entries(tags);
        if (entries.length === 0)
            return "";
        const labelPairs = entries.map(([key, value]) => `${key}="${value}"`);
        return `{${labelPairs.join(",")}}`;
    }
    clearOldMetrics() {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours ago
        for (const [key, metrics] of this.metrics.entries()) {
            const filtered = metrics.filter((m) => m.timestamp.getTime() > cutoff);
            this.metrics.set(key, filtered);
        }
    }
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
// Global performance monitor instance
let globalMonitor = null;
export function initializePerformanceMonitoring(config) {
    if (globalMonitor) {
        globalMonitor.shutdown();
    }
    globalMonitor = new PerformanceMonitor(config);
    return globalMonitor;
}
export function getPerformanceMonitor() {
    return globalMonitor;
}
// Decorator for automatic performance tracking
export function trackPerformance(metricName) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        const name = metricName || `${target.constructor.name}.${propertyKey}`;
        descriptor.value = async function (...args) {
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
            }
            catch (error) {
                monitor.endTransaction(transactionId, "error", error);
                throw error;
            }
        };
        return descriptor;
    };
}
//# sourceMappingURL=performanceMonitoring.js.map