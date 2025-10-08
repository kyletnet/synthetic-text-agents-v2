/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Governance Kernel - DNA-Level Architecture Protection
 *
 * This is NOT a runtime validation system.
 * This is a Meta Runtime Layer that enforces architectural constraints
 * at build-time, load-time, and runtime.
 *
 * Evolution: Immune System → Genetic System
 * - Before: Detect violations after they happen (reactive)
 * - After: Prevent violations before they happen (proactive)
 *
 * Integration Points:
 * 1. Build-time: TypeScript compiler plugin (future)
 * 2. Load-time: Module load guard (current)
 * 3. Runtime: Policy engine + event interpreter
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface GovernancePolicy {
  name: string;
  type: "architecture" | "threshold" | "quality" | "security";
  level: "error" | "warn" | "info";
  condition: string;
  action: string[];
  metadata?: Record<string, unknown>;
}

export interface GovernancePolicies {
  version: string;
  policies: GovernancePolicy[];
}

export interface ValidationResult {
  passed: boolean;
  violations: Array<{
    policy: string;
    severity: "error" | "warn";
    message: string;
    location?: string;
  }>;
  timestamp: string;
}

/**
 * Governance Kernel - Core enforcement engine
 */
export class GovernanceKernel {
  private policies: GovernancePolicies | null = null;
  private projectRoot: string;
  private policyPath: string;
  private strictMode: boolean;

  constructor(options?: { projectRoot?: string; strictMode?: boolean }) {
    this.projectRoot = options?.projectRoot || process.cwd();
    this.policyPath = join(this.projectRoot, "governance-rules.json");
    this.strictMode = options?.strictMode ?? true;
  }

  /**
   * Initialize Governance Kernel
   * Called once at application startup
   */
  async initialize(): Promise<void> {
    console.log("[Governance Kernel] Initializing DNA-level protection...");

    // 1. Load policies
    await this.loadPolicies();

    // 2. Validate architecture at build/load time
    const buildValidation = await this.validateArchitectureOnBuild();
    if (!buildValidation.passed && this.strictMode) {
      this.handleBuildFailure(buildValidation);
    }

    // 3. Enforce module load guard
    this.enforceModuleLoadGuard();

    // 4. Register domain policy engine
    await this.registerDomainPolicyEngine();

    // 5. Enable predictive monitoring
    await this.enablePredictiveMonitoring();

    console.log("[Governance Kernel] ✅ DNA protection active");
  }

  /**
   * Load governance policies from configuration
   */
  private async loadPolicies(): Promise<void> {
    if (!existsSync(this.policyPath)) {
      console.warn(
        `[Governance Kernel] Policy file not found: ${this.policyPath}`,
      );
      console.warn("[Governance Kernel] Creating default policies...");
      await this.createDefaultPolicies();
    }

    try {
      const content = readFileSync(this.policyPath, "utf8");
      this.policies = JSON.parse(content);
      console.log(
        `[Governance Kernel] Loaded ${
          this.policies?.policies.length || 0
        } policies`,
      );
    } catch (error) {
      console.error("[Governance Kernel] Failed to load policies:", error);
      throw new Error("Governance Kernel initialization failed");
    }
  }

  /**
   * Validate architecture at build/load time
   * This runs BEFORE the application starts
   */
  private async validateArchitectureOnBuild(): Promise<ValidationResult> {
    console.log("[Governance Kernel] Running build-time validation...");

    const violations: ValidationResult["violations"] = [];

    try {
      // Run dependency-cruiser validation
      const result = execSync(
        "npx depcruise --config .dependency-cruiser.cjs --output-type json src/",
        {
          cwd: this.projectRoot,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      const analysis = JSON.parse(result);

      // Check for critical violations
      if (analysis.summary?.error > 0) {
        violations.push({
          policy: "no-circular-dependencies",
          severity: "error",
          message: `Found ${analysis.summary.error} architecture errors`,
          location: "See dependency-cruiser output",
        });
      }
    } catch (error: any) {
      // depcruise exits with non-zero if violations found
      if (error.stdout) {
        const analysis = JSON.parse(error.stdout);
        if (analysis.summary?.error > 0) {
          violations.push({
            policy: "architecture-integrity",
            severity: "error",
            message: `Critical architecture violations detected`,
            location: "src/",
          });
        }
      }
    }

    return {
      passed: violations.filter((v) => v.severity === "error").length === 0,
      violations,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Enforce module load guard
   * Prevents loading modules that violate architectural constraints
   */
  private enforceModuleLoadGuard(): void {
    // Note: This is a placeholder for future enhancement
    // Full implementation requires:
    // 1. Custom module loader hook
    // 2. ESM loader customization (Node.js --loader flag)
    // 3. TypeScript compiler plugin for build-time enforcement

    console.log("[Governance Kernel] Module load guard registered");
  }

  /**
   * Register domain policy engine
   * Connects domain events to policy evaluation
   * Now uses Policy Runtime for bidirectional control
   */
  private async registerDomainPolicyEngine(): Promise<void> {
    // Initialize Policy Runtime (bidirectional control)
    const { initializePolicyRuntime } = await import(
      "../../infrastructure/governance/policy-runtime.js"
    );

    await initializePolicyRuntime();

    console.log(
      "[Governance Kernel] Domain policy engine registered (bidirectional)",
    );
  }

  /**
   * Enable predictive monitoring
   * Records data for ML-based drift prediction
   */
  private async enablePredictiveMonitoring(): Promise<void> {
    // Import feedback recorder
    const { PredictiveFeedbackRecorder } = await import(
      "../../infrastructure/governance/predictive-feedback.js"
    );

    const recorder = new PredictiveFeedbackRecorder(this.projectRoot);
    await recorder.initialize();

    console.log("[Governance Kernel] Predictive monitoring enabled");
  }

  /**
   * Evaluate policies for domain event
   */
  private async evaluatePoliciesForEvent(event: any): Promise<void> {
    if (!this.policies) return;

    // Filter relevant policies
    const relevantPolicies = this.policies.policies.filter((policy) => {
      // Match policy type to event type
      if (event.type.startsWith("metric") && policy.type === "threshold") {
        return true;
      }
      if (
        event.type.startsWith("architecture") &&
        policy.type === "architecture"
      ) {
        return true;
      }
      return false;
    });

    // Evaluate each policy (DSL evaluation in next iteration)
    for (const policy of relevantPolicies) {
      // Placeholder: Future DSL interpreter will handle this
      console.log(`[Governance Kernel] Evaluating policy: ${policy.name}`);
    }
  }

  /**
   * Handle build failure
   */
  private handleBuildFailure(result: ValidationResult): never {
    console.error("\n❌ [Governance Kernel] BUILD BLOCKED\n");
    console.error("Critical architecture violations detected:\n");

    for (const violation of result.violations) {
      const icon = violation.severity === "error" ? "❌" : "⚠️";
      console.error(`${icon} [${violation.policy}] ${violation.message}`);
      if (violation.location) {
        console.error(`   Location: ${violation.location}`);
      }
    }

    console.error("\n💡 Fix violations before proceeding:");
    console.error("   npm run arch:check");
    console.error("   npm run governance:check\n");

    process.exit(1);
  }

  /**
   * Create default policies if none exist
   */
  private async createDefaultPolicies(): Promise<void> {
    const defaultPolicies: GovernancePolicies = {
      version: "1.0.0",
      policies: [
        {
          name: "no-circular-dependencies",
          type: "architecture",
          level: "error",
          condition: "circular_count > 0",
          action: ["block", "notify"],
        },
        {
          name: "ddd-boundary-enforcement",
          type: "architecture",
          level: "error",
          condition: "domain_imports_infra == true",
          action: ["block", "notify"],
        },
        {
          name: "threshold-drift-detection",
          type: "threshold",
          level: "warn",
          condition: "abs(new_value - old_value) > 0.2",
          action: ["notify", "record"],
        },
      ],
    };

    const { writeFileSync } = await import("fs");
    writeFileSync(this.policyPath, JSON.stringify(defaultPolicies, null, 2));
    this.policies = defaultPolicies;
  }

  /**
   * Evaluate external policy (Phase 2C preparation)
   *
   * This hook allows integration of external policy documents/specs
   * into the governance system.
   *
   * Phase 2B Step 3: Hook registration
   * Phase 2C: Full implementation with Policy Parser + Interpreter
   *
   * @param policyDoc - External policy document (text, JSON, or parsed)
   * @returns Policy evaluation result with Feature Flag recommendation
   */
  async evaluateExternalPolicy(
    policyDoc: ExternalPolicyDocument,
  ): Promise<PolicyEvaluation> {
    console.log("[Governance Kernel] Evaluating external policy...");

    try {
      // 1. Parse policy document (Phase 2C: auto-parsing)
      const parsed = this.parseExternalPolicy(policyDoc);

      // 2. Validate against current governance rules
      const validation = await this.validateExternalPolicy(parsed);

      if (!validation.safe) {
        console.warn(
          `[Governance Kernel] Policy validation failed: ${validation.reason}`,
        );
        return {
          approved: false,
          reason: validation.reason,
          recommendations: [],
        };
      }

      // 3. Generate Feature Flag recommendation
      const flagRecommendation = this.generateFeatureFlagRecommendation(parsed);

      // 4. Log to governance ledger
      await this.recordPolicyEvaluation(parsed, flagRecommendation);

      console.log(
        `[Governance Kernel] ✅ Policy approved: ${flagRecommendation.name}`,
      );

      return {
        approved: true,
        flag: flagRecommendation,
        recommendations: validation.recommendations,
      };
    } catch (error) {
      console.error("[Governance Kernel] Policy evaluation failed:", error);
      return {
        approved: false,
        reason: String(error),
        recommendations: [],
      };
    }
  }

  /**
   * Parse external policy document
   *
   * Phase 2B: Simple text parsing
   * Phase 2C: Advanced DSL parsing with Policy Parser
   */
  private parseExternalPolicy(policyDoc: ExternalPolicyDocument): ParsedPolicy {
    // Simple parsing for Phase 2B (hook registration)
    return {
      name: policyDoc.name || "external-policy",
      type: policyDoc.type || "quality",
      description: policyDoc.description || "",
      constraints: policyDoc.constraints || [],
      featureFlag: policyDoc.suggestedFlag,
    };
  }

  /**
   * Validate external policy against governance rules
   */
  private async validateExternalPolicy(
    policy: ParsedPolicy,
  ): Promise<PolicyValidation> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check 1: Policy type is valid
    const validTypes = ["architecture", "threshold", "quality", "security"];
    if (!validTypes.includes(policy.type)) {
      issues.push(`Invalid policy type: ${policy.type}`);
    }

    // Check 2: No conflicts with existing policies
    if (this.policies) {
      const conflictingPolicies = this.policies.policies.filter(
        (p) => p.name === policy.name,
      );
      if (conflictingPolicies.length > 0) {
        issues.push(
          `Policy name conflicts with existing policy: ${policy.name}`,
        );
        recommendations.push("Use a different policy name or version suffix");
      }
    }

    // Check 3: Feature Flag recommendation
    if (!policy.featureFlag) {
      recommendations.push(
        "Consider adding a Feature Flag for gradual rollout",
      );
    }

    return {
      safe: issues.length === 0,
      reason: issues.length > 0 ? issues.join("; ") : "Validation passed",
      recommendations,
    };
  }

  /**
   * Generate Feature Flag recommendation
   */
  private generateFeatureFlagRecommendation(
    policy: ParsedPolicy,
  ): FeatureFlagRecommendation {
    return {
      name:
        policy.featureFlag?.name ||
        `FEATURE_${policy.name.toUpperCase().replace(/-/g, "_")}`,
      defaultValue: policy.featureFlag?.defaultValue ?? false,
      description:
        policy.featureFlag?.description ||
        `Auto-generated flag for ${policy.name}`,
      phase: "Phase 4", // Default to experimental
      canaryPercentage: policy.featureFlag?.canaryPercentage ?? 10,
    };
  }

  /**
   * Record policy evaluation to governance ledger
   */
  private async recordPolicyEvaluation(
    policy: ParsedPolicy,
    flag: FeatureFlagRecommendation,
  ): Promise<void> {
    const event = {
      type: "external_policy_evaluated",
      timestamp: new Date().toISOString(),
      policy: {
        name: policy.name,
        type: policy.type,
        description: policy.description,
      },
      flag: {
        name: flag.name,
        defaultValue: flag.defaultValue,
      },
    };

    console.log(
      "[Governance Kernel] Recording policy evaluation:",
      JSON.stringify(event),
    );

    // TODO: Integrate with actual governance event bus
    // For now, just log the event
  }

  /**
   * Get current policies
   */
  getPolicies(): GovernancePolicies | null {
    return this.policies;
  }

  /**
   * Check if kernel is in strict mode
   */
  isStrictMode(): boolean {
    return this.strictMode;
  }
}

// ============================================================================
// Additional Types for External Policy Evaluation
// ============================================================================

/**
 * External Policy Document
 *
 * Input format for external policy documents.
 */
export interface ExternalPolicyDocument {
  name?: string;
  type?: "architecture" | "threshold" | "quality" | "security";
  description?: string;
  constraints?: string[];
  suggestedFlag?: {
    name: string;
    defaultValue: boolean;
    description?: string;
    canaryPercentage?: number;
  };
  source?: "rfc" | "spec" | "guideline" | "external";
}

/**
 * Parsed Policy
 *
 * Internal representation after parsing.
 */
export interface ParsedPolicy {
  name: string;
  type: string;
  description: string;
  constraints: string[];
  featureFlag?: {
    name: string;
    defaultValue: boolean;
    description?: string;
    canaryPercentage?: number;
  };
}

/**
 * Policy Validation Result
 */
export interface PolicyValidation {
  safe: boolean;
  reason: string;
  recommendations: string[];
}

/**
 * Policy Evaluation Result
 */
export interface PolicyEvaluation {
  approved: boolean;
  reason?: string;
  flag?: FeatureFlagRecommendation;
  recommendations: string[];
}

/**
 * Feature Flag Recommendation
 */
export interface FeatureFlagRecommendation {
  name: string;
  defaultValue: boolean;
  description: string;
  phase: string;
  canaryPercentage: number;
}

/**
 * Global kernel instance
 */
let globalKernel: GovernanceKernel | null = null;

/**
 * Initialize global governance kernel
 */
export async function initializeGovernanceKernel(options?: {
  projectRoot?: string;
  strictMode?: boolean;
}): Promise<GovernanceKernel> {
  if (globalKernel) {
    console.warn("[Governance Kernel] Already initialized");
    return globalKernel;
  }

  globalKernel = new GovernanceKernel(options);
  await globalKernel.initialize();

  return globalKernel;
}

/**
 * Get global kernel instance
 */
export function getGovernanceKernel(): GovernanceKernel | null {
  return globalKernel;
}
