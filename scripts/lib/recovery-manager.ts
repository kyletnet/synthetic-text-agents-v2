/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Recovery Manager
 * Crash-safe recovery system for incomplete operations
 *
 * Features:
 * - Atomic file recovery with rollback
 * - Stale lock cleanup
 * - Governance event logging
 * - Multi-level error handling
 *
 * @module recovery-manager
 */

import { glob } from "glob";
import {
  existsSync,
  unlinkSync,
  renameSync,
  statSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "fs";
import { rename, unlink, stat } from "fs/promises";
import { join, dirname } from "path";

/**
 * Recovery operation result
 */
export interface RecoveryResult {
  recoveredFiles: string[];
  removedLocks: string[];
  errors: string[];
  timestamp: string;
}

/**
 * Recovery statistics for monitoring
 */
export interface RecoveryStats {
  totalTempFiles: number;
  totalLocks: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  removedStaleLocks: number;
  duration: number;
}

/**
 * Recover incomplete operations from previous crashes
 *
 * Algorithm:
 * 1. Find all .tmp files in reports/
 * 2. For each tmp file:
 *    a. Create backup of existing target
 *    b. Attempt atomic rename
 *    c. On success: remove backup
 *    d. On failure: restore from backup
 * 3. Clean stale locks (>5 minutes old)
 * 4. Notify governance
 *
 * @param projectRoot - Project root directory (default: cwd)
 * @returns Recovery result with stats
 */
export async function recoverIncompleteOps(
  projectRoot: string = process.cwd(),
): Promise<RecoveryResult> {
  const startTime = Date.now();
  const result: RecoveryResult = {
    recoveredFiles: [],
    removedLocks: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };

  const stats: RecoveryStats = {
    totalTempFiles: 0,
    totalLocks: 0,
    successfulRecoveries: 0,
    failedRecoveries: 0,
    removedStaleLocks: 0,
    duration: 0,
  };

  try {
    // ========================================
    // Step 1: Recover .tmp files
    // ========================================
    const reportsDir = join(projectRoot, "reports");
    const tempFiles = glob.sync("**/*.tmp", { cwd: reportsDir });
    stats.totalTempFiles = tempFiles.length;

    for (const tmp of tempFiles) {
      const tmpPath = join(reportsDir, tmp);
      const targetPath = tmpPath.replace(/\.tmp$/, "");
      const backupPath = `${targetPath}.recovery-backup`;

      try {
        // Check if target already exists
        const targetExists = existsSync(targetPath);

        if (targetExists) {
          // Create backup before attempting recovery
          try {
            await rename(targetPath, backupPath);
          } catch (backupError) {
            result.errors.push(
              `Failed to create backup for ${targetPath}: ${backupError}`,
            );
            stats.failedRecoveries++;
            continue;
          }
        }

        // Attempt atomic rename (recovery)
        try {
          await rename(tmpPath, targetPath);
          result.recoveredFiles.push(targetPath);
          stats.successfulRecoveries++;

          // Success: remove backup if it exists
          if (existsSync(backupPath)) {
            await unlink(backupPath);
          }
        } catch (renameError) {
          // Recovery failed: restore from backup
          result.errors.push(`Failed to recover ${tmpPath}: ${renameError}`);
          stats.failedRecoveries++;

          if (existsSync(backupPath)) {
            try {
              await rename(backupPath, targetPath);

              // Verify rollback succeeded
              if (existsSync(targetPath)) {
                console.error(
                  `⚠️  Recovery failed, restored backup: ${targetPath}`,
                );
              } else {
                result.errors.push(
                  `Critical: Rollback verification failed for ${targetPath}`,
                );
              }
            } catch (restoreError) {
              result.errors.push(
                `Critical: Failed to restore backup for ${targetPath}: ${restoreError}`,
              );
            }
          } else {
            result.errors.push(
              `Critical: No backup found for failed recovery: ${targetPath}`,
            );
          }
        }
      } catch (error) {
        result.errors.push(`Unexpected error processing ${tmpPath}: ${error}`);
        stats.failedRecoveries++;
      }
    }

    // ========================================
    // Step 2: Clean stale locks
    // ========================================
    const locks = glob.sync("**/*.lock", { cwd: reportsDir });
    stats.totalLocks = locks.length;

    for (const lock of locks) {
      const lockPath = join(reportsDir, lock);

      try {
        const lockStat = await stat(lockPath);
        const ageMinutes = (Date.now() - lockStat.mtimeMs) / 60000;

        // Remove locks older than 5 minutes
        if (ageMinutes > 5) {
          await unlink(lockPath);
          result.removedLocks.push(lockPath);
          stats.removedStaleLocks++;
        }
      } catch (error) {
        // Lock might have been removed by another process
        // This is not an error, just skip
        continue;
      }
    }

    // ========================================
    // Step 3: Calculate statistics
    // ========================================
    stats.duration = Date.now() - startTime;

    // ========================================
    // Step 4: Notify governance
    // ========================================
    if (
      result.recoveredFiles.length > 0 ||
      result.removedLocks.length > 0 ||
      result.errors.length > 0
    ) {
      await notifyGovernance({
        event:
          result.errors.length > 0 ? "recovery_failure" : "recovery_operation",
        details: {
          recoveredFiles: result.recoveredFiles,
          removedLocks: result.removedLocks,
          errors: result.errors,
          stats,
        },
        timestamp: result.timestamp,
        actor: "system",
        severity: result.errors.length > 0 ? "high" : "medium",
      });

      // Log to console
      if (result.errors.length > 0) {
        console.error(
          `⚠️  Recovery completed with errors: ${result.errors.length} error(s)`,
        );
      } else {
        console.log(
          `✅ Recovery completed: ${result.recoveredFiles.length} file(s) recovered, ${result.removedLocks.length} lock(s) removed`,
        );
      }
    }
  } catch (error) {
    result.errors.push(`Critical recovery failure: ${error}`);
    stats.duration = Date.now() - startTime;

    // Try to notify governance even on critical failure
    try {
      await notifyGovernance({
        event: "recovery_failure",
        details: {
          error: String(error),
          stats,
        },
        timestamp: result.timestamp,
        actor: "system",
        severity: "critical",
      });
    } catch {
      // If governance notification fails, at least log to console
      console.error(`❌ Critical recovery failure: ${error}`);
    }
  }

  return result;
}

/**
 * Notify governance of recovery events
 * Writes to reports/operations/governance.jsonl
 *
 * @param event - Governance event details
 */
async function notifyGovernance(event: {
  event: string;
  details: any;
  timestamp: string;
  actor: string;
  severity: string;
}): Promise<void> {
  try {
    // Write to operations/governance.jsonl
    const governancePath = join(
      process.cwd(),
      "reports",
      "operations",
      "governance.jsonl",
    );

    // Ensure directory exists
    const dir = dirname(governancePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Create log entry
    const logEntry = {
      id: `op-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: event.timestamp,
      operation: "recovery",
      phase: event.event === "recovery_failure" ? "failure" : "success",
      status: event.event === "recovery_failure" ? "failure" : "success",
      duration: null,
      details: event.details,
      actor: event.actor,
      severity: event.severity,
      environment: {
        node: process.version,
        platform: process.platform,
        cwd: process.cwd(),
      },
    };

    // Append to JSONL
    const { appendFileSync } = await import("fs");
    appendFileSync(governancePath, JSON.stringify(logEntry) + "\n", "utf8");
  } catch (error) {
    // Governance logging is optional, don't fail recovery on logging errors
    console.warn(`Warning: Failed to log to governance: ${error}`);
  }
}

/**
 * Check if recovery is needed (diagnostic only, non-destructive)
 *
 * @param projectRoot - Project root directory
 * @returns True if recovery operations are pending
 */
export function recoveryNeeded(projectRoot: string = process.cwd()): boolean {
  const reportsDir = join(projectRoot, "reports");

  try {
    const tempFiles = glob.sync("**/*.tmp", { cwd: reportsDir });
    const locks = glob.sync("**/*.lock", { cwd: reportsDir });

    // Check for stale locks
    let staleLocks = 0;
    for (const lock of locks) {
      const lockPath = join(reportsDir, lock);
      try {
        const lockStat = statSync(lockPath);
        const ageMinutes = (Date.now() - lockStat.mtimeMs) / 60000;
        if (ageMinutes > 5) staleLocks++;
      } catch {
        // Ignore
      }
    }

    return tempFiles.length > 0 || staleLocks > 0;
  } catch {
    return false;
  }
}

/**
 * Get recovery status for monitoring
 *
 * @param projectRoot - Project root directory
 * @returns Recovery status summary
 */
export function getRecoveryStatus(projectRoot: string = process.cwd()): {
  pendingTempFiles: number;
  activeLocks: number;
  staleLocks: number;
  needsRecovery: boolean;
} {
  const reportsDir = join(projectRoot, "reports");

  try {
    const tempFiles = glob.sync("**/*.tmp", { cwd: reportsDir });
    const locks = glob.sync("**/*.lock", { cwd: reportsDir });

    let staleLocks = 0;
    for (const lock of locks) {
      const lockPath = join(reportsDir, lock);
      try {
        const lockStat = statSync(lockPath);
        const ageMinutes = (Date.now() - lockStat.mtimeMs) / 60000;
        if (ageMinutes > 5) staleLocks++;
      } catch {
        // Ignore
      }
    }

    return {
      pendingTempFiles: tempFiles.length,
      activeLocks: locks.length - staleLocks,
      staleLocks,
      needsRecovery: tempFiles.length > 0 || staleLocks > 0,
    };
  } catch {
    return {
      pendingTempFiles: 0,
      activeLocks: 0,
      staleLocks: 0,
      needsRecovery: false,
    };
  }
}
