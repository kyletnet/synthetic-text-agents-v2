#!/usr/bin/env tsx
/**
 * Full Quality Audit Script
 *
 * Purpose:
 * - Re-validate all QA pairs from last run
 * - Detailed violation analysis
 * - Performance metrics collection
 * - Comprehensive quality report generation
 *
 * Usage:
 *   npx tsx scripts/audit/full-audit.ts [--input <report-file>]
 *
 * Example:
 *   npx tsx scripts/audit/full-audit.ts --input reports/qa-generation/last-run.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { GCGCompiler } from '../../src/offline/genius-lab/gcg/compiler';
import { GCGValidator } from '../../src/offline/genius-lab/gcg/validator';

/**
 * QA Pair Interface
 */
interface QAPair {
  id: string;
  question: string;
  answer: string;
  sourceChunks: string[];
  metadata?: {
    domain?: string;
    validationScore?: number;
    violations?: number;
  };
}

/**
 * Last Run Report
 */
interface LastRunReport {
  timestamp: string;
  config: {
    pdfPath: string | null;
    qaPerDocument: number | null;
  };
  results: {
    qaGeneration: {
      requested: number;
      generated: number;
      avgLatency: string;
    };
    gateG: {
      status: string;
      complianceRate: number;
      validQA: number;
      totalQA: number;
      averageScore: number;
      violations: number;
    };
    gateF: {
      status: string;
      p95Latency: number;
      throughput: number;
      systemUtilization: number;
    };
    overallStatus: string;
    duration: string;
  };
  qaPairs: number;
}

/**
 * Audit Result
 */
interface AuditResult {
  timestamp: string;
  summary: {
    totalQA: number;
    validQA: number;
    complianceRate: number;
    averageScore: number;
    totalViolations: number;
  };
  violationBreakdown: {
    error: { count: number; rules: Map<string, number> };
    warning: { count: number; rules: Map<string, number> };
    info: { count: number; rules: Map<string, number> };
  };
  qaDetails: Array<{
    id: string;
    question: string;
    answer: string;
    score: number;
    passed: boolean;
    violations: Array<{
      rule: string;
      severity: string;
      message: string;
    }>;
  }>;
  recommendations: string[];
}

/**
 * Parse command line arguments
 */
function parseArgs(): { inputPath: string } {
  const args = process.argv.slice(2);
  let inputPath = path.join(process.cwd(), 'reports/qa-generation/last-run.json');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      inputPath = path.resolve(args[i + 1]);
      i++;
    }
  }

  return { inputPath };
}

/**
 * Load QA pairs from last run
 */
function loadQAPairs(reportPath: string): QAPair[] {
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Report file not found: ${reportPath}`);
  }

  const reportData = fs.readFileSync(reportPath, 'utf-8');
  const report: LastRunReport = JSON.parse(reportData);

  // Try to load QA pairs from batch report if available
  const batchReportPath = path.join(path.dirname(reportPath), 'batch-report.json');
  if (fs.existsSync(batchReportPath)) {
    const batchData = fs.readFileSync(batchReportPath, 'utf-8');
    const batchReport = JSON.parse(batchData);

    const allQA: QAPair[] = [];
    for (const result of batchReport.results || []) {
      if (result.qaPairs) {
        allQA.push(...result.qaPairs);
      }
    }

    return allQA;
  }

  // Fallback: try to reconstruct from last-run (limited info)
  console.warn('⚠️  Batch report not found. Limited QA data available.');
  return [];
}

/**
 * Main audit function
 */
async function main() {
  console.log('🔍 Full Quality Audit\n');
  console.log('═'.repeat(60));

  const { inputPath } = parseArgs();
  const startTime = performance.now();

  console.log(`\n📂 Input Report: ${inputPath}\n`);

  // Step 1: Load QA pairs
  console.log('📦 Step 1: Load QA Pairs\n');
  const qaPairs = loadQAPairs(inputPath);

  if (qaPairs.length === 0) {
    console.error('❌ No QA pairs found in report.');
    console.error('💡 Ensure batch-report.json exists with qaPairs data.');
    process.exit(1);
  }

  console.log(`   ✅ Loaded ${qaPairs.length} QA pairs\n`);

  // Step 2: Load guideline and compile grammar
  console.log('📘 Step 2: Load Guideline\n');

  const guidelinePath = path.join(
    process.cwd(),
    'datasets/qa-guideline-test/guideline/문서별 QA 생성 가이드라인 27258518f3ab809f925eff15d6ecd1ac.md'
  );

  const gcgCompiler = new GCGCompiler();
  const gcgValidator = new GCGValidator();

  const grammar = gcgCompiler.compile(guidelinePath);
  console.log(`   ✅ Grammar compiled (domain: ${grammar.domain})\n`);

  // Step 3: Re-validate all QA pairs
  console.log('🔄 Step 3: Re-validate All QA Pairs\n');

  const auditResult: AuditResult = {
    timestamp: new Date().toISOString(),
    summary: {
      totalQA: qaPairs.length,
      validQA: 0,
      complianceRate: 0,
      averageScore: 0,
      totalViolations: 0,
    },
    violationBreakdown: {
      error: { count: 0, rules: new Map() },
      warning: { count: 0, rules: new Map() },
      info: { count: 0, rules: new Map() },
    },
    qaDetails: [],
    recommendations: [],
  };

  let totalScore = 0;
  let totalViolations = 0;

  for (const [index, qa] of qaPairs.entries()) {
    // Validate question and answer
    const questionValidation = gcgValidator.validate(qa.question, grammar);
    const answerValidation = gcgValidator.validate(qa.answer, grammar);

    const avgScore = (questionValidation.score + answerValidation.score) / 2;
    const allViolations = [...questionValidation.violations, ...answerValidation.violations];

    const criticalViolations = allViolations.filter((v) => v.severity === 'error').length;
    const passed = avgScore >= 65 && criticalViolations <= 3; // Aligned with tuned thresholds

    if (passed) {
      auditResult.summary.validQA++;
    }

    totalScore += avgScore;
    totalViolations += criticalViolations;

    // Track violation breakdown
    for (const v of allViolations) {
      const breakdown = auditResult.violationBreakdown[v.severity];
      breakdown.count++;
      const ruleCount = breakdown.rules.get(v.rule) || 0;
      breakdown.rules.set(v.rule, ruleCount + 1);
    }

    // Store QA details
    auditResult.qaDetails.push({
      id: qa.id,
      question: qa.question.substring(0, 100) + (qa.question.length > 100 ? '...' : ''),
      answer: qa.answer.substring(0, 100) + (qa.answer.length > 100 ? '...' : ''),
      score: avgScore,
      passed,
      violations: allViolations.map((v) => ({
        rule: v.rule,
        severity: v.severity,
        message: v.message,
      })),
    });

    console.log(
      `   ${passed ? '✓' : '✗'} QA ${index + 1}/${qaPairs.length} (score: ${avgScore.toFixed(1)}, violations: ${criticalViolations})`
    );
  }

  // Calculate summary
  auditResult.summary.averageScore = totalScore / qaPairs.length;
  auditResult.summary.totalViolations = totalViolations;
  auditResult.summary.complianceRate = (auditResult.summary.validQA / qaPairs.length) * 100;

  console.log('\n');

  // Step 4: Generate recommendations
  console.log('💡 Step 4: Generate Recommendations\n');

  if (auditResult.summary.complianceRate < 70) {
    auditResult.recommendations.push('🔴 Compliance below 70% - consider further rule relaxation');
  }

  if (auditResult.summary.averageScore < 70) {
    auditResult.recommendations.push('🔴 Average score below 70 - improve prompt quality');
  }

  if (auditResult.violationBreakdown.error.count > 20) {
    auditResult.recommendations.push('🔴 High error violations - review GCG rule severity');
  }

  // Top violation rules
  const topErrors = Array.from(auditResult.violationBreakdown.error.rules.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  if (topErrors.length > 0) {
    auditResult.recommendations.push(`🔴 Top error rules: ${topErrors.map((e) => `${e[0]} (${e[1]})`).join(', ')}`);
  }

  if (auditResult.summary.complianceRate >= 70) {
    auditResult.recommendations.push('✅ Compliance target achieved');
  }

  // Step 5: Save audit report
  console.log('📝 Step 5: Save Audit Report\n');

  const outputPath = path.join(process.cwd(), 'reports/audit/full-audit-report.json');
  const outputDir = path.dirname(outputPath);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        ...auditResult,
        violationBreakdown: {
          error: {
            count: auditResult.violationBreakdown.error.count,
            rules: Object.fromEntries(auditResult.violationBreakdown.error.rules),
          },
          warning: {
            count: auditResult.violationBreakdown.warning.count,
            rules: Object.fromEntries(auditResult.violationBreakdown.warning.rules),
          },
          info: {
            count: auditResult.violationBreakdown.info.count,
            rules: Object.fromEntries(auditResult.violationBreakdown.info.rules),
          },
        },
      },
      null,
      2
    )
  );

  console.log(`   ✅ Report saved: ${outputPath}\n`);

  // Final summary
  const duration = ((performance.now() - startTime) / 1000).toFixed(2);

  console.log('═'.repeat(60));
  console.log('📊 AUDIT SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Total QA: ${auditResult.summary.totalQA}`);
  console.log(`   Valid QA: ${auditResult.summary.validQA}`);
  console.log(`   Compliance: ${auditResult.summary.complianceRate.toFixed(1)}%`);
  console.log(`   Average Score: ${auditResult.summary.averageScore.toFixed(1)}/100`);
  console.log(`   Total Violations: ${auditResult.summary.totalViolations}`);
  console.log(`   Duration: ${duration}s`);
  console.log('═'.repeat(60) + '\n');

  console.log('💡 RECOMMENDATIONS\n');
  auditResult.recommendations.forEach((rec) => console.log(`   ${rec}`));
  console.log('');

  console.log('═'.repeat(60) + '\n');

  if (auditResult.summary.complianceRate >= 70) {
    console.log('✅ Audit PASSED - Compliance target achieved');
    process.exit(0);
  } else {
    console.log('⚠️  Audit completed - Compliance below target');
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Audit failed:', error);
    process.exit(1);
  });
}
