/**
 * Mock Search Clients for Development & Testing
 *
 * Purpose:
 * - Enable E2E development without external dependencies
 * - Fast iteration on Hybrid Search flow
 * - Will be replaced with real Elasticsearch & FAISS clients
 *
 * Usage:
 *   const elastic = new MockElasticsearchClient();
 *   const faiss = new MockFAISSClient();
 *   const engine = new HybridSearchEngine({ elastic, faiss });
 *
 * @see src/infrastructure/retrieval/hybrid/README.md
 */

import type { SearchEngine, SearchQuery, SearchResult } from './types';

/**
 * Mock Elasticsearch Client (BM25F simulation)
 */
export class MockElasticsearchClient implements SearchEngine {
  private documents: Map<string, SearchResult> = new Map();
  private documentTexts: Map<string, string> = new Map();

  async index(
    documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    for (const doc of documents) {
      this.documents.set(doc.id, {
        id: doc.id,
        score: 0,
        content: doc.content,
        metadata: doc.metadata || {},
      });
      this.documentTexts.set(doc.id, doc.content.toLowerCase());
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const queryTerms = this.tokenize(query.query.toLowerCase());

    // Handle empty query or k=0
    if (queryTerms.length === 0 || (query.k !== undefined && query.k <= 0)) {
      return [];
    }

    const scores: Array<{ id: string; score: number }> = [];

    // BM25F-like scoring (simplified)
    for (const [id, text] of this.documentTexts.entries()) {
      let score = 0;

      for (const term of queryTerms) {
        if (text.includes(term)) {
          // Term frequency boost
          const tf = (text.match(new RegExp(term, 'g')) || []).length;
          const docLength = Math.max(text.split(/\s+/).filter(w => w.length > 0).length, 1);
          const avgDocLength = this.getAverageDocLength();

          // BM25 formula (simplified)
          const k1 = 1.5;
          const b = 0.75;
          const idf = Math.log(this.documents.size / (this.getDocFreq(term) + 1));

          const numerator = tf * (k1 + 1);
          const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));

          if (denominator > 0) {
            score += idf * (numerator / denominator);
          }
        }
      }

      // Ensure score is a valid number
      if (score > 0 && !isNaN(score) && isFinite(score)) {
        scores.push({ id, score });
      }
    }

    // Sort by score (descending)
    scores.sort((a, b) => b.score - a.score);

    // Apply filters
    let results = scores
      .map(({ id, score }) => {
        const doc = this.documents.get(id)!;
        return { ...doc, score };
      })
      .filter(result => {
        if (query.filters) {
          for (const [key, value] of Object.entries(query.filters)) {
            if (result.metadata[key] !== value) {
              return false;
            }
          }
        }
        return true;
      });

    // Apply min score filter
    if (query.minScore) {
      results = results.filter(r => r.score >= query.minScore!);
    }

    // Return top K
    return results.slice(0, query.k || 10);
  }

  async close(): Promise<void> {
    this.documents.clear();
    this.documentTexts.clear();
  }

  // Helper methods
  private tokenize(text: string): string[] {
    if (!text || text.trim().length === 0) return [];
    return text.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  }

  private getAverageDocLength(): number {
    if (this.documentTexts.size === 0) return 100; // Default average

    const totalLength = Array.from(this.documentTexts.values())
      .map(text => text.split(/\s+/).filter(w => w.length > 0).length)
      .reduce((sum, len) => sum + len, 0);

    const avgLength = totalLength / this.documentTexts.size;
    return avgLength > 0 ? avgLength : 100; // Avoid division by zero
  }

  private getDocFreq(term: string): number {
    let count = 0;
    for (const text of this.documentTexts.values()) {
      if (text.includes(term)) {
        count++;
      }
    }
    return count;
  }
}

/**
 * Mock FAISS Client (Cosine Similarity simulation)
 */
export class MockFAISSClient implements SearchEngine {
  private documents: Map<string, SearchResult> = new Map();
  private embeddings: Map<string, number[]> = new Map();

  async index(
    documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    for (const doc of documents) {
      this.documents.set(doc.id, {
        id: doc.id,
        score: 0,
        content: doc.content,
        metadata: doc.metadata || {},
      });

      // Generate mock embedding (simple word count vector)
      this.embeddings.set(doc.id, this.generateEmbedding(doc.content));
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    // Handle k=0
    if (query.k !== undefined && query.k <= 0) {
      return [];
    }

    const queryEmbedding = this.generateEmbedding(query.query);
    const scores: Array<{ id: string; score: number }> = [];

    // Cosine similarity
    for (const [id, docEmbedding] of this.embeddings.entries()) {
      const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);

      // Ensure score is valid
      if (!isNaN(similarity) && isFinite(similarity)) {
        scores.push({ id, score: similarity });
      }
    }

    // Sort by similarity (descending)
    scores.sort((a, b) => b.score - a.score);

    // Apply filters
    let results = scores
      .map(({ id, score }) => {
        const doc = this.documents.get(id)!;
        return { ...doc, score };
      })
      .filter(result => {
        if (query.filters) {
          for (const [key, value] of Object.entries(query.filters)) {
            if (result.metadata[key] !== value) {
              return false;
            }
          }
        }
        return true;
      });

    // Apply min score filter
    if (query.minScore) {
      results = results.filter(r => r.score >= query.minScore!);
    }

    // Return top K
    return results.slice(0, query.k || 10);
  }

  async close(): Promise<void> {
    this.documents.clear();
    this.embeddings.clear();
  }

  // Helper methods
  private generateEmbedding(text: string): number[] {
    // Simple word frequency vector (mock embedding)
    const words = text.toLowerCase().split(/\s+/);
    const vocab = ['아이돌봄', '서비스', '요금', '지원', '신청', '대상', '기준', '소득', '정부', '가족'];

    const embedding = new Array(vocab.length).fill(0);

    for (const word of words) {
      const index = vocab.indexOf(word);
      if (index !== -1) {
        embedding[index]++;
      }
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
  }
}

/**
 * Create mock clients for testing
 */
export function createMockClients(): {
  elastic: MockElasticsearchClient;
  faiss: MockFAISSClient;
} {
  return {
    elastic: new MockElasticsearchClient(),
    faiss: new MockFAISSClient(),
  };
}
