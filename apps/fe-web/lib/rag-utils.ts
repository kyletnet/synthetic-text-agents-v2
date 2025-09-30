// Simple in-memory RAG implementation for real document processing

export interface Document {
  id: string;
  filename: string;
  content: string;
  uploadedAt: Date;
}

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  metadata: {
    filename: string;
    chunkIndex: number;
  };
}

export interface SearchResult {
  chunk: Chunk;
  score: number;
  algorithm: string;
}

// In-memory storage (in production, use a real database)
// Use globalThis to persist across hot reloads in development
declare global {
  var __ragDocuments: Document[] | undefined;
  var __ragChunks: Chunk[] | undefined;
}

const documents = globalThis.__ragDocuments ?? [];
const chunks = globalThis.__ragChunks ?? [];

if (!globalThis.__ragDocuments) {
  globalThis.__ragDocuments = documents;
}
if (!globalThis.__ragChunks) {
  globalThis.__ragChunks = chunks;
}

export class RAGSystem {
  // Document management
  static addDocument(filename: string, content: string): Document {
    const doc: Document = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      filename,
      content,
      uploadedAt: new Date(),
    };

    documents.push(doc);
    globalThis.__ragDocuments = documents;

    // Create chunks
    const docChunks = this.chunkDocument(doc);
    chunks.push(...docChunks);
    globalThis.__ragChunks = chunks;

    return doc;
  }

  static getDocuments(): Document[] {
    return documents;
  }

  static deleteDocument(docId: string): boolean {
    const docIndex = documents.findIndex((d) => d.id === docId);
    if (docIndex === -1) return false;

    documents.splice(docIndex, 1);
    globalThis.__ragDocuments = documents;

    const filteredChunks = chunks.filter((c) => c.documentId !== docId);
    chunks.length = 0;
    chunks.push(...filteredChunks);
    globalThis.__ragChunks = chunks;
    return true;
  }

  // Text chunking
  static chunkDocument(doc: Document): Chunk[] {
    const content = doc.content;
    const chunks: Chunk[] = [];

    // Smart chunking by paragraphs and sentences
    const paragraphs = content
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 0);

    let chunkIndex = 0;
    for (const paragraph of paragraphs) {
      // Split long paragraphs into smaller chunks
      const sentences = paragraph
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 20);

      if (sentences.length <= 3) {
        // Small paragraph - keep as one chunk
        chunks.push({
          id: `chunk_${doc.id}_${chunkIndex}`,
          documentId: doc.id,
          content: paragraph.trim(),
          index: chunkIndex,
          metadata: {
            filename: doc.filename,
            chunkIndex,
          },
        });
        chunkIndex++;
      } else {
        // Large paragraph - split into smaller chunks
        for (let i = 0; i < sentences.length; i += 3) {
          const chunkSentences = sentences.slice(i, i + 3);
          const chunkContent = chunkSentences.join(". ").trim() + ".";

          chunks.push({
            id: `chunk_${doc.id}_${chunkIndex}`,
            documentId: doc.id,
            content: chunkContent,
            index: chunkIndex,
            metadata: {
              filename: doc.filename,
              chunkIndex,
            },
          });
          chunkIndex++;
        }
      }
    }

    return chunks;
  }

  // BM25 Search implementation
  static search(query: string, topK: number = 5): SearchResult[] {
    if (!query.trim()) return [];

    const queryTerms = this.tokenize(query.toLowerCase());
    const results: SearchResult[] = [];

    for (const chunk of chunks) {
      const score = this.calculateBM25Score(queryTerms, chunk);
      if (score > 0) {
        results.push({
          chunk,
          score,
          algorithm: "bm25",
        });
      }
    }

    // Sort by score and return top K
    return results.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  // Simple BM25 implementation
  private static calculateBM25Score(
    queryTerms: string[],
    chunk: Chunk,
  ): number {
    const k1 = 1.2;
    const b = 0.75;

    const docTerms = this.tokenize(chunk.content.toLowerCase());
    const docLength = docTerms.length;
    const avgDocLength =
      chunks.reduce(
        (sum, c) => sum + this.tokenize(c.content.toLowerCase()).length,
        0,
      ) / chunks.length;

    let score = 0;

    for (const term of queryTerms) {
      const termFreq = docTerms.filter((t) => t === term).length;
      if (termFreq === 0) continue;

      // IDF calculation
      const docsWithTerm = chunks.filter((c) =>
        this.tokenize(c.content.toLowerCase()).includes(term),
      ).length;
      const idf = Math.log(
        (chunks.length - docsWithTerm + 0.5) / (docsWithTerm + 0.5),
      );

      // BM25 formula
      const tf =
        (termFreq * (k1 + 1)) /
        (termFreq + k1 * (1 - b + b * (docLength / avgDocLength)));

      score += idf * tf;
    }

    return score;
  }

  // Simple tokenization
  private static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2);
  }

  // Statistics
  static getStats() {
    return {
      enabled: true,
      documentsCount: documents.length,
      chunksCount: chunks.length,
      ragStats: {
        enabled: true,
        documentsCount: documents.length,
        chunksCount: chunks.length,
      },
      embeddingStats: {
        enabled: false,
        totalEmbeddings: 0,
        modelsUsed: [],
      },
    };
  }

  // Get chunks for QA context
  static getRelevantContext(query: string, maxChunks: number = 3): string {
    const results = this.search(query, maxChunks);

    if (results.length === 0) {
      return "";
    }

    return results
      .map((result, index) => `[Context ${index + 1}]\n${result.chunk.content}`)
      .join("\n\n");
  }
}
