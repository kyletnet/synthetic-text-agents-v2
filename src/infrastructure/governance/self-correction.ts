/**
 * Self-Correction Engine
 *
 * Final Evolution (from GPT insight):
 * "Let governance policies evolve themselves based on feedback."
 *
 * Design:
 * 1. Monitor prediction-train.jsonl for patterns
 * 2. Detect recurring issues (drift, anomalies)
 * 3. Automatically adjust policies
 * 4. Notify humans of autonomous changes
 *
 * This is the difference between:
 * - Working Genetic System (policies are fixed)
 * - Evolving Genetic System (policies adapt)
 *
 * Example:
 * - 10 threshold drifts in 1 week → Lower warning threshold
 * - 0 cost spikes in 1 month → Relax cost policy
 * - 5 quality drops in 1 day → Tighten quality gate
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { load as loadYaml, dump as dumpYaml } from "js-yaml";

export interface PolicyAdaptation {
  policyName: string;
  change: string;
  reason: string;
  impact: string;
  timestamp: string;
  autoApplied: boolean;
}

export interface LearningPattern {
  pattern: string;
  frequency: number;
  severity: "high" | "medium" | "low";
  suggestedAction: string;
}

/**
 * Self-Correction Engine
 * Governance policies that evolve themselves
 */
export class SelfCorrectionEngine {
  private trainingDataPath: string;
  private policyPath: string;
  private adaptationLogPath: string;
  private checkIntervalMs: number = 3600000; // 1 hour
  private minSamplesForAdaptation: number = 20;

  constructor(projectRoot: string = process.cwd()) {
    this.trainingDataPath = join(
      projectRoot,
      "reports/governance/prediction-train.jsonl",
    );
    this.policyPath = join(projectRoot, "governance-rules.yaml");
    this.adaptationLogPath = join(
      projectRoot,
      "reports/governance/policy-adaptations.jsonl",
    );
  }

  /**
   * Initialize self-correction engine
   * Now integrated with Meta-Kernel, Adaptive Objectives, and Feedback Symmetry
   */
  async initialize(): Promise<void> {
    console.log(
      "[Self-Correction] Initializing autonomous policy evolution...",
    );

    // Import advanced components
    const { verifySelfStructure } = await import(
      "../../core/governance/meta-kernel.js"
    );
    const { AdaptiveObjectiveManager } = await import(
      "./adaptive-objective.js"
    );
    const { FeedbackSymmetryEngine } = await import("./feedback-symmetry.js");

    // Phase 1: Self-verification
    console.log("\n🧬 Phase 1: Meta-Kernel Self-Verification");
    await verifySelfStructure();

    // Phase 2: Adaptive objectives
    console.log("\n🎯 Phase 2: Adaptive Objective Analysis");
    const objectiveManager = new AdaptiveObjectiveManager();
    await objectiveManager.analyzeAndEvolve();

    // Phase 3: Feedback symmetry
    console.log("\n🔄 Phase 3: Design Feedback Loop");
    const feedbackEngine = new FeedbackSymmetryEngine();
    await feedbackEngine.generateDesignFeedback();

    // Phase 4: Start periodic analysis
    this.startPeriodicAnalysis();

    console.log(
      `\n[Self-Correction] ✅ Full autonomous system active (monitoring every ${
        this.checkIntervalMs / 1000 / 60
      } minutes)`,
    );
  }

  /**
   * Start periodic analysis of training data
   */
  private startPeriodicAnalysis(): void {
    setInterval(async () => {
      await this.analyzeAndAdapt();
    }, this.checkIntervalMs);

    // Run once immediately
    setTimeout(() => {
      this.analyzeAndAdapt();
    }, 5000); // 5 seconds after startup
  }

  /**
   * Analyze training data and adapt policies
   */
  private async analyzeAndAdapt(): Promise<void> {
    console.log("\n[Self-Correction] 🔍 Analyzing feedback patterns...");

    try {
      // Load training data
      const patterns = await this.detectPatterns();

      if (patterns.length === 0) {
        console.log("   ℹ️  No significant patterns detected");
        return;
      }

      console.log(`   📊 Detected ${patterns.length} patterns`);

      // Generate adaptations
      const adaptations = this.generateAdaptations(patterns);

      if (adaptations.length === 0) {
        console.log("   ℹ️  No policy changes needed");
        return;
      }

      console.log(`   🧬 Generated ${adaptations.length} policy adaptations`);

      // Apply adaptations
      for (const adaptation of adaptations) {
        await this.applyAdaptation(adaptation);
      }

      console.log("   ✅ Self-correction complete\n");
    } catch (error) {
      console.error("   ❌ Self-correction failed:", error);
    }
  }

  /**
   * Detect patterns in training data
   */
  private async detectPatterns(): Promise<LearningPattern[]> {
    if (!existsSync(this.trainingDataPath)) {
      return [];
    }

    const content = readFileSync(this.trainingDataPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    if (lines.length < this.minSamplesForAdaptation) {
      return [];
    }

    const examples = lines.map((line) => JSON.parse(line));

    const patterns: LearningPattern[] = [];

    // Pattern 1: Recurring drift
    const driftCount = examples.filter((e) => e.labels.isDrift).length;
    const driftRate = driftCount / examples.length;

    if (driftRate > 0.3) {
      // >30% drift rate
      patterns.push({
        pattern: "high_drift_rate",
        frequency: driftRate,
        severity: "high",
        suggestedAction: "tighten_threshold_policy",
      });
    }

    // Pattern 2: Low anomaly rate (system stable)
    const anomalyCount = examples.filter((e) => e.labels.isAnomaly).length;
    const anomalyRate = anomalyCount / examples.length;

    if (anomalyRate < 0.05) {
      // <5% anomaly rate
      patterns.push({
        pattern: "low_anomaly_rate",
        frequency: anomalyRate,
        severity: "low",
        suggestedAction: "relax_warning_policy",
      });
    }

    // Pattern 3: High intervention rate
    const interventionCount = examples.filter(
      (e) => e.labels.requiresIntervention,
    ).length;
    const interventionRate = interventionCount / examples.length;

    if (interventionRate > 0.5) {
      // >50% require intervention
      patterns.push({
        pattern: "high_intervention_rate",
        frequency: interventionRate,
        severity: "high",
        suggestedAction: "strengthen_preventive_policy",
      });
    }

    return patterns;
  }

  /**
   * Generate policy adaptations from patterns
   */
  private generateAdaptations(patterns: LearningPattern[]): PolicyAdaptation[] {
    const adaptations: PolicyAdaptation[] = [];

    for (const pattern of patterns) {
      switch (pattern.suggestedAction) {
        case "tighten_threshold_policy":
          adaptations.push({
            policyName: "threshold-drift-detection",
            change: "level: warn → error",
            reason: `High drift rate detected (${(
              pattern.frequency * 100
            ).toFixed(1)}%)`,
            impact: "More strict drift detection",
            timestamp: new Date().toISOString(),
            autoApplied: true,
          });
          break;

        case "relax_warning_policy":
          adaptations.push({
            policyName: "orphan-module-detection",
            change: "threshold: 5 → 10",
            reason: `Low anomaly rate (${(pattern.frequency * 100).toFixed(
              1,
            )}%)`,
            impact: "Less noisy warnings",
            timestamp: new Date().toISOString(),
            autoApplied: true,
          });
          break;

        case "strengthen_preventive_policy":
          adaptations.push({
            policyName: "quality-degradation",
            change: "threshold: 0.80 → 0.85",
            reason: `High intervention rate (${(
              pattern.frequency * 100
            ).toFixed(1)}%)`,
            impact: "Earlier quality warnings",
            timestamp: new Date().toISOString(),
            autoApplied: true,
          });
          break;
      }
    }

    return adaptations;
  }

  /**
   * Apply policy adaptation
   */
  private async applyAdaptation(adaptation: PolicyAdaptation): Promise<void> {
    console.log(`\n🧬 [Self-Correction] Applying adaptation:`);
    console.log(`   Policy: ${adaptation.policyName}`);
    console.log(`   Change: ${adaptation.change}`);
    console.log(`   Reason: ${adaptation.reason}`);

    try {
      // Load current policies
      const policies = loadYaml(readFileSync(this.policyPath, "utf8")) as any;

      // Apply change (simplified - real implementation would be more sophisticated)
      const policy = policies.policies.find(
        (p: any) => p.name === adaptation.policyName,
      );

      if (policy) {
        // Example: Change level
        if (adaptation.change.includes("level:")) {
          const newLevel = adaptation.change.split("→")[1].trim();
          policy.level = newLevel;
        }

        // Write updated policies
        writeFileSync(this.policyPath, dumpYaml(policies));

        // Log adaptation
        appendFileSync(
          this.adaptationLogPath,
          JSON.stringify(adaptation) + "\n",
        );

        console.log(`   ✅ Applied successfully`);
      } else {
        console.log(`   ⚠️  Policy not found: ${adaptation.policyName}`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to apply adaptation:`, error);
    }
  }

  /**
   * Get recent adaptations
   */
  getRecentAdaptations(limit: number = 10): PolicyAdaptation[] {
    if (!existsSync(this.adaptationLogPath)) {
      return [];
    }

    const content = readFileSync(this.adaptationLogPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    return lines
      .slice(-limit)
      .map((line) => JSON.parse(line) as PolicyAdaptation)
      .reverse();
  }
}
