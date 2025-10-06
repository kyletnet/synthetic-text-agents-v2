#!/usr/bin/env tsx

/**
 * Smart Decision Matrix
 * Intelligent balancing of Performance, Safety, and Usability trade-offs
 * Implements adaptive execution strategies based on context and priorities
 */

import { performance } from "perf_hooks";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";

export interface OperationProfile {
  name: string;
  type:
    | "typecheck"
    | "lint"
    | "test"
    | "audit"
    | "evolution"
    | "build"
    | "analysis";

  // Performance characteristics (1-5 scale, 5 = best performance)
  performance: {
    speed: number; // How fast it executes
    resources: number; // How efficient with resources
    scalability: number; // How well it scales with size
  };

  // Safety characteristics (1-5 scale, 5 = safest)
  safety: {
    reliability: number; // How often it succeeds
    reversible: number; // How easy to undo changes
    riskLevel: number; // How dangerous if it fails
  };

  // Usability characteristics (1-5 scale, 5 = most user-friendly)
  usability: {
    clarity: number; // How clear the output is
    automation: number; // How much manual intervention needed
    feedback: number; // How good the progress indication is
  };
}

export interface ExecutionContext {
  priority: "P0" | "P1" | "P2";
  userPresent: boolean;
  systemLoad: "low" | "medium" | "high";
  timeConstraints: "none" | "moderate" | "strict";
  errorTolerance: "zero" | "low" | "medium" | "high";
  automationLevel: "manual" | "supervised" | "autonomous";
}

export interface ApprovalScore {
  totalScore: number; // 0-100, higher = more likely to approve
  subScores: {
    safety: number; // 0-100
    complexity: number; // 0-100
    impact: number; // 0-100
    reversibility: number; // 0-100
  };
  recommendation:
    | "auto-approve"
    | "request-approval"
    | "require-review"
    | "reject";
  confidence: number; // 0-1
  reasoning: string[];
}

export interface DecisionResult {
  execution:
    | "immediate"
    | "optimized"
    | "safe-mode"
    | "user-guided"
    | "deferred";
  configuration: {
    timeoutMs: number;
    retries: number;
    parallelism: number;
    validation: "strict" | "moderate" | "minimal";
    userInteraction: "none" | "progress" | "approval" | "full-control";
  };
  reasoning: string;
  tradeoffs: {
    performance: number; // Weight given to performance (0-1)
    safety: number; // Weight given to safety (0-1)
    usability: number; // Weight given to usability (0-1)
  };
  expectedOutcome: {
    duration: number; // Expected duration in ms
    successProbability: number; // 0-1
    userSatisfaction: number; // 0-1
  };
  approval?: ApprovalScore; // Score-based approval analysis
}

export class SmartDecisionMatrix {
  private operationProfiles: Map<string, OperationProfile> = new Map();
  private decisionHistory: Array<{
    operation: string;
    context: ExecutionContext;
    decision: DecisionResult;
    actualOutcome?: {
      duration: number;
      success: boolean;
      userFeedback?: number;
    };
    timestamp: Date;
  }> = [];
  private strategyMatrix: any = null;
  private strategyMatrixPath: string;

  constructor() {
    this.strategyMatrixPath = join(process.cwd(), ".strategy-matrix.yaml");
    this.loadStrategyMatrix();
    this.initializeOperationProfiles();
  }

  /**
   * Load strategy matrix from YAML file
   */
  private loadStrategyMatrix(): void {
    try {
      if (existsSync(this.strategyMatrixPath)) {
        const yamlContent = readFileSync(this.strategyMatrixPath, "utf8");
        this.strategyMatrix = yaml.parse(yamlContent);
        console.log(
          `📋 Strategy Matrix loaded: ${
            this.strategyMatrix?.version || "unknown"
          }`,
        );
      } else {
        console.warn("⚠️ Strategy matrix file not found, using defaults");
      }
    } catch (error) {
      console.warn("⚠️ Failed to load strategy matrix:", error);
    }
  }

  /**
   * Get strategy configuration for an operation
   */
  private getStrategyConfig(operation: string): any {
    if (!this.strategyMatrix?.strategies) return null;
    return (
      this.strategyMatrix.strategies[operation] ||
      this.strategyMatrix.strategies.maintenance_orchestration
    );
  }

  /**
   * Get execution strategy based on context
   */
  private getExecutionStrategy(context: ExecutionContext): any {
    if (!this.strategyMatrix?.execution_strategies) return null;

    const strategies = this.strategyMatrix.execution_strategies;

    // Apply context-based selection logic
    if (context.priority === "P0" && strategies.immediate) {
      return strategies.immediate;
    } else if (context.priority === "P1" && strategies.optimized) {
      return strategies.optimized;
    } else if (context.priority === "P2" && strategies.coordinated) {
      return strategies.coordinated;
    }

    return strategies.optimized; // Default
  }

  private initializeOperationProfiles(): void {
    // TypeScript checking - High safety, moderate performance
    this.operationProfiles.set("typecheck", {
      name: "TypeScript Type Checking",
      type: "typecheck",
      performance: { speed: 2, resources: 3, scalability: 2 },
      safety: { reliability: 5, reversible: 5, riskLevel: 5 },
      usability: { clarity: 4, automation: 5, feedback: 3 },
    });

    // Linting - Good performance, medium safety
    this.operationProfiles.set("lint", {
      name: "Code Linting",
      type: "lint",
      performance: { speed: 4, resources: 4, scalability: 4 },
      safety: { reliability: 4, reversible: 3, riskLevel: 4 },
      usability: { clarity: 5, automation: 4, feedback: 4 },
    });

    // Testing - Balanced across all dimensions
    this.operationProfiles.set("test", {
      name: "Test Execution",
      type: "test",
      performance: { speed: 3, resources: 3, scalability: 3 },
      safety: { reliability: 4, reversible: 5, riskLevel: 4 },
      usability: { clarity: 4, automation: 4, feedback: 5 },
    });

    // Security audit - High safety, lower performance
    this.operationProfiles.set("audit", {
      name: "Security Audit",
      type: "audit",
      performance: { speed: 2, resources: 2, scalability: 2 },
      safety: { reliability: 5, reversible: 5, riskLevel: 5 },
      usability: { clarity: 3, automation: 3, feedback: 2 },
    });

    // System evolution - Low safety, requires care
    this.operationProfiles.set("evolution", {
      name: "System Evolution",
      type: "evolution",
      performance: { speed: 1, resources: 2, scalability: 1 },
      safety: { reliability: 2, reversible: 1, riskLevel: 1 },
      usability: { clarity: 2, automation: 1, feedback: 3 },
    });

    // Build operations - Good performance, reliable
    this.operationProfiles.set("build", {
      name: "Build Process",
      type: "build",
      performance: { speed: 3, resources: 3, scalability: 4 },
      safety: { reliability: 4, reversible: 4, riskLevel: 4 },
      usability: { clarity: 4, automation: 5, feedback: 4 },
    });

    // Analysis operations - Balanced
    this.operationProfiles.set("analysis", {
      name: "System Analysis",
      type: "analysis",
      performance: { speed: 3, resources: 4, scalability: 3 },
      safety: { reliability: 5, reversible: 5, riskLevel: 5 },
      usability: { clarity: 3, automation: 4, feedback: 3 },
    });
  }

  /**
   * Main decision-making method
   */
  async makeDecision(
    operationName: string,
    context: ExecutionContext,
  ): Promise<DecisionResult> {
    const profile = this.operationProfiles.get(operationName);
    if (!profile) {
      throw new Error(`Unknown operation profile: ${operationName}`);
    }

    // Calculate context-based weights
    const weights = this.calculateContextWeights(context);

    // Score different execution strategies
    const strategies = this.generateExecutionStrategies(profile, context);
    const scoredStrategies = strategies.map((strategy) => ({
      ...strategy,
      score: this.scoreStrategy(strategy, profile, weights),
    }));

    // Select best strategy
    const bestStrategy = scoredStrategies.reduce((best, current) =>
      current.score > best.score ? current : best,
    );

    const decision: DecisionResult = {
      execution: bestStrategy.execution,
      configuration: bestStrategy.configuration,
      reasoning: this.generateReasoning(
        bestStrategy,
        profile,
        context,
        weights,
      ),
      tradeoffs: weights,
      expectedOutcome: this.predictOutcome(bestStrategy, profile, context),
    };

    // Record decision for learning
    this.decisionHistory.push({
      operation: operationName,
      context,
      decision,
      timestamp: new Date(),
    });

    return decision;
  }

  /**
   * Record actual execution outcome for learning
   */
  recordOutcome(
    operationName: string,
    outcome: {
      duration: number;
      success: boolean;
      userFeedback?: number;
    },
  ): void {
    // Find the most recent decision for this operation
    const recentDecision = this.decisionHistory
      .slice()
      .reverse()
      .find(
        (entry) => entry.operation === operationName && !entry.actualOutcome,
      );

    if (recentDecision) {
      const decisionWithOutcome = {
        ...recentDecision,
        actualOutcome: outcome,
      };
      this.learnFromOutcome(decisionWithOutcome);
    }
  }

  /**
   * Get recommendations for improving system balance
   */
  getOptimizationRecommendations(): Array<{
    area: "performance" | "safety" | "usability";
    issue: string;
    recommendation: string;
    impact: "high" | "medium" | "low";
  }> {
    const recommendations = [];

    // Analyze recent decisions
    const recentDecisions = this.decisionHistory.slice(-20);

    // Check for performance issues
    const slowOperations = recentDecisions.filter(
      (d) =>
        d.actualOutcome &&
        d.actualOutcome.duration > d.decision.expectedOutcome.duration * 1.5,
    );

    if (slowOperations.length > 3) {
      recommendations.push({
        area: "performance" as const,
        issue: "Operations consistently taking longer than expected",
        recommendation:
          "Consider implementing parallel execution and better caching",
        impact: "high" as const,
      });
    }

    // Check for safety issues
    const failedOperations = recentDecisions.filter(
      (d) => d.actualOutcome && !d.actualOutcome.success,
    );

    if (failedOperations.length > 2) {
      recommendations.push({
        area: "safety" as const,
        issue: "Higher than expected failure rate",
        recommendation:
          "Increase validation steps and implement better error recovery",
        impact: "high" as const,
      });
    }

    // Check for usability issues
    const lowSatisfactionOperations = recentDecisions.filter(
      (d) => d.actualOutcome?.userFeedback && d.actualOutcome.userFeedback < 3,
    );

    if (lowSatisfactionOperations.length > 3) {
      recommendations.push({
        area: "usability" as const,
        issue: "User satisfaction scores below expectations",
        recommendation: "Improve progress feedback and error messaging",
        impact: "medium" as const,
      });
    }

    return recommendations;
  }

  private calculateContextWeights(context: ExecutionContext): {
    performance: number;
    safety: number;
    usability: number;
  } {
    let performance = 0.33; // Base weight
    let safety = 0.33;
    let usability = 0.33;

    // Adjust based on priority
    switch (context.priority) {
      case "P0":
        safety = 0.5; // Safety is paramount for critical operations
        performance = 0.3;
        usability = 0.2;
        break;
      case "P1":
        safety = 0.4;
        performance = 0.35;
        usability = 0.25;
        break;
      case "P2":
        performance = 0.4; // Performance matters more for low-priority
        safety = 0.3;
        usability = 0.3;
        break;
    }

    // Adjust based on system load
    if (context.systemLoad === "high") {
      performance += 0.1;
      safety -= 0.05;
      usability -= 0.05;
    } else if (context.systemLoad === "low") {
      safety += 0.1;
      usability += 0.05;
      performance -= 0.15;
    }

    // Adjust based on user presence
    if (context.userPresent) {
      usability += 0.15;
      performance -= 0.1;
      safety -= 0.05;
    } else {
      performance += 0.1;
      safety += 0.05;
      usability -= 0.15;
    }

    // Adjust based on time constraints
    if (context.timeConstraints === "strict") {
      performance += 0.2;
      safety -= 0.1;
      usability -= 0.1;
    } else if (context.timeConstraints === "none") {
      safety += 0.15;
      usability += 0.1;
      performance -= 0.25;
    }

    // Normalize to ensure sum equals 1
    const total = performance + safety + usability;
    return {
      performance: performance / total,
      safety: safety / total,
      usability: usability / total,
    };
  }

  private generateExecutionStrategies(
    profile: OperationProfile,
    context: ExecutionContext,
  ): Array<{
    execution: DecisionResult["execution"];
    configuration: DecisionResult["configuration"];
  }> {
    const strategies = [];

    // Immediate execution - prioritizes performance
    strategies.push({
      execution: "immediate" as const,
      configuration: {
        timeoutMs: 60000,
        retries: 1,
        parallelism: 4,
        validation: "minimal" as const,
        userInteraction: "none" as const,
      },
    });

    // Optimized execution - balances all factors
    strategies.push({
      execution: "optimized" as const,
      configuration: {
        timeoutMs: 120000,
        retries: 2,
        parallelism: 2,
        validation: "moderate" as const,
        userInteraction: context.userPresent
          ? ("progress" as const)
          : ("none" as const),
      },
    });

    // Safe mode - prioritizes safety
    strategies.push({
      execution: "safe-mode" as const,
      configuration: {
        timeoutMs: 300000,
        retries: 3,
        parallelism: 1,
        validation: "strict" as const,
        userInteraction: "approval" as const,
      },
    });

    // User-guided - prioritizes usability
    if (context.userPresent) {
      strategies.push({
        execution: "user-guided" as const,
        configuration: {
          timeoutMs: 0, // No timeout - user controls
          retries: 0, // User decides retries
          parallelism: 1,
          validation: "moderate" as const,
          userInteraction: "full-control" as const,
        },
      });
    }

    // Deferred - for high-load situations
    if (context.systemLoad === "high") {
      strategies.push({
        execution: "deferred" as const,
        configuration: {
          timeoutMs: 600000,
          retries: 1,
          parallelism: 1,
          validation: "moderate" as const,
          userInteraction: "none" as const,
        },
      });
    }

    return strategies;
  }

  private scoreStrategy(
    strategy: { execution: string; configuration: any },
    profile: OperationProfile,
    weights: { performance: number; safety: number; usability: number },
  ): number {
    let performanceScore = 0;
    let safetyScore = 0;
    let usabilityScore = 0;

    // Score based on execution type
    switch (strategy.execution) {
      case "immediate":
        performanceScore = 5;
        safetyScore = 2;
        usabilityScore = 3;
        break;
      case "optimized":
        performanceScore = 4;
        safetyScore = 4;
        usabilityScore = 4;
        break;
      case "safe-mode":
        performanceScore = 2;
        safetyScore = 5;
        usabilityScore = 3;
        break;
      case "user-guided":
        performanceScore = 3;
        safetyScore = 4;
        usabilityScore = 5;
        break;
      case "deferred":
        performanceScore = 2;
        safetyScore = 4;
        usabilityScore = 2;
        break;
    }

    // Adjust scores based on operation profile
    performanceScore = (performanceScore + profile.performance.speed) / 2;
    safetyScore = (safetyScore + profile.safety.reliability) / 2;
    usabilityScore = (usabilityScore + profile.usability.automation) / 2;

    // Calculate weighted total
    return (
      performanceScore * weights.performance +
      safetyScore * weights.safety +
      usabilityScore * weights.usability
    );
  }

  private generateReasoning(
    strategy: any,
    profile: OperationProfile,
    context: ExecutionContext,
    weights: { performance: number; safety: number; usability: number },
  ): string {
    const primaryWeight = Math.max(
      weights.performance,
      weights.safety,
      weights.usability,
    );
    const primaryConcern =
      primaryWeight === weights.performance
        ? "performance"
        : primaryWeight === weights.safety
        ? "safety"
        : "usability";

    let reasoning = `Selected ${strategy.execution} execution for ${profile.name}. `;
    reasoning += `Primary concern: ${primaryConcern} (${Math.round(
      primaryWeight * 100,
    )}% weight). `;

    // Add context-specific reasoning
    if (context.priority === "P0") {
      reasoning += "Critical priority demands maximum safety. ";
    }
    if (context.systemLoad === "high") {
      reasoning += "High system load requires resource-conscious approach. ";
    }
    if (context.userPresent) {
      reasoning += "User present - emphasizing feedback and control. ";
    }
    if (context.timeConstraints === "strict") {
      reasoning += "Time constraints favor performance optimization. ";
    }

    return reasoning;
  }

  private predictOutcome(
    strategy: any,
    profile: OperationProfile,
    context: ExecutionContext,
  ): {
    duration: number;
    successProbability: number;
    userSatisfaction: number;
  } {
    let baseDuration = 30000; // Base 30 seconds
    let successProbability = 0.8;
    let userSatisfaction = 0.7;

    // Adjust based on profile
    baseDuration *= 6 - profile.performance.speed; // Slower operations take longer
    successProbability += (profile.safety.reliability - 3) * 0.1;
    userSatisfaction += (profile.usability.clarity - 3) * 0.1;

    // Adjust based on strategy
    switch (strategy.execution) {
      case "immediate":
        baseDuration *= 0.7;
        successProbability -= 0.1;
        break;
      case "safe-mode":
        baseDuration *= 1.5;
        successProbability += 0.15;
        userSatisfaction -= 0.1; // Slower
        break;
      case "user-guided":
        baseDuration *= 2;
        userSatisfaction += 0.2;
        break;
      case "deferred":
        baseDuration *= 0.9;
        userSatisfaction -= 0.15;
        break;
    }

    // Adjust based on context
    if (context.systemLoad === "high") {
      baseDuration *= 1.3;
      successProbability -= 0.1;
    }

    return {
      duration: Math.max(baseDuration, 5000),
      successProbability: Math.min(Math.max(successProbability, 0.1), 0.95),
      userSatisfaction: Math.min(Math.max(userSatisfaction, 0.1), 1.0),
    };
  }

  private learnFromOutcome(entry: {
    operation: string;
    context: ExecutionContext;
    decision: DecisionResult;
    actualOutcome: {
      duration: number;
      success: boolean;
      userFeedback?: number;
    };
  }): void {
    // Simple learning - adjust operation profiles based on outcomes
    const profile = this.operationProfiles.get(entry.operation);
    if (!profile || !entry.actualOutcome) return;

    // If operation was much slower than expected, slightly reduce performance rating
    if (
      entry.actualOutcome.duration >
      entry.decision.expectedOutcome.duration * 1.5
    ) {
      profile.performance.speed = Math.max(1, profile.performance.speed - 0.1);
    }

    // If operation failed, reduce reliability rating
    if (!entry.actualOutcome.success) {
      profile.safety.reliability = Math.max(
        1,
        profile.safety.reliability - 0.1,
      );
    }

    // If user feedback was poor, reduce usability rating
    if (
      entry.actualOutcome.userFeedback &&
      entry.actualOutcome.userFeedback < 3
    ) {
      profile.usability.clarity = Math.max(1, profile.usability.clarity - 0.1);
    }

    console.log(`📊 Updated profile for ${entry.operation} based on outcome`);
  }

  /**
   * Calculate approval score for an operation
   */
  calculateApprovalScore(
    operation: string,
    context: ExecutionContext,
    operationProfile: OperationProfile,
    riskLevel: "low" | "medium" | "high" | "critical" = "medium",
  ): ApprovalScore {
    // Calculate sub-scores (0-100 scale)
    const safetyScore = this.calculateSafetyScore(
      operationProfile,
      context,
      riskLevel,
    );
    const complexityScore = this.calculateComplexityScore(operation, context);
    const impactScore = this.calculateImpactScore(operationProfile, context);
    const reversibilityScore = this.calculateReversibilityScore(
      operationProfile,
      riskLevel,
    );

    // Weighted total score
    const weights = {
      safety: 0.35,
      complexity: 0.25,
      impact: 0.25,
      reversibility: 0.15,
    };

    const totalScore = Math.round(
      safetyScore * weights.safety +
        complexityScore * weights.complexity +
        impactScore * weights.impact +
        reversibilityScore * weights.reversibility,
    );

    // Determine recommendation
    const recommendation = this.determineApprovalRecommendation(
      totalScore,
      riskLevel,
    );

    // Calculate confidence
    const confidence = this.calculateApprovalConfidence(
      totalScore,
      operationProfile,
    );

    // Generate reasoning
    const reasoning = this.generateApprovalReasoning(
      totalScore,
      recommendation,
      safetyScore,
      complexityScore,
      impactScore,
      reversibilityScore,
    );

    return {
      totalScore,
      subScores: {
        safety: safetyScore,
        complexity: complexityScore,
        impact: impactScore,
        reversibility: reversibilityScore,
      },
      recommendation,
      confidence,
      reasoning,
    };
  }

  private calculateSafetyScore(
    profile: OperationProfile,
    context: ExecutionContext,
    riskLevel: string,
  ): number {
    let baseScore = profile.safety.reliability * 20; // 0-100 scale

    // Apply strategy matrix weights if available
    const strategyConfig = this.getStrategyConfig(profile.type);
    if (strategyConfig) {
      // Adjust base score with strategy matrix safety weights
      const safetyWeight = strategyConfig.safety?.reliability || 1;
      baseScore = baseScore * (safetyWeight / 5); // Normalize to 0-100 scale
    }

    // Adjust based on risk level (from strategy matrix risk thresholds if available)
    const riskThresholds = this.strategyMatrix?.risk_thresholds;
    if (riskThresholds && riskThresholds[riskLevel]) {
      const threshold = riskThresholds[riskLevel];
      baseScore = baseScore * (1 - threshold.max_impact);
    } else {
      // Fallback to hardcoded values
      switch (riskLevel) {
        case "low":
          baseScore += 20;
          break;
        case "medium":
          baseScore += 0;
          break;
        case "high":
          baseScore -= 20;
          break;
        case "critical":
          baseScore -= 40;
          break;
      }
    }

    // Adjust based on context
    if (context.errorTolerance === "zero") baseScore += 10;
    if (context.priority === "P0") baseScore -= 10;

    return Math.max(0, Math.min(100, baseScore));
  }

  private calculateComplexityScore(
    operation: string,
    context: ExecutionContext,
  ): number {
    let baseScore = 80; // Default moderate complexity

    // Operation-specific complexity
    const complexityMap: Record<string, number> = {
      typecheck: 85,
      lint: 90,
      test: 75,
      audit: 70,
      evolution: 50,
      build: 60,
    };

    baseScore = complexityMap[operation] || baseScore;

    // Context adjustments
    if (context.priority === "P0") baseScore -= 20; // P0 changes are inherently complex
    if (context.automationLevel === "manual") baseScore += 15; // Manual ops are simpler

    return Math.max(0, Math.min(100, baseScore));
  }

  private calculateImpactScore(
    profile: OperationProfile,
    context: ExecutionContext,
  ): number {
    let baseScore = 70;

    // Higher risk operations have lower impact scores (more caution needed)
    baseScore = Math.max(20, 100 - profile.safety.riskLevel * 20);

    // Context adjustments
    if (context.priority === "P0") baseScore -= 15; // P0 has higher impact
    if (context.errorTolerance === "high") baseScore += 15; // High tolerance = lower impact concern

    return Math.max(0, Math.min(100, baseScore));
  }

  private calculateReversibilityScore(
    profile: OperationProfile,
    riskLevel: string,
  ): number {
    let baseScore = profile.safety.reversible * 20; // 0-100 scale

    // Risk level affects reversibility concerns
    switch (riskLevel) {
      case "low":
        baseScore += 10;
        break;
      case "medium":
        baseScore += 0;
        break;
      case "high":
        baseScore -= 10;
        break;
      case "critical":
        baseScore -= 25;
        break;
    }

    return Math.max(0, Math.min(100, baseScore));
  }

  private determineApprovalRecommendation(
    totalScore: number,
    riskLevel: string,
  ): ApprovalScore["recommendation"] {
    if (riskLevel === "critical") {
      return totalScore >= 85 ? "require-review" : "reject";
    }

    if (totalScore >= 85) return "auto-approve";
    if (totalScore >= 70) return "request-approval";
    if (totalScore >= 50) return "require-review";
    return "reject";
  }

  private calculateApprovalConfidence(
    totalScore: number,
    profile: OperationProfile,
  ): number {
    // Base confidence from reliability
    let confidence = profile.safety.reliability / 5; // 0.2-1.0 scale

    // Adjust based on score clarity
    if (totalScore >= 85 || totalScore <= 30) {
      confidence += 0.2; // Clear decisions have higher confidence
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private generateApprovalReasoning(
    totalScore: number,
    recommendation: ApprovalScore["recommendation"],
    safety: number,
    complexity: number,
    impact: number,
    reversibility: number,
  ): string[] {
    const reasoning: string[] = [
      `종합 점수: ${totalScore}/100 (승인 권장: ${recommendation})`,
    ];

    // Add specific reasoning based on scores
    if (safety >= 80) reasoning.push("✅ 안전성이 높습니다");
    else if (safety <= 40) reasoning.push("⚠️ 안전성 검토가 필요합니다");

    if (complexity >= 80) reasoning.push("✅ 복잡도가 낮아 안전합니다");
    else if (complexity <= 40)
      reasoning.push("⚠️ 높은 복잡도로 인한 위험이 있습니다");

    if (impact >= 80) reasoning.push("✅ 시스템 영향도가 낮습니다");
    else if (impact <= 40)
      reasoning.push("⚠️ 시스템에 높은 영향을 줄 수 있습니다");

    if (reversibility >= 80) reasoning.push("✅ 롤백이 용이합니다");
    else if (reversibility <= 40)
      reasoning.push("⚠️ 롤백이 어려울 수 있습니다");

    return reasoning;
  }
}

// Singleton instance for global use
export const smartDecisionMatrix = new SmartDecisionMatrix();
export default SmartDecisionMatrix;
