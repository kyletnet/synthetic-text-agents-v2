/**
 * Policy Runtime - Bidirectional Control
 *
 * Evolution (from GPT insight):
 * "Don't just evaluate and log. Let policies control domain operations."
 *
 * Before (단방향):
 * Event → Policy evaluates → Log → Done
 * (Policy is an observer)
 *
 * After (양방향):
 * Event → Policy evaluates → Domain action → Feedback
 * (Policy is a controller)
 *
 * Examples:
 * - threshold drift detected → rollback threshold
 * - quality degradation → revert to previous config
 * - cost spike → block operation
 */

import {
  domainEventBus,
  DomainEvent,
} from "../../domain/events/domain-event-bus.js";
import { getPolicyInterpreter } from "./policy-interpreter.js";

export interface DomainController {
  name: string;
  restoreThreshold: (metric: string) => Promise<void>;
  revertConfiguration: (service: string) => Promise<void>;
  blockOperation: (operationId: string) => Promise<void>;
  adjustQuality: (target: number) => Promise<void>;
}

/**
 * Policy Runtime
 * Policies can now control domain operations directly
 */
export class PolicyRuntime {
  private interpreter = getPolicyInterpreter();
  private domainControllers: Map<string, DomainController> = new Map();

  async initialize(): Promise<void> {
    console.log("[Policy Runtime] Initializing bidirectional control...");

    // Load policies
    await this.interpreter.loadPolicies();

    // Register domain controllers
    this.registerDomainControllers();

    // Subscribe to domain events
    this.subscribeToEvents();

    console.log("[Policy Runtime] ✅ Bidirectional control active");
  }

  /**
   * Register domain controllers
   * These controllers allow policies to directly manipulate domain state
   */
  private registerDomainControllers(): void {
    // Threshold Controller
    this.registerController({
      name: "threshold",
      restoreThreshold: async (metric: string) => {
        console.log(`[Policy Runtime] 🔄 Restoring threshold: ${metric}`);
        // TODO: Call ThresholdManagerService to restore previous value
        try {
          const { ThresholdManagerService } = await import(
            "../../application/metrics/threshold-manager-service.js"
          );
          // Implementation: restore from history
        } catch (error) {
          console.error("Failed to restore threshold:", error);
        }
      },
      revertConfiguration: async (service: string) => {
        console.log(`[Policy Runtime] ⏪ Reverting config: ${service}`);
        // TODO: Revert service configuration
      },
      blockOperation: async (operationId: string) => {
        console.log(`[Policy Runtime] 🚫 Blocking operation: ${operationId}`);
        // TODO: Block operation execution
      },
      adjustQuality: async (target: number) => {
        console.log(`[Policy Runtime] 📈 Adjusting quality target: ${target}`);
        // TODO: Update quality target
      },
    });
  }

  /**
   * Register domain controller
   */
  registerController(controller: DomainController): void {
    this.domainControllers.set(controller.name, controller);
  }

  /**
   * Subscribe to domain events
   */
  private subscribeToEvents(): void {
    domainEventBus.subscribeAll(async (event) => {
      await this.handleEvent(event);
    });
  }

  /**
   * Handle domain event with policy-driven control
   */
  private async handleEvent(event: DomainEvent): Promise<void> {
    // Build evaluation context
    const context = this.buildContext(event);

    // Evaluate policies
    const results = await this.interpreter.evaluate(event.type, context);

    // Execute control actions
    for (const result of results) {
      if (result.matched) {
        await this.executeControlActions(result, event, context);
      }
    }
  }

  /**
   * Build evaluation context from event
   */
  private buildContext(event: DomainEvent): Record<string, unknown> {
    const data = event.data;

    // Extract metrics based on event type
    if (event.type.includes("threshold")) {
      return {
        old_value: data.oldValue || 0,
        new_value: data.newValue || 0,
        metric_type: data.metric || "unknown",
      };
    }

    if (event.type.includes("quality")) {
      return {
        old_value: data.oldScore || 0,
        new_value: data.newScore || 0,
        metric_type: "quality_score",
      };
    }

    if (event.type.includes("cost")) {
      return {
        old_value: data.previousCost || 0,
        new_value: data.currentCost || 0,
        metric_type: "cost_per_item",
      };
    }

    return data;
  }

  /**
   * Execute control actions based on policy result
   */
  private async executeControlActions(
    result: any,
    event: DomainEvent,
    context: Record<string, unknown>,
  ): Promise<void> {
    for (const action of result.actionsTriggered) {
      // Rollback actions
      if (action === "rollback:threshold") {
        const controller = this.domainControllers.get("threshold");
        if (controller) {
          await controller.restoreThreshold(
            (context.metric_type as string) || "unknown",
          );
        }
      }

      // Revert actions
      if (action === "rollback:suggest") {
        const controller = this.domainControllers.get("threshold");
        if (controller) {
          await controller.revertConfiguration(event.actor);
        }
      }

      // Block actions
      if (action === "block") {
        const controller = this.domainControllers.get("threshold");
        if (controller) {
          await controller.blockOperation(event.type);
        }
      }

      // Quality adjustment
      if (action.startsWith("adjust:quality")) {
        const controller = this.domainControllers.get("threshold");
        if (controller) {
          await controller.adjustQuality(0.8); // Target 80%
        }
      }
    }
  }

  /**
   * Get registered controllers
   */
  getControllers(): string[] {
    return Array.from(this.domainControllers.keys());
  }
}

/**
 * Global runtime instance
 */
let globalRuntime: PolicyRuntime | null = null;

/**
 * Initialize policy runtime
 */
export async function initializePolicyRuntime(): Promise<PolicyRuntime> {
  if (globalRuntime) {
    return globalRuntime;
  }

  globalRuntime = new PolicyRuntime();
  await globalRuntime.initialize();

  return globalRuntime;
}

/**
 * Get policy runtime
 */
export function getPolicyRuntime(): PolicyRuntime | null {
  return globalRuntime;
}
