#!/usr/bin/env node
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */


/**
 * GAP Config Manager
 *
 * CLI tool for managing .gaprc.json configuration:
 * - Validation
 * - Enable/disable checks
 * - Update settings
 * - Team management
 * - Interactive setup
 */

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { BackupLifecycleManager } from "./lib/backup-lifecycle-manager.js";
import { SchemaValidator } from "./lib/schema-validator.js";

// ============================================================================
// Types
// ============================================================================

interface GaprcConfig {
  version: string;
  globalSettings: {
    mode: "disabled" | "shadow" | "enforce";
    failOn: Array<"P0" | "P1" | "P2">;
    autoFix: {
      enabled: boolean;
      maxSeverity: "P0" | "P1" | "P2";
    };
    timeout: number;
    reportPath: string;
  };
  checks: Array<{
    id: string;
    name: string;
    enabled: boolean;
    severity: "P0" | "P1" | "P2";
    category: string;
    config?: Record<string, unknown>;
    autoFixable: boolean;
  }>;
  teams: Record<
    string,
    {
      members?: string[];
      mode: "disabled" | "shadow" | "enforce";
      failOn: Array<"P0" | "P1" | "P2">;
    }
  >;
  metrics: {
    enabled: boolean;
    collectInterval: string;
    reportRecipients?: string[];
    slackWebhook?: string;
  };
}

// ============================================================================
// Config Manager
// ============================================================================

class GapConfigManager {
  private configPath = ".gaprc.json";
  private backupManager = new BackupLifecycleManager();
  private schemaValidator = new SchemaValidator();

  /**
   * Validate configuration
   */
  async validate(): Promise<void> {
    console.log("🔍 Validating .gaprc.json...\n");

    if (!existsSync(this.configPath)) {
      console.error("❌ .gaprc.json not found");
      console.log("\nRun: npm run init:gap-system");
      process.exit(1);
    }

    try {
      // Step 1: JSON Schema validation
      console.log("📋 Step 1: JSON Schema validation...");
      const schemaResult = await this.schemaValidator.validateGaprc();

      if (!schemaResult.valid) {
        console.error("❌ Schema validation failed:\n");
        for (const error of schemaResult.errors || []) {
          console.error(`   ${error}`);
        }
        process.exit(1);
      }
      console.log("   ✅ Schema valid\n");

      // Step 2: Logical validation
      console.log("📋 Step 2: Logical validation...");
      const content = await readFile(this.configPath, "utf-8");
      const config = JSON.parse(content) as GaprcConfig;

      // Validation checks
      const errors: string[] = [];

      // Check version
      if (!config.version) {
        errors.push("Missing 'version' field");
      }

      // Check globalSettings
      if (!config.globalSettings) {
        errors.push("Missing 'globalSettings' section");
      } else {
        if (
          !["disabled", "shadow", "enforce"].includes(
            config.globalSettings.mode,
          )
        ) {
          errors.push(`Invalid mode: ${config.globalSettings.mode}`);
        }

        if (!Array.isArray(config.globalSettings.failOn)) {
          errors.push("'failOn' must be an array");
        }

        if (!config.globalSettings.autoFix) {
          errors.push("Missing 'autoFix' configuration");
        }
      }

      // Check checks
      if (!Array.isArray(config.checks)) {
        errors.push("'checks' must be an array");
      } else {
        for (const check of config.checks) {
          if (!check.id) {
            errors.push("Check missing 'id' field");
          }
          if (!["P0", "P1", "P2"].includes(check.severity)) {
            errors.push(`Invalid severity for ${check.id}: ${check.severity}`);
          }
        }
      }

      // Check teams
      if (typeof config.teams !== "object") {
        errors.push("'teams' must be an object");
      }

      // Check metrics
      if (!config.metrics) {
        errors.push("Missing 'metrics' section");
      }

      // Report results
      if (errors.length > 0) {
        console.log("❌ Validation failed:\n");
        for (const error of errors) {
          console.log(`   - ${error}`);
        }
        process.exit(1);
      } else {
        console.log("✅ Configuration is valid\n");
        this.printConfigSummary(config);
      }
    } catch (error) {
      console.error("❌ Invalid JSON:");
      console.error(error instanceof Error ? error.message : "Unknown error");
      process.exit(1);
    }
  }

  /**
   * Enable a check
   */
  async enableCheck(checkId: string): Promise<void> {
    await this.backupManager.createBackup(`Enable check: ${checkId}`, false);

    const config = await this.loadConfig();
    const check = config.checks.find((c) => c.id === checkId);

    if (!check) {
      console.error(`❌ Check not found: ${checkId}`);
      process.exit(1);
    }

    check.enabled = true;
    await this.saveConfig(config);

    console.log(`✅ Enabled check: ${checkId}`);
  }

  /**
   * Disable a check
   */
  async disableCheck(checkId: string): Promise<void> {
    await this.backupManager.createBackup(`Disable check: ${checkId}`, false);

    const config = await this.loadConfig();
    const check = config.checks.find((c) => c.id === checkId);

    if (!check) {
      console.error(`❌ Check not found: ${checkId}`);
      process.exit(1);
    }

    check.enabled = false;
    await this.saveConfig(config);

    console.log(`✅ Disabled check: ${checkId}`);
  }

  /**
   * Set mode
   */
  async setMode(mode: "disabled" | "shadow" | "enforce"): Promise<void> {
    await this.backupManager.createBackup(`Set mode: ${mode}`, false);

    const config = await this.loadConfig();
    config.globalSettings.mode = mode;
    await this.saveConfig(config);

    console.log(`✅ Mode set to: ${mode}`);
  }

  /**
   * Add team
   */
  async addTeam(
    name: string,
    options: { mode?: string; members?: string[] },
  ): Promise<void> {
    await this.backupManager.createBackup(`Add team: ${name}`, false);

    const config = await this.loadConfig();

    config.teams[name] = {
      members: options.members || [],
      mode: (options.mode as "disabled" | "shadow" | "enforce") || "shadow",
      failOn: [],
    };

    await this.saveConfig(config);

    console.log(`✅ Added team: ${name}`);
    console.log(`   Mode: ${config.teams[name].mode}`);
    console.log(`   Members: ${config.teams[name].members?.length || 0}`);
  }

  /**
   * List all checks
   */
  async listChecks(): Promise<void> {
    const config = await this.loadConfig();

    console.log("\n📋 GAP Checks\n");
    console.log("═".repeat(70));

    for (const check of config.checks) {
      const status = check.enabled ? "✅" : "❌";
      const autoFix = check.autoFixable ? "🔧" : "  ";
      console.log(`\n${status} ${autoFix} ${check.id}`);
      console.log(`   Name: ${check.name}`);
      console.log(`   Severity: ${check.severity}`);
      console.log(`   Category: ${check.category}`);
      console.log(`   Enabled: ${check.enabled}`);
      console.log(`   Auto-fixable: ${check.autoFixable}`);
    }

    console.log("\n" + "═".repeat(70));
    console.log(
      `\nTotal: ${config.checks.length} checks (${
        config.checks.filter((c) => c.enabled).length
      } enabled)\n`,
    );
  }

  /**
   * Show current configuration
   */
  async showConfig(): Promise<void> {
    const config = await this.loadConfig();

    console.log("\n⚙️  GAP Scanner Configuration\n");
    console.log("═".repeat(70));

    console.log("\n🌍 Global Settings:");
    console.log(`   Mode: ${config.globalSettings.mode}`);
    console.log(
      `   Fail On: ${config.globalSettings.failOn.join(", ") || "none"}`,
    );
    console.log(
      `   Auto-fix: ${
        config.globalSettings.autoFix.enabled ? "enabled" : "disabled"
      }`,
    );
    console.log(
      `   Max Auto-fix Severity: ${config.globalSettings.autoFix.maxSeverity}`,
    );
    console.log(`   Timeout: ${config.globalSettings.timeout}ms`);

    console.log("\n📊 Metrics:");
    console.log(`   Enabled: ${config.metrics.enabled}`);
    console.log(`   Interval: ${config.metrics.collectInterval}`);

    console.log("\n👥 Teams:");
    const teamCount = Object.keys(config.teams).length;
    if (teamCount === 0) {
      console.log("   No teams configured");
    } else {
      for (const [name, team] of Object.entries(config.teams)) {
        console.log(
          `   ${name}: ${team.mode} (${team.members?.length || 0} members)`,
        );
      }
    }

    console.log("\n✅ Enabled Checks:");
    const enabled = config.checks.filter((c) => c.enabled);
    for (const check of enabled) {
      console.log(`   ${check.severity} ${check.id}`);
    }

    console.log("\n" + "═".repeat(70) + "\n");
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async loadConfig(): Promise<GaprcConfig> {
    const content = await readFile(this.configPath, "utf-8");
    return JSON.parse(content) as GaprcConfig;
  }

  private async saveConfig(config: GaprcConfig): Promise<void> {
    await writeFile(this.configPath, JSON.stringify(config, null, 2) + "\n");
  }

  private printConfigSummary(config: GaprcConfig): void {
    console.log("Configuration Summary:");
    console.log(`   Version: ${config.version}`);
    console.log(`   Mode: ${config.globalSettings.mode}`);
    console.log(
      `   Checks: ${config.checks.length} (${
        config.checks.filter((c) => c.enabled).length
      } enabled)`,
    );
    console.log(`   Teams: ${Object.keys(config.teams).length}`);
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const manager = new GapConfigManager();

  const command = args[0];

  try {
    switch (command) {
      case "--validate":
      case "validate": {
        await manager.validate();
        break;
      }

      case "--enable":
      case "enable": {
        const checkId = args[1];
        if (!checkId) {
          console.error("❌ Check ID required");
          console.log("\nUsage: npm run gap:config -- enable <check-id>");
          process.exit(1);
        }
        await manager.enableCheck(checkId);
        break;
      }

      case "--disable":
      case "disable": {
        const checkId = args[1];
        if (!checkId) {
          console.error("❌ Check ID required");
          console.log("\nUsage: npm run gap:config -- disable <check-id>");
          process.exit(1);
        }
        await manager.disableCheck(checkId);
        break;
      }

      case "--mode":
      case "mode": {
        const mode = args[1] as "disabled" | "shadow" | "enforce";
        if (!["disabled", "shadow", "enforce"].includes(mode)) {
          console.error(
            "❌ Invalid mode. Must be: disabled, shadow, or enforce",
          );
          process.exit(1);
        }
        await manager.setMode(mode);
        break;
      }

      case "--add-team":
      case "add-team": {
        const name = args[1];
        if (!name) {
          console.error("❌ Team name required");
          console.log(
            "\nUsage: npm run gap:config -- add-team <name> [--mode=shadow]",
          );
          process.exit(1);
        }

        const modeArg = args.find((arg) => arg.startsWith("--mode="));
        const mode = modeArg ? modeArg.split("=")[1] : "shadow";

        await manager.addTeam(name, { mode });
        break;
      }

      case "--list":
      case "list": {
        await manager.listChecks();
        break;
      }

      case "--show":
      case "show": {
        await manager.showConfig();
        break;
      }

      default: {
        console.log(`
GAP Config Manager

Usage:
  npm run gap:config -- validate                    # Validate configuration
  npm run gap:config -- enable <check-id>           # Enable a check
  npm run gap:config -- disable <check-id>          # Disable a check
  npm run gap:config -- mode <mode>                 # Set global mode
  npm run gap:config -- add-team <name> [options]   # Add team
  npm run gap:config -- list                        # List all checks
  npm run gap:config -- show                        # Show configuration

Commands:
  validate                Validate .gaprc.json syntax and structure
  enable <check-id>       Enable a specific check
  disable <check-id>      Disable a specific check
  mode <mode>             Set mode: disabled, shadow, enforce
  add-team <name>         Add a team configuration
  list                    List all available checks
  show                    Show current configuration

Examples:
  # Validate configuration
  npm run gap:config -- validate

  # Enable a check
  npm run gap:config -- enable pii-masking

  # Set to enforce mode
  npm run gap:config -- mode enforce

  # Add team
  npm run gap:config -- add-team backend --mode=enforce

  # List all checks
  npm run gap:config -- list

Note: All changes create automatic backups
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

export { GapConfigManager };
