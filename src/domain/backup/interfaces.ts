/**
 * Backup Application Interfaces
 * Defines contracts for backup file operations (DIP - Dependency Inversion)
 */

import type {
  BackupFilters,
  BackupFileInfo,
} from "../../domain/backup/backup-types";

/**
 * Interface for file operations in backup context
 * Implemented by infrastructure layer
 */
export interface IFileOperations {
  /**
   * Create a directory
   */
  createDirectory(path: string): Promise<void>;

  /**
   * Calculate file checksum
   */
  calculateChecksum(filePath: string, algorithm: string): Promise<string>;

  /**
   * Collect files from a path with filters
   */
  collectFilesFromPath(
    sourcePath: string,
    filters?: BackupFilters,
  ): Promise<string[]>;

  /**
   * Encode file path for safe storage
   */
  encodeFilePath(filePath: string): string;

  /**
   * Check if file exists
   */
  fileExists(filePath: string): Promise<boolean>;

  /**
   * Restore a file from backup
   */
  restoreFile(
    backupFile: string,
    targetFile: string,
    compressed: boolean,
  ): Promise<void>;

  /**
   * Copy a file to backup location
   */
  copyFile(
    sourceFile: string,
    targetFile: string,
    compress: boolean,
  ): Promise<BackupFileInfo>;

  /**
   * Write JSON data to file
   */
  writeJson(filePath: string, data: unknown): Promise<void>;

  /**
   * Get file modified time (for incremental backups)
   */
  getFileModifiedTime(filePath: string): Promise<Date>;
}
