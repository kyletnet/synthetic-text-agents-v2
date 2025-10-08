/**
 * Unit Tests: Gap Analyzer
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  GapAnalyzer,
  GapAutoFixer,
} from "../../../src/domain/analysis/gap-analyzer.js";
import type {
  Gap,
  GapCheckConfig,
  GapCheckDetector,
  GapDetectionContext,
} from "../../../src/domain/analysis/gap-types.js";

describe("GapAnalyzer", () => {
  let analyzer: GapAnalyzer;

  beforeEach(() => {
    analyzer = new GapAnalyzer();
  });

  describe("registerDetector", () => {
    it("should register a detector", async () => {
      const mockDetector: GapCheckDetector = {
        checkId: "test-check",
        detect: vi.fn().mockResolvedValue([]),
      };

      analyzer.registerDetector("test-check", mockDetector);

      const check: GapCheckConfig = {
        id: "test-check",
        name: "Test Check",
        enabled: true,
        severity: "P1",
        category: "docs",
        autoFixable: false,
      };

      await analyzer.runCheck(check);

      expect(mockDetector.detect).toHaveBeenCalled();
    });
  });

  describe("runCheck", () => {
    it("should call detector with correct context", async () => {
      const mockDetector: GapCheckDetector = {
        checkId: "test-check",
        detect: vi.fn().mockResolvedValue([]),
      };

      analyzer.registerDetector("test-check", mockDetector);

      const check: GapCheckConfig = {
        id: "test-check",
        name: "Test Check",
        enabled: true,
        severity: "P1",
        category: "docs",
        config: { foo: "bar" },
        autoFixable: true,
      };

      await analyzer.runCheck(check);

      expect(mockDetector.detect).toHaveBeenCalledWith({
        checkId: "test-check",
        severity: "P1",
        category: "docs",
        config: { foo: "bar" },
        autoFixable: true,
      });
    });

    it("should throw error if detector not found", async () => {
      const check: GapCheckConfig = {
        id: "unknown-check",
        name: "Unknown Check",
        enabled: true,
        severity: "P1",
        category: "docs",
        autoFixable: false,
      };

      await expect(analyzer.runCheck(check)).rejects.toThrow(
        "No detector registered for check: unknown-check",
      );
    });
  });

  describe("runChecks", () => {
    it("should run multiple checks", async () => {
      const detector1: GapCheckDetector = {
        checkId: "check1",
        detect: vi.fn().mockResolvedValue([
          {
            id: "gap1",
            checkId: "check1",
            severity: "P0",
            category: "docs",
            title: "Gap 1",
            description: "Description 1",
            autoFixable: false,
          },
        ]),
      };

      const detector2: GapCheckDetector = {
        checkId: "check2",
        detect: vi.fn().mockResolvedValue([
          {
            id: "gap2",
            checkId: "check2",
            severity: "P1",
            category: "security",
            title: "Gap 2",
            description: "Description 2",
            autoFixable: false,
          },
        ]),
      };

      analyzer.registerDetector("check1", detector1);
      analyzer.registerDetector("check2", detector2);

      const checks: GapCheckConfig[] = [
        {
          id: "check1",
          name: "Check 1",
          enabled: true,
          severity: "P0",
          category: "docs",
          autoFixable: false,
        },
        {
          id: "check2",
          name: "Check 2",
          enabled: true,
          severity: "P1",
          category: "security",
          autoFixable: false,
        },
      ];

      const gaps = await analyzer.runChecks(checks);

      expect(gaps).toHaveLength(2);
      expect(gaps[0].id).toBe("gap1");
      expect(gaps[1].id).toBe("gap2");
    });

    it("should continue on check failure", async () => {
      const detector1: GapCheckDetector = {
        checkId: "check1",
        detect: vi.fn().mockRejectedValue(new Error("Check failed")),
      };

      const detector2: GapCheckDetector = {
        checkId: "check2",
        detect: vi.fn().mockResolvedValue([
          {
            id: "gap2",
            checkId: "check2",
            severity: "P1",
            category: "security",
            title: "Gap 2",
            description: "Description 2",
            autoFixable: false,
          },
        ]),
      };

      analyzer.registerDetector("check1", detector1);
      analyzer.registerDetector("check2", detector2);

      const checks: GapCheckConfig[] = [
        {
          id: "check1",
          name: "Check 1",
          enabled: true,
          severity: "P0",
          category: "docs",
          autoFixable: false,
        },
        {
          id: "check2",
          name: "Check 2",
          enabled: true,
          severity: "P1",
          category: "security",
          autoFixable: false,
        },
      ];

      const gaps = await analyzer.runChecks(checks);

      expect(gaps).toHaveLength(1);
      expect(gaps[0].id).toBe("gap2");
    });
  });

  describe("getFailingGaps", () => {
    it("should filter gaps that should fail", () => {
      const gaps: Gap[] = [
        {
          id: "gap1",
          checkId: "check1",
          severity: "P0",
          category: "docs",
          title: "Gap 1",
          description: "Description 1",
          autoFixable: false,
        },
        {
          id: "gap2",
          checkId: "check2",
          severity: "P1",
          category: "security",
          title: "Gap 2",
          description: "Description 2",
          autoFixable: false,
        },
        {
          id: "gap3",
          checkId: "check3",
          severity: "P2",
          category: "testing",
          title: "Gap 3",
          description: "Description 3",
          autoFixable: true,
        },
      ];

      const failing = analyzer.getFailingGaps(gaps, ["P0", "P1"]);

      expect(failing).toHaveLength(2);
      expect(failing.map((g) => g.id)).toEqual(["gap1", "gap2"]);
    });
  });
});

describe("GapAutoFixer", () => {
  let autoFixer: GapAutoFixer;

  beforeEach(() => {
    autoFixer = new GapAutoFixer();
  });

  describe("autoFix", () => {
    it("should execute fixes for eligible gaps", async () => {
      const fixFn1 = vi.fn().mockResolvedValue(undefined);
      const fixFn2 = vi.fn().mockResolvedValue(undefined);

      const gaps: Gap[] = [
        {
          id: "gap1",
          checkId: "check1",
          severity: "P2",
          category: "docs",
          title: "Gap 1",
          description: "Description 1",
          autoFixable: true,
          fix: {
            strategy: "auto",
            requiresApproval: false,
            execute: fixFn1,
          },
        },
        {
          id: "gap2",
          checkId: "check2",
          severity: "P2",
          category: "security",
          title: "Gap 2",
          description: "Description 2",
          autoFixable: true,
          fix: {
            strategy: "auto",
            requiresApproval: false,
            execute: fixFn2,
          },
        },
      ];

      const result = await autoFixer.autoFix(gaps, "P2");

      expect(result.fixed).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(fixFn1).toHaveBeenCalled();
      expect(fixFn2).toHaveBeenCalled();
    });

    it("should not fix P0/P1 gaps", async () => {
      const fixFn = vi.fn().mockResolvedValue(undefined);

      const gaps: Gap[] = [
        {
          id: "gap1",
          checkId: "check1",
          severity: "P0",
          category: "docs",
          title: "Gap 1",
          description: "Description 1",
          autoFixable: true,
          fix: {
            strategy: "auto",
            requiresApproval: false,
            execute: fixFn,
          },
        },
      ];

      const result = await autoFixer.autoFix(gaps, "P2");

      expect(result.fixed).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(fixFn).not.toHaveBeenCalled();
    });

    it("should handle fix failures", async () => {
      const fixFn1 = vi.fn().mockResolvedValue(undefined);
      const fixFn2 = vi.fn().mockRejectedValue(new Error("Fix failed"));

      const gaps: Gap[] = [
        {
          id: "gap1",
          checkId: "check1",
          severity: "P2",
          category: "docs",
          title: "Gap 1",
          description: "Description 1",
          autoFixable: true,
          fix: {
            strategy: "auto",
            requiresApproval: false,
            execute: fixFn1,
          },
        },
        {
          id: "gap2",
          checkId: "check2",
          severity: "P2",
          category: "security",
          title: "Gap 2",
          description: "Description 2",
          autoFixable: true,
          fix: {
            strategy: "auto",
            requiresApproval: false,
            execute: fixFn2,
          },
        },
      ];

      const result = await autoFixer.autoFix(gaps, "P2");

      expect(result.fixed).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.fixed[0].id).toBe("gap1");
      expect(result.failed[0].id).toBe("gap2");
    });
  });

  describe("getAutoFixSummary", () => {
    it("should calculate auto-fix summary", () => {
      const gaps: Gap[] = [
        {
          id: "gap1",
          checkId: "check1",
          severity: "P2",
          category: "docs",
          title: "Gap 1",
          description: "Description 1",
          autoFixable: true,
          fix: {
            strategy: "auto",
            requiresApproval: false,
            execute: async () => {},
          },
        },
        {
          id: "gap2",
          checkId: "check1",
          severity: "P2",
          category: "docs",
          title: "Gap 2",
          description: "Description 2",
          autoFixable: true,
          fix: {
            strategy: "auto",
            requiresApproval: false,
            execute: async () => {},
          },
        },
        {
          id: "gap3",
          checkId: "check2",
          severity: "P2",
          category: "security",
          title: "Gap 3",
          description: "Description 3",
          autoFixable: true,
          fix: {
            strategy: "auto",
            requiresApproval: false,
            execute: async () => {},
          },
        },
      ];

      const summary = autoFixer.getAutoFixSummary(gaps, "P2");

      expect(summary.totalEligible).toBe(3);
      expect(summary.byCheck).toEqual({
        check1: 2,
        check2: 1,
      });
    });
  });
});
