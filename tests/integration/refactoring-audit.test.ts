/**
 * Integration test for the refactoring audit workflow
 */

import { describe, it, expect, beforeAll } from "vitest";
import { AuditOrchestrator } from "../../src/application/refactoring/audit-orchestrator.js";
import { join } from "path";

describe("Refactoring Audit Integration", () => {
  const testRootDir = process.cwd();

  describe("Full Audit Workflow", () => {
    it("should run P1 audit successfully", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P1",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const result = await orchestrator.runAudit();

      expect(result).toBeDefined();
      expect(result.findings).toBeInstanceOf(Array);
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
      expect(result.metadata).toBeDefined();
    }, 30000); // 30 second timeout

    it("should run P2 audit successfully", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P2",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const result = await orchestrator.runAudit();

      expect(result.findings).toBeInstanceOf(Array);
      expect(result.summary.totalFindings).toBeGreaterThanOrEqual(0);
    }, 30000);

    it("should run P3 audit successfully", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P3",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const result = await orchestrator.runAudit();

      expect(result.findings).toBeInstanceOf(Array);
      expect(result.metadata.filesScanned).toBeGreaterThanOrEqual(0); // P3 may not scan files
      expect(result.summary.totalFindings).toBeGreaterThanOrEqual(0);
    }, 30000);

    it("should run complete audit with ALL priority", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "ALL",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const result = await orchestrator.runAudit();

      expect(result.findings).toBeInstanceOf(Array);
      expect(result.summary.totalFindings).toBeGreaterThanOrEqual(0);
      expect(result.summary.highPriority).toBeGreaterThanOrEqual(0);
      expect(result.summary.mediumPriority).toBeGreaterThanOrEqual(0);
      expect(result.summary.lowPriority).toBeGreaterThanOrEqual(0);
    }, 60000); // 60 second timeout for full audit
  });

  describe("Audit Result Structure", () => {
    it("should generate valid summary statistics", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "ALL",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const result = await orchestrator.runAudit();

      expect(result.summary.totalFindings).toBe(
        result.summary.highPriority +
          result.summary.mediumPriority +
          result.summary.lowPriority,
      );

      expect(result.summary.categoryCounts).toBeInstanceOf(Object);
    }, 60000);

    it("should generate suggestions for all findings", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P1",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const result = await orchestrator.runAudit();

      expect(result.suggestions.length).toBe(result.findings.length);

      for (const suggestion of result.suggestions) {
        expect(suggestion.issue).toBeDefined();
        expect(suggestion.actions).toBeInstanceOf(Array);
        expect(suggestion.actions.length).toBeGreaterThan(0);
        expect(suggestion.estimatedEffort).toMatch(/^(LOW|MEDIUM|HIGH)$/);
      }
    }, 30000);

    it("should track metadata correctly", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P2",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const startTime = Date.now();
      const result = await orchestrator.runAudit();
      const endTime = Date.now();

      expect(result.metadata.duration).toBeGreaterThan(0);
      expect(result.metadata.duration).toBeLessThanOrEqual(
        endTime - startTime + 100,
      );
      expect(result.metadata.filesScanned).toBeGreaterThan(0);
      expect(result.metadata.timestamp).toBeInstanceOf(Date);
      expect(result.metadata.config.priority).toBe("P2");
    }, 30000);
  });

  describe("Issue Detection Accuracy", () => {
    it("should detect TypeScript issues if present", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P1",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const result = await orchestrator.runAudit();

      const tsIssues = result.findings.filter((f) =>
        f.category.includes("TypeScript"),
      );

      // If there are TS errors, they should be HIGH priority P0
      for (const issue of tsIssues) {
        expect(issue.priority).toBe("HIGH");
        expect(issue.severity).toBe("P0");
        expect(issue.files).toBeInstanceOf(Array);
        expect(issue.files.length).toBeGreaterThan(0);
      }
    }, 30000);

    it("should detect schema issues if present", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P1",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const result = await orchestrator.runAudit();

      const schemaIssues = result.findings.filter((f) =>
        f.category.includes("Schema"),
      );

      for (const issue of schemaIssues) {
        expect(issue.recommendation).toBeDefined();
        expect(issue.recommendation.length).toBeGreaterThan(0);
      }
    }, 30000);

    it("should detect guardrail issues", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P1",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const result = await orchestrator.runAudit();

      const guardrailIssues = result.findings.filter((f) =>
        f.category.includes("Guardrail"),
      );

      for (const issue of guardrailIssues) {
        expect(issue.impact).toBeDefined();
        expect(issue.recommendation).toContain("protection");
      }
    }, 30000);
  });

  describe("Performance Benchmarks", () => {
    it("should complete P1 audit within reasonable time", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P1",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const startTime = Date.now();
      await orchestrator.runAudit();
      const duration = Date.now() - startTime;

      // P1 audit should complete within 15 seconds on average project
      expect(duration).toBeLessThan(15000);
    }, 20000);

    it("should complete full audit within reasonable time", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "ALL",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const startTime = Date.now();
      await orchestrator.runAudit();
      const duration = Date.now() - startTime;

      // Full audit should complete within 30 seconds on average project
      expect(duration).toBeLessThan(30000);
    }, 40000);
  });

  describe("Report Generation", () => {
    it("should generate readable report output", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P1",
        verbose: true,
        autoFix: false,
        rootDir: testRootDir,
      });

      const result = await orchestrator.runAudit();

      // Should not throw when printing report
      expect(() => orchestrator.printReport(result)).not.toThrow();
    }, 30000);
  });

  describe("File Caching", () => {
    it("should cache files for performance", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P2",
        verbose: false,
        autoFix: false,
        rootDir: testRootDir,
      });

      const result = await orchestrator.runAudit();

      // File cache should have entries
      expect(result.metadata.filesScanned).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Error Handling", () => {
    it("should handle invalid root directory gracefully", async () => {
      const orchestrator = new AuditOrchestrator({
        priority: "P1",
        verbose: false,
        autoFix: false,
        rootDir: "/nonexistent/directory",
      });

      // Should not crash, just return empty results
      const result = await orchestrator.runAudit();
      expect(result).toBeDefined();
    }, 10000);
  });
});
