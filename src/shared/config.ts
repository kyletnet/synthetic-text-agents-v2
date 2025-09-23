import { readFile } from "fs/promises";
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

const DEFAULT_CONFIG: AppConfig = {
  features: {
    rag: {
      enabled: false,
      topK: 3,
      minScore: 0.05,
    },
  },
  telemetry: {
    logRag: false,
  },
};

export class ConfigService {
  private config: AppConfig;
  private static instance: ConfigService;

  private constructor(config: AppConfig = DEFAULT_CONFIG) {
    this.config = { ...config };
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  static async initialize(configPath?: string): Promise<ConfigService> {
    const config = await ConfigService.loadConfig(configPath);
    ConfigService.instance = new ConfigService(config);
    return ConfigService.instance;
  }

  private static async loadConfig(configPath?: string): Promise<AppConfig> {
    const paths = [
      configPath,
      ".claude/settings.local.json",
      ".claude/settings.json",
    ].filter(Boolean) as string[];

    let loadedConfig: Partial<AppConfig> = {};

    for (const path of paths) {
      try {
        const content = await readFile(path, "utf-8");
        const parsed = JSON.parse(content);
        loadedConfig = { ...loadedConfig, ...parsed };
      } catch {
        // Continue to next config file if this one fails
      }
    }

    return {
      features: {
        rag: {
          enabled:
            loadedConfig.features?.rag?.enabled ??
            DEFAULT_CONFIG.features.rag.enabled,
          topK:
            loadedConfig.features?.rag?.topK ??
            DEFAULT_CONFIG.features.rag.topK,
          minScore:
            loadedConfig.features?.rag?.minScore ??
            DEFAULT_CONFIG.features.rag.minScore,
        },
      },
      telemetry: {
        logRag:
          loadedConfig.telemetry?.logRag ?? DEFAULT_CONFIG.telemetry.logRag,
      },
    };
  }

  getFeatureFlag<K extends keyof FeatureFlags>(feature: K): FeatureFlags[K] {
    return this.config.features[feature];
  }

  getTelemetryConfig(): TelemetryConfig {
    return this.config.telemetry;
  }

  getRAGConfig(): RAGConfig {
    const ragFeature = this.config.features.rag;
    return {
      enabled: ragFeature.enabled,
      topK: ragFeature.topK,
      minScore: ragFeature.minScore,
      indexPaths: ["docs/", "src/", "CLAUDE.md", "README.md"].filter(
        (path) => path,
      ), // Filter out any empty paths
    };
  }

  isRAGEnabled(): boolean {
    return this.config.features.rag.enabled;
  }

  updateConfig(updates: Partial<AppConfig>): void {
    this.config = {
      features: { ...this.config.features, ...updates.features },
      telemetry: { ...this.config.telemetry, ...updates.telemetry },
    };
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }
}
