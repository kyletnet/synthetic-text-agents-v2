/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Restore Manager
 * Application service for managing restore operations
 */

import { EventEmitter } from "events";
import type {
  BackupConfig,
  BackupMetadata,
  RestoreRequest,
  RestoreResult,
} from "../../domain/backup/backup-types";
import type { BackupStrategy } from "../../domain/backup/backup-strategy";
import { FileBackupStrategy } from "../../domain/backup/backup-strategies/file-backup";
import { DirectoryBackupStrategy } from "../../domain/backup/backup-strategies/directory-backup";
import { IncrementalBackupStrategy } from "../../domain/backup/backup-strategies/incremental-backup";
import { Logger } from "../../shared/logger";

export class RestoreManager extends EventEmitter {
  private strategies: Map<string, BackupStrategy>;
  private config: BackupConfig;
  private logger: Logger;

  constructor(config: BackupConfig) {
    super();
    this.setMaxListeners(50);

    this.config = config;
    this.logger = new Logger({ level: "info" });
    this.strategies = new Map();

    // Initialize strategies
    this.initializeStrategies();
  }

  /**
   * Initialize restore strategies
   */
  private initializeStrategies(): void {
    // Create FileOperations instance for dependency injection
    // Import is allowed from application layer since it's using infrastructure

    const {
      FileOperations,
    } = require("../../infrastructure/backup/file-operations");
    const fileOps = new FileOperations();

    this.strategies.set("file", new FileBackupStrategy(fileOps));
    this.strategies.set("directory", new DirectoryBackupStrategy(fileOps));
    this.strategies.set("incremental", new IncrementalBackupStrategy(fileOps));
  }

  /**
   * Restore from a backup
   */
  async restore(
    metadata: BackupMetadata,
    request: RestoreRequest,
  ): Promise<RestoreResult> {
    if (metadata.status !== "completed") {
      throw new Error(
        `Backup ${request.backupId} is not in completed state (status: ${metadata.status})`,
      );
    }

    this.logger.info(`Starting restore from backup: ${request.backupId}`);
    this.emit("restore:started", { backupId: request.backupId });

    try {
      // Get appropriate strategy based on backup type
      const strategy = this.getStrategyForBackup(metadata);

      // Execute restore
      const result = await strategy.restore(metadata, request, this.config);

      this.emit("restore:completed", {
        backupId: request.backupId,
        result,
      });

      this.logger.info(
        `Restore completed: ${request.backupId} (${result.restoredFiles}/${result.totalFiles} files)`,
      );

      return result;
    } catch (error) {
      this.emit("restore:failed", {
        backupId: request.backupId,
        error,
      });

      this.logger.error(`Restore failed: ${request.backupId}`, error);
      throw error;
    }
  }

  /**
   * Validate a backup
   */
  async validateBackup(metadata: BackupMetadata): Promise<boolean> {
    this.logger.info(`Validating backup: ${metadata.id}`);

    try {
      const strategy = this.getStrategyForBackup(metadata);
      const isValid = await strategy.validate(metadata, this.config);

      if (isValid) {
        this.logger.info(`Backup validation passed: ${metadata.id}`);
      } else {
        this.logger.error(`Backup validation failed: ${metadata.id}`);
      }

      return isValid;
    } catch (error) {
      this.logger.error(`Backup validation error: ${metadata.id}`, error);
      return false;
    }
  }

  /**
   * Get strategy for a backup based on its type
   */
  private getStrategyForBackup(metadata: BackupMetadata): BackupStrategy {
    let strategyKey: string;

    switch (metadata.type) {
      case "full":
        // Determine if it was file or directory backup based on strategy name
        if (metadata.strategy.includes("file")) {
          strategyKey = "file";
        } else {
          strategyKey = "directory";
        }
        break;

      case "incremental":
      case "differential":
        strategyKey = "incremental";
        break;

      default:
        throw new Error(`Unknown backup type: ${metadata.type}`);
    }

    const strategy = this.strategies.get(strategyKey);
    if (!strategy) {
      throw new Error(`Strategy not found for backup type: ${metadata.type}`);
    }

    return strategy;
  }
}
