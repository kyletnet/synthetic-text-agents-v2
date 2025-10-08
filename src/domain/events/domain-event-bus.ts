/**
 * Domain Event Bus
 *
 * Publishes domain events for governance monitoring and quality learning loops.
 * Follows Event-Driven Architecture to decouple domain from governance.
 *
 * Event Flow:
 * 1. Domain operations emit events (threshold updates, metric changes, etc.)
 * 2. Event bus broadcasts to all subscribers
 * 3. Governance layer subscribes and logs to ledger
 * 4. Creates feedback loop for autonomous quality improvement
 */

export interface DomainEvent {
  type: string;
  actor: string;
  timestamp: string;
  data: Record<string, unknown>;
  metadata?: {
    correlationId?: string;
    causationId?: string;
    userId?: string;
  };
}

export type EventHandler = (event: DomainEvent) => void | Promise<void>;

/**
 * Domain Event Bus for publishing and subscribing to domain events
 */
export class DomainEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<EventHandler> = new Set();

  /**
   * Subscribe to specific event type
   */
  subscribe(eventType: string, handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    this.handlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * Subscribe to all events (wildcard)
   */
  subscribeAll(handler: EventHandler): () => void {
    this.wildcardHandlers.add(handler);

    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  /**
   * Publish event to all subscribers
   */
  async publish(event: Omit<DomainEvent, "timestamp">): Promise<void> {
    const fullEvent: DomainEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    // Notify specific handlers
    const handlers = this.handlers.get(event.type) || new Set();
    const allHandlers = [...handlers, ...this.wildcardHandlers];

    // Execute all handlers (don't wait for completion to avoid blocking)
    const promises = allHandlers.map((handler) =>
      Promise.resolve(handler(fullEvent)).catch((error) => {
        console.error(
          `[DomainEventBus] Handler error for ${event.type}:`,
          error,
        );
      }),
    );

    // Wait for all handlers to complete
    await Promise.all(promises);
  }

  /**
   * Get subscriber count for event type
   */
  getSubscriberCount(eventType: string): number {
    return (
      (this.handlers.get(eventType)?.size || 0) + this.wildcardHandlers.size
    );
  }

  /**
   * Clear all subscribers (for testing)
   */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }
}

/**
 * Global singleton instance
 */
export const domainEventBus = new DomainEventBus();
