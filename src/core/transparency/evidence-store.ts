/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Unified Evidence Store
 *
 * Purpose:
 * - Central storage for evidence and audit data
 * - Ensures data consistency across Evidence Viewer + Audit Timeline
 * - Timestamp normalization
 *
 * Phase: v3.2.1 - Trust Infrastructure (P1)
 */

import type {
  EvidenceItem,
  AuditEvent,
  EvidenceQueryOptions,
  AuditQueryOptions,
  EvidenceStoreStats,
} from "./evidence-types.js";

/**
 * Unified Evidence Store
 *
 * Central repository for evidence and audit data
 */
export class EvidenceStore {
  private evidence: Map<string, EvidenceItem> = new Map();
  private auditEvents: Map<string, AuditEvent> = new Map();

  /**
   * Add Evidence Item
   */
  addEvidence(item: EvidenceItem): void {
    // Normalize timestamp
    const normalizedItem: EvidenceItem = {
      ...item,
      timestamp: this.normalizeTimestamp(item.timestamp),
    };

    this.evidence.set(item.id, normalizedItem);
  }

  /**
   * Add Audit Event
   */
  addAuditEvent(event: AuditEvent): void {
    // Normalize timestamp
    const normalizedEvent: AuditEvent = {
      ...event,
      timestamp: this.normalizeTimestamp(event.timestamp),
    };

    this.auditEvents.set(event.id, normalizedEvent);
  }

  /**
   * Query Evidence
   */
  queryEvidence(options: EvidenceQueryOptions = {}): EvidenceItem[] {
    let results = Array.from(this.evidence.values());

    // Filter by evidence IDs
    if (options.evidenceIds && options.evidenceIds.length > 0) {
      const idSet = new Set(options.evidenceIds);
      results = results.filter((item) => idSet.has(item.id));
    }

    // Filter by source IDs
    if (options.sourceIds && options.sourceIds.length > 0) {
      const sourceSet = new Set(options.sourceIds);
      results = results.filter((item) => sourceSet.has(item.sourceId));
    }

    // Filter by time range
    if (options.startTime) {
      results = results.filter(
        (item) => item.timestamp >= options.startTime!,
      );
    }
    if (options.endTime) {
      results = results.filter(
        (item) => item.timestamp <= options.endTime!,
      );
    }

    // Filter by trust score
    if (options.minTrustScore !== undefined) {
      results = results.filter(
        (item) => item.trustScore >= options.minTrustScore!,
      );
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Query Audit Events
   */
  queryAuditEvents(options: AuditQueryOptions = {}): AuditEvent[] {
    let results = Array.from(this.auditEvents.values());

    // Filter by event types
    if (options.eventTypes && options.eventTypes.length > 0) {
      const typeSet = new Set(options.eventTypes);
      results = results.filter((event) => typeSet.has(event.type));
    }

    // Filter by time range
    if (options.startTime) {
      results = results.filter(
        (event) => event.timestamp >= options.startTime!,
      );
    }
    if (options.endTime) {
      results = results.filter(
        (event) => event.timestamp <= options.endTime!,
      );
    }

    // Filter by actor
    if (options.actor) {
      results = results.filter((event) => event.actor === options.actor);
    }

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Get Evidence by ID
   */
  getEvidence(id: string): EvidenceItem | undefined {
    return this.evidence.get(id);
  }

  /**
   * Get Audit Event by ID
   */
  getAuditEvent(id: string): AuditEvent | undefined {
    return this.auditEvents.get(id);
  }

  /**
   * Get Store Statistics
   */
  getStats(): EvidenceStoreStats {
    const evidenceArray = Array.from(this.evidence.values());
    const auditArray = Array.from(this.auditEvents.values());

    const avgTrustScore =
      evidenceArray.length > 0
        ? evidenceArray.reduce((sum, item) => sum + item.trustScore, 0) /
          evidenceArray.length
        : 0;

    const allTimestamps = [
      ...evidenceArray.map((e) => e.timestamp),
      ...auditArray.map((a) => a.timestamp),
    ];

    return {
      totalEvidence: this.evidence.size,
      totalAuditEvents: this.auditEvents.size,
      avgTrustScore,
      oldestTimestamp:
        allTimestamps.length > 0
          ? new Date(Math.min(...allTimestamps.map((t) => t.getTime())))
          : null,
      newestTimestamp:
        allTimestamps.length > 0
          ? new Date(Math.max(...allTimestamps.map((t) => t.getTime())))
          : null,
    };
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.evidence.clear();
    this.auditEvents.clear();
  }

  /**
   * Normalize timestamp to UTC Date
   *
   * Ensures consistency across different timestamp formats
   */
  private normalizeTimestamp(timestamp: Date | string | number): Date {
    if (timestamp instanceof Date) {
      return timestamp;
    }
    return new Date(timestamp);
  }
}

/**
 * Global Evidence Store instance
 */
let globalStore: EvidenceStore | null = null;

/**
 * Get Global Evidence Store
 */
export function getEvidenceStore(): EvidenceStore {
  if (!globalStore) {
    globalStore = new EvidenceStore();
  }
  return globalStore;
}

/**
 * Reset Global Evidence Store (for testing)
 */
export function resetEvidenceStore(): void {
  globalStore = null;
}
