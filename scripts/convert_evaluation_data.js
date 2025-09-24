#!/usr/bin/env node
/**
 * Convert evaluation JSON format to JSONL format for baseline testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function convertEvaluationData(inputPath, outputPath) {
    console.log(`🔄 Converting evaluation data...`);
    console.log(`📥 Input: ${inputPath}`);
    console.log(`📤 Output: ${outputPath}`);

    // Read the evaluation JSON file
    const evaluationData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

    let convertedItems = [];
    let totalQuestions = 0;

    // Process each data item
    evaluationData.data.forEach((item, itemIndex) => {
        const { id, date, paragraphs } = item;
        const { context, qas } = paragraphs;

        // Combine all context paragraphs into source text
        const sourceText = context.join(' ');

        // Process each Q&A pair
        qas.questions.forEach((question, qaIndex) => {
            const answer = qas.answers[qaIndex];

            if (question && answer) {
                const convertedItem = {
                    qa: {
                        q: question.trim(),
                        a: answer.trim()
                    },
                    evidence: sourceText, // Use full context as evidence
                    source_text: sourceText,
                    cost_usd: 0.001, // Default cost
                    latency_ms: 150 + Math.random() * 100, // Simulated latency
                    index: totalQuestions,
                    // Metadata from original
                    metadata: {
                        original_id: id,
                        date: date,
                        qa_pair_index: qaIndex,
                        keywords: qas.keywords ? qas.keywords[qaIndex] : undefined
                    }
                };

                convertedItems.push(convertedItem);
                totalQuestions++;
            }
        });
    });

    // Write as JSONL (each line is a JSON object)
    const jsonlContent = convertedItems
        .map(item => JSON.stringify(item, null, 0))
        .join('\n');

    fs.writeFileSync(outputPath, jsonlContent, 'utf-8');

    console.log(`✅ Conversion completed!`);
    console.log(`📊 Converted ${convertedItems.length} Q&A pairs from ${evaluationData.data.length} documents`);
    console.log(`🎯 Ready for baseline testing with: ./run_v3.sh baseline dev --data=${outputPath}`);

    return {
        totalItems: convertedItems.length,
        totalDocuments: evaluationData.data.length,
        outputPath: outputPath
    };
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node convert_evaluation_data.js <input.json> <output.jsonl>');
        console.log('Example: node convert_evaluation_data.js evaluation_samples.json test_data.jsonl');
        process.exit(1);
    }

    const [inputPath, outputPath] = args;

    try {
        convertEvaluationData(inputPath, outputPath);
    } catch (error) {
        console.error('❌ Conversion failed:', error.message);
        process.exit(1);
    }
}

export { convertEvaluationData };