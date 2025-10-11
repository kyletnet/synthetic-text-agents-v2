#!/usr/bin/env tsx
/**
 * PDF Structure Reporter (Baseline Builder)
 *
 * Purpose:
 * - Diagnose chunking quality
 * - Evaluate structural completeness
 * - Measure completeness, overlap, section alignment
 *
 * Metrics:
 * - chunk_completeness: % of text captured in chunks
 * - section_alignment: % of section boundaries aligned with chunk boundaries
 * - overlap_ratio: % of overlapping text between chunks
 * - missing_blocks: Pages/sections not properly chunked
 * - type_distribution: Distribution of chunk types
 * - average_chunk_size: Mean chunk size
 * - chunk_size_std: Standard deviation of chunk sizes
 *
 * Usage:
 *   npx tsx scripts/pdf-structure-report.ts \
 *     --in datasets/sample.pdf \
 *     --out reports/pdf-structure/report.json
 *
 * @see Phase 3 Option C
 */

import * as fs from 'fs';
import * as path from 'path';
import { PDFIngestor } from '../src/infrastructure/retrieval/pdf-ingestor';
import { EvidenceStore } from '../src/core/transparency/evidence-store';
import type { PDFChunk } from '../src/infrastructure/retrieval/pdf-ingestor';

/**
 * PDF Structure Report
 */
interface PDFStructureReport {
  timestamp: string;
  fileName: string;
  documentStats: {
    totalPages: number;
    totalChars: number;
    totalChunks: number;
  };
  chunkingQuality: {
    chunk_completeness: number; // 0-100
    overlap_ratio: number; // 0-100
    section_alignment: number; // 0-100
    average_chunk_size: number;
    chunk_size_std: number;
    min_chunk_size: number;
    max_chunk_size: number;
  };
  typeDistribution: {
    paragraph: number;
    table: number;
    list: number;
    code: number;
    unknown: number;
  };
  structuralIssues: {
    oversized_chunks: number; // > maxChunkSize
    undersized_chunks: number; // < minChunkSize
    missing_sections: string[]; // Detected sections not in chunks
    orphaned_text: number; // Text not captured in chunks
  };
  sectionAnalysis: {
    detected_sections: number;
    sections_aligned: number;
    sections_split: number; // Sections split across multiple chunks
  };
  recommendations: string[];
}

/**
 * Parse command line arguments
 */
function parseArgs(): { input: string; output: string } {
  const args = process.argv.slice(2);
  let input = '';
  let output = path.join(process.cwd(), 'reports/pdf-structure/report.json');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--in' && args[i + 1]) {
      input = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--out' && args[i + 1]) {
      output = path.resolve(args[i + 1]);
      i++;
    }
  }

  if (!input) {
    console.error('Usage: npx tsx scripts/pdf-structure-report.ts --in <pdf-file> --out <output-file>');
    process.exit(1);
  }

  return { input, output };
}

/**
 * Calculate standard deviation
 */
function calculateStd(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Detect sections in text
 */
function detectSections(text: string): Array<{ title: string; start: number; end: number }> {
  const sections: Array<{ title: string; start: number; end: number }> = [];
  const lines = text.split('\n');

  let currentStart = 0;
  let currentTitle = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const charsSoFar = lines.slice(0, i).join('\n').length + 1;

    // Section header patterns
    const isHeader =
      line.length > 0 &&
      line.length < 100 &&
      (line === line.toUpperCase() || // All caps
        /^[\d\.\)]+\s+[가-힣A-Za-z]/.test(line) || // Numbered: "1. Title"
        /^제\d+[장조항]/.test(line)); // Korean: "제3장"

    if (isHeader) {
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          start: currentStart,
          end: charsSoFar,
        });
      }
      currentTitle = line;
      currentStart = charsSoFar;
    }
  }

  // Add final section
  if (currentTitle) {
    sections.push({
      title: currentTitle,
      start: currentStart,
      end: text.length,
    });
  }

  return sections;
}

/**
 * Calculate section alignment
 */
function calculateSectionAlignment(chunks: PDFChunk[], sections: Array<{ title: string; start: number; end: number }>): { aligned: number; split: number } {
  let aligned = 0;
  let split = 0;

  for (const section of sections) {
    // Find chunks that overlap with this section
    const overlappingChunks = chunks.filter((chunk) => {
      const chunkStart = chunk.metadata.startChar;
      const chunkEnd = chunk.metadata.endChar;
      return chunkStart < section.end && chunkEnd > section.start;
    });

    if (overlappingChunks.length === 1) {
      // Section perfectly aligned with one chunk
      const chunk = overlappingChunks[0];
      if (
        chunk.sectionTitle &&
        section.title.toLowerCase().includes(chunk.sectionTitle.toLowerCase())
      ) {
        aligned++;
      }
    } else if (overlappingChunks.length > 1) {
      // Section split across multiple chunks
      split++;
    }
  }

  return { aligned, split };
}

/**
 * Calculate overlap between consecutive chunks
 */
function calculateOverlap(chunks: PDFChunk[]): number {
  if (chunks.length < 2) return 0;

  let totalOverlap = 0;
  let totalChars = 0;

  for (let i = 0; i < chunks.length - 1; i++) {
    const current = chunks[i];
    const next = chunks[i + 1];

    // Find overlapping text
    const currentEnd = current.text.slice(-100); // Last 100 chars
    const nextStart = next.text.slice(0, 100); // First 100 chars

    let overlapLength = 0;
    for (let len = Math.min(currentEnd.length, nextStart.length); len > 0; len--) {
      if (currentEnd.slice(-len) === nextStart.slice(0, len)) {
        overlapLength = len;
        break;
      }
    }

    totalOverlap += overlapLength;
    totalChars += current.text.length;
  }

  totalChars += chunks[chunks.length - 1].text.length;

  return (totalOverlap / totalChars) * 100;
}

/**
 * Generate report
 */
async function generateReport(pdfPath: string): Promise<PDFStructureReport> {
  console.log('📊 PDF Structure Analysis\n');
  console.log('═'.repeat(60));

  // Step 1: Ingest PDF
  console.log('\n📦 Step 1: Ingest PDF\n');

  const evidenceStore = new EvidenceStore();
  const pdfIngestor = new PDFIngestor(evidenceStore);
  const result = await pdfIngestor.ingestPDF(pdfPath);

  if (!result.success) {
    throw new Error(`PDF ingestion failed: ${result.error}`);
  }

  console.log(`   ✅ Extracted ${result.totalPages} pages, ${result.extractedText.length} chars`);
  console.log(`   ✅ Created ${result.totalChunks} chunks\n`);

  // Step 2: Analyze chunks
  console.log('📊 Step 2: Analyze Chunk Quality\n');

  const chunks = result.chunks;
  const chunkSizes = chunks.map((c) => c.metadata.length);

  const avgChunkSize = chunkSizes.reduce((sum, size) => sum + size, 0) / chunkSizes.length;
  const chunkSizeStd = calculateStd(chunkSizes);
  const minChunkSize = Math.min(...chunkSizes);
  const maxChunkSize = Math.max(...chunkSizes);

  console.log(`   Average Chunk Size: ${avgChunkSize.toFixed(0)} chars`);
  console.log(`   Std Dev: ${chunkSizeStd.toFixed(0)} chars`);
  console.log(`   Min/Max: ${minChunkSize}/${maxChunkSize} chars\n`);

  // Step 3: Type distribution
  console.log('📊 Step 3: Type Distribution\n');

  const typeDistribution = {
    paragraph: 0,
    table: 0,
    list: 0,
    code: 0,
    unknown: 0,
  };

  for (const chunk of chunks) {
    typeDistribution[chunk.metadata.type]++;
  }

  Object.entries(typeDistribution).forEach(([type, count]) => {
    const percent = ((count / chunks.length) * 100).toFixed(1);
    console.log(`   ${type}: ${count} (${percent}%)`);
  });
  console.log('');

  // Step 4: Section analysis
  console.log('📊 Step 4: Section Analysis\n');

  const sections = detectSections(result.extractedText);
  console.log(`   Detected Sections: ${sections.length}`);

  const { aligned, split } = calculateSectionAlignment(chunks, sections);
  console.log(`   Sections Aligned: ${aligned}`);
  console.log(`   Sections Split: ${split}\n`);

  const sectionAlignment = sections.length > 0 ? (aligned / sections.length) * 100 : 0;

  // Step 5: Overlap analysis
  console.log('📊 Step 5: Overlap Analysis\n');

  const overlapRatio = calculateOverlap(chunks);
  console.log(`   Overlap Ratio: ${overlapRatio.toFixed(2)}%\n`);

  // Step 6: Completeness
  console.log('📊 Step 6: Completeness Check\n');

  const totalChunkedText = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);
  const completeness = (totalChunkedText / result.extractedText.length) * 100;
  console.log(`   Chunk Completeness: ${completeness.toFixed(2)}%\n`);

  // Step 7: Structural issues
  console.log('📊 Step 7: Detect Structural Issues\n');

  const oversized = chunks.filter((c) => c.metadata.length > 2000).length;
  const undersized = chunks.filter((c) => c.metadata.length < 100).length;
  const missingSections = sections
    .filter((s) => {
      return !chunks.some((c) => c.sectionTitle && s.title.includes(c.sectionTitle));
    })
    .map((s) => s.title);

  console.log(`   Oversized Chunks (>2000): ${oversized}`);
  console.log(`   Undersized Chunks (<100): ${undersized}`);
  console.log(`   Missing Sections: ${missingSections.length}\n`);

  // Step 8: Recommendations
  console.log('💡 Step 8: Generate Recommendations\n');

  const recommendations: string[] = [];

  if (completeness < 95) {
    recommendations.push('⚠️  Chunk completeness below 95% - text may be lost during chunking');
  }

  if (overlapRatio < 3 || overlapRatio > 10) {
    recommendations.push(`⚠️  Overlap ratio ${overlapRatio.toFixed(1)}% outside optimal range (3-10%)`);
  }

  if (sectionAlignment < 70) {
    recommendations.push(`⚠️  Section alignment ${sectionAlignment.toFixed(1)}% below 70% - consider structure-aware chunking`);
  }

  if (chunkSizeStd > avgChunkSize * 0.5) {
    recommendations.push('⚠️  High chunk size variance - consider more consistent chunking strategy');
  }

  if (split > sections.length * 0.3) {
    recommendations.push('⚠️  >30% of sections split across chunks - recommend Vision-Guided Chunking');
  }

  if (typeDistribution.table > 0 && typeDistribution.table / chunks.length > 0.1) {
    recommendations.push(`⚠️  ${typeDistribution.table} tables detected - recommend table-aware chunking`);
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ Chunking quality is good');
  }

  recommendations.forEach((rec) => console.log(`   ${rec}`));
  console.log('');

  // Build report
  const report: PDFStructureReport = {
    timestamp: new Date().toISOString(),
    fileName: path.basename(pdfPath),
    documentStats: {
      totalPages: result.totalPages,
      totalChars: result.extractedText.length,
      totalChunks: result.totalChunks,
    },
    chunkingQuality: {
      chunk_completeness: completeness,
      overlap_ratio: overlapRatio,
      section_alignment: sectionAlignment,
      average_chunk_size: avgChunkSize,
      chunk_size_std: chunkSizeStd,
      min_chunk_size: minChunkSize,
      max_chunk_size: maxChunkSize,
    },
    typeDistribution,
    structuralIssues: {
      oversized_chunks: oversized,
      undersized_chunks: undersized,
      missing_sections: missingSections,
      orphaned_text: result.extractedText.length - totalChunkedText,
    },
    sectionAnalysis: {
      detected_sections: sections.length,
      sections_aligned: aligned,
      sections_split: split,
    },
    recommendations,
  };

  return report;
}

/**
 * Main
 */
async function main() {
  const { input, output } = parseArgs();

  console.log(`📂 Input PDF: ${input}`);
  console.log(`📄 Output Report: ${output}\n`);

  // Generate report
  const report = await generateReport(input);

  // Save report
  const outputDir = path.dirname(output);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(output, JSON.stringify(report, null, 2));

  console.log('═'.repeat(60));
  console.log('📊 STRUCTURE ANALYSIS COMPLETE');
  console.log('═'.repeat(60));
  console.log(`   Completeness: ${report.chunkingQuality.chunk_completeness.toFixed(1)}%`);
  console.log(`   Section Alignment: ${report.chunkingQuality.section_alignment.toFixed(1)}%`);
  console.log(`   Overlap Ratio: ${report.chunkingQuality.overlap_ratio.toFixed(1)}%`);
  console.log(`   Avg Chunk Size: ${report.chunkingQuality.average_chunk_size.toFixed(0)} chars`);
  console.log('═'.repeat(60) + '\n');

  console.log(`✅ Report saved: ${output}\n`);
}

// Run
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Structure analysis failed:', error);
    process.exit(1);
  });
}
