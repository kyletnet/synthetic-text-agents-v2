/**
 * QA Generator
 *
 * Generates Question-Answer pairs from document evidence following
 * guideline-based constraint grammar.
 *
 * Pipeline:
 * 1. Load document chunks from EvidenceStore
 * 2. Compile guideline → GCG rules
 * 3. Generate QA pairs using LLM + GCG constraints
 * 4. Validate with GCGValidator
 * 5. Return compliant QA pairs
 *
 * Exit KPI:
 * - Groundedness ≥ 85%
 * - Faithfulness ≥ 90%
 * - Guideline Compliance ≥ 90%
 *
 * @see PHASE_2.7_COMPLETE_HANDOFF.md
 */

import * as fs from 'fs';
import type { EvidenceStore } from '../core/transparency/evidence-store';
import type { EvidenceItem } from '../core/transparency/evidence-types';
import { GCGCompiler, type Grammar } from '../offline/genius-lab/gcg/compiler';
import { GCGValidator, type ValidationResult } from '../offline/genius-lab/gcg/validator';

/**
 * QA Pair
 */
export interface QAPair {
  id: string;
  question: string;
  answer: string;
  sourceChunks: string[]; // Evidence chunk IDs
  metadata: {
    domain: string;
    questionType: string;
    difficulty: string;
    generatedAt: string;
    validationScore: number;
    violations: number;
  };
}

/**
 * QA Generation Request
 */
export interface QAGenerationRequest {
  documentId: string;
  guidelinePath: string;
  count: number; // Number of QA pairs to generate
  domains?: string[]; // Filter by domains
  questionTypes?: string[]; // Filter by question types
}

/**
 * QA Generation Result
 */
export interface QAGenerationResult {
  success: boolean;
  documentId: string;
  totalGenerated: number;
  totalValid: number;
  complianceRate: number; // %
  qaPairs: QAPair[];
  errors: string[];
  duration: number;
}

/**
 * QA Generator Configuration
 */
export interface QAGeneratorConfig {
  maxRetries: number; // Max retry attempts per QA
  minValidationScore: number; // Minimum score to accept (0-100)
  enableAutoCorrect: boolean; // Auto-correct violations when possible
}

const DEFAULT_CONFIG: QAGeneratorConfig = {
  maxRetries: 3,
  minValidationScore: 80,
  enableAutoCorrect: true,
};

/**
 * QA Generator
 *
 * Generates guideline-compliant QA pairs from documents.
 */
export class QAGenerator {
  private evidenceStore: EvidenceStore;
  private gcgCompiler: GCGCompiler;
  private gcgValidator: GCGValidator;
  private config: QAGeneratorConfig;
  private grammar?: Grammar;

  constructor(
    evidenceStore: EvidenceStore,
    config: Partial<QAGeneratorConfig> = {}
  ) {
    this.evidenceStore = evidenceStore;
    this.gcgCompiler = new GCGCompiler();
    this.gcgValidator = new GCGValidator();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate QA pairs from document
   */
  async generateQA(request: QAGenerationRequest): Promise<QAGenerationResult> {
    const startTime = performance.now();
    const errors: string[] = [];

    try {
      // 1. Load and compile guideline
      console.log(`📘 Loading guideline: ${request.guidelinePath}`);
      this.grammar = this.gcgCompiler.compile(request.guidelinePath);
      const grammarValidation = this.gcgCompiler.validate(this.grammar);
      if (!grammarValidation.valid) {
        throw new Error(`Invalid grammar: ${grammarValidation.errors.join(', ')}`);
      }

      console.log(`✅ Grammar compiled (domain: ${this.grammar.domain})`);

      // 2. Load document chunks
      console.log(`📄 Loading document chunks: ${request.documentId}`);
      const chunks = this.evidenceStore.queryEvidence({
        sourceIds: [request.documentId],
      });

      if (chunks.length === 0) {
        throw new Error(`No chunks found for document: ${request.documentId}`);
      }

      console.log(`✅ Loaded ${chunks.length} chunks`);

      // 3. Generate QA pairs
      console.log(`🤖 Generating ${request.count} QA pairs...`);
      const qaPairs: QAPair[] = [];
      const targetCount = request.count;

      for (let i = 0; i < targetCount && chunks.length > 0; i++) {
        try {
          // Select random chunk
          const chunkIndex = Math.floor(Math.random() * chunks.length);
          const chunk = chunks[chunkIndex];

          // Generate QA from chunk
          const qaPair = await this.generateQAFromChunk(chunk, i);

          if (qaPair) {
            qaPairs.push(qaPair);
            console.log(`  ✓ Generated QA ${i + 1}/${targetCount} (score: ${qaPair.metadata.validationScore})`);
          } else {
            errors.push(`Failed to generate QA from chunk ${chunk.id}`);
            console.log(`  ✗ Failed to generate QA ${i + 1}/${targetCount}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          errors.push(`QA generation error: ${errorMessage}`);
          console.error(`  ✗ Error generating QA ${i + 1}: ${errorMessage}`);
        }
      }

      // Calculate compliance rate
      const totalValid = qaPairs.filter(
        (qa) => qa.metadata.validationScore >= this.config.minValidationScore
      ).length;
      const complianceRate = qaPairs.length > 0 ? (totalValid / qaPairs.length) * 100 : 0;

      const duration = performance.now() - startTime;

      console.log(`\n✅ QA Generation Complete`);
      console.log(`   Generated: ${qaPairs.length}/${targetCount}`);
      console.log(`   Valid: ${totalValid}/${qaPairs.length}`);
      console.log(`   Compliance: ${complianceRate.toFixed(1)}%`);
      console.log(`   Duration: ${duration.toFixed(2)}ms`);

      return {
        success: true,
        documentId: request.documentId,
        totalGenerated: qaPairs.length,
        totalValid,
        complianceRate,
        qaPairs,
        errors,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

      console.error(`❌ QA Generation Failed: ${errorMessage}`);

      return {
        success: false,
        documentId: request.documentId,
        totalGenerated: 0,
        totalValid: 0,
        complianceRate: 0,
        qaPairs: [],
        errors,
        duration,
      };
    }
  }

  /**
   * Generate single QA pair from evidence chunk
   */
  private async generateQAFromChunk(chunk: EvidenceItem, index: number): Promise<QAPair | null> {
    if (!this.grammar) {
      throw new Error('Grammar not loaded');
    }

    let retries = 0;
    const maxRetries = this.config.maxRetries;

    while (retries < maxRetries) {
      try {
        // Generate QA using synthetic generation (rule-based)
        // In production, this would call an LLM API (Claude, GPT-4, etc.)
        const { question, answer } = this.generateSyntheticQA(chunk, this.grammar);

        // Validate against grammar
        const questionValidation = this.gcgValidator.validate(question, this.grammar);
        const answerValidation = this.gcgValidator.validate(answer, this.grammar);

        // Auto-correct if enabled
        let finalQuestion = question;
        let finalAnswer = answer;

        if (this.config.enableAutoCorrect) {
          if (!questionValidation.passed) {
            finalQuestion = this.gcgValidator.autoCorrect(question, questionValidation.violations);
          }
          if (!answerValidation.passed) {
            finalAnswer = this.gcgValidator.autoCorrect(answer, answerValidation.violations);
          }
        }

        // Re-validate after correction
        const finalQuestionValidation = this.gcgValidator.validate(finalQuestion, this.grammar);
        const finalAnswerValidation = this.gcgValidator.validate(finalAnswer, this.grammar);

        const avgScore = (finalQuestionValidation.score + finalAnswerValidation.score) / 2;
        const totalViolations =
          finalQuestionValidation.violations.filter((v) => v.severity === 'error').length +
          finalAnswerValidation.violations.filter((v) => v.severity === 'error').length;

        // Check if meets minimum score
        if (avgScore >= this.config.minValidationScore) {
          return {
            id: `qa-${chunk.id}-${index}`,
            question: finalQuestion,
            answer: finalAnswer,
            sourceChunks: [chunk.id],
            metadata: {
              domain: this.grammar.domain,
              questionType: this.detectQuestionType(finalQuestion),
              difficulty: this.detectDifficulty(finalQuestion),
              generatedAt: new Date().toISOString(),
              validationScore: avgScore,
              violations: totalViolations,
            },
          };
        }

        retries++;
        console.log(`    Retry ${retries}/${maxRetries} (score: ${avgScore.toFixed(1)})`);
      } catch (error) {
        retries++;
        console.error(`    Retry ${retries}/${maxRetries} (error: ${error})`);
      }
    }

    return null;
  }

  /**
   * Generate synthetic QA (rule-based)
   *
   * NOTE: In production, replace this with LLM API call (Claude/GPT-4)
   */
  private generateSyntheticQA(chunk: EvidenceItem, grammar: Grammar): { question: string; answer: string } {
    const content = chunk.content;

    // Extract key information from content
    const sentences = content.split(/[.!?]/).filter((s) => s.trim().length > 20);
    if (sentences.length === 0) {
      throw new Error('No valid sentences in chunk');
    }

    // Select random sentence as basis
    const baseSentence = sentences[Math.floor(Math.random() * sentences.length)].trim();

    // Generate question based on content patterns
    let question = '';
    let answer = '';

    // Pattern 1: Numbers (일수, 금액 등)
    const numberMatch = baseSentence.match(/(\d+)(일|원|년|개월|명|회|퍼센트)/);
    if (numberMatch) {
      const [_, num, unit] = numberMatch;
      // Extract subject from sentence
      const subjectMatch = baseSentence.match(/([가-힣\s]+)(은|는|가|이)/);
      const subject = subjectMatch ? subjectMatch[1].trim() : '해당 항목';

      question = `${subject}은 며칠인가요?`;
      answer = `${subject}은 ${num}${unit}입니다.`;
    }
    // Pattern 2: Conditional (조건부)
    else if (baseSentence.includes('경우') || baseSentence.includes('때')) {
      const conditionMatch = baseSentence.match(/([^.]+)(경우|때)/);
      if (conditionMatch) {
        const condition = conditionMatch[1].trim();
        question = `${condition} 경우 어떻게 되나요?`;
        answer = baseSentence + (baseSentence.endsWith('.') ? '' : '.');
      } else {
        question = '해당 조건에서 어떤 규정이 적용되나요?';
        answer = baseSentence + (baseSentence.endsWith('.') ? '' : '.');
      }
    }
    // Pattern 3: Default
    else {
      const subjectMatch = baseSentence.match(/([가-힣\s]+)(은|는|가|이)/);
      const subject = subjectMatch ? subjectMatch[1].trim() : '이 항목';

      question = `${subject}에 대해 설명해주세요.`;
      answer = baseSentence + (baseSentence.endsWith('.') ? '' : '.');
    }

    return { question, answer };
  }

  /**
   * Detect question type
   */
  private detectQuestionType(question: string): string {
    if (question.includes('며칠') || question.includes('얼마')) {
      return '기본 정보 확인형';
    }
    if (question.includes('경우') || question.includes('때')) {
      return '조건부 정보 확인형';
    }
    if (question.includes('차이') || question.includes('각각')) {
      return '비교/구분형';
    }
    if (question.includes('어떻게') || question.includes('방법')) {
      return '절차/방법 확인형';
    }
    return '기타';
  }

  /**
   * Detect difficulty level
   */
  private detectDifficulty(question: string): string {
    const conditions = (question.match(/경우|때|만|이상|이하|동안/g) || []).length;
    if (conditions >= 3) return '상';
    if (conditions >= 1) return '중';
    return '하';
  }

  /**
   * Save QA pairs to file
   */
  saveToFile(result: QAGenerationResult, outputPath: string): void {
    const dir = require('path').dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const output = {
      metadata: {
        documentId: result.documentId,
        generatedAt: new Date().toISOString(),
        totalGenerated: result.totalGenerated,
        totalValid: result.totalValid,
        complianceRate: result.complianceRate,
        duration: result.duration,
      },
      qaPairs: result.qaPairs,
      errors: result.errors,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`💾 Saved to: ${outputPath}`);
  }
}
