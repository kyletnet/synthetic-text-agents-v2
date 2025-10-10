/**
 * Gate G: Guideline Compliance Gate
 *
 * Validates that generated QA pairs meet guideline compliance standards.
 *
 * Key Features:
 * - Guideline compliance validation (≥90% target)
 * - GCG (Guideline → Constraint Grammar) integration
 * - Automatic compliance checking
 * - Violation tracking and reporting
 * - Pass/Fail gating for CI/CD
 *
 * KPI:
 * - Guideline Compliance ≥ 90%
 * - Validation Score ≥ 80/100
 * - Zero critical violations
 *
 * @see PHASE_2.7_SUCCESS_REPORT.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { GCGCompiler, type Grammar } from '../../offline/genius-lab/gcg/compiler';
import { GCGValidator, type ValidationResult } from '../../offline/genius-lab/gcg/validator';

/**
 * Gate G Status
 */
export interface GateGStatus {
  enabled: boolean;
  status: 'pass' | 'fail' | 'warning';
  metrics: {
    complianceRate: number; // 0-100%
    totalQA: number;
    validQA: number;
    averageScore: number;
    violations: number;
  };
  thresholds: {
    minCompliance: number; // 90%
    minScore: number; // 80/100
    maxViolations: number; // 0 critical
  };
  history: GateGEvent[];
}

/**
 * Gate G Event
 */
export interface GateGEvent {
  timestamp: Date;
  type: 'pass' | 'fail' | 'warning';
  complianceRate: number;
  violations: number;
  message: string;
}

/**
 * QA Pair for validation
 */
export interface QAPair {
  id: string;
  question: string;
  answer: string;
}

/**
 * Gate G Configuration
 */
export interface GateGConfig {
  minCompliance: number; // Minimum compliance rate (%)
  minScore: number; // Minimum validation score
  maxCriticalViolations: number; // Maximum critical violations allowed
  guidelinePath?: string; // Path to guideline file
  enableAutoFix: boolean; // Auto-fix violations when possible
}

const DEFAULT_CONFIG: GateGConfig = {
  minCompliance: 90, // 90% minimum
  minScore: 80, // 80/100 minimum
  maxCriticalViolations: 0, // Zero critical violations
  enableAutoFix: true,
};

/**
 * Gate G: Guideline Compliance Gate
 *
 * Validates QA pairs against guideline constraints.
 */
export class GateGController {
  private config: GateGConfig;
  private status: GateGStatus;
  private statusPath: string;
  private gcgCompiler: GCGCompiler;
  private gcgValidator: GCGValidator;
  private grammar?: Grammar;

  constructor(config: Partial<GateGConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.statusPath = path.join(process.cwd(), 'reports/gate-g-status.json');
    this.gcgCompiler = new GCGCompiler();
    this.gcgValidator = new GCGValidator();

    this.status = {
      enabled: true,
      status: 'pass',
      metrics: {
        complianceRate: 100,
        totalQA: 0,
        validQA: 0,
        averageScore: 0,
        violations: 0,
      },
      thresholds: {
        minCompliance: this.config.minCompliance,
        minScore: this.config.minScore,
        maxViolations: this.config.maxCriticalViolations,
      },
      history: [],
    };

    this.loadStatus();

    // Load guideline if provided
    if (this.config.guidelinePath) {
      this.loadGuideline(this.config.guidelinePath);
    }
  }

  /**
   * Load and compile guideline
   */
  loadGuideline(guidelinePath: string): void {
    try {
      this.grammar = this.gcgCompiler.compile(guidelinePath);
      const validation = this.gcgCompiler.validate(this.grammar);

      if (!validation.valid) {
        throw new Error(`Invalid grammar: ${validation.errors.join(', ')}`);
      }

      console.log(`✅ Gate G: Loaded guideline (domain: ${this.grammar.domain})`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Gate G: Failed to load guideline: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Validate QA pairs against guideline
   */
  validateQA(qaPairs: QAPair[]): {
    passed: boolean;
    complianceRate: number;
    results: Array<{ id: string; passed: boolean; score: number; violations: number }>;
  } {
    if (!this.grammar) {
      throw new Error('Gate G: Grammar not loaded. Call loadGuideline() first.');
    }

    const results: Array<{ id: string; passed: boolean; score: number; violations: number }> = [];
    let totalScore = 0;
    let totalViolations = 0;
    let validCount = 0;

    for (const qa of qaPairs) {
      // Validate question
      const questionValidation = this.gcgValidator.validate(qa.question, this.grammar);

      // Validate answer
      const answerValidation = this.gcgValidator.validate(qa.answer, this.grammar);

      // Calculate average score
      const avgScore = (questionValidation.score + answerValidation.score) / 2;

      // Count critical violations
      const criticalViolations =
        questionValidation.violations.filter((v) => v.severity === 'error').length +
        answerValidation.violations.filter((v) => v.severity === 'error').length;

      // Determine if QA passed
      const passed =
        avgScore >= this.config.minScore &&
        criticalViolations <= this.config.maxCriticalViolations;

      if (passed) {
        validCount++;
      }

      totalScore += avgScore;
      totalViolations += criticalViolations;

      results.push({
        id: qa.id,
        passed,
        score: avgScore,
        violations: criticalViolations,
      });
    }

    const complianceRate = qaPairs.length > 0 ? (validCount / qaPairs.length) * 100 : 0;
    const averageScore = qaPairs.length > 0 ? totalScore / qaPairs.length : 0;

    // Update status
    this.status.metrics = {
      complianceRate,
      totalQA: qaPairs.length,
      validQA: validCount,
      averageScore,
      violations: totalViolations,
    };

    // Determine gate status
    const gatePassed = complianceRate >= this.config.minCompliance;
    this.status.status = gatePassed ? 'pass' : 'fail';

    // Add event
    this.addEvent({
      timestamp: new Date(),
      type: gatePassed ? 'pass' : 'fail',
      complianceRate,
      violations: totalViolations,
      message: gatePassed
        ? `Gate G: PASS (${complianceRate.toFixed(1)}% compliance)`
        : `Gate G: FAIL (${complianceRate.toFixed(1)}% compliance, target: ${this.config.minCompliance}%)`,
    });

    // Save status
    this.saveStatus();

    console.log(`\n📊 Gate G Validation Results:`);
    console.log(`   Total QA: ${qaPairs.length}`);
    console.log(`   Valid QA: ${validCount}`);
    console.log(`   Compliance: ${complianceRate.toFixed(1)}%`);
    console.log(`   Average Score: ${averageScore.toFixed(1)}/100`);
    console.log(`   Violations: ${totalViolations}`);
    console.log(`   Status: ${gatePassed ? '✅ PASS' : '❌ FAIL'}\n`);

    return {
      passed: gatePassed,
      complianceRate,
      results,
    };
  }

  /**
   * Check if gate passes
   */
  passes(): boolean {
    return this.status.status === 'pass';
  }

  /**
   * Get current status
   */
  getStatus(): GateGStatus {
    return this.status;
  }

  /**
   * Get performance report
   */
  getReport(): {
    summary: string;
    status: GateGStatus;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    if (this.status.status === 'fail') {
      recommendations.push('Review failed QA pairs and regenerate with stricter prompts');
    }

    if (this.status.metrics.complianceRate < 95) {
      recommendations.push('Consider updating grammar rules or improving generation quality');
    }

    if (this.status.metrics.violations > 10) {
      recommendations.push('Too many violations - review guideline adherence');
    }

    const summary = `Gate G Status: ${this.status.status.toUpperCase()}
  Compliance: ${this.status.metrics.complianceRate.toFixed(1)}% (target: ${this.config.minCompliance}%)
  Valid QA: ${this.status.metrics.validQA}/${this.status.metrics.totalQA}
  Average Score: ${this.status.metrics.averageScore.toFixed(1)}/100
  Violations: ${this.status.metrics.violations}`;

    return {
      summary,
      status: this.status,
      recommendations,
    };
  }

  /**
   * Add event to history
   */
  private addEvent(event: GateGEvent): void {
    this.status.history.push(event);

    // Keep last 100 events
    if (this.status.history.length > 100) {
      this.status.history.shift();
    }
  }

  /**
   * Save status to file
   */
  private saveStatus(): void {
    try {
      const dir = path.dirname(this.statusPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.statusPath,
        JSON.stringify(
          {
            ...this.status,
            lastUpdated: new Date().toISOString(),
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error('Failed to save Gate G status:', error);
    }
  }

  /**
   * Load status from file
   */
  private loadStatus(): void {
    try {
      if (fs.existsSync(this.statusPath)) {
        const data = fs.readFileSync(this.statusPath, 'utf-8');
        const loaded = JSON.parse(data);

        this.status = {
          ...this.status,
          ...loaded,
        };
      }
    } catch (error) {
      console.warn('Failed to load Gate G status, using defaults:', error);
    }
  }

  /**
   * Reset gate
   */
  reset(): void {
    this.status = {
      enabled: true,
      status: 'pass',
      metrics: {
        complianceRate: 100,
        totalQA: 0,
        validQA: 0,
        averageScore: 0,
        violations: 0,
      },
      thresholds: {
        minCompliance: this.config.minCompliance,
        minScore: this.config.minScore,
        maxViolations: this.config.maxCriticalViolations,
      },
      history: [],
    };

    this.saveStatus();
  }
}

/**
 * Default singleton instance
 */
export const gateGController = new GateGController();
