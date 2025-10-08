/**
 * Base Backup Strategy
 * Abstract base class providing common functionality for all backup strategies
 * Uses dependency injection to avoid depending on infrastructure layer
 */

import * as path from "path";
import type { BackupStrategy } from "../backup-strategy";
import type {
  BackupMetadata,
  BackupResult,
  RestoreRequest,
  RestoreResult,
  BackupConfig,
  BackupFilters,
  BackupFileInfo,
} from "../backup-types";
import type { IFileOperations } from "../interfaces";
import { Logger } from "../../../shared/logger";

export abstract class BaseBackupStrategy implements BackupStrategy {
  protected fileOps: IFileOperations;
  protected logger: Logger;

  constructor(fileOps: IFileOperations) {
    this.fileOps = fileOps;
    this.logger = new Logger({ level: "info" });
  }

  abstract getName(): string;

  /**
   * Execute backup operation
   */
  async backup(
    sources: string[],
    destination: string,
    config: BackupConfig,
    parentBackupId?: string,
    filters?: BackupFilters,
  ): Promise<BackupResult> {
    const startTime = Date.now();
    const timestamp = new Date();

    const metadata: BackupMetadata = {
      id: this.generateBackupId(),
      strategy: this.getName(),
      type: this.getBackupType(),
      timestamp,
      startTime: timestamp,
      status: "running",
      size: 0,
      checksums: {},
      files: [],
      parentBackupId,
    };

    try {
      // Collect files to backup
      const filesToBackup = await this.collectFiles(
        sources,
        filters,
        parentBackupId,
      );

      // Create backup directory
      const backupPath = this.createBackupPath(destination, metadata);
      metadata.backupPath = backupPath; // Store the path in metadata
      await this.fileOps.createDirectory(backupPath);

      // Process each file
      const files: BackupFileInfo[] = [];
      let totalSize = 0;

      for (const sourceFile of filesToBackup) {
        const fileInfo = await this.backupFile(
          sourceFile,
          backupPath,
          config.compression.enabled,
        );
        files.push(fileInfo);
        totalSize += fileInfo.size;
      }

      // Calculate overall checksum from metadata file (will be created)
      metadata.size = totalSize;
      metadata.files = files;
      metadata.status = "completed";
      metadata.endTime = new Date();

      // Save metadata
      await this.saveBackupMetadata(backupPath, metadata);

      // Calculate checksum of the metadata file
      const metadataPath = path.join(backupPath, "metadata.json");
      metadata.checksums.backup = await this.fileOps.calculateChecksum(
        metadataPath,
        config.verification.checksumAlgorithm,
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        backupId: metadata.id,
        metadata,
        duration,
      };
    } catch (error) {
      metadata.status = "failed";
      metadata.errorMessage = (error as Error).message;
      metadata.endTime = new Date();

      const duration = Date.now() - startTime;

      return {
        success: false,
        backupId: metadata.id,
        metadata,
        duration,
      };
    }
  }

  /**
   * Execute restore operation
   */
  async restore(
    metadata: BackupMetadata,
    request: RestoreRequest,
    config: BackupConfig,
  ): Promise<RestoreResult> {
    const startTime = Date.now();

    const result: RestoreResult = {
      success: false,
      restoredFiles: 0,
      totalFiles: 0,
      skippedFiles: 0,
      errors: [],
      duration: 0,
    };

    try {
      const filesToRestore = request.files
        ? metadata.files.filter((f) => request.files?.includes(f.path) ?? false)
        : metadata.files;

      result.totalFiles = filesToRestore.length;

      if (request.dryRun) {
        this.logger.info(
          `Dry run restore: would restore ${filesToRestore.length} files`,
        );
        result.success = true;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Ensure target directory exists
      await this.fileOps.createDirectory(request.targetPath);

      // Get backup path
      const backupPath = this.getBackupPathFromMetadata(metadata);

      // Restore files
      for (const fileInfo of filesToRestore) {
        try {
          const targetFile = path.join(request.targetPath, fileInfo.path);

          // Check if file exists and handle overwrite
          if (!request.overwrite) {
            const exists = await this.fileOps.fileExists(targetFile);
            if (exists) {
              result.skippedFiles++;
              continue;
            }
          }

          // Restore file
          const backupFile = path.join(
            backupPath,
            "files",
            this.fileOps.encodeFilePath(fileInfo.path),
          );
          await this.fileOps.restoreFile(
            backupFile,
            targetFile,
            fileInfo.compressed,
          );
          result.restoredFiles++;
        } catch (error) {
          result.errors.push(
            `Failed to restore ${fileInfo.path}: ${(error as Error).message}`,
          );
        }
      }

      result.success = result.errors.length === 0;
      result.duration = Date.now() - startTime;

      return result;
    } catch (error) {
      result.errors.push((error as Error).message);
      result.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Validate a backup
   */
  async validate(
    metadata: BackupMetadata,
    config: BackupConfig,
  ): Promise<boolean> {
    try {
      const backupPath = this.getBackupPathFromMetadata(metadata);
      const metadataPath = path.join(backupPath, "metadata.json");
      const actualChecksum = await this.fileOps.calculateChecksum(
        metadataPath,
        config.verification.checksumAlgorithm,
      );

      return actualChecksum === metadata.checksums.backup;
    } catch (error) {
      this.logger.error(`Backup validation failed: ${metadata.id}`, error);
      return false;
    }
  }

  /**
   * Collect files to backup
   */
  async collectFiles(
    sources: string[],
    filters?: BackupFilters,
    _parentBackupId?: string,
  ): Promise<string[]> {
    const files: string[] = [];

    for (const sourcePath of sources) {
      const pathFiles = await this.fileOps.collectFilesFromPath(
        sourcePath,
        filters,
      );
      files.push(...pathFiles);
    }

    return files;
  }

  /**
   * Backup a single file
   */
  protected async backupFile(
    sourceFile: string,
    backupPath: string,
    compress: boolean,
  ): Promise<BackupFileInfo> {
    const targetFile = path.join(
      backupPath,
      "files",
      this.fileOps.encodeFilePath(sourceFile),
    );

    return await this.fileOps.copyFile(sourceFile, targetFile, compress);
  }

  /**
   * Get backup type for this strategy
   */
  protected abstract getBackupType(): "full" | "incremental" | "differential";

  /**
   * Create backup path
   */
  protected createBackupPath(
    destination: string,
    metadata: BackupMetadata,
  ): string {
    const timestamp = metadata.timestamp.toISOString().replace(/[:.]/g, "-");
    return path.join(
      destination,
      metadata.strategy,
      `${metadata.type}-${timestamp}-${metadata.id}`,
    );
  }

  /**
   * Get backup path from metadata
   */
  protected getBackupPathFromMetadata(metadata: BackupMetadata): string {
    // Use stored path if available, otherwise reconstruct it
    if (metadata.backupPath) {
      return metadata.backupPath;
    }

    // Fallback: reconstruct the backup path using the same logic as createBackupPath
    const timestamp = metadata.timestamp.toISOString().replace(/[:.]/g, "-");
    const destination = "/tmp/backups";
    return path.join(
      destination,
      metadata.strategy,
      `${metadata.type}-${timestamp}-${metadata.id}`,
    );
  }

  /**
   * Save backup metadata
   */
  protected async saveBackupMetadata(
    backupPath: string,
    metadata: BackupMetadata,
  ): Promise<void> {
    const metadataPath = path.join(backupPath, "metadata.json");
    await this.fileOps.writeJson(metadataPath, metadata);
  }

  /**
   * Generate unique backup ID
   */
  protected generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
