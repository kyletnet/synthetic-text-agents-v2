/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Operation Logger - Comprehensive audit trail
 *
 * Purpose:
 * - Log all governance operations to JSONL
 * - Enable forensic analysis
 * - Support compliance audits
 *
 * Design:
 * - JSONL format for efficient appending
 * - Structured logging with consistent schema
 * - Query and aggregation support
 */

import {
  existsSync,
  appendFileSync,
  readFileSync,
  mkdirSync,
  statSync,
} from "fs";
import { join, dirname } from "path";
import { execSync } from "child_process";
import type {
  OperationLog,
  OperationDetails,
  LogQueryFilters,
  LogQueryResult,
  PerformanceMetrics,
} from "./operation-log.schema.js";

export class OperationLogger {
  private projectRoot: string;
  private logPath: string;
  private currentOperation: Map<
    string,
    { startTime: number; startMemory: NodeJS.MemoryUsage }
  > = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.logPath = join(
      projectRoot,
      "reports",
      "operations",
      "governance.jsonl",
    );

    // Ensure directory exists
    const dir = dirname(this.logPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Start operation logging
   */
  startOperation(context: {
    name: string;
    type: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): string {
    const operationId = this.generateOperationId();

    // Store start time and memory
    this.currentOperation.set(operationId, {
      startTime: Date.now(),
      startMemory: process.memoryUsage(),
    });

    const log: OperationLog = {
      id: operationId,
      timestamp: new Date().toISOString(),
      operation: context.name,
      phase: "preflight",
      status: "started",
      duration: null,
      details: {
        description: context.description,
        ...context.metadata,
      },
      environment: this.getEnvironment(),
    };

    this.appendLog(log);

    return operationId;
  }

  /**
   * End operation logging
   */
  endOperation(
    operationId: string,
    status: "success" | "failure" | "warning",
    details?: unknown,
  ): void {
    const operationData = this.currentOperation.get(operationId);
    if (!operationData) {
      console.warn(
        `⚠️  Operation ${operationId} not found in current operations`,
      );
      return;
    }

    const duration = Date.now() - operationData.startTime;
    const metrics = this.calculateMetrics(operationData.startMemory);

    const log: OperationLog = {
      id: operationId,
      timestamp: new Date().toISOString(),
      operation: "end",
      phase: "verification",
      status,
      duration,
      details: (details || {}) as OperationDetails,
      metrics,
      environment: this.getEnvironment(),
    };

    this.appendLog(log);

    // Cleanup
    this.currentOperation.delete(operationId);
  }

  /**
   * Log operation phase
   */
  logPhase(
    operationId: string,
    phase: "preflight" | "execution" | "verification" | "cleanup",
    status: "started" | "success" | "failure" | "warning",
    details?: unknown,
  ): void {
    const log: OperationLog = {
      id: operationId,
      timestamp: new Date().toISOString(),
      operation: `phase-${phase}`,
      phase,
      status,
      duration: null,
      details: (details || {}) as OperationDetails,
      environment: this.getEnvironment(),
    };

    this.appendLog(log);
  }

  /**
   * Log error
   */
  logError(operationId: string, error: Error, details?: unknown): void {
    const log: OperationLog = {
      id: operationId,
      timestamp: new Date().toISOString(),
      operation: "error",
      phase: "execution",
      status: "failure",
      duration: null,
      details: (details || {}) as OperationDetails,
      error: {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name,
      },
      environment: this.getEnvironment(),
    };

    this.appendLog(log);
  }

  /**
   * Query logs
   */
  async query(filters: LogQueryFilters = {}): Promise<LogQueryResult> {
    if (!existsSync(this.logPath)) {
      return {
        logs: [],
        total: 0,
        page: filters.page || 1,
        pageSize: filters.pageSize || 50,
      };
    }

    const content = readFileSync(this.logPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    let logs: OperationLog[] = lines.map((line) => JSON.parse(line));

    // Apply filters
    logs = this.applyFilters(logs, filters);

    // Pagination
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;

    return {
      logs: logs.slice(start, end),
      total: logs.length,
      page,
      pageSize,
    };
  }

  /**
   * Get recent logs
   */
  async getRecent(limit: number = 10): Promise<OperationLog[]> {
    const result = await this.query({ pageSize: limit, page: 1 });
    return result.logs;
  }

  /**
   * Get logs by operation ID
   */
  async getByOperationId(operationId: string): Promise<OperationLog[]> {
    const result = await this.query({ pageSize: 1000 });
    return result.logs.filter((log) => log.id === operationId);
  }

  /**
   * Append log to JSONL file
   */
  private appendLog(log: OperationLog): void {
    const line = JSON.stringify(log) + "\n";
    appendFileSync(this.logPath, line, "utf8");
  }

  /**
   * Apply filters to logs
   */
  private applyFilters(
    logs: OperationLog[],
    filters: LogQueryFilters,
  ): OperationLog[] {
    let filtered = logs;

    // Filter by operation
    if (filters.operation) {
      const operations = Array.isArray(filters.operation)
        ? filters.operation
        : [filters.operation];
      filtered = filtered.filter((log) => operations.includes(log.operation));
    }

    // Filter by status
    if (filters.status) {
      const statuses = Array.isArray(filters.status)
        ? filters.status
        : [filters.status];
      filtered = filtered.filter((log) => statuses.includes(log.status));
    }

    // Filter by phase
    if (filters.phase) {
      const phases = Array.isArray(filters.phase)
        ? filters.phase
        : [filters.phase];
      filtered = filtered.filter((log) => phases.includes(log.phase));
    }

    // Filter by date range
    if (filters.dateRange) {
      const from = new Date(filters.dateRange.from).getTime();
      const to = new Date(filters.dateRange.to).getTime();
      filtered = filtered.filter((log) => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= from && logTime <= to;
      });
    }

    // Filter by error presence
    if (filters.hasError !== undefined) {
      filtered = filtered.filter((log) =>
        filters.hasError ? !!log.error : !log.error,
      );
    }

    // Filter by snapshot presence
    if (filters.hasSnapshot !== undefined) {
      filtered = filtered.filter((log) =>
        filters.hasSnapshot ? !!log.snapshots : !log.snapshots,
      );
    }

    // Sort
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        const aVal = a[filters.sortBy!];
        const bVal = b[filters.sortBy!];

        if (aVal === null || bVal === null) return 0;
        if (aVal < bVal) return filters.sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return filters.sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }

  /**
   * Calculate performance metrics
   */
  private calculateMetrics(
    startMemory: NodeJS.MemoryUsage,
  ): PerformanceMetrics {
    const currentMemory = process.memoryUsage();

    return {
      memoryUsage: {
        heapUsed: currentMemory.heapUsed,
        heapTotal: currentMemory.heapTotal,
        external: currentMemory.external,
        rss: currentMemory.rss,
      },
    };
  }

  /**
   * Get environment context
   */
  private getEnvironment(): OperationLog["environment"] {
    return {
      node: process.version,
      npm: this.getNpmVersion(),
      platform: process.platform,
      cwd: process.cwd(),
      gitBranch: this.getGitBranch(),
      gitCommit: this.getGitCommit(),
    };
  }

  /**
   * Get npm version
   */
  private getNpmVersion(): string {
    try {
      return execSync("npm --version", { encoding: "utf8" }).trim();
    } catch {
      return "unknown";
    }
  }

  /**
   * Get Git branch
   */
  private getGitBranch(): string {
    try {
      return execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf8",
        cwd: this.projectRoot,
      }).trim();
    } catch {
      return "unknown";
    }
  }

  /**
   * Get Git commit
   */
  private getGitCommit(): string {
    try {
      return execSync("git rev-parse HEAD", {
        encoding: "utf8",
        cwd: this.projectRoot,
      }).trim();
    } catch {
      return "unknown";
    }
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Get log file size
   */
  getLogSize(): number {
    if (!existsSync(this.logPath)) return 0;
    return statSync(this.logPath).size;
  }

  /**
   * Display statistics
   */
  async displayStatistics(): Promise<void> {
    const result = await this.query({ pageSize: 1000 });

    const successCount = result.logs.filter(
      (l) => l.status === "success",
    ).length;
    const failureCount = result.logs.filter(
      (l) => l.status === "failure",
    ).length;

    console.log("\n📊 Operation Log Statistics:");
    console.log(`   Total operations: ${result.total}`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failure: ${failureCount}`);
    console.log(
      `   Success rate: ${
        result.total > 0 ? ((successCount / result.total) * 100).toFixed(1) : 0
      }%`,
    );
    console.log(`   Log size: ${(this.getLogSize() / 1024).toFixed(2)} KB\n`);
  }
}

/**
 * Global singleton instance
 */
let globalOperationLogger: OperationLogger | null = null;

export function getOperationLogger(projectRoot?: string): OperationLogger {
  if (!globalOperationLogger) {
    globalOperationLogger = new OperationLogger(projectRoot);
  }
  return globalOperationLogger;
}
