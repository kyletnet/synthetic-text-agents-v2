/**
 * System Coordinator
 *
 * Central orchestrator that combines all use cases to provide
 * the same functionality as the original CoreSystemHub.
 *
 * This is the Clean Architecture version of CoreSystemHub:
 * - Domain logic in domain/system/
 * - Use cases in application/system/
 * - Coordination here with full backward compatibility
 */

import { EventEmitter } from "events";
import type { Logger } from "../../shared/logger.js";
import {
  type ComponentId,
  type ComponentStatus,
  type UnifiedMessage,
  type Operation,
  type SystemState,
  type SystemMetrics,
  SystemHealthCalculator,
} from "../../domain/system/system-status.js";
import {
  CheckHealthUseCase,
  type CheckHealthResponse,
} from "./check-health-use-case.js";
import {
  ValidateSystemUseCase,
  type ValidationResult,
} from "./validate-system-use-case.js";
import {
  RouteMessageUseCase,
  type RoutingMetrics,
} from "./route-message-use-case.js";
import {
  ExecuteOperationUseCase,
  type ExecuteOperationResponse,
} from "./execute-operation-use-case.js";

/**
 * System coordinator options
 */
export interface SystemCoordinatorOptions {
  readonly logger: Logger;
  readonly healthCheckIntervalMs?: number;
  readonly metricsExportIntervalMs?: number;
}

/**
 * System status summary (compatible with original CoreSystemHub)
 */
export interface SystemStatusSummary {
  readonly health: number;
  readonly componentsHealthy: number;
  readonly componentsTotal: number;
  readonly activeOperations: number;
  readonly queuedMessages: number;
  readonly memoryUsage: number;
  readonly messageQueues: {
    readonly direct: number;
    readonly hub: number;
    readonly fallback: number;
    readonly priority: number;
  };
}

/**
 * System Coordinator
 *
 * High-level orchestrator that:
 * - Manages system state
 * - Coordinates all use cases
 * - Maintains backward compatibility with CoreSystemHub
 * - Provides event-driven architecture
 */
export class SystemCoordinator extends EventEmitter {
  private systemState: SystemState;
  private readonly checkHealthUseCase: CheckHealthUseCase;
  private readonly validateSystemUseCase: ValidateSystemUseCase;
  private readonly routeMessageUseCase: RouteMessageUseCase;
  private readonly executeOperationUseCase: ExecuteOperationUseCase;

  private healthCheckInterval?: NodeJS.Timeout;
  private metricsExportInterval?: NodeJS.Timeout;
  private messageQueue: {
    direct: UnifiedMessage[];
    hub: UnifiedMessage[];
    fallback: UnifiedMessage[];
  };

  constructor(private readonly options: SystemCoordinatorOptions) {
    super();
    this.setMaxListeners(100);

    // Initialize system state
    this.systemState = {
      health: 100,
      components: new Map(),
      activeOperations: new Map(),
      metrics: {
        operationsPerHour: 0,
        averageOperationTime: 0,
        errorRate: 0,
        componentUtilization: new Map(),
        memoryUsage: 0,
        listenerCount: 0,
      },
    };

    // Initialize message queues
    this.messageQueue = {
      direct: [],
      hub: [],
      fallback: [],
    };

    // Initialize use cases
    this.checkHealthUseCase = new CheckHealthUseCase(options.logger);
    this.validateSystemUseCase = new ValidateSystemUseCase(options.logger);
    this.routeMessageUseCase = new RouteMessageUseCase(options.logger);
    this.executeOperationUseCase = new ExecuteOperationUseCase(options.logger);

    // Start periodic tasks
    this.startHealthMonitoring();
    this.startMetricsExport();
  }

  /**
   * Register a component with the system
   */
  registerComponent(component: ComponentStatus): void {
    this.options.logger.info("Registering component", {
      componentId: component.id,
    });

    // Update system state (make mutable copy)
    const newComponents = new Map(this.systemState.components);
    newComponents.set(component.id, component);

    this.systemState = {
      ...this.systemState,
      components: newComponents,
    };

    this.emit("component:registered", component);
  }

  /**
   * Unregister a component
   */
  unregisterComponent(componentId: ComponentId): void {
    this.options.logger.info("Unregistering component", { componentId });

    const newComponents = new Map(this.systemState.components);
    newComponents.delete(componentId);

    this.systemState = {
      ...this.systemState,
      components: newComponents,
    };

    this.emit("component:unregistered", { componentId });
  }

  /**
   * Send a message through the system
   */
  async sendMessage(message: UnifiedMessage): Promise<void> {
    const hubHealthy = this.systemState.health > 50;
    const directConnectionsAvailable = this.messageQueue.direct.length < 100;

    const response = await this.routeMessageUseCase.execute(this.systemState, {
      message,
      hubHealthy,
      directConnectionsAvailable,
    });

    if (!response.success) {
      this.options.logger.error("Message routing failed", {
        error: response.error,
      });
      return;
    }

    // Add message to appropriate queue
    switch (response.routingDecision.mode) {
      case "direct":
        this.messageQueue.direct.push(message);
        break;
      case "hub":
        this.messageQueue.hub.push(message);
        break;
      case "fallback":
        this.messageQueue.fallback.push(message);
        break;
    }

    // Emit event based on routing mode
    if (message.target === "broadcast") {
      this.emit("message:broadcast", message);
    } else {
      this.emit(`message:${message.target}`, message);
    }

    this.emit("message:routed", {
      message,
      routingMode: response.routingDecision.mode,
      latency: response.latency,
    });
  }

  /**
   * Start an operation
   */
  async startOperation(operation: Operation): Promise<string> {
    this.options.logger.info("Starting operation", {
      operationId: operation.id,
      type: operation.type,
    });

    const response = await this.executeOperationUseCase.execute(
      this.systemState,
      {
        operation,
        dryRun: false,
      },
    );

    if (!response.success) {
      this.options.logger.error("Operation execution failed", {
        operationId: operation.id,
        error: response.error,
      });
      throw new Error(response.error ?? "Operation execution failed");
    }

    // Update system state with active operation
    const newActiveOperations = new Map(this.systemState.activeOperations);
    newActiveOperations.set(operation.id, response.operation);

    this.systemState = {
      ...this.systemState,
      activeOperations: newActiveOperations,
    };

    this.emit("operation:started", response.operation);

    // Execute based on strategy
    switch (response.executionPlan.strategy) {
      case "immediate":
        this.executeImmediate(response.operation);
        break;
      case "distributed":
        this.executeDistributed(response.operation, response.executionPlan);
        break;
      case "delegated":
        if (response.executionPlan.delegatedTo) {
          this.executeDelegated(
            response.operation,
            response.executionPlan.delegatedTo,
          );
        }
        break;
      case "queued":
        this.emit("operation:queued", response.operation);
        break;
    }

    return operation.id;
  }

  /**
   * Get system status (backward compatible with CoreSystemHub)
   */
  getSystemStatus(): SystemStatusSummary {
    return {
      health: this.systemState.health,
      componentsHealthy: Array.from(
        this.systemState.components.values(),
      ).filter((c) => c.status === "healthy").length,
      componentsTotal: this.systemState.components.size,
      activeOperations: this.systemState.activeOperations.size,
      queuedMessages:
        this.messageQueue.direct.length +
        this.messageQueue.hub.length +
        this.messageQueue.fallback.length,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
      messageQueues: {
        direct: this.messageQueue.direct.length,
        hub: this.messageQueue.hub.length,
        fallback: this.messageQueue.fallback.length,
        priority: 0, // Legacy field
      },
    };
  }

  /**
   * Get routing metrics
   */
  getRoutingMetrics(): RoutingMetrics {
    return this.routeMessageUseCase.getMetrics();
  }

  /**
   * Get routing status (backward compatible)
   */
  getRoutingStatus(): ReturnType<RouteMessageUseCase["getRoutingStatus"]> {
    return this.routeMessageUseCase.getRoutingStatus();
  }

  /**
   * Validate system
   */
  async validateSystem(): Promise<ValidationResult> {
    return this.validateSystemUseCase.execute(this.systemState, {
      checkDependencies: true,
      checkOperationalReadiness: true,
      strictMode: false,
    });
  }

  /**
   * Check system health
   */
  async checkHealth(): Promise<CheckHealthResponse> {
    const response = await this.checkHealthUseCase.execute(this.systemState);

    if (response.success) {
      // Update system state with new health
      this.systemState = {
        ...this.systemState,
        health: response.systemHealth.health,
      };

      // Update component statuses
      const newComponents = new Map(this.systemState.components);
      for (const check of response.systemHealth.componentChecks) {
        const component = newComponents.get(check.componentId);
        if (component) {
          newComponents.set(check.componentId, {
            ...component,
            status: check.newStatus,
          });
        }
      }

      this.systemState = {
        ...this.systemState,
        components: newComponents,
      };

      this.emit("health:updated", response.systemHealth.health);
    }

    return response;
  }

  /**
   * Get current system state (for testing/debugging)
   */
  getSystemState(): SystemState {
    return this.systemState;
  }

  /**
   * Shutdown coordinator
   */
  async shutdown(): Promise<void> {
    this.options.logger.info("Shutting down system coordinator");

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.metricsExportInterval) {
      clearInterval(this.metricsExportInterval);
    }

    this.removeAllListeners();
  }

  /**
   * Execute operation immediately
   */
  private executeImmediate(operation: Operation): void {
    for (const participant of operation.participants) {
      this.emit(`operation:execute:${participant}`, operation);
    }
  }

  /**
   * Execute operation in distributed mode
   */
  private executeDistributed(
    operation: Operation,
    executionPlan: { workloadDistribution?: readonly any[] },
  ): void {
    if (!executionPlan.workloadDistribution) return;

    for (const assignment of executionPlan.workloadDistribution) {
      this.emit(`operation:execute:${assignment.componentId}`, {
        ...operation,
        metadata: { ...operation.metadata, ...assignment },
      });
    }
  }

  /**
   * Execute operation in delegated mode
   */
  private executeDelegated(
    operation: Operation,
    delegatedTo: ComponentId,
  ): void {
    this.emit(`operation:execute:${delegatedTo}`, operation);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    const interval = this.options.healthCheckIntervalMs ?? 30000;

    this.healthCheckInterval = setInterval(() => {
      this.checkHealth().catch((error) => {
        this.options.logger.error("Health check failed", { error });
      });
    }, interval);
  }

  /**
   * Start metrics export
   */
  private startMetricsExport(): void {
    const interval = this.options.metricsExportIntervalMs ?? 300000; // 5 minutes

    this.metricsExportInterval = setInterval(() => {
      this.exportMetrics().catch((error) => {
        this.options.logger.error("Metrics export failed", { error });
      });
    }, interval);
  }

  /**
   * Export metrics to file
   */
  private async exportMetrics(): Promise<void> {
    const metrics = {
      timestamp: new Date().toISOString(),
      systemStatus: this.getSystemStatus(),
      routingStatus: this.getRoutingStatus(),
    };

    this.emit("metrics:exported", metrics);

    // Could write to file here if needed
    this.options.logger.debug("Metrics exported", metrics);
  }
}

/**
 * Factory function to create SystemCoordinator
 */
export function createSystemCoordinator(
  logger: Logger,
  options?: Partial<Omit<SystemCoordinatorOptions, "logger">>,
): SystemCoordinator {
  return new SystemCoordinator({
    logger,
    ...options,
  });
}
