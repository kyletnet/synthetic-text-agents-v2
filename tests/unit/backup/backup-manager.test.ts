/**
 * Unit tests for Backup Manager
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BackupManager } from "../../../src/application/backup/backup-manager";
import type {
  BackupConfig,
  BackupJobConfig,
} from "../../../src/application/backup/backup-manager";
import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";

describe("BackupManager", () => {
  let manager: BackupManager;
  let config: BackupConfig;
  let testDir: string;
  let backupDir: string;

  beforeEach(async () => {
    // Create test directories
    testDir = path.join("/tmp", `manager-test-${Date.now()}`);
    backupDir = path.join("/tmp", `manager-backup-${Date.now()}`);

    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(backupDir, { recursive: true });

    // Create test files
    await fs.writeFile(path.join(testDir, "test1.txt"), "content 1");
    await fs.writeFile(path.join(testDir, "test2.txt"), "content 2");

    config = {
      enabled: true,
      compression: {
        enabled: false,
        algorithm: "gzip",
        level: 6,
      },
      encryption: {
        enabled: false,
        algorithm: "aes-256-gcm",
        keyId: "test",
      },
      verification: {
        enabled: false,
        checksumAlgorithm: "sha256",
        testRestore: false,
      },
    };

    manager = new BackupManager(config);
  });

  afterEach(async () => {
    await manager.shutdown();

    if (existsSync(testDir)) {
      await fs.rm(testDir, { recursive: true, force: true });
    }
    if (existsSync(backupDir)) {
      await fs.rm(backupDir, { recursive: true, force: true });
    }
  });

  describe("Initialization", () => {
    it("should create BackupManager instance", () => {
      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(BackupManager);
    });

    it("should initialize with config", () => {
      const status = manager.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.totalBackups).toBe(0);
    });
  });

  describe("Backup Operations", () => {
    it("should create file backup", async () => {
      const jobConfig: BackupJobConfig = {
        name: "test-job",
        type: "file",
        sources: [testDir],
        destination: backupDir,
        enabled: true,
      };

      const result = await manager.createBackup(jobConfig);

      expect(result.success).toBe(true);
      expect(result.backupId).toBeDefined();
      expect(result.metadata.files.length).toBe(2);
    });

    it("should create directory backup", async () => {
      // Create nested structure
      const subDir = path.join(testDir, "nested");
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(path.join(subDir, "nested.txt"), "nested content");

      const jobConfig: BackupJobConfig = {
        name: "dir-job",
        type: "directory",
        sources: [testDir],
        destination: backupDir,
        enabled: true,
      };

      const result = await manager.createBackup(jobConfig);

      expect(result.success).toBe(true);
      expect(result.metadata.files.length).toBe(3);
    });

    it("should prevent concurrent backups for same job", async () => {
      const jobConfig: BackupJobConfig = {
        name: "test-job",
        type: "file",
        sources: [testDir],
        destination: backupDir,
        enabled: true,
      };

      // Start first backup (don't await)
      const promise1 = manager.createBackup(jobConfig);

      // Try to start second backup immediately
      await expect(manager.createBackup(jobConfig)).rejects.toThrow(
        "already running",
      );

      // Wait for first to complete
      await promise1;
    });

    it("should throw error for disabled job", async () => {
      const jobConfig: BackupJobConfig = {
        name: "disabled-job",
        type: "file",
        sources: [testDir],
        destination: backupDir,
        enabled: false,
      };

      await expect(manager.createBackup(jobConfig)).rejects.toThrow(
        "is disabled",
      );
    });
  });

  describe("Incremental Backups", () => {
    it("should create incremental backup", async () => {
      const jobConfig: BackupJobConfig = {
        name: "incremental-job",
        type: "incremental",
        sources: [testDir],
        destination: backupDir,
        enabled: true,
      };

      // First backup (full)
      const result1 = await manager.createBackup(jobConfig);
      expect(result1.metadata.files.length).toBe(2);

      // Modify a file - wait longer to ensure filesystem timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await fs.writeFile(path.join(testDir, "test1.txt"), "modified content");

      // Second backup (incremental)
      const result2 = await manager.createBackup(jobConfig);
      // Should backup changed files (at least the modified one)
      expect(result2.metadata.files.length).toBeGreaterThanOrEqual(1);
      expect(result2.metadata.files.length).toBeLessThanOrEqual(2);
      expect(result2.metadata.parentBackupId).toBe(result1.backupId);
    });
  });

  describe("Backup Management", () => {
    it("should list backups", async () => {
      const jobConfig: BackupJobConfig = {
        name: "list-test",
        type: "file",
        sources: [testDir],
        destination: backupDir,
        enabled: true,
      };

      await manager.createBackup(jobConfig);
      await manager.createBackup(jobConfig);

      const backups = manager.listBackups();
      expect(backups.length).toBe(2);
    });

    it("should get backup by ID", async () => {
      const jobConfig: BackupJobConfig = {
        name: "get-test",
        type: "file",
        sources: [testDir],
        destination: backupDir,
        enabled: true,
      };

      const result = await manager.createBackup(jobConfig);

      const backup = manager.getBackup(result.backupId);
      expect(backup).toBeDefined();
      expect(backup?.id).toBe(result.backupId);
    });

    it("should delete backup", async () => {
      const jobConfig: BackupJobConfig = {
        name: "delete-test",
        type: "file",
        sources: [testDir],
        destination: backupDir,
        enabled: true,
      };

      const result = await manager.createBackup(jobConfig);

      await manager.deleteBackup(result.backupId);

      const backup = manager.getBackup(result.backupId);
      expect(backup).toBeNull();
    });
  });

  describe("Status", () => {
    it("should return correct status", async () => {
      const jobConfig: BackupJobConfig = {
        name: "status-test",
        type: "file",
        sources: [testDir],
        destination: backupDir,
        enabled: true,
      };

      await manager.createBackup(jobConfig);

      const status = manager.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.totalBackups).toBe(1);
      expect(status.activeBackups.length).toBe(0);
      expect(status.lastBackup).toBeInstanceOf(Date);
    });
  });

  describe("Events", () => {
    it("should emit backup:started event", async () => {
      const jobConfig: BackupJobConfig = {
        name: "event-test",
        type: "file",
        sources: [testDir],
        destination: backupDir,
        enabled: true,
      };

      let eventFired = false;
      manager.on("backup:started", () => {
        eventFired = true;
      });

      await manager.createBackup(jobConfig);

      expect(eventFired).toBe(true);
    });

    it("should emit backup:completed event", async () => {
      const jobConfig: BackupJobConfig = {
        name: "event-test",
        type: "file",
        sources: [testDir],
        destination: backupDir,
        enabled: true,
      };

      let eventFired = false;
      manager.on("backup:completed", () => {
        eventFired = true;
      });

      await manager.createBackup(jobConfig);

      expect(eventFired).toBe(true);
    });
  });
});
