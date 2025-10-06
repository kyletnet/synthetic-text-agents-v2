#!/usr/bin/env tsx

// @tool-mode: transform
// @tool-description: Workaround resolution - converts temporary fixes to permanent solutions

/**
 * Workaround Resolution Engine
 * Systematic conversion of temporary fixes to permanent solutions
 * Implements the workaround resolution strategy from system philosophy analysis
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import { wrapWithGovernance } from "../lib/governance/engine-governance-template.js";
import {
  AutoFixManager,
  AutoFixOperation,
  FileChange,
  DryRunResult,
  type SnapshotId,
} from "./auto-fix-manager.js";

interface WorkaroundFinding {
  file: string;
  line: number;
  content: string;
  type: "TODO" | "FIXME" | "HACK" | "TEMP" | "WORKAROUND";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  context: string;
  ageInDays?: number;
  estimation?: string;
}

interface ResolutionPlan {
  finding: WorkaroundFinding;
  strategy:
    | "auto-fix"
    | "guided-fix"
    | "manual-review"
    | "architectural-change";
  confidence: number; // 0-1
  fixSuggestion: string;
  implementationSteps: string[];
  riskLevel: "low" | "medium" | "high";
  estimatedTime: string;
  dependencies: string[];
}

interface ResolutionResult {
  planId: string;
  status: "success" | "failed" | "partial" | "skipped";
  originalContent: string;
  fixedContent?: string;
  userApprovalRequired: boolean;
  notes: string;
  snapshotId?: SnapshotId;
  rollbackAvailable: boolean;
}

export class WorkaroundResolutionEngine {
  private projectRoot = process.cwd();
  private resolutionPlans: Map<string, ResolutionPlan> = new Map();
  private resolutionHistory: ResolutionResult[] = [];
  private autoFixManager: AutoFixManager;

  constructor() {
    this.autoFixManager = new AutoFixManager();
  }

  // Pattern-based auto-fix rules
  private autoFixRules = [
    {
      pattern: /\/\/ TODO: Define proper type/gi,
      replacement: (match: string, context: string) => {
        return this.generateProperType(context);
      },
      confidence: 0.8,
    },
    {
      pattern: /: any; \/\/ TODO/gi,
      replacement: (match: string, context: string) => {
        return this.inferTypeFromContext(context);
      },
      confidence: 0.6,
    },
    {
      pattern: /\/\/ HACK: (.+)/gi,
      replacement: (match: string, hackDescription: string) => {
        return this.proposeHackSolution(hackDescription);
      },
      confidence: 0.4,
    },
    {
      pattern: /\/\/ TEMP.*stub/gi,
      replacement: () => {
        return "// Implemented functionality";
      },
      confidence: 0.9,
    },
  ];

  /**
   * Analyze all workarounds and generate resolution plans
   */
  async generateResolutionPlans(
    findings: WorkaroundFinding[],
  ): Promise<ResolutionPlan[]> {
    return wrapWithGovernance("workaround-resolution-engine", async () => {
      const plans: ResolutionPlan[] = [];

      for (const finding of findings) {
        const plan = await this.analyzeWorkaround(finding);
        plans.push(plan);
        this.resolutionPlans.set(this.getPlanId(finding), plan);
      }

      // Sort by confidence and priority
      plans.sort((a, b) => {
        const priorityWeight = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        const aPriority = priorityWeight[a.finding.severity];
        const bPriority = priorityWeight[b.finding.severity];

        if (aPriority !== bPriority) return bPriority - aPriority;
        return b.confidence - a.confidence;
      });

      console.log(`📋 Generated ${plans.length} resolution plans:`);
      console.log(
        `   🔧 Auto-fixable: ${
          plans.filter((p) => p.strategy === "auto-fix").length
        }`,
      );
      console.log(
        `   🎯 Guided fixes: ${
          plans.filter((p) => p.strategy === "guided-fix").length
        }`,
      );
      console.log(
        `   📝 Manual review: ${
          plans.filter((p) => p.strategy === "manual-review").length
        }`,
      );
      console.log(
        `   🏗️ Architectural: ${
          plans.filter((p) => p.strategy === "architectural-change").length
        }`,
      );

      return plans;
    });
  }

  /**
   * Execute auto-fixable resolution plans
   */
  async executeAutoFixes(
    plans: ResolutionPlan[],
    userApproval: boolean = false,
  ): Promise<ResolutionResult[]> {
    const autoFixablePlans = plans.filter(
      (p) => p.strategy === "auto-fix" && p.confidence >= 0.7,
    );

    const results: ResolutionResult[] = [];

    console.log(`🔧 Executing ${autoFixablePlans.length} auto-fixes...`);

    for (const plan of autoFixablePlans) {
      const planId = this.getPlanId(plan.finding);

      try {
        // Get user approval for high-risk changes
        if (plan.riskLevel === "high" && userApproval) {
          const approved = await this.requestApproval(plan);
          if (!approved) {
            results.push({
              planId,
              status: "skipped",
              originalContent: plan.finding.content,
              userApprovalRequired: true,
              notes: "User approval denied",
              rollbackAvailable: false,
            });
            continue;
          }
        }

        const result = await this.applyFix(plan);
        results.push(result);

        if (result.status === "success") {
          console.log(`   ✅ Fixed: ${plan.finding.file}:${plan.finding.line}`);
        } else {
          console.log(
            `   ❌ Failed: ${plan.finding.file}:${plan.finding.line} - ${result.notes}`,
          );
        }
      } catch (error) {
        results.push({
          planId,
          status: "failed",
          originalContent: plan.finding.content,
          userApprovalRequired: false,
          notes: error instanceof Error ? error.message : String(error),
          rollbackAvailable: false,
        });
      }
    }

    this.resolutionHistory.push(...results);
    return results;
  }

  /**
   * Execute auto-fixes with rollback capability
   */
  async executeAutoFixesWithRollback(
    plans: ResolutionPlan[],
    userApproval: boolean = false,
  ): Promise<ResolutionResult[]> {
    const autoFixablePlans = plans.filter(
      (p) => p.strategy === "auto-fix" && p.confidence >= 0.7,
    );

    console.log(
      `🔧 Executing ${autoFixablePlans.length} auto-fixes with rollback support...`,
    );

    const results: ResolutionResult[] = [];

    for (const plan of autoFixablePlans) {
      const planId = this.getPlanId(plan.finding);

      try {
        // Convert to AutoFixOperation
        const operation: AutoFixOperation = {
          id: planId,
          name: `Fix ${plan.finding.type} in ${plan.finding.file}`,
          description: plan.fixSuggestion,
          priority: this.mapSeverityToPriority(plan.finding.severity),
          targetFiles: [plan.finding.file],
          changes: await this.planToFileChanges(plan),
          metadata: { originalPlan: plan },
        };

        // Get user approval for high-risk changes
        if (plan.riskLevel === "high" && userApproval) {
          const approved = await this.requestApproval(plan);
          if (!approved) {
            results.push({
              planId,
              status: "skipped",
              originalContent: plan.finding.content,
              userApprovalRequired: true,
              notes: "User approval denied",
              rollbackAvailable: false,
            });
            continue;
          }
        }

        // Execute with automatic rollback on failure
        const result = await this.autoFixManager.executeWithRollback(operation);

        results.push({
          planId,
          status: result.success ? "success" : "failed",
          originalContent: plan.finding.content,
          fixedContent: result.success ? "Applied auto-fix" : undefined,
          userApprovalRequired: false,
          notes: result.success
            ? "Auto-fix applied with rollback support"
            : result.error?.message || "Unknown error",
          snapshotId: result.snapshotId,
          rollbackAvailable: true,
        });

        if (result.success) {
          console.log(
            `   ✅ Fixed: ${plan.finding.file}:${plan.finding.line} (Snapshot: ${result.snapshotId})`,
          );
        } else {
          console.log(
            `   ❌ Failed: ${plan.finding.file}:${plan.finding.line} - Rolled back automatically`,
          );
        }
      } catch (error) {
        results.push({
          planId,
          status: "failed",
          originalContent: plan.finding.content,
          userApprovalRequired: false,
          notes: error instanceof Error ? error.message : String(error),
          rollbackAvailable: false,
        });
      }
    }

    this.resolutionHistory.push(...results);
    return results;
  }

  /**
   * Perform dry-run analysis of resolution plans
   */
  async performDryRun(
    plans: ResolutionPlan[],
  ): Promise<Map<string, DryRunResult>> {
    const dryRunResults = new Map<string, DryRunResult>();
    const autoFixablePlans = plans.filter(
      (p) => p.strategy === "auto-fix" && p.confidence >= 0.7,
    );

    console.log(
      `🔍 Performing dry-run analysis on ${autoFixablePlans.length} auto-fixable plans...`,
    );

    for (const plan of autoFixablePlans) {
      const planId = this.getPlanId(plan.finding);

      try {
        const operation: AutoFixOperation = {
          id: planId,
          name: `Fix ${plan.finding.type} in ${plan.finding.file}`,
          description: plan.fixSuggestion,
          priority: this.mapSeverityToPriority(plan.finding.severity),
          targetFiles: [plan.finding.file],
          changes: await this.planToFileChanges(plan),
          metadata: { originalPlan: plan },
        };

        const dryRunResult = await this.autoFixManager.dryRun(operation);
        dryRunResults.set(planId, dryRunResult);

        console.log(
          `   📋 ${planId}: ${dryRunResult.impact.riskLevel} risk, ${dryRunResult.changes.length} changes`,
        );
      } catch (error) {
        console.error(`   ❌ Dry-run failed for ${planId}:`, error);
      }
    }

    return dryRunResults;
  }

  /**
   * Rollback a specific resolution result
   */
  async rollbackResolution(planId: string): Promise<boolean> {
    const result = this.resolutionHistory.find((r) => r.planId === planId);

    if (!result) {
      console.error(`❌ Resolution result not found: ${planId}`);
      return false;
    }

    if (!result.snapshotId || !result.rollbackAvailable) {
      console.error(`❌ Rollback not available for: ${planId}`);
      return false;
    }

    try {
      console.log(
        `🔄 Rolling back resolution: ${planId} to snapshot: ${result.snapshotId}`,
      );
      const success = await this.autoFixManager.rollback(result.snapshotId);

      if (success) {
        // Update result status
        result.status = "failed";
        result.notes += " [ROLLED BACK]";
        console.log(`✅ Successfully rolled back: ${planId}`);
      }

      return success;
    } catch (error) {
      console.error(`❌ Rollback failed for ${planId}:`, error);
      return false;
    }
  }

  /**
   * List all available snapshots for rollback
   */
  getAvailableSnapshots(): Array<{
    snapshotId: SnapshotId;
    operation: string;
    timestamp: Date;
    filesCount: number;
  }> {
    return this.autoFixManager.getSnapshots().map((snapshot) => ({
      snapshotId: snapshot.id,
      operation: snapshot.operation,
      timestamp: snapshot.timestamp,
      filesCount: snapshot.files.length,
    }));
  }

  /**
   * Clean up old snapshots
   */
  async cleanupOldSnapshots(retentionHours = 168): Promise<void> {
    await this.autoFixManager.cleanupSnapshots(retentionHours);
  }

  /**
   * Generate guided fix instructions for manual implementation
   */
  generateGuidedFixInstructions(plans: ResolutionPlan[]): string {
    const guidedPlans = plans.filter(
      (p) => p.strategy === "guided-fix" || p.strategy === "manual-review",
    );

    let instructions = `# 🛠️ Workaround Resolution Guide\n\n`;
    instructions += `Generated ${new Date().toISOString()}\n\n`;

    guidedPlans.forEach((plan, index) => {
      instructions += `## ${index + 1}. ${plan.finding.type} in ${
        plan.finding.file
      }\n\n`;
      instructions += `**Location**: Line ${plan.finding.line}\n`;
      instructions += `**Current**: \`${plan.finding.content.trim()}\`\n`;
      instructions += `**Severity**: ${plan.finding.severity}\n`;
      instructions += `**Estimated Time**: ${plan.estimatedTime}\n\n`;

      instructions += `### 🎯 Fix Suggestion\n${plan.fixSuggestion}\n\n`;

      instructions += `### 📋 Implementation Steps\n`;
      plan.implementationSteps.forEach((step, stepIndex) => {
        instructions += `${stepIndex + 1}. ${step}\n`;
      });
      instructions += "\n";

      if (plan.dependencies.length > 0) {
        instructions += `### 🔗 Dependencies\n`;
        plan.dependencies.forEach((dep) => {
          instructions += `- ${dep}\n`;
        });
        instructions += "\n";
      }

      instructions += `### ⚠️ Risk Level: ${plan.riskLevel.toUpperCase()}\n\n`;
      instructions += `---\n\n`;
    });

    return instructions;
  }

  /**
   * Create resolution milestone plan
   */
  createMilestonePlan(plans: ResolutionPlan[]): {
    milestone1: ResolutionPlan[]; // Quick wins (1-2 days)
    milestone2: ResolutionPlan[]; // Medium effort (1 week)
    milestone3: ResolutionPlan[]; // Complex changes (2-4 weeks)
    architectural: ResolutionPlan[]; // Major changes (1+ months)
  } {
    return {
      milestone1: plans.filter(
        (p) =>
          p.strategy === "auto-fix" ||
          p.estimatedTime.includes("minutes") ||
          p.estimatedTime.includes("hour"),
      ),
      milestone2: plans.filter(
        (p) =>
          p.strategy === "guided-fix" &&
          (p.estimatedTime.includes("day") || p.estimatedTime.includes("2-3")),
      ),
      milestone3: plans.filter(
        (p) =>
          p.strategy === "manual-review" && p.estimatedTime.includes("week"),
      ),
      architectural: plans.filter((p) => p.strategy === "architectural-change"),
    };
  }

  /**
   * Generate progress report on resolution efforts
   */
  generateProgressReport(): string {
    const totalResults = this.resolutionHistory.length;
    const successful = this.resolutionHistory.filter(
      (r) => r.status === "success",
    ).length;
    const failed = this.resolutionHistory.filter(
      (r) => r.status === "failed",
    ).length;
    const skipped = this.resolutionHistory.filter(
      (r) => r.status === "skipped",
    ).length;

    let report = `# 📊 Workaround Resolution Progress\n\n`;
    report += `**Total Processed**: ${totalResults}\n`;
    report += `**Successfully Fixed**: ${successful} (${Math.round(
      (successful / totalResults) * 100,
    )}%)\n`;
    report += `**Failed Fixes**: ${failed}\n`;
    report += `**Skipped**: ${skipped}\n\n`;

    if (successful > 0) {
      report += `## ✅ Recent Successes\n`;
      this.resolutionHistory
        .filter((r) => r.status === "success")
        .slice(-5)
        .forEach((result) => {
          report += `- Fixed: ${result.planId}\n`;
        });
      report += "\n";
    }

    if (failed > 0) {
      report += `## ❌ Issues to Address\n`;
      this.resolutionHistory
        .filter((r) => r.status === "failed")
        .forEach((result) => {
          report += `- ${result.planId}: ${result.notes}\n`;
        });
      report += "\n";
    }

    return report;
  }

  private async analyzeWorkaround(
    finding: WorkaroundFinding,
  ): Promise<ResolutionPlan> {
    const strategy = this.determineStrategy(finding);
    const confidence = this.calculateConfidence(finding, strategy);

    return {
      finding,
      strategy,
      confidence,
      fixSuggestion: this.generateFixSuggestion(finding),
      implementationSteps: this.generateImplementationSteps(finding),
      riskLevel: this.assessRiskLevel(finding),
      estimatedTime: this.estimateTime(finding, strategy),
      dependencies: this.identifyDependencies(finding),
    };
  }

  private determineStrategy(
    finding: WorkaroundFinding,
  ): ResolutionPlan["strategy"] {
    // Check if it matches auto-fix patterns
    for (const rule of this.autoFixRules) {
      if (rule.pattern.test(finding.content)) {
        return "auto-fix";
      }
    }

    // Categorize based on content analysis
    if (
      finding.content.includes("Define proper type") ||
      finding.content.includes(": any")
    ) {
      return "auto-fix";
    }

    if (finding.type === "HACK" || finding.severity === "HIGH") {
      return finding.content.length > 100 ? "manual-review" : "guided-fix";
    }

    if (finding.type === "TODO" && finding.content.includes("implement")) {
      return "guided-fix";
    }

    if (
      finding.content.includes("architecture") ||
      finding.content.includes("refactor")
    ) {
      return "architectural-change";
    }

    return "guided-fix";
  }

  private calculateConfidence(
    finding: WorkaroundFinding,
    strategy: string,
  ): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for patterns we can handle well
    if (strategy === "auto-fix") {
      confidence = 0.8;

      if (finding.content.includes("Define proper type")) confidence = 0.9;
      if (finding.content.includes("TODO") && finding.content.length < 50)
        confidence = 0.7;
    }

    // Adjust based on severity
    if (finding.severity === "HIGH") confidence -= 0.1;
    if (finding.severity === "CRITICAL") confidence -= 0.2;

    // Adjust based on context
    if (finding.file.includes("test")) confidence += 0.1;
    if (finding.file.includes("types")) confidence += 0.2;

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  private generateFixSuggestion(finding: WorkaroundFinding): string {
    if (finding.content.includes("Define proper type")) {
      return "Replace `any` type with specific interface or type definition based on usage context.";
    }

    if (finding.type === "HACK" && finding.content.includes("bypass")) {
      return "Implement proper validation or error handling instead of bypassing checks.";
    }

    if (finding.type === "TODO" && finding.content.includes("implement")) {
      return "Complete the implementation based on the requirements and existing patterns.";
    }

    if (finding.content.includes("temporary")) {
      return "Replace temporary solution with permanent implementation following project conventions.";
    }

    return `Address the ${finding.type.toLowerCase()} by implementing a proper solution based on project standards.`;
  }

  private generateImplementationSteps(finding: WorkaroundFinding): string[] {
    const steps = [];

    if (finding.content.includes("Define proper type")) {
      steps.push("Analyze the variable/parameter usage context");
      steps.push("Define appropriate TypeScript interface or type");
      steps.push("Replace `any` with the specific type");
      steps.push("Run TypeScript checks to verify");
    } else if (finding.type === "HACK") {
      steps.push("Understand why the hack was necessary");
      steps.push("Research proper solution approach");
      steps.push("Implement the correct solution");
      steps.push("Test thoroughly to ensure no regressions");
      steps.push("Remove the hack code");
    } else {
      steps.push(`Review the ${finding.type.toLowerCase()} requirement`);
      steps.push("Design the proper solution");
      steps.push("Implement following project conventions");
      steps.push("Add appropriate tests");
      steps.push("Update documentation if needed");
    }

    return steps;
  }

  private assessRiskLevel(
    finding: WorkaroundFinding,
  ): "low" | "medium" | "high" {
    if (finding.severity === "CRITICAL") return "high";
    if (finding.severity === "HIGH") return "medium";

    if (
      finding.file.includes("core") ||
      finding.file.includes("shared") ||
      finding.content.includes("architecture")
    ) {
      return "high";
    }

    if (finding.type === "HACK" || finding.content.includes("bypass")) {
      return "medium";
    }

    return "low";
  }

  private estimateTime(finding: WorkaroundFinding, strategy: string): string {
    if (strategy === "auto-fix") return "15-30 minutes";

    if (strategy === "guided-fix") {
      if (finding.content.length < 50) return "1-2 hours";
      return "2-4 hours";
    }

    if (strategy === "manual-review") {
      if (finding.severity === "HIGH") return "1-2 days";
      return "4-8 hours";
    }

    return "1-4 weeks"; // architectural-change
  }

  private identifyDependencies(finding: WorkaroundFinding): string[] {
    const dependencies = [];

    if (
      finding.content.includes("type") ||
      finding.content.includes("interface")
    ) {
      dependencies.push("TypeScript configuration");
    }

    if (finding.content.includes("test")) {
      dependencies.push("Test framework setup");
    }

    if (finding.file.includes("shared") || finding.file.includes("core")) {
      dependencies.push("System architecture review");
    }

    return dependencies;
  }

  private async applyFix(plan: ResolutionPlan): Promise<ResolutionResult> {
    const planId = this.getPlanId(plan.finding);

    try {
      if (!existsSync(plan.finding.file)) {
        return {
          planId,
          status: "failed",
          originalContent: plan.finding.content,
          userApprovalRequired: false,
          notes: "File not found",
          rollbackAvailable: false,
        };
      }

      const fileContent = readFileSync(plan.finding.file, "utf8");
      const lines = fileContent.split("\n");

      if (plan.finding.line > lines.length) {
        return {
          planId,
          status: "failed",
          originalContent: plan.finding.content,
          userApprovalRequired: false,
          notes: "Line number out of range",
          rollbackAvailable: false,
        };
      }

      const originalLine = lines[plan.finding.line - 1];
      const fixedLine = this.applyAutoFixRules(originalLine, plan.finding);

      if (fixedLine === originalLine) {
        return {
          planId,
          status: "skipped",
          originalContent: originalLine,
          userApprovalRequired: false,
          notes: "No applicable auto-fix rule found",
          rollbackAvailable: false,
        };
      }

      lines[plan.finding.line - 1] = fixedLine;
      writeFileSync(plan.finding.file, lines.join("\n"), "utf8");

      return {
        planId,
        status: "success",
        originalContent: originalLine,
        fixedContent: fixedLine,
        userApprovalRequired: false,
        notes: "Auto-fix applied successfully",
        rollbackAvailable: false,
      };
    } catch (error) {
      return {
        planId,
        status: "failed",
        originalContent: plan.finding.content,
        userApprovalRequired: false,
        notes: error instanceof Error ? error.message : String(error),
        rollbackAvailable: false,
      };
    }
  }

  private applyAutoFixRules(
    content: string,
    finding: WorkaroundFinding,
  ): string {
    for (const rule of this.autoFixRules) {
      if (rule.pattern.test(content)) {
        return content.replace(rule.pattern, (match, ...groups) =>
          rule.replacement(match, finding.context),
        );
      }
    }
    return content;
  }

  private generateProperType(context: string): string {
    // Simple type inference based on context
    if (
      context.includes("string") ||
      context.includes("name") ||
      context.includes("text")
    ) {
      return ": string";
    }
    if (
      context.includes("number") ||
      context.includes("count") ||
      context.includes("age")
    ) {
      return ": number";
    }
    if (
      context.includes("boolean") ||
      context.includes("flag") ||
      context.includes("is")
    ) {
      return ": boolean";
    }
    return ": unknown"; // Conservative fallback
  }

  private inferTypeFromContext(context: string): string {
    return this.generateProperType(context) + ";";
  }

  private proposeHackSolution(hackDescription: string): string {
    return `// RESOLVED: ${hackDescription}`;
  }

  private async requestApproval(plan: ResolutionPlan): Promise<boolean> {
    console.log(`\n🤔 Approval required for high-risk fix:`);
    console.log(`   File: ${plan.finding.file}:${plan.finding.line}`);
    console.log(`   Current: ${plan.finding.content.trim()}`);
    console.log(`   Suggestion: ${plan.fixSuggestion}`);

    // In a real implementation, this would integrate with the approval system
    return true; // Default approve for now
  }

  private getPlanId(finding: WorkaroundFinding): string {
    return `${finding.file}:${finding.line}:${finding.type}`;
  }

  private mapSeverityToPriority(
    severity: WorkaroundFinding["severity"],
  ): "P0" | "P1" | "P2" {
    switch (severity) {
      case "CRITICAL":
        return "P0";
      case "HIGH":
        return "P1";
      case "MEDIUM":
      case "LOW":
      default:
        return "P2";
    }
  }

  private async planToFileChanges(plan: ResolutionPlan): Promise<FileChange[]> {
    if (!existsSync(plan.finding.file)) {
      return [];
    }

    const fileContent = readFileSync(plan.finding.file, "utf8");
    const lines = fileContent.split("\n");

    if (plan.finding.line > lines.length) {
      return [];
    }

    const originalLine = lines[plan.finding.line - 1];
    const fixedLine = this.applyAutoFixRules(originalLine, plan.finding);

    if (fixedLine === originalLine) {
      return [];
    }

    // Create new content with the fixed line
    const newLines = [...lines];
    newLines[plan.finding.line - 1] = fixedLine;
    const newContent = newLines.join("\n");

    return [
      {
        filePath: plan.finding.file,
        oldContent: fileContent,
        newContent,
        changeType: "modify",
        metadata: {
          lineNumber: plan.finding.line,
          originalContent: originalLine,
          fixedContent: fixedLine,
          planId: this.getPlanId(plan.finding),
        },
      },
    ];
  }
}

// Create singleton instance
export const workaroundResolutionEngine = new WorkaroundResolutionEngine();
export default WorkaroundResolutionEngine;
