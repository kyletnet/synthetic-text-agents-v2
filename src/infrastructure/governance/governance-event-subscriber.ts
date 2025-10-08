/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Governance Event Subscriber
 *
 * Listens to domain events and logs them to governance ledger.
 * Creates autonomous feedback loop for quality decisions.
 *
 * Integration Point:
 * - Subscribes to domainEventBus
 * - Writes to reports/governance/domain-events.jsonl
 * - Enables quality learning from domain operations
 */

import { existsSync, mkdirSync, appendFileSync } from "fs";
import { join } from "path";
import type { DomainEvent } from "../../domain/events/domain-event-bus.js";

export interface GovernanceLogEntry {
  event: string;
  actor: string;
  timestamp: string;
  data: Record<string, unknown>;
  severity: "info" | "warn" | "error";
  category: "metric" | "threshold" | "quality" | "architecture" | "other";
}

/**
 * Governance Event Subscriber
 */
export class GovernanceEventSubscriber {
  private logPath: string;
  private enabled: boolean;

  constructor(projectRoot: string = process.cwd(), enabled = true) {
    this.logPath = join(projectRoot, "reports/governance/domain-events.jsonl");
    this.enabled = enabled;

    // Ensure directory exists
    const dir = join(projectRoot, "reports/governance");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Handle domain event and log to governance ledger
   */
  async handleEvent(event: DomainEvent): Promise<void> {
    if (!this.enabled) return;

    try {
      const logEntry = this.transformToGovernanceLog(event);
      this.appendToLedger(logEntry);
    } catch (error) {
      console.error("[GovernanceEventSubscriber] Failed to log event:", error);
    }
  }

  /**
   * Transform domain event to governance log format
   */
  private transformToGovernanceLog(event: DomainEvent): GovernanceLogEntry {
    // Determine severity and category from event type
    const { severity, category } = this.classifyEvent(event.type);

    return {
      event: event.type,
      actor: event.actor,
      timestamp: event.timestamp,
      data: event.data,
      severity,
      category,
    };
  }

  /**
   * Classify event by type
   */
  private classifyEvent(eventType: string): {
    severity: GovernanceLogEntry["severity"];
    category: GovernanceLogEntry["category"];
  } {
    // Metric events
    if (eventType.includes("metric")) {
      return { severity: "info", category: "metric" };
    }

    // Threshold events
    if (eventType.includes("threshold")) {
      return { severity: "info", category: "threshold" };
    }

    // Quality events
    if (eventType.includes("quality")) {
      return { severity: "info", category: "quality" };
    }

    // Architecture events
    if (eventType.includes("architecture")) {
      return { severity: "warn", category: "architecture" };
    }

    // Error events
    if (eventType.includes("error") || eventType.includes("failure")) {
      return { severity: "error", category: "other" };
    }

    return { severity: "info", category: "other" };
  }

  /**
   * Append to governance ledger (JSONL format)
   */
  private appendToLedger(entry: GovernanceLogEntry): void {
    try {
      appendFileSync(this.logPath, JSON.stringify(entry) + "\n");
    } catch (error) {
      console.error(
        "[GovernanceEventSubscriber] Failed to write to ledger:",
        error,
      );
      throw error;
    }
  }

  /**
   * Enable/disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get log file path
   */
  getLogPath(): string {
    return this.logPath;
  }
}

/**
 * Initialize governance bridge
 * Call this once at application startup
 */
export function initializeGovernanceBridge(eventBus: {
  subscribeAll: (handler: (event: DomainEvent) => Promise<void>) => void;
}): GovernanceEventSubscriber {
  const subscriber = new GovernanceEventSubscriber();

  // Subscribe to all domain events
  eventBus.subscribeAll((event) => subscriber.handleEvent(event));

  console.log("[Governance Bridge] Initialized - listening to domain events");

  return subscriber;
}
