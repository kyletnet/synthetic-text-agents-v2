/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

/**
 * Composite Entity Extractor
 *
 * Combines NER and dictionary-based extraction for optimal results.
 * Strategy:
 * 1. Dictionary extraction (highest confidence)
 * 2. NER extraction (fill gaps)
 * 3. Merge and deduplicate (prioritize dictionary > NER)
 */

import {
  DEFAULT_ENTITY_EXTRACTION_CONFIG,
  type Entity,
  type EntityRecognizer,
  type EntityExtractionConfig,
} from "./entity-recognizer.js";
import { KoreanNER } from "./korean-ner.js";
import { DictionaryBasedExtractor } from "./entity-dictionary.js";

export class CompositeExtractor implements EntityRecognizer {
  private ner: KoreanNER;
  private dict: DictionaryBasedExtractor;
  private config: EntityExtractionConfig;

  constructor(config?: Partial<EntityExtractionConfig>) {
    this.ner = new KoreanNER();
    this.dict = new DictionaryBasedExtractor();
    this.config = {
      ...DEFAULT_ENTITY_EXTRACTION_CONFIG,
      ...config,
    };
  }

  async extractEntities(
    text: string,
    domain: string = "art_renaissance",
  ): Promise<Entity[]> {
    // 1. Dictionary extraction (highest confidence)
    const dictEntities = await this.dict.extractEntities(text, domain);

    // 2. NER extraction
    const nerEntities = await this.ner.extractEntities(text, domain);

    // 3. Merge (dictionary 우선)
    const merged = this.mergeEntities([...dictEntities, ...nerEntities]);

    // 4. Apply config filters
    return this.applyFilters(merged);
  }

  async extractFromMultipleTexts(
    texts: string[],
    domain: string = "art_renaissance",
  ): Promise<Entity[]> {
    const allEntities: Entity[] = [];

    for (const text of texts) {
      const entities = await this.extractEntities(text, domain);
      allEntities.push(...entities);
    }

    // 중복 제거
    const merged = this.mergeEntities(allEntities);

    // Apply config filters
    return this.applyFilters(merged);
  }

  /**
   * Merge entities with deduplication
   *
   * Priority:
   * 1. Source: dictionary > ner > hybrid
   * 2. Confidence: higher is better
   * 3. Type: more specific is better (PERSON > TERM > OTHER)
   */
  private mergeEntities(entities: Entity[]): Entity[] {
    const merged = new Map<string, Entity>();

    for (const entity of entities) {
      const key = entity.text.toLowerCase();
      const existing = merged.get(key);

      if (!existing) {
        merged.set(key, entity);
        continue;
      }

      // 병합 전략 적용
      const shouldReplace = this.shouldReplaceEntity(existing, entity);

      if (shouldReplace) {
        // 기존 엔티티와 신규 엔티티의 source를 hybrid로 표시
        const hybridEntity: Entity = {
          ...entity,
          source: "hybrid",
          confidence: Math.max(existing.confidence, entity.confidence),
        };
        merged.set(key, hybridEntity);
      }
    }

    return Array.from(merged.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );
  }

  /**
   * Determine if new entity should replace existing
   */
  private shouldReplaceEntity(existing: Entity, newEntity: Entity): boolean {
    // 병합 전략에 따라 결정
    const strategy = this.config.mergeStrategy;

    if (strategy === "highest_confidence") {
      return newEntity.confidence > existing.confidence;
    }

    if (strategy === "source_priority") {
      // Source 우선순위: dictionary > ner > hybrid
      const sourcePriority = {
        dictionary: 3,
        ner: 2,
        hybrid: 1,
      };

      const existingPriority = sourcePriority[existing.source];
      const newPriority = sourcePriority[newEntity.source];

      if (newPriority > existingPriority) {
        return true;
      }

      if (newPriority === existingPriority) {
        // 같은 source면 신뢰도로 결정
        return newEntity.confidence > existing.confidence;
      }

      return false;
    }

    if (strategy === "first") {
      return false; // 항상 첫 번째 유지
    }

    return false;
  }

  /**
   * Apply configuration filters
   */
  private applyFilters(entities: Entity[]): Entity[] {
    let filtered = entities;

    // 1. Confidence threshold
    filtered = filtered.filter(
      (entity) => entity.confidence >= this.config.minConfidence,
    );

    // 2. Include types (if specified)
    if (this.config.includeTypes && this.config.includeTypes.length > 0) {
      filtered = filtered.filter((entity) =>
        this.config.includeTypes!.includes(entity.type),
      );
    }

    // 3. Exclude types (if specified)
    if (this.config.excludeTypes && this.config.excludeTypes.length > 0) {
      filtered = filtered.filter(
        (entity) => !this.config.excludeTypes!.includes(entity.type),
      );
    }

    // 4. Max entities (if specified)
    if (this.config.maxEntities && this.config.maxEntities > 0) {
      filtered = filtered.slice(0, this.config.maxEntities);
    }

    return filtered;
  }

  /**
   * Get entity statistics
   */
  async getEntityStatistics(
    texts: string[],
    domain?: string,
  ): Promise<{
    total: number;
    byType: Record<Entity["type"], number>;
    bySource: Record<Entity["source"], number>;
    avgConfidence: number;
  }> {
    const entities = await this.extractFromMultipleTexts(texts, domain);

    const byType: Record<Entity["type"], number> = {
      PERSON: 0,
      LOCATION: 0,
      TERM: 0,
      DATE: 0,
      OTHER: 0,
    };

    const bySource: Record<Entity["source"], number> = {
      ner: 0,
      dictionary: 0,
      hybrid: 0,
    };

    let totalConfidence = 0;

    for (const entity of entities) {
      byType[entity.type]++;
      bySource[entity.source]++;
      totalConfidence += entity.confidence;
    }

    return {
      total: entities.length,
      byType,
      bySource,
      avgConfidence:
        entities.length > 0 ? totalConfidence / entities.length : 0,
    };
  }
}
