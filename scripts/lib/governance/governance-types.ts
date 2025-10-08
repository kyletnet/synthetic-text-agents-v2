/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Common Governance Types
 *
 * Shared type definitions used across governance modules
 */

/**
 * Operation type for timeout policy
 */
export type OperationType =
  | "user-input" // 무한 대기 허용
  | "system-command" // 10분 타임아웃
  | "validation" // 2분 타임아웃
  | "file-operation"; // 30초 타임아웃

/**
 * Severity levels
 */
export type Severity = "critical" | "high" | "medium" | "low";

/**
 * Governance rule definition
 */
export interface GovernanceRule {
  id: string;
  severity: Severity;
  description: string;
  enabled: boolean;
  enforceInCI: boolean;
  message?: string;
  pattern?: string;
  action?: "throw" | "warn" | "log";
  enforcedBy?: string;
}

/**
 * Timeout policy
 */
export interface TimeoutPolicy {
  timeout: number | null; // null = 무한 대기
  description: string;
  examples?: string[];
}

/**
 * Loop detection configuration
 */
export interface LoopDetectionConfig {
  enabled: boolean;
  maxIterations: number;
  maxRatePerSecond: number;
  whitelist: string[];
  alertThreshold: {
    iterations: number;
    ratePerSecond: number;
  };
  profileEnabled: boolean;
  profilePath: string;
}

/**
 * Notification channel configuration
 */
export interface NotificationConfig {
  enabled: boolean;
  channels: NotificationChannel[];
  config: {
    slack?: {
      webhookUrl: string;
      channel: string;
      username: string;
    };
    github?: {
      repo: string;
      owner: string;
      token: string;
      labels: string[];
    };
    file?: {
      logPath: string;
      maxFiles: number;
      rotationPolicy: "daily" | "weekly" | "size-based";
    };
  };
  eventTypes: Record<string, EventTypeConfig>;
}

export type NotificationChannel =
  | "console"
  | "file"
  | "slack"
  | "github"
  | "email";

export interface EventTypeConfig {
  severity: Severity;
  channels: NotificationChannel[];
}

/**
 * Risk domain definition
 */
export interface RiskDomain {
  path: string;
  reason: string;
  severity: Severity;
  requiresApproval: boolean;
}

/**
 * Deprecated file definition
 */
export interface DeprecatedFile {
  path: string;
  replacement: string;
  reason: string;
  deprecatedSince: string;
}

/**
 * Governance rules configuration (from governance-rules.json)
 */
export interface GovernanceRulesConfig {
  schemaVersion: string;
  metadata: {
    description: string;
    lastUpdated: string;
    maintainer: string;
  };
  rules: GovernanceRule[];
  timeoutPolicy: Record<OperationType, TimeoutPolicy>;
  loopDetection: LoopDetectionConfig;
  notifications: NotificationConfig;
  snapshot: {
    enabled: boolean;
    includePaths: string[];
    excludePaths: string[];
    hashAlgorithm: string;
    retentionDays: number;
  };
  operationLogging: {
    enabled: boolean;
    logPath: string;
    detailLevel: "minimal" | "normal" | "verbose";
    includeSnapshots: boolean;
    rotationPolicy: {
      maxSizeMB: number;
      maxFiles: number;
    };
  };
  riskDomains: RiskDomain[];
  selfValidation: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
    checks: Array<{
      name: string;
      command: string;
      required: boolean;
      autoFix?: string;
    }>;
  };
  deprecatedFiles: DeprecatedFile[];
}

/**
 * Execution options for SafeExecutor
 */
export interface ExecutionOptions {
  type: OperationType;
  maxRetries?: number;
  retryDelay?: number;
  onTimeout?: () => void;
  onRetry?: (attempt: number) => void;
}

/**
 * Timeout error
 */
export class TimeoutError extends Error {
  constructor(
    message: string,
    public operationType: OperationType,
    public timeout: number,
  ) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Infinite loop error
 */
export class InfiniteLoopError extends Error {
  constructor(
    public operationId: string,
    public iterations: number,
    public duration: number,
  ) {
    super(
      `Infinite loop detected: ${operationId} (${iterations} iterations in ${duration}s)`,
    );
    this.name = "InfiniteLoopError";
  }
}

/**
 * Verification error
 */
export class VerificationError extends Error {
  constructor(
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "VerificationError";
  }
}

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Governance error (base class)
 */
export class GovernanceError extends Error {
  constructor(
    message: string,
    public code: string,
    public severity: Severity,
  ) {
    super(message);
    this.name = "GovernanceError";
  }
}
