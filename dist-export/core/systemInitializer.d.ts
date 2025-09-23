/**
 * System Initializer
 * Boots up all production infrastructure components
 */
export interface SystemConfig {
  environment: "development" | "staging" | "production" | "test";
  serviceName: string;
  version: string;
  enablePerformanceMonitoring: boolean;
  enableAPM: boolean;
  enableLogAggregation: boolean;
  enableLogForwarding: boolean;
  enableBackupSystem: boolean;
  enableErrorTracking: boolean;
  apmProvider?: "datadog" | "newrelic" | "prometheus" | "custom";
  logStorageBackend?: "file" | "elasticsearch" | "splunk" | "datadog";
  backupEnabled?: boolean;
}
export declare class SystemInitializer {
  private logger;
  private initialized;
  private config;
  constructor();
  /**
   * Initialize all production infrastructure components
   */
  initialize(): Promise<void>;
  /**
   * Get current system status
   */
  getSystemStatus(): {
    initialized: boolean;
    environment: string;
    uptime: number;
    components: Record<
      string,
      {
        enabled: boolean;
        status: string;
      }
    >;
  };
  private loadConfiguration;
  private initializeErrorTracking;
  private initializePerformanceMonitoring;
  private initializeAPMIntegration;
  private initializeLogAggregation;
  private initializeLogForwarding;
  private initializeBackupSystem;
  private initializePerformanceDashboard;
  private setupGlobalErrorHandlers;
  private setupGracefulShutdown;
  private getLogForwardingTargets;
  private getEnvBoolean;
  private logSystemStatus;
}
export declare function getSystemInitializer(): SystemInitializer;
export declare function initializeSystem(): Promise<void>;
//# sourceMappingURL=systemInitializer.d.ts.map
