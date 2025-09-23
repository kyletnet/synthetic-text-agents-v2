/**
 * Log Aggregation and Analysis System
 * Provides centralized log collection, processing, and analysis
 */
import { EventEmitter } from "events";
import { Logger } from "./logger";
import * as fs from "fs/promises";
import * as path from "path";
export class LogAggregator extends EventEmitter {
    config;
    logger;
    buffer = [];
    flushTimer;
    logIndex = new Map();
    metrics = {
        totalLogs: 0,
        logsByLevel: {
            trace: 0,
            debug: 0,
            info: 0,
            warn: 0,
            error: 0,
            fatal: 0,
        },
        logsByService: {},
        errorRate: 0,
        averageLogSize: 0,
        indexSize: 0,
        oldestLog: null,
        newestLog: null,
    };
    constructor(config) {
        super();
        this.config = config;
        this.logger = new Logger({ level: "info" });
        if (config.enabled) {
            this.startFlushTimer();
            this.setupStorageBackend();
        }
    }
    /**
     * Add a log entry to the aggregation system
     */
    addLog(entry) {
        if (!this.config.enabled)
            return;
        // Apply sampling if enabled
        if (this.config.enableSampling &&
            Math.random() > this.config.samplingRate) {
            return;
        }
        const logEntry = {
            id: this.generateLogId(),
            timestamp: new Date(),
            ...entry,
        };
        // Check log size limit
        const logSize = JSON.stringify(logEntry).length;
        if (logSize > this.config.maxLogSize) {
            this.logger.warn(`Log entry exceeds max size (${logSize} > ${this.config.maxLogSize}), truncating`);
            logEntry.message =
                logEntry.message.substring(0, this.config.maxLogSize - 1000) +
                    "... [TRUNCATED]";
        }
        this.buffer.push(logEntry);
        this.updateMetrics(logEntry);
        // Index for fast searching
        if (this.config.indexingEnabled) {
            this.indexLog(logEntry);
        }
        // Auto-flush if buffer is full
        if (this.buffer.length >= this.config.bufferSize) {
            this.flush();
        }
        this.emit("log:added", logEntry);
    }
    /**
     * Query logs with filters
     */
    async queryLogs(filter, limit = 1000, offset = 0) {
        let logs = [];
        if (this.config.indexingEnabled) {
            logs = this.queryFromIndex(filter);
        }
        else {
            logs = await this.queryFromStorage(filter);
        }
        // Apply additional filtering
        logs = this.applyFilters(logs, filter);
        // Sort by timestamp (newest first)
        logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        const total = logs.length;
        const paginatedLogs = logs.slice(offset, offset + limit);
        return {
            logs: paginatedLogs,
            total,
            hasMore: offset + limit < total,
        };
    }
    /**
     * Analyze logs for patterns and anomalies
     */
    async analyzeLogs(timeRange) {
        const filter = timeRange ? { timeRange } : {};
        const queryResult = await this.queryLogs(filter, 10000); // Analyze up to 10k logs
        const logs = queryResult.logs;
        if (logs.length === 0) {
            return this.getEmptyAnalysis();
        }
        return {
            summary: this.generateSummary(logs),
            patterns: this.detectPatterns(logs),
            anomalies: this.detectAnomalies(logs),
        };
    }
    /**
     * Get current log metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Search logs by text
     */
    async searchLogs(query, limit = 100) {
        const filter = { textSearch: query };
        const result = await this.queryLogs(filter, limit);
        return result.logs;
    }
    /**
     * Get logs by trace ID
     */
    async getLogsByTrace(traceId) {
        const filter = { traceId };
        const result = await this.queryLogs(filter, 1000);
        return result.logs;
    }
    /**
     * Export logs in various formats
     */
    async exportLogs(filter, format = "json") {
        const result = await this.queryLogs(filter, 50000); // Max 50k for export
        const logs = result.logs;
        switch (format) {
            case "json":
                return JSON.stringify(logs, null, 2);
            case "jsonl":
                return logs.map((log) => JSON.stringify(log)).join("\n");
            case "csv":
                return this.convertToCSV(logs);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    /**
     * Clean up old logs based on retention policy
     */
    async cleanup() {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - this.config.retentionDays);
        let deletedCount = 0;
        let sizeFreed = 0;
        // Clean buffer
        const originalBufferSize = this.buffer.length;
        this.buffer = this.buffer.filter((log) => log.timestamp > cutoff);
        deletedCount += originalBufferSize - this.buffer.length;
        // Clean index
        for (const [key, logs] of this.logIndex.entries()) {
            const originalSize = logs.length;
            const filtered = logs.filter((log) => log.timestamp > cutoff);
            this.logIndex.set(key, filtered);
            deletedCount += originalSize - filtered.length;
        }
        // Clean storage backend
        if (this.config.storageBackend === "file" && this.config.storagePath) {
            sizeFreed = await this.cleanupFileStorage(cutoff);
        }
        this.logger.info(`Cleanup completed: ${deletedCount} logs deleted, ${sizeFreed} bytes freed`);
        return { deletedCount, sizeFreed };
    }
    /**
     * Force flush pending logs
     */
    async flush() {
        if (this.buffer.length === 0)
            return;
        const logsToFlush = [...this.buffer];
        this.buffer = [];
        try {
            await this.writeToStorage(logsToFlush);
            this.emit("logs:flushed", { count: logsToFlush.length });
        }
        catch (error) {
            this.logger.error("Failed to flush logs to storage:", error);
            // Return logs to buffer for retry
            this.buffer.unshift(...logsToFlush);
            throw error;
        }
    }
    /**
     * Shutdown the log aggregator
     */
    async shutdown() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
        }
        // Flush remaining logs
        await this.flush();
        this.emit("shutdown");
    }
    startFlushTimer() {
        this.flushTimer = setInterval(() => {
            this.flush().catch((error) => {
                this.logger.error("Scheduled flush failed:", error);
            });
        }, this.config.flushInterval);
    }
    async setupStorageBackend() {
        switch (this.config.storageBackend) {
            case "file":
                if (this.config.storagePath) {
                    await fs.mkdir(this.config.storagePath, { recursive: true });
                }
                break;
            case "elasticsearch":
                await this.setupElasticsearch();
                break;
            case "splunk":
                await this.setupSplunk();
                break;
            case "datadog":
                await this.setupDatadog();
                break;
        }
    }
    async writeToStorage(logs) {
        switch (this.config.storageBackend) {
            case "file":
                await this.writeToFileStorage(logs);
                break;
            case "elasticsearch":
                await this.writeToElasticsearch(logs);
                break;
            case "splunk":
                await this.writeToSplunk(logs);
                break;
            case "datadog":
                await this.writeToDatadog(logs);
                break;
        }
    }
    async writeToFileStorage(logs) {
        if (!this.config.storagePath)
            throw new Error("Storage path not configured");
        const today = new Date().toISOString().split("T")[0];
        const filename = `logs-${today}.jsonl`;
        const filepath = path.join(this.config.storagePath, filename);
        const logLines = logs.map((log) => JSON.stringify(log)).join("\n") + "\n";
        await fs.appendFile(filepath, logLines, "utf-8");
        // Compress old files if enabled
        if (this.config.compressionEnabled) {
            await this.compressOldFiles();
        }
    }
    async writeToElasticsearch(logs) {
        if (!this.config.elasticsearchUrl)
            throw new Error("Elasticsearch URL not configured");
        const bulkBody = logs.flatMap((log) => [
            { index: { _index: `logs-${new Date().toISOString().split("T")[0]}` } },
            log,
        ]);
        await fetch(`${this.config.elasticsearchUrl}/_bulk`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: bulkBody.map((item) => JSON.stringify(item)).join("\n") + "\n",
        });
    }
    async writeToSplunk(logs) {
        // Splunk HEC implementation would go here
        this.logger.warn("Splunk integration not yet implemented");
    }
    async writeToDatadog(logs) {
        // Datadog Logs API implementation would go here
        this.logger.warn("Datadog Logs integration not yet implemented");
    }
    updateMetrics(logEntry) {
        this.metrics.totalLogs++;
        this.metrics.logsByLevel[logEntry.level]++;
        if (!this.metrics.logsByService[logEntry.service]) {
            this.metrics.logsByService[logEntry.service] = 0;
        }
        this.metrics.logsByService[logEntry.service]++;
        if (!this.metrics.oldestLog ||
            logEntry.timestamp < this.metrics.oldestLog) {
            this.metrics.oldestLog = logEntry.timestamp;
        }
        if (!this.metrics.newestLog ||
            logEntry.timestamp > this.metrics.newestLog) {
            this.metrics.newestLog = logEntry.timestamp;
        }
        // Calculate error rate
        const errorLogs = this.metrics.logsByLevel.error + this.metrics.logsByLevel.fatal;
        this.metrics.errorRate = errorLogs / this.metrics.totalLogs;
        // Estimate average log size
        const logSize = JSON.stringify(logEntry).length;
        this.metrics.averageLogSize =
            (this.metrics.averageLogSize * (this.metrics.totalLogs - 1) + logSize) /
                this.metrics.totalLogs;
    }
    indexLog(logEntry) {
        // Index by service
        const serviceKey = `service:${logEntry.service}`;
        if (!this.logIndex.has(serviceKey)) {
            this.logIndex.set(serviceKey, []);
        }
        const serviceEntries = this.logIndex.get(serviceKey);
        if (serviceEntries) {
            serviceEntries.push(logEntry);
        }
        // Index by level
        const levelKey = `level:${logEntry.level}`;
        if (!this.logIndex.has(levelKey)) {
            this.logIndex.set(levelKey, []);
        }
        const levelEntries = this.logIndex.get(levelKey);
        if (levelEntries) {
            levelEntries.push(logEntry);
        }
        // Index by trace ID if present
        if (logEntry.traceId) {
            const traceKey = `trace:${logEntry.traceId}`;
            if (!this.logIndex.has(traceKey)) {
                this.logIndex.set(traceKey, []);
            }
            const traceEntries = this.logIndex.get(traceKey);
            if (traceEntries) {
                traceEntries.push(logEntry);
            }
        }
        this.metrics.indexSize = this.logIndex.size;
    }
    queryFromIndex(filter) {
        let results = [];
        // Query by service
        if (filter.services && filter.services.length > 0) {
            for (const service of filter.services) {
                const logs = this.logIndex.get(`service:${service}`) || [];
                results.push(...logs);
            }
        }
        // Query by trace ID
        if (filter.traceId) {
            const logs = this.logIndex.get(`trace:${filter.traceId}`) || [];
            results.push(...logs);
        }
        // If no specific filters, get all logs from buffer
        if (results.length === 0) {
            results = [...this.buffer];
        }
        return results;
    }
    async queryFromStorage(filter) {
        // This would implement storage-specific querying
        // For now, return buffer contents
        return [...this.buffer];
    }
    applyFilters(logs, filter) {
        return logs.filter((log) => {
            // Level filter
            if (filter.levels && !filter.levels.includes(log.level)) {
                return false;
            }
            // Time range filter
            if (filter.timeRange) {
                if (log.timestamp < filter.timeRange.start ||
                    log.timestamp > filter.timeRange.end) {
                    return false;
                }
            }
            // User ID filter
            if (filter.userId && log.userId !== filter.userId) {
                return false;
            }
            // Error code filter
            if (filter.errorCode && log.errorCode !== filter.errorCode) {
                return false;
            }
            // Text search filter
            if (filter.textSearch) {
                const searchText = filter.textSearch.toLowerCase();
                if (!log.message.toLowerCase().includes(searchText)) {
                    return false;
                }
            }
            // Tags filter
            if (filter.tags) {
                for (const [key, value] of Object.entries(filter.tags)) {
                    if (!log.tags || log.tags[key] !== value) {
                        return false;
                    }
                }
            }
            return true;
        });
    }
    generateSummary(logs) {
        const services = new Map();
        const components = new Map();
        const errorDistribution = {
            trace: 0,
            debug: 0,
            info: 0,
            warn: 0,
            error: 0,
            fatal: 0,
        };
        let earliest = logs[0]?.timestamp;
        let latest = logs[0]?.timestamp;
        for (const log of logs) {
            services.set(log.service, (services.get(log.service) || 0) + 1);
            components.set(log.component, (components.get(log.component) || 0) + 1);
            errorDistribution[log.level]++;
            if (log.timestamp < earliest)
                earliest = log.timestamp;
            if (log.timestamp > latest)
                latest = log.timestamp;
        }
        return {
            totalLogs: logs.length,
            timeRange: { start: earliest, end: latest },
            topServices: Array.from(services.entries())
                .map(([service, count]) => ({ service, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            topComponents: Array.from(components.entries())
                .map(([component, count]) => ({ component, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            errorDistribution,
        };
    }
    detectPatterns(logs) {
        // Detect frequent errors
        const errorMessages = new Map();
        // Detect slow operations
        const slowOperations = new Map();
        for (const log of logs) {
            if (log.level === "error" || log.level === "fatal") {
                const key = log.message;
                if (!errorMessages.has(key)) {
                    errorMessages.set(key, {
                        count: 0,
                        services: new Set(),
                        lastOccurrence: log.timestamp,
                    });
                }
                const errorData = errorMessages.get(key);
                if (!errorData)
                    continue;
                errorData.count++;
                errorData.services.add(log.service);
                if (log.timestamp > errorData.lastOccurrence) {
                    errorData.lastOccurrence = log.timestamp;
                }
            }
            if (log.duration && log.duration > 1000) {
                // Slow operations > 1s
                const key = log.component;
                if (!slowOperations.has(key)) {
                    slowOperations.set(key, { totalDuration: 0, count: 0 });
                }
                const opData = slowOperations.get(key);
                if (!opData)
                    continue;
                opData.totalDuration += log.duration;
                opData.count++;
            }
        }
        return {
            frequentErrors: Array.from(errorMessages.entries())
                .map(([message, data]) => ({
                message,
                count: data.count,
                services: Array.from(data.services),
                lastOccurrence: data.lastOccurrence,
            }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10),
            slowOperations: Array.from(slowOperations.entries())
                .map(([component, data]) => ({
                component,
                averageDuration: data.totalDuration / data.count,
                count: data.count,
            }))
                .sort((a, b) => b.averageDuration - a.averageDuration)
                .slice(0, 10),
            volumeSpikes: [], // Would implement volume spike detection
        };
    }
    detectAnomalies(logs) {
        const anomalies = [];
        // Detect error spikes
        const hourlyErrors = new Map();
        for (const log of logs) {
            if (log.level === "error" || log.level === "fatal") {
                const hour = new Date(log.timestamp).toISOString().substring(0, 13);
                hourlyErrors.set(hour, (hourlyErrors.get(hour) || 0) + 1);
            }
        }
        const avgErrorsPerHour = Array.from(hourlyErrors.values()).reduce((a, b) => a + b, 0) /
            hourlyErrors.size || 0;
        for (const [hour, count] of hourlyErrors.entries()) {
            if (count > avgErrorsPerHour * 3) {
                // 3x average
                anomalies.push({
                    type: "error_spike",
                    severity: count > avgErrorsPerHour * 10 ? "critical" : "high",
                    timestamp: new Date(hour + ":00:00.000Z"),
                    description: `Error spike detected: ${count} errors (${(count / avgErrorsPerHour).toFixed(1)}x average)`,
                    affectedServices: [],
                    suggestion: "Review error logs and check for system issues",
                });
            }
        }
        return anomalies.slice(0, 20); // Limit anomalies
    }
    getEmptyAnalysis() {
        return {
            summary: {
                totalLogs: 0,
                timeRange: { start: new Date(), end: new Date() },
                topServices: [],
                topComponents: [],
                errorDistribution: {
                    trace: 0,
                    debug: 0,
                    info: 0,
                    warn: 0,
                    error: 0,
                    fatal: 0,
                },
            },
            patterns: {
                frequentErrors: [],
                slowOperations: [],
                volumeSpikes: [],
            },
            anomalies: [],
        };
    }
    convertToCSV(logs) {
        const headers = [
            "timestamp",
            "level",
            "service",
            "component",
            "message",
            "traceId",
            "userId",
        ];
        const rows = logs.map((log) => [
            log.timestamp.toISOString(),
            log.level,
            log.service,
            log.component,
            log.message.replace(/"/g, '""'), // Escape quotes
            log.traceId || "",
            log.userId || "",
        ]);
        return [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");
    }
    async compressOldFiles() {
        // File compression implementation would go here
    }
    async cleanupFileStorage(cutoff) {
        if (!this.config.storagePath)
            return 0;
        let sizeFreed = 0;
        try {
            const files = await fs.readdir(this.config.storagePath);
            for (const file of files) {
                const filepath = path.join(this.config.storagePath, file);
                const stats = await fs.stat(filepath);
                if (stats.mtime < cutoff) {
                    sizeFreed += stats.size;
                    await fs.unlink(filepath);
                }
            }
        }
        catch (error) {
            this.logger.error("Error cleaning up file storage:", error);
        }
        return sizeFreed;
    }
    async setupElasticsearch() {
        // Elasticsearch setup implementation
    }
    async setupSplunk() {
        // Splunk setup implementation
    }
    async setupDatadog() {
        // Datadog setup implementation
    }
    generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
// Global log aggregator instance
let globalAggregator = null;
export function initializeLogAggregation(config) {
    if (globalAggregator) {
        globalAggregator.shutdown();
    }
    globalAggregator = new LogAggregator(config);
    return globalAggregator;
}
export function getLogAggregator() {
    return globalAggregator;
}
//# sourceMappingURL=logAggregation.js.map