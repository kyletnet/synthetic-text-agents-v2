/**
 * Performance Dashboard Data Provider
 * Generates real-time performance data for monitoring dashboards
 */
import { PerformanceMonitor } from "./performanceMonitoring";
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
export declare class PerformanceDashboard {
    private performanceMonitor;
    private logger;
    private alerts;
    private alertThresholds;
    constructor(performanceMonitor: PerformanceMonitor, alertThresholds?: Partial<AlertThresholds>);
    getDashboardMetrics(timeWindow?: number): Promise<DashboardMetrics>;
    private getOverviewMetrics;
    private getAgentMetrics;
    private getSystemMetrics;
    private getTrendMetrics;
    private getTopErrors;
    private generateAlerts;
    private addAlert;
    acknowledgeAlert(alertId: string): boolean;
    getActiveAlerts(): Alert[];
    private getAgentPerformanceData;
    private getMetricsInTimeRange;
    private generateAlertId;
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
export declare function initializePerformanceDashboard(performanceMonitor: PerformanceMonitor, alertThresholds?: Partial<AlertThresholds>): PerformanceDashboard;
export declare function getPerformanceDashboard(): PerformanceDashboard | null;
export {};
//# sourceMappingURL=performanceDashboard.d.ts.map