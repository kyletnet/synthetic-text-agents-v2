/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Feature Matrix Manager
 *
 * Manages plugin activation, conflict resolution, and priority ordering.
 * Loads configuration from feature-matrix.yml
 *
 * Phase 2B Step 3: Plugin Integration
 */

import { readFileSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";

/**
 * Plugin Configuration
 */
export interface PluginConfig {
  name: string;
  enabled: boolean;
  phase: string;
  priority: number;
  canary_percentage?: number;
  conflicts?: string[];
  dependencies?: string[];
  cost_per_qa?: number;
  max_budget?: number;
}

/**
 * Feature Matrix Configuration
 */
export interface FeatureMatrixConfig {
  version: string;
  updated: string;
  feedback_loop: {
    enabled: boolean;
    canary_percentage: number;
    auto_adjustment: boolean;
    drift_threshold: number;
    baseline_tag: string;
  };
  plugin_registry: {
    enabled: boolean;
    max_concurrent_plugins: number;
    auto_registration: boolean;
    priority_order: string[];
  };
  [key: string]: any;
}

/**
 * Feature Matrix Manager
 *
 * Handles plugin registration, conflict detection, and priority ordering.
 */
export class FeatureMatrixManager {
  private config: FeatureMatrixConfig;
  private plugins: Map<string, PluginConfig> = new Map();
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.config = this.loadConfig();
    this.loadPlugins();
  }

  /**
   * Load feature matrix configuration
   */
  private loadConfig(): FeatureMatrixConfig {
    const configPath = join(
      this.projectRoot,
      "configs",
      "quality",
      "feature-matrix.yml",
    );

    try {
      const content = readFileSync(configPath, "utf8");
      return parseYaml(content) as FeatureMatrixConfig;
    } catch (error) {
      console.warn(
        `Feature matrix config not found: ${configPath}, using defaults`,
      );
      return this.getDefaultConfig();
    }
  }

  /**
   * Load plugin configurations
   */
  private loadPlugins(): void {
    // Extract plugin configs from feature matrix
    const pluginKeys = [
      "rule_based_checker",
      "evidence_aligner",
      "hybrid_search_checker",
      "multi_view_embedding",
      "query_side_embedding",
      "translation_embedding",
      "ragas_eval",
    ];

    for (const key of pluginKeys) {
      if (this.config[key]) {
        const pluginConfig = this.config[key] as PluginConfig;

        // Override with environment variables if available
        const envKey = this.getEnvKey(pluginConfig.name);
        if (process.env[envKey] !== undefined) {
          pluginConfig.enabled = process.env[envKey] === "true";
        }

        this.plugins.set(pluginConfig.name, pluginConfig);
      }
    }
  }

  /**
   * Get environment variable key for plugin
   */
  private getEnvKey(pluginName: string): string {
    // Convert "hybrid-search-checker" -> "FEATURE_QUALITY_HYBRID_SEARCH"
    const normalized = pluginName
      .replace(/-checker$/, "")
      .replace(/-/g, "_")
      .toUpperCase();
    return `FEATURE_QUALITY_${normalized}`;
  }

  /**
   * Check if plugin is enabled
   */
  isEnabled(pluginName: string): boolean {
    const plugin = this.plugins.get(pluginName);
    return plugin?.enabled ?? false;
  }

  /**
   * Get conflicts for a plugin
   */
  getConflicts(pluginName: string): string[] {
    const plugin = this.plugins.get(pluginName);
    return plugin?.conflicts ?? [];
  }

  /**
   * Get dependencies for a plugin
   */
  getDependencies(pluginName: string): string[] {
    const plugin = this.plugins.get(pluginName);
    return plugin?.dependencies ?? [];
  }

  /**
   * Check if plugin can be activated
   *
   * Returns true if:
   * - Plugin is enabled
   * - No conflicting plugins are active
   * - All dependencies are satisfied
   */
  canActivate(
    pluginName: string,
    activePlugins: string[],
  ): { canActivate: boolean; reason?: string } {
    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      return { canActivate: false, reason: "Plugin not found" };
    }

    if (!plugin.enabled) {
      return { canActivate: false, reason: "Plugin not enabled" };
    }

    // Check conflicts
    const conflicts = plugin.conflicts ?? [];
    for (const conflict of conflicts) {
      if (activePlugins.includes(conflict)) {
        return {
          canActivate: false,
          reason: `Conflicts with active plugin: ${conflict}`,
        };
      }
    }

    // Check dependencies
    const dependencies = plugin.dependencies ?? [];
    for (const dep of dependencies) {
      if (!activePlugins.includes(dep)) {
        return {
          canActivate: false,
          reason: `Missing dependency: ${dep}`,
        };
      }
    }

    return { canActivate: true };
  }

  /**
   * Get plugins in priority order
   */
  getPluginsInPriorityOrder(): PluginConfig[] {
    const plugins = Array.from(this.plugins.values());

    // Sort by priority (ascending)
    return plugins.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get enabled plugins in priority order
   */
  getEnabledPluginsInPriorityOrder(): PluginConfig[] {
    return this.getPluginsInPriorityOrder().filter((p) => p.enabled);
  }

  /**
   * Get feedback loop configuration
   */
  getFeedbackLoopConfig() {
    return this.config.feedback_loop;
  }

  /**
   * Get plugin registry configuration
   */
  getPluginRegistryConfig() {
    return this.config.plugin_registry;
  }

  /**
   * Get default configuration (fallback)
   */
  private getDefaultConfig(): FeatureMatrixConfig {
    return {
      version: "1.0.0",
      updated: new Date().toISOString().split("T")[0],
      feedback_loop: {
        enabled: false,
        canary_percentage: 10,
        auto_adjustment: false,
        drift_threshold: 0.15,
        baseline_tag: "integration-base",
      },
      plugin_registry: {
        enabled: false,
        max_concurrent_plugins: 1,
        auto_registration: false,
        priority_order: [
          "rule_based",
          "evidence_aligner",
          "hybrid_search",
          "multi_view_embedding",
          "ragas_eval",
        ],
      },
    };
  }

  /**
   * Get plugin configuration
   */
  getPluginConfig(pluginName: string): PluginConfig | undefined {
    return this.plugins.get(pluginName);
  }

  /**
   * Get all plugin configurations
   */
  getAllPlugins(): Map<string, PluginConfig> {
    return this.plugins;
  }
}
