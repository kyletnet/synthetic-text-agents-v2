/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Backup Manager
 * Application service for managing backups with strategy selection
 */

import { EventEmitter } from "events";
import type {
  BackupConfig,
  BackupMetadata,
  BackupResult,
  BackupFilters,
} from "../../domain/backup/backup-types";
import type { BackupStrategy } from "../../domain/backup/backup-strategy";
import { FileBackupStrategy } from "../../domain/backup/backup-strategies/file-backup";
import { DirectoryBackupStrategy } from "../../domain/backup/backup-strategies/directory-backup";
import { IncrementalBackupStrategy } from "../../domain/backup/backup-strategies/incremental-backup";
import { Logger } from "../../shared/logger";
import { FileOperations } from "../../infrastructure/backup/file-operations.js";

export interface BackupJobConfig {
  name: string;
  type: "file" | "directory" | "incremental";
  sources: string[];
  destination: string;
  filters?: BackupFilters;
  enabled: boolean;
}

export class BackupManager extends EventEmitter {
  private strategies: Map<string, BackupStrategy>;
  private backups: Map<string, BackupMetadata>;
  private activeBackups: Set<string>;
  private config: BackupConfig;
  private logger: Logger;

  constructor(config: BackupConfig) {
    super();
    this.setMaxListeners(50);

    this.config = config;
    this.logger = new Logger({ level: "info" });
    this.strategies = new Map();
    this.backups = new Map();
    this.activeBackups = new Set();

    // Initialize strategies
    this.initializeStrategies();
  }

  /**
   * Initialize backup strategies
   */
  private initializeStrategies(): void {
    // Create FileOperations instance for dependency injection
    // Import is allowed from application layer since it's using infrastructure
    const fileOps = new FileOperations();

    this.strategies.set("file", new FileBackupStrategy(fileOps));
    this.strategies.set("directory", new DirectoryBackupStrategy(fileOps));
    this.strategies.set("incremental", new IncrementalBackupStrategy(fileOps));
  }

  /**
   * Create a backup using specified strategy
   */
  async createBackup(jobConfig: BackupJobConfig): Promise<BackupResult> {
    if (!jobConfig.enabled) {
      throw new Error(`Backup job '${jobConfig.name}' is disabled`);
    }

    if (this.activeBackups.has(jobConfig.name)) {
      throw new Error(`Backup job '${jobConfig.name}' is already running`);
    }

    const strategy = this.strategies.get(jobConfig.type);
    if (!strategy) {
      throw new Error(`Unknown backup strategy: ${jobConfig.type}`);
    }

    this.activeBackups.add(jobConfig.name);
    this.emit("backup:started", { name: jobConfig.name, type: jobConfig.type });

    try {
      // Find parent backup for incremental
      let parentBackupId: string | undefined;
      if (jobConfig.type === "incremental") {
        parentBackupId = this.findLastBackupId(jobConfig.name);
        if (parentBackupId) {
          const parentMetadata = this.backups.get(parentBackupId);
          if (parentMetadata) {
            (strategy as IncrementalBackupStrategy).setParentBackup(
              parentBackupId,
              parentMetadata,
            );
          }
        }
      }

      // Execute backup
      const result = await strategy.backup(
        jobConfig.sources,
        jobConfig.destination,
        this.config,
        parentBackupId,
        jobConfig.filters,
      );

      // Set job name in metadata
      result.metadata.jobName = jobConfig.name;

      // Store metadata
      this.backups.set(result.backupId, result.metadata);

      // Verify if enabled
      if (this.config.verification.enabled) {
        const isValid = await strategy.validate(result.metadata, this.config);
        result.metadata.verificationStatus = isValid ? "passed" : "failed";

        if (!isValid) {
          this.logger.error(`Backup verification failed: ${result.backupId}`);
        }
      }

      this.emit("backup:completed", {
        name: jobConfig.name,
        backupId: result.backupId,
        result,
      });

      this.logger.info(`Backup completed: ${result.backupId}`);

      return result;
    } catch (error) {
      this.emit("backup:failed", {
        name: jobConfig.name,
        error,
      });

      this.logger.error(`Backup failed: ${jobConfig.name}`, error);
      throw error;
    } finally {
      this.activeBackups.delete(jobConfig.name);
    }
  }

  /**
   * List all backups
   */
  listBackups(name?: string): BackupMetadata[] {
    let backups = Array.from(this.backups.values());

    if (name) {
      backups = backups.filter((b) => b.strategy === name);
    }

    return backups.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  /**
   * Get backup by ID
   */
  getBackup(backupId: string): BackupMetadata | null {
    return this.backups.get(backupId) || null;
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }

    try {
      // Delete backup from memory
      this.backups.delete(backupId);

      this.emit("backup:deleted", { backupId });
      this.logger.info(`Backup deleted: ${backupId}`);
    } catch (error) {
      this.logger.error(`Failed to delete backup: ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Get system status
   */
  getStatus(): {
    enabled: boolean;
    activeBackups: string[];
    totalBackups: number;
    lastBackup: Date | null;
    failedBackups: number;
  } {
    const backups = Array.from(this.backups.values());
    const failedBackups = backups.filter((b) => b.status === "failed").length;

    const lastBackup =
      backups.length > 0
        ? new Date(Math.max(...backups.map((b) => b.timestamp.getTime())))
        : null;

    return {
      enabled: this.config.enabled,
      activeBackups: Array.from(this.activeBackups),
      totalBackups: backups.length,
      lastBackup,
      failedBackups,
    };
  }

  /**
   * Find last backup ID for a job
   */
  private findLastBackupId(jobName: string): string | undefined {
    const jobBackups = Array.from(this.backups.values())
      .filter((b) => b.jobName === jobName && b.status === "completed")
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return jobBackups[0]?.id;
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    for (const jobName of this.activeBackups) {
      this.emit("backup:cancelled", { name: jobName });
    }

    this.emit("shutdown");
  }
}
