/**
 * Dead Letter Queue (DLQ) Implementation
 * Handles failed messages and provides retry mechanisms
 */
export interface DLQMessage<T = unknown> {
    id: string;
    payload: T;
    originalQueue: string;
    failureReason: string;
    failureCount: number;
    firstFailureTime: Date;
    lastFailureTime: Date;
    nextRetryTime?: Date;
    maxRetries: number;
    priority: number;
    tags: string[];
    context?: Record<string, unknown>;
}
export interface DLQConfig {
    maxRetries: number;
    initialRetryDelay: number;
    maxRetryDelay: number;
    backoffMultiplier: number;
    enableJitter: boolean;
    persistToDisk: boolean;
    diskPath?: string;
    maxQueueSize: number;
    monitor?: (event: DLQEvent) => void;
}
export interface DLQEvent {
    type: "message_added" | "message_retried" | "message_failed" | "message_recovered" | "queue_full";
    message: DLQMessage;
    timestamp: Date;
    details?: string;
}
export interface DLQStats {
    totalMessages: number;
    messagesByQueue: Record<string, number>;
    messagesByFailureReason: Record<string, number>;
    oldestMessage?: Date;
    newestMessage?: Date;
    averageFailureCount: number;
    readyForRetry: number;
    permanentlyFailed: number;
}
/**
 * Dead Letter Queue implementation
 */
export declare class DeadLetterQueue {
    private config;
    private messages;
    private retryTimer?;
    private diskPersistence?;
    constructor(config: DLQConfig);
    /**
     * Add a failed message to the DLQ
     */
    addMessage<T>(payload: T, originalQueue: string, failureReason: string, context?: Record<string, unknown>, priority?: number, maxRetries?: number): Promise<string>;
    /**
     * Increment failure count for an existing message
     */
    incrementFailure(messageId: string, newFailureReason?: string): Promise<void>;
    /**
     * Get messages ready for retry
     */
    getMessagesReadyForRetry(): DLQMessage[];
    /**
     * Get permanently failed messages (exceeded max retries)
     */
    getPermanentlyFailedMessages(): DLQMessage[];
    /**
     * Remove a message from the DLQ (after successful retry or manual intervention)
     */
    removeMessage(messageId: string, reason?: "recovered" | "manual"): Promise<boolean>;
    /**
     * Get a specific message by ID
     */
    getMessage(messageId: string): DLQMessage | undefined;
    /**
     * Get all messages for a specific queue
     */
    getMessagesByQueue(queueName: string): DLQMessage[];
    /**
     * Get messages by failure reason
     */
    getMessagesByFailureReason(reason: string): DLQMessage[];
    /**
     * Search messages by tags
     */
    getMessagesByTag(tag: string): DLQMessage[];
    /**
     * Get DLQ statistics
     */
    getStats(): DLQStats;
    /**
     * Clear all messages from the DLQ
     */
    clearAll(): Promise<void>;
    /**
     * Clear permanently failed messages
     */
    clearPermanentlyFailed(): Promise<number>;
    /**
     * Process retry queue
     */
    processRetries(processor: (message: DLQMessage) => Promise<boolean>): Promise<void>;
    /**
     * Start automatic retry processor
     */
    private startRetryProcessor;
    /**
     * Stop retry processor
     */
    stop(): void;
    /**
     * Calculate next retry time with exponential backoff
     */
    private calculateNextRetryTime;
    /**
     * Generate unique message ID
     */
    private generateMessageId;
    /**
     * Generate tags for message categorization
     */
    private generateTags;
    /**
     * Get oldest message for queue size management
     */
    private getOldestMessage;
    /**
     * Emit DLQ event
     */
    private emitEvent;
    /**
     * Persist messages to disk
     */
    private persistToDisk;
    /**
     * Load messages from disk
     */
    private loadFromDisk;
}
/**
 * Initialize global DLQ
 */
export declare function initializeDeadLetterQueue(config?: Partial<DLQConfig>): DeadLetterQueue;
/**
 * Get global DLQ instance
 */
export declare function getDeadLetterQueue(): DeadLetterQueue;
//# sourceMappingURL=deadLetterQueue.d.ts.map