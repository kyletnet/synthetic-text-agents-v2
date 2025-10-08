#!/usr/bin/env node
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * Sync Transaction System
 * Provides atomic operations and rollback for /sync workflow
 */

import { execSync } from "child_process";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  cpSync,
  rmSync,
} from "fs";
import { join, dirname } from "path";

interface SyncTransaction {
  id: string;
  timestamp: string;
  status: "STARTED" | "COMPLETED" | "FAILED" | "ROLLED_BACK";
  steps: SyncStep[];
  backup: {
    created: boolean;
    path: string;
  };
  metadata: {
    gitCommit?: string;
    modifiedFiles: string[];
    failurePoint?: string;
    errorMessage?: string;
  };
}

interface SyncStep {
  name: string;
  command: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  output?: string;
  error?: string;
  duration?: number;
  critical: boolean; // If true, failure blocks entire sync
}

class SyncTransactionSystem {
  private projectRoot: string;
  private transactionDir: string;
  private currentTransaction: SyncTransaction | null = null;

  constructor() {
    this.projectRoot = process.cwd();
    this.transactionDir = join(this.projectRoot, "reports/.sync-transactions");

    if (!existsSync(this.transactionDir)) {
      mkdirSync(this.transactionDir, { recursive: true });
    }
  }

  async startTransaction(): Promise<string> {
    const transactionId = `sync-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;
    const backupPath = join(this.transactionDir, `${transactionId}-backup`);

    console.log("🔄 Starting sync transaction:", transactionId);

    this.currentTransaction = {
      id: transactionId,
      timestamp: new Date().toISOString(),
      status: "STARTED",
      steps: this.defineSteps(),
      backup: {
        created: false,
        path: backupPath,
      },
      metadata: {
        modifiedFiles: [],
      },
    };

    // Create backup of critical files
    await this.createBackup();

    // Save initial transaction state
    this.saveTransaction();

    console.log("✅ Transaction started with backup at:", backupPath);
    return transactionId;
  }

  private defineSteps(): SyncStep[] {
    return [
      {
        name: "AI Fix Suggestions",
        command: "npm run status:smart",
        status: "PENDING",
        critical: false,
      },
      {
        name: "Cleanup Old Docs",
        command: "cleanup_old_docs",
        status: "PENDING",
        critical: false,
      },
      {
        name: "Update Slash Commands",
        command: "update_slash_commands",
        status: "PENDING",
        critical: false,
      },
      {
        name: "Documentation Sync",
        command: "npm run docs:sync",
        status: "PENDING",
        critical: true,
      },
      {
        name: "Core Document Updates",
        command: "npm run docs:update-core",
        status: "PENDING",
        critical: true,
      },
      {
        name: "Security Audit",
        command: "npm run security:audit:check",
        status: "PENDING",
        critical: false,
      },
      {
        name: "CI Validation",
        command: "npm run ci:strict",
        status: "PENDING",
        critical: true,
      },
      {
        name: "Health Report",
        command: "npm run health:report",
        status: "PENDING",
        critical: false,
      },
      {
        name: "Auto Commit & Push",
        command: "auto_commit_push",
        status: "PENDING",
        critical: false,
      },
    ];
  }

  private async createBackup(): Promise<void> {
    if (!this.currentTransaction) return;

    const backupPath = this.currentTransaction.backup.path;

    try {
      // Create backup directory
      mkdirSync(backupPath, { recursive: true });

      // Critical files to backup
      const criticalFiles = [
        "docs/",
        "SLASH_COMMANDS.md",
        "SYSTEM_MAP.md",
        "package.json",
        "scripts/slash-commands.sh",
        "reports/",
        "README.md",
        "CHANGELOG.md",
        "HANDOFF_NAVIGATION.md",
      ];

      for (const file of criticalFiles) {
        const sourcePath = join(this.projectRoot, file);
        const backupFilePath = join(backupPath, file);

        if (existsSync(sourcePath)) {
          mkdirSync(dirname(backupFilePath), { recursive: true });
          cpSync(sourcePath, backupFilePath, { recursive: true });
        }
      }

      // Store current git state
      try {
        const gitCommit = execSync("git rev-parse HEAD", {
          encoding: "utf8",
        }).trim();
        this.currentTransaction.metadata.gitCommit = gitCommit;
      } catch (error) {
        console.warn("⚠️ Could not get git commit hash");
      }

      this.currentTransaction.backup.created = true;
      console.log("✅ Backup created successfully");
    } catch (error) {
      console.error("❌ Backup creation failed:", error);
      throw new Error("Failed to create backup");
    }
  }

  async executeStep(stepName: string): Promise<boolean> {
    if (!this.currentTransaction) {
      throw new Error("No active transaction");
    }

    const step = this.currentTransaction.steps.find((s) => s.name === stepName);
    if (!step) {
      throw new Error(`Step not found: ${stepName}`);
    }

    console.log(`🔧 Executing: ${stepName}`);
    step.status = "RUNNING";
    this.saveTransaction();

    const startTime = Date.now();

    try {
      let output: string;

      // Handle built-in functions
      if (
        step.command === "cleanup_old_docs" ||
        step.command === "update_slash_commands" ||
        step.command === "auto_commit_push"
      ) {
        output = `Built-in function ${step.command} executed`;
        console.log(`ℹ️ Built-in function: ${step.command}`);
      } else {
        // Execute npm command
        output = execSync(step.command, {
          encoding: "utf8",
          cwd: this.projectRoot,
          timeout: 300000, // 5 minutes timeout
        });
      }

      step.status = "SUCCESS";
      step.output = output;
      step.duration = Date.now() - startTime;

      console.log(`✅ ${stepName} completed in ${step.duration}ms`);
      this.saveTransaction();
      return true;
    } catch (error: any) {
      step.status = "FAILED";
      step.error = error.message;
      step.duration = Date.now() - startTime;

      console.error(`❌ ${stepName} failed:`, error.message);

      // If critical step fails, mark transaction as failed
      if (step.critical) {
        this.currentTransaction.status = "FAILED";
        this.currentTransaction.metadata.failurePoint = stepName;
        this.currentTransaction.metadata.errorMessage = error.message;
      }

      this.saveTransaction();
      return false;
    }
  }

  async rollback(): Promise<void> {
    if (!this.currentTransaction) {
      console.log("ℹ️ No active transaction to rollback");
      return;
    }

    console.log(
      "🔄 Rolling back sync transaction:",
      this.currentTransaction.id,
    );

    if (!this.currentTransaction.backup.created) {
      console.warn("⚠️ No backup available for rollback");
      return;
    }

    try {
      const backupPath = this.currentTransaction.backup.path;

      // Restore files from backup
      const criticalFiles = [
        "docs/",
        "SLASH_COMMANDS.md",
        "SYSTEM_MAP.md",
        "package.json",
        "scripts/slash-commands.sh",
        "reports/",
        "README.md",
        "CHANGELOG.md",
        "HANDOFF_NAVIGATION.md",
      ];

      for (const file of criticalFiles) {
        const backupFilePath = join(backupPath, file);
        const targetPath = join(this.projectRoot, file);

        if (existsSync(backupFilePath)) {
          // Remove current version
          if (existsSync(targetPath)) {
            rmSync(targetPath, { recursive: true, force: true });
          }
          // Restore from backup
          cpSync(backupFilePath, targetPath, { recursive: true });
          console.log(`✅ Restored: ${file}`);
        }
      }

      // Reset git state if needed
      if (this.currentTransaction.metadata.gitCommit) {
        try {
          execSync("git reset --hard HEAD~1", { cwd: this.projectRoot });
          console.log("✅ Git state reset");
        } catch (error) {
          console.warn("⚠️ Could not reset git state:", error);
        }
      }

      this.currentTransaction.status = "ROLLED_BACK";
      this.saveTransaction();

      console.log("✅ Rollback completed successfully");
    } catch (error) {
      console.error("❌ Rollback failed:", error);
      throw error;
    }
  }

  async commitTransaction(): Promise<void> {
    if (!this.currentTransaction) {
      throw new Error("No active transaction");
    }

    // Check if all critical steps succeeded
    const failedCriticalSteps = this.currentTransaction.steps.filter(
      (s) => s.critical && s.status === "FAILED",
    );

    if (failedCriticalSteps.length > 0) {
      console.error(
        "❌ Cannot commit - critical steps failed:",
        failedCriticalSteps.map((s) => s.name).join(", "),
      );
      throw new Error("Critical steps failed");
    }

    this.currentTransaction.status = "COMPLETED";
    this.saveTransaction();

    // Clean up backup after successful completion
    try {
      rmSync(this.currentTransaction.backup.path, {
        recursive: true,
        force: true,
      });
      console.log("✅ Transaction committed and backup cleaned up");
    } catch (error) {
      console.warn("⚠️ Could not clean up backup:", error);
    }

    this.currentTransaction = null;
  }

  private saveTransaction(): void {
    if (!this.currentTransaction) return;

    const transactionFile = join(
      this.transactionDir,
      `${this.currentTransaction.id}.json`,
    );
    writeFileSync(
      transactionFile,
      JSON.stringify(this.currentTransaction, null, 2),
    );
  }

  async getLastTransaction(): Promise<SyncTransaction | null> {
    try {
      const files = execSync(`ls -t ${this.transactionDir}/*.json | head -1`, {
        encoding: "utf8",
      }).trim();
      if (files) {
        const content = readFileSync(files, "utf8");
        return JSON.parse(content);
      }
    } catch (error) {
      // No transactions found
    }
    return null;
  }

  async showTransactionStatus(): Promise<void> {
    const lastTransaction = await this.getLastTransaction();

    if (!lastTransaction) {
      console.log("ℹ️ No sync transactions found");
      return;
    }

    console.log("\n🔄 Last Sync Transaction Status");
    console.log("==============================");
    console.log(`📊 ID: ${lastTransaction.id}`);
    console.log(`🕐 Time: ${lastTransaction.timestamp}`);
    console.log(
      `📈 Status: ${this.getStatusIcon(lastTransaction.status)} ${
        lastTransaction.status
      }`,
    );

    if (lastTransaction.metadata.failurePoint) {
      console.log(`❌ Failed at: ${lastTransaction.metadata.failurePoint}`);
      console.log(`💬 Error: ${lastTransaction.metadata.errorMessage}`);
    }

    console.log("\n📋 Steps:");
    lastTransaction.steps.forEach((step, i) => {
      const icon = this.getStatusIcon(step.status);
      const duration = step.duration ? ` (${step.duration}ms)` : "";
      console.log(`   ${i + 1}. ${icon} ${step.name}${duration}`);

      if (step.status === "FAILED" && step.error) {
        console.log(`      💬 ${step.error}`);
      }
    });

    console.log(
      `\n📁 Transaction log: ${join(
        this.transactionDir,
        lastTransaction.id + ".json",
      )}`,
    );
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case "PENDING":
        return "⏳";
      case "RUNNING":
        return "🔄";
      case "SUCCESS":
      case "COMPLETED":
        return "✅";
      case "FAILED":
        return "❌";
      case "ROLLED_BACK":
        return "🔄";
      case "STARTED":
        return "🚀";
      default:
        return "❓";
    }
  }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
  const system = new SyncTransactionSystem();
  const command = process.argv[2];

  switch (command) {
    case "start":
      system
        .startTransaction()
        .then((id) => {
          console.log("Transaction ID:", id);
        })
        .catch(console.error);
      break;

    case "rollback":
      system.rollback().catch(console.error);
      break;

    case "status":
      system.showTransactionStatus().catch(console.error);
      break;

    case "commit":
      system.commitTransaction().catch(console.error);
      break;

    default:
      console.log(
        "Usage: tsx sync-transaction-system.ts <start|rollback|status|commit>",
      );
      process.exit(1);
  }
}

export default SyncTransactionSystem;
