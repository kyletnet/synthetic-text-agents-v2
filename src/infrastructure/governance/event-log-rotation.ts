/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Event Log Rotation - Governance Log Management
 *
 * Purpose:
 * - Prevent governance log files from growing indefinitely
 * - Rotate logs based on time (7 days) and size (1GB)
 * - Compress old logs to save disk space
 * - Maintain operational visibility while managing storage
 *
 * Phase 2C: Operational stability for long-running systems
 */

import { existsSync, readdirSync, statSync, unlinkSync, renameSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { gzipSync } from "zlib";
import type { Logger } from "../../shared/logger.js";

/**
 * Rotation configuration
 */
export interface RotationConfig {
  retentionDays?: number; // Days to keep logs, default: 7
  maxSizeGB?: number; // Max size per log file (GB), default: 1
  compressionEnabled?: boolean; // Enable gzip compression, default: true
  rotationCheckInterval?: number; // Check interval (ms), default: 3600000 (1h)
}

/**
 * Rotation statistics
 */
export interface RotationStats {
  filesRotated: number;
  filesDeleted: number;
  filesCompressed: number;
  spaceFreed: number; // bytes
  timestamp: Date;
}

/**
 * Event Log Rotation Manager
 *
 * Manages governance log files:
 * - reports/governance/*.jsonl
 * - reports/operations/*.jsonl
 */
export class EventLogRotation {
  private readonly logger: Logger;
  private readonly config: Required<RotationConfig>;
  private readonly projectRoot: string;
  private readonly logDirs: string[];
  private rotationTimer: NodeJS.Timeout | null = null;

  constructor(logger: Logger, projectRoot?: string, config: RotationConfig = {}) {
    this.logger = logger;
    this.projectRoot = projectRoot || process.cwd();

    // Log directories to manage
    this.logDirs = [
      join(this.projectRoot, "reports", "governance"),
      join(this.projectRoot, "reports", "operations"),
    ];

    // Merge config with defaults
    this.config = {
      retentionDays: config.retentionDays ?? 7,
      maxSizeGB: config.maxSizeGB ?? 1,
      compressionEnabled: config.compressionEnabled ?? true,
      rotationCheckInterval: config.rotationCheckInterval ?? 3600000, // 1h
    };
  }

  /**
   * Start automatic rotation
   *
   * Runs rotation check every N hours (default: 1h)
   */
  start(): void {
    if (this.rotationTimer) {
      this.logger.warn("Log rotation already started");
      return;
    }

    this.logger.info("Starting event log rotation", {
      retentionDays: this.config.retentionDays,
      maxSizeGB: this.config.maxSizeGB,
      compressionEnabled: this.config.compressionEnabled,
      checkInterval: this.config.rotationCheckInterval,
    });

    // Run immediately
    this.rotate().catch((error) => {
      this.logger.error("Initial log rotation failed", { error });
    });

    // Schedule periodic rotation
    this.rotationTimer = setInterval(() => {
      this.rotate().catch((error) => {
        this.logger.error("Scheduled log rotation failed", { error });
      });
    }, this.config.rotationCheckInterval);

    this.logger.info("Event log rotation started");
  }

  /**
   * Stop automatic rotation
   */
  stop(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer);
      this.rotationTimer = null;
      this.logger.info("Event log rotation stopped");
    }
  }

  /**
   * Perform log rotation
   *
   * Algorithm:
   * 1. Find logs older than retention period → delete
   * 2. Find logs larger than max size → rotate + compress
   * 3. Clean up old compressed logs
   */
  async rotate(): Promise<RotationStats> {
    this.logger.info("Running log rotation check...");

    const stats: RotationStats = {
      filesRotated: 0,
      filesDeleted: 0,
      filesCompressed: 0,
      spaceFreed: 0,
      timestamp: new Date(),
    };

    for (const logDir of this.logDirs) {
      if (!existsSync(logDir)) {
        this.logger.warn("Log directory not found, skipping", { logDir });
        continue;
      }

      const files = readdirSync(logDir);

      for (const file of files) {
        // Skip compressed files (already rotated)
        if (file.endsWith(".gz")) {
          // Check if compressed file is too old
          const filePath = join(logDir, file);
          const fileStats = statSync(filePath);
          const ageInDays = (Date.now() - fileStats.mtimeMs) / (1000 * 60 * 60 * 24);

          if (ageInDays > this.config.retentionDays) {
            const size = fileStats.size;
            unlinkSync(filePath);
            stats.filesDeleted++;
            stats.spaceFreed += size;

            this.logger.info("Deleted old compressed log", {
              file,
              ageInDays: ageInDays.toFixed(1),
            });
          }
          continue;
        }

        // Only process .jsonl files
        if (!file.endsWith(".jsonl")) {
          continue;
        }

        const filePath = join(logDir, file);
        const fileStats = statSync(filePath);

        // Check 1: Age-based rotation (delete old logs)
        const ageInDays = (Date.now() - fileStats.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageInDays > this.config.retentionDays) {
          const size = fileStats.size;
          unlinkSync(filePath);
          stats.filesDeleted++;
          stats.spaceFreed += size;

          this.logger.info("Deleted old log file", {
            file,
            ageInDays: ageInDays.toFixed(1),
          });
          continue;
        }

        // Check 2: Size-based rotation (rotate + compress large logs)
        const sizeInGB = fileStats.size / (1024 * 1024 * 1024);
        if (sizeInGB > this.config.maxSizeGB) {
          await this.rotateAndCompress(filePath);
          stats.filesRotated++;
          if (this.config.compressionEnabled) {
            stats.filesCompressed++;
          }

          this.logger.info("Rotated large log file", {
            file,
            sizeInGB: sizeInGB.toFixed(2),
          });
        }
      }
    }

    this.logger.info("Log rotation complete", {
      filesRotated: stats.filesRotated,
      filesDeleted: stats.filesDeleted,
      filesCompressed: stats.filesCompressed,
      spaceFreedMB: (stats.spaceFreed / (1024 * 1024)).toFixed(2),
    });

    return stats;
  }

  /**
   * Rotate and compress a log file
   *
   * Steps:
   * 1. Rename original file to timestamped backup
   * 2. Compress backup if enabled
   * 3. Create new empty log file
   */
  private async rotateAndCompress(filePath: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = filePath.replace(".jsonl", `.${timestamp}.jsonl`);

    // Rename original to backup
    renameSync(filePath, backupPath);

    // Compress backup if enabled
    if (this.config.compressionEnabled) {
      const content = readFileSync(backupPath, "utf8");
      const compressed = gzipSync(content);
      const compressedPath = `${backupPath}.gz`;

      writeFileSync(compressedPath, compressed);

      // Calculate space saved
      const originalSize = statSync(backupPath).size;
      const compressedSize = compressed.length;
      const spaceSaved = originalSize - compressedSize;

      this.logger.info("Compressed log file", {
        original: backupPath,
        compressed: compressedPath,
        compressionRatio: (compressedSize / originalSize * 100).toFixed(1) + "%",
        spaceSavedMB: (spaceSaved / (1024 * 1024)).toFixed(2),
      });

      // Delete uncompressed backup
      unlinkSync(backupPath);
    }

    // Create new empty log file
    writeFileSync(filePath, "", "utf8");

    this.logger.info("Created new log file", { path: filePath });
  }

  /**
   * Get rotation statistics (without running rotation)
   */
  async getStats(): Promise<{
    totalLogs: number;
    totalSizeGB: number;
    oldestLogAgeDays: number;
    largestLogSizeGB: number;
  }> {
    let totalLogs = 0;
    let totalSize = 0;
    let oldestAge = 0;
    let largestSize = 0;

    for (const logDir of this.logDirs) {
      if (!existsSync(logDir)) {
        continue;
      }

      const files = readdirSync(logDir);

      for (const file of files) {
        if (!file.endsWith(".jsonl") && !file.endsWith(".gz")) {
          continue;
        }

        const filePath = join(logDir, file);
        const fileStats = statSync(filePath);

        totalLogs++;
        totalSize += fileStats.size;

        const ageInDays = (Date.now() - fileStats.mtimeMs) / (1000 * 60 * 60 * 24);
        oldestAge = Math.max(oldestAge, ageInDays);

        const sizeInGB = fileStats.size / (1024 * 1024 * 1024);
        largestSize = Math.max(largestSize, sizeInGB);
      }
    }

    return {
      totalLogs,
      totalSizeGB: totalSize / (1024 * 1024 * 1024),
      oldestLogAgeDays: oldestAge,
      largestLogSizeGB: largestSize,
    };
  }

  /**
   * Manual rotation trigger (for testing or emergency)
   */
  async forceRotate(): Promise<RotationStats> {
    this.logger.warn("Manual log rotation triggered");
    return await this.rotate();
  }

  /**
   * Get configuration
   */
  getConfig(): Required<RotationConfig> {
    return { ...this.config };
  }
}

/**
 * Create default event log rotation manager
 */
export function createEventLogRotation(logger: Logger): EventLogRotation {
  return new EventLogRotation(logger, process.cwd(), {
    retentionDays: 7, // 7 days
    maxSizeGB: 1, // 1GB
    compressionEnabled: true,
    rotationCheckInterval: 3600000, // 1h
  });
}
