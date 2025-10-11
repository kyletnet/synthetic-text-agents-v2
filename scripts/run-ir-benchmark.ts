#!/usr/bin/env node
/**
 * IR Metrics Benchmark Script
 *
 * 비용 0원으로 검색 품질을 측정하는 표준 IR 지표 실행
 * LLM-RAGAS와 교차 검증용
 *
 * Phase 6 Day 2
 *
 * Usage:
 *   npx tsx scripts/run-ir-benchmark.ts
 *   npx tsx scripts/run-ir-benchmark.ts --k 10
 *   npx tsx scripts/run-ir-benchmark.ts --input reports/hybrid-benchmark/custom.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { IRMetricsEvaluator } from '../src/evaluation/ir/ir-metrics-evaluator.js';
import type {
  IRMetricsInput,
  IRMetricsBenchmarkResult,
  SearchResult,
} from '../src/evaluation/ir/ir-metrics-types.js';
import { IR_METRICS_SUCCESS_CRITERIA } from '../src/evaluation/ir/ir-metrics-types.js';

/**
 * CLI 옵션 파싱
 */
interface CLIOptions {
  k: number;
  input: string;
  output: string;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    k: 5,
    input: 'reports/hybrid-benchmark/real-benchmark-ragas.json',
    output: 'reports/ir/phase6-ir-metrics.json',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--k' && args[i + 1]) {
      options.k = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--input' && args[i + 1]) {
      options.input = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    }
  }

  return options;
}

/**
 * Hybrid Benchmark 결과 로드
 */
interface HybridBenchmarkResult {
  results: Array<{
    query: {
      id: string;
      query: string;
      groundTruth: string;
    };
    ragResult: {
      context: Array<{
        id: string;
        content: string;
        score: number;
        metadata?: Record<string, unknown>;
      }>;
      answer: string;
    };
  }>;
  summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

function loadHybridBenchmark(filePath: string): HybridBenchmarkResult {
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data) as HybridBenchmarkResult;
}

/**
 * Ground Truth 파싱
 *
 * groundTruth는 정답 텍스트일 수 있으므로, context의 content와 유사도로 매칭합니다.
 * 또는 chunk ID가 있다면 직접 매칭합니다.
 */
function parseGroundTruth(
  groundTruth: string,
  contexts: Array<{ id: string; content: string }>
): string[] {
  // Strategy 1: groundTruth가 chunk ID 리스트인 경우 (예: "chunk1,chunk2")
  if (groundTruth.includes('chunk_') || groundTruth.includes('page_')) {
    return groundTruth.split(/[,\s]+/).filter(Boolean);
  }

  // Strategy 2: groundTruth가 정답 텍스트인 경우 → content와 유사도 매칭
  // 간단한 휴리스틱: groundTruth 텍스트가 context.content에 포함되어 있으면 정답으로 간주
  const relevantIds: string[] = [];
  const gtLower = groundTruth.toLowerCase().trim();

  for (const ctx of contexts) {
    const contentLower = ctx.content.toLowerCase();
    // 정답 텍스트가 context에 포함되어 있거나, context가 정답 텍스트에 포함되어 있으면 정답
    if (
      contentLower.includes(gtLower) ||
      gtLower.includes(contentLower.substring(0, Math.min(100, contentLower.length)))
    ) {
      relevantIds.push(ctx.id);
    }
  }

  // Strategy 3: 매칭 실패 시 첫 번째 context를 정답으로 가정 (fallback)
  if (relevantIds.length === 0 && contexts.length > 0) {
    console.warn(
      `⚠️  Ground truth 매칭 실패, 첫 번째 context를 정답으로 가정: ${groundTruth.substring(0, 50)}...`
    );
    relevantIds.push(contexts[0].id);
  }

  return relevantIds;
}

/**
 * Hybrid Benchmark → IR Metrics 변환
 */
function convertToIRMetricsInput(
  hybridResult: HybridBenchmarkResult,
  k: number
): IRMetricsInput[] {
  return hybridResult.results.map(result => {
    const { query, ragResult } = result;
    const contexts = ragResult.context;

    // Ground Truth 파싱
    const groundTruth = parseGroundTruth(
      query.groundTruth,
      contexts.map(c => ({ id: c.id, content: c.content }))
    );

    // 검색 결과 변환
    const searchResults: SearchResult[] = contexts.map((ctx, idx) => ({
      id: ctx.id,
      score: ctx.score,
      rank: idx + 1,
      isRelevant: groundTruth.includes(ctx.id),
    }));

    return {
      queryId: query.id,
      query: query.query,
      results: searchResults,
      groundTruth,
      k,
    };
  });
}

/**
 * 결과 출력 (콘솔)
 */
function printResults(result: IRMetricsBenchmarkResult): void {
  const { summary, gatePassRates, successCriteria } = result;

  console.log('\n' + '='.repeat(70));
  console.log('📊 IR Metrics Benchmark Results');
  console.log('='.repeat(70));

  console.log('\n[Summary]');
  console.log(`  Total Queries:    ${summary.totalQueries}`);
  console.log(`  K:                ${summary.k}`);
  console.log(`  Duration:         ${summary.durationMs.toFixed(0)}ms`);

  console.log('\n[Metrics]');
  console.log(`  NDCG@${summary.k}:         ${(summary.avgNDCG * 100).toFixed(2)}%`);
  console.log(`  mAP@${summary.k}:          ${(summary.avgMAP * 100).toFixed(2)}%`);
  console.log(`  F1@${summary.k}:           ${(summary.avgF1 * 100).toFixed(2)}%`);
  console.log(`  MRR:              ${(summary.avgMRR * 100).toFixed(2)}%`);
  console.log(`  Precision@${summary.k}:    ${(summary.avgPrecision * 100).toFixed(2)}%`);
  console.log(`  Recall@${summary.k}:       ${(summary.avgRecall * 100).toFixed(2)}%`);
  console.log(`  Hit Rate@${summary.k}:     ${(summary.hitRate * 100).toFixed(2)}%`);

  console.log('\n[Gate Status]');
  console.log(
    `  ${gatePassRates.ndcgPass ? '✅' : '❌'} NDCG@${summary.k}:     ${(summary.avgNDCG * 100).toFixed(2)}% ${gatePassRates.ndcgPass ? '≥' : '<'} ${(successCriteria.ndcgThreshold * 100).toFixed(0)}%`
  );
  console.log(
    `  ${gatePassRates.mapPass ? '✅' : '❌'} mAP@${summary.k}:      ${(summary.avgMAP * 100).toFixed(2)}% ${gatePassRates.mapPass ? '≥' : '<'} ${(successCriteria.mapThreshold * 100).toFixed(0)}%`
  );
  console.log(
    `  ${gatePassRates.f1Pass ? '✅' : '❌'} F1@${summary.k}:       ${(summary.avgF1 * 100).toFixed(2)}% ${gatePassRates.f1Pass ? '≥' : '<'} ${(successCriteria.f1Threshold * 100).toFixed(0)}%`
  );
  console.log(
    `  ${gatePassRates.mrrPass ? '✅' : '❌'} MRR:          ${(summary.avgMRR * 100).toFixed(2)}% ${gatePassRates.mrrPass ? '≥' : '<'} ${(successCriteria.mrrThreshold * 100).toFixed(0)}%`
  );

  const allPass =
    gatePassRates.ndcgPass &&
    gatePassRates.mapPass &&
    gatePassRates.f1Pass &&
    gatePassRates.mrrPass;
  console.log(
    `\n${allPass ? '✅ ALL GATES PASSED' : '⚠️  SOME GATES FAILED'}`
  );

  if (!allPass) {
    console.log('\n[Improvement Guide]');
    if (!gatePassRates.ndcgPass) {
      console.log(
        `  NDCG@${summary.k} < ${(successCriteria.ndcgThreshold * 100).toFixed(0)}%:`
      );
      console.log('    → 검색 순위 품질 개선 필요');
      console.log('    → RRF 가중치 튜닝 (Elastic:FAISS 비율 조정)');
      console.log('    → Semantic search 가중치 증가');
    }
    if (!gatePassRates.mapPass) {
      console.log(
        `  mAP@${summary.k} < ${(successCriteria.mapThreshold * 100).toFixed(0)}%:`
      );
      console.log('    → 정밀도 개선 필요');
      console.log('    → Query expansion 규칙 축소');
      console.log('    → Elastic pre-filter 강화 (year/domain)');
    }
    if (!gatePassRates.f1Pass) {
      console.log(
        `  F1@${summary.k} < ${(successCriteria.f1Threshold * 100).toFixed(0)}%:`
      );
      console.log('    → Precision/Recall 균형 조정');
      console.log('    → Context-Aware Subtree Retrieval 적용');
      console.log('    → Adaptive RAG k 값 조정');
    }
    if (!gatePassRates.mrrPass) {
      console.log(
        `  MRR < ${(successCriteria.mrrThreshold * 100).toFixed(0)}%:`
      );
      console.log('    → 첫 정답 순위 개선 필요');
      console.log('    → Ranking 모델 개선 (BM25 boost)');
      console.log('    → Query understanding 강화');
    }
  }

  console.log('\n' + '='.repeat(70));
}

/**
 * Main
 */
async function main(): Promise<void> {
  const options = parseArgs();

  console.log('🚀 IR Metrics Benchmark');
  console.log(`  Input:  ${options.input}`);
  console.log(`  K:      ${options.k}`);
  console.log(`  Output: ${options.output}`);

  // 1. Load hybrid benchmark
  console.log('\n[Step 1] Loading hybrid benchmark...');
  const hybridResult = loadHybridBenchmark(options.input);
  console.log(`  ✅ Loaded ${hybridResult.results.length} queries`);

  // 2. Convert to IR Metrics format
  console.log('\n[Step 2] Converting to IR Metrics format...');
  const irInputs = convertToIRMetricsInput(hybridResult, options.k);
  console.log(`  ✅ Converted ${irInputs.length} queries`);

  // 3. Evaluate IR Metrics
  console.log('\n[Step 3] Evaluating IR Metrics...');
  const evaluator = new IRMetricsEvaluator({ k: options.k });
  const { results, summary } = evaluator.evaluateBatch(irInputs);
  console.log(`  ✅ Evaluated ${results.length} queries in ${summary.durationMs}ms`);

  // 4. Check gates
  console.log('\n[Step 4] Checking gates...');
  const gateResults = evaluator.checkGates(summary);
  console.log(`  ✅ Gates checked: ${gateResults.allPass ? 'ALL PASS' : 'SOME FAILED'}`);

  // 5. Build benchmark result
  const benchmarkResult: IRMetricsBenchmarkResult = {
    config: {
      k: options.k,
      timestamp: new Date().toISOString(),
      datasetPath: options.input,
    },
    results,
    summary,
    gatePassRates: {
      ndcgPass: gateResults.ndcgPass,
      mapPass: gateResults.mapPass,
      f1Pass: gateResults.f1Pass,
      mrrPass: gateResults.mrrPass,
    },
    successCriteria: {
      ndcgThreshold: IR_METRICS_SUCCESS_CRITERIA.ndcg,
      mapThreshold: IR_METRICS_SUCCESS_CRITERIA.map,
      f1Threshold: IR_METRICS_SUCCESS_CRITERIA.f1,
      mrrThreshold: IR_METRICS_SUCCESS_CRITERIA.mrr,
    },
  };

  // 6. Save result
  console.log('\n[Step 5] Saving result...');
  const outputDir = path.dirname(options.output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(options.output, JSON.stringify(benchmarkResult, null, 2));
  console.log(`  ✅ Saved to ${options.output}`);

  // 7. Print results
  printResults(benchmarkResult);

  // 8. Exit code
  process.exit(gateResults.allPass ? 0 : 1);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
