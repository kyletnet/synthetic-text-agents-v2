#!/usr/bin/env node

/**
 * GAP Scanner Dashboard
 *
 * Real-time visual dashboard for GAP Prevention System
 */

import { readFile } from "fs/promises";
import { existsSync } from "fs";

interface GapScanReport {
  timestamp: string;
  mode: string;
  totalChecks: number;
  enabledChecks: number;
  gaps: Array<{
    severity: "P0" | "P1" | "P2";
    checkId: string;
    title: string;
  }>;
  summary: {
    P0: number;
    P1: number;
    P2: number;
    total: number;
  };
  executionTime: number;
}

class GapDashboard {
  private reportPath = "reports/gap-scan-results.json";

  async display(): Promise<void> {
    console.clear();

    if (!existsSync(this.reportPath)) {
      this.showEmptyState();
      return;
    }

    const content = await readFile(this.reportPath, "utf-8");
    const report = JSON.parse(content) as GapScanReport;

    this.render(report);
  }

  private render(report: GapScanReport): void {
    const { summary, gaps, mode, timestamp, executionTime } = report;

    // Header
    console.log("╔" + "═".repeat(78) + "╗");
    console.log("║" + this.center("🔍 GAP SCANNER DASHBOARD", 78) + "║");
    console.log("╠" + "═".repeat(78) + "╣");

    // Status overview
    const statusIcon =
      summary.total === 0
        ? "✅"
        : summary.P0 > 0
        ? "🔴"
        : summary.P1 > 0
        ? "🟡"
        : "🟢";
    const statusText =
      summary.total === 0 ? "ALL CLEAR" : `${summary.total} GAP(S) DETECTED`;

    console.log("║" + this.center(`${statusIcon} ${statusText}`, 78) + "║");
    console.log("╠" + "═".repeat(78) + "╣");

    // Metrics grid
    console.log(
      "║                                                                              ║",
    );
    console.log(
      "║" + this.pad("  📊 METRICS", 38) + this.pad("⚙️  CONFIG", 40) + "║",
    );
    console.log(
      "║" + "  " + "─".repeat(36) + this.pad("─".repeat(38), 40) + "║",
    );

    // Left column: Metrics
    const p0Bar = this.progressBar(summary.P0, 10, "🔴");
    const p1Bar = this.progressBar(summary.P1, 10, "🟡");
    const p2Bar = this.progressBar(summary.P2, 10, "🟢");

    console.log(
      "║" +
        this.pad(
          `  P0 Critical: ${summary.P0.toString().padStart(2)}  ${p0Bar}`,
          38,
        ) +
        this.pad(`  Mode: ${mode}`, 40) +
        "║",
    );
    console.log(
      "║" +
        this.pad(
          `  P1 High:     ${summary.P1.toString().padStart(2)}  ${p1Bar}`,
          38,
        ) +
        this.pad(
          `  Checks: ${report.enabledChecks}/${report.totalChecks}`,
          40,
        ) +
        "║",
    );
    console.log(
      "║" +
        this.pad(
          `  P2 Medium:   ${summary.P2.toString().padStart(2)}  ${p2Bar}`,
          38,
        ) +
        this.pad(`  Time: ${executionTime}ms`, 40) +
        "║",
    );

    console.log(
      "║                                                                              ║",
    );
    console.log("╠" + "═".repeat(78) + "╣");

    // Recent gaps
    if (gaps.length > 0) {
      console.log("║" + this.pad("  🔎 RECENT GAPS", 78) + "║");
      console.log("║" + "  " + "─".repeat(74) + "  ║");

      const displayGaps = gaps.slice(0, 5); // Show max 5
      for (const gap of displayGaps) {
        const icon =
          gap.severity === "P0" ? "🔴" : gap.severity === "P1" ? "🟡" : "🟢";
        const line = `  ${icon} [${gap.checkId}] ${gap.title}`;
        console.log("║" + this.pad(this.truncate(line, 74), 78) + "║");
      }

      if (gaps.length > 5) {
        console.log(
          "║" + this.pad(`  ... and ${gaps.length - 5} more`, 78) + "║",
        );
      }

      console.log(
        "║                                                                              ║",
      );
      console.log("╠" + "═".repeat(78) + "╣");
    }

    // Action items
    console.log("║" + this.pad("  📋 QUICK ACTIONS", 78) + "║");
    console.log("║" + "  " + "─".repeat(74) + "  ║");

    if (summary.P0 > 0) {
      console.log(
        "║" + this.pad("  ⚠️  Fix P0 critical gaps immediately!", 78) + "║",
      );
    }
    if (summary.P1 > 0) {
      console.log(
        "║" + this.pad("  📝 Review P1 high-priority gaps", 78) + "║",
      );
    }

    console.log("║" + this.pad("  🔄 Run: npm run gap:scan", 78) + "║");
    console.log("║" + this.pad("  📊 Run: npm run gap:scan:metrics", 78) + "║");
    console.log(
      "║" + this.pad("  📖 Docs: docs/GAP_SCANNER_GUIDE.md", 78) + "║",
    );

    console.log(
      "║                                                                              ║",
    );
    console.log("╠" + "═".repeat(78) + "╣");

    // Footer
    const lastScan = new Date(timestamp).toLocaleString();
    console.log("║" + this.center(`Last scan: ${lastScan}`, 78) + "║");
    console.log("╚" + "═".repeat(78) + "╝");

    console.log("");
  }

  private showEmptyState(): void {
    console.log("╔" + "═".repeat(78) + "╗");
    console.log("║" + this.center("🔍 GAP SCANNER DASHBOARD", 78) + "║");
    console.log("╠" + "═".repeat(78) + "╣");
    console.log(
      "║                                                                              ║",
    );
    console.log("║" + this.center("No scan results available", 78) + "║");
    console.log(
      "║                                                                              ║",
    );
    console.log("║" + this.center("Run: npm run gap:scan", 78) + "║");
    console.log(
      "║                                                                              ║",
    );
    console.log("╚" + "═".repeat(78) + "╝");
    console.log("");
  }

  private center(text: string, width: number): string {
    const padding = Math.floor((width - text.length) / 2);
    return (
      " ".repeat(padding) + text + " ".repeat(width - padding - text.length)
    );
  }

  private pad(text: string, width: number): string {
    return text + " ".repeat(Math.max(0, width - text.length));
  }

  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }

  private progressBar(value: number, max: number, icon: string): string {
    const normalized = Math.min(value, max);
    const filled = Math.floor((normalized / max) * 10);
    const empty = 10 - filled;

    return icon.repeat(filled) + "·".repeat(empty);
  }

  async watch(): Promise<void> {
    console.log("📊 Starting GAP Scanner Dashboard (watch mode)");
    console.log("Press Ctrl+C to exit\n");

    // Initial display
    await this.display();

    // Watch for changes
    setInterval(async () => {
      await this.display();
    }, 5000); // Refresh every 5 seconds
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);
  const watch = args.includes("--watch") || args.includes("-w");
  const help = args.includes("--help") || args.includes("-h");

  if (help) {
    console.log(`
GAP Scanner Dashboard

Usage:
  npm run gap:dashboard              # Show current status
  npm run gap:dashboard -- --watch   # Watch mode (auto-refresh)

Options:
  --watch, -w    Watch mode (refresh every 5s)
  --help, -h     Show this help message

Examples:
  # One-time display
  npm run gap:dashboard

  # Continuous monitoring
  npm run gap:dashboard -- --watch
    `);
    process.exit(0);
  }

  const dashboard = new GapDashboard();

  if (watch) {
    await dashboard.watch();
  } else {
    await dashboard.display();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { GapDashboard };
