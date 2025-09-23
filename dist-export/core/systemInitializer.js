/**
 * System Initializer
 * Boots up all production infrastructure components
 */
import { Logger } from "../shared/logger";
import {
  initializePerformanceMonitoring,
  getPerformanceMonitor,
} from "../shared/performanceMonitoring";
import { initializeAPM } from "../shared/apmIntegration";
import {
  initializeLogAggregation,
  getLogAggregator,
} from "../shared/logAggregation";
import { initializeLogForwarder } from "../shared/logForwarder";
import { initializeBackupSystem } from "../shared/backupSystem";
import { initializePerformanceDashboard } from "../shared/performanceDashboard";
import { initializeErrorTracking } from "../shared/errorTracking";
export class SystemInitializer {
  logger;
  initialized = false;
  config;
  constructor() {
    this.logger = new Logger({ level: "info" });
    this.config = this.loadConfiguration();
  }
  /**
   * Initialize all production infrastructure components
   */
  async initialize() {
    if (this.initialized) {
      this.logger.warn("System already initialized");
      return;
    }
    try {
      this.logger.info("Initializing production infrastructure...");
      // Initialize components in dependency order
      await this.initializeErrorTracking();
      await this.initializePerformanceMonitoring();
      await this.initializeAPMIntegration();
      await this.initializeLogAggregation();
      await this.initializeLogForwarding();
      await this.initializeBackupSystem();
      await this.initializePerformanceDashboard();
      // Setup system-wide error handlers
      await this.setupGlobalErrorHandlers();
      // Register graceful shutdown
      await this.setupGracefulShutdown();
      this.initialized = true;
      this.logger.info("✅ Production infrastructure initialized successfully");
      // Log system status
      this.logSystemStatus();
    } catch (error) {
      this.logger.error(
        "❌ Failed to initialize production infrastructure:",
        error,
      );
      throw error;
    }
  }
  /**
   * Get current system status
   */
  getSystemStatus() {
    const uptime = process.uptime();
    return {
      initialized: this.initialized,
      environment: this.config.environment,
      uptime,
      components: {
        performanceMonitoring: {
          enabled: this.config.enablePerformanceMonitoring,
          status: getPerformanceMonitor() ? "active" : "inactive",
        },
        logAggregation: {
          enabled: this.config.enableLogAggregation,
          status: getLogAggregator() ? "active" : "inactive",
        },
        errorTracking: {
          enabled: this.config.enableErrorTracking,
          status: "active", // Error tracking is always active once initialized
        },
        circuitBreaker: {
          enabled: true,
          status: "active",
        },
      },
    };
  }
  loadConfiguration() {
    const environment = process.env.NODE_ENV || "development";
    const serviceName = process.env.SERVICE_NAME || "synthetic-agents";
    const version = process.env.npm_package_version || "1.0.0";
    // Feature flags based on environment
    const isProduction = environment === "production";
    const isStaging = environment === "staging";
    const isDevelopment = environment === "development";
    return {
      environment,
      serviceName,
      version,
      // Enable production features in staging and production
      enablePerformanceMonitoring: this.getEnvBoolean(
        "ENABLE_PERFORMANCE_MONITORING",
        isProduction || isStaging,
      ),
      enableAPM: this.getEnvBoolean("ENABLE_APM", isProduction || isStaging),
      enableLogAggregation: this.getEnvBoolean(
        "ENABLE_LOG_AGGREGATION",
        !isDevelopment,
      ),
      enableLogForwarding: this.getEnvBoolean(
        "ENABLE_LOG_FORWARDING",
        isProduction,
      ),
      enableBackupSystem: this.getEnvBoolean(
        "ENABLE_BACKUP_SYSTEM",
        isProduction,
      ),
      enableErrorTracking: this.getEnvBoolean(
        "ENABLE_ERROR_TRACKING",
        !isDevelopment,
      ),
      // Provider configurations
      apmProvider: process.env.APM_PROVIDER || "prometheus",
      logStorageBackend: process.env.LOG_STORAGE_BACKEND || "file",
      backupEnabled: this.getEnvBoolean("BACKUP_ENABLED", isProduction),
    };
  }
  async initializeErrorTracking() {
    if (!this.config.enableErrorTracking) {
      this.logger.info("Error tracking disabled");
      return;
    }
    try {
      const errorTracker = initializeErrorTracking({
        sampleRate: this.config.environment === "production" ? 0.1 : 1.0,
      });
      this.logger.info("✅ Error tracking initialized");
    } catch (error) {
      this.logger.error("❌ Failed to initialize error tracking:", error);
    }
  }
  async initializePerformanceMonitoring() {
    if (!this.config.enablePerformanceMonitoring) {
      this.logger.info("Performance monitoring disabled");
      return;
    }
    try {
      initializePerformanceMonitoring({
        provider: this.config.apmProvider || "custom",
        enabled: true,
        samplingRate: this.config.environment === "production" ? 0.1 : 1.0,
        flushInterval: 30000, // 30 seconds
        batchSize: 100,
        serviceName: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version,
      });
      this.logger.info("✅ Performance monitoring initialized");
    } catch (error) {
      this.logger.error(
        "❌ Failed to initialize performance monitoring:",
        error,
      );
    }
  }
  async initializeAPMIntegration() {
    if (!this.config.enableAPM) {
      this.logger.info("APM integration disabled");
      return;
    }
    try {
      const performanceMonitor = getPerformanceMonitor();
      if (!performanceMonitor) {
        this.logger.warn(
          "Performance monitor not available for APM integration",
        );
        return;
      }
      const apmIntegration = initializeAPM(
        {
          provider: this.config.apmProvider || "custom",
          enabled: true,
          samplingRate: this.config.environment === "production" ? 0.1 : 1.0,
          flushInterval: 30000,
          batchSize: 100,
          apiKey: process.env.APM_API_KEY || "",
          endpoint: process.env.APM_ENDPOINT || "",
          serviceName: this.config.serviceName,
          environment: this.config.environment,
          version: this.config.version,
        },
        performanceMonitor,
      );
      await apmIntegration.initialize();
      this.logger.info("✅ APM integration initialized");
    } catch (error) {
      this.logger.error("❌ Failed to initialize APM integration:", error);
    }
  }
  async initializeLogAggregation() {
    if (!this.config.enableLogAggregation) {
      this.logger.info("Log aggregation disabled");
      return;
    }
    try {
      initializeLogAggregation({
        enabled: true,
        bufferSize: 1000,
        flushInterval: 30000, // 30 seconds
        retentionDays: this.config.environment === "production" ? 30 : 7,
        compressionEnabled: this.config.environment === "production",
        indexingEnabled: true,
        storageBackend: this.config.logStorageBackend || "file",
        storagePath: process.env.LOG_STORAGE_PATH || "/tmp/logs",
        elasticsearchUrl: process.env.ELASTICSEARCH_URL || "",
        maxLogSize: 64 * 1024, // 64KB
        enableSampling: this.config.environment === "production",
        samplingRate: this.config.environment === "production" ? 0.1 : 1.0,
      });
      this.logger.info("✅ Log aggregation initialized");
    } catch (error) {
      this.logger.error("❌ Failed to initialize log aggregation:", error);
    }
  }
  async initializeLogForwarding() {
    if (!this.config.enableLogForwarding) {
      this.logger.info("Log forwarding disabled");
      return;
    }
    try {
      initializeLogForwarder({
        enabled: true,
        targets: this.getLogForwardingTargets(),
        batchSize: 100,
        flushInterval: 30000,
        retryAttempts: 3,
        retryDelay: 5000,
        enableCompression: true,
        enableEncryption: this.config.environment === "production",
      });
      this.logger.info("✅ Log forwarding initialized");
    } catch (error) {
      this.logger.error("❌ Failed to initialize log forwarding:", error);
    }
  }
  async initializeBackupSystem() {
    if (!this.config.enableBackupSystem) {
      this.logger.info("Backup system disabled");
      return;
    }
    try {
      initializeBackupSystem({
        enabled: true,
        strategies: [
          {
            name: "daily-full",
            type: "full",
            source: {
              type: "application_data",
              paths: ["./data", "./logs", "./config"],
            },
            destination: {
              type: process.env.BACKUP_STORAGE_TYPE || "local",
              location: process.env.BACKUP_STORAGE_PATH || "/tmp/backups",
            },
            enabled: true,
            priority: 1,
            maxRetryAttempts: 3,
          },
        ],
        retention: {
          daily: 7,
          weekly: 4,
          monthly: 12,
          yearly: 5,
        },
        compression: {
          enabled: true,
          algorithm: "gzip",
          level: 6,
        },
        encryption: {
          enabled: this.config.environment === "production",
          algorithm: "aes-256-gcm",
          keyId: process.env.BACKUP_ENCRYPTION_KEY_ID || "default",
        },
        scheduling: {
          full: "0 2 * * *", // Daily at 2 AM
          incremental: "0 */4 * * *", // Every 4 hours
          differential: "0 */2 * * *", // Every 2 hours
        },
        verification: {
          enabled: true,
          checksumAlgorithm: "sha256",
          testRestore: this.config.environment !== "production",
        },
      });
      this.logger.info("✅ Backup system initialized");
    } catch (error) {
      this.logger.error("❌ Failed to initialize backup system:", error);
    }
  }
  async initializePerformanceDashboard() {
    try {
      const performanceMonitor = getPerformanceMonitor();
      if (!performanceMonitor) {
        this.logger.warn("Performance monitor not available for dashboard");
        return;
      }
      initializePerformanceDashboard(performanceMonitor, {
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
      });
      this.logger.info("✅ Performance dashboard initialized");
    } catch (error) {
      this.logger.error(
        "❌ Failed to initialize performance dashboard:",
        error,
      );
    }
  }
  async setupGlobalErrorHandlers() {
    // Uncaught exception handler
    process.on("uncaughtException", (error) => {
      this.logger.error("Uncaught Exception:", error);
      // Report to error tracking
      if (this.config.enableErrorTracking) {
        // Error would be automatically reported by error tracking system
      }
      // Graceful shutdown
      process.exit(1);
    });
    // Unhandled rejection handler
    process.on("unhandledRejection", (reason, promise) => {
      this.logger.error(
        `Unhandled Rejection at: ${promise}, reason: ${reason}`,
      );
      // Report to error tracking
      if (this.config.enableErrorTracking) {
        // Error would be automatically reported by error tracking system
      }
    });
    this.logger.info("✅ Global error handlers setup");
  }
  async setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      this.logger.info(`${signal} received, starting graceful shutdown...`);
      try {
        // Shutdown all systems in reverse order
        const performanceMonitor = getPerformanceMonitor();
        if (performanceMonitor) {
          performanceMonitor.shutdown();
        }
        const logAggregator = getLogAggregator();
        if (logAggregator) {
          await logAggregator.shutdown();
        }
        this.logger.info("✅ Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        this.logger.error("Error during graceful shutdown:", error);
        process.exit(1);
      }
    };
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    this.logger.info("✅ Graceful shutdown handlers setup");
  }
  getLogForwardingTargets() {
    const targets = [];
    // Elasticsearch target
    if (process.env.ELASTICSEARCH_URL) {
      targets.push({
        name: "elasticsearch",
        type: "elasticsearch",
        enabled: true,
        url: process.env.ELASTICSEARCH_URL,
        authentication: process.env.ELASTICSEARCH_API_KEY
          ? {
              type: "apikey",
              credentials: { apikey: process.env.ELASTICSEARCH_API_KEY },
            }
          : undefined,
        format: "json",
        filters: {
          levels: ["error", "warn", "info"],
        },
      });
    }
    // Datadog target
    if (process.env.DATADOG_API_KEY) {
      targets.push({
        name: "datadog",
        type: "datadog",
        enabled: true,
        url:
          process.env.DATADOG_LOG_ENDPOINT ||
          "https://http-intake.logs.datadoghq.com",
        authentication: {
          type: "apikey",
          credentials: { apikey: process.env.DATADOG_API_KEY },
        },
        format: "json",
      });
    }
    return targets;
  }
  getEnvBoolean(envVar, defaultValue) {
    const value = process.env[envVar];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === "true" || value === "1";
  }
  logSystemStatus() {
    const status = this.getSystemStatus();
    this.logger.info("📊 System Status:", {
      environment: status.environment,
      uptime: `${Math.floor(status.uptime)}s`,
      components: Object.entries(status.components)
        .map(
          ([name, component]) =>
            `${name}: ${component.enabled ? "✅" : "❌"} ${component.status}`,
        )
        .join(", "),
    });
  }
}
// Global system initializer instance
let globalSystemInitializer = null;
export function getSystemInitializer() {
  if (!globalSystemInitializer) {
    globalSystemInitializer = new SystemInitializer();
  }
  return globalSystemInitializer;
}
export async function initializeSystem() {
  const initializer = getSystemInitializer();
  await initializer.initialize();
}
//# sourceMappingURL=systemInitializer.js.map
