#!/usr/bin/env node

/**
 * Backup Lifecycle Manager
 *
 * Manages automatic backups of .gaprc.json with lifecycle tracking:
 * - Regular backups (30-day retention)
 * - Emergency backups (6-month retention)
 * - Automatic cleanup of expired backups
 * - Registry-based tracking
 */

import { readFile, writeFile, mkdir, unlink, copyFile } from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

interface BackupMetadata {
  path: string;
  createdAt: Date;
  expiresAt: Date;
  reason: string;
  isEmergency: boolean;
  sourceHash?: string;
}

interface BackupRegistry {
  version: string;
  backups: BackupMetadata[];
}

// ============================================================================
// Backup Lifecycle Manager
// ============================================================================

export class BackupLifecycleManager {
  private registryPath = ".gaprc/backup-registry.json";
  private backupDir = ".gaprc";
  private sourceFile = ".gaprc.json";

  /**
   * Create a new backup
   */
  async createBackup(reason: string, emergency = false): Promise<string> {
    // Ensure backup directory exists
    if (!existsSync(this.backupDir)) {
      await mkdir(this.backupDir, { recursive: true });
    }

    // Ensure source file exists
    if (!existsSync(this.sourceFile)) {
      throw new Error(`.gaprc.json not found. Cannot create backup.`);
    }

    const timestamp = Date.now();
    const backupPath = path.join(this.backupDir, `backup.${timestamp}.json`);

    // Create backup
    await copyFile(this.sourceFile, backupPath);

    // Calculate expiration
    const createdAt = new Date();
    const expiresAt = emergency
      ? this.addMonths(createdAt, 6) // Emergency: 6 months
      : this.addDays(createdAt, 30); // Regular: 30 days

    // Create metadata
    const metadata: BackupMetadata = {
      path: backupPath,
      createdAt,
      expiresAt,
      reason,
      isEmergency: emergency,
      sourceHash: await this.calculateHash(this.sourceFile),
    };

    // Add to registry
    await this.addToRegistry(metadata);

    console.log(`✅ Backup created: ${backupPath}`);
    console.log(
      `   Type: ${emergency ? "Emergency (6 months)" : "Regular (30 days)"}`,
    );
    console.log(`   Expires: ${expiresAt.toISOString().split("T")[0]}`);
    console.log(`   Reason: ${reason}`);

    return backupPath;
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(backupPath: string): Promise<void> {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    // Create a backup of current state before restoring
    console.log("⚠️  Creating safety backup of current state...");
    await this.createBackup("Pre-restore safety backup", false);

    // Restore
    await copyFile(backupPath, this.sourceFile);

    console.log(`✅ Restored from: ${backupPath}`);
    console.log(`   Target: ${this.sourceFile}`);
  }

  /**
   * List all backups
   */
  async listBackups(): Promise<void> {
    const registry = await this.loadRegistry();

    if (registry.backups.length === 0) {
      console.log("\nℹ️  No backups found");
      return;
    }

    console.log("\n📦 Backup Registry\n");
    console.log("═".repeat(80));

    const sorted = [...registry.backups].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    for (const backup of sorted) {
      const age = Math.floor(
        (Date.now() - new Date(backup.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const expiresIn = Math.floor(
        (new Date(backup.expiresAt).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      );

      const icon = backup.isEmergency ? "🚨" : "📄";
      const status = expiresIn < 0 ? "EXPIRED" : `in ${expiresIn} days`;

      console.log(`\n${icon} ${path.basename(backup.path)}`);
      console.log(
        `   Created: ${new Date(backup.createdAt).toISOString().split("T")[0]} (${age} days ago)`,
      );
      console.log(`   Expires: ${status}`);
      console.log(`   Reason: ${backup.reason}`);
      if (backup.sourceHash) {
        console.log(`   Hash: ${backup.sourceHash.substring(0, 8)}...`);
      }
    }

    console.log("\n" + "═".repeat(80));
    console.log(`Total: ${registry.backups.length} backup(s)\n`);
  }

  /**
   * Clean up expired backups
   */
  async cleanupExpiredBackups(): Promise<void> {
    const registry = await this.loadRegistry();
    const now = new Date();

    let cleaned = 0;
    const remaining: BackupMetadata[] = [];

    for (const backup of registry.backups) {
      const expired = new Date(backup.expiresAt) < now;

      if (expired && !backup.isEmergency) {
        // Delete expired regular backup
        try {
          if (existsSync(backup.path)) {
            await unlink(backup.path);
            console.log(
              `🗑️  Deleted expired backup: ${path.basename(backup.path)}`,
            );
            cleaned++;
          }
        } catch (error) {
          console.error(
            `   ❌ Failed to delete: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          remaining.push(backup);
        }
      } else {
        remaining.push(backup);
      }
    }

    // Update registry
    registry.backups = remaining;
    await this.saveRegistry(registry);

    if (cleaned === 0) {
      console.log("ℹ️  No expired backups to clean");
    } else {
      console.log(`✅ Cleaned ${cleaned} expired backup(s)`);
    }

    // Show emergency backups separately
    const emergency = remaining.filter((b) => b.isEmergency);
    if (emergency.length > 0) {
      console.log(
        `\nℹ️  ${emergency.length} emergency backup(s) preserved (6-month retention)`,
      );
    }
  }

  /**
   * Get the most recent backup
   */
  async getMostRecentBackup(): Promise<BackupMetadata | null> {
    const registry = await this.loadRegistry();

    if (registry.backups.length === 0) {
      return null;
    }

    const sorted = [...registry.backups].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return sorted[0];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async loadRegistry(): Promise<BackupRegistry> {
    if (!existsSync(this.registryPath)) {
      return {
        version: "1.0.0",
        backups: [],
      };
    }

    const content = await readFile(this.registryPath, "utf-8");
    const registry = JSON.parse(content) as {
      version: string;
      backups: unknown[];
    };

    // Convert date strings to Date objects
    return {
      version: registry.version,
      backups: registry.backups.map((item: unknown) => {
        const backup = item as Record<string, unknown>;
        return {
          ...backup,
          createdAt: new Date(backup.createdAt as string),
          expiresAt: new Date(backup.expiresAt as string),
        } as BackupMetadata;
      }),
    };
  }

  private async saveRegistry(registry: BackupRegistry): Promise<void> {
    if (!existsSync(this.backupDir)) {
      await mkdir(this.backupDir, { recursive: true });
    }

    await writeFile(
      this.registryPath,
      JSON.stringify(registry, null, 2) + "\n",
    );
  }

  private async addToRegistry(metadata: BackupMetadata): Promise<void> {
    const registry = await this.loadRegistry();
    registry.backups.push(metadata);
    await this.saveRegistry(registry);
  }

  private async calculateHash(filePath: string): Promise<string> {
    const content = await readFile(filePath, "utf-8");
    // Simple hash (for demonstration - could use crypto.createHash for production)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const manager = new BackupLifecycleManager();

  const command = args[0];

  try {
    switch (command) {
      case "create": {
        const reason = args[1] || "Manual backup";
        const emergency = args.includes("--emergency");
        await manager.createBackup(reason, emergency);
        break;
      }

      case "list": {
        await manager.listBackups();
        break;
      }

      case "cleanup": {
        await manager.cleanupExpiredBackups();
        break;
      }

      case "restore": {
        const backupPath = args[1];
        if (!backupPath) {
          console.error("❌ Error: Backup path required");
          console.log("\nUsage: npm run gap:backup -- restore <backup-path>");
          process.exit(1);
        }
        await manager.restoreBackup(backupPath);
        break;
      }

      case "recent": {
        const recent = await manager.getMostRecentBackup();
        if (recent) {
          console.log("\n📦 Most Recent Backup:\n");
          console.log(`   Path: ${recent.path}`);
          console.log(`   Created: ${recent.createdAt.toISOString()}`);
          console.log(`   Reason: ${recent.reason}`);
        } else {
          console.log("\nℹ️  No backups found");
        }
        break;
      }

      default: {
        console.log(`
Backup Lifecycle Manager

Usage:
  npm run gap:backup -- create [reason] [--emergency]
  npm run gap:backup -- list
  npm run gap:backup -- cleanup
  npm run gap:backup -- restore <backup-path>
  npm run gap:backup -- recent

Commands:
  create       Create a new backup
               --emergency: 6-month retention (default: 30 days)

  list         List all backups

  cleanup      Delete expired backups

  restore      Restore from a backup (creates safety backup first)

  recent       Show most recent backup

Examples:
  # Create regular backup
  npm run gap:backup -- create "Before major update"

  # Create emergency backup (6-month retention)
  npm run gap:backup -- create "Emergency rollback point" --emergency

  # List all backups
  npm run gap:backup -- list

  # Clean up expired backups
  npm run gap:backup -- cleanup

  # Restore from backup
  npm run gap:backup -- restore .gaprc/backup.1234567890.json
        `);
      }
    }
  } catch (error) {
    console.error(
      "\n❌ Error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
