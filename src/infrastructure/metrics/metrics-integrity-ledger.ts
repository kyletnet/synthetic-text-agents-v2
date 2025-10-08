/**
 * Metrics Integrity Ledger
 *
 * Tracks all metrics changes for quality history visualization and drift analysis.
 *
 * Purpose:
 * - Record every metrics update (before/after values)
 * - Detect anomalous changes (sudden spikes/drops)
 * - Provide audit trail for metrics drift
 * - Enable quality history visualization
 *
 * Phase 2B → 2C Transition: Robustness Patch
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

/**
 * Metrics Change Entry
 */
export interface MetricsChangeEntry {
  timestamp: string; // ISO timestamp
  metric_name: string;
  before_value: number;
  after_value: number;
  change_delta: number; // after - before
  change_percent: number; // (delta / before) * 100
  source: string; // Source of change (e.g., "diversity-planner", "feedback-loop")
  trigger: string; // What triggered the change
  drift_filtered: boolean; // Was rolling average applied?
  metadata?: Record<string, unknown>;
}

/**
 * Anomaly Detection Result
 */
export interface AnomalyDetection {
  is_anomaly: boolean;
  severity: "low" | "medium" | "high";
  reason: string;
  threshold_exceeded: number; // How much the threshold was exceeded
}

/**
 * Metrics Integrity Ledger
 *
 * JSONL-based append-only log for metrics changes.
 */
export class MetricsIntegrityLedger {
  private ledgerPath: string;
  private anomalyThresholds: {
    spike_percent: number; // Default: 50% (sudden increase)
    drop_percent: number; // Default: -30% (sudden decrease)
    absolute_delta: number; // Default: 0.2 (20% absolute change)
  };

  constructor(projectRoot?: string) {
    const root = projectRoot || process.cwd();
    this.ledgerPath = join(root, "reports", "metrics-integrity-ledger.jsonl");

    // Ensure directory exists
    const dir = dirname(this.ledgerPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.anomalyThresholds = {
      spike_percent: 50, // 50% sudden increase
      drop_percent: -30, // 30% sudden decrease
      absolute_delta: 0.2, // 20% absolute change
    };
  }

  /**
   * Record metrics change
   */
  recordChange(
    metricName: string,
    beforeValue: number,
    afterValue: number,
    source: string,
    trigger: string,
    options?: {
      driftFiltered?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): void {
    const delta = afterValue - beforeValue;
    const changePercent = beforeValue === 0 ? 0 : (delta / beforeValue) * 100;

    const entry: MetricsChangeEntry = {
      timestamp: new Date().toISOString(),
      metric_name: metricName,
      before_value: beforeValue,
      after_value: afterValue,
      change_delta: delta,
      change_percent: changePercent,
      source,
      trigger,
      drift_filtered: options?.driftFiltered ?? false,
      metadata: options?.metadata,
    };

    // Detect anomalies
    const anomaly = this.detectAnomaly(entry);
    if (anomaly.is_anomaly) {
      console.warn(
        `[Metrics Integrity] ANOMALY DETECTED: ${metricName} - ${anomaly.reason}`,
      );

      // Add anomaly to metadata
      entry.metadata = {
        ...entry.metadata,
        anomaly: {
          detected: true,
          severity: anomaly.severity,
          reason: anomaly.reason,
        },
      };
    }

    // Append to ledger (JSONL format)
    appendFileSync(this.ledgerPath, JSON.stringify(entry) + "\n", "utf8");
  }

  /**
   * Detect anomalous changes
   */
  private detectAnomaly(entry: MetricsChangeEntry): AnomalyDetection {
    // Check for spike (sudden increase > 50%)
    if (entry.change_percent > this.anomalyThresholds.spike_percent) {
      return {
        is_anomaly: true,
        severity: entry.change_percent > 100 ? "high" : "medium",
        reason: `Sudden spike: +${entry.change_percent.toFixed(1)}%`,
        threshold_exceeded:
          entry.change_percent - this.anomalyThresholds.spike_percent,
      };
    }

    // Check for drop (sudden decrease < -30%)
    if (entry.change_percent < this.anomalyThresholds.drop_percent) {
      return {
        is_anomaly: true,
        severity:
          entry.change_percent < -50
            ? "high"
            : entry.change_percent < -40
            ? "medium"
            : "low",
        reason: `Sudden drop: ${entry.change_percent.toFixed(1)}%`,
        threshold_exceeded: Math.abs(
          entry.change_percent - this.anomalyThresholds.drop_percent,
        ),
      };
    }

    // Check for large absolute delta (> 0.2)
    if (Math.abs(entry.change_delta) > this.anomalyThresholds.absolute_delta) {
      return {
        is_anomaly: true,
        severity: Math.abs(entry.change_delta) > 0.5 ? "high" : "low",
        reason: `Large absolute change: ${entry.change_delta.toFixed(3)}`,
        threshold_exceeded:
          Math.abs(entry.change_delta) - this.anomalyThresholds.absolute_delta,
      };
    }

    return {
      is_anomaly: false,
      severity: "low",
      reason: "No anomaly detected",
      threshold_exceeded: 0,
    };
  }

  /**
   * Get recent changes (for visualization)
   */
  getRecentChanges(options?: {
    limit?: number;
    metricName?: string;
  }): MetricsChangeEntry[] {
    if (!existsSync(this.ledgerPath)) {
      return [];
    }

    const content = readFileSync(this.ledgerPath, "utf8");
    const lines = content.trim().split("\n");

    let entries: MetricsChangeEntry[] = lines
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as MetricsChangeEntry);

    // Filter by metric name if specified
    if (options?.metricName) {
      entries = entries.filter((e) => e.metric_name === options.metricName);
    }

    // Limit results
    const limit = options?.limit ?? 100;
    return entries.slice(-limit); // Last N entries
  }

  /**
   * Get anomalies only
   */
  getAnomalies(options?: { limit?: number }): MetricsChangeEntry[] {
    const allChanges = this.getRecentChanges(options);

    return allChanges.filter(
      (entry) =>
        entry.metadata?.anomaly && (entry.metadata.anomaly as any).detected,
    );
  }

  /**
   * Get metrics summary (for dashboard)
   */
  getMetricsSummary(): {
    total_changes: number;
    anomalies_count: number;
    metrics_tracked: string[];
    last_update: string | null;
  } {
    const allChanges = this.getRecentChanges({ limit: 10000 });

    const metricsSet = new Set<string>();
    for (const entry of allChanges) {
      metricsSet.add(entry.metric_name);
    }

    const anomalies = allChanges.filter(
      (entry) =>
        entry.metadata?.anomaly && (entry.metadata.anomaly as any).detected,
    );

    const lastUpdate =
      allChanges.length > 0
        ? allChanges[allChanges.length - 1].timestamp
        : null;

    return {
      total_changes: allChanges.length,
      anomalies_count: anomalies.length,
      metrics_tracked: Array.from(metricsSet),
      last_update: lastUpdate,
    };
  }

  /**
   * Clear ledger (for testing or reset)
   */
  clear(): void {
    if (existsSync(this.ledgerPath)) {
      // Backup before clearing
      const backupPath = this.ledgerPath.replace(
        ".jsonl",
        `-backup-${Date.now()}.jsonl`,
      );
      const content = readFileSync(this.ledgerPath, "utf8");
      appendFileSync(backupPath, content);

      // Clear ledger
      appendFileSync(this.ledgerPath, "", { flag: "w" }); // Overwrite with empty
      console.log(`[Metrics Integrity] Ledger cleared (backup: ${backupPath})`);
    }
  }

  /**
   * Get ledger path
   */
  getLedgerPath(): string {
    return this.ledgerPath;
  }
}

/**
 * Create global metrics integrity ledger instance
 */
let globalLedger: MetricsIntegrityLedger | null = null;

/**
 * Get global metrics integrity ledger
 */
export function getMetricsIntegrityLedger(
  projectRoot?: string,
): MetricsIntegrityLedger {
  if (!globalLedger) {
    globalLedger = new MetricsIntegrityLedger(projectRoot);
  }
  return globalLedger;
}
