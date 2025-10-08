/**
 * Domain: Gap Analyzer
 *
 * High-level gap analysis orchestration.
 * Coordinates multiple gap detectors and applies business rules.
 */

import type {
  Gap,
  GapCheckConfig,
  GapCheckDetector,
  GapDetectionContext,
  GapSummary,
} from "./gap-types.js";
import { GapDetectionRules } from "./gap-detector.js";

// ============================================================================
// Gap Analyzer
// ============================================================================

export class GapAnalyzer {
  private detectors: Map<string, GapCheckDetector> = new Map();

  /**
   * Register a gap detector for a specific check
   */
  registerDetector(checkId: string, detector: GapCheckDetector): void {
    this.detectors.set(checkId, detector);
  }

  /**
   * Run a single gap check
   */
  async runCheck(check: GapCheckConfig): Promise<readonly Gap[]> {
    const detector = this.detectors.get(check.id);
    if (!detector) {
      throw new Error(`No detector registered for check: ${check.id}`);
    }

    const context: GapDetectionContext = {
      checkId: check.id,
      severity: check.severity,
      category: check.category,
      config: check.config,
      autoFixable: check.autoFixable,
    };

    return detector.detect(context);
  }

  /**
   * Run multiple gap checks
   */
  async runChecks(checks: readonly GapCheckConfig[]): Promise<readonly Gap[]> {
    const allGaps: Gap[] = [];

    for (const check of checks) {
      try {
        const gaps = await this.runCheck(check);
        allGaps.push(...gaps);
      } catch (error) {
        console.error(
          `Check failed: ${check.id} - ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
      }
    }

    return allGaps;
  }

  /**
   * Calculate summary statistics for gaps
   */
  calculateSummary(gaps: readonly Gap[]): GapSummary {
    return GapDetectionRules.calculateSummary(gaps);
  }

  /**
   * Filter gaps that should cause failure
   */
  getFailingGaps(
    gaps: readonly Gap[],
    failOn: readonly Gap["severity"][],
  ): readonly Gap[] {
    return gaps.filter((gap) => GapDetectionRules.shouldFailOnGap(gap, failOn));
  }

  /**
   * Filter gaps eligible for auto-fixing
   */
  getAutoFixableGaps(
    gaps: readonly Gap[],
    maxSeverity: Gap["severity"],
  ): readonly Gap[] {
    return gaps.filter((gap) => GapDetectionRules.canAutoFix(gap, maxSeverity));
  }

  /**
   * Group gaps by severity
   */
  groupBySeverity(gaps: readonly Gap[]): Record<string, readonly Gap[]> {
    return {
      P0: GapDetectionRules.filterBySeverity(gaps, "P0"),
      P1: GapDetectionRules.filterBySeverity(gaps, "P1"),
      P2: GapDetectionRules.filterBySeverity(gaps, "P2"),
    };
  }

  /**
   * Group gaps by category
   */
  groupByCategory(gaps: readonly Gap[]): Record<string, readonly Gap[]> {
    const result: Record<string, Gap[]> = {};

    for (const gap of gaps) {
      if (!result[gap.category]) {
        result[gap.category] = [];
      }
      result[gap.category].push(gap);
    }

    return result;
  }
}

// ============================================================================
// Gap Auto-Fixer
// ============================================================================

export class GapAutoFixer {
  /**
   * Execute auto-fixes for eligible gaps
   */
  async autoFix(
    gaps: readonly Gap[],
    maxSeverity: Gap["severity"],
  ): Promise<{
    fixed: readonly Gap[];
    failed: readonly Gap[];
  }> {
    const eligible = gaps.filter((gap) =>
      GapDetectionRules.canAutoFix(gap, maxSeverity),
    );

    const fixed: Gap[] = [];
    const failed: Gap[] = [];

    for (const gap of eligible) {
      try {
        if (gap.fix) {
          await gap.fix.execute();
          fixed.push(gap);
        }
      } catch (error) {
        console.error(
          `Auto-fix failed for ${gap.id}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        );
        failed.push(gap);
      }
    }

    return { fixed, failed };
  }

  /**
   * Get auto-fix summary
   */
  getAutoFixSummary(
    gaps: readonly Gap[],
    maxSeverity: Gap["severity"],
  ): {
    totalEligible: number;
    byCheck: Record<string, number>;
  } {
    const eligible = gaps.filter((gap) =>
      GapDetectionRules.canAutoFix(gap, maxSeverity),
    );

    const byCheck: Record<string, number> = {};
    for (const gap of eligible) {
      byCheck[gap.checkId] = (byCheck[gap.checkId] || 0) + 1;
    }

    return {
      totalEligible: eligible.length,
      byCheck,
    };
  }
}
