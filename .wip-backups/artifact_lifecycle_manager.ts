#!/usr/bin/env tsx

/**
 * Artifact Lifecycle Manager
 * 자동 압축, 정리, 아카이브 시스템
 * .system-backups/, reports/, logs/ 관리
 */

import { promises as fs } from "fs";
import { resolve, join, dirname, extname } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "./simple_logger.js";

const execAsync = promisify(exec);

interface ArtifactConfig {
  path: string;
  maxAge: number; // days
  maxSize: number; // MB
  archiveExtensions: string[];
  keepLatest: number;
}

interface CleanupResult {
  path: string;
  action: "archived" | "deleted" | "kept";
  sizeSaved: number;
  reason: string;
}

class ArtifactLifecycleManager {
  private readonly configs: ArtifactConfig[] = [
    {
      path: ".system-backups",
      maxAge: 30,
      maxSize: 100,
      archiveExtensions: [".json", ".md", ".yaml"],
      keepLatest: 5,
    },
    {
      path: "reports",
      maxAge: 7,
      maxSize: 50,
      archiveExtensions: [".json", ".md"],
      keepLatest: 10,
    },
    {
      path: "logs",
      maxAge: 3,
      maxSize: 200,
      archiveExtensions: [".log", ".jsonl"],
      keepLatest: 20,
    },
    {
      path: "reports/.fix-sessions",
      maxAge: 1,
      maxSize: 10,
      archiveExtensions: [".json"],
      keepLatest: 3,
    },
  ];

  private readonly rootPath: string;

  constructor(rootPath = process.cwd()) {
    this.rootPath = rootPath;
  }

  async cleanup(): Promise<CleanupResult[]> {
    const results: CleanupResult[] = [];

    logger.info("🧹 Starting artifact lifecycle cleanup");

    for (const config of this.configs) {
      try {
        const configResults = await this.cleanupPath(config);
        results.push(...configResults);
      } catch (error) {
        logger.error(`Failed to cleanup ${config.path}:`, error);
      }
    }

    const totalSaved = results.reduce((sum, r) => sum + r.sizeSaved, 0);
    logger.info(
      `🎯 Cleanup complete: ${results.length} operations, ${this.formatSize(
        totalSaved,
      )} saved`,
    );

    return results;
  }

  private async cleanupPath(config: ArtifactConfig): Promise<CleanupResult[]> {
    const fullPath = resolve(this.rootPath, config.path);
    const results: CleanupResult[] = [];

    try {
      await fs.access(fullPath);
    } catch {
      return results; // Path doesn't exist
    }

    const files = await this.getFilesRecursive(fullPath);
    const fileStats = await Promise.all(
      files.map(async (file) => ({
        path: file,
        stat: await fs.stat(file),
        relativePath: file.replace(fullPath + "/", ""),
      })),
    );

    // Sort by modification time (newest first)
    fileStats.sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

    // Keep latest files
    const filesToProcess = fileStats.slice(config.keepLatest);

    for (const fileInfo of filesToProcess) {
      const ageInDays =
        (Date.now() - fileInfo.stat.mtime.getTime()) / (1000 * 60 * 60 * 24);
      const sizeInMB = fileInfo.stat.size / (1024 * 1024);

      if (ageInDays > config.maxAge) {
        const result = await this.handleOldFile(fileInfo, config);
        results.push(result);
      } else if (sizeInMB > config.maxSize) {
        const result = await this.handleLargeFile(fileInfo, config);
        results.push(result);
      }
    }

    return results;
  }

  private async handleOldFile(
    fileInfo: { path: string; stat: any; relativePath: string },
    config: ArtifactConfig,
  ): Promise<CleanupResult> {
    const ext = extname(fileInfo.path);

    if (config.archiveExtensions.includes(ext)) {
      return this.archiveFile(fileInfo);
    } else {
      return this.deleteFile(fileInfo);
    }
  }

  private async handleLargeFile(
    fileInfo: { path: string; stat: any; relativePath: string },
    config: ArtifactConfig,
  ): Promise<CleanupResult> {
    // Large files are always archived or deleted
    const ext = extname(fileInfo.path);

    if (config.archiveExtensions.includes(ext)) {
      return this.archiveFile(fileInfo);
    } else {
      return this.deleteFile(fileInfo);
    }
  }

  private async archiveFile(fileInfo: {
    path: string;
    stat: any;
    relativePath: string;
  }): Promise<CleanupResult> {
    const archivePath = `${fileInfo.path}.gz`;

    try {
      await execAsync(`gzip -9 "${fileInfo.path}"`);

      return {
        path: fileInfo.relativePath,
        action: "archived",
        sizeSaved: fileInfo.stat.size * 0.7, // Estimate compression
        reason: "Old file archived",
      };
    } catch (error) {
      logger.warn(`Failed to archive ${fileInfo.path}:`, error);
      return this.deleteFile(fileInfo);
    }
  }

  private async deleteFile(fileInfo: {
    path: string;
    stat: any;
    relativePath: string;
  }): Promise<CleanupResult> {
    try {
      await fs.unlink(fileInfo.path);

      return {
        path: fileInfo.relativePath,
        action: "deleted",
        sizeSaved: fileInfo.stat.size,
        reason: "Old file deleted",
      };
    } catch (error) {
      logger.error(`Failed to delete ${fileInfo.path}:`, error);

      return {
        path: fileInfo.relativePath,
        action: "kept",
        sizeSaved: 0,
        reason: `Delete failed: ${error}`,
      };
    }
  }

  private async getFilesRecursive(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const items = await fs.readdir(dir);

      for (const item of items) {
        const fullPath = join(dir, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          const subFiles = await this.getFilesRecursive(fullPath);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.warn(`Cannot read directory ${dir}:`, error);
    }

    return files;
  }

  private formatSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  async getStatus(): Promise<any> {
    const status = {
      timestamp: new Date().toISOString(),
      paths: [],
    };

    for (const config of this.configs) {
      const fullPath = resolve(this.rootPath, config.path);

      try {
        const files = await this.getFilesRecursive(fullPath);
        const totalSize = await this.calculateTotalSize(files);
        const oldestFile = await this.getOldestFile(files);

        (status.paths as any[]).push({
          path: config.path,
          fileCount: files.length,
          totalSize: this.formatSize(totalSize),
          totalSizeBytes: totalSize,
          oldestFile: oldestFile
            ? {
                path: oldestFile.path.replace(fullPath + "/", ""),
                age: Math.floor(
                  (Date.now() - oldestFile.mtime.getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              }
            : null,
          config: {
            maxAge: config.maxAge,
            maxSize: config.maxSize,
            keepLatest: config.keepLatest,
          },
        });
      } catch (error) {
        (status.paths as any[]).push({
          path: config.path,
          error: (error as Error).message,
        });
      }
    }

    return status;
  }

  private async calculateTotalSize(files: string[]): Promise<number> {
    let total = 0;

    for (const file of files) {
      try {
        const stat = await fs.stat(file);
        total += stat.size;
      } catch {
        // Ignore files that can't be accessed
      }
    }

    return total;
  }

  private async getOldestFile(
    files: string[],
  ): Promise<{ path: string; mtime: Date } | null> {
    let oldest: { path: string; mtime: Date } | null = null;

    for (const file of files) {
      try {
        const stat = await fs.stat(file);
        if (!oldest || stat.mtime < oldest.mtime) {
          oldest = { path: file, mtime: stat.mtime };
        }
      } catch {
        // Ignore files that can't be accessed
      }
    }

    return oldest;
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] || "status";
  const manager = new ArtifactLifecycleManager();

  (async () => {
    try {
      switch (command) {
        case "cleanup":
          const results = await manager.cleanup();
          console.log("\n📋 Cleanup Results:");
          results.forEach((r) => {
            const icon =
              r.action === "archived"
                ? "📦"
                : r.action === "deleted"
                ? "🗑️"
                : "📁";
            console.log(
              `  ${icon} ${r.path} (${manager["formatSize"](
                r.sizeSaved,
              )} saved) - ${r.reason}`,
            );
          });
          break;

        case "status":
          const status = await manager.getStatus();
          console.log("\n📊 Artifact Status:");
          console.log(JSON.stringify(status, null, 2));
          break;

        default:
          console.log(
            "Usage: tsx artifact_lifecycle_manager.ts [cleanup|status]",
          );
      }
    } catch (error) {
      logger.error("Artifact manager failed:", error);
      process.exit(1);
    }
  })();
}

export { ArtifactLifecycleManager };
