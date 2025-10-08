/**
 * Unit Tests: Gap Detector Domain Logic
 */

import { describe, it, expect } from "vitest";
import {
  GapDetectionRules,
  ConfigurationResolver,
  GracePeriodRules,
  DocumentLifecycleRules,
} from "../../../src/domain/analysis/gap-detector.js";
import type {
  Gap,
  GapSeverity,
} from "../../../src/domain/analysis/gap-types.js";

describe("GapDetectionRules", () => {
  describe("shouldFailOnGap", () => {
    it("should return true for matching severity", () => {
      const gap: Gap = {
        id: "test-gap",
        checkId: "test-check",
        severity: "P0",
        category: "docs",
        title: "Test Gap",
        description: "Test description",
        autoFixable: false,
      };

      expect(GapDetectionRules.shouldFailOnGap(gap, ["P0", "P1"])).toBe(true);
    });

    it("should return false for non-matching severity", () => {
      const gap: Gap = {
        id: "test-gap",
        checkId: "test-check",
        severity: "P2",
        category: "docs",
        title: "Test Gap",
        description: "Test description",
        autoFixable: false,
      };

      expect(GapDetectionRules.shouldFailOnGap(gap, ["P0", "P1"])).toBe(false);
    });

    it("should return false for empty failOn array", () => {
      const gap: Gap = {
        id: "test-gap",
        checkId: "test-check",
        severity: "P0",
        category: "docs",
        title: "Test Gap",
        description: "Test description",
        autoFixable: false,
      };

      expect(GapDetectionRules.shouldFailOnGap(gap, [])).toBe(false);
    });
  });

  describe("canAutoFix", () => {
    it("should return false if not autoFixable", () => {
      const gap: Gap = {
        id: "test-gap",
        checkId: "test-check",
        severity: "P2",
        category: "docs",
        title: "Test Gap",
        description: "Test description",
        autoFixable: false,
      };

      expect(GapDetectionRules.canAutoFix(gap, "P2")).toBe(false);
    });

    it("should return false if no fix function", () => {
      const gap: Gap = {
        id: "test-gap",
        checkId: "test-check",
        severity: "P2",
        category: "docs",
        title: "Test Gap",
        description: "Test description",
        autoFixable: true,
      };

      expect(GapDetectionRules.canAutoFix(gap, "P2")).toBe(false);
    });

    it("should return true for P2 with fix function", () => {
      const gap: Gap = {
        id: "test-gap",
        checkId: "test-check",
        severity: "P2",
        category: "docs",
        title: "Test Gap",
        description: "Test description",
        autoFixable: true,
        fix: {
          strategy: "auto",
          requiresApproval: false,
          execute: async () => {},
        },
      };

      expect(GapDetectionRules.canAutoFix(gap, "P2")).toBe(true);
    });

    it("should return false for P0/P1 even with fix function", () => {
      const gapP0: Gap = {
        id: "test-gap",
        checkId: "test-check",
        severity: "P0",
        category: "docs",
        title: "Test Gap",
        description: "Test description",
        autoFixable: true,
        fix: {
          strategy: "auto",
          requiresApproval: false,
          execute: async () => {},
        },
      };

      const gapP1: Gap = {
        ...gapP0,
        severity: "P1",
      };

      expect(GapDetectionRules.canAutoFix(gapP0, "P2")).toBe(false);
      expect(GapDetectionRules.canAutoFix(gapP1, "P2")).toBe(false);
    });
  });

  describe("calculateSummary", () => {
    it("should calculate correct summary", () => {
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
          checkId: "check1",
          severity: "P0",
          category: "docs",
          title: "Gap 2",
          description: "Description 2",
          autoFixable: false,
        },
        {
          id: "gap3",
          checkId: "check2",
          severity: "P1",
          category: "security",
          title: "Gap 3",
          description: "Description 3",
          autoFixable: false,
        },
        {
          id: "gap4",
          checkId: "check3",
          severity: "P2",
          category: "testing",
          title: "Gap 4",
          description: "Description 4",
          autoFixable: true,
        },
      ];

      const summary = GapDetectionRules.calculateSummary(gaps);

      expect(summary).toEqual({
        P0: 2,
        P1: 1,
        P2: 1,
        total: 4,
      });
    });

    it("should handle empty gap list", () => {
      const summary = GapDetectionRules.calculateSummary([]);

      expect(summary).toEqual({
        P0: 0,
        P1: 0,
        P2: 0,
        total: 0,
      });
    });
  });

  describe("filterBySeverity", () => {
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
        checkId: "check1",
        severity: "P1",
        category: "docs",
        title: "Gap 2",
        description: "Description 2",
        autoFixable: false,
      },
      {
        id: "gap3",
        checkId: "check2",
        severity: "P2",
        category: "security",
        title: "Gap 3",
        description: "Description 3",
        autoFixable: false,
      },
    ];

    it("should filter P0 gaps", () => {
      const filtered = GapDetectionRules.filterBySeverity(gaps, "P0");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("gap1");
    });

    it("should filter P1 gaps", () => {
      const filtered = GapDetectionRules.filterBySeverity(gaps, "P1");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("gap2");
    });

    it("should filter P2 gaps", () => {
      const filtered = GapDetectionRules.filterBySeverity(gaps, "P2");
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("gap3");
    });
  });
});

describe("ConfigurationResolver", () => {
  describe("resolveMode", () => {
    it("should use ENV override when provided", () => {
      const result = ConfigurationResolver.resolveMode(
        "disabled",
        "shadow",
        "enforce",
        false,
      );
      expect(result).toBe("enforce");
    });

    it("should use team override when no ENV", () => {
      const result = ConfigurationResolver.resolveMode(
        "disabled",
        "shadow",
        undefined,
        false,
      );
      expect(result).toBe("shadow");
    });

    it("should use global when no overrides", () => {
      const result = ConfigurationResolver.resolveMode(
        "disabled",
        undefined,
        undefined,
        false,
      );
      expect(result).toBe("disabled");
    });

    it("should use shadow in CI unless explicitly enforce", () => {
      const result1 = ConfigurationResolver.resolveMode(
        "disabled",
        undefined,
        undefined,
        true,
      );
      expect(result1).toBe("shadow");

      const result2 = ConfigurationResolver.resolveMode(
        "enforce",
        undefined,
        undefined,
        true,
      );
      expect(result2).toBe("enforce");
    });
  });

  describe("getEnabledChecks", () => {
    it("should filter enabled checks", () => {
      const checks = [
        {
          id: "check1",
          name: "Check 1",
          enabled: true,
          severity: "P0" as GapSeverity,
          category: "docs" as const,
          autoFixable: false,
        },
        {
          id: "check2",
          name: "Check 2",
          enabled: false,
          severity: "P1" as GapSeverity,
          category: "security" as const,
          autoFixable: false,
        },
        {
          id: "check3",
          name: "Check 3",
          enabled: true,
          severity: "P2" as GapSeverity,
          category: "testing" as const,
          autoFixable: true,
        },
      ];

      const enabled = ConfigurationResolver.getEnabledChecks(checks);
      expect(enabled).toHaveLength(2);
      expect(enabled.map((c) => c.id)).toEqual(["check1", "check3"]);
    });
  });

  describe("findUserTeam", () => {
    it("should find user's team", () => {
      const teams = {
        backend: {
          members: ["alice", "bob"],
          mode: "enforce" as const,
          failOn: [],
        },
        frontend: {
          members: ["charlie", "dave"],
          mode: "shadow" as const,
          failOn: [],
        },
      };

      expect(ConfigurationResolver.findUserTeam(teams, "alice")).toBe(
        "backend",
      );
      expect(ConfigurationResolver.findUserTeam(teams, "charlie")).toBe(
        "frontend",
      );
    });

    it("should return undefined if user not in any team", () => {
      const teams = {
        backend: {
          members: ["alice", "bob"],
          mode: "enforce" as const,
          failOn: [],
        },
      };

      expect(
        ConfigurationResolver.findUserTeam(teams, "unknown"),
      ).toBeUndefined();
    });
  });
});

describe("GracePeriodRules", () => {
  describe("daysSince", () => {
    it("should calculate days correctly", () => {
      const date = new Date();
      date.setDate(date.getDate() - 5);

      const days = GracePeriodRules.daysSince(date);
      expect(days).toBe(5);
    });
  });

  describe("isInGracePeriod", () => {
    it("should return true if within grace period", () => {
      const date = new Date();
      date.setDate(date.getDate() - 3);

      expect(GracePeriodRules.isInGracePeriod(date, 7)).toBe(true);
    });

    it("should return false if outside grace period", () => {
      const date = new Date();
      date.setDate(date.getDate() - 10);

      expect(GracePeriodRules.isInGracePeriod(date, 7)).toBe(false);
    });
  });

  describe("determineSeverity", () => {
    it("should return P2 if within grace period", () => {
      const date = new Date();
      date.setDate(date.getDate() - 3);

      const severity = GracePeriodRules.determineSeverity(date, 7, "P0");
      expect(severity).toBe("P2");
    });

    it("should return base severity if outside grace period", () => {
      const date = new Date();
      date.setDate(date.getDate() - 10);

      const severity = GracePeriodRules.determineSeverity(date, 7, "P0");
      expect(severity).toBe("P0");
    });
  });
});

describe("DocumentLifecycleRules", () => {
  describe("hasFrontmatter", () => {
    it("should detect valid frontmatter", () => {
      const content = `---
deprecatedDate: 2025-01-01
replacedBy: new-doc.md
---

# Document content`;

      expect(DocumentLifecycleRules.hasFrontmatter(content)).toBe(true);
    });

    it("should return false for missing frontmatter", () => {
      const content = "# Document content";
      expect(DocumentLifecycleRules.hasFrontmatter(content)).toBe(false);
    });
  });

  describe("extractFrontmatter", () => {
    it("should extract deprecation info", () => {
      const content = `---
deprecatedDate: 2025-01-01
replacedBy: new-doc.md
---

# Document content`;

      const result = DocumentLifecycleRules.extractFrontmatter(content);
      expect(result?.deprecatedDate).toEqual(new Date("2025-01-01"));
      expect(result?.replacedBy).toBe("new-doc.md");
    });

    it("should return null for missing frontmatter", () => {
      const content = "# Document content";
      const result = DocumentLifecycleRules.extractFrontmatter(content);
      expect(result).toBeNull();
    });

    it("should handle partial frontmatter", () => {
      const content = `---
deprecatedDate: 2025-01-01
---

# Document content`;

      const result = DocumentLifecycleRules.extractFrontmatter(content);
      expect(result?.deprecatedDate).toEqual(new Date("2025-01-01"));
      expect(result?.replacedBy).toBeUndefined();
    });
  });

  describe("isTooOld", () => {
    it("should return true if older than max age", () => {
      const date = new Date();
      date.setDate(date.getDate() - 100);

      expect(DocumentLifecycleRules.isTooOld(date, 90)).toBe(true);
    });

    it("should return false if within max age", () => {
      const date = new Date();
      date.setDate(date.getDate() - 50);

      expect(DocumentLifecycleRules.isTooOld(date, 90)).toBe(false);
    });
  });

  describe("hasReplacement", () => {
    it("should return true if replacedBy exists", () => {
      expect(
        DocumentLifecycleRules.hasReplacement({ replacedBy: "new-doc.md" }),
      ).toBe(true);
    });

    it("should return false if replacedBy missing", () => {
      expect(DocumentLifecycleRules.hasReplacement({})).toBe(false);
    });
  });
});
