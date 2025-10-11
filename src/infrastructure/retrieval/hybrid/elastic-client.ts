/**
 * Elasticsearch Client
 *
 * Phase 3 Week 4: Real Elasticsearch Integration with BM25F
 *
 * Features:
 * - BM25F ranking with field boosting
 * - Korean morphological analysis (nori_tokenizer)
 * - Multi-field search (title, heading, body, table)
 * - Metadata filtering
 * - Connection pooling
 *
 * Setup:
 *   Option 1 (Docker):
 *     docker run -d -p 9200:9200 -e "discovery.type=single-node" \
 *       -e "xpack.security.enabled=false" elasticsearch:8.12.0
 *
 *   Option 2 (Elastic Cloud):
 *     https://cloud.elastic.co/registration (14-day trial)
 *
 * @see designs/rfc/rfc-integrate-multimodal-rag-augmentation.md (Section 4)
 */

import { Client } from '@elastic/elasticsearch';
import type { SearchEngine, SearchQuery, SearchResult, ElasticsearchConfig } from './types';

/**
 * Default Elasticsearch Configuration
 */
const DEFAULT_CONFIG: Partial<ElasticsearchConfig> = {
  indexName: 'hybrid-search-documents',
  fieldBoosts: {
    title: 2.0,
    heading: 1.5,
    body: 1.0,
    table: 1.2,
  },
};

/**
 * Elasticsearch Client Implementation
 */
export class ElasticsearchClient implements SearchEngine {
  private client: Client;
  private config: Required<ElasticsearchConfig>;
  private indexCreated: boolean = false;

  constructor(config: ElasticsearchConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      fieldBoosts: {
        ...DEFAULT_CONFIG.fieldBoosts,
        ...config.fieldBoosts,
      },
    } as Required<ElasticsearchConfig>;

    this.client = new Client({
      node: this.config.url,
      auth: this.config.apiKey ? {
        apiKey: this.config.apiKey,
      } : undefined,
      // Connection settings
      maxRetries: 3,
      requestTimeout: 30000,
      sniffOnStart: false,
    });
  }

  /**
   * Create index with Korean analyzer
   */
  private async ensureIndex(): Promise<void> {
    if (this.indexCreated) return;

    try {
      const exists = await this.client.indices.exists({
        index: this.config.indexName,
      });

      if (!exists) {
        await this.client.indices.create({
          index: this.config.indexName,
          settings: {
            analysis: {
              analyzer: {
                korean_analyzer: {
                  type: 'custom',
                  tokenizer: 'nori_tokenizer',
                  filter: ['lowercase', 'nori_part_of_speech'],
                },
              },
              tokenizer: {
                nori_tokenizer: {
                  type: 'nori_tokenizer',
                  decompound_mode: 'mixed',
                },
              },
            },
            number_of_shards: 1,
            number_of_replicas: 0,
          },
          mappings: {
            properties: {
              content: {
                type: 'text',
                analyzer: 'korean_analyzer',
              },
              title: {
                type: 'text',
                analyzer: 'korean_analyzer',
                // Note: boost is applied at query time, not mapping time (ES 5.x+)
              },
              heading: {
                type: 'text',
                analyzer: 'korean_analyzer',
              },
              body: {
                type: 'text',
                analyzer: 'korean_analyzer',
              },
              table: {
                type: 'text',
                analyzer: 'korean_analyzer',
              },
              metadata: {
                type: 'object',
                enabled: true,
              },
            },
          },
        });
      }

      this.indexCreated = true;
    } catch (error) {
      throw new Error(`Failed to create Elasticsearch index: ${error}`);
    }
  }

  /**
   * Index documents
   */
  async index(
    documents: Array<{ id: string; content: string; metadata?: Record<string, unknown> }>
  ): Promise<void> {
    await this.ensureIndex();

    const operations = documents.flatMap(doc => [
      { index: { _index: this.config.indexName, _id: doc.id } },
      {
        content: doc.content,
        // Extract fields for boosting
        title: this.extractField(doc.content, doc.metadata, 'title'),
        heading: this.extractField(doc.content, doc.metadata, 'heading'),
        body: this.extractField(doc.content, doc.metadata, 'body'),
        table: this.extractField(doc.content, doc.metadata, 'table'),
        metadata: doc.metadata || {},
      },
    ]);

    try {
      const response = await this.client.bulk({
        refresh: true,
        operations,
      });

      if (response.errors) {
        const errors = response.items.filter(item => item.index?.error);
        console.warn(`Elasticsearch bulk indexing had ${errors.length} errors`);
      }
    } catch (error) {
      throw new Error(`Failed to index documents: ${error}`);
    }
  }

  /**
   * Search documents using multi-match query with BM25F
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    await this.ensureIndex();

    try {
      const response = await this.client.search({
        index: this.config.indexName,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query: query.query,
                  fields: [
                    `title^${this.config.fieldBoosts.title}`,
                    `heading^${this.config.fieldBoosts.heading}`,
                    `body^${this.config.fieldBoosts.body}`,
                    `table^${this.config.fieldBoosts.table}`,
                    'content',
                  ],
                  type: 'best_fields',
                  tie_breaker: 0.3,
                  analyzer: 'korean_analyzer',
                },
              },
            ],
            filter: this.buildFilters(query.filters),
          },
        },
        size: query.k || 10,
        min_score: query.minScore,
      });

      return response.hits.hits.map(hit => ({
        id: hit._id!,
        score: hit._score || 0,
        content: (hit._source as any).content,
        metadata: (hit._source as any).metadata || {},
      }));
    } catch (error) {
      throw new Error(`Elasticsearch search failed: ${error}`);
    }
  }

  /**
   * Close client
   */
  async close(): Promise<void> {
    await this.client.close();
  }

  /**
   * Delete index (for testing)
   */
  async deleteIndex(): Promise<void> {
    try {
      await this.client.indices.delete({
        index: this.config.indexName,
      });
      this.indexCreated = false;
    } catch (error) {
      // Index might not exist, ignore
    }
  }

  /**
   * Get client info
   */
  async info(): Promise<any> {
    return await this.client.info();
  }

  // Private helper methods

  private extractField(
    content: string,
    metadata: Record<string, unknown> | undefined,
    field: 'title' | 'heading' | 'body' | 'table'
  ): string {
    // Extract from metadata if available
    if (metadata) {
      if (field === 'title' && metadata.sectionTitle) {
        return String(metadata.sectionTitle);
      }
      if (field === 'table' && metadata.type === 'table') {
        return content;
      }
    }

    // Fallback: extract from content
    if (field === 'title' || field === 'heading') {
      // Extract first line or markdown header
      const firstLine = content.split('\n')[0];
      if (firstLine.startsWith('#')) {
        return firstLine.replace(/^#+\s*/, '');
      }
      return firstLine;
    }

    return content;
  }

  private buildFilters(filters?: Record<string, unknown>): any[] {
    if (!filters) return [];

    return Object.entries(filters).map(([key, value]) => ({
      term: { [`metadata.${key}`]: value },
    }));
  }
}

/**
 * Create Elasticsearch client
 */
export function createElasticsearchClient(config: ElasticsearchConfig): ElasticsearchClient {
  return new ElasticsearchClient(config);
}

/**
 * Check Elasticsearch connection
 */
export async function checkElasticsearchConnection(url: string): Promise<boolean> {
  const client = new Client({ node: url });

  try {
    const info = await client.info();
    await client.close();
    return info.version !== undefined;
  } catch (error) {
    return false;
  }
}
