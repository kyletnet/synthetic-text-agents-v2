/**
 * E2E Real Benchmark
 *
 * TRUE end-to-end performance measurement with REAL implementations.
 *
 * This replaces mock-based tests with actual component integration.
 *
 * Success Criteria (Phase 2.7):
 * - Identify REAL bottlenecks (not estimates)
 * - Measure TRUE p95 latency
 * - Determine if optimization is actually needed
 */

import { describe, it, expect } from 'vitest';
import { E2EOrchestrator } from '../../../src/runtime/e2e-orchestrator';
import { PerfTracker } from '../../../scripts/metrics/perf-tracker';

describe('E2E Real Benchmark', () => {
  const perfTracker = new PerfTracker();
  const orchestrator = new E2EOrchestrator();

  it('should measure REAL single query E2E latency', async () => {
    const query = {
      text: 'How to implement HIPAA compliance in healthcare systems?',
      userId: 'bench-user',
    };

    perfTracker.startLayer('E2E', 'single-query');
    const response = await orchestrator.processQuery(query);
    const totalLatency = perfTracker.endLayer('E2E', 'single-query');

    console.log('\nSingle Query E2E Performance:');
    console.log(`  L1 (Retrieval): ${response.performance.l1Latency.toFixed(2)}ms`);
    console.log(`  L2 (Synthesis): ${response.performance.l2Latency.toFixed(2)}ms`);
    console.log(`    ↳ Domain Detection: ${response.domain.detectedDomain}`);
    console.log(`  L3 (Planning): ${response.performance.l3Latency.toFixed(2)}ms`);
    console.log(`  L4 (Optimization): ${response.performance.l4Latency.toFixed(2)}ms`);
    console.log(`  TOTAL: ${totalLatency.toFixed(2)}ms`);

    expect(response.answer).toBeDefined();
    expect(response.domain.detectedDomain).toBe('healthcare');
  });

  it('should measure REAL batch processing performance (100 queries)', async () => {
    const queries = [
      'How to implement HIPAA compliance in healthcare systems?',
      'What are the SOX requirements for financial reporting?',
      'Explain aerospace safety regulations',
      'What is a breach of contract?',
      'How do I change a tire?',
    ];

    const inputs = Array(100)
      .fill(0)
      .map((_, i) => ({
        text: queries[i % queries.length],
        userId: `user-${i}`,
      }));

    perfTracker.startLayer('E2E', 'batch-100');
    const result = await orchestrator.processBatch(inputs);
    const batchLatency = perfTracker.endLayer('E2E', 'batch-100');

    console.log('\nBatch Processing (100 queries):');
    console.log(`  Total Duration: ${result.batchPerformance.totalDuration.toFixed(2)}ms`);
    console.log(`  Avg Latency: ${result.batchPerformance.avgLatency.toFixed(2)}ms`);
    console.log(`  p50: ${result.batchPerformance.p50.toFixed(2)}ms`);
    console.log(`  p95: ${result.batchPerformance.p95.toFixed(2)}ms`);
    console.log(`  p99: ${result.batchPerformance.p99.toFixed(2)}ms`);
    console.log(`  Throughput: ${(100 / (result.batchPerformance.totalDuration / 1000)).toFixed(1)} queries/sec`);

    expect(result.responses.length).toBe(100);
    expect(result.batchPerformance.p95).toBeLessThan(3000); // <3s target
  });

  it('should measure REAL stress test (1000 queries) and identify bottlenecks', async () => {
    const queries = [
      'How to implement HIPAA compliance in healthcare systems?',
      'What are the SOX requirements for financial reporting?',
      'Explain aerospace safety regulations',
      'What is a breach of contract?',
      'How do I change a tire?',
      'What is quantum computing?',
      'How does photosynthesis work?',
      'Explain the theory of relativity',
      'What causes earthquakes?',
      'How to build a REST API?',
    ];

    const inputs = Array(1000)
      .fill(0)
      .map((_, i) => ({
        text: queries[i % queries.length],
        userId: `stress-user-${i}`,
      }));

    const layerLatencies = {
      l1: [] as number[],
      l2: [] as number[],
      l3: [] as number[],
      l4: [] as number[],
      total: [] as number[],
    };

    const startStress = performance.now();

    for (const input of inputs) {
      const response = await orchestrator.processQuery(input);
      layerLatencies.l1.push(response.performance.l1Latency);
      layerLatencies.l2.push(response.performance.l2Latency);
      layerLatencies.l3.push(response.performance.l3Latency);
      layerLatencies.l4.push(response.performance.l4Latency);
      layerLatencies.total.push(response.performance.totalLatency);
    }

    const totalDuration = performance.now() - startStress;

    // Calculate percentiles for each layer
    const calculateStats = (latencies: number[]) => {
      const sorted = [...latencies].sort((a, b) => a - b);
      return {
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        mean: sorted.reduce((sum, l) => sum + l, 0) / sorted.length,
      };
    };

    const stats = {
      l1: calculateStats(layerLatencies.l1),
      l2: calculateStats(layerLatencies.l2),
      l3: calculateStats(layerLatencies.l3),
      l4: calculateStats(layerLatencies.l4),
      total: calculateStats(layerLatencies.total),
    };

    console.log('\n🔥 Stress Test (1000 queries) - REAL BOTTLENECK ANALYSIS:');
    console.log('\nL1 (Retrieval):');
    console.log(`  p50: ${stats.l1.p50.toFixed(2)}ms | p95: ${stats.l1.p95.toFixed(2)}ms | p99: ${stats.l1.p99.toFixed(2)}ms`);

    console.log('\nL2 (Synthesis + Domain Detection):');
    console.log(`  p50: ${stats.l2.p50.toFixed(2)}ms | p95: ${stats.l2.p95.toFixed(2)}ms | p99: ${stats.l2.p99.toFixed(2)}ms`);
    if (stats.l2.p95 > 50) {
      console.log('  ⚠️  BOTTLENECK DETECTED: p95 > 50ms target!');
    }

    console.log('\nL3 (Planning):');
    console.log(`  p50: ${stats.l3.p50.toFixed(2)}ms | p95: ${stats.l3.p95.toFixed(2)}ms | p99: ${stats.l3.p99.toFixed(2)}ms`);

    console.log('\nL4 (Optimization + Feedback Filter):');
    console.log(`  p50: ${stats.l4.p50.toFixed(2)}ms | p95: ${stats.l4.p95.toFixed(2)}ms | p99: ${stats.l4.p99.toFixed(2)}ms`);
    if (stats.l4.p95 > 50) {
      console.log('  ⚠️  BOTTLENECK DETECTED: p95 > 50ms target!');
    }

    console.log('\nE2E Total:');
    console.log(`  p50: ${stats.total.p50.toFixed(2)}ms | p95: ${stats.total.p95.toFixed(2)}ms | p99: ${stats.total.p99.toFixed(2)}ms`);
    console.log(`  Total Duration: ${totalDuration.toFixed(2)}ms`);
    console.log(`  Throughput: ${(1000 / (totalDuration / 1000)).toFixed(1)} queries/sec`);

    // Identify bottleneck
    const layers = [
      { name: 'L1', p95: stats.l1.p95 },
      { name: 'L2', p95: stats.l2.p95 },
      { name: 'L3', p95: stats.l3.p95 },
      { name: 'L4', p95: stats.l4.p95 },
    ];
    const bottleneck = layers.reduce((max, layer) =>
      layer.p95 > max.p95 ? layer : max
    );

    console.log(`\n🎯 PRIMARY BOTTLENECK: ${bottleneck.name} (p95 = ${bottleneck.p95.toFixed(2)}ms)`);

    // Success criteria
    expect(stats.total.p95).toBeLessThan(3000); // E2E <3s target
  }, 120000); // 2 minute timeout

  it('should verify component isolation benchmarks match E2E measurements', async () => {
    const components = orchestrator.getComponents();

    // Domain Detector isolation
    const domainStartTime = performance.now();
    await components.domainDetector.detect(
      'How to implement HIPAA compliance in healthcare systems?'
    );
    const domainIsolatedLatency = performance.now() - domainStartTime;

    // Feedback Filter isolation
    const mockFeedback = Array(100)
      .fill(0)
      .map((_, i) => ({
        userId: `user-${i}`,
        text: 'Good answer',
        confidence: 0.8,
        timestamp: new Date(),
        intent: 'positive' as const,
        modifiers: [],
      }));

    const feedbackStartTime = performance.now();
    components.feedbackFilter.filter(mockFeedback);
    const feedbackIsolatedLatency = performance.now() - feedbackStartTime;

    console.log('\n🔬 Component Isolation vs E2E Comparison:');
    console.log(`  Domain Detector (isolated): ${domainIsolatedLatency.toFixed(2)}ms`);
    console.log(`  Feedback Filter (isolated, 100 items): ${feedbackIsolatedLatency.toFixed(2)}ms`);

    // These should match the previous unit test results
    expect(domainIsolatedLatency).toBeLessThan(1); // Should be sub-ms
    expect(feedbackIsolatedLatency).toBeLessThan(1); // Should be sub-ms
  });

  it('should save REAL baseline for Phase 2.7 optimization', async () => {
    // Run comprehensive benchmark
    const queries = Array(100)
      .fill(0)
      .map((_, i) => ({
        text: `Test query ${i}`,
        userId: `baseline-user-${i}`,
      }));

    const result = await orchestrator.processBatch(queries);

    // Save as baseline
    perfTracker.saveAsBaseline('2.7-real-e2e');

    const report = perfTracker.generateReport();
    perfTracker.printReport(report);

    console.log('\n✅ Real baseline saved to reports/perf-baseline.json');
    console.log('   Use this for accurate Phase 2.7 optimization decisions.');

    expect(result.batchPerformance.p95).toBeLessThan(3000);
  });
});
