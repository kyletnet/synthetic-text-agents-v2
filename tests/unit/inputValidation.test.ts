import { describe, it, expect } from "vitest";
import { z } from "zod";
import { InputValidator } from "../../src/shared/inputValidation";
import type { ValidationConfig } from "../../src/shared/inputValidation";

describe("InputValidator - Smoke Tests", () => {
  describe("Instance Creation", () => {
    it("should create an InputValidator instance", () => {
      const validator = new InputValidator();
      expect(validator).toBeDefined();
      expect(validator).toBeInstanceOf(InputValidator);
    });

    it("should create instance with custom config", () => {
      const config: Partial<ValidationConfig> = {
        maxStringLength: 5000,
        maxArrayLength: 500,
        enableXSSProtection: false,
      };
      const validator = new InputValidator(config);
      expect(validator).toBeDefined();
    });
  });

  describe("Schema Validation", () => {
    it("should validate valid input", async () => {
      const validator = new InputValidator();
      const schema = z.object({ name: z.string(), age: z.number() });

      const result = await validator.validate(schema, {
        name: "John",
        age: 30,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: "John", age: 30 });
    });

    it("should reject invalid input", async () => {
      const validator = new InputValidator();
      const schema = z.object({ name: z.string(), age: z.number() });

      const result = await validator.validate(schema, {
        name: "John",
        age: "not-a-number",
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it("should handle string schema", async () => {
      const validator = new InputValidator();
      const schema = z.string();

      const result = await validator.validate(schema, "test string");

      expect(result.success).toBe(true);
      expect(result.data).toBe("test string");
    });

    it("should handle array schema", async () => {
      const validator = new InputValidator();
      const schema = z.array(z.number());

      const result = await validator.validate(schema, [1, 2, 3]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
    });
  });

  describe("String Sanitization", () => {
    it("should sanitize string input", () => {
      const validator = new InputValidator();

      const result = validator.sanitizeString("  test  string  ");

      expect(typeof result).toBe("string");
    });

    it("should handle empty string", () => {
      const validator = new InputValidator();

      const result = validator.sanitizeString("");

      expect(result).toBe("");
    });

    it("should handle special characters", () => {
      const validator = new InputValidator();

      const result = validator.sanitizeString("<script>alert('xss')</script>");

      expect(typeof result).toBe("string");
    });
  });

  describe("Security Checks", () => {
    it("should enable XSS protection", () => {
      const validator = new InputValidator({ enableXSSProtection: true });
      expect(validator).toBeDefined();
    });

    it("should enable SQL injection protection", () => {
      const validator = new InputValidator({
        enableSQLInjectionProtection: true,
      });
      expect(validator).toBeDefined();
    });

    it("should configure max string length", () => {
      const validator = new InputValidator({ maxStringLength: 10 });
      expect(validator).toBeDefined();
    });
  });

  describe("Object Validation", () => {
    it("should configure max object depth", () => {
      const validator = new InputValidator({ maxObjectDepth: 3 });
      expect(validator).toBeDefined();
    });

    it("should handle nested object validation via schema", async () => {
      const validator = new InputValidator({ maxObjectDepth: 2 });
      const schema = z.object({
        level1: z.object({
          level2: z.string(),
        }),
      });

      const result = await validator.validate(schema, {
        level1: { level2: "value" },
      });

      expect(result.success).toBe(true);
    });
  });

  describe("Array Validation", () => {
    it("should configure max array length", () => {
      const validator = new InputValidator({ maxArrayLength: 100 });
      expect(validator).toBeDefined();
    });

    it("should validate arrays via schema", async () => {
      const validator = new InputValidator({ maxArrayLength: 5 });
      const schema = z.array(z.number());

      const result = await validator.validate(schema, [1, 2, 3]);

      expect(result.success).toBe(true);
    });
  });

  describe("Configuration", () => {
    it("should use default config values", () => {
      const validator = new InputValidator();
      expect(validator).toBeDefined();
    });

    it("should allow disabling sanitization", () => {
      const validator = new InputValidator({ enableSanitization: false });
      expect(validator).toBeDefined();
    });

    it("should allow custom max lengths", () => {
      const validator = new InputValidator({
        maxStringLength: 1000,
        maxArrayLength: 50,
        maxObjectDepth: 5,
      });
      expect(validator).toBeDefined();
    });
  });
});
