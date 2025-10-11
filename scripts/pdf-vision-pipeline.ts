#!/usr/bin/env tsx
/**
 * PDF Vision Pipeline (Phase 3 Week 2)
 *
 * Complete pipeline for Vision-Guided PDF analysis:
 * 1. PDF → Images (300 DPI)
 * 2. Vision Analysis (Gemini API)
 * 3. Structured Output (reports/pdf-vision/output.json)
 *
 * Features:
 * - Checkpoint system (resume on session disconnect)
 * - Progress tracking
 * - Error recovery
 * - Cost tracking
 *
 * Usage:
 *   npx tsx scripts/pdf-vision-pipeline.ts \
 *     --in datasets/qa-guideline-test/documents/2024년_아이돌봄지원사업_안내.pdf \
 *     --out reports/pdf-vision/output.json \
 *     --pages 1-5
 *
 * Resume from checkpoint:
 *   npx tsx scripts/pdf-vision-pipeline.ts --resume
 *
 * @see docs/INNOVATION/2025-10-vision-guided-hybrid.md
 */

import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { PDFImageConverter } from '../src/infrastructure/vision/pdf-image-converter';
import { GeminiVisionClient, type VisionAnalysisResult } from '../src/infrastructure/vision/gemini-vision-client';

// Load environment variables
dotenv.config();

/**
 * Pipeline Configuration
 */
interface PipelineConfig {
  inputPDF: string;
  outputPath: string;
  pageRange?: { start: number; end: number };
  checkpointPath: string;
  imageOutputDir: string;
  cleanupImages: boolean;
}

/**
 * Checkpoint Data (for session resume)
 */
interface Checkpoint {
  config: PipelineConfig;
  timestamp: string;
  progress: {
    stage: 'images' | 'vision' | 'completed';
    totalPages: number;
    convertedImages: number;
    analyzedPages: number;
    failedPages: number[];
  };
  results: {
    images: any[];
    visionAnalysis: VisionAnalysisResult[];
  };
}

/**
 * Final Output
 */
interface PipelineOutput {
  timestamp: string;
  inputPDF: string;
  totalPages: number;
  processedPages: number;
  failedPages: number[];
  duration: number;
  cost: {
    totalImages: number;
    estimatedCost: number;
  };
  visionAnalysis: VisionAnalysisResult[];
  summary: {
    totalSections: number;
    totalTables: number;
    totalLists: number;
    totalParagraphs: number;
    totalFigures: number;
  };
}

/**
 * Parse command line arguments
 */
function parseArgs(): { resume: boolean; input?: string; output?: string; pages?: string } {
  const args = process.argv.slice(2);
  const parsed: any = { resume: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--resume') {
      parsed.resume = true;
    } else if (args[i] === '--in' && args[i + 1]) {
      parsed.input = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--out' && args[i + 1]) {
      parsed.output = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--pages' && args[i + 1]) {
      parsed.pages = args[i + 1];
      i++;
    }
  }

  return parsed;
}

/**
 * Parse page range (e.g., "1-5" → {start: 1, end: 5})
 */
function parsePageRange(rangeStr: string): { start: number; end: number } | undefined {
  const match = rangeStr.match(/^(\d+)-(\d+)$/);
  if (match) {
    return {
      start: parseInt(match[1], 10),
      end: parseInt(match[2], 10),
    };
  }
  return undefined;
}

/**
 * Save checkpoint
 */
function saveCheckpoint(checkpoint: Checkpoint): void {
  const dir = path.dirname(checkpoint.config.checkpointPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(checkpoint.config.checkpointPath, JSON.stringify(checkpoint, null, 2));
  console.log(`📌 Checkpoint saved: ${checkpoint.config.checkpointPath}`);
}

/**
 * Load checkpoint
 */
function loadCheckpoint(checkpointPath: string): Checkpoint | null {
  if (fs.existsSync(checkpointPath)) {
    const data = fs.readFileSync(checkpointPath, 'utf-8');
    return JSON.parse(data);
  }
  return null;
}

/**
 * Main Pipeline
 */
async function runPipeline(config: PipelineConfig, checkpoint?: Checkpoint): Promise<PipelineOutput> {
  const startTime = performance.now();

  console.log('🚀 PDF Vision Pipeline (Phase 3 Week 2)\n');
  console.log('═'.repeat(60));
  console.log(`\n📂 Input PDF: ${config.inputPDF}`);
  console.log(`📄 Output: ${config.outputPath}`);
  console.log(`📁 Image Dir: ${config.imageOutputDir}\n`);

  // Initialize or resume
  let currentCheckpoint: Checkpoint = checkpoint || {
    config,
    timestamp: new Date().toISOString(),
    progress: {
      stage: 'images',
      totalPages: 0,
      convertedImages: 0,
      analyzedPages: 0,
      failedPages: [],
    },
    results: {
      images: [],
      visionAnalysis: [],
    },
  };

  if (checkpoint) {
    console.log(`📌 Resuming from checkpoint (Stage: ${checkpoint.progress.stage})\n`);
  }

  // Stage 1: PDF → Images
  if (currentCheckpoint.progress.stage === 'images') {
    console.log('📦 Stage 1: PDF → Images (300 DPI)\n');

    const imageConverter = new PDFImageConverter({
      outputDir: config.imageOutputDir,
      dpi: 300,
      format: 'png',
      pageRange: config.pageRange,
    });

    const conversionResult = await imageConverter.convert(config.inputPDF, (progress) => {
      console.log(`   Converting: ${progress.currentPage}/${progress.totalPages} pages...`);
    });

    if (!conversionResult.success) {
      throw new Error(`Image conversion failed: ${conversionResult.error}`);
    }

    console.log(`\n   ✅ Converted ${conversionResult.convertedPages}/${conversionResult.totalPages} pages`);
    console.log(`   ⚠️  Failed pages: ${conversionResult.failedPages.length}\n`);

    currentCheckpoint.progress.totalPages = conversionResult.totalPages;
    currentCheckpoint.progress.convertedImages = conversionResult.convertedPages;
    currentCheckpoint.progress.failedPages = conversionResult.failedPages;
    currentCheckpoint.results.images = conversionResult.images;
    currentCheckpoint.progress.stage = 'vision';

    saveCheckpoint(currentCheckpoint);
  }

  // Stage 2: Vision Analysis
  if (currentCheckpoint.progress.stage === 'vision') {
    console.log('🔍 Stage 2: Vision Analysis (Gemini API)\n');

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY not set in environment');
    }

    const visionClient = new GeminiVisionClient({ apiKey });

    const images = currentCheckpoint.results.images;
    const startIndex = currentCheckpoint.progress.analyzedPages;

    for (let i = startIndex; i < images.length; i++) {
      const image = images[i];
      console.log(`   Analyzing page ${image.pageNumber}/${images.length}...`);

      try {
        const analysis = await visionClient.analyzePage(image.imagePath, image.pageNumber);
        currentCheckpoint.results.visionAnalysis.push(analysis);
        currentCheckpoint.progress.analyzedPages++;

        // Save checkpoint every 5 pages
        if ((i + 1) % 5 === 0) {
          saveCheckpoint(currentCheckpoint);
        }
      } catch (error) {
        console.error(`   ✗ Failed to analyze page ${image.pageNumber}:`, error);
        currentCheckpoint.progress.failedPages.push(image.pageNumber);
      }
    }

    const costTracker = visionClient.getCostTracker();
    console.log(`\n   ✅ Analyzed ${currentCheckpoint.progress.analyzedPages}/${images.length} pages`);
    console.log(`   💰 Estimated Cost: $${costTracker.estimatedCost.toFixed(4)}\n`);

    currentCheckpoint.progress.stage = 'completed';
    saveCheckpoint(currentCheckpoint);
  }

  // Stage 3: Generate Output
  console.log('📝 Stage 3: Generate Output\n');

  const duration = performance.now() - startTime;
  const visionAnalysis = currentCheckpoint.results.visionAnalysis;

  // Calculate summary
  const summary = {
    totalSections: visionAnalysis.reduce((sum, page) => sum + page.sections.length, 0),
    totalTables: visionAnalysis.reduce((sum, page) => sum + page.tables.length, 0),
    totalLists: visionAnalysis.reduce((sum, page) => sum + page.lists.length, 0),
    totalParagraphs: visionAnalysis.reduce((sum, page) => sum + page.paragraphs.length, 0),
    totalFigures: visionAnalysis.reduce((sum, page) => sum + page.figures.length, 0),
  };

  const output: PipelineOutput = {
    timestamp: new Date().toISOString(),
    inputPDF: config.inputPDF,
    totalPages: currentCheckpoint.progress.totalPages,
    processedPages: currentCheckpoint.progress.analyzedPages,
    failedPages: currentCheckpoint.progress.failedPages,
    duration,
    cost: {
      totalImages: currentCheckpoint.progress.analyzedPages,
      estimatedCost: currentCheckpoint.progress.analyzedPages * 0.0025,
    },
    visionAnalysis,
    summary,
  };

  // Save output
  const outputDir = path.dirname(config.outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(config.outputPath, JSON.stringify(output, null, 2));

  console.log(`   ✅ Output saved: ${config.outputPath}\n`);

  // Cleanup images if requested
  if (config.cleanupImages) {
    console.log('🧹 Cleaning up images...\n');
    fs.rmSync(config.imageOutputDir, { recursive: true, force: true });
  }

  // Delete checkpoint
  if (fs.existsSync(config.checkpointPath)) {
    fs.unlinkSync(config.checkpointPath);
    console.log('📌 Checkpoint deleted (pipeline completed)\n');
  }

  return output;
}

/**
 * Main
 */
async function main() {
  const args = parseArgs();

  // Resume mode
  if (args.resume) {
    const checkpointPath = path.join(process.cwd(), 'reports/pdf-vision/.checkpoint.json');
    const checkpoint = loadCheckpoint(checkpointPath);

    if (!checkpoint) {
      console.error('❌ No checkpoint found. Run with --in and --out to start a new pipeline.');
      process.exit(1);
    }

    const output = await runPipeline(checkpoint.config, checkpoint);
    printSummary(output);
    return;
  }

  // New pipeline
  if (!args.input || !args.output) {
    console.error('Usage: npx tsx scripts/pdf-vision-pipeline.ts --in <pdf> --out <output> [--pages 1-5]');
    console.error('       npx tsx scripts/pdf-vision-pipeline.ts --resume');
    process.exit(1);
  }

  const config: PipelineConfig = {
    inputPDF: args.input,
    outputPath: args.output,
    pageRange: args.pages ? parsePageRange(args.pages) : undefined,
    checkpointPath: path.join(path.dirname(args.output), '.checkpoint.json'),
    imageOutputDir: path.join(path.dirname(args.output), 'images'),
    cleanupImages: false, // Keep images for debugging
  };

  const output = await runPipeline(config);
  printSummary(output);
}

/**
 * Print summary
 */
function printSummary(output: PipelineOutput): void {
  console.log('═'.repeat(60));
  console.log('📊 PIPELINE SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Total Pages: ${output.totalPages}`);
  console.log(`   Processed: ${output.processedPages}`);
  console.log(`   Failed: ${output.failedPages.length}`);
  console.log(`   Duration: ${(output.duration / 1000).toFixed(2)}s`);
  console.log(`   Estimated Cost: $${output.cost.estimatedCost.toFixed(4)}`);
  console.log('');
  console.log('📊 STRUCTURE SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Sections: ${output.summary.totalSections}`);
  console.log(`   Tables: ${output.summary.totalTables}`);
  console.log(`   Lists: ${output.summary.totalLists}`);
  console.log(`   Paragraphs: ${output.summary.totalParagraphs}`);
  console.log(`   Figures: ${output.summary.totalFigures}`);
  console.log('═'.repeat(60) + '\n');

  if (output.processedPages >= output.totalPages) {
    console.log('✅ Pipeline completed successfully!\n');
  } else {
    console.log('⚠️  Pipeline incomplete - use --resume to continue\n');
  }
}

// Run
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Pipeline failed:', error);
    process.exit(1);
  });
}
