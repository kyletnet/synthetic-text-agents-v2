/**
 * Domain: Preflight Validation Rules
 * Defines validation rules for each preflight stage
 */

import { Logger } from "../../shared/logger.js";

const logger = new Logger({ level: "info" });

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details?: Record<string, unknown>;
}

// ============================================================================
// TypeScript Validation Rules
// ============================================================================

export class TypeScriptValidationRules {
  static validateCompilation(output: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for compilation errors
    if (output.includes("error TS")) {
      const errorCount = (output.match(/error TS/g) || []).length;
      errors.push(`${errorCount} TypeScript compilation error(s) found`);
    }

    // Check for specific critical errors
    const criticalPatterns = [
      /Cannot find module/i,
      /Type .* is not assignable/i,
      /Property .* does not exist/i,
    ];

    for (const pattern of criticalPatterns) {
      if (pattern.test(output)) {
        warnings.push(`Critical type error detected: ${pattern.source}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: { errorCount: errors.length },
    };
  }
}

// ============================================================================
// Lint Validation Rules
// ============================================================================

export class LintValidationRules {
  static validateLintOutput(
    output: string,
    maxWarnings: number = 0,
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Parse ESLint output
    const errorMatch = output.match(/(\d+)\s+error/);
    const warningMatch = output.match(/(\d+)\s+warning/);

    const errorCount = errorMatch ? parseInt(errorMatch[1], 10) : 0;
    const warningCount = warningMatch ? parseInt(warningMatch[1], 10) : 0;

    if (errorCount > 0) {
      errors.push(`${errorCount} ESLint error(s) found`);
    }

    if (warningCount > maxWarnings) {
      errors.push(
        `${warningCount} ESLint warning(s) found (max: ${maxWarnings})`,
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: { errorCount, warningCount },
    };
  }

  static checkFlatConfigPresence(): boolean {
    const fs = require("fs");
    const path = require("path");

    const flatConfigFiles = [
      "eslint.config.js",
      "eslint.config.cjs",
      "eslint.config.mjs",
    ];

    for (const file of flatConfigFiles) {
      try {
        if (fs.existsSync(path.resolve(process.cwd(), file))) {
          return true;
        }
      } catch {
        // Continue checking other files
      }
    }

    return false;
  }
}

// ============================================================================
// Manifest Validation Rules
// ============================================================================

export interface ManifestValidationResult extends ValidationResult {
  manifestExists: boolean;
  checksumValid: boolean;
  filesPresent: number;
  filesMissing: number;
}

export class ManifestValidationRules {
  static async validateManifestIntegrity(
    manifest: any,
  ): Promise<ManifestValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!manifest) {
      return {
        valid: false,
        errors: ["Manifest not found"],
        warnings: [],
        manifestExists: false,
        checksumValid: false,
        filesPresent: 0,
        filesMissing: 0,
      };
    }

    // Validate required fields
    const requiredFields = [
      "manifest_id",
      "created_timestamp",
      "input_files",
      "config_files",
      "seed_value",
    ];

    for (const field of requiredFields) {
      if (!(field in manifest)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate file counts
    const totalFiles =
      (manifest.input_files?.length || 0) +
      (manifest.gold_files?.length || 0) +
      (manifest.config_files?.length || 0);

    if (totalFiles === 0) {
      warnings.push("No files in manifest");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      manifestExists: true,
      checksumValid: true,
      filesPresent: totalFiles,
      filesMissing: 0,
      details: {
        manifest_id: manifest.manifest_id,
        file_count: totalFiles,
      },
    };
  }
}

// ============================================================================
// Seed Validation Rules
// ============================================================================

export class SeedValidationRules {
  static validateSeed(seed: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof seed !== "number" || isNaN(seed)) {
      errors.push("Seed must be a valid number");
    }

    if (seed < 0 || seed > 1000000) {
      warnings.push("Seed should be between 0 and 1,000,000");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      details: { seed },
    };
  }
}

// ============================================================================
// Threshold Validation Rules
// ============================================================================

export interface ThresholdValidationResult extends ValidationResult {
  p0Count: number;
  p1Count: number;
  p2Count: number;
  calibrationStatus: "CURRENT" | "NEEDED" | "UNKNOWN";
}

export class ThresholdValidationRules {
  static validateThresholds(
    p0Thresholds: any,
    p1Thresholds: any,
    p2Thresholds: any,
  ): ThresholdValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const p0Count = Object.keys(p0Thresholds || {}).length;
    const p1Count = Object.keys(p1Thresholds || {}).length;
    const p2Count = Object.keys(p2Thresholds || {}).length;

    if (p0Count === 0) {
      errors.push("No P0 thresholds defined");
    }

    if (p1Count === 0) {
      warnings.push("No P1 thresholds defined");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      p0Count,
      p1Count,
      p2Count,
      calibrationStatus: "UNKNOWN",
      details: {
        p0: p0Thresholds,
        p1: p1Thresholds,
        p2: p2Thresholds,
      },
    };
  }
}

// ============================================================================
// Smoke Run Validation Rules
// ============================================================================

export interface SmokeRunValidationResult extends ValidationResult {
  casesProcessed: number;
  costUsd: number;
  result: string;
  meetsMinimumCost: boolean;
}

export class SmokeRunValidationRules {
  static validateSmokeResults(
    output: string,
    minCost: number = 0.0,
  ): SmokeRunValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Parse smoke run output
    const casesMatch = output.match(/(\d+)\s+cases?/i);
    const costMatch = output.match(/\$?([0-9.]+)\s*(usd|cost)/i);
    const resultMatch = output.match(/result[:\s]+(PASS|FAIL|PARTIAL)/i);

    const casesProcessed = casesMatch ? parseInt(casesMatch[1], 10) : 0;
    const costUsd = costMatch ? parseFloat(costMatch[1]) : 0;
    const result = resultMatch ? resultMatch[1] : "UNKNOWN";

    if (casesProcessed === 0) {
      errors.push("No cases processed in smoke run");
    }

    const meetsMinimumCost = costUsd > minCost;
    if (!meetsMinimumCost) {
      warnings.push(
        `Cost ($${costUsd}) is below minimum threshold ($${minCost})`,
      );
    }

    if (result === "FAIL") {
      errors.push("Smoke run failed");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      casesProcessed,
      costUsd,
      result,
      meetsMinimumCost,
      details: { casesProcessed, costUsd, result },
    };
  }
}

// ============================================================================
// Gating Validation Rules
// ============================================================================

export interface GatingValidationResult extends ValidationResult {
  canProceed: boolean;
  gateStatus: "PASS" | "WARN" | "PARTIAL" | "FAIL";
  overallScore: number;
  violations: string[];
}

export class GatingValidationRules {
  static validateGatingCriteria(
    sessionMetrics: {
      totalCases: number;
      totalCost: number;
      result: string;
      warningCount: number;
      errorCount: number;
      p0Violations: string[];
      p1Warnings: string[];
      p2Issues: string[];
    },
    criteria: {
      minCases: number;
      requireCostGt: number;
      maxWarn: number;
      enforceResult: string[];
    },
  ): GatingValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const violations: string[] = [];

    // Validate minimum cases
    if (sessionMetrics.totalCases < criteria.minCases) {
      violations.push(
        `Insufficient cases: ${sessionMetrics.totalCases} < ${criteria.minCases}`,
      );
      errors.push(violations[violations.length - 1]);
    }

    // Validate cost requirement
    if (sessionMetrics.totalCost <= criteria.requireCostGt) {
      violations.push(
        `Insufficient cost: $${sessionMetrics.totalCost} <= $${criteria.requireCostGt}`,
      );
      warnings.push(violations[violations.length - 1]);
    }

    // Validate warning limit
    if (sessionMetrics.warningCount > criteria.maxWarn) {
      violations.push(
        `Too many warnings: ${sessionMetrics.warningCount} > ${criteria.maxWarn}`,
      );
      errors.push(violations[violations.length - 1]);
    }

    // Validate result requirement
    if (!criteria.enforceResult.includes(sessionMetrics.result)) {
      violations.push(
        `Result '${
          sessionMetrics.result
        }' not in [${criteria.enforceResult.join(", ")}]`,
      );
      errors.push(violations[violations.length - 1]);
    }

    // Validate P0 violations (always blocking)
    if (sessionMetrics.p0Violations.length > 0) {
      violations.push(
        `P0 violations: ${sessionMetrics.p0Violations.join(", ")}`,
      );
      errors.push(violations[violations.length - 1]);
    }

    // Calculate overall score
    let overallScore = 1.0;
    overallScore -= violations.length * 0.1;
    overallScore -= sessionMetrics.errorCount * 0.2;
    overallScore -= sessionMetrics.warningCount * 0.05;
    overallScore = Math.max(0, Math.min(1, overallScore));

    // Determine gate status
    let gateStatus: "PASS" | "WARN" | "PARTIAL" | "FAIL";
    if (errors.length === 0) {
      gateStatus = warnings.length === 0 ? "PASS" : "WARN";
    } else {
      const hasCritical = sessionMetrics.p0Violations.length > 0;
      gateStatus = hasCritical ? "FAIL" : "PARTIAL";
    }

    const canProceed = errors.length === 0 && gateStatus !== "FAIL";

    return {
      valid: canProceed,
      errors,
      warnings,
      canProceed,
      gateStatus,
      overallScore,
      violations,
      details: { sessionMetrics, criteria },
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

logger.info("Validation rules loaded", {
  rules: [
    "TypeScript",
    "Lint",
    "Manifest",
    "Seed",
    "Threshold",
    "SmokeRun",
    "Gating",
  ],
});
