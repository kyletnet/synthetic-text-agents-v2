/**
 * PDF Ingestor
 *
 * Extracts text from PDF documents and stores as evidence chunks.
 *
 * Features:
 * - PDF text extraction using pdf-parse
 * - Chunk normalization (paragraph/table/code detection)
 * - EvidenceStore integration
 * - Metadata preservation
 *
 * Exit KPI:
 * - Ingestion success ≥ 99%
 * - Chunk recall@10 ≥ 85%
 *
 * @see PHASE_2.7_COMPLETE_HANDOFF.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createRequire } from 'module';
import { EvidenceStore } from '../../core/transparency/evidence-store';
import type { EvidenceItem } from '../../core/transparency/evidence-types';

// Create require for CommonJS modules
const require = createRequire(import.meta.url);

/**
 * PDF Chunk with metadata
 */
export interface PDFChunk {
  id: string;
  docId: string;
  text: string;
  pageNumber: number;
  sectionTitle?: string;
  chunkIndex: number;
  hash: string;
  metadata: {
    startChar: number;
    endChar: number;
    length: number;
    type: 'paragraph' | 'table' | 'code' | 'list' | 'unknown';
  };
}

/**
 * PDF Ingestion Result
 */
export interface PDFIngestionResult {
  docId: string;
  fileName: string;
  totalPages: number;
  totalChunks: number;
  chunks: PDFChunk[];
  extractedText: string;
  success: boolean;
  error?: string;
  duration: number;
}

/**
 * PDF Ingestor Configuration
 */
export interface PDFIngestorConfig {
  chunkSize: number; // Target chunk size (characters)
  chunkOverlap: number; // Overlap between chunks
  minChunkSize: number; // Minimum chunk size
  maxChunkSize: number; // Maximum chunk size
}

const DEFAULT_CONFIG: PDFIngestorConfig = {
  chunkSize: 500,
  chunkOverlap: 50,
  minChunkSize: 100,
  maxChunkSize: 2000,
};

/**
 * PDF Ingestor
 *
 * Extracts text from PDF and creates normalized chunks.
 */
export class PDFIngestor {
  private config: PDFIngestorConfig;
  private evidenceStore: EvidenceStore;

  constructor(evidenceStore: EvidenceStore, config?: Partial<PDFIngestorConfig>) {
    this.evidenceStore = evidenceStore;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Ingest PDF file
   */
  async ingestPDF(pdfPath: string): Promise<PDFIngestionResult> {
    const startTime = performance.now();
    const fileName = path.basename(pdfPath);
    const docId = this.generateDocId(fileName);

    try {
      // 1. Read PDF file
      const dataBuffer = fs.readFileSync(pdfPath);

      // 2. Extract text using pdf-parse (CommonJS module)
      let extractedText: string;
      let totalPages: number;

      // Use require for CommonJS module (pdf-parse 1.x default export)
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
      totalPages = pdfData.numpages;

      console.log(`📄 Extracted ${extractedText.length} characters from ${totalPages} pages`);

      // 3. Create chunks
      const chunks = this.createChunks(extractedText, docId, totalPages);

      // 4. Store in EvidenceStore
      this.storeChunks(chunks, fileName);

      const duration = performance.now() - startTime;

      console.log(`✅ PDF ingestion complete: ${chunks.length} chunks in ${duration.toFixed(2)}ms`);

      return {
        docId,
        fileName,
        totalPages,
        totalChunks: chunks.length,
        chunks,
        extractedText,
        success: true,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`❌ PDF ingestion failed: ${errorMessage}`);

      return {
        docId,
        fileName,
        totalPages: 0,
        totalChunks: 0,
        chunks: [],
        extractedText: '',
        success: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Create chunks from extracted text
   */
  private createChunks(text: string, docId: string, totalPages: number): PDFChunk[] {
    const chunks: PDFChunk[] = [];

    // Split by double newlines (paragraphs)
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

    let currentChunkText = '';
    let currentStartChar = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();

      // If current chunk + new paragraph exceeds maxChunkSize, finalize current chunk
      if (currentChunkText.length + trimmed.length > this.config.maxChunkSize && currentChunkText.length > 0) {
        const chunk = this.finalizeChunk(
          currentChunkText,
          docId,
          chunkIndex,
          currentStartChar,
          totalPages
        );
        chunks.push(chunk);
        chunkIndex++;

        // Start new chunk with overlap
        const overlapText = this.extractOverlap(currentChunkText);
        currentChunkText = overlapText + trimmed;
        currentStartChar += currentChunkText.length - overlapText.length - trimmed.length;
      } else {
        currentChunkText += (currentChunkText.length > 0 ? '\n\n' : '') + trimmed;
      }

      // If current chunk exceeds target size, finalize
      if (currentChunkText.length >= this.config.chunkSize) {
        const chunk = this.finalizeChunk(
          currentChunkText,
          docId,
          chunkIndex,
          currentStartChar,
          totalPages
        );
        chunks.push(chunk);
        chunkIndex++;

        const overlapText = this.extractOverlap(currentChunkText);
        currentChunkText = overlapText;
        currentStartChar += currentChunkText.length - overlapText.length;
      }
    }

    // Finalize remaining text
    if (currentChunkText.length >= this.config.minChunkSize) {
      const chunk = this.finalizeChunk(
        currentChunkText,
        docId,
        chunkIndex,
        currentStartChar,
        totalPages
      );
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Finalize chunk with metadata
   */
  private finalizeChunk(
    text: string,
    docId: string,
    chunkIndex: number,
    startChar: number,
    totalPages: number
  ): PDFChunk {
    const trimmed = text.trim();
    const hash = crypto.createHash('sha256').update(trimmed).digest('hex').substring(0, 16);
    const id = `${docId}-chunk-${chunkIndex}-${hash}`;

    // Estimate page number (rough heuristic)
    const pageNumber = Math.min(Math.floor(chunkIndex / 3) + 1, totalPages);

    // Detect chunk type
    const type = this.detectChunkType(trimmed);

    // Extract section title (first line if it looks like a header)
    const sectionTitle = this.extractSectionTitle(trimmed);

    return {
      id,
      docId,
      text: trimmed,
      pageNumber,
      sectionTitle,
      chunkIndex,
      hash,
      metadata: {
        startChar,
        endChar: startChar + trimmed.length,
        length: trimmed.length,
        type,
      },
    };
  }

  /**
   * Extract overlap from end of chunk
   */
  private extractOverlap(text: string): string {
    if (text.length < this.config.chunkOverlap) {
      return text;
    }

    // Find last complete sentence within overlap window
    const overlapText = text.slice(-this.config.chunkOverlap);
    const lastPeriodIndex = overlapText.lastIndexOf('.');

    if (lastPeriodIndex > 0) {
      return overlapText.slice(lastPeriodIndex + 1).trim();
    }

    return overlapText;
  }

  /**
   * Detect chunk type based on content patterns
   */
  private detectChunkType(text: string): 'paragraph' | 'table' | 'code' | 'list' | 'unknown' {
    // List: Multiple lines starting with bullets or numbers
    if (/^[\d\-\*\•]\s/m.test(text) && text.split('\n').filter((line) => /^[\d\-\*\•]\s/.test(line)).length >= 2) {
      return 'list';
    }

    // Table: Multiple lines with consistent delimiters
    if (text.includes('|') && text.split('\n').filter((line) => line.includes('|')).length >= 3) {
      return 'table';
    }

    // Code: Indented lines or code-like syntax
    if (text.split('\n').filter((line) => /^\s{4,}/.test(line)).length >= 3) {
      return 'code';
    }

    // Paragraph: Default
    if (text.split('\n\n').length <= 2) {
      return 'paragraph';
    }

    return 'unknown';
  }

  /**
   * Extract section title from chunk
   */
  private extractSectionTitle(text: string): string | undefined {
    const lines = text.split('\n');
    const firstLine = lines[0].trim();

    // Header patterns:
    // - All caps
    // - Starts with number (e.g., "1. Introduction")
    // - Short line (<80 chars) followed by content
    if (
      firstLine.length > 0 &&
      firstLine.length < 80 &&
      (firstLine === firstLine.toUpperCase() ||
        /^[\d\.\)]+\s+/.test(firstLine) ||
        (lines.length > 1 && lines[1].trim().length === 0))
    ) {
      return firstLine;
    }

    return undefined;
  }

  /**
   * Store chunks in EvidenceStore
   */
  private storeChunks(chunks: PDFChunk[], fileName: string): void {
    for (const chunk of chunks) {
      const evidenceItem: EvidenceItem = {
        id: chunk.id,
        sourceId: chunk.docId,
        content: chunk.text,
        timestamp: new Date(),
        trustScore: 1.0, // PDF documents are trusted sources
        metadata: {
          domain: 'document',
          author: fileName,
          retrievalStrategy: 'hybrid' as const,
        },
      };

      this.evidenceStore.addEvidence(evidenceItem);
    }
  }

  /**
   * Generate document ID from filename
   */
  private generateDocId(fileName: string): string {
    const hash = crypto.createHash('sha256').update(fileName).digest('hex').substring(0, 12);
    const cleanName = fileName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9가-힣]/g, '-');
    return `${cleanName}-${hash}`;
  }

  /**
   * Get EvidenceStore instance
   */
  getEvidenceStore(): EvidenceStore {
    return this.evidenceStore;
  }

  /**
   * Query chunks by document ID
   */
  queryChunks(docId: string): EvidenceItem[] {
    return this.evidenceStore.queryEvidence({
      sourceIds: [docId],
    });
  }
}
