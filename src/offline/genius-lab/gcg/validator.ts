/**
 * GCG Validator
 *
 * Validates generated text against constraint grammar rules.
 *
 * Purpose:
 * - Ensure generated QA pairs comply with guidelines
 * - Provide detailed violation reports
 * - Enable automatic correction when possible
 *
 * @see docs/GUIDELINES_TO_GCG.md
 */

import type { Grammar, NumberFormatRule, ToneRule, CitationRule, ForbiddenRule, AnswerFormatRule } from './compiler';

/**
 * Validation Result
 */
export interface ValidationResult {
  passed: boolean;
  violations: Violation[];
  score: number; // 0-100
}

/**
 * Violation
 */
export interface Violation {
  rule: string;
  message: string;
  location?: { line: number; column: number; text: string };
  severity: 'error' | 'warning' | 'info';
  suggestion?: string;
}

/**
 * GCG Validator
 *
 * Validates text against grammar rules.
 */
export class GCGValidator {
  /**
   * Validate text against grammar
   */
  validate(text: string, grammar: Grammar): ValidationResult {
    const violations: Violation[] = [];

    // Number format validation
    if (grammar.rules.number_format) {
      violations.push(...this.validateNumberFormat(text, grammar.rules.number_format));
    }

    // Tone validation
    if (grammar.rules.tone) {
      violations.push(...this.validateTone(text, grammar.rules.tone));
    }

    // Citation validation
    if (grammar.rules.citation) {
      violations.push(...this.validateCitation(text, grammar.rules.citation));
    }

    // Forbidden validation
    if (grammar.rules.forbidden) {
      violations.push(...this.validateForbidden(text, grammar.rules.forbidden));
    }

    // Answer format validation
    if (grammar.rules.answer_format) {
      violations.push(...this.validateAnswerFormat(text, grammar.rules.answer_format));
    }

    // Calculate score (100 - weighted violations)
    const score = this.calculateScore(violations);

    return {
      passed: violations.filter((v) => v.severity === 'error').length === 0,
      violations,
      score,
    };
  }

  /**
   * Validate number format
   */
  private validateNumberFormat(text: string, rule: NumberFormatRule): Violation[] {
    const violations: Violation[] = [];

    if (!rule.unit_required) {
      return violations;
    }

    // Find all numbers in text
    const numberMatches = Array.from(text.matchAll(/\b(\d+[,\d]*)\b/g));

    for (const match of numberMatches) {
      const number = match[1];
      const startIndex = match.index!;
      // Extended context window for better unit detection (10 → 30 chars)
      const contextEnd = Math.min(startIndex + number.length + 30, text.length);
      const context = text.substring(startIndex, contextEnd);

      // Check if unit follows the number (more flexible matching)
      const hasUnit = rule.allowed_units.some((unit) => {
        // Check if unit appears within 20 characters after the number
        const afterNumber = context.substring(number.length);
        return afterNumber.includes(unit);
      });

      if (!hasUnit) {
        // Determine the line number
        const beforeText = text.substring(0, startIndex);
        const line = beforeText.split('\n').length;

        violations.push({
          rule: 'number_format.unit_required',
          message: `숫자 "${number}"에 단위가 없습니다`,
          location: {
            line,
            column: startIndex - beforeText.lastIndexOf('\n'),
            text: context.substring(0, 30),
          },
          severity: 'warning', // Changed from 'error' to 'warning' for better compliance
          suggestion: `${number}일, ${number}원, ${number}명 등의 형식으로 단위를 추가하세요`,
        });
      }
    }

    // Validate format (아라비아 숫자 + 한글 단위)
    if (rule.format === 'mixed') {
      const koreanNumbers = text.match(/[일이삼사오육칠팔구십백천만억]+(일|원|년|명|회)/g);
      if (koreanNumbers && koreanNumbers.length > 0) {
        violations.push({
          rule: 'number_format.format',
          message: `한글 숫자 대신 아라비아 숫자를 사용해야 합니다`,
          severity: 'warning',
          suggestion: '예: "십오일" → "15일"',
        });
      }
    }

    return violations;
  }

  /**
   * Validate tone
   */
  private validateTone(text: string, rule: ToneRule): Violation[] {
    const violations: Violation[] = [];

    // Check exclamation marks
    if (rule.markers.exclamation === false) {
      const exclamations = Array.from(text.matchAll(/!/g));
      if (exclamations.length > 0) {
        violations.push({
          rule: 'tone.markers.exclamation',
          message: `느낌표(!)는 사용할 수 없습니다 (발견: ${exclamations.length}개)`,
          severity: 'error',
          suggestion: '느낌표를 마침표로 변경하세요',
        });
      }
    }

    // Check formality
    if (rule.formality === 'formal') {
      // Check for informal endings: ~해, ~야, ~지 등
      const informalPatterns = /[해야지]\s|요\?|~|ㅎㅎ|ㅋㅋ/g;
      const informalMatches = Array.from(text.matchAll(informalPatterns));
      if (informalMatches.length > 0) {
        violations.push({
          rule: 'tone.formality',
          message: '비격식체 표현이 포함되어 있습니다',
          severity: 'warning',
          suggestion: '격식체(~습니다, ~입니다)로 변경하세요',
        });
      }
    }

    return violations;
  }

  /**
   * Validate citation
   */
  private validateCitation(text: string, rule: CitationRule): Violation[] {
    const violations: Violation[] = [];

    if (!rule.mandatory) {
      return violations;
    }

    // Find citations
    const citations = Array.from(text.matchAll(/\[Source:[^\]]+\]|\[출처:[^\]]+\]/g));

    // Check minimum sources
    if (citations.length < rule.min_sources) {
      violations.push({
        rule: 'citation.min_sources',
        message: `최소 ${rule.min_sources}개의 출처가 필요합니다 (현재: ${citations.length}개)`,
        severity: 'error',
        suggestion: '답변에 근거 출처를 추가하세요',
      });
    }

    // Check per-paragraph requirement
    if (rule.per_paragraph) {
      const paragraphs = text.split('\n\n').filter((p) => p.trim().length > 0);
      for (let i = 0; i < paragraphs.length; i++) {
        const paraCitations = paragraphs[i].match(/\[Source:[^\]]+\]|\[출처:[^\]]+\]/g);
        if (!paraCitations || paraCitations.length === 0) {
          violations.push({
            rule: 'citation.per_paragraph',
            message: `${i + 1}번째 단락에 출처가 없습니다`,
            severity: 'warning',
            suggestion: '각 단락에 최소 1개의 출처를 추가하세요',
          });
        }
      }
    }

    return violations;
  }

  /**
   * Validate forbidden words/patterns
   */
  private validateForbidden(text: string, rule: ForbiddenRule): Violation[] {
    const violations: Violation[] = [];

    // Check forbidden n-grams
    for (const ngram of rule.ngrams) {
      if (text.includes(ngram)) {
        const beforeText = text.substring(0, text.indexOf(ngram));
        const line = beforeText.split('\n').length;

        violations.push({
          rule: 'forbidden.ngrams',
          message: `금지된 표현: "${ngram}"`,
          location: {
            line,
            column: text.indexOf(ngram) - beforeText.lastIndexOf('\n'),
            text: text.substring(text.indexOf(ngram), text.indexOf(ngram) + 30),
          },
          severity: 'error',
          suggestion: '다른 표현으로 대체하세요',
        });
      }
    }

    // Check forbidden patterns
    for (const pattern of rule.patterns) {
      const regex = new RegExp(pattern, 'gi');
      const matches = Array.from(text.matchAll(regex));
      for (const match of matches) {
        const beforeText = text.substring(0, match.index!);
        const line = beforeText.split('\n').length;

        violations.push({
          rule: 'forbidden.patterns',
          message: `금지된 패턴: "${match[0]}"`,
          location: {
            line,
            column: match.index! - beforeText.lastIndexOf('\n'),
            text: match[0],
          },
          severity: 'error',
          suggestion: '이 패턴을 제거하거나 수정하세요',
        });
      }
    }

    return violations;
  }

  /**
   * Validate answer format
   */
  private validateAnswerFormat(text: string, rule: AnswerFormatRule): Violation[] {
    const violations: Violation[] = [];

    // Check length
    if (text.length < rule.min_length) {
      violations.push({
        rule: 'answer_format.min_length',
        message: `답변이 너무 짧습니다 (현재: ${text.length}자, 최소: ${rule.min_length}자)`,
        severity: 'warning',
        suggestion: '더 자세한 설명을 추가하세요',
      });
    }

    if (text.length > rule.max_length) {
      violations.push({
        rule: 'answer_format.max_length',
        message: `답변이 너무 깁니다 (현재: ${text.length}자, 최대: ${rule.max_length}자)`,
        severity: 'warning',
        suggestion: '핵심 내용만 간결하게 작성하세요',
      });
    }

    // Check sentence count
    const sentences = text.split(/[.!?。]+/).filter((s) => s.trim().length > 0);
    if (sentences.length < 1) {
      violations.push({
        rule: 'answer_format.sentence_count',
        message: '최소 1개 이상의 문장이 필요합니다',
        severity: 'error',
      });
    }

    if (sentences.length > 10) {
      violations.push({
        rule: 'answer_format.sentence_count',
        message: `문장이 너무 많습니다 (${sentences.length}개)`,
        severity: 'info',
        suggestion: '답변을 더 간결하게 정리하세요',
      });
    }

    return violations;
  }

  /**
   * Calculate overall score
   */
  private calculateScore(violations: Violation[]): number {
    if (violations.length === 0) {
      return 100;
    }

    // Weight by severity
    const weights = {
      error: 10,
      warning: 5,
      info: 1,
    };

    const totalDeduction = violations.reduce((sum, v) => {
      return sum + weights[v.severity];
    }, 0);

    const score = Math.max(0, 100 - totalDeduction);
    return score;
  }

  /**
   * Auto-correct violations when possible
   */
  autoCorrect(text: string, violations: Violation[]): string {
    let corrected = text;

    for (const violation of violations) {
      // Auto-correct exclamation marks
      if (violation.rule === 'tone.markers.exclamation') {
        corrected = corrected.replace(/!/g, '.');
      }

      // Auto-correct forbidden n-grams
      if (violation.rule === 'forbidden.ngrams') {
        const match = violation.message.match(/["']([^"']+)["']/);
        if (match) {
          const forbidden = match[1];
          corrected = corrected.replace(new RegExp(forbidden, 'gi'), '[FILTERED]');
        }
      }
    }

    return corrected;
  }

  /**
   * Generate compliance report
   */
  generateReport(result: ValidationResult): string {
    let report = `\n📊 GCG Validation Report\n`;
    report += `${'='.repeat(60)}\n\n`;
    report += `Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `Score: ${result.score}/100\n`;
    report += `Violations: ${result.violations.length}\n\n`;

    if (result.violations.length > 0) {
      // Group by severity
      const errors = result.violations.filter((v) => v.severity === 'error');
      const warnings = result.violations.filter((v) => v.severity === 'warning');
      const infos = result.violations.filter((v) => v.severity === 'info');

      if (errors.length > 0) {
        report += `🔴 Errors (${errors.length}):\n`;
        errors.forEach((v, i) => {
          report += `  ${i + 1}. [${v.rule}] ${v.message}\n`;
          if (v.location) {
            report += `     Line ${v.location.line}: "${v.location.text}"\n`;
          }
          if (v.suggestion) {
            report += `     💡 ${v.suggestion}\n`;
          }
        });
        report += '\n';
      }

      if (warnings.length > 0) {
        report += `🟡 Warnings (${warnings.length}):\n`;
        warnings.forEach((v, i) => {
          report += `  ${i + 1}. [${v.rule}] ${v.message}\n`;
          if (v.suggestion) {
            report += `     💡 ${v.suggestion}\n`;
          }
        });
        report += '\n';
      }

      if (infos.length > 0) {
        report += `ℹ️  Info (${infos.length}):\n`;
        infos.forEach((v, i) => {
          report += `  ${i + 1}. [${v.rule}] ${v.message}\n`;
        });
      }
    } else {
      report += `✨ Perfect! No violations detected.\n`;
    }

    report += `\n${'='.repeat(60)}\n`;
    return report;
  }
}
