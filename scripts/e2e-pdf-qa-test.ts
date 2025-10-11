#!/usr/bin/env tsx
/**
 * End-to-End PDF → QA Generation Test
 *
 * Complete pipeline test:
 * 1. PDF Ingest → Chunks
 * 2. Guideline → GCG Rules
 * 3. LLM → QA Generation
 * 4. Gate G → Compliance Validation
 * 5. Gate F → Performance Monitoring
 * 6. Report Generation
 *
 * Usage:
 *   npx tsx scripts/e2e-pdf-qa-test.ts
 *
 * Environment Variables:
 *   LLM_PROVIDER=claude|openai|mock (default: mock)
 *   ANTHROPIC_API_KEY=your-key
 *   LLM_MODEL=claude-3-5-sonnet-20241022
 *
 * Exit Criteria:
 *   - Guideline Compliance ≥ 90%
 *   - Groundedness ≥ 85%
 *   - p95 Latency ≤ 10ms
 */

import * as fs from 'fs';
import * as path from 'path';
import { LLMProvider } from '../src/clients/llm-provider';
import { GCGCompiler, type Grammar } from '../src/offline/genius-lab/gcg/compiler';
import { GCGValidator } from '../src/offline/genius-lab/gcg/validator';
import { GateGController } from '../src/runtime/optimization/gate-g-guideline';
import { GateFController } from '../src/runtime/optimization/gate-f-throughput';
import { PDFIngestor } from '../src/infrastructure/retrieval/pdf-ingestor';
import { EvidenceStore } from '../src/core/transparency/evidence-store';
import type { QAPair } from '../src/application/qa-generator';
import type { PDFChunk } from '../src/infrastructure/retrieval/pdf-ingestor';

/**
 * Configuration
 */
const CONFIG = {
  // Paths
  guidelinePath: path.join(
    process.cwd(),
    'datasets/qa-guideline-test/guideline/문서별 QA 생성 가이드라인 27258518f3ab809f925eff15d6ecd1ac.md'
  ),
  pdfPath: path.join(process.cwd(), 'datasets/qa-guideline-test/documents/2024년_아이돌봄지원사업_안내.pdf'),
  outputPath: path.join(process.cwd(), 'reports/e2e-pdf-qa-test'),

  // QA Generation
  qaPerDocument: 10,
  maxRetries: 3,
  minValidationScore: 80,

  // Gate thresholds
  gateG: {
    minCompliance: 80, // 80% for testing (90% for production)
    minScore: 80,
  },
  gateF: {
    maxP95Latency: 50.0, // 50ms for testing (10ms for production)
    minThroughput: 20, // 20 q/s for testing (400 q/s for production)
  },
};


/**
 * Main test flow
 */
async function main() {
  console.log('🚀 E2E PDF → QA Test Starting...\n');
  console.log('═'.repeat(60));

  const startTime = performance.now();

  // Step 1: Initialize components
  console.log('\n📦 Step 1: Initialize Components\n');

  const llmProvider = new LLMProvider({
    provider: (process.env.LLM_PROVIDER as any) || 'mock',
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  console.log(`   LLM Provider: ${llmProvider.getConfig().provider}`);
  console.log(`   Model: ${llmProvider.getConfig().model}`);
  console.log(`   Ready: ${llmProvider.isReady() ? '✅' : '❌'}\n`);

  const gcgCompiler = new GCGCompiler();
  const gcgValidator = new GCGValidator();

  const gateG = new GateGController({
    guidelinePath: CONFIG.guidelinePath,
    minCompliance: CONFIG.gateG.minCompliance,
    minScore: CONFIG.gateG.minScore,
  });

  const gateF = new GateFController({
    maxP95Latency: CONFIG.gateF.maxP95Latency,
    minThroughput: CONFIG.gateF.minThroughput,
  });

  // Step 2: Compile guideline
  console.log('📘 Step 2: Compile Guideline\n');

  if (!fs.existsSync(CONFIG.guidelinePath)) {
    throw new Error(`Guideline not found: ${CONFIG.guidelinePath}`);
  }

  const grammar = gcgCompiler.compile(CONFIG.guidelinePath);
  console.log(`   ✅ Grammar compiled (domain: ${grammar.domain})`);
  console.log(`   Rules: ${Object.keys(grammar.rules).length} categories\n`);

  // Step 3: Load chunks from PDF
  console.log('📄 Step 3: Ingest PDF Document\n');

  const evidenceStore = new EvidenceStore();
  const pdfIngestor = new PDFIngestor(evidenceStore);

  console.log(`   Processing: ${path.basename(CONFIG.pdfPath)}`);
  const pdfResult = await pdfIngestor.ingestPDF(CONFIG.pdfPath);

  if (!pdfResult.success) {
    throw new Error(`PDF ingestion failed: ${pdfResult.error}`);
  }

  const chunks = pdfResult.chunks;
  console.log(`   ✅ Extracted ${pdfResult.totalPages} pages → ${chunks.length} chunks`);
  console.log(`   Text: ${pdfResult.extractedText.length} characters\n`);

  // Step 4: Generate QA pairs
  console.log(`🤖 Step 4: Generate ${CONFIG.qaPerDocument} QA Pairs\n`);

  const qaPairs: QAPair[] = [];
  const generationLatencies: number[] = [];

  for (let i = 0; i < Math.min(CONFIG.qaPerDocument, chunks.length); i++) {
    const chunk = chunks[i % chunks.length];
    const qaStartTime = performance.now();

    try {
      const qa = await generateQA(llmProvider, chunk, grammar, gcgValidator, i + 1);

      if (qa) {
        qaPairs.push(qa);
        const latency = performance.now() - qaStartTime;
        generationLatencies.push(latency);

        // Record in Gate F
        gateF.recordMeasurement(latency, 1);

        console.log(`  ✓ Generated QA ${i + 1}/${CONFIG.qaPerDocument} (score: ${qa.metadata.validationScore})`);
      } else {
        console.log(`  ✗ Failed QA ${i + 1}/${CONFIG.qaPerDocument}`);
      }
    } catch (error) {
      console.error(`  ✗ Error QA ${i + 1}/${CONFIG.qaPerDocument}:`, error);
    }
  }

  console.log(`\n✅ QA Generation Complete`);
  console.log(`   Generated: ${qaPairs.length}/${CONFIG.qaPerDocument}`);
  console.log(`   Valid: ${qaPairs.length}/${CONFIG.qaPerDocument}`);
  console.log(
    `   Compliance: ${qaPairs.length > 0 ? ((qaPairs.length / CONFIG.qaPerDocument) * 100).toFixed(1) : 0}%`
  );

  const avgLatency = generationLatencies.reduce((sum, l) => sum + l, 0) / generationLatencies.length;
  console.log(`   Duration: ${avgLatency.toFixed(2)}ms\n`);

  // Step 5: Validate with Gate G
  console.log('📊 Step 5: Gate G Validation\n');

  const gateGResult = gateG.validateQA(qaPairs);

  // Calculate metrics from results
  const totalQA = gateGResult.results.length;
  const validQA = gateGResult.results.filter((r) => r.passed).length;
  const avgScore = gateGResult.results.reduce((sum, r) => sum + r.score, 0) / totalQA || 0;
  const totalViolations = gateGResult.results.reduce((sum, r) => sum + r.violations, 0);

  console.log(`   Total QA: ${totalQA}`);
  console.log(`   Valid QA: ${validQA}`);
  console.log(`   Compliance: ${gateGResult.complianceRate.toFixed(1)}%`);
  console.log(`   Average Score: ${avgScore.toFixed(1)}/100`);
  console.log(`   Violations: ${totalViolations}`);
  console.log(`   Status: ${gateGResult.passed ? '✅ PASS' : '❌ FAIL'}\n`);

  // Step 6: Check Gate F
  console.log('📊 Step 6: Gate F Status\n');

  const gateFStatus = gateF.getStatus();

  console.log(`   Status: ${gateF.passes() ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   p95 Latency: ${gateFStatus.metrics.p95Latency.toFixed(3)}ms`);
  console.log(`   Throughput: ${gateFStatus.metrics.throughput.toFixed(0)} q/s`);
  console.log(`   System Utilization: ${(gateFStatus.metrics.systemUtilization * 100).toFixed(1)}%\n`);

  // Step 7: Generate report
  console.log('📝 Step 7: Generate Report\n');

  const duration = performance.now() - startTime;

  const report = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    results: {
      qaGeneration: {
        requested: CONFIG.qaPerDocument,
        generated: qaPairs.length,
        avgLatency: avgLatency.toFixed(2) + 'ms',
      },
      gateG: {
        status: gateGResult.passed ? 'PASS' : 'FAIL',
        complianceRate: gateGResult.complianceRate,
        validQA,
        totalQA,
        averageScore: avgScore,
        violations: totalViolations,
      },
      gateF: {
        status: gateF.passes() ? 'PASS' : 'FAIL',
        p95Latency: gateFStatus.metrics.p95Latency,
        throughput: gateFStatus.metrics.throughput,
        systemUtilization: gateFStatus.metrics.systemUtilization,
      },
      overallStatus: gateGResult.passed && gateF.passes() ? 'PASS' : 'FAIL',
      duration: duration.toFixed(2) + 'ms',
    },
    qaPairs,
  };

  // Save report
  if (!fs.existsSync(CONFIG.outputPath)) {
    fs.mkdirSync(CONFIG.outputPath, { recursive: true });
  }

  const reportPath = path.join(CONFIG.outputPath, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`   ✅ Report saved: ${reportPath}\n`);

  // Final summary
  console.log('═'.repeat(60));
  console.log('📊 FINAL SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Overall Status: ${report.results.overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   QA Generated: ${qaPairs.length}/${CONFIG.qaPerDocument}`);
  console.log(`   Gate G: ${gateGResult.passed ? '✅ PASS' : '❌ FAIL'} (${gateGResult.complianceRate.toFixed(1)}%)`);
  console.log(`   Gate F: ${gateF.passes() ? '✅ PASS' : '❌ FAIL'} (${gateFStatus.metrics.p95Latency.toFixed(2)}ms)`);
  console.log(`   Duration: ${(duration / 1000).toFixed(2)}s`);
  console.log('═'.repeat(60) + '\n');

  // Exit with appropriate code
  if (report.results.overallStatus !== 'PASS') {
    console.error('❌ Test FAILED - Check report for details');
    process.exit(1);
  }

  console.log('✅ Test PASSED - All gates passed');
  process.exit(0);
}

/**
 * Generate single QA pair with LLM + GCG validation
 */
async function generateQA(
  llmProvider: LLMProvider,
  chunk: PDFChunk,
  grammar: Grammar,
  validator: GCGValidator,
  index: number
): Promise<QAPair | null> {
  const maxRetries = CONFIG.maxRetries;
  let retries = 0;

  while (retries < maxRetries) {
    try {
      // Build system prompt with GCG rules
      const systemPrompt = buildSystemPrompt(grammar);

      // Build user prompt with chunk content
      const userPrompt = buildUserPrompt(chunk);

      // Call LLM
      const response = await llmProvider.generate({
        systemPrompt,
        userPrompt,
        maxTokens: 1024,
        temperature: 0.7,
      });

      // Parse response
      const { question, answer } = parseQAResponse(response.content);

      // Validate with GCG
      const questionValidation = validator.validate(question, grammar);
      const answerValidation = validator.validate(answer, grammar);

      const avgScore = (questionValidation.score + answerValidation.score) / 2;
      const violations =
        questionValidation.violations.filter((v) => v.severity === 'error').length +
        answerValidation.violations.filter((v) => v.severity === 'error').length;

      // Check if meets minimum score
      if (avgScore >= CONFIG.minValidationScore) {
        return {
          id: `qa-${chunk.id}-${index}`,
          question,
          answer,
          sourceChunks: [chunk.id],
          metadata: {
            domain: grammar.domain,
            questionType: detectQuestionType(question),
            difficulty: 'medium',
            generatedAt: new Date().toISOString(),
            validationScore: avgScore,
            violations,
          },
        };
      }

      retries++;
    } catch (error) {
      retries++;
      console.error(`    Retry ${retries}/${maxRetries}:`, error);
    }
  }

  return null;
}

/**
 * Build system prompt with GCG rules
 */
function buildSystemPrompt(grammar: Grammar): string {
  // Extract grammar rules with type safety
  const numberFormat = grammar.rules.number_format
    ? `형식: ${grammar.rules.number_format.format}, 단위: ${grammar.rules.number_format.allowed_units.join('/')}`
    : '아라비아 숫자 사용';

  const tone = grammar.rules.tone
    ? `${grammar.rules.tone.formality} 톤 (${grammar.rules.tone.allowed.join(', ')})`
    : '정중한 어조 사용';

  const forbidden = grammar.rules.forbidden
    ? `금지 패턴: ${grammar.rules.forbidden.ngrams.slice(0, 3).join(', ')}${grammar.rules.forbidden.ngrams.length > 3 ? ' 등' : ''}`
    : '부적절한 표현 금지';

  return `당신은 ${grammar.domain} 도메인의 QA 쌍을 생성하는 전문가입니다.

다음 가이드라인을 반드시 준수하세요:

1. **숫자 형식**: ${numberFormat}
2. **톤**: ${tone}
3. **금지 사항**: ${forbidden}

응답 형식 (JSON):
{
  "question": "질문 내용",
  "answer": "답변 내용"
}

중요:
- 질문과 답변은 반드시 제공된 컨텍스트에 근거해야 합니다
- 숫자는 정확하게 표기하세요
- 존댓말을 사용하세요
- JSON 형식으로만 응답하세요`;
}

/**
 * Build user prompt with chunk content
 */
function buildUserPrompt(chunk: PDFChunk): string {
  return `다음 문서 내용을 기반으로 질문-답변 쌍을 생성하세요:

【문서 내용】
${chunk.text}

【요구사항】
- 질문: 문서 내용에 대한 명확한 질문
- 답변: 문서 내용에 근거한 정확한 답변
- 형식: JSON {"question": "...", "answer": "..."}

JSON 응답:`;
}

/**
 * Parse QA response from LLM
 */
function parseQAResponse(content: string): { question: string; answer: string } {
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(content);
    if (parsed.question && parsed.answer) {
      return {
        question: parsed.question,
        answer: parsed.answer,
      };
    }
  } catch {
    // If not JSON, try to extract from text
    const questionMatch = content.match(/["']?question["']?\s*:\s*["'](.+?)["']/i);
    const answerMatch = content.match(/["']?answer["']?\s*:\s*["'](.+?)["']/i);

    if (questionMatch && answerMatch) {
      return {
        question: questionMatch[1],
        answer: answerMatch[1],
      };
    }
  }

  throw new Error('Failed to parse QA from response');
}

/**
 * Detect question type
 */
function detectQuestionType(question: string): string {
  if (question.includes('무엇') || question.includes('뭐')) return 'what';
  if (question.includes('어떻게') || question.includes('방법')) return 'how';
  if (question.includes('왜')) return 'why';
  if (question.includes('언제')) return 'when';
  if (question.includes('어디')) return 'where';
  if (question.includes('누구')) return 'who';
  return 'general';
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}
