import { describe, it, expect } from "vitest";
import { djb2 } from "../../src/shared/hash";

describe("Hash Functions - Smoke Tests", () => {
  describe("djb2", () => {
    it("should hash a simple string", () => {
      const result = djb2("hello");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should produce consistent hashes", () => {
      const text = "test string";
      const hash1 = djb2(text);
      const hash2 = djb2(text);
      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different inputs", () => {
      const hash1 = djb2("hello");
      const hash2 = djb2("world");
      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string", () => {
      const result = djb2("");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle special characters", () => {
      const result = djb2("!@#$%^&*()");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle unicode characters", () => {
      const result = djb2("안녕하세요 🎉");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle long strings", () => {
      const longString = "a".repeat(10000);
      const result = djb2(longString);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should return hexadecimal string", () => {
      const result = djb2("test");
      expect(result).toMatch(/^[0-9a-f]+$/);
    });
  });
});
