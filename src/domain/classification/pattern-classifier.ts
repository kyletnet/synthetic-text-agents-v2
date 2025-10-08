/**
 * Pattern-based Question Classifier
 *
 * Uses regex patterns to classify questions into 4 types.
 * Migrated from tools/diversity_analyzer.js and scripts/metrics/qtypeDistribution.ts.
 *
 * Pattern priority (highest to lowest):
 * 1. Analytical (왜, 이유, 원인)
 * 2. Procedural (어떻게, 방법, 과정)
 * 3. Comparative (차이, 비교)
 * 4. Factual (무엇, 누가, 언제, 어디)
 */

import type {
  QuestionClassifier,
  QuestionClassificationResult,
  QuestionType,
} from "./question-classifier.js";

export class PatternClassifier implements QuestionClassifier {
  private patterns: Record<QuestionType, RegExp[]> = {
    analytical: [
      /왜/,
      /이유/,
      /원인/,
      /까닭/,
      /어째서/,
      /어찌하여/,
      /why/i,
      /reason/i,
      /cause/i,
    ],
    procedural: [
      /어떻게/,
      /방법/,
      /과정/,
      /절차/,
      /방식/,
      /수단/,
      /how/i,
      /method/i,
      /process/i,
      /procedure/i,
    ],
    comparative: [
      /차이/,
      /비교/,
      /다른/,
      /유사/,
      /같은/,
      /다르/,
      /비슷/,
      /compare/i,
      /difference/i,
      /similar/i,
      /versus/i,
      /vs/i,
    ],
    factual: [
      /무엇/,
      /뭐/,
      /누가/,
      /누구/,
      /언제/,
      /어디/,
      /몇/,
      /얼마/,
      /what/i,
      /who/i,
      /when/i,
      /where/i,
      /which/i,
      /how many/i,
      /how much/i,
    ],
  };

  // Pattern priority (higher = more specific)
  private priority: Record<QuestionType, number> = {
    analytical: 4,
    procedural: 3,
    comparative: 2,
    factual: 1,
  };

  classify(question: string): QuestionClassificationResult {
    const q = question.toLowerCase();

    // Check patterns in priority order
    const matches: Array<{
      type: QuestionType;
      matchedPattern: string;
      priority: number;
    }> = [];

    for (const [type, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(q)) {
          matches.push({
            type: type as QuestionType,
            matchedPattern: pattern.source,
            priority: this.priority[type as QuestionType],
          });
        }
      }
    }

    // If multiple matches, choose highest priority
    if (matches.length > 0) {
      const best = matches.sort((a, b) => b.priority - a.priority)[0];

      return {
        type: best.type,
        confidence: 0.8, // High confidence for pattern match
        classified: true,
        metadata: {
          matchedPattern: best.matchedPattern,
        },
      };
    }

    // No pattern matched → default to factual
    return {
      type: "factual",
      confidence: 0.5, // Low confidence for default
      classified: false,
      metadata: {
        reasoning: "No pattern matched, defaulting to factual",
      },
    };
  }

  classifyBatch(questions: string[]): QuestionClassificationResult[] {
    return questions.map((q) => this.classify(q));
  }

  getTypeDistribution(questions: string[]): {
    analytical: number;
    procedural: number;
    comparative: number;
    factual: number;
    total: number;
  } {
    const distribution = {
      analytical: 0,
      procedural: 0,
      comparative: 0,
      factual: 0,
      total: questions.length,
    };

    for (const question of questions) {
      const result = this.classify(question);
      distribution[result.type]++;
    }

    return distribution;
  }

  /**
   * Get classification statistics
   */
  getClassificationStatistics(questions: string[]): {
    distribution: {
      analytical: number;
      procedural: number;
      comparative: number;
      factual: number;
      total: number;
    };
    classified: number;
    unclassified: number;
    avgConfidence: number;
  } {
    const results = this.classifyBatch(questions);
    const distribution = this.getTypeDistribution(questions);

    const classified = results.filter((r) => r.classified).length;
    const unclassified = results.filter((r) => !r.classified).length;

    const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
    const avgConfidence =
      results.length > 0 ? totalConfidence / results.length : 0;

    return {
      distribution,
      classified,
      unclassified,
      avgConfidence,
    };
  }

  /**
   * Add custom pattern for a type
   */
  addPattern(type: QuestionType, pattern: RegExp): void {
    this.patterns[type].push(pattern);
  }

  /**
   * Get all patterns for debugging
   */
  getPatterns(): Record<QuestionType, RegExp[]> {
    return { ...this.patterns };
  }
}
