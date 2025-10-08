/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * System Status Domain Types
 *
 * Pure domain types and value objects for system state management.
 * No infrastructure dependencies - only business logic.
 */

/**
 * Component identifier for all system components
 */
export type ComponentId =
  | "maintenance-orchestrator"
  | "unified-dashboard"
  | "unified-reporter"
  | "ai-fix-engine"
  | "design-principle-engine"
  | "user-communication"
  | "workflow-prevention"
  | "auto-integration-guard"
  | "component-registry"
  | "architectural-evolution"
  | "performance-cache"
  | "approval-system"
  | "safe-automation-guard"
  | "broadcast";

/**
 * Message types for component communication
 */
export type MessageType = "request" | "response" | "event" | "metric";

/**
 * Priority levels for operations and messages
 */
export type Priority = "P0" | "P1" | "P2";

/**
 * Component status states
 */
export type ComponentStatusType =
  | "healthy"
  | "degraded"
  | "failed"
  | "maintenance";

/**
 * Operation types
 */
export type OperationType =
  | "maintenance"
  | "analysis"
  | "optimization"
  | "evolution";

/**
 * Operation execution states
 */
export type OperationStatus = "pending" | "running" | "completed" | "failed";

/**
 * Component status value object
 */
export interface ComponentStatus {
  readonly id: ComponentId;
  readonly status: ComponentStatusType;
  readonly lastHeartbeat: Date;
  readonly version: string;
  readonly capabilities: readonly string[];
  readonly dependencies: readonly ComponentId[];
}

/**
 * System operation value object
 */
export interface Operation {
  readonly id: string;
  readonly type: OperationType;
  readonly initiator: ComponentId;
  readonly participants: readonly ComponentId[];
  readonly status: OperationStatus;
  readonly startTime: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * System metrics value object
 */
export interface SystemMetrics {
  readonly operationsPerHour: number;
  readonly averageOperationTime: number;
  readonly errorRate: number;
  readonly componentUtilization: ReadonlyMap<ComponentId, number>;
  readonly memoryUsage: number;
  readonly listenerCount: number;
}

/**
 * Complete system state aggregate
 */
export interface SystemState {
  readonly health: number; // 0-100
  readonly components: ReadonlyMap<ComponentId, ComponentStatus>;
  readonly activeOperations: ReadonlyMap<string, Operation>;
  readonly metrics: SystemMetrics;
}

/**
 * Unified message for component communication
 */
export interface UnifiedMessage {
  readonly source: ComponentId;
  readonly target: ComponentId | "broadcast";
  readonly type: MessageType;
  readonly priority: Priority;
  readonly payload: unknown;
  readonly correlation: string;
  readonly timestamp: Date;
  readonly routingMode?: "direct" | "hub" | "fallback";
}

/**
 * System health assessment result
 */
export interface HealthAssessment {
  readonly overallHealth: number;
  readonly healthyCount: number;
  readonly totalCount: number;
  readonly degradedComponents: readonly ComponentId[];
  readonly failedComponents: readonly ComponentId[];
  readonly recommendations: readonly string[];
}

/**
 * Component health check result
 */
export interface ComponentHealthCheck {
  readonly componentId: ComponentId;
  readonly isHealthy: boolean;
  readonly timeSinceHeartbeat: number;
  readonly status: ComponentStatusType;
  readonly reason?: string;
}

/**
 * Domain service: Calculate system health
 */
export class SystemHealthCalculator {
  /**
   * Calculate overall system health based on component statuses
   */
  static calculateHealth(
    components: ReadonlyMap<ComponentId, ComponentStatus>,
  ): number {
    if (components.size === 0) return 100;

    let totalHealth = 0;

    for (const status of components.values()) {
      totalHealth += this.getComponentHealthScore(status.status);
    }

    return Math.round(totalHealth / components.size);
  }

  /**
   * Get health score for a component status
   */
  private static getComponentHealthScore(status: ComponentStatusType): number {
    switch (status) {
      case "healthy":
        return 100;
      case "degraded":
        return 50;
      case "failed":
      case "maintenance":
        return 0;
      default:
        return 0;
    }
  }

  /**
   * Assess component health based on heartbeat
   */
  static assessComponentHealth(
    lastHeartbeat: Date,
    now: Date = new Date(),
  ): ComponentHealthCheck {
    const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();

    let status: ComponentStatusType;
    let isHealthy: boolean;
    let reason: string | undefined;

    if (timeSinceHeartbeat > 120000) {
      // 2 minutes
      status = "failed";
      isHealthy = false;
      reason = "No heartbeat for over 2 minutes";
    } else if (timeSinceHeartbeat > 60000) {
      // 1 minute
      status = "degraded";
      isHealthy = false;
      reason = "No heartbeat for over 1 minute";
    } else {
      status = "healthy";
      isHealthy = true;
    }

    return {
      componentId: "broadcast", // Will be overridden by caller
      isHealthy,
      timeSinceHeartbeat,
      status,
      reason,
    };
  }

  /**
   * Create health assessment for the entire system
   */
  static createHealthAssessment(
    components: ReadonlyMap<ComponentId, ComponentStatus>,
  ): HealthAssessment {
    const degradedComponents: ComponentId[] = [];
    const failedComponents: ComponentId[] = [];
    let healthyCount = 0;

    for (const [id, status] of components.entries()) {
      switch (status.status) {
        case "healthy":
          healthyCount++;
          break;
        case "degraded":
          degradedComponents.push(id);
          break;
        case "failed":
          failedComponents.push(id);
          break;
      }
    }

    const recommendations = this.generateRecommendations(
      components,
      degradedComponents,
      failedComponents,
    );

    return {
      overallHealth: this.calculateHealth(components),
      healthyCount,
      totalCount: components.size,
      degradedComponents,
      failedComponents,
      recommendations,
    };
  }

  /**
   * Generate health recommendations
   */
  private static generateRecommendations(
    components: ReadonlyMap<ComponentId, ComponentStatus>,
    degraded: readonly ComponentId[],
    failed: readonly ComponentId[],
  ): string[] {
    const recommendations: string[] = [];

    if (failed.length > 0) {
      recommendations.push(
        `CRITICAL: ${failed.length} component(s) failed - immediate attention required`,
      );
    }

    if (degraded.length > 0) {
      recommendations.push(
        `WARNING: ${degraded.length} component(s) degraded - investigate heartbeat issues`,
      );
    }

    const healthRatio =
      (components.size - failed.length - degraded.length) / components.size;
    if (healthRatio < 0.5) {
      recommendations.push(
        "System health below 50% - consider emergency maintenance",
      );
    }

    return recommendations;
  }
}

/**
 * Domain service: Operation priority calculator
 */
export class OperationPriorityCalculator {
  /**
   * Calculate numeric priority weight
   */
  static getPriorityWeight(priority: Priority): number {
    switch (priority) {
      case "P0":
        return 3;
      case "P1":
        return 2;
      case "P2":
        return 1;
      default:
        return 1;
    }
  }

  /**
   * Compare two operations by priority and start time
   */
  static compare(a: Operation, b: Operation): number {
    const aPriority = OperationPriorityCalculator.getPriorityWeight(
      (a.metadata.priority as Priority) ?? "P2",
    );
    const bPriority = OperationPriorityCalculator.getPriorityWeight(
      (b.metadata.priority as Priority) ?? "P2",
    );

    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }

    return a.startTime.getTime() - b.startTime.getTime(); // Earlier first
  }

  /**
   * Sort operations by priority
   */
  static sortByPriority(operations: readonly Operation[]): Operation[] {
    return [...operations].sort((a, b) =>
      OperationPriorityCalculator.compare(a, b),
    );
  }
}
