/**
 * Guideline Compliance Test
 *
 * Validates that the complete QA generation pipeline produces
 * guideline-compliant output at ≥90% rate.
 *
 * Test Flow:
 * 1. Ingest real PDF document
 * 2. Compile guideline → GCG grammar
 * 3. Generate QA pairs
 * 4. Validate compliance
 * 5. Assert ≥90% compliance rate
 *
 * Exit KPI:
 * - Guideline Compliance ≥ 90%
 * - Groundedness ≥ 85%
 * - Faithfulness ≥ 90%
 *
 * @see PHASE_2.7_COMPLETE_HANDOFF.md
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { PDFIngestor } from '../../src/infrastructure/retrieval/pdf-ingestor';
import { QAGenerator } from '../../src/application/qa-generator';
import { GCGCompiler } from '../../src/offline/genius-lab/gcg/compiler';
import { GCGValidator } from '../../src/offline/genius-lab/gcg/validator';
import { EvidenceStore } from '../../src/core/transparency/evidence-store';

describe('Guideline Compliance Test (Gate G)', () => {
  const PDF_PATH = path.join(process.cwd(), 'datasets/qa-guideline-test/documents/2024년_아이돌봄지원사업_안내.pdf');
  const GUIDELINE_PATH = path.join(
    process.cwd(),
    'datasets/qa-guideline-test/guideline/문서별 QA 생성 가이드라인 27258518f3ab809f925eff15d6ecd1ac.md'
  );
  const OUTPUT_PATH = path.join(process.cwd(), 'reports/qa-generation/qa-output.json');

  let evidenceStore: EvidenceStore;
  let pdfIngestor: PDFIngestor;
  let qaGenerator: QAGenerator;
  let gcgCompiler: GCGCompiler;
  let gcgValidator: GCGValidator;
  let documentId: string;

  beforeAll(async () => {
    // Check files exist
    if (!fs.existsSync(PDF_PATH)) {
      throw new Error(`PDF file not found: ${PDF_PATH}`);
    }
    if (!fs.existsSync(GUIDELINE_PATH)) {
      throw new Error(`Guideline file not found: ${GUIDELINE_PATH}`);
    }

    // Initialize components
    evidenceStore = new EvidenceStore();
    pdfIngestor = new PDFIngestor({}, evidenceStore);
    qaGenerator = new QAGenerator(evidenceStore);
    gcgCompiler = new GCGCompiler();
    gcgValidator = new GCGValidator();

    console.log('🏁 Guideline Compliance Test Starting...\n');
  });

  it('should ingest PDF document successfully', async () => {
    console.log('📄 Step 1: PDF Ingestion');
    console.log(`   File: ${path.basename(PDF_PATH)}`);

    const result = await pdfIngestor.ingestPDF(PDF_PATH);

    expect(result.success).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.totalPages).toBeGreaterThan(0);

    documentId = result.docId;

    console.log(`   ✅ Ingested: ${result.totalPages} pages, ${result.chunks.length} chunks`);
    console.log(`   Document ID: ${documentId}`);
    console.log(`   Duration: ${result.duration.toFixed(2)}ms\n`);

    // Verify chunks are stored
    const storedChunks = evidenceStore.queryEvidence({ sourceIds: [documentId] });
    expect(storedChunks.length).toBe(result.chunks.length);
  }, 30000);

  it('should compile guideline into GCG grammar', () => {
    console.log('📘 Step 2: Guideline Compilation');
    console.log(`   File: ${path.basename(GUIDELINE_PATH)}`);

    const grammar = gcgCompiler.compile(GUIDELINE_PATH);

    expect(grammar).toBeDefined();
    expect(grammar.version).toBeDefined();
    expect(grammar.domain).toBe('hr'); // Should detect HR domain from guideline
    expect(grammar.rules).toBeDefined();
    expect(Object.keys(grammar.rules).length).toBeGreaterThan(0);

    console.log(`   ✅ Grammar compiled`);
    console.log(`   Domain: ${grammar.domain}`);
    console.log(`   Rules: ${Object.keys(grammar.rules).join(', ')}`);
    console.log(`   Version: ${grammar.version}\n`);

    // Validate grammar structure
    const validation = gcgCompiler.validate(grammar);
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);

    // Save grammar for inspection
    const grammarPath = path.join(process.cwd(), 'reports/qa-generation/grammar.yml');
    gcgCompiler.save(grammar, grammarPath);
    console.log(`   💾 Saved grammar: ${grammarPath}\n`);
  });

  it('should generate QA pairs with ≥90% compliance', async () => {
    console.log('🤖 Step 3: QA Generation');
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
    result.qaPairs.slice(0, 3).forEach((qa, i) => {
      console.log(`${i + 1}. Q: ${qa.question}`);
      console.log(`   A: ${qa.answer.substring(0, 100)}${qa.answer.length > 100 ? '...' : ''}`);
      console.log(`   Score: ${qa.metadata.validationScore}/100`);
      console.log(`   Type: ${qa.metadata.questionType} (${qa.metadata.difficulty})\n`);
    });
  }, 60000);

  it('should validate compliance for each QA pair', async () => {
    console.log('✅ Step 4: Individual QA Validation');

    // Load generated QA pairs
    const qaData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    const qaPairs = qaData.qaPairs;

    expect(qaPairs.length).toBeGreaterThan(0);

    // Load grammar
    const grammar = gcgCompiler.compile(GUIDELINE_PATH);

    // Validate each pair
    let passedCount = 0;
    const failedPairs: any[] = [];

    console.log(`   Validating ${qaPairs.length} QA pairs...\n`);

    for (const qa of qaPairs) {
      const questionValidation = gcgValidator.validate(qa.question, grammar);
      const answerValidation = gcgValidator.validate(qa.answer, grammar);

      const avgScore = (questionValidation.score + answerValidation.score) / 2;
      const passed = avgScore >= 80; // Minimum 80/100

      if (passed) {
        passedCount++;
      } else {
        failedPairs.push({
          id: qa.id,
          score: avgScore,
          questionViolations: questionValidation.violations,
          answerViolations: answerValidation.violations,
        });
      }
    }

    const complianceRate = (passedCount / qaPairs.length) * 100;

    console.log(`\n📊 Validation Results:`);
    console.log(`   Passed: ${passedCount}/${qaPairs.length}`);
    console.log(`   Compliance: ${complianceRate.toFixed(1)}%`);

    if (failedPairs.length > 0) {
      console.log(`\n❌ Failed QA Pairs (${failedPairs.length}):`);
      failedPairs.forEach((pair, i) => {
        console.log(`   ${i + 1}. ${pair.id} (score: ${pair.score.toFixed(1)})`);
        console.log(`      Q violations: ${pair.questionViolations.length}`);
        console.log(`      A violations: ${pair.answerViolations.length}`);
      });
    }

    console.log();

    // Assert ≥90% compliance
    expect(complianceRate).toBeGreaterThanOrEqual(90);
  });

  it('should verify rule-specific compliance', () => {
    console.log('🔍 Step 5: Rule-Specific Compliance Check');

    // Load generated QA pairs
    const qaData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    const qaPairs = qaData.qaPairs;

    // Load grammar
    const grammar = gcgCompiler.compile(GUIDELINE_PATH);

    // Track rule violations
    const ruleViolations: Record<string, number> = {};
    let totalChecks = 0;

    for (const qa of qaPairs) {
      const questionValidation = gcgValidator.validate(qa.question, grammar);
      const answerValidation = gcgValidator.validate(qa.answer, grammar);

      const allViolations = [
        ...questionValidation.violations,
        ...answerValidation.violations,
      ].filter((v) => v.severity === 'error');

      allViolations.forEach((v) => {
        ruleViolations[v.rule] = (ruleViolations[v.rule] || 0) + 1;
      });

      totalChecks += 2; // Question + Answer
    }

    console.log(`\n📊 Rule Violation Breakdown:`);
    console.log(`   Total checks: ${totalChecks}`);
    console.log(`   Total violations: ${Object.values(ruleViolations).reduce((sum, count) => sum + count, 0)}`);

    if (Object.keys(ruleViolations).length > 0) {
      console.log(`\n   Violations by rule:`);
      Object.entries(ruleViolations)
        .sort(([, a], [, b]) => b - a)
        .forEach(([rule, count]) => {
          console.log(`   - ${rule}: ${count}`);
        });
    } else {
      console.log(`   ✨ No violations detected!`);
    }

    console.log();

    // Most common violations should be less than 10% of total checks
    const maxViolations = Object.values(ruleViolations).length > 0
      ? Math.max(...Object.values(ruleViolations))
      : 0;
    const violationRate = (maxViolations / totalChecks) * 100;

    expect(violationRate).toBeLessThan(10);
  });

  it('should generate compliance report', () => {
    console.log('📊 Step 6: Compliance Report Generation');

    // Load generated QA pairs
    const qaData = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));

    const report = {
      timestamp: new Date().toISOString(),
      documentId,
      pdfFile: path.basename(PDF_PATH),
      guidelineFile: path.basename(GUIDELINE_PATH),
      metrics: {
        totalGenerated: qaData.metadata.totalGenerated,
        totalValid: qaData.metadata.totalValid,
        complianceRate: qaData.metadata.complianceRate,
        duration: qaData.metadata.duration,
      },
      gateStatus: qaData.metadata.complianceRate >= 90 ? 'PASS' : 'FAIL',
      qaSamples: qaData.qaPairs.slice(0, 5).map((qa: any) => ({
        id: qa.id,
        questionType: qa.metadata.questionType,
        difficulty: qa.metadata.difficulty,
        score: qa.metadata.validationScore,
      })),
    };

    const reportPath = path.join(process.cwd(), 'reports/qa-generation/compliance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log(`   ✅ Report generated: ${reportPath}\n`);
    console.log(`   📊 Summary:`);
    console.log(`      Status: ${report.gateStatus}`);
    console.log(`      Compliance: ${report.metrics.complianceRate.toFixed(1)}%`);
    console.log(`      Generated: ${report.metrics.totalGenerated}`);
    console.log(`      Valid: ${report.metrics.totalValid}`);
    console.log();

    // Gate G: Guideline Compliance ≥90%
    expect(report.gateStatus).toBe('PASS');
    expect(report.metrics.complianceRate).toBeGreaterThanOrEqual(90);

    console.log('🎉 Gate G: PASS (Guideline Compliance ≥90%)\n');
  });
});
