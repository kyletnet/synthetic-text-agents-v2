import type { RAGConfig } from "../rag/service.js";
export interface FeatureFlags {
    rag: {
        enabled: boolean;
        topK: number;
        minScore: number;
    };
}
export interface TelemetryConfig {
    logRag: boolean;
}
export interface AppConfig {
    features: FeatureFlags;
    telemetry: TelemetryConfig;
}
export declare class ConfigService {
    private config;
    private static instance;
    private constructor();
    static getInstance(): ConfigService;
    static initialize(configPath?: string): Promise<ConfigService>;
    private static loadConfig;
    getFeatureFlag<K extends keyof FeatureFlags>(feature: K): FeatureFlags[K];
    getTelemetryConfig(): TelemetryConfig;
    getRAGConfig(): RAGConfig;
    isRAGEnabled(): boolean;
    updateConfig(updates: Partial<AppConfig>): void;
    getConfig(): AppConfig;
}
//# sourceMappingURL=config.d.ts.map