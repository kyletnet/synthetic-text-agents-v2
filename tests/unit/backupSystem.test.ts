/**
 * Unit tests for BackupSystem implementation (Smoke Tests)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BackupSystem } from "../../src/shared/backupSystem";
import type { BackupConfig } from "../../src/shared/backupSystem";

describe("BackupSystem - Smoke Tests", () => {
  let backupSystem: BackupSystem;
  let mockConfig: BackupConfig;

  beforeEach(() => {
    mockConfig = {
      enabled: false, // Disabled to prevent automatic scheduling
      strategies: [
        {
          name: "test-strategy",
          type: "full",
          enabled: true,
          schedule: "0 0 * * *",
          retention: {
            days: 7,
            count: 5,
          },
          sources: [],
          destination: {
            type: "local",
            path: "/tmp/test-backups",
          },
        },
      ],
      verification: {
        enabled: false,
        checksumAlgorithm: "sha256",
      },
      compression: {
        enabled: false,
        algorithm: "gzip",
        level: 6,
      },
      encryption: {
        enabled: false,
        algorithm: "aes-256-gcm",
      },
    };
  });

  afterEach(() => {
    // Clean up any event listeners
    if (backupSystem) {
      backupSystem.removeAllListeners();
    }
  });

  describe("Instance Creation", () => {
    it("should create a BackupSystem instance", () => {
      backupSystem = new BackupSystem(mockConfig);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });

    it("should create instance with enabled=false config", () => {
      const config: BackupConfig = {
        ...mockConfig,
        enabled: false,
      };
      backupSystem = new BackupSystem(config);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });

    it("should handle config with multiple strategies", () => {
      const config: BackupConfig = {
        ...mockConfig,
        strategies: [
          {
            name: "strategy-1",
            type: "full",
            enabled: true,
            schedule: "0 0 * * *",
            retention: { days: 7, count: 5 },
            sources: [],
            destination: { type: "local", path: "/tmp/backup-1" },
          },
          {
            name: "strategy-2",
            type: "incremental",
            enabled: false,
            schedule: "0 12 * * *",
            retention: { days: 30, count: 10 },
            sources: [],
            destination: { type: "local", path: "/tmp/backup-2" },
          },
        ],
      };

      backupSystem = new BackupSystem(config);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });
  });

  describe("Configuration", () => {
    beforeEach(() => {
      backupSystem = new BackupSystem(mockConfig);
    });

    it("should accept config with verification enabled", () => {
      const config: BackupConfig = {
        ...mockConfig,
        verification: {
          enabled: true,
          checksumAlgorithm: "sha256",
        },
      };

      const system = new BackupSystem(config);
      expect(system).toBeInstanceOf(BackupSystem);
    });

    it("should accept config with compression enabled", () => {
      const config: BackupConfig = {
        ...mockConfig,
        compression: {
          enabled: true,
          algorithm: "gzip",
          level: 9,
        },
      };

      const system = new BackupSystem(config);
      expect(system).toBeInstanceOf(BackupSystem);
    });

    it("should accept config with encryption enabled", () => {
      const config: BackupConfig = {
        ...mockConfig,
        encryption: {
          enabled: true,
          algorithm: "aes-256-gcm",
          key: "test-key-123",
        },
      };

      const system = new BackupSystem(config);
      expect(system).toBeInstanceOf(BackupSystem);
    });
  });

  describe("Strategy Types", () => {
    it("should support full backup strategy", () => {
      const config: BackupConfig = {
        ...mockConfig,
        strategies: [
          {
            name: "full-backup",
            type: "full",
            enabled: true,
            schedule: "0 0 * * 0",
            retention: { days: 30, count: 4 },
            sources: [],
            destination: { type: "local", path: "/tmp/full" },
          },
        ],
      };

      backupSystem = new BackupSystem(config);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });

    it("should support incremental backup strategy", () => {
      const config: BackupConfig = {
        ...mockConfig,
        strategies: [
          {
            name: "incremental-backup",
            type: "incremental",
            enabled: true,
            schedule: "0 */6 * * *",
            retention: { days: 7, count: 28 },
            sources: [],
            destination: { type: "local", path: "/tmp/incremental" },
          },
        ],
      };

      backupSystem = new BackupSystem(config);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });

    it("should support differential backup strategy", () => {
      const config: BackupConfig = {
        ...mockConfig,
        strategies: [
          {
            name: "differential-backup",
            type: "differential",
            enabled: true,
            schedule: "0 12 * * *",
            retention: { days: 14, count: 14 },
            sources: [],
            destination: { type: "local", path: "/tmp/differential" },
          },
        ],
      };

      backupSystem = new BackupSystem(config);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });
  });

  describe("Destination Types", () => {
    it("should support local destination", () => {
      const config: BackupConfig = {
        ...mockConfig,
        strategies: [
          {
            name: "local-backup",
            type: "full",
            enabled: true,
            schedule: "0 0 * * *",
            retention: { days: 7, count: 5 },
            sources: [],
            destination: {
              type: "local",
              path: "/var/backups/test",
            },
          },
        ],
      };

      backupSystem = new BackupSystem(config);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });

    it("should support S3 destination", () => {
      const config: BackupConfig = {
        ...mockConfig,
        strategies: [
          {
            name: "s3-backup",
            type: "full",
            enabled: true,
            schedule: "0 0 * * *",
            retention: { days: 30, count: 10 },
            sources: [],
            destination: {
              type: "s3",
              bucket: "test-backups",
              region: "us-east-1",
              accessKeyId: "test-key",
              secretAccessKey: "test-secret",
            },
          },
        ],
      };

      backupSystem = new BackupSystem(config);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });

    it("should support remote destination", () => {
      const config: BackupConfig = {
        ...mockConfig,
        strategies: [
          {
            name: "remote-backup",
            type: "full",
            enabled: true,
            schedule: "0 0 * * *",
            retention: { days: 7, count: 5 },
            sources: [],
            destination: {
              type: "remote",
              host: "backup.example.com",
              port: 22,
              username: "backup-user",
              path: "/backups/test",
            },
          },
        ],
      };

      backupSystem = new BackupSystem(config);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });
  });

  describe("Retention Policies", () => {
    it("should accept retention by days", () => {
      const config: BackupConfig = {
        ...mockConfig,
        strategies: [
          {
            name: "retention-days",
            type: "full",
            enabled: true,
            schedule: "0 0 * * *",
            retention: { days: 90 },
            sources: [],
            destination: { type: "local", path: "/tmp/backups" },
          },
        ],
      };

      backupSystem = new BackupSystem(config);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });

    it("should accept retention by count", () => {
      const config: BackupConfig = {
        ...mockConfig,
        strategies: [
          {
            name: "retention-count",
            type: "full",
            enabled: true,
            schedule: "0 0 * * *",
            retention: { count: 20 },
            sources: [],
            destination: { type: "local", path: "/tmp/backups" },
          },
        ],
      };

      backupSystem = new BackupSystem(config);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });

    it("should accept retention by both days and count", () => {
      const config: BackupConfig = {
        ...mockConfig,
        strategies: [
          {
            name: "retention-both",
            type: "full",
            enabled: true,
            schedule: "0 0 * * *",
            retention: { days: 30, count: 10 },
            sources: [],
            destination: { type: "local", path: "/tmp/backups" },
          },
        ],
      };

      backupSystem = new BackupSystem(config);
      expect(backupSystem).toBeInstanceOf(BackupSystem);
    });
  });

  describe("Event Emitter", () => {
    beforeEach(() => {
      backupSystem = new BackupSystem(mockConfig);
    });

    it("should be an EventEmitter", () => {
      expect(typeof backupSystem.on).toBe("function");
      expect(typeof backupSystem.emit).toBe("function");
      expect(typeof backupSystem.removeListener).toBe("function");
    });

    it("should allow event listener registration", () => {
      const listener = () => {};
      backupSystem.on("backup:started", listener);
      backupSystem.removeListener("backup:started", listener);
      // Should not throw
      expect(true).toBe(true);
    });
  });
});
