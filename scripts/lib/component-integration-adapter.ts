#!/usr/bin/env tsx

/**
 * Component Integration Adapter
 * Helps existing scattered components integrate with Core System Hub
 * without requiring complete rewrites
 */

import {
  coreSystemHub,
  ComponentId,
  UnifiedMessage,
  ComponentStatus,
  Operation,
} from "./core-system-hub.js";
import { performance } from "perf_hooks";

export interface LegacyComponent {
  name: string;
  execute: (params?: unknown) => Promise<unknown>;
  dependencies?: string[];
  capabilities?: string[];
}

export interface IntegrationConfig {
  componentId: ComponentId;
  version: string;
  capabilities: string[];
  dependencies: ComponentId[];
  healthCheckInterval?: number;
  enableMetrics?: boolean;
}

/**
 * Base adapter that legacy components can extend
 */
export abstract class ComponentAdapter {
  protected componentId: ComponentId;
  protected config: IntegrationConfig;
  private healthCheckTimer?: NodeJS.Timeout;
  private lastHeartbeat: Date = new Date();
  private operationCount = 0;
  private errorCount = 0;

  constructor(config: IntegrationConfig) {
    this.componentId = config.componentId;
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Register with the hub
    const status: ComponentStatus = {
      id: this.componentId,
      status: "healthy",
      lastHeartbeat: new Date(),
      version: this.config.version,
      capabilities: this.config.capabilities,
      dependencies: this.config.dependencies,
    };

    coreSystemHub.registerComponent(status);

    // Set up message listeners
    coreSystemHub.on(
      `message:${this.componentId}`,
      this.handleMessage.bind(this),
    );
    coreSystemHub.on(
      `operation:execute:${this.componentId}`,
      this.handleOperation.bind(this),
    );
    coreSystemHub.on("message:broadcast", this.handleBroadcast.bind(this));

    // Start health monitoring
    this.startHealthCheck();

    console.log(
      `🔌 Component ${this.componentId} integrated with Core System Hub`,
    );
  }

  /**
   * Send message to other components or broadcast
   */
  protected async sendMessage(
    target: ComponentId | "broadcast",
    type: "request" | "response" | "event" | "metric",
    payload: unknown,
    priority: "P0" | "P1" | "P2" = "P1",
  ): Promise<void> {
    const message: UnifiedMessage = {
      source: this.componentId,
      target,
      type,
      priority,
      payload,
      correlation: this.generateCorrelationId(),
      timestamp: new Date(),
    };

    await coreSystemHub.sendMessage(message);
  }

  /**
   * Request operation from the hub
   */
  protected async requestOperation(
    type: "maintenance" | "analysis" | "optimization" | "evolution",
    participants: ComponentId[],
    metadata: Record<string, unknown> = {},
  ): Promise<string> {
    const operation: Operation = {
      id: this.generateOperationId(),
      type,
      initiator: this.componentId,
      participants,
      status: "pending",
      startTime: new Date(),
      metadata: {
        ...metadata,
        requestedBy: this.componentId,
      },
    };

    return await coreSystemHub.startOperation(operation);
  }

  /**
   * Report metrics to the hub
   */
  protected reportMetrics(metrics: Record<string, number>): void {
    if (!this.config.enableMetrics) return;

    this.sendMessage(
      "broadcast",
      "metric",
      {
        component: this.componentId,
        timestamp: new Date(),
        metrics,
      },
      "P2",
    );
  }

  /**
   * Handle incoming messages - override in subclasses
   */
  protected async handleMessage(message: UnifiedMessage): Promise<void> {
    console.log(
      `📨 ${this.componentId} received message from ${message.source}`,
    );
    // Default implementation - override in subclasses
  }

  /**
   * Handle operation requests - override in subclasses
   */
  protected async handleOperation(operation: Operation): Promise<void> {
    const startTime = performance.now();

    try {
      console.log(
        `⚙️ ${this.componentId} executing operation: ${operation.type}`,
      );

      // Execute the operation - subclasses should override this
      await this.executeOperation(operation);

      this.operationCount++;

      // Report success
      await this.sendMessage(
        operation.initiator,
        "response",
        {
          operationId: operation.id,
          status: "completed",
          duration: performance.now() - startTime,
          executor: this.componentId,
        },
        operation.metadata.priority as "P0" | "P1" | "P2",
      );
    } catch (error) {
      this.errorCount++;

      // Report failure
      await this.sendMessage(
        operation.initiator,
        "response",
        {
          operationId: operation.id,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          duration: performance.now() - startTime,
          executor: this.componentId,
        },
        "P0",
      ); // Failures are always high priority
    }
  }

  /**
   * Handle broadcast messages - override in subclasses
   */
  protected async handleBroadcast(message: UnifiedMessage): Promise<void> {
    // Default implementation - can be overridden
    if (message.type === "event" && message.payload) {
      console.log(
        `📢 ${this.componentId} received broadcast from ${message.source}`,
      );
    }
  }

  /**
   * Execute operation - must be implemented by subclasses
   */
  protected abstract executeOperation(operation: Operation): Promise<void>;

  private startHealthCheck(): void {
    const interval = this.config.healthCheckInterval || 30000; // 30 seconds default

    this.healthCheckTimer = setInterval(() => {
      this.lastHeartbeat = new Date();

      // Report health metrics
      this.reportMetrics({
        operationCount: this.operationCount,
        errorCount: this.errorCount,
        errorRate:
          this.operationCount > 0 ? this.errorCount / this.operationCount : 0,
        uptime: process.uptime(),
      });
    }, interval);
  }

  private generateCorrelationId(): string {
    return `${this.componentId}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  private generateOperationId(): string {
    return `op-${this.componentId}-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;
  }

  /**
   * Clean up resources when component shuts down
   */
  public cleanup(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    console.log(`🔌 Component ${this.componentId} cleaned up`);
  }
}

/**
 * Quick integration utility for simple legacy components
 */
export class LegacyComponentWrapper extends ComponentAdapter {
  private legacyComponent: LegacyComponent;

  constructor(
    legacyComponent: LegacyComponent,
    config: Partial<IntegrationConfig>,
  ) {
    const fullConfig: IntegrationConfig = {
      componentId: config.componentId || (legacyComponent.name as ComponentId),
      version: config.version || "1.0.0",
      capabilities: config.capabilities ||
        legacyComponent.capabilities || ["general"],
      dependencies: config.dependencies || [],
      healthCheckInterval: config.healthCheckInterval || 30000,
      enableMetrics: config.enableMetrics ?? true,
    };

    super(fullConfig);
    this.legacyComponent = legacyComponent;
  }

  protected async executeOperation(operation: Operation): Promise<void> {
    // Execute legacy component with operation metadata as parameters
    await this.legacyComponent.execute(operation.metadata);
  }

  /**
   * Simple wrapper for legacy execute method
   */
  async executeLegacy(params?: unknown): Promise<unknown> {
    return await this.legacyComponent.execute(params);
  }
}

/**
 * Factory for quickly wrapping existing components
 */
export class ComponentIntegrationFactory {
  static wrapLegacyComponent(
    component: LegacyComponent,
    config: Partial<IntegrationConfig>,
  ): LegacyComponentWrapper {
    return new LegacyComponentWrapper(component, config);
  }

  static createAdapter(config: IntegrationConfig): ComponentAdapter {
    return new (class extends ComponentAdapter {
      protected async executeOperation(operation: Operation): Promise<void> {
        // Basic implementation - can be customized
        console.log(`Executing ${operation.type} operation`);
      }
    })(config);
  }

  /**
   * Mass integration utility for multiple components
   */
  static async integrateComponents(
    components: Array<{
      component: LegacyComponent;
      config: Partial<IntegrationConfig>;
    }>,
  ): Promise<LegacyComponentWrapper[]> {
    const wrappers: LegacyComponentWrapper[] = [];

    for (const { component, config } of components) {
      const wrapper = this.wrapLegacyComponent(component, config);
      wrappers.push(wrapper);

      // Small delay to avoid overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`🔄 Integrated ${wrappers.length} legacy components`);
    return wrappers;
  }
}

export default ComponentAdapter;
