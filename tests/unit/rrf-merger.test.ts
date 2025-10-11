/**
 * RRF Merger Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { RRFMerger, createRRFMerger, normalizeScores } from '../../src/infrastructure/retrieval/hybrid/rrf-merger';
import type { SearchResult } from '../../src/infrastructure/retrieval/hybrid/types';

describe('RRFMerger', () => {
  describe('Constructor', () => {
    it('should create with default config', () => {
      const merger = new RRFMerger();
      const config = merger.getConfig();

      expect(config.k).toBe(60);
      expect(config.weights.elastic).toBe(0.6);
      expect(config.weights.faiss).toBe(0.4);
    });

    it('should create with custom config', () => {
      const merger = new RRFMerger({
        k: 100,
        weights: { elastic: 0.7, faiss: 0.3 },
      });
      const config = merger.getConfig();

      expect(config.k).toBe(100);
      expect(config.weights.elastic).toBe(0.7);
      expect(config.weights.faiss).toBe(0.3);
    });

    it('should throw error if weights do not sum to 1.0', () => {
      expect(() => {
        new RRFMerger({
          weights: { elastic: 0.5, faiss: 0.4 }, // Sum = 0.9
        });
      }).toThrow('weights must sum to 1.0');
    });
  });

  describe('merge()', () => {
    it('should merge results from two sources', () => {
      const merger = new RRFMerger();

      const elasticResults: SearchResult[] = [
        { id: 'doc1', score: 0.9, content: 'A', metadata: {} },
        { id: 'doc2', score: 0.8, content: 'B', metadata: {} },
        { id: 'doc3', score: 0.7, content: 'C', metadata: {} },
      ];

      const faissResults: SearchResult[] = [
        { id: 'doc2', score: 0.95, content: 'B', metadata: {} },
        { id: 'doc1', score: 0.85, content: 'A', metadata: {} },
        { id: 'doc4', score: 0.75, content: 'D', metadata: {} },
      ];

      const merged = merger.merge(elasticResults, faissResults, 5);

      // Check that results are merged
      expect(merged.length).toBeGreaterThan(0);

      // Check that doc1 and doc2 appear (they're in both lists)
      const ids = merged.map(r => r.id);
      expect(ids).toContain('doc1');
      expect(ids).toContain('doc2');

      // Check that RRF scores are calculated
      merged.forEach(result => {
        expect(result.rrfScore).toBeGreaterThan(0);
        expect(result.originalRank).toBeDefined();
      });
    });

    it('should rank documents appearing in both sources higher', () => {
      const merger = new RRFMerger();

      const elasticResults: SearchResult[] = [
        { id: 'doc1', score: 0.9, content: 'A', metadata: {} },
        { id: 'doc2', score: 0.8, content: 'B', metadata: {} },
      ];

      const faissResults: SearchResult[] = [
        { id: 'doc1', score: 0.95, content: 'A', metadata: {} },
        { id: 'doc3', score: 0.85, content: 'C', metadata: {} },
      ];

      const merged = merger.merge(elasticResults, faissResults, 5);

      // doc1 appears in both, should be ranked first
      expect(merged[0].id).toBe('doc1');
      expect(merged[0].originalRank.elastic).toBe(1);
      expect(merged[0].originalRank.faiss).toBe(1);
    });

    it('should respect topK parameter', () => {
      const merger = new RRFMerger();

      const elasticResults: SearchResult[] = Array.from({ length: 20 }, (_, i) => ({
        id: `doc${i}`,
        score: 1 - i * 0.01,
        content: `Doc ${i}`,
        metadata: {},
      }));

      const faissResults: SearchResult[] = Array.from({ length: 20 }, (_, i) => ({
        id: `doc${i + 10}`,
        score: 1 - i * 0.01,
        content: `Doc ${i + 10}`,
        metadata: {},
      }));

      const merged = merger.merge(elasticResults, faissResults, 10);

      expect(merged.length).toBe(10);
    });

    it('should handle empty results', () => {
      const merger = new RRFMerger();

      const merged1 = merger.merge([], [], 10);
      expect(merged1.length).toBe(0);

      const elasticResults: SearchResult[] = [
        { id: 'doc1', score: 0.9, content: 'A', metadata: {} },
      ];

      const merged2 = merger.merge(elasticResults, [], 10);
      expect(merged2.length).toBe(1);
      expect(merged2[0].id).toBe('doc1');
    });
  });

  describe('calculateScore()', () => {
    it('should calculate correct RRF score', () => {
      const merger = new RRFMerger({ k: 60 });

      // Rank 1, weight 1.0: 1 / (60 + 1) = 0.01639...
      const score1 = merger.calculateScore(1, 1.0);
      expect(score1).toBeCloseTo(1 / 61, 5);

      // Rank 10, weight 0.5: 0.5 / (60 + 10) = 0.00714...
      const score10 = merger.calculateScore(10, 0.5);
      expect(score10).toBeCloseTo(0.5 / 70, 5);
    });

    it('should produce monotonically decreasing scores', () => {
      const merger = new RRFMerger();

      const scores = [1, 2, 3, 5, 10, 20, 50, 100].map(rank =>
        merger.calculateScore(rank, 1.0)
      );

      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThan(scores[i - 1]);
      }
    });
  });

  describe('updateWeights()', () => {
    it('should update weights successfully', () => {
      const merger = new RRFMerger();

      merger.updateWeights({ elastic: 0.7, faiss: 0.3 });
      const config = merger.getConfig();

      expect(config.weights.elastic).toBe(0.7);
      expect(config.weights.faiss).toBe(0.3);
    });

    it('should throw error if new weights do not sum to 1.0', () => {
      const merger = new RRFMerger();

      expect(() => {
        merger.updateWeights({ elastic: 0.5, faiss: 0.4 });
      }).toThrow('weights must sum to 1.0');
    });
  });

  describe('mergeMultiple()', () => {
    it('should merge multiple result lists', () => {
      const merger = new RRFMerger();

      const list1: SearchResult[] = [
        { id: 'doc1', score: 0.9, content: 'A', metadata: {} },
        { id: 'doc2', score: 0.8, content: 'B', metadata: {} },
      ];

      const list2: SearchResult[] = [
        { id: 'doc2', score: 0.95, content: 'B', metadata: {} },
        { id: 'doc3', score: 0.85, content: 'C', metadata: {} },
      ];

      const list3: SearchResult[] = [
        { id: 'doc1', score: 0.88, content: 'A', metadata: {} },
        { id: 'doc4', score: 0.77, content: 'D', metadata: {} },
      ];

      const merged = merger.mergeMultiple([
        { results: list1, weight: 0.5 },
        { results: list2, weight: 0.3 },
        { results: list3, weight: 0.2 },
      ], 5);

      expect(merged.length).toBeGreaterThan(0);

      // doc1 and doc2 appear in multiple lists, should rank high
      const ids = merged.map(r => r.id);
      expect(ids.slice(0, 2)).toContain('doc1');
      expect(ids.slice(0, 2)).toContain('doc2');
    });

    it('should throw error if weights do not sum to 1.0', () => {
      const merger = new RRFMerger();

      const list1: SearchResult[] = [
        { id: 'doc1', score: 0.9, content: 'A', metadata: {} },
      ];

      expect(() => {
        merger.mergeMultiple([
          { results: list1, weight: 0.5 },
          { results: list1, weight: 0.3 }, // Sum = 0.8
        ], 5);
      }).toThrow('weights must sum to 1.0');
    });
  });
});

describe('Utility Functions', () => {
  describe('createRRFMerger()', () => {
    it('should create RRF merger with default config', () => {
      const merger = createRRFMerger();
      const config = merger.getConfig();

      expect(config.k).toBe(60);
      expect(config.weights.elastic).toBe(0.6);
      expect(config.weights.faiss).toBe(0.4);
    });
  });

  describe('normalizeScores()', () => {
    it('should normalize scores to 0-1 range', () => {
      const results = [
        { id: 'doc1', score: 0.9, content: 'A', metadata: {}, rrfScore: 0.1, originalRank: {} },
        { id: 'doc2', score: 0.8, content: 'B', metadata: {}, rrfScore: 0.05, originalRank: {} },
        { id: 'doc3', score: 0.7, content: 'C', metadata: {}, rrfScore: 0.02, originalRank: {} },
      ];

      const normalized = normalizeScores(results);

      // Check all scores are in 0-1 range
      normalized.forEach(result => {
        expect(result.rrfScore).toBeGreaterThanOrEqual(0);
        expect(result.rrfScore).toBeLessThanOrEqual(1);
      });

      // Max score should be 1.0
      expect(normalized[0].rrfScore).toBeCloseTo(1.0, 5);

      // Min score should be 0.0
      expect(normalized[normalized.length - 1].rrfScore).toBeCloseTo(0.0, 5);
    });

    it('should handle empty results', () => {
      const normalized = normalizeScores([]);
      expect(normalized.length).toBe(0);
    });

    it('should handle uniform scores', () => {
      const results = [
        { id: 'doc1', score: 0.9, content: 'A', metadata: {}, rrfScore: 0.5, originalRank: {} },
        { id: 'doc2', score: 0.8, content: 'B', metadata: {}, rrfScore: 0.5, originalRank: {} },
        { id: 'doc3', score: 0.7, content: 'C', metadata: {}, rrfScore: 0.5, originalRank: {} },
      ];

      const normalized = normalizeScores(results);

      // All scores should be 1.0 when they're all the same
      normalized.forEach(result => {
        expect(result.rrfScore).toBe(1.0);
      });
    });
  });
});
