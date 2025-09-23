#!/usr/bin/env node

import { ABTestManager } from '../core/abTestManager.js';
import { Orchestrator } from '../core/orchestrator.js';
import { QARequest } from '../shared/types.js';
import { Logger } from '../shared/logger.js';
import * as fs from 'fs';
import * as path from 'path';

interface TestConfig {
  testId: string;
  variants: string[];
  sampleRequests: QARequest[];
  description?: string;
}

class ABTestCLI {
  private abTestManager: ABTestManager;
  private orchestrator: Orchestrator;
  private logger: Logger;

  constructor() {
    this.orchestrator = new Orchestrator();
    this.abTestManager = new ABTestManager(this.orchestrator);
    this.logger = new Logger();
  }

  async initialize(): Promise<void> {
    await this.orchestrator.initialize();
    await this.logger.initialize();
  }

  /**
   * 단일 variant 테스트
   */
  async testSingleVariant(variantId: string, topic: string): Promise<void> {
    console.log(`🧪 Testing variant: ${variantId} with topic: "${topic}"`);

    const request: QARequest = {
      topic,
      complexity: 7,
      domainContext: 'general',
      qualityTarget: 8
    };

    try {
      const startTime = Date.now();
      const { response, metrics } = await this.abTestManager.processRequestWithVariant(
        variantId,
        request
      );
      const duration = Date.now() - startTime;

      console.log(`\n✅ Variant ${variantId} Results:`);
      console.log(`   📊 Quality Score: ${metrics.qualityScore.toFixed(2)}/10`);
      console.log(`   🎯 Confidence: ${metrics.averageConfidence.toFixed(2)}`);
      console.log(`   🌈 Diversity: ${metrics.diversityScore.toFixed(2)}/10`);
      console.log(`   🧠 Agent Collaboration: ${metrics.agentCollaborationScore.toFixed(2)}/10`);
      console.log(`   ⏱️  Processing Time: ${duration}ms`);
      console.log(`   🤖 Agents Used: ${response.metadata?.agentsUsed?.join(', ') || 'unknown'}`);
      console.log(`   📝 Questions Generated: ${response.questions?.length || 0}`);

      if (response.questions && response.questions.length > 0) {
        console.log(`\n📋 Sample Question:`);
        const sample = response.questions[0];
        console.log(`   Q: ${sample.question}`);
        console.log(`   A: ${sample.answer.substring(0, 100)}...`);
        console.log(`   Confidence: ${sample.confidence?.toFixed(2) || 'N/A'}`);
      }

    } catch (error) {
      console.error(`❌ Variant ${variantId} failed:`, error);
    }
  }

  /**
   * 여러 variant 비교 테스트
   */
  async compareVariants(variants: string[], topic: string): Promise<void> {
    console.log(`🔬 Comparing variants: ${variants.join(', ')} with topic: "${topic}"`);

    const request: QARequest = {
      topic,
      complexity: 7,
      domainContext: 'general',
      qualityTarget: 8
    };

    const results: { [variantId: string]: any } = {};

    for (const variantId of variants) {
      try {
        console.log(`\n🧪 Testing ${variantId}...`);
        const startTime = Date.now();
        const { response, metrics } = await this.abTestManager.processRequestWithVariant(
          variantId,
          request
        );
        const duration = Date.now() - startTime;

        results[variantId] = {
          metrics,
          duration,
          response,
          success: true
        };

        console.log(`   ✅ ${variantId}: Quality ${metrics.qualityScore.toFixed(1)}, Time ${duration}ms`);

      } catch (error) {
        results[variantId] = {
          error: String(error),
          success: false
        };
        console.log(`   ❌ ${variantId}: Failed - ${error}`);
      }
    }

    this.printComparisonTable(results);
  }

  /**
   * 자동화된 배치 테스트
   */
  async runBatchTest(configPath: string): Promise<void> {
    const config: TestConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    console.log(`🚀 Starting batch test: ${config.testId}`);
    console.log(`   📝 Description: ${config.description || 'No description'}`);
    console.log(`   🧪 Variants: ${config.variants.join(', ')}`);
    console.log(`   📊 Sample requests: ${config.sampleRequests.length}`);

    // Start the test
    await this.abTestManager.startTest(config.testId, config.variants);

    // Run automated test
    await this.abTestManager.runAutomatedTest(
      config.testId,
      config.sampleRequests,
      config.variants
    );

    // Analyze results
    const analysis = await this.abTestManager.analyzeTestResults(config.testId);

    console.log(`\n📊 Test Results Summary:`);
    console.log(`   🏆 Best Variant: ${analysis.summary.bestVariant}`);
    console.log(`   📈 Total Requests: ${analysis.summary.totalRequests}`);
    console.log(`   🎯 Recommendation: ${analysis.summary.recommendedAction}`);

    // Save results
    const resultsPath = `reports/ab_tests/${config.testId}_summary.json`;
    fs.writeFileSync(resultsPath, JSON.stringify(analysis, null, 2));
    console.log(`\n💾 Results saved to: ${resultsPath}`);
  }

  /**
   * 사용 가능한 variants 조회
   */
  listVariants(): void {
    const variants = this.abTestManager.getVariants();

    console.log('🧬 Available Test Variants:');
    console.log('=' .repeat(50));

    variants.forEach(variant => {
      console.log(`\n📦 ${variant.id} (${variant.enabled ? '✅ Enabled' : '❌ Disabled'})`);
      console.log(`   📝 ${variant.name}`);
      console.log(`   💡 ${variant.description}`);
    });
  }

  private printComparisonTable(results: { [variantId: string]: any }): void {
    console.log(`\n📊 Comparison Results:`);
    console.log('=' .repeat(80));

    const headers = ['Variant', 'Quality', 'Confidence', 'Diversity', 'Time (ms)', 'Status'];
    const widths = [12, 8, 10, 9, 10, 8];

    // Print header
    let headerRow = '';
    headers.forEach((header, i) => {
      headerRow += header.padEnd(widths[i]);
    });
    console.log(headerRow);
    console.log('-'.repeat(80));

    // Print data rows
    Object.entries(results).forEach(([variantId, result]) => {
      let row = '';
      row += variantId.padEnd(widths[0]);

      if (result.success) {
        row += result.metrics.qualityScore.toFixed(1).padEnd(widths[1]);
        row += result.metrics.averageConfidence.toFixed(2).padEnd(widths[2]);
        row += result.metrics.diversityScore.toFixed(1).padEnd(widths[3]);
        row += result.duration.toString().padEnd(widths[4]);
        row += '✅ OK'.padEnd(widths[5]);
      } else {
        row += 'N/A'.padEnd(widths[1]);
        row += 'N/A'.padEnd(widths[2]);
        row += 'N/A'.padEnd(widths[3]);
        row += 'N/A'.padEnd(widths[4]);
        row += '❌ FAIL'.padEnd(widths[5]);
      }

      console.log(row);
    });

    // Find best performer
    const successfulResults = Object.entries(results).filter(([_, result]) => result.success);
    if (successfulResults.length > 0) {
      const best = successfulResults.reduce((prev, curr) =>
        curr[1].metrics.qualityScore > prev[1].metrics.qualityScore ? curr : prev
      );
      console.log(`\n🏆 Best Performer: ${best[0]} (Quality: ${best[1].metrics.qualityScore.toFixed(2)})`);
    }
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const cli = new ABTestCLI();
  await cli.initialize();

  try {
    switch (command) {
      case 'list':
        cli.listVariants();
        break;

      case 'test':
        if (args.length < 3) {
          console.error('Usage: test <variant> <topic>');
          process.exit(1);
        }
        await cli.testSingleVariant(args[1], args[2]);
        break;

      case 'compare': {
        if (args.length < 3) {
          console.error('Usage: compare <variant1,variant2,...> <topic>');
          process.exit(1);
        }
        const variants = args[1].split(',');
        await cli.compareVariants(variants, args[2]);
        break;
      }

      case 'batch':
        if (args.length < 2) {
          console.error('Usage: batch <config.json>');
          process.exit(1);
        }
        await cli.runBatchTest(args[1]);
        break;

      default:
        console.log('🧪 A/B Test CLI for QA Generation System');
        console.log('');
        console.log('Commands:');
        console.log('  list                     - List available variants');
        console.log('  test <variant> <topic>   - Test single variant');
        console.log('  compare <variants> <topic> - Compare multiple variants');
        console.log('  batch <config.json>      - Run batch test from config');
        console.log('');
        console.log('Examples:');
        console.log('  npm run ab-test list');
        console.log('  npm run ab-test test balanced "TypeScript tutorial"');
        console.log('  npm run ab-test compare conservative,balanced,comprehensive "AI ethics"');
        console.log('  npm run ab-test batch test-configs/quality-comparison.json');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}