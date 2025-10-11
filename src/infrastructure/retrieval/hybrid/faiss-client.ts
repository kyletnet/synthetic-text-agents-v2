/**
 * FAISS Client (using Vectra)
 *
 * Phase 3 Week 4: Real Vector Search with HNSW Index
 *
 * Features:
 * - HNSW (Hierarchical Navigable Small World) index
 * - Multilingual-E5 embeddings via Transformers.js
 * - Cosine similarity search
 * - Persistent storage
 * - GPU-free operation (M1/M2 Mac compatible)
 *
 * Why Vectra instead of faiss-node:
 * - Pure JavaScript (no native compilation issues)
 * - M1/M2 Mac compatible
 * - Faster setup and deployment
 * - HNSW algorithm support
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 4)
 */

import * as fs from 'fs';
import * as path from 'path';
import { LocalIndex } from 'vectra';
import { pipeline } from '@xenova/transformers';
import type { SearchEngine, SearchQuery, SearchResult, FAISSConfig } from './types';

/**
 * Default FAISS Configuration
 */
const DEFAULT_CONFIG: Partial<FAISSConfig> = {
  embeddingModel: 'Xenova/multilingual-e5-small', // Smaller, faster model
  dimension: 384, // multilingual-e5-small dimension
  metric: 'cosine',
};

/**
 * FAISS Client Implementation (using Vectra)
 */
export class FAISSClient implements SearchEngine {
  private config: Required<FAISSConfig>;
  private vectorIndex: LocalIndex;
  private embedder: any;
  private embedderReady: Promise<void>;
  private documents: Map<string, SearchResult> = new Map();

  constructor(config: FAISSConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as Required<FAISSConfig>;

    // Ensure index directory exists
    const indexDir = path.dirname(this.config.indexPath);
    if (!fs.existsSync(indexDir)) {
      fs.mkdirSync(indexDir, { recursive: true });
    }

    // Initialize Vectra index
    this.vectorIndex = new LocalIndex(this.config.indexPath);

    // Initialize embedder
    this.embedderReady = this.initializeEmbedder();
  }

  /**
   * Initialize embedding model
   */
  private async initializeEmbedder(): Promise<void> {
    try {
      console.log(`Loading embedding model: ${this.config.embeddingModel}...`);
      this.embedder = await pipeline('feature-extraction', this.config.embeddingModel);
      console.log('✅ Embedding model loaded');
    } catch (error) {
      throw new Error(`Failed to load embedding model: ${error}`);
    }
  }

  /**
   * Generate embedding for text
   */
  private async embed(text: string): Promise<number[]> {
    await this.embedderReady;

    try {
      const output = await this.embedder(text, {
        pooling: 'mean',
        normalize: true,
      });

      // Convert to array
      const embedding = Array.from(output.data) as number[];

      return embedding.slice(0, this.config.dimension);
    } catch (error) {
      throw new Error(`Embedding generation failed: ${error}`);
    }
  }

  /**
   * Index documents
   */
  async index(
    documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    await this.embedderReady;

    // Create index if it doesn't exist
    if (!await this.vectorIndex.isIndexCreated()) {
      await this.vectorIndex.createIndex();
    }

    // Index documents
    for (const doc of documents) {
      // Store document
      this.documents.set(doc.id, {
        id: doc.id,
        score: 0,
        content: doc.content,
        metadata: doc.metadata || {},
      });

      // Generate embedding
      const embedding = await this.embed(doc.content);

      // Add to index
      await this.vectorIndex.insertItem({
        id: doc.id,
        vector: embedding,
        metadata: {
          content: doc.content,
          ...doc.metadata,
        },
      });
    }
  }

  /**
   * Search using vector similarity
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    await this.embedderReady;

    if (!await this.vectorIndex.isIndexCreated()) {
      return [];
    }

    try {
      // Generate query embedding
      const queryEmbedding = await this.embed(query.query);

      // Search
      const results = await this.vectorIndex.queryItems(
        queryEmbedding,
        query.query, // Original query text
        query.k || 10
      );

      // Convert to SearchResult format
      const searchResults: SearchResult[] = results.map(result => {
        const doc = this.documents.get(result.item.id);

        if (!doc) {
          return {
            id: result.item.id,
            score: result.score,
            content: (result.item.metadata as any).content || '',
            metadata: result.item.metadata || {},
          };
        }

        return {
          ...doc,
          score: result.score,
        };
      });

      // Apply filters
      let filtered = searchResults;

      if (query.filters) {
        filtered = searchResults.filter(result => {
          for (const [key, value] of Object.entries(query.filters!)) {
            if (result.metadata[key] !== value) {
              return false;
            }
          }
          return true;
        });
      }

      // Apply min score filter
      if (query.minScore) {
        filtered = filtered.filter(r => r.score >= query.minScore!);
      }

      return filtered;
    } catch (error) {
      throw new Error(`FAISS search failed: ${error}`);
    }
  }

  /**
   * Close client
   */
  async close(): Promise<void> {
    // Vectra doesn't require explicit closing
    this.documents.clear();
  }

  /**
   * Delete index (for testing)
   */
  async deleteIndex(): Promise<void> {
    try {
      if (fs.existsSync(this.config.indexPath)) {
        fs.rmSync(this.config.indexPath, { recursive: true, force: true });
      }
      this.documents.clear();
    } catch (error) {
      console.warn('Failed to delete index:', error);
    }
  }

  /**
   * Get index stats
   */
  async getStats(): Promise<{ totalDocuments: number; indexSize: string }> {
    const totalDocuments = this.documents.size;

    let indexSize = '0 B';
    try {
      if (fs.existsSync(this.config.indexPath)) {
        const stats = fs.statSync(this.config.indexPath);
        indexSize = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
      }
    } catch (error) {
      // Ignore
    }

    return {
      totalDocuments,
      indexSize,
    };
  }
}

/**
 * Create FAISS client
 */
export function createFAISSClient(config: FAISSConfig): FAISSClient {
  return new FAISSClient(config);
}
