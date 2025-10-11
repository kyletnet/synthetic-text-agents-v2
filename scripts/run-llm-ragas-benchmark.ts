#!/usr/bin/env tsx
/**
 * LLM-based RAGAS Benchmark Runner
 *
 * Phase 6 Day 2: Detective Mode Hardening
 *
 * Purpose:
 * - Run LLM-based RAGAS evaluation on Real Hybrid Benchmark data
 * - Improve Gate B/D/E from 40% to 70-90%
 * - Cost: ~$0.72 (20% sampling with Claude Sonnet)
 *
 * Features:
 * - Evaluation bias prevention (6 checks)
 * - Retry logic with backoff
 * - Budget guard and rate limiting
 * - Cache and reproducibility (seed fixed)
 *
 * Usage:
 *   # Basic (20% sampling, Anthropic)
 *   export ANTHROPIC_API_KEY=sk-ant-...
 *   npx tsx scripts/run-llm-ragas-benchmark.ts
 *
 *   # Full evaluation (100%)
 *   LLM_RAGAS_SAMPLING_RATE=1.0 npx tsx scripts/run-llm-ragas-benchmark.ts
 *
 *   # OpenAI (fallback)
 *   export OPENAI_API_KEY=sk-...
 *   LLM_RAGAS_PROVIDER=openai npx tsx scripts/run-llm-ragas-benchmark.ts
 *
 *   # Dual-provider (Sonnet + Opus 10%)
 *   LLM_RAGAS_SECONDARY=claude-opus LLM_RAGAS_SECONDARY_RATE=0.1 \\
 *     npx tsx scripts/run-llm-ragas-benchmark.ts
 *
 * @see PHASE_6_START.md (Section A.1)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLLMRAGASEvaluator } from '../src/evaluation/ragas/llm-ragas-evaluator';
import type {
  LLMRAGASInput,
  LLMRAGASResult,
  LLMRAGASSummary,
} from '../src/evaluation/ragas/llm-ragas-types';

/**
 * Configuration
 */
const CONFIG = {
  // Input
  inputPath:
    process.env.LLM_RAGAS_INPUT ||
    'reports/hybrid-benchmark/real-benchmark-ragas.json',

  // Output
  outputPath:
    process.env.LLM_RAGAS_OUTPUT || 'reports/ragas/llm-ragas-phase6.json',

  // LLM Provider
  provider: (process.env.LLM_RAGAS_PROVIDER || 'anthropic') as
    | 'openai'
    | 'anthropic',
  model:
    process.env.LLM_RAGAS_MODEL ||
    (process.env.LLM_RAGAS_PROVIDER === 'openai'
      ? 'gpt-4-turbo'
      : 'claude-3-5-sonnet-20241022'),

  // Sampling
  samplingRate: parseFloat(process.env.LLM_RAGAS_SAMPLING_RATE || '0.2'), // 20%

  // Batch processing
  batchSize: parseInt(process.env.LLM_RAGAS_BATCH || '5'),
  timeout: parseInt(process.env.LLM_RAGAS_TIMEOUT || '30000'), // 30s

  // Cache
  enableCache: process.env.LLM_RAGAS_ENABLE_CACHE !== 'false', // default true

  // Budget guard
  maxCostUSD: parseFloat(process.env.LLM_RAGAS_MAX_COST || '10.0'), // $10

  // Reproducibility
  seed: parseInt(process.env.LLM_RAGAS_SEED || '42'),

  // Dual-provider (optional)
  secondaryProvider: process.env.LLM_RAGAS_SECONDARY as
    | 'claude-opus'
    | 'gemini-pro'
    | undefined,
  secondaryRate: parseFloat(process.env.LLM_RAGAS_SECONDARY_RATE || '0.1'), // 10%
};

/**
 * Budget guard
 */
let totalCostUSD = 0;

function checkBudget(additionalCost: number) {
  totalCostUSD += additionalCost;
  if (totalCostUSD > CONFIG.maxCostUSD) {
    throw new Error(
      `Budget exceeded: $${totalCostUSD.toFixed(2)} > $${CONFIG.maxCostUSD}`
    );
  }
}

/**
 * Main function
 */
async function main() {
  console.log('[START] LLM-based RAGAS Benchmark\n');
  console.log('Configuration:');
  console.log(`   - Provider: ${CONFIG.provider}`);
  console.log(`   - Model: ${CONFIG.model}`);
  console.log(`   - Sampling Rate: ${(CONFIG.samplingRate * 100).toFixed(0)}%`);
  console.log(`   - Batch Size: ${CONFIG.batchSize}`);
  console.log(`   - Max Cost: $${CONFIG.maxCostUSD}`);
  console.log(`   - Seed: ${CONFIG.seed}`);
  if (CONFIG.secondaryProvider) {
    console.log(`   - Secondary: ${CONFIG.secondaryProvider} (${(CONFIG.secondaryRate * 100).toFixed(0)}%)`);
  }
  console.log('');

  // Step 1: Load input data
  console.log('[Step 1] Loading input data...');

  let inputData: any;
  try {
    const fileContent = await fs.readFile(CONFIG.inputPath, 'utf-8');
    inputData = JSON.parse(fileContent);
    console.log(`   [OK] Loaded benchmark data`);
    console.log(`   - Total queries: ${inputData.results?.length || 0}`);
  } catch (error) {
    console.error(`   [ERROR] Failed to load input: ${error}`);
    process.exit(1);
  }

  if (!inputData.results || inputData.results.length === 0) {
    console.error('   [ERROR] No results found in input file');
    process.exit(1);
  }

  // Step 2: Prepare LLM RAGAS inputs
  console.log('\n[Step 2] Preparing LLM RAGAS inputs...');

  const inputs: LLMRAGASInput[] = inputData.results.map((result: any) => ({
    question: result.query.query,
    answer: result.ragResult.answer,
    contexts: result.ragResult.context.map((c: any) => c.content),
    groundTruth: result.query.groundTruth,
  }));

  console.log(`   [OK] Prepared ${inputs.length} inputs`);

  // Step 3: Initialize LLM RAGAS Evaluator
  console.log('\n[Step 3] Initializing LLM RAGAS Evaluator...');

  const evaluator = createLLMRAGASEvaluator({
    provider: CONFIG.provider,
    model: CONFIG.model,
    samplingRate: CONFIG.samplingRate,
    batchSize: CONFIG.batchSize,
    timeout: CONFIG.timeout,
    enableCache: CONFIG.enableCache,
    temperature: 0.0, // deterministic
    maxTokens: 500,
  });

  console.log(`   [OK] Evaluator initialized`);
  console.log(`   - Provider: ${CONFIG.provider}`);
  console.log(`   - Model: ${CONFIG.model}`);

  // Step 4: Run evaluation
  console.log('\n[Step 4] Running LLM RAGAS evaluation...');

  // Set seed for reproducibility
  Math.random = (() => {
    let seed = CONFIG.seed;
    return () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
  })();

  const startTime = performance.now();

  let results: LLMRAGASResult[];
  let summary: LLMRAGASSummary;

  try {
    const evaluation = await evaluator.evaluateBatch(inputs, CONFIG.samplingRate);
    results = evaluation.results;
    summary = evaluation.summary;

    // Check budget
    checkBudget(summary.cost.totalCostUSD);

    console.log(`   [OK] Evaluation complete`);
    console.log(`   - Sampled: ${summary.sampledQueries}/${summary.totalQueries}`);
    console.log(`   - Cost: $${summary.cost.totalCostUSD.toFixed(4)}`);
    console.log(`   - Time: ${(summary.performance.totalTimeMs / 1000).toFixed(1)}s`);
  } catch (error) {
    console.error(`   [ERROR] Evaluation failed: ${error}`);
    process.exit(1);
  }

  const endTime = performance.now();

  // Step 5: Secondary provider (optional)
  let secondaryResults: LLMRAGASResult[] | undefined;
  let secondarySummary: LLMRAGASSummary | undefined;

  if (CONFIG.secondaryProvider) {
    console.log(`\n[Step 5] Running secondary evaluation (${CONFIG.secondaryProvider})...`);

    const secondaryEvaluator = createLLMRAGASEvaluator({
      provider: CONFIG.secondaryProvider === 'claude-opus' ? 'anthropic' : 'openai',
      model:
        CONFIG.secondaryProvider === 'claude-opus'
          ? 'claude-3-opus-20240229'
          : 'gemini-2.5-pro',
      samplingRate: CONFIG.secondaryRate,
      batchSize: CONFIG.batchSize,
      timeout: CONFIG.timeout,
      enableCache: CONFIG.enableCache,
      temperature: 0.0,
      maxTokens: 500,
    });

    try {
      const secondaryEvaluation = await secondaryEvaluator.evaluateBatch(
        inputs,
        CONFIG.secondaryRate
      );
      secondaryResults = secondaryEvaluation.results;
      secondarySummary = secondaryEvaluation.summary;

      // Check budget
      checkBudget(secondarySummary.cost.totalCostUSD);

      console.log(`   [OK] Secondary evaluation complete`);
      console.log(
        `   - Sampled: ${secondarySummary.sampledQueries}/${secondarySummary.totalQueries}`
      );
      console.log(`   - Cost: $${secondarySummary.cost.totalCostUSD.toFixed(4)}`);
    } catch (error) {
      console.error(`   [WARN] Secondary evaluation failed: ${error}`);
    }
  }

  // Step 6: Print summary
  console.log('\n[Step 6] Summary Statistics\n');

  console.log('Primary Evaluation:');
  console.log(`   - Provider: ${CONFIG.provider}`);
  console.log(`   - Model: ${CONFIG.model}`);
  console.log(`   - Sampled: ${summary.sampledQueries}/${summary.totalQueries} (${(summary.samplingRate * 100).toFixed(0)}%)`);
  console.log('');

  console.log('Gate Pass Rates:');
  console.log(`   - Gate B (Context Recall):    ${(summary.gatePassRates.B * 100).toFixed(1)}% (threshold: 70%)`);
  console.log(`   - Gate D (Context Precision):  ${(summary.gatePassRates.D * 100).toFixed(1)}% (threshold: 75%)`);
  console.log(`   - Gate E (Answer Relevance):   ${(summary.gatePassRates.E * 100).toFixed(1)}% (threshold: 85%)`);
  console.log(`   - Gate G (Answer Faithfulness): ${(summary.gatePassRates.G * 100).toFixed(1)}% (threshold: 90%)`);
  console.log('');

  console.log('Average Metrics:');
  console.log(
    `   - Context Recall:    ${summary.averageMetrics.contextRecall.toFixed(3)}`
  );
  console.log(
    `   - Context Precision:  ${summary.averageMetrics.contextPrecision.toFixed(3)}`
  );
  console.log(
    `   - Answer Relevance:   ${summary.averageMetrics.answerRelevance.toFixed(3)}`
  );
  console.log(
    `   - Answer Faithfulness: ${summary.averageMetrics.answerFaithfulness.toFixed(3)}`
  );
  console.log(`   - Overall:           ${summary.averageMetrics.overall.toFixed(3)}`);
  console.log('');

  console.log('Cost & Performance:');
  console.log(`   - Total Tokens: ${summary.cost.totalTokens}`);
  console.log(`   - Total Cost: $${summary.cost.totalCostUSD.toFixed(4)}`);
  console.log(
    `   - Avg Cost/Query: $${summary.cost.averageCostPerQuery.toFixed(4)}`
  );
  console.log(
    `   - Avg Latency: ${summary.performance.averageLatencyMs.toFixed(0)}ms`
  );
  console.log('');

  // Secondary comparison
  if (secondarySummary) {
    console.log(`Secondary Evaluation (${CONFIG.secondaryProvider}):`);
    console.log(
      `   - Context Recall:    ${secondarySummary.averageMetrics.contextRecall.toFixed(3)} (Δ ${(secondarySummary.averageMetrics.contextRecall - summary.averageMetrics.contextRecall).toFixed(3)})`
    );
    console.log(
      `   - Context Precision:  ${secondarySummary.averageMetrics.contextPrecision.toFixed(3)} (Δ ${(secondarySummary.averageMetrics.contextPrecision - summary.averageMetrics.contextPrecision).toFixed(3)})`
    );
    console.log(
      `   - Answer Relevance:   ${secondarySummary.averageMetrics.answerRelevance.toFixed(3)} (Δ ${(secondarySummary.averageMetrics.answerRelevance - summary.averageMetrics.answerRelevance).toFixed(3)})`
    );
    console.log(
      `   - Answer Faithfulness: ${secondarySummary.averageMetrics.answerFaithfulness.toFixed(3)} (Δ ${(secondarySummary.averageMetrics.answerFaithfulness - summary.averageMetrics.answerFaithfulness).toFixed(3)})`
    );
    console.log(
      `   - Cost: $${secondarySummary.cost.totalCostUSD.toFixed(4)} (Total: $${(summary.cost.totalCostUSD + secondarySummary.cost.totalCostUSD).toFixed(4)})`
    );
    console.log('');
  }

  // Step 7: Success/failure check
  console.log('[Step 7] Success Criteria Check\n');

  const passB = summary.gatePassRates.B >= 0.7;
  const passD = summary.gatePassRates.D >= 0.75;
  const passE = summary.gatePassRates.E >= 0.85;
  const passG = summary.gatePassRates.G >= 0.9;
  const passCost = totalCostUSD <= CONFIG.maxCostUSD;

  console.log(`   ${passB ? '✅' : '❌'} Gate B (Recall):       ${(summary.gatePassRates.B * 100).toFixed(1)}% ${passB ? '≥' : '<'} 70%`);
  console.log(`   ${passD ? '✅' : '❌'} Gate D (Precision):    ${(summary.gatePassRates.D * 100).toFixed(1)}% ${passD ? '≥' : '<'} 75%`);
  console.log(`   ${passE ? '✅' : '❌'} Gate E (Relevance):    ${(summary.gatePassRates.E * 100).toFixed(1)}% ${passE ? '≥' : '<'} 85%`);
  console.log(`   ${passG ? '✅' : '❌'} Gate G (Faithfulness): ${(summary.gatePassRates.G * 100).toFixed(1)}% ${passG ? '≥' : '<'} 90%`);
  console.log(`   ${passCost ? '✅' : '❌'} Cost:                  $${totalCostUSD.toFixed(2)} ${passCost ? '≤' : '>'} $${CONFIG.maxCostUSD}`);
  console.log('');

  const allPassed = passB && passD && passE && passG && passCost;

  if (allPassed) {
    console.log('🎉 SUCCESS: All criteria passed!');
  } else {
    console.log('⚠️  PARTIAL: Some criteria failed. See improvement guide:');
    console.log('');

    if (!passB) {
      console.log('   Gate B (Recall) < 70%:');
      console.log(
        '     → Increase adaptiveRAG confidence threshold (0.7 → 0.65)'
      );
      console.log('     → Enable Context-Aware Subtree Retrieval');
    }

    if (!passD) {
      console.log('   Gate D (Precision) < 75%:');
      console.log('     → Reduce query expansion rules');
      console.log('     → Add Elastic pre-filter (year/domain)');
    }

    if (!passE) {
      console.log('   Gate E (Relevance) < 85%:');
      console.log('     → Refine answer generation template');
      console.log('     → Add direct answer → evidence → reasoning structure');
    }

    if (!passG) {
      console.log('   Gate G (Faithfulness) < 90%:');
      console.log('     → Enforce "context-only answer" rule');
      console.log('     → Use Evidence-Locked generation');
    }

    if (!passCost) {
      console.log('   Cost exceeded:');
      console.log('     → Reduce sampling rate');
      console.log('     → Enable caching');
      console.log('     → Use cheaper model (Sonnet instead of Opus)');
    }
  }

  console.log('');

  // Step 8: Save report
  console.log('[Step 8] Saving report...');

  const report = {
    metadata: {
      timestamp: new Date().toISOString(),
      config: {
        provider: CONFIG.provider,
        model: CONFIG.model,
        samplingRate: CONFIG.samplingRate,
        batchSize: CONFIG.batchSize,
        seed: CONFIG.seed,
        secondaryProvider: CONFIG.secondaryProvider,
        secondaryRate: CONFIG.secondaryRate,
      },
      duration: endTime - startTime,
    },
    summary,
    secondarySummary,
    results,
    secondaryResults,
  };

  await fs.mkdir(path.dirname(CONFIG.outputPath), { recursive: true });
  await fs.writeFile(CONFIG.outputPath, JSON.stringify(report, null, 2));

  console.log(`   [OK] Report saved to ${CONFIG.outputPath}`);
  console.log('');
  console.log('[COMPLETE] LLM RAGAS Benchmark finished!');
  console.log('');

  process.exit(allPassed ? 0 : 1);
}

// Run main function
main().catch(error => {
  console.error('[ERROR] Benchmark failed:', error);
  process.exit(1);
});
