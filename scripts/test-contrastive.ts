#!/usr/bin/env tsx
/**
 * Quick test for contrastive alignment
 */

import {
  calculateAlignment,
  calculateNgramOverlap,
  getCacheStats,
} from "./lib/contrastive-alignment.js";

async function main() {
  console.log("🧪 Testing Contrastive Alignment\n");

  // Test case 1: High similarity
  const answer1 = "The capital of France is Paris, a major European city.";
  const evidence1 = "Paris is the capital and most populous city of France.";

  console.log("Test 1: High Similarity");
  console.log(`Answer: ${answer1}`);
  console.log(`Evidence: ${evidence1}`);

  const result1 = await calculateAlignment(answer1, evidence1);
  console.log(`Result:`, result1);
  console.log();

  // Test case 2: Low similarity
  const answer2 = "Climate change is affecting polar bears.";
  const evidence2 = "The stock market experienced gains today.";

  console.log("Test 2: Low Similarity");
  console.log(`Answer: ${answer2}`);
  console.log(`Evidence: ${evidence2}`);

  const result2 = await calculateAlignment(answer2, evidence2);
  console.log(`Result:`, result2);
  console.log();

  // Test case 3: Partial overlap
  const answer3 =
    "The economy grew by 3% last quarter, showing strong performance.";
  const evidence3 = "Economic growth reached 3% in Q4.";

  console.log("Test 3: Partial Overlap");
  console.log(`Answer: ${answer3}`);
  console.log(`Evidence: ${evidence3}`);

  const result3 = await calculateAlignment(answer3, evidence3);
  console.log(`Result:`, result3);
  console.log();

  // Cache stats
  const stats = getCacheStats();
  console.log("Cache Stats:", stats);

  // Compare with n-gram only
  console.log("\n📊 Comparison: Contrastive vs N-gram");
  const ngramScore1 = calculateNgramOverlap(answer1, evidence1);
  console.log(
    `Test 1 - Contrastive: ${result1.score.toFixed(
      3,
    )}, N-gram: ${ngramScore1.toFixed(3)}`,
  );

  const ngramScore2 = calculateNgramOverlap(answer2, evidence2);
  console.log(
    `Test 2 - Contrastive: ${result2.score.toFixed(
      3,
    )}, N-gram: ${ngramScore2.toFixed(3)}`,
  );

  const ngramScore3 = calculateNgramOverlap(answer3, evidence3);
  console.log(
    `Test 3 - Contrastive: ${result3.score.toFixed(
      3,
    )}, N-gram: ${ngramScore3.toFixed(3)}`,
  );
}

main().catch(console.error);
