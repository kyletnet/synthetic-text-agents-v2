/**
 * APM Integration Layer
 * Provides unified interface for multiple APM providers
 */
import { Logger } from "./logger";
/**
 * Datadog APM Provider
 */
export class DatadogProvider {
    name = "datadog";
    config;
    logger;
    dd;
    constructor() {
        this.logger = new Logger({ level: "info" });
    }
    async initialize(config) {
        this.config = config;
        try {
            // Initialize Datadog APM
            this.dd = require("dd-trace");
            this.dd.init({
                service: config.serviceName,
                env: config.environment,
                version: config.version,
                sampleRate: config.sampleRate || 1.0,
                runtimeMetrics: true,
                logInjection: true,
            });
            this.logger.info("Datadog APM initialized successfully");
        }
        catch (error) {
            this.logger.error("Failed to initialize Datadog APM:", error);
            throw error;
        }
    }
    async recordMetric(metric) {
        if (!this.dd)
            return;
        try {
            this.dd.dogstatsd.gauge(`synthetic_agents.${metric.name}`, metric.value, metric.tags
                ? Object.entries(metric.tags).map(([k, v]) => `${k}:${v}`)
                : []);
        }
        catch (error) {
            this.logger.error("Failed to record metric to Datadog:", error);
        }
    }
    async recordError(error, context) {
        if (!this.dd)
            return;
        try {
            const span = this.dd.scope().active();
            if (span) {
                span.setTag("error", true);
                span.setTag("error.msg", error.message);
                span.setTag("error.type", error.name);
                span.setTag("error.stack", error.stack);
                if (context) {
                    Object.entries(context).forEach(([key, value]) => {
                        span.setTag(`context.${key}`, value);
                    });
                }
            }
        }
        catch (err) {
            this.logger.error("Failed to record error to Datadog:", err);
        }
    }
    startTransaction(name, type) {
        if (!this.dd)
            return "";
        try {
            const span = this.dd.trace(name, {
                service: this.config.serviceName,
                resource: name,
                type: type,
            });
            return span.context().toSpanId();
        }
        catch (error) {
            this.logger.error("Failed to start Datadog transaction:", error);
            return "";
        }
    }
    async endTransaction(id, result) {
        if (!this.dd)
            return;
        try {
            const span = this.dd.scope().active();
            if (span) {
                span.setTag("result", result);
                span.finish();
            }
        }
        catch (error) {
            this.logger.error("Failed to end Datadog transaction:", error);
        }
    }
    addCustomAttribute(key, value) {
        if (!this.dd)
            return;
        try {
            const span = this.dd.scope().active();
            if (span) {
                span.setTag(key, value);
            }
        }
        catch (error) {
            this.logger.error("Failed to add custom attribute to Datadog:", error);
        }
    }
    async shutdown() {
        if (this.dd) {
            await this.dd.shutdown();
        }
    }
}
/**
 * New Relic APM Provider
 */
export class NewRelicProvider {
    name = "newrelic";
    config;
    logger;
    newrelic;
    constructor() {
        this.logger = new Logger({ level: "info" });
    }
    async initialize(config) {
        this.config = config;
        try {
            process.env.NEW_RELIC_LICENSE_KEY = config.apiKey;
            process.env.NEW_RELIC_APP_NAME = config.serviceName;
            process.env.NEW_RELIC_ENVIRONMENT = config.environment;
            this.newrelic = require("newrelic");
            this.logger.info("New Relic APM initialized successfully");
        }
        catch (error) {
            this.logger.error("Failed to initialize New Relic APM:", error);
            throw error;
        }
    }
    async recordMetric(metric) {
        if (!this.newrelic)
            return;
        try {
            this.newrelic.recordMetric(`Custom/SyntheticAgents/${metric.name}`, metric.value);
        }
        catch (error) {
            this.logger.error("Failed to record metric to New Relic:", error);
        }
    }
    async recordError(error, context) {
        if (!this.newrelic)
            return;
        try {
            this.newrelic.noticeError(error, context);
        }
        catch (err) {
            this.logger.error("Failed to record error to New Relic:", err);
        }
    }
    startTransaction(name, type) {
        if (!this.newrelic)
            return "";
        try {
            const transactionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            this.newrelic.setTransactionName(type, name);
            return transactionId;
        }
        catch (error) {
            this.logger.error("Failed to start New Relic transaction:", error);
            return "";
        }
    }
    async endTransaction(id, result) {
        if (!this.newrelic)
            return;
        try {
            this.newrelic.addCustomAttribute("result", result);
            this.newrelic.endTransaction();
        }
        catch (error) {
            this.logger.error("Failed to end New Relic transaction:", error);
        }
    }
    addCustomAttribute(key, value) {
        if (!this.newrelic)
            return;
        try {
            this.newrelic.addCustomAttribute(key, value);
        }
        catch (error) {
            this.logger.error("Failed to add custom attribute to New Relic:", error);
        }
    }
    async shutdown() {
        // New Relic doesn't require explicit shutdown
    }
}
/**
 * Prometheus Provider (for metrics collection)
 */
export class PrometheusProvider {
    name = "prometheus";
    config;
    logger;
    prom;
    metrics = new Map();
    constructor() {
        this.logger = new Logger({ level: "info" });
    }
    async initialize(config) {
        this.config = config;
        try {
            this.prom = require("prom-client");
            // Set default labels
            this.prom.register.setDefaultLabels({
                service: config.serviceName,
                environment: config.environment,
                version: config.version,
            });
            // Collect default metrics
            this.prom.collectDefaultMetrics({
                prefix: "synthetic_agents_",
                timeout: 5000,
            });
            this.logger.info("Prometheus metrics initialized successfully");
        }
        catch (error) {
            this.logger.error("Failed to initialize Prometheus metrics:", error);
            throw error;
        }
    }
    async recordMetric(metric) {
        if (!this.prom)
            return;
        try {
            const metricName = `synthetic_agents_${metric.name.replace(/[^a-zA-Z0-9_]/g, "_")}`;
            if (!this.metrics.has(metricName)) {
                this.metrics.set(metricName, new this.prom.Gauge({
                    name: metricName,
                    help: `Performance metric for ${metric.name}`,
                    labelNames: Object.keys(metric.tags || {}),
                }));
            }
            const prometheusMetric = this.metrics.get(metricName);
            if (metric.tags) {
                prometheusMetric.set(metric.tags, metric.value);
            }
            else {
                prometheusMetric.set(metric.value);
            }
        }
        catch (error) {
            this.logger.error("Failed to record metric to Prometheus:", error);
        }
    }
    async recordError(error, context) {
        if (!this.prom)
            return;
        try {
            const errorMetric = this.getOrCreateErrorMetric();
            errorMetric.inc({
                error_type: error.name,
                error_message: error.message.substring(0, 100), // Truncate for label safety
            });
        }
        catch (err) {
            this.logger.error("Failed to record error to Prometheus:", err);
        }
    }
    startTransaction(name, type) {
        // Prometheus doesn't have built-in transaction tracking
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    async endTransaction(id, result) {
        if (!this.prom)
            return;
        try {
            const transactionMetric = this.getOrCreateTransactionMetric();
            transactionMetric.inc({ result });
        }
        catch (error) {
            this.logger.error("Failed to end Prometheus transaction:", error);
        }
    }
    addCustomAttribute(key, value) {
        // Custom attributes are handled through labels in recordMetric
    }
    async shutdown() {
        if (this.prom) {
            this.prom.register.clear();
        }
    }
    getMetricsForScraping() {
        if (!this.prom)
            return "";
        return this.prom.register.metrics();
    }
    getOrCreateErrorMetric() {
        const name = "synthetic_agents_errors_total";
        if (!this.metrics.has(name)) {
            this.metrics.set(name, new this.prom.Counter({
                name,
                help: "Total number of errors",
                labelNames: ["error_type", "error_message"],
            }));
        }
        return this.metrics.get(name);
    }
    getOrCreateTransactionMetric() {
        const name = "synthetic_agents_transactions_total";
        if (!this.metrics.has(name)) {
            this.metrics.set(name, new this.prom.Counter({
                name,
                help: "Total number of transactions",
                labelNames: ["result"],
            }));
        }
        return this.metrics.get(name);
    }
}
/**
 * APM Integration Manager
 */
export class APMIntegration {
    providers = new Map();
    config;
    logger;
    performanceMonitor;
    constructor(config, performanceMonitor) {
        this.config = config;
        this.performanceMonitor = performanceMonitor;
        this.logger = new Logger({ level: "info" });
    }
    async initialize() {
        if (!this.config.enabled) {
            this.logger.info("APM integration disabled");
            return;
        }
        try {
            const providerConfig = {
                apiKey: this.config.apiKey,
                endpoint: this.config.endpoint,
                serviceName: this.config.serviceName,
                environment: this.config.environment,
                version: this.config.version,
                sampleRate: this.config.samplingRate,
            };
            switch (this.config.provider) {
                case "datadog": {
                    const datadogProvider = new DatadogProvider();
                    await datadogProvider.initialize(providerConfig);
                    this.providers.set("datadog", datadogProvider);
                    break;
                }
                case "newrelic": {
                    const newrelicProvider = new NewRelicProvider();
                    await newrelicProvider.initialize(providerConfig);
                    this.providers.set("newrelic", newrelicProvider);
                    break;
                }
                case "prometheus": {
                    const prometheusProvider = new PrometheusProvider();
                    await prometheusProvider.initialize(providerConfig);
                    this.providers.set("prometheus", prometheusProvider);
                    break;
                }
            }
            // Set up metric forwarding from performance monitor
            this.performanceMonitor.on("metric:recorded", this.onMetricRecorded.bind(this));
            this.performanceMonitor.on("transaction:start", this.onTransactionStart.bind(this));
            this.performanceMonitor.on("transaction:end", this.onTransactionEnd.bind(this));
            this.logger.info(`APM integration initialized with provider: ${this.config.provider}`);
        }
        catch (error) {
            this.logger.error("Failed to initialize APM integration:", error);
            throw error;
        }
    }
    async recordError(error, context) {
        for (const provider of this.providers.values()) {
            try {
                await provider.recordError(error, context);
            }
            catch (err) {
                this.logger.error(`Failed to record error with provider ${provider.name}:`, err);
            }
        }
    }
    addCustomAttribute(key, value) {
        for (const provider of this.providers.values()) {
            try {
                provider.addCustomAttribute(key, value);
            }
            catch (error) {
                this.logger.error(`Failed to add custom attribute with provider ${provider.name}:`, error);
            }
        }
    }
    getPrometheusMetrics() {
        const prometheusProvider = this.providers.get("prometheus");
        if (prometheusProvider) {
            return prometheusProvider.getMetricsForScraping();
        }
        return "";
    }
    async shutdown() {
        for (const provider of this.providers.values()) {
            try {
                await provider.shutdown();
            }
            catch (error) {
                this.logger.error(`Failed to shutdown provider ${provider.name}:`, error);
            }
        }
        this.providers.clear();
    }
    async onMetricRecorded(metric) {
        for (const provider of this.providers.values()) {
            try {
                await provider.recordMetric(metric);
            }
            catch (error) {
                this.logger.error(`Failed to record metric with provider ${provider.name}:`, error);
            }
        }
    }
    onTransactionStart(transaction) {
        for (const provider of this.providers.values()) {
            try {
                provider.startTransaction(transaction.name, transaction.type);
            }
            catch (error) {
                this.logger.error(`Failed to start transaction with provider ${provider.name}:`, error);
            }
        }
    }
    async onTransactionEnd(transaction) {
        for (const provider of this.providers.values()) {
            try {
                await provider.endTransaction(transaction.id, transaction.status === "success" ? "success" : "error");
            }
            catch (error) {
                this.logger.error(`Failed to end transaction with provider ${provider.name}:`, error);
            }
        }
    }
}
// Global APM integration instance
let globalAPM = null;
export function initializeAPM(config, performanceMonitor) {
    if (globalAPM) {
        globalAPM.shutdown();
    }
    globalAPM = new APMIntegration(config, performanceMonitor);
    return globalAPM;
}
export function getAPMIntegration() {
    return globalAPM;
}
//# sourceMappingURL=apmIntegration.js.map