/**
 * Debug script for snippet alignment analysis
 *
 * Purpose: Understand why alignment scores are low
 */

import { EvidenceAligner } from "./checkers/evidence-aligner.js";
import { readFile } from "fs/promises";
import type { QAPair } from "./models/quality-domain.js";

async function main() {
  // Load test data
  const testDataPath = "data/qa-pairs-phase2-sample.json";
  const data = await readFile(testDataPath, "utf-8");
  const qaPairs: QAPair[] = JSON.parse(data);

  const aligner = new EvidenceAligner();

  console.log("🔍 Snippet Alignment Debug Analysis\n");
  console.log("=" .repeat(80));

  for (const qa of qaPairs) {
    if (!qa.evidence || qa.evidence.length === 0) continue;

    console.log(`\n📌 QA ID: ${qa.id}`);
    console.log(`Question: ${qa.question}`);
    console.log(`\nAnswer:\n  "${qa.answer}"\n`);
    console.log(`Evidence:`);
    qa.evidence.forEach((ev, idx) => {
      console.log(`  [${idx + 1}] "${ev}"`);
    });

    // Calculate alignment for this QA
    const sentences = splitIntoSentences(qa.answer);
    console.log(`\nSentences (${sentences.length}):`);

    let totalAlignment = 0;
    const combinedEvidence = qa.evidence.join(" ");

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      console.log(`\n  [${i + 1}] "${sentence}"`);

      let bestMatch = 0;
      let bestMatchSource = "";

      // Check against individual evidence
      for (let j = 0; j < qa.evidence.length; j++) {
        const evidenceSnippet = qa.evidence[j];
        const similarity = calculateKeywordOverlap(sentence, evidenceSnippet);

        if (similarity > bestMatch) {
          bestMatch = similarity;
          bestMatchSource = `Evidence[${j + 1}]`;
        }

        console.log(
          `      vs Evidence[${j + 1}]: ${(similarity * 100).toFixed(1)}%`,
        );
      }

      // Check against combined evidence
      const combinedSimilarity = calculateKeywordOverlap(
        sentence,
        combinedEvidence,
      );
      if (combinedSimilarity > bestMatch) {
        bestMatch = combinedSimilarity;
        bestMatchSource = "Combined";
      }

      console.log(
        `      vs Combined: ${(combinedSimilarity * 100).toFixed(1)}%`,
      );
      console.log(
        `      → Best: ${(bestMatch * 100).toFixed(1)}% (${bestMatchSource})`,
      );

      totalAlignment += bestMatch;
    }

    const avgAlignment = totalAlignment / sentences.length;
    console.log(
      `\n  ✅ Overall Alignment: ${(avgAlignment * 100).toFixed(1)}%`,
    );
    console.log("=" .repeat(80));
  }
}

// ============================================================================
// Helper Functions (copied from EvidenceAligner for debugging)
// ============================================================================

function splitIntoSentences(text: string): string[] {
  const sentences = text
    .split(/[.!?,]|(?:이며|하며|하고|그리고)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  return sentences.length > 0 ? sentences : [text];
}

function calculateKeywordOverlap(text1: string, text2: string): number {
  // Extract entities
  const entities1 = extractEntities(text1);
  const entities2 = extractEntities(text2);

  // Entity overlap score
  let entityScore = 0;
  if (entities1.numbers.size > 0 || entities2.numbers.size > 0) {
    const numberMatch = calculateSetOverlap(
      entities1.numbers,
      entities2.numbers,
    );
    entityScore += numberMatch * 0.4;
  }

  if (entities1.amounts.size > 0 || entities2.amounts.size > 0) {
    const amountMatch = calculateSetOverlap(
      entities1.amounts,
      entities2.amounts,
    );
    entityScore += amountMatch * 0.4;
  }

  // Keyword overlap
  const words1 = new Set(
    text1.toLowerCase().split(/\s+/).filter((w) => w.length >= 2),
  );
  const words2 = new Set(
    text2.toLowerCase().split(/\s+/).filter((w) => w.length >= 2),
  );

  let keywordScore = 0;
  if (words1.size > 0 && words2.size > 0) {
    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    keywordScore = intersection.size / union.size;
  }

  // Combine scores
  if (entityScore > 0) {
    return Math.min(1.0, entityScore * 0.5 + keywordScore * 0.5);
  } else {
    return keywordScore;
  }
}

function extractEntities(text: string): {
  numbers: Set<string>;
  amounts: Set<string>;
  dates: Set<string>;
} {
  const numbers = new Set<string>();
  const amounts = new Set<string>();
  const dates = new Set<string>();

  const numberPatterns = [
    /(\d+)일/g,
    /(\d+)개월/g,
    /(\d+)년/g,
    /(\d+)퍼센트/g,
    /(\d+)%/g,
    /(\d+)\s*회/g,
  ];

  for (const pattern of numberPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      numbers.add(match[1]);
    }
  }

  const amountPatterns = [/(\d+)만원/g, /(\d+,\d+)원/g, /(\d+)원/g];

  for (const pattern of amountPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      amounts.add(match[1].replace(/,/g, ""));
    }
  }

  return { numbers, amounts, dates };
}

function calculateSetOverlap(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter((item) => set2.has(item)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

main().catch(console.error);
