/**
 * Performance Tracker
 *
 * Automated performance tracking and regression detection for Phase 2.7.
 *
 * Features:
 * - Layer-wise latency profiling (L1, L2, L3, L4)
 * - Percentile calculation (p50, p95, p99)
 * - Baseline comparison and drift detection
 * - Automatic logging and reporting
 *
 * Usage:
 * ```typescript
 * const tracker = new PerfTracker();
 * tracker.startLayer('L2');
 * // ... operation ...
 * tracker.endLayer('L2');
 * const report = tracker.generateReport();
 * ```
 *
 * @see HANDOFF_PHASE_2.7.md - Batch Profiling Hook requirement
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Layer identifier
 */
export type LayerId = 'L1' | 'L2' | 'L3' | 'L4' | 'E2E';

/**
 * Performance measurement
 */
export interface PerfMeasurement {
  layerId: LayerId;
  operation: string;
  latency: number; // milliseconds
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Percentile statistics
 */
export interface PercentileStats {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
  count: number;
}

/**
 * Layer performance report
 */
export interface LayerPerfReport {
  layerId: LayerId;
  stats: PercentileStats;
  baseline?: PercentileStats;
  regression?: {
    detected: boolean;
    metric: string;
    current: number;
    baseline: number;
    drift: number; // percentage
  };
}

/**
 * Full performance report
 */
export interface PerfReport {
  timestamp: Date;
  layers: Record<LayerId, LayerPerfReport>;
  summary: {
    totalMeasurements: number;
    regressions: number;
    improvements: number;
  };
}

/**
 * Performance baseline data
 */
export interface PerfBaseline {
  timestamp: string;
  phase: string;
  layers: Record<LayerId, PercentileStats>;
}

/**
 * Performance Tracker
 *
 * Tracks performance metrics and detects regressions.
 */
export class PerfTracker {
  private measurements = new Map<LayerId, PerfMeasurement[]>();
  private activeTimers = new Map<string, { layerId: LayerId; startTime: number }>();
  private baseline: PerfBaseline | null = null;
  private config = {
    regressionThreshold: 0.10, // 10% degradation triggers regression warning
    baselinePath: path.join(process.cwd(), 'reports/perf-baseline.json'),
    logPath: path.join(process.cwd(), 'reports/perf-logs.jsonl'),
  };

  constructor(baselinePath?: string) {
    if (baselinePath) {
      this.config.baselinePath = baselinePath;
    }
    this.loadBaseline();
  }

  /**
   * Load performance baseline
   */
  private loadBaseline(): void {
    try {
      if (fs.existsSync(this.config.baselinePath)) {
        const data = fs.readFileSync(this.config.baselinePath, 'utf-8');
        this.baseline = JSON.parse(data) as PerfBaseline;
      }
    } catch (error) {
      console.warn('Failed to load performance baseline:', error);
    }
  }

  /**
   * Start timing a layer operation
   */
  startLayer(layerId: LayerId, operation: string = 'default'): void {
    const key = `${layerId}:${operation}`;
    this.activeTimers.set(key, {
      layerId,
      startTime: performance.now(),
    });
  }

  /**
   * End timing and record measurement
   */
  endLayer(
    layerId: LayerId,
    operation: string = 'default',
    metadata?: Record<string, unknown>
  ): number {
    const key = `${layerId}:${operation}`;
    const timer = this.activeTimers.get(key);

    if (!timer) {
      console.warn(`No active timer for ${key}`);
      return 0;
    }

    const latency = performance.now() - timer.startTime;
    this.activeTimers.delete(key);

    // Record measurement
    const measurement: PerfMeasurement = {
      layerId,
      operation,
      latency,
      timestamp: new Date(),
      metadata,
    };

    if (!this.measurements.has(layerId)) {
      this.measurements.set(layerId, []);
    }
    this.measurements.get(layerId)!.push(measurement);

    // Auto-log if configured
    if (this.config.logPath) {
      this.logMeasurement(measurement);
    }

    return latency;
  }

  /**
   * Record a measurement directly (without start/end)
   */
  record(layerId: LayerId, latency: number, operation: string = 'default'): void {
    const measurement: PerfMeasurement = {
      layerId,
      operation,
      latency,
      timestamp: new Date(),
    };

    if (!this.measurements.has(layerId)) {
      this.measurements.set(layerId, []);
    }
    this.measurements.get(layerId)!.push(measurement);

    if (this.config.logPath) {
      this.logMeasurement(measurement);
    }
  }

  /**
   * Calculate percentile statistics
   */
  private calculateStats(latencies: number[]): PercentileStats {
    if (latencies.length === 0) {
      return {
        p50: 0,
        p95: 0,
        p99: 0,
        mean: 0,
        min: 0,
        max: 0,
        count: 0,
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const count = sorted.length;

    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * count) - 1;
      return sorted[Math.max(0, index)];
    };

    const mean = sorted.reduce((sum, val) => sum + val, 0) / count;

    return {
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
      mean,
      min: sorted[0],
      max: sorted[count - 1],
      count,
    };
  }

  /**
   * Detect regression by comparing to baseline
   */
  private detectRegression(
    layerId: LayerId,
    currentStats: PercentileStats
  ): LayerPerfReport['regression'] {
    if (!this.baseline || !this.baseline.layers[layerId]) {
      return undefined;
    }

    const baselineStats = this.baseline.layers[layerId];
    const p95Drift = ((currentStats.p95 - baselineStats.p95) / baselineStats.p95) * 100;

    const detected = p95Drift > this.config.regressionThreshold * 100;

    return {
      detected,
      metric: 'p95',
      current: currentStats.p95,
      baseline: baselineStats.p95,
      drift: p95Drift,
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): PerfReport {
    const layers: Record<LayerId, LayerPerfReport> = {} as Record<LayerId, LayerPerfReport>;
    let regressions = 0;
    let improvements = 0;

    for (const [layerId, measurements] of this.measurements.entries()) {
      const latencies = measurements.map((m) => m.latency);
      const stats = this.calculateStats(latencies);
      const regression = this.detectRegression(layerId, stats);

      if (regression?.detected) {
        if (regression.drift > 0) {
          regressions++;
        } else {
          improvements++;
        }
      }

      layers[layerId] = {
        layerId,
        stats,
        baseline: this.baseline?.layers[layerId],
        regression,
      };
    }

    return {
      timestamp: new Date(),
      layers,
      summary: {
        totalMeasurements: Array.from(this.measurements.values()).reduce(
          (sum, m) => sum + m.length,
          0
        ),
        regressions,
        improvements,
      },
    };
  }

  /**
   * Save current measurements as new baseline
   */
  saveAsBaseline(phase: string): void {
    const layers: Record<LayerId, PercentileStats> = {} as Record<LayerId, PercentileStats>;

    for (const [layerId, measurements] of this.measurements.entries()) {
      const latencies = measurements.map((m) => m.latency);
      layers[layerId] = this.calculateStats(latencies);
    }

    const baseline: PerfBaseline = {
      timestamp: new Date().toISOString(),
      phase,
      layers,
    };

    const dir = path.dirname(this.config.baselinePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.config.baselinePath, JSON.stringify(baseline, null, 2));
    this.baseline = baseline;
  }

  /**
   * Log measurement to JSONL file
   */
  private logMeasurement(measurement: PerfMeasurement): void {
    try {
      const dir = path.dirname(this.config.logPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const line = JSON.stringify(measurement) + '\n';
      fs.appendFileSync(this.config.logPath, line);
    } catch (error) {
      console.error('Failed to log measurement:', error);
    }
  }

  /**
   * Print report to console
   */
  printReport(report: PerfReport): void {
    console.log('\n📊 Performance Report');
    console.log('==================\n');

    for (const [layerId, layerReport] of Object.entries(report.layers)) {
      console.log(`${layerId}:`);
      console.log(`  p50: ${layerReport.stats.p50.toFixed(2)}ms`);
      console.log(`  p95: ${layerReport.stats.p95.toFixed(2)}ms`);
      console.log(`  p99: ${layerReport.stats.p99.toFixed(2)}ms`);
      console.log(`  mean: ${layerReport.stats.mean.toFixed(2)}ms`);
      console.log(`  count: ${layerReport.stats.count}`);

      if (layerReport.regression) {
        const icon = layerReport.regression.detected
          ? layerReport.regression.drift > 0
            ? '⚠️ '
            : '✅'
          : '✓';
        console.log(
          `  ${icon} Drift: ${layerReport.regression.drift > 0 ? '+' : ''}${layerReport.regression.drift.toFixed(1)}%`
        );
      }
      console.log();
    }

    console.log(`Summary:`);
    console.log(`  Total measurements: ${report.summary.totalMeasurements}`);
    console.log(`  Regressions: ${report.summary.regressions}`);
    console.log(`  Improvements: ${report.summary.improvements}`);
    console.log();
  }

  /**
   * Clear all measurements
   */
  clear(): void {
    this.measurements.clear();
    this.activeTimers.clear();
  }

  /**
   * Get raw measurements
   */
  getMeasurements(): Map<LayerId, PerfMeasurement[]> {
    return this.measurements;
  }
}

/**
 * Default singleton instance
 */
export const perfTracker = new PerfTracker();
