/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 *
 * Gate R: Regulatory Compliance
 *
 * Purpose:
 * - Block deployment if regulatory compliance < 95%
 * - Ensure GDPR/HIPAA/SOX/CCPA compliance
 * - Prevent regulatory violations
 *
 * Phase: v3.4 - Regulatory Automation (Priority 4)
 */

import {
  ComplianceEngine,
  createComplianceEngine,
  type ComplianceResult,
  type ValidationContext,
} from '../../application/compliance/compliance-engine.js';
import type { PolicyPack } from '../../control/policy/policy-pack-generator.js';

/**
 * Gate R Check Result
 */
export interface GateRResult {
  passed: boolean; // Gate passed or failed
  score: number; // Compliance score (0-1)
  action: 'allow' | 'warn' | 'block'; // Action taken
  message: string; // Human-readable message
  details: {
    framework: string; // "HIPAA", "SOX", "GDPR", etc.
    complianceResult: ComplianceResult;
    criticalViolations: number;
    highViolations: number;
  };
}

/**
 * Gate R Config
 */
export interface GateRConfig {
  passThreshold: number; // Default: 0.95 (95%)
  warnThreshold: number; // Default: 0.85 (85%)
  blockCriticalViolations: boolean; // Default: true (block if any critical)
}

/**
 * Gate R: Regulatory Compliance Validator
 *
 * Ensures system meets regulatory compliance requirements
 */
export class GateR {
  private readonly engine: ComplianceEngine;
  private readonly config: GateRConfig;

  constructor(options: Partial<GateRConfig> = {}) {
    this.engine = createComplianceEngine({
      threshold: options.passThreshold ?? 0.95,
    });

    this.config = {
      passThreshold: options.passThreshold ?? 0.95,
      warnThreshold: options.warnThreshold ?? 0.85,
      blockCriticalViolations: options.blockCriticalViolations ?? true,
    };
  }

  /**
   * Check Regulatory Compliance
   *
   * Validates system against regulatory framework
   */
  async check(
    policyPack: PolicyPack,
    context: ValidationContext
  ): Promise<GateRResult> {
    // Execute compliance check
    const complianceResult = await this.engine.checkCompliance(
      policyPack,
      context
    );

    const { score, criticalViolations, highViolations } = complianceResult;

    // Determine action
    let action: 'allow' | 'warn' | 'block';
    let message: string;
    let passed: boolean;

    // Block if critical violations exist
    if (this.config.blockCriticalViolations && criticalViolations > 0) {
      action = 'block';
      passed = false;
      message = `BLOCKED: ${criticalViolations} critical ${policyPack.framework} violation(s) detected`;
    }
    // Pass if score meets threshold
    else if (score >= this.config.passThreshold) {
      action = 'allow';
      passed = true;
      message = `${policyPack.framework} compliance passed (${(score * 100).toFixed(1)}%)`;
    }
    // Warn if score in warning zone
    else if (score >= this.config.warnThreshold) {
      action = 'warn';
      passed = false;
      message = `WARNING: ${policyPack.framework} compliance ${(score * 100).toFixed(1)}% (below ${(this.config.passThreshold * 100).toFixed(0)}% threshold)`;
    }
    // Block if score below warning threshold
    else {
      action = 'block';
      passed = false;
      message = `BLOCKED: ${policyPack.framework} compliance ${(score * 100).toFixed(1)}% (critically low)`;
    }

    return {
      passed,
      score,
      action,
      message,
      details: {
        framework: policyPack.framework,
        complianceResult,
        criticalViolations,
        highViolations,
      },
    };
  }

  /**
   * Check Multiple Frameworks
   *
   * Validates against multiple regulatory frameworks
   */
  async checkMultiple(
    policyPacks: PolicyPack[],
    context: ValidationContext
  ): Promise<{
    passed: boolean;
    overallScore: number;
    results: GateRResult[];
    message: string;
  }> {
    const results: GateRResult[] = [];

    // Check each framework
    for (const pack of policyPacks) {
      const result = await this.check(pack, context);
      results.push(result);
    }

    // Calculate overall score (average)
    const overallScore =
      results.reduce((sum, r) => sum + r.score, 0) / results.length;

    // Determine overall pass/fail
    const allPassed = results.every((r) => r.passed);
    const anyBlocked = results.some((r) => r.action === 'block');

    let message: string;
    if (allPassed) {
      message = `All ${policyPacks.length} regulatory frameworks compliant (${(overallScore * 100).toFixed(1)}%)`;
    } else if (anyBlocked) {
      const blockedCount = results.filter((r) => r.action === 'block').length;
      message = `BLOCKED: ${blockedCount}/${policyPacks.length} frameworks failed compliance`;
    } else {
      const warnCount = results.filter((r) => r.action === 'warn').length;
      message = `WARNING: ${warnCount}/${policyPacks.length} frameworks below threshold`;
    }

    return {
      passed: allPassed,
      overallScore,
      results,
      message,
    };
  }

  /**
   * Get Compliance Summary
   *
   * Generate human-readable compliance summary
   */
  generateSummary(result: GateRResult): string {
    const { score, details } = result;
    const { framework, complianceResult } = details;

    const lines: string[] = [];

    lines.push(`${framework} Compliance Report`);
    lines.push(`${'='.repeat(50)}`);
    lines.push(`Overall Score: ${(score * 100).toFixed(1)}%`);
    lines.push(
      `Status: ${result.passed ? '✅ PASS' : result.action === 'warn' ? '⚠️  WARN' : '❌ FAIL'}`
    );
    lines.push('');

    lines.push(`Rules: ${complianceResult.passedRules}/${complianceResult.totalRules} passed`);
    lines.push(`Critical Violations: ${complianceResult.criticalViolations}`);
    lines.push(`High Violations: ${complianceResult.highViolations}`);
    lines.push('');

    if (complianceResult.violations.length > 0) {
      lines.push('Violations:');
      for (const violation of complianceResult.violations) {
        lines.push(
          `  [${violation.severity.toUpperCase()}] ${violation.requirement}`
        );
        if (violation.citation) {
          lines.push(`    Citation: ${violation.citation}`);
        }
        if (violation.remediation) {
          lines.push(`    Remediation: ${violation.remediation}`);
        }
      }
      lines.push('');
    }

    if (complianceResult.recommendations.length > 0) {
      lines.push('Recommendations:');
      for (const rec of complianceResult.recommendations) {
        lines.push(`  • ${rec}`);
      }
    }

    return lines.join('\n');
  }
}

/**
 * Create Gate R instance
 */
export function createGateR(config?: Partial<GateRConfig>): GateR {
  return new GateR(config);
}

/**
 * Quick Check: GDPR Compliance
 */
export async function checkGDPR(
  context: ValidationContext,
  policyPack: PolicyPack
): Promise<GateRResult> {
  const gate = createGateR();
  return gate.check(policyPack, context);
}

/**
 * Quick Check: HIPAA Compliance
 */
export async function checkHIPAA(
  context: ValidationContext,
  policyPack: PolicyPack
): Promise<GateRResult> {
  const gate = createGateR();
  return gate.check(policyPack, context);
}

/**
 * Quick Check: All Regulatory Frameworks
 */
export async function checkAllRegulatory(
  context: ValidationContext,
  policyPacks: PolicyPack[]
): Promise<{
  passed: boolean;
  overallScore: number;
  results: GateRResult[];
  message: string;
}> {
  const gate = createGateR();
  return gate.checkMultiple(policyPacks, context);
}
