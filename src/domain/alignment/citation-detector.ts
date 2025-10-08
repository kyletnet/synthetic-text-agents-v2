/**
 * Citation Detector
 *
 * Detects direct quotes from evidence in answers.
 * Uses character-level n-gram matching (3-10 characters) to find exact matches.
 */

export interface CitationMatch {
  answerSpan: string;
  evidenceSpan: string;
  similarity: number;
  spanLength: number;
}

export class CitationDetector {
  /**
   * Detect direct quotes (3-gram or longer exact matches)
   *
   * Algorithm:
   * 1. Extract n-grams from answer (n=10 down to 3)
   * 2. Check if each n-gram exists in evidence
   * 3. Deduplicate matches (keep longest)
   *
   * @param answer - Answer text to check for quotes
   * @param evidence - Evidence text to match against
   * @param minNgramSize - Minimum n-gram size (default: 3)
   * @param maxNgramSize - Maximum n-gram size (default: 10)
   * @returns Array of citation matches
   */
  detectDirectQuotes(
    answer: string,
    evidence: string,
    minNgramSize: number = 3,
    maxNgramSize: number = 10,
  ): CitationMatch[] {
    const matches: CitationMatch[] = [];

    // 정규화 (공백 제거, 소문자 변환)
    const normalizedAnswer = this.normalizeText(answer);
    const normalizedEvidence = this.normalizeText(evidence);

    // n-gram 추출 (큰 것부터 작은 것 순서로)
    for (let n = maxNgramSize; n >= minNgramSize; n--) {
      const answerNgrams = this.extractNgrams(normalizedAnswer, n);

      for (const ngram of answerNgrams) {
        // Evidence에 존재하는지 확인
        if (normalizedEvidence.includes(ngram)) {
          // 원본 텍스트에서 해당 부분 추출
          const answerSpan = this.findOriginalSpan(answer, ngram);
          const evidenceSpan = this.findOriginalSpan(evidence, ngram);

          matches.push({
            answerSpan,
            evidenceSpan,
            similarity: 1.0, // 정확한 매칭
            spanLength: ngram.length,
          });
        }
      }
    }

    // 중복 제거 (긴 매칭이 짧은 매칭을 포함하면 짧은 것 제거)
    return this.deduplicateMatches(matches);
  }

  /**
   * Calculate direct quote ratio (quoted characters / total characters)
   *
   * @param answer - Answer text
   * @param evidence - Evidence text
   * @returns Ratio (0.0 - 1.0)
   */
  calculateDirectQuoteRatio(answer: string, evidence: string): number {
    const matches = this.detectDirectQuotes(answer, evidence);

    if (matches.length === 0) return 0;

    // 매칭된 문자 수 합산 (중복 제거)
    const totalMatchedChars = this.calculateTotalMatchedChars(matches);

    // 답변 전체 문자 수
    const answerLength = this.normalizeText(answer).length;

    return answerLength > 0 ? totalMatchedChars / answerLength : 0;
  }

  /**
   * Detect citation patterns (e.g., "문서에 따르면", "~라고 합니다")
   *
   * @param answer - Answer text
   * @returns True if citation pattern is detected
   */
  hasCitationPattern(answer: string): boolean {
    const citationPatterns = [
      /문서에\s*따르면/,
      /자료에\s*의하면/,
      /~라고\s*합니다/,
      /~라고\s*설명합니다/,
      /~라고\s*언급합니다/,
      /인용하면/,
      /~에\s*따르면/,
    ];

    return citationPatterns.some((pattern) => pattern.test(answer));
  }

  /**
   * Normalize text (remove whitespace, lowercase)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, "") // 공백 제거
      .trim();
  }

  /**
   * Extract character-level n-grams
   */
  private extractNgrams(text: string, n: number): string[] {
    const ngrams: string[] = [];

    for (let i = 0; i <= text.length - n; i++) {
      ngrams.push(text.substring(i, i + n));
    }

    return ngrams;
  }

  /**
   * Find original span in text (before normalization)
   *
   * Strategy:
   * 1. Remove spaces from both texts
   * 2. Find position in normalized text
   * 3. Map back to original text with spaces
   */
  private findOriginalSpan(
    originalText: string,
    normalizedNgram: string,
  ): string {
    const normalizedText = this.normalizeText(originalText);
    const startIndex = normalizedText.indexOf(normalizedNgram);

    if (startIndex === -1) return normalizedNgram; // fallback

    // 원본 텍스트에서 해당 부분 추출 (공백 포함)
    let charCount = 0;
    let originalStart = 0;
    let originalEnd = 0;

    for (let i = 0; i < originalText.length; i++) {
      const char = originalText[i];

      // 공백이 아닌 문자만 카운트
      if (!/\s/.test(char)) {
        if (charCount === startIndex) {
          originalStart = i;
        }
        if (charCount === startIndex + normalizedNgram.length - 1) {
          originalEnd = i + 1;
          break;
        }
        charCount++;
      }
    }

    return originalText.substring(originalStart, originalEnd);
  }

  /**
   * Deduplicate matches (keep longest matches, remove subsumed shorter ones)
   */
  private deduplicateMatches(matches: CitationMatch[]): CitationMatch[] {
    // 긴 매칭 우선 정렬
    const sorted = matches.sort((a, b) => b.spanLength - a.spanLength);
    const deduplicated: CitationMatch[] = [];

    for (const match of sorted) {
      // 이미 추가된 매칭에 포함되는지 확인
      const isSubsumed = deduplicated.some(
        (existing) =>
          existing.answerSpan.includes(match.answerSpan) ||
          this.normalizeText(existing.answerSpan).includes(
            this.normalizeText(match.answerSpan),
          ),
      );

      if (!isSubsumed) {
        deduplicated.push(match);
      }
    }

    return deduplicated;
  }

  /**
   * Calculate total matched characters (avoiding double counting)
   */
  private calculateTotalMatchedChars(matches: CitationMatch[]): number {
    // 중복 제거된 매칭의 길이 합산
    return matches.reduce((sum, match) => sum + match.spanLength, 0);
  }

  /**
   * Get citation statistics
   */
  getCitationStatistics(
    answer: string,
    evidence: string,
  ): {
    directQuoteRatio: number;
    matchCount: number;
    longestMatch: number;
    hasCitationPattern: boolean;
    matches: CitationMatch[];
  } {
    const matches = this.detectDirectQuotes(answer, evidence);
    const ratio = this.calculateDirectQuoteRatio(answer, evidence);
    const pattern = this.hasCitationPattern(answer);

    return {
      directQuoteRatio: ratio,
      matchCount: matches.length,
      longestMatch: matches.length > 0 ? matches[0].spanLength : 0,
      hasCitationPattern: pattern,
      matches,
    };
  }
}
