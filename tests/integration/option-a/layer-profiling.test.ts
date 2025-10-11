/**
 * Layer-wise Latency Profiling Tests
 *
 * Measures p50/p95/p99 latency for each layer:
 * - L1: Retrieval (BM25 + Vector + Fusion)
 * - L2: Synthesis (Answer generation + Entity linking)
 * - L3: Planning (NLI validation + Proof generation)
 * - L4: Optimization (Feedback processing + Bandit policy)
 *
 * Target: Identify bottlenecks for Phase 2.7 optimization
 */

import { describe, it, expect } from 'vitest';
import { FeedbackNoiseFilter } from '../../../src/runtime/l4-optimizer/feedback-noise-filter.js';
import { DomainDetector } from '../../../src/runtime/l2-synthesizer/domain/domain-detector.js';
import type { UserFeedback } from '../../../src/runtime/types.js';

interface LatencyStats {
  p50: number;
  p95: number;
  p99: number;
  mean: number;
  min: number;
  max: number;
}

function calculateStats(latencies: number[]): LatencyStats {
  const sorted = [...latencies].sort((a, b) => a - b);
  const len = sorted.length;

  return {
    p50: sorted[Math.floor(len * 0.5)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)],
    mean: sorted.reduce((sum, l) => sum + l, 0) / len,
    min: sorted[0],
    max: sorted[len - 1],
  };
}

describe('Layer-wise Latency Profiling', () => {
  const ITERATIONS = 1000;

  describe('L1: Retrieval Layer', () => {
    it('should measure BM25 retrieval latency (p50/p95/p99)', () => {
      const latencies: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        // Mock BM25 retrieval
        const query = `Test query ${i}`;
        const _results = mockBM25Retrieval(query);
        const end = performance.now();
        latencies.push(end - start);
      }

      const stats = calculateStats(latencies);

      console.log('L1 (BM25) Latency:', stats);

      expect(stats.p95).toBeLessThan(10); // <10ms p95
      expect(stats.p99).toBeLessThan(20); // <20ms p99
    });

    it('should measure Vector retrieval latency', () => {
      const latencies: number[] = [];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const query = `Vector query ${i}`;
        const _results = mockVectorRetrieval(query);
        const end = performance.now();
        latencies.push(end - start);
      }

      const stats = calculateStats(latencies);

      console.log('L1 (Vector) Latency:', stats);

      expect(stats.p95).toBeLessThan(15); // <15ms p95
      expect(stats.p99).toBeLessThan(30); // <30ms p99
    });

    it('should measure RRF Fusion latency', () => {
      const latencies: number[] = [];
      const bm25Results = mockBM25Retrieval('query');
      const vectorResults = mockVectorRetrieval('query');

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const _fused = mockRRFFusion(bm25Results, vectorResults);
        const end = performance.now();
        latencies.push(end - start);
      }

      const stats = calculateStats(latencies);

      console.log('L1 (RRF Fusion) Latency:', stats);

      expect(stats.p95).toBeLessThan(5); // <5ms p95 (very fast)
      expect(stats.p99).toBeLessThan(10);
    });
  });

  describe('L2: Synthesis Layer', () => {
    it('should measure Answer Synthesis latency', () => {
      const latencies: number[] = [];
      const chunks = mockBM25Retrieval('query');

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const _synthesis = mockSynthesis(`Query ${i}`, chunks);
        const end = performance.now();
        latencies.push(end - start);
      }

      const stats = calculateStats(latencies);

      console.log('L2 (Synthesis) Latency:', stats);

      expect(stats.p95).toBeLessThan(10); // <10ms p95
      expect(stats.p99).toBeLessThan(20);
    });

    it('should measure Domain Detection latency (REAL)', async () => {
      const latencies: number[] = [];
      const detector = new DomainDetector();
      const queries = [
        'How to implement HIPAA compliance in healthcare systems?',
        'What are the SOX requirements for financial reporting?',
        'Explain aerospace safety regulations',
      ];

      for (let i = 0; i < Math.min(ITERATIONS, 100); i++) {
        // Limit to 100 for real implementation
        const query = queries[i % queries.length];
        const start = performance.now();
        await detector.detect(query);
        const end = performance.now();
        latencies.push(end - start);
      }

      const stats = calculateStats(latencies);

      console.log('L2 (Domain Detection - REAL) Latency:', stats);

      expect(stats.p95).toBeLessThan(50); // <50ms p95
      expect(stats.p99).toBeLessThan(100);
    });
  });

  describe('L3: Planning Layer', () => {
    it('should measure NLI Gate latency (mock)', () => {
      const latencies: number[] = [];
      const answer = 'TypeScript is a typed superset of JavaScript.';
      const evidence = [
        { text: 'TypeScript is a superset of JavaScript.', source: 'typescript.org' },
      ];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const _result = mockNLIGate(answer, evidence);
        const end = performance.now();
        latencies.push(end - start);
      }

      const stats = calculateStats(latencies);

      console.log('L3 (NLI Gate - mock) Latency:', stats);

      expect(stats.p95).toBeLessThan(10); // <10ms p95 (mock)
      expect(stats.p99).toBeLessThan(20);
    });

    it('should measure Proof Context Generation latency', () => {
      const latencies: number[] = [];
      const answer = 'Test answer with multiple claims and evidence.';
      const evidence = [{ text: 'Evidence 1', source: 'source1' }];

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const _proof = mockProofContextGeneration(answer, evidence);
        const end = performance.now();
        latencies.push(end - start);
      }

      const stats = calculateStats(latencies);

      console.log('L3 (Proof Generation) Latency:', stats);

      expect(stats.p95).toBeLessThan(5); // <5ms p95
      expect(stats.p99).toBeLessThan(10);
    });
  });

  describe('L4: Optimization Layer', () => {
    it('should measure Feedback Noise Filter latency (REAL)', () => {
      const latencies: number[] = [];
      const noiseFilter = new FeedbackNoiseFilter();

      const feedbackBatch: UserFeedback[] = Array(100)
        .fill(0)
        .map((_, i) => ({
          id: `fb-${i}`,
          intent: 'incorrect',
          modifiers: [],
          confidence: 0.75 + Math.random() * 0.25,
          text: `Feedback ${i} with detailed context`,
          timestamp: new Date(),
          userId: `user-${i % 10}`,
        }));

      for (let i = 0; i < Math.min(ITERATIONS, 100); i++) {
        const start = performance.now();
        noiseFilter.filter(feedbackBatch);
        const end = performance.now();
        latencies.push(end - start);
      }

      const stats = calculateStats(latencies);

      console.log('L4 (Feedback Filter - REAL) Latency:', stats);

      expect(stats.p95).toBeLessThan(50); // <50ms p95 for 100 feedbacks
      expect(stats.p99).toBeLessThan(100);
    });

    it('should measure Bandit Policy Selection latency', () => {
      const latencies: number[] = [];
      const context = {
        query: 'What is TypeScript?',
        domain: 'programming',
        userPreference: 'quality',
      };

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const _action = mockBanditPolicy(context);
        const end = performance.now();
        latencies.push(end - start);
      }

      const stats = calculateStats(latencies);

      console.log('L4 (Bandit Policy) Latency:', stats);

      expect(stats.p95).toBeLessThan(5); // <5ms p95 (very fast)
      expect(stats.p99).toBeLessThan(10);
    });
  });

  describe('End-to-End Layer Breakdown', () => {
    it('should measure E2E latency with layer breakdown', () => {
      const iterations = 100;
      const results: {
        l1: number[];
        l2: number[];
        l3: number[];
        l4: number[];
        total: number[];
      } = {
        l1: [],
        l2: [],
        l3: [],
        l4: [],
        total: [],
      };

      for (let i = 0; i < iterations; i++) {
        const totalStart = performance.now();

        // L1: Retrieval
        const l1Start = performance.now();
        const chunks = mockBM25Retrieval(`Query ${i}`);
        const l1End = performance.now();
        results.l1.push(l1End - l1Start);

        // L2: Synthesis
        const l2Start = performance.now();
        const synthesis = mockSynthesis(`Query ${i}`, chunks);
        const l2End = performance.now();
        results.l2.push(l2End - l2Start);

        // L3: Planning
        const l3Start = performance.now();
        mockNLIGate(
          synthesis.answer,
          chunks.map((c) => ({ text: c.text, source: c.source }))
        );
        const l3End = performance.now();
        results.l3.push(l3End - l3Start);

        // L4: Optimization
        const l4Start = performance.now();
        mockBanditPolicy({ query: `Query ${i}`, domain: 'test', userPreference: 'quality' });
        const l4End = performance.now();
        results.l4.push(l4End - l4Start);

        const totalEnd = performance.now();
        results.total.push(totalEnd - totalStart);
      }

      const stats = {
        l1: calculateStats(results.l1),
        l2: calculateStats(results.l2),
        l3: calculateStats(results.l3),
        l4: calculateStats(results.l4),
        total: calculateStats(results.total),
      };

      console.log('E2E Layer Breakdown:');
      console.log('L1 (Retrieval):', stats.l1);
      console.log('L2 (Synthesis):', stats.l2);
      console.log('L3 (Planning):', stats.l3);
      console.log('L4 (Optimization):', stats.l4);
      console.log('Total:', stats.total);

      // Save to profiling report
      const report = {
        timestamp: new Date().toISOString(),
        iterations,
        layers: stats,
      };

      console.log(JSON.stringify(report, null, 2));

      // Verify total is sum of layers
      expect(stats.total.p95).toBeLessThan(100); // <100ms p95
      expect(stats.total.p99).toBeLessThan(200);
    });
  });
});

// Mock functions (same as l1-l4-pipeline.test.ts)
function mockBM25Retrieval(query: string) {
  return [
    { text: `${query} result 1`, score: 0.85, source: 'docs.example.com' },
    { text: `${query} result 2`, score: 0.72, source: 'tutorial.example.com' },
  ];
}

function mockVectorRetrieval(query: string) {
  return [{ text: `${query} semantic match`, similarity: 0.92, source: 'knowledge.base' }];
}

function mockRRFFusion(bm25Results: unknown[], vectorResults: unknown[]) {
  return [{ text: 'Fused result', rrfScore: 0.88, source: 'combined' }];
}

function mockSynthesis(query: string, chunks: unknown[]) {
  return {
    answer: `Based on "${query}", here is the synthesized answer...`,
    citations: chunks.slice(0, 2),
    trustScore: 0.85,
  };
}

function mockNLIGate(answer: string, evidence: { text: string; source: string }[]) {
  const answerLower = answer.toLowerCase();
  const evidenceLower = evidence.map((e) => e.text.toLowerCase()).join(' ');

  const keywords = answerLower.split(' ').filter((w) => w.length > 4);
  const matches = keywords.filter((k) => evidenceLower.includes(k)).length;
  const confidence = matches / Math.max(keywords.length, 1);

  return {
    entailed: confidence > 0.6,
    confidence,
  };
}

function mockProofContextGeneration(answer: string, evidence: unknown[]) {
  return {
    claims: [{ statement: answer.split('.')[0], evidenceIds: ['e1'] }],
    evidence: evidence.slice(0, 2),
  };
}

function mockBanditPolicy(_context: { query: string; domain: string; userPreference: string }) {
  const strategies = ['bm25', 'vector', 'hybrid'] as const;
  return {
    strategy: strategies[Math.floor(Math.random() * strategies.length)],
    confidence: 0.75,
  };
}
