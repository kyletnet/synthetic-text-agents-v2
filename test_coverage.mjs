#!/usr/bin/env node

import { readFileSync } from 'fs';
import { calculateCoverageMetrics } from './dist/scripts/metrics/coverageMetrics.js';

// Load sample data
const lines = readFileSync('evaluation_sample_fixed.jsonl', 'utf-8')
  .trim()
  .split('\n');

const qaItems = lines.slice(0, 5).map(line => JSON.parse(line));

const sourceTexts = qaItems.map(item => item.source_text).filter(Boolean);

console.log('QA Items:', qaItems.length);
console.log('Source Texts:', sourceTexts.length);

try {
  const result = calculateCoverageMetrics(qaItems, sourceTexts, 'baseline_config.json');
  console.log('Coverage Result:');
  console.log('- Entity coverage:', result.entity_coverage.coverage_rate);
  console.log('- Section coverage:', result.section_coverage.coverage_rate);
  console.log('- Overall score:', result.coverage_summary.overall_score);
  console.log('- Total entities:', result.entity_coverage.total_entities);
  console.log('- Total sections:', result.section_coverage.total_sections);
} catch (error) {
  console.error('Error:', error.message);
}