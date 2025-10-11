/**
 * Real Hybrid Search Benchmark with RAGAS Evaluation
 *
 * Phase 6 Day 3: 한글 인코딩 수정 완료 + 안전장치 추가
 *
 * Pipeline:
 * 1. Load Vision-Guided Chunking results
 * 2. Initialize Hybrid Search (Elasticsearch + FAISS or Mock)
 * 3. Initialize Adaptive RAG
 * 4. Run test queries
 * 5. Evaluate with RAGAS
 * 6. Generate comprehensive report
 *
 * Environment Variables:
 * - ELASTICSEARCH_URL: Elasticsearch endpoint (default: mock)
 * - USE_REAL_CLIENTS: Set to 'true' to use real Elasticsearch/FAISS
 * - FAISS_INDEX_PATH: Path to FAISS index (default: data/faiss-index)
 *
 * Usage:
 *   # With mock clients (fast, no setup)
 *   npx tsx scripts/real-hybrid-benchmark.ts
 *
 *   # With real clients (requires Elasticsearch + setup)
 *   USE_REAL_CLIENTS=true ELASTICSEARCH_URL=http://localhost:9200 \
 *     npx tsx scripts/real-hybrid-benchmark.ts
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { HybridSearchEngine } from '../src/infrastructure/retrieval/hybrid/hybrid-search-engine';
import { MockElasticsearchClient, MockFAISSClient } from '../src/infrastructure/retrieval/hybrid/mock-clients';
import { ElasticsearchClient } from '../src/infrastructure/retrieval/hybrid/elastic-client';
import { FAISSClient } from '../src/infrastructure/retrieval/hybrid/faiss-client';
import { createAdaptiveRAG } from '../src/runtime/adaptive-rag';
import { createRAGASEvaluator } from '../src/evaluation/ragas';
import type { RAGASInput } from '../src/evaluation/ragas/types';
import { createGateIntegration } from '../src/runtime/gates';

/**
 * 제어문자 필터링 함수 (재발 방지)
 * Phase 6: 안전장치 추가
 */
function sanitizeText(text: string): string {
  if (!text) return '';

  // 제어문자 (0x00-0x1F, 0x7F-0x9F) 제거, 단 \t, \n, \r은 유지
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

/**
 * Configuration
 */
const CONFIG = {
  useRealClients: process.env.USE_REAL_CLIENTS === 'true',
  elasticsearchUrl: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  faissIndexPath: process.env.FAISS_INDEX_PATH || 'data/faiss-index',
  visionResultsPath: process.env.VISION_CHUNKED_PATH || 'reports/pdf-vision/test-5-10-chunked.json',
  outputPath: 'reports/hybrid-benchmark/real-benchmark-ragas.json',
};

/**
 * Test Queries (아이돌봄 서비스 관련 실제 질문)
 * Phase 6: 정상 한글 인코딩으로 교체 완료
 */
const TEST_QUERIES = [
  {
    id: 'q1',
    query: '독립형 아이돌봄 서비스의 가격은 얼마인가?',
    groundTruth: '0세아는 시간당 11,630원, 영아는 시간당 15,110원입니다.',
  },
  {
    id: 'q2',
    query: '아이돌봄 서비스의 유형에는 어떤 것들이 있나?',
    groundTruth: '시간제 서비스, 종일제 서비스, 영아 종일제 서비스 등이 있습니다.',
  },
  {
    id: 'q3',
    query: '긴급 돌봄 서비스는 어떻게 신청하나?',
    groundTruth: '긴급 돌봄은 전화나 온라인을 통해 사전 신청 없이 즉시 이용 가능합니다.',
  },
  {
    id: 'q4',
    query: '아이돌봄 서비스 이용 자격은 무엇인가?',
    groundTruth: '만 12세 이하 아동을 둔 맞벌이 가정이 주요 대상입니다.',
  },
  {
    id: 'q5',
    query: '정부 지원금은 소득 수준에 따라 어떻게 다른가?',
    groundTruth: '소득 수준에 따라 가형, 나형, 다형으로 구분되며 지원 비율이 달라집니다.',
  },
];

/**
 * Main benchmark function
 */
async function main() {
  console.log('[START] Real Hybrid Search Benchmark with RAGAS');
  console.log('Configuration:');
  console.log(`   - Use Real Clients: ${CONFIG.useRealClients}`);
  console.log(`   - Elasticsearch URL: ${CONFIG.elasticsearchUrl}`);
  console.log(`   - FAISS Index Path: ${CONFIG.faissIndexPath}`);
  console.log('');

  // Step 1: Load Vision results
  console.log('[Step 1] Loading Vision-Guided Chunking results...');
  let visionData: any;
  try {
    const visionFile = await fs.readFile(CONFIG.visionResultsPath, 'utf-8');
    visionData = JSON.parse(visionFile);
    console.log(`   [OK] Loaded ${visionData.chunks?.length || 0} chunks`);
  } catch (error) {
    console.error(`   [ERROR] Failed to load Vision results: ${error}`);
    console.log(`   [INFO] Continuing with mock data...`);
    visionData = { chunks: [] };
  }

  // Step 2: Initialize Hybrid Search Engine
  console.log('[Step 2] Initializing Hybrid Search Engine...');

  let elasticClient: any, faissClient: any;

  if (CONFIG.useRealClients) {
    console.log('   Using REAL Elasticsearch + FAISS clients');

    try {
      // Real Elasticsearch
      elasticClient = new ElasticsearchClient({
        url: CONFIG.elasticsearchUrl,
        indexName: 'hybrid-benchmark',
      });

      // Real FAISS
      faissClient = new FAISSClient({
        indexPath: CONFIG.faissIndexPath,
        embeddingModel: 'Xenova/multilingual-e5-small',
        dimension: 384,
      });

      console.log('   [OK] Real clients initialized');
    } catch (error) {
      console.error(`   [ERROR] Failed to initialize real clients: ${error}`);
      console.log('   [WARN] Falling back to mock clients...');
      elasticClient = new MockElasticsearchClient();
      faissClient = new MockFAISSClient();
    }
  } else {
    console.log('   Using MOCK clients (fast, no external dependencies)');
    elasticClient = new MockElasticsearchClient();
    faissClient = new MockFAISSClient();
    console.log('   [OK] Mock clients initialized');
  }

  const hybridSearch = new HybridSearchEngine(elasticClient, faissClient);

  // Step 3: Index documents
  console.log('[Step 3] Indexing documents...');

  const documents = visionData.chunks && visionData.chunks.length > 0
    ? visionData.chunks.map((chunk: any, idx: number) => ({
        id: chunk.id || `chunk-${idx}`,
        content: sanitizeText(chunk.content || ''),
        metadata: chunk.metadata || {},
      }))
    : [
        // Fallback mock data (Phase 6: 정상 한글로 교체 완료)
        {
          id: 'mock-1',
          content: '독립형 아이돌봄 서비스 가격표: 0세아 시간당 11,630원, 영아 시간당 15,110원',
          metadata: { page: 47, type: 'table' },
        },
        {
          id: 'mock-2',
          content: '아이돌봄 서비스 유형: 시간제 서비스, 종일제 서비스, 영아 종일제 서비스가 있습니다.',
          metadata: { page: 48, type: 'paragraph' },
        },
        {
          id: 'mock-3',
          content: '긴급 돌봄 서비스: 사전 신청 없이 전화나 온라인을 통해 즉시 이용 가능합니다.',
          metadata: { page: 50, type: 'paragraph' },
        },
        {
          id: 'mock-4',
          content: '이용 자격: 만 12세 이하 아동을 둔 맞벌이 가정이 주요 대상입니다.',
          metadata: { page: 52, type: 'paragraph' },
        },
        {
          id: 'mock-5',
          content: '정부 지원금 구조: 소득 수준에 따라 가형, 나형, 다형으로 구분되며 지원 비율이 달라집니다.',
          metadata: { page: 55, type: 'paragraph' },
        },
      ];

  await hybridSearch.index(documents);
  console.log(`   [OK] Indexed ${documents.length} documents`);

  // Step 4: Initialize Adaptive RAG
  console.log('[Step 4] Initializing Adaptive RAG...');

  const adaptiveRAG = createAdaptiveRAG(hybridSearch, undefined, {
    initialK: 2,
    maxK: 6,
    confidenceThreshold: 0.7,
    enableGateF: true,
  });

  console.log('   [OK] Adaptive RAG initialized');

  // Step 5: Initialize RAGAS Evaluator
  console.log('[Step 5] Initializing RAGAS Evaluator...');

  const ragasEvaluator = createRAGASEvaluator({
    method: 'heuristic',
    thresholds: {
      contextRecall: 0.7,
      contextPrecision: 0.75,
      answerFaithfulness: 0.8,
      answerRelevance: 0.85,
    },
    enableGates: true,
  });

  console.log('   [OK] RAGAS Evaluator initialized');

  // Step 5.5: Initialize Gate Integration
  console.log('[Step 5.5] Initializing Gate Integration...');

  const gateIntegration = createGateIntegration();

  console.log('   [OK] Gate Integration initialized');

  // Step 6: Run benchmark queries
  console.log('[Step 6] Running benchmark queries...\n');

  const results: any[] = [];

  for (const testQuery of TEST_QUERIES) {
    console.log(`   [Query ${testQuery.id}] "${testQuery.query}"`);

    // Execute Adaptive RAG
    const ragResult = await adaptiveRAG.query({
      query: testQuery.query,
    });

    console.log(`      -> Final K: ${ragResult.finalK}`);
    console.log(`      -> Iterations: ${ragResult.iterations}`);
    console.log(`      -> Confidence: ${ragResult.confidence.toFixed(3)}`);
    console.log(`      -> Context chunks: ${ragResult.context.length}`);
    console.log(`      -> Cost: ${ragResult.cost.totalTokens} tokens ($${ragResult.cost.costUSD.toFixed(4)})`);

    // Evaluate with RAGAS
    const ragasInput: RAGASInput = {
      question: sanitizeText(testQuery.query),
      answer: sanitizeText(ragResult.answer),
      contexts: ragResult.context.map(c => sanitizeText(c.content)),
      groundTruth: sanitizeText(testQuery.groundTruth),
    };

    const ragasResult = await ragasEvaluator.evaluate(ragasInput);

    console.log(`      -> RAGAS Overall: ${ragasResult.metrics.overall.toFixed(3)}`);
    console.log(`         - Context Recall: ${ragasResult.metrics.contextRecall.toFixed(3)} (Gate B)`);
    console.log(`         - Context Precision: ${ragasResult.metrics.contextPrecision.toFixed(3)} (Gate D)`);
    console.log(`         - Answer Faithfulness: ${ragasResult.metrics.answerFaithfulness.toFixed(3)} (Gate G)`);
    console.log(`         - Answer Relevance: ${ragasResult.metrics.answerRelevance.toFixed(3)} (Gate E)`);

    // Create Gate Report
    const gateReport = await gateIntegration.createGateReport(
      testQuery.id,
      ragasResult,
      ragResult
    );

    console.log(`      -> Gate Status: ${gateReport.summary.overallStatus} (${gateReport.summary.totalPassed}/5 passed)`);
    console.log('');

    results.push({
      query: testQuery,
      ragResult,
      ragasResult,
      gateReport,
    });
  }

  // Step 7: Aggregate statistics
  console.log('[Step 7] Aggregating statistics...\n');

  const adaptiveRAGStats = adaptiveRAG.getStats();
  const searchMetrics = hybridSearch.getMetrics();

  const avgRAGAS = {
    contextRecall: results.reduce((sum, r) => sum + r.ragasResult.metrics.contextRecall, 0) / results.length,
    contextPrecision: results.reduce((sum, r) => sum + r.ragasResult.metrics.contextPrecision, 0) / results.length,
    answerFaithfulness: results.reduce((sum, r) => sum + r.ragasResult.metrics.answerFaithfulness, 0) / results.length,
    answerRelevance: results.reduce((sum, r) => sum + r.ragasResult.metrics.answerRelevance, 0) / results.length,
    overall: results.reduce((sum, r) => sum + r.ragasResult.metrics.overall, 0) / results.length,
  };

  console.log('[COMPLETE] Benchmark Complete!\n');
  console.log('Summary Statistics:\n');
  console.log('   Adaptive RAG:');
  console.log(`      - Average K: ${adaptiveRAGStats.averageK.toFixed(2)}`);
  console.log(`      - Average Iterations: ${adaptiveRAGStats.averageIterations.toFixed(2)}`);
  console.log(`      - Average Confidence: ${adaptiveRAGStats.averageConfidence.toFixed(3)}`);
  console.log(`      - Token Savings: ${adaptiveRAGStats.savings.percentageSaved.toFixed(1)}%`);
  console.log(`      - Total Cost: $${adaptiveRAGStats.totalCostUSD.toFixed(4)}`);
  console.log('');
  console.log('   Hybrid Search:');
  console.log(`      - Total Queries: ${searchMetrics.totalQueries}`);
  console.log(`      - Average Latency: ${searchMetrics.averageLatency.toFixed(2)}ms`);
  console.log(`      - Cache Hit Rate: ${(searchMetrics.cacheHits / (searchMetrics.cacheHits + searchMetrics.cacheMisses) * 100).toFixed(1)}%`);
  console.log('');
  console.log('   RAGAS Metrics:');
  console.log(`      - Context Recall (Gate B): ${avgRAGAS.contextRecall.toFixed(3)}`);
  console.log(`      - Context Precision (Gate D): ${avgRAGAS.contextPrecision.toFixed(3)}`);
  console.log(`      - Answer Faithfulness (Gate G): ${avgRAGAS.answerFaithfulness.toFixed(3)}`);
  console.log(`      - Answer Relevance (Gate E): ${avgRAGAS.answerRelevance.toFixed(3)}`);
  console.log(`      - Overall Score: ${avgRAGAS.overall.toFixed(3)}`);
  console.log('');

  // Gate statistics
  const gateStats = await gateIntegration.getStatistics(results.map(r => r.gateReport));
  console.log('   Gate System:');
  console.log(`      - Gate B Pass Rate: ${(gateStats.gatePassRates.B * 100).toFixed(1)}%`);
  console.log(`      - Gate D Pass Rate: ${(gateStats.gatePassRates.D * 100).toFixed(1)}%`);
  console.log(`      - Gate E Pass Rate: ${(gateStats.gatePassRates.E * 100).toFixed(1)}%`);
  console.log(`      - Gate F Pass Rate: ${(gateStats.gatePassRates.F * 100).toFixed(1)}%`);
  console.log(`      - Gate G Pass Rate: ${(gateStats.gatePassRates.G * 100).toFixed(1)}%`);
  console.log(`      - Overall Pass Rate: ${(gateStats.overallPassRate * 100).toFixed(1)}%`);
  console.log('');

  // Step 8: Save report (Phase 6: UTF-8 명시 추가)
  console.log('[Step 8] Saving report...');

  const report = {
    metadata: {
      timestamp: new Date().toISOString(),
      config: CONFIG,
      totalQueries: TEST_QUERIES.length,
      encoding: 'utf-8',
      phase: 'Phase 6 Day 3 - Encoding Fixed',
    },
    summary: {
      adaptiveRAG: adaptiveRAGStats,
      hybridSearch: searchMetrics,
      ragas: avgRAGAS,
      gates: gateStats,
    },
    results,
  };

  await fs.mkdir(path.dirname(CONFIG.outputPath), { recursive: true });
  // Phase 6: UTF-8 명시 (안전장치)
  await fs.writeFile(CONFIG.outputPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`   [OK] Report saved to ${CONFIG.outputPath}`);
  console.log('');
  console.log('[SUCCESS] Benchmark complete! Next steps:');
  console.log('   1. Review report: cat ' + CONFIG.outputPath);
  console.log('   2. Run LLM-RAGAS: npx tsx scripts/run-llm-ragas-benchmark.ts');
  console.log('   3. Deploy with real clients: USE_REAL_CLIENTS=true npm run benchmark');
  console.log('');

  // Cleanup
  await hybridSearch.close();
}

// Run benchmark
main().catch(error => {
  console.error('[ERROR] Benchmark failed:', error);
  process.exit(1);
});
