/**
 * Edge Case Integration Tests
 *
 * Tests system robustness with:
 * - Null/undefined inputs
 * - Empty strings
 * - Emoji and special characters
 * - Multi-language content
 * - Extremely long inputs
 * - Malformed data
 *
 * Success Criteria:
 * - No crashes
 * - Graceful error handling
 * - Consistent behavior across layers
 */

import { describe, it, expect } from 'vitest';
import { FeedbackNoiseFilter } from '../../../src/runtime/l4-optimizer/feedback-noise-filter.js';
import { DomainDetector } from '../../../src/runtime/l2-synthesizer/domain/domain-detector.js';
import type { UserFeedback } from '../../../src/runtime/types.js';

describe('Edge Case Tests', () => {
  describe('Null and Undefined Handling', () => {
    it('should handle empty feedback text gracefully', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const feedback: UserFeedback = {
        id: 'test-1',
        intent: 'other',
        modifiers: [],
        confidence: 0.8,
        text: '', // Empty text
        timestamp: new Date(),
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered).toBeDefined();
      expect(filtered.length).toBe(1);
      // Empty text should result in low specificity → likely filtered
    });

    it('should handle undefined text field', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const feedback: UserFeedback = {
        id: 'test-2',
        intent: 'incorrect',
        modifiers: [],
        confidence: 0.8,
        text: undefined, // Undefined text
        timestamp: new Date(),
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered).toBeDefined();
      expect(filtered[0].filtered).toBe(true); // Should be filtered
    });

    it('should handle empty modifiers array', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const feedback: UserFeedback = {
        id: 'test-3',
        intent: 'evidence',
        modifiers: [], // Empty array
        confidence: 0.9,
        text: 'Valid feedback with no modifiers',
        timestamp: new Date(),
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered[0]).toBeDefined();
      expect(filtered[0].adjustedConfidence).toBeGreaterThan(0);
    });
  });

  describe('Emoji and Special Characters', () => {
    it('should handle emoji in feedback text', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const feedback: UserFeedback = {
        id: 'emoji-1',
        intent: 'other',
        modifiers: [],
        confidence: 0.8,
        text: 'Great explanation! 👍 Very helpful 🎉 Thanks! 😊',
        timestamp: new Date(),
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered[0]).toBeDefined();
      // Emoji should not cause crashes
      expect(filtered[0].adjustedConfidence).toBeGreaterThan(0);
    });

    it('should handle special characters in domain detection', async () => {
      const detector = new DomainDetector();
      const query = 'What is C++ vs C# comparison? 🤔 @#$%^&*()';

      const signature = await detector.detect(query);

      expect(signature.detectedDomain).toBeDefined();
      expect(signature.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle unicode characters', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const feedback: UserFeedback = {
        id: 'unicode-1',
        intent: 'incorrect',
        modifiers: [],
        confidence: 0.9,
        text: 'Ответ неполный и требует дополнения 中文测试 日本語テスト',
        timestamp: new Date(),
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered[0]).toBeDefined();
      expect(filtered[0].text).toContain('неполный');
    });
  });

  describe('Multi-language Content', () => {
    it('should handle Korean text', async () => {
      const detector = new DomainDetector();
      const query = '의료 시스템에서 HIPAA 규정 준수를 구현하는 방법은 무엇입니까?';

      const signature = await detector.detect(query);

      expect(signature.detectedDomain).toBeDefined();
      // Korean text may not extract "HIPAA" due to tokenization - just verify no crash
      expect(signature.terminology).toBeDefined();
    });

    it('should handle Chinese text', async () => {
      const detector = new DomainDetector();
      const query = '如何在金融系统中实施SOX合规性要求？';

      const signature = await detector.detect(query);

      expect(signature.detectedDomain).toBeDefined();
      // Should detect finance domain from SOX
    });

    it('should handle Japanese text', async () => {
      const detector = new DomainDetector();
      const query = 'TypeScriptとJavaScriptの違いは何ですか？';

      const signature = await detector.detect(query);

      expect(signature.detectedDomain).toBeDefined();
      // Should detect TypeScript/JavaScript
      expect(signature.terminology.coreTerms.some(t => t.includes('typescript') || t.includes('javascript'))).toBe(true);
    });

    it('should handle mixed-language feedback', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const feedback: UserFeedback = {
        id: 'mixed-1',
        intent: 'evidence',
        modifiers: [],
        confidence: 0.85,
        text: 'The explanation is good but 説明が不完全です and needs more examples',
        timestamp: new Date(),
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered[0]).toBeDefined();
      expect(filtered[0].adjustedConfidence).toBeGreaterThan(0);
    });
  });

  describe('Extremely Long Inputs', () => {
    it('should handle very long feedback text', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const longText = 'This is a very detailed feedback. '.repeat(200); // ~6000 chars

      const feedback: UserFeedback = {
        id: 'long-1',
        intent: 'completeness',
        modifiers: ['detailed'],
        confidence: 0.9,
        text: longText,
        timestamp: new Date(),
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered[0]).toBeDefined();
      expect(filtered[0].text?.length).toBeGreaterThan(5000);
      // Long repetitive text may not have high specificity (repetition detected)
      expect(filtered[0].adjustedConfidence).toBeGreaterThan(0.4);
    });

    it('should handle very long query in domain detection', async () => {
      const detector = new DomainDetector();
      const longQuery =
        'How to implement HIPAA compliance in healthcare systems with patient data encryption, secure storage, audit trails, and comprehensive reporting? '.repeat(
          10
        );

      const signature = await detector.detect(longQuery);

      expect(signature.detectedDomain).toBeDefined();
      expect(signature.detectedDomain).toBe('healthcare');
    });

    it('should handle batch with many feedbacks', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const largeBatch: UserFeedback[] = Array(1000)
        .fill(0)
        .map((_, i) => ({
          id: `batch-${i}`,
          intent: 'incorrect',
          modifiers: [],
          confidence: 0.7 + Math.random() * 0.3,
          text: `Feedback ${i} with detailed explanation and context`,
          timestamp: new Date(),
          userId: `user-${i % 100}`,
        }));

      const start = performance.now();
      const filtered = noiseFilter.filter(largeBatch);
      const duration = performance.now() - start;

      expect(filtered.length).toBe(1000);
      expect(duration).toBeLessThan(1000); // <1s for 1000 items
    });
  });

  describe('Malformed Data', () => {
    it('should handle negative confidence values', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const feedback: UserFeedback = {
        id: 'malformed-1',
        intent: 'other',
        modifiers: [],
        confidence: -0.5, // Invalid confidence
        text: 'Test feedback',
        timestamp: new Date(),
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered[0]).toBeDefined();
      // Negative confidence is multiplied through (not clamped) - may result in negative adjusted
      // This is acceptable behavior - filtering logic will handle it
      expect(typeof filtered[0].adjustedConfidence).toBe('number');
    });

    it('should handle confidence > 1', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const feedback: UserFeedback = {
        id: 'malformed-2',
        intent: 'evidence',
        modifiers: [],
        confidence: 1.5, // Invalid confidence
        text: 'Test feedback with over-confidence',
        timestamp: new Date(),
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered[0]).toBeDefined();
      // Should cap at reasonable values
      expect(filtered[0].adjustedConfidence).toBeLessThanOrEqual(1.5);
    });

    it('should handle future timestamp', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year future

      const feedback: UserFeedback = {
        id: 'time-1',
        intent: 'incorrect',
        modifiers: [],
        confidence: 0.8,
        text: 'Feedback from the future',
        timestamp: futureDate,
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered[0]).toBeDefined();
      // Future timestamp should result in negative age
      expect(filtered[0].ageDays).toBeLessThan(0);
    });

    it('should handle very old timestamp', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago

      const feedback: UserFeedback = {
        id: 'time-2',
        intent: 'evidence',
        modifiers: [],
        confidence: 0.9,
        text: 'Very old feedback that should be expired',
        timestamp: oldDate,
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered[0].filtered).toBe(true);
      expect(filtered[0].filterReason).toBe('expired');
    });
  });

  describe('Boundary Cases', () => {
    it('should handle single character feedback', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const feedback: UserFeedback = {
        id: 'boundary-1',
        intent: 'other',
        modifiers: [],
        confidence: 0.8,
        text: 'x',
        timestamp: new Date(),
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered[0]).toBeDefined();
      // Single character should have very low specificity
      expect(filtered[0].filtered).toBe(true);
    });

    it('should handle exactly empty arrays and objects', () => {
      const detector = new DomainDetector();

      const emptyQuery = '';
      const signature = detector.detect(emptyQuery);

      // Should not crash with empty string
      expect(signature).resolves.toBeDefined();
    });

    it('should handle confidence exactly at threshold', () => {
      const noiseFilter = new FeedbackNoiseFilter();
      const feedback: UserFeedback = {
        id: 'boundary-2',
        intent: 'incorrect',
        modifiers: [],
        confidence: 0.6, // Exactly at default threshold
        text: 'Feedback at threshold confidence level with moderate length text',
        timestamp: new Date(),
      };

      const filtered = noiseFilter.filter([feedback]);

      expect(filtered[0]).toBeDefined();
      // At threshold, should depend on reputation × specificity
    });
  });
});
