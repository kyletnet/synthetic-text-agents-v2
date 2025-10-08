/**
 * Snapshot Logger Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SnapshotLogger } from "../../../src/core/trust/snapshot-logger.js";
import type {
  TrustScoreSnapshot,
  ComplianceSnapshot,
  TelemetrySummarySnapshot,
  EvidenceHashSnapshot,
} from "../../../src/core/trust/snapshot-types.js";

describe("Snapshot Logger", () => {
  const testDir = "reports/trust-snapshots-test";
  let logger: SnapshotLogger;

  const mockTrustScore: TrustScoreSnapshot = {
    groundedness: 0.92,
    alignment: 0.88,
    faithfulness: 0.95,
    overall: 0.92,
  };

  const mockEvidenceHash: EvidenceHashSnapshot = {
    totalEvidence: 10,
    totalAuditEvents: 5,
    contentHash: "abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd",
    oldestTimestamp: "2025-01-01T00:00:00.000Z",
    newestTimestamp: "2025-01-02T00:00:00.000Z",
  };

  const mockCompliance: ComplianceSnapshot = {
    gdpr: true,
    ccpa: true,
    hipaa: false,
    lastAuditDate: "2025-01-01T00:00:00.000Z",
  };

  const mockTelemetry: TelemetrySummarySnapshot = {
    totalSessions: 100,
    totalEvents: 500,
    avgConfidenceScore: 0.85,
    avgVerificationDepth: 0.7,
    intentDistribution: {
      trusting: 50,
      verifying: 30,
      uncertain: 15,
      distrusting: 5,
    },
  };

  beforeEach(() => {
    logger = new SnapshotLogger({ directory: testDir });
  });

  afterEach(() => {
    // Cleanup test snapshots
    try {
      if (existsSync(testDir)) {
        const files = readdirSync(testDir);
        for (const file of files) {
          unlinkSync(join(testDir, file));
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Snapshot Creation", () => {
    it("should create snapshot with all fields", () => {
      const snapshot = logger.createSnapshot(
        mockTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
      );

      expect(snapshot.id).toBeDefined();
      expect(snapshot.timestamp).toBeDefined();
      expect(snapshot.version).toBe("1.0.0");
      expect(snapshot.trustScore).toEqual(mockTrustScore);
      expect(snapshot.evidenceHash).toEqual(mockEvidenceHash);
      expect(snapshot.complianceStatus).toEqual(mockCompliance);
      expect(snapshot.telemetrySummary).toEqual(mockTelemetry);
      expect(snapshot.checksum).toBeDefined();
      expect(snapshot.checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it("should include context information", () => {
      const snapshot = logger.createSnapshot(
        mockTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
        { tenantId: "tenant-123", appVersion: "1.0.0" },
      );

      expect(snapshot.context.tenantId).toBe("tenant-123");
      expect(snapshot.context.appVersion).toBe("1.0.0");
      expect(snapshot.context.nodeVersion).toBeDefined();
      expect(snapshot.context.environment).toBeDefined();
    });

    it("should generate unique IDs for each snapshot", () => {
      const snapshot1 = logger.createSnapshot(
        mockTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
      );
      const snapshot2 = logger.createSnapshot(
        mockTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
      );

      expect(snapshot1.id).not.toBe(snapshot2.id);
    });

    it("should generate different checksums for different data", () => {
      const snapshot1 = logger.createSnapshot(
        mockTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
      );

      const differentTrustScore = { ...mockTrustScore, groundedness: 0.5 };
      const snapshot2 = logger.createSnapshot(
        differentTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
      );

      expect(snapshot1.checksum).not.toBe(snapshot2.checksum);
    });
  });

  describe("Snapshot Persistence", () => {
    it("should save snapshot to disk", () => {
      const snapshot = logger.createSnapshot(
        mockTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
      );

      const filepath = logger.saveSnapshot(snapshot);

      expect(existsSync(filepath)).toBe(true);
      expect(filepath).toContain(testDir);
      expect(filepath).toMatch(/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
    });

    it("should load snapshot from disk", () => {
      const snapshot = logger.createSnapshot(
        mockTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
      );

      const filepath = logger.saveSnapshot(snapshot);
      const result = logger.loadSnapshot(filepath);

      expect(result.valid).toBe(true);
      expect(result.checksumMatch).toBe(true);
      expect(result.snapshot).toEqual(snapshot);
      expect(result.error).toBeUndefined();
    });

    it("should detect non-existent snapshot", () => {
      const result = logger.loadSnapshot("/non/existent/path.json");

      expect(result.valid).toBe(false);
      expect(result.snapshot).toBeNull();
      expect(result.error).toContain("not found");
    });
  });

  describe("Checksum Verification", () => {
    it("should verify valid checksum", () => {
      const snapshot = logger.createSnapshot(
        mockTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
      );

      const filepath = logger.saveSnapshot(snapshot);
      const result = logger.loadSnapshot(filepath);

      expect(result.checksumMatch).toBe(true);
      expect(result.valid).toBe(true);
    });

    it("should detect tampered snapshot", () => {
      const snapshot = logger.createSnapshot(
        mockTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
      );

      const filepath = logger.saveSnapshot(snapshot);

      // Tamper with snapshot (manually modify file)
      const { readFileSync, writeFileSync } = require("node:fs");
      const content = JSON.parse(readFileSync(filepath, "utf-8"));
      content.trustScore.groundedness = 0.5; // Tamper with data
      writeFileSync(filepath, JSON.stringify(content, null, 2), "utf-8");

      const result = logger.loadSnapshot(filepath);

      expect(result.checksumMatch).toBe(false);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Checksum mismatch");
    });
  });

  describe("Filename Generation", () => {
    it("should generate filename with timestamp", () => {
      const snapshot = logger.createSnapshot(
        mockTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
      );

      const filepath = logger.saveSnapshot(snapshot);
      const filename = filepath.split("/").pop();

      expect(filename).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
    });
  });

  describe("Directory Management", () => {
    it("should create directory if not exists", () => {
      const newLogger = new SnapshotLogger({ directory: testDir + "-new" });
      const snapshot = newLogger.createSnapshot(
        mockTrustScore,
        mockEvidenceHash,
        mockCompliance,
        mockTelemetry,
      );

      const filepath = newLogger.saveSnapshot(snapshot);

      expect(existsSync(testDir + "-new")).toBe(true);
      expect(existsSync(filepath)).toBe(true);

      // Cleanup
      unlinkSync(filepath);
    });
  });
});
