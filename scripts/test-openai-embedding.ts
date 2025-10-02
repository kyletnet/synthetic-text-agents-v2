#!/usr/bin/env npx tsx
/**
 * Test OpenAI embedding integration
 * Only runs if OPENAI_API_KEY is set
 */

import { calculateAlignment } from "./lib/contrastive-alignment.js";

async function main() {
  const hasRealKey =
    process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== "sk-your-openai-key-here";

  if (!hasRealKey) {
    console.log("⚠️  No real OpenAI API key found. Skipping OpenAI test.");
    console.log("   Using mock embeddings instead.");
    process.exit(0);
  }

  console.log("🔑 Real OpenAI API key detected");
  console.log("🧪 Testing OpenAI embedding integration\n");

  // Small test to verify API works
  const answer = "Paris is the capital of France.";
  const evidence = "The capital city of France is Paris.";

  console.log(`Answer: ${answer}`);
  console.log(`Evidence: ${evidence}\n`);

  try {
    const result = await calculateAlignment(answer, evidence);

    console.log("✅ OpenAI embedding API works!");
    console.log(`Result:`, result);
    console.log(
      `\nAlignment score: ${result.score.toFixed(3)} (${result.method})`,
    );

    if (result.method === "contrastive") {
      console.log("\n🎉 Successfully using real OpenAI embeddings!");
    } else {
      console.log("\n⚠️  Fell back to n-gram (OpenAI API might have failed)");
    }
  } catch (error) {
    console.error("❌ OpenAI embedding test failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
