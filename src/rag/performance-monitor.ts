// RAG Performance Monitor - Cost tracking and performance analytics
// Integrates with existing Performance Guardian system

import { Logger } from "../shared/logger.js";

export interface RAGPerformanceMetrics {
  searchLatency: number;
  chunkingTime: number;
  embeddingTime?: number;
  totalTime: number;
  documentsProcessed: number;
  chunksRetrieved: number;
  apiCalls: number;
  tokensUsed: number;
  estimatedCost: number;
}

export interface CostBreakdown {
  embeddingCosts: number;
  searchCosts: number;
  storageCosts: number;
  totalCost: number;
  currency: string;
}

export interface PerformanceAlert {
  type: "cost_threshold" | "latency_threshold" | "error_rate";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  metrics: Record<string, number>;
  timestamp: Date;
}

/**
 * RAG Performance Monitor
 *
 * Tracks performance metrics, cost usage, and generates alerts
 * for RAG operations. Integrates with the system's Performance Guardian.
 */
export class RAGPerformanceMonitor {
  private logger: Logger;
  private metrics: RAGPerformanceMetrics[] = [];
  private totalCost: number = 0;
  private alertThresholds: {
    dailyCostLimit: number;
    averageLatencyLimit: number;
    errorRateLimit: number;
  };

  constructor(logger: Logger) {
    this.logger = logger;
    this.alertThresholds = {
      dailyCostLimit: parseFloat(process.env.RAG_DAILY_COST_LIMIT || "10.0"),
      averageLatencyLimit: parseFloat(process.env.RAG_LATENCY_LIMIT || "5000"),
      errorRateLimit: parseFloat(process.env.RAG_ERROR_RATE_LIMIT || "0.05"),
    };
  }

  async recordSearchOperation(
    searchLatency: number,
    chunksRetrieved: number,
    algorithm: "bm25" | "vector" = "bm25",
  ): Promise<void> {
    const metrics: RAGPerformanceMetrics = {
      searchLatency,
      chunkingTime: 0,
      totalTime: searchLatency,
      documentsProcessed: 0,
      chunksRetrieved,
      apiCalls: 0,
      tokensUsed: 0,
      estimatedCost: this.calculateSearchCost(chunksRetrieved, algorithm),
    };

    this.metrics.push(metrics);
    this.totalCost += metrics.estimatedCost;

    await this.logger.trace({
      level: "info",
      agentId: "rag-performance-monitor",
      action: "search_operation_recorded",
      data: {
        algorithm,
        latency: searchLatency,
        chunksRetrieved,
        estimatedCost: metrics.estimatedCost,
      },
    });

    await this.checkAlerts(metrics);
  }

  async recordChunkingOperation(
    chunkingTime: number,
    documentsProcessed: number,
    chunksCreated: number,
  ): Promise<void> {
    const metrics: RAGPerformanceMetrics = {
      searchLatency: 0,
      chunkingTime,
      totalTime: chunkingTime,
      documentsProcessed,
      chunksRetrieved: 0,
      apiCalls: 0,
      tokensUsed: 0,
      estimatedCost: this.calculateChunkingCost(documentsProcessed),
    };

    this.metrics.push(metrics);
    this.totalCost += metrics.estimatedCost;

    await this.logger.trace({
      level: "info",
      agentId: "rag-performance-monitor",
      action: "chunking_operation_recorded",
      data: {
        chunkingTime,
        documentsProcessed,
        chunksCreated,
        estimatedCost: metrics.estimatedCost,
      },
    });
  }

  async recordEmbeddingOperation(
    embeddingTime: number,
    chunksProcessed: number,
    tokensUsed: number,
    provider: string,
    model: string,
  ): Promise<void> {
    const apiCost = this.calculateEmbeddingCost(tokensUsed, provider, model);

    const metrics: RAGPerformanceMetrics = {
      searchLatency: 0,
      chunkingTime: 0,
      embeddingTime,
      totalTime: embeddingTime,
      documentsProcessed: 0,
      chunksRetrieved: chunksProcessed,
      apiCalls: 1,
      tokensUsed,
      estimatedCost: apiCost,
    };

    this.metrics.push(metrics);
    this.totalCost += metrics.estimatedCost;

    await this.logger.trace({
      level: "info",
      agentId: "rag-performance-monitor",
      action: "embedding_operation_recorded",
      data: {
        embeddingTime,
        chunksProcessed,
        tokensUsed,
        provider,
        model,
        estimatedCost: apiCost,
      },
    });

    await this.checkAlerts(metrics);
  }

  getDailyStats(): {
    operationsCount: number;
    totalCost: number;
    averageLatency: number;
    costBreakdown: CostBreakdown;
  } {
    const todayMetrics = this.metrics.filter((_m) => {
      // Note: This is simplified - in production, you'd want proper timestamp tracking
      return true; // For now, return all metrics
    });

    const totalLatency = todayMetrics.reduce((sum, m) => sum + m.totalTime, 0);
    const averageLatency =
      todayMetrics.length > 0 ? totalLatency / todayMetrics.length : 0;

    const embeddingCosts = todayMetrics
      .filter((m) => m.embeddingTime && m.embeddingTime > 0)
      .reduce((sum, m) => sum + m.estimatedCost, 0);

    const searchCosts = todayMetrics
      .filter((m) => m.searchLatency > 0)
      .reduce((sum, m) => sum + m.estimatedCost, 0);

    const chunkingCosts = todayMetrics
      .filter((m) => m.chunkingTime > 0)
      .reduce((sum, m) => sum + m.estimatedCost, 0);

    return {
      operationsCount: todayMetrics.length,
      totalCost: this.totalCost,
      averageLatency,
      costBreakdown: {
        embeddingCosts,
        searchCosts,
        storageCosts: chunkingCosts,
        totalCost: this.totalCost,
        currency: "USD",
      },
    };
  }

  getPerformanceReport(): {
    summary: ReturnType<RAGPerformanceMonitor["getDailyStats"]>;
    trends: {
      latencyTrend: "improving" | "stable" | "degrading";
      costTrend: "decreasing" | "stable" | "increasing";
    };
    recommendations: string[];
  } {
    const summary = this.getDailyStats();

    // Simple trend analysis (in production, you'd want more sophisticated analysis)
    const recentMetrics = this.metrics.slice(-10);
    const olderMetrics = this.metrics.slice(-20, -10);

    const recentAvgLatency =
      recentMetrics.reduce((sum, m) => sum + m.totalTime, 0) /
      Math.max(recentMetrics.length, 1);
    const olderAvgLatency =
      olderMetrics.reduce((sum, m) => sum + m.totalTime, 0) /
      Math.max(olderMetrics.length, 1);

    const latencyTrend =
      recentAvgLatency < olderAvgLatency * 0.9
        ? "improving"
        : recentAvgLatency > olderAvgLatency * 1.1
          ? "degrading"
          : "stable";

    const recentAvgCost =
      recentMetrics.reduce((sum, m) => sum + m.estimatedCost, 0) /
      Math.max(recentMetrics.length, 1);
    const olderAvgCost =
      olderMetrics.reduce((sum, m) => sum + m.estimatedCost, 0) /
      Math.max(olderMetrics.length, 1);

    const costTrend =
      recentAvgCost < olderAvgCost * 0.9
        ? "decreasing"
        : recentAvgCost > olderAvgCost * 1.1
          ? "increasing"
          : "stable";

    const recommendations: string[] = [];

    if (latencyTrend === "degrading") {
      recommendations.push(
        "Consider optimizing chunk sizes or implementing caching",
      );
    }

    if (costTrend === "increasing") {
      recommendations.push(
        "Review embedding usage and consider local alternatives",
      );
    }

    if (summary.averageLatency > this.alertThresholds.averageLatencyLimit) {
      recommendations.push(
        "Average latency exceeds threshold - investigate performance bottlenecks",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "RAG system is performing within expected parameters",
      );
    }

    return {
      summary,
      trends: { latencyTrend, costTrend },
      recommendations,
    };
  }

  private async checkAlerts(metrics: RAGPerformanceMetrics): Promise<void> {
    const alerts: PerformanceAlert[] = [];

    // Cost threshold alert
    if (this.totalCost > this.alertThresholds.dailyCostLimit) {
      alerts.push({
        type: "cost_threshold",
        severity: "high",
        message: `Daily cost limit exceeded: $${this.totalCost.toFixed(2)} > $${this.alertThresholds.dailyCostLimit}`,
        metrics: {
          totalCost: this.totalCost,
          limit: this.alertThresholds.dailyCostLimit,
        },
        timestamp: new Date(),
      });
    }

    // Latency threshold alert
    if (metrics.totalTime > this.alertThresholds.averageLatencyLimit) {
      alerts.push({
        type: "latency_threshold",
        severity: "medium",
        message: `Operation latency exceeded threshold: ${metrics.totalTime}ms > ${this.alertThresholds.averageLatencyLimit}ms`,
        metrics: {
          latency: metrics.totalTime,
          limit: this.alertThresholds.averageLatencyLimit,
        },
        timestamp: new Date(),
      });
    }

    // Log alerts
    for (const alert of alerts) {
      await this.logger.trace({
        level: alert.severity === "critical" ? "error" : "warn",
        agentId: "rag-performance-monitor",
        action: "performance_alert",
        data: {
          alertType: alert.type,
          severity: alert.severity,
          message: alert.message,
          metrics: alert.metrics,
        },
      });
    }
  }

  private calculateSearchCost(
    chunksRetrieved: number,
    algorithm: string,
  ): number {
    // BM25 search is essentially free (computation only)
    if (algorithm === "bm25") {
      return 0.0001 * chunksRetrieved; // Minimal compute cost
    }

    // Vector search would have embedding comparison costs
    return 0.001 * chunksRetrieved;
  }

  private calculateChunkingCost(documentsProcessed: number): number {
    // Chunking is computational only, minimal cost
    return 0.0001 * documentsProcessed;
  }

  private calculateEmbeddingCost(
    tokensUsed: number,
    provider: string,
    model: string,
  ): number {
    // OpenAI embedding pricing (approximate)
    if (provider === "openai") {
      if (model.includes("large")) {
        return tokensUsed * (0.00013 / 1000); // $0.00013 per 1K tokens
      } else {
        return tokensUsed * (0.00002 / 1000); // $0.00002 per 1K tokens
      }
    }

    // Local or mock providers
    return 0;
  }
}
