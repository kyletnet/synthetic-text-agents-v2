// RAG Factory - Centralized creation and configuration of RAG components
// Simplifies integration with existing system without major architectural changes

import { Logger } from "../shared/logger.js";
import { flag } from "../shared/env.js";
import { RAGService, type RAGConfig } from "./service.js";
import { EmbeddingManager, type EmbeddingConfig } from "./embeddings.js";
import {
  ContextInjector,
  type ContextInjectorConfig,
} from "../components/context-injector.js";
import { RAGPerformanceMonitor } from "./performance-monitor.js";

export interface RAGFactoryConfig {
  // Feature flags
  enableRAG: boolean;
  enableEmbeddings: boolean;

  // RAG service configuration
  ragConfig: RAGConfig;

  // Embedding configuration
  embeddingConfig: EmbeddingConfig;

  // Context injector configuration
  contextInjectorConfig: ContextInjectorConfig;
}

export interface RAGComponents {
  ragService: RAGService;
  embeddingManager: EmbeddingManager;
  contextInjector: ContextInjector;
  performanceMonitor: RAGPerformanceMonitor;
}

/**
 * RAG Factory
 *
 * Provides a centralized way to create and configure RAG components
 * with proper feature flag support and graceful degradation.
 */
export class RAGFactory {
  private static instance: RAGFactory | null = null;
  private logger: Logger;
  private config: RAGFactoryConfig;
  private components: RAGComponents | null = null;

  private constructor() {
    this.logger = new Logger();
    this.config = this.loadDefaultConfig();
  }

  static getInstance(): RAGFactory {
    if (!RAGFactory.instance) {
      RAGFactory.instance = new RAGFactory();
    }
    return RAGFactory.instance;
  }

  async initialize(): Promise<RAGComponents | null> {
    if (!this.config.enableRAG) {
      this.logger.trace({
        level: "info",
        agentId: "rag-factory",
        action: "initialization_skipped",
        data: { reason: "RAG disabled via feature flag" },
      });
      return null;
    }

    try {
      const start = Date.now();

      // Initialize RAG service
      const ragService = new RAGService(this.config.ragConfig, this.logger);
      await ragService.initialize();

      // Initialize embedding manager if enabled
      let embeddingManager: EmbeddingManager | null = null;
      if (this.config.enableEmbeddings) {
        embeddingManager = new EmbeddingManager(
          this.config.embeddingConfig,
          this.logger,
        );
        await embeddingManager.initialize();
      }

      // Initialize performance monitor
      const performanceMonitor = new RAGPerformanceMonitor(this.logger);

      // Initialize context injector
      const contextInjector = new ContextInjector(
        ragService,
        this.config.contextInjectorConfig,
        this.logger,
      );

      this.components = {
        ragService,
        embeddingManager:
          embeddingManager ||
          new EmbeddingManager(this.config.embeddingConfig, this.logger),
        contextInjector,
        performanceMonitor,
      };

      this.logger.trace({
        level: "info",
        agentId: "rag-factory",
        action: "initialization_completed",
        data: {
          ragEnabled: true,
          embeddingsEnabled: this.config.enableEmbeddings,
          documentsIndexed: ragService.getStats().documentsCount,
        },
        duration: Date.now() - start,
      });

      return this.components;
    } catch (error) {
      this.logger.trace({
        level: "error",
        agentId: "rag-factory",
        action: "initialization_failed",
        data: {},
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  getComponents(): RAGComponents | null {
    return this.components;
  }

  getRAGService(): RAGService | null {
    return this.components?.ragService || null;
  }

  getContextInjector(): ContextInjector | null {
    return this.components?.contextInjector || null;
  }

  isEnabled(): boolean {
    return this.config.enableRAG;
  }

  async addDocument(path: string, content?: string): Promise<void> {
    if (!this.components?.ragService) {
      throw new Error("RAG service not initialized");
    }

    // Step 1: Add document to RAG service (creates chunks)
    await this.components.ragService.addDocument(path, content);

    // Step 2: Generate embeddings if enabled
    if (this.config.enableEmbeddings && this.components.embeddingManager) {
      try {
        const start = Date.now();

        // Get chunks for the newly added document
        const chunks = this.components.ragService.getDocumentChunks(path);

        if (!chunks || chunks.length === 0) {
          this.logger.trace({
            level: "warn",
            agentId: "rag-factory",
            action: "embedding_generation_skipped",
            data: {
              documentPath: path,
              reason: "No chunks found for document",
            },
          });
          return;
        }

        this.logger.trace({
          level: "info",
          agentId: "rag-factory",
          action: "embedding_generation_started",
          data: {
            documentPath: path,
            chunkCount: chunks.length,
          },
        });

        // Generate embeddings for all chunks
        const embeddings =
          await this.components.embeddingManager.generateEmbeddings(chunks);

        // Store each embedding
        for (const embedding of embeddings) {
          this.components.embeddingManager.storeEmbedding(embedding);
        }

        this.logger.trace({
          level: "info",
          agentId: "rag-factory",
          action: "embedding_generation_completed",
          data: {
            documentPath: path,
            chunkCount: chunks.length,
            embeddingsGenerated: embeddings.length,
          },
          duration: Date.now() - start,
        });
      } catch (error) {
        this.logger.trace({
          level: "error",
          agentId: "rag-factory",
          action: "embedding_generation_failed",
          data: { documentPath: path },
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw - embedding generation failure shouldn't block document addition
        console.warn(
          `Warning: Embedding generation failed for ${path}: ${error}`,
        );
      }
    }
  }

  async removeDocument(path: string): Promise<void> {
    if (!this.components?.ragService) {
      throw new Error("RAG service not initialized");
    }

    // Remove document from RAG service
    await this.components.ragService.removeDocument(path);

    // Remove associated embeddings if enabled
    if (this.config.enableEmbeddings && this.components.embeddingManager) {
      try {
        const removed =
          this.components.embeddingManager.removeEmbeddingsForDocument(path);

        this.logger.trace({
          level: "info",
          agentId: "rag-factory",
          action: "document_embeddings_removed",
          data: {
            documentPath: path,
            embeddingsRemoved: removed,
          },
        });
      } catch (error) {
        this.logger.trace({
          level: "warn",
          agentId: "rag-factory",
          action: "embedding_removal_failed",
          data: { documentPath: path },
          error: error instanceof Error ? error.message : String(error),
        });
        // Don't throw - embedding removal failure shouldn't block document removal
      }
    }
  }

  getStats(): {
    enabled: boolean;
    ragStats?: ReturnType<RAGService["getStats"]>;
    embeddingStats?: ReturnType<EmbeddingManager["getStats"]>;
  } {
    return {
      enabled: this.config.enableRAG,
      ragStats: this.components?.ragService.getStats(),
      embeddingStats: this.components?.embeddingManager?.getStats(),
    };
  }

  private loadDefaultConfig(): RAGFactoryConfig {
    return {
      enableRAG: flag("FEATURE_RAG_CONTEXT", false),
      enableEmbeddings: flag("FEATURE_VECTOR_EMBEDDINGS", false),

      ragConfig: {
        enabled: flag("FEATURE_RAG_CONTEXT", false),
        topK: 5,
        minScore: 0.01,
        chunkOptions: {
          maxChars: 1200,
          overlap: 120,
          minChars: 200,
          strategy: "smart",
          respectMarkdown: true,
        },
        indexPaths: this.getIndexPaths(),
      },

      embeddingConfig: {
        enabled: flag("FEATURE_VECTOR_EMBEDDINGS", false),
        provider: "mock", // Safe default for development
        model: "mock-v1",
        batchSize: 10,
        cacheEnabled: true,
      },

      contextInjectorConfig: {
        enabled: flag("FEATURE_RAG_CONTEXT", false),
        maxContextTokens: 2000,
        contextTemplate: `## Reference Context

{context}

---

## Task

{originalPrompt}`,
        fallbackBehavior: "skip",
      },
    };
  }

  private getIndexPaths(): string[] {
    // Default paths to index for RAG
    const defaultPaths = ["./docs", "./README.md", "./CLAUDE.md"];

    // Allow override via environment variable
    const customPaths = process.env.RAG_INDEX_PATHS;
    if (customPaths) {
      return customPaths.split(",").map((p) => p.trim());
    }

    return defaultPaths;
  }
}

// Convenience function for easy integration
export async function initializeRAG(): Promise<RAGComponents | null> {
  const factory = RAGFactory.getInstance();
  return await factory.initialize();
}

export function getRAGService(): RAGService | null {
  return RAGFactory.getInstance().getRAGService();
}

export function getContextInjector(): ContextInjector | null {
  return RAGFactory.getInstance().getContextInjector();
}
