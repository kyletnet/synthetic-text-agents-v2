/**
 * Alignment Specification Pattern
 *
 * Encapsulates alignment rules as objects for testability and composability.
 * Follows Specification Pattern from DDD.
 */

import type { AlignmentResult } from "./semantic-aligner.js";

export interface QAPair {
  question: string;
  answer: string;
  evidence: string;
}

/**
 * Alignment Specification Interface
 *
 * Encapsulates a single alignment rule that can be tested.
 */
export interface AlignmentSpecification {
  /**
   * Check if the QA pair satisfies this specification
   */
  isSatisfiedBy(pair: QAPair): boolean;

  /**
   * Get the alignment result for this specification
   */
  evaluate(pair: QAPair): Promise<AlignmentResult>;

  /**
   * Get human-readable description
   */
  getDescription(): string;
}

/**
 * Direct Quote Specification
 *
 * Satisfied when answer contains direct quotes from evidence (30%+).
 */
export class DirectQuoteSpecification implements AlignmentSpecification {
  constructor(
    private readonly minQuoteRatio: number = 0.3,
    private readonly citationDetector?: any,
  ) {}

  isSatisfiedBy(pair: QAPair): boolean {
    // Simplified check for interface compatibility
    return pair.answer.includes(pair.evidence.substring(0, 10));
  }

  async evaluate(pair: QAPair): Promise<AlignmentResult> {
    // Use CitationDetector if provided
    if (this.citationDetector) {
      const ratio = this.citationDetector.calculateDirectQuoteRatio(
        pair.answer,
        pair.evidence,
      );

      if (ratio >= this.minQuoteRatio) {
        return {
          score: 0.8 + ratio * 0.2,
          method: "direct_quote",
          confidence: 0.95,
          matchedSpans: this.citationDetector.detectDirectQuotes(
            pair.answer,
            pair.evidence,
          ),
          metadata: { directQuoteRatio: ratio },
        };
      }
    }

    throw new Error("Specification not satisfied");
  }

  getDescription(): string {
    return `Direct quote ratio >= ${this.minQuoteRatio * 100}%`;
  }
}

/**
 * Paraphrase Specification
 *
 * Satisfied when answer paraphrases evidence (50%+ similarity).
 */
export class ParaphraseSpecification implements AlignmentSpecification {
  constructor(
    private readonly minSimilarity: number = 0.5,
    private readonly lexicalAligner?: any,
  ) {}

  isSatisfiedBy(pair: QAPair): boolean {
    // Simplified check
    const commonWords = this.getCommonWords(pair.answer, pair.evidence);
    return commonWords.length >= 3;
  }

  async evaluate(pair: QAPair): Promise<AlignmentResult> {
    if (this.lexicalAligner) {
      const result = await this.lexicalAligner.calculateAlignment(
        pair.answer,
        pair.evidence,
      );

      if (
        result.score >= this.minSimilarity &&
        result.method === "paraphrase"
      ) {
        return result;
      }
    }

    throw new Error("Specification not satisfied");
  }

  getDescription(): string {
    return `Paraphrase similarity >= ${this.minSimilarity * 100}%`;
  }

  private getCommonWords(text1: string, text2: string): string[] {
    const words1 = new Set(
      text1
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
    const words2 = text2
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);

    return words2.filter((w) => words1.has(w));
  }
}

/**
 * Inference Specification
 *
 * Satisfied when answer can be inferred from evidence (30%+ similarity).
 */
export class InferenceSpecification implements AlignmentSpecification {
  constructor(
    private readonly minSimilarity: number = 0.3,
    private readonly lexicalAligner?: any,
  ) {}

  isSatisfiedBy(pair: QAPair): boolean {
    // Simplified check
    return pair.answer.length > 0 && pair.evidence.length > 0;
  }

  async evaluate(pair: QAPair): Promise<AlignmentResult> {
    if (this.lexicalAligner) {
      const result = await this.lexicalAligner.calculateAlignment(
        pair.answer,
        pair.evidence,
      );

      if (result.score >= this.minSimilarity && result.method === "inference") {
        return result;
      }
    }

    throw new Error("Specification not satisfied");
  }

  getDescription(): string {
    return `Inference similarity >= ${this.minSimilarity * 100}%`;
  }
}

/**
 * Composite Specification (AND)
 *
 * Satisfied when all sub-specifications are satisfied.
 */
export class AndSpecification implements AlignmentSpecification {
  constructor(private readonly specs: AlignmentSpecification[]) {}

  isSatisfiedBy(pair: QAPair): boolean {
    return this.specs.every((spec) => spec.isSatisfiedBy(pair));
  }

  async evaluate(pair: QAPair): Promise<AlignmentResult> {
    const results: AlignmentResult[] = [];

    for (const spec of this.specs) {
      if (spec.isSatisfiedBy(pair)) {
        results.push(await spec.evaluate(pair));
      }
    }

    if (results.length === this.specs.length) {
      // All satisfied - return best result
      const best = results.sort((a, b) => b.score - a.score)[0];
      return best;
    }

    throw new Error("Not all specifications satisfied");
  }

  getDescription(): string {
    return `ALL of: ${this.specs.map((s) => s.getDescription()).join(", ")}`;
  }
}

/**
 * Composite Specification (OR)
 *
 * Satisfied when any sub-specification is satisfied.
 */
export class OrSpecification implements AlignmentSpecification {
  constructor(private readonly specs: AlignmentSpecification[]) {}

  isSatisfiedBy(pair: QAPair): boolean {
    return this.specs.some((spec) => spec.isSatisfiedBy(pair));
  }

  async evaluate(pair: QAPair): Promise<AlignmentResult> {
    for (const spec of this.specs) {
      if (spec.isSatisfiedBy(pair)) {
        try {
          return await spec.evaluate(pair);
        } catch {
          // Try next spec
          continue;
        }
      }
    }

    throw new Error("No specification satisfied");
  }

  getDescription(): string {
    return `ANY of: ${this.specs.map((s) => s.getDescription()).join(", ")}`;
  }
}

/**
 * Alignment Specification Factory
 *
 * Creates common specification combinations.
 */
export class AlignmentSpecificationFactory {
  /**
   * Create standard alignment specification (Direct Quote OR Paraphrase OR Inference)
   */
  static createStandard(
    citationDetector?: any,
    lexicalAligner?: any,
  ): AlignmentSpecification {
    return new OrSpecification([
      new DirectQuoteSpecification(0.3, citationDetector),
      new ParaphraseSpecification(0.5, lexicalAligner),
      new InferenceSpecification(0.3, lexicalAligner),
    ]);
  }

  /**
   * Create strict specification (Direct Quote AND high similarity)
   */
  static createStrict(
    citationDetector?: any,
    lexicalAligner?: any,
  ): AlignmentSpecification {
    return new AndSpecification([
      new DirectQuoteSpecification(0.5, citationDetector),
      new ParaphraseSpecification(0.7, lexicalAligner),
    ]);
  }

  /**
   * Create lenient specification (any alignment method)
   */
  static createLenient(
    citationDetector?: any,
    lexicalAligner?: any,
  ): AlignmentSpecification {
    return new OrSpecification([
      new DirectQuoteSpecification(0.1, citationDetector),
      new ParaphraseSpecification(0.3, lexicalAligner),
      new InferenceSpecification(0.2, lexicalAligner),
    ]);
  }
}
