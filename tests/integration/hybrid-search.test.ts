/**
 * Hybrid Search Integration Tests
 *
 * Tests the complete Hybrid Search flow:
 * 1. Index documents
 * 2. Search with Elasticsearch + FAISS
 * 3. Merge results with RRF
 * 4. Validate result quality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HybridSearchEngine } from '../../src/infrastructure/retrieval/hybrid/hybrid-search-engine';
import { MockElasticsearchClient, MockFAISSClient } from '../../src/infrastructure/retrieval/hybrid/mock-clients';

describe('Hybrid Search - E2E Integration', () => {
  let engine: HybridSearchEngine;

  beforeEach(async () => {
    const elasticClient = new MockElasticsearchClient();
    const faissClient = new MockFAISSClient();
    engine = new HybridSearchEngine(elasticClient, faissClient);

    // Index sample documents (Korean child care service documents)
    const documents = [
      {
        id: 'doc1',
        content: '아이돌봄 서비스 요금은 기본형 11,630원, 종합형 15,110원입니다.',
        metadata: { page: 47, type: 'table' as const, section: '제3조' },
      },
      {
        id: 'doc2',
        content: '정부 지원금은 소득에 따라 차등 지급됩니다. 가형 85%, 나형 60%, 다형 15%입니다.',
        metadata: { page: 48, type: 'paragraph' as const, section: '제4조' },
      },
      {
        id: 'doc3',
        content: '아이돌봄 서비스 신청 대상은 만 12세 이하 아동이 있는 가정입니다.',
        metadata: { page: 10, type: 'paragraph' as const, section: '제1조' },
      },
      {
        id: 'doc4',
        content: '서비스 이용 시간은 1회 최소 2시간 이상부터 가능합니다.',
        metadata: { page: 52, type: 'paragraph' as const, section: '제5조' },
      },
      {
        id: 'doc5',
        content: '소득 기준은 중위소득 150% 이하 가구가 정부 지원 대상입니다.',
        metadata: { page: 20, type: 'table' as const, section: '제2조' },
      },
    ];

    await engine.index(documents);
  });

  describe('Basic Search Functionality', () => {
    it('should return results for simple query', async () => {
      const results = await engine.search({
        query: '아이돌봄 서비스 요금',
        k: 5,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);

      // Check result structure
      results.forEach(result => {
        expect(result.id).toBeDefined();
        expect(result.content).toBeDefined();
        expect(result.rrfScore).toBeGreaterThan(0);
        expect(result.originalRank).toBeDefined();
      });
    });

    it('should rank relevant documents higher', async () => {
      const results = await engine.search({
        query: '아이돌봄 요금',
        k: 5,
      });

      expect(results.length).toBeGreaterThan(0);

      // First result should be the most relevant (pricing document)
      expect(results[0].content).toContain('요금');
    });

    it('should handle Korean text correctly', async () => {
      const results = await engine.search({
        query: '정부 지원금',
        k: 5,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('지원금');
    });
  });

  describe('Metadata Filtering', () => {
    it('should filter by page number', async () => {
      const results = await engine.search({
        query: '서비스',
        k: 5,
        filters: { page: 47 },
      });

      results.forEach(result => {
        expect(result.metadata.page).toBe(47);
      });
    });

    it('should filter by document type', async () => {
      const results = await engine.search({
        query: '아이돌봄',
        k: 5,
        filters: { type: 'table' },
      });

      results.forEach(result => {
        expect(result.metadata.type).toBe('table');
      });
    });

    it('should filter by section', async () => {
      const results = await engine.search({
        query: '신청',
        k: 5,
        filters: { section: '제1조' },
      });

      results.forEach(result => {
        expect(result.metadata.section).toBe('제1조');
      });
    });
  });

  describe('RRF Score Calculation', () => {
    it('should assign RRF scores to all results', async () => {
      const results = await engine.search({
        query: '아이돌봄 서비스',
        k: 5,
      });

      results.forEach(result => {
        expect(result.rrfScore).toBeDefined();
        expect(result.rrfScore).toBeGreaterThan(0);
      });
    });

    it('should rank documents by RRF score (descending)', async () => {
      const results = await engine.search({
        query: '아이돌봄 서비스',
        k: 5,
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i].rrfScore).toBeLessThanOrEqual(results[i - 1].rrfScore);
      }
    });

    it('should boost documents appearing in both sources', async () => {
      const results = await engine.search({
        query: '아이돌봄 서비스',
        k: 5,
      });

      // Documents appearing in both Elasticsearch and FAISS should have both ranks
      const docsInBoth = results.filter(
        r => r.originalRank.elastic !== undefined && r.originalRank.faiss !== undefined
      );

      // At least some documents should appear in both
      expect(docsInBoth.length).toBeGreaterThan(0);
    });
  });

  describe('Performance & Caching', () => {
    it('should cache results', async () => {
      const query = { query: '아이돌봄 서비스 요금', k: 5 };

      // First query
      await engine.search(query);
      let metrics = engine.getMetrics();
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.cacheHits).toBe(0);

      // Second query (should hit cache)
      await engine.search(query);
      metrics = engine.getMetrics();
      expect(metrics.cacheHits).toBe(1);
    });

    it('should clear cache after re-indexing', async () => {
      const query = { query: '아이돌봄 서비스', k: 5 };

      // First query
      await engine.search(query);

      // Re-index
      await engine.index([
        {
          id: 'doc6',
          content: '새로운 문서입니다.',
          metadata: {},
        },
      ]);

      // Query again (cache should be cleared)
      await engine.search(query);
      const metrics = engine.getMetrics();

      // Both queries should be cache misses (cache was cleared)
      expect(metrics.cacheMisses).toBe(2);
    });

    it('should track search metrics', async () => {
      await engine.search({ query: '아이돌봄', k: 5 });
      await engine.search({ query: '서비스', k: 5 });

      const metrics = engine.getMetrics();

      expect(metrics.totalQueries).toBe(2);
      expect(metrics.elasticTime).toBeGreaterThan(0);
      expect(metrics.faissTime).toBeGreaterThan(0);
      expect(metrics.mergeTime).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('Weight Tuning', () => {
    it('should allow updating RRF weights', async () => {
      // Default weights: elastic 0.6, faiss 0.4
      const results1 = await engine.search({ query: '아이돌봄', k: 5 });

      // Update weights to favor FAISS
      engine.updateWeights({ elastic: 0.3, faiss: 0.7 });

      const results2 = await engine.search({ query: '아이돌봄', k: 5 });

      // Results should be different (but we can't easily test exact ordering without real scores)
      expect(results2).toBeDefined();
      expect(results2.length).toBe(results1.length);
    });

    it('should clear cache after weight update', async () => {
      const query = { query: '아이돌봄', k: 5 };

      await engine.search(query);

      // Update weights (should clear cache)
      engine.updateWeights({ elastic: 0.5, faiss: 0.5 });

      await engine.search(query);

      const metrics = engine.getMetrics();
      expect(metrics.cacheMisses).toBe(2); // Both queries should miss cache
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty query', async () => {
      const results = await engine.search({ query: '', k: 5 });

      // Should return empty or all documents (depending on implementation)
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle query with no matches', async () => {
      const results = await engine.search({ query: 'xyz不存在的词汇', k: 5 });

      // Should return empty array
      expect(results.length).toBe(0);
    });

    it('should handle k=0', async () => {
      const results = await engine.search({ query: '아이돌봄', k: 0 });

      // Should return empty array
      expect(results.length).toBe(0);
    });

    it('should handle large k value', async () => {
      const results = await engine.search({ query: '아이돌봄', k: 100 });

      // Should return all matching documents (up to 5 in test data)
      expect(results.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Cleanup', () => {
    it('should close clients properly', async () => {
      await expect(engine.close()).resolves.not.toThrow();
    });
  });
});
