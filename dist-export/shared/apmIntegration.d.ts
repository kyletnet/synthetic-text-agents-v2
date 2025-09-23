/**
 * APM Integration Layer
 * Provides unified interface for multiple APM providers
 */
import { PerformanceMonitor, APMConfig, PerformanceMetric } from "./performanceMonitoring";
export interface APMProvider {
    name: string;
    initialize(config: APMProviderConfig): Promise<void>;
    recordMetric(metric: PerformanceMetric): Promise<void>;
    recordError(error: Error, context?: Record<string, unknown>): Promise<void>;
    startTransaction(name: string, type: string): string;
    endTransaction(id: string, result: "success" | "error"): Promise<void>;
    addCustomAttribute(key: string, value: string | number): void;
    shutdown(): Promise<void>;
}
export interface APMProviderConfig {
    apiKey?: string;
    endpoint?: string;
    serviceName: string;
    environment: string;
    version: string;
    sampleRate?: number;
    [key: string]: unknown;
}
/**
 * Datadog APM Provider
 */
export declare class DatadogProvider implements APMProvider {
    name: string;
    private config;
    private logger;
    private dd;
    constructor();
    initialize(config: APMProviderConfig): Promise<void>;
    recordMetric(metric: PerformanceMetric): Promise<void>;
    recordError(error: Error, context?: Record<string, unknown>): Promise<void>;
    startTransaction(name: string, type: string): string;
    endTransaction(id: string, result: "success" | "error"): Promise<void>;
    addCustomAttribute(key: string, value: string | number): void;
    shutdown(): Promise<void>;
}
/**
 * New Relic APM Provider
 */
export declare class NewRelicProvider implements APMProvider {
    name: string;
    private config;
    private logger;
    private newrelic;
    constructor();
    initialize(config: APMProviderConfig): Promise<void>;
    recordMetric(metric: PerformanceMetric): Promise<void>;
    recordError(error: Error, context?: Record<string, unknown>): Promise<void>;
    startTransaction(name: string, type: string): string;
    endTransaction(id: string, result: "success" | "error"): Promise<void>;
    addCustomAttribute(key: string, value: string | number): void;
    shutdown(): Promise<void>;
}
/**
 * Prometheus Provider (for metrics collection)
 */
export declare class PrometheusProvider implements APMProvider {
    name: string;
    private config;
    private logger;
    private prom;
    private metrics;
    constructor();
    initialize(config: APMProviderConfig): Promise<void>;
    recordMetric(metric: PerformanceMetric): Promise<void>;
    recordError(error: Error, context?: Record<string, unknown>): Promise<void>;
    startTransaction(name: string, type: string): string;
    endTransaction(id: string, result: "success" | "error"): Promise<void>;
    addCustomAttribute(key: string, value: string | number): void;
    shutdown(): Promise<void>;
    getMetricsForScraping(): string;
    private getOrCreateErrorMetric;
    private getOrCreateTransactionMetric;
}
/**
 * APM Integration Manager
 */
export declare class APMIntegration {
    private providers;
    private config;
    private logger;
    private performanceMonitor;
    constructor(config: APMConfig, performanceMonitor: PerformanceMonitor);
    initialize(): Promise<void>;
    recordError(error: Error, context?: Record<string, unknown>): Promise<void>;
    addCustomAttribute(key: string, value: string | number): void;
    getPrometheusMetrics(): string;
    shutdown(): Promise<void>;
    private onMetricRecorded;
    private onTransactionStart;
    private onTransactionEnd;
}
export declare function initializeAPM(config: APMConfig, performanceMonitor: PerformanceMonitor): APMIntegration;
export declare function getAPMIntegration(): APMIntegration | null;
//# sourceMappingURL=apmIntegration.d.ts.map