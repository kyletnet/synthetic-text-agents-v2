import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
export class DLQManager {
    dlqDir;
    retryConfig;
    constructor(baseDir) {
        this.dlqDir = join(baseDir || process.cwd(), "reports", "dlq");
        this.ensureDirectoryExists();
        this.retryConfig = {
            max_retries: 3,
            initial_backoff_ms: 1000,
            max_backoff_ms: 30000,
            backoff_multiplier: 2.0,
            retry_jitter_pct: 10,
        };
    }
    ensureDirectoryExists() {
        if (!existsSync(this.dlqDir)) {
            mkdirSync(this.dlqDir, { recursive: true });
        }
    }
    /**
     * Add failed item to DLQ with appropriate error classification
     */
    addFailedItem(runId, itemId, originalData, error, context = {}) {
        const errorType = this.classifyError(error);
        const maxRetries = this.getMaxRetriesForErrorType(errorType);
        const backoffMs = this.calculateBackoff(0);
        const dlqItem = {
            id: `${runId}_${itemId}_${Date.now()}`,
            run_id: runId,
            item_id: itemId,
            original_data: originalData,
            error_type: errorType,
            error_message: error.message,
            first_failure_timestamp: new Date().toISOString(),
            last_retry_timestamp: new Date().toISOString(),
            retry_count: 0,
            max_retries: maxRetries,
            backoff_ms: backoffMs,
            next_retry_timestamp: new Date(Date.now() + backoffMs).toISOString(),
            context: {
                profile: context.profile || "dev",
                agent_role: context.agent_role,
                cost_budget_remaining: context.cost_budget_remaining,
                timeout_ms: context.timeout_ms,
            },
        };
        this.writeDLQItem(runId, dlqItem);
        return dlqItem;
    }
    /**
     * Classify error type for retry strategy
     */
    classifyError(error) {
        const message = error.message.toLowerCase();
        // P0 Policy violations - never retry
        if (message.includes("pii") ||
            message.includes("license") ||
            message.includes("copyright") ||
            message.includes("policy violation")) {
            return "POLICY";
        }
        // Permanent errors - don't retry
        if (message.includes("invalid input") ||
            message.includes("malformed") ||
            message.includes("authentication failed") ||
            message.includes("permission denied") ||
            error.name === "ValidationError") {
            return "PERMANENT";
        }
        // Transient errors - retry with backoff
        if (message.includes("429") || // Rate limit
            message.includes("rate limit") ||
            message.includes("timeout") ||
            message.includes("connection") ||
            message.includes("503") || // Service unavailable
            message.includes("502") || // Bad gateway
            message.includes("500") || // Internal server error
            error.name === "TimeoutError" ||
            error.name === "NetworkError") {
            return "TRANSIENT";
        }
        // Default to permanent for unknown errors
        return "PERMANENT";
    }
    /**
     * Get max retries based on error type
     */
    getMaxRetriesForErrorType(errorType) {
        switch (errorType) {
            case "TRANSIENT":
                return this.retryConfig.max_retries;
            case "PERMANENT":
                return 0;
            case "POLICY":
                return 0;
            default:
                return 0;
        }
    }
    /**
     * Calculate exponential backoff with jitter
     */
    calculateBackoff(retryCount) {
        const baseBackoff = Math.min(this.retryConfig.initial_backoff_ms *
            Math.pow(this.retryConfig.backoff_multiplier, retryCount), this.retryConfig.max_backoff_ms);
        // Add jitter to prevent thundering herd
        const jitter = baseBackoff * (this.retryConfig.retry_jitter_pct / 100);
        const jitterAmount = (Math.random() - 0.5) * 2 * jitter;
        return Math.max(100, Math.floor(baseBackoff + jitterAmount));
    }
    /**
     * Write DLQ item to file
     */
    writeDLQItem(runId, dlqItem) {
        const filePath = join(this.dlqDir, `${runId}.jsonl`);
        const line = JSON.stringify(dlqItem) + "\n";
        try {
            writeFileSync(filePath, line, { flag: "a" });
        }
        catch (_error) {
            console.error(`Failed to write DLQ item to ${filePath}:`, _error);
        }
    }
    /**
     * Get all pending retries that are ready to be processed
     */
    getPendingRetries(runId) {
        const now = new Date();
        const pendingItems = [];
        try {
            const files = runId ? [`${runId}.jsonl`] : this.getAllDLQFiles();
            for (const file of files) {
                const filePath = join(this.dlqDir, file);
                if (!existsSync(filePath))
                    continue;
                const content = readFileSync(filePath, "utf-8");
                const lines = content
                    .trim()
                    .split("\n")
                    .filter((line) => line.trim());
                for (const line of lines) {
                    try {
                        const item = JSON.parse(line);
                        // Check if item is ready for retry
                        if (item.retry_count < item.max_retries &&
                            new Date(item.next_retry_timestamp) <= now) {
                            pendingItems.push(item);
                        }
                    }
                    catch (_error) {
                        console.warn(`Failed to parse DLQ line: ${line}`);
                    }
                }
            }
        }
        catch (_error) {
            console.error("Failed to get pending retries:", _error);
        }
        return pendingItems;
    }
    /**
     * Mark retry attempt for item
     */
    markRetryAttempt(dlqItem, success, error) {
        const updatedItem = { ...dlqItem };
        updatedItem.retry_count++;
        updatedItem.last_retry_timestamp = new Date().toISOString();
        if (success) {
            // Remove from DLQ on success
            this.removeDLQItem(dlqItem.run_id, dlqItem.id);
            return null;
        }
        // Update for next retry if retries remaining
        if (updatedItem.retry_count < updatedItem.max_retries) {
            updatedItem.backoff_ms = this.calculateBackoff(updatedItem.retry_count);
            updatedItem.next_retry_timestamp = new Date(Date.now() + updatedItem.backoff_ms).toISOString();
            if (error) {
                updatedItem.error_message = error.message;
                updatedItem.error_type = this.classifyError(error);
            }
            // Update the DLQ file
            this.updateDLQItem(updatedItem);
            return updatedItem;
        }
        // Mark as exhausted (no more retries)
        updatedItem.next_retry_timestamp = "exhausted";
        this.updateDLQItem(updatedItem);
        return updatedItem;
    }
    /**
     * Update existing DLQ item in file
     */
    updateDLQItem(updatedItem) {
        const filePath = join(this.dlqDir, `${updatedItem.run_id}.jsonl`);
        try {
            if (!existsSync(filePath))
                return;
            const content = readFileSync(filePath, "utf-8");
            const lines = content
                .trim()
                .split("\n")
                .filter((line) => line.trim());
            const updatedLines = [];
            let found = false;
            for (const line of lines) {
                try {
                    const item = JSON.parse(line);
                    if (item.id === updatedItem.id) {
                        updatedLines.push(JSON.stringify(updatedItem));
                        found = true;
                    }
                    else {
                        updatedLines.push(line);
                    }
                }
                catch (_error) {
                    updatedLines.push(line); // Keep malformed lines as-is
                }
            }
            if (!found) {
                updatedLines.push(JSON.stringify(updatedItem));
            }
            writeFileSync(filePath, updatedLines.join("\n") + "\n");
        }
        catch (_error) {
            console.error(`Failed to update DLQ item ${updatedItem.id}:`, _error);
        }
    }
    /**
     * Remove DLQ item from file
     */
    removeDLQItem(runId, itemId) {
        const filePath = join(this.dlqDir, `${runId}.jsonl`);
        try {
            if (!existsSync(filePath))
                return;
            const content = readFileSync(filePath, "utf-8");
            const lines = content
                .trim()
                .split("\n")
                .filter((line) => line.trim());
            const filteredLines = [];
            for (const line of lines) {
                try {
                    const item = JSON.parse(line);
                    if (item.id !== itemId) {
                        filteredLines.push(line);
                    }
                }
                catch (_error) {
                    filteredLines.push(line); // Keep malformed lines as-is
                }
            }
            if (filteredLines.length === 0) {
                // Remove empty file
                require("fs").unlinkSync(filePath);
            }
            else {
                writeFileSync(filePath, filteredLines.join("\n") + "\n");
            }
        }
        catch (_error) {
            console.error(`Failed to remove DLQ item ${itemId}:`, _error);
        }
    }
    /**
     * Get all DLQ files
     */
    getAllDLQFiles() {
        try {
            return require("fs")
                .readdirSync(this.dlqDir)
                .filter((file) => file.endsWith(".jsonl"));
        }
        catch (_error) {
            console.error("Failed to list DLQ files:", _error);
            return [];
        }
    }
    /**
     * Get DLQ statistics
     */
    getDLQStats(runId) {
        const stats = {
            total_items: 0,
            transient_errors: 0,
            permanent_errors: 0,
            policy_errors: 0,
            pending_retries: 0,
            exhausted_retries: 0,
            success_after_retry: 0,
        };
        try {
            const files = runId ? [`${runId}.jsonl`] : this.getAllDLQFiles();
            const now = new Date();
            for (const file of files) {
                const filePath = join(this.dlqDir, file);
                if (!existsSync(filePath))
                    continue;
                const content = readFileSync(filePath, "utf-8");
                const lines = content
                    .trim()
                    .split("\n")
                    .filter((line) => line.trim());
                for (const line of lines) {
                    try {
                        const item = JSON.parse(line);
                        stats.total_items++;
                        switch (item.error_type) {
                            case "TRANSIENT":
                                stats.transient_errors++;
                                break;
                            case "PERMANENT":
                                stats.permanent_errors++;
                                break;
                            case "POLICY":
                                stats.policy_errors++;
                                break;
                        }
                        if (item.next_retry_timestamp === "exhausted") {
                            stats.exhausted_retries++;
                        }
                        else if (item.retry_count < item.max_retries &&
                            new Date(item.next_retry_timestamp) <= now) {
                            stats.pending_retries++;
                        }
                        if (item.retry_count > 0) {
                            stats.success_after_retry++;
                        }
                    }
                    catch (_error) {
                        // Skip malformed lines
                    }
                }
            }
        }
        catch (_error) {
            console.error("Failed to calculate DLQ stats:", _error);
        }
        return stats;
    }
    /**
     * Clean up old DLQ entries (older than specified days)
     */
    cleanupOldEntries(maxAgeInDays = 7) {
        const cutoffDate = new Date(Date.now() - maxAgeInDays * 24 * 60 * 60 * 1000);
        let removedCount = 0;
        try {
            const files = this.getAllDLQFiles();
            for (const file of files) {
                const filePath = join(this.dlqDir, file);
                const content = readFileSync(filePath, "utf-8");
                const lines = content
                    .trim()
                    .split("\n")
                    .filter((line) => line.trim());
                const remainingLines = [];
                for (const line of lines) {
                    try {
                        const item = JSON.parse(line);
                        const itemDate = new Date(item.first_failure_timestamp);
                        if (itemDate >= cutoffDate) {
                            remainingLines.push(line);
                        }
                        else {
                            removedCount++;
                        }
                    }
                    catch (_error) {
                        remainingLines.push(line); // Keep malformed lines
                    }
                }
                if (remainingLines.length === 0) {
                    require("fs").unlinkSync(filePath);
                }
                else {
                    writeFileSync(filePath, remainingLines.join("\n") + "\n");
                }
            }
        }
        catch (_error) {
            console.error("Failed to cleanup old DLQ entries:", _error);
        }
        return removedCount;
    }
}
/**
 * Factory function to create DLQ manager
 */
export function createDLQManager(baseDir) {
    return new DLQManager(baseDir);
}
/**
 * Wrapper function for retry logic with DLQ
 */
export async function withRetryAndDLQ(operation, runId, itemId, originalData, context = {}, dlqManager) {
    const manager = dlqManager || new DLQManager();
    try {
        return await operation();
    }
    catch (error) {
        console.warn(`Operation failed for item ${itemId}:`, error?.message ?? error);
        // Add to DLQ for potential retry
        const dlqItem = manager.addFailedItem(runId, itemId, originalData, error, context);
        console.log(`Added item ${itemId} to DLQ with ${dlqItem.max_retries} max retries`);
        return null;
    }
}
//# sourceMappingURL=dlq_manager.js.map