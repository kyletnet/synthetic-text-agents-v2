/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Evidence Types
 *
 * Purpose:
 * - Unified evidence and audit data types
 * - Consistent data structure for Evidence Viewer + Audit Timeline
 *
 * Phase: v3.2.1 - Trust Infrastructure
 */

/**
 * Evidence Item (Single piece of evidence)
 */
export interface EvidenceItem {
  id: string; // Unique evidence ID
  sourceId: string; // Chunk ID or source identifier
  content: string; // Evidence content
  trustScore: number; // 0-1 scale
  timestamp: Date; // Normalized timestamp
  metadata: {
    domain?: string;
    author?: string;
    retrievalStrategy: "bm25" | "vector" | "hybrid";
  };
}

/**
 * Audit Event (Policy/decision change)
 */
export interface AuditEvent {
  id: string; // Unique event ID
  type: "policy_change" | "decision" | "feedback" | "rollback";
  timestamp: Date; // Normalized timestamp
  description: string; // Natural language description
  actor: "system" | "human" | "policy";
  details: {
    before?: unknown;
    after?: unknown;
    reason?: string;
  };
  evidenceIds: string[]; // Related evidence items
}

/**
 * Evidence Query Options
 */
export interface EvidenceQueryOptions {
  evidenceIds?: string[];
  sourceIds?: string[];
  startTime?: Date;
  endTime?: Date;
  minTrustScore?: number;
  limit?: number;
}

/**
 * Audit Query Options
 */
export interface AuditQueryOptions {
  eventTypes?: Array<"policy_change" | "decision" | "feedback" | "rollback">;
  startTime?: Date;
  endTime?: Date;
  actor?: "system" | "human" | "policy";
  limit?: number;
}

/**
 * Evidence Store Statistics
 */
export interface EvidenceStoreStats {
  totalEvidence: number;
  totalAuditEvents: number;
  avgTrustScore: number;
  oldestTimestamp: Date | null;
  newestTimestamp: Date | null;
}
