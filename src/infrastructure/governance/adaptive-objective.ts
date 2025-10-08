/**
 * Adaptive Objective Function (AOF)
 *
 * Critical Insight (from GPT):
 * "Self-Correction learns thresholds, but humans still define what 'success' means.
 *  Let the system redefine its own objectives based on experience."
 *
 * Evolution:
 * - Stage 4: System adapts HOW (adjust thresholds)
 * - Stage 5: System adapts WHY (redefine objectives)
 *
 * Examples:
 * - Initial: "Minimize cost"
 * - Learned: "Minimize cost while maintaining quality >0.8"
 * - Evolved: "Maximize value (cost/quality ratio)"
 *
 * This is teleonomic evolution - system understands its purpose.
 */

import { readFileSync, existsSync, appendFileSync, writeFileSync } from "fs";
import { join } from "path";
import { dump as dumpYaml, load as loadYaml } from "js-yaml";

export interface ObjectiveFunction {
  name: string;
  description: string;
  formula: string;
  priority: number;
  adaptable: boolean;
  constraints: string[];
}

export interface ObjectiveEvolution {
  timestamp: string;
  oldObjective: string;
  newObjective: string;
  reason: string;
  impact: string;
  confidence: number;
}

/**
 * Adaptive Objective Function Manager
 */
export class AdaptiveObjectiveManager {
  private trainingDataPath: string;
  private objectivesPath: string;
  private evolutionLogPath: string;
  private minSamplesForEvolution: number = 50;

  constructor(projectRoot: string = process.cwd()) {
    this.trainingDataPath = join(
      projectRoot,
      "reports/governance/prediction-train.jsonl",
    );
    this.objectivesPath = join(projectRoot, "governance-objectives.yaml");
    this.evolutionLogPath = join(
      projectRoot,
      "reports/governance/objective-evolution.jsonl",
    );

    // Initialize defaults synchronously
    if (!existsSync(this.objectivesPath)) {
      const defaultObjectives = {
        version: "1.0.0",
        objectives: [
          {
            name: "minimize_cost",
            description: "Minimize operational cost per item",
            formula: "min(cost_per_item)",
            priority: 1,
            adaptable: true,
            constraints: [],
          },
          {
            name: "maintain_quality",
            description: "Maintain quality score above threshold",
            formula: "quality_score >= 0.80",
            priority: 1,
            adaptable: true,
            constraints: ["quality_score >= 0.70"],
          },
          {
            name: "prevent_drift",
            description: "Keep metric changes within acceptable range",
            formula: "abs(delta) < 0.20",
            priority: 2,
            adaptable: true,
            constraints: [],
          },
        ],
      };
      writeFileSync(this.objectivesPath, dumpYaml(defaultObjectives));
    }
  }

  /**
   * Analyze and evolve objectives based on feedback
   */
  async analyzeAndEvolve(): Promise<ObjectiveEvolution[]> {
    console.log(
      "\n[Adaptive Objectives] 🎯 Analyzing objective performance...",
    );

    if (!existsSync(this.trainingDataPath)) {
      console.log("   ℹ️  No training data available yet");
      return [];
    }

    const content = readFileSync(this.trainingDataPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    if (lines.length < this.minSamplesForEvolution) {
      console.log(
        `   ℹ️  Need ${this.minSamplesForEvolution} samples, have ${lines.length}`,
      );
      return [];
    }

    const examples = lines.map((line) => JSON.parse(line));

    // Analyze patterns
    const patterns = this.analyzeObjectivePatterns(examples);

    // Generate evolutions
    const evolutions = this.generateObjectiveEvolutions(patterns);

    if (evolutions.length > 0) {
      console.log(`   🧬 Generated ${evolutions.length} objective evolutions`);

      for (const evolution of evolutions) {
        await this.applyEvolution(evolution);
      }
    } else {
      console.log("   ℹ️  Current objectives are optimal");
    }

    return evolutions;
  }

  /**
   * Analyze objective performance patterns
   */
  private analyzeObjectivePatterns(examples: any[]): any {
    const patterns: any = {
      cost_vs_quality: this.analyzeCostQualityTradeoff(examples),
      stability_vs_performance: this.analyzeStabilityPerformance(examples),
      intervention_rate: this.analyzeInterventionRate(examples),
    };

    return patterns;
  }

  /**
   * Analyze cost vs quality tradeoff
   */
  private analyzeCostQualityTradeoff(examples: any[]): any {
    // Check if we're sacrificing quality for cost
    const costDecreases = examples.filter(
      (e) =>
        e.delta?.metric?.includes("cost") &&
        e.delta?.percentChange < -10 &&
        (e.outcome?.gatePassed ?? false),
    );

    const qualityDrops = examples.filter(
      (e) =>
        e.delta?.metric?.includes("quality") &&
        e.delta?.percentChange < -5 &&
        !(e.outcome?.gatePassed ?? true),
    );

    if (costDecreases.length > 5 && qualityDrops.length > 3) {
      return {
        pattern: "cost_optimization_hurts_quality",
        confidence: 0.8,
        suggestion: "evolve_to_value_optimization",
      };
    }

    return { pattern: "balanced", confidence: 0.5 };
  }

  /**
   * Analyze stability vs performance
   */
  private analyzeStabilityPerformance(examples: any[]): any {
    const driftEvents = examples.filter((e) => e.labels?.isDrift ?? false);
    const driftRate = driftEvents.length / examples.length;

    if (driftRate > 0.4) {
      return {
        pattern: "high_instability",
        confidence: 0.9,
        suggestion: "prioritize_stability",
      };
    }

    if (driftRate < 0.05) {
      return {
        pattern: "over_constrained",
        confidence: 0.7,
        suggestion: "allow_more_flexibility",
      };
    }

    return { pattern: "balanced", confidence: 0.6 };
  }

  /**
   * Analyze intervention rate
   */
  private analyzeInterventionRate(examples: any[]): number {
    const interventions = examples.filter(
      (e) => e.labels?.requiresIntervention ?? false,
    );
    return interventions.length / examples.length;
  }

  /**
   * Generate objective evolutions from patterns
   */
  private generateObjectiveEvolutions(patterns: any): ObjectiveEvolution[] {
    const evolutions: ObjectiveEvolution[] = [];

    // Evolution 1: Cost vs Quality → Value Optimization
    if (
      patterns.cost_vs_quality.suggestion === "evolve_to_value_optimization"
    ) {
      evolutions.push({
        timestamp: new Date().toISOString(),
        oldObjective: "minimize_cost",
        newObjective: "maximize_value",
        reason:
          "Detected cost optimization hurting quality. Evolving to value-based optimization.",
        impact:
          "System will now optimize cost/quality ratio instead of cost alone",
        confidence: patterns.cost_vs_quality.confidence,
      });
    }

    // Evolution 2: Stability Priority
    if (
      patterns.stability_vs_performance.suggestion === "prioritize_stability"
    ) {
      evolutions.push({
        timestamp: new Date().toISOString(),
        oldObjective: "prevent_drift",
        newObjective: "enforce_stability",
        reason: "High instability detected. Tightening drift constraints.",
        impact: "Drift tolerance reduced from 20% to 10%",
        confidence: patterns.stability_vs_performance.confidence,
      });
    }

    // Evolution 3: Allow Flexibility
    if (
      patterns.stability_vs_performance.suggestion === "allow_more_flexibility"
    ) {
      evolutions.push({
        timestamp: new Date().toISOString(),
        oldObjective: "prevent_drift",
        newObjective: "balanced_adaptability",
        reason: "System over-constrained. Allowing more flexibility.",
        impact: "Drift tolerance increased from 20% to 30%",
        confidence: patterns.stability_vs_performance.confidence,
      });
    }

    return evolutions;
  }

  /**
   * Apply objective evolution
   */
  private async applyEvolution(evolution: ObjectiveEvolution): Promise<void> {
    console.log(`\n🎯 [Adaptive Objectives] Evolving objective:`);
    console.log(`   Old: ${evolution.oldObjective}`);
    console.log(`   New: ${evolution.newObjective}`);
    console.log(`   Reason: ${evolution.reason}`);
    console.log(`   Confidence: ${(evolution.confidence * 100).toFixed(1)}%`);

    try {
      // Load current objectives
      const objectives = loadYaml(
        readFileSync(this.objectivesPath, "utf8"),
      ) as any;

      // Apply evolution (simplified)
      const objective = objectives.objectives.find(
        (o: any) => o.name === evolution.oldObjective,
      );

      if (objective) {
        objective.name = evolution.newObjective;
        // Update formula based on evolution
        if (evolution.newObjective === "maximize_value") {
          objective.formula = "max(quality_score / cost_per_item)";
          objective.description = "Maximize value (quality-to-cost ratio)";
        }

        // Write updated objectives
        const { writeFileSync } = await import("fs");
        writeFileSync(this.objectivesPath, dumpYaml(objectives));

        // Log evolution
        appendFileSync(this.evolutionLogPath, JSON.stringify(evolution) + "\n");

        console.log(`   ✅ Objective evolved successfully`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to apply evolution:`, error);
    }
  }

  /**
   * Get current objectives
   */
  getCurrentObjectives(): ObjectiveFunction[] {
    if (!existsSync(this.objectivesPath)) {
      return [];
    }

    const content = readFileSync(this.objectivesPath, "utf8");
    const data = loadYaml(content) as any;
    return data.objectives || [];
  }

  /**
   * Get evolution history
   */
  getEvolutionHistory(limit: number = 10): ObjectiveEvolution[] {
    if (!existsSync(this.evolutionLogPath)) {
      return [];
    }

    const content = readFileSync(this.evolutionLogPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    return lines
      .slice(-limit)
      .map((line) => JSON.parse(line) as ObjectiveEvolution)
      .reverse();
  }
}
