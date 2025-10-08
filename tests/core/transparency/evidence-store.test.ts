/**
 * Unified Evidence Store Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EvidenceStore,
  getEvidenceStore,
  resetEvidenceStore,
} from "../../../src/core/transparency/evidence-store.js";
import type {
  EvidenceItem,
  AuditEvent,
} from "../../../src/core/transparency/evidence-types.js";

describe("Unified Evidence Store", () => {
  let store: EvidenceStore;

  beforeEach(() => {
    resetEvidenceStore();
    store = new EvidenceStore();
  });

  describe("Evidence Management", () => {
    it("should add and retrieve evidence", () => {
      const evidence: EvidenceItem = {
        id: "ev-1",
        sourceId: "chunk-1",
        content: "Test evidence content",
        trustScore: 0.9,
        timestamp: new Date(),
        metadata: {
          domain: "test.com",
          retrievalStrategy: "bm25",
        },
      };

      store.addEvidence(evidence);
      const retrieved = store.getEvidence("ev-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.sourceId).toBe("chunk-1");
      expect(retrieved?.trustScore).toBe(0.9);
    });

    it("should normalize timestamps", () => {
      const evidence: EvidenceItem = {
        id: "ev-1",
        sourceId: "chunk-1",
        content: "Test",
        trustScore: 0.8,
        timestamp: "2025-01-01T00:00:00.000Z" as any,
        metadata: { retrievalStrategy: "bm25" },
      };

      store.addEvidence(evidence);
      const retrieved = store.getEvidence("ev-1");

      expect(retrieved?.timestamp).toBeInstanceOf(Date);
    });

    it("should query evidence by IDs", () => {
      store.addEvidence({
        id: "ev-1",
        sourceId: "chunk-1",
        content: "Content 1",
        trustScore: 0.9,
        timestamp: new Date(),
        metadata: { retrievalStrategy: "bm25" },
      });

      store.addEvidence({
        id: "ev-2",
        sourceId: "chunk-2",
        content: "Content 2",
        trustScore: 0.8,
        timestamp: new Date(),
        metadata: { retrievalStrategy: "vector" },
      });

      const results = store.queryEvidence({ evidenceIds: ["ev-1"] });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("ev-1");
    });

    it("should filter by trust score", () => {
      store.addEvidence({
        id: "ev-1",
        sourceId: "chunk-1",
        content: "High trust",
        trustScore: 0.9,
        timestamp: new Date(),
        metadata: { retrievalStrategy: "bm25" },
      });

      store.addEvidence({
        id: "ev-2",
        sourceId: "chunk-2",
        content: "Low trust",
        trustScore: 0.4,
        timestamp: new Date(),
        metadata: { retrievalStrategy: "bm25" },
      });

      const results = store.queryEvidence({ minTrustScore: 0.7 });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("ev-1");
    });

    it("should filter by time range", () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      store.addEvidence({
        id: "ev-old",
        sourceId: "chunk-1",
        content: "Old evidence",
        trustScore: 0.9,
        timestamp: yesterday,
        metadata: { retrievalStrategy: "bm25" },
      });

      store.addEvidence({
        id: "ev-new",
        sourceId: "chunk-2",
        content: "New evidence",
        trustScore: 0.9,
        timestamp: now,
        metadata: { retrievalStrategy: "bm25" },
      });

      const results = store.queryEvidence({ startTime: now, endTime: tomorrow });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("ev-new");
    });
  });

  describe("Audit Event Management", () => {
    it("should add and retrieve audit events", () => {
      const event: AuditEvent = {
        id: "audit-1",
        type: "policy_change",
        timestamp: new Date(),
        description: "Policy updated",
        actor: "system",
        details: {
          before: { threshold: 0.5 },
          after: { threshold: 0.7 },
          reason: "Improving quality",
        },
        evidenceIds: ["ev-1", "ev-2"],
      };

      store.addAuditEvent(event);
      const retrieved = store.getAuditEvent("audit-1");

      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe("policy_change");
      expect(retrieved?.actor).toBe("system");
    });

    it("should query events by type", () => {
      store.addAuditEvent({
        id: "audit-1",
        type: "policy_change",
        timestamp: new Date(),
        description: "Policy change",
        actor: "system",
        details: {},
        evidenceIds: [],
      });

      store.addAuditEvent({
        id: "audit-2",
        type: "decision",
        timestamp: new Date(),
        description: "Decision made",
        actor: "human",
        details: {},
        evidenceIds: [],
      });

      const results = store.queryAuditEvents({ eventTypes: ["policy_change"] });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("audit-1");
    });

    it("should filter by actor", () => {
      store.addAuditEvent({
        id: "audit-1",
        type: "policy_change",
        timestamp: new Date(),
        description: "System change",
        actor: "system",
        details: {},
        evidenceIds: [],
      });

      store.addAuditEvent({
        id: "audit-2",
        type: "rollback",
        timestamp: new Date(),
        description: "Human rollback",
        actor: "human",
        details: {},
        evidenceIds: [],
      });

      const results = store.queryAuditEvents({ actor: "human" });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("audit-2");
    });
  });

  describe("Statistics", () => {
    it("should calculate statistics", () => {
      store.addEvidence({
        id: "ev-1",
        sourceId: "chunk-1",
        content: "Evidence 1",
        trustScore: 0.8,
        timestamp: new Date(),
        metadata: { retrievalStrategy: "bm25" },
      });

      store.addEvidence({
        id: "ev-2",
        sourceId: "chunk-2",
        content: "Evidence 2",
        trustScore: 0.9,
        timestamp: new Date(),
        metadata: { retrievalStrategy: "bm25" },
      });

      store.addAuditEvent({
        id: "audit-1",
        type: "decision",
        timestamp: new Date(),
        description: "Decision",
        actor: "system",
        details: {},
        evidenceIds: [],
      });

      const stats = store.getStats();

      expect(stats.totalEvidence).toBe(2);
      expect(stats.totalAuditEvents).toBe(1);
      expect(stats.avgTrustScore).toBeCloseTo(0.85, 2);
      expect(stats.oldestTimestamp).toBeInstanceOf(Date);
      expect(stats.newestTimestamp).toBeInstanceOf(Date);
    });
  });

  describe("Global Store", () => {
    it("should provide singleton instance", () => {
      const store1 = getEvidenceStore();
      const store2 = getEvidenceStore();

      expect(store1).toBe(store2);
    });

    it("should reset global store", () => {
      const store1 = getEvidenceStore();
      store1.addEvidence({
        id: "ev-1",
        sourceId: "chunk-1",
        content: "Test",
        trustScore: 0.9,
        timestamp: new Date(),
        metadata: { retrievalStrategy: "bm25" },
      });

      resetEvidenceStore();

      const store2 = getEvidenceStore();
      const stats = store2.getStats();

      expect(stats.totalEvidence).toBe(0);
    });
  });
});
