/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Fairness Scheduler - Priority Aging + Quota Management
 *
 * Purpose:
 * - Prevent agent starvation (low priority requests get starved)
 * - Fair resource allocation across agents
 * - Priority aging (older requests get higher priority)
 * - Quota management per agent
 *
 * Phase 1: Multi-Agent Bus Expansion
 */

/**
 * Scheduler Priority (1 = highest, 5 = lowest)
 */
export type SchedulerPriority = 1 | 2 | 3 | 4 | 5;

/**
 * Scheduled Task
 */
export interface ScheduledTask {
  taskId: string;
  agentId: string;
  priority: SchedulerPriority;
  submittedAt: number; // Unix timestamp
  estimatedDuration?: number; // Estimated duration in ms
  metadata?: {
    type?: string;
    description?: string;
    context?: Record<string, unknown>;
  };
}

/**
 * Task Result
 */
export interface TaskResult {
  taskId: string;
  agentId: string;
  success: boolean;
  duration: number; // Actual duration in ms
  error?: string;
}

/**
 * Agent Quota
 */
export interface AgentQuota {
  agentId: string;
  maxConcurrent: number; // Max concurrent tasks
  maxPerMinute: number; // Max tasks per minute
  maxPerHour: number; // Max tasks per hour
}

/**
 * Scheduler Config
 */
export interface SchedulerConfig {
  agingFactor: number; // Priority aging factor (default: 0.1)
  agingInterval: number; // Aging interval in ms (default: 10000 = 10s)
  quotaEnabled: boolean; // Enable quota management
  fairnessEnabled: boolean; // Enable fairness (prevent starvation)
}

/**
 * Scheduler Statistics
 */
export interface SchedulerStats {
  totalSubmitted: number;
  totalCompleted: number;
  totalFailed: number;
  avgWaitTime: number; // Average wait time in ms
  avgDuration: number; // Average execution duration in ms
  queueLength: number;
  activeTasksCount: number;
  agentBreakdown: Record<
    string,
    {
      submitted: number;
      completed: number;
      failed: number;
      avgWaitTime: number;
    }
  >;
}

/**
 * Fairness Scheduler
 */
export class FairnessScheduler {
  private queue: ScheduledTask[] = [];
  private activeTasks: Map<string, ScheduledTask> = new Map(); // taskId -> task
  private agentQuotas: Map<string, AgentQuota> = new Map(); // agentId -> quota
  private agentUsage: Map<string, { minute: number[]; hour: number[] }> =
    new Map(); // agentId -> usage timestamps
  private agentStats: Map<
    string,
    { submitted: number; completed: number; failed: number; waitTimes: number[] }
  > = new Map();

  private totalSubmitted: number = 0;
  private totalCompleted: number = 0;
  private totalFailed: number = 0;

  private config: SchedulerConfig;
  private agingTimer?: NodeJS.Timeout;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      agingFactor: config?.agingFactor ?? 0.1,
      agingInterval: config?.agingInterval ?? 10000, // 10 seconds
      quotaEnabled: config?.quotaEnabled ?? true,
      fairnessEnabled: config?.fairnessEnabled ?? true,
    };

    // Start priority aging
    if (this.config.fairnessEnabled) {
      this.startPriorityAging();
    }
  }

  /**
   * Submit task to scheduler
   *
   * @param task - Scheduled task
   * @returns True if submitted successfully
   */
  submit(task: ScheduledTask): boolean {
    // 1. Check quota
    if (this.config.quotaEnabled) {
      const quota = this.agentQuotas.get(task.agentId);

      if (quota) {
        // Check concurrent limit
        const agentActiveTasks = Array.from(this.activeTasks.values()).filter(
          (t) => t.agentId === task.agentId,
        ).length;

        if (agentActiveTasks >= quota.maxConcurrent) {
          return false; // Quota exceeded (concurrent)
        }

        // Check rate limits
        const usage = this.agentUsage.get(task.agentId);
        if (usage) {
          const now = Date.now();

          // Per-minute limit
          const minuteAgo = now - 60000;
          const recentMinute = usage.minute.filter((t) => t > minuteAgo);
          if (recentMinute.length >= quota.maxPerMinute) {
            return false; // Quota exceeded (per minute)
          }

          // Per-hour limit
          const hourAgo = now - 3600000;
          const recentHour = usage.hour.filter((t) => t > hourAgo);
          if (recentHour.length >= quota.maxPerHour) {
            return false; // Quota exceeded (per hour)
          }
        }
      }
    }

    // 2. Add to queue
    this.queue.push(task);
    this.totalSubmitted++;

    // 3. Update agent stats
    const stats = this.agentStats.get(task.agentId) || {
      submitted: 0,
      completed: 0,
      failed: 0,
      waitTimes: [],
    };
    stats.submitted++;
    this.agentStats.set(task.agentId, stats);

    // 4. Sort queue by effective priority
    this.sortQueue();

    return true;
  }

  /**
   * Get next task from queue
   *
   * @returns Next task or null if queue is empty
   */
  next(): ScheduledTask | null {
    if (this.queue.length === 0) {
      return null;
    }

    // Get highest priority task
    const task = this.queue.shift()!;

    // Move to active tasks
    this.activeTasks.set(task.taskId, task);

    // Record usage timestamp
    const now = Date.now();
    const usage = this.agentUsage.get(task.agentId) || { minute: [], hour: [] };
    usage.minute.push(now);
    usage.hour.push(now);
    this.agentUsage.set(task.agentId, usage);

    // Record wait time
    const waitTime = now - task.submittedAt;
    const stats = this.agentStats.get(task.agentId)!;
    stats.waitTimes.push(waitTime);

    return task;
  }

  /**
   * Complete task
   *
   * @param result - Task result
   */
  complete(result: TaskResult): void {
    // Remove from active tasks
    this.activeTasks.delete(result.taskId);

    // Update stats
    if (result.success) {
      this.totalCompleted++;
      const stats = this.agentStats.get(result.agentId);
      if (stats) {
        stats.completed++;
      }
    } else {
      this.totalFailed++;
      const stats = this.agentStats.get(result.agentId);
      if (stats) {
        stats.failed++;
      }
    }
  }

  /**
   * Set agent quota
   *
   * @param agentId - Agent ID
   * @param quota - Agent quota
   */
  setAgentQuota(agentId: string, quota: AgentQuota): void {
    this.agentQuotas.set(agentId, quota);
  }

  /**
   * Get queue length
   */
  getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * Get active tasks count
   */
  getActiveTasksCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Get scheduler statistics
   */
  getStats(): SchedulerStats {
    const agentBreakdown: SchedulerStats["agentBreakdown"] = {};

    for (const [agentId, stats] of this.agentStats.entries()) {
      agentBreakdown[agentId] = {
        submitted: stats.submitted,
        completed: stats.completed,
        failed: stats.failed,
        avgWaitTime:
          stats.waitTimes.length > 0
            ? stats.waitTimes.reduce((sum, t) => sum + t, 0) / stats.waitTimes.length
            : 0,
      };
    }

    const allWaitTimes = Array.from(this.agentStats.values()).flatMap(
      (s) => s.waitTimes,
    );
    const avgWaitTime =
      allWaitTimes.length > 0
        ? allWaitTimes.reduce((sum, t) => sum + t, 0) / allWaitTimes.length
        : 0;

    return {
      totalSubmitted: this.totalSubmitted,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed,
      avgWaitTime,
      avgDuration: 0, // TODO: track actual durations
      queueLength: this.queue.length,
      activeTasksCount: this.activeTasks.size,
      agentBreakdown,
    };
  }

  /**
   * Clear queue (for testing/emergency)
   */
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * Shutdown scheduler
   */
  shutdown(): void {
    if (this.agingTimer) {
      clearInterval(this.agingTimer);
      this.agingTimer = undefined;
    }
  }

  /**
   * Start priority aging
   *
   * Increases priority of tasks that have been waiting longer
   * to prevent starvation
   */
  private startPriorityAging(): void {
    this.agingTimer = setInterval(() => {
      const now = Date.now();

      for (const task of this.queue) {
        const waitTime = now - task.submittedAt;

        // Age priority every agingInterval (10s by default)
        const ageIncrements = Math.floor(waitTime / this.config.agingInterval);

        if (ageIncrements > 0 && task.priority > 1) {
          // Increase priority (lower number = higher priority)
          const newPriority = Math.max(
            1,
            task.priority - ageIncrements * this.config.agingFactor,
          ) as SchedulerPriority;

          task.priority = newPriority;
        }
      }

      // Re-sort queue after aging
      this.sortQueue();
    }, this.config.agingInterval);
  }

  /**
   * Sort queue by effective priority
   *
   * Considers:
   * 1. Priority (1 = highest)
   * 2. Wait time (FIFO for same priority)
   * 3. Agent fairness (distribute load)
   */
  private sortQueue(): void {
    this.queue.sort((a, b) => {
      // 1. Priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }

      // 2. Fairness: Prefer agents with fewer active tasks
      if (this.config.fairnessEnabled) {
        const aActiveTasks = Array.from(this.activeTasks.values()).filter(
          (t) => t.agentId === a.agentId,
        ).length;
        const bActiveTasks = Array.from(this.activeTasks.values()).filter(
          (t) => t.agentId === b.agentId,
        ).length;

        if (aActiveTasks !== bActiveTasks) {
          return aActiveTasks - bActiveTasks;
        }
      }

      // 3. FIFO (older tasks first)
      return a.submittedAt - b.submittedAt;
    });
  }
}

/**
 * Global scheduler instance
 */
let globalScheduler: FairnessScheduler | null = null;

/**
 * Get global scheduler
 *
 * @returns Global scheduler instance
 */
export function getGlobalScheduler(): FairnessScheduler {
  if (!globalScheduler) {
    globalScheduler = new FairnessScheduler();
  }
  return globalScheduler;
}

/**
 * Reset global scheduler (for testing)
 */
export function resetGlobalScheduler(): void {
  if (globalScheduler) {
    globalScheduler.shutdown();
    globalScheduler = null;
  }
}
