#!/usr/bin/env tsx

/**
 * LLM I/O Validation
 *
 * Validates LLM outputs against quality criteria:
 * - Empty/null response detection
 * - Format validation (QA structure)
 * - Minimum quality thresholds
 * - Basic hallucination indicators
 *
 * Input: QA pairs from qa_sample_*.json or evaluation_*.json
 * Output: Validation report + exit code (0=pass, 1=fail)
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface QAPair {
  q: string;
  a: string;
}

interface QAItem {
  qa: QAPair;
  evidence?: string;
  timestamp?: string;
  [key: string]: unknown;
}

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalItems: number;
    validItems: number;
    emptyResponses: number;
    tooShort: number;
    formatErrors: number;
    suspiciousItems: number;
  };
}

class LLMIOValidator {
  private projectRoot: string;
  private minQuestionLength = 5;
  private minAnswerLength = 10;
  private maxRepeatedChars = 10; // Detect "aaaaaaa..." patterns

  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * Validate QA files
   */
  validateQAFiles(filePaths: string[]): ValidationResult {
    const result: ValidationResult = {
      passed: true,
      errors: [],
      warnings: [],
      stats: {
        totalItems: 0,
        validItems: 0,
        emptyResponses: 0,
        tooShort: 0,
        formatErrors: 0,
        suspiciousItems: 0,
      },
    };

    for (const filePath of filePaths) {
      const fullPath = join(this.projectRoot, filePath);

      if (!existsSync(fullPath)) {
        result.errors.push(`File not found: ${filePath}`);
        result.passed = false;
        continue;
      }

      try {
        const content = readFileSync(fullPath, "utf-8");
        const items: QAItem[] = JSON.parse(content);

        if (!Array.isArray(items)) {
          result.errors.push(`${filePath}: Not an array of QA items`);
          result.passed = false;
          continue;
        }

        this.validateItems(items, filePath, result);
      } catch (error) {
        result.errors.push(
          `${filePath}: Failed to parse - ${(error as Error).message}`,
        );
        result.passed = false;
      }
    }

    return result;
  }

  private validateItems(
    items: QAItem[],
    filePath: string,
    result: ValidationResult,
  ): void {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      result.stats.totalItems++;

      // Check 1: Format validation
      if (!item.qa || typeof item.qa !== "object") {
        result.errors.push(`${filePath}[${i}]: Missing or invalid 'qa' field`);
        result.stats.formatErrors++;
        result.passed = false;
        continue;
      }

      const { q, a } = item.qa;

      // Check 2: Empty response detection
      if (!q || !a || q.trim() === "" || a.trim() === "") {
        result.errors.push(`${filePath}[${i}]: Empty question or answer`);
        result.stats.emptyResponses++;
        result.passed = false;
        continue;
      }

      // Check 3: Minimum length
      if (q.trim().length < this.minQuestionLength) {
        result.warnings.push(
          `${filePath}[${i}]: Question too short (${q.length} chars)`,
        );
        result.stats.tooShort++;
      }

      if (a.trim().length < this.minAnswerLength) {
        result.errors.push(
          `${filePath}[${i}]: Answer too short (${a.length} chars)`,
        );
        result.stats.tooShort++;
        result.passed = false;
        continue;
      }

      // Check 4: Suspicious patterns (basic hallucination indicators)
      if (this.hasSuspiciousPatterns(a)) {
        result.warnings.push(
          `${filePath}[${i}]: Suspicious pattern detected in answer`,
        );
        result.stats.suspiciousItems++;
      }

      // Check 5: Evidence grounding (if evidence exists)
      if (item.evidence && typeof item.evidence === "string") {
        if (!this.isGroundedInEvidence(a, item.evidence)) {
          result.warnings.push(
            `${filePath}[${i}]: Answer may not be grounded in evidence`,
          );
          result.stats.suspiciousItems++;
        }
      }

      // Valid item
      result.stats.validItems++;
    }
  }

  /**
   * Detect suspicious patterns that might indicate hallucination
   */
  private hasSuspiciousPatterns(text: string): boolean {
    // Pattern 1: Excessive repetition (e.g., "aaaaa...")
    const repeatedChar = /(.)\1{10,}/;
    if (repeatedChar.test(text)) {
      return true;
    }

    // Pattern 2: Common LLM hallucination phrases (Korean)
    const hallucinations = [
      "제공된 정보가 없습니다",
      "답변드릴 수 없습니다",
      "정보를 찾을 수 없습니다",
      "AI로서",
      "언어 모델로서",
    ];

    for (const phrase of hallucinations) {
      if (text.includes(phrase)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if answer is grounded in evidence (basic keyword matching)
   */
  private isGroundedInEvidence(answer: string, evidence: string): boolean {
    // Extract key terms from answer (simple: words longer than 3 chars)
    const answerTerms = answer
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 10); // Check first 10 key terms

    // At least 30% of key terms should appear in evidence
    const matchedTerms = answerTerms.filter((term) =>
      evidence.includes(term),
    ).length;

    return matchedTerms / Math.max(answerTerms.length, 1) >= 0.3;
  }

  displayResults(result: ValidationResult): void {
    console.log("\n🔍 LLM I/O Validation Report");
    console.log("═".repeat(60));

    if (result.passed) {
      console.log("✅ VALIDATION PASSED\n");
    } else {
      console.log("❌ VALIDATION FAILED\n");
    }

    console.log("📊 Statistics:");
    console.log(`   Total items: ${result.stats.totalItems}`);
    console.log(`   Valid items: ${result.stats.validItems}`);
    console.log(`   Empty responses: ${result.stats.emptyResponses}`);
    console.log(`   Too short: ${result.stats.tooShort}`);
    console.log(`   Format errors: ${result.stats.formatErrors}`);
    console.log(`   Suspicious items: ${result.stats.suspiciousItems}`);

    if (result.errors.length > 0) {
      console.log(`\n❌ Errors (${result.errors.length}):`);
      result.errors.slice(0, 10).forEach((error) => {
        console.log(`   • ${error}`);
      });
      if (result.errors.length > 10) {
        console.log(`   ... and ${result.errors.length - 10} more`);
      }
    }

    if (result.warnings.length > 0) {
      console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
      result.warnings.slice(0, 5).forEach((warning) => {
        console.log(`   • ${warning}`);
      });
      if (result.warnings.length > 5) {
        console.log(`   ... and ${result.warnings.length - 5} more`);
      }
    }

    console.log("\n" + "═".repeat(60));
  }
}

// Main execution
const validator = new LLMIOValidator();

// Default files to validate (only qa_sample format)
const defaultFiles = ["qa_sample_100.json"];

// Use command line args if provided, otherwise use defaults
const filesToValidate =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : defaultFiles.filter((f) => existsSync(join(process.cwd(), f)));

console.log(`📄 Validating ${filesToValidate.length} file(s)...\n`);

const result = validator.validateQAFiles(filesToValidate);
validator.displayResults(result);

process.exit(result.passed ? 0 : 1);
