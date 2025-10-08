/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Ledger Schema Validator - Quality Ledger Integrity
 *
 * Purpose:
 * - Validate quality ledger entries against schema
 * - Verify SHA256 integrity hashes
 * - Detect schema violations
 * - Support DRY-RUN and ENFORCE modes
 *
 * Design Philosophy:
 * - Strict schema enforcement for quality traceability
 * - Hash-based tamper detection
 * - Progressive deployment (DRY-RUN → ENFORCE)
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

/**
 * Ledger entry schema (from governance-rules.json)
 */
export interface LedgerEntry {
  timestamp: string;
  phase: "Phase 0" | "Phase 1" | "Phase 2" | "Phase 3" | "Phase 4";
  metrics: {
    guideline_compliance: number | null;
    retrieval_quality_score: number | null;
    semantic_quality: number | null;
  };
  gate_result: "PASS" | "WARN" | "PARTIAL" | "FAIL";
  next_phase: string | null;
  session_id: string;
  config_version: string;
  hash?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  lineNumber: number;
  entry?: LedgerEntry;
  violations: string[];
  integrityValid?: boolean;
}

/**
 * Schema validation report
 */
export interface SchemaValidationReport {
  filePath: string;
  totalEntries: number;
  validEntries: number;
  invalidEntries: number;
  violations: ValidationResult[];
  summary: {
    schemaErrors: number;
    integrityErrors: number;
    missingFields: number;
    invalidTypes: number;
  };
}

/**
 * Ledger Schema Validator
 */
export class LedgerSchemaValidator {
  private projectRoot: string;
  private mode: "DRY-RUN" | "ENFORCE";

  constructor(
    projectRoot: string = process.cwd(),
    mode: "DRY-RUN" | "ENFORCE" = "DRY-RUN",
  ) {
    this.projectRoot = projectRoot;
    this.mode = mode;
  }

  /**
   * Validate ledger file
   *
   * Algorithm:
   * 1. Read JSONL file
   * 2. Parse each line
   * 3. Validate schema
   * 4. Verify integrity hash
   * 5. Generate report
   */
  validate(ledgerPath: string): SchemaValidationReport {
    const fullPath = join(this.projectRoot, ledgerPath);

    if (!existsSync(fullPath)) {
      throw new Error(`Ledger file not found: ${fullPath}`);
    }

    const content = readFileSync(fullPath, "utf8");
    const lines = content.trim().split("\n").filter(Boolean);

    const violations: ValidationResult[] = [];
    let validEntries = 0;
    let schemaErrors = 0;
    let integrityErrors = 0;
    let missingFields = 0;
    let invalidTypes = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1;
      const line = lines[i];

      try {
        // 1. Parse JSON
        const entry = JSON.parse(line) as LedgerEntry;

        // 2. Validate schema
        const result = this.validateEntry(entry, lineNumber);

        if (!result.valid) {
          violations.push(result);
          schemaErrors++;

          // Categorize violations
          for (const violation of result.violations) {
            if (violation.includes("missing")) {
              missingFields++;
            } else if (violation.includes("type")) {
              invalidTypes++;
            } else if (violation.includes("integrity")) {
              integrityErrors++;
            }
          }
        } else {
          validEntries++;
        }
      } catch (error) {
        // JSON parse error
        violations.push({
          valid: false,
          lineNumber,
          violations: [`JSON parse error: ${error}`],
        });
        schemaErrors++;
        invalidTypes++;
      }
    }

    return {
      filePath: ledgerPath,
      totalEntries: lines.length,
      validEntries,
      invalidEntries: violations.length,
      violations,
      summary: {
        schemaErrors,
        integrityErrors,
        missingFields,
        invalidTypes,
      },
    };
  }

  /**
   * Validate single ledger entry
   */
  private validateEntry(
    entry: LedgerEntry,
    lineNumber: number,
  ): ValidationResult {
    const violations: string[] = [];

    // 1. Required fields
    if (!entry.timestamp) {
      violations.push("Missing required field: timestamp");
    }

    if (!entry.phase) {
      violations.push("Missing required field: phase");
    }

    if (!entry.metrics) {
      violations.push("Missing required field: metrics");
    }

    if (!entry.gate_result) {
      violations.push("Missing required field: gate_result");
    }

    if (!entry.session_id) {
      violations.push("Missing required field: session_id");
    }

    if (!entry.config_version) {
      violations.push("Missing required field: config_version");
    }

    // 2. Type validation
    if (entry.timestamp && !this.isValidISO8601(entry.timestamp)) {
      violations.push(`Invalid timestamp format: ${entry.timestamp}`);
    }

    if (
      entry.phase &&
      !["Phase 0", "Phase 1", "Phase 2", "Phase 3", "Phase 4"].includes(
        entry.phase,
      )
    ) {
      violations.push(`Invalid phase value: ${entry.phase}`);
    }

    if (
      entry.gate_result &&
      !["PASS", "WARN", "PARTIAL", "FAIL"].includes(entry.gate_result)
    ) {
      violations.push(`Invalid gate_result value: ${entry.gate_result}`);
    }

    // 3. Metrics validation
    if (entry.metrics) {
      const {
        guideline_compliance,
        retrieval_quality_score,
        semantic_quality,
      } = entry.metrics;

      if (
        guideline_compliance !== null &&
        typeof guideline_compliance !== "number"
      ) {
        violations.push(
          `Invalid type for guideline_compliance: ${typeof guideline_compliance}`,
        );
      }

      if (
        retrieval_quality_score !== null &&
        typeof retrieval_quality_score !== "number"
      ) {
        violations.push(
          `Invalid type for retrieval_quality_score: ${typeof retrieval_quality_score}`,
        );
      }

      if (semantic_quality !== null && typeof semantic_quality !== "number") {
        violations.push(
          `Invalid type for semantic_quality: ${typeof semantic_quality}`,
        );
      }
    }

    // 4. Integrity hash validation (if present)
    let integrityValid = true;

    if (entry.hash) {
      const calculatedHash = this.calculateEntryHash(entry);

      if (calculatedHash !== entry.hash) {
        violations.push(
          `Integrity hash mismatch: expected ${entry.hash}, got ${calculatedHash}`,
        );
        integrityValid = false;
      }
    }

    return {
      valid: violations.length === 0,
      lineNumber,
      entry,
      violations,
      integrityValid,
    };
  }

  /**
   * Calculate SHA256 hash for entry (excluding hash field itself)
   */
  private calculateEntryHash(entry: LedgerEntry): string {
    // Create copy without hash field
    const { hash: _hash, ...entryWithoutHash } = entry;

    // Canonical JSON (sorted keys)
    const canonical = JSON.stringify(
      entryWithoutHash,
      Object.keys(entryWithoutHash).sort(),
    );

    // SHA256
    return createHash("sha256").update(canonical).digest("hex");
  }

  /**
   * Validate ISO 8601 timestamp
   */
  private isValidISO8601(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && date.toISOString() === timestamp;
  }

  /**
   * Display validation report
   */
  displayReport(report: SchemaValidationReport): void {
    console.log(`\n📋 Ledger Schema Validation Report`);
    console.log(`═══════════════════════════════════════`);
    console.log(`File: ${report.filePath}`);
    console.log(`Mode: ${this.mode}`);
    console.log(`\nSummary:`);
    console.log(`  Total entries: ${report.totalEntries}`);
    console.log(`  Valid entries: ${report.validEntries}`);
    console.log(`  Invalid entries: ${report.invalidEntries}`);
    console.log(`\nViolation breakdown:`);
    console.log(`  Schema errors: ${report.summary.schemaErrors}`);
    console.log(`  Integrity errors: ${report.summary.integrityErrors}`);
    console.log(`  Missing fields: ${report.summary.missingFields}`);
    console.log(`  Invalid types: ${report.summary.invalidTypes}`);

    if (report.violations.length > 0) {
      console.log(`\n⚠️  Violations:`);

      for (const violation of report.violations.slice(0, 10)) {
        console.log(`\n  Line ${violation.lineNumber}:`);

        for (const message of violation.violations) {
          console.log(`    • ${message}`);
        }
      }

      if (report.violations.length > 10) {
        console.log(
          `\n  ... and ${report.violations.length - 10} more violations`,
        );
      }

      if (this.mode === "ENFORCE") {
        console.log(`\n❌ Validation FAILED (ENFORCE mode)`);
        throw new Error(
          `Ledger schema validation failed: ${report.invalidEntries} invalid entries`,
        );
      } else {
        console.log(
          `\n⚠️  Validation issues detected (DRY-RUN mode, not blocking)`,
        );
      }
    } else {
      console.log(`\n✅ All entries valid`);
    }
  }

  /**
   * Validate all ledgers in quality-history/
   */
  validateAllLedgers(): SchemaValidationReport[] {
    const ledgerDir = join(this.projectRoot, "reports", "quality-history");

    if (!existsSync(ledgerDir)) {
      console.log(`\n⚠️  No ledger directory found: ${ledgerDir}`);
      return [];
    }

    const { readdirSync } = require("fs");
    const files = readdirSync(ledgerDir).filter((f: string) =>
      f.endsWith(".jsonl"),
    );

    if (files.length === 0) {
      console.log(`\n⚠️  No ledger files found in ${ledgerDir}`);
      return [];
    }

    const reports: SchemaValidationReport[] = [];

    for (const file of files) {
      const ledgerPath = join("reports", "quality-history", file);

      try {
        const report = this.validate(ledgerPath);
        reports.push(report);
      } catch (error) {
        console.error(`\n❌ Failed to validate ${file}: ${error}`);
      }
    }

    return reports;
  }

  /**
   * Set validation mode
   */
  setMode(mode: "DRY-RUN" | "ENFORCE"): void {
    this.mode = mode;
  }
}

/**
 * Global singleton
 */
let globalValidator: LedgerSchemaValidator | null = null;

export function getLedgerSchemaValidator(
  projectRoot?: string,
  mode?: "DRY-RUN" | "ENFORCE",
): LedgerSchemaValidator {
  if (!globalValidator) {
    globalValidator = new LedgerSchemaValidator(projectRoot, mode);
  } else if (mode) {
    globalValidator.setMode(mode);
  }

  return globalValidator;
}
