#!/usr/bin/env tsx

/**
 * Emergency Undo Stack System
 * 고위험 작업 추적 및 롤백 시스템
 * 자동 스냅샷, 트랜잭션 관리, 원자적 복구
 */

import { promises as fs } from "fs";
import { resolve, join, dirname } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { createHash } from "crypto";
import { logger } from "./simple_logger.js";

const execAsync = promisify(exec);

interface UndoOperation {
  id: string;
  timestamp: Date;
  operation: string;
  description: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  beforeState: SnapshotData;
  afterState?: SnapshotData;
  rollbackCommands: string[];
  metadata: Record<string, any>;
  status: "pending" | "completed" | "failed" | "rolled_back";
  dependencies: string[]; // Other operation IDs this depends on
}

interface SnapshotData {
  id: string;
  timestamp: Date;
  fileHashes: Record<string, string>;
  gitCommit?: string;
  environment: Record<string, string>;
  checkpoints: string[];
}

interface RollbackResult {
  success: boolean;
  operationsRolledBack: string[];
  errors: string[];
  finalState: SnapshotData;
}

class EmergencyUndoStack {
  private readonly stackPath: string;
  private readonly snapshotsPath: string;
  private readonly maxStackSize = 50;
  private readonly criticalPaths = [
    "src/",
    "scripts/",
    "package.json",
    "tsconfig.json",
    ".env",
    "CLAUDE.md",
    "DEVELOPMENT_STANDARDS.md",
  ];

  constructor(rootPath = process.cwd()) {
    this.stackPath = resolve(rootPath, ".system-backups/undo-stack");
    this.snapshotsPath = resolve(rootPath, ".system-backups/snapshots");
  }

  async init(): Promise<void> {
    await fs.mkdir(this.stackPath, { recursive: true });
    await fs.mkdir(this.snapshotsPath, { recursive: true });

    logger.info("🔄 Emergency Undo Stack initialized");
  }

  async createOperation(
    operation: string,
    description: string,
    riskLevel: UndoOperation["riskLevel"],
    rollbackCommands: string[],
    metadata: Record<string, any> = {},
  ): Promise<string> {
    const id = this.generateOperationId(operation);
    const beforeState = await this.createSnapshot(`before-${operation}-${id}`);

    const undoOp: UndoOperation = {
      id,
      timestamp: new Date(),
      operation,
      description,
      riskLevel,
      beforeState,
      rollbackCommands,
      metadata,
      status: "pending",
      dependencies: [],
    };

    await this.saveOperation(undoOp);
    await this.maintainStackSize();

    logger.info(`📝 Created undo operation: ${id} (${riskLevel} risk)`);
    return id;
  }

  async completeOperation(
    operationId: string,
    afterState?: SnapshotData,
  ): Promise<void> {
    const operation = await this.loadOperation(operationId);
    if (!operation) {
      throw new Error(`Operation ${operationId} not found`);
    }

    operation.status = "completed";
    operation.afterState =
      afterState ||
      (await this.createSnapshot(
        `after-${operation.operation}-${operationId}`,
      ));

    await this.saveOperation(operation);
    logger.info(`✅ Completed operation: ${operationId}`);
  }

  async rollback(
    operationId?: string,
    toTimestamp?: Date,
  ): Promise<RollbackResult> {
    const result: RollbackResult = {
      success: false,
      operationsRolledBack: [],
      errors: [],
      finalState: null as any,
    };

    try {
      let operationsToRollback: UndoOperation[];

      if (operationId) {
        // Rollback specific operation and its dependents
        operationsToRollback = await this.getOperationChain(operationId);
      } else if (toTimestamp) {
        // Rollback to specific timestamp
        operationsToRollback = await this.getOperationsAfter(toTimestamp);
      } else {
        // Rollback last operation
        const lastOp = await this.getLastOperation();
        operationsToRollback = lastOp ? [lastOp] : [];
      }

      if (operationsToRollback.length === 0) {
        result.success = true;
        result.finalState = await this.createSnapshot("rollback-empty");
        return result;
      }

      // Sort by timestamp (newest first) to rollback in reverse order
      operationsToRollback.sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
      );

      // Create emergency snapshot before rollback
      const emergencySnapshot = await this.createSnapshot(
        "emergency-before-rollback",
      );

      // Execute rollbacks
      for (const operation of operationsToRollback) {
        try {
          await this.executeRollback(operation);
          operation.status = "rolled_back";
          await this.saveOperation(operation);
          result.operationsRolledBack.push(operation.id);

          logger.info(`🔄 Rolled back operation: ${operation.id}`);
        } catch (error) {
          result.errors.push(
            `Failed to rollback ${operation.id}: ${(error as Error).message}`,
          );
          logger.error(`Failed to rollback ${operation.id}:`, error);
        }
      }

      result.finalState = await this.createSnapshot("rollback-complete");
      result.success = result.errors.length === 0;

      logger.info(
        `🎯 Rollback complete: ${result.operationsRolledBack.length} operations, ${result.errors.length} errors`,
      );
    } catch (error) {
      result.errors.push(`Rollback system error: ${(error as Error).message}`);
      logger.error("Rollback system error:", error);
    }

    return result;
  }

  private async executeRollback(operation: UndoOperation): Promise<void> {
    // Execute rollback commands in order
    for (const command of operation.rollbackCommands) {
      if (command.startsWith("git ")) {
        await this.executeGitCommand(command);
      } else if (command.startsWith("restore:")) {
        const filePath = command.replace("restore:", "");
        await this.restoreFileFromSnapshot(filePath, operation.beforeState);
      } else if (command.startsWith("exec:")) {
        const cmd = command.replace("exec:", "");
        await execAsync(cmd);
      } else {
        logger.warn(`Unknown rollback command format: ${command}`);
      }
    }
  }

  private async restoreFileFromSnapshot(
    filePath: string,
    snapshot: SnapshotData,
  ): Promise<void> {
    const snapshotFile = join(this.snapshotsPath, snapshot.id, filePath);
    const targetFile = resolve(process.cwd(), filePath);

    try {
      await fs.mkdir(dirname(targetFile), { recursive: true });
      await fs.copyFile(snapshotFile, targetFile);
    } catch (error) {
      throw new Error(
        `Failed to restore ${filePath}: ${(error as Error).message}`,
      );
    }
  }

  private async executeGitCommand(command: string): Promise<void> {
    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr && !stderr.includes("warning")) {
        throw new Error(stderr);
      }
    } catch (error) {
      throw new Error(
        `Git command failed: ${command} - ${(error as Error).message}`,
      );
    }
  }

  async createSnapshot(name: string): Promise<SnapshotData> {
    const id = `${name}-${Date.now()}`;
    const snapshotDir = join(this.snapshotsPath, id);

    await fs.mkdir(snapshotDir, { recursive: true });

    const fileHashes: Record<string, string> = {};

    // Snapshot critical paths
    for (const path of this.criticalPaths) {
      const fullPath = resolve(process.cwd(), path);

      try {
        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
          await this.snapshotDirectory(fullPath, snapshotDir, path, fileHashes);
        } else {
          await this.snapshotFile(fullPath, snapshotDir, path, fileHashes);
        }
      } catch (error) {
        logger.warn(`Cannot snapshot ${path}:`, (error as Error).message);
      }
    }

    // Get git state
    let gitCommit: string | undefined;
    try {
      const { stdout } = await execAsync("git rev-parse HEAD");
      gitCommit = stdout.trim();
    } catch {
      // Not a git repo or no commits
    }

    const snapshot: SnapshotData = {
      id,
      timestamp: new Date(),
      fileHashes,
      gitCommit,
      environment: {
        NODE_ENV: process.env.NODE_ENV || "",
        FEATURE_FLAGS: JSON.stringify(this.getFeatureFlags()),
      },
      checkpoints: [name],
    };

    await fs.writeFile(
      join(snapshotDir, "metadata.json"),
      JSON.stringify(snapshot, null, 2),
    );

    logger.debug(`📸 Created snapshot: ${id}`);
    return snapshot;
  }

  private async snapshotDirectory(
    sourcePath: string,
    snapshotDir: string,
    relativePath: string,
    fileHashes: Record<string, string>,
  ): Promise<void> {
    try {
      const items = await fs.readdir(sourcePath);

      for (const item of items) {
        if (item.startsWith(".") && item !== ".env") continue; // Skip hidden files except .env

        const itemPath = join(sourcePath, item);
        const itemRelativePath = join(relativePath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          await this.snapshotDirectory(
            itemPath,
            snapshotDir,
            itemRelativePath,
            fileHashes,
          );
        } else {
          await this.snapshotFile(
            itemPath,
            snapshotDir,
            itemRelativePath,
            fileHashes,
          );
        }
      }
    } catch (error) {
      logger.warn(
        `Cannot read directory ${sourcePath}:`,
        (error as Error).message,
      );
    }
  }

  private async snapshotFile(
    sourcePath: string,
    snapshotDir: string,
    relativePath: string,
    fileHashes: Record<string, string>,
  ): Promise<void> {
    try {
      const content = await fs.readFile(sourcePath);
      const hash = createHash("sha256").update(content).digest("hex");

      fileHashes[relativePath] = hash;

      const targetPath = join(snapshotDir, relativePath);
      await fs.mkdir(dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, content);
    } catch (error) {
      logger.warn(
        `Cannot snapshot file ${sourcePath}:`,
        (error as Error).message,
      );
    }
  }

  private generateOperationId(operation: string): string {
    const timestamp = Date.now().toString();
    const hash = createHash("md5")
      .update(`${operation}-${timestamp}`)
      .digest("hex")
      .slice(0, 8);
    return `${operation.replace(/[^a-zA-Z0-9]/g, "-")}-${hash}`;
  }

  private async saveOperation(operation: UndoOperation): Promise<void> {
    const operationFile = join(this.stackPath, `${operation.id}.json`);
    await fs.writeFile(operationFile, JSON.stringify(operation, null, 2));
  }

  private async loadOperation(
    operationId: string,
  ): Promise<UndoOperation | null> {
    try {
      const operationFile = join(this.stackPath, `${operationId}.json`);
      const content = await fs.readFile(operationFile, "utf-8");
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async getOperationChain(
    operationId: string,
  ): Promise<UndoOperation[]> {
    const operation = await this.loadOperation(operationId);
    if (!operation) return [];

    const chain = [operation];

    // Find operations that depend on this one
    const allOperations = await this.getAllOperations();
    for (const op of allOperations) {
      if (
        op.dependencies.includes(operationId) &&
        op.timestamp > operation.timestamp
      ) {
        const dependentChain = await this.getOperationChain(op.id);
        chain.push(...dependentChain);
      }
    }

    return chain;
  }

  private async getOperationsAfter(timestamp: Date): Promise<UndoOperation[]> {
    const allOperations = await this.getAllOperations();
    return allOperations.filter((op) => op.timestamp > timestamp);
  }

  private async getLastOperation(): Promise<UndoOperation | null> {
    const allOperations = await this.getAllOperations();
    if (allOperations.length === 0) return null;

    return allOperations.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    )[0];
  }

  private async getAllOperations(): Promise<UndoOperation[]> {
    try {
      const files = await fs.readdir(this.stackPath);
      const operations: UndoOperation[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          const operation = await this.loadOperation(file.replace(".json", ""));
          if (operation) operations.push(operation);
        }
      }

      return operations;
    } catch {
      return [];
    }
  }

  private async maintainStackSize(): Promise<void> {
    const operations = await this.getAllOperations();

    if (operations.length <= this.maxStackSize) return;

    // Sort by timestamp and keep only recent ones
    const sortedOps = operations.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
    const toDelete = sortedOps.slice(this.maxStackSize);

    for (const op of toDelete) {
      try {
        await fs.unlink(join(this.stackPath, `${op.id}.json`));
        // Also cleanup associated snapshots
        try {
          await fs.rmdir(join(this.snapshotsPath, op.beforeState.id), {
            recursive: true,
          });
          if (op.afterState) {
            await fs.rmdir(join(this.snapshotsPath, op.afterState.id), {
              recursive: true,
            });
          }
        } catch {
          // Snapshot cleanup failures are non-critical
        }
      } catch (error) {
        logger.warn(`Failed to cleanup old operation ${op.id}:`, error);
      }
    }
  }

  private getFeatureFlags(): Record<string, boolean> {
    // Extract feature flags from environment
    const flags: Record<string, boolean> = {};

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith("FEATURE_")) {
        flags[key] = value === "true" || value === "1";
      }
    }

    return flags;
  }

  async getStatus(): Promise<any> {
    const operations = await this.getAllOperations();
    const snapshots = await this.getSnapshotsList();

    return {
      timestamp: new Date().toISOString(),
      stackSize: operations.length,
      maxStackSize: this.maxStackSize,
      recentOperations: operations
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5)
        .map((op) => ({
          id: op.id,
          operation: op.operation,
          description: op.description,
          riskLevel: op.riskLevel,
          status: op.status,
          timestamp: op.timestamp,
        })),
      snapshotsCount: snapshots.length,
      criticalPaths: this.criticalPaths,
    };
  }

  private async getSnapshotsList(): Promise<string[]> {
    try {
      return await fs.readdir(this.snapshotsPath);
    } catch {
      return [];
    }
  }
}

// CLI Interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , command, ...args] = process.argv;
  const undoStack = new EmergencyUndoStack();

  (async () => {
    try {
      await undoStack.init();

      switch (command) {
        case "status":
          const status = await undoStack.getStatus();
          console.log(JSON.stringify(status, null, 2));
          break;

        case "rollback":
          const operationId = args[0];
          const result = await undoStack.rollback(operationId);
          console.log("🔄 Rollback Result:");
          console.log(JSON.stringify(result, null, 2));
          break;

        case "snapshot":
          const name = args[0] || "manual";
          const snapshot = await undoStack.createSnapshot(name);
          console.log(`📸 Created snapshot: ${snapshot.id}`);
          break;

        default:
          console.log(
            "Usage: tsx emergency_undo_stack.ts [status|rollback [operation-id]|snapshot [name]]",
          );
      }
    } catch (error) {
      logger.error("Emergency undo stack failed:", error);
      process.exit(1);
    }
  })();
}

export { EmergencyUndoStack };
