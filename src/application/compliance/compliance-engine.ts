/**
 * Compliance Engine (Phase 3.4 - Regulatory Automation)
 *
 * "규제 준수는 실시간 검증되어야 한다"
 * - Master Directive
 *
 * Purpose:
 * - Execute Policy Pack validation rules
 * - Calculate compliance scores (GDPR, HIPAA, SOX, etc.)
 * - Generate compliance reports
 *
 * Architecture:
 * Policy Pack → **Compliance Engine** → Compliance Score → Gate R
 *
 * Scoring Strategy:
 * 1. Rule Execution (evaluate all rules)
 * 2. Severity Weighting (critical=1.0, high=0.7, medium=0.4, low=0.2)
 * 3. Score Aggregation (weighted average)
 * 4. Threshold Evaluation (≥95% = compliant)
 *
 * Expected Gain: Compliance automation 100%, Real-time validation
 */

import type {
  PolicyPack,
  PolicyRule,
  ValidationRule,
} from '../../control/policy/policy-pack-generator';

/**
 * Compliance Check Result
 */
export interface ComplianceResult {
  // Overall
  compliant: boolean; // Pass/Fail (threshold: score >= 0.95)
  score: number; // 0-1 (weighted compliance score)
  framework: string; // "HIPAA", "SOX", "GDPR", etc.

  // Rule Results
  totalRules: number;
  passedRules: number;
  failedRules: number;
  criticalViolations: number;
  highViolations: number;

  // Details
  violations: ComplianceViolation[];
  recommendations: string[];

  // Metadata
  timestamp: Date;
  executionTime: number; // ms
}

/**
 * Compliance Violation
 */
export interface ComplianceViolation {
  ruleId: string;
  category: string;
  requirement: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  citation?: string;
  remediation?: string;
}

/**
 * Validation Context (data to validate against)
 */
export interface ValidationContext {
  // System context
  dataHandling: {
    piiProcessed: boolean;
    dataEncrypted: boolean;
    encryptionAlgorithm?: string;
    dataRetentionDays?: number;
  };

  // Access control
  accessControl: {
    authenticationEnabled: boolean;
    authorizationEnabled: boolean;
    roleBasedAccess: boolean;
    multiFactorAuth: boolean;
  };

  // Audit
  auditLogging: {
    enabled: boolean;
    immutable: boolean;
    retentionDays?: number;
  };

  // Consent
  userConsent: {
    obtained: boolean;
    documented: boolean;
    revocable: boolean;
  };

  // Incident response
  incidentResponse: {
    planExists: boolean;
    teamAssigned: boolean;
    responseTimeSLA?: number; // hours
  };

  // Training
  training: {
    programExists: boolean;
    completionRate?: number; // 0-1
  };

  // Custom fields
  [key: string]: unknown;
}

/**
 * Compliance Engine Config
 */
export interface ComplianceEngineConfig {
  threshold: number; // Default: 0.95 (95%)
  severityWeights: {
    critical: number; // Default: 1.0
    high: number; // Default: 0.7
    medium: number; // Default: 0.4
    low: number; // Default: 0.2
  };
  enableRecommendations: boolean; // Default: true
}

/**
 * Compliance Engine
 *
 * Executes Policy Pack validation and calculates compliance scores
 */
export class ComplianceEngine {
  private config: ComplianceEngineConfig;

  constructor(config?: Partial<ComplianceEngineConfig>) {
    this.config = {
      threshold: config?.threshold ?? 0.95,
      severityWeights: {
        critical: config?.severityWeights?.critical ?? 1.0,
        high: config?.severityWeights?.high ?? 0.7,
        medium: config?.severityWeights?.medium ?? 0.4,
        low: config?.severityWeights?.low ?? 0.2,
      },
      enableRecommendations: config?.enableRecommendations ?? true,
    };
  }

  /**
   * Check Compliance
   *
   * Main entry point for compliance validation
   */
  async checkCompliance(
    policyPack: PolicyPack,
    context: ValidationContext
  ): Promise<ComplianceResult> {
    const startTime = Date.now();
    const violations: ComplianceViolation[] = [];

    let totalWeight = 0;
    let passedWeight = 0;

    // Execute all rules
    for (const rule of policyPack.rules) {
      const weight = this.config.severityWeights[rule.severity];
      totalWeight += weight;

      const ruleResult = await this.executeRule(rule, context);

      if (ruleResult.passed) {
        passedWeight += weight;
      } else {
        violations.push(ruleResult.violation!);
      }
    }

    // Calculate score
    const score = totalWeight > 0 ? passedWeight / totalWeight : 1.0;
    const compliant = score >= this.config.threshold;

    // Count violations by severity
    const criticalViolations = violations.filter(
      (v) => v.severity === 'critical'
    ).length;
    const highViolations = violations.filter(
      (v) => v.severity === 'high'
    ).length;

    // Generate recommendations
    const recommendations = this.config.enableRecommendations
      ? this.generateRecommendations(violations)
      : [];

    return {
      compliant,
      score,
      framework: policyPack.framework,
      totalRules: policyPack.rules.length,
      passedRules: policyPack.rules.length - violations.length,
      failedRules: violations.length,
      criticalViolations,
      highViolations,
      violations,
      recommendations,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Execute Single Rule
   */
  private async executeRule(
    rule: PolicyRule,
    context: ValidationContext
  ): Promise<{
    passed: boolean;
    violation?: ComplianceViolation;
  }> {
    try {
      const validationResult = this.validateRule(rule.validation, context);

      if (validationResult.passed) {
        return { passed: true };
      }

      // Create violation
      const violation: ComplianceViolation = {
        ruleId: rule.id,
        category: rule.category,
        requirement: rule.requirement,
        severity: rule.severity,
        message: validationResult.message || rule.validation.errorMessage,
        citation: rule.citation,
        remediation: this.getRemediation(rule),
      };

      return { passed: false, violation };
    } catch (error) {
      // Validation error = rule failed
      return {
        passed: false,
        violation: {
          ruleId: rule.id,
          category: rule.category,
          requirement: rule.requirement,
          severity: rule.severity,
          message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
          citation: rule.citation,
        },
      };
    }
  }

  /**
   * Validate Rule
   */
  private validateRule(
    validation: ValidationRule,
    context: ValidationContext
  ): { passed: boolean; message?: string } {
    switch (validation.type) {
      case 'field-exists':
        return this.validateFieldExists(validation, context);
      case 'field-value':
        return this.validateFieldValue(validation, context);
      case 'data-encrypted':
        return this.validateDataEncrypted(context);
      case 'audit-logged':
        return this.validateAuditLogged(context);
      case 'access-controlled':
        return this.validateAccessControlled(context);
      case 'consent-obtained':
        return this.validateConsentObtained(context);
      case 'retention-policy':
        return this.validateRetentionPolicy(validation, context);
      case 'custom':
        return this.validateCustom(validation, context);
      default:
        throw new Error(`Unknown validation type: ${validation.type}`);
    }
  }

  /**
   * Validation Type: field-exists
   */
  private validateFieldExists(
    validation: ValidationRule,
    context: ValidationContext
  ): { passed: boolean; message?: string } {
    const fieldPath = validation.parameters?.fieldPath as string;
    if (!fieldPath) {
      return { passed: false, message: 'Field path not specified' };
    }

    const value = this.getNestedField(context, fieldPath);
    const passed = value !== undefined && value !== null;

    return {
      passed,
      message: passed ? undefined : `Required field missing: ${fieldPath}`,
    };
  }

  /**
   * Validation Type: field-value
   */
  private validateFieldValue(
    validation: ValidationRule,
    context: ValidationContext
  ): { passed: boolean; message?: string } {
    const fieldPath = validation.parameters?.fieldPath as string;
    const expectedValue = validation.parameters?.expectedValue;

    const actualValue = this.getNestedField(context, fieldPath);
    const passed = actualValue === expectedValue;

    return {
      passed,
      message: passed
        ? undefined
        : `Field ${fieldPath} = ${actualValue}, expected ${expectedValue}`,
    };
  }

  /**
   * Validation Type: data-encrypted
   */
  private validateDataEncrypted(
    context: ValidationContext
  ): { passed: boolean; message?: string } {
    const encrypted = context.dataHandling?.dataEncrypted === true;
    return {
      passed: encrypted,
      message: encrypted ? undefined : 'Data encryption not enabled',
    };
  }

  /**
   * Validation Type: audit-logged
   */
  private validateAuditLogged(
    context: ValidationContext
  ): { passed: boolean; message?: string } {
    const enabled = context.auditLogging?.enabled === true;
    const immutable = context.auditLogging?.immutable === true;

    const passed = enabled && immutable;

    return {
      passed,
      message: passed
        ? undefined
        : `Audit logging incomplete (enabled: ${enabled}, immutable: ${immutable})`,
    };
  }

  /**
   * Validation Type: access-controlled
   */
  private validateAccessControlled(
    context: ValidationContext
  ): { passed: boolean; message?: string } {
    const auth = context.accessControl?.authenticationEnabled === true;
    const authz = context.accessControl?.authorizationEnabled === true;

    const passed = auth && authz;

    return {
      passed,
      message: passed
        ? undefined
        : `Access control incomplete (auth: ${auth}, authz: ${authz})`,
    };
  }

  /**
   * Validation Type: consent-obtained
   */
  private validateConsentObtained(
    context: ValidationContext
  ): { passed: boolean; message?: string } {
    const obtained = context.userConsent?.obtained === true;
    const documented = context.userConsent?.documented === true;

    const passed = obtained && documented;

    return {
      passed,
      message: passed
        ? undefined
        : `Consent incomplete (obtained: ${obtained}, documented: ${documented})`,
    };
  }

  /**
   * Validation Type: retention-policy
   */
  private validateRetentionPolicy(
    validation: ValidationRule,
    context: ValidationContext
  ): { passed: boolean; message?: string } {
    const minDays = validation.parameters?.minDays as number;
    const actualDays = context.dataHandling?.dataRetentionDays;

    if (actualDays === undefined) {
      return { passed: false, message: 'Data retention policy not defined' };
    }

    const passed = actualDays >= minDays;

    return {
      passed,
      message: passed
        ? undefined
        : `Retention period ${actualDays} days < minimum ${minDays} days`,
    };
  }

  /**
   * Validation Type: custom
   */
  private validateCustom(
    validation: ValidationRule,
    context: ValidationContext
  ): { passed: boolean; message?: string } {
    // Custom validation using condition expression
    try {
      // Safe eval using Function constructor (limited scope)
      const fn = new Function('context', `return ${validation.condition}`);
      const result = fn(context);

      return {
        passed: Boolean(result),
        message: result ? undefined : validation.errorMessage,
      };
    } catch (error) {
      return {
        passed: false,
        message: `Custom validation error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Get nested field from context
   */
  private getNestedField(
    context: ValidationContext,
    fieldPath: string
  ): unknown {
    const parts = fieldPath.split('.');
    let value: unknown = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = (value as Record<string, unknown>)[part];
    }

    return value;
  }

  /**
   * Get remediation advice
   */
  private getRemediation(rule: PolicyRule): string {
    const remediations: Record<string, string> = {
      'data-protection': 'Enable data encryption and access controls',
      'access-control': 'Implement authentication and authorization',
      'audit-logging': 'Enable immutable audit logging',
      encryption: 'Enable end-to-end encryption',
      disclosure: 'Provide required disclosures to users',
      retention: 'Implement data retention policy',
      'incident-response': 'Establish incident response plan and team',
      training: 'Implement compliance training program',
    };

    return remediations[rule.category] || 'Review and address compliance gap';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    violations: ComplianceViolation[]
  ): string[] {
    const recommendations: string[] = [];

    // Group violations by category
    const categoryViolations = new Map<string, ComplianceViolation[]>();
    for (const violation of violations) {
      const existing = categoryViolations.get(violation.category) || [];
      existing.push(violation);
      categoryViolations.set(violation.category, existing);
    }

    // Generate category-specific recommendations
    for (const [category, categoryViols] of categoryViolations) {
      const criticalCount = categoryViols.filter(
        (v) => v.severity === 'critical'
      ).length;

      if (criticalCount > 0) {
        recommendations.push(
          `CRITICAL: Address ${criticalCount} ${category} violation(s) immediately`
        );
      }
    }

    // Prioritization recommendation
    if (violations.some((v) => v.severity === 'critical')) {
      recommendations.push(
        'Prioritize critical violations before deployment'
      );
    }

    // Training recommendation
    if (violations.some((v) => v.category === 'training')) {
      recommendations.push(
        'Implement compliance training program for all personnel'
      );
    }

    return recommendations;
  }
}

/**
 * Create Compliance Engine instance
 */
export function createComplianceEngine(
  config?: Partial<ComplianceEngineConfig>
): ComplianceEngine {
  return new ComplianceEngine(config);
}
