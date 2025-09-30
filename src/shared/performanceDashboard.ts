/**
 * Performance Dashboard Data Provider
 * Generates real-time performance data for monitoring dashboards
 */

import { PerformanceMonitor } from "./performanceMonitoring";
import { Logger } from "./logger";

export interface DashboardMetrics {
  overview: {
    uptime: number;
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
  };

  agents: {
    name: string;
    executionCount: number;
    averageExecutionTime: number;
    averageQualityScore: number;
    errorRate: number;
    lastExecution: Date | null;
  }[];

  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    activeConnections: number;
  };

  trends: {
    responseTime: TimeSeriesData[];
    throughput: TimeSeriesData[];
    errorRate: TimeSeriesData[];
    qualityScore: TimeSeriesData[];
  };

  alerts: Alert[];
  topErrors: ErrorSummary[];
}

export interface TimeSeriesData {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface Alert {
  id: string;
  level: "info" | "warning" | "error" | "critical";
  title: string;
  description: string;
  timestamp: Date;
  acknowledged: boolean;
  source: string;
}

export interface ErrorSummary {
  errorType: string;
  message: string;
  count: number;
  lastOccurrence: Date;
  affectedAgents: string[];
}

export class PerformanceDashboard {
  private performanceMonitor: PerformanceMonitor;
  private logger: Logger;
  private alerts: Alert[] = [];
  private alertThresholds: AlertThresholds;

  constructor(
    performanceMonitor: PerformanceMonitor,
    alertThresholds?: Partial<AlertThresholds>,
  ) {
    this.performanceMonitor = performanceMonitor;
    this.logger = new Logger({ level: "info" });
    this.alertThresholds = {
      responseTimeWarning: 1000,
      responseTimeCritical: 5000,
      errorRateWarning: 0.05,
      errorRateCritical: 0.15,
      cpuUsageWarning: 70,
      cpuUsageCritical: 90,
      memoryUsageWarning: 80,
      memoryUsageCritical: 95,
      qualityScoreWarning: 7.0,
      qualityScoreCritical: 6.0,
      ...alertThresholds,
    };
  }

  async getDashboardMetrics(
    timeWindow: number = 300000,
  ): Promise<DashboardMetrics> {
    try {
      const [overview, agents, system, trends, topErrors] = await Promise.all([
        this.getOverviewMetrics(timeWindow),
        this.getAgentMetrics(timeWindow),
        this.getSystemMetrics(),
        this.getTrendMetrics(timeWindow),
        this.getTopErrors(timeWindow),
      ]);

      // Generate alerts based on current metrics
      this.generateAlerts(overview, agents, system);

      return {
        overview,
        agents,
        system,
        trends,
        alerts: this.getActiveAlerts(),
        topErrors,
      };
    } catch (error) {
      this.logger.error("Failed to get dashboard metrics:", error);
      throw error;
    }
  }

  private async getOverviewMetrics(
    timeWindow: number,
  ): Promise<DashboardMetrics["overview"]> {
    const summary = this.performanceMonitor.getPerformanceSummary(timeWindow);
    const uptime = Date.now() - process.uptime() * 1000;

    return {
      uptime,
      totalRequests: summary.transactions.total,
      averageResponseTime: summary.transactions.averageDuration,
      errorRate:
        summary.transactions.total > 0
          ? summary.transactions.failed / summary.transactions.total
          : 0,
      throughput: summary.transactions.total / (timeWindow / 1000), // requests per second
    };
  }

  private async getAgentMetrics(
    timeWindow: number,
  ): Promise<DashboardMetrics["agents"]> {
    const agentMetrics = this.getAgentPerformanceData(timeWindow);

    return Object.entries(agentMetrics).map(([agentName, data]) => ({
      name: agentName,
      executionCount: data.executions.length,
      averageExecutionTime:
        data.executions.reduce((sum, exec) => sum + exec.duration, 0) /
          data.executions.length || 0,
      averageQualityScore:
        data.qualityScores.reduce((sum, score) => sum + score, 0) /
          data.qualityScores.length || 0,
      errorRate: data.errors.length / Math.max(data.executions.length, 1),
      lastExecution:
        data.executions.length > 0
          ? new Date(
              Math.max(...data.executions.map((e) => e.timestamp.getTime())),
            )
          : null,
    }));
  }

  private async getSystemMetrics(): Promise<DashboardMetrics["system"]> {
    const systemMetrics = await this.performanceMonitor.getSystemMetrics();

    return {
      cpuUsage: systemMetrics.cpu.usage,
      memoryUsage:
        (systemMetrics.memory.used / systemMetrics.memory.total) * 100,
      diskUsage: (systemMetrics.disk.used / systemMetrics.disk.total) * 100,
      activeConnections: systemMetrics.network.connectionsActive,
    };
  }

  private async getTrendMetrics(
    timeWindow: number,
  ): Promise<DashboardMetrics["trends"]> {
    const bucketSize = Math.max(timeWindow / 50, 60000); // At least 1 minute buckets
    const buckets = Math.floor(timeWindow / bucketSize);
    const now = Date.now();

    const responseTime: TimeSeriesData[] = [];
    const throughput: TimeSeriesData[] = [];
    const errorRate: TimeSeriesData[] = [];
    const qualityScore: TimeSeriesData[] = [];

    for (let i = buckets; i >= 0; i--) {
      const bucketStart = now - i * bucketSize;
      const bucketEnd = bucketStart + bucketSize;
      const timestamp = new Date(bucketStart);

      const bucketMetrics = this.getMetricsInTimeRange(bucketStart, bucketEnd);

      // Response time trend
      const avgResponseTime =
        bucketMetrics.responseTimes.reduce((sum, rt) => sum + rt, 0) /
          bucketMetrics.responseTimes.length || 0;
      responseTime.push({ timestamp, value: avgResponseTime });

      // Throughput trend
      const requestCount = bucketMetrics.requestCount;
      const bucketThroughput = requestCount / (bucketSize / 1000);
      throughput.push({ timestamp, value: bucketThroughput });

      // Error rate trend
      const bucketErrorRate =
        requestCount > 0 ? bucketMetrics.errorCount / requestCount : 0;
      errorRate.push({ timestamp, value: bucketErrorRate });

      // Quality score trend
      const avgQualityScore =
        bucketMetrics.qualityScores.reduce((sum, qs) => sum + qs, 0) /
          bucketMetrics.qualityScores.length || 0;
      qualityScore.push({ timestamp, value: avgQualityScore });
    }

    return {
      responseTime,
      throughput,
      errorRate,
      qualityScore,
    };
  }

  private async getTopErrors(_timeWindow: number): Promise<ErrorSummary[]> {
    // This would typically pull from error tracking system
    // For now, we'll generate some sample data
    const now = Date.now();
    const sampleErrors: ErrorSummary[] = [
      {
        errorType: "APITimeoutError",
        message: "Request timeout exceeded",
        count: 15,
        lastOccurrence: new Date(now - 30000),
        affectedAgents: ["QAGenerator", "DomainConsultant"],
      },
      {
        errorType: "ValidationError",
        message: "Invalid input format",
        count: 8,
        lastOccurrence: new Date(now - 120000),
        affectedAgents: ["PromptArchitect"],
      },
    ];

    return sampleErrors.sort((a, b) => b.count - a.count).slice(0, 10);
  }

  private generateAlerts(
    overview: DashboardMetrics["overview"],
    agents: DashboardMetrics["agents"],
    system: DashboardMetrics["system"],
  ): void {
    const now = new Date();

    // Response time alerts
    if (
      overview.averageResponseTime > this.alertThresholds.responseTimeCritical
    ) {
      this.addAlert({
        level: "critical",
        title: "Critical Response Time",
        description: `Average response time (${overview.averageResponseTime}ms) exceeds critical threshold`,
        source: "performance_monitor",
        timestamp: now,
      });
    } else if (
      overview.averageResponseTime > this.alertThresholds.responseTimeWarning
    ) {
      this.addAlert({
        level: "warning",
        title: "High Response Time",
        description: `Average response time (${overview.averageResponseTime}ms) exceeds warning threshold`,
        source: "performance_monitor",
        timestamp: now,
      });
    }

    // Error rate alerts
    if (overview.errorRate > this.alertThresholds.errorRateCritical) {
      this.addAlert({
        level: "critical",
        title: "Critical Error Rate",
        description: `Error rate (${(overview.errorRate * 100).toFixed(1)}%) exceeds critical threshold`,
        source: "error_tracking",
        timestamp: now,
      });
    } else if (overview.errorRate > this.alertThresholds.errorRateWarning) {
      this.addAlert({
        level: "warning",
        title: "High Error Rate",
        description: `Error rate (${(overview.errorRate * 100).toFixed(1)}%) exceeds warning threshold`,
        source: "error_tracking",
        timestamp: now,
      });
    }

    // System resource alerts
    if (system.cpuUsage > this.alertThresholds.cpuUsageCritical) {
      this.addAlert({
        level: "critical",
        title: "Critical CPU Usage",
        description: `CPU usage (${system.cpuUsage.toFixed(1)}%) exceeds critical threshold`,
        source: "system_monitor",
        timestamp: now,
      });
    } else if (system.cpuUsage > this.alertThresholds.cpuUsageWarning) {
      this.addAlert({
        level: "warning",
        title: "High CPU Usage",
        description: `CPU usage (${system.cpuUsage.toFixed(1)}%) exceeds warning threshold`,
        source: "system_monitor",
        timestamp: now,
      });
    }

    if (system.memoryUsage > this.alertThresholds.memoryUsageCritical) {
      this.addAlert({
        level: "critical",
        title: "Critical Memory Usage",
        description: `Memory usage (${system.memoryUsage.toFixed(1)}%) exceeds critical threshold`,
        source: "system_monitor",
        timestamp: now,
      });
    } else if (system.memoryUsage > this.alertThresholds.memoryUsageWarning) {
      this.addAlert({
        level: "warning",
        title: "High Memory Usage",
        description: `Memory usage (${system.memoryUsage.toFixed(1)}%) exceeds warning threshold`,
        source: "system_monitor",
        timestamp: now,
      });
    }

    // Agent quality alerts
    for (const agent of agents) {
      if (
        agent.averageQualityScore < this.alertThresholds.qualityScoreCritical
      ) {
        this.addAlert({
          level: "critical",
          title: `Critical Quality Score - ${agent.name}`,
          description: `Agent ${agent.name} quality score (${agent.averageQualityScore.toFixed(1)}) below critical threshold`,
          source: "quality_monitor",
          timestamp: now,
        });
      } else if (
        agent.averageQualityScore < this.alertThresholds.qualityScoreWarning
      ) {
        this.addAlert({
          level: "warning",
          title: `Low Quality Score - ${agent.name}`,
          description: `Agent ${agent.name} quality score (${agent.averageQualityScore.toFixed(1)}) below warning threshold`,
          source: "quality_monitor",
          timestamp: now,
        });
      }
    }
  }

  private addAlert(alertData: Omit<Alert, "id" | "acknowledged">): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      acknowledged: false,
      ...alertData,
    };

    // Check if similar alert already exists
    const existingAlert = this.alerts.find(
      (a) =>
        a.title === alert.title &&
        a.source === alert.source &&
        !a.acknowledged &&
        alert.timestamp.getTime() - a.timestamp.getTime() < 300000, // 5 minutes
    );

    if (!existingAlert) {
      this.alerts.push(alert);
      this.logger.warn(
        `Alert generated: ${alert.title} - ${alert.description}`,
      );
    }
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.logger.info(`Alert acknowledged: ${alertId}`);
      return true;
    }
    return false;
  }

  getActiveAlerts(): Alert[] {
    // Return unacknowledged alerts from last 24 hours
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return this.alerts
      .filter(
        (alert) => !alert.acknowledged && alert.timestamp.getTime() > cutoff,
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  private getAgentPerformanceData(_timeWindow: number): Record<
    string,
    {
      executions: { timestamp: Date; duration: number }[];
      qualityScores: number[];
      errors: { timestamp: Date; error: string }[];
    }
  > {
    // This would typically pull from the performance monitor's internal data
    // For now, returning sample data structure
    return {
      QAGenerator: {
        executions: [],
        qualityScores: [],
        errors: [],
      },
      QualityAuditor: {
        executions: [],
        qualityScores: [],
        errors: [],
      },
    };
  }

  private getMetricsInTimeRange(
    _start: number,
    _end: number,
  ): {
    responseTimes: number[];
    requestCount: number;
    errorCount: number;
    qualityScores: number[];
  } {
    // This would filter actual metrics by time range
    return {
      responseTimes: [],
      requestCount: 0,
      errorCount: 0,
      qualityScores: [],
    };
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

interface AlertThresholds {
  responseTimeWarning: number;
  responseTimeCritical: number;
  errorRateWarning: number;
  errorRateCritical: number;
  cpuUsageWarning: number;
  cpuUsageCritical: number;
  memoryUsageWarning: number;
  memoryUsageCritical: number;
  qualityScoreWarning: number;
  qualityScoreCritical: number;
}

// Global dashboard instance
let globalDashboard: PerformanceDashboard | null = null;

export function initializePerformanceDashboard(
  performanceMonitor: PerformanceMonitor,
  alertThresholds?: Partial<AlertThresholds>,
): PerformanceDashboard {
  globalDashboard = new PerformanceDashboard(
    performanceMonitor,
    alertThresholds,
  );
  return globalDashboard;
}

export function getPerformanceDashboard(): PerformanceDashboard | null {
  return globalDashboard;
}
