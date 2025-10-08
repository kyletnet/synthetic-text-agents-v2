/**
 * Intent Classifier (L2 Synthesizer)
 *
 * Hybrid approach: Rule-based + Vector-based classification
 * - Explicit keywords → Rule-based (high confidence)
 * - Ambiguous expressions → Vector similarity (medium confidence)
 * - Confidence fusion: rule × 0.6 + vector × 0.4
 *
 * Expected gain: Feedback Utilization ≥70%, Intent Accuracy ≥85%
 *
 * Architecture Insight:
 * Intent classification is NOT just keyword matching - it's a
 * FUSION of explicit rules and semantic understanding.
 *
 * @see RFC 2025-17, Section 2 (L2 Synthesizer)
 */

import type { UserIntent, IntentResult } from '../types';

/**
 * Intent classification configuration
 */
export interface IntentClassifierConfig {
  ruleWeight: number; // Weight for rule-based confidence (default: 0.6)
  vectorWeight: number; // Weight for vector-based confidence (default: 0.4)
  minConfidence: number; // Minimum confidence threshold (default: 0.5)
  enableVectorFallback: boolean; // Enable vector-based fallback (default: true)
}

const DEFAULT_CONFIG: IntentClassifierConfig = {
  ruleWeight: 0.6,
  vectorWeight: 0.4,
  minConfidence: 0.5,
  enableVectorFallback: true,
};

/**
 * Intent patterns (rule-based)
 */
const INTENT_PATTERNS: Record<UserIntent, RegExp[]> = {
  incorrect: [
    /\b(wrong|incorrect|inaccurate|error|mistake|false)\b/i,
    /\b(not (true|correct|accurate|right))\b/i,
    /\b(factual(ly)? (wrong|incorrect))\b/i,
  ],
  insufficient: [
    /\b(insufficient|not enough|lacking|incomplete|missing)\b/i,
    /\b(need(s)? more|more detail|more (information|info|context))\b/i,
    /\b(too (short|brief|vague))\b/i,
    /\b(expand|elaborate)\b/i,
  ],
  evidence: [
    /\b(evidence|source|citation|reference|proof)\b/i,
    /\b(where (is|did)|show (me )?the source)\b/i,
    /\b(need(s)? (evidence|source|citation))\b/i,
    /\b(support(ed)? by)\b/i,
  ],
  brevity: [
    /\b(too long|verbose|wordy|lengthy)\b/i,
    /\b(shorter|brief(er)?|concise|succinct)\b/i,
    /\b(summarize|condense)\b/i,
    /\b(tl;?dr|too much)\b/i,
  ],
  contrast: [
    /\b(alternative|contrast|compare|different|other (view|perspective))\b/i,
    /\b(what about|but what if|on the other hand)\b/i,
    /\b(counter(argument|example|point))\b/i,
  ],
  lexicon: [
    /\b(jargon|terminology|term|word(s)?|language)\b/i,
    /\b(technical|formal|informal|casual)\b/i,
    /\b(plain (language|english))\b/i,
    /\b(simpler (words|terms))\b/i,
  ],
  structure: [
    /\b(format|structure|layout|organization)\b/i,
    /\b(bullet|list|table|paragraph)\b/i,
    /\b(reorganize|restructure)\b/i,
  ],
  coverage: [
    /\b(coverage|comprehensive|complete|thorough)\b/i,
    /\b(missing|left out|forgot|omitted)\b/i,
    /\b(all (aspects|angles|sides))\b/i,
  ],
  tone: [
    /\b(tone|style|voice|manner)\b/i,
    /\b(formal|informal|professional|casual|friendly)\b/i,
    /\b(too (formal|informal|technical))\b/i,
  ],
  other: [],
};

/**
 * Modifier patterns
 */
const MODIFIER_PATTERNS: Record<string, RegExp> = {
  lexicon_strict: /\b(domain (specific|term)|technical (term|jargon)|strict (terminology|lexicon))\b/i,
  structure_bullet: /\b(bullet(s)?|list)\b/i,
  structure_paragraph: /\b(paragraph(s)?|prose|continuous)\b/i,
  structure_table: /\b(table|grid|matrix)\b/i,
  coverage_comprehensive: /\b(comprehensive|exhaustive|complete|thorough|all)\b/i,
  brevity_extreme: /\b(very (short|brief)|ultra (concise|brief)|tl;?dr)\b/i,
  evidence_rich: /\b(many (sources|citations)|rich (evidence|sources)|multiple (citations|sources))\b/i,
  creative: /\b(creative|novel|innovative|original|unique)\b/i,
  conservative: /\b(conservative|safe|grounded|factual|verified)\b/i,
};

/**
 * Intent embeddings (for vector-based classification)
 * TODO: Replace with actual embeddings from sentence-transformers
 */
const INTENT_EMBEDDINGS: Record<UserIntent, string> = {
  incorrect: 'This information is wrong and needs correction',
  insufficient: 'I need more detailed information and context',
  evidence: 'Please provide sources and citations for this claim',
  brevity: 'This response is too long, make it shorter',
  contrast: 'Show me alternative perspectives and contrasts',
  lexicon: 'Use simpler language and avoid technical jargon',
  structure: 'Change the format to bullet points or table',
  coverage: 'This is incomplete, cover all aspects',
  tone: 'The tone is too formal, make it more casual',
  other: 'General feedback',
};

/**
 * Intent Classifier
 *
 * Hybrid rule-based + vector-based classification.
 */
export class IntentClassifier {
  private config: IntentClassifierConfig;

  constructor(config: Partial<IntentClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Classify user feedback intent
   *
   * @param text User feedback text
   * @returns Intent classification result
   */
  classify(text: string): IntentResult {
    // Stage 1: Rule-based classification
    const ruleResults = this.classifyByRules(text);

    // Stage 2: Vector-based classification (if enabled)
    let vectorResults: Map<UserIntent, number> | null = null;
    if (this.config.enableVectorFallback) {
      vectorResults = this.classifyByVector(text);
    }

    // Stage 3: Fusion
    const fusedConfidences = this.fuseConfidences(ruleResults, vectorResults);

    // Select best intent
    const bestIntent = this.selectBestIntent(fusedConfidences);

    // Extract modifiers
    const modifiers = this.extractModifiers(text);

    return {
      intent: bestIntent.intent,
      confidence: bestIntent.confidence,
      modifiers,
    };
  }

  /**
   * Rule-based classification
   *
   * Returns confidence scores for each intent based on pattern matching.
   */
  private classifyByRules(text: string): Map<UserIntent, number> {
    const confidences = new Map<UserIntent, number>();

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      let matchCount = 0;

      for (const pattern of patterns) {
        if (pattern.test(text)) {
          matchCount++;
        }
      }

      // Confidence = (matches / total patterns) for this intent
      const confidence = patterns.length > 0 ? matchCount / patterns.length : 0;
      confidences.set(intent as UserIntent, confidence);
    }

    return confidences;
  }

  /**
   * Vector-based classification (simplified)
   *
   * TODO: Replace with actual embedding similarity (sentence-transformers)
   * For now, use simple keyword overlap as proxy
   */
  private classifyByVector(text: string): Map<UserIntent, number> {
    const confidences = new Map<UserIntent, number>();

    for (const [intent, exemplar] of Object.entries(INTENT_EMBEDDINGS)) {
      // Simple keyword overlap (placeholder for actual embedding similarity)
      const similarity = this.computeKeywordOverlap(text, exemplar);
      confidences.set(intent as UserIntent, similarity);
    }

    return confidences;
  }

  /**
   * Compute keyword overlap (placeholder for cosine similarity)
   */
  private computeKeywordOverlap(text1: string, text2: string): number {
    const tokens1 = new Set(
      text1.toLowerCase().split(/\s+/).filter((t) => t.length > 3)
    );
    const tokens2 = new Set(
      text2.toLowerCase().split(/\s+/).filter((t) => t.length > 3)
    );

    const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
    const union = new Set([...tokens1, ...tokens2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Fuse rule-based and vector-based confidences
   *
   * Formula: fused = rule × ruleWeight + vector × vectorWeight
   */
  private fuseConfidences(
    ruleResults: Map<UserIntent, number>,
    vectorResults: Map<UserIntent, number> | null
  ): Map<UserIntent, number> {
    const fused = new Map<UserIntent, number>();

    for (const intent of Object.keys(INTENT_PATTERNS) as UserIntent[]) {
      const ruleConf = ruleResults.get(intent) || 0;
      const vectorConf = vectorResults?.get(intent) || 0;

      const fusedConf =
        ruleConf * this.config.ruleWeight + vectorConf * this.config.vectorWeight;

      fused.set(intent, fusedConf);
    }

    return fused;
  }

  /**
   * Select best intent from fused confidences
   */
  private selectBestIntent(
    confidences: Map<UserIntent, number>
  ): { intent: UserIntent; confidence: number } {
    let bestIntent: UserIntent = 'other';
    let bestConfidence = 0;

    for (const [intent, confidence] of confidences.entries()) {
      if (confidence > bestConfidence) {
        bestIntent = intent;
        bestConfidence = confidence;
      }
    }

    // Fallback to 'other' if confidence too low
    if (bestConfidence < this.config.minConfidence) {
      return { intent: 'other', confidence: bestConfidence };
    }

    return { intent: bestIntent, confidence: bestConfidence };
  }

  /**
   * Extract modifiers from text
   *
   * Returns list of modifiers (e.g., 'lexicon_strict', 'structure_bullet')
   */
  private extractModifiers(text: string): string[] {
    const modifiers: string[] = [];

    for (const [modifier, pattern] of Object.entries(MODIFIER_PATTERNS)) {
      if (pattern.test(text)) {
        modifiers.push(modifier);
      }
    }

    return modifiers;
  }

  /**
   * Batch classify multiple feedbacks
   */
  batchClassify(texts: string[]): IntentResult[] {
    return texts.map((text) => this.classify(text));
  }

  /**
   * Get configuration
   */
  getConfig(): IntentClassifierConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<IntentClassifierConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get supported intents
   */
  getSupportedIntents(): UserIntent[] {
    return Object.keys(INTENT_PATTERNS) as UserIntent[];
  }

  /**
   * Get supported modifiers
   */
  getSupportedModifiers(): string[] {
    return Object.keys(MODIFIER_PATTERNS);
  }

  /**
   * Validate intent
   */
  isValidIntent(intent: string): intent is UserIntent {
    return Object.keys(INTENT_PATTERNS).includes(intent);
  }
}

/**
 * Default singleton instance
 */
export const intentClassifier = new IntentClassifier();
