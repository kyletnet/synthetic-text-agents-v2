#!/usr/bin/env tsx
/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Security Profile Manager
 *
 * Purpose:
 * - Load and apply environment-specific security profiles
 * - Support dev/staging/prod configurations
 * - Prevent "Over-Hardened System" in development
 *
 * Usage:
 *   npm run security:profile           # Show current profile
 *   npm run security:profile dev       # Apply dev profile
 *   npm run security:profile staging   # Apply staging profile
 *   npm run security:profile prod      # Apply prod profile
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const PROFILE_FILE = join(process.cwd(), ".security-profile.yml");

interface SecurityProfile {
  name: string;
  description: string;
  sandbox: {
    enabled: boolean;
    logOnly: boolean;
  };
  secretLint: {
    enabled: boolean;
    failOnDetect: boolean;
  };
  sbom: {
    mode: "strict" | "adaptive";
    enforceHash: boolean;
  };
  governance: {
    enforceLevel: "log" | "warn" | "enforce";
    deadLockRecovery: boolean;
  };
  license: {
    verify: boolean;
    warnOnly: boolean;
  };
  recommended: string[];
}

/**
 * Load security profile from YAML
 */
function loadProfile(profileName: string): SecurityProfile | null {
  if (!existsSync(PROFILE_FILE)) {
    console.error(`❌ Profile file not found: ${PROFILE_FILE}`);
    return null;
  }

  const content = readFileSync(PROFILE_FILE, "utf8");

  // Simple YAML parsing for our specific structure
  const lines = content.split("\n");
  let inProfile = false;
  let inTargetProfile = false;
  const profile: any = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith("#") || trimmed === "") continue;

    // Detect profile section
    if (trimmed === `${profileName}:`) {
      inTargetProfile = true;
      continue;
    }

    // Exit profile section if we hit another profile
    if (
      inTargetProfile &&
      /^(dev|staging|prod):$/.test(trimmed) &&
      trimmed !== `${profileName}:`
    ) {
      break;
    }

    // Parse profile content
    if (inTargetProfile) {
      const match = trimmed.match(/^(\w+):\s*(.+)$/);
      if (match) {
        const [, key, value] = match;
        profile[key] =
          value === "true" ? true : value === "false" ? false : value.replace(/"/g, "");
      }
    }
  }

  if (Object.keys(profile).length === 0) {
    return null;
  }

  return profile as SecurityProfile;
}

/**
 * Get current environment
 */
function getCurrentEnv(): string {
  return (
    process.env.SECURITY_PROFILE ||
    process.env.NODE_ENV ||
    "dev"
  );
}

/**
 * Print profile details
 */
function printProfile(profileName: string, profile: SecurityProfile) {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         Security Profile - Configuration                  ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  console.log(`📋 Profile: ${profileName.toUpperCase()}`);
  console.log(`   Name: ${profile.name}`);
  console.log(`   Description: ${profile.description}\n`);

  console.log("🔒 Security Settings:");
  console.log(`   Sandbox: ${profile.sandbox?.enabled ? "ENABLED" : "DISABLED"} ${profile.sandbox?.logOnly ? "(log-only)" : ""}`);
  console.log(`   Secret Lint: ${profile.secretLint?.enabled ? "ENABLED" : "DISABLED"} ${profile.secretLint?.failOnDetect ? "(fail-on-detect)" : "(warn-only)"}`);
  console.log(`   SBOM: ${profile.sbom?.mode.toUpperCase()} mode ${profile.sbom?.enforceHash ? "(hash-enforced)" : "(hash-relaxed)"}`);
  console.log(`   Governance: ${profile.governance?.enforceLevel.toUpperCase()} ${profile.governance?.deadLockRecovery ? "+ recovery" : ""}`);
  console.log(`   License: ${profile.license?.verify ? "VERIFY" : "SKIP"} ${profile.license?.warnOnly ? "(warn-only)" : "(enforce)"}\n`);

  if (profile.recommended) {
    console.log("💡 Recommended for:");
    for (const item of profile.recommended) {
      console.log(`   - ${item}`);
    }
    console.log();
  }
}

/**
 * Get environment variable commands
 */
function getEnvCommands(profileName: string, profile: SecurityProfile): string[] {
  const commands: string[] = [];

  if (profile.sandbox?.logOnly) {
    commands.push("export SANDBOX_LOG_ONLY=true");
  }

  if (profile.sbom?.mode === "adaptive") {
    commands.push("export SBOM_MODE=adaptive");
  }

  if (profile.governance?.deadLockRecovery) {
    commands.push("export GOVERNANCE_RECOVERY=true");
  }

  commands.push(`export SECURITY_PROFILE=${profileName}`);

  return commands;
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const targetProfile = args[0] || getCurrentEnv();

  console.log(`🔍 Loading security profile: ${targetProfile}\n`);

  const profile = loadProfile(targetProfile);

  if (!profile) {
    console.error(`❌ Profile '${targetProfile}' not found in ${PROFILE_FILE}\n`);
    console.error("Available profiles: dev, staging, prod\n");
    process.exit(1);
  }

  printProfile(targetProfile, profile);

  console.log("📝 Environment Variables:");
  const envCommands = getEnvCommands(targetProfile, profile);
  for (const cmd of envCommands) {
    console.log(`   ${cmd}`);
  }
  console.log();

  console.log("🚀 Usage:");
  console.log(`   # Apply ${targetProfile} profile:`);
  console.log(`   ${envCommands.join(" && ")} && npm run build\n`);
  console.log(`   # Or set NODE_ENV:`);
  console.log(`   NODE_ENV=${targetProfile} npm run build\n`);
}

main();
