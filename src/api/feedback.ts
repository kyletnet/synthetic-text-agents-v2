/**
 * Feedback API
 *
 * RESTful endpoint for submitting feedback on QA pairs
 *
 * POST /api/feedback
 * {
 *   qaId: string,
 *   userId: string,
 *   feedbackType: 'correction' | 'improvement' | 'tone' | 'accuracy',
 *   feedback: string,
 *   suggestedQuestion?: string,
 *   suggestedAnswer?: string,
 *   severity: 'low' | 'medium' | 'high'
 * }
 *
 * Response:
 * {
 *   success: true,
 *   feedbackId: string,
 *   message: 'Feedback received'
 * }
 */

import { FeedbackRewriter, type QAFeedback, type RewriteRequest } from '../application/feedback-rewrite';
import type { QAPair } from '../application/qa-generator';

/**
 * Feedback API Handler
 */
export class FeedbackAPI {
  private rewriter: FeedbackRewriter;
  private feedbackStore: Map<string, QAFeedback>;

  constructor() {
    this.rewriter = new FeedbackRewriter();
    this.feedbackStore = new Map();
  }

  /**
   * Submit feedback
   */
  async submitFeedback(feedback: QAFeedback): Promise<{
    success: boolean;
    feedbackId: string;
    message: string;
  }> {
    const feedbackId = `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store feedback
    this.feedbackStore.set(feedbackId, {
      ...feedback,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      feedbackId,
      message: 'Feedback received and will be processed',
    };
  }

  /**
   * Get feedback for QA
   */
  async getFeedback(qaId: string): Promise<QAFeedback[]> {
    const feedbacks: QAFeedback[] = [];

    for (const [, feedback] of this.feedbackStore) {
      if (feedback.qaId === qaId) {
        feedbacks.push(feedback);
      }
    }

    return feedbacks;
  }

  /**
   * Trigger rewrite based on feedback
   */
  async triggerRewrite(
    originalQA: QAPair,
    feedbackId: string
  ): Promise<{
    success: boolean;
    rewrittenQA?: QAPair;
    improvements?: any;
  }> {
    const feedback = this.feedbackStore.get(feedbackId);

    if (!feedback) {
      return {
        success: false,
      };
    }

    const request: RewriteRequest = {
      originalQA,
      feedback,
      preserveIntent: true,
      maxAttempts: 3,
    };

    const result = await this.rewriter.rewrite(request);

    return {
      success: result.success,
      rewrittenQA: result.rewrittenQA,
      improvements: result.improvements,
    };
  }
}
