import * as fs from "fs";
import * as path from "path";

interface DLQEntry {
  run_id: string;
  timestamp: string;
  target: string;
  mode: string;
  reason: string;
  exit_code: number;
  top_fail_reasons: string[];
  budget_usd?: string;
  cost_usd?: string;
  session_id?: string;
  notes?: string;
}

export class DLQManager {
  private readonly dlqDir = "reports/dlq";
  private readonly indexPath: string;

  constructor() {
    this.indexPath = path.join(this.dlqDir, "index.jsonl");
    this.ensureDLQDirectory();
  }

  /**
   * Ensure DLQ directory structure exists
   */
  private ensureDLQDirectory(): void {
    if (!fs.existsSync(this.dlqDir)) {
      fs.mkdirSync(this.dlqDir, { recursive: true });
    }
  }

  /**
   * Add a failed run to DLQ
   */
  toDLQ(
    runId: string,
    reason: string,
    exitCode: number,
    artifacts: string[] = [],
    options: {
      target?: string;
      mode?: string;
      sessionId?: string;
      budgetUsd?: string;
      costUsd?: string;
      notes?: string;
    } = {},
  ): void {
    const timestamp = new Date().toISOString();
    const dlqRunDir = path.join(this.dlqDir, runId);

    try {
      // Create DLQ run directory
      if (!fs.existsSync(dlqRunDir)) {
        fs.mkdirSync(dlqRunDir, { recursive: true });
      }

      // Move artifacts to DLQ directory
      for (const artifact of artifacts) {
        if (fs.existsSync(artifact)) {
          const basename = path.basename(artifact);
          const targetPath = path.join(dlqRunDir, basename);

          try {
            if (fs.statSync(artifact).isDirectory()) {
              // Copy directory recursively
              this.copyDirectory(artifact, targetPath);
            } else {
              // Copy file
              fs.copyFileSync(artifact, targetPath);
            }
          } catch (copyError) {
            console.warn(
              `[DLQ] Failed to copy artifact ${artifact}:`,
              copyError,
            );
            // Continue with other artifacts
          }
        }
      }

      // Create DLQ entry metadata
      const entry: any = {
        run_id: runId,
        timestamp,
        target: options.target || "unknown",
        mode: options.mode || "unknown",
        reason,
        exit_code: exitCode,
        top_fail_reasons: this.extractFailReasons(reason, artifacts),
      };
      if (typeof options.budgetUsd === "string")
        entry.budget_usd = options.budgetUsd;
      if (typeof options.costUsd === "string") entry.cost_usd = options.costUsd;
      if (typeof options.sessionId === "string")
        entry.session_id = options.sessionId;
      if (options.notes) entry.notes = options.notes;
      const dlqEntry: DLQEntry = entry;

      // Write metadata to DLQ directory
      const metadataPath = path.join(dlqRunDir, "dlq_metadata.json");
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(dlqEntry, null, 2),
        "utf-8",
      );

      // Append to DLQ index (atomic append)
      this.appendToIndex(dlqEntry);

      console.log(`[DLQ] Added failed run to DLQ: ${dlqRunDir}`);
    } catch (error) {
      console.error(`[DLQ] Failed to add run to DLQ (${runId}):`, error);

      // Try to at least append to index for tracking
      try {
        const minimalEntry: DLQEntry = {
          run_id: runId,
          timestamp,
          target: options.target || "unknown",
          mode: options.mode || "unknown",
          reason: `${reason} (dlq_creation_failed: ${error})`,
          exit_code: exitCode,
          top_fail_reasons: ["dlq_creation_failed"],
        };
        this.appendToIndex(minimalEntry);
        console.warn(`[DLQ] Minimal DLQ entry recorded in index only`);
      } catch (indexError) {
        console.error(
          `[DLQ] Critical: Failed to record DLQ entry anywhere:`,
          indexError,
        );
        throw indexError;
      }
    }
  }

  /**
   * Copy directory recursively
   */
  private copyDirectory(src: string, dest: string): void {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src);
    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);

      if (fs.statSync(srcPath).isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  /**
   * Extract failure reasons from context
   */
  private extractFailReasons(reason: string, artifacts: string[]): string[] {
    const reasons: string[] = [];

    // Primary reason
    reasons.push(reason);

    // Check artifacts for additional context
    for (const artifact of artifacts) {
      if (fs.existsSync(artifact) && artifact.includes("log")) {
        try {
          const content = fs.readFileSync(artifact, "utf-8");

          // Look for common error patterns
          if (
            content.includes("ENOTFOUND") ||
            content.includes("ECONNREFUSED")
          ) {
            reasons.push("network_connectivity");
          }
          if (content.includes("401") || content.includes("unauthorized")) {
            reasons.push("authentication_failure");
          }
          if (content.includes("429") || content.includes("rate limit")) {
            reasons.push("rate_limiting");
          }
          if (content.includes("timeout")) {
            reasons.push("timeout");
          }
          if (content.includes("schema") || content.includes("validation")) {
            reasons.push("schema_validation");
          }
          if (content.includes("budget") || content.includes("cost")) {
            reasons.push("budget_exceeded");
          }
        } catch (______e) {
          // Ignore file read errors
        }
      }
    }

    // Remove duplicates and limit to top 5
    return Array.from(new Set(reasons)).slice(0, 5);
  }

  /**
   * Append entry to DLQ index
   */
  private appendToIndex(entry: DLQEntry): void {
    try {
      const line = JSON.stringify(entry) + "\n";
      fs.appendFileSync(this.indexPath, line, "utf-8");
    } catch (error) {
      console.error(`[DLQ] Failed to append to index:`, error);
      throw error;
    }
  }

  /**
   * Get DLQ statistics
   */
  getDLQStats(): {
    totalEntries: number;
    recentEntries: DLQEntry[];
    topFailReasons: { reason: string; count: number }[];
  } {
    if (!fs.existsSync(this.indexPath)) {
      return {
        totalEntries: 0,
        recentEntries: [],
        topFailReasons: [],
      };
    }

    try {
      const content = fs.readFileSync(this.indexPath, "utf-8");
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim());
      const entries: DLQEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          entries.push(entry);
        } catch (______e) {
          console.warn(`[DLQ] Skipping malformed index line: ${line}`);
        }
      }

      // Sort by timestamp (most recent first)
      entries.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // Count failure reasons
      const reasonCounts: Record<string, number> = {};
      for (const entry of entries) {
        for (const reason of entry.top_fail_reasons) {
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        }
      }

      const topFailReasons = Object.entries(reasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalEntries: entries.length,
        recentEntries: entries.slice(0, 10),
        topFailReasons,
      };
    } catch (error) {
      console.error(`[DLQ] Failed to read DLQ stats:`, error);
      return {
        totalEntries: 0,
        recentEntries: [],
        topFailReasons: [],
      };
    }
  }

  /**
   * Clean up old DLQ entries (keep last N days)
   */
  cleanupOldEntries(keepDays: number = 30): void {
    const cutoffDate = new Date(Date.now() - keepDays * 24 * 60 * 60 * 1000);

    try {
      // Clean up directories
      if (fs.existsSync(this.dlqDir)) {
        const entries = fs.readdirSync(this.dlqDir);
        for (const entry of entries) {
          if (entry === "index.jsonl") continue;

          const entryPath = path.join(this.dlqDir, entry);
          const stat = fs.statSync(entryPath);

          if (stat.isDirectory() && stat.mtime < cutoffDate) {
            fs.rmSync(entryPath, { recursive: true, force: true });
            console.log(`[DLQ] Cleaned up old DLQ directory: ${entry}`);
          }
        }
      }

      // Rebuild index to remove entries for deleted directories
      this.rebuildIndex();
    } catch (error) {
      console.error(`[DLQ] Failed to cleanup old entries:`, error);
    }
  }

  /**
   * Rebuild DLQ index based on existing directories
   */
  private rebuildIndex(): void {
    try {
      if (!fs.existsSync(this.dlqDir)) {
        return;
      }

      const newEntries: DLQEntry[] = [];
      const entries = fs.readdirSync(this.dlqDir);

      for (const entry of entries) {
        if (entry === "index.jsonl") continue;

        const entryPath = path.join(this.dlqDir, entry);
        const metadataPath = path.join(entryPath, "dlq_metadata.json");

        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
            newEntries.push(metadata);
          } catch (______e) {
            console.warn(`[DLQ] Skipping invalid metadata: ${metadataPath}`);
          }
        }
      }

      // Write new index
      const newIndexContent =
        newEntries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
      fs.writeFileSync(this.indexPath, newIndexContent, "utf-8");

      console.log(`[DLQ] Rebuilt index with ${newEntries.length} entries`);
    } catch (error) {
      console.error(`[DLQ] Failed to rebuild index:`, error);
    }
  }
}

// CLI interface for Node.js execution
if (typeof require !== "undefined" && require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage: node dlq.js --to-dlq <run_id> <reason> <exit_code> [--target <target>] [--mode <mode>] ...",
    );
    process.exit(1);
  }

  const dlq = new DLQManager();

  if (args[0] === "--to-dlq") {
    const runId = args[1];
    const reason = args[2];
    const exitCode = parseInt(args[3], 10) || 1;

    if (!runId || !reason) {
      console.error("Usage: --to-dlq <run_id> <reason> <exit_code>");
      process.exit(1);
    }

    const options: any = {};
    const artifacts: string[] = [];

    for (let i = 4; i < args.length; i += 2) {
      const key = args[i];
      const value = args[i + 1];

      if (key === "--target") options.target = value;
      else if (key === "--mode") options.mode = value;
      else if (key === "--session-id") options.sessionId = value;
      else if (key === "--budget-usd") options.budgetUsd = value;
      else if (key === "--cost-usd") options.costUsd = value;
      else if (key === "--notes") options.notes = value;
      else if (key === "--artifact") artifacts.push(value);
    }

    try {
      dlq.toDLQ(runId, reason, exitCode, artifacts, options);
      console.log("DLQ entry created successfully");
    } catch (error) {
      console.error("Failed to create DLQ entry:", error);
      process.exit(1);
    }
  } else if (args[0] === "--stats") {
    const stats = dlq.getDLQStats();
    console.log(JSON.stringify(stats, null, 2));
  } else if (args[0] === "--cleanup") {
    const keepDays = parseInt(args[1], 10) || 30;
    dlq.cleanupOldEntries(keepDays);
    console.log(`DLQ cleanup completed (kept last ${keepDays} days)`);
  } else {
    console.error("Unknown command. Use --to-dlq, --stats, or --cleanup");
    process.exit(1);
  }
}
