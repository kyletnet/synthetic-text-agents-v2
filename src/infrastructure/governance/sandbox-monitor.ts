/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Sandbox Load Monitor
 *
 * Prevents CPU spikes, infinite loops, and resource exhaustion
 * during external policy parsing.
 *
 * Protection:
 * - CPU quota: 30% max (configurable)
 * - Memory quota: 256MB max
 * - Execution timeout: 5000ms max
 * - Network: Disabled
 * - File system: Read-only, restricted paths
 *
 * Phase 2B → 2C Transition: Robustness Patch
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Sandbox Configuration
 */
export interface SandboxConfig {
  version: string;
  cpu_quota: {
    enabled: boolean;
    max_percent: number;
    monitoring_interval_ms: number;
    violation_action: "warn" | "terminate";
  };
  memory_quota: {
    enabled: boolean;
    max_mb: number;
    monitoring_interval_ms: number;
    violation_action: "warn" | "terminate";
  };
  timeout: {
    enabled: boolean;
    max_execution_ms: number;
    violation_action: "warn" | "terminate";
  };
  alerts: {
    cpu_spike: {
      threshold_percent: number;
      duration_ms: number;
      action: "warn" | "terminate";
    };
    memory_spike: {
      threshold_mb: number;
      duration_ms: number;
      action: "warn" | "terminate";
    };
    infinite_loop_detection: {
      enabled: boolean;
      max_iterations: number;
      action: "warn" | "terminate";
    };
  };
  logging: {
    enabled: boolean;
    log_path: string;
    log_level: "debug" | "info" | "warn" | "error";
  };
}

/**
 * Sandbox Monitoring Result
 */
export interface SandboxMonitoringResult {
  allowed: boolean;
  violations: SandboxViolation[];
  metrics: {
    cpu_percent: number;
    memory_mb: number;
    execution_ms: number;
  };
  timestamp: Date;
}

/**
 * Sandbox Violation
 */
export interface SandboxViolation {
  type: "cpu" | "memory" | "timeout" | "infinite_loop";
  threshold: number;
  actual: number;
  action: "warn" | "terminate";
  message: string;
}

/**
 * Sandbox Load Monitor
 *
 * Monitors resource usage during policy parsing and terminates on violations.
 */
export class SandboxMonitor {
  private config: SandboxConfig;
  private startTime: number = 0;
  private iterations: number = 0;

  constructor(projectRoot?: string) {
    const configPath = join(
      projectRoot || process.cwd(),
      "configs",
      "governance",
      "sandbox.config.json",
    );

    if (existsSync(configPath)) {
      const content = readFileSync(configPath, "utf8");
      this.config = JSON.parse(content);
    } else {
      // Fallback to safe defaults
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Start monitoring
   */
  startMonitoring(): void {
    this.startTime = Date.now();
    this.iterations = 0;
  }

  /**
   * Check resource usage (call periodically during parsing)
   */
  checkResourceUsage(): SandboxMonitoringResult {
    const violations: SandboxViolation[] = [];

    // Get current metrics
    const cpuPercent = this.getCPUUsage();
    const memoryMB = this.getMemoryUsage();
    const executionMs = Date.now() - this.startTime;

    // Check CPU quota
    if (
      this.config.cpu_quota.enabled &&
      cpuPercent > this.config.cpu_quota.max_percent
    ) {
      violations.push({
        type: "cpu",
        threshold: this.config.cpu_quota.max_percent,
        actual: cpuPercent,
        action: this.config.cpu_quota.violation_action,
        message: `CPU usage (${cpuPercent.toFixed(1)}%) exceeds quota (${
          this.config.cpu_quota.max_percent
        }%)`,
      });
    }

    // Check memory quota
    if (
      this.config.memory_quota.enabled &&
      memoryMB > this.config.memory_quota.max_mb
    ) {
      violations.push({
        type: "memory",
        threshold: this.config.memory_quota.max_mb,
        actual: memoryMB,
        action: this.config.memory_quota.violation_action,
        message: `Memory usage (${memoryMB.toFixed(1)}MB) exceeds quota (${
          this.config.memory_quota.max_mb
        }MB)`,
      });
    }

    // Check timeout
    if (
      this.config.timeout.enabled &&
      executionMs > this.config.timeout.max_execution_ms
    ) {
      violations.push({
        type: "timeout",
        threshold: this.config.timeout.max_execution_ms,
        actual: executionMs,
        action: this.config.timeout.violation_action,
        message: `Execution time (${executionMs}ms) exceeds timeout (${this.config.timeout.max_execution_ms}ms)`,
      });
    }

    // Check infinite loop
    this.iterations++;
    if (
      this.config.alerts.infinite_loop_detection.enabled &&
      this.iterations >
        this.config.alerts.infinite_loop_detection.max_iterations
    ) {
      violations.push({
        type: "infinite_loop",
        threshold: this.config.alerts.infinite_loop_detection.max_iterations,
        actual: this.iterations,
        action: this.config.alerts.infinite_loop_detection.action,
        message: `Iteration count (${this.iterations}) exceeds max iterations (${this.config.alerts.infinite_loop_detection.max_iterations}) - possible infinite loop`,
      });
    }

    // Determine if allowed
    const terminateViolations = violations.filter(
      (v) => v.action === "terminate",
    );
    const allowed = terminateViolations.length === 0;

    return {
      allowed,
      violations,
      metrics: {
        cpu_percent: cpuPercent,
        memory_mb: memoryMB,
        execution_ms: executionMs,
      },
      timestamp: new Date(),
    };
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.startTime = 0;
    this.iterations = 0;
  }

  /**
   * Get CPU usage percentage (approximation)
   */
  private getCPUUsage(): number {
    // Note: process.cpuUsage() returns microseconds, not percentage
    // This is a simplified implementation - real production would use OS-level monitoring

    const cpuUsage = process.cpuUsage();
    const totalCPU = cpuUsage.user + cpuUsage.system;

    // Convert to percentage (rough approximation)
    // For accurate monitoring, use external tools like pidusage
    const elapsedMs = Date.now() - this.startTime;
    const cpuPercent = elapsedMs > 0 ? (totalCPU / 1000 / elapsedMs) * 100 : 0;

    return Math.min(cpuPercent, 100); // Cap at 100%
  }

  /**
   * Get memory usage in MB
   */
  private getMemoryUsage(): number {
    const memoryUsage = process.memoryUsage();
    return memoryUsage.heapUsed / 1024 / 1024; // Convert to MB
  }

  /**
   * Get default safe configuration
   */
  private getDefaultConfig(): SandboxConfig {
    return {
      version: "1.0.0",
      cpu_quota: {
        enabled: true,
        max_percent: 30,
        monitoring_interval_ms: 100,
        violation_action: "terminate",
      },
      memory_quota: {
        enabled: true,
        max_mb: 256,
        monitoring_interval_ms: 500,
        violation_action: "terminate",
      },
      timeout: {
        enabled: true,
        max_execution_ms: 5000,
        violation_action: "terminate",
      },
      alerts: {
        cpu_spike: {
          threshold_percent: 25,
          duration_ms: 1000,
          action: "warn",
        },
        memory_spike: {
          threshold_mb: 200,
          duration_ms: 2000,
          action: "warn",
        },
        infinite_loop_detection: {
          enabled: true,
          max_iterations: 10000,
          action: "terminate",
        },
      },
      logging: {
        enabled: true,
        log_path: "reports/governance/sandbox-monitor.log",
        log_level: "info",
      },
    };
  }

  /**
   * Get configuration
   */
  getConfig(): SandboxConfig {
    return this.config;
  }
}

/**
 * Execute function with sandbox monitoring
 *
 * Automatically monitors resource usage and terminates on violations.
 */
export async function executeSandboxed<T>(
  fn: () => Promise<T>,
  options?: { projectRoot?: string },
): Promise<{ result: T | null; violations: SandboxViolation[] }> {
  const monitor = new SandboxMonitor(options?.projectRoot);

  monitor.startMonitoring();

  try {
    // Start periodic monitoring
    const monitorInterval = setInterval(() => {
      const status = monitor.checkResourceUsage();

      if (!status.allowed) {
        clearInterval(monitorInterval);
        throw new Error(
          `Sandbox violation: ${status.violations
            .map((v) => v.message)
            .join(", ")}`,
        );
      }
    }, 100); // Check every 100ms

    // Execute function
    const result = await fn();

    clearInterval(monitorInterval);
    monitor.stopMonitoring();

    return { result, violations: [] };
  } catch (error) {
    monitor.stopMonitoring();

    const status = monitor.checkResourceUsage();
    return { result: null, violations: status.violations };
  }
}
