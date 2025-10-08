/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Snapshot Types
 *
 * Purpose:
 * - Define snapshot structure for legal audit
 * - Record SSR-time trust state
 * - Enable audit trail reproducibility
 *
 * Phase: v3.2.1 - Trust Infrastructure (P2-3)
 */

/**
 * Trust Score Snapshot
 */
export interface TrustScoreSnapshot {
  groundedness: number; // 0-1 scale
  alignment: number; // 0-1 scale
  faithfulness: number; // 0-1 scale
  overall: number; // Weighted average
}

/**
 * Compliance Status Snapshot
 */
export interface ComplianceSnapshot {
  gdpr: boolean;
  ccpa: boolean;
  hipaa: boolean;
  lastAuditDate?: string; // ISO 8601
}

/**
 * Telemetry Summary Snapshot
 */
export interface TelemetrySummarySnapshot {
  totalSessions: number;
  totalEvents: number;
  avgConfidenceScore: number;
  avgVerificationDepth: number;
  intentDistribution: Record<string, number>; // UserIntent -> count
}

/**
 * Evidence Hash Snapshot
 */
export interface EvidenceHashSnapshot {
  totalEvidence: number;
  totalAuditEvents: number;
  contentHash: string; // SHA-256 of all evidence content
  oldestTimestamp: string | null; // ISO 8601
  newestTimestamp: string | null; // ISO 8601
}

/**
 * Trust Snapshot (Complete state at SSR time)
 */
export interface TrustSnapshot {
  // Metadata
  id: string; // UUID v7
  timestamp: string; // ISO 8601 (snapshot creation time)
  version: string; // Snapshot schema version

  // Trust State
  trustScore: TrustScoreSnapshot;
  evidenceHash: EvidenceHashSnapshot;
  complianceStatus: ComplianceSnapshot;
  telemetrySummary: TelemetrySummarySnapshot;

  // Integrity
  checksum: string; // SHA-256 of entire snapshot (excluding this field)

  // Context
  context: {
    tenantId?: string;
    environment: string; // "production" | "staging" | "development"
    nodeVersion: string;
    appVersion: string;
  };
}

/**
 * Snapshot Storage Options
 */
export interface SnapshotStorageOptions {
  directory?: string; // Default: "reports/trust-snapshots"
  retention?: number; // Retention period in days (default: 30)
  format?: "json" | "jsonl"; // Storage format (default: "json")
}

/**
 * Snapshot Verification Result
 */
export interface SnapshotVerificationResult {
  valid: boolean;
  snapshot: TrustSnapshot | null;
  error?: string;
  checksumMatch: boolean;
}
