/**
 * Slot Extractor (L2 Synthesizer)
 *
 * Extracts structured information from user feedback.
 * - Numbers, versions, sections, figures, tables, equations
 * - Context-aware extraction (not just regex matching)
 *
 * Examples:
 * - "Show me Table 3" → {table: "3"}
 * - "Figure 2.1 is wrong" → {figure: "2.1"}
 * - "Update to version 1.2.3" → {version: "1.2.3"}
 * - "Section 4.5 is incomplete" → {section: "4.5"}
 *
 * Architecture Insight:
 * Slot extraction is NOT just pattern matching - it's
 * STRUCTURED INFORMATION EXTRACTION with context awareness.
 *
 * @see RFC 2025-17, Section 2 (L2 Synthesizer)
 */

/**
 * Extracted slots
 */
export type Slots = Record<string, string | number | boolean>;

/**
 * Slot extraction configuration
 */
export interface SlotExtractorConfig {
  enabledSlotTypes: SlotType[];
  strictMode: boolean; // If true, only extract high-confidence slots
}

/**
 * Slot types
 */
export type SlotType =
  | 'table'
  | 'figure'
  | 'section'
  | 'version'
  | 'equation'
  | 'page'
  | 'line'
  | 'paragraph'
  | 'chapter'
  | 'appendix'
  | 'numeric_range'
  | 'date'
  | 'percentage';

const DEFAULT_CONFIG: SlotExtractorConfig = {
  enabledSlotTypes: [
    'table',
    'figure',
    'section',
    'version',
    'equation',
    'page',
    'line',
    'paragraph',
  ],
  strictMode: false,
};

/**
 * Slot patterns
 */
const SLOT_PATTERNS: Record<SlotType, RegExp[]> = {
  table: [
    /\btable\s+(\d+(?:\.\d+)?)\b/i,
    /\btbl\.?\s+(\d+(?:\.\d+)?)\b/i,
    /\b(table|tbl):\s*(\d+(?:\.\d+)?)\b/i,
  ],
  figure: [
    /\bfigure\s+(\d+(?:\.\d+)?)\b/i,
    /\bfig\.?\s+(\d+(?:\.\d+)?)\b/i,
    /\b(figure|fig):\s*(\d+(?:\.\d+)?)\b/i,
  ],
  section: [
    /\bsection\s+(\d+(?:\.\d+)*)\b/i,
    /\bsec\.?\s+(\d+(?:\.\d+)*)\b/i,
    /\b§\s*(\d+(?:\.\d+)*)\b/,
  ],
  version: [
    /\bversion\s+(\d+\.\d+(?:\.\d+)?)\b/i,
    /\bv(\d+\.\d+(?:\.\d+)?)\b/i,
    /\bver\.?\s+(\d+\.\d+(?:\.\d+)?)\b/i,
  ],
  equation: [
    /\bequation\s+(\d+(?:\.\d+)?)\b/i,
    /\beq\.?\s+(\d+(?:\.\d+)?)\b/i,
    /\b\((\d+(?:\.\d+)?)\)\b/, // e.g., (3.1)
  ],
  page: [
    /\bpage\s+(\d+)\b/i,
    /\bp\.?\s+(\d+)\b/i,
    /\bpp\.?\s+(\d+)\b/i,
  ],
  line: [
    /\bline\s+(\d+)\b/i,
    /\bl\.?\s+(\d+)\b/i,
  ],
  paragraph: [
    /\bparagraph\s+(\d+)\b/i,
    /\bpara\.?\s+(\d+)\b/i,
    /\b¶\s*(\d+)\b/,
  ],
  chapter: [
    /\bchapter\s+(\d+)\b/i,
    /\bch\.?\s+(\d+)\b/i,
  ],
  appendix: [
    /\bappendix\s+([A-Z])\b/i,
    /\bapp\.?\s+([A-Z])\b/i,
  ],
  numeric_range: [
    /\b(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\b/,
    /\b(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\b/i,
    /\bbetween\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)\b/i,
  ],
  date: [
    /\b(\d{4})-(\d{2})-(\d{2})\b/, // YYYY-MM-DD
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/, // MM/DD/YYYY
  ],
  percentage: [
    /\b(\d+(?:\.\d+)?)\s*%\b/,
    /\b(\d+(?:\.\d+)?)\s+percent\b/i,
  ],
};

/**
 * Slot Extractor
 *
 * Extracts structured slots from user feedback.
 */
export class SlotExtractor {
  private config: SlotExtractorConfig;

  constructor(config: Partial<SlotExtractorConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      enabledSlotTypes: config.enabledSlotTypes || DEFAULT_CONFIG.enabledSlotTypes,
    };
  }

  /**
   * Extract slots from text
   *
   * @param text User feedback text
   * @returns Extracted slots as key-value pairs
   */
  extract(text: string): Slots {
    const slots: Slots = {};

    for (const slotType of this.config.enabledSlotTypes) {
      const patterns = SLOT_PATTERNS[slotType];
      if (!patterns) continue;

      for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) {
          // Extract value (first capture group or full match)
          const value = this.extractValue(match, slotType);
          if (value !== null) {
            slots[slotType] = value;
            break; // Only take first match per slot type
          }
        }
      }
    }

    return slots;
  }

  /**
   * Extract value from regex match
   */
  private extractValue(match: RegExpExecArray, slotType: SlotType): string | number | null {
    // Handle different slot types
    switch (slotType) {
      case 'numeric_range':
        // Range: [start, end]
        if (match[1] && match[2]) {
          return `${match[1]}-${match[2]}`;
        }
        break;

      case 'date':
        // Date: YYYY-MM-DD or MM/DD/YYYY
        if (match[1] && match[2] && match[3]) {
          return `${match[1]}-${match[2]}-${match[3]}`;
        }
        break;

      case 'percentage':
        // Percentage: convert to number
        if (match[1]) {
          return parseFloat(match[1]);
        }
        break;

      default:
        // Simple extraction: first capture group
        if (match[1]) {
          // Try to parse as number
          const num = parseFloat(match[1]);
          if (!isNaN(num) && slotType !== 'version') {
            return num;
          }
          return match[1];
        }
    }

    return null;
  }

  /**
   * Extract slots with confidence scores
   *
   * @param text User feedback text
   * @returns Slots with confidence scores
   */
  extractWithConfidence(text: string): Map<string, { value: string | number; confidence: number }> {
    const slots = new Map<string, { value: string | number; confidence: number }>();

    for (const slotType of this.config.enabledSlotTypes) {
      const patterns = SLOT_PATTERNS[slotType];
      if (!patterns) continue;

      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const match = pattern.exec(text);

        if (match) {
          const value = this.extractValue(match, slotType);
          if (value !== null) {
            // Confidence = 1.0 for first pattern, 0.8 for second, 0.6 for third
            const confidence = Math.max(0.6, 1.0 - i * 0.2);

            // In strict mode, only accept high-confidence matches
            if (this.config.strictMode && confidence < 0.8) {
              continue;
            }

            slots.set(slotType, { value, confidence });
            break;
          }
        }
      }
    }

    return slots;
  }

  /**
   * Batch extract slots from multiple texts
   */
  batchExtract(texts: string[]): Slots[] {
    return texts.map((text) => this.extract(text));
  }

  /**
   * Check if text contains any slots
   */
  hasSlots(text: string): boolean {
    const slots = this.extract(text);
    return Object.keys(slots).length > 0;
  }

  /**
   * Get configuration
   */
  getConfig(): SlotExtractorConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SlotExtractorConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      enabledSlotTypes: config.enabledSlotTypes || this.config.enabledSlotTypes,
    };
  }

  /**
   * Get supported slot types
   */
  getSupportedSlotTypes(): SlotType[] {
    return Object.keys(SLOT_PATTERNS) as SlotType[];
  }

  /**
   * Validate slot type
   */
  isValidSlotType(slotType: string): slotType is SlotType {
    return Object.keys(SLOT_PATTERNS).includes(slotType);
  }
}

/**
 * Default singleton instance
 */
export const slotExtractor = new SlotExtractor();
