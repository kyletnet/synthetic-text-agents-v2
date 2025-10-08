/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Backup Strategy Interface
 * Defines the contract for backup strategies using Strategy pattern
 */

import type {
  BackupMetadata,
  BackupResult,
  RestoreRequest,
  RestoreResult,
  BackupConfig,
  BackupFilters,
} from "./backup-types";

/**
 * Strategy pattern interface for different backup types
 */
export interface BackupStrategy {
  /**
   * Get the name/type of this strategy
   */
  getName(): string;

  /**
   * Execute backup operation
   * @param sources Array of file/directory paths to backup
   * @param destination Destination path for backup
   * @param config Backup configuration
   * @param parentBackupId Optional parent backup for incremental/differential
   * @param filters Optional file filters
   */
  backup(
    sources: string[],
    destination: string,
    config: BackupConfig,
    parentBackupId?: string,
    filters?: BackupFilters,
  ): Promise<BackupResult>;

  /**
   * Execute restore operation
   * @param metadata Backup metadata
   * @param request Restore request details
   * @param config Backup configuration
   */
  restore(
    metadata: BackupMetadata,
    request: RestoreRequest,
    config: BackupConfig,
  ): Promise<RestoreResult>;

  /**
   * Validate a backup
   * @param metadata Backup metadata to validate
   * @param config Backup configuration
   */
  validate(metadata: BackupMetadata, config: BackupConfig): Promise<boolean>;

  /**
   * Collect files to backup based on strategy rules
   * @param sources Source paths
   * @param filters Optional file filters
   * @param parentBackupId Optional parent backup for comparison
   */
  collectFiles(
    sources: string[],
    filters?: BackupFilters,
    parentBackupId?: string,
  ): Promise<string[]>;
}
