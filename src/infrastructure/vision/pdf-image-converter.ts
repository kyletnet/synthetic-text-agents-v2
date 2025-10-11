/**
 * PDF Image Converter
 *
 * Converts PDF pages to high-quality images for Vision analysis.
 *
 * Features:
 * - 300 DPI conversion (optimal quality vs file size)
 * - PNG/JPEG format support
 * - Batch processing with progress tracking
 * - Metadata preservation (page number, dimensions)
 * - Error handling and recovery
 *
 * Dependencies:
 * - pdf-poppler: PDF rendering
 * - sharp: Image processing
 *
 * @see docs/INNOVATION/2025-10-vision-guided-hybrid.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import sharp from 'sharp';

const execAsync = promisify(exec);

/**
 * PDF Image Configuration
 */
export interface PDFImageConfig {
  dpi: number; // Resolution (300 recommended)
  format: 'png' | 'jpeg'; // Output format
  quality: number; // JPEG quality (1-100, ignored for PNG)
  outputDir: string; // Output directory
  pageRange?: { start: number; end: number }; // Optional page range
}

/**
 * PDF Image Metadata
 */
export interface PDFImage {
  pageNumber: number;
  imagePath: string;
  width: number;
  height: number;
  dpi: number;
  format: string;
  fileSize: number; // bytes
}

/**
 * Conversion Progress
 */
export interface ConversionProgress {
  totalPages: number;
  currentPage: number;
  convertedPages: number;
  failedPages: number[];
  status: 'initializing' | 'converting' | 'completed' | 'failed';
  message: string;
}

/**
 * Conversion Result
 */
export interface ConversionResult {
  success: boolean;
  images: PDFImage[];
  totalPages: number;
  convertedPages: number;
  failedPages: number[];
  duration: number;
  error?: string;
}

const DEFAULT_CONFIG: Omit<PDFImageConfig, 'outputDir'> = {
  dpi: 300,
  format: 'png',
  quality: 90,
};

/**
 * PDF Image Converter
 *
 * Converts PDF pages to images using pdf-poppler.
 */
export class PDFImageConverter {
  private config: PDFImageConfig;

  constructor(config: Partial<PDFImageConfig> & { outputDir: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Convert PDF to images
   */
  async convert(
    pdfPath: string,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<ConversionResult> {
    const startTime = performance.now();

    try {
      // Validate PDF
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF not found: ${pdfPath}`);
      }

      // Get total pages
      const totalPages = await this.getTotalPages(pdfPath);

      const progress: ConversionProgress = {
        totalPages,
        currentPage: 0,
        convertedPages: 0,
        failedPages: [],
        status: 'initializing',
        message: 'Initializing conversion...',
      };

      onProgress?.(progress);

      // Create output directory
      if (!fs.existsSync(this.config.outputDir)) {
        fs.mkdirSync(this.config.outputDir, { recursive: true });
      }

      // Convert pages
      progress.status = 'converting';
      const images: PDFImage[] = [];

      const startPage = this.config.pageRange?.start || 1;
      const endPage = this.config.pageRange?.end || totalPages;

      for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
        progress.currentPage = pageNum;
        progress.message = `Converting page ${pageNum}/${endPage}...`;
        onProgress?.(progress);

        try {
          const image = await this.convertPage(pdfPath, pageNum, totalPages);
          images.push(image);
          progress.convertedPages++;
        } catch (error) {
          console.error(`Failed to convert page ${pageNum}:`, error);
          progress.failedPages.push(pageNum);
        }
      }

      // Complete
      progress.status = 'completed';
      progress.message = `Conversion complete: ${progress.convertedPages}/${totalPages} pages`;
      onProgress?.(progress);

      const duration = performance.now() - startTime;

      return {
        success: true,
        images,
        totalPages,
        convertedPages: progress.convertedPages,
        failedPages: progress.failedPages,
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        success: false,
        images: [],
        totalPages: 0,
        convertedPages: 0,
        failedPages: [],
        duration,
        error: errorMessage,
      };
    }
  }

  /**
   * Convert single page to image
   */
  private async convertPage(pdfPath: string, pageNumber: number, totalPages: number): Promise<PDFImage> {
    // Generate output filename
    const outputFileName = `page-${String(pageNumber).padStart(4, '0')}.${this.config.format}`;
    const outputPath = path.join(this.config.outputDir, outputFileName);

    // Use pdftoppm (from poppler-utils) for conversion
    // Note: pdftoppm is more reliable than pdf-poppler npm package
    const command = this.buildPdftoppmCommand(pdfPath, pageNumber, outputPath);

    try {
      await execAsync(command);

      // Process with sharp if needed (optimize size, adjust quality)
      const imageBuffer = fs.readFileSync(outputPath);
      const metadata = await sharp(imageBuffer).metadata();

      // Optimize image
      let processedBuffer = imageBuffer;
      if (this.config.format === 'jpeg') {
        processedBuffer = Buffer.from(
          await sharp(imageBuffer)
            .jpeg({ quality: this.config.quality })
            .toBuffer()
        );
      } else {
        processedBuffer = Buffer.from(
          await sharp(imageBuffer)
            .png({ compressionLevel: 9 })
            .toBuffer()
        );
      }

      // Write optimized image
      fs.writeFileSync(outputPath, processedBuffer);

      const stats = fs.statSync(outputPath);

      return {
        pageNumber,
        imagePath: outputPath,
        width: metadata.width || 0,
        height: metadata.height || 0,
        dpi: this.config.dpi,
        format: this.config.format,
        fileSize: stats.size,
      };
    } catch (error) {
      throw new Error(`Failed to convert page ${pageNumber}: ${error}`);
    }
  }

  /**
   * Build pdftoppm command
   */
  private buildPdftoppmCommand(pdfPath: string, pageNumber: number, outputPath: string): string {
    const outputBaseName = outputPath.replace(/\.(png|jpeg|jpg)$/, '');

    let command = `pdftoppm`;
    command += ` -${this.config.format}`; // Format
    command += ` -r ${this.config.dpi}`; // DPI
    command += ` -f ${pageNumber}`; // First page
    command += ` -l ${pageNumber}`; // Last page
    command += ` -singlefile`; // Single file output
    command += ` "${pdfPath}"`;
    command += ` "${outputBaseName}"`;

    return command;
  }

  /**
   * Get total pages in PDF
   */
  private async getTotalPages(pdfPath: string): Promise<number> {
    try {
      // Use pdfinfo to get page count
      const { stdout } = await execAsync(`pdfinfo "${pdfPath}"`);
      const match = stdout.match(/Pages:\s+(\d+)/);

      if (match) {
        return parseInt(match[1], 10);
      }

      throw new Error('Could not determine page count');
    } catch (error) {
      throw new Error(`Failed to get page count: ${error}`);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): PDFImageConfig {
    return { ...this.config };
  }

  /**
   * Clean up output directory
   */
  cleanup(): void {
    if (fs.existsSync(this.config.outputDir)) {
      fs.rmSync(this.config.outputDir, { recursive: true, force: true });
    }
  }
}
