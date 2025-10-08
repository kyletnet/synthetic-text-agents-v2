/**
 * Value Objects for Entity Extraction
 *
 * Immutable value objects representing domain concepts.
 * Following DDD principles - value objects have no identity, only values.
 */

import type { Entity } from "./entity-recognizer.js";

/**
 * Entity Confidence Score (Value Object)
 *
 * Immutable confidence score with validation and comparison.
 */
export class EntityConfidence {
  private readonly _value: number;

  private constructor(value: number) {
    this._value = value;
  }

  static create(value: number): EntityConfidence {
    if (value < 0 || value > 1) {
      throw new Error(
        `Invalid confidence score: ${value}. Must be between 0 and 1.`,
      );
    }
    const instance = new EntityConfidence(value);
    return Object.freeze(instance) as EntityConfidence;
  }

  get value(): number {
    return this._value;
  }

  isHighConfidence(): boolean {
    return this._value >= 0.8;
  }

  isMediumConfidence(): boolean {
    return this._value >= 0.5 && this._value < 0.8;
  }

  isLowConfidence(): boolean {
    return this._value < 0.5;
  }

  equals(other: EntityConfidence): boolean {
    return this._value === other._value;
  }

  greaterThan(other: EntityConfidence): boolean {
    return this._value > other._value;
  }

  toString(): string {
    return `${(this._value * 100).toFixed(1)}%`;
  }
}

/**
 * Entity Span (Value Object)
 *
 * Immutable text span with start and end positions.
 */
export class EntitySpan {
  private readonly _start: number;
  private readonly _end: number;

  private constructor(start: number, end: number) {
    this._start = start;
    this._end = end;
  }

  static create(start: number, end: number): EntitySpan {
    if (start < 0 || end < 0) {
      throw new Error(
        `Invalid span: [${start}, ${end}]. Positions must be non-negative.`,
      );
    }
    if (start >= end) {
      throw new Error(
        `Invalid span: [${start}, ${end}]. Start must be less than end.`,
      );
    }
    const instance = new EntitySpan(start, end);
    return Object.freeze(instance) as EntitySpan;
  }

  static fromTuple(span: [number, number]): EntitySpan {
    return EntitySpan.create(span[0], span[1]);
  }

  get start(): number {
    return this._start;
  }

  get end(): number {
    return this._end;
  }

  get length(): number {
    return this._end - this._start;
  }

  toTuple(): [number, number] {
    return [this._start, this._end];
  }

  contains(position: number): boolean {
    return position >= this._start && position < this._end;
  }

  overlaps(other: EntitySpan): boolean {
    return this._start < other._end && other._start < this._end;
  }

  subsumes(other: EntitySpan): boolean {
    return this._start <= other._start && other._end <= this._end;
  }

  equals(other: EntitySpan): boolean {
    return this._start === other._start && this._end === other._end;
  }

  toString(): string {
    return `[${this._start}, ${this._end}]`;
  }
}

/**
 * Entity Type (Value Object)
 *
 * Immutable entity type with hierarchy and validation.
 */
export class EntityType {
  private readonly _value: Entity["type"];

  private constructor(value: Entity["type"]) {
    this._value = value;
  }

  static create(value: Entity["type"]): EntityType {
    const instance = new EntityType(value);
    return Object.freeze(instance) as EntityType;
  }

  static PERSON = Object.freeze(new EntityType("PERSON"));
  static LOCATION = Object.freeze(new EntityType("LOCATION"));
  static TERM = Object.freeze(new EntityType("TERM"));
  static DATE = Object.freeze(new EntityType("DATE"));
  static OTHER = Object.freeze(new EntityType("OTHER"));

  get value(): Entity["type"] {
    return this._value;
  }

  isPerson(): boolean {
    return this._value === "PERSON";
  }

  isLocation(): boolean {
    return this._value === "LOCATION";
  }

  isTerm(): boolean {
    return this._value === "TERM";
  }

  isDate(): boolean {
    return this._value === "DATE";
  }

  isOther(): boolean {
    return this._value === "OTHER";
  }

  /**
   * Get priority for disambiguation (higher = more specific)
   */
  getPriority(): number {
    const priorities: Record<Entity["type"], number> = {
      PERSON: 5,
      LOCATION: 4,
      DATE: 4,
      TERM: 3,
      OTHER: 1,
    };
    return priorities[this._value];
  }

  equals(other: EntityType): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * Entity Source (Value Object)
 *
 * Immutable source indicator with priority.
 */
export class EntitySource {
  private readonly _value: Entity["source"];

  private constructor(value: Entity["source"]) {
    this._value = value;
  }

  static create(value: Entity["source"]): EntitySource {
    const instance = new EntitySource(value);
    return Object.freeze(instance) as EntitySource;
  }

  static NER = Object.freeze(new EntitySource("ner"));
  static DICTIONARY = Object.freeze(new EntitySource("dictionary"));
  static HYBRID = Object.freeze(new EntitySource("hybrid"));

  get value(): Entity["source"] {
    return this._value;
  }

  isNER(): boolean {
    return this._value === "ner";
  }

  isDictionary(): boolean {
    return this._value === "dictionary";
  }

  isHybrid(): boolean {
    return this._value === "hybrid";
  }

  /**
   * Get priority for merging (higher = more reliable)
   */
  getPriority(): number {
    const priorities: Record<Entity["source"], number> = {
      dictionary: 3,
      ner: 2,
      hybrid: 1,
    };
    return priorities[this._value];
  }

  equals(other: EntitySource): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}

/**
 * Extracted Entity (Immutable Entity with Value Objects)
 *
 * Domain entity using value objects for all properties.
 */
export class ExtractedEntity {
  private readonly _text: string;
  private readonly _type: EntityType;
  private readonly _confidence: EntityConfidence;
  private readonly _span: EntitySpan;
  private readonly _source: EntitySource;

  private constructor(
    text: string,
    type: EntityType,
    confidence: EntityConfidence,
    span: EntitySpan,
    source: EntitySource,
  ) {
    this._text = text;
    this._type = type;
    this._confidence = confidence;
    this._span = span;
    this._source = source;
  }

  static create(
    text: string,
    type: Entity["type"],
    confidence: number,
    span: [number, number],
    source: Entity["source"],
  ): ExtractedEntity {
    const instance = new ExtractedEntity(
      text,
      EntityType.create(type),
      EntityConfidence.create(confidence),
      EntitySpan.fromTuple(span),
      EntitySource.create(source),
    );
    return Object.freeze(instance) as ExtractedEntity;
  }

  static fromPlain(entity: Entity): ExtractedEntity {
    return ExtractedEntity.create(
      entity.text,
      entity.type,
      entity.confidence,
      entity.span,
      entity.source,
    );
  }

  get text(): string {
    return this._text;
  }

  get type(): EntityType {
    return this._type;
  }

  get confidence(): EntityConfidence {
    return this._confidence;
  }

  get span(): EntitySpan {
    return this._span;
  }

  get source(): EntitySource {
    return this._source;
  }

  /**
   * Convert to plain Entity (for serialization)
   */
  toPlain(): Entity {
    return {
      text: this._text,
      type: this._type.value,
      confidence: this._confidence.value,
      span: this._span.toTuple(),
      source: this._source.value,
    };
  }

  /**
   * Check if this entity should replace another during merging
   */
  shouldReplace(other: ExtractedEntity): boolean {
    // Same text (case-insensitive)
    if (this._text.toLowerCase() !== other._text.toLowerCase()) {
      return false;
    }

    // Source priority
    if (this._source.getPriority() > other._source.getPriority()) {
      return true;
    }

    if (this._source.getPriority() === other._source.getPriority()) {
      // Confidence
      return this._confidence.greaterThan(other._confidence);
    }

    return false;
  }

  equals(other: ExtractedEntity): boolean {
    return (
      this._text === other._text &&
      this._type.equals(other._type) &&
      this._confidence.equals(other._confidence) &&
      this._span.equals(other._span) &&
      this._source.equals(other._source)
    );
  }

  toString(): string {
    return `${this._text} [${this._type}] (${this._confidence})`;
  }
}
