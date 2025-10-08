/**
 * Evidence-Locked Decoder (Quick Win #3)
 *
 * Implements constraint-based decoding that LOCKS generation to evidence.
 * This is the most critical component for preventing hallucination.
 *
 * 3-Stage Pipeline:
 * 1. Cite-first: Identify evidence → Generate citations → Generate text
 * 2. Span-copy: Copy exact spans from evidence (minimize paraphrase)
 * 3. NLI Gate: Post-generation verification (entailment check)
 *
 * Expected gain: Groundedness +8-12%p, Hallucination ↓
 *
 * Architecture Insight:
 * Evidence-Locked Decoding is NOT just adding constraints - it's
 * REDESIGNING the generation process to be evidence-first.
 *
 * @see RFC 2025-17, Section 1.3
 */

import { NLIGate } from './nli-gate';
import type { Evidence, DecodingConstraints } from '../types';

/**
 * Evidence-Locked Decoder configuration
 */
export interface EvidenceLockedConfig {
  citationMandatory: boolean;
  spanCopyOnly: boolean;
  maxNewTokens: number;
  nliGateEnabled: boolean;
  nliThreshold: number;
  constraintEngine: 'lmql' | 'outlines' | 'guidance' | 'none';
  structureFormat?: 'bullet' | 'paragraph' | 'table';
  numericPrecision?: number;
}

const DEFAULT_CONFIG: EvidenceLockedConfig = {
  citationMandatory: true,
  spanCopyOnly: false, // If true, ONLY copy exact spans (no paraphrase)
  maxNewTokens: 500,
  nliGateEnabled: true,
  nliThreshold: 0.8,
  constraintEngine: 'none', // Will use manual constraints until library is installed
  structureFormat: 'paragraph',
  numericPrecision: 2,
};

/**
 * Generation result with provenance
 */
export interface GenerationResult {
  text: string;
  evidenceIds: string[];
  citations: Citation[];
  nliVerified: boolean;
  constraintsApplied: string[];
  metadata: {
    truncated: boolean;
    filteredSentences: number;
    spansCopied: number;
  };
}

/**
 * Citation metadata
 */
export interface Citation {
  text: string; // Cited text span
  evidenceId: string;
  position: number; // Position in generated text
  type: 'direct' | 'paraphrase';
}

/**
 * Evidence-Locked Decoder
 *
 * Core component for grounded generation.
 */
export class EvidenceLockedDecoder {
  private config: EvidenceLockedConfig;
  private nliGate: NLIGate;

  constructor(config: Partial<EvidenceLockedConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.nliGate = new NLIGate({
      threshold: this.config.nliThreshold,
      strictMode: true,
    });
  }

  /**
   * Generate text with evidence-locked constraints
   *
   * ARCHITECTURE:
   * 1. Pre-generation: Select evidence spans
   * 2. Generation: Apply constraints (cite-first, span-copy)
   * 3. Post-generation: NLI verification + filtering
   *
   * @param prompt User prompt
   * @param evidence Evidence chunks
   * @param constraints Decoding constraints
   * @returns Generation result with provenance
   */
  async generate(
    prompt: string,
    evidence: Evidence[],
    constraints?: Partial<DecodingConstraints>
  ): Promise<GenerationResult> {
    // Validate inputs
    if (evidence.length === 0) {
      throw new Error('Evidence-Locked Decoding requires at least one evidence chunk');
    }

    // Merge constraints
    const finalConstraints: DecodingConstraints = {
      citationMandatory: this.config.citationMandatory,
      spanCopyOnly: this.config.spanCopyOnly,
      evidenceIds: evidence.map((e) => e.id),
      maxNewTokens: this.config.maxNewTokens,
      ...constraints,
    };

    // Stage 1: Select relevant evidence spans
    const spans = this.selectEvidenceSpans(prompt, evidence);

    // Stage 2: Generate with constraints
    const generated = await this.generateConstrained(prompt, spans, finalConstraints);

    // Stage 3: NLI verification (if enabled)
    let verified = true;
    let filtered = generated;
    let filteredCount = 0;

    if (this.config.nliGateEnabled) {
      verified = await this.nliGate.check(generated, evidence);

      if (!verified) {
        // Filter out non-entailed sentences
        filtered = await this.nliGate.filterNonEntailed(generated, evidence);
        const originalSentences = this.splitSentences(generated).length;
        const filteredSentences = this.splitSentences(filtered).length;
        filteredCount = originalSentences - filteredSentences;
      }
    }

    // Build citations
    const citations = this.extractCitations(filtered, spans);

    return {
      text: filtered,
      evidenceIds: evidence.map((e) => e.id),
      citations,
      nliVerified: verified,
      constraintsApplied: this.getAppliedConstraints(finalConstraints),
      metadata: {
        truncated: filtered.length < generated.length,
        filteredSentences: filteredCount,
        spansCopied: spans.length,
      },
    };
  }

  /**
   * Stage 1: Select relevant evidence spans
   *
   * Strategy:
   * - Extract key noun phrases from prompt
   * - Find matching spans in evidence
   * - Rank by relevance and trust score
   */
  private selectEvidenceSpans(prompt: string, evidence: Evidence[]): EvidenceSpan[] {
    const spans: EvidenceSpan[] = [];

    // Simple keyword matching (can be improved with NER/dependency parsing)
    const keywords = this.extractKeywords(prompt);

    for (const ev of evidence) {
      // Find sentences in evidence that contain keywords
      const sentences = this.splitSentences(ev.text);

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const matchCount = keywords.filter((kw) =>
          sentence.toLowerCase().includes(kw.toLowerCase())
        ).length;

        if (matchCount > 0) {
          spans.push({
            text: sentence,
            evidenceId: ev.id,
            relevanceScore: matchCount / keywords.length,
            trustScore: ev.trustScore,
            position: i,
          });
        }
      }
    }

    // Rank by relevance × trust
    return spans
      .sort((a, b) => {
        const scoreA = a.relevanceScore * a.trustScore;
        const scoreB = b.relevanceScore * b.trustScore;
        return scoreB - scoreA;
      })
      .slice(0, 5); // Top 5 spans
  }

  /**
   * Stage 2: Generate with constraints
   *
   * CONSTRAINT FRAMEWORK:
   * - Cite-first: Force citation before each claim
   * - Span-copy: Prefer exact spans over paraphrase
   * - Structure: Enforce format (bullet/paragraph/table)
   * - Numeric: Enforce precision and units
   *
   * TODO: Replace with actual constraint decoding library (LMQL/Outlines/Guidance)
   * For now, use template-based generation
   */
  private async generateConstrained(
    prompt: string,
    spans: EvidenceSpan[],
    constraints: DecodingConstraints
  ): Promise<string> {
    // Build template with citations
    const template = this.buildTemplate(prompt, spans, constraints);

    // For now, return template-based result
    // TODO: Replace with actual LLM call + constraint decoding
    return template;
  }

  /**
   * Build template with cite-first structure
   */
  private buildTemplate(
    prompt: string,
    spans: EvidenceSpan[],
    constraints: DecodingConstraints
  ): string {
    const parts: string[] = [];

    if (constraints.structureFormat === 'bullet') {
      // Bullet format
      for (let i = 0; i < Math.min(spans.length, 5); i++) {
        const span = spans[i];
        parts.push(`• [Evidence ${i + 1}] ${span.text}`);
      }
      return parts.join('\n');
    } else if (constraints.structureFormat === 'paragraph') {
      // Paragraph format with citations
      for (let i = 0; i < Math.min(spans.length, 3); i++) {
        const span = spans[i];
        if (constraints.spanCopyOnly) {
          // Direct copy
          parts.push(`${span.text} [${span.evidenceId}]`);
        } else {
          // Allow paraphrase (but cite)
          parts.push(`Based on evidence, ${span.text.toLowerCase()} [${span.evidenceId}]`);
        }
      }
      return parts.join(' ');
    } else {
      // Default: concatenate spans
      return spans.map((s) => s.text).join(' ');
    }
  }

  /**
   * Extract citations from generated text
   */
  private extractCitations(text: string, spans: EvidenceSpan[]): Citation[] {
    const citations: Citation[] = [];

    // Find citation markers (e.g., [evidenceId])
    const citationPattern = /\[([^\]]+)\]/g;
    let match;

    while ((match = citationPattern.exec(text)) !== null) {
      const evidenceId = match[1];
      const position = match.index;

      // Find corresponding span
      const span = spans.find((s) => s.evidenceId === evidenceId);
      if (span) {
        citations.push({
          text: span.text,
          evidenceId,
          position,
          type: 'direct', // Assume direct for now
        });
      }
    }

    return citations;
  }

  /**
   * Get list of applied constraints
   */
  private getAppliedConstraints(constraints: DecodingConstraints): string[] {
    const applied: string[] = [];

    if (constraints.citationMandatory) {
      applied.push('citation_mandatory');
    }
    if (constraints.spanCopyOnly) {
      applied.push('span_copy_only');
    }
    if (constraints.structureFormat) {
      applied.push(`structure_${constraints.structureFormat}`);
    }
    if (constraints.numericFormat) {
      applied.push(`numeric_${constraints.numericFormat}`);
    }

    return applied;
  }

  /**
   * Extract keywords from prompt (simple version)
   */
  private extractKeywords(text: string): string[] {
    // Remove stop words and extract nouns/verbs
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'should', 'could', 'may', 'might', 'must', 'can', 'what',
      'when', 'where', 'why', 'how', 'which', 'who', 'whom', 'whose',
    ]);

    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word))
      .slice(0, 10); // Top 10 keywords
  }

  /**
   * Split text into sentences
   */
  private splitSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Verify generation against evidence (comprehensive)
   *
   * Checks:
   * 1. All claims are supported by evidence (NLI)
   * 2. All citations are valid
   * 3. No forbidden patterns (e.g., "I think", "maybe")
   */
  async verify(result: GenerationResult, evidence: Evidence[]): Promise<VerificationResult> {
    const issues: string[] = [];

    // Check 1: NLI verification
    if (this.config.nliGateEnabled && !result.nliVerified) {
      issues.push('NLI verification failed - some sentences not entailed by evidence');
    }

    // Check 2: Citation validity
    const validEvidenceIds = new Set(evidence.map((e) => e.id));
    const invalidCitations = result.citations.filter(
      (c) => !validEvidenceIds.has(c.evidenceId)
    );

    if (invalidCitations.length > 0) {
      issues.push(`${invalidCitations.length} invalid citations found`);
    }

    // Check 3: Forbidden patterns
    const forbiddenPatterns = [
      /I think/i,
      /maybe/i,
      /perhaps/i,
      /possibly/i,
      /it seems/i,
      /apparently/i,
    ];

    for (const pattern of forbiddenPatterns) {
      if (pattern.test(result.text)) {
        issues.push(`Forbidden pattern detected: ${pattern.source}`);
      }
    }

    // Check 4: Citation coverage
    const citationCount = result.citations.length;
    const sentenceCount = this.splitSentences(result.text).length;

    if (this.config.citationMandatory && citationCount === 0) {
      issues.push('No citations found (citation_mandatory is enabled)');
    }

    const citationDensity = sentenceCount > 0 ? citationCount / sentenceCount : 0;
    if (citationDensity < 0.3) {
      issues.push(`Low citation density: ${citationDensity.toFixed(2)} (expected ≥0.3)`);
    }

    return {
      valid: issues.length === 0,
      issues,
      score: Math.max(0, 1 - issues.length * 0.2), // Penalty per issue
    };
  }

  /**
   * Get configuration
   */
  getConfig(): EvidenceLockedConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<EvidenceLockedConfig>): void {
    this.config = { ...this.config, ...config };
    this.nliGate.getStatus(); // Ensure NLI Gate is initialized
  }
}

/**
 * Evidence span with metadata
 */
interface EvidenceSpan {
  text: string;
  evidenceId: string;
  relevanceScore: number; // 0-1
  trustScore: number; // 0-1
  position: number;
}

/**
 * Verification result
 */
export interface VerificationResult {
  valid: boolean;
  issues: string[];
  score: number; // 0-1
}

/**
 * Default singleton instance
 */
export const evidenceLockedDecoder = new EvidenceLockedDecoder();
