/**
 * Vision-Guided Chunker Types
 *
 * Phase 3 Week 3: Structure-Preserving Chunking using Vision Analysis
 *
 * Purpose:
 * - Use Vision API results to guide chunk boundaries
 * - Preserve section integrity
 * - Maintain table structure
 * - Respect visual layout
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md
 */

import type { VisionAnalysisResult } from '../../../infrastructure/vision/gemini-vision-client';

/**
 * Vision-Guided Chunk
 */
export interface VisionGuidedChunk {
  id: string;
  content: string;
  type: 'section' | 'table' | 'list' | 'paragraph' | 'figure';
  metadata: {
    page: number;
    sectionTitle?: string;
    sectionLevel?: number; // 1, 2, 3...
    tableInfo?: {
      caption?: string;
      rows: number;
      cols: number;
    };
    listInfo?: {
      type: 'bullet' | 'numbered';
      items: number;
    };
    bbox?: [number, number, number, number]; // x, y, w, h
    startChar: number;
    endChar: number;
  };
}

/**
 * Chunking Strategy
 */
export interface ChunkingStrategy {
  mode: 'section-based' | 'table-based' | 'hybrid';
  maxChunkSize: number; // Max chars per chunk
  minChunkSize: number; // Min chars per chunk
  preserveTable: boolean; // Never split tables across chunks
  preserveSection: boolean; // Try to keep sections together
  overlapSize: number; // Overlap between chunks (chars)
}

/**
 * Chunking Result
 */
export interface ChunkingResult {
  chunks: VisionGuidedChunk[];
  stats: {
    totalChunks: number;
    avgChunkSize: number;
    sectionChunks: number;
    tableChunks: number;
    listChunks: number;
    paragraphChunks: number;
    figureChunks: number;
    preservationRate: number; // % of structures kept intact
  };
}

/**
 * Vision-Guided Chunker Interface
 */
export interface VisionGuidedChunker {
  chunk(
    visionResults: VisionAnalysisResult[],
    strategy: ChunkingStrategy
  ): Promise<ChunkingResult>;
}
