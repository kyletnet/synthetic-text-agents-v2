/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Retrieval Feedback Bridge
 *
 * Purpose:
 * - Connect Retrieval events to Governance kernel
 * - Enable automatic Gate I/P updates
 * - Provide audit trail for retrieval operations
 *
 * Phase 1.6: Governance Loop Integration
 */

import type { RetrievalResult } from "../domain/ports/retrieval-port.js";
import { Logger } from "../shared/logger.js";

/**
 * Governance Event Types
 */
export type GovernanceEventType =
  | "retrieval_assessment"
  | "trust_score_update"
  | "poisoning_detection"
  | "retrieval_failure";

/**
 * Governance Event
 */
export interface GovernanceEvent {
  event: GovernanceEventType;
  data: {
    trust_avg?: number;
    domain_failures?: number;
    poisoned_blocked?: number;
    strategy?: string;
    duration?: number;
    timestamp: string;
    metadata?: Record<string, unknown>;
  };
  severity?: "info" | "warning" | "error" | "critical";
}

/**
 * Event Handler
 */
type EventHandler = (event: GovernanceEvent) => void | Promise<void>;

/**
 * Event Registry
 */
const eventHandlers = new Map<GovernanceEventType, EventHandler[]>();

/**
 * Logger instance
 */
const logger = new Logger();

/**
 * Register event handler
 *
 * @param eventType - Event type to listen for
 * @param handler - Handler function
 */
export function onGovernanceEvent(
  eventType: GovernanceEventType,
  handler: EventHandler,
): void {
  const handlers = eventHandlers.get(eventType) || [];
  handlers.push(handler);
  eventHandlers.set(eventType, handlers);
}

/**
 * Emit governance event
 *
 * @param event - Event to emit
 */
export async function emitGovernanceEvent(event: GovernanceEvent): Promise<void> {
  // Log event
  await logger.trace({
    level: "info",
    agentId: "retrieval-feedback-bridge",
    action: "governance_event",
    data: event,
  });

  // Call registered handlers
  const handlers = eventHandlers.get(event.event) || [];

  for (const handler of handlers) {
    try {
      await handler(event);
    } catch (error) {
      await logger.trace({
        level: "error",
        agentId: "retrieval-feedback-bridge",
        action: "handler_error",
        data: {
          event: event.event,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}

/**
 * Report retrieval event to governance
 *
 * @param result - Retrieval result
 */
export async function reportRetrievalEvent(
  result: RetrievalResult,
): Promise<void> {
  const event: GovernanceEvent = {
    event: "retrieval_assessment",
    data: {
      trust_avg: result.metadata.avgTrustScore,
      poisoned_blocked: result.metadata.poisonedBlocked,
      strategy: result.metadata.strategy,
      duration: result.metadata.duration,
      timestamp: result.metadata.timestamp.toISOString(),
      metadata: {
        query: result.query,
        totalCandidates: result.metadata.totalCandidates,
        filteredCount: result.metadata.filteredCount,
        chunks: result.chunks.length,
      },
    },
    severity: determineSeverity(result),
  };

  await emitGovernanceEvent(event);
}

/**
 * Report trust score update
 *
 * @param domain - Domain that was updated
 * @param oldScore - Old trust score
 * @param newScore - New trust score
 * @param reason - Reason for update
 */
export async function reportTrustScoreUpdate(
  domain: string,
  oldScore: number,
  newScore: number,
  reason: string,
): Promise<void> {
  const event: GovernanceEvent = {
    event: "trust_score_update",
    data: {
      timestamp: new Date().toISOString(),
      metadata: {
        domain,
        oldScore,
        newScore,
        delta: newScore - oldScore,
        reason,
      },
    },
    severity: Math.abs(newScore - oldScore) > 0.2 ? "warning" : "info",
  };

  await emitGovernanceEvent(event);
}

/**
 * Report poisoning detection
 *
 * @param chunkId - Chunk ID that was blocked
 * @param reasons - Reasons for blocking
 */
export async function reportPoisoningDetection(
  chunkId: string,
  reasons: string[],
): Promise<void> {
  const event: GovernanceEvent = {
    event: "poisoning_detection",
    data: {
      timestamp: new Date().toISOString(),
      metadata: {
        chunkId,
        reasons,
        blocked: true,
      },
    },
    severity: "warning",
  };

  await emitGovernanceEvent(event);
}

/**
 * Report retrieval failure
 *
 * @param query - Query that failed
 * @param error - Error message
 */
export async function reportRetrievalFailure(
  query: string,
  error: string,
): Promise<void> {
  const event: GovernanceEvent = {
    event: "retrieval_failure",
    data: {
      timestamp: new Date().toISOString(),
      metadata: {
        query,
        error,
      },
    },
    severity: "error",
  };

  await emitGovernanceEvent(event);
}

/**
 * Determine event severity based on retrieval result
 *
 * @param result - Retrieval result
 * @returns Event severity
 */
function determineSeverity(result: RetrievalResult): GovernanceEvent["severity"] {
  // Critical: High poisoning rate (>20%)
  if (
    result.metadata.totalCandidates > 0 &&
    result.metadata.poisonedBlocked / result.metadata.totalCandidates > 0.2
  ) {
    return "critical";
  }

  // Error: Very low trust score (<0.4)
  if (result.metadata.avgTrustScore < 0.4) {
    return "error";
  }

  // Warning: Low trust score (<0.6)
  if (result.metadata.avgTrustScore < 0.6) {
    return "warning";
  }

  // Info: Normal operation
  return "info";
}

/**
 * Get event statistics
 *
 * @returns Event statistics
 */
export function getEventStats(): {
  handlers: Record<GovernanceEventType, number>;
  totalHandlers: number;
} {
  const handlers: Record<string, number> = {};

  for (const [eventType, handlerList] of eventHandlers.entries()) {
    handlers[eventType] = handlerList.length;
  }

  const totalHandlers = Array.from(eventHandlers.values()).reduce(
    (sum, list) => sum + list.length,
    0,
  );

  return {
    handlers: handlers as Record<GovernanceEventType, number>,
    totalHandlers,
  };
}

/**
 * Clear all event handlers (for testing)
 */
export function clearEventHandlers(): void {
  eventHandlers.clear();
}
