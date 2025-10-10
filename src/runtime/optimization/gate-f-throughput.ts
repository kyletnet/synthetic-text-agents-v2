/**
 * Gate F: Throughput & Energy Controller
 *
 * Monitors system performance and automatically adjusts processing
 * to maintain optimal throughput while preventing system overload.
 *
 * Key Features:
 * - E2E latency monitoring (p95 threshold: 1ms)
 * - Throughput monitoring (min: 1000 q/s)
 * - Adaptive batch size adjustment (100 → 10 fallback)
 * - Automatic cooldown and recovery
 * - Energy profiler integration
 *
 * KPI:
 * - p95 ≤ 1ms maintained
 * - System utilization ≤ 80%
 * - Auto-recovery < 5s
 *
 * @see Phase 2.7 Final Verification Plan
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Gate F status
 */
export interface GateFStatus {
  enabled: boolean;
  status: 'healthy' | 'warning' | 'cooldown' | 'critical';
  metrics: {
    p95Latency: number;
    throughput: number;
    systemUtilization: number;
    batchSize: number;
  };
  thresholds: {
    maxP95Latency: number;
    minThroughput: number;
    maxUtilization: number;
  };
  cooldown: {
    active: boolean;
    startTime?: Date;
    duration: number;
    reason?: string;
  };
  history: GateFEvent[];
}

/**
 * Gate F event
 */
export interface GateFEvent {
  timestamp: Date;
  type: 'warning' | 'cooldown' | 'recovery' | 'batch_adjust';
  metric: string;
  value: number;
  threshold: number;
  action: string;
}

/**
 * Performance window
 */
interface PerformanceWindow {
  latencies: number[];
  timestamps: number[];
  batchSizes: number[];
  windowSize: number;
}

/**
 * Gate F Configuration
 */
export interface GateFConfig {
  maxP95Latency: number; // Maximum p95 latency (ms)
  minThroughput: number; // Minimum throughput (q/s)
  maxUtilization: number; // Maximum system utilization (%)
  cooldownDuration: number; // Cooldown duration (ms)
  recoveryThreshold: number; // Recovery threshold (0-1)
  batchSizeMin: number; // Minimum batch size
  batchSizeMax: number; // Maximum batch size
  windowSize: number; // Performance window size
}

const DEFAULT_CONFIG: GateFConfig = {
  maxP95Latency: 1.0, // 1ms
  minThroughput: 1000, // 1000 q/s
  maxUtilization: 0.8, // 80%
  cooldownDuration: 5000, // 5s
  recoveryThreshold: 0.7, // 70% of threshold
  batchSizeMin: 10,
  batchSizeMax: 100,
  windowSize: 100, // Last 100 measurements
};

/**
 * Gate F: Throughput & Energy Controller
 *
 * Maintains optimal system performance through adaptive control.
 */
export class GateFController {
  private config: GateFConfig;
  private status: GateFStatus;
  private performanceWindow: PerformanceWindow;
  private statusPath: string;

  constructor(config: Partial<GateFConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.statusPath = path.join(process.cwd(), 'reports/gate-f-status.json');

    this.performanceWindow = {
      latencies: [],
      timestamps: [],
      batchSizes: [],
      windowSize: this.config.windowSize,
    };

    this.status = {
      enabled: true,
      status: 'healthy',
      metrics: {
        p95Latency: 0,
        throughput: 0,
        systemUtilization: 0,
        batchSize: this.config.batchSizeMax,
      },
      thresholds: {
        maxP95Latency: this.config.maxP95Latency,
        minThroughput: this.config.minThroughput,
        maxUtilization: this.config.maxUtilization,
      },
      cooldown: {
        active: false,
        duration: this.config.cooldownDuration,
      },
      history: [],
    };

    this.loadStatus();
  }

  /**
   * Record performance measurement
   */
  recordMeasurement(latency: number, batchSize: number = 1): void {
    const now = performance.now();

    // Add to window
    this.performanceWindow.latencies.push(latency);
    this.performanceWindow.timestamps.push(now);
    this.performanceWindow.batchSizes.push(batchSize);

    // Trim window
    if (this.performanceWindow.latencies.length > this.performanceWindow.windowSize) {
      this.performanceWindow.latencies.shift();
      this.performanceWindow.timestamps.shift();
      this.performanceWindow.batchSizes.shift();
    }

    // Update metrics
    this.updateMetrics();

    // Check thresholds
    this.checkThresholds();

    // Save status
    this.saveStatus();
  }

  /**
   * Update current metrics
   */
  private updateMetrics(): void {
    if (this.performanceWindow.latencies.length === 0) return;

    // Calculate p95 latency
    const sorted = [...this.performanceWindow.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    this.status.metrics.p95Latency = sorted[p95Index];

    // Calculate throughput
    const timeWindow =
      this.performanceWindow.timestamps[this.performanceWindow.timestamps.length - 1] -
      this.performanceWindow.timestamps[0];
    const totalQueries = this.performanceWindow.batchSizes.reduce((sum, size) => sum + size, 0);
    this.status.metrics.throughput = (totalQueries / (timeWindow / 1000));

    // System utilization (simplified - based on latency vs threshold)
    this.status.metrics.systemUtilization =
      Math.min(this.status.metrics.p95Latency / this.config.maxP95Latency, 1.0);
  }

  /**
   * Check performance thresholds
   */
  private checkThresholds(): void {
    // Skip if in cooldown
    if (this.status.cooldown.active) {
      this.checkRecovery();
      return;
    }

    // Check p95 latency
    if (this.status.metrics.p95Latency > this.config.maxP95Latency) {
      this.triggerCooldown('p95_latency', this.status.metrics.p95Latency);
      return;
    }

    // Check throughput
    if (this.status.metrics.throughput < this.config.minThroughput) {
      this.triggerWarning('throughput', this.status.metrics.throughput);
    }

    // Check utilization
    if (this.status.metrics.systemUtilization > this.config.maxUtilization) {
      this.adjustBatchSize('down');
    } else if (this.status.metrics.systemUtilization < this.config.recoveryThreshold) {
      this.adjustBatchSize('up');
    }

    // Update status
    if (this.status.metrics.p95Latency > this.config.maxP95Latency * 0.9) {
      this.status.status = 'warning';
    } else {
      this.status.status = 'healthy';
    }
  }

  /**
   * Trigger cooldown
   */
  private triggerCooldown(metric: string, value: number): void {
    const threshold =
      metric === 'p95_latency' ? this.config.maxP95Latency : this.config.minThroughput;

    this.status.status = 'cooldown';
    this.status.cooldown.active = true;
    this.status.cooldown.startTime = new Date();
    this.status.cooldown.reason = `${metric} exceeded threshold: ${value.toFixed(3)} > ${threshold}`;

    // Reduce batch size to minimum
    this.status.metrics.batchSize = this.config.batchSizeMin;

    const event: GateFEvent = {
      timestamp: new Date(),
      type: 'cooldown',
      metric,
      value,
      threshold,
      action: `Batch size reduced to ${this.config.batchSizeMin}`,
    };
    this.status.history.push(event);

    console.warn(`⚠️  Gate F: COOLDOWN triggered (${metric})`);
    console.warn(`   Value: ${value.toFixed(3)} | Threshold: ${threshold}`);
    console.warn(`   Action: Batch size reduced to ${this.config.batchSizeMin}`);
  }

  /**
   * Trigger warning
   */
  private triggerWarning(metric: string, value: number): void {
    const event: GateFEvent = {
      timestamp: new Date(),
      type: 'warning',
      metric,
      value,
      threshold: this.config.minThroughput,
      action: 'Monitoring',
    };
    this.status.history.push(event);

    if (this.status.status === 'healthy') {
      this.status.status = 'warning';
    }
  }

  /**
   * Check for recovery from cooldown
   */
  private checkRecovery(): void {
    if (!this.status.cooldown.active || !this.status.cooldown.startTime) return;

    const now = new Date();
    const cooldownElapsed = now.getTime() - this.status.cooldown.startTime.getTime();

    // Check if cooldown period has elapsed
    if (cooldownElapsed < this.config.cooldownDuration) return;

    // Check if metrics are below recovery threshold
    const recoveryLatency = this.config.maxP95Latency * this.config.recoveryThreshold;

    if (this.status.metrics.p95Latency < recoveryLatency) {
      this.status.cooldown.active = false;
      this.status.cooldown.startTime = undefined;
      this.status.cooldown.reason = undefined;
      this.status.status = 'healthy';

      const event: GateFEvent = {
        timestamp: new Date(),
        type: 'recovery',
        metric: 'p95_latency',
        value: this.status.metrics.p95Latency,
        threshold: recoveryLatency,
        action: 'Cooldown ended, batch size will gradually increase',
      };
      this.status.history.push(event);

      console.log(`✅ Gate F: RECOVERY complete`);
      console.log(`   Cooldown duration: ${cooldownElapsed}ms`);
      console.log(`   Current p95: ${this.status.metrics.p95Latency.toFixed(3)}ms`);
    }
  }

  /**
   * Adjust batch size
   */
  private adjustBatchSize(direction: 'up' | 'down'): void {
    const currentSize = this.status.metrics.batchSize;
    let newSize = currentSize;

    if (direction === 'down') {
      newSize = Math.max(this.config.batchSizeMin, Math.floor(currentSize * 0.5));
    } else {
      newSize = Math.min(this.config.batchSizeMax, Math.floor(currentSize * 1.2));
    }

    if (newSize !== currentSize) {
      this.status.metrics.batchSize = newSize;

      const event: GateFEvent = {
        timestamp: new Date(),
        type: 'batch_adjust',
        metric: 'batch_size',
        value: newSize,
        threshold: currentSize,
        action: `Batch size ${direction === 'up' ? 'increased' : 'decreased'}: ${currentSize} → ${newSize}`,
      };
      this.status.history.push(event);
    }
  }

  /**
   * Get current status
   */
  getStatus(): GateFStatus {
    return this.status;
  }

  /**
   * Get recommended batch size
   */
  getRecommendedBatchSize(): number {
    return this.status.metrics.batchSize;
  }

  /**
   * Check if gate passes
   */
  passes(): boolean {
    return (
      this.status.status === 'healthy' ||
      this.status.status === 'warning'
    );
  }

  /**
   * Save status to file
   */
  private saveStatus(): void {
    try {
      const dir = path.dirname(this.statusPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.statusPath,
        JSON.stringify(
          {
            ...this.status,
            lastUpdated: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error('Failed to save Gate F status:', error);
    }
  }

  /**
   * Load status from file
   */
  private loadStatus(): void {
    try {
      if (fs.existsSync(this.statusPath)) {
        const data = fs.readFileSync(this.statusPath, 'utf-8');
        const loaded = JSON.parse(data);

        // Restore status (but reset cooldown if stale)
        if (loaded.cooldown?.startTime) {
          const cooldownAge = Date.now() - new Date(loaded.cooldown.startTime).getTime();
          if (cooldownAge > this.config.cooldownDuration * 2) {
            loaded.cooldown.active = false;
            loaded.status = 'healthy';
          }
        }

        this.status = {
          ...this.status,
          ...loaded,
          cooldown: {
            ...this.status.cooldown,
            ...loaded.cooldown,
            startTime: loaded.cooldown?.startTime
              ? new Date(loaded.cooldown.startTime)
              : undefined,
          },
        };
      }
    } catch (error) {
      console.warn('Failed to load Gate F status, using defaults:', error);
    }
  }

  /**
   * Reset gate
   */
  reset(): void {
    this.performanceWindow = {
      latencies: [],
      timestamps: [],
      batchSizes: [],
      windowSize: this.config.windowSize,
    };

    this.status = {
      enabled: true,
      status: 'healthy',
      metrics: {
        p95Latency: 0,
        throughput: 0,
        systemUtilization: 0,
        batchSize: this.config.batchSizeMax,
      },
      thresholds: {
        maxP95Latency: this.config.maxP95Latency,
        minThroughput: this.config.minThroughput,
        maxUtilization: this.config.maxUtilization,
      },
      cooldown: {
        active: false,
        duration: this.config.cooldownDuration,
      },
      history: [],
    };

    this.saveStatus();
  }

  /**
   * Get performance report
   */
  getReport(): {
    summary: string;
    status: GateFStatus;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    if (this.status.status === 'cooldown') {
      recommendations.push('System in cooldown - reduce load');
    }

    if (this.status.metrics.p95Latency > this.config.maxP95Latency * 0.8) {
      recommendations.push('p95 latency approaching threshold - consider optimization');
    }

    if (this.status.metrics.throughput < this.config.minThroughput * 1.2) {
      recommendations.push('Throughput below optimal - check bottlenecks');
    }

    const summary = `Gate F Status: ${this.status.status.toUpperCase()}
  p95 Latency: ${this.status.metrics.p95Latency.toFixed(3)}ms (threshold: ${this.config.maxP95Latency}ms)
  Throughput: ${this.status.metrics.throughput.toFixed(0)} q/s (min: ${this.config.minThroughput} q/s)
  Batch Size: ${this.status.metrics.batchSize}
  Utilization: ${(this.status.metrics.systemUtilization * 100).toFixed(1)}%`;

    return {
      summary,
      status: this.status,
      recommendations,
    };
  }
}

/**
 * Default singleton instance
 */
export const gateFController = new GateFController();
