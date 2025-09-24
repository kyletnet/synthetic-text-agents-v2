#!/usr/bin/env node
/**
 * Sample a subset of evaluation data for cost-effective testing
 */

import fs from 'fs';

function sampleEvaluationData(inputPath, outputPath, sampleSize = 100) {
    console.log(`🎲 Sampling ${sampleSize} items from ${inputPath}...`);

    // Read JSONL file
    const lines = fs.readFileSync(inputPath, 'utf-8')
        .trim()
        .split('\n')
        .filter(line => line.trim());

    console.log(`📊 Total items available: ${lines.length}`);

    // Random sampling
    const sampledLines = [];
    const totalItems = lines.length;
    const step = Math.floor(totalItems / sampleSize);

    if (sampleSize >= totalItems) {
        console.log(`⚠️  Sample size (${sampleSize}) >= total items (${totalItems}), using all items`);
        sampledLines.push(...lines);
    } else {
        // Even distribution sampling
        for (let i = 0; i < sampleSize; i++) {
            const index = Math.floor(i * step + Math.random() * step);
            if (index < totalItems) {
                sampledLines.push(lines[index]);
            }
        }
    }

    // Write sampled data
    fs.writeFileSync(outputPath, sampledLines.join('\n') + '\n', 'utf-8');

    console.log(`✅ Sampled ${sampledLines.length} items to ${outputPath}`);
    console.log(`💰 Estimated cost reduction: ${Math.round((1 - sampledLines.length / totalItems) * 100)}%`);

    return sampledLines.length;
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node sample_evaluation_data.js <input.jsonl> <output.jsonl> [sample_size=100]');
        console.log('Example: node sample_evaluation_data.js evaluation_data.jsonl evaluation_sample.jsonl 50');
        process.exit(1);
    }

    const [inputPath, outputPath, sampleSizeStr] = args;
    const sampleSize = sampleSizeStr ? parseInt(sampleSizeStr) : 100;

    try {
        sampleEvaluationData(inputPath, outputPath, sampleSize);
    } catch (error) {
        console.error('❌ Sampling failed:', error.message);
        process.exit(1);
    }
}

export { sampleEvaluationData };