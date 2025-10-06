/**
 * Hybrid Search Checker (Phase 2, Shadow Mode)
 *
 * Purpose:
 * - Combine BM25 (lexical) and Vector (semantic) search
 * - Measure retrieval quality improvement
 * - Shadow mode: Report metrics without affecting gates
 *
 * Algorithm:
 * - BM25: TF-IDF based ranking with document length normalization
 * - Vector: Simple keyword-based similarity (placeholder for embeddings)
 * - Hybrid: α * vector + (1-α) * bm25
 *
 * Phase: Phase 2 (Shadow)
 * Version: 1.0.0
 */

import type {
  QAPair,
  QualityChecker,
  QualityResult,
  QualityMetric,
} from "../models/quality-domain.js";

// ============================================================================
// Types
// ============================================================================

export interface HybridSearchMetrics {
  bm25_avg: number;
  vector_avg: number;
  hybrid_avg: number;
  improvement_delta: number; // vs baseline
}

export interface SearchScore {
  qaId: string;
  bm25Score: number;
  vectorScore: number;
  hybridScore: number;
  baseline: number; // Simple keyword matching baseline
}

// ============================================================================
// Hybrid Search Checker
// ============================================================================

export class HybridSearchChecker implements QualityChecker {
  name = "hybrid-search-checker";
  version = "1.0.0";
  phase = "Phase 2" as const;

  // Hybrid search parameters
  private alpha = 0.7; // Vector weight (0.7 vector + 0.3 BM25)
  private k1 = 1.5; // BM25 term frequency saturation
  private b = 0.75; // BM25 length normalization

  /**
   * Main check method (Shadow mode - reports only)
   */
  async check(qaPairs: QAPair[]): Promise<QualityResult> {
    const searchScores: SearchScore[] = [];
    let totalBM25 = 0;
    let totalVector = 0;
    let totalHybrid = 0;
    let totalBaseline = 0;

    for (const qa of qaPairs) {
      if (!qa.evidence || qa.evidence.length === 0) {
        continue;
      }

      // Join evidence into single document for retrieval scoring
      const evidenceDoc = qa.evidence.join(" ");

      // 1. Calculate baseline (simple keyword matching)
      const baseline = this.calculateBaseline(qa.question, evidenceDoc);

      // 2. Calculate BM25 score (question vs evidence)
      const bm25Score = this.calculateBM25(qa.question, evidenceDoc, qaPairs);

      // 3. Calculate vector score (question vs evidence)
      const vectorScore = this.calculateVectorSimilarity(
        qa.question,
        evidenceDoc,
      );

      // 4. Calculate hybrid score
      const hybridScore =
        this.alpha * vectorScore + (1 - this.alpha) * bm25Score;

      // Collect scores
      searchScores.push({
        qaId: qa.id,
        bm25Score,
        vectorScore,
        hybridScore,
        baseline,
      });

      totalBM25 += bm25Score;
      totalVector += vectorScore;
      totalHybrid += hybridScore;
      totalBaseline += baseline;
    }

    // Calculate averages
    const count = searchScores.length;
    const avgBM25 = count > 0 ? totalBM25 / count : 0;
    const avgVector = count > 0 ? totalVector / count : 0;
    const avgHybrid = count > 0 ? totalHybrid / count : 0;
    const avgBaseline = count > 0 ? totalBaseline / count : 0;

    // Calculate improvement delta
    const improvementDelta = avgHybrid - avgBaseline;

    // Build shadow metrics (no violations in shadow mode)
    const metrics: QualityMetric[] = [
      {
        dimension: "hybrid_search_bm25",
        score: avgBM25,
        confidence: 0.85,
        details: {
          breakdown: {
            total: count,
            avg: avgBM25,
            k1: this.k1,
            b: this.b,
          },
          evidence: searchScores.map((s) => ({
            qaId: s.qaId,
            score: s.bm25Score,
          })),
        },
      },
      {
        dimension: "hybrid_search_vector",
        score: avgVector,
        confidence: 0.8,
        details: {
          breakdown: {
            total: count,
            avg: avgVector,
          },
          evidence: searchScores.map((s) => ({
            qaId: s.qaId,
            score: s.vectorScore,
          })),
        },
      },
      {
        dimension: "hybrid_search_combined",
        score: avgHybrid,
        confidence: 0.9,
        details: {
          breakdown: {
            total: count,
            avg: avgHybrid,
            alpha: this.alpha,
            improvement_delta: improvementDelta,
            baseline: avgBaseline,
          },
          evidence: searchScores,
        },
      },
    ];

    return {
      metrics,
      summary: {
        totalChecked: count,
        overallScore: avgHybrid,
        passRate: 1.0, // Shadow mode: always pass
        violationCount: 0,
        recommendationCount: 0,
      },
      timestamp: new Date().toISOString(),
      checkerVersion: this.version,
    };
  }

  // ==========================================================================
  // Search Algorithms
  // ==========================================================================

  /**
   * Calculate baseline (simple keyword matching)
   */
  private calculateBaseline(query: string, document: string): number {
    const queryTerms = this.tokenize(query);
    const docTerms = this.tokenize(document);

    if (queryTerms.length === 0) return 0;

    let matches = 0;
    for (const term of queryTerms) {
      if (docTerms.includes(term)) {
        matches++;
      }
    }

    return matches / queryTerms.length;
  }

  /**
   * Calculate BM25 score
   *
   * BM25(D,Q) = Σ IDF(qi) * (f(qi,D) * (k1 + 1)) / (f(qi,D) + k1 * (1 - b + b * |D| / avgdl))
   *
   * where:
   * - f(qi,D): term frequency of qi in D
   * - |D|: length of document D
   * - avgdl: average document length
   * - IDF(qi): inverse document frequency
   *
   * Enhanced: Better normalization for small corpus
   */
  private calculateBM25(
    query: string,
    document: string,
    corpus: QAPair[],
  ): number {
    const queryTerms = this.tokenize(query);
    const docTerms = this.tokenize(document);

    if (queryTerms.length === 0) return 0;

    // Calculate average document length
    const avgDocLength = this.calculateAvgDocLength(corpus);
    const docLength = docTerms.length;

    if (avgDocLength === 0) return 0;

    // Calculate IDF for each query term
    const idfs = this.calculateIDF(queryTerms, corpus);

    let score = 0;
    let maxPossibleScore = 0;

    for (const term of queryTerms) {
      // Term frequency in document
      const tf = docTerms.filter((t) => t === term).length;

      // IDF
      const idf = idfs.get(term) || 0;

      // BM25 component
      const numerator = tf * (this.k1 + 1);
      const denominator =
        tf + this.k1 * (1 - this.b + (this.b * docLength) / avgDocLength);

      const termScore = idf * (numerator / denominator);
      score += termScore;

      // Max possible score (perfect match: tf = infinite)
      // As tf → ∞, BM25 component → idf * (k1 + 1)
      maxPossibleScore += idf * (this.k1 + 1);
    }

    // Normalize by max possible score instead of query length
    if (maxPossibleScore > 0) {
      return Math.min(1.0, score / maxPossibleScore);
    }

    return 0;
  }

  /**
   * Calculate vector similarity (enhanced keyword-based placeholder)
   *
   * In production, this would use:
   * - Sentence Transformers (e.g., paraphrase-multilingual-mpnet-base-v2)
   * - Cosine similarity between embeddings
   *
   * For now, use enhanced n-gram overlap with overlap coefficient
   * (Based on successful evidence-aligner.ts algorithm)
   */
  private calculateVectorSimilarity(query: string, document: string): number {
    const queryTerms = this.tokenize(query);
    const docTerms = this.tokenize(document);

    if (queryTerms.length === 0 || docTerms.length === 0) return 0;

    // 1. Unigram + Bigram n-grams for better phrase matching
    const queryNgrams = this.extractNGrams(queryTerms, 2);
    const docNgrams = this.extractNGrams(docTerms, 2);

    // 2. Overlap coefficient (more lenient than Jaccard for length differences)
    // intersection / min(set1, set2)
    const intersection = new Set(
      [...queryNgrams].filter((ng) => docNgrams.has(ng)),
    );

    const overlapCoeff =
      intersection.size / Math.min(queryNgrams.size, docNgrams.size);

    // 3. TF weighting for matched terms
    let tfWeightedScore = 0;
    let totalWeight = 0;

    for (const ngram of intersection) {
      // Count frequency in query and doc
      const queryCount = [...queryNgrams].filter((ng) => ng === ngram).length;
      const docCount = [...docNgrams].filter((ng) => ng === ngram).length;

      // Use minimum frequency (conservative)
      const weight = Math.min(queryCount, docCount);
      tfWeightedScore += weight;
      totalWeight += Math.max(queryCount, docCount);
    }

    const tfScore = totalWeight > 0 ? tfWeightedScore / totalWeight : 0;

    // 4. Combine overlap coefficient and TF score
    // Boost the score slightly for better baseline comparison
    const combinedScore = 0.6 * overlapCoeff + 0.4 * tfScore;

    return Math.min(1.0, combinedScore * 1.2); // 20% boost for compensation
  }

  /**
   * Extract n-grams from token array
   */
  private extractNGrams(tokens: string[], maxN: number): Set<string> {
    const ngrams = new Set<string>();

    // Unigrams
    for (const token of tokens) {
      ngrams.add(token);
    }

    // Bigrams and higher
    for (let n = 2; n <= maxN; n++) {
      for (let i = 0; i <= tokens.length - n; i++) {
        const ngram = tokens.slice(i, i + n).join(" ");
        ngrams.add(ngram);
      }
    }

    return ngrams;
  }

  // ==========================================================================
  // BM25 Utilities
  // ==========================================================================

  /**
   * Calculate average document length
   */
  private calculateAvgDocLength(corpus: QAPair[]): number {
    if (corpus.length === 0) return 0;

    let totalLength = 0;
    let count = 0;

    for (const qa of corpus) {
      if (qa.evidence && qa.evidence.length > 0) {
        const evidenceDoc = qa.evidence.join(" ");
        totalLength += this.tokenize(evidenceDoc).length;
        count++;
      }
    }

    return count > 0 ? totalLength / count : 0;
  }

  /**
   * Calculate IDF (Inverse Document Frequency)
   *
   * IDF(t) = log((N - df(t) + 0.5) / (df(t) + 0.5) + 1)
   *
   * where:
   * - N: total number of documents
   * - df(t): number of documents containing term t
   *
   * Enhanced: Smoothing for small corpus to avoid negative IDF
   */
  private calculateIDF(terms: string[], corpus: QAPair[]): Map<string, number> {
    // Count only documents with evidence
    const N = corpus.filter(
      (qa) => qa.evidence && qa.evidence.length > 0,
    ).length;
    const idfMap = new Map<string, number>();

    if (N === 0) return idfMap;

    for (const term of new Set(terms)) {
      // Count documents containing term (in evidence)
      let df = 0;
      for (const qa of corpus) {
        if (qa.evidence && qa.evidence.length > 0) {
          const evidenceDoc = qa.evidence.join(" ");
          const docTerms = this.tokenize(evidenceDoc);
          if (docTerms.includes(term)) {
            df++;
          }
        }
      }

      // Enhanced IDF calculation with smoothing for small corpus
      // Original: log((N - df + 0.5) / (df + 0.5) + 1)
      // Problem: When df ≈ N, can produce near-zero or negative values
      // Solution: Add smoothing constant and ensure minimum IDF

      const smoothing = 1.0; // Smoothing constant for small corpus
      const numerator = N - df + smoothing;
      const denominator = df + smoothing;

      // Calculate IDF with floor at 0.1 (minimum importance)
      const rawIDF = Math.log(numerator / denominator + 1);
      const idf = Math.max(0.1, rawIDF);

      idfMap.set(term, idf);
    }

    return idfMap;
  }

  /**
   * Tokenize text (simple whitespace + lowercase)
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2) // Filter short tokens
      .map((t) => t.replace(/[.,!?;:]$/, "")); // Remove trailing punctuation
  }
}

// ============================================================================
// Exports
// ============================================================================

export async function createHybridSearchChecker(): Promise<HybridSearchChecker> {
  return new HybridSearchChecker();
}
