/**
 * Guideline Compliance Test (Simplified - No PDF)
 *
 * Tests the complete QA generation pipeline without PDF dependency.
 * Uses pre-defined text chunks to verify:
 * 1. GCG Compiler (Guideline → Grammar)
 * 2. GCG Validator (Text → Compliance Check)
 * 3. QA Generator (Chunks → QA Pairs)
 * 4. Gate G (≥90% Compliance)
 *
 * @see PHASE_2.7_FINAL_IMPLEMENTATION.md
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { QAGenerator } from '../../src/application/qa-generator';
import { GCGCompiler } from '../../src/offline/genius-lab/gcg/compiler';
import { GCGValidator } from '../../src/offline/genius-lab/gcg/validator';
import { EvidenceStore } from '../../src/core/transparency/evidence-store';
import type { EvidenceItem } from '../../src/core/transparency/evidence-types';

describe('Guideline Compliance Test (Simplified)', () => {
  const GUIDELINE_PATH = path.join(
    process.cwd(),
    'datasets/qa-guideline-test/guideline/문서별 QA 생성 가이드라인 27258518f3ab809f925eff15d6ecd1ac.md'
  );
  const OUTPUT_PATH = path.join(process.cwd(), 'reports/qa-generation/qa-output-simple.json');

  let evidenceStore: EvidenceStore;
  let qaGenerator: QAGenerator;
  let gcgCompiler: GCGCompiler;
  let gcgValidator: GCGValidator;
  const documentId = 'test-document-001';

  // Sample text chunks (휴가/휴직 관련)
  const sampleChunks = [
    '연차유급휴가는 1년간 80퍼센트 이상 출근한 직원에게 15일의 유급휴가가 부여됩니다. 3년 이상 계속 근로한 직원은 최초 1년을 초과하는 계속 근로연수 매 2년마다 1일씩 가산되며, 총 휴가일수는 25일을 한도로 합니다.',
    '보건휴가는 여성 직원이 청구하는 경우 월 1일의 유급 보건휴가를 부여받을 수 있습니다. 보건휴가는 연차유급휴가와 별도로 사용 가능합니다.',
    '배우자출산휴가는 직원의 배우자가 출산한 경우 10일의 유급휴가를 받을 수 있습니다. 배우자출산휴가는 출산한 날부터 90일 이내에 청구해야 하며, 90일이 지나면 청구할 수 없습니다.',
    '육아휴직은 만 8세 이하 또는 초등학교 2학년 이하의 자녀를 가진 직원이 자녀 양육을 위해 청구할 수 있습니다. 단, 육아휴직을 시작하려는 날의 전날까지 계속 근로기간이 6개월 미만인 경우에는 적용되지 않습니다.',
    '경조금은 본인 결혼의 경우 50만원과 5일의 유급 휴가를 받을 수 있으며, 자녀 결혼의 경우 20만원과 1일의 유급 휴가를 받을 수 있습니다.',
    '가족돌봄휴가는 가족의 질병, 사고, 노령으로 인하여 그 가족을 돌보기 위한 목적으로 연간 최대 10일까지 사용할 수 있습니다. 가족돌봄휴가는 무급으로 처리됩니다.',
    '연차유급휴가를 사용하고자 할 경우에는 부득이한 사유가 없는 한 적어도 5일 전에 소속 부서의 장에게 승인을 얻어야 합니다. 연차유급휴가 청구권은 발생한 날로부터 1년간 행사하지 아니하면 소멸됩니다.',
    '임신 중인 여성 직원에게는 출산 전과 출산 후를 통하여 90일의 출산 전후 휴가가 부여됩니다. 출산 전후 휴가는 출산 후에 45일 이상 확보되어야 합니다.',
    '난임치료휴가는 인공수정 또는 체외수정 등 난임 치료를 받는 직원이 연간 3일 이내로 휴가를 청구할 수 있습니다. 난임치료휴가 중 최초 1일은 유급으로, 나머지 2일은 무급으로 처리됩니다.',
    '병가는 업무 외의 사유로 인한 부상 또는 질병으로 치료가 필요한 경우 연간 30일 이내로 사용할 수 있습니다. 병가는 유급으로 처리되며, 진단서 또는 소견서를 제출해야 합니다.',
  ];

  beforeAll(() => {
    console.log('🏁 Simplified Guideline Compliance Test Starting...\n');

    // Initialize components
    evidenceStore = new EvidenceStore();
    qaGenerator = new QAGenerator(evidenceStore);
    gcgCompiler = new GCGCompiler();
    gcgValidator = new GCGValidator();

    // Populate EvidenceStore with sample chunks
    sampleChunks.forEach((text, index) => {
      const chunk: EvidenceItem = {
        id: `chunk-${index}`,
        sourceId: documentId,
        content: text,
        timestamp: new Date(),
        trustScore: 1.0,
        metadata: {
          domain: 'hr',
          author: 'test',
          retrievalStrategy: 'hybrid' as const,
        },
      };
      evidenceStore.addEvidence(chunk);
    });

    console.log(`📝 Loaded ${sampleChunks.length} sample chunks into EvidenceStore\n`);
  });

  it('should compile guideline into GCG grammar', () => {
    console.log('📘 Step 1: Guideline Compilation');

    const grammar = gcgCompiler.compile(GUIDELINE_PATH);

    expect(grammar).toBeDefined();
    expect(grammar.version).toBeDefined();
    expect(grammar.domain).toBe('hr');
    expect(grammar.rules).toBeDefined();
    expect(Object.keys(grammar.rules).length).toBeGreaterThan(0);

    console.log(`   ✅ Grammar compiled`);
    console.log(`   Domain: ${grammar.domain}`);
    console.log(`   Rules: ${Object.keys(grammar.rules).join(', ')}\n`);

    // Validate grammar
    const validation = gcgCompiler.validate(grammar);
    expect(validation.valid).toBe(true);
  });

  it('should generate QA pairs with ≥90% compliance', async () => {
    console.log('🤖 Step 2: QA Generation');
    console.log(`   Target: 20 QA pairs`);
    console.log(`   Compliance goal: ≥90%\n`);

    const result = await qaGenerator.generateQA({
      documentId,
      guidelinePath: GUIDELINE_PATH,
      count: 20,
    });

    expect(result.success).toBe(true);
    expect(result.totalGenerated).toBeGreaterThan(0);

    console.log(`\n📊 QA Generation Results:`);
    console.log(`   Generated: ${result.totalGenerated}/20`);
    console.log(`   Valid: ${result.totalValid}/${result.totalGenerated}`);
    console.log(`   Compliance: ${result.complianceRate.toFixed(1)}%`);
    console.log(`   Duration: ${result.duration.toFixed(2)}ms\n`);

    // Save results
    qaGenerator.saveToFile(result, OUTPUT_PATH);

    // Assert ≥90% compliance
    expect(result.complianceRate).toBeGreaterThanOrEqual(90);

    // Show sample QA pairs
    console.log('📝 Sample QA Pairs:\n');
    result.qaPairs.slice(0, 5).forEach((qa, i) => {
      console.log(`${i + 1}. Q: ${qa.question}`);
      console.log(`   A: ${qa.answer.substring(0, 100)}${qa.answer.length > 100 ? '...' : ''}`);
      console.log(`   Score: ${qa.metadata.validationScore}/100\n`);
    });
  }, 60000);

  it('should validate individual QA pairs', async () => {
    console.log('✅ Step 3: Individual QA Validation');

    // Load generated QA pairs
    const qaData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    const qaPairs = qaData.qaPairs;

    expect(qaPairs.length).toBeGreaterThan(0);

    // Load grammar
    const grammar = gcgCompiler.compile(GUIDELINE_PATH);

    // Validate each pair
    let passedCount = 0;

    for (const qa of qaPairs) {
      const questionValidation = gcgValidator.validate(qa.question, grammar);
      const answerValidation = gcgValidator.validate(qa.answer, grammar);

      const avgScore = (questionValidation.score + answerValidation.score) / 2;
      if (avgScore >= 80) {
        passedCount++;
      }
    }

    const complianceRate = (passedCount / qaPairs.length) * 100;

    console.log(`\n📊 Validation Results:`);
    console.log(`   Passed: ${passedCount}/${qaPairs.length}`);
    console.log(`   Compliance: ${complianceRate.toFixed(1)}%\n`);

    expect(complianceRate).toBeGreaterThanOrEqual(90);
  });

  it('should verify Gate G: Guideline Compliance ≥90%', () => {
    console.log('🎯 Step 4: Gate G Verification');

    // Load results
    const qaData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    const complianceRate = qaData.metadata.complianceRate;

    console.log(`\n📊 Gate G Status:`);
    console.log(`   Compliance Rate: ${complianceRate.toFixed(1)}%`);
    console.log(`   Target: ≥90%`);
    console.log(`   Status: ${complianceRate >= 90 ? '✅ PASS' : '❌ FAIL'}\n`);

    // Gate G: Guideline Compliance ≥90%
    expect(complianceRate).toBeGreaterThanOrEqual(90);

    if (complianceRate >= 90) {
      console.log('🎉 Gate G: PASS (Guideline Compliance ≥90%)\n');
    }
  });

  it('should generate compliance summary report', () => {
    console.log('📊 Step 5: Compliance Summary Report');

    const qaData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));

    const report = {
      timestamp: new Date().toISOString(),
      test: 'simplified (no PDF)',
      documentId,
      metrics: {
        totalGenerated: qaData.metadata.totalGenerated,
        totalValid: qaData.metadata.totalValid,
        complianceRate: qaData.metadata.complianceRate,
        duration: qaData.metadata.duration,
      },
      gateG: {
        status: qaData.metadata.complianceRate >= 90 ? 'PASS' : 'FAIL',
        target: 90,
        actual: qaData.metadata.complianceRate,
      },
      sampleCount: sampleChunks.length,
    };

    const reportPath = path.join(process.cwd(), 'reports/qa-generation/compliance-report-simple.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log(`   ✅ Report saved: ${reportPath}\n`);
    console.log(`   Summary:`);
    console.log(`      Gate G: ${report.gateG.status}`);
    console.log(`      Compliance: ${report.gateG.actual.toFixed(1)}% (target: ${report.gateG.target}%)`);
    console.log(`      Generated: ${report.metrics.totalGenerated}`);
    console.log(`      Valid: ${report.metrics.totalValid}\n`);

    expect(report.gateG.status).toBe('PASS');
  });
});
