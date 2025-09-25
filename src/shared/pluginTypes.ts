/**
 * DocPlugin Interface - 확장 가능한 문서 자동화 플러그인 시스템
 */

export interface DocPluginMeta {
  name: string;
  description: string;
  version: string;
  author?: string;
  permissions: DocPermission[];
  supportedScopes: string[];
  documentTypes: string[];
  dependencies?: string[];
}

export type DocPermission =
  | "general-docs"
  | "core-system"
  | "security"
  | "api-docs"
  | "code-analysis"
  | "file-system"
  | "git-ops"
  | "llm-calls";

export interface DocSyncContext {
  projectRoot: string;
  projectScope: string;
  changedFiles: string[];
  gitDiff?: string;
  documentMap: Record<string, DocStatus>;
  environment: "development" | "staging" | "production";
  cache: Map<string, any>;
  tempFiles: string[];
  logger: Logger;
  traceId: string;
}

export interface DocStatus {
  path: string;
  lastModified: Date;
  contentHash: string;
  generatedBy?: string;
  needsUpdate: boolean;
  dependencies: string[];
}

export interface DocPluginResult {
  success: boolean;
  message: string;
  modifiedFiles: string[];
  newDependencies: string[];
  executionTime: number;
  resourceUsage: {
    memoryMB: number;
    llmTokens?: number;
    apiCalls?: number;
  };
  error?: {
    code: string;
    details: string;
    recoverable: boolean;
  };
  metadata: Record<string, any>;
}

export interface DocPlugin {
  meta: DocPluginMeta;
  initialize(context: DocSyncContext): Promise<void>;
  execute(context: DocSyncContext): Promise<DocPluginResult>;
  cleanup?(context: DocSyncContext): Promise<void>;
  healthCheck?(): Promise<boolean>;
}

export interface PluginLoader {
  loadPlugins(patterns: string[], projectScope?: string): Promise<DocPlugin[]>;
  validatePluginSecurity(
    plugin: DocPlugin,
    requiredPermissions: DocPermission[],
  ): boolean;
  executePlugin(
    plugin: DocPlugin,
    context: DocSyncContext,
  ): Promise<DocPluginResult>;
}

export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: any): void;
}
