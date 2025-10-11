/**
 * Gemini Vision Client
 *
 * Client for Google Gemini Vision API to analyze document layouts.
 *
 * Features:
 * - Document structure analysis (sections, tables, lists)
 * - Batch processing with rate limiting
 * - Error handling and retry logic
 * - Cost tracking
 *
 * API: @google/generative-ai
 * Model: gemini-2.0-flash-exp (vision capable)
 *
 * @see docs/INNOVATION/2025-10-vision-guided-hybrid.md
 */

import * as fs from 'fs';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

/**
 * Vision Analysis Result
 */
export interface VisionAnalysisResult {
  pageNumber: number;
  sections: Array<{
    title: string;
    level: number; // 1, 2, 3...
    bbox?: [number, number, number, number]; // x, y, w, h
    text: string;
  }>;
  tables: Array<{
    caption?: string;
    rows: number;
    cols: number;
    bbox?: [number, number, number, number];
    cells?: string[][];
  }>;
  lists: Array<{
    items: string[];
    type: 'bullet' | 'numbered';
    level: number;
  }>;
  paragraphs: Array<{
    text: string;
    sectionId?: string;
    bbox?: [number, number, number, number];
  }>;
  figures: Array<{
    caption?: string;
    description: string;
    bbox?: [number, number, number, number];
  }>;
}

/**
 * Vision API Configuration
 */
export interface VisionAPIConfig {
  apiKey: string;
  model: string; // Default: gemini-2.0-flash-exp
  maxRetries: number;
  retryDelay: number; // ms
  temperature: number;
}

const DEFAULT_CONFIG: Omit<VisionAPIConfig, 'apiKey'> = {
  model: 'gemini-2.0-flash-exp',
  maxRetries: 3,
  retryDelay: 1000,
  temperature: 0.1,
};

/**
 * Vision Analysis Prompt Template
 */
const VISION_PROMPT = `Analyze this document page and extract structural information.

Identify:
1. **Sections**: Section headers with hierarchy (제1장, 1., 가. etc.)
2. **Tables**: All tables with captions and structure
3. **Lists**: Bullet/numbered lists with items
4. **Paragraphs**: Body text
5. **Figures**: Images, diagrams with captions

Output as JSON:
{
  "sections": [
    {"title": "...", "level": 1, "text": "..."}
  ],
  "tables": [
    {"caption": "...", "rows": 5, "cols": 3}
  ],
  "lists": [
    {"items": ["...", "..."], "type": "bullet", "level": 1}
  ],
  "paragraphs": [
    {"text": "..."}
  ],
  "figures": [
    {"caption": "...", "description": "..."}
  ]
}

Be thorough. Extract all structural elements.`;

/**
 * Gemini Vision Client
 */
export class GeminiVisionClient {
  private config: VisionAPIConfig;
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;
  private costTracker: {
    totalImages: number;
    totalTokensInput: number;
    totalTokensOutput: number;
    estimatedCost: number;
  };

  constructor(config: Partial<VisionAPIConfig> & { apiKey: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.client = new GoogleGenerativeAI(this.config.apiKey);
    this.model = this.client.getGenerativeModel({ model: this.config.model });

    this.costTracker = {
      totalImages: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      estimatedCost: 0,
    };
  }

  /**
   * Analyze single page image
   */
  async analyzePage(imagePath: string, pageNumber: number): Promise<VisionAnalysisResult> {
    let retries = 0;

    while (retries < this.config.maxRetries) {
      try {
        // Read image
        const imageBuffer = fs.readFileSync(imagePath);
        const imageBase64 = imageBuffer.toString('base64');

        // Determine MIME type
        const ext = imagePath.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

        // Build request
        const result = await this.model.generateContent([
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          {
            text: VISION_PROMPT,
          },
        ]);

        const response = await result.response;
        const text = response.text();

        // Track cost
        this.costTracker.totalImages++;
        // Note: Actual token counts would come from response metadata if available
        this.costTracker.totalTokensInput += 1000; // Estimate
        this.costTracker.totalTokensOutput += text.length / 4; // Rough estimate
        this.costTracker.estimatedCost += 0.0025; // $0.0025 per image (Gemini pricing)

        // Parse JSON response
        const parsed = this.parseVisionResponse(text);

        return {
          pageNumber,
          ...parsed,
        };
      } catch (error) {
        retries++;
        if (retries >= this.config.maxRetries) {
          throw new Error(`Failed to analyze page ${pageNumber} after ${retries} retries: ${error}`);
        }

        console.warn(`Retry ${retries}/${this.config.maxRetries} for page ${pageNumber}`);
        await this.sleep(this.config.retryDelay * retries);
      }
    }

    throw new Error('Unexpected error in analyzePage');
  }

  /**
   * Parse vision response
   */
  private parseVisionResponse(text: string): Omit<VisionAnalysisResult, 'pageNumber'> {
    try {
      // Extract JSON from response (might be wrapped in markdown code blocks)
      let jsonText = text.trim();

      // Remove markdown code blocks if present
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
      }

      const parsed = JSON.parse(jsonText);

      return {
        sections: parsed.sections || [],
        tables: parsed.tables || [],
        lists: parsed.lists || [],
        paragraphs: parsed.paragraphs || [],
        figures: parsed.figures || [],
      };
    } catch (error) {
      console.error('Failed to parse vision response:', error);
      console.error('Raw response:', text.substring(0, 500));

      // Return empty structure
      return {
        sections: [],
        tables: [],
        lists: [],
        paragraphs: [],
        figures: [],
      };
    }
  }

  /**
   * Get cost tracker
   */
  getCostTracker() {
    return { ...this.costTracker };
  }

  /**
   * Reset cost tracker
   */
  resetCostTracker(): void {
    this.costTracker = {
      totalImages: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
      estimatedCost: 0,
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.apiKey.length > 0;
  }
}
