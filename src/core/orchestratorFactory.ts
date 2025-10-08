/**
 * SPDX-License-Identifier: BUSL-1.1
 * Copyright (c) 2025 [Your Company]
 */

import { Orchestrator } from "./orchestrator.js";
import { AgentRegistry } from "../shared/registry.js";
import { MessageBus } from "../shared/bus.js";
import { Logger } from "../shared/logger.js";
import { RAGService } from "../rag/service.js";
import { ConfigService } from "../shared/config.js";

export interface OrchestrationServiceOptions {
  configPath?: string;
  enableRAG?: boolean;
}

export class OrchestrationService {
  private orchestrator: Orchestrator;
  private ragService?: RAGService | undefined;
  private configService: ConfigService;

  private constructor(
    orchestrator: Orchestrator,
    ragService: RAGService | undefined,
    configService: ConfigService,
  ) {
    this.orchestrator = orchestrator;
    this.ragService = ragService || undefined;
    this.configService = configService;
  }

  static async create(
    registry: AgentRegistry,
    messageBus: MessageBus,
    logger: Logger,
    options: OrchestrationServiceOptions = {},
  ): Promise<OrchestrationService> {
    // Initialize configuration
    const configService = await ConfigService.initialize(options.configPath);
    const ragConfig = configService.getRAGConfig();

    // Initialize RAG service if enabled
    let ragService: RAGService | undefined;
    if (ragConfig.enabled || options.enableRAG) {
      ragService = new RAGService(ragConfig, logger);
      await ragService.initialize();

      await logger.trace({
        level: "info",
        agentId: "orchestration-service",
        action: "rag_initialized",
        data: ragService.getStats(),
      });
    } else {
      await logger.trace({
        level: "info",
        agentId: "orchestration-service",
        action: "rag_disabled",
        data: {
          configEnabled: ragConfig.enabled,
          optionEnabled: options.enableRAG,
        },
      });
    }

    // Create orchestrator with RAG service
    const orchestrator = new Orchestrator();

    return new OrchestrationService(orchestrator, ragService, configService);
  }

  getOrchestrator(): Orchestrator {
    return this.orchestrator;
  }

  getRAGService(): RAGService | undefined {
    return this.ragService;
  }

  getConfigService(): ConfigService {
    return this.configService;
  }

  async addDocumentToRAG(path: string, content?: string): Promise<void> {
    if (this.ragService) {
      await this.ragService.addDocument(path, content);
    }
  }

  async removeDocumentFromRAG(path: string): Promise<void> {
    if (this.ragService) {
      await this.ragService.removeDocument(path);
    }
  }

  getRAGStats() {
    return (
      this.ragService?.getStats() ?? {
        enabled: false,
        documentsCount: 0,
        chunksCount: 0,
        config: null,
      }
    );
  }
}
