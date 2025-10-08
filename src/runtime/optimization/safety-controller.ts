/**
 * Optimizer Safety Controller (Phase 3.6 - Hardening)
 *
 * "최적화는 안전할 때만 가치가 있다"
 * - Claude Code Implementation
 *
 * Purpose:
 * - Monitor optimization impact in real-time
 * - Auto-rollback on performance degradation
 * - Enforce cooldown periods
 * - Track optimization stability
 *
 * Architecture:
 * Auto-Optimizer → **Safety Controller** → Monitor → Rollback/Approve → 99%+ Stability
 *
 * Safety Rules:
 * 1. Rollback if Δlatency > 10%
 * 2. Rollback if error rate > 5%
 * 3. Enforce 24h cooldown between updates
 * 4. Require validation window (5 minutes)
 *
 * Expected Gain: Optimizer Stability +1%p (98% → 99%+), Rollback success 100%
 *
 * @see RFC 2025-18: Phase 3.6 Hardening Strategy
 */

import type {
  OptimizationAction,
  OptimizationResult,
} from './auto-optimizer';

/**
 * Performance Baseline
 */
export interface PerformanceBaseline {
  latency: number; // ms
  errorRate: number; // 0-1
  throughput: number; // requests/second
  timestamp: Date;
}

/**
 * Safety Result
 */
export interface SafetyResult {
  status: 'success' | 'rollback' | 'monitoring';
  reason?: string;
  baseline: PerformanceBaseline;
  current: PerformanceBaseline;
  action: OptimizationAction;
  validationDuration?: number; // ms
}

/**
 * Risk Metric
 */
export interface RiskMetric {
  timestamp: Date;
  latency: number;
  errorRate: number;
  throughput: number;
  anomaly?: Anomaly;
}

/**
 * Anomaly
 */
export interface Anomaly {
  type: 'latency-spike' | 'error-spike' | 'throughput-drop';
  severity: 'high' | 'medium' | 'low';
  value: number;
  baseline: number;
}

/**
 * Risk Assessment
 */
export interface RiskAssessment {
  risk: 'high' | 'medium' | 'low';
  anomaly?: Anomaly;
  recommendation?: string;
  metrics: RiskMetric[];
  stable?: boolean;
}

/**
 * Safety Controller Config
 */
export interface SafetyControllerConfig {
  // Rollback thresholds
  maxLatencyDelta: number; // Default: 0.10 (10%)
  maxErrorDelta: number; // Default: 0.05 (5%)
  maxAbsoluteError: number; // Default: 0.01 (1%)

  // Monitoring
  validationWindow: number; // ms, Default: 300000 (5 min)
  monitoringInterval: number; // ms, Default: 10000 (10 sec)

  // Cooldown
  cooldownPeriod: number; // ms, Default: 86400000 (24h)

  // Rollback
  enableAutoRollback: boolean; // Default: true
  rollbackTimeout: number; // ms, Default: 30000 (30 sec)
}

/**
 * Optimizer Safety Controller
 *
 * Ensures safe optimization with automatic rollback
 */
export class OptimizerSafetyController {
  private config: SafetyControllerConfig;
  private cooldownManager: BanditCooldownManager;
  private riskMonitor: RiskLevelMonitor;
  private safetyHistory: SafetyResult[] = [];

  constructor(config?: Partial<SafetyControllerConfig>) {
    this.config = {
      maxLatencyDelta: config?.maxLatencyDelta ?? 0.10, // 10%
      maxErrorDelta: config?.maxErrorDelta ?? 0.05, // 5%
      maxAbsoluteError: config?.maxAbsoluteError ?? 0.01, // 1%
      validationWindow: config?.validationWindow ?? 300000, // 5 min
      monitoringInterval: config?.monitoringInterval ?? 10000, // 10 sec
      cooldownPeriod: config?.cooldownPeriod ?? 86400000, // 24h
      enableAutoRollback: config?.enableAutoRollback ?? true,
      rollbackTimeout: config?.rollbackTimeout ?? 30000, // 30 sec
    };

    this.cooldownManager = new BanditCooldownManager(this.config.cooldownPeriod);
    this.riskMonitor = new RiskLevelMonitor(
      this.config.validationWindow,
      this.config.monitoringInterval
    );
  }

  /**
   * Monitor optimization and trigger rollback if needed
   *
   * Main entry point
   */
  async monitorAndRollback(
    action: OptimizationAction,
    baseline: PerformanceBaseline
  ): Promise<SafetyResult> {
    // Check cooldown
    if (!this.cooldownManager.canUpdate(action.target.layer)) {
      const remaining = this.cooldownManager.getRemainingCooldown(
        action.target.layer
      );

      return {
        status: 'rollback',
        reason: `Cooldown period active (${Math.floor(remaining / 1000 / 60)} minutes remaining)`,
        baseline,
        current: baseline,
        action,
      };
    }

    // Execute action
    await this.executeAction(action);

    // Start risk monitoring
    const riskAssessment = await this.riskMonitor.monitorRisk(action);

    // Check for anomalies during monitoring
    if (riskAssessment.anomaly) {
      if (this.config.enableAutoRollback) {
        await this.rollbackAction(action);
      }

      return {
        status: 'rollback',
        reason: `Anomaly detected: ${riskAssessment.anomaly.type}`,
        baseline,
        current: await this.measurePerformance(),
        action,
        validationDuration: this.config.validationWindow,
      };
    }

    // Measure final performance
    const current = await this.measurePerformance();

    // Calculate deltas
    const latencyDelta = (current.latency - baseline.latency) / baseline.latency;
    const errorDelta = current.errorRate - baseline.errorRate;

    // Check thresholds
    const shouldRollback = this.shouldRollback(
      latencyDelta,
      errorDelta,
      current.errorRate
    );

    if (shouldRollback) {
      if (this.config.enableAutoRollback) {
        await this.rollbackAction(action);
      }

      const result: SafetyResult = {
        status: 'rollback',
        reason: this.formatRollbackReason(latencyDelta, errorDelta, current.errorRate),
        baseline,
        current,
        action,
        validationDuration: this.config.validationWindow,
      };

      this.safetyHistory.push(result);

      return result;
    }

    // Success - record cooldown
    this.cooldownManager.recordUpdate(action.target.layer);

    const result: SafetyResult = {
      status: 'success',
      baseline,
      current,
      action,
      validationDuration: this.config.validationWindow,
    };

    this.safetyHistory.push(result);

    return result;
  }

  /**
   * Check if rollback should be triggered
   */
  private shouldRollback(
    latencyDelta: number,
    errorDelta: number,
    absoluteError: number
  ): boolean {
    return (
      latencyDelta > this.config.maxLatencyDelta ||
      errorDelta > this.config.maxErrorDelta ||
      absoluteError > this.config.maxAbsoluteError
    );
  }

  /**
   * Format rollback reason
   */
  private formatRollbackReason(
    latencyDelta: number,
    errorDelta: number,
    absoluteError: number
  ): string {
    const reasons: string[] = [];

    if (latencyDelta > this.config.maxLatencyDelta) {
      reasons.push(
        `Latency increased by ${(latencyDelta * 100).toFixed(1)}% (threshold: ${this.config.maxLatencyDelta * 100}%)`
      );
    }

    if (errorDelta > this.config.maxErrorDelta) {
      reasons.push(
        `Error rate increased by ${(errorDelta * 100).toFixed(1)}% (threshold: ${this.config.maxErrorDelta * 100}%)`
      );
    }

    if (absoluteError > this.config.maxAbsoluteError) {
      reasons.push(
        `Error rate ${(absoluteError * 100).toFixed(2)}% exceeds threshold (${this.config.maxAbsoluteError * 100}%)`
      );
    }

    return reasons.join('; ');
  }

  /**
   * Execute optimization action
   */
  private async executeAction(action: OptimizationAction): Promise<void> {
    // Simulate execution
    // In production: Actually modify configuration/parameters

    console.log(
      `[SafetyController] Executing action: ${action.description}`
    );

    // Simulate async execution
    await this.wait(100);

    // Success (in production: verify execution)
  }

  /**
   * Rollback optimization action
   */
  private async rollbackAction(action: OptimizationAction): Promise<void> {
    console.log(
      `[SafetyController] Rolling back action: ${action.description}`
    );

    // Simulate rollback
    await this.wait(50);

    // In production: Restore previous configuration
  }

  /**
   * Measure current performance
   */
  private async measurePerformance(): Promise<PerformanceBaseline> {
    // Simulate measurement
    // In production: Collect real metrics

    return {
      latency: 100 + Math.random() * 50, // 100-150ms
      errorRate: Math.random() * 0.005, // 0-0.5%
      throughput: 50 + Math.random() * 20, // 50-70 req/s
      timestamp: new Date(),
    };
  }

  /**
   * Wait helper
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get configuration
   */
  getConfig(): SafetyControllerConfig {
    return { ...this.config };
  }

  /**
   * Get safety history
   */
  getHistory(): SafetyResult[] {
    return [...this.safetyHistory];
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalActions: number;
    successCount: number;
    rollbackCount: number;
    successRate: number;
    avgValidationDuration: number;
  } {
    const totalActions = this.safetyHistory.length;
    const successCount = this.safetyHistory.filter(
      (r) => r.status === 'success'
    ).length;
    const rollbackCount = this.safetyHistory.filter(
      (r) => r.status === 'rollback'
    ).length;

    const successRate = totalActions > 0 ? successCount / totalActions : 0;

    const avgValidationDuration =
      this.safetyHistory.reduce((sum, r) => sum + (r.validationDuration || 0), 0) /
      (totalActions || 1);

    return {
      totalActions,
      successCount,
      rollbackCount,
      successRate,
      avgValidationDuration,
    };
  }
}

/**
 * Bandit Cooldown Manager
 *
 * Enforces cooldown periods between updates
 */
export class BanditCooldownManager {
  private lastUpdates = new Map<string, Date>();
  private cooldownMs: number;

  constructor(cooldownMs: number = 86400000) {
    // 24h default
    this.cooldownMs = cooldownMs;
  }

  /**
   * Check if operator can be updated
   */
  canUpdate(operatorId: string): boolean {
    const lastUpdate = this.lastUpdates.get(operatorId);

    if (!lastUpdate) return true;

    const elapsed = Date.now() - lastUpdate.getTime();
    return elapsed >= this.cooldownMs;
  }

  /**
   * Record update and start cooldown
   */
  recordUpdate(operatorId: string): void {
    this.lastUpdates.set(operatorId, new Date());
  }

  /**
   * Get remaining cooldown time
   */
  getRemainingCooldown(operatorId: string): number {
    const lastUpdate = this.lastUpdates.get(operatorId);

    if (!lastUpdate) return 0;

    const elapsed = Date.now() - lastUpdate.getTime();
    return Math.max(0, this.cooldownMs - elapsed);
  }

  /**
   * Get all cooldowns
   */
  getAllCooldowns(): Map<string, number> {
    const cooldowns = new Map<string, number>();

    this.lastUpdates.forEach((lastUpdate, operatorId) => {
      const remaining = this.getRemainingCooldown(operatorId);
      cooldowns.set(operatorId, remaining);
    });

    return cooldowns;
  }

  /**
   * Reset cooldown for operator
   */
  resetCooldown(operatorId: string): void {
    this.lastUpdates.delete(operatorId);
  }

  /**
   * Reset all cooldowns
   */
  resetAllCooldowns(): void {
    this.lastUpdates.clear();
  }
}

/**
 * Risk Level Monitor
 *
 * Monitors optimization risk in real-time
 */
export class RiskLevelMonitor {
  private validationWindow: number;
  private monitoringInterval: number;

  constructor(
    validationWindow: number = 300000,
    monitoringInterval: number = 10000
  ) {
    this.validationWindow = validationWindow;
    this.monitoringInterval = monitoringInterval;
  }

  /**
   * Monitor risk during validation window
   */
  async monitorRisk(action: OptimizationAction): Promise<RiskAssessment> {
    const metrics: RiskMetric[] = [];

    const startTime = Date.now();
    while (Date.now() - startTime < this.validationWindow) {
      // Collect metrics
      await this.wait(this.monitoringInterval);

      const metric = await this.collectMetric();
      metrics.push(metric);

      // Check for anomalies
      const anomaly = this.detectAnomaly(metrics);
      if (anomaly) {
        return {
          risk: 'high',
          anomaly,
          recommendation: 'Immediate rollback recommended',
          metrics,
        };
      }
    }

    // Calculate overall risk
    const risk = this.assessOverallRisk(metrics);

    return {
      risk,
      metrics,
      stable: true,
    };
  }

  /**
   * Collect performance metric
   */
  private async collectMetric(): Promise<RiskMetric> {
    // Simulate metric collection
    // In production: Collect from actual system

    return {
      timestamp: new Date(),
      latency: 100 + Math.random() * 50, // 100-150ms
      errorRate: Math.random() * 0.005, // 0-0.5%
      throughput: 50 + Math.random() * 20, // 50-70 req/s
    };
  }

  /**
   * Detect anomalies in metrics
   */
  private detectAnomaly(metrics: RiskMetric[]): Anomaly | null {
    // Need at least 3 data points
    if (metrics.length < 3) return null;

    // Calculate baseline from earlier metrics
    const baselineMetrics = metrics.slice(0, Math.max(1, metrics.length - 3));
    const recentMetrics = metrics.slice(-3);

    // Calculate averages
    const baselineLatency =
      baselineMetrics.reduce((sum, m) => sum + m.latency, 0) /
      baselineMetrics.length;
    const recentLatency =
      recentMetrics.reduce((sum, m) => sum + m.latency, 0) /
      recentMetrics.length;

    const baselineError =
      baselineMetrics.reduce((sum, m) => sum + m.errorRate, 0) /
      baselineMetrics.length;
    const recentError =
      recentMetrics.reduce((sum, m) => sum + m.errorRate, 0) /
      recentMetrics.length;

    const baselineThroughput =
      baselineMetrics.reduce((sum, m) => sum + m.throughput, 0) /
      baselineMetrics.length;
    const recentThroughput =
      recentMetrics.reduce((sum, m) => sum + m.throughput, 0) /
      recentMetrics.length;

    // Detect latency spike: > 50% increase
    if (recentLatency > baselineLatency * 1.5) {
      return {
        type: 'latency-spike',
        severity: 'high',
        value: recentLatency,
        baseline: baselineLatency,
      };
    }

    // Detect error spike: > 100% increase
    if (recentError > baselineError * 2.0) {
      return {
        type: 'error-spike',
        severity: 'high',
        value: recentError,
        baseline: baselineError,
      };
    }

    // Detect throughput drop: > 30% decrease
    if (recentThroughput < baselineThroughput * 0.7) {
      return {
        type: 'throughput-drop',
        severity: 'medium',
        value: recentThroughput,
        baseline: baselineThroughput,
      };
    }

    return null;
  }

  /**
   * Assess overall risk from metrics
   */
  private assessOverallRisk(
    metrics: RiskMetric[]
  ): 'high' | 'medium' | 'low' {
    if (metrics.length === 0) return 'low';

    // Calculate variance
    const latencies = metrics.map((m) => m.latency);
    const latencyVariance = this.calculateVariance(latencies);

    const errors = metrics.map((m) => m.errorRate);
    const errorVariance = this.calculateVariance(errors);

    // High variance indicates instability
    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const latencyCV = Math.sqrt(latencyVariance) / avgLatency; // Coefficient of variation

    if (latencyCV > 0.3) return 'high'; // > 30% CV
    if (latencyCV > 0.15) return 'medium'; // > 15% CV

    // Check error rate
    const maxError = Math.max(...errors);
    if (maxError > 0.01) return 'high'; // > 1%
    if (maxError > 0.005) return 'medium'; // > 0.5%

    return 'low';
  }

  /**
   * Calculate variance
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((sum, d) => sum + d, 0) / values.length;
  }

  /**
   * Wait helper
   */
  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Default singleton instance
 */
export const optimizerSafetyController = new OptimizerSafetyController();
