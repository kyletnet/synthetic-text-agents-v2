/**
 * Metrics Service (Application Layer)
 *
 * Orchestrates metrics collection and reporting.
 * Uses MetricsPortV1 for storage abstraction.
 *
 * Phase 2B Step 2: Metrics Refactoring (Port/Adapter Pattern)
 *
 * Architecture:
 * - Application Layer (this file)
 * - Domain Layer (MetricsPortV1 interface)
 * - Infrastructure Layer (FileMetricsAdapter)
 */

import type { Logger } from "../../shared/logger.js";
import type {
  MetricsPortV1,
  QualityMetrics,
  DiversityMetrics,
  AdvancedQualityMetrics,
  MetricsReport,
} from "../../domain/ports/metrics-port.js";

/**
 * Metrics Service Configuration
 */
export interface MetricsServiceConfig {
  enableFallback?: boolean; // Enable fallback to in-memory storage
  enablePerformanceMonitoring?: boolean; // Monitor metrics recording performance
  performanceThresholdMs?: number; // Alert if metrics recording takes too long
}

/**
 * Metrics Service
 *
 * Coordinates metrics collection and storage.
 * Provides fallback mechanism if storage fails.
 */
export class MetricsService {
  private readonly logger: Logger;
  private readonly metricsPort: MetricsPortV1;
  private readonly config: MetricsServiceConfig;
  private fallbackStorage: Map<string, unknown> = new Map();

  constructor(
    logger: Logger,
    metricsPort: MetricsPortV1,
    config: MetricsServiceConfig = {},
  ) {
    this.logger = logger;
    this.metricsPort = metricsPort;
    this.config = {
      enableFallback: true,
      enablePerformanceMonitoring: true,
      performanceThresholdMs: 1000, // 1 second
      ...config,
    };
  }

  /**
   * Record quality metrics
   */
  async recordQualityMetrics(metrics: QualityMetrics): Promise<void> {
    const startTime = Date.now();

    try {
      await this.metricsPort.recordQualityMetrics(metrics);

      this.monitorPerformance("recordQualityMetrics", startTime);
    } catch (error) {
      this.logger.error("Failed to record quality metrics via port", { error });

      if (this.config.enableFallback) {
        this.logger.warn("Using fallback storage for quality metrics");
        this.fallbackStorage.set("quality-metrics", metrics);
      } else {
        throw error;
      }
    }
  }

  /**
   * Record diversity metrics
   */
  async recordDiversityMetrics(metrics: DiversityMetrics): Promise<void> {
    const startTime = Date.now();

    try {
      await this.metricsPort.recordDiversityMetrics(metrics);

      this.monitorPerformance("recordDiversityMetrics", startTime);

      // Log to governance
      this.logToGovernance("diversity_metrics_recorded", {
        entityCoverageRatio: metrics.entityCoverageRatio,
        questionTypeBalance: metrics.questionTypeBalance,
        meetsTarget: metrics.meetsTarget,
      });
    } catch (error) {
      this.logger.error("Failed to record diversity metrics via port", { error });

      if (this.config.enableFallback) {
        this.logger.warn("Using fallback storage for diversity metrics");
        this.fallbackStorage.set("diversity-metrics", metrics);
      } else {
        throw error;
      }
    }
  }

  /**
   * Record advanced quality metrics
   */
  async recordAdvancedQualityMetrics(
    metrics: AdvancedQualityMetrics,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      await this.metricsPort.recordAdvancedQualityMetrics(metrics);

      this.monitorPerformance("recordAdvancedQualityMetrics", startTime);

      // Log to governance with cost/latency alerts
      this.logToGovernance("advanced_quality_metrics_recorded", {
        activeCheckers: metrics.activeCheckers,
        costPerQA: metrics.costPerQA,
        latencyMs: metrics.latencyMs,
        errorRate: metrics.errorRate,
      });

      // Alert if cost exceeds threshold
      if (metrics.costPerQA > 0.005) {
        this.logger.warn("Advanced quality cost exceeds threshold", {
          costPerQA: metrics.costPerQA,
          threshold: 0.005,
        });
      }

      // Alert if latency exceeds threshold
      if (metrics.latencyMs > 500) {
        this.logger.warn("Advanced quality latency exceeds threshold", {
          latencyMs: metrics.latencyMs,
          threshold: 500,
        });
      }
    } catch (error) {
      this.logger.error(
        "Failed to record advanced quality metrics via port",
        { error },
      );

      if (this.config.enableFallback) {
        this.logger.warn("Using fallback storage for advanced quality metrics");
        this.fallbackStorage.set("advanced-quality-metrics", metrics);
      } else {
        throw error;
      }
    }
  }

  /**
   * Get current metrics report
   */
  async getCurrentReport(): Promise<MetricsReport> {
    try {
      return await this.metricsPort.getCurrentReport();
    } catch (error) {
      this.logger.error("Failed to get current report via port", { error });

      if (this.config.enableFallback) {
        this.logger.warn("Using fallback storage for current report");
        return this.getFallbackReport();
      }

      throw error;
    }
  }

  /**
   * Get historical metrics
   */
  async getHistoricalMetrics(options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<MetricsReport[]> {
    try {
      return await this.metricsPort.getHistoricalMetrics(options);
    } catch (error) {
      this.logger.error("Failed to get historical metrics via port", { error });
      return [];
    }
  }

  /**
   * Get baseline metrics for comparison
   */
  async getBaselineMetrics(tag: string): Promise<MetricsReport | null> {
    try {
      return await this.metricsPort.getBaselineMetrics(tag);
    } catch (error) {
      this.logger.error(`Failed to get baseline metrics: ${tag}`, { error });
      return null;
    }
  }

  /**
   * Compare current metrics with baseline
   */
  async compareWithBaseline(tag: string): Promise<{
    improved: boolean;
    degraded: boolean;
    changes: Record<string, number>;
  }> {
    const [current, baseline] = await Promise.all([
      this.getCurrentReport(),
      this.getBaselineMetrics(tag),
    ]);

    if (!baseline) {
      this.logger.warn(`Baseline not found: ${tag}`);
      return {
        improved: false,
        degraded: false,
        changes: {},
      };
    }

    // Calculate changes
    const changes: Record<string, number> = {
      entityCoverage:
        current.quality.entityCoverage - baseline.quality.entityCoverage,
      evidenceAlignment:
        current.quality.evidenceAlignment - baseline.quality.evidenceAlignment,
      entityCoverageRatio:
        current.diversity.entityCoverageRatio -
        baseline.diversity.entityCoverageRatio,
      questionTypeBalance:
        current.diversity.questionTypeBalance -
        baseline.diversity.questionTypeBalance,
    };

    // Determine if improved or degraded
    const improved = Object.values(changes).some((change) => change > 0.05); // >5% improvement
    const degraded = Object.values(changes).some((change) => change < -0.05); // >5% degradation

    return {
      improved,
      degraded,
      changes,
    };
  }

  /**
   * Clear metrics (for testing)
   */
  async clear(): Promise<void> {
    try {
      await this.metricsPort.clear();
      this.fallbackStorage.clear();
    } catch (error) {
      this.logger.error("Failed to clear metrics", { error });
      throw error;
    }
  }

  /**
   * Get fallback report from in-memory storage
   */
  private getFallbackReport(): MetricsReport {
    const quality = (this.fallbackStorage.get("quality-metrics") ||
      this.getDefaultQualityMetrics()) as QualityMetrics;

    const diversity = (this.fallbackStorage.get("diversity-metrics") ||
      this.getDefaultDiversityMetrics()) as DiversityMetrics;

    const advanced = this.fallbackStorage.get(
      "advanced-quality-metrics",
    ) as AdvancedQualityMetrics | undefined;

    return {
      quality,
      diversity,
      advanced,
      timestamp: new Date(),
    };
  }

  /**
   * Get default quality metrics
   */
  private getDefaultQualityMetrics(): QualityMetrics {
    return {
      entityCoverage: 0,
      questionTypeDistribution: new Map(),
      evidenceAlignment: 0,
      evidenceSourceCounts: new Map(),
      naturalness: 0,
      coherence: 0,
      totalSamples: 0,
      timestamp: new Date(),
    };
  }

  /**
   * Get default diversity metrics
   */
  private getDefaultDiversityMetrics(): DiversityMetrics {
    return {
      entityCoverageRatio: 0,
      questionTypeBalance: 0,
      evidenceSourceDiversity: 0,
      meetsTarget: false,
      timestamp: new Date(),
    };
  }

  /**
   * Monitor performance of metrics recording
   */
  private monitorPerformance(operation: string, startTime: number): void {
    if (!this.config.enablePerformanceMonitoring) return;

    const duration = Date.now() - startTime;
    const threshold = this.config.performanceThresholdMs || 1000;

    if (duration > threshold) {
      this.logger.warn(`Metrics operation slow: ${operation}`, {
        durationMs: duration,
        thresholdMs: threshold,
      });

      // Log to governance for performance degradation tracking
      this.logToGovernance("metrics_performance_degraded", {
        operation,
        durationMs: duration,
        thresholdMs: threshold,
      });
    }
  }

  /**
   * Log event to governance ledger
   */
  private logToGovernance(eventType: string, data: unknown): void {
    this.logger.info(`[Governance] ${eventType}`, data);

    // TODO: Integrate with actual governance event bus
    // For now, just log to logger which writes to governance.jsonl
  }
}
