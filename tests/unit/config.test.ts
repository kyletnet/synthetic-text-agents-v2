/**
 * Unit tests for ConfigService implementation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigService } from "../../src/shared/config";

describe("ConfigService", () => {
  // Reset singleton instance between tests
  afterEach(() => {
    // @ts-expect-error - Accessing private static for test cleanup
    ConfigService.instance = undefined;
  });

  describe("Singleton Pattern", () => {
    it("should create a singleton instance", () => {
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(ConfigService);
    });
  });

  describe("Default Configuration", () => {
    it("should return default RAG config", () => {
      const config = ConfigService.getInstance();
      const ragFeature = config.getFeatureFlag("rag");

      expect(ragFeature).toEqual({
        enabled: false,
        topK: 3,
        minScore: 0.05,
      });
    });

    it("should return default telemetry config", () => {
      const config = ConfigService.getInstance();
      const telemetry = config.getTelemetryConfig();

      expect(telemetry).toEqual({
        logRag: false,
      });
    });

    it("should return RAG config in RAGConfig format", () => {
      const config = ConfigService.getInstance();
      const ragConfig = config.getRAGConfig();

      expect(ragConfig).toHaveProperty("enabled");
      expect(ragConfig).toHaveProperty("topK");
      expect(ragConfig).toHaveProperty("minScore");
      expect(ragConfig).toHaveProperty("indexPaths");
      expect(Array.isArray(ragConfig.indexPaths)).toBe(true);
    });

    it("should report RAG disabled by default", () => {
      const config = ConfigService.getInstance();

      expect(config.isRAGEnabled()).toBe(false);
    });
  });

  describe("Configuration Updates", () => {
    let config: ConfigService;

    beforeEach(() => {
      config = ConfigService.getInstance();
    });

    it("should update RAG feature config", () => {
      config.updateConfig({
        features: {
          rag: {
            enabled: true,
            topK: 5,
            minScore: 0.1,
          },
        },
        telemetry: {
          logRag: false,
        },
      });

      const ragFeature = config.getFeatureFlag("rag");
      expect(ragFeature.enabled).toBe(true);
      expect(ragFeature.topK).toBe(5);
      expect(ragFeature.minScore).toBe(0.1);
    });

    it("should update telemetry config", () => {
      config.updateConfig({
        features: {
          rag: {
            enabled: false,
            topK: 3,
            minScore: 0.05,
          },
        },
        telemetry: {
          logRag: true,
        },
      });

      const telemetry = config.getTelemetryConfig();
      expect(telemetry.logRag).toBe(true);
    });

    it("should enable RAG and reflect in isRAGEnabled", () => {
      config.updateConfig({
        features: {
          rag: {
            enabled: true,
            topK: 3,
            minScore: 0.05,
          },
        },
        telemetry: {
          logRag: false,
        },
      });

      expect(config.isRAGEnabled()).toBe(true);
    });

    it("should return config object", () => {
      const configCopy = config.getConfig();

      // Config should be readable
      expect(configCopy).toHaveProperty("features");
      expect(configCopy).toHaveProperty("telemetry");
      expect(configCopy.features.rag).toBeDefined();
    });
  });

  describe("RAG Config Generation", () => {
    it("should include expected index paths", () => {
      const config = ConfigService.getInstance();
      const ragConfig = config.getRAGConfig();

      expect(ragConfig.indexPaths).toContain("docs/");
      expect(ragConfig.indexPaths).toContain("src/");
      expect(ragConfig.indexPaths).toContain("CLAUDE.md");
      expect(ragConfig.indexPaths).toContain("README.md");
    });

    it("should sync RAG feature settings to RAGConfig", () => {
      const config = ConfigService.getInstance();
      config.updateConfig({
        features: {
          rag: {
            enabled: true,
            topK: 10,
            minScore: 0.25,
          },
        },
        telemetry: {
          logRag: false,
        },
      });

      const ragConfig = config.getRAGConfig();
      expect(ragConfig.enabled).toBe(true);
      expect(ragConfig.topK).toBe(10);
      expect(ragConfig.minScore).toBe(0.25);
    });
  });

  describe("Partial Updates", () => {
    it("should preserve unmodified config sections", () => {
      const config = ConfigService.getInstance();

      config.updateConfig({
        features: {
          rag: {
            enabled: true,
            topK: 7,
            minScore: 0.15,
          },
        },
        telemetry: {
          logRag: false,
        },
      });

      // Update only telemetry
      config.updateConfig({
        features: {
          rag: {
            enabled: true,
            topK: 7,
            minScore: 0.15,
          },
        },
        telemetry: {
          logRag: true,
        },
      });

      const fullConfig = config.getConfig();
      expect(fullConfig.features.rag.topK).toBe(7);
      expect(fullConfig.telemetry.logRag).toBe(true);
    });
  });
});
