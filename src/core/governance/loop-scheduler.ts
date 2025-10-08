/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Loop Scheduler - Adaptive Feedback Loop Interval Control
 *
 * Purpose:
 * - Prevent CPU spikes during external policy parsing
 * - Adjust loop interval based on system workload
 * - Ensure feedback loop doesn't overwhelm the system
 *
 * Phase 2C Preparation: Adaptive timing for external knowledge integration
 */

import type { Logger } from "../../shared/logger.js";

/**
 * Workload metrics for adaptive scheduling
 */
export interface WorkloadMetrics {
  cpuUsage: number; // 0-1 (0% - 100%)
  memoryUsage: number; // 0-1 (0% - 100%)
  activePlugins: number; // Count of active quality checkers
  pendingPolicies: number; // Count of policies waiting to be evaluated
  recentDriftEvents: number; // Drift events in last 5 minutes
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  minInterval?: number; // Minimum interval (ms), default: 2000 (2s)
  maxInterval?: number; // Maximum interval (ms), default: 10000 (10s)
  baseInterval?: number; // Base interval (ms), default: 5000 (5s)

  // Workload thresholds
  cpuThreshold?: number; // CPU usage threshold (0-1), default: 0.7 (70%)
  memoryThreshold?: number; // Memory usage threshold (0-1), default: 0.8 (80%)
  pluginThreshold?: number; // Max concurrent plugins, default: 3

  // Adaptive factors
  cpuFactor?: number; // CPU impact on interval, default: 1.5
  memoryFactor?: number; // Memory impact on interval, default: 1.3
  pluginFactor?: number; // Plugin count impact, default: 1.2

  // Queue management (Phase 2C: Peak load protection)
  maxQueueLength?: number; // Maximum queue length, default: 20
  dropPolicy?: "oldest" | "lowest_priority"; // Drop policy when queue is full, default: "oldest"
  queueMonitoring?: boolean; // Enable queue monitoring, default: true
}

/**
 * Scheduling decision result
 */
export interface SchedulingDecision {
  nextInterval: number; // Next loop interval (ms)
  reason: string; // Reason for interval adjustment
  workload: WorkloadMetrics;
  timestamp: Date;
}

/**
 * Queue item for scheduling
 */
export interface QueueItem {
  id: string;
  priority: 1 | 2 | 3 | 4 | 5; // 1 = highest
  task: () => Promise<void>;
  addedAt: Date;
}

/**
 * Loop Scheduler - Adaptive interval control for feedback loop
 *
 * Adjusts feedback loop execution interval based on:
 * - CPU/Memory usage (system load)
 * - Active plugins count (processing complexity)
 * - Pending policies count (parser workload)
 * - Recent drift events (feedback frequency)
 *
 * Phase 2C Enhancement:
 * - Queue management (prevents event explosion)
 * - Drop policy (oldest or lowest priority)
 * - Queue monitoring (alerts on near-full)
 */
export class LoopScheduler {
  private readonly logger: Logger;
  private readonly config: Required<SchedulerConfig>;
  private currentInterval: number;
  private lastDecision: SchedulingDecision | null = null;
  private queue: QueueItem[] = []; // Event queue
  private droppedCount = 0; // Dropped items counter

  constructor(logger: Logger, config: SchedulerConfig = {}) {
    this.logger = logger;

    // Merge config with defaults
    this.config = {
      minInterval: config.minInterval ?? 2000, // 2s
      maxInterval: config.maxInterval ?? 10000, // 10s
      baseInterval: config.baseInterval ?? 5000, // 5s
      cpuThreshold: config.cpuThreshold ?? 0.7, // 70%
      memoryThreshold: config.memoryThreshold ?? 0.8, // 80%
      pluginThreshold: config.pluginThreshold ?? 3,
      cpuFactor: config.cpuFactor ?? 1.5,
      memoryFactor: config.memoryFactor ?? 1.3,
      pluginFactor: config.pluginFactor ?? 1.2,
      maxQueueLength: config.maxQueueLength ?? 20,
      dropPolicy: config.dropPolicy ?? "oldest",
      queueMonitoring: config.queueMonitoring ?? true,
    };

    this.currentInterval = this.config.baseInterval;
  }

  /**
   * Calculate next loop interval based on current workload
   *
   * Algorithm:
   * 1. Start with base interval (5s)
   * 2. Increase if CPU/Memory high (spike protection)
   * 3. Increase if many plugins active (processing load)
   * 4. Decrease if system idle (faster response)
   * 5. Clamp to [minInterval, maxInterval]
   */
  calculateNextInterval(workload: WorkloadMetrics): SchedulingDecision {
    let interval = this.config.baseInterval;
    const reasons: string[] = [];

    // Factor 1: CPU Usage
    if (workload.cpuUsage > this.config.cpuThreshold) {
      const cpuAdjustment = this.config.cpuFactor;
      interval *= cpuAdjustment;
      reasons.push(
        `CPU high (${(workload.cpuUsage * 100).toFixed(1)}%) → ×${cpuAdjustment}`,
      );
    }

    // Factor 2: Memory Usage
    if (workload.memoryUsage > this.config.memoryThreshold) {
      const memAdjustment = this.config.memoryFactor;
      interval *= memAdjustment;
      reasons.push(
        `Memory high (${(workload.memoryUsage * 100).toFixed(1)}%) → ×${memAdjustment}`,
      );
    }

    // Factor 3: Active Plugins
    if (workload.activePlugins > this.config.pluginThreshold) {
      const pluginAdjustment = this.config.pluginFactor;
      interval *= pluginAdjustment;
      reasons.push(
        `Many plugins (${workload.activePlugins}) → ×${pluginAdjustment}`,
      );
    }

    // Factor 4: Pending Policies (Parser workload)
    if (workload.pendingPolicies > 5) {
      const policyAdjustment = 1.4;
      interval *= policyAdjustment;
      reasons.push(
        `Pending policies (${workload.pendingPolicies}) → ×${policyAdjustment}`,
      );
    }

    // Factor 5: Recent Drift Events (already high feedback frequency)
    if (workload.recentDriftEvents > 3) {
      const driftAdjustment = 1.3;
      interval *= driftAdjustment;
      reasons.push(
        `Frequent drifts (${workload.recentDriftEvents}) → ×${driftAdjustment}`,
      );
    }

    // Factor 6: System Idle (decrease interval for faster response)
    if (
      workload.cpuUsage < 0.3 &&
      workload.memoryUsage < 0.5 &&
      workload.activePlugins <= 1
    ) {
      const idleAdjustment = 0.7;
      interval *= idleAdjustment;
      reasons.push(`System idle → ×${idleAdjustment}`);
    }

    // Clamp to [minInterval, maxInterval]
    const clampedInterval = Math.max(
      this.config.minInterval,
      Math.min(this.config.maxInterval, interval),
    );

    const decision: SchedulingDecision = {
      nextInterval: Math.round(clampedInterval),
      reason:
        reasons.length > 0
          ? reasons.join("; ")
          : "Base interval (no adjustments)",
      workload,
      timestamp: new Date(),
    };

    this.lastDecision = decision;
    this.currentInterval = decision.nextInterval;

    this.logger.info("Loop interval calculated", {
      nextInterval: decision.nextInterval,
      reason: decision.reason,
      workload,
    });

    return decision;
  }

  /**
   * Get current interval
   */
  getCurrentInterval(): number {
    return this.currentInterval;
  }

  /**
   * Get last scheduling decision
   */
  getLastDecision(): SchedulingDecision | null {
    return this.lastDecision;
  }

  /**
   * Reset to base interval (for testing or manual override)
   */
  reset(): void {
    this.currentInterval = this.config.baseInterval;
    this.lastDecision = null;
    this.logger.info("Loop scheduler reset to base interval", {
      interval: this.currentInterval,
    });
  }

  /**
   * Collect workload metrics from system
   *
   * Note: This is a placeholder. Real implementation should:
   * - Use os.cpus() for CPU usage
   * - Use process.memoryUsage() for memory
   * - Query PluginRegistry for active plugins
   * - Query GovernanceKernel for pending policies
   */
  async collectWorkloadMetrics(): Promise<WorkloadMetrics> {
    // Placeholder implementation
    // TODO: Integrate with actual system metrics

    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;

    return {
      cpuUsage: 0.5, // Placeholder: 50%
      memoryUsage: usedMem / totalMem,
      activePlugins: 1, // Placeholder: 1 plugin
      pendingPolicies: 0, // Placeholder: 0 pending
      recentDriftEvents: 0, // Placeholder: 0 events
    };
  }

  /**
   * Auto-schedule next feedback loop execution
   *
   * This method:
   * 1. Collects current workload metrics
   * 2. Calculates optimal interval
   * 3. Returns interval for setTimeout/setInterval
   */
  async scheduleNext(): Promise<number> {
    const workload = await this.collectWorkloadMetrics();
    const decision = this.calculateNextInterval(workload);

    this.logger.info("Next feedback loop scheduled", {
      interval: decision.nextInterval,
      reason: decision.reason,
    });

    return decision.nextInterval;
  }

  /**
   * Add task to queue
   *
   * If queue is full, applies drop policy:
   * - "oldest": Drop oldest item
   * - "lowest_priority": Drop lowest priority item
   */
  enqueue(item: QueueItem): boolean {
    // Check if queue is full
    if (this.queue.length >= this.config.maxQueueLength) {
      this.logger.warn("Queue full, applying drop policy", {
        queueLength: this.queue.length,
        maxLength: this.config.maxQueueLength,
        dropPolicy: this.config.dropPolicy,
      });

      // Apply drop policy
      if (this.config.dropPolicy === "oldest") {
        const dropped = this.queue.shift(); // Remove oldest (first item)
        this.droppedCount++;
        this.logger.warn("Dropped oldest item from queue", {
          droppedId: dropped?.id,
          droppedCount: this.droppedCount,
        });
      } else if (this.config.dropPolicy === "lowest_priority") {
        // Find lowest priority item (highest priority number)
        let lowestPriorityIndex = 0;
        let lowestPriority = this.queue[0]?.priority ?? 5;

        for (let i = 1; i < this.queue.length; i++) {
          if (this.queue[i].priority > lowestPriority) {
            lowestPriority = this.queue[i].priority;
            lowestPriorityIndex = i;
          }
        }

        const dropped = this.queue.splice(lowestPriorityIndex, 1)[0];
        this.droppedCount++;
        this.logger.warn("Dropped lowest priority item from queue", {
          droppedId: dropped?.id,
          droppedPriority: dropped?.priority,
          droppedCount: this.droppedCount,
        });
      }
    }

    // Add item to queue
    this.queue.push(item);

    // Queue monitoring alert (near-full warning)
    if (
      this.config.queueMonitoring &&
      this.queue.length >= this.config.maxQueueLength * 0.8
    ) {
      this.logger.warn("Queue near-full (80%)", {
        queueLength: this.queue.length,
        maxLength: this.config.maxQueueLength,
        utilization: (this.queue.length / this.config.maxQueueLength) * 100,
      });
    }

    this.logger.info("Task enqueued", {
      taskId: item.id,
      priority: item.priority,
      queueLength: this.queue.length,
    });

    return true;
  }

  /**
   * Dequeue next task (highest priority first)
   */
  dequeue(): QueueItem | undefined {
    if (this.queue.length === 0) {
      return undefined;
    }

    // Sort by priority (1 = highest, 5 = lowest)
    this.queue.sort((a, b) => a.priority - b.priority);

    const item = this.queue.shift();

    this.logger.info("Task dequeued", {
      taskId: item?.id,
      priority: item?.priority,
      remainingInQueue: this.queue.length,
    });

    return item;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    length: number;
    maxLength: number;
    utilization: number;
    droppedCount: number;
  } {
    return {
      length: this.queue.length,
      maxLength: this.config.maxQueueLength,
      utilization:
        (this.queue.length / this.config.maxQueueLength) * 100,
      droppedCount: this.droppedCount,
    };
  }

  /**
   * Clear queue (for testing or emergency)
   */
  clearQueue(): void {
    const cleared = this.queue.length;
    this.queue = [];
    this.logger.warn("Queue cleared", { clearedItems: cleared });
  }

  /**
   * Get scheduler configuration
   */
  getConfig(): Required<SchedulerConfig> {
    return { ...this.config };
  }
}

/**
 * Create default loop scheduler
 */
export function createLoopScheduler(logger: Logger): LoopScheduler {
  return new LoopScheduler(logger, {
    minInterval: 2000, // 2s minimum
    maxInterval: 10000, // 10s maximum
    baseInterval: 5000, // 5s base
  });
}
