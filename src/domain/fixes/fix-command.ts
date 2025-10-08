/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Fix Command Pattern - Base Interface
 *
 * Design Philosophy:
 * - Each fix command is independent and testable
 * - Undo capability is mandatory for safe rollback
 * - Commands report progress and results
 * - Commands can be executed in parallel or sequentially
 *
 * Command Pattern Benefits:
 * - Separation of concerns (each fix type has its own class)
 * - Testability (each command can be unit tested)
 * - Extensibility (new fix types just add new commands)
 * - Transaction support (undo/redo capabilities)
 */

import type { Logger } from "../../shared/logger.js";

/**
 * Issue definition - unified across all fix types
 */
export interface Issue {
  /** Unique identifier for the issue */
  id: string;

  /** Category of the issue */
  category:
    | "typescript"
    | "eslint"
    | "import"
    | "workaround"
    | "documentation"
    | "security";

  /** Severity level */
  severity: "critical" | "high" | "medium" | "low";

  /** Human-readable description */
  description: string;

  /** File path where the issue exists */
  filePath: string;

  /** Line number (optional) */
  line?: number;

  /** Column number (optional) */
  column?: number;

  /** Specific error message */
  message: string;

  /** Whether this issue can be auto-fixed */
  autoFixable: boolean;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Fix result for a single command execution
 */
export interface FixResult {
  /** Whether the fix was successful */
  success: boolean;

  /** Issues that were fixed */
  fixedIssues: Issue[];

  /** Issues that failed to fix */
  failedIssues: Issue[];

  /** Changes applied during the fix */
  changes: FileChange[];

  /** Error message if failed */
  error?: string;

  /** Execution time in milliseconds */
  duration: number;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * File change record for undo capability
 */
export interface FileChange {
  /** File path */
  filePath: string;

  /** Original content (for undo) */
  originalContent: string;

  /** New content after fix */
  newContent: string;

  /** Type of change */
  changeType: "modify" | "create" | "delete";

  /** Timestamp of change */
  timestamp: Date;

  /** Checksum of original content */
  checksum: string;
}

/**
 * Progress update callback
 */
export interface ProgressUpdate {
  /** Current step */
  step: number;

  /** Total steps */
  total: number;

  /** Current status message */
  message: string;

  /** Progress percentage (0-100) */
  percentage: number;
}

/**
 * Fix Command Interface
 *
 * All fix commands must implement this interface
 */
export interface FixCommand {
  /** Command identifier */
  readonly id: string;

  /** Command name */
  readonly name: string;

  /** Command description */
  readonly description: string;

  /**
   * Check if this command can fix the given issue
   */
  canFix(issue: Issue): boolean;

  /**
   * Execute the fix for the given issues
   *
   * @param issues - Issues to fix
   * @param options - Execution options
   * @returns Fix result
   */
  execute(issues: Issue[], options?: FixCommandOptions): Promise<FixResult>;

  /**
   * Undo the last fix
   *
   * @returns True if undo was successful
   */
  undo(): Promise<boolean>;

  /**
   * Validate that the fix can be applied safely
   *
   * @param issues - Issues to validate
   * @returns Validation result
   */
  validate(issues: Issue[]): Promise<ValidationResult>;
}

/**
 * Fix command execution options
 */
export interface FixCommandOptions {
  /** Dry run mode (don't actually apply changes) */
  dryRun?: boolean;

  /** Progress callback */
  onProgress?: (update: ProgressUpdate) => void;

  /** Logger instance */
  logger?: Logger;

  /** Maximum parallel executions */
  maxParallel?: number;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Whether to create backup before fixing */
  createBackup?: boolean;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation errors */
  errors: string[];

  /** Validation warnings */
  warnings: string[];

  /** Risk assessment */
  riskLevel: "low" | "medium" | "high" | "critical";

  /** Estimated duration in seconds */
  estimatedDuration: number;
}

/**
 * Abstract base class for fix commands
 *
 * Provides common functionality:
 * - Logging
 * - Progress reporting
 * - Undo stack management
 * - Validation
 */
export abstract class BaseFixCommand implements FixCommand {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;

  protected logger: Logger;
  protected undoStack: FileChange[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  abstract canFix(issue: Issue): boolean;

  abstract execute(
    issues: Issue[],
    options?: FixCommandOptions,
  ): Promise<FixResult>;

  /**
   * Default undo implementation - can be overridden
   */
  async undo(): Promise<boolean> {
    this.logger.info(`Undoing ${this.name}`, {
      changesCount: this.undoStack.length,
    });

    try {
      // Restore files in reverse order
      for (let i = this.undoStack.length - 1; i >= 0; i--) {
        const change = this.undoStack[i];
        await this.restoreFile(change);
      }

      this.undoStack = [];
      this.logger.info(`Successfully undid ${this.name}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to undo ${this.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Default validation implementation - can be overridden
   */
  async validate(issues: Issue[]): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (issues.length === 0) {
      errors.push("No issues provided");
    }

    // Check if all issues can be fixed by this command
    const unfixable = issues.filter((issue) => !this.canFix(issue));
    if (unfixable.length > 0) {
      errors.push(`Cannot fix ${unfixable.length} issues with this command`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      riskLevel: this.assessRisk(issues),
      estimatedDuration: this.estimateDuration(issues),
    };
  }

  /**
   * Assess risk level based on issues
   */
  protected assessRisk(
    issues: Issue[],
  ): "low" | "medium" | "high" | "critical" {
    const hasCritical = issues.some((i) => i.severity === "critical");
    const hasHigh = issues.some((i) => i.severity === "high");
    const count = issues.length;

    if (hasCritical || count > 50) return "critical";
    if (hasHigh || count > 20) return "high";
    if (count > 5) return "medium";
    return "low";
  }

  /**
   * Estimate duration based on issues count
   */
  protected estimateDuration(issues: Issue[]): number {
    // Base duration: 2 seconds per issue
    return issues.length * 2;
  }

  /**
   * Restore a file from a change record
   */
  protected async restoreFile(change: FileChange): Promise<void> {
    const fs = await import("fs/promises");

    switch (change.changeType) {
      case "modify":
        await fs.writeFile(change.filePath, change.originalContent, "utf8");
        break;
      case "create":
        await fs.unlink(change.filePath);
        break;
      case "delete":
        await fs.writeFile(change.filePath, change.originalContent, "utf8");
        break;
    }
  }

  /**
   * Calculate checksum for file content
   */
  protected async calculateChecksum(content: string): Promise<string> {
    const crypto = await import("crypto");
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  /**
   * Report progress
   */
  protected reportProgress(
    options: FixCommandOptions | undefined,
    step: number,
    total: number,
    message: string,
  ): void {
    if (options?.onProgress) {
      options.onProgress({
        step,
        total,
        message,
        percentage: Math.round((step / total) * 100),
      });
    }
  }
}
