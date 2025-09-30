import { BaseAgent } from "../core/baseAgent.js";
import { RAGService, type RAGConfig, type RAGContext } from "../rag/service.js";
import { Logger } from "../shared/logger.js";
import { AgentContext } from "../shared/types.js";

export interface ContextInjectionRequest {
  query: string;
  originalPrompt: string;
  domainHint?: string;
  maxContextLength?: number;
}

export interface ContextInjectionResult {
  enhancedPrompt: string;
  ragContext: RAGContext;
  injectionStats: {
    chunksUsed: number;
    contextLength: number;
    searchDuration: number;
    truncated: boolean;
    tokenBudget: {
      originalChunks: number;
      selectedChunks: number;
      estimatedTokens: number;
      budgetLimit: number;
      utilizationRate: number;
    };
  };
}

export interface ContextInjectorConfig {
  enabled: boolean;
  maxContextTokens: number;
  contextTemplate: string;
  fallbackBehavior: "skip" | "partial" | "error";
}

/**
 * RAG Context Injector Component
 *
 * Integrates with the 8-Agent system to provide document-based context
 * for QA generation. Follows all system standards including Feature Flags,
 * performance monitoring, and graceful degradation.
 */
export class ContextInjector extends BaseAgent {
  private ragService: RAGService;
  private config: ContextInjectorConfig;
  private isEnabled: boolean;

  constructor(
    ragService: RAGService,
    config: ContextInjectorConfig,
    logger: Logger,
  ) {
    super(
      "context-injector",
      "Document Context Integration",
      ["rag", "context", "enhancement"],
      logger,
    );

    this.ragService = ragService;
    this.config = config;
    this.isEnabled = process.env.FEATURE_RAG_CONTEXT === "true" && config.enabled;

    // Log initialization status for system monitoring
    this.logger.trace({
      level: "info",
      agentId: this.id,
      action: "component_initialized",
      data: {
        enabled: this.isEnabled,
        featureFlag: process.env.FEATURE_RAG_CONTEXT,
        configEnabled: config.enabled,
      },
    });
  }

  async handle(
    content: unknown,
    _context?: AgentContext,
  ): Promise<ContextInjectionResult> {
    const request = this.validateRequest(content);
    const start = Date.now();

    // Graceful degradation: if disabled, return original prompt
    if (!this.isEnabled) {
      return this.createFallbackResult(request, "feature_disabled");
    }

    try {
      // Search for relevant context
      const ragContext = await this.ragService.search(request.query, {
        topK: 5,
        minScore: 0.1,
      });

      // Build enhanced prompt with context and get token budget info
      const { enhancedPrompt, tokenBudgetInfo } = this.buildEnhancedPromptWithBudget(request, ragContext);

      const result: ContextInjectionResult = {
        enhancedPrompt,
        ragContext,
        injectionStats: {
          chunksUsed: tokenBudgetInfo.selectedChunks,
          contextLength: this.calculateContextLength(ragContext),
          searchDuration: ragContext.searchDuration,
          truncated: tokenBudgetInfo.originalChunks > tokenBudgetInfo.selectedChunks,
          tokenBudget: tokenBudgetInfo,
        },
      };

      await this.logger.trace({
        level: "debug",
        agentId: this.id,
        action: "context_injection_completed",
        data: {
          originalPromptLength: request.originalPrompt.length,
          enhancedPromptLength: enhancedPrompt.length,
          chunksRetrieved: ragContext.retrievedChunks.length,
          searchDuration: ragContext.searchDuration,
        },
        duration: Date.now() - start,
      });

      return result;

    } catch (error) {
      await this.logger.trace({
        level: "error",
        agentId: this.id,
        action: "context_injection_failed",
        data: { query: request.query.substring(0, 100) },
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - start,
      });

      // Graceful degradation on error
      return this.createFallbackResult(request, "search_error");
    }
  }

  async assessConfidence(
    result: unknown,
    _context?: AgentContext,
  ): Promise<number> {
    const injectionResult = result as ContextInjectionResult;

    // Confidence based on number of relevant chunks found
    const baseConfidence = 0.7;
    const chunkBonus = Math.min(injectionResult.ragContext.retrievedChunks.length * 0.1, 0.3);

    return Math.min(baseConfidence + chunkBonus, 1.0);
  }

  getCapabilities(): string[] {
    return [
      "document_context_retrieval",
      "prompt_enhancement",
      "rag_integration",
      "graceful_degradation",
    ];
  }

  getHealthStatus(): {
    status: "healthy" | "degraded" | "error";
    details: Record<string, unknown>;
  } {
    const ragStats = this.ragService.getStats();

    return {
      status: this.isEnabled && ragStats.enabled ? "healthy" : "degraded",
      details: {
        enabled: this.isEnabled,
        ragServiceEnabled: ragStats.enabled,
        documentsIndexed: ragStats.documentsCount,
        chunksAvailable: ragStats.chunksCount,
        featureFlag: process.env.FEATURE_RAG_CONTEXT,
      },
    };
  }

  private validateRequest(content: unknown): ContextInjectionRequest {
    if (!content || typeof content !== "object") {
      throw new Error("Invalid request: expected object");
    }

    const req = content as Record<string, unknown>;

    if (typeof req.query !== "string" || typeof req.originalPrompt !== "string") {
      throw new Error("Invalid request: missing query or originalPrompt");
    }

    return {
      query: req.query,
      originalPrompt: req.originalPrompt,
      domainHint: typeof req.domainHint === "string" ? req.domainHint : undefined,
      maxContextLength: typeof req.maxContextLength === "number" ? req.maxContextLength : this.config.maxContextTokens,
    };
  }

  private createFallbackResult(
    request: ContextInjectionRequest,
    reason: string,
  ): ContextInjectionResult {
    this.logger.trace({
      level: "warn",
      agentId: this.id,
      action: "fallback_result_created",
      data: { reason },
    });

    const estimatedTokens = Math.ceil(request.originalPrompt.length / 3);
    const budgetLimit = request.maxContextLength || this.config.maxContextTokens;

    return {
      enhancedPrompt: request.originalPrompt, // Return original prompt unchanged
      ragContext: {
        query: request.query,
        retrievedChunks: [],
        totalChunks: 0,
        searchDuration: 0,
      },
      injectionStats: {
        chunksUsed: 0,
        contextLength: 0,
        searchDuration: 0,
        truncated: false,
        tokenBudget: {
          originalChunks: 0,
          selectedChunks: 0,
          estimatedTokens,
          budgetLimit,
          utilizationRate: 0,
        },
      },
    };
  }

  private buildEnhancedPromptWithBudget(
    request: ContextInjectionRequest,
    ragContext: RAGContext,
  ): { enhancedPrompt: string; tokenBudgetInfo: ContextInjectionResult['injectionStats']['tokenBudget'] } {
    if (ragContext.retrievedChunks.length === 0) {
      return {
        enhancedPrompt: request.originalPrompt,
        tokenBudgetInfo: {
          originalChunks: 0,
          selectedChunks: 0,
          estimatedTokens: Math.ceil(request.originalPrompt.length / 3),
          budgetLimit: request.maxContextLength || this.config.maxContextTokens,
          utilizationRate: 0,
        },
      };
    }

    // Token budget management: prevent LLM API failures
    const maxContextTokens = request.maxContextLength || this.config.maxContextTokens;
    const budgetSafetyMargin = 0.7; // Use 70% of budget for context, leave 30% for prompt/response
    const effectiveTokenBudget = Math.floor(maxContextTokens * budgetSafetyMargin);

    // Estimate tokens (rough: 1 token ≈ 4 characters for English, 2 chars for mixed)
    const estimateTokens = (text: string): number => Math.ceil(text.length / 3);

    // Select chunks within token budget
    const selectedChunks = [...ragContext.retrievedChunks];
    const totalTokens = estimateTokens(request.originalPrompt) + 50; // Base prompt + template overhead

    // Reduce chunks if budget exceeded
    while (selectedChunks.length > 0) {
      const currentContextLength = selectedChunks.reduce(
        (total, item) => total + item.chunk.content.length, 0
      );
      const contextTokens = estimateTokens(currentContextLength.toString());

      if (totalTokens + contextTokens <= effectiveTokenBudget) {
        break; // Within budget
      }

      // Remove the lowest scoring chunk (they're sorted by score desc)
      selectedChunks.pop();

      this.logger.trace({
        level: "info",
        agentId: this.id,
        action: "token_budget_chunk_removed",
        data: {
          remainingChunks: selectedChunks.length,
          estimatedTokens: totalTokens + contextTokens,
          tokenBudget: effectiveTokenBudget,
        },
      });
    }

    if (selectedChunks.length === 0) {
      this.logger.trace({
        level: "warn",
        agentId: this.id,
        action: "token_budget_no_chunks",
        data: { originalPromptLength: request.originalPrompt.length },
      });
      return {
        enhancedPrompt: request.originalPrompt,
        tokenBudgetInfo: {
          originalChunks: ragContext.retrievedChunks.length,
          selectedChunks: 0,
          estimatedTokens: estimateTokens(request.originalPrompt),
          budgetLimit: effectiveTokenBudget,
          utilizationRate: 0,
        },
      }; // Fallback to original prompt
    }

    // Build context section from selected chunks
    const contextSections = selectedChunks.map((chunk, index) => {
      return `[Context ${index + 1}]\n${chunk.chunk.content}\n`;
    }).join("\n");

    // Apply template or use default format
    const template = this.config.contextTemplate || `
{context}

---

Based on the above context, please answer the following:

{originalPrompt}
    `.trim();

    const enhancedPrompt = template
      .replace("{context}", contextSections)
      .replace("{originalPrompt}", request.originalPrompt);

    // Log token budget usage
    const finalTokenEstimate = estimateTokens(enhancedPrompt);
    this.logger.trace({
      level: "debug",
      agentId: this.id,
      action: "token_budget_applied",
      data: {
        originalChunks: ragContext.retrievedChunks.length,
        selectedChunks: selectedChunks.length,
        estimatedTokens: finalTokenEstimate,
        tokenBudget: effectiveTokenBudget,
        utilizationRate: (finalTokenEstimate / effectiveTokenBudget).toFixed(2),
      },
    });

    return {
      enhancedPrompt,
      tokenBudgetInfo: {
        originalChunks: ragContext.retrievedChunks.length,
        selectedChunks: selectedChunks.length,
        estimatedTokens: finalTokenEstimate,
        budgetLimit: effectiveTokenBudget,
        utilizationRate: parseFloat((finalTokenEstimate / effectiveTokenBudget).toFixed(2)),
      },
    };
  }

  private calculateContextLength(ragContext: RAGContext): number {
    return ragContext.retrievedChunks.reduce(
      (total, item) => total + item.chunk.content.length,
      0,
    );
  }
}

// Component registration for Self-Designing System
export const RAGContextComponent = {
  id: "rag-context-injector",
  name: "RAG Context Injector",
  status: "active" as const,
  dependencies: ["rag-service", "qa-generator"] as const,
  healthCheck: (injector: ContextInjector) => injector.getHealthStatus(),
  capabilities: ["document_context_retrieval", "prompt_enhancement"],
  version: "1.0.0",
  featureFlag: "FEATURE_RAG_CONTEXT",
};