#!/usr/bin/env tsx
/**
 * PDF Ingestor Test
 *
 * Test PDF ingestion with real PDF document
 */

import * as path from 'path';
import { PDFIngestor } from '../src/infrastructure/retrieval/pdf-ingestor';
import { EvidenceStore } from '../src/core/transparency/evidence-store';

async function main() {
  console.log('🧪 PDF Ingestor Test\n');

  const pdfPath = path.join(
    process.cwd(),
    'datasets/qa-guideline-test/documents/2024년_아이돌봄지원사업_안내.pdf'
  );

  const evidenceStore = new EvidenceStore();
  const pdfIngestor = new PDFIngestor(evidenceStore);

  console.log(`📄 Processing: ${pdfPath}\n`);

  try {
    const result = await pdfIngestor.ingestPDF(pdfPath);

    console.log('\n✅ Ingestion Complete\n');
    console.log(`   Document ID: ${result.docId}`);
    console.log(`   File Name: ${result.fileName}`);
    console.log(`   Total Chunks: ${result.totalChunks}`);
    console.log(`   Total Pages: ${result.totalPages}`);
    console.log(`   Extracted Text: ${result.extractedText.length} chars`);
    console.log(`   Duration: ${result.duration}ms\n`);

    // Show first 3 chunks
    console.log('📦 Sample Chunks:\n');
    const chunks = result.chunks.slice(0, 3);
    chunks.forEach((chunk, idx) => {
      console.log(`Chunk ${idx + 1}:`);
      console.log(`  ID: ${chunk.id}`);
      console.log(`  Page: ${chunk.pageNumber}`);
      console.log(`  Length: ${chunk.text.length} chars`);
      console.log(`  Preview: ${chunk.text.slice(0, 100)}...`);
      console.log('');
    });

    console.log('✅ PDF Ingestor is working correctly!');
  } catch (error) {
    console.error('❌ PDF Ingestor failed:', error);
    process.exit(1);
  }
}

main();
