#!/usr/bin/env tsx

/**
 * Quality History Tracker
 *
 * Purpose:
 * - Record daily quality snapshots (baseline_report.jsonl)
 * - Detect quality regression over time
 * - Enable "한 번 고치면 다시는 안 망가진다" guarantee
 *
 * Design:
 * - Historical snapshots in reports/historical/
 * - Automatic cleanup (30 days retention)
 * - Regression detection (10% degradation threshold)
 */

import {
  existsSync,
  readFileSync,
  copyFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  mkdirSync,
} from "fs";
import { join } from "path";

export interface RegressionResult {
  degraded: boolean;
  details: Array<{
    period?: string;
    avgScore?: string;
    regression?: string;
    threshold?: string;
  }>;
}

export class QualityHistoryTracker {
  private historyDir: string;
  private sourceFile: string;

  constructor(projectRoot: string = process.cwd()) {
    this.historyDir = join(projectRoot, "reports", "historical");
    this.sourceFile = join(projectRoot, "reports", "baseline_report.jsonl");

    // Ensure directory exists
    if (!existsSync(this.historyDir)) {
      mkdirSync(this.historyDir, { recursive: true });
      console.log(`📁 Created historical directory: ${this.historyDir}`);
    }
  }

  /**
   * Record quality snapshot for today
   * - Copies baseline_report.jsonl to historical/citation_quality_YYYY-MM-DD.jsonl
   * - Skips if already recorded today
   */
  async recordQualitySnapshot(): Promise<void> {
    const date = new Date().toISOString().split("T")[0];
    const destFile = join(this.historyDir, `citation_quality_${date}.jsonl`);

    // Already recorded today
    if (existsSync(destFile)) {
      console.log(`✅ Quality snapshot already exists for ${date}`);
      return;
    }

    // Source file doesn't exist
    if (!existsSync(this.sourceFile)) {
      console.warn(
        `⚠️  Source file not found: ${this.sourceFile}\n` +
          `   Run baseline test to generate it.`,
      );
      return;
    }

    try {
      // Copy to historical
      copyFileSync(this.sourceFile, destFile);
      console.log(`📸 Quality snapshot saved: citation_quality_${date}.jsonl`);

      // Cleanup old files
      await this.cleanupOldHistory(30);
    } catch (error) {
      console.error("Failed to save quality snapshot:", error);
    }
  }

  /**
   * Detect quality regression over N days
   * - Compares recent 3 days avg vs past days avg
   * - Returns true if degraded by >10%
   */
  async detectRegression(days: number = 7): Promise<RegressionResult> {
    const files = this.getRecentHistoryFiles(days);

    if (files.length < 4) {
      // Need at least 4 days of data (3 recent + 1+ past)
      console.log(
        `⚠️  Insufficient data for regression detection (${files.length}/4 days)`,
      );
      return { degraded: false, details: [] };
    }

    try {
      const scores: number[] = [];

      for (const file of files) {
        const avgScore = await this.calculateAvgScore(
          join(this.historyDir, file),
        );
        scores.push(avgScore);
      }

      // Recent 3 days vs past days
      const recentScores = scores.slice(-3);
      const pastScores = scores.slice(0, -3);

      const recentAvg =
        recentScores.reduce((a, b) => a + b, 0) / recentScores.length;
      const pastAvg = pastScores.reduce((a, b) => a + b, 0) / pastScores.length;

      // Regression detection: recent < past * 0.9 (10% degradation)
      const degraded = recentAvg < pastAvg * 0.9;
      const regressionPercent = (
        ((pastAvg - recentAvg) / pastAvg) *
        100
      ).toFixed(1);

      return {
        degraded,
        details: [
          { period: "recent (3 days)", avgScore: recentAvg.toFixed(3) },
          {
            period: `past (${pastScores.length} days)`,
            avgScore: pastAvg.toFixed(3),
          },
          { regression: `${regressionPercent}%`, threshold: "10%" },
        ],
      };
    } catch (error) {
      console.error("Failed to detect regression:", error);
      return { degraded: false, details: [] };
    }
  }

  /**
   * Get recent history files (sorted by date)
   */
  private getRecentHistoryFiles(days: number): string[] {
    if (!existsSync(this.historyDir)) {
      return [];
    }

    return readdirSync(this.historyDir)
      .filter((f) => f.startsWith("citation_quality_") && f.endsWith(".jsonl"))
      .sort() // YYYY-MM-DD format sorts correctly
      .slice(-days);
  }

  /**
   * Calculate average quality score from JSONL file
   */
  private async calculateAvgScore(filePath: string): Promise<number> {
    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter(Boolean);

      if (lines.length === 0) {
        return 0;
      }

      const sum = lines.reduce((total, line) => {
        try {
          const obj = JSON.parse(line);
          return total + (obj.quality_score || 0);
        } catch {
          return total;
        }
      }, 0);

      return sum / lines.length;
    } catch (error) {
      console.error(`Failed to read ${filePath}:`, error);
      return 0;
    }
  }

  /**
   * Cleanup old history files (default: 30 days)
   */
  private async cleanupOldHistory(retentionDays: number): Promise<void> {
    if (!existsSync(this.historyDir)) {
      return;
    }

    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const files = readdirSync(this.historyDir);

    let deletedCount = 0;

    for (const file of files) {
      const filePath = join(this.historyDir, file);

      try {
        const stats = statSync(filePath);

        if (stats.mtimeMs < cutoffTime) {
          unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️  Deleted old history: ${file}`);
        }
      } catch (error) {
        console.warn(`Failed to delete ${file}:`, error);
      }
    }

    if (deletedCount > 0) {
      console.log(
        `🧹 Cleaned up ${deletedCount} old history files (>${retentionDays} days)`,
      );
    }
  }

  /**
   * Get historical trend (for visualization)
   */
  async getHistoricalTrend(days: number = 30): Promise<
    Array<{
      date: string;
      avgScore: number;
    }>
  > {
    const files = this.getRecentHistoryFiles(days);
    const trend: Array<{ date: string; avgScore: number }> = [];

    for (const file of files) {
      // Extract date from filename: citation_quality_2025-10-04.jsonl
      const match = file.match(/citation_quality_(\d{4}-\d{2}-\d{2})\.jsonl/);
      if (!match) continue;

      const date = match[1];
      const avgScore = await this.calculateAvgScore(
        join(this.historyDir, file),
      );

      trend.push({ date, avgScore });
    }

    return trend;
  }
}

// Singleton instance
let instance: QualityHistoryTracker | null = null;

export function getQualityHistoryTracker(
  projectRoot?: string,
): QualityHistoryTracker {
  if (!instance) {
    instance = new QualityHistoryTracker(projectRoot);
  }
  return instance;
}
