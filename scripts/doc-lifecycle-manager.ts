#!/usr/bin/env node

/**
 * Document Lifecycle Manager
 *
 * Manages the lifecycle of documentation files:
 * - Active: Currently maintained documents
 * - Archived: Historical versions, read-only
 * - Deprecated: Scheduled for deletion
 *
 * Features:
 * - Automatic status detection
 * - Reference tracking (prevent breaking links)
 * - Safe deprecation with grace period
 * - Automatic cleanup of expired documents
 */

import {
  readFile,
  writeFile,
  rename,
  unlink,
  mkdir,
  readdir,
  stat,
} from "fs/promises";
import { existsSync } from "fs";
import { execSync } from "child_process";
import { glob } from "glob";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

type DocStatus = "active" | "archived" | "deprecated";

interface DocMetadata {
  path: string;
  status: DocStatus;
  lastModified: Date;
  referencedBy: string[];
  replaces?: string;
  replacedBy?: string;
  deprecationDate?: Date;
  deletionDate?: Date;
}

interface DeprecationRegistryEntry {
  path: string;
  originalPath: string;
  replacementDoc?: string;
  deprecatedAt: Date;
  deleteAt: Date;
  reason?: string;
}

interface DeprecationPlan {
  safe: boolean;
  action: string;
  steps: string[];
  details?: {
    references?: string[];
    replacement?: string;
    gracePeriodDays?: number;
  };
}

// ============================================================================
// Document Lifecycle Manager
// ============================================================================

class DocLifecycleManager {
  private registryPath = "docs/deprecated/.metadata.json";

  /**
   * Analyze document status based on content and location
   */
  async analyzeDocStatus(docPath: string): Promise<DocMetadata> {
    if (!existsSync(docPath)) {
      throw new Error(`Document not found: ${docPath}`);
    }

    const content = await readFile(docPath, "utf-8");
    const fileStat = await stat(docPath);

    const status = this.detectStatus(content, docPath);
    const referencedBy = await this.findReferences(docPath);
    const replacedBy = this.extractReplacementDoc(content);
    const { deprecationDate, deletionDate } = this.extractDates(content);

    return {
      path: docPath,
      status,
      lastModified: fileStat.mtime,
      referencedBy,
      replacedBy,
      deprecationDate,
      deletionDate,
    };
  }

  /**
   * Detect document status from content and path
   */
  private detectStatus(content: string, docPath: string): DocStatus {
    // Explicit status markers
    if (
      content.includes("**Status**: Deprecated") ||
      content.includes("⚠️ DEPRECATED")
    ) {
      return "deprecated";
    }
    if (content.includes("**Status**: Archived")) {
      return "archived";
    }

    // Path-based detection
    if (docPath.includes("/deprecated/")) return "deprecated";
    if (docPath.includes("/archived/")) return "archived";
    if (docPath.includes("/active/")) return "active";

    // Content-based heuristics
    const deprecatedPatterns = [
      /no longer (used|maintained|supported)/i,
      /this document is (obsolete|outdated)/i,
      /replaced by \[.*\]/i,
      /⚠️.*deprecated/i,
    ];

    if (deprecatedPatterns.some((regex) => regex.test(content))) {
      return "deprecated";
    }

    // Default to active if in docs/ root
    return "active";
  }

  /**
   * Find all files that reference this document
   */
  async findReferences(docPath: string): Promise<string[]> {
    const docName = path.basename(docPath);
    const references: string[] = [];

    try {
      // Search in code files
      const codeFiles = await glob("{src,scripts,tests}/**/*.{ts,js,md}");
      for (const file of codeFiles) {
        const content = await readFile(file, "utf-8");
        if (content.includes(docName)) {
          references.push(file);
        }
      }

      // Search in other docs
      const docFiles = await glob("docs/**/*.md");
      for (const file of docFiles) {
        if (file === docPath) continue;
        const content = await readFile(file, "utf-8");
        if (content.includes(docName)) {
          references.push(file);
        }
      }
    } catch (error) {
      console.error(`Error finding references: ${error}`);
    }

    return references;
  }

  /**
   * Extract replacement document from content
   */
  private extractReplacementDoc(content: string): string | undefined {
    // Look for patterns like:
    // **Replacement**: See [NEW_DOC](path/to/new_doc.md)
    // Replaced by [NEW_DOC](path/to/new_doc.md)
    const patterns = [
      /\*\*Replacement\*\*:.*\[.*\]\((.*?)\)/,
      /Replaced by.*\[.*\]\((.*?)\)/i,
      /See.*\[.*\]\((.*?)\)/,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Extract deprecation and deletion dates
   */
  private extractDates(content: string): {
    deprecationDate?: Date;
    deletionDate?: Date;
  } {
    const deprecationMatch = content.match(
      /\*\*Deprecation Date\*\*:\s*(\d{4}-\d{2}-\d{2})/,
    );
    const deletionMatch = content.match(
      /\*\*Deletion Date\*\*:\s*(\d{4}-\d{2}-\d{2})/,
    );

    return {
      deprecationDate: deprecationMatch
        ? new Date(deprecationMatch[1])
        : undefined,
      deletionDate: deletionMatch ? new Date(deletionMatch[1]) : undefined,
    };
  }

  /**
   * Propose a deprecation plan for a document
   */
  async proposeDeprecation(docPath: string): Promise<DeprecationPlan> {
    const metadata = await this.analyzeDocStatus(docPath);

    // Check if it has references
    if (metadata.referencedBy.length > 0) {
      return {
        safe: false,
        action: "update-references-first",
        steps: [
          "1. Create replacement document (if needed)",
          `2. Update ${metadata.referencedBy.length} references:`,
          ...metadata.referencedBy.map((ref) => `   - ${ref}`),
          "3. Mark as deprecated with grace period",
          "4. Schedule deletion in 3 months",
        ],
        details: {
          references: metadata.referencedBy,
          replacement: metadata.replacedBy,
          gracePeriodDays: 90,
        },
      };
    }

    // Safe to deprecate
    return {
      safe: true,
      action: "move-to-deprecated",
      steps: [
        "1. Move to docs/deprecated/",
        "2. Add deprecation header",
        `3. Set deletion date: ${this.getDateInDays(90)}`,
      ],
      details: {
        gracePeriodDays: 90,
      },
    };
  }

  /**
   * Deprecate a document
   */
  async deprecateDocument(
    docPath: string,
    options: {
      replacementDoc?: string;
      reason?: string;
      gracePeriodDays?: number;
    } = {},
  ): Promise<void> {
    const plan = await this.proposeDeprecation(docPath);

    if (!plan.safe) {
      throw new Error(
        `Cannot deprecate ${docPath}: has ${plan.details?.references?.length} active references.\n` +
          `Run: npm run doc:lifecycle -- --update-refs ${docPath}`,
      );
    }

    const gracePeriod = options.gracePeriodDays || 90;
    const deprecationDate = new Date();
    const deletionDate = this.getDateInDays(gracePeriod);

    // Ensure deprecated directory exists
    await mkdir("docs/deprecated", { recursive: true });

    // Move file
    const fileName = path.basename(docPath);
    const deprecatedPath = path.join("docs/deprecated", fileName);

    // Read original content
    const originalContent = await readFile(docPath, "utf-8");

    // Add deprecation header
    const header = `---
**⚠️ DEPRECATED**

This document is no longer maintained.

${options.replacementDoc ? `**Replacement**: See [@${path.basename(options.replacementDoc)}](../${options.replacementDoc})` : ""}
${options.reason ? `**Reason**: ${options.reason}` : ""}

**Deprecation Date**: ${deprecationDate.toISOString().split("T")[0]}
**Deletion Date**: ${deletionDate}
**Grace Period**: ${gracePeriod} days

---

`;

    // Write to deprecated location
    await writeFile(deprecatedPath, header + originalContent);

    // Update registry
    await this.updateDeprecationRegistry({
      path: deprecatedPath,
      originalPath: docPath,
      replacementDoc: options.replacementDoc,
      deprecatedAt: deprecationDate,
      deleteAt: new Date(deletionDate),
      reason: options.reason,
    });

    // Remove original
    await unlink(docPath);

    console.log(`✅ Deprecated: ${docPath}`);
    console.log(`   → Moved to: ${deprecatedPath}`);
    console.log(`   → Will be deleted: ${deletionDate}`);
  }

  /**
   * Archive a document (move to archived/)
   */
  async archiveDocument(docPath: string, reason?: string): Promise<void> {
    // Ensure archived directory exists
    const year = new Date().getFullYear();
    const archiveDir = path.join("docs/archived", String(year));
    await mkdir(archiveDir, { recursive: true });

    // Move file
    const fileName = path.basename(docPath);
    const archivedPath = path.join(archiveDir, fileName);

    // Read original content
    const originalContent = await readFile(docPath, "utf-8");

    // Add archive header
    const header = `---
**📦 ARCHIVED**

This is a historical version archived on ${new Date().toISOString().split("T")[0]}.

${reason ? `**Reason**: ${reason}` : ""}

For the latest version, see [Active Documentation](../../active/)

---

`;

    // Write to archived location
    await writeFile(archivedPath, header + originalContent);

    // Remove original
    await unlink(docPath);

    console.log(`✅ Archived: ${docPath}`);
    console.log(`   → Moved to: ${archivedPath}`);
  }

  /**
   * Find stale documents (not updated in 90+ days)
   */
  async findStaleDocuments(daysThreshold = 90): Promise<DocMetadata[]> {
    const docs = await glob("docs/**/*.md", {
      ignore: ["docs/deprecated/**", "docs/archived/**"],
    });

    const stale: DocMetadata[] = [];
    const now = Date.now();
    const threshold = daysThreshold * 24 * 60 * 60 * 1000;

    for (const doc of docs) {
      const metadata = await this.analyzeDocStatus(doc);
      const age = now - metadata.lastModified.getTime();

      if (age > threshold) {
        stale.push(metadata);
      }
    }

    return stale.sort(
      (a, b) => a.lastModified.getTime() - b.lastModified.getTime(),
    );
  }

  /**
   * Cleanup expired deprecated documents
   */
  async cleanupDeprecated(): Promise<void> {
    const registry = await this.loadDeprecationRegistry();
    const now = new Date();
    let deleted = 0;

    for (const entry of registry) {
      if (entry.deleteAt < now) {
        if (existsSync(entry.path)) {
          await unlink(entry.path);
          console.log(
            `🗑️  Deleted: ${entry.path} (deprecated ${this.getDaysAgo(entry.deprecatedAt)} days ago)`,
          );
          deleted++;
        }

        // Remove from registry
        await this.removeFromRegistry(entry.path);
      }
    }

    if (deleted === 0) {
      console.log("ℹ️  No expired documents to clean up");
    } else {
      console.log(`✅ Cleaned up ${deleted} expired document(s)`);
    }
  }

  /**
   * Analyze all documents and generate report
   */
  async analyze(): Promise<void> {
    console.log("\n📊 Document Lifecycle Analysis\n");
    console.log("═".repeat(60));

    // Count by status
    const allDocs = await glob("docs/**/*.md");
    const active = allDocs.filter(
      (d) =>
        d.startsWith("docs/active/") ||
        (!d.includes("/archived/") && !d.includes("/deprecated/")),
    );
    const archived = allDocs.filter((d) => d.includes("/archived/"));
    const deprecated = allDocs.filter((d) => d.includes("/deprecated/"));

    console.log(`\n📈 Document Status:`);
    console.log(`   Active: ${active.length}`);
    console.log(`   Archived: ${archived.length}`);
    console.log(`   Deprecated: ${deprecated.length}`);
    console.log(`   Total: ${allDocs.length}`);

    // Find stale documents
    const stale = await this.findStaleDocuments(90);
    if (stale.length > 0) {
      console.log(`\n⚠️  Stale Documents (90+ days):`);
      for (const doc of stale.slice(0, 10)) {
        const daysOld = this.getDaysAgo(doc.lastModified);
        console.log(`   - ${doc.path} (${daysOld} days old)`);
      }
      if (stale.length > 10) {
        console.log(`   ... and ${stale.length - 10} more`);
      }
    }

    // Check deprecated documents
    const registry = await this.loadDeprecationRegistry();
    if (registry.length > 0) {
      console.log(`\n🗑️  Scheduled for Deletion:`);
      for (const entry of registry) {
        const daysUntil = Math.ceil(
          (entry.deleteAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
        );
        console.log(`   - ${entry.path} (in ${daysUntil} days)`);
      }
    }

    console.log("\n" + "═".repeat(60));
    console.log("");
  }

  // ============================================================================
  // Registry Management
  // ============================================================================

  private async loadDeprecationRegistry(): Promise<DeprecationRegistryEntry[]> {
    if (!existsSync(this.registryPath)) {
      return [];
    }

    const content = await readFile(this.registryPath, "utf-8");
    const registry = JSON.parse(content);

    // Convert date strings to Date objects
    return registry.map((entry: any) => ({
      ...entry,
      deprecatedAt: new Date(entry.deprecatedAt),
      deleteAt: new Date(entry.deleteAt),
    }));
  }

  private async updateDeprecationRegistry(
    entry: DeprecationRegistryEntry,
  ): Promise<void> {
    const registry = await this.loadDeprecationRegistry();
    registry.push(entry);

    await mkdir(path.dirname(this.registryPath), { recursive: true });
    await writeFile(this.registryPath, JSON.stringify(registry, null, 2));
  }

  private async removeFromRegistry(docPath: string): Promise<void> {
    const registry = await this.loadDeprecationRegistry();
    const filtered = registry.filter((entry) => entry.path !== docPath);

    await writeFile(this.registryPath, JSON.stringify(filtered, null, 2));
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private getDateInDays(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }

  private getDaysAgo(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new DocLifecycleManager();

  if (!command || command === "--help" || command === "-h") {
    console.log(`
Document Lifecycle Manager

Usage:
  npm run doc:lifecycle -- --analyze              # Analyze all documents
  npm run doc:lifecycle -- --find-stale           # Find stale documents
  npm run doc:lifecycle -- --deprecate <path>     # Deprecate a document
  npm run doc:lifecycle -- --archive <path>       # Archive a document
  npm run doc:lifecycle -- --cleanup              # Clean up expired docs

Options:
  --replacement <path>    Specify replacement document
  --reason <text>         Specify reason for deprecation
  --grace-period <days>   Grace period before deletion (default: 90)

Examples:
  # Analyze all documents
  npm run doc:lifecycle -- --analyze

  # Find documents not updated in 90+ days
  npm run doc:lifecycle -- --find-stale

  # Deprecate with replacement
  npm run doc:lifecycle -- --deprecate docs/OLD.md --replacement docs/NEW.md

  # Archive old version
  npm run doc:lifecycle -- --archive docs/v1/GUIDE.md --reason "Version 2 released"

  # Clean up expired documents
  npm run doc:lifecycle -- --cleanup
    `);
    process.exit(0);
  }

  try {
    switch (command) {
      case "--analyze":
        await manager.analyze();
        break;

      case "--find-stale": {
        const stale = await manager.findStaleDocuments(90);
        console.log(
          `\n⚠️  Found ${stale.length} stale documents (90+ days):\n`,
        );
        for (const doc of stale) {
          const days = Math.floor(
            (Date.now() - doc.lastModified.getTime()) / (24 * 60 * 60 * 1000),
          );
          console.log(`- ${doc.path} (${days} days old)`);
        }
        console.log(
          `\n💡 Suggested: npm run doc:lifecycle -- --deprecate <path>`,
        );
        break;
      }

      case "--deprecate": {
        const docPath = args[1];
        if (!docPath) {
          console.error("❌ Error: Document path required");
          process.exit(1);
        }

        const replacementIdx = args.indexOf("--replacement");
        const reasonIdx = args.indexOf("--reason");
        const gracePeriodIdx = args.indexOf("--grace-period");

        const options = {
          replacementDoc:
            replacementIdx >= 0 ? args[replacementIdx + 1] : undefined,
          reason: reasonIdx >= 0 ? args[reasonIdx + 1] : undefined,
          gracePeriodDays:
            gracePeriodIdx >= 0 ? parseInt(args[gracePeriodIdx + 1]) : 90,
        };

        await manager.deprecateDocument(docPath, options);
        break;
      }

      case "--archive": {
        const docPath = args[1];
        if (!docPath) {
          console.error("❌ Error: Document path required");
          process.exit(1);
        }

        const reasonIdx = args.indexOf("--reason");
        const reason = reasonIdx >= 0 ? args[reasonIdx + 1] : undefined;

        await manager.archiveDocument(docPath, reason);
        break;
      }

      case "--cleanup":
        await manager.cleanupDeprecated();
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.error(`Run: npm run doc:lifecycle -- --help`);
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Document Lifecycle Manager failed:");
    console.error(error);
    process.exit(1);
  });
}

export { DocLifecycleManager };
