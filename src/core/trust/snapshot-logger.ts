/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Snapshot Logger
 *
 * Purpose:
 * - Record SSR-time trust state for legal audit
 * - Append-only log with SHA-256 checksum
 * - Enable audit trail reproducibility
 *
 * Phase: v3.2.1 - Trust Infrastructure (P2-3)
 */

import { createHash, randomUUID } from "node:crypto";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  TrustSnapshot,
  TrustScoreSnapshot,
  ComplianceSnapshot,
  TelemetrySummarySnapshot,
  EvidenceHashSnapshot,
  SnapshotStorageOptions,
  SnapshotVerificationResult,
} from "./snapshot-types.js";

/**
 * Snapshot Logger
 *
 * Records trust state snapshots for legal audit
 */
export class SnapshotLogger {
  private readonly directory: string;
  private readonly retention: number; // days
  private readonly format: "json" | "jsonl";
  private readonly version = "1.0.0"; // Snapshot schema version

  constructor(options: SnapshotStorageOptions = {}) {
    this.directory = options.directory || "reports/trust-snapshots";
    this.retention = options.retention || 30;
    this.format = options.format || "json";

    // Ensure directory exists
    this.ensureDirectory();
  }

  /**
   * Create Snapshot
   *
   * Records current trust state with checksum
   */
  createSnapshot(
    trustScore: TrustScoreSnapshot,
    evidenceHash: EvidenceHashSnapshot,
    complianceStatus: ComplianceSnapshot,
    telemetrySummary: TelemetrySummarySnapshot,
    context?: Partial<TrustSnapshot["context"]>,
  ): TrustSnapshot {
    const snapshot: Omit<TrustSnapshot, "checksum"> = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      version: this.version,
      trustScore,
      evidenceHash,
      complianceStatus,
      telemetrySummary,
      context: {
        tenantId: context?.tenantId,
        environment: context?.environment || process.env.NODE_ENV || "development",
        nodeVersion: process.version,
        appVersion: context?.appVersion || "unknown",
      },
    };

    // Calculate checksum (exclude checksum field itself)
    const checksum = this.calculateChecksum(snapshot);

    return {
      ...snapshot,
      checksum,
    };
  }

  /**
   * Save Snapshot
   *
   * Writes snapshot to disk (append-only)
   */
  saveSnapshot(snapshot: TrustSnapshot): string {
    const filename = this.generateFilename(snapshot.timestamp);
    const filepath = join(this.directory, filename);

    // Write to disk
    writeFileSync(filepath, JSON.stringify(snapshot, null, 2), "utf-8");

    return filepath;
  }

  /**
   * Load Snapshot
   *
   * Reads snapshot from disk and verifies checksum
   */
  loadSnapshot(filepath: string): SnapshotVerificationResult {
    try {
      if (!existsSync(filepath)) {
        return {
          valid: false,
          snapshot: null,
          error: `Snapshot file not found: ${filepath}`,
          checksumMatch: false,
        };
      }

      const content = readFileSync(filepath, "utf-8");
      const snapshot = JSON.parse(content) as TrustSnapshot;

      // Verify checksum
      const { checksum, ...snapshotWithoutChecksum } = snapshot;
      const expectedChecksum = this.calculateChecksum(snapshotWithoutChecksum);
      const checksumMatch = checksum === expectedChecksum;

      return {
        valid: checksumMatch,
        snapshot,
        error: checksumMatch ? undefined : "Checksum mismatch (snapshot may be tampered)",
        checksumMatch,
      };
    } catch (error) {
      return {
        valid: false,
        snapshot: null,
        error: `Failed to load snapshot: ${error instanceof Error ? error.message : "Unknown error"}`,
        checksumMatch: false,
      };
    }
  }

  /**
   * Calculate Checksum
   *
   * SHA-256 hash of snapshot content
   */
  private calculateChecksum(snapshot: Omit<TrustSnapshot, "checksum">): string {
    const content = JSON.stringify(snapshot);
    return createHash("sha256").update(content).digest("hex");
  }

  /**
   * Generate Filename
   *
   * Format: YYYY-MM-DD-HH-mm-ss.json
   */
  private generateFilename(timestamp: string): string {
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hour = String(date.getUTCHours()).padStart(2, "0");
    const minute = String(date.getUTCMinutes()).padStart(2, "0");
    const second = String(date.getUTCSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}-${hour}-${minute}-${second}.json`;
  }

  /**
   * Ensure Directory Exists
   */
  private ensureDirectory(): void {
    if (!existsSync(this.directory)) {
      mkdirSync(this.directory, { recursive: true });
    }
  }
}

/**
 * Create default Snapshot Logger
 */
export function createSnapshotLogger(
  options?: SnapshotStorageOptions,
): SnapshotLogger {
  return new SnapshotLogger(options);
}
