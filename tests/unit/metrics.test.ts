import { describe, it, expect } from "vitest";
import {
  wordCount,
  ngramOverlap,
  difficultyScore,
} from "../../src/shared/metrics";

describe("Metrics Functions - Smoke Tests", () => {
  describe("wordCount", () => {
    it("should count words in a simple string", () => {
      const result = wordCount("hello world");
      expect(result).toBe(2);
    });

    it("should handle empty string", () => {
      const result = wordCount("");
      expect(result).toBe(0);
    });

    it("should handle single word", () => {
      const result = wordCount("hello");
      expect(result).toBe(1);
    });

    it("should handle multiple spaces", () => {
      const result = wordCount("hello    world");
      expect(result).toBe(2);
    });

    it("should handle leading/trailing spaces", () => {
      const result = wordCount("  hello world  ");
      expect(result).toBe(2);
    });

    it("should handle newlines and tabs", () => {
      const result = wordCount("hello\nworld\ttesting");
      expect(result).toBe(3);
    });
  });

  describe("ngramOverlap", () => {
    it("should calculate bigram overlap", () => {
      const result = ngramOverlap("hello world", "hello world", 2);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("should return 0 for completely different strings", () => {
      const result = ngramOverlap("abc", "xyz", 2);
      expect(result).toBe(0);
    });

    it("should handle identical strings", () => {
      const result = ngramOverlap("test string", "test string", 2);
      expect(result).toBe(1);
    });

    it("should handle empty strings", () => {
      const result = ngramOverlap("", "", 2);
      expect(result).toBe(0);
    });

    it("should handle partial overlap", () => {
      const result = ngramOverlap("hello world", "world hello", 2);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("should handle custom n-gram size", () => {
      const result = ngramOverlap("a b c d", "a b c d", 3);
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe("difficultyScore", () => {
    it("should calculate difficulty for simple text", () => {
      const result = difficultyScore("cat dog");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it("should give higher score for longer words", () => {
      const simple = difficultyScore("cat dog");
      const complex = difficultyScore("sophisticated terminology");
      expect(complex).toBeGreaterThan(simple);
    });

    it("should handle empty string", () => {
      const result = difficultyScore("");
      expect(result).toBe(0);
    });

    it("should handle single word", () => {
      const result = difficultyScore("hello");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("should handle unicode characters", () => {
      const result = difficultyScore("안녕하세요");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("should handle mixed English and Korean", () => {
      const result = difficultyScore("hello 안녕 world");
      expect(typeof result).toBe("number");
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });
});
