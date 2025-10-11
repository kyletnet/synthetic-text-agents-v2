/**
 * QA Regenerate API
 *
 * POST /api/trust/qa-regenerate
 *
 * Request:
 * {
 *   qaId: string,
 *   feedback?: string,
 *   preserveQuestion?: boolean,
 *   preserveAnswer?: boolean
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   original: QAPair,
 *   regenerated: QAPair,
 *   improvements: {
 *     score: { before: number, after: number },
 *     violations: { before: number, after: number }
 *   }
 * }
 */

import { FeedbackRewriter, type RewriteRequest, type QAFeedback } from '../../application/feedback-rewrite';
import type { QAPair } from '../../application/qa-generator';

/**
 * Regenerate Request
 */
export interface RegenerateRequest {
  qaId: string;
  feedback?: string;
  preserveQuestion?: boolean;
  preserveAnswer?: boolean;
  userId?: string;
}

/**
 * Regenerate Response
 */
export interface RegenerateResponse {
  success: boolean;
  original: QAPair;
  regenerated: QAPair;
  improvements: {
    score: {
      before: number;
      after: number;
      delta: number;
    };
    violations: {
      before: number;
      after: number;
      delta: number;
    };
    complianceGain: number;
  };
  message: string;
}

/**
 * QA Regenerate API
 */
export class QARegenerateAPI {
  private qaStore: Map<string, QAPair>;
  private rewriter: FeedbackRewriter;

  constructor() {
    this.qaStore = new Map();
    this.rewriter = new FeedbackRewriter();
  }

  /**
   * Regenerate QA with feedback
   */
  async regenerate(request: RegenerateRequest): Promise<RegenerateResponse | null> {
    const originalQA = this.qaStore.get(request.qaId);

    if (!originalQA) {
      return null;
    }

    // Create feedback from request
    const feedback: QAFeedback = {
      qaId: request.qaId,
      userId: request.userId || 'system',
      timestamp: new Date().toISOString(),
      feedbackType: request.feedback ? 'improvement' : 'correction',
      feedback: request.feedback || 'Regenerate with improved quality',
      severity: 'medium',
    };

    // If preserving parts, use suggestions
    if (request.preserveQuestion) {
      feedback.suggestedQuestion = originalQA.question;
    }
    if (request.preserveAnswer) {
      feedback.suggestedAnswer = originalQA.answer;
    }

    // Rewrite
    const rewriteRequest: RewriteRequest = {
      originalQA,
      feedback,
      preserveIntent: true,
      maxAttempts: 3,
    };

    const result = await this.rewriter.rewrite(rewriteRequest);

    if (!result.success) {
      return null;
    }

    // Store regenerated QA
    this.qaStore.set(result.rewrittenQA.id, result.rewrittenQA);

    return {
      success: true,
      original: originalQA,
      regenerated: result.rewrittenQA,
      improvements: {
        score: {
          before: result.improvements.validationScore.before,
          after: result.improvements.validationScore.after,
          delta: result.improvements.validationScore.after - result.improvements.validationScore.before,
        },
        violations: {
          before: result.improvements.violations.before,
          after: result.improvements.violations.after,
          delta: result.improvements.violations.after - result.improvements.violations.before,
        },
        complianceGain: result.improvements.complianceGain,
      },
      message: result.changes.summary,
    };
  }

  /**
   * Add QA to store
   */
  addQA(qa: QAPair): void {
    this.qaStore.set(qa.id, qa);
  }

  /**
   * Batch regenerate
   */
  async regenerateBatch(requests: RegenerateRequest[]): Promise<RegenerateResponse[]> {
    const results: RegenerateResponse[] = [];

    for (const request of requests) {
      const result = await this.regenerate(request);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }
}
