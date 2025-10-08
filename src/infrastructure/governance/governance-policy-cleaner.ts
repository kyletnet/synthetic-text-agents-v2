/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Governance Policy Cleaner
 *
 * Automatically purges old/stale external policies to prevent governance noise.
 *
 * Rules:
 * - External policies older than 90 days → auto-purge
 * - Core policies (priority 1-20) → never purge
 * - Experimental policies → 30 days grace period
 *
 * Phase 2B → 2C Transition: Robustness Patch
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { GovernancePolicies } from "../../core/governance/kernel.js";

/**
 * Policy Age Configuration
 */
export interface PolicyAgeConfig {
  external_policy_max_age_days: number; // Default: 90 days
  experimental_policy_max_age_days: number; // Default: 30 days
  core_policy_never_purge: boolean; // Default: true
  auto_purge_enabled: boolean; // Default: true
  dry_run: boolean; // Default: false (actually purge)
}

/**
 * Purge Result
 */
export interface PurgeResult {
  purged_count: number;
  kept_count: number;
  purged_policies: string[];
  timestamp: Date;
  dry_run: boolean;
}

/**
 * Policy Metadata (for age tracking)
 */
export interface PolicyMetadata {
  name: string;
  created_at: string; // ISO timestamp
  priority: number;
  type: "core" | "external" | "experimental";
}

/**
 * Governance Policy Cleaner
 *
 * Removes stale external policies to keep governance clean.
 */
export class GovernancePolicyCleaner {
  private config: PolicyAgeConfig;
  private projectRoot: string;
  private policyPath: string;

  constructor(projectRoot?: string, config: Partial<PolicyAgeConfig> = {}) {
    this.projectRoot = projectRoot || process.cwd();
    this.policyPath = join(this.projectRoot, "governance-rules.json");

    this.config = {
      external_policy_max_age_days: config.external_policy_max_age_days ?? 90,
      experimental_policy_max_age_days:
        config.experimental_policy_max_age_days ?? 30,
      core_policy_never_purge: config.core_policy_never_purge ?? true,
      auto_purge_enabled: config.auto_purge_enabled ?? true,
      dry_run: config.dry_run ?? false,
    };
  }

  /**
   * Purge stale policies
   *
   * Returns list of purged policies.
   */
  async purge(): Promise<PurgeResult> {
    if (!this.config.auto_purge_enabled) {
      console.log("[Policy Cleaner] Auto-purge disabled");
      return {
        purged_count: 0,
        kept_count: 0,
        purged_policies: [],
        timestamp: new Date(),
        dry_run: this.config.dry_run,
      };
    }

    if (!existsSync(this.policyPath)) {
      console.log("[Policy Cleaner] No governance-rules.json found");
      return {
        purged_count: 0,
        kept_count: 0,
        purged_policies: [],
        timestamp: new Date(),
        dry_run: this.config.dry_run,
      };
    }

    // Load current policies
    const content = readFileSync(this.policyPath, "utf8");
    const policies: GovernancePolicies = JSON.parse(content);

    const now = new Date();
    const purgedPolicies: string[] = [];
    const keptPolicies: typeof policies.policies = [];

    // Classify and purge policies
    for (const policy of policies.policies) {
      const metadata = this.getPolicyMetadata(policy.name);

      if (!metadata) {
        // No metadata → keep (assume core policy)
        keptPolicies.push(policy);
        continue;
      }

      const age = this.calculateAgeDays(metadata.created_at, now);
      const shouldPurge = this.shouldPurgePolicy(metadata, age);

      if (shouldPurge) {
        purgedPolicies.push(policy.name);
        console.log(
          `[Policy Cleaner] Purging policy: ${policy.name} (age: ${age} days)`,
        );
      } else {
        keptPolicies.push(policy);
      }
    }

    // Update policies (if not dry run)
    if (!this.config.dry_run && purgedPolicies.length > 0) {
      policies.policies = keptPolicies;
      writeFileSync(this.policyPath, JSON.stringify(policies, null, 2));
      console.log(`[Policy Cleaner] Purged ${purgedPolicies.length} policies`);
    } else if (this.config.dry_run) {
      console.log(
        `[Policy Cleaner] DRY RUN - would purge ${purgedPolicies.length} policies`,
      );
    }

    return {
      purged_count: purgedPolicies.length,
      kept_count: keptPolicies.length,
      purged_policies: purgedPolicies,
      timestamp: now,
      dry_run: this.config.dry_run,
    };
  }

  /**
   * Should purge policy based on age and type
   */
  private shouldPurgePolicy(
    metadata: PolicyMetadata,
    ageDays: number,
  ): boolean {
    // Core policies never purge
    if (this.config.core_policy_never_purge && metadata.type === "core") {
      return false;
    }

    // Core policies (priority 1-20) never purge
    if (this.config.core_policy_never_purge && metadata.priority <= 20) {
      return false;
    }

    // Experimental policies: 30 days
    if (
      metadata.type === "experimental" &&
      ageDays > this.config.experimental_policy_max_age_days
    ) {
      return true;
    }

    // External policies: 90 days
    if (
      metadata.type === "external" &&
      ageDays > this.config.external_policy_max_age_days
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get policy metadata (from governance ledger or policy name)
   */
  private getPolicyMetadata(policyName: string): PolicyMetadata | null {
    // Try to load from metadata file
    const metadataPath = join(
      this.projectRoot,
      "reports",
      "governance",
      "policy-metadata.json",
    );

    if (existsSync(metadataPath)) {
      const content = readFileSync(metadataPath, "utf8");
      const metadata: Record<string, PolicyMetadata> = JSON.parse(content);

      if (metadata[policyName]) {
        return metadata[policyName];
      }
    }

    // Fallback: Infer from policy name
    return this.inferMetadataFromName(policyName);
  }

  /**
   * Infer metadata from policy name
   */
  private inferMetadataFromName(policyName: string): PolicyMetadata | null {
    // Check if policy is core (common core policy names)
    const corePolicies = [
      "no-circular-dependencies",
      "ddd-boundary-enforcement",
      "threshold-drift-detection",
      "pii-protection",
      "license-compliance",
    ];

    if (corePolicies.includes(policyName)) {
      return {
        name: policyName,
        created_at: "2025-01-01T00:00:00Z", // Assume old core policies
        priority: 1,
        type: "core",
      };
    }

    // Check if policy is external (starts with "external-" or "rfc-")
    if (policyName.startsWith("external-") || policyName.startsWith("rfc-")) {
      return {
        name: policyName,
        created_at: new Date().toISOString(), // Assume recent
        priority: 60,
        type: "external",
      };
    }

    // Check if policy is experimental (starts with "experiment-")
    if (policyName.startsWith("experiment-")) {
      return {
        name: policyName,
        created_at: new Date().toISOString(),
        priority: 80,
        type: "experimental",
      };
    }

    // Unknown → treat as external (safest)
    return {
      name: policyName,
      created_at: new Date().toISOString(),
      priority: 60,
      type: "external",
    };
  }

  /**
   * Calculate age in days
   */
  private calculateAgeDays(createdAt: string, now: Date): number {
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Get configuration
   */
  getConfig(): PolicyAgeConfig {
    return this.config;
  }
}

/**
 * Run policy cleaner (CLI entry point)
 */
export async function runPolicyCleaner(options?: {
  projectRoot?: string;
  dryRun?: boolean;
}): Promise<PurgeResult> {
  const cleaner = new GovernancePolicyCleaner(options?.projectRoot, {
    dry_run: options?.dryRun ?? false,
  });

  const result = await cleaner.purge();

  if (result.dry_run) {
    console.log("\n[Policy Cleaner] DRY RUN SUMMARY:");
  } else {
    console.log("\n[Policy Cleaner] PURGE SUMMARY:");
  }

  console.log(`  Purged: ${result.purged_count}`);
  console.log(`  Kept: ${result.kept_count}`);
  console.log(`  Timestamp: ${result.timestamp.toISOString()}`);

  if (result.purged_policies.length > 0) {
    console.log(`\n  Purged policies:`);
    for (const policy of result.purged_policies) {
      console.log(`    - ${policy}`);
    }
  }

  return result;
}
