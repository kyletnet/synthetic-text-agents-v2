/**
 * Dead Letter Queue (DLQ) Implementation
 * Handles failed messages and provides retry mechanisms
 */
/**
 * Dead Letter Queue implementation
 */
export class DeadLetterQueue {
    config;
    messages = new Map();
    retryTimer;
    diskPersistence;
    constructor(config) {
        this.config = config;
        if (config.persistToDisk) {
            this.diskPersistence = new DLQDiskPersistence(config.diskPath || "./dlq");
            this.loadFromDisk();
        }
        this.startRetryProcessor();
    }
    /**
     * Add a failed message to the DLQ
     */
    async addMessage(payload, originalQueue, failureReason, context, priority = 5, maxRetries) {
        // Check queue size limit
        if (this.messages.size >= this.config.maxQueueSize) {
            this.emitEvent({
                type: "queue_full",
                message: {},
                timestamp: new Date(),
                details: `Queue size limit reached: ${this.config.maxQueueSize}`,
            });
            // Remove oldest message to make space
            const oldestMessage = this.getOldestMessage();
            if (oldestMessage) {
                this.messages.delete(oldestMessage.id);
            }
        }
        const messageId = this.generateMessageId();
        const now = new Date();
        const message = {
            id: messageId,
            payload,
            originalQueue,
            failureReason,
            failureCount: 1,
            firstFailureTime: now,
            lastFailureTime: now,
            nextRetryTime: this.calculateNextRetryTime(1),
            maxRetries: maxRetries ?? this.config.maxRetries,
            priority,
            tags: this.generateTags(originalQueue, failureReason),
            context,
        };
        this.messages.set(messageId, message);
        this.emitEvent({
            type: "message_added",
            message,
            timestamp: now,
            details: `Message added to DLQ from ${originalQueue}`,
        });
        await this.persistToDisk();
        return messageId;
    }
    /**
     * Increment failure count for an existing message
     */
    async incrementFailure(messageId, newFailureReason) {
        const message = this.messages.get(messageId);
        if (!message) {
            throw new Error(`Message not found in DLQ: ${messageId}`);
        }
        message.failureCount++;
        message.lastFailureTime = new Date();
        if (newFailureReason) {
            message.failureReason = newFailureReason;
        }
        // Calculate next retry time if not exceeded max retries
        if (message.failureCount <= message.maxRetries) {
            message.nextRetryTime = this.calculateNextRetryTime(message.failureCount);
        }
        else {
            message.nextRetryTime = undefined; // No more retries
        }
        this.emitEvent({
            type: "message_failed",
            message,
            timestamp: new Date(),
            details: `Failure count incremented to ${message.failureCount}`,
        });
        await this.persistToDisk();
    }
    /**
     * Get messages ready for retry
     */
    getMessagesReadyForRetry() {
        const now = new Date();
        return Array.from(this.messages.values())
            .filter((message) => message.failureCount <= message.maxRetries &&
            message.nextRetryTime &&
            message.nextRetryTime <= now)
            .sort((a, b) => {
            // Sort by priority first, then by next retry time
            if (a.priority !== b.priority) {
                return a.priority - b.priority; // Lower number = higher priority
            }
            return ((a.nextRetryTime?.getTime() ?? 0) - (b.nextRetryTime?.getTime() ?? 0));
        });
    }
    /**
     * Get permanently failed messages (exceeded max retries)
     */
    getPermanentlyFailedMessages() {
        return Array.from(this.messages.values()).filter((message) => message.failureCount > message.maxRetries);
    }
    /**
     * Remove a message from the DLQ (after successful retry or manual intervention)
     */
    async removeMessage(messageId, reason = "recovered") {
        const message = this.messages.get(messageId);
        if (!message) {
            return false;
        }
        this.messages.delete(messageId);
        this.emitEvent({
            type: "message_recovered",
            message,
            timestamp: new Date(),
            details: `Message removed: ${reason}`,
        });
        await this.persistToDisk();
        return true;
    }
    /**
     * Get a specific message by ID
     */
    getMessage(messageId) {
        return this.messages.get(messageId);
    }
    /**
     * Get all messages for a specific queue
     */
    getMessagesByQueue(queueName) {
        return Array.from(this.messages.values()).filter((message) => message.originalQueue === queueName);
    }
    /**
     * Get messages by failure reason
     */
    getMessagesByFailureReason(reason) {
        return Array.from(this.messages.values()).filter((message) => message.failureReason.includes(reason));
    }
    /**
     * Search messages by tags
     */
    getMessagesByTag(tag) {
        return Array.from(this.messages.values()).filter((message) => message.tags.includes(tag));
    }
    /**
     * Get DLQ statistics
     */
    getStats() {
        const messages = Array.from(this.messages.values());
        if (messages.length === 0) {
            return {
                totalMessages: 0,
                messagesByQueue: {},
                messagesByFailureReason: {},
                averageFailureCount: 0,
                readyForRetry: 0,
                permanentlyFailed: 0,
            };
        }
        const messagesByQueue = messages.reduce((acc, msg) => {
            acc[msg.originalQueue] = (acc[msg.originalQueue] || 0) + 1;
            return acc;
        }, {});
        const messagesByFailureReason = messages.reduce((acc, msg) => {
            acc[msg.failureReason] = (acc[msg.failureReason] || 0) + 1;
            return acc;
        }, {});
        const now = new Date();
        const readyForRetry = messages.filter((msg) => msg.failureCount <= msg.maxRetries &&
            msg.nextRetryTime &&
            msg.nextRetryTime <= now).length;
        const permanentlyFailed = messages.filter((msg) => msg.failureCount > msg.maxRetries).length;
        const averageFailureCount = messages.reduce((sum, msg) => sum + msg.failureCount, 0) /
            messages.length;
        const sortedByTime = messages.sort((a, b) => a.firstFailureTime.getTime() - b.firstFailureTime.getTime());
        return {
            totalMessages: messages.length,
            messagesByQueue,
            messagesByFailureReason,
            oldestMessage: sortedByTime[0]?.firstFailureTime,
            newestMessage: sortedByTime[sortedByTime.length - 1]?.firstFailureTime,
            averageFailureCount,
            readyForRetry,
            permanentlyFailed,
        };
    }
    /**
     * Clear all messages from the DLQ
     */
    async clearAll() {
        this.messages.clear();
        await this.persistToDisk();
    }
    /**
     * Clear permanently failed messages
     */
    async clearPermanentlyFailed() {
        const permanentlyFailed = this.getPermanentlyFailedMessages();
        permanentlyFailed.forEach((message) => {
            this.messages.delete(message.id);
        });
        await this.persistToDisk();
        return permanentlyFailed.length;
    }
    /**
     * Process retry queue
     */
    async processRetries(processor) {
        const readyMessages = this.getMessagesReadyForRetry();
        for (const message of readyMessages) {
            try {
                const success = await processor(message);
                if (success) {
                    await this.removeMessage(message.id, "recovered");
                    this.emitEvent({
                        type: "message_retried",
                        message,
                        timestamp: new Date(),
                        details: "Message successfully retried and recovered",
                    });
                }
                else {
                    await this.incrementFailure(message.id, "Retry failed");
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                await this.incrementFailure(message.id, `Retry error: ${errorMessage}`);
            }
        }
    }
    /**
     * Start automatic retry processor
     */
    startRetryProcessor() {
        const processInterval = 30000; // 30 seconds
        this.retryTimer = setInterval(async () => {
            try {
                const readyMessages = this.getMessagesReadyForRetry();
                if (readyMessages.length > 0) {
                    console.log(`[DLQ] ${readyMessages.length} messages ready for retry`);
                }
            }
            catch (error) {
                console.error("[DLQ] Error in retry processor:", error);
            }
        }, processInterval);
    }
    /**
     * Stop retry processor
     */
    stop() {
        if (this.retryTimer) {
            clearInterval(this.retryTimer);
        }
    }
    /**
     * Calculate next retry time with exponential backoff
     */
    calculateNextRetryTime(failureCount) {
        let delay = this.config.initialRetryDelay *
            Math.pow(this.config.backoffMultiplier, failureCount - 1);
        // Cap the delay
        delay = Math.min(delay, this.config.maxRetryDelay);
        // Add jitter if enabled
        if (this.config.enableJitter) {
            const jitter = delay * 0.1 * Math.random(); // Up to 10% jitter
            delay = delay + jitter;
        }
        return new Date(Date.now() + delay);
    }
    /**
     * Generate unique message ID
     */
    generateMessageId() {
        return `dlq_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }
    /**
     * Generate tags for message categorization
     */
    generateTags(originalQueue, failureReason) {
        const tags = [`queue:${originalQueue}`];
        // Add tags based on failure reason
        if (failureReason.toLowerCase().includes("timeout")) {
            tags.push("failure:timeout");
        }
        if (failureReason.toLowerCase().includes("network")) {
            tags.push("failure:network");
        }
        if (failureReason.toLowerCase().includes("auth")) {
            tags.push("failure:auth");
        }
        return tags;
    }
    /**
     * Get oldest message for queue size management
     */
    getOldestMessage() {
        const messages = Array.from(this.messages.values());
        return messages.sort((a, b) => a.firstFailureTime.getTime() - b.firstFailureTime.getTime())[0];
    }
    /**
     * Emit DLQ event
     */
    emitEvent(event) {
        if (this.config.monitor) {
            try {
                this.config.monitor(event);
            }
            catch (error) {
                console.error("DLQ monitor error:", error);
            }
        }
    }
    /**
     * Persist messages to disk
     */
    async persistToDisk() {
        if (this.diskPersistence) {
            await this.diskPersistence.save(Array.from(this.messages.values()));
        }
    }
    /**
     * Load messages from disk
     */
    async loadFromDisk() {
        if (this.diskPersistence) {
            const messages = await this.diskPersistence.load();
            messages.forEach((message) => {
                this.messages.set(message.id, message);
            });
        }
    }
}
/**
 * Disk persistence for DLQ messages
 */
class DLQDiskPersistence {
    basePath;
    constructor(basePath) {
        this.basePath = basePath;
    }
    async save(messages) {
        try {
            const fs = await import("fs/promises");
            const path = await import("path");
            await fs.mkdir(this.basePath, { recursive: true });
            const filePath = path.join(this.basePath, "dlq_messages.json");
            const data = JSON.stringify(messages, null, 2);
            await fs.writeFile(filePath, data);
        }
        catch (error) {
            console.error("Failed to persist DLQ messages to disk:", error);
        }
    }
    async load() {
        try {
            const fs = await import("fs/promises");
            const path = await import("path");
            const filePath = path.join(this.basePath, "dlq_messages.json");
            const data = await fs.readFile(filePath, "utf-8");
            const messages = JSON.parse(data);
            // Convert date strings back to Date objects
            return messages.map((message) => ({
                ...message,
                firstFailureTime: new Date(message.firstFailureTime),
                lastFailureTime: new Date(message.lastFailureTime),
                nextRetryTime: message.nextRetryTime
                    ? new Date(message.nextRetryTime)
                    : undefined,
            }));
        }
        catch (error) {
            // File doesn't exist or other error, return empty array
            return [];
        }
    }
}
/**
 * Global DLQ instance
 */
let globalDLQ;
/**
 * Initialize global DLQ
 */
export function initializeDeadLetterQueue(config) {
    const defaultConfig = {
        maxRetries: 3,
        initialRetryDelay: 5000, // 5 seconds
        maxRetryDelay: 300000, // 5 minutes
        backoffMultiplier: 2,
        enableJitter: true,
        persistToDisk: true,
        maxQueueSize: 10000,
        ...config,
    };
    globalDLQ = new DeadLetterQueue(defaultConfig);
    return globalDLQ;
}
/**
 * Get global DLQ instance
 */
export function getDeadLetterQueue() {
    if (!globalDLQ) {
        globalDLQ = initializeDeadLetterQueue();
    }
    return globalDLQ;
}
//# sourceMappingURL=deadLetterQueue.js.map