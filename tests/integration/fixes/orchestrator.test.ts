/**
 * Integration tests for FixOrchestrator
 */

import { describe, it, expect, beforeEach } from "vitest";
import { FixOrchestrator } from "../../../src/application/fixes/fix-orchestrator.js";
import { TypeScriptFixCommand } from "../../../src/domain/fixes/typescript-fix.js";
import { ESLintFixCommand } from "../../../src/domain/fixes/eslint-fix.js";
import { ImportFixCommand } from "../../../src/domain/fixes/import-fix.js";
import { Logger } from "../../../src/shared/logger.js";
import type { Issue } from "../../../src/domain/fixes/fix-command.js";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("FixOrchestrator Integration Tests", () => {
  let orchestrator: FixOrchestrator;
  let logger: Logger;
  let testDir: string;

  beforeEach(async () => {
    logger = new Logger({ level: "error" });
    orchestrator = new FixOrchestrator(logger);

    // Register commands
    orchestrator.registerCommand(new TypeScriptFixCommand(logger));
    orchestrator.registerCommand(new ESLintFixCommand(logger));
    orchestrator.registerCommand(new ImportFixCommand(logger));

    // Create test directory
    testDir = join(tmpdir(), `orch-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    orchestrator.clear();

    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  describe("Command Registration", () => {
    it("should register and retrieve commands", () => {
      const commands = orchestrator.getCommands();
      expect(commands).toHaveLength(3);

      const commandIds = commands.map((c) => c.id);
      expect(commandIds).toContain("typescript-fix");
      expect(commandIds).toContain("eslint-fix");
      expect(commandIds).toContain("import-fix");
    });

    it("should unregister commands", () => {
      orchestrator.unregisterCommand("typescript-fix");
      const commands = orchestrator.getCommands();
      expect(commands).toHaveLength(2);
    });

    it("should clear all commands", () => {
      orchestrator.clear();
      expect(orchestrator.getCommands()).toHaveLength(0);
    });
  });

  describe("Sequential Execution", () => {
    it("should execute multiple fixes sequentially", async () => {
      // Create test files
      const file1 = join(testDir, "test1.ts");
      const file2 = join(testDir, "test2.ts");

      await fs.writeFile(file1, "let foo = 1;\n");
      await fs.writeFile(file2, "let bar = 2;\n");

      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: file1,
          line: 1,
          message: "foo is unused",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
        {
          id: "ts-2",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: file2,
          line: 1,
          message: "bar is unused",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "bar" },
        },
      ];

      const result = await orchestrator.execute(issues, {
        maxParallel: 1,
        transactional: true,
      });

      expect(result.success).toBe(true);
      expect(result.totalFixed).toBe(2);
      expect(result.totalFailed).toBe(0);
      expect(result.commandResults.size).toBeGreaterThan(0);
    });
  });

  describe("Parallel Execution", () => {
    it("should execute multiple fixes in parallel", async () => {
      const files = await Promise.all(
        [1, 2, 3, 4, 5].map(async (i) => {
          const file = join(testDir, `test${i}.ts`);
          await fs.writeFile(file, `let var${i} = ${i};\n`);
          return file;
        }),
      );

      const issues: Issue[] = files.map((file, i) => ({
        id: `ts-${i + 1}`,
        category: "typescript" as const,
        severity: "low" as const,
        description: "Unused variable",
        filePath: file,
        line: 1,
        message: `var${i + 1} is unused`,
        autoFixable: true,
        metadata: { fixType: "unused-variable", variableName: `var${i + 1}` },
      }));

      const startTime = Date.now();
      const result = await orchestrator.execute(issues, {
        maxParallel: 5,
        transactional: false,
      });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.totalFixed).toBe(5);

      // Parallel execution should be faster than sequential
      // (though this is a rough heuristic)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe("Transaction Mode", () => {
    it("should rollback all changes on failure in transactional mode", async () => {
      const file1 = join(testDir, "test1.ts");
      const file2 = join(testDir, "test-nonexistent.ts");

      await fs.writeFile(file1, "let foo = 1;\n");
      const originalContent = await fs.readFile(file1, "utf8");

      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: file1,
          line: 1,
          message: "foo is unused",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
        {
          id: "ts-2",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: file2, // This file doesn't exist
          line: 1,
          message: "bar is unused",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "bar" },
        },
      ];

      const result = await orchestrator.execute(issues, {
        transactional: true,
        maxParallel: 1,
      });

      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);

      // Verify file1 was rolled back to original content
      const restoredContent = await fs.readFile(file1, "utf8");
      expect(restoredContent).toBe(originalContent);
    });

    it("should continue on error in non-transactional mode", async () => {
      const file1 = join(testDir, "test1.ts");
      const file2 = join(testDir, "test-nonexistent.ts");
      const file3 = join(testDir, "test3.ts");

      await fs.writeFile(file1, "let foo = 1;\n");
      await fs.writeFile(file3, "let baz = 3;\n");

      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: file1,
          line: 1,
          message: "foo is unused",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
        {
          id: "ts-2",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: file2, // Doesn't exist
          line: 1,
          message: "bar is unused",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "bar" },
        },
        {
          id: "ts-3",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: file3,
          line: 1,
          message: "baz is unused",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "baz" },
        },
      ];

      const result = await orchestrator.execute(issues, {
        transactional: false,
        continueOnError: true,
        maxParallel: 1,
      });

      // Should have fixed file1 and file3, failed on file2
      expect(result.totalFixed).toBeGreaterThan(0);
      expect(result.totalFailed).toBeGreaterThan(0);
      expect(result.rolledBack).toBe(false);
    });
  });

  describe("Dry Run Mode", () => {
    it("should not modify files in dry run mode", async () => {
      const testFile = join(testDir, "test.ts");
      const originalContent = "let foo = 1;\n";
      await fs.writeFile(testFile, originalContent);

      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: testFile,
          line: 1,
          message: "foo is unused",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
      ];

      const result = await orchestrator.execute(issues, {
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.totalChanges).toBeGreaterThan(0);

      // File should not be modified
      const content = await fs.readFile(testFile, "utf8");
      expect(content).toBe(originalContent);
    });
  });

  describe("Progress Tracking", () => {
    it("should emit progress events during execution", async () => {
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
          message: "foo is unused",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "foo" },
        },
      ];

      const events: any[] = [];
      orchestrator.on("command:started", (data) =>
        events.push({ type: "started", data }),
      );
      orchestrator.on("command:completed", (data) =>
        events.push({ type: "completed", data }),
      );

      await orchestrator.execute(issues);

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type === "started")).toBe(true);
      expect(events.some((e) => e.type === "completed")).toBe(true);
    });
  });

  describe("Mixed Issue Types", () => {
    it("should route issues to appropriate commands", async () => {
      const testFile = join(testDir, "test.ts");
      await fs.writeFile(
        testFile,
        'import { foo } from "./bar"\nlet unused = 1;\n',
      );

      const issues: Issue[] = [
        {
          id: "ts-1",
          category: "typescript",
          severity: "low",
          description: "Unused variable",
          filePath: testFile,
          line: 2,
          message: "unused is declared but never used",
          autoFixable: true,
          metadata: { fixType: "unused-variable", variableName: "unused" },
        },
        {
          id: "import-1",
          category: "import",
          severity: "medium",
          description: "Missing .js extension",
          filePath: testFile,
          line: 1,
          message: "Import path should include .js extension",
          autoFixable: true,
          metadata: { fixType: "missing-js-extension" },
        },
      ];

      const result = await orchestrator.execute(issues, {
        maxParallel: 2,
      });

      expect(result.success).toBe(true);
      expect(result.commandResults.size).toBeGreaterThan(0);

      // Both TypeScript and Import commands should have been executed
      const commandIds = Array.from(result.commandResults.keys());
      expect(commandIds).toContain("typescript-fix");
      expect(commandIds).toContain("import-fix");
    });
  });
});
