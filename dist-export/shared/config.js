import { readFile } from "fs/promises";
const DEFAULT_CONFIG = {
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
  config;
  static instance;
  constructor(config = DEFAULT_CONFIG) {
    this.config = { ...config };
  }
  static getInstance() {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }
  static async initialize(configPath) {
    const config = await ConfigService.loadConfig(configPath);
    ConfigService.instance = new ConfigService(config);
    return ConfigService.instance;
  }
  static async loadConfig(configPath) {
    const paths = [
      configPath,
      ".claude/settings.local.json",
      ".claude/settings.json",
    ].filter(Boolean);
    let loadedConfig = {};
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
  getFeatureFlag(feature) {
    return this.config.features[feature];
  }
  getTelemetryConfig() {
    return this.config.telemetry;
  }
  getRAGConfig() {
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
  isRAGEnabled() {
    return this.config.features.rag.enabled;
  }
  updateConfig(updates) {
    this.config = {
      features: { ...this.config.features, ...updates.features },
      telemetry: { ...this.config.telemetry, ...updates.telemetry },
    };
  }
  getConfig() {
    return { ...this.config };
  }
}
//# sourceMappingURL=config.js.map
