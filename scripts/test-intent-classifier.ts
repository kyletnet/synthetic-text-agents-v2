#!/usr/bin/env tsx
/**
 * Intent Classifier Test
 *
 * Phase 7: Verify Intent Classification
 */

import { IntentClassifier } from '../src/runtime/intent';

const TEST_QUERIES = [
  '독립형 아이돌봄 서비스의 가격은 얼마인가?',
  '아이돌봄 서비스의 유형에는 어떤 것들이 있나?',
  '긴급 돌봄 서비스는 어떻게 신청하나?',
  '아이돌봄 서비스 이용 자격은 무엇인가?',
  '정부 지원금은 소득 수준에 따라 어떻게 다른가?',
];

async function main() {
  console.log('[START] Intent Classifier Test\n');

  const classifier = new IntentClassifier();

  for (const query of TEST_QUERIES) {
    const result = await classifier.classify(query);

    console.log(`[Query] ${query}`);
    console.log(`  Intent Type: ${result.intent.type}`);
    console.log(`  Answer Type: ${result.intent.expectedAnswerType}`);
    console.log(`  Entities: ${result.intent.entities.join(', ')}`);
    console.log(`  Keywords: ${result.intent.keywords.slice(0, 5).join(', ')}...`);
    console.log(`  Confidence: ${result.intent.confidence}`);
    console.log(`  Processing Time: ${result.processingTime.toFixed(2)}ms`);
    console.log();
  }

  console.log('[SUCCESS] Intent Classification Test Complete');
}

main().catch(console.error);
