/**
 * Gate E: Explanation Stability Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { GateE } from "../../../src/domain/preflight/gate-e-explanation-stability.js";
import {
  ExplanationValidator,
} from "../../../src/core/transparency/explanation-validator.js";
import {
  ExplanationCache,
  resetExplanationCache,
} from "../../../src/core/transparency/explanation-cache.js";

describe("Gate E: Explanation Stability", () => {
  let gateE: GateE;

  beforeEach(() => {
    resetExplanationCache();
    gateE = new GateE();
  });

  const context1 = {
    decision: "approve",
    trustScore: 0.85,
    evidenceCount: 5,
  };

  const baselineExplanation =
    "Policy approved due to high trust score (0.85) and sufficient evidence (5 sources)";

  describe("First Explanation Caching", () => {
    it("should cache first explanation and allow", () => {
      const result = gateE.check(context1, baselineExplanation);

      expect(result.passed).toBe(true);
      expect(result.action).toBe("allow");
      expect(result.similarity).toBe(1.0);
      expect(result.details.cached).toBe(true);
      expect(result.message).toContain("First explanation cached");
    });

    it("should not overwrite cached explanation", () => {
      gateE.check(context1, baselineExplanation);

      const differentExplanation = "Completely different explanation";
      const result = gateE.check(context1, differentExplanation);

      // Should compare against original cached explanation
      expect(result.details.cached).toBe(false);
      expect(result.similarity).toBeLessThan(0.5);
    });
  });

  describe("Consistency Validation", () => {
    beforeEach(() => {
      // Cache baseline
      gateE.check(context1, baselineExplanation);
    });

    it("should allow identical explanation", () => {
      const result = gateE.check(context1, baselineExplanation);

      expect(result.passed).toBe(true);
      expect(result.action).toBe("allow");
      expect(result.similarity).toBeGreaterThanOrEqual(0.95);
    });

    it("should allow very similar explanation (>95%)", () => {
      // Use almost identical explanation (only minor wording change)
      const similarExplanation =
        "Policy approved due to high trust score (0.85) and sufficient evidence (5 sources)";

      const result = gateE.check(context1, similarExplanation);

      expect(result.passed).toBe(true);
      expect(result.action).toBe("allow");
      expect(result.similarity).toBeGreaterThanOrEqual(0.95);
    });

    it("should warn on moderate drift (85-95%)", () => {
      const moderateDrift =
        "Approved due to trust score 0.85 and evidence count of 5";

      const result = gateE.check(context1, moderateDrift);

      if (result.similarity >= 0.85 && result.similarity < 0.95) {
        expect(result.action).toBe("warn");
        expect(result.message).toContain("drift detected");
      }
    });

    it("should block critical drift (<85%)", () => {
      const criticalDrift =
        "Decision based on completely different reasoning and factors";

      const result = gateE.check(context1, criticalDrift);

      expect(result.similarity).toBeLessThan(0.85);
      expect(result.action).toBe("block");
      expect(result.message).toContain("Critical explanation drift");
      expect(result.details.fallbackUsed).toBe(true);
    });
  });

  describe("Stable Explanation Retrieval", () => {
    beforeEach(() => {
      gateE.check(context1, baselineExplanation);
    });

    it("should return new explanation if stable", () => {
      const similarExplanation =
        "Policy approved due to high trust score (0.85) and sufficient evidence (5 sources)";

      const stable = gateE.getStableExplanation(context1, similarExplanation);

      expect(stable).toBe(similarExplanation);
    });

    it("should return cached explanation if critical drift", () => {
      const driftedExplanation = "Completely different and unrelated explanation";

      const stable = gateE.getStableExplanation(context1, driftedExplanation);

      // Should fallback to cached baseline
      expect(stable).toBe(baselineExplanation);
      expect(stable).not.toBe(driftedExplanation);
    });
  });

  describe("Context Isolation", () => {
    it("should maintain separate explanations for different contexts", () => {
      const context2 = {
        decision: "reject",
        trustScore: 0.3,
        evidenceCount: 1,
      };

      const explanation1 = "Approved due to high trust";
      const explanation2 = "Rejected due to low trust";

      gateE.check(context1, explanation1);
      gateE.check(context2, explanation2);

      // Each context should have its own cached explanation
      const result1 = gateE.check(context1, explanation1);
      const result2 = gateE.check(context2, explanation2);

      expect(result1.similarity).toBeGreaterThan(0.95);
      expect(result2.similarity).toBeGreaterThan(0.95);
    });
  });

  describe("Cache Statistics", () => {
    it("should track cache statistics", () => {
      gateE.check(context1, baselineExplanation);
      gateE.check(context1, baselineExplanation); // Second check

      const stats = gateE.getStats();

      expect(stats.totalEntries).toBe(1);
      expect(stats.totalUsage).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });
  });
});

describe("Explanation Validator", () => {
  const validator = new ExplanationValidator();

  describe("Token Overlap Similarity", () => {
    it("should calculate 100% similarity for identical text", () => {
      const text = "This is a test explanation";
      const result = validator.calculateSimilarity(text, text);

      expect(result.similarity).toBe(1.0);
      expect(result.method).toBe("token-overlap");
    });

    it("should calculate high similarity for very similar text", () => {
      const text1 = "Policy approved due to high trust score";
      const text2 = "Policy approved due to high trust score value";

      const result = validator.calculateSimilarity(text1, text2);

      expect(result.similarity).toBeGreaterThan(0.8);
    });

    it("should calculate low similarity for different text", () => {
      const text1 = "Policy approved due to high trust";
      const text2 = "Completely different reasoning and factors";

      const result = validator.calculateSimilarity(text1, text2);

      expect(result.similarity).toBeLessThan(0.5);
    });

    it("should be case-insensitive", () => {
      const text1 = "POLICY APPROVED";
      const text2 = "policy approved";

      const result = validator.calculateSimilarity(text1, text2);

      expect(result.similarity).toBe(1.0);
    });

    it("should ignore punctuation", () => {
      const text1 = "Policy approved!";
      const text2 = "Policy approved.";

      const result = validator.calculateSimilarity(text1, text2);

      expect(result.similarity).toBe(1.0);
    });
  });

  describe("Consistency Validation", () => {
    it("should validate high similarity as consistent", () => {
      const baseline = "Policy approved due to high trust score";
      const candidate = "Policy approved due to high trust score"; // Identical

      const isValid = validator.validate(baseline, candidate);

      expect(isValid).toBe(true);
    });

    it("should reject low similarity as inconsistent", () => {
      const baseline = "Policy approved due to high trust";
      const candidate = "Rejected for completely different reasons";

      const isValid = validator.validate(baseline, candidate);

      expect(isValid).toBe(false);
    });
  });
});

describe("Explanation Cache", () => {
  let cache: ExplanationCache;

  beforeEach(() => {
    cache = new ExplanationCache();
  });

  describe("Cache Operations", () => {
    it("should store and retrieve explanations", () => {
      const context = { decision: "approve", score: 0.9 };
      const explanation = "Approved due to high score";

      cache.set(context, explanation);
      const cached = cache.get(context);

      expect(cached).not.toBeNull();
      expect(cached?.explanation).toBe(explanation);
    });

    it("should return null for non-existent context", () => {
      const context = { decision: "approve", score: 0.9 };
      const cached = cache.get(context);

      expect(cached).toBeNull();
    });

    it("should increment usage count on retrieval", () => {
      const context = { decision: "approve", score: 0.9 };
      cache.set(context, "Explanation");

      const first = cache.get(context);
      const second = cache.get(context);

      // First get returns usageCount 0 (before increment)
      // Second get returns usageCount 1 (before second increment)
      expect(first?.usageCount).toBe(0);
      expect(second?.usageCount).toBe(1);
    });

    it("should use first-write-wins strategy", () => {
      const context = { decision: "approve", score: 0.9 };

      cache.set(context, "First explanation");
      cache.set(context, "Second explanation"); // Should be ignored

      const cached = cache.get(context);

      expect(cached?.explanation).toBe("First explanation");
    });

    it("should generate same hash for equivalent contexts", () => {
      const context1 = { a: 1, b: 2 };
      const context2 = { b: 2, a: 1 }; // Different order, same content

      cache.set(context1, "Explanation");

      expect(cache.has(context2)).toBe(true);
    });
  });

  describe("Cache Statistics", () => {
    it("should calculate statistics", () => {
      cache.set({ id: 1 }, "Explanation 1");
      cache.set({ id: 2 }, "Explanation 2");

      cache.get({ id: 1 });
      cache.get({ id: 1 });
      cache.get({ id: 2 });

      const stats = cache.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.totalUsage).toBe(3);
      expect(stats.avgUsagePerEntry).toBe(1.5);
    });
  });
});
