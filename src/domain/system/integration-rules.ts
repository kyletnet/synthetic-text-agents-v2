/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Integration Rules Domain Logic
 *
 * Business rules for message routing, operation coordination,
 * and system integration patterns.
 */

import type {
  ComponentId,
  Priority,
  UnifiedMessage,
  Operation,
  SystemState,
  ComponentStatus,
} from "./system-status.js";

/**
 * Routing mode for messages
 */
export type RoutingMode = "direct" | "hub" | "fallback";

/**
 * Execution strategy for operations
 */
export type ExecutionStrategy =
  | "immediate"
  | "queued"
  | "delegated"
  | "distributed";

/**
 * Routing decision result
 */
export interface RoutingDecision {
  readonly mode: RoutingMode;
  readonly reason: string;
  readonly shouldRetry: boolean;
  readonly maxRetries: number;
}

/**
 * Execution strategy decision
 */
export interface StrategyDecision {
  readonly strategy: ExecutionStrategy;
  readonly participants: readonly ComponentId[];
  readonly priority: Priority;
  readonly reasoning: string;
}

/**
 * Routing Rules - Domain Service
 *
 * Encapsulates business rules for message routing
 */
export class RoutingRules {
  /**
   * Determine routing mode for a message
   */
  static determineRoutingMode(
    message: UnifiedMessage,
    systemState: SystemState,
    hubHealthy: boolean,
    directConnectionsAvailable: boolean,
  ): RoutingDecision {
    // Critical messages use fallback if hub is down
    if (message.priority === "P0" && !hubHealthy) {
      return {
        mode: "fallback",
        reason: "Critical priority with hub failure",
        shouldRetry: true,
        maxRetries: 5,
      };
    }

    // Use direct routing if available and hub load is high
    if (
      message.target !== "broadcast" &&
      directConnectionsAvailable &&
      systemState.metrics.operationsPerHour > 40
    ) {
      return {
        mode: "direct",
        reason: "High load optimization - direct routing available",
        shouldRetry: true,
        maxRetries: 2,
      };
    }

    // Hub failure - use fallback for all messages
    if (!hubHealthy) {
      return {
        mode: "fallback",
        reason: "Hub failure detected",
        shouldRetry: true,
        maxRetries: 5,
      };
    }

    // Default to hub-mediated routing
    return {
      mode: "hub",
      reason: "Normal hub-mediated routing",
      shouldRetry: true,
      maxRetries: 3,
    };
  }

  /**
   * Check if direct connection should be established
   */
  static shouldEstablishDirectConnection(
    source: ComponentId,
    target: ComponentId,
    systemLoad: number,
    hubHealthy: boolean,
  ): boolean {
    // Don't establish direct connections to broadcast
    if (target === "broadcast") return false;

    // Establish direct connections during high load
    if (systemLoad > 40) return true;

    // Establish direct connections during hub failure
    if (!hubHealthy) return true;

    return false;
  }

  /**
   * Check if message requires coordination
   */
  static requiresCoordination(message: UnifiedMessage): boolean {
    return message.target === "broadcast" || message.type === "request";
  }

  /**
   * Get emergency level for priority
   */
  static getEmergencyLevel(
    priority: Priority,
  ): "low" | "medium" | "high" | "critical" {
    switch (priority) {
      case "P0":
        return "critical";
      case "P1":
        return "high";
      case "P2":
        return "medium";
      default:
        return "low";
    }
  }
}

/**
 * Execution Strategy Rules - Domain Service
 *
 * Encapsulates business rules for operation execution
 */
export class ExecutionStrategyRules {
  /**
   * Decide execution strategy for an operation
   */
  static decideStrategy(
    operation: Operation,
    systemState: SystemState,
  ): StrategyDecision {
    const healthyComponents = this.getHealthyComponents(systemState);
    const availableParticipants = operation.participants.filter((p) =>
      healthyComponents.includes(p),
    );

    // P0 operations run immediately regardless of load
    if (operation.metadata.priority === "P0") {
      return {
        strategy: "immediate",
        participants: availableParticipants,
        priority: "P0",
        reasoning: "Critical priority requires immediate execution",
      };
    }

    // High load - queue non-critical operations
    if (systemState.metrics.operationsPerHour > 50) {
      return {
        strategy: "queued",
        participants: operation.participants,
        priority: "P2",
        reasoning: "High system load - queueing for later execution",
      };
    }

    // Distribute across healthy components for efficiency
    const distributionTarget = Math.min(3, healthyComponents.length);
    const selectedParticipants = healthyComponents.slice(0, distributionTarget);

    return {
      strategy: "distributed",
      participants: selectedParticipants,
      priority: "P1",
      reasoning: "Normal load - distributing across available components",
    };
  }

  /**
   * Get healthy components from system state
   */
  private static getHealthyComponents(systemState: SystemState): ComponentId[] {
    return Array.from(systemState.components.entries())
      .filter(([_, status]) => status.status === "healthy")
      .map(([id, _]) => id);
  }

  /**
   * Check if operation can be executed immediately
   */
  static canExecuteImmediately(
    operation: Operation,
    systemState: SystemState,
  ): boolean {
    const strategy = this.decideStrategy(operation, systemState);
    return strategy.strategy === "immediate";
  }

  /**
   * Check if operation should be queued
   */
  static shouldQueue(operation: Operation, systemState: SystemState): boolean {
    const strategy = this.decideStrategy(operation, systemState);
    return strategy.strategy === "queued";
  }

  /**
   * Find best component for delegation
   */
  static findBestComponentForDelegation(
    operation: Operation,
    systemState: SystemState,
  ): ComponentId | null {
    for (const participantId of operation.participants) {
      const component = systemState.components.get(participantId);
      if (
        component?.status === "healthy" &&
        component.capabilities.includes(operation.type)
      ) {
        return participantId;
      }
    }

    // Fallback to first healthy participant
    for (const participantId of operation.participants) {
      const component = systemState.components.get(participantId);
      if (component?.status === "healthy") {
        return participantId;
      }
    }

    return null;
  }

  /**
   * Calculate workload distribution
   */
  static distributeWorkload(
    operation: Operation,
    participants: readonly ComponentId[],
  ): Array<{
    componentId: ComponentId;
    partition: number;
    totalPartitions: number;
    metadata: Record<string, unknown>;
  }> {
    const participantCount = participants.length;

    return participants.map((componentId, index) => ({
      componentId,
      partition: index + 1,
      totalPartitions: participantCount,
      metadata: { ...operation.metadata },
    }));
  }
}

/**
 * Component dependency rules
 */
export class ComponentDependencyRules {
  /**
   * Check if component dependencies are satisfied
   */
  static areDependenciesSatisfied(
    component: ComponentStatus,
    systemState: SystemState,
  ): boolean {
    for (const depId of component.dependencies) {
      const dep = systemState.components.get(depId);
      if (!dep || dep.status !== "healthy") {
        return false;
      }
    }
    return true;
  }

  /**
   * Get failed dependencies for a component
   */
  static getFailedDependencies(
    component: ComponentStatus,
    systemState: SystemState,
  ): ComponentId[] {
    const failed: ComponentId[] = [];

    for (const depId of component.dependencies) {
      const dep = systemState.components.get(depId);
      if (!dep || dep.status !== "healthy") {
        failed.push(depId);
      }
    }

    return failed;
  }

  /**
   * Check if component can be started
   */
  static canStart(
    component: ComponentStatus,
    systemState: SystemState,
  ): {
    canStart: boolean;
    reason: string;
    blockedBy: readonly ComponentId[];
  } {
    const failedDeps = this.getFailedDependencies(component, systemState);

    if (failedDeps.length === 0) {
      return {
        canStart: true,
        reason: "All dependencies satisfied",
        blockedBy: [],
      };
    }

    return {
      canStart: false,
      reason: `Blocked by ${failedDeps.length} failed dependencies`,
      blockedBy: failedDeps,
    };
  }

  /**
   * Get startup order based on dependencies
   */
  static getStartupOrder(
    components: readonly ComponentStatus[],
  ): ComponentId[] {
    const order: ComponentId[] = [];
    const remaining = new Set(components.map((c) => c.id));
    const componentMap = new Map(components.map((c) => [c.id, c]));

    while (remaining.size > 0) {
      let addedAny = false;

      for (const id of remaining) {
        const component = componentMap.get(id)!;
        const unsatisfiedDeps = component.dependencies.filter((depId) =>
          remaining.has(depId),
        );

        if (unsatisfiedDeps.length === 0) {
          order.push(id);
          remaining.delete(id);
          addedAny = true;
        }
      }

      // Break circular dependencies
      if (!addedAny && remaining.size > 0) {
        const next = remaining.values().next().value as ComponentId;
        if (next) {
          order.push(next);
          remaining.delete(next);
        }
      }
    }

    return order;
  }
}

/**
 * Risk assessment rules
 */
export class RiskAssessmentRules {
  /**
   * Assess risk of operation execution
   */
  static assessOperationRisk(
    operation: Operation,
    systemState: SystemState,
  ): {
    riskLevel: "low" | "medium" | "high" | "critical";
    factors: readonly string[];
  } {
    const factors: string[] = [];
    let riskScore = 0;

    // Check system health
    if (systemState.health < 50) {
      riskScore += 3;
      factors.push("System health below 50%");
    } else if (systemState.health < 70) {
      riskScore += 2;
      factors.push("System health below 70%");
    }

    // Check system load
    if (systemState.metrics.operationsPerHour > 80) {
      riskScore += 3;
      factors.push("Very high system load (>80 ops/hour)");
    } else if (systemState.metrics.operationsPerHour > 50) {
      riskScore += 2;
      factors.push("High system load (>50 ops/hour)");
    }

    // Check participant availability
    const healthyParticipants = operation.participants.filter((p) => {
      const component = systemState.components.get(p);
      return component?.status === "healthy";
    });

    if (healthyParticipants.length === 0) {
      riskScore += 4;
      factors.push("No healthy participants available");
    } else if (healthyParticipants.length < operation.participants.length / 2) {
      riskScore += 2;
      factors.push("Less than 50% of participants healthy");
    }

    // Determine risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    if (riskScore >= 7) {
      riskLevel = "critical";
    } else if (riskScore >= 5) {
      riskLevel = "high";
    } else if (riskScore >= 3) {
      riskLevel = "medium";
    } else {
      riskLevel = "low";
    }

    return { riskLevel, factors };
  }

  /**
   * Check if operation should proceed given risk level
   */
  static shouldProceed(
    riskLevel: "low" | "medium" | "high" | "critical",
    priority: Priority,
  ): boolean {
    // P0 operations proceed regardless of risk
    if (priority === "P0") return true;

    // P1 operations proceed unless critical risk
    if (priority === "P1" && riskLevel !== "critical") return true;

    // P2 operations only proceed on low/medium risk
    return riskLevel === "low" || riskLevel === "medium";
  }
}
