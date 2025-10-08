/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Policy Parser (Phase 2C Preparation)
 *
 * Parses external policy documents into internal governance format.
 * Supports "parseOnly" mode for safe parsing without execution.
 *
 * Security: Sandbox Boundary Protection
 * - parseOnly mode: Parse documents but never execute/apply
 * - Validation only: Check syntax and structure
 * - No side effects: Cannot modify system state
 *
 * Phase 2B → 2C Transition: Robustness Patch
 */

import type {
  ExternalPolicyDocument,
  ParsedPolicy,
} from "../../core/governance/kernel.js";

/**
 * Parser Mode
 *
 * - parseOnly: Parse but do NOT execute/apply (safe for external documents)
 * - validate: Parse + validate structure
 * - full: Parse + validate + prepare for execution (requires approval)
 */
export type ParserMode = "parseOnly" | "validate" | "full";

/**
 * Parser Options
 */
export interface PolicyParserOptions {
  mode?: ParserMode; // Default: parseOnly (safest)
  strictValidation?: boolean; // Enforce strict validation rules
  allowExecution?: boolean; // Explicitly allow execution (requires mode: "full")
}

/**
 * Parser Result
 */
export interface PolicyParserResult {
  success: boolean;
  parsed: ParsedPolicy | null;
  errors: string[];
  warnings: string[];
  metadata: {
    mode: ParserMode;
    source: string;
    timestamp: Date;
    safetyChecks: SafetyCheckResult[];
  };
}

/**
 * Safety Check Result
 */
export interface SafetyCheckResult {
  check: string;
  passed: boolean;
  reason?: string;
}

/**
 * Policy Parser
 *
 * Safe parsing of external policy documents with Sandbox Boundary protection.
 */
export class PolicyParser {
  private readonly mode: ParserMode;
  private readonly strictValidation: boolean;
  private readonly allowExecution: boolean;

  constructor(options: PolicyParserOptions = {}) {
    this.mode = options.mode ?? "parseOnly"; // Default: parseOnly (safest)
    this.strictValidation = options.strictValidation ?? true;
    this.allowExecution = options.allowExecution ?? false;

    // Safety: Never allow execution in parseOnly mode
    if (this.mode === "parseOnly" && this.allowExecution) {
      throw new Error(
        "Execution not allowed in parseOnly mode (Sandbox Boundary violation)",
      );
    }
  }

  /**
   * Parse external policy document (SAFE with automatic rollback)
   *
   * Trust Boundary Protection: Any parsing error triggers immediate rollback.
   */
  async parse(document: ExternalPolicyDocument): Promise<PolicyParserResult> {
    return await this.safeParse(document);
  }

  /**
   * Safe parse with automatic rollback on any error
   *
   * Trust Boundary: Document structure corruption → immediate rollback
   */
  private async safeParse(
    document: ExternalPolicyDocument,
  ): Promise<PolicyParserResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const safetyChecks: SafetyCheckResult[] = [];

    try {
      // Step 1: Safety checks (Sandbox Boundary)
      const sandboxCheck = this.performSandboxChecks(document);
      safetyChecks.push(...sandboxCheck.checks);

      if (!sandboxCheck.safe) {
        // Rollback: Safety check failed
        await this.rollbackPolicy(document, "safety_check_failed");

        return {
          success: false,
          parsed: null,
          errors: sandboxCheck.errors,
          warnings: ["Policy rolled back due to safety check failure"],
          metadata: {
            mode: this.mode,
            source: document.source ?? "unknown",
            timestamp: new Date(),
            safetyChecks,
          },
        };
      }

      // Step 2: Parse document structure (with try/catch for corruption)
      let parsed: ParsedPolicy;
      try {
        parsed = this.parseDocumentStructure(document);
      } catch (parseError) {
        // Rollback: Document structure corrupted
        await this.rollbackPolicy(document, "structure_corruption");

        return {
          success: false,
          parsed: null,
          errors: [`Document structure corrupted: ${parseError}`],
          warnings: ["Policy rolled back due to structure corruption"],
          metadata: {
            mode: this.mode,
            source: document.source ?? "unknown",
            timestamp: new Date(),
            safetyChecks,
          },
        };
      }

      // Step 3: Validate (if mode is "validate" or "full")
      if (this.mode === "validate" || this.mode === "full") {
        const validationResult = this.validateParsedPolicy(parsed);
        errors.push(...validationResult.errors);
        warnings.push(...validationResult.warnings);

        if (validationResult.errors.length > 0 && this.strictValidation) {
          return {
            success: false,
            parsed: null,
            errors,
            warnings,
            metadata: {
              mode: this.mode,
              source: document.source ?? "unknown",
              timestamp: new Date(),
              safetyChecks,
            },
          };
        }
      }

      // Step 4: Prepare for execution (if mode is "full" AND allowExecution)
      if (this.mode === "full" && !this.allowExecution) {
        warnings.push(
          "Policy parsed successfully, but execution is disabled (allowExecution: false)",
        );
      }

      return {
        success: true,
        parsed,
        errors,
        warnings,
        metadata: {
          mode: this.mode,
          source: document.source ?? "unknown",
          timestamp: new Date(),
          safetyChecks,
        },
      };
    } catch (error) {
      return {
        success: false,
        parsed: null,
        errors: [String(error)],
        warnings,
        metadata: {
          mode: this.mode,
          source: document.source ?? "unknown",
          timestamp: new Date(),
          safetyChecks,
        },
      };
    }
  }

  /**
   * Perform Sandbox Boundary checks
   *
   * Security: Prevent execution of malicious code in external documents.
   */
  private performSandboxChecks(document: ExternalPolicyDocument): {
    safe: boolean;
    errors: string[];
    checks: SafetyCheckResult[];
  } {
    const errors: string[] = [];
    const checks: SafetyCheckResult[] = [];

    // Check 1: No executable code in document
    const hasExecutableCode = this.detectExecutableCode(document);
    checks.push({
      check: "no_executable_code",
      passed: !hasExecutableCode,
      reason: hasExecutableCode
        ? "Document contains executable code (security risk)"
        : undefined,
    });

    if (hasExecutableCode) {
      errors.push("Document contains executable code - rejected by Sandbox");
    }

    // Check 2: No external references (URLs, imports)
    const hasExternalRefs = this.detectExternalReferences(document);
    checks.push({
      check: "no_external_references",
      passed: !hasExternalRefs,
      reason: hasExternalRefs
        ? "Document contains external references (security risk)"
        : undefined,
    });

    if (hasExternalRefs && this.strictValidation) {
      errors.push(
        "Document contains external references - rejected by Sandbox",
      );
    }

    // Check 3: Policy type is valid
    const validTypes = ["architecture", "threshold", "quality", "security"];
    const hasValidType = !document.type || validTypes.includes(document.type);
    checks.push({
      check: "valid_policy_type",
      passed: hasValidType,
      reason: hasValidType
        ? undefined
        : `Invalid policy type: ${document.type}`,
    });

    if (!hasValidType) {
      errors.push(`Invalid policy type: ${document.type}`);
    }

    return {
      safe: errors.length === 0,
      errors,
      checks,
    };
  }

  /**
   * Detect executable code in document
   *
   * Simple heuristic: Check for function/eval/require patterns.
   */
  private detectExecutableCode(document: ExternalPolicyDocument): boolean {
    const content = JSON.stringify(document);

    // Dangerous patterns
    const dangerousPatterns = [
      /\beval\s*\(/i,
      /\bFunction\s*\(/i,
      /\brequire\s*\(/i,
      /\bimport\s+/i,
      /\bexec\s*\(/i,
      /\bspawn\s*\(/i,
    ];

    return dangerousPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Detect external references in document
   */
  private detectExternalReferences(document: ExternalPolicyDocument): boolean {
    const content = JSON.stringify(document);

    // External reference patterns
    const externalPatterns = [
      /https?:\/\//i, // HTTP/HTTPS URLs
      /file:\/\//i, // File URLs
      /\bimport\s+.*\s+from\s+['"](?!\.)/i, // Non-relative imports
    ];

    return externalPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * Parse document structure
   */
  private parseDocumentStructure(
    document: ExternalPolicyDocument,
  ): ParsedPolicy {
    return {
      name: document.name ?? "external-policy",
      type: document.type ?? "quality",
      description: document.description ?? "",
      constraints: document.constraints ?? [],
      featureFlag: document.suggestedFlag,
    };
  }

  /**
   * Validate parsed policy
   */
  private validateParsedPolicy(policy: ParsedPolicy): {
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validation 1: Name is required
    if (!policy.name || policy.name.trim().length === 0) {
      errors.push("Policy name is required");
    }

    // Validation 2: Type is valid
    const validTypes = ["architecture", "threshold", "quality", "security"];
    if (!validTypes.includes(policy.type)) {
      errors.push(`Invalid policy type: ${policy.type}`);
    }

    // Validation 3: Description is recommended
    if (!policy.description || policy.description.trim().length === 0) {
      warnings.push("Policy description is recommended for clarity");
    }

    // Validation 4: Feature Flag recommendation
    if (!policy.featureFlag) {
      warnings.push(
        "Feature Flag is recommended for gradual rollout and safety",
      );
    }

    return { errors, warnings };
  }

  /**
   * Get parser mode
   */
  getMode(): ParserMode {
    return this.mode;
  }

  /**
   * Check if execution is allowed
   */
  isExecutionAllowed(): boolean {
    return this.mode === "full" && this.allowExecution;
  }

  /**
   * Rollback policy on parsing failure
   *
   * Trust Boundary: Immediate rollback prevents partial/corrupted policies.
   */
  private async rollbackPolicy(
    document: ExternalPolicyDocument,
    reason: string,
  ): Promise<void> {
    console.warn(
      `[Policy Parser] Rolling back policy: ${
        document.name || "unknown"
      } (reason: ${reason})`,
    );

    // Log rollback event to governance
    const rollbackEvent = {
      type: "policy_rollback",
      timestamp: new Date().toISOString(),
      policy: document.name || "unknown",
      source: document.source || "unknown",
      reason,
    };

    console.log(
      `[Policy Parser] Rollback event: ${JSON.stringify(rollbackEvent)}`,
    );

    // TODO: Integrate with Governance Event Bus
    // await governanceEventBus.emit('policy_rollback', rollbackEvent);
  }
}

/**
 * Create safe parser (parseOnly mode)
 *
 * Factory function for creating a parser in the safest mode.
 */
export function createSafeParser(): PolicyParser {
  return new PolicyParser({
    mode: "parseOnly",
    strictValidation: true,
    allowExecution: false,
  });
}

/**
 * Create validation parser (validate mode)
 */
export function createValidationParser(): PolicyParser {
  return new PolicyParser({
    mode: "validate",
    strictValidation: true,
    allowExecution: false,
  });
}

/**
 * Create full parser (with execution capability)
 *
 * WARNING: Only use this for trusted sources with approval.
 */
export function createFullParser(options?: {
  allowExecution?: boolean;
}): PolicyParser {
  return new PolicyParser({
    mode: "full",
    strictValidation: true,
    allowExecution: options?.allowExecution ?? false,
  });
}
