// Vector embedding infrastructure for future semantic search capabilities.
// Currently focuses on embedding generation with multiple provider support.

import { Logger } from "../shared/logger.js";
import type { Chunk } from "./chunk.js";

export interface EmbeddingVector {
  id: string;
  chunkId: string;
  vector: number[];
  model: string;
  createdAt: Date;
  meta?: Record<string, unknown>;
}

export interface EmbeddingProvider {
  name: string;
  model: string;
  dimensions: number;
  maxTokens: number;
  embed(texts: string[]): Promise<number[][]>;
  estimateCost(tokenCount: number): number;
}

export interface EmbeddingConfig {
  enabled: boolean;
  provider: "openai" | "local" | "mock";
  model: string;
  batchSize: number;
  cacheEnabled: boolean;
  storePath?: string;
}

export interface EmbeddingStats {
  totalEmbeddings: number;
  modelsUsed: string[];
  totalCost: number;
  cacheHitRate: number;
}

/**
 * Vector Embedding Manager
 *
 * Handles generation and storage of vector embeddings for chunks.
 * Designed for future integration with semantic search while
 * maintaining current BM25 functionality.
 */
export class EmbeddingManager {
  private config: EmbeddingConfig;
  private logger: Logger;
  private provider: EmbeddingProvider | null = null;
  private embeddings: Map<string, EmbeddingVector> = new Map();
  private stats: EmbeddingStats;
  private isEnabled: boolean;

  constructor(config: EmbeddingConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.isEnabled =
      process.env.FEATURE_VECTOR_EMBEDDINGS === "true" && config.enabled;
    this.stats = {
      totalEmbeddings: 0,
      modelsUsed: [],
      totalCost: 0,
      cacheHitRate: 0,
    };

    this.logger.trace({
      level: "info",
      agentId: "embedding-manager",
      action: "manager_initialized",
      data: {
        enabled: this.isEnabled,
        provider: config.provider,
        featureFlag: process.env.FEATURE_VECTOR_EMBEDDINGS,
      },
    });
  }

  async initialize(): Promise<void> {
    if (!this.isEnabled) {
      this.logger.trace({
        level: "info",
        agentId: "embedding-manager",
        action: "initialization_skipped",
        data: { reason: "embeddings disabled" },
      });
      return;
    }

    try {
      this.provider = await this.createProvider();

      this.logger.trace({
        level: "info",
        agentId: "embedding-manager",
        action: "initialization_completed",
        data: {
          provider: this.provider.name,
          model: this.provider.model,
          dimensions: this.provider.dimensions,
        },
      });
    } catch (error) {
      this.logger.trace({
        level: "error",
        agentId: "embedding-manager",
        action: "initialization_failed",
        data: { provider: this.config.provider },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async generateEmbeddings(chunks: Chunk[]): Promise<EmbeddingVector[]> {
    if (!this.isEnabled || !this.provider) {
      return [];
    }

    const start = Date.now();
    const results: EmbeddingVector[] = [];

    try {
      // Process in batches to avoid API limits
      const batches = this.createBatches(chunks);

      for (const batch of batches) {
        const batchResults = await this.processBatch(batch);
        results.push(...batchResults);
      }

      // Update statistics
      this.stats.totalEmbeddings += results.length;
      if (!this.stats.modelsUsed.includes(this.provider.model)) {
        this.stats.modelsUsed.push(this.provider.model);
      }

      this.logger.trace({
        level: "info",
        agentId: "embedding-manager",
        action: "embeddings_generated",
        data: {
          chunkCount: chunks.length,
          embeddingCount: results.length,
          provider: this.provider.name,
        },
        duration: Date.now() - start,
      });

      return results;
    } catch (error) {
      this.logger.trace({
        level: "error",
        agentId: "embedding-manager",
        action: "embedding_generation_failed",
        data: { chunkCount: chunks.length },
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });
      throw error;
    }
  }

  async findSimilar(
    queryEmbedding: number[],
    topK: number = 5,
    minSimilarity: number = 0.7,
  ): Promise<Array<{ embedding: EmbeddingVector; similarity: number }>> {
    if (!this.isEnabled || this.embeddings.size === 0) {
      return [];
    }

    const results: Array<{ embedding: EmbeddingVector; similarity: number }> =
      [];

    for (const embedding of this.embeddings.values()) {
      const similarity = this.cosineSimilarity(
        queryEmbedding,
        embedding.vector,
      );
      if (similarity >= minSimilarity) {
        results.push({ embedding, similarity });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  }

  storeEmbedding(embedding: EmbeddingVector): void {
    this.embeddings.set(embedding.chunkId, embedding);
  }

  getEmbedding(chunkId: string): EmbeddingVector | undefined {
    return this.embeddings.get(chunkId);
  }

  /**
   * Remove embedding for a specific chunk
   */
  removeEmbedding(chunkId: string): boolean {
    return this.embeddings.delete(chunkId);
  }

  /**
   * Remove all embeddings for chunks from a specific document
   *
   * @param documentPath - Source document path to match in chunk metadata
   * @returns Number of embeddings removed
   */
  removeEmbeddingsForDocument(documentPath: string): number {
    let removed = 0;
    const pathPrefix = documentPath.replace(/[^a-zA-Z0-9]/g, "_");

    for (const chunkId of this.embeddings.keys()) {
      // Check if embedding's chunk belongs to this document
      if (chunkId.startsWith(pathPrefix)) {
        this.embeddings.delete(chunkId);
        removed++;
      }
    }

    this.logger.trace({
      level: "info",
      agentId: "embedding-manager",
      action: "embeddings_removed",
      data: {
        documentPath,
        embeddingsRemoved: removed,
        remainingEmbeddings: this.embeddings.size,
      },
    });

    return removed;
  }

  getStats(): EmbeddingStats & { enabled: boolean } {
    return {
      ...this.stats,
      enabled: this.isEnabled,
    };
  }

  private async createProvider(): Promise<EmbeddingProvider> {
    switch (this.config.provider) {
      case "openai":
        return new OpenAIEmbeddingProvider(this.config.model, this.logger);
      case "local":
        return new LocalEmbeddingProvider(this.config.model, this.logger);
      case "mock":
        return new MockEmbeddingProvider(this.config.model, this.logger);
      default:
        throw new Error(`Unknown embedding provider: ${this.config.provider}`);
    }
  }

  private createBatches(chunks: Chunk[]): Chunk[][] {
    const batches: Chunk[][] = [];
    for (let i = 0; i < chunks.length; i += this.config.batchSize) {
      batches.push(chunks.slice(i, i + this.config.batchSize));
    }
    return batches;
  }

  private async processBatch(chunks: Chunk[]): Promise<EmbeddingVector[]> {
    if (!this.provider) {
      throw new Error("Provider not initialized");
    }

    const texts = chunks.map((chunk) => chunk.content || chunk.text);
    const vectors = await this.provider.embed(texts);

    return chunks.map((chunk, index) => {
      if (!this.provider) {
        throw new Error("Provider not initialized");
      }
      return {
        id: `emb_${chunk.id}_${Date.now()}`,
        chunkId: chunk.id,
        vector: vectors[index],
        model: this.provider.model,
        createdAt: new Date(),
        meta: {
          provider: this.provider.name,
          dimensions: vectors[index].length,
        },
      };
    });
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    return norm === 0 ? 0 : dotProduct / norm;
  }
}

// Provider implementations

class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = "openai";
  model: string;
  dimensions: number;
  maxTokens: number;
  private logger: Logger;

  constructor(model: string = "text-embedding-3-small", logger: Logger) {
    this.model = model;
    this.dimensions = model.includes("large") ? 3072 : 1536;
    this.maxTokens = 8191;
    this.logger = logger;
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Check if API key is available
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      this.logger.trace({
        level: "warn",
        agentId: "openai-embedding-provider",
        action: "missing_api_key_fallback_to_mock",
        data: {
          textCount: texts.length,
          reason: "OPENAI_API_KEY not set - using mock embeddings",
        },
      });

      // Fallback to mock vectors
      return texts.map(() =>
        Array.from({ length: this.dimensions }, () => Math.random() - 0.5),
      );
    }

    try {
      // Dynamic import to avoid dependency issues if package not installed
      const OpenAI = (await import("openai")).default;

      const openai = new OpenAI({ apiKey });

      this.logger.trace({
        level: "info",
        agentId: "openai-embedding-provider",
        action: "embedding_request_started",
        data: {
          textCount: texts.length,
          model: this.model,
          totalChars: texts.reduce((sum, t) => sum + t.length, 0),
        },
      });

      const response = await openai.embeddings.create({
        model: this.model,
        input: texts,
        encoding_format: "float",
      });

      const embeddings = response.data.map((item: any) => item.embedding);

      this.logger.trace({
        level: "info",
        agentId: "openai-embedding-provider",
        action: "embedding_request_completed",
        data: {
          textCount: texts.length,
          embeddingsCount: embeddings.length,
          dimensions: embeddings[0]?.length ?? 0,
          tokensUsed: response.usage.total_tokens,
          estimatedCost: this.estimateCost(response.usage.total_tokens),
        },
      });

      return embeddings;
    } catch (error) {
      this.logger.trace({
        level: "error",
        agentId: "openai-embedding-provider",
        action: "embedding_request_failed",
        data: {
          textCount: texts.length,
          error: String(error),
          fallbackToMock: true,
        },
      });

      // Fallback to mock on error
      console.error(
        `❌ OpenAI embedding failed, falling back to mock: ${error}`,
      );
      return texts.map(() =>
        Array.from({ length: this.dimensions }, () => Math.random() - 0.5),
      );
    }
  }

  estimateCost(tokenCount: number): number {
    // OpenAI embedding pricing (as of 2025)
    // text-embedding-3-small: $0.00002 / 1K tokens
    // text-embedding-3-large: $0.00013 / 1K tokens
    const pricePerToken = this.model.includes("large")
      ? 0.00013 / 1000
      : 0.00002 / 1000;
    return tokenCount * pricePerToken;
  }
}

class LocalEmbeddingProvider implements EmbeddingProvider {
  name = "local";
  model: string;
  dimensions = 384; // Common for local models
  maxTokens = 512;
  private logger: Logger;
  private pythonEnvManager: any = null;
  private pythonProcessManager: any = null;
  private isInitialized = false;

  constructor(
    model: string = "sentence-transformers/all-MiniLM-L6-v2",
    logger: Logger,
  ) {
    this.model = model;
    this.logger = logger;
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Lazy initialization
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        // Fallback to mock if initialization failed
        return this.mockEmbeddings(texts);
      }
    }

    try {
      // Use Python bridge for real embeddings
      const embeddings = await this.pythonProcessManager.embed(
        texts,
        this.model,
      );

      // Update dimensions from actual embeddings
      if (embeddings.length > 0 && embeddings[0].length > 0) {
        this.dimensions = embeddings[0].length;
      }

      this.logger.trace({
        level: "info",
        agentId: "local-embedding-provider",
        action: "embeddings_generated",
        data: {
          textCount: texts.length,
          dimensions: this.dimensions,
          model: this.model,
        },
      });

      return embeddings;
    } catch (error) {
      this.logger.trace({
        level: "error",
        agentId: "local-embedding-provider",
        action: "embedding_generation_failed",
        data: {
          textCount: texts.length,
          fallbackToMock: true,
        },
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to mock on error
      return this.mockEmbeddings(texts);
    }
  }

  /**
   * Initialize Python environment and process
   */
  private async initialize(): Promise<boolean> {
    try {
      // Dynamic import to avoid circular dependencies
      const { PythonEnvironmentManager } = await import(
        "./python-env-manager.js"
      );
      const { PythonProcessManager } = await import(
        "./python-process-manager.js"
      );

      this.pythonEnvManager = new PythonEnvironmentManager(this.logger);

      this.logger.trace({
        level: "info",
        agentId: "local-embedding-provider",
        action: "python_setup_started",
        data: { model: this.model },
      });

      // Setup Python environment (install dependencies if needed)
      const pythonEnv = await this.pythonEnvManager.setup();

      if (!pythonEnv.available || !pythonEnv.dependenciesInstalled) {
        this.logger.trace({
          level: "warn",
          agentId: "local-embedding-provider",
          action: "python_setup_failed",
          data: {
            available: pythonEnv.available,
            dependenciesInstalled: pythonEnv.dependenciesInstalled,
          },
        });
        return false;
      }

      // Start Python process
      this.pythonProcessManager = new PythonProcessManager(
        this.logger,
        pythonEnv,
      );
      await this.pythonProcessManager.start();

      this.isInitialized = true;

      this.logger.trace({
        level: "info",
        agentId: "local-embedding-provider",
        action: "python_setup_completed",
        data: {
          pythonVersion: pythonEnv.version,
          model: this.model,
        },
      });

      return true;
    } catch (error) {
      this.logger.trace({
        level: "error",
        agentId: "local-embedding-provider",
        action: "python_initialization_failed",
        data: {},
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Generate mock embeddings (fallback)
   */
  private mockEmbeddings(texts: string[]): number[][] {
    this.logger.trace({
      level: "warn",
      agentId: "local-embedding-provider",
      action: "mock_embeddings_returned",
      data: {
        textCount: texts.length,
        reason: "Python bridge unavailable",
      },
    });

    return texts.map(() =>
      Array.from({ length: this.dimensions }, () => Math.random() - 0.5),
    );
  }

  estimateCost(_tokenCount: number): number {
    return 0; // Local inference is free
  }

  /**
   * Cleanup Python process
   */
  async cleanup(): Promise<void> {
    if (this.pythonProcessManager) {
      await this.pythonProcessManager.shutdown();
    }
  }
}

class MockEmbeddingProvider implements EmbeddingProvider {
  name = "mock";
  model: string;
  dimensions = 256;
  maxTokens = 1000;
  private _logger: Logger;

  constructor(model: string = "mock-v1", logger: Logger) {
    this.model = model;
    this._logger = logger;
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Generate deterministic mock vectors based on text content
    return texts.map((text) => {
      const hash = this.simpleHash(text);
      return Array.from({ length: this.dimensions }, (_, i) => {
        return Math.sin(hash + i) * 0.5; // Deterministic but varied
      });
    });
  }

  estimateCost(_tokenCount: number): number {
    return 0; // Mock provider is free
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }
}
