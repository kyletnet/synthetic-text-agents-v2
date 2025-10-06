#!/usr/bin/env tsx

/**
 * Snapshot Browser CLI - Interactive snapshot management dashboard
 * Provides enhanced UX for browsing, analyzing, and managing system snapshots
 */

import { AutoFixManager } from "./lib/auto-fix-manager.js";

interface BrowserOptions {
  interactive?: boolean;
  format?: "table" | "detailed" | "json";
  filter?: "recent" | "compressed" | "large" | "all";
  sort?: "date" | "size" | "compression" | "operation";
  limit?: number;
}

class SnapshotBrowser {
  private manager: AutoFixManager;

  constructor() {
    this.manager = new AutoFixManager();
  }

  async browse(options: BrowserOptions = {}): Promise<void> {
    const {
      interactive = false,
      format = "table",
      filter = "all",
      sort = "date",
      limit = 10,
    } = options;

    console.log("📸 **Snapshot Browser Dashboard**");
    console.log("═".repeat(80));

    const snapshots = this.manager.getSnapshots();

    if (snapshots.length === 0) {
      console.log("📭 No snapshots found");
      console.log("\n💡 **Quick Start**:");
      console.log("   Create your first snapshot:");
      console.log("   ```typescript");
      console.log("   const manager = new AutoFixManager();");
      console.log('   await manager.createSnapshot("initial-setup");');
      console.log("   ```\n");
      return;
    }

    // Filter snapshots
    const filtered = this.filterSnapshots(snapshots, filter);

    // Sort snapshots
    const sorted = this.sortSnapshots(filtered, sort);

    // Limit results
    const limited = limit > 0 ? sorted.slice(0, limit) : sorted;

    console.log(
      `\n📊 **Summary** (${limited.length}/${snapshots.length} snapshots)`,
    );
    console.log(`   Filter: ${filter} | Sort: ${sort} | Format: ${format}`);

    // Display overview stats
    await this.displayOverviewStats(snapshots);

    switch (format) {
      case "table":
        await this.displayTable(limited);
        break;
      case "detailed":
        await this.displayDetailed(limited);
        break;
      case "json":
        await this.displayJson(limited);
        break;
    }

    if (interactive) {
      await this.startInteractiveMode(limited);
    } else {
      this.displayCommands();
    }
  }

  private filterSnapshots(snapshots: any[], filter: string): any[] {
    const now = new Date();

    switch (filter) {
      case "recent":
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        return snapshots.filter((s) => new Date(s.timestamp) > oneDayAgo);

      case "compressed":
        return snapshots.filter((s) =>
          s.files.some((f: any) => f.isCompressed),
        );

      case "large":
        return snapshots.filter(
          (s) => s.metadata.totalSize > 1024 * 1024, // > 1MB
        );

      default:
        return snapshots;
    }
  }

  private sortSnapshots(snapshots: any[], sort: string): any[] {
    return [...snapshots].sort((a, b) => {
      switch (sort) {
        case "date":
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

        case "size":
          return b.metadata.totalSize - a.metadata.totalSize;

        case "compression":
          return b.metadata.compressionSavings - a.metadata.compressionSavings;

        case "operation":
          return a.operation.localeCompare(b.operation);

        default:
          return 0;
      }
    });
  }

  private async displayOverviewStats(snapshots: any[]): Promise<void> {
    const totalSize = snapshots.reduce(
      (sum, s) => sum + s.metadata.totalSize,
      0,
    );
    const totalCompressedSize = snapshots.reduce(
      (sum, s) => sum + s.metadata.totalCompressedSize,
      0,
    );
    const avgCompressionSavings =
      snapshots.reduce((sum, s) => sum + s.metadata.compressionSavings, 0) /
      snapshots.length;

    const compressedCount = snapshots.filter((s) =>
      s.files.some((f: any) => f.isCompressed),
    ).length;

    console.log("\n🗂️  **Storage Overview**:");
    console.log(`   Total snapshots: ${snapshots.length}`);
    console.log(
      `   Compressed snapshots: ${compressedCount}/${snapshots.length}`,
    );
    console.log(`   Total storage: ${this.formatBytes(totalSize)}`);
    console.log(
      `   After compression: ${this.formatBytes(totalCompressedSize)}`,
    );
    console.log(`   Average space saved: ${avgCompressionSavings.toFixed(1)}%`);

    // Recent activity
    const recentCount = snapshots.filter((s) => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return new Date(s.timestamp) > oneDayAgo;
    }).length;

    if (recentCount > 0) {
      console.log(`   Recent activity (24h): ${recentCount} snapshots`);
    }
  }

  private async displayTable(snapshots: any[]): Promise<void> {
    console.log("\n📋 **Snapshot List**:");
    console.log("─".repeat(110));
    console.log(
      "ID".padEnd(20) +
        "Created".padEnd(20) +
        "Operation".padEnd(25) +
        "Files".padEnd(8) +
        "Size".padEnd(12) +
        "Saved".padEnd(10) +
        "Git".padEnd(10),
    );
    console.log("─".repeat(110));

    for (const snapshot of snapshots) {
      const id = snapshot.id.substring(0, 18) + "..";
      const created =
        new Date(snapshot.timestamp).toLocaleDateString() +
        " " +
        new Date(snapshot.timestamp).toLocaleTimeString().substring(0, 5);
      const operation =
        snapshot.operation.length > 23
          ? snapshot.operation.substring(0, 20) + "..."
          : snapshot.operation;
      const files = snapshot.files.length.toString();
      const size = this.formatBytes(snapshot.metadata.totalSize);
      const saved =
        snapshot.metadata.compressionSavings > 0
          ? `${snapshot.metadata.compressionSavings.toFixed(0)}%`
          : "-";
      const git = snapshot.metadata.gitCommit
        ? snapshot.metadata.gitCommit.substring(0, 8)
        : "none";

      console.log(
        id.padEnd(20) +
          created.padEnd(20) +
          operation.padEnd(25) +
          files.padEnd(8) +
          size.padEnd(12) +
          saved.padEnd(10) +
          git.padEnd(10),
      );
    }

    console.log("─".repeat(110));
  }

  private async displayDetailed(snapshots: any[]): Promise<void> {
    console.log("\n📄 **Detailed View**:");

    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      console.log(`\n${i + 1}. 🆔 **${snapshot.id}**`);
      console.log(
        `   📅 Created: ${new Date(snapshot.timestamp).toLocaleString()}`,
      );
      console.log(`   ⚙️  Operation: ${snapshot.operation}`);

      if (snapshot.metadata.description) {
        console.log(`   📝 Description: ${snapshot.metadata.description}`);
      }

      console.log(
        `   📁 Files: ${snapshot.files.length} (${
          snapshot.files.filter((f: any) => f.isCompressed).length
        } compressed)`,
      );
      console.log(
        `   💾 Size: ${this.formatBytes(snapshot.metadata.totalSize)}`,
      );

      if (snapshot.metadata.compressionSavings > 0) {
        console.log(
          `   🗜️  Compressed: ${this.formatBytes(
            snapshot.metadata.totalCompressedSize,
          )} (${snapshot.metadata.compressionSavings.toFixed(1)}% saved)`,
        );
      }

      console.log(
        `   🌍 Environment: ${snapshot.metadata.environment.platform}`,
      );
      console.log(
        `   📦 Project: ${
          snapshot.metadata.environment.projectName || "unknown"
        }`,
      );

      if (snapshot.metadata.gitCommit) {
        console.log(
          `   🔀 Git: ${snapshot.metadata.gitCommit.substring(0, 8)} (${
            snapshot.metadata.environment.gitBranch || "unknown"
          })`,
        );
      }

      if (snapshot.metadata.tags && snapshot.metadata.tags.length > 0) {
        console.log(`   🏷️  Tags: ${snapshot.metadata.tags.join(", ")}`);
      }

      // Risk assessment for rollback
      const riskLevel = this.assessRollbackRisk(snapshot);
      const riskEmoji = {
        low: "✅",
        medium: "⚠️",
        high: "🚨",
      }[riskLevel];

      console.log(`   ${riskEmoji} Rollback Risk: ${riskLevel.toUpperCase()}`);

      if (i < snapshots.length - 1) {
        console.log("   " + "─".repeat(60));
      }
    }
  }

  private async displayJson(snapshots: any[]): Promise<void> {
    const output = {
      summary: {
        totalSnapshots: snapshots.length,
        totalSize: snapshots.reduce((sum, s) => sum + s.metadata.totalSize, 0),
        avgCompressionSavings:
          snapshots.reduce((sum, s) => sum + s.metadata.compressionSavings, 0) /
          snapshots.length,
      },
      snapshots: snapshots.map((s) => ({
        id: s.id,
        timestamp: s.timestamp,
        operation: s.operation,
        filesCount: s.files.length,
        totalSize: s.metadata.totalSize,
        compressionSavings: s.metadata.compressionSavings,
        gitCommit: s.metadata.gitCommit,
        rollbackRisk: this.assessRollbackRisk(s),
      })),
    };

    console.log(JSON.stringify(output, null, 2));
  }

  private assessRollbackRisk(snapshot: any): "low" | "medium" | "high" {
    const age = Date.now() - new Date(snapshot.timestamp).getTime();
    const ageDays = age / (1000 * 60 * 60 * 24);

    if (ageDays > 30) return "high"; // Old snapshot
    if (snapshot.files.length > 20) return "medium"; // Many files
    if (snapshot.metadata.totalSize > 10 * 1024 * 1024) return "medium"; // Large size

    return "low";
  }

  private async startInteractiveMode(snapshots: any[]): Promise<void> {
    console.log("\n🎮 **Interactive Mode**");
    console.log("Available actions:");
    console.log("  [d]etails <id> - Show detailed snapshot info");
    console.log("  [r]ollback <id> - Rollback to snapshot");
    console.log("  [delete] <id> - Delete snapshot");
    console.log("  [c]leanup <hours> - Clean old snapshots");
    console.log("  [q]uit - Exit interactive mode\n");

    // For demo purposes, show basic interactive commands
    // In real implementation, would use readline for actual interaction
    console.log("💡 **Example Commands**:");
    console.log(`   npm run snapshot:browser -- --interactive`);
    console.log(
      `   npm run snapshot:details ${snapshots[0]?.id || "<snapshot-id>"}`,
    );
    console.log(
      `   npm run snapshot:rollback ${snapshots[0]?.id || "<snapshot-id>"}`,
    );
  }

  private displayCommands(): void {
    console.log("\n💻 **Available Commands**:");
    console.log(
      "   npm run snapshot:browser                    # Default table view",
    );
    console.log(
      "   npm run snapshot:browser -- --detailed     # Detailed view",
    );
    console.log(
      "   npm run snapshot:browser -- --recent       # Recent snapshots only",
    );
    console.log(
      "   npm run snapshot:browser -- --compressed   # Compressed snapshots only",
    );
    console.log("   npm run snapshot:browser -- --json         # JSON output");
    console.log(
      "   npm run snapshot:browser -- --interactive  # Interactive mode",
    );
    console.log(
      "   npm run snapshot:browser -- --limit 5      # Limit results",
    );
    console.log("   npm run snapshot:browser -- --sort size    # Sort by size");
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const browser = new SnapshotBrowser();

  const options: BrowserOptions = {
    interactive: args.includes("--interactive"),
    format:
      (args.find((arg) => arg.startsWith("--format="))?.split("=")[1] as any) ||
      (args.includes("--detailed")
        ? "detailed"
        : args.includes("--json")
        ? "json"
        : "table"),
    filter:
      (args.find((arg) => arg.startsWith("--filter="))?.split("=")[1] as any) ||
      (args.includes("--recent")
        ? "recent"
        : args.includes("--compressed")
        ? "compressed"
        : args.includes("--large")
        ? "large"
        : "all"),
    sort:
      (args.find((arg) => arg.startsWith("--sort="))?.split("=")[1] as any) ||
      "date",
    limit: parseInt(
      args.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || "10",
    ),
  };

  try {
    await browser.browse(options);
  } catch (error) {
    console.error("❌ Snapshot browser error:", error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { SnapshotBrowser };
export default SnapshotBrowser;
