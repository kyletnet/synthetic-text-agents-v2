/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Plugin Loader - 보안과 스코프를 고려한 플러그인 로딩 시스템
 *
 * 팀별/기능별 플러그인을 안전하게 로드하고 실행하는 시스템
 */

import { glob } from "glob";
import { Logger } from "./logger.js";
import {
  DocPlugin,
  PluginLoader,
  DocSyncContext,
  DocPluginResult,
  DocPermission,
} from "./pluginTypes.js";

export class DocPluginLoader implements PluginLoader {
  private logger = new Logger({ level: "info" });
  private loadedPlugins = new Map<string, DocPlugin>();

  /**
   * 지정된 패턴으로 플러그인 로드
   */
  async loadPlugins(
    patterns: string[],
    projectScope?: string,
  ): Promise<DocPlugin[]> {
    this.logger.info("🔌 Loading plugins", { patterns, projectScope });

    const plugins: DocPlugin[] = [];
    const pluginFiles = new Set<string>();

    // 각 패턴에 대해 파일 검색
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          ignore: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"],
        });
        files.forEach((file) => pluginFiles.add(file));
      } catch (error) {
        this.logger.warn(`Failed to load pattern: ${pattern}`, error);
      }
    }

    this.logger.info(`📁 Found ${pluginFiles.size} plugin files`);

    // 각 파일에서 플러그인 로드
    for (const filePath of pluginFiles) {
      try {
        const plugin = await this.loadSinglePlugin(filePath, projectScope);
        if (plugin) {
          plugins.push(plugin);
          this.loadedPlugins.set(plugin.meta.name, plugin);
        }
      } catch (error) {
        this.logger.error(`Failed to load plugin: ${filePath}`, error);
      }
    }

    this.logger.info(`✅ Loaded ${plugins.length} plugins successfully`);
    return plugins;
  }

  /**
   * 단일 플러그인 로드
   */
  private async loadSinglePlugin(
    filePath: string,
    projectScope?: string,
  ): Promise<DocPlugin | null> {
    try {
      // 플러그인 모듈 동적 임포트
      const pluginModule = await import(filePath);
      const plugin: DocPlugin = pluginModule.default || pluginModule;

      // 플러그인 검증
      if (!this.validatePluginStructure(plugin)) {
        this.logger.warn(`Invalid plugin structure: ${filePath}`);
        return null;
      }

      // 스코프 검증
      if (projectScope && !plugin.meta.supportedScopes.includes(projectScope)) {
        this.logger.info(`Plugin ${plugin.meta.name} skipped (scope mismatch)`);
        return null;
      }

      // 플러그인 초기화
      if (plugin.initialize) {
        const context = this.createInitialContext();
        await plugin.initialize(context);
      }

      this.logger.info(
        `🔌 Loaded plugin: ${plugin.meta.name} v${plugin.meta.version}`,
      );
      return plugin;
    } catch (error) {
      this.logger.error(`Failed to load plugin from ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 초기 컨텍스트 생성
   */
  private createInitialContext(): DocSyncContext {
    return {
      projectRoot: process.cwd(),
      projectScope: "default",
      changedFiles: [],
      documentMap: {},
      environment: "development" as const,
      cache: new Map(),
      tempFiles: [],
      logger: this.logger,
      traceId: "trace-" + Date.now(),
    };
  }

  /**
   * 플러그인 구조 검증
   */
  private validatePluginStructure(plugin: any): plugin is DocPlugin {
    return (
      plugin &&
      typeof plugin === "object" &&
      plugin.meta &&
      typeof plugin.meta.name === "string" &&
      typeof plugin.meta.version === "string" &&
      typeof plugin.execute === "function" &&
      Array.isArray(plugin.meta.permissions) &&
      Array.isArray(plugin.meta.supportedScopes)
    );
  }

  /**
   * 플러그인 보안 검증
   */
  validatePluginSecurity(
    plugin: DocPlugin,
    requiredPermissions: DocPermission[],
  ): boolean {
    const pluginPermissions = plugin.meta.permissions;

    // 요구되는 권한이 플러그인 권한에 포함되는지 확인
    return requiredPermissions.every((permission) =>
      pluginPermissions.includes(permission),
    );
  }

  /**
   * 단일 플러그인 실행
   */
  async executePlugin(
    plugin: DocPlugin,
    context: DocSyncContext,
  ): Promise<DocPluginResult> {
    const startTime = Date.now();

    try {
      this.logger.info(`🚀 Executing plugin: ${plugin.meta.name}`);

      // 플러그인 헬스체크
      if (plugin.healthCheck) {
        const healthy = await plugin.healthCheck();
        if (!healthy) {
          return this.createErrorResult(
            plugin,
            "Plugin health check failed",
            startTime,
          );
        }
      }

      // 권한 검증 (예시: 기본 권한만 체크)
      const requiredPermissions: DocPermission[] = ["general-docs"];
      if (!this.validatePluginSecurity(plugin, requiredPermissions)) {
        return this.createErrorResult(
          plugin,
          "Insufficient permissions",
          startTime,
        );
      }

      // 플러그인 실행
      const result = await plugin.execute(context);

      this.logger.info(`✅ Plugin executed successfully: ${plugin.meta.name}`);
      return result;
    } catch (error) {
      this.logger.error(
        `❌ Plugin execution failed: ${plugin.meta.name}`,
        error,
      );
      return this.createErrorResult(
        plugin,
        `Execution error: ${error}`,
        startTime,
      );
    } finally {
      // 정리 작업
      if (plugin.cleanup) {
        try {
          await plugin.cleanup(context);
        } catch (cleanupError) {
          this.logger.warn(
            `Cleanup failed for ${plugin.meta.name}:`,
            cleanupError,
          );
        }
      }
    }
  }

  /**
   * 여러 플러그인 순차 실행
   */
  async runPluginsSequentially(
    plugins: DocPlugin[],
    context: DocSyncContext,
  ): Promise<{
    success: boolean;
    results: DocPluginResult[];
  }> {
    const results: DocPluginResult[] = [];
    let allSuccess = true;

    for (const plugin of plugins) {
      try {
        const result = await this.executePlugin(plugin, context);
        results.push(result);

        if (!result.success) {
          allSuccess = false;
          // 치명적 오류인 경우 중단
          if (result.error && !result.error.recoverable) {
            this.logger.error(
              `Critical error in ${plugin.meta.name}, stopping execution`,
            );
            break;
          }
        }
      } catch (error) {
        allSuccess = false;
        this.logger.error(`Fatal error executing ${plugin.meta.name}:`, error);
        break;
      }
    }

    return { success: allSuccess, results };
  }

  /**
   * 오류 결과 생성 헬퍼
   */
  private createErrorResult(
    plugin: DocPlugin,
    message: string,
    startTime: number,
  ): DocPluginResult {
    return {
      success: false,
      message,
      modifiedFiles: [],
      newDependencies: [],
      executionTime: Date.now() - startTime,
      resourceUsage: {
        memoryMB: process.memoryUsage().heapUsed / 1024 / 1024,
      },
      error: {
        code: "PLUGIN_ERROR",
        details: message,
        recoverable: true,
      },
      metadata: {
        pluginName: plugin.meta.name,
        pluginVersion: plugin.meta.version,
      },
    };
  }
}

export default DocPluginLoader;
