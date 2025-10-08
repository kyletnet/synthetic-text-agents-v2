/**
 * Unit tests for TypeScriptFixCommand
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TypeScriptFixCommand } from "../../../src/domain/fixes/typescript-fix.js";
import { Logger } from "../../../src/shared/logger.js";
import type { Issue } from "../../../src/domain/fixes/fix-command.js";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("TypeScriptFixCommand", () => {
  let command: TypeScriptFixCommand;
  let logger: Logger;
  let testDir: string;

  beforeEach(async () => {
    logger = new Logger({ level: "error" }); // Suppress logs during tests
    command = new TypeScriptFixCommand(logger);

    // Create a temporary test directory
    testDir = join(tmpdir(), `ts-fix-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("canFix", () => {
    it("should return true for TypeScript issues", () => {
      const issue: Issue = {
        id: "ts-1",
        category: "typescript",
        severity: "high",
        description: "Type error",
        filePath: "/test.ts",
        message: "Type 'string' is not assignable to type 'number'",
        autoFixable: true,
      };

      expect(command.canFix(issue)).toBe(true);
    });

    it("should return false for non-TypeScript issues", () => {
      const issue: Issue = {
        id: "eslint-1",
        category: "eslint",
        severity: "medium",
        description: "ESLint error",
        filePath: "/test.ts",
        message: "Missing semicolon",
        autoFixable: true,
      };

      expect(command.canFix(issue)).toBe(false);
    });

    it("should return false for non-auto-fixable TypeScript issues", () => {
      const issue: Issue = {
        id: "ts-2",
        category: "typescript",
        severity: "critical",
        description: "Complex type error",
        filePath: "/test.ts",
        message: "Cannot infer type",
        autoFixable: false,
      };

      expect(command.canFix(issue)).toBe(false);
    });
  });

  describe("validate", () => {
    it("should validate fixable issues", async () => {
      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "medium",
          description: "Unused variable",
          filePath: "/test.ts",
          line: 10,
          message: "foo is declared but never used",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
      ];

      const result = await command.validate(issues);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.riskLevel).toBe("low");
    });

    it("should reject empty issues array", async () => {
      const result = await command.validate([]);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("No issues provided");
    });

    it("should reject unfixable issues", async () => {
      const issues: Issue[] = [
        {
          id: "eslint-1",
          category: "eslint",
          severity: "low",
          description: "ESLint issue",
          filePath: "/test.ts",
          message: "Prefer const",
          autoFixable: true,
        },
      ];

      const result = await command.validate(issues);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("execute", () => {
    it("should fix unused variable by adding _ prefix", async () => {
      const testFile = join(testDir, "test.ts");
      const originalContent = `function test(foo: string) {\n  console.log("test");\n}\n`;
      await fs.writeFile(testFile, originalContent);

      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "medium",
          description: "Unused parameter",
          filePath: testFile,
          line: 1,
          message: "foo is declared but never used",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
      ];

      const result = await command.execute(issues);

      expect(result.success).toBe(true);
      expect(result.fixedIssues).toHaveLength(1);
      expect(result.changes).toHaveLength(1);

      const modifiedContent = await fs.readFile(testFile, "utf8");
      expect(modifiedContent).toContain("_foo");
    });

    it("should handle dry run mode without modifying files", async () => {
      const testFile = join(testDir, "test.ts");
      const originalContent = `let foo = 123;\n`;
      await fs.writeFile(testFile, originalContent);

      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: testFile,
          line: 1,
          message: "foo is declared but never used",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
      ];

      const result = await command.execute(issues, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.changes).toHaveLength(1);

      // File should not be modified
      const content = await fs.readFile(testFile, "utf8");
      expect(content).toBe(originalContent);
    });

    it("should create backups when requested", async () => {
      const testFile = join(testDir, "test.ts");
      const originalContent = `let foo = 123;\n`;
      await fs.writeFile(testFile, originalContent);

      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: testFile,
          line: 1,
          message: "foo is declared but never used",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
      ];

      await command.execute(issues, { createBackup: true });

      // Check if backup file exists
      const files = await fs.readdir(testDir);
      const backupFiles = files.filter((f) => f.includes(".backup-"));
      expect(backupFiles.length).toBeGreaterThan(0);
    });

    it("should handle multiple issues in the same file", async () => {
      const testFile = join(testDir, "test.ts");
      const originalContent = `function test(foo: string, bar: number) {\n  console.log("test");\n}\n`;
      await fs.writeFile(testFile, originalContent);

      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "medium",
          description: "Unused parameter",
          filePath: testFile,
          line: 1,
          message: "foo is declared but never used",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
        {
          id: "ts-2",
          category: "typescript",
          severity: "medium",
          description: "Unused parameter",
          filePath: testFile,
          line: 1,
          message: "bar is declared but never used",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "bar" },
        },
      ];

      const result = await command.execute(issues);

      expect(result.success).toBe(true);
      expect(result.fixedIssues).toHaveLength(2);

      const modifiedContent = await fs.readFile(testFile, "utf8");
      expect(modifiedContent).toContain("_foo");
      expect(modifiedContent).toContain("_bar");
    });

    it("should report progress via callback", async () => {
      const testFile = join(testDir, "test.ts");
      await fs.writeFile(testFile, "let foo = 1;\n");

      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: testFile,
          line: 1,
          message: "foo is declared but never used",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
      ];

      const progressUpdates: any[] = [];
      await command.execute(issues, {
        onProgress: (update) => progressUpdates.push(update),
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[0]).toHaveProperty("step");
      expect(progressUpdates[0]).toHaveProperty("total");
      expect(progressUpdates[0]).toHaveProperty("percentage");
    });
  });

  describe("undo", () => {
    it("should undo changes and restore original content", async () => {
      const testFile = join(testDir, "test.ts");
      const originalContent = `let foo = 123;\n`;
      await fs.writeFile(testFile, originalContent);

      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: testFile,
          line: 1,
          message: "foo is declared but never used",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
      ];

      // Execute fix
      await command.execute(issues);

      // Verify change was applied
      let content = await fs.readFile(testFile, "utf8");
      expect(content).toContain("_foo");

      // Undo
      const undoResult = await command.undo();
      expect(undoResult).toBe(true);

      // Verify original content restored
      content = await fs.readFile(testFile, "utf8");
      expect(content).toBe(originalContent);
    });
  });
});
