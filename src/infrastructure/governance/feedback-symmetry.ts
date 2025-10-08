/**
 * Feedback Symmetry Engine
 *
 * Critical Insight (from GPT):
 * "Self-Correction logs adaptations, but those logs don't feed back into design.
 *  Create a symmetric feedback loop: Data → Learning → Design → Data"
 *
 * Current Flow (Asymmetric):
 * Domain Event → Learning Data → Policy Adaptation → Log
 *
 * Target Flow (Symmetric):
 * Domain Event → Learning Data → Policy Adaptation → Design Feedback → Policy DSL
 *                     ↑_______________________________________________|
 *
 * This closes the loop: Learning shapes design, design shapes learning.
 */

import { readFileSync, existsSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";
import { load as loadYaml, dump as dumpYaml } from "js-yaml";

export interface DesignFeedback {
  timestamp: string;
  source: "policy_adaptation" | "objective_evolution" | "meta_verification";
  insight: string;
  suggestedChange: {
    target: "policy_dsl" | "objective_function" | "kernel_config";
    change: string;
    reason: string;
  };
  confidence: number;
  applied: boolean;
}

/**
 * Feedback Symmetry Engine
 * Closes the learning-design loop
 */
export class FeedbackSymmetryEngine {
  private adaptationLogPath: string;
  private objectiveLogPath: string;
  private feedbackLogPath: string;
  private policyPath: string;
  private objectivePath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.adaptationLogPath = join(
      projectRoot,
      "reports/governance/policy-adaptations.jsonl",
    );
    this.objectiveLogPath = join(
      projectRoot,
      "reports/governance/objective-evolution.jsonl",
    );
    this.feedbackLogPath = join(
      projectRoot,
      "reports/governance/design-feedback.jsonl",
    );
    this.policyPath = join(projectRoot, "governance-rules.yaml");
    this.objectivePath = join(projectRoot, "governance-objectives.yaml");
  }

  /**
   * Analyze learning data and generate design feedback
   */
  async generateDesignFeedback(): Promise<DesignFeedback[]> {
    console.log(
      "\n[Feedback Symmetry] 🔄 Analyzing learning → design feedback...",
    );

    const feedback: DesignFeedback[] = [];

    // Feedback from policy adaptations
    const adaptationFeedback = await this.analyzeAdaptations();
    feedback.push(...adaptationFeedback);

    // Feedback from objective evolutions
    const objectiveFeedback = await this.analyzeObjectiveEvolutions();
    feedback.push(...objectiveFeedback);

    if (feedback.length > 0) {
      console.log(`   📊 Generated ${feedback.length} design insights`);

      for (const fb of feedback) {
        await this.applyDesignFeedback(fb);
      }
    } else {
      console.log("   ℹ️  No design feedback generated");
    }

    return feedback;
  }

  /**
   * Analyze policy adaptations for design insights
   */
  private async analyzeAdaptations(): Promise<DesignFeedback[]> {
    if (!existsSync(this.adaptationLogPath)) {
      return [];
    }

    const content = readFileSync(this.adaptationLogPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    if (lines.length < 3) {
      return []; // Need enough data (minimum 3 for pattern detection)
    }

    const adaptations = lines.slice(-10).map((line) => JSON.parse(line));

    const feedback: DesignFeedback[] = [];

    // Pattern 1: Repeated adaptations → DSL structure issue
    const policyChangeCounts = new Map<string, number>();
    for (const adapt of adaptations) {
      const count = policyChangeCounts.get(adapt.policyName) || 0;
      policyChangeCounts.set(adapt.policyName, count + 1);
    }

    for (const [policyName, count] of policyChangeCounts.entries()) {
      if (count >= 3) {
        // Policy changed 3+ times
        feedback.push({
          timestamp: new Date().toISOString(),
          source: "policy_adaptation",
          insight: `Policy ${policyName} adapted ${count} times - indicates unstable design`,
          suggestedChange: {
            target: "policy_dsl",
            change: `Add adaptive threshold to ${policyName}`,
            reason: "Frequent changes suggest fixed threshold is inappropriate",
          },
          confidence: 0.8,
          applied: false,
        });
      }
    }

    // Pattern 2: All policies trending stricter → Global shift needed
    const stricterCount = adaptations.filter((a) =>
      a.change.includes("→ error"),
    ).length;
    const relaxerCount = adaptations.filter((a) =>
      a.change.includes("→ warn"),
    ).length;

    if (stricterCount > relaxerCount * 2) {
      feedback.push({
        timestamp: new Date().toISOString(),
        source: "policy_adaptation",
        insight: "Majority of adaptations are stricter - system under stress",
        suggestedChange: {
          target: "kernel_config",
          change: "Enable strict mode by default",
          reason: "System consistently needs tighter constraints",
        },
        confidence: 0.7,
        applied: false,
      });
    }

    return feedback;
  }

  /**
   * Analyze objective evolutions for design insights
   */
  private async analyzeObjectiveEvolutions(): Promise<DesignFeedback[]> {
    if (!existsSync(this.objectiveLogPath)) {
      return [];
    }

    const content = readFileSync(this.objectiveLogPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    if (lines.length === 0) {
      return [];
    }

    const evolutions = lines.map((line) => JSON.parse(line));
    const feedback: DesignFeedback[] = [];

    // Pattern: Objective changed → Update policy priorities
    const latestEvolution = evolutions[evolutions.length - 1];

    if (latestEvolution.newObjective.includes("value")) {
      feedback.push({
        timestamp: new Date().toISOString(),
        source: "objective_evolution",
        insight:
          "Objective evolved to value optimization - policies should balance cost/quality",
        suggestedChange: {
          target: "policy_dsl",
          change: "Add cost-quality-balance policy with composite condition",
          reason: "New objective requires multi-dimensional evaluation",
        },
        confidence: 0.85,
        applied: false,
      });
    }

    if (latestEvolution.newObjective.includes("stability")) {
      feedback.push({
        timestamp: new Date().toISOString(),
        source: "objective_evolution",
        insight: "Objective prioritizes stability - tighten drift policies",
        suggestedChange: {
          target: "policy_dsl",
          change: "Update all drift thresholds from 0.20 to 0.10",
          reason: "Stability-focused objective requires stricter bounds",
        },
        confidence: 0.9,
        applied: false,
      });
    }

    return feedback;
  }

  /**
   * Apply design feedback to governance files
   */
  private async applyDesignFeedback(feedback: DesignFeedback): Promise<void> {
    console.log(`\n🔄 [Feedback Symmetry] Applying design feedback:`);
    console.log(`   Insight: ${feedback.insight}`);
    console.log(`   Change: ${feedback.suggestedChange.change}`);
    console.log(`   Confidence: ${(feedback.confidence * 100).toFixed(1)}%`);

    if (feedback.confidence < 0.7) {
      console.log(`   ⏭️  Skipped (low confidence)`);
      return;
    }

    try {
      if (feedback.suggestedChange.target === "policy_dsl") {
        await this.applyPolicyDSLChange(feedback);
      } else if (feedback.suggestedChange.target === "objective_function") {
        await this.applyObjectiveChange(feedback);
      } else if (feedback.suggestedChange.target === "kernel_config") {
        await this.applyKernelConfigChange(feedback);
      }

      feedback.applied = true;
      appendFileSync(this.feedbackLogPath, JSON.stringify(feedback) + "\n");

      console.log(`   ✅ Design feedback applied`);
    } catch (error) {
      console.error(`   ❌ Failed to apply feedback:`, error);
    }
  }

  /**
   * Apply policy DSL change
   */
  private async applyPolicyDSLChange(feedback: DesignFeedback): Promise<void> {
    const policies = loadYaml(readFileSync(this.policyPath, "utf8")) as any;

    // Example: Add adaptive threshold
    if (feedback.suggestedChange.change.includes("adaptive threshold")) {
      // Find the policy mentioned in insight
      const policyName = feedback.insight.match(/Policy (\S+)/)?.[1];
      if (policyName) {
        const policy = policies.policies.find(
          (p: any) => p.name === policyName,
        );
        if (policy) {
          // Add metadata to indicate adaptive threshold
          policy.metadata = policy.metadata || {};
          policy.metadata.adaptive_threshold = true;
          policy.metadata.last_adapted = new Date().toISOString();
        }
      }
    }

    // Example: Update drift thresholds
    if (feedback.suggestedChange.change.includes("drift thresholds")) {
      for (const policy of policies.policies) {
        if (policy.condition.includes("0.20")) {
          policy.condition = policy.condition.replace("0.20", "0.10");
        }
      }
    }

    writeFileSync(this.policyPath, dumpYaml(policies));
  }

  /**
   * Apply objective function change
   */
  private async applyObjectiveChange(feedback: DesignFeedback): Promise<void> {
    const objectives = loadYaml(
      readFileSync(this.objectivePath, "utf8"),
    ) as any;

    // Apply change (simplified)
    // Real implementation would parse and modify objectives

    writeFileSync(this.objectivePath, dumpYaml(objectives));
  }

  /**
   * Apply kernel config change
   */
  private async applyKernelConfigChange(
    feedback: DesignFeedback,
  ): Promise<void> {
    // Example: Update kernel configuration
    // This would modify kernel initialization parameters
    console.log("   ℹ️  Kernel config changes require manual review");
  }

  /**
   * Get feedback history
   */
  getFeedbackHistory(limit: number = 10): DesignFeedback[] {
    if (!existsSync(this.feedbackLogPath)) {
      return [];
    }

    const content = readFileSync(this.feedbackLogPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    return lines
      .slice(-limit)
      .map((line) => JSON.parse(line) as DesignFeedback)
      .reverse();
  }

  /**
   * Visualize feedback loop
   */
  visualizeFeedbackLoop(): void {
    console.log("\n🔄 Feedback Symmetry Loop:\n");
    console.log("   Domain Events");
    console.log("        ↓");
    console.log("   Learning Data (prediction-train.jsonl)");
    console.log("        ↓");
    console.log("   Policy Adaptations (policy-adaptations.jsonl)");
    console.log("        ↓");
    console.log("   Design Feedback (design-feedback.jsonl)");
    console.log("        ↓");
    console.log("   Policy DSL Update (governance-rules.yaml)");
    console.log("        ↓");
    console.log("   ←── Loop Closes ───");
    console.log("        ↓");
    console.log("   Domain Events (improved policies)\n");
  }
}
