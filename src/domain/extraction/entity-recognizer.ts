/**
 * Entity Recognition Interface
 *
 * Domain layer interface for named entity recognition (NER).
 * Supports Korean language with specialized patterns for:
 * - Person names (Korean, Hanja, Western)
 * - Locations (cities, countries, regions)
 * - Terms (domain-specific terminology)
 * - Dates (centuries, years, periods)
 */

export interface Entity {
  /** The text of the entity */
  text: string;

  /** Type of the entity */
  type: "PERSON" | "LOCATION" | "TERM" | "DATE" | "OTHER";

  /** Confidence score (0.0 - 1.0) */
  confidence: number;

  /** Character span in the source text [start, end] */
  span: [number, number];

  /** Source of recognition */
  source: "ner" | "dictionary" | "hybrid";
}

export interface EntityRecognizer {
  /**
   * Extract entities from text
   *
   * @param text - Source text to extract entities from
   * @param domain - Optional domain context (e.g., "art_renaissance")
   * @returns Promise resolving to array of entities
   */
  extractEntities(text: string, domain?: string): Promise<Entity[]>;

  /**
   * Extract entities from multiple texts
   *
   * @param texts - Array of source texts
   * @param domain - Optional domain context
   * @returns Promise resolving to array of entities (deduplicated)
   */
  extractFromMultipleTexts(texts: string[], domain?: string): Promise<Entity[]>;
}

/**
 * Configuration for entity extraction
 */
export interface EntityExtractionConfig {
  /** Minimum confidence threshold (0.0 - 1.0) */
  minConfidence: number;

  /** Maximum number of entities to return */
  maxEntities?: number;

  /** Entity types to include (if empty, include all) */
  includeTypes?: Array<Entity["type"]>;

  /** Entity types to exclude */
  excludeTypes?: Array<Entity["type"]>;

  /** Enable deduplication */
  deduplicate: boolean;

  /** Merge strategy for duplicate entities */
  mergeStrategy: "highest_confidence" | "source_priority" | "first";
}

/**
 * Default configuration
 */
export const DEFAULT_ENTITY_EXTRACTION_CONFIG: EntityExtractionConfig = {
  minConfidence: 0.5,
  deduplicate: true,
  mergeStrategy: "highest_confidence",
};
