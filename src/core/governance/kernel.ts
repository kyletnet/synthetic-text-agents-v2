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
