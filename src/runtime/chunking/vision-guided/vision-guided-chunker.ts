/**
 * Vision-Guided Chunker
 *
 * Phase 3 Week 3: Structure-Preserving Chunking using Vision Analysis
 *
 * Purpose:
 * - Use Vision API results to guide chunk boundaries
 * - Preserve section integrity (never split mid-section)
 * - Maintain table structure (tables as standalone chunks)
 * - Respect visual layout and hierarchy
 *
 * Strategy:
 * - Hybrid mode (default): Sections + Tables + Overlap
 * - Section-based: Align chunks to section boundaries
 * - Table-based: Extract tables as standalone chunks
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 3)
 */

import type {
  VisionGuidedChunk,
  ChunkingStrategy,
  ChunkingResult,
  VisionGuidedChunker as IVisionGuidedChunker,
} from './types';
import type { VisionAnalysisResult } from '../../../infrastructure/vision/gemini-vision-client';

/**
 * Default Chunking Strategy
 */
const DEFAULT_STRATEGY: ChunkingStrategy = {
  mode: 'hybrid',
  maxChunkSize: 2500,
  minChunkSize: 500,
  preserveTable: true,
  preserveSection: true,
  overlapSize: 100,
};

/**
 * Vision-Guided Chunker Implementation
 */
export class VisionGuidedChunker implements IVisionGuidedChunker {
  /**
   * Main chunking method
   */
  async chunk(
    visionResults: VisionAnalysisResult[],
    strategy?: Partial<ChunkingStrategy>
  ): Promise<ChunkingResult> {
    const config: ChunkingStrategy = {
      ...DEFAULT_STRATEGY,
      ...strategy,
    };

    const chunks: VisionGuidedChunk[] = [];

    switch (config.mode) {
      case 'section-based':
        return this.chunkBySections(visionResults, config);

      case 'table-based':
        return this.chunkByTables(visionResults, config);

      case 'hybrid':
      default:
        return this.chunkHybrid(visionResults, config);
    }
  }

  /**
   * Hybrid Strategy: Sections + Tables + Paragraphs
   */
  private async chunkHybrid(
    visionResults: VisionAnalysisResult[],
    config: ChunkingStrategy
  ): Promise<ChunkingResult> {
    const chunks: VisionGuidedChunk[] = [];
    let preservedStructures = 0;
    let totalStructures = 0;

    for (const page of visionResults) {
      // 1. Extract tables as standalone chunks
      if (config.preserveTable && page.tables.length > 0) {
        for (const table of page.tables) {
          totalStructures++;

          const tableChunk: VisionGuidedChunk = {
            id: `table-${page.pageNumber}-${chunks.length}`,
            content: this.formatTable(table),
            type: 'table',
            metadata: {
              page: page.pageNumber,
              tableInfo: {
                caption: table.caption,
                rows: table.rows,
                cols: table.cols,
              },
              bbox: table.bbox,
              startChar: 0,
              endChar: 0,
            },
          };

          chunks.push(tableChunk);
          preservedStructures++; // Tables are always preserved
        }
      }

      // 2. Group sections with their paragraphs
      if (config.preserveSection && page.sections.length > 0) {
        for (const section of page.sections) {
          totalStructures++;

          // Find paragraphs belonging to this section
          const sectionParagraphs = page.paragraphs.filter(
            p => p.sectionId === section.title || !p.sectionId
          );

          const sectionContent = this.formatSection(section, sectionParagraphs);

          // Check if section fits in one chunk
          if (sectionContent.length <= config.maxChunkSize) {
            const sectionChunk: VisionGuidedChunk = {
              id: `section-${page.pageNumber}-${chunks.length}`,
              content: sectionContent,
              type: 'section',
              metadata: {
                page: page.pageNumber,
                sectionTitle: section.title,
                sectionLevel: section.level,
                startChar: 0,
                endChar: sectionContent.length,
              },
            };

            chunks.push(sectionChunk);
            preservedStructures++; // Section kept intact
          } else {
            // Split large section by paragraphs (preserve as much as possible)
            const splitChunks = this.splitSection(
              section,
              sectionParagraphs,
              page.pageNumber,
              config
            );
            chunks.push(...splitChunks);

            // Count partial preservation
            if (splitChunks.length === 1) {
              preservedStructures++;
            }
          }
        }
      } else {
        // 3. Handle pages without sections (fallback to paragraphs)
        for (const paragraph of page.paragraphs) {
          if (paragraph.text.trim().length < config.minChunkSize) {
            continue; // Skip very short paragraphs
          }

          const paragraphChunk: VisionGuidedChunk = {
            id: `paragraph-${page.pageNumber}-${chunks.length}`,
            content: paragraph.text,
            type: 'paragraph',
            metadata: {
              page: page.pageNumber,
              bbox: paragraph.bbox,
              startChar: 0,
              endChar: paragraph.text.length,
            },
          };

          chunks.push(paragraphChunk);
        }
      }

      // 4. Handle lists
      for (const list of page.lists) {
        totalStructures++;

        const listContent = this.formatList(list);

        const listChunk: VisionGuidedChunk = {
          id: `list-${page.pageNumber}-${chunks.length}`,
          content: listContent,
          type: 'list',
          metadata: {
            page: page.pageNumber,
            listInfo: {
              type: list.type,
              items: list.items.length,
            },
            startChar: 0,
            endChar: listContent.length,
          },
        };

        chunks.push(listChunk);
        preservedStructures++; // Lists are always preserved
      }

      // 5. Handle figures
      for (const figure of page.figures) {
        const figureContent = this.formatFigure(figure);

        const figureChunk: VisionGuidedChunk = {
          id: `figure-${page.pageNumber}-${chunks.length}`,
          content: figureContent,
          type: 'figure',
          metadata: {
            page: page.pageNumber,
            bbox: figure.bbox,
            startChar: 0,
            endChar: figureContent.length,
          },
        };

        chunks.push(figureChunk);
      }
    }

    // Calculate stats
    const stats = this.calculateStats(chunks, totalStructures, preservedStructures);

    return {
      chunks,
      stats,
    };
  }

  /**
   * Section-Based Strategy
   */
  private async chunkBySections(
    visionResults: VisionAnalysisResult[],
    config: ChunkingStrategy
  ): Promise<ChunkingResult> {
    const chunks: VisionGuidedChunk[] = [];
    let preservedStructures = 0;
    let totalStructures = 0;

    for (const page of visionResults) {
      for (const section of page.sections) {
        totalStructures++;

        const sectionParagraphs = page.paragraphs.filter(
          p => p.sectionId === section.title
        );

        const sectionContent = this.formatSection(section, sectionParagraphs);

        const sectionChunk: VisionGuidedChunk = {
          id: `section-${page.pageNumber}-${chunks.length}`,
          content: sectionContent,
          type: 'section',
          metadata: {
            page: page.pageNumber,
            sectionTitle: section.title,
            sectionLevel: section.level,
            startChar: 0,
            endChar: sectionContent.length,
          },
        };

        chunks.push(sectionChunk);
        preservedStructures++;
      }
    }

    const stats = this.calculateStats(chunks, totalStructures, preservedStructures);

    return {
      chunks,
      stats,
    };
  }

  /**
   * Table-Based Strategy
   */
  private async chunkByTables(
    visionResults: VisionAnalysisResult[],
    config: ChunkingStrategy
  ): Promise<ChunkingResult> {
    const chunks: VisionGuidedChunk[] = [];
    let preservedStructures = 0;
    let totalStructures = 0;

    for (const page of visionResults) {
      for (const table of page.tables) {
        totalStructures++;

        const tableChunk: VisionGuidedChunk = {
          id: `table-${page.pageNumber}-${chunks.length}`,
          content: this.formatTable(table),
          type: 'table',
          metadata: {
            page: page.pageNumber,
            tableInfo: {
              caption: table.caption,
              rows: table.rows,
              cols: table.cols,
            },
            bbox: table.bbox,
            startChar: 0,
            endChar: 0,
          },
        };

        chunks.push(tableChunk);
        preservedStructures++;
      }
    }

    const stats = this.calculateStats(chunks, totalStructures, preservedStructures);

    return {
      chunks,
      stats,
    };
  }

  // Helper methods

  private formatTable(table: VisionAnalysisResult['tables'][0]): string {
    let content = '';

    if (table.caption) {
      content += `**${table.caption}**\n\n`;
    }

    // Phase 6: Use table.data (from Vision Analysis) instead of table.cells
    const tableData = (table as any).data || (table as any).cells;

    if (tableData && tableData.length > 0) {
      // Format as markdown table
      content += '\n';
      for (const row of tableData) {
        content += `| ${row.join(' | ')} |\n`;
      }
      content += '\n';
    } else {
      // Fallback: Show dimensions only
      content += `Table (${table.rows} rows × ${table.cols} cols)\n`;
    }

    return content.trim();
  }

  private formatSection(
    section: VisionAnalysisResult['sections'][0],
    paragraphs: VisionAnalysisResult['paragraphs']
  ): string {
    let content = `${'#'.repeat(section.level)} ${section.title}\n\n`;

    if (section.text) {
      content += `${section.text}\n\n`;
    }

    for (const paragraph of paragraphs) {
      content += `${paragraph.text}\n\n`;
    }

    return content.trim();
  }

  private formatList(list: VisionAnalysisResult['lists'][0]): string {
    let content = '';

    for (let i = 0; i < list.items.length; i++) {
      if (list.type === 'numbered') {
        content += `${i + 1}. ${list.items[i]}\n`;
      } else {
        content += `- ${list.items[i]}\n`;
      }
    }

    return content.trim();
  }

  private formatFigure(figure: VisionAnalysisResult['figures'][0]): string {
    let content = '';

    if (figure.caption) {
      content += `**Figure**: ${figure.caption}\n\n`;
    }

    content += `Description: ${figure.description}`;

    return content.trim();
  }

  private splitSection(
    section: VisionAnalysisResult['sections'][0],
    paragraphs: VisionAnalysisResult['paragraphs'],
    pageNumber: number,
    config: ChunkingStrategy
  ): VisionGuidedChunk[] {
    const chunks: VisionGuidedChunk[] = [];
    let currentContent = `${'#'.repeat(section.level)} ${section.title}\n\n`;

    for (const paragraph of paragraphs) {
      if (currentContent.length + paragraph.text.length > config.maxChunkSize) {
        // Save current chunk
        chunks.push({
          id: `section-split-${pageNumber}-${chunks.length}`,
          content: currentContent.trim(),
          type: 'section',
          metadata: {
            page: pageNumber,
            sectionTitle: section.title,
            sectionLevel: section.level,
            startChar: 0,
            endChar: currentContent.length,
          },
        });

        // Start new chunk
        currentContent = `${'#'.repeat(section.level)} ${section.title} (continued)\n\n`;
      }

      currentContent += `${paragraph.text}\n\n`;
    }

    // Add final chunk
    if (currentContent.trim().length > 0) {
      chunks.push({
        id: `section-split-${pageNumber}-${chunks.length}`,
        content: currentContent.trim(),
        type: 'section',
        metadata: {
          page: pageNumber,
          sectionTitle: section.title,
          sectionLevel: section.level,
          startChar: 0,
          endChar: currentContent.length,
        },
      });
    }

    return chunks;
  }

  private calculateStats(
    chunks: VisionGuidedChunk[],
    totalStructures: number,
    preservedStructures: number
  ) {
    const sectionChunks = chunks.filter(c => c.type === 'section').length;
    const tableChunks = chunks.filter(c => c.type === 'table').length;
    const listChunks = chunks.filter(c => c.type === 'list').length;
    const paragraphChunks = chunks.filter(c => c.type === 'paragraph').length;
    const figureChunks = chunks.filter(c => c.type === 'figure').length;

    const totalChunkSize = chunks.reduce((sum, c) => sum + c.content.length, 0);
    const avgChunkSize = chunks.length > 0 ? totalChunkSize / chunks.length : 0;

    const preservationRate = totalStructures > 0
      ? (preservedStructures / totalStructures) * 100
      : 100;

    return {
      totalChunks: chunks.length,
      avgChunkSize,
      sectionChunks,
      tableChunks,
      listChunks,
      paragraphChunks,
      figureChunks,
      preservationRate,
    };
  }
}

/**
 * Create Vision-Guided Chunker
 */
export function createVisionGuidedChunker(): VisionGuidedChunker {
  return new VisionGuidedChunker();
}
