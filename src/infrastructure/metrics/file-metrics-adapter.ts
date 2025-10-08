/**
 * File Metrics Adapter
 *
 * Implementation of MetricsPortV1 using file-based storage.
 * Infrastructure layer - adapts Port interface to concrete implementation.
 *
 * Phase 2B Step 2: Metrics Refactoring (Port/Adapter Pattern)
 */

import { promises as fs } from "fs";
import { join } from "path";
import type {
  MetricsPortV1,
  QualityMetrics,
  DiversityMetrics,
  AdvancedQualityMetrics,
  MetricsReport,
} from "../../domain/ports/metrics-port.js";
import type { Logger } from "../../shared/logger.js";

/**
 * File Metrics Adapter Configuration
 */
export interface FileMetricsAdapterConfig {
  storagePath: string; // Directory for metrics storage
  enableCaching?: boolean; // Enable in-memory caching
  cacheTTLMs?: number; // Cache TTL in milliseconds
}

/**
 * File Metrics Adapter
 *
 * Stores metrics in JSON files on disk.
 * Implements MetricsPortV1 interface.
 */
export class FileMetricsAdapter implements MetricsPortV1 {
  private readonly config: FileMetricsAdapterConfig;
  private readonly logger: Logger;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();

  constructor(logger: Logger, config: FileMetricsAdapterConfig) {
    this.logger = logger;
    this.config = {
      enableCaching: false,
      cacheTTLMs: 5 * 60 * 1000, // Default: 5 minutes
      ...config,
    };
  }

  /**
   * Record quality metrics
   */
  async recordQualityMetrics(metrics: QualityMetrics): Promise<void> {
    const filePath = join(this.config.storagePath, "quality-metrics.json");

    try {
      await this.ensureDirectory();
      await fs.writeFile(
        filePath,
        JSON.stringify(metrics, this.mapReplacer, 2),
      );

      this.logger.info("Quality metrics recorded", {
        entityCoverage: metrics.entityCoverage,
        evidenceAlignment: metrics.evidenceAlignment,
        totalSamples: metrics.totalSamples,
      });

      // Clear cache
      if (this.config.enableCaching) {
        this.cache.delete("current-report");
      }
    } catch (error) {
      this.logger.error("Failed to record quality metrics", { error });
      throw new Error(`Failed to record quality metrics: ${error}`);
    }
  }

  /**
   * Record diversity metrics
   */
  async recordDiversityMetrics(metrics: DiversityMetrics): Promise<void> {
    const filePath = join(this.config.storagePath, "diversity-metrics.json");

    try {
      await this.ensureDirectory();
      await fs.writeFile(filePath, JSON.stringify(metrics, null, 2));

      this.logger.info("Diversity metrics recorded", {
        entityCoverageRatio: metrics.entityCoverageRatio,
        questionTypeBalance: metrics.questionTypeBalance,
        meetsTarget: metrics.meetsTarget,
      });

      // Clear cache
      if (this.config.enableCaching) {
        this.cache.delete("current-report");
      }

      // Emit governance event
      this.emitGovernanceEvent("diversity_metrics_updated", metrics);
    } catch (error) {
      this.logger.error("Failed to record diversity metrics", { error });
      throw new Error(`Failed to record diversity metrics: ${error}`);
    }
  }

  /**
   * Record advanced quality metrics
   */
  async recordAdvancedQualityMetrics(
    metrics: AdvancedQualityMetrics,
  ): Promise<void> {
    const filePath = join(
      this.config.storagePath,
      "advanced-quality-metrics.json",
    );

    try {
      await this.ensureDirectory();
      await fs.writeFile(filePath, JSON.stringify(metrics, null, 2));

      this.logger.info("Advanced quality metrics recorded", {
        activeCheckers: metrics.activeCheckers,
        costPerQA: metrics.costPerQA,
        latencyMs: metrics.latencyMs,
      });

      // Clear cache
      if (this.config.enableCaching) {
        this.cache.delete("current-report");
      }

      // Emit governance event
      this.emitGovernanceEvent("advanced_quality_metrics_updated", metrics);
    } catch (error) {
      this.logger.error("Failed to record advanced quality metrics", { error });
      throw new Error(`Failed to record advanced quality metrics: ${error}`);
    }
  }

  /**
   * Get current metrics report
   */
  async getCurrentReport(): Promise<MetricsReport> {
    // Check cache
    if (this.config.enableCaching) {
      const cached = this.getFromCache<MetricsReport>("current-report");
      if (cached) {
        return cached;
      }
    }

    try {
      const [quality, diversity, advanced] = await Promise.all([
        this.readQualityMetrics(),
        this.readDiversityMetrics(),
        this.readAdvancedQualityMetrics(),
      ]);

      const report: MetricsReport = {
        quality,
        diversity,
        advanced,
        timestamp: new Date(),
      };

      // Cache result
      if (this.config.enableCaching) {
        this.setCache("current-report", report);
      }

      return report;
    } catch (error) {
      this.logger.error("Failed to get current report", { error });
      throw new Error(`Failed to get current report: ${error}`);
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
    const historyPath = join(this.config.storagePath, "history");

    try {
      // Check if history directory exists
      try {
        await fs.access(historyPath);
      } catch {
        return []; // No history yet
      }

      const files = await fs.readdir(historyPath);
      const reportFiles = files
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse(); // Most recent first

      const reports: MetricsReport[] = [];

      for (const file of reportFiles) {
        if (options.limit && reports.length >= options.limit) {
          break;
        }

        const filePath = join(historyPath, file);
        const content = await fs.readFile(filePath, "utf-8");
        const report = JSON.parse(content, this.mapReviver) as MetricsReport;

        // Filter by date if specified
        const reportDate = new Date(report.timestamp);
        if (options.startDate && reportDate < options.startDate) continue;
        if (options.endDate && reportDate > options.endDate) continue;

        reports.push(report);
      }

      return reports;
    } catch (error) {
      this.logger.error("Failed to get historical metrics", { error });
      return [];
    }
  }

  /**
   * Get baseline metrics
   */
  async getBaselineMetrics(tag: string): Promise<MetricsReport | null> {
    const baselinePath = join(
      this.config.storagePath,
      "baselines",
      `${tag}.json`,
    );

    try {
      const content = await fs.readFile(baselinePath, "utf-8");
      return JSON.parse(content, this.mapReviver) as MetricsReport;
    } catch (error) {
      this.logger.warn(`Baseline not found: ${tag}`, { error });
      return null;
    }
  }

  /**
   * Clear metrics (for testing)
   */
  async clear(): Promise<void> {
    try {
      await fs.rm(this.config.storagePath, { recursive: true, force: true });
      this.cache.clear();
      this.logger.info("Metrics cleared");
    } catch (error) {
      this.logger.error("Failed to clear metrics", { error });
      throw new Error(`Failed to clear metrics: ${error}`);
    }
  }

  /**
   * Read quality metrics from file
   */
  private async readQualityMetrics(): Promise<QualityMetrics> {
    const filePath = join(this.config.storagePath, "quality-metrics.json");

    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content, this.mapReviver) as QualityMetrics;
    } catch {
      // Return default if file doesn't exist
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
  }

  /**
   * Read diversity metrics from file
   */
  private async readDiversityMetrics(): Promise<DiversityMetrics> {
    const filePath = join(this.config.storagePath, "diversity-metrics.json");

    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as DiversityMetrics;
    } catch {
      // Return default if file doesn't exist
      return {
        entityCoverageRatio: 0,
        questionTypeBalance: 0,
        evidenceSourceDiversity: 0,
        meetsTarget: false,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Read advanced quality metrics from file
   */
  private async readAdvancedQualityMetrics(): Promise<
    AdvancedQualityMetrics | undefined
  > {
    const filePath = join(
      this.config.storagePath,
      "advanced-quality-metrics.json",
    );

    try {
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content) as AdvancedQualityMetrics;
    } catch {
      // Return undefined if file doesn't exist (advanced metrics optional)
      return undefined;
    }
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.storagePath, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
    }
  }

  /**
   * Emit governance event
   */
  private emitGovernanceEvent(eventType: string, data: unknown): void {
    // TODO: Integrate with actual governance event bus
    this.logger.info(`Governance event: ${eventType}`, data);
  }

  /**
   * Get from cache
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const ttl = this.config.cacheTTLMs || 5 * 60 * 1000;

    if (now - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cache
   */
  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * JSON replacer for Map serialization
   */
  private mapReplacer(_key: string, value: unknown): unknown {
    if (value instanceof Map) {
      return {
        __type: "Map",
        value: Array.from(value.entries()),
      };
    }
    return value;
  }

  /**
   * JSON reviver for Map deserialization
   */
  private mapReviver(_key: string, value: unknown): unknown {
    if (
      typeof value === "object" &&
      value !== null &&
      "__type" in value &&
      value.__type === "Map" &&
      "value" in value
    ) {
      return new Map(value.value as [string, number][]);
    }
    return value;
  }
}
