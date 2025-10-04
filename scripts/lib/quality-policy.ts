#!/usr/bin/env tsx

/**
 * Quality Policy Manager
 *
 * Purpose:
 * - Load and manage quality-policy.json
 * - Provide centralized quality criteria access
 * - Support both static and dynamic protection
 *
 * Design:
 * - Single source of truth: quality-policy.json
 * - No hardcoded thresholds
 * - Extensible for future criteria
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface QualityPolicy {
  schemaVersion: string;
  citationThresholds: {
    minAlignment: number;
    minCoverage: number;
    maxInvalidRate: number;
    minQualityScore: number;
  };
  agentProtection: {
    static: Array<{
      file: string;
      reason: string;
      severity: string;
      autoRefactor: boolean;
      requireApproval: boolean;
    }>;
    dynamic: {
      enabled: boolean;
      minUsagePercent: number;
      minQualityImpact: number;
      updateFrequency: string;
    };
  };
  refactoringCriteria: {
    fileSize: {
      warnThreshold: number;
      refactorThreshold: number;
      exemptIfQualityEssential: boolean;
    };
    cyclomaticComplexity: {
      warnThreshold: number;
      refactorThreshold: number;
    };
    duplicationPercent: {
      warnThreshold: number;
      refactorThreshold: number;
    };
  };
  plugins?: Record<string, any>;
  guidelines?: any;
  security?: any;
}

export class QualityPolicyManager {
  private policy: QualityPolicy;
  private policyPath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.policyPath = join(projectRoot, "quality-policy.json");
    this.policy = this.loadPolicy();
  }

  private loadPolicy(): QualityPolicy {
    if (!existsSync(this.policyPath)) {
      throw new Error(
        `Quality policy not found: ${this.policyPath}\n` +
          `Run: touch quality-policy.json`,
      );
    }

    try {
      const content = readFileSync(this.policyPath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Failed to parse quality-policy.json: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Check if file is protected (static protection)
   */
  isProtectedFile(filePath: string): boolean {
    const staticProtected = this.policy.agentProtection.static.some((p) =>
      filePath.includes(p.file),
    );

    if (staticProtected) {
      return true;
    }

    // TODO: Dynamic protection (RUN_LOGS based)
    // if (this.policy.agentProtection.dynamic.enabled) {
    //   return this.isDynamicallyProtected(filePath);
    // }

    return false;
  }

  /**
   * Get protection reason
   */
  getProtectionReason(filePath: string): string | null {
    const protection = this.policy.agentProtection.static.find((p) =>
      filePath.includes(p.file),
    );

    return protection ? protection.reason : null;
  }

  /**
   * Check if file requires manual approval for changes
   */
  requiresApproval(filePath: string): boolean {
    const protection = this.policy.agentProtection.static.find((p) =>
      filePath.includes(p.file),
    );

    return protection?.requireApproval ?? false;
  }

  /**
   * Get citation quality thresholds
   */
  getCitationThresholds() {
    return this.policy.citationThresholds;
  }

  /**
   * Get refactoring criteria
   */
  getRefactoringCriteria() {
    return this.policy.refactoringCriteria;
  }

  /**
   * Check if file should be refactored based on metrics
   */
  shouldRefactor(
    filePath: string,
    metrics: {
      lines: number;
      complexity?: number;
      duplication?: number;
    },
  ): boolean {
    // Quality-essential files are exempt
    if (this.isProtectedFile(filePath)) {
      return false;
    }

    const criteria = this.policy.refactoringCriteria;

    // Check file size
    if (metrics.lines > criteria.fileSize.refactorThreshold) {
      return true;
    }

    // Check complexity
    if (
      metrics.complexity &&
      metrics.complexity > criteria.cyclomaticComplexity.refactorThreshold
    ) {
      return true;
    }

    // Check duplication
    if (
      metrics.duplication &&
      metrics.duplication > criteria.duplicationPercent.refactorThreshold
    ) {
      return true;
    }

    return false;
  }

  /**
   * Get policy for plugin
   */
  getPluginConfig(pluginId: string): any {
    return this.policy.plugins?.[pluginId] ?? null;
  }

  /**
   * Check if plugin is enabled
   */
  isPluginEnabled(pluginId: string): boolean {
    return this.policy.plugins?.[pluginId]?.enabled ?? false;
  }

  /**
   * Reload policy (for hot-reload support)
   */
  reload(): void {
    this.policy = this.loadPolicy();
  }

  /**
   * Export full policy
   */
  exportPolicy(): QualityPolicy {
    return this.policy;
  }
}

// Singleton instance
let instance: QualityPolicyManager | null = null;

export function getQualityPolicyManager(
  projectRoot?: string,
): QualityPolicyManager {
  if (!instance) {
    instance = new QualityPolicyManager(projectRoot);
  }
  return instance;
}
