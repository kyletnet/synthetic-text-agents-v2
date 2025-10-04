import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { appendJSONL } from "../../src/shared/jsonl";

describe("JSONL Functions - Smoke Tests", () => {
  const testDir = path.join(process.cwd(), "test-temp-jsonl");
  const testFile = path.join(testDir, "test.jsonl");

  beforeEach(() => {
    // Clean up before each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up after each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("appendJSONL", () => {
    it("should create file if it does not exist", () => {
      appendJSONL(testFile, { test: "data" });

      expect(fs.existsSync(testFile)).toBe(true);
    });

    it("should create directory if it does not exist", () => {
      const nestedFile = path.join(testDir, "nested", "deep", "file.jsonl");

      appendJSONL(nestedFile, { test: "data" });

      expect(fs.existsSync(nestedFile)).toBe(true);
    });

    it("should append object as JSON line", () => {
      const data = { name: "test", value: 123 };

      appendJSONL(testFile, data);

      const content = fs.readFileSync(testFile, "utf8");
      expect(content).toContain(JSON.stringify(data));
      expect(content.endsWith("\n")).toBe(true);
    });

    it("should append multiple objects", () => {
      appendJSONL(testFile, { id: 1 });
      appendJSONL(testFile, { id: 2 });
      appendJSONL(testFile, { id: 3 });

      const content = fs.readFileSync(testFile, "utf8");
      const lines = content.trim().split("\n");

      expect(lines.length).toBe(3);
      expect(JSON.parse(lines[0])).toEqual({ id: 1 });
      expect(JSON.parse(lines[1])).toEqual({ id: 2 });
      expect(JSON.parse(lines[2])).toEqual({ id: 3 });
    });

    it("should handle objects with nested properties", () => {
      const data = {
        user: {
          name: "John",
          age: 30,
          addresses: [{ city: "NYC" }, { city: "LA" }],
        },
      };

      appendJSONL(testFile, data);

      const content = fs.readFileSync(testFile, "utf8");
      const parsed = JSON.parse(content.trim());

      expect(parsed).toEqual(data);
    });

    it("should handle arrays", () => {
      const data = [1, 2, 3, 4, 5];

      appendJSONL(testFile, data);

      const content = fs.readFileSync(testFile, "utf8");
      const parsed = JSON.parse(content.trim());

      expect(parsed).toEqual(data);
    });

    it("should handle strings", () => {
      appendJSONL(testFile, "test string");

      const content = fs.readFileSync(testFile, "utf8");
      const parsed = JSON.parse(content.trim());

      expect(parsed).toBe("test string");
    });

    it("should handle numbers", () => {
      appendJSONL(testFile, 123);

      const content = fs.readFileSync(testFile, "utf8");
      const parsed = JSON.parse(content.trim());

      expect(parsed).toBe(123);
    });

    it("should handle booleans", () => {
      appendJSONL(testFile, true);

      const content = fs.readFileSync(testFile, "utf8");
      const parsed = JSON.parse(content.trim());

      expect(parsed).toBe(true);
    });

    it("should handle null", () => {
      appendJSONL(testFile, null);

      const content = fs.readFileSync(testFile, "utf8");
      const parsed = JSON.parse(content.trim());

      expect(parsed).toBe(null);
    });

    it("should handle special characters in strings", () => {
      const data = { message: 'Test "quotes" and \n newlines' };

      appendJSONL(testFile, data);

      const content = fs.readFileSync(testFile, "utf8");
      const parsed = JSON.parse(content.trim());

      expect(parsed).toEqual(data);
    });

    it("should handle unicode characters", () => {
      const data = { text: "안녕하세요 🎉" };

      appendJSONL(testFile, data);

      const content = fs.readFileSync(testFile, "utf8");
      const parsed = JSON.parse(content.trim());

      expect(parsed).toEqual(data);
    });
  });
});
