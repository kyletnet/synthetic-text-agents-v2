/**
 * Rule-Based Quality Checker (Phase 1)
 *
 * Purpose:
 * - Validate QA pairs against guideline rules
 * - Detect violations and generate recommendations
 * - Phase 1 core compliance checker
 *
 * Checks:
 * 1. Question Type Compliance (7 types)
 * 2. Number Format Rules (period, amount, percentage)
 * 3. Prohibited Pattern Detection
 * 4. Answer Structure Validation
 *
 * Phase: Phase 1
 * Version: 1.0.0
 */

import type {
  QAPair,
  QualityChecker,
  QualityResult,
  QualityMetric,
  Violation,
  Recommendation,
} from "../models/quality-domain.js";
import type {
  ParsedGuideline,
  QuestionType,
  NumberFormatRule,
} from "../parsers/guideline-parser.js";
import { getActiveGuideline } from "../parsers/guideline-parser.js";

// ============================================================================
// Rule-Based Checker
// ============================================================================

export class RuleBasedChecker implements QualityChecker {
  name = "rule-based-checker";
  version = "1.0.0";
  phase = "Phase 1" as const;

  private guideline: ParsedGuideline | null = null;
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Load guideline rules
   */
  private async ensureGuideline(): Promise<void> {
    if (!this.guideline) {
      this.guideline = await getActiveGuideline(this.projectRoot);
    }
  }

  /**
   * Main check method
   */
  async check(qaPairs: QAPair[]): Promise<QualityResult> {
    await this.ensureGuideline();
    if (!this.guideline) {
      throw new Error("Failed to load guideline");
    }

    const allViolations: Violation[] = [];
    const allRecommendations: Recommendation[] = [];
    const metrics: QualityMetric[] = [];

    // 1. Question Type Check
    const questionTypeResult = this.checkQuestionTypes(qaPairs);
    metrics.push(questionTypeResult.metric);
    allViolations.push(...questionTypeResult.violations);
    allRecommendations.push(...questionTypeResult.recommendations);

    // 2. Number Format Check
    const numberFormatResult = this.checkNumberFormats(qaPairs);
    metrics.push(numberFormatResult.metric);
    allViolations.push(...numberFormatResult.violations);

    // 3. Prohibited Pattern Check
    const prohibitedResult = this.checkProhibitedPatterns(qaPairs);
    metrics.push(prohibitedResult.metric);
    allViolations.push(...prohibitedResult.violations);

    // 4. Answer Structure Check
    const answerStructureResult = this.checkAnswerStructure(qaPairs);
    metrics.push(answerStructureResult.metric);
    allViolations.push(...answerStructureResult.violations);
    allRecommendations.push(...answerStructureResult.recommendations);

    // Calculate overall score
    const overallScore = this.calculateOverallScore(metrics);

    return {
      metrics,
      summary: {
        totalChecked: qaPairs.length,
        overallScore,
        passRate: this.calculatePassRate(qaPairs.length, allViolations.length),
        violationCount: allViolations.length,
        recommendationCount: allRecommendations.length,
      },
      timestamp: new Date().toISOString(),
      checkerVersion: this.version,
    };
  }

  // ==========================================================================
  // Check Methods
  // ==========================================================================

  /**
   * 1. Question Type Compliance Check
   *
   * Validates that questions match one of 7 defined question types.
   */
  private checkQuestionTypes(qaPairs: QAPair[]): {
    metric: QualityMetric;
    violations: Violation[];
    recommendations: Recommendation[];
  } {
    const violations: Violation[] = [];
    const recommendations: Recommendation[] = [];
    let matchedCount = 0;

    for (const qa of qaPairs) {
      const matched = this.matchQuestionType(qa.question);

      if (!matched) {
        violations.push({
          id: `qt-${qa.id}`,
          severity: "medium",
          category: "question_type",
          description: `질문이 정의된 7가지 유형 중 하나와 일치하지 않습니다`,
          location: {
            qaId: qa.id,
            field: "question",
          },
          suggestion: "정의된 질문 패턴 중 하나를 사용하세요",
        });

        recommendations.push({
          id: `qt-rec-${qa.id}`,
          priority: "medium",
          category: "question_type",
          description: `질문 유형을 명확히 하여 일관성을 높이세요`,
          actionable: true,
        });
      } else {
        matchedCount++;
      }
    }

    const score = qaPairs.length > 0 ? matchedCount / qaPairs.length : 1.0;

    return {
      metric: {
        dimension: "question_type_compliance",
        score,
        confidence: 0.9,
        details: {
          violations,
          recommendations,
          breakdown: {
            matched: matchedCount,
            total: qaPairs.length,
          },
        },
      },
      violations,
      recommendations,
    };
  }

  /**
   * Match question against question type patterns
   */
  private matchQuestionType(question: string): QuestionType | null {
    if (!this.guideline) return null;

    for (const type of this.guideline.questionTypes) {
      // Check if question matches any pattern
      for (const pattern of type.patterns) {
        // Simple keyword matching (can be enhanced with regex)
        const keywords = this.extractKeywords(pattern);
        const matches = keywords.some((keyword) => question.includes(keyword));

        if (matches) {
          return type;
        }
      }
    }

    return null;
  }

  /**
   * Extract keywords from pattern
   */
  private extractKeywords(pattern: string): string[] {
    // Remove placeholders like [휴가명], [조건]
    const cleaned = pattern.replace(/\[.+?\]/g, "");

    // Extract meaningful words
    const keywords = cleaned
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .filter(
        (word) => !["은", "는", "이", "가", "을", "를", "의"].includes(word),
      );

    return keywords;
  }

  /**
   * 2. Number Format Check
   *
   * Validates that numbers follow defined format rules:
   * - Period: "15일", "90일"
   * - Amount: "50만원", "500,000원"
   * - Percentage: "80퍼센트"
   */
  private checkNumberFormats(qaPairs: QAPair[]): {
    metric: QualityMetric;
    violations: Violation[];
  } {
    const violations: Violation[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    if (!this.guideline) {
      return {
        metric: {
          dimension: "number_format_compliance",
          score: 1.0,
          confidence: 0,
        },
        violations: [],
      };
    }

    for (const qa of qaPairs) {
      const text = `${qa.question} ${qa.answer}`;

      for (const rule of this.guideline.numberFormatRules) {
        totalChecks++;

        const hasViolation = this.checkNumberFormatRule(
          text,
          rule,
          qa.id,
          violations,
        );

        if (!hasViolation) {
          passedChecks++;
        }
      }
    }

    const score = totalChecks > 0 ? passedChecks / totalChecks : 1.0;

    return {
      metric: {
        dimension: "number_format_compliance",
        score,
        confidence: 0.85,
        details: {
          violations,
          breakdown: {
            passed: passedChecks,
            total: totalChecks,
          },
        },
      },
      violations,
    };
  }

  /**
   * Check single number format rule
   */
  private checkNumberFormatRule(
    text: string,
    rule: NumberFormatRule,
    qaId: string,
    violations: Violation[],
  ): boolean {
    let hasViolation = false;

    // Check counter-examples (violations)
    for (const counterExample of rule.counterExamples) {
      if (text.includes(counterExample)) {
        violations.push({
          id: `nf-${rule.type}-${qaId}`,
          severity: "low",
          category: "number_format",
          description: `잘못된 ${rule.type} 형식: "${counterExample}" (권장: ${rule.format})`,
          location: { qaId, field: "answer" },
          suggestion: `${rule.format} 형식을 사용하세요`,
        });
        hasViolation = true;
      }
    }

    return hasViolation;
  }

  /**
   * 3. Prohibited Pattern Check
   *
   * Detects prohibited question patterns.
   */
  private checkProhibitedPatterns(qaPairs: QAPair[]): {
    metric: QualityMetric;
    violations: Violation[];
  } {
    const violations: Violation[] = [];
    let violationCount = 0;

    if (!this.guideline) {
      return {
        metric: {
          dimension: "prohibition_compliance",
          score: 1.0,
          confidence: 0,
        },
        violations: [],
      };
    }

    for (const qa of qaPairs) {
      for (const pattern of this.guideline.prohibitedPatterns) {
        if (qa.question.includes(pattern)) {
          violations.push({
            id: `proh-${qa.id}`,
            severity: "high",
            category: "prohibited_pattern",
            description: `권장하지 않는 질문 패턴 사용: "${pattern}"`,
            location: { qaId: qa.id, field: "question" },
            suggestion: "구체적인 상황 대신 일반적인 규정을 묻도록 변경하세요",
          });
          violationCount++;
        }
      }
    }

    const score =
      qaPairs.length > 0 ? 1 - violationCount / qaPairs.length : 1.0;

    return {
      metric: {
        dimension: "prohibition_compliance",
        score,
        confidence: 0.95,
        details: {
          violations,
          breakdown: {
            violations: violationCount,
            total: qaPairs.length,
          },
        },
      },
      violations,
    };
  }

  /**
   * 4. Answer Structure Check
   *
   * Validates answer structure against defined patterns.
   */
  private checkAnswerStructure(qaPairs: QAPair[]): {
    metric: QualityMetric;
    violations: Violation[];
    recommendations: Recommendation[];
  } {
    const violations: Violation[] = [];
    const recommendations: Recommendation[] = [];
    let passedCount = 0;

    for (const qa of qaPairs) {
      const isValid = this.validateAnswerStructure(qa.answer);

      if (!isValid) {
        violations.push({
          id: `as-${qa.id}`,
          severity: "medium",
          category: "answer_structure",
          description: "답변 구조가 권장 패턴과 일치하지 않습니다",
          location: { qaId: qa.id, field: "answer" },
          suggestion:
            "패턴 A(직접 답변 → 보충 설명) 또는 패턴 B(조건 제시 → 결과 설명)를 따르세요",
        });

        recommendations.push({
          id: `as-rec-${qa.id}`,
          priority: "low",
          category: "answer_structure",
          description: "답변 구조를 개선하여 가독성을 높이세요",
          actionable: true,
        });
      } else {
        passedCount++;
      }
    }

    const score = qaPairs.length > 0 ? passedCount / qaPairs.length : 1.0;

    return {
      metric: {
        dimension: "answer_structure_compliance",
        score,
        confidence: 0.75,
        details: {
          violations,
          recommendations,
          breakdown: {
            passed: passedCount,
            total: qaPairs.length,
          },
        },
      },
      violations,
      recommendations,
    };
  }

  /**
   * Validate answer structure
   *
   * Basic validation:
   * - Length: 1-4 sentences
   * - Structure: Has clear beginning and end
   */
  private validateAnswerStructure(answer: string): boolean {
    // Count sentences
    const sentences = answer.split(/[.!?]/).filter((s) => s.trim().length > 0);

    // Check length (1-4 sentences)
    if (sentences.length < 1 || sentences.length > 4) {
      return false;
    }

    // Check minimum length per sentence
    const avgLength =
      sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;

    if (avgLength < 10) {
      return false;
    }

    return true;
  }

  // ==========================================================================
  // Score Calculation
  // ==========================================================================

  /**
   * Calculate overall score from metrics
   */
  private calculateOverallScore(metrics: QualityMetric[]): number {
    if (metrics.length === 0) return 0;

    const total = metrics.reduce((sum, m) => sum + m.score * m.confidence, 0);
    const totalConfidence = metrics.reduce((sum, m) => sum + m.confidence, 0);

    return totalConfidence > 0 ? total / totalConfidence : 0;
  }

  /**
   * Calculate pass rate
   */
  private calculatePassRate(total: number, violations: number): number {
    if (total === 0) return 1.0;
    return Math.max(0, (total - violations) / total);
  }
}

// ============================================================================
// Exports
// ============================================================================

export async function createRuleBasedChecker(
  projectRoot?: string,
): Promise<RuleBasedChecker> {
  return new RuleBasedChecker(projectRoot);
}
