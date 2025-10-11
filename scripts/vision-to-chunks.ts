#!/usr/bin/env tsx
/**
 * Vision to Chunks Converter
 *
 * Purpose:
 * - Convert Vision Analysis results to chunked format
 * - Use Vision-Guided Chunker for structure-preserving chunking
 * - Save chunks for use in Real Hybrid Benchmark
 *
 * Usage:
 *   npx tsx scripts/vision-to-chunks.ts \
 *     --input reports/pdf-vision/test-5-10.json \
 *     --output reports/pdf-vision/test-5-10-chunked.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { VisionGuidedChunker } from '../src/runtime/chunking/vision-guided/vision-guided-chunker';
import type { VisionAnalysisResult } from '../src/infrastructure/vision/gemini-vision-client';

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    input: 'reports/pdf-vision/test-5-10.json',
    output: 'reports/pdf-vision/test-5-10-chunked.json',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) {
      config.input = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      config.output = args[i + 1];
      i++;
    }
  }

  return config;
}

/**
 * Main conversion function
 */
async function main() {
  console.log('[START] Vision to Chunks Converter\n');

  const config = parseArgs();
  console.log('Configuration:');
  console.log(`   - Input: ${config.input}`);
  console.log(`   - Output: ${config.output}\n`);

  // Step 1: Load Vision analysis results
  console.log('[Step 1] Loading Vision analysis results...');

  let visionData: any;
  try {
    const fileContent = await fs.readFile(config.input, 'utf-8');
    visionData = JSON.parse(fileContent);
    console.log(`   [OK] Loaded Vision data`);
    console.log(`   - Total pages: ${visionData.totalPages}`);
    console.log(`   - Processed pages: ${visionData.processedPages}`);
    console.log(`   - Total tables: ${visionData.summary?.totalTables || 0}`);
    console.log(`   - Total sections: ${visionData.summary?.totalSections || 0}`);
  } catch (error) {
    console.error(`   [ERROR] Failed to load Vision data: ${error}`);
    process.exit(1);
  }

  if (!visionData.visionAnalysis || visionData.visionAnalysis.length === 0) {
    console.error('   [ERROR] No visionAnalysis found in input file');
    process.exit(1);
  }

  const visionResults: VisionAnalysisResult[] = visionData.visionAnalysis;

  // Step 2: Chunk using Vision-Guided Chunker
  console.log('\n[Step 2] Chunking with Vision-Guided Chunker...');

  const chunker = new VisionGuidedChunker();
  const chunkingResult = await chunker.chunk(visionResults, {
    mode: 'hybrid',
    maxChunkSize: 2500,
    minChunkSize: 500,
    preserveTable: true,
    preserveSection: true,
    overlapSize: 100,
  });

  console.log(`   [OK] Created ${chunkingResult.stats.totalChunks} chunks`);
  console.log(`   - Section chunks: ${chunkingResult.stats.sectionChunks}`);
  console.log(`   - Table chunks: ${chunkingResult.stats.tableChunks}`);
  console.log(`   - List chunks: ${chunkingResult.stats.listChunks}`);
  console.log(`   - Avg chunk size: ${Math.round(chunkingResult.stats.avgChunkSize)} chars`);
  console.log(`   - Preservation rate: ${chunkingResult.stats.preservationRate.toFixed(1)}%`);

  // Step 3: Save chunked results
  console.log('\n[Step 3] Saving chunked results...');

  const outputData = {
    ...visionData,
    chunks: chunkingResult.chunks,
    chunkingStats: chunkingResult.stats,
  };

  await fs.mkdir(path.dirname(config.output), { recursive: true });
  await fs.writeFile(config.output, JSON.stringify(outputData, null, 2));

  console.log(`   [OK] Saved to ${config.output}`);
  console.log('');
  console.log('[SUCCESS] Vision to Chunks conversion complete!');
  console.log('');
  console.log('Next steps:');
  console.log(`   1. Review chunks: jq '.chunks | length' ${config.output}`);
  console.log(`   2. Run Real benchmark with chunks:`);
  console.log(`      USE_REAL_CLIENTS=true VISION_CHUNKED_PATH=${config.output} \\`);
  console.log(`        npx tsx scripts/real-hybrid-benchmark.ts`);
  console.log('');
}

// Run main function
main().catch(error => {
  console.error('[ERROR] Conversion failed:', error);
  process.exit(1);
});
