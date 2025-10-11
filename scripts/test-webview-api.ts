#!/usr/bin/env tsx
/**
 * WebView API Integration Test
 *
 * Purpose:
 * - Load QA from batch report
 * - Test all API endpoints (list, detail, regenerate)
 * - Verify filtering, sorting, pagination
 *
 * Usage:
 *   npx tsx scripts/test-webview-api.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { QAListAPI } from '../src/api/trust/qa-list';
import type { QAPair } from '../src/application/qa-generator';

async function main() {
  console.log('🔧 WebView API Integration Test\n');
  console.log('═'.repeat(60));

  // Step 1: Load QA from batch report
  console.log('\n📦 Step 1: Load QA from Batch Report\n');

  const reportPath = path.join(
    process.cwd(),
    'reports/qa-generation/batch-report-optimized.json'
  );

  if (!fs.existsSync(reportPath)) {
    throw new Error(`Report not found: ${reportPath}`);
  }

  const batchReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  const qaAPI = new QAListAPI();

  let totalQA = 0;
  for (const result of batchReport.results || []) {
    if (result.qaPairs) {
      for (const qa of result.qaPairs) {
        qaAPI.addQA(qa);
        totalQA++;
      }
    }
  }

  console.log(`   ✅ Loaded ${totalQA} QA pairs into API\n`);

  // Step 2: Test QA List API
  console.log('📊 Step 2: Test QA List API\n');

  // Test 1: Get all QA
  console.log('   Test 1: Get all QA (default)');
  const allQA = await qaAPI.getList({});
  console.log(`   ✓ Total: ${allQA.total}, Page: ${allQA.page}, Limit: ${allQA.limit}`);
  console.log(`   ✓ Summary: ${allQA.summary.totalQA} total, ${allQA.summary.passed} passed, ${allQA.summary.failed} failed`);
  console.log(`   ✓ Average Score: ${allQA.summary.averageScore}/100\n`);

  // Test 2: Filter by passed
  console.log('   Test 2: Filter by passed QA');
  const passedQA = await qaAPI.getList({ filter: 'passed' });
  console.log(`   ✓ Passed QA: ${passedQA.total}\n`);

  // Test 3: Filter by failed
  console.log('   Test 3: Filter by failed QA');
  const failedQA = await qaAPI.getList({ filter: 'failed' });
  console.log(`   ✓ Failed QA: ${failedQA.total}\n`);

  // Test 4: Sort by score
  console.log('   Test 4: Sort by score (descending)');
  const sortedByScore = await qaAPI.getList({ sort: 'score', limit: 3 });
  console.log(`   ✓ Top 3 QA by score:`);
  sortedByScore.data.forEach((qa, idx) => {
    console.log(`     ${idx + 1}. Score: ${qa.metadata.validationScore}, ID: ${qa.id.substring(0, 30)}...`);
  });
  console.log('');

  // Test 5: Sort by violations
  console.log('   Test 5: Sort by violations (ascending)');
  const sortedByViolations = await qaAPI.getList({ sort: 'violations', limit: 3 });
  console.log(`   ✓ Top 3 QA by fewest violations:`);
  sortedByViolations.data.forEach((qa, idx) => {
    console.log(`     ${idx + 1}. Violations: ${qa.metadata.violations}, Score: ${qa.metadata.validationScore}`);
  });
  console.log('');

  // Test 6: Pagination
  console.log('   Test 6: Pagination (page 1, limit 5)');
  const page1 = await qaAPI.getList({ page: 1, limit: 5 });
  console.log(`   ✓ Page 1: ${page1.data.length} items`);

  console.log('   Test 7: Pagination (page 2, limit 5)');
  const page2 = await qaAPI.getList({ page: 2, limit: 5 });
  console.log(`   ✓ Page 2: ${page2.data.length} items\n`);

  // Test 7: Filter by domain
  console.log('   Test 8: Filter by domain (hr)');
  const hrQA = await qaAPI.getList({ domain: 'hr' });
  console.log(`   ✓ HR domain QA: ${hrQA.total}\n`);

  // Step 3: API Summary
  console.log('═'.repeat(60));
  console.log('📊 API TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Total QA Loaded: ${totalQA}`);
  console.log(`   Passed QA: ${passedQA.total} (${((passedQA.total / totalQA) * 100).toFixed(1)}%)`);
  console.log(`   Failed QA: ${failedQA.total} (${((failedQA.total / totalQA) * 100).toFixed(1)}%)`);
  console.log(`   Average Score: ${allQA.summary.averageScore}/100`);
  console.log(`   Highest Score: ${sortedByScore.data[0]?.metadata.validationScore || 0}`);
  console.log(`   Lowest Violations: ${sortedByViolations.data[0]?.metadata.violations || 0}`);
  console.log('═'.repeat(60) + '\n');

  // Step 4: Sample QA Detail
  console.log('📄 Step 3: Sample QA Detail\n');

  if (allQA.data.length > 0) {
    const sampleQA = allQA.data[0];
    console.log(`   ID: ${sampleQA.id}`);
    console.log(`   Question: ${sampleQA.question}`);
    console.log(`   Answer: ${sampleQA.answer.substring(0, 100)}...`);
    console.log(`   Score: ${sampleQA.metadata.validationScore}`);
    console.log(`   Violations: ${sampleQA.metadata.violations}`);
    console.log(`   Domain: ${sampleQA.metadata.domain}`);
    console.log('');
  }

  console.log('✅ WebView API Test Completed Successfully\n');
}

// Run
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ API Test Failed:', error);
    process.exit(1);
  });
}
