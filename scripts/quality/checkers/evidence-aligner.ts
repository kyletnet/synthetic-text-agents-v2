/**
 * Evidence-Answer Alignment Checker (Phase 2)
 *
 * Purpose:
 * - Measure alignment between evidence and generated answers
 * - Detect hallucination and unsupported claims
 * - Calculate citation presence and precision
 *
 * Metrics:
 * 1. snippet_alignment: Evidence와 답변 간 문장 단위 매칭도
 * 2. citation_presence: 인용 존재 여부
 * 3. context_precision: Evidence 중 실제 사용된 비율
 * 4. context_recall: 필요한 정보가 Evidence에 포함된 비율
 *
 * Phase: Phase 2
 * Version: 1.0.0
 */

import type {
  QAPair,
  QualityChecker,
  QualityResult,
  QualityMetric,
  Violation,
} from "../models/quality-domain.js";

// ============================================================================
// Types
// ============================================================================

export interface EvidenceMetrics {
  snippet_alignment: number; // 0~1
  citation_presence: number; // 0~1
  context_precision: number; // 0~1
  context_recall: number; // 0~1
  retrieval_quality_score: number; // 종합 점수
}

export interface AlignmentDetail {
  qaId: string;
  evidenceUsageRate: number; // Evidence 활용 비율
  matchedSnippets: string[]; // 매칭된 Evidence 조각
  hallucinations: string[]; // 근거 없는 주장
  citations: string[]; // 인용된 증거
}

// ============================================================================
// Evidence Aligner
// ============================================================================

export class EvidenceAligner implements QualityChecker {
  name = "evidence-aligner";
  version = "1.0.0";
  phase = "Phase 2" as const;

  /**
   * Main check method
   */
  async check(qaPairs: QAPair[]): Promise<QualityResult> {
    const metrics: QualityMetric[] = [];
    const violations: Violation[] = [];
    const alignmentDetails: AlignmentDetail[] = [];

    let totalSnippetAlignment = 0;
    let totalCitationPresence = 0;
    let totalContextPrecision = 0;
    let totalContextRecall = 0;

    for (const qa of qaPairs) {
      if (!qa.evidence || qa.evidence.length === 0) {
        // No evidence provided, skip
        continue;
      }

      // 1. Calculate snippet alignment
      const snippetAlignment = this.calculateSnippetAlignment(
        qa.answer,
        qa.evidence,
      );

      // 2. Check citation presence
      const citationPresence = this.checkCitationPresence(
        qa.answer,
        qa.evidence,
      );

      // 3. Calculate context precision (Evidence 중 사용된 비율)
      const contextPrecision = this.calculateContextPrecision(
        qa.answer,
        qa.evidence,
      );

      // 4. Calculate context recall (필요 정보 포함도)
      const contextRecall = this.calculateContextRecall(qa.answer, qa.evidence);

      // Collect details
      const detail: AlignmentDetail = {
        qaId: qa.id,
        evidenceUsageRate: contextPrecision,
        matchedSnippets: this.findMatchedSnippets(qa.answer, qa.evidence),
        hallucinations: this.detectHallucinations(qa.answer, qa.evidence),
        citations: this.extractCitations(qa.answer, qa.evidence),
      };

      alignmentDetails.push(detail);

      // Accumulate scores
      totalSnippetAlignment += snippetAlignment;
      totalCitationPresence += citationPresence;
      totalContextPrecision += contextPrecision;
      totalContextRecall += contextRecall;

      // Generate violations for low alignment
      if (snippetAlignment < 0.6) {
        violations.push({
          id: `align-${qa.id}`,
          severity: "high",
          category: "evidence_alignment",
          description: `답변과 Evidence 정렬도가 낮습니다 (${(
            snippetAlignment * 100
          ).toFixed(1)}%)`,
          location: { qaId: qa.id, field: "answer" },
          suggestion: "Evidence에 기반한 답변으로 수정하세요",
        });
      }

      // Hallucination detection
      if (detail.hallucinations.length > 0) {
        violations.push({
          id: `halluc-${qa.id}`,
          severity: "critical",
          category: "hallucination",
          description: `근거 없는 주장 ${detail.hallucinations.length}개 발견`,
          location: { qaId: qa.id, field: "answer" },
          suggestion: "Evidence에 포함된 내용만 사용하세요",
        });
      }
    }

    // Calculate averages
    const count = qaPairs.filter((qa) => qa.evidence?.length).length;
    const avgSnippetAlignment = count > 0 ? totalSnippetAlignment / count : 0;
    const avgCitationPresence = count > 0 ? totalCitationPresence / count : 0;
    const avgContextPrecision = count > 0 ? totalContextPrecision / count : 0;
    const avgContextRecall = count > 0 ? totalContextRecall / count : 0;

    // Calculate retrieval quality score (weighted average)
    const retrievalQualityScore =
      avgSnippetAlignment * 0.4 +
      avgCitationPresence * 0.2 +
      avgContextPrecision * 0.2 +
      avgContextRecall * 0.2;

    // Build metrics
    metrics.push(
      {
        dimension: "snippet_alignment",
        score: avgSnippetAlignment,
        confidence: 0.85,
        details: {
          violations: violations.filter(
            (v) => v.category === "evidence_alignment",
          ),
          breakdown: {
            total: count,
            avg: avgSnippetAlignment,
          },
        },
      },
      {
        dimension: "citation_presence",
        score: avgCitationPresence,
        confidence: 0.9,
        details: {
          breakdown: {
            total: count,
            avg: avgCitationPresence,
          },
        },
      },
      {
        dimension: "context_precision",
        score: avgContextPrecision,
        confidence: 0.8,
        details: {
          breakdown: {
            total: count,
            avg: avgContextPrecision,
          },
        },
      },
      {
        dimension: "context_recall",
        score: avgContextRecall,
        confidence: 0.8,
        details: {
          breakdown: {
            total: count,
            avg: avgContextRecall,
          },
        },
      },
      {
        dimension: "retrieval_quality_score",
        score: retrievalQualityScore,
        confidence: 0.85,
        details: {
          violations: violations.filter((v) => v.category === "hallucination"),
          breakdown: {
            snippet_alignment: avgSnippetAlignment,
            citation_presence: avgCitationPresence,
            context_precision: avgContextPrecision,
            context_recall: avgContextRecall,
          },
          evidence: alignmentDetails,
        },
      },
    );

    return {
      metrics,
      summary: {
        totalChecked: count,
        overallScore: retrievalQualityScore,
        passRate: this.calculatePassRate(count, violations.length),
        violationCount: violations.length,
        recommendationCount: 0,
      },
      timestamp: new Date().toISOString(),
      checkerVersion: this.version,
    };
  }

  // ==========================================================================
  // Alignment Algorithms
  // ==========================================================================

  /**
   * Calculate snippet alignment (문장 단위 매칭)
   *
   * Algorithm:
   * 1. Split answer into sentences
   * 2. For each sentence, find best matching evidence snippet
   * 3. Use keyword overlap and semantic similarity (simplified)
   * 4. Return average alignment score
   *
   * Enhancement: Also check against combined evidence for better recall
   */
  private calculateSnippetAlignment(
    answer: string,
    evidence: string[],
  ): number {
    const answerSentences = this.splitIntoSentences(answer);
    if (answerSentences.length === 0) return 0;

    // Combine evidence for holistic matching
    const combinedEvidence = evidence.join(" ");

    let totalAlignment = 0;

    for (const sentence of answerSentences) {
      let bestMatch = 0;

      // Check against individual evidence snippets
      for (const evidenceSnippet of evidence) {
        const similarity = this.calculateKeywordOverlap(
          sentence,
          evidenceSnippet,
        );
        bestMatch = Math.max(bestMatch, similarity);
      }

      // Also check against combined evidence (for cross-snippet matching)
      const combinedSimilarity = this.calculateKeywordOverlap(
        sentence,
        combinedEvidence,
      );
      bestMatch = Math.max(bestMatch, combinedSimilarity);

      totalAlignment += bestMatch;
    }

    return totalAlignment / answerSentences.length;
  }

  /**
   * Check citation presence (인용 존재 여부)
   */
  private checkCitationPresence(answer: string, evidence: string[]): number {
    // Check if answer contains any evidence snippets
    let citationCount = 0;

    for (const snippet of evidence) {
      // Extract key phrases from evidence
      const keyPhrases = this.extractKeyPhrases(snippet);

      for (const phrase of keyPhrases) {
        if (answer.includes(phrase)) {
          citationCount++;
          break; // Count each evidence once
        }
      }
    }

    return evidence.length > 0 ? citationCount / evidence.length : 0;
  }

  /**
   * Calculate context precision (Evidence 중 사용된 비율)
   */
  private calculateContextPrecision(
    answer: string,
    evidence: string[],
  ): number {
    let usedCount = 0;

    for (const snippet of evidence) {
      const keyPhrases = this.extractKeyPhrases(snippet);
      const isUsed = keyPhrases.some((phrase) => answer.includes(phrase));

      if (isUsed) {
        usedCount++;
      }
    }

    return evidence.length > 0 ? usedCount / evidence.length : 0;
  }

  /**
   * Calculate context recall (필요한 정보가 Evidence에 포함된 비율)
   *
   * Enhanced: Entity-based matching for better recall
   */
  private calculateContextRecall(answer: string, evidence: string[]): number {
    // Extract key entities from answer
    const answerEntities = this.extractEntities(answer);
    const evidenceText = evidence.join(" ");
    const evidenceEntities = this.extractEntities(evidenceText);

    // Count how many answer entities are found in evidence
    let totalEntities = 0;
    let foundEntities = 0;

    // Check numbers
    for (const num of answerEntities.numbers) {
      totalEntities++;
      if (evidenceEntities.numbers.has(num)) {
        foundEntities++;
      }
    }

    // Check amounts
    for (const amount of answerEntities.amounts) {
      totalEntities++;
      if (evidenceEntities.amounts.has(amount)) {
        foundEntities++;
      }
    }

    // If no entities, fall back to claim-based matching
    if (totalEntities === 0) {
      const answerClaims = this.extractClaims(answer);
      if (answerClaims.length === 0) return 1.0;

      let supportedCount = 0;

      for (const claim of answerClaims) {
        const isSupported = evidence.some((snippet) => {
          const similarity = this.calculateKeywordOverlap(claim, snippet);
          return similarity > 0.3; // Lower threshold for better recall
        });

        if (isSupported) {
          supportedCount++;
        }
      }

      return supportedCount / answerClaims.length;
    }

    // Entity-based recall
    return totalEntities > 0 ? foundEntities / totalEntities : 1.0;
  }

  /**
   * Find matched snippets
   */
  private findMatchedSnippets(answer: string, evidence: string[]): string[] {
    const matched: string[] = [];

    for (const snippet of evidence) {
      const keyPhrases = this.extractKeyPhrases(snippet);
      const isMatched = keyPhrases.some((phrase) => answer.includes(phrase));

      if (isMatched) {
        matched.push(snippet);
      }
    }

    return matched;
  }

  /**
   * Detect hallucinations (근거 없는 주장)
   *
   * Enhanced: Entity-based validation
   */
  private detectHallucinations(answer: string, evidence: string[]): string[] {
    const hallucinations: string[] = [];
    const answerEntities = this.extractEntities(answer);
    const evidenceText = evidence.join(" ");
    const evidenceEntities = this.extractEntities(evidenceText);

    // Check if answer contains entities not in evidence
    for (const num of answerEntities.numbers) {
      if (!evidenceEntities.numbers.has(num)) {
        hallucinations.push(`숫자 "${num}"이(가) Evidence에 없습니다`);
      }
    }

    for (const amount of answerEntities.amounts) {
      if (!evidenceEntities.amounts.has(amount)) {
        hallucinations.push(`금액 "${amount}"이(가) Evidence에 없습니다`);
      }
    }

    // Also check claim-based (for non-entity hallucinations)
    const claims = this.extractClaims(answer);
    for (const claim of claims) {
      // Skip if claim is too short
      if (claim.length < 10) continue;

      const isSupported = evidence.some((snippet) => {
        const similarity = this.calculateKeywordOverlap(claim, snippet);
        return similarity > 0.4; // Higher threshold for hallucination
      });

      if (!isSupported && !this.hasEntities(claim)) {
        // Only report if claim has no entities (entity-based already checked)
        hallucinations.push(claim);
      }
    }

    return hallucinations;
  }

  /**
   * Check if text has entities
   */
  private hasEntities(text: string): boolean {
    const entities = this.extractEntities(text);
    return (
      entities.numbers.size > 0 ||
      entities.amounts.size > 0 ||
      entities.dates.size > 0
    );
  }

  /**
   * Extract citations
   */
  private extractCitations(answer: string, evidence: string[]): string[] {
    const citations: string[] = [];

    for (const snippet of evidence) {
      const keyPhrases = this.extractKeyPhrases(snippet);

      for (const phrase of keyPhrases) {
        if (answer.includes(phrase)) {
          citations.push(phrase);
        }
      }
    }

    return citations;
  }

  // ==========================================================================
  // Text Processing Utilities
  // ==========================================================================

  /**
   * Split text into sentences
   *
   * Enhanced: Also split on commas for better granularity
   */
  private splitIntoSentences(text: string): string[] {
    // Split on period, comma, and conjunctions
    const sentences = text
      .split(/[.!?,]|(?:이며|하며|하고|그리고)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5); // Filter very short fragments

    return sentences.length > 0 ? sentences : [text];
  }

  /**
   * Extract key phrases (3+ char words)
   */
  private extractKeyPhrases(text: string): string[] {
    // Extract meaningful phrases (3+ characters)
    const words = text.split(/\s+/).filter((w) => w.length >= 3);

    // Simple n-gram extraction (2-3 words)
    const phrases: string[] = [];

    for (let i = 0; i < words.length; i++) {
      // Unigram
      phrases.push(words[i]);

      // Bigram
      if (i < words.length - 1) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }

      // Trigram
      if (i < words.length - 2) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }

    return phrases;
  }

  /**
   * Extract claims from answer
   */
  private extractClaims(answer: string): string[] {
    // Split into sentences as basic claims
    return this.splitIntoSentences(answer);
  }

  /**
   * Calculate keyword overlap (Enhanced with entity extraction + normalization)
   */
  private calculateKeywordOverlap(text1: string, text2: string): number {
    // 0. Normalize templates for better matching
    const normalized1 = this.normalizeTemplate(text1);
    const normalized2 = this.normalizeTemplate(text2);

    // 1. Extract entities (numbers, amounts, dates, key terms)
    const entities1 = this.extractEntities(normalized1);
    const entities2 = this.extractEntities(normalized2);

    // 2. Entity overlap score (높은 가중치)
    let entityScore = 0;
    if (entities1.numbers.size > 0 || entities2.numbers.size > 0) {
      const numberMatch = this.calculateSetOverlap(
        entities1.numbers,
        entities2.numbers,
      );
      entityScore += numberMatch * 0.4;
    }

    if (entities1.amounts.size > 0 || entities2.amounts.size > 0) {
      const amountMatch = this.calculateSetOverlap(
        entities1.amounts,
        entities2.amounts,
      );
      entityScore += amountMatch * 0.4;
    }

    // 3. N-gram overlap (use overlap coefficient instead of Jaccard)
    const ngrams1 = this.extractNGrams(normalized1, 2); // Only unigram + bigram
    const ngrams2 = this.extractNGrams(normalized2, 2);

    let keywordScore = 0;
    if (ngrams1.size > 0 && ngrams2.size > 0) {
      const intersection = new Set(
        [...ngrams1].filter((ng) => ngrams2.has(ng)),
      );
      // Overlap coefficient: intersection / min(set1, set2)
      // More lenient than Jaccard when one text is much longer
      keywordScore = intersection.size / Math.min(ngrams1.size, ngrams2.size);
    }

    // 4. Combine scores (balanced)
    // Entity와 keyword 균형 유지
    if (entityScore > 0) {
      // Entity가 있으면 entity + keyword balanced
      return Math.min(1.0, entityScore * 0.5 + keywordScore * 0.5);
    } else {
      // Entity 없으면 keyword만 사용하되 약간 boost
      return Math.min(1.0, keywordScore * 1.1);
    }
  }

  /**
   * Normalize template patterns for better matching
   *
   * Normalizations:
   * 1. "키: 값" → "키 값" (colon-based patterns)
   * 2. "키의 경우 값" → "키 값" (의 경우 removal)
   * 3. "값을 받을 수 있다" → "값" (trailing boilerplate removal)
   * 4. "와/과" → "와" (conjunction normalization)
   * 5. Multiple spaces → single space
   */
  private normalizeTemplate(text: string): string {
    let normalized = text;

    // 1. Colon-based patterns: "본인 결혼: 경조금 50만원, 휴가 5일"
    //    → "본인 결혼 경조금 50만원 휴가 5일"
    normalized = normalized.replace(/:\s*/g, " ");
    normalized = normalized.replace(/,\s*/g, " ");

    // 2. Remove common particles and boilerplate
    normalized = normalized.replace(/의\s*경우/g, "");
    normalized = normalized.replace(/에\s*대하여/g, "");
    normalized = normalized.replace(/에\s*대해/g, "");

    // 3. Remove trailing boilerplate (받을 수 있다, 부여한다 등)
    normalized = normalized.replace(/을\s*받을\s*수\s*있[습다으며]/g, "");
    normalized = normalized.replace(/를\s*받을\s*수\s*있[습다으며]/g, "");
    normalized = normalized.replace(/을\s*부여받을\s*수\s*있[습다으며]/g, "");
    normalized = normalized.replace(/를\s*부여받을\s*수\s*있[습다으며]/g, "");
    normalized = normalized.replace(/을\s*부여한다/g, "");
    normalized = normalized.replace(/를\s*부여한다/g, "");

    // 4. Normalize conjunctions
    normalized = normalized.replace(/과\s+/g, "와 ");

    // 5. Normalize "마다", "이며", "하며" → ""
    normalized = normalized.replace(/마다/g, "");
    normalized = normalized.replace(/이며/g, "");
    normalized = normalized.replace(/하며/g, "");

    // 6. Normalize "에게는" → "에게"
    normalized = normalized.replace(/에게는/g, "에게");

    // 7. Normalize multiple spaces
    normalized = normalized.replace(/\s+/g, " ");

    // 7. Trim
    return normalized.trim();
  }

  /**
   * Extract n-grams from text
   *
   * @param text Input text
   * @param maxN Maximum n-gram size (1 = unigram, 2 = bigram, 3 = trigram)
   * @param minN Minimum n-gram size (default = 1)
   * @returns Set of n-grams
   */
  private extractNGrams(text: string, maxN: number, minN = 1): Set<string> {
    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2);

    const ngrams = new Set<string>();

    for (let n = minN; n <= maxN; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const ngram = words.slice(i, i + n).join(" ");
        ngrams.add(ngram);
      }
    }

    return ngrams;
  }

  /**
   * Extract entities (numbers, amounts, dates)
   */
  private extractEntities(text: string): {
    numbers: Set<string>;
    amounts: Set<string>;
    dates: Set<string>;
  } {
    const numbers = new Set<string>();
    const amounts = new Set<string>();
    const dates = new Set<string>();

    // Extract numbers (일수, 개월 등)
    const numberPatterns = [
      /(\d+)일/g,
      /(\d+)개월/g,
      /(\d+)년/g,
      /(\d+)퍼센트/g,
      /(\d+)%/g,
      /(\d+)\s*회/g,
    ];

    for (const pattern of numberPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        numbers.add(match[1]);
      }
    }

    // Extract amounts (금액)
    const amountPatterns = [/(\d+)만원/g, /(\d+,\d+)원/g, /(\d+)원/g];

    for (const pattern of amountPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        amounts.add(match[1].replace(/,/g, ""));
      }
    }

    return { numbers, amounts, dates };
  }

  /**
   * Calculate set overlap
   */
  private calculateSetOverlap(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 && set2.size === 0) return 1.0;
    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter((item) => set2.has(item)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate pass rate
   */
  private calculatePassRate(total: number, violations: number): number {
    if (total === 0) return 1.0;
    return Math.max(0, (total - violations) / total);
  }
}

// ============================================================================
// Exports
// ============================================================================

export async function createEvidenceAligner(): Promise<EvidenceAligner> {
  return new EvidenceAligner();
}
