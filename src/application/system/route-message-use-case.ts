/**
 * Route Message Use Case
 *
 * Application service for message routing operations.
 * Orchestrates domain logic to route messages through optimal paths.
 */

import type { Logger } from "../../shared/logger.js";
import type {
  ComponentId,
  UnifiedMessage,
  SystemState,
} from "../../domain/system/system-status.js";
import {
  RoutingRules,
  type RoutingMode,
  type RoutingDecision,
} from "../../domain/system/integration-rules.js";

/**
 * Route message request
 */
export interface RouteMessageRequest {
  readonly message: UnifiedMessage;
  readonly hubHealthy: boolean;
  readonly directConnectionsAvailable: boolean;
}

/**
 * Route message response
 */
export interface RouteMessageResponse {
  readonly success: boolean;
  readonly routingDecision: RoutingDecision;
  readonly latency: number;
  readonly shouldEstablishDirectConnection: boolean;
  readonly requiresCoordination: boolean;
  readonly error?: string;
}

/**
 * Routing metrics
 */
export interface RoutingMetrics {
  readonly totalMessages: number;
  readonly modeDistribution: {
    readonly direct: number;
    readonly hub: number;
    readonly fallback: number;
  };
  readonly averageLatency: {
    readonly direct: number;
    readonly hub: number;
    readonly fallback: number;
  };
  readonly performanceBaseline: {
    readonly hubLatency: number;
    readonly directLatency: number;
  };
}

/**
 * Routing history entry
 */
export interface RoutingHistoryEntry {
  readonly timestamp: Date;
  readonly mode: RoutingMode;
  readonly reason: string;
  readonly latency: number;
  readonly messageId: string;
  readonly priority: string;
}

/**
 * Route Message Use Case
 *
 * Responsibilities:
 * - Determine optimal routing mode for messages
 * - Track routing metrics and performance
 * - Manage direct connection establishment
 * - Provide routing recommendations
 */
export class RouteMessageUseCase {
  private routingHistory: RoutingHistoryEntry[] = [];
  private metrics: RoutingMetrics = {
    totalMessages: 0,
    modeDistribution: { direct: 0, hub: 0, fallback: 0 },
    averageLatency: { direct: 0, hub: 0, fallback: 0 },
    performanceBaseline: { hubLatency: 100, directLatency: 40 },
  };

  constructor(private readonly logger: Logger) {}

  /**
   * Execute message routing
   */
  async execute(
    systemState: SystemState,
    request: RouteMessageRequest,
  ): Promise<RouteMessageResponse> {
    const startTime = performance.now();

    this.logger.debug("Routing message", {
      source: request.message.source,
      target: request.message.target,
      type: request.message.type,
      priority: request.message.priority,
    });

    try {
      // Determine routing mode using domain rules
      const routingDecision = RoutingRules.determineRoutingMode(
        request.message,
        systemState,
        request.hubHealthy,
        request.directConnectionsAvailable,
      );

      // Check if direct connection should be established
      const shouldEstablishDirectConnection =
        request.message.target !== "broadcast" &&
        RoutingRules.shouldEstablishDirectConnection(
          request.message.source,
          request.message.target as ComponentId,
          systemState.metrics.operationsPerHour,
          request.hubHealthy,
        );

      // Check if coordination is required
      const requiresCoordination = RoutingRules.requiresCoordination(
        request.message,
      );

      const latency = performance.now() - startTime;

      // Update metrics
      this.updateMetrics(routingDecision.mode, latency);

      // Record routing history
      this.recordHistory(request.message, routingDecision, latency);

      this.logger.debug("Message routed successfully", {
        mode: routingDecision.mode,
        reason: routingDecision.reason,
        latency: latency.toFixed(2),
      });

      return {
        success: true,
        routingDecision,
        latency,
        shouldEstablishDirectConnection,
        requiresCoordination,
      };
    } catch (error) {
      const latency = performance.now() - startTime;

      this.logger.error("Message routing failed", {
        error: error instanceof Error ? error.message : String(error),
        latency,
      });

      return {
        success: false,
        routingDecision: {
          mode: "fallback",
          reason: "Routing error - using fallback",
          shouldRetry: true,
          maxRetries: 5,
        },
        latency,
        shouldEstablishDirectConnection: false,
        requiresCoordination: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get routing metrics
   */
  getMetrics(): RoutingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get routing history (last N entries)
   */
  getHistory(limit: number = 100): readonly RoutingHistoryEntry[] {
    return this.routingHistory.slice(-limit);
  }

  /**
   * Get routing status report
   */
  getRoutingStatus(): {
    currentMode: RoutingMode;
    metrics: RoutingMetrics;
    recentHistory: readonly RoutingHistoryEntry[];
    performance: {
      latencyReduction: string;
      directRoutingPercentage: string;
      recommendedMode: RoutingMode;
    };
  } {
    const recentHistory = this.routingHistory.slice(-10);
    const currentMode =
      recentHistory.length > 0
        ? recentHistory[recentHistory.length - 1].mode
        : "hub";

    const total = this.metrics.totalMessages || 1;
    const directPercentage =
      (this.metrics.modeDistribution.direct / total) * 100;

    const hubLatency =
      this.metrics.averageLatency.hub ||
      this.metrics.performanceBaseline.hubLatency;
    const directLatency =
      this.metrics.averageLatency.direct ||
      this.metrics.performanceBaseline.directLatency;

    const latencyReduction =
      hubLatency > directLatency
        ? `${(((hubLatency - directLatency) / hubLatency) * 100).toFixed(1)}%`
        : "0%";

    return {
      currentMode,
      metrics: this.metrics,
      recentHistory,
      performance: {
        latencyReduction,
        directRoutingPercentage: `${directPercentage.toFixed(1)}%`,
        recommendedMode: this.recommendOptimalMode(),
      },
    };
  }

  /**
   * Clear routing history and metrics
   */
  clear(): void {
    this.routingHistory = [];
    this.metrics = {
      totalMessages: 0,
      modeDistribution: { direct: 0, hub: 0, fallback: 0 },
      averageLatency: { direct: 0, hub: 0, fallback: 0 },
      performanceBaseline: this.metrics.performanceBaseline,
    };
    this.logger.debug("Routing history and metrics cleared");
  }

  /**
   * Update routing metrics
   */
  private updateMetrics(mode: RoutingMode, latency: number): void {
    // Create mutable copy for updates
    const modeDistribution = { ...this.metrics.modeDistribution };
    modeDistribution[mode]++;

    // Update average latency using running average
    const count = modeDistribution[mode];
    const currentAvg = this.metrics.averageLatency[mode];
    const newAvg = (currentAvg * (count - 1) + latency) / count;

    const averageLatency = { ...this.metrics.averageLatency };
    averageLatency[mode] = newAvg;

    // Update metrics object
    this.metrics = {
      totalMessages: this.metrics.totalMessages + 1,
      modeDistribution,
      averageLatency,
      performanceBaseline: this.metrics.performanceBaseline,
    };
  }

  /**
   * Record routing history entry
   */
  private recordHistory(
    message: UnifiedMessage,
    decision: RoutingDecision,
    latency: number,
  ): void {
    this.routingHistory.push({
      timestamp: new Date(),
      mode: decision.mode,
      reason: decision.reason,
      latency,
      messageId: message.correlation,
      priority: message.priority,
    });

    // Keep only last 500 entries
    if (this.routingHistory.length > 500) {
      this.routingHistory = this.routingHistory.slice(-500);
    }
  }

  /**
   * Recommend optimal routing mode based on current metrics
   */
  private recommendOptimalMode(): RoutingMode {
    const total = this.metrics.totalMessages;
    if (total === 0) return "hub";

    const directPercentage =
      (this.metrics.modeDistribution.direct / total) * 100;
    const fallbackPercentage =
      (this.metrics.modeDistribution.fallback / total) * 100;

    // If fallback is being used frequently, there's a problem
    if (fallbackPercentage > 10) return "fallback";

    // If direct routing is already high and performing well, keep it
    if (
      directPercentage > 50 &&
      this.metrics.averageLatency.direct < this.metrics.averageLatency.hub
    ) {
      return "direct";
    }

    return "hub";
  }
}

/**
 * Batch Route Message Use Case
 *
 * Routes multiple messages in batch
 */
export class BatchRouteMessageUseCase {
  constructor(
    private readonly logger: Logger,
    private readonly routeMessageUseCase: RouteMessageUseCase,
  ) {}

  /**
   * Execute batch message routing
   */
  async execute(
    systemState: SystemState,
    requests: readonly RouteMessageRequest[],
  ): Promise<readonly RouteMessageResponse[]> {
    this.logger.info("Executing batch message routing", {
      messageCount: requests.length,
    });

    const results = await Promise.allSettled(
      requests.map((request) =>
        this.routeMessageUseCase.execute(systemState, request),
      ),
    );

    return results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      // Return error response for failed routing
      return {
        success: false,
        routingDecision: {
          mode: "fallback" as const,
          reason: "Batch routing error",
          shouldRetry: true,
          maxRetries: 5,
        },
        latency: 0,
        shouldEstablishDirectConnection: false,
        requiresCoordination: false,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      };
    });
  }
}
