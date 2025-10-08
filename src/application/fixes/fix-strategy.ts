/**
 * Fix Strategy Selector
 *
 * Determines the optimal fix strategy based on:
 * - Issue severity and count
 * - System state
 * - Resource availability
 * - User preferences
 */

import type { Issue } from "../../domain/fixes/fix-command.js";
import type { Logger } from "../../shared/logger.js";

export type FixStrategyType =
  | "aggressive" // Fix everything immediately
  | "conservative" // Fix only safe issues
  | "interactive" // Ask for user approval
  | "staged" // Fix in multiple stages
  | "parallel" // Maximum parallelization
  | "sequential"; // One at a time

export interface StrategyRecommendation {
  /** Recommended strategy */
  strategy: FixStrategyType;

  /** Reason for recommendation */
  reason: string;

  /** Confidence level (0-1) */
  confidence: number;

  /** Risk level */
  riskLevel: "low" | "medium" | "high" | "critical";

  /** Estimated duration in seconds */
  estimatedDuration: number;

  /** Recommended max parallel executions */
  maxParallel: number;

  /** Whether to use transactional mode */
  transactional: boolean;

  /** Whether to create backups */
  createBackups: boolean;

  /** Additional recommendations */
  recommendations: string[];
}

export interface StrategyContext {
  /** Issues to fix */
  issues: Issue[];

  /** Available system resources */
  resources?: {
    cpuUsage?: number;
    memoryUsage?: number;
    diskSpace?: number;
  };

  /** User preferences */
  preferences?: {
    riskTolerance?: "low" | "medium" | "high";
    speed?: "fast" | "balanced" | "safe";
    interactive?: boolean;
  };

  /** Time constraints */
  timeConstraints?: {
    maxDuration?: number; // Maximum allowed duration in seconds
    urgency?: "low" | "medium" | "high";
  };
}

/**
 * Fix Strategy Selector
 *
 * Analyzes issues and context to recommend the optimal fix strategy
 */
export class FixStrategySelector {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Recommend a fix strategy based on context
   */
  recommend(context: StrategyContext): StrategyRecommendation {
    this.logger.info("Analyzing fix strategy", {
      issueCount: context.issues.length,
    });

    // Analyze issues
    const analysis = this.analyzeIssues(context.issues);

    // Consider user preferences
    const preferences = context.preferences ?? {};
    const riskTolerance = preferences.riskTolerance ?? "medium";
    const speed = preferences.speed ?? "balanced";
    const interactive = preferences.interactive ?? false;

    // Determine strategy
    let strategy: FixStrategyType;
    let reason: string;
    let confidence = 0.8;

    // Critical issues require immediate attention
    if (analysis.criticalCount > 0) {
      if (riskTolerance === "low" || interactive) {
        strategy = "interactive";
        reason = "Critical issues detected - user approval recommended";
        confidence = 0.9;
      } else {
        strategy = "conservative";
        reason = "Critical issues detected - using conservative approach";
        confidence = 0.85;
      }
    }
    // High risk requires caution
    else if (
      analysis.riskLevel === "high" ||
      analysis.riskLevel === "critical"
    ) {
      if (interactive) {
        strategy = "interactive";
        reason = "High risk detected - requesting user approval";
      } else if (riskTolerance === "high") {
        strategy = "staged";
        reason = "High risk but high tolerance - using staged approach";
      } else {
        strategy = "conservative";
        reason = "High risk - using conservative approach";
      }
    }
    // Many issues might benefit from parallelization
    else if (analysis.totalCount > 50 && speed === "fast") {
      strategy = "parallel";
      reason = "Many issues detected - using parallel execution for speed";
      confidence = 0.75;
    }
    // Staged approach for medium complexity
    else if (analysis.totalCount > 20) {
      strategy = "staged";
      reason = "Medium complexity - using staged approach";
      confidence = 0.8;
    }
    // Conservative for unknown or risky situations
    else if (riskTolerance === "low" || analysis.unknownCount > 0) {
      strategy = "conservative";
      reason = "Low risk tolerance - using conservative approach";
      confidence = 0.85;
    }
    // Aggressive for simple cases
    else {
      strategy = "aggressive";
      reason = "Low risk and complexity - using aggressive approach";
      confidence = 0.9;
    }

    // Determine parameters based on strategy
    const params = this.getStrategyParameters(strategy, analysis);

    return {
      strategy,
      reason,
      confidence,
      riskLevel: analysis.riskLevel,
      estimatedDuration: this.estimateDuration(analysis, strategy),
      maxParallel: params.maxParallel,
      transactional: params.transactional,
      createBackups: params.createBackups,
      recommendations: this.generateRecommendations(strategy, analysis),
    };
  }

  /**
   * Analyze issues to understand their characteristics
   */
  private analyzeIssues(issues: Issue[]): {
    totalCount: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    autoFixableCount: number;
    unknownCount: number;
    riskLevel: "low" | "medium" | "high" | "critical";
    categories: Map<string, number>;
  } {
    const categories = new Map<string, number>();
    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let autoFixableCount = 0;
    let unknownCount = 0;

    for (const issue of issues) {
      // Count by severity
      switch (issue.severity) {
        case "critical":
          criticalCount++;
          break;
        case "high":
          highCount++;
          break;
        case "medium":
          mediumCount++;
          break;
        case "low":
          lowCount++;
          break;
      }

      // Count auto-fixable
      if (issue.autoFixable) {
        autoFixableCount++;
      }

      // Count by category
      const count = categories.get(issue.category) ?? 0;
      categories.set(issue.category, count + 1);

      // Count unknown categories
      if (
        ![
          "typescript",
          "eslint",
          "import",
          "workaround",
          "documentation",
        ].includes(issue.category)
      ) {
        unknownCount++;
      }
    }

    // Determine overall risk level
    let riskLevel: "low" | "medium" | "high" | "critical";
    if (criticalCount > 0) {
      riskLevel = "critical";
    } else if (highCount > 10 || unknownCount > 5) {
      riskLevel = "high";
    } else if (highCount > 0 || mediumCount > 20) {
      riskLevel = "medium";
    } else {
      riskLevel = "low";
    }

    return {
      totalCount: issues.length,
      criticalCount,
      highCount,
      mediumCount,
      lowCount,
      autoFixableCount,
      unknownCount,
      riskLevel,
      categories,
    };
  }

  /**
   * Get strategy parameters
   */
  private getStrategyParameters(
    strategy: FixStrategyType,
    analysis: ReturnType<typeof this.analyzeIssues>,
  ): {
    maxParallel: number;
    transactional: boolean;
    createBackups: boolean;
  } {
    switch (strategy) {
      case "aggressive":
        return {
          maxParallel: 10,
          transactional: false,
          createBackups: false,
        };

      case "conservative":
        return {
          maxParallel: 1,
          transactional: true,
          createBackups: true,
        };

      case "interactive":
        return {
          maxParallel: 1,
          transactional: true,
          createBackups: true,
        };

      case "staged":
        return {
          maxParallel: 3,
          transactional: true,
          createBackups: true,
        };

      case "parallel":
        return {
          maxParallel: Math.min(10, Math.ceil(analysis.totalCount / 5)),
          transactional: false,
          createBackups: false,
        };

      case "sequential":
        return {
          maxParallel: 1,
          transactional: true,
          createBackups: true,
        };

      default:
        return {
          maxParallel: 1,
          transactional: true,
          createBackups: true,
        };
    }
  }

  /**
   * Estimate duration based on strategy and analysis
   */
  private estimateDuration(
    analysis: ReturnType<typeof this.analyzeIssues>,
    strategy: FixStrategyType,
  ): number {
    // Base time: 2 seconds per issue
    let baseTime = analysis.totalCount * 2;

    // Adjust based on strategy
    switch (strategy) {
      case "aggressive":
        baseTime *= 0.5; // Faster with less safety checks
        break;

      case "conservative":
        baseTime *= 2; // Slower with more safety checks
        break;

      case "interactive":
        baseTime *= 3; // Much slower due to user interaction
        break;

      case "staged":
        baseTime *= 1.5; // Moderate overhead for staging
        break;

      case "parallel":
        baseTime *= 0.3; // Much faster with parallelization
        break;

      case "sequential":
        baseTime *= 1.2; // Slight overhead for sequential processing
        break;
    }

    return Math.ceil(baseTime);
  }

  /**
   * Generate recommendations based on strategy and analysis
   */
  private generateRecommendations(
    strategy: FixStrategyType,
    analysis: ReturnType<typeof this.analyzeIssues>,
  ): string[] {
    const recommendations: string[] = [];

    // General recommendations
    if (analysis.criticalCount > 0) {
      recommendations.push(
        `${analysis.criticalCount} critical issues require immediate attention`,
      );
    }

    if (analysis.unknownCount > 0) {
      recommendations.push(
        `${analysis.unknownCount} issues have unknown categories - manual review recommended`,
      );
    }

    if (analysis.autoFixableCount < analysis.totalCount / 2) {
      recommendations.push(
        "Many issues cannot be auto-fixed - manual intervention may be required",
      );
    }

    // Strategy-specific recommendations
    switch (strategy) {
      case "aggressive":
        recommendations.push(
          "Aggressive mode: verify results after completion",
        );
        recommendations.push("Consider running tests immediately after fixes");
        break;

      case "conservative":
        recommendations.push(
          "Conservative mode: each fix is verified before proceeding",
        );
        recommendations.push("This may take longer but is safer");
        break;

      case "interactive":
        recommendations.push(
          "Interactive mode: you will be prompted for approval",
        );
        recommendations.push("Prepare to review each fix carefully");
        break;

      case "staged":
        recommendations.push(
          "Staged mode: fixes will be applied in multiple phases",
        );
        recommendations.push("You can stop between stages if needed");
        break;

      case "parallel":
        recommendations.push(
          "Parallel mode: multiple fixes will run simultaneously",
        );
        recommendations.push("Monitor system resources during execution");
        break;

      case "sequential":
        recommendations.push(
          "Sequential mode: fixes will be applied one at a time",
        );
        recommendations.push("This is the safest but slowest option");
        break;
    }

    // Resource recommendations
    if (analysis.totalCount > 100) {
      recommendations.push(
        "Large number of issues - ensure adequate system resources",
      );
    }

    return recommendations;
  }
}
