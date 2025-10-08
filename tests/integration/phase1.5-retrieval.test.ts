/**
 * Phase 1.5: Retrieval Integration Tests
 *
 * Tests:
 * - RetrievalPort interface
 * - BM25Adapter
 * - SourceTrust scoring
 * - PoisoningGuard filtering
 */

import { describe, it, expect, beforeEach } from "vitest";
import { BM25Adapter } from "../../src/infrastructure/retrieval/bm25-adapter.js";
import { SourceTrust } from "../../src/infrastructure/retrieval/source-trust.js";
import { PoisoningGuard } from "../../src/infrastructure/retrieval/poisoning-guard.js";
import type { Chunk } from "../../src/rag/chunk.js";

describe("Phase 1.5: Retrieval Integration", () => {
  let corpus: Chunk[];

  beforeEach(() => {
    corpus = [
      {
        id: "chunk-1",
        text: "TypeScript is a typed superset of JavaScript.",
        content: "TypeScript is a typed superset of JavaScript.",
        start: 0,
        end: 46,
        meta: {
          domain: "docs.company.com",
          signature: "a".repeat(64), // Valid SHA-256 length
          timestamp: new Date("2025-01-01"),
          author: "official-team",
        },
      },
      {
        id: "chunk-2",
        text: "React is a JavaScript library for building user interfaces.",
        content: "React is a JavaScript library for building user interfaces.",
        start: 0,
        end: 59,
        meta: {
          domain: "unknown.com", // Not whitelisted
          timestamp: new Date("2023-01-01"), // Old
        },
      },
      {
        id: "chunk-3",
        text: "This document contains MALWARE and VIRUS instructions!",
        content: "This document contains MALWARE and VIRUS instructions!",
        start: 0,
        end: 55,
        meta: {
          domain: "docs.company.com",
        },
      },
    ];
  });

  describe("SourceTrust", () => {
    it("should score trusted domain highly", () => {
      const trust = new SourceTrust();
      const score = trust.scoreChunk(corpus[0]);

      expect(score.chunkId).toBe("chunk-1");
      expect(score.score).toBeGreaterThan(0.7); // High trust
      expect(score.factors.domainTrust).toBe(1.0); // Whitelisted domain
      expect(score.factors.signatureValid).toBe(true);
    });

    it("should score unknown domain lower", () => {
      const trust = new SourceTrust();
      const score = trust.scoreChunk(corpus[1]);

      expect(score.score).toBeLessThan(0.5); // Low trust
      expect(score.factors.domainTrust).toBe(0.3); // Unknown domain
      expect(score.factors.signatureValid).toBe(false); // No signature
    });

    it("should apply time decay to freshness", () => {
      const trust = new SourceTrust();
      const freshScore = trust.scoreChunk(corpus[0]); // 2025-01-01 (future)
      const oldScore = trust.scoreChunk(corpus[1]); // 2023-01-01 (old)

      expect(freshScore.factors.timeFreshness).toBeGreaterThan(
        oldScore.factors.timeFreshness,
      );
    });
  });

  describe("PoisoningGuard", () => {
    it("should pass clean chunks", () => {
      const guard = new PoisoningGuard();
      const check = guard.check(corpus[0]);

      expect(check.passed).toBe(true);
      expect(check.blocked).toHaveLength(0);
    });

    it("should block chunks from non-whitelisted domains", () => {
      const guard = new PoisoningGuard();
      const check = guard.check(corpus[1]);

      expect(check.passed).toBe(false);
      expect(check.blocked.length).toBeGreaterThan(0);
      expect(check.blocked[0]).toContain("not in allowlist");
    });

    it("should detect forbidden patterns", () => {
      const guard = new PoisoningGuard();
      const check = guard.check(corpus[2]);

      // Even if domain is whitelisted, forbidden patterns should block
      expect(check.passed).toBe(false);
      expect(check.blocked.some((b) => b.includes("Forbidden pattern"))).toBe(true);
    });
  });

  describe("BM25Adapter", () => {
    it("should retrieve relevant chunks", async () => {
      const adapter = new BM25Adapter(corpus);
      const result = await adapter.retrieve("TypeScript JavaScript", {
        topK: 2,
      });

      expect(result.query).toBe("TypeScript JavaScript");
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks.length).toBeLessThanOrEqual(2);
      expect(result.metadata.strategy).toBe("bm25");
    });

    it("should apply trust + poison filtering", async () => {
      const adapter = new BM25Adapter(corpus);
      const result = await adapter.retrieve("document", {
        topK: 5,
        filters: {
          trustThreshold: 0.5,
        },
      });

      // Chunk-3 should be filtered out (forbidden pattern)
      const chunk3 = result.chunks.find((c) => c.chunk.id === "chunk-3");
      expect(chunk3).toBeUndefined();

      // All returned chunks should have trust >= 0.5
      for (const chunk of result.chunks) {
        expect(chunk.trustScore.score).toBeGreaterThanOrEqual(0.5);
        expect(chunk.poisonCheck.passed).toBe(true);
      }
    });

    it("should provide metadata", async () => {
      const adapter = new BM25Adapter(corpus);
      const result = await adapter.retrieve("JavaScript");

      expect(result.metadata.duration).toBeGreaterThan(0);
      expect(result.metadata.totalCandidates).toBeGreaterThan(0);
      expect(result.metadata.avgTrustScore).toBeGreaterThanOrEqual(0);
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
    });

    it("should support batch retrieval", async () => {
      const adapter = new BM25Adapter(corpus);
      const results = await adapter.batchRetrieve(
        ["TypeScript", "React", "JavaScript"],
        { topK: 2 },
      );

      expect(results).toHaveLength(3);
      expect(results[0].query).toBe("TypeScript");
      expect(results[1].query).toBe("React");
      expect(results[2].query).toBe("JavaScript");
    });

    it("should provide statistics", async () => {
      const adapter = new BM25Adapter(corpus);

      // Run some queries
      await adapter.retrieve("test1");
      await adapter.retrieve("test2");

      const stats = adapter.stats();

      expect(stats.totalQueries).toBe(2);
      expect(stats.totalChunks).toBe(3);
      expect(stats.avgDuration).toBeGreaterThan(0);
      expect(stats.strategyBreakdown.bm25).toBe(2);
    });

    it("should report health status", async () => {
      const adapter = new BM25Adapter(corpus);
      const health = await adapter.health();

      expect(health.healthy).toBe(true);
      expect(health.message).toContain("3 chunks");
    });
  });
});
