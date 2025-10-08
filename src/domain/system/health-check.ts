/**
 * Health Check Domain Rules
 *
 * Business rules for health monitoring and assessment.
 * Pure domain logic - no infrastructure dependencies.
 */

import type {
  ComponentId,
  ComponentStatus,
  ComponentStatusType,
  SystemState,
} from "./system-status.js";

/**
 * Health check thresholds configuration
 */
export interface HealthCheckThresholds {
  readonly degradedThresholdMs: number;
  readonly failedThresholdMs: number;
  readonly criticalHealthPercentage: number;
  readonly warningHealthPercentage: number;
}

/**
 * Default health check thresholds
 */
export const DEFAULT_HEALTH_THRESHOLDS: HealthCheckThresholds = {
  degradedThresholdMs: 60000, // 1 minute
  failedThresholdMs: 120000, // 2 minutes
  criticalHealthPercentage: 50,
  warningHealthPercentage: 70,
};

/**
 * Health check result
 */
export interface HealthCheckResult {
  readonly componentId: ComponentId;
  readonly previousStatus: ComponentStatusType;
  readonly newStatus: ComponentStatusType;
  readonly changed: boolean;
  readonly timeSinceHeartbeat: number;
  readonly reason: string;
}

/**
 * System health status
 */
export interface SystemHealthStatus {
  readonly health: number;
  readonly status: "critical" | "warning" | "healthy";
  readonly healthyComponents: number;
  readonly totalComponents: number;
  readonly componentChecks: readonly HealthCheckResult[];
  readonly recommendations: readonly string[];
}

/**
 * Health Check Rules - Domain Service
 *
 * Encapsulates business rules for health monitoring
 */
export class HealthCheckRules {
  constructor(
    private readonly thresholds: HealthCheckThresholds = DEFAULT_HEALTH_THRESHOLDS,
  ) {}

  /**
   * Check if a component is healthy based on heartbeat
   */
  checkComponentHealth(
    component: ComponentStatus,
    now: Date = new Date(),
  ): HealthCheckResult {
    const timeSinceHeartbeat =
      now.getTime() - component.lastHeartbeat.getTime();
    const previousStatus = component.status;
    let newStatus: ComponentStatusType;
    let reason: string;

    if (timeSinceHeartbeat > this.thresholds.failedThresholdMs) {
      newStatus = "failed";
      reason = `No heartbeat for ${Math.round(
        timeSinceHeartbeat / 1000,
      )}s (threshold: ${this.thresholds.failedThresholdMs / 1000}s)`;
    } else if (timeSinceHeartbeat > this.thresholds.degradedThresholdMs) {
      newStatus = "degraded";
      reason = `Slow heartbeat: ${Math.round(
        timeSinceHeartbeat / 1000,
      )}s (threshold: ${this.thresholds.degradedThresholdMs / 1000}s)`;
    } else {
      newStatus = "healthy";
      reason = "Component responding normally";
    }

    return {
      componentId: component.id,
      previousStatus,
      newStatus,
      changed: previousStatus !== newStatus,
      timeSinceHeartbeat,
      reason,
    };
  }

  /**
   * Check all components in the system
   */
  checkAllComponents(
    components: ReadonlyMap<ComponentId, ComponentStatus>,
    now: Date = new Date(),
  ): readonly HealthCheckResult[] {
    const results: HealthCheckResult[] = [];

    for (const component of components.values()) {
      results.push(this.checkComponentHealth(component, now));
    }

    return results;
  }

  /**
   * Determine overall system health status
   */
  determineSystemHealthStatus(
    health: number,
  ): "critical" | "warning" | "healthy" {
    if (health < this.thresholds.criticalHealthPercentage) {
      return "critical";
    }
    if (health < this.thresholds.warningHealthPercentage) {
      return "warning";
    }
    return "healthy";
  }

  /**
   * Generate health recommendations based on check results
   */
  generateHealthRecommendations(
    checkResults: readonly HealthCheckResult[],
    overallHealth: number,
  ): readonly string[] {
    const recommendations: string[] = [];

    const failed = checkResults.filter((r) => r.newStatus === "failed");
    const degraded = checkResults.filter((r) => r.newStatus === "degraded");
    const recovered = checkResults.filter(
      (r) => r.changed && r.newStatus === "healthy",
    );

    // Critical issues
    if (failed.length > 0) {
      recommendations.push(
        `🚨 CRITICAL: ${failed.length} component(s) failed - ${failed
          .map((f) => f.componentId)
          .join(", ")}`,
      );
    }

    // Warnings
    if (degraded.length > 0) {
      recommendations.push(
        `⚠️ WARNING: ${degraded.length} component(s) degraded - ${degraded
          .map((d) => d.componentId)
          .join(", ")}`,
      );
    }

    // Positive updates
    if (recovered.length > 0) {
      recommendations.push(
        `✅ ${recovered.length} component(s) recovered - ${recovered
          .map((r) => r.componentId)
          .join(", ")}`,
      );
    }

    // Overall system health
    const status = this.determineSystemHealthStatus(overallHealth);
    if (status === "critical") {
      recommendations.push(
        "🔴 System health critical - immediate action required",
      );
    } else if (status === "warning") {
      recommendations.push(
        "🟡 System health degraded - monitoring recommended",
      );
    }

    return recommendations;
  }

  /**
   * Create complete system health status
   */
  createSystemHealthStatus(
    components: ReadonlyMap<ComponentId, ComponentStatus>,
    health: number,
    now: Date = new Date(),
  ): SystemHealthStatus {
    const componentChecks = this.checkAllComponents(components, now);
    const healthyComponents = componentChecks.filter(
      (c) => c.newStatus === "healthy",
    ).length;

    const recommendations = this.generateHealthRecommendations(
      componentChecks,
      health,
    );

    return {
      health,
      status: this.determineSystemHealthStatus(health),
      healthyComponents,
      totalComponents: components.size,
      componentChecks,
      recommendations,
    };
  }

  /**
   * Check if system requires immediate attention
   */
  requiresImmediateAttention(status: SystemHealthStatus): boolean {
    return (
      status.status === "critical" ||
      status.componentChecks.some((c) => c.newStatus === "failed")
    );
  }

  /**
   * Check if component status change should trigger alert
   */
  shouldAlert(checkResult: HealthCheckResult): boolean {
    // Alert on status degradation
    if (!checkResult.changed) return false;

    // Alert if component went from healthy to degraded/failed
    if (
      checkResult.previousStatus === "healthy" &&
      (checkResult.newStatus === "degraded" ||
        checkResult.newStatus === "failed")
    ) {
      return true;
    }

    // Alert if component went from degraded to failed
    if (
      checkResult.previousStatus === "degraded" &&
      checkResult.newStatus === "failed"
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get health check interval based on system health
   */
  getRecommendedCheckInterval(health: number): number {
    if (health < this.thresholds.criticalHealthPercentage) {
      return 5000; // 5 seconds for critical systems
    }
    if (health < this.thresholds.warningHealthPercentage) {
      return 15000; // 15 seconds for degraded systems
    }
    return 30000; // 30 seconds for healthy systems
  }
}

/**
 * Heartbeat validation rules
 */
export class HeartbeatValidator {
  /**
   * Validate heartbeat freshness
   */
  static isHeartbeatFresh(
    lastHeartbeat: Date,
    thresholdMs: number,
    now: Date = new Date(),
  ): boolean {
    const timeSinceHeartbeat = now.getTime() - lastHeartbeat.getTime();
    return timeSinceHeartbeat <= thresholdMs;
  }

  /**
   * Validate heartbeat consistency
   */
  static validateHeartbeatConsistency(
    heartbeats: readonly Date[],
    expectedIntervalMs: number,
    toleranceMs: number = 5000,
  ): {
    consistent: boolean;
    gaps: number[];
    averageInterval: number;
  } {
    if (heartbeats.length < 2) {
      return { consistent: true, gaps: [], averageInterval: 0 };
    }

    const gaps: number[] = [];
    let totalInterval = 0;

    for (let i = 1; i < heartbeats.length; i++) {
      const gap = heartbeats[i].getTime() - heartbeats[i - 1].getTime();
      gaps.push(gap);
      totalInterval += gap;
    }

    const averageInterval = totalInterval / gaps.length;
    const consistent = gaps.every(
      (gap) => Math.abs(gap - expectedIntervalMs) <= toleranceMs,
    );

    return { consistent, gaps, averageInterval };
  }
}
