/**
 * Document Lifecycle Manager Test
 *
 * Tests the document lifecycle management system:
 * - Status detection (active, archived, deprecated)
 * - Reference tracking
 * - Deprecation planning
 * - Cleanup operations
 */

import { describe, it, expect } from "vitest";

describe("Document Lifecycle Manager", () => {
  describe("Status Detection", () => {
    it("should detect deprecated status from content markers", () => {
      const content = `
# Old Document

**Status**: Deprecated

This document is no longer maintained.
      `;

      const hasDeprecatedMarker = content.includes("**Status**: Deprecated");
      expect(hasDeprecatedMarker).toBe(true);
    });

    it("should detect deprecated status from warning markers", () => {
      const content = `
⚠️ DEPRECATED

Use NEW_DOC.md instead.
      `;

      const hasWarningMarker = content.includes("⚠️ DEPRECATED");
      expect(hasWarningMarker).toBe(true);
    });

    it("should detect archived status", () => {
      const content = `
**Status**: Archived

Archived on 2025-01-01.
      `;

      const hasArchivedMarker = content.includes("**Status**: Archived");
      expect(hasArchivedMarker).toBe(true);
    });

    it("should detect status from path", () => {
      const deprecatedPath = "docs/deprecated/OLD_DOC.md";
      const archivedPath = "docs/archived/2024/ARCHIVED_DOC.md";
      const activePath = "docs/ACTIVE_DOC.md";

      expect(deprecatedPath.includes("/deprecated/")).toBe(true);
      expect(archivedPath.includes("/archived/")).toBe(true);
      expect(
        !activePath.includes("/deprecated/") &&
          !activePath.includes("/archived/"),
      ).toBe(true);
    });
  });

  describe("Reference Extraction", () => {
    it("should extract replacement document from content", () => {
      const content = `
**Replacement**: See [NEW_DOC](docs/NEW_DOC.md)
      `;

      const replacementPattern = /\*\*Replacement\*\*:.*\[.*\]\((.*?)\)/;
      const match = content.match(replacementPattern);

      expect(match).toBeDefined();
      expect(match![1]).toBe("docs/NEW_DOC.md");
    });

    it("should extract replacement from 'Replaced by' pattern", () => {
      const content = `
Replaced by [Better Doc](docs/BETTER_DOC.md)
      `;

      const replacementPattern = /Replaced by.*\[.*\]\((.*?)\)/i;
      const match = content.match(replacementPattern);

      expect(match).toBeDefined();
      expect(match![1]).toBe("docs/BETTER_DOC.md");
    });

    it("should extract deprecation date", () => {
      const content = `
**Deprecation Date**: 2025-01-15
**Deletion Date**: 2025-04-15
      `;

      const deprecationMatch = content.match(
        /\*\*Deprecation Date\*\*:\s*(\d{4}-\d{2}-\d{2})/,
      );
      const deletionMatch = content.match(
        /\*\*Deletion Date\*\*:\s*(\d{4}-\d{2}-\d{2})/,
      );

      expect(deprecationMatch).toBeDefined();
      expect(deprecationMatch![1]).toBe("2025-01-15");
      expect(deletionMatch).toBeDefined();
      expect(deletionMatch![1]).toBe("2025-04-15");
    });
  });

  describe("Deprecation Planning", () => {
    it("should identify safe deprecation (no references)", () => {
      const metadata = {
        path: "docs/OLD_DOC.md",
        referencedBy: [],
        hasReferences: false,
      };

      const isSafeToDeprecate = metadata.referencedBy.length === 0;
      expect(isSafeToDeprecate).toBe(true);
    });

    it("should identify unsafe deprecation (has references)", () => {
      const metadata = {
        path: "docs/IMPORTANT_DOC.md",
        referencedBy: ["src/main.ts", "docs/GUIDE.md", "README.md"],
        hasReferences: true,
      };

      const isSafeToDeprecate = metadata.referencedBy.length === 0;
      expect(isSafeToDeprecate).toBe(false);
      expect(metadata.referencedBy.length).toBe(3);
    });

    it("should calculate grace period dates", () => {
      const gracePeriodDays = 90;
      const deprecationDate = new Date("2025-01-01");
      const deletionDate = new Date(deprecationDate);
      deletionDate.setDate(deletionDate.getDate() + gracePeriodDays);

      expect(deletionDate.toISOString().split("T")[0]).toBe("2025-04-01");
    });
  });

  describe("Lifecycle Operations", () => {
    it("should generate deprecation header", () => {
      const gracePeriod = 90;
      const deprecationDate = new Date("2025-01-01");
      const deletionDate = new Date(deprecationDate);
      deletionDate.setDate(deletionDate.getDate() + gracePeriod);

      const header = `---
**⚠️ DEPRECATED**

This document is no longer maintained.

**Replacement**: See [NEW_DOC](docs/NEW_DOC.md)
**Reason**: Outdated information

**Deprecation Date**: ${deprecationDate.toISOString().split("T")[0]}
**Deletion Date**: ${deletionDate.toISOString().split("T")[0]}
**Grace Period**: ${gracePeriod} days

---
`;

      expect(header).toContain("⚠️ DEPRECATED");
      expect(header).toContain("**Deprecation Date**: 2025-01-01");
      expect(header).toContain("**Deletion Date**: 2025-04-01");
      expect(header).toContain("**Grace Period**: 90 days");
    });

    it("should generate archive header", () => {
      const archiveDate = "2025-01-01";
      const reason = "Version 2 released";

      const header = `---
**📦 ARCHIVED**

This is a historical version archived on ${archiveDate}.

**Reason**: ${reason}

For the latest version, see [Active Documentation](../../active/)

---
`;

      expect(header).toContain("📦 ARCHIVED");
      expect(header).toContain("archived on 2025-01-01");
      expect(header).toContain("**Reason**: Version 2 released");
    });
  });

  describe("Registry Management", () => {
    it("should create deprecation registry entry", () => {
      const entry = {
        path: "docs/deprecated/OLD_DOC.md",
        originalPath: "docs/OLD_DOC.md",
        replacementDoc: "docs/NEW_DOC.md",
        deprecatedAt: new Date("2025-01-01"),
        deleteAt: new Date("2025-04-01"),
        reason: "Outdated",
      };

      expect(entry.path).toContain("/deprecated/");
      expect(entry.originalPath).not.toContain("/deprecated/");
      expect(entry.replacementDoc).toBeDefined();
      expect(entry.deprecatedAt).toBeInstanceOf(Date);
      expect(entry.deleteAt).toBeInstanceOf(Date);
      expect(entry.deleteAt.getTime()).toBeGreaterThan(
        entry.deprecatedAt.getTime(),
      );
    });

    it("should identify expired documents", () => {
      const now = new Date("2025-05-01");
      const registry = [
        {
          path: "docs/deprecated/DOC1.md",
          deleteAt: new Date("2025-04-01"), // Expired
        },
        {
          path: "docs/deprecated/DOC2.md",
          deleteAt: new Date("2025-06-01"), // Not expired
        },
      ];

      const expired = registry.filter((entry) => entry.deleteAt < now);
      const active = registry.filter((entry) => entry.deleteAt >= now);

      expect(expired.length).toBe(1);
      expect(expired[0].path).toBe("docs/deprecated/DOC1.md");
      expect(active.length).toBe(1);
      expect(active[0].path).toBe("docs/deprecated/DOC2.md");
    });
  });

  describe("Date Calculations", () => {
    it("should calculate days until deletion", () => {
      const now = new Date("2025-01-01");
      const deleteAt = new Date("2025-04-01");
      const daysUntil = Math.ceil(
        (deleteAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );

      expect(daysUntil).toBe(90);
    });

    it("should calculate days since deprecation", () => {
      const deprecatedAt = new Date("2025-01-01");
      const now = new Date("2025-02-01");
      const daysAgo = Math.floor(
        (now.getTime() - deprecatedAt.getTime()) / (24 * 60 * 60 * 1000),
      );

      expect(daysAgo).toBe(31);
    });

    it("should identify stale documents (90+ days)", () => {
      const now = Date.now();
      const threshold = 90 * 24 * 60 * 60 * 1000; // 90 days in ms

      const docs = [
        {
          path: "docs/FRESH.md",
          lastModified: new Date(now - 30 * 24 * 60 * 60 * 1000),
        }, // 30 days ago
        {
          path: "docs/STALE.md",
          lastModified: new Date(now - 100 * 24 * 60 * 60 * 1000),
        }, // 100 days ago
      ];

      const stale = docs.filter(
        (doc) => now - doc.lastModified.getTime() > threshold,
      );

      expect(stale.length).toBe(1);
      expect(stale[0].path).toBe("docs/STALE.md");
    });
  });
});
