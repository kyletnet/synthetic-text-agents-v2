/**
 * Entity Extraction Module
 *
 * Exports:
 * - EntityRecognizer interface
 * - KoreanNER (pattern-based)
 * - DictionaryBasedExtractor (domain-specific)
 * - CompositeExtractor (NER + Dictionary)
 * - Value Objects (EntityConfidence, EntitySpan, EntityType, etc.)
 */

export * from "./entity-recognizer.js";
export * from "./korean-ner.js";
export * from "./entity-dictionary.js";
export * from "./composite-extractor.js";
export * from "./value-objects.js";
