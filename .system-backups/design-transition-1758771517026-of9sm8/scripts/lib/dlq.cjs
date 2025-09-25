// CommonJS version for immediate testing
const fs = require("fs");
const path = require("path");

class DLQManager {
  constructor() {
    this.dlqDir = "reports/dlq";
    this.indexPath = path.join(this.dlqDir, "index.jsonl");
    this.ensureDLQDirectory();
  }

  ensureDLQDirectory() {
    if (!fs.existsSync(this.dlqDir)) {
      fs.mkdirSync(this.dlqDir, { recursive: true });
    }
  }

  toDLQ(runId, reason, exitCode, artifacts = [], options = {}) {
    const timestamp = new Date().toISOString();
    const dlqRunDir = path.join(this.dlqDir, runId);

    try {
      if (!fs.existsSync(dlqRunDir)) {
        fs.mkdirSync(dlqRunDir, { recursive: true });
      }

      const dlqEntry = {
        run_id: runId,
        timestamp,
        target: options.target || "unknown",
        mode: options.mode || "unknown",
        reason,
        exit_code: exitCode,
        top_fail_reasons: [reason],
        budget_usd: options.budgetUsd,
        cost_usd: options.costUsd,
        session_id: options.sessionId,
        notes: options.notes,
      };

      const metadataPath = path.join(dlqRunDir, "dlq_metadata.json");
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(dlqEntry, null, 2),
        "utf-8",
      );

      this.appendToIndex(dlqEntry);
      console.log(`[DLQ] Added failed run to DLQ: ${dlqRunDir}`);
    } catch (error) {
      console.error(`[DLQ] Failed to add run to DLQ (${runId}):`, error);
      throw error;
    }
  }

  appendToIndex(entry) {
    try {
      const line = JSON.stringify(entry) + "\n";
      fs.appendFileSync(this.indexPath, line, "utf-8");
    } catch (error) {
      console.error(`[DLQ] Failed to append to index:`, error);
      throw error;
    }
  }

  getDLQStats() {
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
      const entries = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          entries.push(entry);
        } catch (e) {
          console.warn(`[DLQ] Skipping malformed index line: ${line}`);
        }
      }

      return {
        totalEntries: entries.length,
        recentEntries: entries.slice(-10),
        topFailReasons: [],
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
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(
      "Usage: node dlq.js --to-dlq <run_id> <reason> <exit_code> [options]",
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

    const options = {};
    for (let i = 4; i < args.length; i += 2) {
      const key = args[i];
      const value = args[i + 1];

      if (key === "--target") options.target = value;
      else if (key === "--mode") options.mode = value;
      else if (key === "--session-id") options.sessionId = value;
      else if (key === "--budget-usd") options.budgetUsd = value;
      else if (key === "--cost-usd") options.costUsd = value;
      else if (key === "--notes") options.notes = value;
    }

    try {
      dlq.toDLQ(runId, reason, exitCode, [], options);
      console.log("DLQ entry created successfully");
    } catch (error) {
      console.error("Failed to create DLQ entry:", error);
      process.exit(1);
    }
  } else if (args[0] === "--stats") {
    const stats = dlq.getDLQStats();
    console.log(JSON.stringify(stats, null, 2));
  } else {
    console.error("Unknown command. Use --to-dlq or --stats");
    process.exit(1);
  }
}

module.exports = { DLQManager };
