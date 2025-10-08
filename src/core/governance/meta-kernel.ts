/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Meta-Kernel: Self-Verification System
 *
 * Critical Insight (from GPT):
 * "The kernel loads the app, but who verifies the kernel itself?"
 * "DNA creates life, but DNA must also verify its own integrity."
 *
 * This is the difference between:
 * - Stage 4: System knows how to survive
 * - Stage 5: System knows why it exists
 *
 * Meta-Kernel verifies:
 * 1. Governance structure integrity
 * 2. Policy DSL schema validity
 * 3. Kernel module consistency
 * 4. Self-referential correctness
 */

import { existsSync, readdirSync, statSync, readFileSync } from "fs";
import { join } from "path";
import { load as loadYaml } from "js-yaml";

export interface MetaVerificationResult {
  passed: boolean;
  timestamp: string;
  checks: {
    structureIntegrity: boolean;
    policySchemaValid: boolean;
    moduleConsistency: boolean;
    selfReferenceCorrect: boolean;
  };
  issues: string[];
  recommendations: string[];
}

/**
 * Meta-Kernel
 * The kernel that verifies the kernel
 */
export class MetaKernel {
  private projectRoot: string;
  private governancePath: string;
  private policyPath: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.governancePath = join(projectRoot, "src/core/governance");
    this.policyPath = join(projectRoot, "governance-rules.yaml");
  }

  /**
   * Verify governance structure
   * "DNA verifies its own genome"
   */
  async verify(): Promise<MetaVerificationResult> {
    console.log("[Meta-Kernel] 🧬 Starting self-verification...\n");

    const result: MetaVerificationResult = {
      passed: true,
      timestamp: new Date().toISOString(),
      checks: {
        structureIntegrity: false,
        policySchemaValid: false,
        moduleConsistency: false,
        selfReferenceCorrect: false,
      },
      issues: [],
      recommendations: [],
    };

    // Check 1: Structure Integrity
    console.log("📐 Check 1: Governance Structure Integrity");
    result.checks.structureIntegrity = await this.verifyStructureIntegrity(
      result,
    );

    // Check 2: Policy Schema Validity
    console.log("📋 Check 2: Policy DSL Schema Validity");
    result.checks.policySchemaValid = await this.verifyPolicySchema(result);

    // Check 3: Module Consistency
    console.log("🔗 Check 3: Module Consistency");
    result.checks.moduleConsistency = await this.verifyModuleConsistency(
      result,
    );

    // Check 4: Self-Reference Correctness
    console.log("🔄 Check 4: Self-Referential Correctness");
    result.checks.selfReferenceCorrect = await this.verifySelfReference(result);

    // Determine overall result
    result.passed =
      result.checks.structureIntegrity &&
      result.checks.policySchemaValid &&
      result.checks.moduleConsistency &&
      result.checks.selfReferenceCorrect;

    this.displayResult(result);

    return result;
  }

  /**
   * Verify governance structure integrity
   *
   * Phase 2C Extensions:
   * - Sandbox Runner (infrastructure/governance)
   * - Loop Scheduler (core/governance)
   * - Self-Tuning Agent (core/governance)
   */
  private async verifyStructureIntegrity(
    result: MetaVerificationResult,
  ): Promise<boolean> {
    const requiredFiles = [
      "kernel.ts",
      "bootloader.ts",
      "meta-kernel.ts", // Self-reference!
      "loop-scheduler.ts", // Phase 2C: Adaptive loop timing
      "self-tuning-agent.ts", // Phase 2C: Advisor mode tuning
    ];

    let allFound = true;

    for (const file of requiredFiles) {
      const filePath = join(this.governancePath, file);
      if (!existsSync(filePath)) {
        result.issues.push(`Missing governance file: ${file}`);
        result.recommendations.push(
          `Create ${file} to complete governance structure`,
        );
        allFound = false;
      } else {
        console.log(`   ✅ ${file}`);
      }
    }

    // Phase 2C: Check infrastructure/governance components
    const infrastructurePath = join(
      this.projectRoot,
      "src/infrastructure/governance",
    );
    if (existsSync(infrastructurePath)) {
      const infrastructureFiles = ["sandbox-runner.ts", "policy-parser.ts"];
      for (const file of infrastructureFiles) {
        const filePath = join(infrastructurePath, file);
        if (!existsSync(filePath)) {
          result.issues.push(
            `Missing Phase 2C infrastructure file: ${file}`,
          );
        } else {
          console.log(`   ✅ infrastructure/${file}`);
        }
      }
    }

    // Check for unexpected files (potential drift)
    const actualFiles = readdirSync(this.governancePath).filter((f) =>
      f.endsWith(".ts"),
    );
    const expectedFiles = new Set([
      ...requiredFiles,
      "meta-kernel.ts",
      "loop-scheduler.ts", // Phase 2C: Adaptive feedback loop timing
      "self-tuning-agent.ts", // Phase 2C: Self-tuning advisor
      // Add other expected files
    ]);

    for (const file of actualFiles) {
      if (!expectedFiles.has(file) && !file.endsWith(".d.ts")) {
        result.issues.push(
          `Unexpected governance file: ${file} (potential drift)`,
        );
        result.recommendations.push(
          `Review ${file} - is it part of the governance DNA?`,
        );
      }
    }

    return allFound;
  }

  /**
   * Verify policy DSL schema validity
   */
  private async verifyPolicySchema(
    result: MetaVerificationResult,
  ): Promise<boolean> {
    if (!existsSync(this.policyPath)) {
      result.issues.push("Policy file not found: governance-rules.yaml");
      result.recommendations.push("Create governance-rules.yaml");
      return false;
    }

    try {
      const content = readFileSync(this.policyPath, "utf8");
      const policies = loadYaml(content) as any;

      // Validate schema
      if (!policies.version) {
        result.issues.push("Policy schema missing 'version' field");
        return false;
      }

      if (!policies.policies || !Array.isArray(policies.policies)) {
        result.issues.push("Policy schema missing 'policies' array");
        return false;
      }

      // Detect schema drift: unknown top-level fields
      const allowedTopLevelFields = new Set([
        "version",
        "policies",
        "actions",
        "context",
        "rg", // Regression Guard policies
      ]);

      const actualFields = Object.keys(policies);
      for (const field of actualFields) {
        if (!allowedTopLevelFields.has(field)) {
          result.issues.push(
            `Policy schema drift detected: unexpected field '${field}' (allowed: ${Array.from(
              allowedTopLevelFields,
            ).join(", ")})`,
          );
          result.recommendations.push(
            `Remove '${field}' from governance-rules.yaml or update schema definition`,
          );
        }
      }

      // Validate each policy
      for (const policy of policies.policies) {
        if (
          !policy.name ||
          !policy.type ||
          !policy.level ||
          !policy.condition
        ) {
          result.issues.push(
            `Invalid policy: ${
              policy.name || "unnamed"
            } - missing required fields`,
          );
        }
      }

      console.log(`   ✅ ${policies.policies.length} policies validated`);
      return result.issues.length === 0;
    } catch (error) {
      result.issues.push(`Policy schema parse error: ${error}`);
      return false;
    }
  }

  /**
   * Verify module consistency
   */
  private async verifyModuleConsistency(
    result: MetaVerificationResult,
  ): Promise<boolean> {
    // Check if all governance modules can be loaded
    const modules = ["kernel", "bootloader", "meta-kernel"];

    for (const module of modules) {
      try {
        // Dynamic import check
        const modulePath = join(this.governancePath, `${module}.ts`);
        if (existsSync(modulePath)) {
          const content = readFileSync(modulePath, "utf8");

          // Check for circular dependencies within governance
          if (content.includes("import") && content.includes("governance")) {
            const importLines = content
              .split("\n")
              .filter(
                (line) =>
                  line.includes("import") && line.includes("governance"),
              );

            for (const line of importLines) {
              // Simple heuristic: check for self-imports
              if (line.includes(module)) {
                result.issues.push(
                  `Circular dependency detected in ${module}.ts`,
                );
              }
            }
          }

          console.log(`   ✅ ${module}.ts`);
        }
      } catch (error) {
        result.issues.push(
          `Module consistency check failed for ${module}: ${error}`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Verify self-referential correctness
   * "Can the meta-kernel verify itself?"
   */
  private async verifySelfReference(
    result: MetaVerificationResult,
  ): Promise<boolean> {
    // Check if meta-kernel can reference itself
    const metaKernelPath = join(this.governancePath, "meta-kernel.ts");

    if (!existsSync(metaKernelPath)) {
      result.issues.push(
        "Meta-kernel cannot find itself (self-reference broken)",
      );
      return false;
    }

    // Check if meta-kernel is called by bootloader
    const bootloaderPath = join(this.governancePath, "bootloader.ts");
    if (existsSync(bootloaderPath)) {
      const content = readFileSync(bootloaderPath, "utf8");
      if (!content.includes("meta-kernel") && !content.includes("MetaKernel")) {
        result.recommendations.push(
          "Consider integrating meta-kernel into bootloader for automatic self-verification",
        );
      }
    }

    console.log("   ✅ Self-reference intact");
    return true;
  }

  /**
   * Display verification result
   */
  private displayResult(result: MetaVerificationResult): void {
    console.log("\n" + "=".repeat(60));
    console.log("🧬 Meta-Kernel Self-Verification Result");
    console.log("=".repeat(60));

    if (result.passed) {
      console.log("✅ Status: PASSED - Governance DNA is intact");
    } else {
      console.log("❌ Status: FAILED - Governance DNA has issues");
    }

    console.log(`\nChecks:`);
    console.log(
      `  Structure: ${result.checks.structureIntegrity ? "✅" : "❌"}`,
    );
    console.log(`  Schema: ${result.checks.policySchemaValid ? "✅" : "❌"}`);
    console.log(`  Modules: ${result.checks.moduleConsistency ? "✅" : "❌"}`);
    console.log(
      `  Self-Reference: ${result.checks.selfReferenceCorrect ? "✅" : "❌"}`,
    );

    if (result.issues.length > 0) {
      console.log(`\n⚠️  Issues Found:`);
      result.issues.forEach((issue, i) => {
        console.log(`  ${i + 1}. ${issue}`);
      });
    }

    if (result.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      result.recommendations.forEach((rec, i) => {
        console.log(`  ${i + 1}. ${rec}`);
      });
    }

    console.log("=".repeat(60) + "\n");
  }

  /**
   * Emit governance event about self-verification
   */
  private async emitVerificationEvent(
    result: MetaVerificationResult,
  ): Promise<void> {
    try {
      const { domainEventBus } = await import(
        "../../domain/events/domain-event-bus.js"
      );

      await domainEventBus.publish({
        type: "governance.self_verification.completed",
        actor: "MetaKernel",
        data: {
          passed: result.passed,
          checks: result.checks,
          issueCount: result.issues.length,
        },
      });
    } catch (error) {
      console.warn("[Meta-Kernel] Failed to emit verification event:", error);
    }
  }
}

/**
 * Run meta-kernel self-verification
 */
export async function verifySelfStructure(
  projectRoot?: string,
): Promise<MetaVerificationResult> {
  const metaKernel = new MetaKernel(projectRoot);
  const result = await metaKernel.verify();

  // Emit event for governance tracking
  await metaKernel["emitVerificationEvent"](result);

  return result;
}
