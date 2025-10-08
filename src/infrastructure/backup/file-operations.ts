/**
 * File Operations for Backup System
 * Low-level file system operations
 * Implements IFileOperations interface (DIP - Dependency Inversion)
 */

import * as fs from "fs/promises";
import * as path from "path";
import { createReadStream, createWriteStream } from "fs";
import { createGzip, createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import type {
  BackupFileInfo,
  BackupFilters,
  ChecksumAlgorithm,
} from "../../domain/backup/backup-types";
import type { IFileOperations } from "../../domain/backup/interfaces";

export class FileOperations implements IFileOperations {
  /**
   * Collect all files from a path (recursive for directories)
   */
  async collectFilesFromPath(
    sourcePath: string,
    filters?: BackupFilters,
  ): Promise<string[]> {
    const files: string[] = [];

    try {
      const stats = await fs.stat(sourcePath);

      if (stats.isFile()) {
        if (this.shouldIncludeFile(sourcePath, filters)) {
          files.push(sourcePath);
        }
      } else if (stats.isDirectory()) {
        const entries = await fs.readdir(sourcePath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(sourcePath, entry.name);

          if (entry.isDirectory()) {
            const subFiles = await this.collectFilesFromPath(fullPath, filters);
            files.push(...subFiles);
          } else if (
            entry.isFile() &&
            this.shouldIncludeFile(fullPath, filters)
          ) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to access path ${sourcePath}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }

    return files;
  }

  /**
   * Check if a file should be included based on filters
   */
  shouldIncludeFile(filePath: string, filters?: BackupFilters): boolean {
    if (!filters) return true;

    // Check exclude patterns
    if (filters.exclude) {
      for (const pattern of filters.exclude) {
        if (this.matchesPattern(filePath, pattern)) {
          return false;
        }
      }
    }

    // Check include patterns
    if (filters.include) {
      for (const pattern of filters.include) {
        if (this.matchesPattern(filePath, pattern)) {
          return true;
        }
      }
      return false; // If include patterns exist, file must match at least one
    }

    return true;
  }

  /**
   * Simple glob-like pattern matching
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    const regex = pattern.replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(regex).test(filePath);
  }

  /**
   * Copy a file to backup location
   */
  async copyFile(
    sourceFile: string,
    targetFile: string,
    compress: boolean,
  ): Promise<BackupFileInfo> {
    const stats = await fs.stat(sourceFile);
    const checksum = await this.calculateChecksum(sourceFile, "sha256");

    // Ensure target directory exists
    await fs.mkdir(path.dirname(targetFile), { recursive: true });

    if (compress) {
      await this.compressFile(sourceFile, targetFile);
    } else {
      await fs.copyFile(sourceFile, targetFile);
    }

    return {
      path: sourceFile,
      size: stats.size,
      modifiedTime: stats.mtime,
      checksum,
      compressed: compress,
      encrypted: false,
    };
  }

  /**
   * Restore a file from backup
   */
  async restoreFile(
    backupFile: string,
    targetFile: string,
    compressed: boolean,
  ): Promise<void> {
    // Ensure target directory exists
    await fs.mkdir(path.dirname(targetFile), { recursive: true });

    if (compressed) {
      await this.decompressFile(backupFile, targetFile);
    } else {
      await fs.copyFile(backupFile, targetFile);
    }
  }

  /**
   * Compress a file using gzip
   */
  async compressFile(sourceFile: string, targetFile: string): Promise<void> {
    const readStream = createReadStream(sourceFile);
    const writeStream = createWriteStream(targetFile);
    const gzipStream = createGzip();

    await pipeline(readStream, gzipStream, writeStream);
  }

  /**
   * Decompress a file using gunzip
   */
  async decompressFile(sourceFile: string, targetFile: string): Promise<void> {
    const readStream = createReadStream(sourceFile);
    const writeStream = createWriteStream(targetFile);
    const gunzipStream = createGunzip();

    await pipeline(readStream, gunzipStream, writeStream);
  }

  /**
   * Calculate file checksum
   */
  async calculateChecksum(
    filePath: string,
    algorithm: ChecksumAlgorithm,
  ): Promise<string> {
    const crypto = require("crypto");
    const hash = crypto.createHash(algorithm);
    const stream = createReadStream(filePath);

    for await (const chunk of stream) {
      hash.update(chunk);
    }

    return hash.digest("hex");
  }

  /**
   * Encode file path for safe storage
   */
  encodeFilePath(filePath: string): string {
    return filePath.replace(/[/\\]/g, "_");
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file modification time
   */
  async getFileModifiedTime(filePath: string): Promise<Date> {
    const stats = await fs.stat(filePath);
    return stats.mtime;
  }

  /**
   * Delete a file or directory recursively
   */
  async delete(targetPath: string): Promise<void> {
    await fs.rm(targetPath, { recursive: true, force: true });
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  /**
   * Read JSON file
   */
  async readJson<T>(filePath: string): Promise<T> {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as T;
  }

  /**
   * Write JSON file
   */
  async writeJson<T>(filePath: string, data: T): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }
}
