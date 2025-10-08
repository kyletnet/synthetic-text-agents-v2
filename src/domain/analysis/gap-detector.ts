/**
 * Domain: Gap Detector
 *
 * Core gap detection rules and business logic.
 * This file contains the pure business rules for detecting gaps.
 */

import type {
  Gap,
  GapCheckConfig,
  GapCheckDetector,
  GapDetectionContext,
  GapSeverity,
} from "./gap-types.js";

// ============================================================================
// Base Gap Detector
// ============================================================================

export abstract class BaseGapDetector implements GapCheckDetector {
  constructor(public readonly checkId: string) {}

  abstract detect(context: GapDetectionContext): Promise<readonly Gap[]>;

  protected createGap(
    context: GapDetectionContext,
    params: {
      id: string;
      title: string;
      description: string;
      details?: Record<string, unknown>;
      fix?: () => Promise<void>;
    },
  ): Gap {
    return {
      id: params.id,
      checkId: context.checkId,
      severity: context.severity,
      category: context.category,
      title: params.title,
      description: params.description,
      autoFixable: context.autoFixable,
      details: params.details,
      fix: params.fix
        ? {
            strategy: "auto",
            requiresApproval: false,
            execute: params.fix,
          }
        : undefined,
    };
  }
}

// ============================================================================
// Gap Detection Rules
// ============================================================================

export class GapDetectionRules {
  /**
   * Determines if a gap should cause the scan to fail
   */
  static shouldFailOnGap(gap: Gap, failOn: readonly GapSeverity[]): boolean {
    return failOn.includes(gap.severity);
  }

  /**
   * Determines if a gap is eligible for auto-fixing
   */
  static canAutoFix(gap: Gap, maxSeverity: GapSeverity): boolean {
    if (!gap.autoFixable || !gap.fix) return false;

    // Only fix P2 (never P0/P1)
    return (
      gap.severity === "P2" &&
      this.compareSeverity(gap.severity, maxSeverity) <= 0
    );
  }

  /**
   * Compares two severities
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
   */
  private static compareSeverity(a: GapSeverity, b: GapSeverity): number {
    const order: Record<GapSeverity, number> = { P0: 0, P1: 1, P2: 2 };
    return order[a] - order[b];
  }

  /**
   * Filters gaps by severity
   */
  static filterBySeverity(
    gaps: readonly Gap[],
    severity: GapSeverity,
  ): readonly Gap[] {
    return gaps.filter((gap) => gap.severity === severity);
  }

  /**
   * Filters gaps by category
   */
  static filterByCategory(
    gaps: readonly Gap[],
    category: string,
  ): readonly Gap[] {
    return gaps.filter((gap) => gap.category === category);
  }

  /**
   * Calculates gap summary statistics
   */
  static calculateSummary(gaps: readonly Gap[]): {
    P0: number;
    P1: number;
    P2: number;
    total: number;
  } {
    return {
      P0: gaps.filter((g) => g.severity === "P0").length,
      P1: gaps.filter((g) => g.severity === "P1").length,
      P2: gaps.filter((g) => g.severity === "P2").length,
      total: gaps.length,
    };
  }
}

// ============================================================================
// Configuration Resolution Rules
// ============================================================================

export class ConfigurationResolver {
  /**
   * Resolves effective configuration based on hierarchy:
   * ENV > Team > Global
   */
  static resolveMode(
    globalMode: string,
    teamMode: string | undefined,
    envMode: string | undefined,
    ci: boolean,
  ): "disabled" | "shadow" | "enforce" {
    // ENV override (highest priority)
    if (envMode) {
      return envMode as "disabled" | "shadow" | "enforce";
    }

    // Team override
    if (teamMode) {
      return teamMode as "disabled" | "shadow" | "enforce";
    }

    // CI always uses shadow (unless explicitly enforce)
    if (ci && globalMode !== "enforce") {
      return "shadow";
    }

    return globalMode as "disabled" | "shadow" | "enforce";
  }

  /**
   * Resolves failOn settings
   */
  static resolveFailOn(
    globalFailOn: readonly GapSeverity[],
    teamFailOn: readonly GapSeverity[] | undefined,
  ): readonly GapSeverity[] {
    return teamFailOn || globalFailOn;
  }

  /**
   * Filters enabled checks from configuration
   */
  static getEnabledChecks(
    checks: readonly GapCheckConfig[],
  ): readonly GapCheckConfig[] {
    return checks.filter((check) => check.enabled);
  }

  /**
   * Finds user's team configuration
   */
  static findUserTeam(
    teams: Record<string, { members?: readonly string[] }>,
    user: string,
  ): string | undefined {
    for (const [teamName, teamConfig] of Object.entries(teams)) {
      if (teamConfig.members?.includes(user)) {
        return teamName;
      }
    }
    return undefined;
  }
}

// ============================================================================
// Grace Period Rules
// ============================================================================

export class GracePeriodRules {
  /**
   * Calculates days since a given date
   */
  static daysSince(date: Date): number {
    return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * Checks if within grace period
   */
  static isInGracePeriod(date: Date, gracePeriodDays: number): boolean {
    return this.daysSince(date) < gracePeriodDays;
  }

  /**
   * Calculates remaining grace period days
   */
  static remainingGracePeriodDays(date: Date, gracePeriodDays: number): number {
    return Math.max(0, gracePeriodDays - this.daysSince(date));
  }

  /**
   * Determines severity based on grace period
   */
  static determineSeverity(
    date: Date,
    gracePeriodDays: number,
    baseSeverity: GapSeverity,
  ): GapSeverity {
    return this.isInGracePeriod(date, gracePeriodDays) ? "P2" : baseSeverity;
  }
}

// ============================================================================
// Document Lifecycle Rules
// ============================================================================

export class DocumentLifecycleRules {
  /**
   * Validates document has required frontmatter
   */
  static hasFrontmatter(content: string): boolean {
    return /^---\n[\s\S]*?\n---/.test(content);
  }

  /**
   * Extracts frontmatter from document
   */
  static extractFrontmatter(
    content: string,
  ): { deprecatedDate?: Date; replacedBy?: string } | null {
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const deprecatedDateMatch = frontmatterMatch[1].match(
      /deprecatedDate:\s*(\d{4}-\d{2}-\d{2})/,
    );
    const replacedByMatch = frontmatterMatch[1].match(/replacedBy:\s*(.+)/);

    return {
      deprecatedDate: deprecatedDateMatch
        ? new Date(deprecatedDateMatch[1])
        : undefined,
      replacedBy: replacedByMatch ? replacedByMatch[1].trim() : undefined,
    };
  }

  /**
   * Checks if deprecated document is too old
   */
  static isTooOld(deprecatedDate: Date, maxAge: number): boolean {
    const ageInDays = Math.floor(
      (Date.now() - deprecatedDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    return ageInDays > maxAge;
  }

  /**
   * Validates replacement is specified
   */
  static hasReplacement(frontmatter: { replacedBy?: string }): boolean {
    return Boolean(frontmatter.replacedBy);
  }
}
