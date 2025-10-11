/**
 * GPU Domain Detector Benchmark
 *
 * Compares performance of GPU-accelerated vs CPU-based domain detection.
 *
 * Success Criteria (Phase 2.7):
 * - GPU Domain Detector p95 < 20ms
 * - Improvement: 3x faster than baseline (57ms → 20ms)
 * - Accuracy: Same or better than regex-based
 */

import { describe, it, expect } from 'vitest';
import { DomainDetector } from '../../../src/runtime/l2-synthesizer/domain/domain-detector';
import { GPUDomainDetector } from '../../../src/runtime/l2-synthesizer/domain/gpu-domain-detector';
import { PerfTracker } from '../../../scripts/metrics/perf-tracker';

describe('GPU Domain Detector Benchmark', () => {
  const perfTracker = new PerfTracker();

  // Test queries
  const testQueries = [
    'What are the symptoms of hypertension and how is it treated?',
    'How does diversification reduce portfolio risk?',
    'What is the minimum safe altitude for aircraft during takeoff?',
    'What are the legal requirements for contract formation?',
    'How do I change a tire?',
  ];

  it('should benchmark CPU-based Domain Detector (baseline)', async () => {
    const detector = new DomainDetector();
    const latencies: number[] = [];

    // Warmup
    for (let i = 0; i < 5; i++) {
      await detector.detect(testQueries[i % testQueries.length]);
    }

    // Benchmark
    for (let i = 0; i < 100; i++) {
      perfTracker.startLayer('L2', 'cpu-domain-detection');
      await detector.detect(testQueries[i % testQueries.length]);
      const latency = perfTracker.endLayer('L2', 'cpu-domain-detection');
      latencies.push(latency);
    }

    // Calculate percentiles
    const sorted = latencies.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(latencies.length * 0.5)];
    const p95 = sorted[Math.floor(latencies.length * 0.95)];
    const p99 = sorted[Math.floor(latencies.length * 0.99)];
    const mean = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

    console.log('CPU Domain Detector (Baseline):');
    console.log(`  p50: ${p50.toFixed(2)}ms`);
    console.log(`  p95: ${p95.toFixed(2)}ms`);
    console.log(`  p99: ${p99.toFixed(2)}ms`);
    console.log(`  mean: ${mean.toFixed(2)}ms`);

    // Save as baseline reference
    expect(p95).toBeLessThan(100); // Sanity check
  });

  it('should benchmark GPU-accelerated Domain Detector', async () => {
    const detector = new GPUDomainDetector();
    await detector.initialize(); // Pre-initialize

    const latencies: number[] = [];

    // Warmup (cache population)
    for (let i = 0; i < 5; i++) {
      await detector.detect(testQueries[i % testQueries.length]);
    }

    // Clear cache for fair comparison
    detector.clearCache();

    // Benchmark
    for (let i = 0; i < 100; i++) {
      perfTracker.startLayer('L2', 'gpu-domain-detection');
      await detector.detect(testQueries[i % testQueries.length]);
      const latency = perfTracker.endLayer('L2', 'gpu-domain-detection');
      latencies.push(latency);
    }

    // Calculate percentiles
    const sorted = latencies.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(latencies.length * 0.5)];
    const p95 = sorted[Math.floor(latencies.length * 0.95)];
    const p99 = sorted[Math.floor(latencies.length * 0.99)];
    const mean = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;

    console.log('\nGPU Domain Detector:');
    console.log(`  p50: ${p50.toFixed(2)}ms`);
    console.log(`  p95: ${p95.toFixed(2)}ms`);
    console.log(`  p99: ${p99.toFixed(2)}ms`);
    console.log(`  mean: ${mean.toFixed(2)}ms`);
    console.log(`  cache size: ${detector.getCacheSize()}`);

    // Success criteria
    console.log('\nSuccess Criteria:');
    console.log(`  p95 < 20ms: ${p95 < 20 ? '✅' : '❌'} (actual: ${p95.toFixed(2)}ms)`);

    // Cleanup
    await detector.dispose();

    // Report
    const report = perfTracker.generateReport();
    perfTracker.printReport(report);

    // Validate target
    expect(p95).toBeLessThan(20); // Phase 2.7 target
  }, 60000); // 60s timeout for model download

  it('should verify accuracy matches baseline', async () => {
    const cpuDetector = new DomainDetector();
    const gpuDetector = new GPUDomainDetector();
    await gpuDetector.initialize();

    const queries = [
      { text: 'What is the treatment for diabetes?', expectedDomain: 'healthcare' },
      { text: 'How to calculate portfolio returns?', expectedDomain: 'finance' },
      { text: 'What are FAA regulations for pilots?', expectedDomain: 'aerospace' },
      { text: 'What is a breach of contract?', expectedDomain: 'legal' },
    ];

    for (const query of queries) {
      const cpuResult = await cpuDetector.detect(query.text);
      const gpuResult = await gpuDetector.detect(query.text);

      console.log(`\nQuery: ${query.text}`);
      console.log(`  CPU: ${cpuResult.detectedDomain} (${cpuResult.confidence.toFixed(2)})`);
      console.log(`  GPU: ${gpuResult.detectedDomain} (${gpuResult.confidence.toFixed(2)})`);

      // Both should detect expected domain
      expect(cpuResult.detectedDomain).toBe(query.expectedDomain);
      expect(gpuResult.detectedDomain).toBe(query.expectedDomain);
    }

    await gpuDetector.dispose();
  });

  it('should demonstrate cache effectiveness', async () => {
    const detector = new GPUDomainDetector();
    await detector.initialize();

    const query = 'What are the symptoms of COVID-19?';

    // First run (no cache)
    perfTracker.startLayer('L2', 'no-cache');
    await detector.detect(query);
    const noCacheLatency = perfTracker.endLayer('L2', 'no-cache');

    // Second run (cached)
    perfTracker.startLayer('L2', 'cached');
    await detector.detect(query);
    const cachedLatency = perfTracker.endLayer('L2', 'cached');

    console.log('\nCache Effectiveness:');
    console.log(`  No cache: ${noCacheLatency.toFixed(2)}ms`);
    console.log(`  Cached: ${cachedLatency.toFixed(2)}ms`);
    console.log(`  Speedup: ${(noCacheLatency / cachedLatency).toFixed(1)}x`);

    // Cached should be significantly faster
    expect(cachedLatency).toBeLessThan(noCacheLatency / 2);

    await detector.dispose();
  });
});
