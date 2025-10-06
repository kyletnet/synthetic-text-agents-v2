#!/usr/bin/env tsx

/**
 * Externalized Decision Matrix
 * YAML-configured decision logic for system optimization trade-offs
 * Implements GPT recommendations for flexibility and maintainability
 */

import * as yaml from "js-yaml";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { EventEmitter } from "events";

export interface StrategyConfig {
  performance: {
    speed: number;
    resources: number;
    scalability: number;
  };
  safety: {
    reliability: number;
    reversible: number;
    riskLevel: number;
  };
  usability: {
    clarity: number;
    automation: number;
    feedback: number;
  };
}

export interface ExecutionStrategyConfig {
  timeout: number;
  retries: number;
  parallelism: number;
  description: string;
  use_when: string[];
}

export interface IntegrationRule {
  conditions: string[];
  description: string;
}

export interface HarmonyMetric {
  weight: number;
  calculation: string;
  target: number;
  description: string;
  factors: string[];
}

export interface StrategyMatrixConfig {
  version: string;
  updated: string;
  strategies: Record<string, StrategyConfig>;
  context_weights: Record<string, Record<string, number>>;
  execution_strategies: Record<string, ExecutionStrategyConfig>;
  integration_rules: Record<string, IntegrationRule>;
  harmony_metrics: Record<string, HarmonyMetric>;
  risk_thresholds: Record<string, any>;
  operational_modes: Record<string, any>;
  feature_flags: Record<string, boolean>;
}

export interface DecisionContext {
  priority: "P0" | "P1" | "P2";
  operationType: string;
  systemState: {
    operationsPerHour: number;
    healthyComponents: number;
    systemLoad: number;
  };
  environment: "development" | "staging" | "production";
}

export interface IntegrationDecision {
  strategy: "full_integration" | "partial_integration" | "reject_integration";
  reasoning: string;
  conditions_met: string[];
  conditions_failed: string[];
  recommendations: string[];
}

export interface SystemHarmonyScore {
  overall: number;
  breakdown: {
    componentHarmony: number;
    architectureAlignment: number;
    performanceCoherence: number;
  };
  trends: Array<{
    timestamp: Date;
    score: number;
    factors: Record<string, number>;
  }>;
  recommendations: string[];
}

/**
 * Externalized Decision Matrix - Configuration-driven decision making
 */
export class ExternalizedDecisionMatrix extends EventEmitter {
  private config!: StrategyMatrixConfig;
  private configPath: string;
  private harmonyHistory: Array<{
    timestamp: Date;
    score: number;
    factors: Record<string, number>;
  }> = [];

  constructor(configPath?: string) {
    super();
    this.setMaxListeners(50);

    this.configPath =
      configPath || join(process.cwd(), ".strategy-matrix.yaml");
    this.loadConfiguration();

    // Watch for config changes
    this.watchConfigChanges();
  }

  /**
   * Load configuration from YAML file
   */
  private loadConfiguration(): void {
    try {
      if (!existsSync(this.configPath)) {
        throw new Error(
          `Strategy matrix configuration not found: ${this.configPath}`,
        );
      }

      const yamlContent = readFileSync(this.configPath, "utf8");
      this.config = yaml.load(yamlContent) as StrategyMatrixConfig;

      console.log(
        `📊 Loaded strategy matrix v${this.config.version} (${this.config.updated})`,
      );
      this.emit("config:loaded", this.config);
    } catch (error) {
      console.error("❌ Failed to load strategy matrix configuration:", error);
      throw error;
    }
  }

  /**
   * Watch for configuration file changes
   */
  private watchConfigChanges(): void {
    // Simple file watching - could be enhanced with fs.watch
    setInterval(() => {
      try {
        const yamlContent = readFileSync(this.configPath, "utf8");
        const newConfig = yaml.load(yamlContent) as StrategyMatrixConfig;

        if (newConfig.updated !== this.config.updated) {
          console.log("🔄 Strategy matrix configuration updated, reloading...");
          this.config = newConfig;
          this.emit("config:updated", this.config);
        }
      } catch (error) {
        console.warn("⚠️ Failed to check config updates:", error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Make execution decision based on context
   */
  async makeDecision(context: DecisionContext): Promise<{
    strategy: string;
    configuration: ExecutionStrategyConfig;
    score: number;
    reasoning: string;
  }> {
    const operationStrategy = this.config.strategies[context.operationType];
    if (!operationStrategy) {
      throw new Error(
        `No strategy defined for operation type: ${context.operationType}`,
      );
    }

    // Calculate weighted scores
    const weights =
      this.config.context_weights[context.priority] ||
      this.config.context_weights.P2;
    const score = this.calculateWeightedScore(operationStrategy, weights);

    // Find best execution strategy
    const bestStrategy = this.selectExecutionStrategy(context);
    const configuration = this.config.execution_strategies[bestStrategy];

    const reasoning = this.generateReasoning(
      context,
      operationStrategy,
      bestStrategy,
      score,
    );

    this.emit("decision:made", {
      context,
      strategy: bestStrategy,
      score,
      reasoning,
    });

    return {
      strategy: bestStrategy,
      configuration,
      score,
      reasoning,
    };
  }

  /**
   * Evaluate integration strategy for new components
   */
  async evaluateIntegration(
    componentName: string,
    compatibilityScore: number,
    performanceImpact: number,
    architectureAlignment: number,
  ): Promise<IntegrationDecision> {
    console.log(`🔍 Evaluating integration for: ${componentName}`);
    console.log(`   Compatibility: ${compatibilityScore}`);
    console.log(`   Performance Impact: ${performanceImpact}`);
    console.log(`   Architecture Alignment: ${architectureAlignment}`);

    const conditionsMet: string[] = [];
    const conditionsFailed: string[] = [];
    let selectedStrategy = "reject_integration";

    // Check each integration rule
    for (const [ruleName, rule] of Object.entries(
      this.config.integration_rules,
    )) {
      const ruleResult = this.evaluateIntegrationRule(
        rule,
        compatibilityScore,
        performanceImpact,
        architectureAlignment,
      );

      if (ruleResult.success) {
        selectedStrategy = ruleName;
        conditionsMet.push(...ruleResult.conditions);
        break; // Use first matching rule
      } else {
        conditionsFailed.push(...ruleResult.conditions);
      }
    }

    const recommendations = this.generateIntegrationRecommendations(
      selectedStrategy,
      compatibilityScore,
      performanceImpact,
      architectureAlignment,
    );

    const decision: IntegrationDecision = {
      strategy: selectedStrategy as
        | "full_integration"
        | "partial_integration"
        | "reject_integration",
      reasoning: this.config.integration_rules[selectedStrategy].description,
      conditions_met: conditionsMet,
      conditions_failed: conditionsFailed,
      recommendations,
    };

    console.log(`📋 Integration decision: ${selectedStrategy}`);
    console.log(`   Reasoning: ${decision.reasoning}`);

    this.emit("integration:evaluated", { componentName, decision });
    return decision;
  }

  /**
   * Calculate system harmony score
   */
  async calculateSystemHarmonyScore(systemMetrics: {
    dependencyGraphEntropy: number;
    designPrincipleConformity: number;
    runtimeVarianceAnalysis: number;
  }): Promise<SystemHarmonyScore> {
    const breakdown = {
      componentHarmony: this.calculateComponentHarmony(
        systemMetrics.dependencyGraphEntropy,
      ),
      architectureAlignment: systemMetrics.designPrincipleConformity,
      performanceCoherence: this.calculatePerformanceCoherence(
        systemMetrics.runtimeVarianceAnalysis,
      ),
    };

    // Calculate weighted overall score
    const harmonyMetrics = this.config.harmony_metrics;
    const overall =
      breakdown.componentHarmony * harmonyMetrics.component_harmony.weight +
      breakdown.architectureAlignment *
        harmonyMetrics.architecture_alignment.weight +
      breakdown.performanceCoherence *
        harmonyMetrics.performance_coherence.weight;

    // Add to history
    const scoreRecord = {
      timestamp: new Date(),
      score: overall,
      factors: breakdown,
    };
    this.harmonyHistory.push(scoreRecord);

    // Keep only last 100 records
    if (this.harmonyHistory.length > 100) {
      this.harmonyHistory = this.harmonyHistory.slice(-100);
    }

    const recommendations = this.generateHarmonyRecommendations(breakdown);

    const harmonyScore: SystemHarmonyScore = {
      overall: Math.round(overall * 100) / 100,
      breakdown,
      trends: this.harmonyHistory.slice(-10), // Last 10 records
      recommendations,
    };

    console.log(`🎯 System Harmony Score: ${harmonyScore.overall}`);
    console.log(`   Component Harmony: ${breakdown.componentHarmony}`);
    console.log(
      `   Architecture Alignment: ${breakdown.architectureAlignment}`,
    );
    console.log(`   Performance Coherence: ${breakdown.performanceCoherence}`);

    this.emit("harmony:calculated", harmonyScore);
    return harmonyScore;
  }

  /**
   * Get current configuration
   */
  getConfiguration(): StrategyMatrixConfig {
    return this.config;
  }

  /**
   * Update feature flag
   */
  updateFeatureFlag(flag: string, enabled: boolean): void {
    this.config.feature_flags[flag] = enabled;
    console.log(`🚩 Feature flag updated: ${flag} = ${enabled}`);
    this.emit("feature:toggled", { flag, enabled });
  }

  private calculateWeightedScore(
    strategy: StrategyConfig,
    weights: Record<string, number>,
  ): number {
    const perfScore =
      (strategy.performance.speed +
        strategy.performance.resources +
        strategy.performance.scalability) /
      15;
    const safetyScore =
      (strategy.safety.reliability +
        strategy.safety.reversible +
        strategy.safety.riskLevel) /
      15;
    const usabilityScore =
      (strategy.usability.clarity +
        strategy.usability.automation +
        strategy.usability.feedback) /
      15;

    return (
      perfScore * weights.performance +
      safetyScore * weights.safety +
      usabilityScore * weights.usability
    );
  }

  private selectExecutionStrategy(context: DecisionContext): string {
    const { priority, systemState } = context;

    // Check immediate conditions first
    if (priority === "P0" && systemState.operationsPerHour < 20) {
      return "immediate";
    }

    if (priority === "P1" && systemState.operationsPerHour < 40) {
      return "optimized";
    }

    if (systemState.operationsPerHour >= 40) {
      return "coordinated";
    }

    if (systemState.healthyComponents >= 3 && systemState.systemLoad < 0.7) {
      return "distributed";
    }

    return "optimized"; // Default fallback
  }

  private generateReasoning(
    context: DecisionContext,
    strategy: StrategyConfig,
    selectedStrategy: string,
    score: number,
  ): string {
    const config = this.config.execution_strategies[selectedStrategy];
    return `Selected ${selectedStrategy} strategy (score: ${score.toFixed(
      2,
    )}) for ${context.priority} priority operation. ${config.description}`;
  }

  private evaluateIntegrationRule(
    rule: IntegrationRule,
    compatibilityScore: number,
    performanceImpact: number,
    architectureAlignment: number,
  ): { success: boolean; conditions: string[] } {
    const conditions: string[] = [];
    let success = true;

    for (const condition of rule.conditions) {
      if (condition.includes("compatibility_score")) {
        const threshold = parseFloat(
          condition.split(">=")[1]?.trim() ||
            condition.split("<")[1]?.trim() ||
            "0",
        );
        const operator = condition.includes(">=") ? ">=" : "<";

        if (operator === ">=" && compatibilityScore >= threshold) {
          conditions.push(
            `Compatibility score ${compatibilityScore} meets threshold ${threshold}`,
          );
        } else if (operator === "<" && compatibilityScore < threshold) {
          conditions.push(
            `Compatibility score ${compatibilityScore} below threshold ${threshold}`,
          );
        } else {
          success = false;
          conditions.push(
            `Compatibility score ${compatibilityScore} fails condition: ${condition}`,
          );
        }
      }

      if (condition.includes("performance_impact")) {
        const threshold = parseFloat(
          condition.split("<")[1]?.trim() ||
            condition.split(">=")[1]?.trim() ||
            "0",
        );
        const operator = condition.includes("<") ? "<" : ">=";

        if (operator === "<" && performanceImpact < threshold) {
          conditions.push(
            `Performance impact ${performanceImpact} within acceptable range ${threshold}`,
          );
        } else if (operator === ">=" && performanceImpact >= threshold) {
          conditions.push(
            `Performance impact ${performanceImpact} exceeds threshold ${threshold}`,
          );
        } else {
          success = false;
          conditions.push(
            `Performance impact ${performanceImpact} fails condition: ${condition}`,
          );
        }
      }

      if (condition.includes("architecture_alignment")) {
        const threshold = parseFloat(
          condition.split(">=")[1]?.trim() ||
            condition.split("<")[1]?.trim() ||
            "0",
        );
        const operator = condition.includes(">=") ? ">=" : "<";

        if (operator === ">=" && architectureAlignment >= threshold) {
          conditions.push(
            `Architecture alignment ${architectureAlignment} meets standard ${threshold}`,
          );
        } else if (operator === "<" && architectureAlignment < threshold) {
          conditions.push(
            `Architecture alignment ${architectureAlignment} below standard ${threshold}`,
          );
        } else {
          success = false;
          conditions.push(
            `Architecture alignment ${architectureAlignment} fails condition: ${condition}`,
          );
        }
      }
    }

    return { success, conditions };
  }

  private generateIntegrationRecommendations(
    strategy: string,
    compatibilityScore: number,
    performanceImpact: number,
    architectureAlignment: number,
  ): string[] {
    const recommendations: string[] = [];

    if (strategy === "reject_integration") {
      if (compatibilityScore < 0.6) {
        recommendations.push(
          "Improve component compatibility by addressing interface mismatches",
        );
      }
      if (performanceImpact >= 0.2) {
        recommendations.push(
          "Optimize component performance to reduce system impact",
        );
      }
      if (architectureAlignment < 0.5) {
        recommendations.push(
          "Redesign component to better align with system architecture",
        );
      }
    } else if (strategy === "partial_integration") {
      recommendations.push(
        "Enable integration with feature flags to limit exposure",
      );
      recommendations.push(
        "Monitor performance metrics closely during rollout",
      );
      recommendations.push(
        "Plan for full integration after addressing compatibility gaps",
      );
    } else {
      recommendations.push("Proceed with full integration");
      recommendations.push("Monitor system harmony metrics post-integration");
    }

    return recommendations;
  }

  private calculateComponentHarmony(dependencyGraphEntropy: number): number {
    // Convert entropy to harmony score (lower entropy = higher harmony)
    return Math.max(0, Math.min(1, 1 - dependencyGraphEntropy / 10));
  }

  private calculatePerformanceCoherence(runtimeVariance: number): number {
    // Convert variance to coherence score (lower variance = higher coherence)
    return Math.max(0, Math.min(1, 1 - runtimeVariance / 2));
  }

  private generateHarmonyRecommendations(breakdown: {
    componentHarmony: number;
    architectureAlignment: number;
    performanceCoherence: number;
  }): string[] {
    const recommendations: string[] = [];
    const targets = this.config.harmony_metrics;

    if (breakdown.componentHarmony < targets.component_harmony.target) {
      recommendations.push(
        "Reduce component coupling by simplifying dependency relationships",
      );
    }

    if (
      breakdown.architectureAlignment < targets.architecture_alignment.target
    ) {
      recommendations.push("Review and address design principle violations");
    }

    if (breakdown.performanceCoherence < targets.performance_coherence.target) {
      recommendations.push(
        "Investigate performance variance and optimize inconsistent components",
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        "System harmony is within target ranges - maintain current practices",
      );
    }

    return recommendations;
  }
}

// Global instance
export const externalizedDecisionMatrix = new ExternalizedDecisionMatrix();
export default ExternalizedDecisionMatrix;
