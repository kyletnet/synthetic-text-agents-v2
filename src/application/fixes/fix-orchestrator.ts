/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Fix Orchestrator
 *
 * Orchestrates the execution of multiple fix commands:
 * - Transaction support (all-or-nothing)
 * - Parallel execution
 * - Progress tracking
 * - Rollback on failure
 * - Command dependency management
 */

import { EventEmitter } from "events";
import type {
  FixCommand,
  Issue,
  FixResult,
  FixCommandOptions,
  FileChange,
} from "../../domain/fixes/fix-command.js";
import type { Logger } from "../../shared/logger.js";

export interface TransactionResult {
  /** Whether the entire transaction succeeded */
  success: boolean;

  /** Individual command results */
  commandResults: Map<string, FixResult>;

  /** Total issues fixed */
  totalFixed: number;

  /** Total issues failed */
  totalFailed: number;

  /** Total changes applied */
  totalChanges: number;

  /** Total duration in milliseconds */
  duration: number;

  /** Whether rollback was performed */
  rolledBack: boolean;

  /** Rollback errors (if any) */
  rollbackErrors: string[];
}

export interface OrchestratorOptions {
  /** Execute all commands in a transaction (rollback on failure) */
  transactional?: boolean;

  /** Maximum parallel command executions */
  maxParallel?: number;

  /** Timeout for entire operation in milliseconds */
  timeout?: number;

  /** Dry run mode */
  dryRun?: boolean;

  /** Create backups before executing */
  createBackups?: boolean;

  /** Continue on command failure (non-transactional only) */
  continueOnError?: boolean;

  /** Logger instance */
  logger?: Logger;
}

/**
 * Fix Orchestrator
 *
 * Manages the execution of multiple fix commands with:
 * - Transaction support
 * - Parallel execution
 * - Dependency resolution
 * - Progress tracking
 */
export class FixOrchestrator extends EventEmitter {
  private commands: Map<string, FixCommand> = new Map();
  private logger: Logger;
  private isExecuting = false;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.setMaxListeners(50);
  }

  /**
   * Register a fix command
   */
  registerCommand(command: FixCommand): void {
    if (this.commands.has(command.id)) {
      this.logger.warn(`Command ${command.id} is already registered`);
      return;
    }

    this.commands.set(command.id, command);
    this.logger.debug(`Registered command: ${command.id}`);
  }

  /**
   * Unregister a fix command
   */
  unregisterCommand(commandId: string): void {
    this.commands.delete(commandId);
    this.logger.debug(`Unregistered command: ${commandId}`);
  }

  /**
   * Get all registered commands
   */
  getCommands(): FixCommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Execute fixes for the given issues
   *
   * @param issues - Issues to fix
   * @param options - Orchestrator options
   * @returns Transaction result
   */
  async execute(
    issues: Issue[],
    options: OrchestratorOptions = {},
  ): Promise<TransactionResult> {
    if (this.isExecuting) {
      throw new Error("Orchestrator is already executing");
    }

    this.isExecuting = true;
    const startTime = Date.now();

    this.logger.info("Starting fix orchestration", {
      issueCount: issues.length,
      commandCount: this.commands.size,
      transactional: options.transactional ?? true,
      dryRun: options.dryRun ?? false,
    });

    this.emit("orchestration:started", { issues, options });

    try {
      // Group issues by command
      const issuesByCommand = this.groupIssuesByCommand(issues);

      // Execute with timeout if specified
      const result = options.timeout
        ? await this.executeWithTimeout(issuesByCommand, options)
        : await this.executeInternal(issuesByCommand, options);

      const duration = Date.now() - startTime;
      result.duration = duration;

      this.logger.info("Fix orchestration completed", {
        success: result.success,
        totalFixed: result.totalFixed,
        totalFailed: result.totalFailed,
        duration,
      });

      this.emit("orchestration:completed", { result });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error("Fix orchestration failed", {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      this.emit("orchestration:failed", { error });

      return {
        success: false,
        commandResults: new Map(),
        totalFixed: 0,
        totalFailed: issues.length,
        totalChanges: 0,
        duration,
        rolledBack: false,
        rollbackErrors: [],
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout(
    issuesByCommand: Map<string, Issue[]>,
    options: OrchestratorOptions,
  ): Promise<TransactionResult> {
    return Promise.race([
      this.executeInternal(issuesByCommand, options),
      this.createTimeoutPromise(options.timeout!),
    ]);
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(timeout: number): Promise<TransactionResult> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Orchestration timeout after ${timeout}ms`));
      }, timeout);
    });
  }

  /**
   * Internal execution logic
   */
  private async executeInternal(
    issuesByCommand: Map<string, Issue[]>,
    options: OrchestratorOptions,
  ): Promise<TransactionResult> {
    const commandResults = new Map<string, FixResult>();
    const executedCommands: string[] = [];

    const maxParallel = options.maxParallel ?? 1;
    const transactional = options.transactional ?? true;
    const continueOnError = options.continueOnError ?? false;

    try {
      // Execute commands in batches for parallel execution
      const commandBatches = this.createCommandBatches(
        Array.from(issuesByCommand.entries()),
        maxParallel,
      );

      for (const batch of commandBatches) {
        // Execute batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map(async ([commandId, commandIssues]) => {
            const command = this.commands.get(commandId);
            if (!command) {
              throw new Error(`Command not found: ${commandId}`);
            }

            this.logger.info(`Executing command: ${commandId}`, {
              issueCount: commandIssues.length,
            });

            this.emit("command:started", {
              commandId,
              issueCount: commandIssues.length,
            });

            const commandOptions: FixCommandOptions = {
              dryRun: options.dryRun,
              createBackup: options.createBackups,
              logger: this.logger,
              onProgress: (progress) => {
                this.emit("command:progress", { commandId, progress });
              },
            };

            const result = await command.execute(commandIssues, commandOptions);

            this.emit("command:completed", { commandId, result });

            return { commandId, result };
          }),
        );

        // Process batch results
        for (const promiseResult of batchResults) {
          if (promiseResult.status === "fulfilled") {
            const { commandId, result } = promiseResult.value;
            commandResults.set(commandId, result);
            executedCommands.push(commandId);

            // If transactional and command failed, throw to trigger rollback
            if (transactional && !result.success) {
              throw new Error(
                `Command ${commandId} failed in transactional mode`,
              );
            }

            // If not continuing on error and command failed, throw
            if (!continueOnError && !result.success) {
              throw new Error(`Command ${commandId} failed`);
            }
          } else {
            const error = promiseResult.reason;
            this.logger.error("Command execution failed", {
              error: error instanceof Error ? error.message : String(error),
            });

            if (transactional || !continueOnError) {
              throw error;
            }
          }
        }
      }

      // Calculate totals
      const totals = this.calculateTotals(commandResults);

      return {
        success: totals.totalFailed === 0,
        commandResults,
        totalFixed: totals.totalFixed,
        totalFailed: totals.totalFailed,
        totalChanges: totals.totalChanges,
        duration: 0, // Will be set by caller
        rolledBack: false,
        rollbackErrors: [],
      };
    } catch (error) {
      this.logger.error("Orchestration failed, rolling back", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Rollback executed commands in reverse order
      const rollbackErrors = await this.rollback(executedCommands);

      // Calculate totals from partial results
      const totals = this.calculateTotals(commandResults);

      return {
        success: false,
        commandResults,
        totalFixed: 0, // Nothing fixed after rollback
        totalFailed: totals.totalFixed + totals.totalFailed,
        totalChanges: 0, // No changes after rollback
        duration: 0, // Will be set by caller
        rolledBack: true,
        rollbackErrors,
      };
    }
  }

  /**
   * Rollback executed commands
   */
  private async rollback(commandIds: string[]): Promise<string[]> {
    this.logger.info("Rolling back commands", { count: commandIds.length });
    this.emit("rollback:started", { commandIds });

    const errors: string[] = [];

    // Rollback in reverse order
    for (let i = commandIds.length - 1; i >= 0; i--) {
      const commandId = commandIds[i];
      const command = this.commands.get(commandId);

      if (!command) {
        errors.push(`Command not found for rollback: ${commandId}`);
        continue;
      }

      try {
        this.logger.info(`Rolling back command: ${commandId}`);
        const success = await command.undo();

        if (!success) {
          errors.push(`Rollback failed for command: ${commandId}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Rollback error for ${commandId}: ${errorMsg}`);
        this.logger.error(`Rollback failed for ${commandId}`, {
          error: errorMsg,
        });
      }
    }

    this.emit("rollback:completed", { errors });

    return errors;
  }

  /**
   * Group issues by the commands that can fix them
   */
  private groupIssuesByCommand(issues: Issue[]): Map<string, Issue[]> {
    const grouped = new Map<string, Issue[]>();

    for (const issue of issues) {
      // Find commands that can fix this issue
      for (const [commandId, command] of this.commands.entries()) {
        if (command.canFix(issue)) {
          const existing = grouped.get(commandId) ?? [];
          existing.push(issue);
          grouped.set(commandId, existing);
          break; // Only one command per issue
        }
      }
    }

    return grouped;
  }

  /**
   * Create command batches for parallel execution
   */
  private createCommandBatches(
    entries: Array<[string, Issue[]]>,
    batchSize: number,
  ): Array<Array<[string, Issue[]]>> {
    const batches: Array<Array<[string, Issue[]]>> = [];

    for (let i = 0; i < entries.length; i += batchSize) {
      batches.push(entries.slice(i, i + batchSize));
    }

    return batches;
  }

  /**
   * Calculate totals from command results
   */
  private calculateTotals(results: Map<string, FixResult>): {
    totalFixed: number;
    totalFailed: number;
    totalChanges: number;
  } {
    let totalFixed = 0;
    let totalFailed = 0;
    let totalChanges = 0;

    for (const result of results.values()) {
      totalFixed += result.fixedIssues.length;
      totalFailed += result.failedIssues.length;
      totalChanges += result.changes.length;
    }

    return { totalFixed, totalFailed, totalChanges };
  }

  /**
   * Clear all registered commands
   */
  clear(): void {
    this.commands.clear();
    this.logger.debug("Cleared all registered commands");
  }
}
