/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Check Health Use Case
 *
 * Application service for health checking operations.
 * Orchestrates domain logic to check system and component health.
 */

import type { Logger } from "../../shared/logger.js";
import {
  type ComponentId,
  type ComponentStatus,
  type SystemState,
  SystemHealthCalculator,
} from "../../domain/system/system-status.js";
import {
  HealthCheckRules,
  type HealthCheckThresholds,
  type SystemHealthStatus,
  DEFAULT_HEALTH_THRESHOLDS,
} from "../../domain/system/health-check.js";

/**
 * Health check request
 */
export interface CheckHealthRequest {
  readonly targetComponents?: readonly ComponentId[];
  readonly thresholds?: HealthCheckThresholds;
  readonly timestamp?: Date;
}

/**
 * Health check response
 */
export interface CheckHealthResponse {
  readonly success: boolean;
  readonly systemHealth: SystemHealthStatus;
  readonly changedComponents: readonly ComponentId[];
  readonly alertRequired: boolean;
  readonly executionTime: number;
  readonly error?: string;
}

/**
 * Health check event
 */
export interface HealthCheckEvent {
  readonly type:
    | "health:checked"
    | "health:degraded"
    | "health:critical"
    | "health:recovered";
  readonly timestamp: Date;
  readonly health: number;
  readonly changedComponents: readonly ComponentId[];
  readonly data: SystemHealthStatus;
}

/**
 * Check Health Use Case
 *
 * Responsibilities:
 * - Check health of all system components
 * - Update component statuses based on heartbeats
 * - Generate health recommendations
 * - Emit health events
 */
export class CheckHealthUseCase {
  private readonly healthCheckRules: HealthCheckRules;

  constructor(
    private readonly logger: Logger,
    thresholds: HealthCheckThresholds = DEFAULT_HEALTH_THRESHOLDS,
  ) {
    this.healthCheckRules = new HealthCheckRules(thresholds);
  }

  /**
   * Execute health check
   */
  async execute(
    systemState: SystemState,
    request: CheckHealthRequest = {},
  ): Promise<CheckHealthResponse> {
    const startTime = Date.now();
    const timestamp = request.timestamp ?? new Date();

    this.logger.debug("Executing health check", {
      componentCount: systemState.components.size,
      targetComponents: request.targetComponents?.length ?? "all",
    });

    try {
      // Get components to check
      const componentsToCheck = this.getComponentsToCheck(
        systemState.components,
        request.targetComponents,
      );

      // Calculate current health
      const currentHealth =
        SystemHealthCalculator.calculateHealth(componentsToCheck);

      // Create health status with checks
      const systemHealth = this.healthCheckRules.createSystemHealthStatus(
        componentsToCheck,
        currentHealth,
        timestamp,
      );

      // Find changed components
      const changedComponents = systemHealth.componentChecks
        .filter((check) => check.changed)
        .map((check) => check.componentId);

      // Check if alert is required
      const alertRequired = systemHealth.componentChecks.some((check) =>
        this.healthCheckRules.shouldAlert(check),
      );

      const executionTime = Date.now() - startTime;

      this.logger.info("Health check completed", {
        health: systemHealth.health,
        status: systemHealth.status,
        changedComponents: changedComponents.length,
        alertRequired,
        executionTime,
      });

      // Emit appropriate event
      this.emitHealthEvent(systemState.health, systemHealth, changedComponents);

      return {
        success: true,
        systemHealth,
        changedComponents,
        alertRequired,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error("Health check failed", {
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      });

      return {
        success: false,
        systemHealth: {
          health: 0,
          status: "critical",
          healthyComponents: 0,
          totalComponents: systemState.components.size,
          componentChecks: [],
          recommendations: ["Health check failed - manual inspection required"],
        },
        changedComponents: [],
        alertRequired: true,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check if system requires immediate attention
   */
  requiresImmediateAttention(healthStatus: SystemHealthStatus): boolean {
    return this.healthCheckRules.requiresImmediateAttention(healthStatus);
  }

  /**
   * Get recommended check interval based on current health
   */
  getRecommendedCheckInterval(health: number): number {
    return this.healthCheckRules.getRecommendedCheckInterval(health);
  }

  /**
   * Get components to check based on request
   */
  private getComponentsToCheck(
    allComponents: ReadonlyMap<ComponentId, ComponentStatus>,
    targetComponents?: readonly ComponentId[],
  ): ReadonlyMap<ComponentId, ComponentStatus> {
    if (!targetComponents || targetComponents.length === 0) {
      return allComponents;
    }

    const filtered = new Map<ComponentId, ComponentStatus>();
    for (const id of targetComponents) {
      const component = allComponents.get(id);
      if (component) {
        filtered.set(id, component);
      }
    }

    return filtered;
  }

  /**
   * Emit appropriate health event based on status change
   */
  private emitHealthEvent(
    previousHealth: number,
    currentStatus: SystemHealthStatus,
    changedComponents: readonly ComponentId[],
  ): HealthCheckEvent | null {
    const currentHealth = currentStatus.health;

    let eventType: HealthCheckEvent["type"];

    // Determine event type based on health change
    if (currentStatus.status === "critical") {
      eventType = "health:critical";
    } else if (currentStatus.status === "warning") {
      eventType = "health:degraded";
    } else if (previousHealth < 70 && currentHealth >= 70) {
      eventType = "health:recovered";
    } else {
      eventType = "health:checked";
    }

    const event: HealthCheckEvent = {
      type: eventType,
      timestamp: new Date(),
      health: currentHealth,
      changedComponents,
      data: currentStatus,
    };

    this.logger.debug("Health event emitted", {
      eventType,
      health: currentHealth,
      changedCount: changedComponents.length,
    });

    return event;
  }
}

/**
 * Batch health check use case
 *
 * Checks health of multiple systems in batch
 */
export class BatchHealthCheckUseCase {
  constructor(
    private readonly logger: Logger,
    private readonly healthCheckUseCase: CheckHealthUseCase,
  ) {}

  /**
   * Execute batch health check
   */
  async execute(
    systems: readonly SystemState[],
    request: CheckHealthRequest = {},
  ): Promise<readonly CheckHealthResponse[]> {
    this.logger.info("Executing batch health check", {
      systemCount: systems.length,
    });

    const results = await Promise.allSettled(
      systems.map((system) => this.healthCheckUseCase.execute(system, request)),
    );

    return results.map((result) => {
      if (result.status === "fulfilled") {
        return result.value;
      }

      // Return error response for failed checks
      return {
        success: false,
        systemHealth: {
          health: 0,
          status: "critical" as const,
          healthyComponents: 0,
          totalComponents: 0,
          componentChecks: [],
          recommendations: ["Batch health check failed"],
        },
        changedComponents: [],
        alertRequired: true,
        executionTime: 0,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      };
    });
  }
}
