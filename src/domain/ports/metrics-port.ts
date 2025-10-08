/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Metrics Port Interface (Version 1)
 *
 * Defines the contract between Domain/Application layers and Infrastructure layer.
 * Port/Adapter pattern ensures Domain logic is independent of metrics implementation.
 *
 * Phase 2B Step 2: Metrics Refactoring
 *
 * IMPORTANT: This interface is FROZEN (V1). Any changes require a new version (V2).
 * Adapters can evolve, but Port interface must remain stable.
 */

/**
 * Quality Metrics recorded by the system
 */
export interface QualityMetrics {
  // Entity extraction coverage
  entityCoverage: number; // 0-1, ratio of domain entities covered

  // Question type distribution
  questionTypeDistribution: Map<string, number>; // type -> count

  // Evidence quality
  evidenceAlignment: number; // 0-1, evidence-answer alignment score
  evidenceSourceCounts: Map<string, number>; // source -> count

  // Answer quality
  naturalness: number; // 0-1, answer naturalness score (optional)
  coherence: number; // 0-1, answer coherence score (optional)

  // Overall
  totalSamples: number;
  timestamp: Date;
}

/**
 * Diversity Metrics from Diversity Planner
 */
export interface DiversityMetrics {
  entityCoverageRatio: number; // current / target
  questionTypeBalance: number; // 0-1, balance score
  evidenceSourceDiversity: number; // 0-1, diversity score
  meetsTarget: boolean;
  timestamp: Date;
}

/**
 * Advanced Quality Metrics (from Advanced Checkers)
 */
export interface AdvancedQualityMetrics {
  // Multi-view embedding
  multiViewAlignment?: number; // 0-1, multi-view alignment improvement

  // Query-side embedding
  querySideAlignment?: number; // 0-1, query-side alignment improvement

  // Translation-based embedding
  translationNaturalness?: number; // 0-1, translation naturalness score

  // Hybrid search
  hybridSearchCoverage?: number; // 0-1, hybrid search coverage improvement

  // Ragas evaluation
  ragasOverallScore?: number; // 0-1, ragas overall quality score

  // Cost tracking
  costPerQA: number; // USD per QA pair
  totalCost: number; // USD total cost

  // Performance
  latencyMs: number; // milliseconds
  errorRate: number; // 0-1, error rate

  // Active checkers
  activeCheckers: string[];

  timestamp: Date;
}

/**
 * Aggregated Metrics Report
 */
export interface MetricsReport {
  quality: QualityMetrics;
  diversity: DiversityMetrics;
  advanced?: AdvancedQualityMetrics; // Optional - only if advanced checkers enabled
  timestamp: Date;
}

/**
 * Metrics Port V1
 *
 * Contract for recording and retrieving metrics.
 * Domain/Application layers depend on this interface.
 * Infrastructure layer implements adapters for this interface.
 */
export interface MetricsPortV1 {
  /**
   * Record quality metrics
   */
  recordQualityMetrics(metrics: QualityMetrics): Promise<void>;

  /**
   * Record diversity metrics (from Diversity Planner)
   */
  recordDiversityMetrics(metrics: DiversityMetrics): Promise<void>;

  /**
   * Record advanced quality metrics (from Advanced Checkers)
   */
  recordAdvancedQualityMetrics(metrics: AdvancedQualityMetrics): Promise<void>;

  /**
   * Get current metrics report
   */
  getCurrentReport(): Promise<MetricsReport>;

  /**
   * Get historical metrics (for trend analysis)
   */
  getHistoricalMetrics(options: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): Promise<MetricsReport[]>;

  /**
   * Get baseline metrics (for comparison)
   */
  getBaselineMetrics(tag: string): Promise<MetricsReport | null>;

  /**
   * Clear metrics (for testing)
   */
  clear(): Promise<void>;
}

/**
 * Metrics Adapter Factory
 *
 * Creates concrete implementations of MetricsPortV1.
 */
export interface MetricsAdapterFactory {
  /**
   * Create a metrics adapter
   *
   * @param config - Adapter configuration
   * @returns Concrete implementation of MetricsPortV1
   */
  createAdapter(config: MetricsAdapterConfig): MetricsPortV1;
}

/**
 * Metrics Adapter Configuration
 */
export interface MetricsAdapterConfig {
  // Adapter type (file, database, memory, etc.)
  type: "file" | "memory" | "database";

  // Storage path (for file adapter)
  storagePath?: string;

  // Database connection (for database adapter)
  databaseUrl?: string;

  // Feature flags
  enableAdvancedMetrics?: boolean;
  enableCaching?: boolean;
  cacheTTLMs?: number;
}

/**
 * Version information
 */
export const METRICS_PORT_VERSION = "1.0.0" as const;

/**
 * Port metadata
 */
export const METRICS_PORT_METADATA = Object.freeze({
  version: METRICS_PORT_VERSION,
  created: "2025-10-08",
  stability: "frozen", // Interface is frozen - no breaking changes allowed
  deprecation: null, // Not deprecated
  successor: null, // No successor version yet
});
