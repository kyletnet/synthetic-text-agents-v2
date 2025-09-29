// Enhanced retriever with BM25 scoring and fallback to Jaccard similarity.
// Provides much better semantic matching while maintaining dependency-free design.

import type { Chunk } from "./chunk.js";

export interface RetrieveOptions {
  topK?: number; // number of results
  minScore?: number; // filter low matches
  algorithm?: "bm25" | "jaccard"; // scoring algorithm
  k1?: number; // BM25 term frequency saturation parameter
  b?: number; // BM25 document length normalization parameter
}

export interface RetrievalItem {
  id: string;
  score: number;
  chunk: Chunk;
  algorithm: string;
}

interface TermStats {
  termFreq: Map<string, number>; // term frequency in document
  docLength: number; // document length in tokens
}

const DEFAULTS: Required<RetrieveOptions> = {
  topK: 5,
  minScore: 0.01,
  algorithm: "bm25",
  k1: 1.5, // BM25 k1 parameter
  b: 0.75, // BM25 b parameter
};

export function retrieve(
  query: string,
  corpus: Chunk[],
  options: RetrieveOptions = {},
): RetrievalItem[] {
  const cfg = { ...DEFAULTS, ...options };
  if (!query?.trim() || !Array.isArray(corpus) || corpus.length === 0)
    return [];

  const queryTokens = toTokens(query);
  const results: RetrievalItem[] = [];

  if (cfg.algorithm === "bm25") {
    // Precompute corpus statistics for BM25
    const corpusStats = computeCorpusStats(corpus);
    const avgDocLength = corpusStats.avgDocLength;
    const docFreq = corpusStats.docFreq;

    for (const chunk of corpus) {
      const score = bm25Score(queryTokens, chunk, docFreq, avgDocLength, cfg.k1, cfg.b, corpus.length);
      results.push({
        id: chunk.id,
        score,
        chunk,
        algorithm: "bm25"
      });
    }
  } else {
    // Fallback to Jaccard similarity
    for (const chunk of corpus) {
      const score = jaccard(queryTokens, toTokens(chunk.text));
      results.push({
        id: chunk.id,
        score,
        chunk,
        algorithm: "jaccard"
      });
    }
  }

  return results
    .filter((r) => r.score >= cfg.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, cfg.topK);
}

function toTokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(/[^a-z0-9가-힣]+/g)
    .filter(Boolean);
}

function computeCorpusStats(corpus: Chunk[]): {
  avgDocLength: number;
  docFreq: Map<string, number>;
} {
  let totalTokens = 0;
  const docFreq = new Map<string, number>();

  for (const chunk of corpus) {
    const tokens = toTokens(chunk.text);
    totalTokens += tokens.length;

    // Count unique terms in this document
    const uniqueTerms = new Set(tokens);
    for (const term of uniqueTerms) {
      docFreq.set(term, (docFreq.get(term) || 0) + 1);
    }
  }

  return {
    avgDocLength: corpus.length > 0 ? totalTokens / corpus.length : 0,
    docFreq,
  };
}

function computeTermStats(chunk: Chunk): TermStats {
  const tokens = toTokens(chunk.text);
  const termFreq = new Map<string, number>();

  for (const token of tokens) {
    termFreq.set(token, (termFreq.get(token) || 0) + 1);
  }

  return {
    termFreq,
    docLength: tokens.length,
  };
}

function bm25Score(
  queryTokens: string[],
  chunk: Chunk,
  docFreq: Map<string, number>,
  avgDocLength: number,
  k1: number,
  b: number,
  corpusSize: number,
): number {
  const termStats = computeTermStats(chunk);
  let score = 0;

  for (const term of queryTokens) {
    const tf = termStats.termFreq.get(term) || 0;
    const df = docFreq.get(term) || 0;

    if (tf === 0) continue;

    // IDF calculation: log((N - df + 0.5) / (df + 0.5))
    const idf = Math.log((corpusSize - df + 0.5) / (df + 0.5));

    // BM25 term score: IDF * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (|D| / avgdl)))
    const termScore = idf *
      (tf * (k1 + 1)) /
      (tf + k1 * (1 - b + b * (termStats.docLength / avgDocLength)));

    score += termScore;
  }

  return Math.max(0, score); // Ensure non-negative scores
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}
